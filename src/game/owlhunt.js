// The owl. On a still night a barn owl comes over the roofs like a pale ghost, quartering low and silent;
// it checks, hangs a moment with its face turned down, and drops with its feet thrown forward onto a mouse
// out along the wall. Often it rises with the mouse in its talons and is gone into the dark; sometimes it
// comes up empty and sails off to try again. A screech from somewhere, and that's all you know of it.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    let W = null, cool = 30, caught = 0, missed = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const night = () => game.isNight && game.isNight();
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) { W = null; return; } const mice = (O.Mice && O.Mice.mice) || [];
      if (W) { W.t += dt; const m = W.mouse;
        if (W.phase === 'in') { const k = Math.min(1, W.t / 2.6); W.x = W.x0 + (m.x - W.x0) * k; W.y = W.y0 + (m.y - 30 - W.y0) * k; W.h = 60 * (1 - k) + 30; W.flap = 0; if (k >= 1) { W.phase = 'hover'; W.t = 0; } }
        else if (W.phase === 'hover') { W.x = m.x; W.y = m.y - 30 + Math.sin(W.t * 8) * 1; W.flap = 1; if (W.t > 0.7) { W.phase = 'drop'; W.t = 0; W.tx = m.x; W.ty = m.y; } }
        else if (W.phase === 'drop') { const k = Math.min(1, W.t / 0.25); W.y = (W.ty - 30) + 30 * k; W.x = W.tx; if (k >= 1) { const got = mice.includes(m) && Math.random() < 0.65; if (got) { mice.splice(mice.indexOf(m), 1); caught++; W.got = true; } else { missed++; if (mice.includes(m)) { m.flee = true; m.st = 'run'; m.go = 9; } } W.phase = 'up'; W.t = 0; W.x0 = W.x; W.y0 = W.y; if (near(W.x, W.y, 300)) O.animalCall && O.animalCall('owl', 0.25); } }
        else { const k = W.t / 2.5; W.x = W.x0 + W.dir * 140 * k; W.y = W.y0 - 30 - 80 * k; W.flap = 1; if (k >= 1) W = null; }
        return; }
      if (!night() || !mice.length) return; cool -= dt; if (cool > 0) return; cool = 40 + Math.random() * 60;
      const m = mice.find((mm) => !mm.flee && near(mm.x, mm.y, 300)); if (!m || (O.CatHunt && O.CatHunt.hunt && O.CatHunt.hunt.mouse === m)) return;
      const dir = Math.random() < 0.5 ? 1 : -1; W = { mouse: m, x0: m.x - dir * 220, y0: m.y - 120, x: m.x - dir * 220, y: m.y - 120, h: 60, dir, t: 0, phase: 'in', flap: 0, got: false };
    });
    game.hooks.drawTop.push((ctx, cam, inScene) => { if (!W || inScene || game.scene) return; const x = Math.round(W.x - cam.x), y = Math.round(W.y - cam.y), d = W.dir, f = W.flap ? Math.floor(performance.now() / 70) % 2 : 0;
      // its shadow on the ground while it's low
      if (W.phase === 'hover' || W.phase === 'drop') { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(W.tx ?? W.x) - cam.x - 4, Math.round((W.ty ?? W.y + 30) - cam.y), 9, 2); }
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 2, y - 3, 5, 5); ctx.fillStyle = '#c8a870'; ctx.fillRect(x - 7, y - 2 - (f ? 2 : 0), 5, 2); ctx.fillRect(x + 3, y - 2 - (f ? 2 : 0), 5, 2); ctx.fillStyle = '#f4f0e8'; ctx.fillRect(x - 1, y - 2, 3, 2); ctx.fillStyle = '#2a2020'; ctx.fillRect(x - 1 + (d > 0 ? 1 : 0), y - 2, 1, 1);
      if (W.got && W.phase === 'up') { ctx.fillStyle = '#5a504a'; ctx.fillRect(x - 1, y + 3, 3, 2); } });
    O.OwlHunt = { get owl() { return W; }, get caught() { return caught; }, get missed() { return missed; }, soon: () => { cool = 0; } };
  }
  O.OwlHuntSetup = { setup };
})();
