// Shut for good. A shop that has gone under stands with planks nailed across its door and its window
// shutters fastened, a weed or two coming up at the step, until somebody takes it on again.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height;
      for (const b of s.world.buildings) { if (!b.closedShop || s.biz.get(b.id) || b.ruined || !b.sprite || !b.sprite.door) continue; const sp = b.sprite, bx = b.x * 16 - sp.OV - cam.x, by = (b.bottom + 1) * 16 - sp.H - cam.y; if (bx > W + 10 || by > H + 10 || bx + sp.W < -10 || by + sp.H < -10) continue;
        const d = sp.door, x = Math.round(bx + d.x), y = Math.round(by + d.y), w = d.w, h = d.h;
        ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + w, y + h - 3); ctx.moveTo(x + w, y + 2); ctx.lineTo(x, y + h - 3); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = '#8a6a44'; ctx.fillRect(x - 1, y + Math.round(h * 0.45), w + 2, 3); ctx.fillStyle = '#4a4a50'; ctx.fillRect(x, y + Math.round(h * 0.45) + 1, 1, 1); ctx.fillRect(x + w - 1, y + Math.round(h * 0.45) + 1, 1, 1);
        for (const wd of (sp.windows || []).slice(0, 3)) { ctx.fillStyle = 'rgba(70,50,30,0.85)'; ctx.fillRect(Math.round(bx + wd.x), Math.round(by + wd.y), wd.w, wd.h); ctx.fillStyle = 'rgba(40,28,18,0.9)'; ctx.fillRect(Math.round(bx + wd.x + wd.w / 2), Math.round(by + wd.y), 1, wd.h); }
        ctx.fillStyle = '#5a8a3a'; ctx.fillRect(x - 3, y + h - 3, 1, 3); ctx.fillRect(x - 2, y + h - 4, 1, 2); ctx.fillRect(x + w + 2, y + h - 2, 1, 2); }
    });
    O.BoardedUp = { count: () => { const s = cur(); return s.world.buildings.filter((b) => b.closedShop && !s.biz.get(b.id)).length; } };
  }
  O.BoardedUpSetup = { setup };
})();
