// The mill turns. A mill beside water has its great wheel going round at its side, paddles dripping,
// the water white under it; a mill with no water near has sails on the roof, turning in the wind (faster
// in a blow, still on a dead calm day, stopped at night when the miller's gone home).
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const cache = new Map();
    function info(s, bz) { const key = (s.world.placeId || 'x') + bz.id; if (cache.has(key)) return cache.get(key); const b = s.building(bz.b?.id ?? bz.id); if (!b) return null; const w = s.world; let water = null;
      if (w.TER && w.ter) for (let r = 1; r < 5 && !water; r++) for (const [x, y] of [[b.x + b.w - 1 + r, b.bottom], [b.x - r, b.bottom], [b.x + b.w - 1 + r, b.bottom - 1], [b.x - r, b.bottom - 1]]) if (!water && w.ter[y * w.W + x] === w.TER.WATER) water = [x * T + 8, y * T + 4];
      const i = { b, water, roof: [(b.x + b.w / 2) * T, (b.bottom + 1) * T - (b.sprite ? b.sprite.H : 64) + 10] }; cache.set(key, i); return i; }
    let rot = 0;
    game.hooks.update.push((dt) => { const s = cur(); if (!s) return; const wind = s.weather ? (s.weather.wind ?? 0.4) : 0.4; rot += dt * (0.6 + wind * 1.6); });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || !s.biz || game.scene) return; const night = game.isNight && game.isNight();
      for (const bz of s.biz.values()) { if (bz.type !== 'mill' && bz.type !== 'sawmill') continue; const I = info(s, bz); if (!I) continue;
        const going = !night && (bz.open !== false); const a = going ? rot : 0.3;
        if (I.water) { const x = Math.round(I.water[0] - cam.x), y = Math.round(I.water[1] - cam.y); if (x < -40 || y < -40 || x > ctx.canvas.width + 40 || y > ctx.canvas.height + 40) continue; const R = 13;
          ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - R, R, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = '#6a4a2c';
          for (let i = 0; i < 8; i++) { const t = a + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x, y - R); ctx.lineTo(x + Math.cos(t) * R, y - R + Math.sin(t) * R); ctx.stroke(); ctx.fillStyle = '#5a3d26'; ctx.fillRect(Math.round(x + Math.cos(t) * R) - 2, Math.round(y - R + Math.sin(t) * R) - 1, 4, 3); }
          ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 1, y - R - 1, 3, 3); if (going) { ctx.fillStyle = 'rgba(235,245,255,0.7)'; for (let i = 0; i < 5; i++) ctx.fillRect(x - 8 + ((i * 5 + Math.floor(performance.now() / 90)) % 16), y - 1 + (i % 2), 2, 1); } }
        else { const x = Math.round(I.roof[0] - cam.x), y = Math.round(I.roof[1] - cam.y); if (x < -60 || y < -60 || x > ctx.canvas.width + 60 || y > ctx.canvas.height + 60) continue; const L = 22;
          for (let i = 0; i < 4; i++) { const t = a + i * Math.PI / 2, ex = x + Math.cos(t) * L, ey = y + Math.sin(t) * L; ctx.strokeStyle = '#5a3d26'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke(); const px = -Math.sin(t) * 4, py = Math.cos(t) * 4; ctx.fillStyle = 'rgba(232,224,204,0.9)'; ctx.beginPath(); ctx.moveTo(x + Math.cos(t) * 6, y + Math.sin(t) * 6); ctx.lineTo(ex, ey); ctx.lineTo(ex + px, ey + py); ctx.lineTo(x + Math.cos(t) * 6 + px, y + Math.sin(t) * 6 + py); ctx.closePath(); ctx.fill(); }
          ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 2, y - 2, 4, 4); } }
    });
  }
  O.MillsSetup = { setup };
})();
