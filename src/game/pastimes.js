// Tavern pastimes. Sit down with someone at a table and play at hazard: you call the main, throw two dice,
// and a nick wins, a crab loses, anything else becomes your chance and you throw till it comes again (you
// win) or the main does (you lose). Stakes come out of real purses. Use loaded dice if you're sly enough,
// but be caught at it and there'll be trouble. Or stand the whole house a round: everyone drinking there
// thinks better of you.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    const FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const d6 = (loaded) => { const r = 1 + Math.floor(Math.random() * 6); return loaded && Math.random() < 0.35 ? 6 : r; };
    const seatedAt = (sc, it) => { const [x, y] = sc.anchor(it); return [...sc.actors.values()].filter((a) => !a.hidden && a.person && a.person.age >= 16 && (a.seat || ['sit', 'eat', 'drink', 'talk'].includes(a.gAnim || a.anim)) && Math.hypot((a.gx ?? a.x) - a.x, (a.gy ?? a.y) - a.y) < 6 && Math.hypot(a.x - x, a.y - y) < 44 && a.person.activity?.act !== 'work').map((a) => a.person); };
    let playing = null;
    const prevScene = O.sceneCandidate;
    O.sceneCandidate = () => {
      const sc = game.scene, base = prevScene ? prevScene() : null;
      if (!sc || playing || !['tavern', 'inn', 'alehouse'].includes(sc.b.type)) return base;
      const p = game.player; let best = null;
      for (const it of sc.L.items) {
        if (it.kind !== 'table') continue;
        const [x, y] = sc.anchor(it), d = Math.hypot(x - p.x, y - p.y); if (d > (p.sitting ? 52 : 40)) continue;
        const who = seatedAt(sc, it); if (!who.length) continue;
        const c = { type: 'custom', d: p.sitting ? -5 : d + 2, label: `Play at dice with ${who[0].first}`, act: () => dice(who[0]) }; // (sit down at the table and it's the first thing offered)
        if (!best || c.d < best.d) best = c;
      }
      // a round for the house, at the bar
      const bar = sc.L.items.find((i) => i.kind === 'bar' || i.counter);
      if (bar) { const [x, y] = sc.anchor(bar), d = Math.hypot(x - p.x, y + 10 - p.y); if (d < 44) { const n = [...sc.actors.values()].filter((a) => !a.hidden && a.person && a.person.age >= 16 && a.person.activity?.act !== 'work').length; if (n >= 2) { const c = { type: 'custom', d: d + 6, label: `Stand the house a round (₳${2 + n})`, act: () => round(n) }; if (!best || c.d < best.d) best = c; } } }
      if (best && (!base || best.d < base.d)) return best;
      return base;
    };
    function round(n) {
      const s = cur(), sc = game.scene, cost = 2 + n; if (PS.money < cost) return say(`That's ₳${cost} for the whole house.`, 'bad');
      PS.money -= cost; const bz = s.biz.get(sc.b.id); if (bz) { bz.cash += cost; bz.salesToday = (bz.salesToday || 0) + cost; if (bz.stock.ale != null) bz.stock.ale = Math.max(0, bz.stock.ale - n * 0.3); }
      for (const a of sc.actors.values()) if (a.person && a.person.activity?.act !== 'work') { s.relate(a.person, { id: 0 }, 0.08); a.anim = 'celebrate'; }
      PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.03);
      say(`"A round for the house!" Cups are filled and raised to you. ${n} people drink your health.`);
    }
    function dice(q) {
      const s = cur(), hh = s.household(q), purse = Math.floor(hh ? hh.money : 10), aff = q.rel.get(0)?.affinity || 0;
      if (purse < 2) return say(`${q.first} turns out empty pockets. "Nothing to stake, friend."`);
      if (aff < -0.3) return say(`${q.first} won't throw dice with you.`, 'bad');
      const stakes = [1, 2, 5, 10].filter((n) => n <= Math.min(purse, 20));
      const sly = (PS.skills.stealth || 0) + (PS.skills.sleight || 0);
      O.UI.dialog.open({ name: `Hazard with ${q.first}`, color: '#5a3a1a', text: `${q.first} rattles two bone dice in a cup. "What's the stake?"`, options: [...stakes.map((n) => ({ key: 's' + n, label: `₳${n} a throw` })), ...(sly > 0.2 ? [{ key: 'l5', label: 'Swap in loaded dice (₳5)' }] : []), { key: 'no', label: 'Not now' }], onPick: (k) => {
        O.UI.dialog.close(); if (k === 'no') return;
        const stake = +k.slice(1), loaded = k[0] === 'l';
        if (PS.money < stake) return say(`You haven't ₳${stake}.`, 'bad');
        playing = { q, stake, loaded }; game.player.locked = true; throwOnce(s, [], null);
      } });
    }
    // one throw at a time, so you see each fall of the dice
    function throwOnce(s, history, chance) {
      const { q, stake, loaded } = playing;
      const a = d6(loaded), b = d6(loaded), t = a + b; history.push(`${FACE[a]} ${FACE[b]} (${t})`);
      let res = null;
      if (chance == null) { if (t === 7 || t === 11) res = 'win'; else if (t === 2 || t === 3 || t === 12) res = 'lose'; else chance = t; }
      else if (t === chance) res = 'win'; else if (t === 7) res = 'lose';
      const lines = history.map((h, i) => `${i ? 'Again' : 'You throw'}: ${h}`).join('. ');
      if (!res) return O.UI.dialog.open({ name: `Hazard with ${q.first}`, color: '#5a3a1a', text: `${lines}. Your chance is ${chance}: throw until it comes again, but a 7 loses.`, options: [{ key: 'go', label: 'Throw again' }], onPick: () => { O.UI.dialog.close(); throwOnce(s, history, chance); } });
      settle(s, res, lines);
    }
    function settle(s, res, lines) {
      const { q, stake, loaded } = playing; playing = null; game.player.locked = false;
      const hh = s.household(q);
      // loaded dice can be noticed
      if (loaded && Math.random() < 0.3 - (PS.skills.stealth || 0) * 0.2) {
        s.relate(q, { id: 0 }, -0.7); s.remember(q, 'Caught the stranger cheating at dice.', 'crime', 2, 0);
        const cr = s.recordCrime({ kind: 'cheating at dice', perp: 'player', placeName: game.scene?.b.name || 'the tavern', tile: [Math.floor(game.player.x / T), Math.floor(game.player.y / T)], seen: [q], victimPerson: q, severity: 1 });
        PS.crimes.push(cr.id); PS.rep.local = Math.max(-1, (PS.rep.local || 0) - 0.1);
        return O.UI.dialog.open({ name: q.first, color: '#7a1a1a', text: `${lines}. ${q.first} snatches up the dice and weighs them in a palm. "Loaded! You cheating cur!" The room goes quiet.`, options: [{ key: 'ok', label: 'Back away' }], onPick: () => O.UI.dialog.close() });
      }
      if (res === 'win') { const n = Math.min(stake, Math.floor(hh ? hh.money : stake)); if (hh) hh.money -= n; PS.money += n; s.relate(q, { id: 0 }, n > 4 ? -0.05 : 0.02); PS.skills.gambling = Math.min(1, (PS.skills.gambling || 0) + 0.01); }
      else { PS.money -= stake; if (hh) hh.money += stake; s.relate(q, { id: 0 }, 0.04); }
      O.UI.dialog.open({ name: `Hazard with ${q.first}`, color: res === 'win' ? '#2a5a2a' : '#5a1a1a', text: `${lines}. ${res === 'win' ? `You win ₳${stake}. ${q.first} pushes the coins across with a scowl.` : `You lose ₳${stake}. ${q.first} sweeps the coins up, grinning.`}`, options: [{ key: 'again', label: 'Another throw' }, { key: 'stop', label: 'Enough' }], onPick: (k) => { O.UI.dialog.close(); if (k === 'again') dice(q); } });
    }
  }
  O.PastimesSetup = { setup };
})();
// Fishing for yourself: with a rod, at the edge of a river, lake or the sea. Half an hour a cast; what bites
// depends on the season, the hour and how practised you are.
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k);
    const waterBeside = () => { const w = game.world, p = game.player; if (!w || game.scene) return null; for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 2], [1, 1], [-1, 1]]) { const tx = Math.floor(p.x / T) + dx, ty = Math.floor((p.y - 2) / T) + dy, i = ty * w.W + tx; if (tx >= 0 && ty >= 0 && tx < w.W && ty < w.H && w.ter[i] === w.TER.WATER) return [tx, ty]; } return null; };
    let busy = 0, after = null;
    game.hooks.update.push((dt) => { if (busy > 0) { busy -= dt; game.player.locked = true; game.player.anim = 'fish'; if (busy <= 0) { game.player.locked = false; game.player.anim = 'idle'; const f = after; after = null; f && f(); } } });
    const hook = () => {
      const prev = O.stallCandidate;
      O.stallCandidate = () => {
        const base = prev ? prev() : null;
        if (busy > 0 || game.scene || !PS.items.includes('rod') || game.player.mount) return base;
        const wt = waterBeside(); if (!wt) return base;
        const c = { type: 'custom', d: 14, label: 'Cast a line (half an hour)', act: cast, x: wt[0] * T + 8, y: wt[1] * T - 20 };
        return base && base.d < c.d ? base : c;
      };
    };
    let hooked = false; game.hooks.update.push(() => { if (!hooked) { hooked = true; hook(); } });
    function cast() {
      const s = cur(), wt = waterBeside(); if (!wt) return;
      game.player.dir = O.dirOf(wt[0] * T + 8 - game.player.x, wt[1] * T + 8 - game.player.y);
      busy = 3.2; after = () => {
        for (let i = 0; i < 15; i++) { s.tick(2); PS.tick(2, false); }
        const sk = PS.skills.fishing || 0, h = s.hour, good = (h < 9 || h > 17) ? 0.15 : 0, cold = s.season === 'winter' ? -0.15 : 0;
        PS.skills.fishing = Math.min(1, sk + 0.01);
        if (Math.random() < 0.38 + sk * 0.4 + good + cold) {
          if (!PS.canCarry('fish')) return say('A fish! But your satchel is full, and it slips back into the water.', 'bad');
          PS.add('fish'); const big = Math.random() < 0.15 + sk * 0.2;
          if (big && PS.canCarry('fish')) PS.add('fish');
          say(big ? 'The line goes taut: two good fish before the light changes.' : 'A tug, a fight, and a fish flapping on the bank.');
        } else say(['Nothing bites. The water keeps its own counsel.', 'A nibble, then nothing. The bait is gone.', 'You watch the float a long while. Nothing.'][Math.floor(Math.random() * 3)]);
      };
    }
  }
  O.FishingSetup = { setup };
})();
