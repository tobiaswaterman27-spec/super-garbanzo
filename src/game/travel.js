// Travel between settlements. Walk (or ride) to the edge of town on the high road and pick a road.
// Time passes on the journey for every living settlement; the road may bring bandits or company.
// Each place you reach is generated from its kingdom stats and simulated in full while you're
// there; when you come back later it catches up on the time you were away.
'use strict';
(function () {
  const PS = O.PlayerState, esc = (s) => O.escape(s);

  function setup(game, home, npcUI) {
    const K = home.kingdom, T = 16;
    const visited = new Map(); // placeId -> { world, sim, leftAt }
    visited.set('ashford', { world: home.world, sim: home, leftAt: null });
    const now = () => home.day * 1440 + home.minute;
    const cur = () => O.SimRef.cur;

    function atExit() {
      if (game.scene) return null;
      const w = game.world, p = game.player;
      if (Math.abs(p.y / T - (w.roadY + 1)) > 2.6) return null;
      if (p.x < 26) return 'west';
      if (p.x > w.W * T - 26) return 'east';
      return null;
    }
    // no exit button: you walk out of town onto the road (roads.js)
    O.exitCandidate = () => null; void atExit;

    function hoursFor(a, b) { const road = K.road(a, b); const d = K.dist(a, b); return Math.max(2, Math.round(d * (game.player.mount ? 0.35 : 0.8) * (1.4 - road.quality * 0.5))); }

    O.travelPanel = (side) => {
      const here = game.world.placeId, me = K.place(here);
      const opts = K.neighbours(here).map((id) => K.place(id)).filter((pl) => (side === 'east' ? pl.x >= me.x - 2 : pl.x <= me.x + 2) || K.neighbours(here).length <= 2);
      const rows = opts.map((pl) => { const rd = K.road(here, pl.id); const h = hoursFor(here, pl.id); return `<tr><td><b>${esc(pl.name)}</b><br><small class="lbl">${pl.kind} · ${pl.region}${visited.has(pl.id) ? ' · visited' : ''}</small></td><td class="n">${h} h</td><td>${rd.damaged ? '<span class="warn">closed by storm damage</span>' : `${rd.quality > 0.7 ? 'good road' : rd.quality > 0.45 ? 'rutted track' : 'poor track'}, ${rd.danger > 0.3 ? '<span class="warn">bandits reported</span>' : rd.danger > 0.15 ? 'some danger' : 'safe'}`}</td><td>${rd.damaged ? '' : `<button data-go="${pl.id}">Set out</button>`}</td></tr>`; }).join('');
      O.Panels.open(`Leave ${me.name}`, `<p class="caption">${game.player.mount ? `On ${esc(game.player.mount.name)}, the miles go quicker.` : 'On foot. A horse would halve the journey.'} Time will pass for everyone while you travel.</p>
        <table><thead><tr><th>Road to</th><th class="n">Time</th><th>The road</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4">No road leads this way.</td></tr>'}</tbody></table>`, (r) => {
        r.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { O.Panels.close(); journey(here, b.dataset.go); });
      });
    };

    function passTime(minutes) {
      const steps = Math.ceil(minutes / 2);
      for (let i = 0; i < steps; i++) { cur().tick(2); if (cur() !== home) home.tick(2); PS.tick(2, false); }
    }

    function journey(from, to) {
      const rd = K.road(from, to), hours = hoursFor(from, to);
      const r = home.rng;
      // the road itself
      const banditRisk = rd.danger * 0.7 + Math.max(...home.gangs.map((g) => (g.id === 'player' ? 0 : g.influence)), 0) * 0.1;
      passTime(hours * 30);
      if (r.chance(banditRisk)) return bandits(from, to, hours);
      if (r.chance(0.3) && K.caravans.length) { const c = r.pick(K.caravans); O.Panels.toast(`On the road you fall in with ${c.merchant}'s caravan carrying ${c.good} to ${K.place(c.to).name}.`); }
      passTime(hours * 30);
      arrive(from, to);
    }

    function bandits(from, to, hours) {
      const toll = 8 + Math.round(home.rng.next() * 20);
      O.Panels.open('Bandits!', `<p class="speech">“That's far enough, friend. Road's ours. Purse or blood.”</p><p class="caption">Four ragged men step out from the trees between ${esc(K.place(from).name)} and ${esc(K.place(to).name)}.</p>
        <div class="topics"><button data-b="pay">Pay ${toll}d</button><button data-b="fight">Fight</button><button data-b="flee">${game.player.mount ? 'Spur your horse through' : 'Run for it'}</button>${PS.rep.criminal > 0.3 ? '<button data-b="talk">Speak their language</button>' : ''}</div>`, (r) => {
        r.querySelector('.x').hidden = true;
        const done = (msg, bad) => { O.Panels.close(); if (msg) O.Panels.toast(msg, bad ? 'bad' : ''); passTime(hours * 30); arrive(from, to); };
        r.querySelector('[data-b=pay]').onclick = () => { const paid = Math.min(PS.money, toll); PS.money -= paid; done(`You hand over ${paid}d. They melt back into the trees.`, true); };
        r.querySelector('[data-b=fight]').onclick = () => {
          const armed = O.Combat && O.Combat.armed(); const win = home.rng.chance(0.3 + (armed ? 0.25 : 0) + (PS.hp > 70 ? 0.1 : 0));
          PS.hp = Math.max(5, PS.hp - (win ? 15 : 35));
          if (win) { const loot = 5 + home.rng.int(0, 20); PS.money += loot; PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.03); done(`You drive them off and take ${loot}d from the one who fell.`); }
          else { const lost = Math.floor(PS.money * 0.5); PS.money -= lost; done(`They beat you bloody and take ${lost}d.`, true); }
        };
        r.querySelector('[data-b=flee]').onclick = () => { const ok = home.rng.chance(game.player.mount ? 0.85 : 0.4); if (ok) done('You break away and leave them cursing in the road.'); else { const lost = Math.floor(PS.money * 0.3); PS.money -= lost; PS.hp = Math.max(5, PS.hp - 15); done(`They catch you. You lose ${lost}d and some skin.`, true); } };
        const tk = r.querySelector('[data-b=talk]'); if (tk) tk.onclick = () => done('“Ah — one of ours. Go on, then.” They let you pass, and tell you where the soft caravans run.');
      });
    }

    // build a settlement (its map and its living people) ahead of time, so walking in is instant
    function ensure(to) {
      let v = visited.get(to);
      if (v) return v;
      const place = K.place(to);
      const world = O.Gen.makeSettlement(place);
      O.Roads.attachExits(world, K);
      const s = new O.Sim(world, O.hash('sim', to), { foreign: true, kingdom: K, day: home.day, minute: home.minute });
      v = { world, sim: s, leftAt: home.day * 1440 + home.minute }; // it keeps living until you arrive
      visited.set(to, v);
      return v;
    }
    function arrive(from, to, viaRoad) {
      // leave the current settlement
      const leaving = visited.get(game.world.placeId); if (leaving) leaving.leftAt = now();
      let v = visited.get(to);
      if (!v) {
        v = ensure(to);
        v.sim.log(`A traveller arrived from ${K.place(from).name}.`, 'day');
      } else if (v.leftAt != null && v.sim !== home) {
        // catch up on the time we were away (up to two days in detail)
        const missed = Math.min(2880, now() - v.leftAt);
        for (let i = 0; i < missed / 2; i++) v.sim.tick(2);
      }
      O.SimRef.cur = v.sim;
      game.season = v.sim.season;
      const comingFromWest = K.place(from).x < K.place(to).x;
      if (!v.world.exits[from]) O.Roads.attachExits(v.world, K);
      game.load(v.world);
      O.applySeason && O.applySeason();
      const ex = v.world.exits[from];
      if (ex && ex.side) { const d = ex.side === 'west' ? [2, 0] : ex.side === 'east' ? [-2, 0] : ex.side === 'north' ? [0, 2] : [0, -2]; game.player.x = (ex.x + d[0]) * T + 8; game.player.y = (ex.y + d[1]) * T + 10; game.player.dir = ex.side === 'west' ? 2 : ex.side === 'east' ? 1 : ex.side === 'north' ? 0 : 3; }
      else { const e2 = comingFromWest ? v.world.exits.west : v.world.exits.east; game.player.x = (e2[0] + (comingFromWest ? 2 : -2)) * T + 8; game.player.y = (e2[1] + 1) * T + 6; game.player.dir = comingFromWest ? 2 : 1; }
      if (game.player.mount) game.player.mount.world = to;
      O.Panels.toast(`You reach ${K.place(to).name}. It is ${O.DAYNAMES[v.sim.weekday]}, ${game.timeString()}.`);
    }
    O.Travel = { visited, journey, arrive, ensure };
  }
  O.TravelSetup = { setup };
})();
