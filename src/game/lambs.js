// Spring lambs. In spring the ewes have lambs at foot: little ones that trot after their mothers, butt
// at them to suck, and now and then go off on a mad skipping run, springing straight up on all fours.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const lambs = new Map(); // ewe -> lamb
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const spring = s.season === 'spring', id = s.world.placeId, P = game.player;
      if (!spring) { lambs.clear(); return; }
      for (const f of O.fauna || []) { if (f.kind !== 'sheep' || f.world !== id || f.dead || f.wild) continue; if (Math.hypot(f.x - P.x, f.y - P.y) > 600) { lambs.delete(f); continue; } if (!lambs.has(f) && (f.seed % 3) !== 0) lambs.set(f, { x: f.x + 8, y: f.y + 4, seed: f.seed + 1, dir: 1, ft: 0, hop: 0, run: 0, vx: 0, vy: 0 }); }
      for (const [ewe, l] of lambs) { l.ft += dt; if (l.run > 0) { l.run -= dt; l.x += l.vx * dt; l.y += l.vy * dt; l.hop = Math.abs(Math.sin(l.ft * 9)) * 5; if (game.solidAt(l.x, l.y - 1)) { l.vx = -l.vx; l.vy = -l.vy; } l.dir = l.vx > 0 ? 2 : 1; continue; }
        l.hop = 0; const tx = ewe.x + (ewe.dir === 2 ? -10 : 10), ty = ewe.y + 4, dx = tx - l.x, dy = ty - l.y, d = Math.hypot(dx, dy); if (d > 2) { const st = Math.min(d, (d > 30 ? 40 : 14) * dt); l.x += dx / d * st; l.y += dy / d * st; l.dir = dx > 0 ? 2 : 1; l.moving = true; } else l.moving = false;
        if (Math.random() < dt * 0.06) { l.run = 1.5 + Math.random(); const a = Math.random() * Math.PI * 2; l.vx = Math.cos(a) * 45; l.vy = Math.sin(a) * 25; }
        if (Math.random() < dt * 0.02 && Math.hypot(l.x - P.x, l.y - P.y) < 200) O.animalCall && O.animalCall('sheep', 0.15); }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene || !lambs.size) return;
      for (const l of lambs.values()) { const x = l.x - cam.x, y = l.y - cam.y; if (x < -20 || y < -20 || x > ctx.canvas.width + 20 || y > ctx.canvas.height + 20) continue; const moving = l.run > 0 || l.moving, an = moving ? 'walk' : 'graze', H = O.Animals.HANIMS[an];
        try { const fr = O.Animals.animal('sheep', l.seed, l.dir, moving, Math.floor(l.ft * H.fps * (l.run > 0 ? 2 : 1)) % H.frames, an); const k = 0.6, w = fr.width * k, h = fr.height * k; ctx.drawImage(fr, Math.round(x - (fr.ox ?? fr.width / 2) * k), Math.round(y - (fr.gy ?? fr.height) * k - l.hop), Math.round(w), Math.round(h)); } catch (e) { /* */ } }
    });
    O.Lambs = { lambs };
  }
  O.LambsSetup = { setup };
})();
