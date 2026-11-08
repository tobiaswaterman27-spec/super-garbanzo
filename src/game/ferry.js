// The ferry crosses. Where there's a ferry, its flat boat goes back and forth across the water all day,
// the ferryman leaning on his pole at the stern, a passenger or two standing amidships with their bundle,
// sometimes a goat; it bumps the landing, they step off, others step on.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    let F = null, seed = 1;
    const mk = (i) => O.Char.makeAppearance(O.hash('ferry', i, seed), { sex: i ? (i % 2 ? 'f' : 'm') : 'm', age: 22 + i * 9, genes: O.Char.randomGenes(O.RNG(O.hash('fg', i, seed)), 'north'), role: i ? 'peasant' : 'fisher', wealth: 0.3 });
    function find(s) {
      const w = s.world; if (!w.TER || !w.ter) return null; const fz = [...s.biz.values()].find((z) => z.type === 'ferry'); const b = fz && s.building(fz.b?.id ?? fz.id); if (!b || b.doorX == null) return null;
      const water = (x, y) => x > 0 && y > 0 && x < w.W && y < w.H && w.ter[y * w.W + x] === w.TER.WATER;
      for (let r = 1; r < 14; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { const x0 = b.doorX + dx, y0 = b.doorY + dy; if (!water(x0, y0)) continue; const sx = Math.sign(dx), sy = Math.sign(dy); let n = 0; while (water(x0 + sx * n, y0 + sy * n) && n < 30) n++; if (n >= 3) { seed++; return { s, a: [x0 * T + 8, y0 * T + 8], b: [(x0 + sx * (n - 1)) * T + 8, (y0 + sy * (n - 1)) * T + 8], k: 0, dir: 1, wait: 2, men: [0, 1, 2].map(mk), ft: 0 }; } }
      return null;
    }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return; if (!F || F.s !== s) F = find(s); if (!F) return; F.ft += dt; if (game.isNight && game.isNight()) return; if (F.wait > 0) { F.wait -= dt; if (F.wait <= 0) F.n = 1 + Math.floor(Math.random() * 2); return; } const L = Math.hypot(F.b[0] - F.a[0], F.b[1] - F.a[1]); F.k += (F.dir * 14 * dt) / Math.max(1, L); if (F.k >= 1 || F.k <= 0) { F.k = Math.max(0, Math.min(1, F.k)); F.dir = -F.dir; F.wait = 4 + Math.random() * 4; if (Math.hypot(F.a[0] - game.player.x, F.a[1] - game.player.y) < 300) O.sfx && O.sfx('place', 0.3); } });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (!F || game.scene || F.s !== cur()) return; const x0 = F.a[0] + (F.b[0] - F.a[0]) * F.k, y0 = F.a[1] + (F.b[1] - F.a[1]) * F.k, x = Math.round(x0 - cam.x), y = Math.round(y0 - cam.y) + Math.round(Math.sin(F.ft * 1.5)); if (x < -60 || y < -60 || x > ctx.canvas.width + 60 || y > ctx.canvas.height + 60) return;
      const horiz = Math.abs(F.b[0] - F.a[0]) > Math.abs(F.b[1] - F.a[1]), dir = horiz ? (F.dir > 0 === (F.b[0] > F.a[0]) ? 2 : 1) : 0;
      const n = F.wait > 0 ? 0 : (F.n || 1);
      for (let i = n; i >= 0; i--) { try { const an = i === 0 ? 'pitch' : 'idle', A = O.Char.ANIMS[an], fr = O.Char.frame(F.men[i], dir, an, Math.floor(F.ft * A.fps) % A.frames); ctx.drawImage(fr, x - 16 + (i === 0 ? -10 : i * 7 - 4), y - O.Char.GROUND + 2); } catch (e) { /* */ } }
      ctx.fillStyle = '#5e3e28'; ctx.fillRect(x - 18, y - 4, 36, 7); ctx.fillStyle = '#7a5232'; ctx.fillRect(x - 18, y - 5, 36, 2); ctx.fillStyle = '#4a3020'; for (let i = -14; i <= 14; i += 7) ctx.fillRect(x + i, y - 3, 1, 5); ctx.fillStyle = 'rgba(220,235,250,0.6)'; ctx.fillRect(x - 16, y + 3, 32, 1);
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 8, y - 26); ctx.lineTo(x - 18, y + 6); ctx.stroke();
    });
    O.Ferry = { get F() { return F; } };
  }
  O.FerrySetup = { setup };
})();
