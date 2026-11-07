// The harbour. Where a place has a harbour, a ship lies at the quay: a fat-bellied cog with one mast,
// her sail furled on the yard and a pennant flying, rocking a little; sailors go up and down the
// gangplank with sacks and casks on their shoulders, and gulls wheel and cry over the water. Now and
// then she's gone (sailed) and another comes in.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let port = null, seed = 1;
    const mk = (i) => O.Char.makeAppearance(O.hash('sailor', i, seed), { sex: 'm', age: 20 + i * 7, genes: O.Char.randomGenes(O.RNG(O.hash('sl', i, seed)), pick(['west', 'south', 'north'])), role: 'fisher', wealth: 0.3 });
    function find(s) {
      const w = s.world; if (!w.TER || !w.ter) return null; const hb = [...s.biz.values()].find((z) => z.type === 'harbour'); const b = hb && s.building(hb.b?.id ?? hb.id); if (!b || b.doorX == null) return null;
      const water = (x, y) => x > 0 && y > 0 && x < w.W && y < w.H && w.ter[y * w.W + x] === w.TER.WATER;
      let best = null; for (let r = 2; r < 18 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) { const x = b.doorX + dx, y = b.doorY + dy; if (water(x, y) && water(x + 1, y) && water(x - 1, y) && water(x + 2, y) && water(x - 2, y)) { const land = [[0, -1], [0, 1], [-3, 0], [3, 0]].map(([ax, ay]) => [x + ax, y + ay]).find(([ax, ay]) => !water(ax, ay) && !w.solid[ay * w.W + ax]); if (land) best = { ship: [x * T + 8, y * T + 8], quay: [land[0] * T + 8, land[1] * T + 10], door: [b.doorX * T + 8, (b.doorY + 1) * T + 10] }; } }
      if (!best) return null; seed++;
      return Object.assign(best, { s, t: 0, men: [0, 1, 2].map((i) => ({ app: mk(i), t: i * 2.2, ft: 0 })), gulls: Array.from({ length: 4 }, (_, i) => ({ a: i * 1.5, r: 30 + i * 8, h: 40 + i * 6 })), name: pick(['the Margaret', 'the Holy Ghost', 'the Swan of Bristow', 'the Cog Anne', 'the Saint Nicholas', 'the Good Hope']), cargo: pick(['wine', 'wool', 'salt', 'cloth', 'iron']) });
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; if (!port || port.s !== s) port = find(s); if (!port) return; port.t += dt;
      for (const m of port.men) m.ft += dt; for (const g of port.gulls) g.a += dt * (0.5 + g.r / 100);
      if (Math.random() < dt * 0.05 && Math.hypot(port.ship[0] - game.player.x, port.ship[1] - game.player.y) < 300) O.animalCall && O.animalCall('crow', 0.15);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const P = port; if (!P || game.scene) return; const tk = performance.now() / 1000, day = !(game.isNight && game.isNight());
      const sx = Math.round(P.ship[0] - cam.x), sy = Math.round(P.ship[1] - cam.y) + Math.round(Math.sin(tk * 0.8) * 1); if (sx < -80 || sy < -100 || sx > ctx.canvas.width + 80 || sy > ctx.canvas.height + 80) return;
      // the cog
      ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.moveTo(sx - 32, sy - 14); ctx.lineTo(sx + 32, sy - 14); ctx.quadraticCurveTo(sx + 26, sy + 6, sx, sy + 6); ctx.quadraticCurveTo(sx - 26, sy + 6, sx - 32, sy - 14); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3a2418'; ctx.fillRect(sx - 28, sy - 4, 56, 1); ctx.fillRect(sx - 24, sy + 1, 48, 1); ctx.fillStyle = '#5e3e28'; ctx.fillRect(sx - 28, sy - 13, 56, 4); ctx.fillStyle = '#3a2418'; for (let i = -24; i < 26; i += 6) ctx.fillRect(sx + i, sy - 9, 1, 6);
      ctx.fillStyle = '#5e3e28'; ctx.fillRect(sx - 30, sy - 22, 10, 10); ctx.fillRect(sx + 20, sy - 20, 10, 8); // castles fore and aft
      ctx.fillStyle = '#6a4a2c'; ctx.fillRect(sx - 1, sy - 66, 3, 54); ctx.fillRect(sx - 18, sy - 58, 37, 2); ctx.fillStyle = '#e8e0cc'; ctx.fillRect(sx - 18, sy - 57, 37, 4);
      ctx.fillStyle = '#b8352a'; ctx.fillRect(sx + 2, sy - 66, 8 + (Math.floor(tk * 3) % 2), 3);
      ctx.fillStyle = 'rgba(200,220,235,0.5)'; ctx.fillRect(sx - 26, sy + 4, 52, 1);
      // gangplank to the quay
      const qx = Math.round(P.quay[0] - cam.x), qy = Math.round(P.quay[1] - cam.y); ctx.strokeStyle = '#8a6239'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy - 12); ctx.lineTo(qx, qy - 2); ctx.stroke(); ctx.lineWidth = 1;
      // sailors up and down with loads
      if (day) for (const m of P.men) { const L = 8, k = ((m.t + P.t) % L) / L, up = k < 0.5, u = up ? k * 2 : (1 - k) * 2; const ax = P.ship[0] + (P.door[0] - P.ship[0]) * u, ay = P.ship[1] - 12 + (P.door[1] - (P.ship[1] - 12)) * u; const dir = (up ? P.door[0] - P.ship[0] : P.ship[0] - P.door[0]) > 0 ? 2 : 1; try { const anim = up ? 'carry' : 'walk', A = O.Char.ANIMS[anim]; const fr = O.Char.frame(m.app, dir, anim, Math.floor(m.ft * A.fps) % A.frames); ctx.drawImage(fr, Math.round(ax - cam.x) - 16, Math.round(ay - cam.y) - O.Char.GROUND); } catch (e) { /* */ } if (up) { ctx.fillStyle = P.cargo === 'wine' ? '#6a4a2c' : '#c8b080'; ctx.fillRect(Math.round(ax - cam.x) - 3, Math.round(ay - cam.y) - 30, 7, 6); } }
      // gulls
      if (day) for (const g of P.gulls) { const x = Math.round(P.ship[0] + Math.cos(g.a) * g.r - cam.x), y = Math.round(P.ship[1] - g.h + Math.sin(g.a) * g.r * 0.4 - cam.y), f = Math.floor(tk * 6 + g.r) % 2; ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x - 3, y - f, 2, 1); ctx.fillRect(x + 2, y - f, 2, 1); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => port && port.s === s && /harbour|sailor|fisher|carrier|porter/.test(q.job?.role || '') ? `${port.name} lies at the quay unloading ${port.cargo}.` : '');
    O.Harbour = { get port() { return port; } };
  }
  O.HarbourSetup = { setup };
})();
