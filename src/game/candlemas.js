// Candlemas. On the feast of the Purification, in the depth of winter, the town goes to church with
// candles: a file of folk walks up from the square each with a little wax light cupped against the wind,
// the flames bobbing in the grey morning, the priest waits on the step to bless them, and in they go,
// the candles to be kept all year against storms and sickness.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let C = null, forced = false, blessed = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._candle && !q._bit && !q._scene && !talking(q);
    const dos = (s) => (s.weather && s.weather.dayOfSeason) || 0;
    // Candlemas in the depth of winter, and Lammas, the loaf-mass, at the end of summer when the first loaves of the new wheat are carried up
    const feast = (s) => forced ? forcedKind : s.season === 'winter' && dos(s) === 7 ? 'candle' : s.season === 'summer' && dos(s) === 14 ? 'loaf' : null; let forcedKind = 'candle';
    function rel(q, inside) { if (!q || !q.agent) return; const a = q.agent; a.forceAnim = null; if (!talking(q)) a.frozen = false; q._candle = false; if (inside != null && !talking(q)) { a.inside = inside; a.hidden = true; a.path = null; } }
    function end() { if (!C) return; for (const f of C.file) if (f.q._candle) rel(f.q); if (C.priest) rel(C.priest); C = null; }
    function step(a, tx, ty, v, dt) { const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1.5) return d; const st = Math.min(d, v * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; a.stuck = a.stuck || 0;
      if (!game.solidAt(nx, ny - 2) || a.stuck > 1) { a.x = nx; a.y = ny; } else if (!game.solidAt(nx, a.y - 2)) a.x = nx; else if (!game.solidAt(a.x, ny - 2)) a.y = ny; else a.stuck += dt; a.dir = O.dirOf(dx, dy); return d; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (C) { C.t += dt; if (C.s !== s || C.t > 150) { end(); return; }
        const b = C.b, door = [b.doorX * T + 8, (b.doorY + 1) * T + 10];
        if (C.priest) { const pa = C.priest.agent; pa.dir = 0; pa.forceAnim = Math.floor(C.t / 2) % 3 === 0 ? 'pray' : 'idle'; }
        // the file walks up in a line, each a few steps behind the one in front; at the step, a blessing, then in
        C.file.forEach((f, i) => { const q = f.q, a = q.agent; if (!q._candle) return; if (talking(q)) { rel(q); return; }
          if (f.state === 'queue' && C.t > f.delay) { f.state = 'walk'; a.frozen = false; const spot = [b.doorX + [0, -1, 1, -2, 2, -1, 1, 0][i % 8], b.doorY + 1 + (i >= 5 ? 1 : 0)]; O.Errands.send(s, q, spot, { anim: 'idle', secs: 0.1, face: 3, giveUp: game.t + 60, after: (ok) => { if (!C || !q._candle) return; if (!ok) { rel(q); f.state = 'in'; return; } a.frozen = true; a.path = null; f.state = 'bless'; f.k = 0; } }); }
          else if (f.state === 'bless') { f.k += dt; a.dir = 3; a.forceAnim = f.k < 1.4 ? 'bow' : 'pray'; if (f.k > 0.4 && !C.spoke && C.priest && near(door[0], door[1], 320)) { C.spoke = true; O.Speech && O.Speech.say(C.priest, pick(C.kind === 'loaf' ? ['Blessed be the first bread of the harvest, and the hands that reaped it.', 'Give us this day our daily bread. Go in, and be thankful.', 'Break it at your own table, and remember who sends the rain.'] : ['Lumen ad revelationem gentium. Go in, and God keep your light.', 'Blessed be this light, and all who carry it.', 'Keep your candle by you this year, against the storm.']), 3.4); }
            if (f.k > 2.2) { f.state = 'in'; blessed++; rel(q, b.id); } } });
        if (C.file.every((f) => f.state === 'in' || !f.q._candle)) end();
        return; }
      if (!feast(s) || hr < 9 || hr >= 10.5) return; if (s._candleDone === s.day) return; if (!s.chapelId || !s.Z || !s.Z.square) return; const b = s.building(s.chapelId); if (!b || b.doorX == null || !near(b.doorX * T, b.doorY * T, 520)) return;
      s._candleDone = s.day;
      const folk = s.people.filter((q) => able(q) && q.age >= 8 && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - b.doorX * T, q.agent.y - b.doorY * T) < 700).slice(0, 8); if (folk.length < 3) return;
      const bz = s.biz.get(s.chapelId), priest = ((bz && bz.workers) || []).map((id) => s.byId.get(id)).find(able) || null;
      if (priest) { const a = priest.agent; a.inside = null; a.hidden = false; a.x = b.doorX * T + 8 + 14; a.y = (b.doorY + 1) * T + 6; a.frozen = true; a.path = null; priest._candle = true; }
      // they set off from a little way down the lane, in a line
      const w = s.world; let sx = b.doorX * T + 8, sy = (b.doorY + 6) * T; for (let d = 6; d > 2; d--) { const i = (b.doorY + d) * w.W + b.doorX; if (!w.solid[i]) { sy = (b.doorY + d) * T + 8; break; } }
      folk.forEach((q, i) => { const a = q.agent; q._candle = true; a.frozen = true; a.path = null; a.stuck = 0; if (Math.hypot(a.x - sx, a.y - sy) > 260) { a.x = sx + ((i % 2) ? 6 : -6); a.y = sy + i * 13; if (game.solidAt(a.x, a.y - 2)) { a.x = sx; a.y = sy + i * 6; } } });
      C = { s, b, kind: feast(s), file: folk.map((q, i) => ({ q, state: 'queue', k: 0, delay: i * 1.4 })), priest, t: 0 };
      if (near(sx, sy, 400)) O.sfx && O.sfx('handbell', 0.2);
    });
    // the little lights, cupped against the wind
    game.hooks.drawWorld.push((ctx, cam) => { if (!C || game.scene || C.s !== cur()) return; const tk = performance.now() / 1000;
      for (const f of C.file) { if (f.state === 'in' || !f.q._candle || f.q.agent.hidden) continue; const a = f.q.agent, x = Math.round(a.x - cam.x) + (a.dir === 1 ? -5 : 4), y = Math.round(a.y - cam.y) - (f.q.age < 13 ? 13 : 16); if (C.kind === 'loaf') { ctx.fillStyle = '#c89a5a'; ctx.fillRect(x - 2, y, 6, 4); ctx.fillStyle = '#a87a40'; ctx.fillRect(x - 2, y + 3, 6, 1); ctx.fillStyle = '#e0b878'; ctx.fillRect(x - 1, y, 3, 1); continue; } ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x, y, 2, 5); const fl = Math.sin(tk * 11 + f.q.id) > 0; ctx.fillStyle = 'rgba(255,210,110,0.3)'; ctx.fillRect(x - 2, y - 5, 6, 5); ctx.fillStyle = fl ? '#ffd860' : '#f0a030'; ctx.fillRect(x, y - 3 + (fl ? 0 : 1), 2, 2 + (fl ? 1 : 0)); } });
    (O.extraLines = O.extraLines || []).push((s, q) => { const k = feast(s); if (!k) return ''; return k === 'loaf' ? (q._candle ? 'It is Lammas, the loaf-mass, and you are carrying a loaf of the first new wheat up to church to be blessed.' : 'It is Lammas, the loaf-mass, when the first bread of the harvest is blessed at church.') : (q._candle ? 'It is Candlemas and you are carrying your candle up to church to be blessed.' : 'It is Candlemas, the feast of candles, when the year\'s candles are blessed at church.'); });
    // you can carry yours up too
    let yours = 0, PS = O.PlayerState;
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!C || C.youCame || game.scene || P.locked || !C.priest) return null; const pa = C.priest.agent; if (Math.hypot(pa.x - P.x, pa.y - P.y) > 50) return null; if (C.kind === 'loaf' && !(PS.items || []).includes('bread')) return null;
      return { type: 'custom', d: 50, x: pa.x, y: pa.y - 30, label: C.kind === 'loaf' ? 'Hold up your loaf to be blessed' : 'Light a candle and have it blessed', act: () => { C.youCame = true; yours++; P.anim = 'bow'; setTimeout(() => { P.anim = 'pray'; setTimeout(() => { P.anim = 'idle'; }, 1500); }, 900); O.Speech && O.Speech.say(C.priest, C.kind === 'loaf' ? 'Blessed be your bread, stranger. May you never want for it.' : 'God keep your light, stranger, all the year.', 3); if (PS.rep) PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.01); PS.blessed = { kind: C.kind, day: C.s.day }; } }; });
    O.Candlemas = { get yours() { return yours; }, get feast() { return C; }, get blessed() { return blessed; }, force: (k) => { forced = true; forcedKind = k || 'candle'; const s = cur(); if (s) s._candleDone = -1; }, unforce: () => { forced = false; } };
  }
  O.CandlemasSetup = { setup };
})();
