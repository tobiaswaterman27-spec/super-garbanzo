// Airing the bedding. On a fine dry morning in spring and summer the goodwives throw the quilts and
// blankets over the windowsills to air in the sun, striped and patched and faded, so that a whole row of
// houses is hung with colour; now and then one is given a beating with a stick in a puff of dust and
// feathers, and by noon they're all taken in again.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const puffs = []; let acc = 0;
    const COLS = [['#b84a3a', '#e8d8b8'], ['#3a5a8a', '#d8d0c0'], ['#5a7a3a', '#e0d8b0'], ['#8a6a3a', '#c8b890'], ['#7a3a6a', '#e0d0c8'], ['#c8a040', '#6a4a2c']];
    const out = (s) => { const hr = s.minute / 60, W = s.weather; return (s.season === 'spring' || s.season === 'summer') && hr >= 8 && hr < 12.5 && !(W && (W.raining || W.kind === 'fog' || W.kind === 'snow')); };
    const hung = (s, b) => b.type === 'house' && b.sprite && (b.sprite.windows || []).length && !b.ruined && !b.closedShop && ((b.id * 7 + s.day * 3) % 10) < 3;
    game.hooks.update.push((dt) => {
      for (const p of puffs.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > 1.2) puffs.splice(puffs.indexOf(p), 1); }
      const s = cur(); if (!s || !s.world || game.scene || !out(s)) return; acc += dt; if (acc < 1.5) return; acc = 0;
      // a beating now and then, from inside the window
      const P = game.player; const bs = s.world.buildings.filter((b) => hung(s, b) && Math.abs(b.x * T - P.x) < 300 && Math.abs(b.bottom * T - P.y) < 220); if (!bs.length || Math.random() < 0.5) return;
      const b = bs[Math.floor(Math.random() * bs.length)], sp = b.sprite, wd = sp.windows[0], bx = b.x * T - sp.OV, by = (b.bottom + 1) * T - sp.H;
      for (let i = 0; i < 10; i++) puffs.push({ x: bx + wd.x + Math.random() * wd.w, y: by + wd.y + wd.h + 4 + Math.random() * 6, vx: (Math.random() - 0.5) * 16, vy: -4 - Math.random() * 10, t: 0, c: i % 4 ? '#d8d0c0' : '#f4f0ea' });
      if (Math.hypot(bx + wd.x - P.x, by + wd.y - P.y) < 260) O.sfx && O.sfx('smack', 0.08);
    });
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (!s || game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height;
      if (out(s)) for (const b of s.world.buildings) { if (!hung(s, b)) continue; const sp = b.sprite, bx = b.x * T - sp.OV - cam.x, by = (b.bottom + 1) * T - sp.H - cam.y; if (bx > W + 10 || by > H + 10 || bx + sp.W < -10 || by + sp.H < -10) continue;
        const wd = sp.windows[0], [c1, c2] = COLS[(b.id + s.day) % COLS.length], x = Math.round(bx + wd.x - 2), y = Math.round(by + wd.y + wd.h - 2), w = wd.w + 4, h = 10 + (b.id % 3) * 2;
        ctx.fillStyle = c1; ctx.fillRect(x, y, w, h); ctx.fillStyle = c2; for (let i = 2; i < h; i += 4) ctx.fillRect(x, y + i, w, 1); if (b.id % 2) { ctx.fillStyle = c2; ctx.fillRect(x + 2, y + 3, 3, 3); } ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + h, w, 1); ctx.fillRect(x + w - 1, y, 1, h); }
      for (const p of puffs) { ctx.globalAlpha = Math.max(0, 0.8 * (1 - p.t / 1.2)); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 1, 1); } ctx.globalAlpha = 1; });
    O.Airing = { out: () => out(cur()), count: () => { const s = cur(); return s.world.buildings.filter((b) => hung(s, b)).length; }, puffs };
  }
  O.AiringSetup = { setup };
})();
