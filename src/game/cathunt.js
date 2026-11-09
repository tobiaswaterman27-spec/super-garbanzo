// The cat hunts. At night, when the mice are out along the walls, a cat nearby notices: it goes low and
// creeps, a paw at a time, freezing when the mouse freezes, tail-tip twitching; then the rump wiggles and
// it pounces. Often enough it misses and the mouse is gone into a crack; when it doesn't, it trots off
// proudly with the mouse in its mouth, and as like as not leaves it on somebody's doorstep.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    let H = null, caught = 0, missed = 0; const gifts = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) { H = null; return; } const mice = (O.Mice && O.Mice.mice) || [];
      for (const g of gifts.slice()) if (g.s !== s || g.day !== s.day && s.minute > 9 * 60) gifts.splice(gifts.indexOf(g), 1);
      if (H) { H.t += dt; const c = H.cat, m = H.mouse; c._held = game.t + 0.5;
        if (H.phase === 'stalk') { if (!mice.includes(m) || m.flee) { H.phase = 'off'; H.t = 0; missed++; }
          else { const d = Math.hypot(m.x - c.x, m.y - c.y); c.dir = m.x > c.x ? 2 : 1; if (m.st === 'freeze') { c.x += (m.x - c.x) / d * 18 * dt; c.y += (m.y - c.y) / d * 18 * dt; c.moving = true; } else c.moving = false; c.tx = null;
            if (d < 30) { H.phase = 'wiggle'; H.t = 0; } } }
        if (H.phase === 'wiggle') { c.moving = false; c.tx = null; c.x += Math.sin(H.t * 40) * 0.3; if (H.t > 0.8) { H.phase = 'pounce'; H.t = 0; H.from = [c.x, c.y]; H.to = [m.x, m.y]; } }
        if (H.phase === 'pounce') { const k = Math.min(1, H.t / 0.25); c.x = H.from[0] + (H.to[0] - H.from[0]) * k; c.y = H.from[1] + (H.to[1] - H.from[1]) * k - Math.sin(k * Math.PI) * 6; c.moving = true; c.tx = null;
          if (k >= 1) { const got = mice.includes(m) && Math.random() < 0.6; if (got) { mice.splice(mice.indexOf(m), 1); caught++; H.phase = 'proud'; H.t = 0; if (near(c.x, c.y, 260)) O.sfx && O.sfx('squeak', 0.2); } else { if (mice.includes(m)) { m.flee = true; m.st = 'run'; m.t = 0; m.go = 9; m.dir = Math.random() < 0.5 ? 1 : -1; } missed++; H.phase = 'off'; H.t = 0; } } }
        if (H.phase === 'proud') { // trot off and leave it on a doorstep
          if (!H.door) { const bs = s.world.buildings.filter((b) => b.doorX != null && Math.hypot(b.doorX * 16 - c.x, b.doorY * 16 - c.y) < 220); const b = bs[Math.floor(Math.random() * bs.length)]; H.door = b ? [b.doorX * 16 + 8 + (Math.random() - 0.5) * 6, (b.doorY + 1) * 16 + 12] : [c.x + 40, c.y]; }
          const dx = H.door[0] - c.x, dy = H.door[1] - c.y, d = Math.hypot(dx, dy); if (d > 2 && H.t < 20) { c.x += dx / d * 30 * dt; c.y += dy / d * 30 * dt; c.dir = dx > 0 ? 2 : 1; c.moving = true; c.tx = null; } else { gifts.push({ s, x: c.x + (c.dir === 2 ? 5 : -5), y: c.y, day: s.day }); H = null; return; } }
        if (H.phase === 'off') { c.moving = false; if (H.t > 1.5) { H = null; return; } }
        if (H.t > 40) H = null;
        return; }
      if (!mice.length) return; const id = s.world.placeId;
      for (const c of O.fauna || []) { if (c.kind !== 'cat' || c.world !== id || c.dead || !near(c.x, c.y, 360)) continue; const m = mice.find((mm) => !mm.flee && Math.hypot(mm.x - c.x, mm.y - c.y) < 160); if (!m) continue; H = { cat: c, mouse: m, phase: 'stalk', t: 0 }; break; }
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; const s = cur();
      // the mouse in its mouth, and the little grey gifts left on doorsteps
      if (H && H.phase === 'proud') { const c = H.cat, x = Math.round(c.x - cam.x) + (c.dir === 2 ? 6 : -8), y = Math.round(c.y - cam.y) - 6; ctx.fillStyle = '#5a504a'; ctx.fillRect(x, y, 3, 2); ctx.fillStyle = '#8a7a74'; ctx.fillRect(x + (c.dir === 2 ? 3 : -2), y + 1, 2, 1); }
      if (H && (H.phase === 'stalk' || H.phase === 'wiggle')) { const c = H.cat, x = Math.round(c.x - cam.x) + (c.dir === 2 ? -9 : 8), y = Math.round(c.y - cam.y) - 8 + (Math.floor(performance.now() / 160) % 2); ctx.fillStyle = '#3a3030'; ctx.fillRect(x, y, 1, 2); }
      for (const g of gifts) { if (g.s !== s) continue; const x = Math.round(g.x - cam.x), y = Math.round(g.y - cam.y); ctx.fillStyle = '#5a504a'; ctx.fillRect(x, y - 1, 3, 2); ctx.fillStyle = '#8a7a74'; ctx.fillRect(x + 3, y, 2, 1); } });
    O.CatHunt = { get hunt() { return H; }, get caught() { return caught; }, get missed() { return missed; }, gifts };
  }
  O.CatHuntSetup = { setup };
})();
