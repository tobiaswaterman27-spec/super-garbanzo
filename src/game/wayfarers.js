// People on the island's roads. Travellers walk the real roads between towns, stopping to pass the time
// of day with each other or with you; the realm's caravans creak along them; and on the wild roads a
// gang keeps a camp and wants a toll. They live in island coordinates, so they carry on unbroken when
// you cross from one town's stretch of land into the next.
'use strict';
(function () {
  function setup(game, home) {
    const I = O.Island, T = 16, K = home.kingdom, PS = O.PlayerState;
    const state = new Map(); // road key -> { day, travellers, gangsters }
    let active = [], scan = 0;

    function spawn(r) {
      const rng = O.RNG(home.day * 13 + O.hash(r.key)), st = { day: home.day, travellers: [], gangsters: [], robbed: null };
      const n = 1 + rng.int(0, 2) + (r.total > 200 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const role = rng.pick(['merchant', 'villager', 'farmer', 'courier', 'priest', 'farmhand', 'woodcutter', 'shepherd']);
        const a = O.Char.makeAppearance(O.hash('trav', r.key, home.day, i), { role, age: rng.int(17, 64) });
        st.travellers.push({ a, s: rng.next() * r.total, dirn: rng.chance(0.5) ? 1 : -1, speed: 20 + rng.int(0, 14), ft: rng.next(), anim: 'walk', traveller: true, x: 0, y: 0, dir: 0, name: rng.pick(O.Data.NAMES[a.sex === 'm' ? 'm' : 'f']), role, road: r });
      }
      if (r.camp) for (let i = 0; i < 4; i++) {
        const a = O.Char.makeAppearance(O.hash('gang', r.key, i), { role: 'outlaw', age: 20 + i * 6, sex: i === 3 ? 'f' : 'm' });
        st.gangsters.push({ a, gx: r.camp.x + (i % 2 ? 2 : -2) + 0.5, gy: r.camp.y + (i < 2 ? 2 : 3), x: 0, y: 0, dir: i % 2 ? 1 : 2, anim: i === 0 ? 'idle' : 'talk', ft: i * 0.4, gangster: true });
      }
      state.set(r.key, st);
      return st;
    }
    const local = (gx, gy) => I.toLocal(game.world, gx * T, gy * T);

    game.hooks.update.push((dt) => {
      const w = game.world; if (!w || !w.island || game.scene) return;
      const pl = game.player, [pgx, pgy] = I.toGlobal(w, pl.x, pl.y), ptx = pgx / T, pty = pgy / T;
      // the roads near enough to matter, looked over every second or so
      scan -= dt;
      if (scan <= 0) { scan = 1; active = I.cachedRoads().filter((r) => r.line && ptx > r.x0 - 70 && ptx < r.x1 + 70 && pty > r.y0 - 50 && pty < r.y1 + 50); }
      const extra = [];
      for (const r of active) {
        let st = state.get(r.key); if (!st || st.day !== home.day) st = spawn(r);
        for (const tr of st.travellers) {
          tr.ft += dt; tr.chatCd = Math.max(0, (tr.chatCd || 0) - dt);
          // two travellers meeting stop to pass the time of day; so does one you walk up to
          if (!tr.pause && !tr.chatCd) {
            const near = st.travellers.find((o) => o !== tr && !o.chatCd && !o.pause && Math.abs(o.s - tr.s) < 1.6 && o.dirn !== tr.dirn);
            if (near) { tr.pause = near.pause = 4 + ((Math.floor(tr.s) * 7) % 4); tr.with = near; near.with = tr; }
            else if (Math.hypot(pl.x - tr.x, pl.y - tr.y) < 30) { tr.pause = 2.5; tr.with = pl; }
          }
          if (tr.down) { tr.anim = 'lie'; [tr.x, tr.y] = I.toLocal(game.world, tr.down[0], tr.down[1]); extra.push(tr); continue; }
          if (tr.flee > 0) tr.flee = Math.max(0, tr.flee - dt);
          if (tr.pause && !tr.flee) {
            tr.pause = Math.max(0, tr.pause - dt); tr.anim = 'talk';
            if (tr.with) tr.dir = O.dirOf(tr.with.x - tr.x, tr.with.y - tr.y);
            if (!tr.pause) { tr.chatCd = 12; tr.with = null; tr.anim = 'walk'; }
          } else {
            tr.anim = tr.flee ? 'run' : 'walk'; tr.pause = 0;
            tr.s += tr.dirn * (tr.flee ? 95 : tr.speed) * dt / T;
            if (tr.s < 2 || tr.s > r.total - 2) { tr.dirn *= -1; tr.s = O.clamp(tr.s, 2, r.total - 2); } // into the town and back out again, near enough
          }
          // keep to your own side of the road, smoothly along its bends
          const [ax, ay] = I.pointAt(r, tr.s), [bx, by] = I.pointAt(r, tr.s + 1), d = Math.hypot(bx - ax, by - ay) || 1, side = tr.dirn > 0 ? 0.45 : -0.45;
          const gx = ax + 0.5 - (by - ay) / d * side, gy = ay + 0.6 + (bx - ax) / d * side;
          const [nx, ny] = local(gx, gy);
          if (!tr.pause && (tr.x || tr.y) && Math.hypot(nx - tr.x, ny - tr.y) < 40) tr.dir = O.dirOf(nx - tr.x, ny - tr.y);
          tr.x = nx; tr.y = ny;
          extra.push(tr);
        }
        for (const g of st.gangsters) { g.ft += dt; [g.x, g.y] = local(g.gx, g.gy); extra.push(g); }
        // caravans of the realm on this road
        for (const c of K.caravans) {
          const a = c.path[c.leg], b = c.path[c.leg + 1]; if (!b) continue;
          const fwd = a === r.rd.a && b === r.rd.b, back = a === r.rd.b && b === r.rd.a; if (!fwd && !back) continue;
          const sd = (fwd ? O.clamp(c.prog, 0, 1) : 1 - O.clamp(c.prog, 0, 1)) * r.total, [cx, cy] = I.pointAt(r, sd), [x, y] = local(cx + 0.5, cy + 0.8);
          extra.push({ x, y, caravan: c, dir: fwd ? 2 : 1, cart: true });
        }
        // the gang wants a toll from anyone who passes their camp
        if (r.camp && !O.panelOpen && st.robbed !== home.day && r.camp.beaten !== home.day && Math.hypot(ptx - r.camp.rx, pty - r.camp.ry) < 4.5) {
          st.robbed = home.day;
          O.Roads.ambush({ camp: r.camp, rd: r.rd, name: r.rd.name || 'the road' });
        }
      }
      // real people on their way from one town to another
      const nowMin = home.day * 1440 + home.minute;
      if (O.Journeys) {
        O.Journeys.tickJourneys(K, nowMin);
        for (const j of K.journeys || []) {
          if (j.started == null || j.done || (j.arrived && !j.homeward) || nowMin < j.started) continue;
          const at = O.Journeys.whereOn(K, j); if (!at || !active.includes(at.r)) continue;
          j._actors = j._actors || (j.travellers || []).map((t, k) => ({ a: O.Char.makeAppearance(t.seed, { sex: t.sex, age: t.age, genes: t.genes, role: t.role === 'merchant' ? 'merchant' : 'villager', wealth: 0.55 }), name: t.name, role: t.role, traveller: true, journey: j, k, x: 0, y: 0, dir: 0, ft: k * 0.3, anim: 'walk' }));
          const dirn = at.dir * (j.homeward ? 1 : 1);
          for (const tr of j._actors) {
            const sd = at.s - tr.k * 1.2 * dirn, [ax, ay] = I.pointAt(at.r, sd), [bx, by] = I.pointAt(at.r, sd + dirn), dd = Math.hypot(bx - ax, by - ay) || 1, side = 0.45 * dirn;
            const [nx, ny] = local(ax + 0.5 - (by - ay) / dd * side, ay + 0.6 + (bx - ax) / dd * side);
            if (tr.x || tr.y) tr.dir = O.dirOf(nx - tr.x, ny - tr.y);
            tr.x = nx; tr.y = ny; tr.ft += dt; tr.anim = j.horse ? 'run' : 'walk'; tr.s = sd; tr.road = at.r; tr.dirn = dirn;
            extra.push(tr);
          }
        }
        // anyone whose journey was lost (an old save) simply comes home
        for (const v of O.Travel.visited.values()) for (const q of v.sim.people) if (q.away && !(K.journeys || []).some((x) => x.id === q.away.journey && !x.done)) { q.away = null; q.agent.hidden = false; }
      }
      if (extra.length) game.actors.push(...extra.filter((e) => e.x > -64 && e.y > -64 && e.x < w.W * T + 64 && e.y < w.H * T + 64));
    });

    // anyone out on the road can be struck: a traveller runs or falls, a gang fights, a carter gives up the cart
    const crime = (kind, sev, tile) => { const s = O.SimRef.cur; if (s.recordCrime) s.recordCrime({ kind, perp: 'player', placeName: O.placeName ? O.placeName() : 'the road', tile, seen: [], severity: sev }); };
    const here = () => { const p = game.player; return [Math.floor(p.x / T), Math.floor(p.y / T)]; };
    O.Combat && O.Combat.addTargets(() => {
      const out = [];
      for (const r of active) {
        const st = state.get(r.key); if (!st) continue;
        for (const tr of st.travellers) if (!tr.down) out.push({ x: tr.x, y: tr.y, hit: (dmg) => {
          tr.hp = (tr.hp ?? 60) - dmg; tr.pause = 0; tr.with = null;
          if (tr.hp <= 0) { tr.down = I.toGlobal(game.world, tr.x, tr.y); crime('murder on the road', 4, here()); O.Panels.toast(`${tr.name} falls in the road and does not get up.`, 'bad'); PS.bounty = true; return; }
          const [pg0, pg1] = I.toGlobal(game.world, game.player.x, game.player.y), f = I.pointAt(r, tr.s + 4), b = I.pointAt(r, tr.s - 4);
          tr.dirn = Math.hypot(f[0] * T - pg0, f[1] * T - pg1) > Math.hypot(b[0] * T - pg0, b[1] * T - pg1) ? 1 : -1; tr.flee = 8;
          if (!tr.hurt) { tr.hurt = true; crime('assault on the road', 2, here()); O.Panels.toast(`${tr.name} cries out and runs for ${K.place(tr.dirn > 0 ? r.rd.b : r.rd.a).name}!`, 'bad'); }
        } });
        for (const g of st.gangsters) out.push({ x: g.x, y: g.y, hit: () => { if (!O.panelOpen && r.camp.beaten !== home.day) { st.robbed = home.day; O.Roads.ambush({ camp: r.camp, rd: r.rd, name: r.rd.name || 'the road' }); } } });
      }
      for (const a of game.actors) if (a.cart && a.caravan && !a.caravan.done) { const c = a.caravan; out.push({ x: a.x, y: a.y, hit: (dmg) => {
        c.struck = (c.struck || 0) + dmg;
        if (c.struck < 25 + c.guards * 15) { O.UI.say(`${c.merchant}'s ${c.guards > 1 ? 'guards close round' : 'carter shouts at'} you. Strike again and they'll fight or flee.`, 'bad'); return; }
        const take = Math.max(4, Math.round(c.value * 0.25)); PS.money += take; c.qty = Math.floor(c.qty * 0.6); c.value -= take; c.done = true;
        crime('highway robbery', 3, here()); PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.06);
        K.addNews && K.addNews(`${c.merchant}'s caravan of ${c.good} was robbed on the road.`, 'crime');
        O.Panels.toast(`The carter cuts the horse loose and runs. You take ${take}d of ${c.good} from the cart.`, 'bad');
      } }); }
      return out;
    });

    // journeys go on whether or not you're out on the road to see them
    game.hooks.update.push(() => { if (O.Journeys) O.Journeys.tickJourneys(K, home.day * 1440 + home.minute); });

    // talk to travellers and look round the ruins out in the country
    const cand0 = O.roadCandidate, act0 = O.roadAct;
    O.roadCandidate = () => {
      const w = game.world; if (!w || game.scene) return null;
      if (!w.island) return cand0 ? cand0() : null;
      const p = game.player; let best = null, bd = 26;
      for (const tr of game.actors) if (tr.journey) { const d = Math.hypot(tr.x - p.x, tr.y - p.y); if (d < bd) { bd = d; best = { type: 'traveller', tr, d, x: tr.x, y: tr.y - 44 }; } }
      for (const r of active) { const st = state.get(r.key); if (st) for (const tr of st.travellers) { if (tr.down) continue; const d = Math.hypot(tr.x - p.x, tr.y - p.y); if (d < bd) { bd = d; best = { type: 'traveller', tr, d, x: tr.x, y: tr.y - 44 }; } } }
      for (const b of w.buildings) if (b.ruined && b.ruinNote) { const d = Math.hypot(b.doorX * T + 8 - p.x, b.doorY * T - p.y); if (d < 40 && d < bd) { bd = d; best = { type: 'ruin', b, d, x: b.doorX * T + 8, y: b.doorY * T - 30 }; } }
      return best;
    };
    O.roadAct = (c) => {
      if (!game.world.island || c.type !== 'traveller') return act0(c);
      if (c.tr.journey) { const j = c.tr.journey, to = K.place(j.homeward ? j.from : j.to), from = K.place(j.homeward ? j.to : j.from); const what = j.homeward ? `Home to ${to.name}, at last.` : j.purpose === 'trade' ? `Taking ${Object.entries(j.goods || {}).map(([g, n]) => `${n} ${O.Data.GOODS[g]?.name.toLowerCase()}`).join(' and ')} from ${from.name} to sell in ${to.name}.` : j.purpose === 'move' ? `We're leaving ${from.name} for good. There's nothing for us there now. ${to.name}, we hope.` : `Off to ${to.name} to see family.`; O.UI.dialog.open({ name: c.tr.name, color: '#8a6a4a', text: what, options: [] }); return; }
      const tr = c.tr, r = tr.road, to = K.place(tr.dirn > 0 ? r.rd.b : r.rd.a);
      const news = K.news.length ? K.news[K.news.length - 1].text : null;
      const lines = [`Bound for ${to.name}. Long way yet.`, r.camp ? `Mind ${r.camp.gang} further on. They keep a fire off the road and want paying.` : 'Quiet road, this. That suits me.', news ? `I hear ${news.charAt(0).toLowerCase() + news.slice(1)}` : 'Little news worth the telling.', 'Fine weather for walking, if it holds.', `${to.name}? Good ale there.`];
      O.UI.dialog.open({ name: tr.name, color: '#8a6a4a', text: lines[(Math.floor(tr.s) + home.day) % lines.length], options: [] });
    };
  }
  O.Wayfarers = { setup };
})();
