// Shops show their wares. While a shop is open, a trestle stands by its door with what it sells laid
// out on it (the real goods: loaves, cabbages, candles, pots, cloth, knives), fewer as the stock runs
// low; when it shuts, the trestle is carried in and the shutters go up. You can see from down the street
// who's open and what they've got.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const icons = new Map(); const iconOf = (k) => { if (icons.has(k)) return icons.get(k); let c = null; try { c = O.ItemArt ? O.ItemArt.icon(k) : null; } catch (e) { c = null; } icons.set(k, c); return c; };
    const spots = new Map();
    function spotFor(s, b) { if (spots.has(b.id)) return spots.get(b.id); let at = null; for (const dx of [-2, 2, -3, 3]) { const x = (b.doorX + dx) * T + 8, y = (b.doorY + 1) * T + 6; if (!game.solidAt(x - 10, y - 2) && !game.solidAt(x + 10, y - 2) && !game.solidAt(x, y + 4)) { at = [x, y]; break; } } spots.set(b.id, at); return at; }
    game.hooks.drawGround.push((ctx, cam) => {
      const s = cur(); if (!s || !s.biz || game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height, night = game.isNight && game.isNight();
      if (s !== game._dispSim) { spots.clear(); game._dispSim = s; }
      for (const bz of s.biz.values()) {
        if (bz.def.public || !bz.def.sells || !bz.def.sells.length || bz.closedDown || bz.type === 'tavern' || bz.type === 'farmhouse') continue;
        const b = s.building(bz.b?.id ?? bz.id); if (!b || b.doorX == null) continue; const sx = b.doorX * T - cam.x, sy = b.doorY * T - cam.y; if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
        const at = spotFor(s, b); if (!at) continue; const x = Math.round(at[0] - cam.x), y = Math.round(at[1] - cam.y);
        if (bz.open && !night) {
          ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 11, y - 9, 22, 3); ctx.fillRect(x - 10, y - 6, 2, 6); ctx.fillRect(x + 8, y - 6, 2, 6); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 11, y - 9, 22, 1);
          const goods = bz.def.sells.filter((k) => (bz.stock?.[k] || 0) > 0).slice(0, 3); let i = 0;
          for (const k of goods) { const ic = iconOf(k); const n = Math.min(2, Math.ceil((bz.stock[k] || 0) / 6)); for (let j = 0; j < n; j++, i++) { const gx = x - 10 + i * 7, gy = y - 17; if (ic) ctx.drawImage(ic, gx, gy, 9, 9); else { ctx.fillStyle = '#c8a060'; ctx.fillRect(gx + 2, gy + 4, 5, 4); } } }
          if (!goods.length) { ctx.fillStyle = '#e8e0cc'; ctx.fillRect(x - 6, y - 14, 12, 4); ctx.fillStyle = '#5a3d26'; ctx.fillRect(x - 4, y - 13, 8, 1); } // (a board: sold out)
        } else {
          // shutters up over the shop window beside the door
          const wx = Math.round((b.doorX + (at[0] < b.doorX * T ? -1 : 1)) * T + 2 - cam.x), wy = Math.round((b.doorY) * T - 6 - cam.y);
          ctx.fillStyle = '#5a3d26'; ctx.fillRect(wx, wy, 12, 10); ctx.fillStyle = '#4a3020'; ctx.fillRect(wx, wy + 3, 12, 1); ctx.fillRect(wx, wy + 7, 12, 1); ctx.fillStyle = '#3a3a42'; ctx.fillRect(wx + 5, wy + 4, 2, 2);
        }
      }
    });
    O.ShopDisplay = { spots };
  }
  O.ShopDisplaySetup = { setup };
})();
