// All Hallows' Eve. On the last evening of autumn, when the dead are nearest, every house sets a candle in
// its window for its own departed, so the town glitters at dusk; and the children go souling from door to
// door with a hollowed turnip for a lantern, singing "A soul, a soul, a soul-cake! Please good missus, a
// soul-cake!", and the goodwives come out with little spiced cakes, one for each, for the souls of the
// household dead. Folk walk to the churchyard too, to stand a while.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let R = null, forced = false, cakes = 0, doors = 0; const tossed = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._soul && !q._bit && !q._scene && !talking(q);
    const eve = (s) => forced || (s.season === 'autumn' && ((s.weather && s.weather.dayOfSeason) || 0) === 14);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._soul = false; }
    function end() { if (!R) return; for (const q of R.kids) rel(q); if (R.wife) rel(R.wife); R = null; }
    function step(a, tx, ty, v, dt) { const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1.5) return d; const st = Math.min(d, v * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; a.stuck = a.stuck || 0;
      if (!game.solidAt(nx, ny - 2) || a.stuck > 1.2) { a.x = nx; a.y = ny; } else if (!game.solidAt(nx, a.y - 2)) a.x = nx; else if (!game.solidAt(a.x, ny - 2)) a.y = ny; else a.stuck += dt; a.dir = O.dirOf(dx, dy); return d; }
    game.hooks.update.push((dt) => {
      for (const c of tossed.slice()) { c.t += dt; if (c.t > 0.7) tossed.splice(tossed.indexOf(c), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (R) { R.t += dt; if (R.s !== s || R.t > 200 || R.kids.some((q) => talking(q) || q.alive === false)) { end(); return; }
        const [lead, ...rest] = R.kids, la = lead.agent, door = R.doors[R.i]; if (!door) { end(); return; }
        const dx = door.doorX * T + 8, dy = (door.doorY + 2) * T + 2;
        if (R.phase === 'walk') { const d = step(la, dx, dy, 34, dt); la.forceAnim = 'walk'; rest.forEach((q, i) => { const a = q.agent; step(a, la.x + (i ? 12 : -12), la.y + 6, 40, dt); a.forceAnim = 'walk'; }); if (d < 2 || (R.wt = (R.wt || 0) + dt) > 25) { R.phase = 'sing'; R.k = 0; R.wt = 0; } }
        if (R.phase === 'sing') { R.k += dt; for (const q of R.kids) { q.agent.dir = 3; q.agent.forceAnim = Math.floor(R.k * 2 + q.id) % 2 ? 'celebrate' : 'idle'; }
          if (!R.sung) { R.sung = true; if (near(la.x, la.y, 320)) { O.Speech && O.Speech.say(lead, pick(['A soul, a soul, a soul-cake! Please good missus, a soul-cake!', 'An apple, a pear, a plum or a cherry, any good thing to make us all merry!', 'One for Peter, two for Paul, three for Him who made us all!']), 3.2); O.sfx && O.sfx('pipe', 0.12); } }
          if (R.k > 3 && !R.came) { R.came = true; const w = s.people.find((q) => q.home === door.id && q.age >= 16 && able(q)); if (w) { const a = w.agent; a.inside = null; a.hidden = false; a.x = door.doorX * T + 8; a.y = (door.doorY + 1) * T + 6; a.frozen = true; a.path = null; a.dir = 0; w._soul = true; R.wife = w; R.phase = 'give'; R.k = 0; doors++; } else { R.phase = 'next'; } } }
        if (R.phase === 'give') { R.k += dt; const wa = R.wife.agent; wa.forceAnim = R.k < 2.4 ? 'give' : 'idle';
          if (!R.said) { R.said = true; if (near(la.x, la.y, 320)) O.Speech && O.Speech.say(R.wife, pick(['Here, one each, and pray for our dead.', 'Say one for my mother, God rest her.', 'There. And off home before the dark comes down.']), 2.8); }
          R.kids.forEach((q, i) => { if (R.k > 0.5 + i * 0.6 && !R['g' + i]) { R['g' + i] = true; cakes++; tossed.push({ s, x0: wa.x, y0: wa.y - 16, x1: q.agent.x, y1: q.agent.y - 14, t: 0 }); } q.agent.forceAnim = R.k > 0.5 + i * 0.6 ? (R.k > 2.8 ? 'bow' : 'take') : 'idle'; });
          if (R.k > 3.6) { if (near(la.x, la.y, 320)) O.Speech && O.Speech.say(rest[0] || lead, 'God bless this house!', 1.8); R.phase = 'next'; } }
        if (R.phase === 'next') { if (R.wife) { rel(R.wife); R.wife = null; } R.i++; R.sung = false; R.came = false; R.said = false; for (let i = 0; i < 4; i++) R['g' + i] = false; R.phase = 'walk'; }
        return; }
      if (!eve(s) || hr < 16.5 || hr >= 19.5) return; if (s._soulDone === s.day) return;
      const P = game.player, ds = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 380).sort((a, b) => a.doorX - b.doorX).slice(0, 4); if (ds.length < 2) return;
      const kids = s.people.filter((q) => able(q) && q.age >= 6 && q.age <= 12 && !q.agent.hidden && q.agent.inside == null && near(q.agent.x, q.agent.y, 700)).slice(0, 3); if (kids.length < 2) return;
      s._soulDone = s.day; for (const q of kids) { q._soul = true; q.agent.frozen = true; q.agent.path = null; q.agent.stuck = 0; }
      const d0 = ds[0]; if (Math.hypot(kids[0].agent.x - d0.doorX * T, kids[0].agent.y - d0.doorY * T) > 360) kids.forEach((q, i) => { q.agent.x = d0.doorX * T - 100 - i * 12; q.agent.y = (d0.doorY + 2) * T + 2; if (game.solidAt(q.agent.x, q.agent.y - 2)) q.agent.x = d0.doorX * T + 8; });
      R = { s, kids, doors: ds, i: 0, t: 0, phase: 'walk' };
    });
    // candles in every window, and the turnip lantern
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; const s = cur(); if (!s || !eve(s)) return; const hr = s.minute / 60, W = ctx.canvas.width, H = ctx.canvas.height, tk = performance.now() / 1000;
      if (hr >= 16.5 || hr < 5) for (const b of s.world.buildings) { if (b.type !== 'house' || !b.sprite || b.ruined) continue; const sp = b.sprite, bx = b.x * T - sp.OV - cam.x, by = (b.bottom + 1) * T - sp.H - cam.y; if (bx > W + 10 || by > H + 10 || bx + sp.W < -10 || by + sp.H < -10) continue; const wd = (sp.windows || [])[0]; if (!wd) continue;
        const x = Math.round(bx + wd.x + wd.w / 2), y = Math.round(by + wd.y + wd.h - 2), f = Math.sin(tk * 9 + b.id) > 0; ctx.fillStyle = 'rgba(255,200,90,0.35)'; ctx.fillRect(x - 3, y - 6, 6, 6); ctx.fillStyle = '#f0e8d8'; ctx.fillRect(x - 1, y - 3, 2, 3); ctx.fillStyle = f ? '#ffd060' : '#f0a030'; ctx.fillRect(x - 1, y - 5, 2, 2); }
      if (R && R.s === s) { const a = R.kids[0].agent, x = Math.round(a.x - cam.x) + (a.dir === 1 ? -7 : 5), y = Math.round(a.y - cam.y) - 12; ctx.fillStyle = '#d8c8a0'; ctx.fillRect(x - 2, y, 5, 5); ctx.fillStyle = '#e8a030'; ctx.fillRect(x - 1, y + 1, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x - 1, y + 3, 3, 1); ctx.strokeStyle = '#6a4a2c'; ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y - 6); ctx.stroke(); }
      for (const c of tossed) { if (c.s !== s) continue; const k = c.t / 0.7, x = Math.round(c.x0 + (c.x1 - c.x0) * k - cam.x), y = Math.round(c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 8 - cam.y); ctx.fillStyle = '#b8803a'; ctx.fillRect(x - 1, y - 1, 3, 2); ctx.fillStyle = '#e8d8a8'; ctx.fillRect(x, y - 1, 1, 1); } });
    (O.extraLines = O.extraLines || []).push((s, q) => !eve(s) ? '' : q._soul && R && R.kids.includes(q) ? 'It is All Hallows\' Eve and you are out souling door to door with the other children, singing for soul-cakes.' : 'It is All Hallows\' Eve: a candle in every window for the dead, and the children out souling for soul-cakes. You are thinking of your own dead.');
    O.Souling = { get run() { return R; }, get cakes() { return cakes; }, get doors() { return doors; }, force: () => { forced = true; const s = cur(); if (s) s._soulDone = -1; }, unforce: () => { forced = false; } };
  }
  O.SoulingSetup = { setup };
})();
