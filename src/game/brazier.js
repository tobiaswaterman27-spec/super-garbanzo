// The watch's brazier. Outside the watch house a brazier burns all night, coals glowing through the
// iron, sparks going up; the watchmen on duty stand round it between rounds holding their hands to it,
// and anyone passing late stops to warm themselves a moment.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const sparks = []; let spot = null, spotSim = null, tick = 0;
    const night = () => game.isNight && game.isNight();
    function where(s) { if (spotSim === s) return spot; spotSim = s; spot = null; const gz = [...s.biz.values()].find((z) => z.type === 'guard'); const b = gz && s.building(gz.b?.id ?? gz.id); if (!b || b.doorX == null) return null; for (const dx of [2, -2, 3, -3]) { const x = (b.doorX + dx) * T + 8, y = (b.doorY + 2) * T + 4; if (!game.solidAt(x, y - 2) && !game.solidAt(x, y - 8)) { spot = [x, y]; break; } } return spot; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const at = where(s); if (!at || !night()) { sparks.length = 0; return; }
      if (Math.random() < dt * 8) sparks.push({ x: at[0] + (Math.random() - 0.5) * 6, y: at[1] - 16, vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 25, t: 0, life: 0.8 + Math.random() * 0.6 });
      for (const p of sparks.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) sparks.splice(sparks.indexOf(p), 1); }
      tick -= dt; if (tick > 0) return; tick = 2;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || q.errand) continue; const d = Math.hypot(a.x - at[0], a.y - at[1]); if (d < 40 && !a.path) { a.dir = O.dirOf(at[0] - a.x, at[1] - a.y); O.gesture && O.gesture(q, 'wipe', 1.8); } }
    });
    (O.extraLights = O.extraLights || []).push((pools, cam) => { const s = cur(); if (!s || !spot || spotSim !== s || !night()) return; pools.push([spot[0] - cam.x, spot[1] - 14 - cam.y, 30 + Math.sin(performance.now() / 150) * 2]); });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene || spotSim !== s || !spot) return; const x = Math.round(spot[0] - cam.x), y = Math.round(spot[1] - cam.y); if (x < -30 || y < -40 || x > ctx.canvas.width + 30 || y > ctx.canvas.height + 30) return;
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 1, y - 6, 2, 6); ctx.fillRect(x - 5, y - 1, 10, 1); ctx.fillRect(x - 6, y - 14, 12, 8); ctx.fillStyle = '#3a3a42'; for (let i = -5; i <= 5; i += 3) ctx.fillRect(x + i, y - 14, 1, 8);
      if (night()) { const tk = Math.floor(performance.now() / 110); ctx.fillStyle = tk % 3 ? '#ff8a20' : '#ffb040'; ctx.fillRect(x - 5, y - 13, 10, 3); ctx.fillStyle = '#ffd070'; ctx.fillRect(x - 3 + (tk % 2), y - 17, 2, 4); ctx.fillRect(x + 1 - (tk % 2), y - 16, 2, 3); ctx.fillStyle = '#fff2a0'; ctx.fillRect(x, y - 15, 1, 2); for (const p of sparks) { ctx.fillStyle = p.t < 0.3 ? '#ffe080' : '#ff9a30'; ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 1, 1); } }
    });
  }
  O.BrazierSetup = { setup };
})();
