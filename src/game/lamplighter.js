// Lanterns on posts by the tavern, the chapel, the guardhouse and the corners of the square. At dusk
// someone of the watch goes round with a long pole and a taper and lights them one by one (you see
// each catch and glow), and at first light goes round again and snuffs them. Lit, they throw a pool of
// warm light on the street; on a wet night one gutters out now and then until it's seen to.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const isWatch = (q) => /guard|sergeant|watch|captain|constable/.test(q.job?.role || '');
    const free = (q) => q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._scene && !q._playing && !q._fighting && !q._bit && !q._cp && !q._war && !q._mark && !q._front && !q._shake && !q._pass && q.alive !== false && !q.jailUntil && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function lamps(s) {
      const w = s.world; if (w._lamps) return w._lamps; const out = [], ok = (x, y) => !game.solidAt(x, y - 2) && !game.solidAt(x, y - 10);
      const add = (x, y) => { if (ok(x, y) && !out.some((l) => Math.hypot(l.x - x, l.y - y) < 40)) out.push({ x, y, lit: false }); };
      for (const b of w.buildings) { if (b.doorX == null || !['tavern', 'chapel', 'guard', 'posthouse', 'inn', 'smithy', 'castle', 'hall', 'bakery'].includes(b.type)) continue; for (const dx of [2, -2, 3, -3]) { const x = (b.doorX + dx) * T + 8, y = (b.doorY + 1) * T + 6; if (ok(x, y)) { add(x, y); break; } } }
      if (s.Z && s.Z.square) { const [x0, y0, x1, y1] = s.Z.square; for (const [tx, ty] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) add(tx * T + 8, ty * T + 12); }
      return (w._lamps = out.slice(0, 14));
    }
    let job = null, chk = 2;
    const want = () => game.isNight ? game.isNight() : false;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world) return; const L = lamps(s), on = want();
      // rain gutters a lamp now and then
      if (on && s.weather && /rain|storm/.test(s.weather.kind || '') && Math.random() < dt * 0.01) { const l = L[Math.floor(Math.random() * L.length)]; if (l && l.lit) l.lit = false; }
      if (job) { const q = job.q, a = q.agent; job.t += dt;
        if (q.alive === false || game.scene || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) || job.t > 120) { endJob(); return; }
        const l = job.list[0]; if (!l) { endJob(); return; }
        if (l.lit === on) { job.list.shift(); job.stage = 'go'; return; }
        const fx = l.x - 8, fy = l.y + 2;
        if (job.stage === 'go') { const dx = fx - a.x, dy = fy - a.y, d = Math.hypot(dx, dy); if (d < 2 || job.stuck > 6) { job.stage = 'reach'; job.k = 0; a.dir = 2; job.stuck = 0; } else { const st = Math.min(d, 40 * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; if (!game.solidAt(nx, ny - 2)) { a.x = nx; a.y = ny; } else if (!game.solidAt(nx, a.y - 2)) a.x = nx; else if (!game.solidAt(a.x, ny - 2)) a.y = ny; else job.stuck = (job.stuck || 0) + dt; a.dir = O.dirOf(dx, dy); a.forceAnim = 'walk'; } }
        else { job.k += dt; a.forceAnim = 'point'; a.dir = 2; if (job.k > 1.3) { l.lit = on; if (on) l.flare = 0.6; O.sfx && near(l.x, l.y, 200) && O.sfx(on ? 'whoosh' : 'sweep', 0.12); job.list.shift(); job.stage = 'go'; } }
        return;
      }
      chk -= dt; if (chk > 0) return; chk = 3;
      const wrong = L.filter((l) => l.lit !== on); if (!wrong.length) return;
      // out of your sight they get done somehow; near you, someone has to walk round
      for (const l of wrong) if (!near(l.x, l.y, 520)) l.lit = on;
      const seen = L.filter((l) => l.lit !== on); if (!seen.length || game.scene) return;
      const q = s.people.filter((q) => free(q) && isWatch(q)).sort((a, b) => Math.hypot(a.agent.x - seen[0].x, a.agent.y - seen[0].y) - Math.hypot(b.agent.x - seen[0].x, b.agent.y - seen[0].y))[0] || s.people.find((q) => free(q) && q.age >= 16 && /chandler|porter|sexton/.test(q.job?.role || ''));
      if (!q || Math.hypot(q.agent.x - seen[0].x, q.agent.y - seen[0].y) > 700) { for (const l of seen) l.lit = on; return; }
      // nearest-first round
      const list = []; let px = q.agent.x, py = q.agent.y; const left = seen.slice(); while (left.length) { left.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py)); const n = left.shift(); list.push(n); px = n.x; py = n.y; }
      q._lamp = true; q.agent.frozen = true; q.agent.path = null; job = { q, list, t: 0, stage: 'go' };
    });
    function endJob() { const q = job.q; q._lamp = false; q.agent.forceAnim = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; for (const l of job.list) l.lit = want(); job = null; }
    (O.extraLights = O.extraLights || []).push((pools, cam) => { const s = cur(); if (!s || !s.world || !s.world._lamps) return; for (const l of s.world._lamps) if (l.lit) pools.push([l.x - cam.x, l.y - 18 - cam.y, 34 + (l.flare > 0 ? 8 : 0)]); });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const L = s.world._lamps; if (!L) return; const tk = Math.floor(performance.now() / 120);
      for (const l of L) { const x = Math.round(l.x - cam.x), y = Math.round(l.y - cam.y); if (x < -10 || y < -40 || x > ctx.canvas.width + 10 || y > ctx.canvas.height + 10) continue;
        ctx.fillStyle = '#3a2e26'; ctx.fillRect(x, y - 24, 2, 24); ctx.fillRect(x - 1, y - 1, 4, 1); ctx.fillRect(x - 1, y - 25, 4, 1);
        ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 2, y - 31, 6, 1); ctx.fillRect(x - 2, y - 30, 1, 5); ctx.fillRect(x + 3, y - 30, 1, 5); ctx.fillRect(x - 1, y - 32, 4, 1);
        if (l.lit) { ctx.fillStyle = tk % 3 ? '#ffc050' : '#ffa830'; ctx.fillRect(x - 1, y - 30, 4, 5); ctx.fillStyle = '#fff2a0'; ctx.fillRect(x, y - 29 + (tk % 2), 2, 2); if (l.flare > 0) l.flare -= 0.016; } else { ctx.fillStyle = 'rgba(60,60,70,0.6)'; ctx.fillRect(x - 1, y - 30, 4, 5); } }
      if (job) { const a = job.q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y), reach = job.stage === 'reach'; ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 4, y - 12); ctx.lineTo(x + (reach ? 9 : 7), y - (reach ? 36 : 30)); ctx.stroke(); if (want()) { ctx.fillStyle = tk % 2 ? '#ffb040' : '#ffd070'; ctx.fillRect(x + (reach ? 8 : 6), y - (reach ? 38 : 32), 2, 2); } }
    });
    O.Lamps = { list: () => lamps(cur()), get job() { return job; } };
  }
  O.LamplighterSetup = { setup };
})();
