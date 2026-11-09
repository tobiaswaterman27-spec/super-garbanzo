// Swallows. On spring and summer evenings, before the bats, the swallows come down low over the grass and
// the water after the midges, darting and jinking and sweeping round in long curves, so fast you only
// catch the fork of the tail as they flick past; lower before rain.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const birds = [];
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || game.scene) { birds.length = 0; return; } const hr = s.minute / 60, on = (s.season === 'summer' || s.season === 'spring') && hr > 16.5 && hr < 20.5 && !s.raining;
      const P = game.player, vw = game.vw || 600, vh = game.vh || 400;
      if (!on) { for (const b of birds) if (!b.leave) { b.leave = true; b.lt = 0; } }
      else while (birds.length < 8) birds.push({ x: P.x + (Math.random() - 0.5) * vw, y: P.y + (Math.random() - 0.5) * vh, a: Math.random() * 6.28, v: 90 + Math.random() * 50, turn: 0, t: Math.random() * 3, z: 8 + Math.random() * 20 });
      const low = s.weather && /cloudy|rain|storm/.test(s.weather.next || '') ? 0.5 : 1;
      for (const b of birds.slice()) { b.t += dt; if (Math.random() < dt * 2) b.turn = (Math.random() - 0.5) * 6; b.a += b.turn * dt; const dx = P.x - b.x, dy = P.y - b.y; if (!b.leave && Math.hypot(dx, dy) > vw * 0.6) { const want = Math.atan2(dy, dx); b.a += Math.sign(Math.sin(want - b.a)) * 2.5 * dt; } b.x += Math.cos(b.a) * b.v * dt; b.y += Math.sin(b.a) * b.v * 0.6 * dt; b.z = (8 + Math.sin(b.t * 2) * 6) * low + 4; if (b.leave) { b.lt += dt; b.z += 30 * b.lt; if (b.lt > 4 || Math.hypot(dx, dy) > vw) birds.splice(birds.indexOf(b), 1); } }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene || !birds.length) return;
      for (const b of birds) { const x = Math.round(b.x - cam.x), y = Math.round(b.y - b.z - cam.y); if (x < -10 || y < -10 || x > ctx.canvas.width + 10 || y > ctx.canvas.height + 10) continue; const f = Math.floor(b.t * 14) % 2, c = Math.cos(b.a), sgn = c >= 0 ? 1 : -1;
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(Math.round(b.x - cam.x), Math.round(b.y - cam.y), 2, 1);
        ctx.fillStyle = '#1a1a2a'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x - 3, y - (f ? 1 : 0), 2, 1); ctx.fillRect(x + 2, y - (f ? 1 : 0), 2, 1); ctx.fillRect(x - sgn * 3, y + 1, 1, 1); ctx.fillStyle = '#8a3a2a'; ctx.fillRect(x + sgn, y, 1, 1); }
    });
    O.Swallows = { birds };
  }
  O.SwallowsSetup = { setup };
})();
