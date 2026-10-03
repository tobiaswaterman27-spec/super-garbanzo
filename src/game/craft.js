// Making things yourself, and selling them. At a workstation you may use — in a building you own,
// or at your employer's while you're working there — turn your own materials into goods: bake,
// forge, saw, brew, mill, brew remedies or cook. Skill decides what you can attempt and how much it
// yields, and the work teaches you more. Then mind a market stall for an hour and sell what you made
// to the townsfolk, who really pay from their purses and really eat what they buy.
'use strict';
(function () {
  const G = O.Data.GOODS;
  // station kinds → recipes: [label, inputs, outputs, skill, min skill]
  const RECIPES = {
    oven: [['Bake bread', { flour: 2, firewood: 1 }, { bread: 5 }, 'baking', 0.12]],
    fireplace: [['Cook a hot meal', { bread: 1, cabbage: 1 }, { meal: 2 }, 'serving', 0], ['Cook a hot meal (fish)', { bread: 1, fish: 1 }, { meal: 2 }, 'serving', 0], ['Cook a hot meal (meat)', { bread: 1, meat: 1 }, { meal: 3 }, 'serving', 0.1]],
    forge: [['Forge tools', { iron: 2, firewood: 1 }, { tools: 1 }, 'smithing', 0.25], ['Forge a dagger', { iron: 2, firewood: 1 }, { dagger: 1 }, 'smithing', 0.35], ['Forge a hand axe', { iron: 2, firewood: 1, logs: 1 }, { axe: 1 }, 'smithing', 0.4], ['Forge a sword', { iron: 4, firewood: 2 }, { sword: 1 }, 'smithing', 0.65], ['Beat out a helm', { iron: 4, firewood: 2 }, { helm: 1 }, 'smithing', 0.55]],
    workbench: [['Split firewood', { logs: 1 }, { firewood: 3 }, 'woodcraft', 0], ['Saw planks', { logs: 1 }, { planks: 1 }, 'woodcraft', 0.15], ['Make a chair', { planks: 2 }, { furniture: 1 }, 'woodcraft', 0.4]],
    cauldron: [['Brew a remedy', { herbs: 2 }, { medicine: 1 }, 'physic', 0.3], ['Cook a stew', { cabbage: 2, meat: 1 }, { meal: 3 }, 'serving', 0.15]],
    millstone: [['Grind flour', { wheat: 2 }, { flour: 2 }, 'milling', 0]],
    barrel: [['Brew ale', { wheat: 2 }, { ale: 3 }, 'serving', 0.25]],
  };
  RECIPES.anvil = RECIPES.forge;

  function setup(game) {
    const PS = O.PlayerState, toast = (t, k) => O.Panels.toast(t, k), cur = () => O.SimRef.cur, esc = (s) => O.escape(String(s));
    const skill = (k) => (PS.skills && PS.skills[k]) || 0;
    function mayUse(scene) {
      const b = scene.b;
      if (b.owner && b.owner.kind === 'player') return 'your own';
      if (PS.room && PS.room.b === b.id && cur().day <= PS.room.until) return null; // a rented bed isn't a workshop
      const J = O.Work && O.Work.job(); const bz = J && cur().biz.get(J.biz);
      if (J && J.biz === b.id && bz && bz.open) return `${J.masterName}'s`;
      return null;
    }
    O.craftCandidate = (scene, it, d, cx, cy) => {
      if (!RECIPES[it.kind] || scene.floor !== 0 && it.kind !== 'fireplace') return null;
      if (it.kind === 'barrel' && scene.b.type !== 'tavern' && !(scene.b.owner && scene.b.owner.kind === 'player')) return null;
      const who = mayUse(scene); if (!who) return null;
      const J = O.Work && O.Work.job(); if (J && J.biz === scene.b.id && !(scene.b.owner && scene.b.owner.kind === 'player')) return null; // the work prompt covers it
      return { type: 'craft', it, who, d: d - 13, x: cx, y: cy };
    };
    O.craftLabel = (c) => `Make something at the ${c.it.kind === 'fireplace' ? 'hearth' : c.it.kind}`;
    O.craftPanel = (c) => {
      const rows = RECIPES[c.it.kind].map((rc, i) => {
        const [label, inp, out, sk, min] = rc;
        const have = Object.entries(inp).every(([g, n]) => PS.count(g) >= n), able = skill(sk) >= min;
        const yieldN = (n) => n + (skill(sk) >= 0.7 && n > 1 ? 1 : 0);
        return `<tr><td><b>${esc(label)}</b><br><small class="caption">${Object.entries(inp).map(([g, n]) => `${n} ${G[g].name.toLowerCase()} (${PS.count(g)})`).join(', ')} → ${Object.entries(out).map(([g, n]) => `${yieldN(n)} ${G[g].name.toLowerCase()}`).join(', ')}</small></td>
          <td>${able ? '' : `<small class="warn">needs ${O.Work.SKILL_LABEL[sk].toLowerCase()} ${Math.round(min * 100)}</small>`}</td><td><button data-r="${i}" ${have && able ? '' : 'disabled'}>Make · 1 hour</button></td></tr>`;
      }).join('');
      const workRow = c.work ? `<tr><td><b>Work an hour for ${esc(c.who.replace(/'s$/, ''))}</b><br><small class="caption">${esc(O.workLabel())} — the master's materials, the master's goods, your wages</small></td><td></td><td><button data-work="1" class="hot">Work · 1 hour</button></td></tr>` : '';
      O.Panels.open(`At the ${c.it.kind === 'fireplace' ? 'hearth' : c.it.kind}`, `<p class="caption">${c.work ? 'Work for wages with the master\'s materials, or make something' : 'Make something'} with your own at ${esc(c.who)} ${c.it.kind === 'fireplace' ? 'hearth' : 'bench'}. What you make from your own materials is yours to keep or sell.</p><table><tbody>${workRow}${rows}</tbody></table>`, (r) => {
        const w = r.querySelector('[data-work]'); if (w) w.onclick = () => { O.Panels.close(); O.workShift(); };
        r.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => make(c, RECIPES[c.it.kind][+b.dataset.r]));
      });
    };
    function make(c, rc) {
      const [label, inp, out, sk] = rc, s = cur();
      if (PS.energy < 10) return toast("You're too tired to work.", 'bad');
      let room = PS.SLOTS - PS.slotsUsed() + Object.entries(inp).reduce((t, [g, n]) => t + (G[g].slots || 1) * n, 0);
      const extra = skill(sk) >= 0.7 ? 1 : 0;
      const need = Object.entries(out).reduce((t, [g, n]) => t + (G[g].slots || 1) * (n + (n > 1 ? extra : 0)), 0);
      if (need > room) return toast('Your satchel would not hold what you make. Make room first.', 'bad');
      for (const [g, n] of Object.entries(inp)) PS.remove(g, n);
      game.player.anim = 'work';
      for (let i = 0; i < 30; i++) { s.tick(2); PS.tick(2, false); }
      PS.energy = Math.max(0, PS.energy - 3);
      const made = [];
      for (const [g, n] of Object.entries(out)) { const k = n + (n > 1 ? extra : 0); PS.add(g, k); made.push(`${k} ${G[g].name.toLowerCase()}`); }
      const before = skill(sk); PS.skills[sk] = Math.min(1, before + 0.005 * (1 - before * 0.8));
      PS.made = (PS.made || 0) + 1;
      O.Panels.close(); toast(`${label}: ${made.join(', ')}.`);
      setTimeout(() => { if (game.player.anim === 'work') game.player.anim = 'idle'; }, 1200);
    }

    // ---------------------------------------------------------------- the market stall
    O.stallCandidate = () => {
      if (game.scene) return null;
      const s = cur();
      for (const pr of s.world.props) if (pr.kind === 'stall') { const d = Math.hypot(pr.x - game.player.x, pr.y - game.player.y); if (d < 30) return { type: 'stall', prop: pr, d: d + (sellable().length ? -10 : 3), x: pr.x, y: pr.y - 30 }; }
      return null;
    };
    const sellable = () => [...new Set(PS.items)].filter((k) => G[k] && G[k].base > 0 && !G[k].valuable && !G[k].quest);
    O.stallLabel = () => (sellable().length ? 'Mind a stall for an hour' : 'An empty stall (nothing to sell)');
    O.mindStall = () => {
      const s = cur(), h = s.hour;
      if (!sellable().length) return toast('You have nothing to sell. Make or buy something first.', 'bad');
      if (h < 8 || h >= 18 || s.weekday === 6) return toast('No one buys at a stall at this hour. Come back in market hours (8 to 6, not Sundays).', 'bad');
      if (O.refusesTrade && PS.rep.local < -0.55) return toast('People cross the street rather than buy from you.', 'bad');
      const st = O.stallCandidate(); if (st) { game.player.x = st.prop.x; game.player.y = st.prop.y - 20; game.player.dir = 0; } // behind the counter
      game.player.anim = 'talk';
      for (let i = 0; i < 30; i++) { s.tick(2); PS.tick(2, false); }
      // how many come by: market day, a good name and good company help
      const busy = (s.weekday === 4 ? 2 : 1) * (s.people.length > 200 ? 1.8 : 1);
      const callers = Math.round((2 + s.rng.int(0, 4)) * busy * (1 + Math.max(-0.5, PS.rep.local + PS.rep.merchant * 0.5) + skill('trading') * 0.6));
      const priceOf = (g) => { const bz = [...s.biz.values()].find((b) => b.def.sells.includes(g)); return Math.max(1, Math.round((bz ? s.price(bz, g) : G[g].base) * (0.95 + skill('trading') * 0.15))); };
      const buyers = s.households.filter((hh) => !hh.gone && hh.money > 8).sort(() => s.rng.next() - 0.5);
      let sold = [], take = 0;
      for (let i = 0; i < callers && buyers.length; i++) {
        const goods = sellable(); if (!goods.length) break;
        const g = s.rng.pick(goods), pr = priceOf(g), hh = buyers[i % buyers.length];
        if (hh.money < pr * 1.5) continue;
        PS.remove(g); hh.money -= pr; PS.money += pr; take += pr; sold.push(G[g].name.toLowerCase());
        if (G[g].food) hh.pantry[g] = (hh.pantry[g] || 0) + 1;
        const tax = Math.round(pr * s.treasury.taxRate); s.treasury.cash += tax; PS.money -= tax; take -= tax;
      }
      PS.skills.trading = Math.min(1, skill('trading') + 0.006 * sold.length);
      if (sold.length) PS.rep.merchant = Math.min(1, PS.rep.merchant + 0.01);
      PS.earned = (PS.earned || 0) + Math.max(0, Math.round(take));
      const tally = {}; for (const x of sold) tally[x] = (tally[x] || 0) + 1;
      toast(sold.length ? `An hour at the stall: sold ${Object.entries(tally).map(([k, n]) => `${n} ${k}`).join(', ')} for ${O.money(Math.round(take))} after the market tax.` : 'An hour at the stall, and hardly a soul stopped. Better luck on market day.');
      setTimeout(() => { if (game.player.anim === 'talk') game.player.anim = 'idle'; }, 1500);
    };
  }

  O.Craft = { setup, RECIPES };
})();
