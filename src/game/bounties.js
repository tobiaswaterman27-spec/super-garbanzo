// Hired work and bounties. The watch house keeps a bounty board and the tavern a board of hired work.
// One contract at a time:
//   a bounty on a known thief (a gang hand of the town): find them (the arrow shows the way) and take
//     them in; they may come quietly, run, or fight;
//   escort a merchant: meet them at the tavern and walk them to the edge of town; on the way there may
//     be trouble on the road, to fight off or pay off;
//   clear a bandit camp: the gang's den in the woods outside town; go there and drive them out.
// Paid in coin, and the watch think better of you.
'use strict';
(function () {
  const T = 16;
  function setup(game, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    const now = (s) => s.day * 1440 + s.minute;
    const fightSkill = () => O.clamp(0.3 + (PS.skills.fighting || PS.skills.combat || 0) * 0.5 + (PS.items.includes('sword') ? 0.15 : PS.items.includes('axe') || PS.items.includes('dagger') ? 0.08 : 0) + (PS.items.includes('helm') ? 0.05 : 0) + PS.hp / 100 * 0.1, 0.1, 0.92);
    const learn = (k) => { PS.skills.fighting = Math.min(1, (PS.skills.fighting || 0) + k); };

    // ---------------------------------------------------------------- what's on offer in a town today
    function offers(s, where) {
      const r = O.RNG(O.hash('bounty', s.world.placeId || 'x', s.day, where)), out = [];
      if (where === 'watch') {
        const rogues = s.people.filter((q) => q.gang && q.gang !== 'player' && q.alive !== false && !q.visitor && q.task?.act !== 'jailed');
        for (const q of rogues.slice(0, 6).sort(() => r.next() - 0.5).slice(0, 2)) { const g = s.gang(q.gang); out.push({ kind: 'thief', target: q.id, reward: 20 + r.int(0, 4) * 5, text: `Wanted: ${q.name}, who runs with ${g ? g.name : 'a gang'}. Bring them to the watch.` }); }
        const den = s.world.buildings.find((b) => b.type === 'hideout' && b.gang && b.gang !== 'player' && !b.roadKey);
        if (den) out.push({ kind: 'camp', target: den.id, reward: 60 + r.int(0, 4) * 10, text: `The watch will pay to see ${den.name} cleared out.` });
      } else {
        out.push({ kind: 'escort', reward: 15 + r.int(0, 3) * 5, text: `A merchant wants a strong arm to see them and their goods safe to the edge of town.` });
      }
      return out.filter((o) => !(PS.contract && PS.contract.kind === o.kind && PS.contract.target === o.target));
    }
    function board(where) {
      const s = cur(), list = offers(s, where), C = PS.contract;
      const mine = C ? `<p class="caption">Your contract: ${esc(C.text)} (₳${C.reward}).</p><div class="topics"><button data-drop="1">Give it up</button></div>` : '';
      O.Panels.open(where === 'watch' ? 'The bounty board' : 'Hired work', `<p class="speech">${where === 'watch' ? 'Nailed to the watch-house door, under the town\'s seal.' : 'Notes pinned by the tavern door, some in a good hand, some in a poor one.'}</p>${list.length ? `<table><tbody>${list.map((o, i) => `<tr><td>${esc(o.text)}</td><td class="n">₳${o.reward}</td><td><button data-take="${i}" ${C ? 'disabled' : ''}>Take it</button></td></tr>`).join('')}</tbody></table>` : '<p>Nothing posted today.</p>'}${mine}`, (r) => {
        r.querySelectorAll('[data-take]').forEach((b) => b.onclick = () => { take(s, list[+b.dataset.take]); O.Panels.close(); });
        const d = r.querySelector('[data-drop]'); if (d) d.onclick = () => { drop(s, 'You give up the contract.'); O.Panels.close(); };
      });
    }
    function take(s, o) {
      PS.contract = Object.assign({ place: s.world.placeId, until: now(s) + 1440 * 2 }, o);
      if (o.kind === 'thief') { O.addLead({ place: s.world.placeId, id: o.target, until: PS.contract.until, why: 'contract', label: 'The bounty' }); say('You take the bounty. The marker will show you where they are; talk to them to take them in.'); }
      if (o.kind === 'camp') { O.addLead({ place: s.world.placeId, b: o.target, until: PS.contract.until, why: 'contract', label: 'The bandit camp' }); } if (o.kind === 'camp') say(`You take the contract. ${s.building(o.target).name} lies outside town: go there and press E at its door.`);
      if (o.kind === 'escort') {
        const r = O.RNG(O.hash('esc', s.day)), sex = r.chance(0.7) ? 'm' : 'f', D = O.Data, Ch = O.Char;
        const q = s.newPerson({ sex, age: r.int(28, 55), first: r.pick(D.NAMES[sex]), sur: r.pick(['Chapman', 'of Goldmere', 'Woolman', 'Packer']), household: 0, home: null, genes: Ch.randomGenes(r, 'south'), wealth: 0.65, visitor: true });
        q.name = `${q.first} ${q.sur}`; q.job = { biz: null, role: 'merchant' }; q.wake = 0; q.bed = 1440; q.app = Ch.makeAppearance(O.hash('escort', q.id), { sex, age: q.age, genes: q.genes, role: 'merchant', wealth: 0.65 });
        const tv = s.building(s.tavernId), [ex, ey] = s.entry(tv);
        q.agent = { x: ex * T + 8, y: ey * T + 12, dir: 0, anim: 'idle', ft: 0, a: q.app, hidden: false, inside: null, path: null, goal: null, person: q, frozen: true, carrying: { good: 'cloth', qty: 1 } };
        q.escortee = true; PS.contract.target = q.id; O.addLead({ place: s.world.placeId, id: q.id, until: PS.contract.until, why: 'contract', label: 'The merchant to escort' });
        say(`The merchant, ${q.name}, waits outside ${tv.name}. Go to them and they'll walk with you to the edge of town.`);
      }
    }
    function drop(s, msg) { const C = PS.contract; if (C && C.kind === 'escort') { const q = s.byId.get(C.target); if (q) { q.escortee = false; q.agent.frozen = false; q.task = { act: 'leave', outdoor: true, zone: 'east', emigrating: true }; } } PS.contract = null; O.dropLead((l) => l.why === 'contract'); if (msg) say(msg); }
    function pay(s, extra) { const C = PS.contract; PS.money += C.reward; PS.rep.guard = Math.min(1, PS.rep.guard + 0.12); PS.rep.local = Math.min(1, PS.rep.local + 0.06); s.log(`The stranger was paid ₳${C.reward}: ${C.text.replace(/\.$/, '')}.`, 'crime'); PS.contract = null; O.dropLead((l) => l.why === 'contract'); say(`Done. ₳${C.reward} is counted into your hand${extra ? '. ' + extra : '.'}`); }

    // ---------------------------------------------------------------- the boards
    let hooked = false, prev = null;
    game.hooks.update.push(() => { if (hooked) return; hooked = true; prev = O.stallCandidate; O.stallCandidate = cand; });
    function cand() {
      const s = cur(), p = game.player;
      if (!game.scene) {
        for (const b of s.world.buildings) {
          if (b.doorX == null || (b.type !== 'guard' && b.id !== s.tavernId)) continue;
          const x = b.doorX * T + 8 + (b.type === 'guard' ? 22 : -22), y = b.doorY * T + 6, d = Math.hypot(x - p.x, y - p.y);
          if (d < 20) return { type: 'custom', label: b.type === 'guard' ? 'Read the bounty board' : 'Read the notes of hired work', act: () => board(b.type === 'guard' ? 'watch' : 'tavern'), d: d + 4, x, y: y - 30 };
        }
        // the bandits' den on a camp contract
        const C = PS.contract;
        if (C && C.kind === 'camp' && C.place === s.world.placeId) { const den = s.building(C.target); if (den) { const x = den.doorX * T + 8, y = den.doorY * T + 8, d = Math.hypot(x - p.x, y - p.y); if (d < 26) return { type: 'custom', label: `Drive out ${den.name}`, act: () => raid(s, den), d: d - 6, x, y: y - 40 }; } }
      }
      return prev ? prev() : null;
    }
    // a board drawn by the doors
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; const s = cur();
      for (const b of s.world.buildings) {
        if (b.doorX == null || (b.type !== 'guard' && b.id !== s.tavernId)) continue;
        const x = Math.round(b.doorX * T + 8 + (b.type === 'guard' ? 22 : -22) - cam.x), y = Math.round(b.doorY * T - 2 - cam.y);
        if (x < -20 || y < -40 || x > game.vw + 20 || y > game.vh + 20) continue;
        ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 1, y - 8, 2, 10); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 8, y - 22, 16, 14); ctx.fillStyle = '#3a2618'; ctx.fillRect(x - 8, y - 22, 16, 1); ctx.fillRect(x - 8, y - 9, 16, 1);
        ctx.fillStyle = '#efe6cc'; ctx.fillRect(x - 6, y - 20, 5, 6); ctx.fillRect(x + 1, y - 19, 5, 7); ctx.fillStyle = '#a8382f'; ctx.fillRect(x - 4, y - 15, 1, 1); ctx.fillRect(x + 3, y - 13, 1, 1);
      }
    });

    // ---------------------------------------------------------------- taking a thief in
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => {
      const out = prevExtra ? prevExtra(q) : [], C = PS.contract;
      if (C && C.kind === 'thief' && C.target === q.id && C.place === cur().world.placeId) out.unshift(['seize', "There's a bounty on you. You're coming with me"]);
      if (C && C.kind === 'escort' && C.target === q.id && !C.started) out.unshift(['escort', "I'm your escort. Let's go"]);
      return out;
    };
    npcUI.onExtra = (q, key, render) => {
      const s = cur();
      if (key === 'seize') {
        const brave = q.traits.includes('brave') || q.traits.includes('hostile'), k = fightSkill();
        if (!brave && s.rng.chance(0.35)) { npcUI.closeTalk(); arrest(s, q); return pay(s, `${q.first} came quietly`); }
        if (!brave && s.rng.chance(0.5)) { npcUI.closeTalk(); O.flee && O.flee(q, 8); say(`${q.first} bolts! Catch them and talk to them again.`, 'bad'); return; }
        npcUI.closeTalk();
        if (s.rng.chance(k)) { learn(0.05); q.health.hp = Math.max(15, q.health.hp - 40); arrest(s, q); return pay(s, `You wrestle ${q.first} down and march them to the watch house`); }
        learn(0.03); PS.hp = Math.max(8, PS.hp - 25); say(`${q.first} fights you off and gets away. You'll have to try again.`, 'bad'); O.flee && O.flee(q, 10); return;
      }
      if (key === 'escort') { PS.contract.started = true; q.agent.frozen = true; npcUI.closeTalk(); say(`${q.first}: "Lead on. To the edge of town, and keep your eyes open."`); return; }
      return prevOn && prevOn(q, key, render);
    };
    function arrest(s, q) { const cr = s.recordCrime({ kind: 'thieving', perp: q, placeName: s.world.name, tile: [Math.floor(q.agent.x / T), Math.floor(q.agent.y / T)], seen: [], severity: 2 }); s.arrestNPC(q, cr, false); }

    // ---------------------------------------------------------------- the escort: they follow you to the town's edge
    let ambushed = false;
    game.hooks.update.push((dt) => {
      const s = cur(), C = PS.contract; if (!C) return;
      if (now(s) > C.until && C.place === s.world.placeId) { drop(s, 'Your contract ran out of time.'); return; }
      if (C.kind !== 'escort' || !C.started || C.place !== s.world.placeId || game.scene) return;
      const q = s.byId.get(C.target); if (!q) { drop(s); return; }
      const a = q.agent, p = game.player, dx = p.x - 16 - a.x, dy = p.y + 10 - a.y, d = Math.hypot(dx, dy);
      if (d > 6) { const sp = (d > 80 ? 90 : 50) * dt, nx = a.x + dx / d * Math.min(sp, d), ny = a.y + dy / d * Math.min(sp, d); if (!game.solidAt(nx, ny)) { a.x = nx; a.y = ny; } a.dir = O.dirOf(dx, dy); a.forceAnim = 'carry'; } else a.forceAnim = 'idle';
      // trouble on the way
      const E = s.Z.east || [s.world.W - 2, 30], ex = E[0] * T, dist = Math.abs(p.x - ex) + Math.abs(p.y - E[1] * T);
      if (!ambushed && dist < 900 && s.rng.chance(0.004)) { ambushed = true; ambush(s, q); }
      if (dist < 120) { q.escortee = false; a.frozen = false; a.forceAnim = null; q.task = { act: 'leave', outdoor: true, zone: 'east', emigrating: true }; ambushed = false; pay(s, `${q.first} shakes your hand at the edge of town and goes on alone`); }
    });
    function ambush(s, q) {
      O.UI.dialog.open({ name: 'Trouble on the road', color: '#a8382f', text: `Two rough men step out from behind a cart. "That's a fine pack your friend's carrying. Leave it, and walk on."`, options: [{ key: 'fight', label: 'Fight them off' }, { key: 'pay', label: 'Pay them ₳10 to go away' }, { key: 'run', label: 'Run for it, with the merchant' }], onPick: (k) => {
        O.UI.dialog.close();
        if (k === 'pay') { if (PS.money >= 10) { PS.money -= 10; say('You pay them off. They melt away, laughing.'); } else { say("You haven't the coin. They take the merchant's pack and run.", 'bad'); PS.contract.reward = Math.floor(PS.contract.reward / 2); } return; }
        if (k === 'run') { if (s.rng.chance(0.5)) say('You hustle the merchant away; they don\'t follow.'); else { PS.hp = Math.max(8, PS.hp - 15); say('They catch you up and knock you about before you get clear.', 'bad'); } return; }
        if (s.rng.chance(fightSkill())) { learn(0.06); say('You lay into them and they run, nursing their heads. The merchant looks at you with new respect.'); PS.contract.reward += 5; }
        else { learn(0.03); PS.hp = Math.max(8, PS.hp - 30); PS.contract.reward = Math.floor(PS.contract.reward / 2); say('They beat you and take half the goods before they run.', 'bad'); }
        void q;
      } });
    }

    // ---------------------------------------------------------------- clearing a bandit camp
    function raid(s, den) {
      const g = s.gang(den.gang), size = g ? g.members.length : 3, k = fightSkill() - size * 0.06;
      O.UI.dialog.open({ name: den.name, color: '#a8382f', text: `Smoke from a fire, ${size} rough voices. They haven't seen you yet.`, options: [{ key: 'go', label: 'Go in hard' }, { key: 'back', label: 'Think better of it' }], onPick: (key) => {
        O.UI.dialog.close(); if (key === 'back') return;
        if (s.rng.chance(O.clamp(k, 0.08, 0.85))) {
          learn(0.08); PS.hp = Math.max(10, PS.hp - 15);
          if (g) { for (const m of [...g.members]) { const q = s.byId.get(m.id); if (q && s.rng.chance(0.5)) { s.leaveGang(m, g, 'scattered when their den was cleared'); } } g.influence = Math.max(0, (g.influence || 0.2) - 0.15); g.purse = Math.floor((g.purse || 0) / 2); }
          s.log(`${den.name} was cleared out by the stranger, for the watch's bounty.`, 'crime');
          pay(s, 'The camp is broken up and they scatter into the woods');
        } else { learn(0.04); PS.hp = Math.max(5, PS.hp - 40); say('There are too many of them. You get out with your life, barely.', 'bad'); }
      } });
    }
  }
  O.BountiesSetup = { setup };
})();
