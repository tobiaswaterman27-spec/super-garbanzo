// Birds on the water. Wherever there's a pond or a river, ducks paddle about in little parties, upending
// to dabble with their tails in the air, a line of ducklings bobbing after the mother in spring; on the
// wider water a pair of swans glide; and in the shallows a grey heron stands as still as a post, strikes
// at a fish now and then, and flaps off with slow wingbeats if you come too near.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    let flock = null;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function isWater(w, x, y) { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx > 0 && ty > 0 && tx < w.W && ty < w.H && w.ter[ty * w.W + tx] === w.TER.WATER; }
    function build(s) {
      const w = s.world, P = game.player, cx = Math.floor(P.x / T / 16), cy = Math.floor(P.y / T / 16), key = (w.placeId || 'x') + ':' + cx + ':' + cy; if (flock && flock.key === key && flock.s === s) return flock;
      const F = { key, s, ducks: [], herons: [], swans: [] }, r = O.RNG(O.hash('fowl', key));
      const water = []; for (let ty = cy * 16 - 14; ty < cy * 16 + 30; ty += 2) for (let tx = cx * 16 - 20; tx < cx * 16 + 36; tx += 2) if (tx > 1 && ty > 1 && tx < w.W - 1 && ty < w.H - 1 && w.ter[ty * w.W + tx] === w.TER.WATER) water.push([tx, ty]);
      if (water.length < 6) return (flock = F);
      const groups = Math.min(3, Math.floor(water.length / 20) + 1);
      for (let g = 0; g < groups; g++) { const [tx, ty] = water[r.int(0, water.length - 1)]; const n = r.int(2, 4); for (let i = 0; i < n; i++) F.ducks.push({ x: tx * T + 8 + r.int(-10, 10), y: ty * T + 8 + r.int(-6, 6), vx: 0, vy: 0, t: r.next() * 5, dab: 0, male: i === 0, young: false, g }); if (s.season === 'spring') for (let i = 0; i < 4; i++) F.ducks.push({ x: tx * T + 8 - (i + 1) * 5, y: ty * T + 10, vx: 0, vy: 0, t: 0, dab: 0, young: true, g, lead: F.ducks.length - n }); }
      // a heron at the edge (water with land beside)
      const edges = water.filter(([tx, ty]) => w.ter[ty * w.W + tx + 1] !== w.TER.WATER || w.ter[ty * w.W + tx - 1] !== w.TER.WATER || w.ter[(ty + 1) * w.W + tx] !== w.TER.WATER);
      if (edges.length && r.next() < 0.7 && s.season !== 'winter') { const [tx, ty] = edges[r.int(0, edges.length - 1)]; F.herons.push({ x: tx * T + 8, y: ty * T + 10, st: 'stand', t: 0, z: 0, vx: 0, strike: 0 }); }
      if (water.length > 60 && r.next() < 0.5) { const [tx, ty] = water[r.int(0, water.length - 1)]; for (let i = 0; i < 2; i++) F.swans.push({ x: tx * T + 8 + i * 14, y: ty * T + 8 + i * 3, t: r.next() * 6 }); }
      return (flock = F);
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene || !s.world.ter) return; const F = build(s), w = s.world, P = game.player;
      for (const d of F.ducks) { d.t += dt;
        if (d.young) { const m = F.ducks[d.lead]; if (m) { const k = F.ducks.indexOf(d) - d.lead; const tx = m.x - (m.vx >= 0 ? 1 : -1) * 5 * k, ty = m.y + 2; d.x += (tx - d.x) * Math.min(1, dt * 2); d.y += (ty - d.y) * Math.min(1, dt * 2); d.vx = m.vx; } continue; }
        const scare = Math.hypot(P.x - d.x, P.y - d.y) < 50; if (scare) { const a = Math.atan2(d.y - P.y, d.x - P.x); d.vx = Math.cos(a) * 30; d.vy = Math.sin(a) * 20; d.dab = 0; }
        else if (Math.random() < dt * 0.3) { d.vx = (Math.random() - 0.5) * 14; d.vy = (Math.random() - 0.5) * 8; } if (d.dab > 0) { d.dab -= dt; d.vx *= 0.9; d.vy *= 0.9; } else if (!scare && Math.random() < dt * 0.08) d.dab = 1.5 + Math.random() * 2;
        const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt; if (isWater(w, nx, ny) && isWater(w, nx + Math.sign(d.vx) * 4, ny)) { d.x = nx; d.y = ny; } else { d.vx = -d.vx; d.vy = -d.vy; }
        if (scare && Math.random() < dt * 0.6 && near(d.x, d.y, 200)) O.sfx && O.sfx('gull', 0.15); }
      for (const h of F.herons) { h.t += dt; if (h.st === 'stand') { if (Math.hypot(P.x - h.x, P.y - h.y) < 70) { h.st = 'fly'; h.vx = h.x > P.x ? 40 : -40; h.t = 0; } else if (Math.random() < dt * 0.1) h.strike = 0.4; if (h.strike > 0) h.strike -= dt; }
        else { h.x += h.vx * dt; h.z = Math.min(60, h.z + 22 * dt); if (h.t > 6) { h.st = 'gone'; } } }
      for (const sw of F.swans) { sw.t += dt; const nx = sw.x + Math.sin(sw.t * 0.2) * 6 * dt, ny = sw.y + Math.cos(sw.t * 0.17) * 3 * dt; if (isWater(w, nx, ny)) { sw.x = nx; sw.y = ny; } }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene || !flock || flock.s !== s) return; const tk = performance.now() / 1000, W = ctx.canvas.width, H = ctx.canvas.height, F = flock;
      const vis = (x, y) => x > -20 && y > -40 && x < W + 20 && y < H + 20;
      for (const d of F.ducks) { const x = Math.round(d.x - cam.x), y = Math.round(d.y - cam.y); if (!vis(x, y)) continue; const fwd = d.vx >= 0 ? 1 : -1, bob = Math.round(Math.sin(tk * 2 + d.x) * 0.5);
        ctx.fillStyle = 'rgba(220,235,250,0.35)'; ctx.fillRect(x - 4, y + 1, 8, 1);
        if (d.young) { ctx.fillStyle = '#d8c060'; ctx.fillRect(x - 1, y - 2 + bob, 3, 2); ctx.fillRect(x + fwd, y - 3 + bob, 1, 1); continue; }
        if (d.dab > 0) { ctx.fillStyle = d.male ? '#7a6a5a' : '#8a7458'; ctx.fillRect(x - 1, y - 3, 3, 3); ctx.fillStyle = '#e8e4d8'; ctx.fillRect(x, y - 4, 1, 1); continue; }
        ctx.fillStyle = d.male ? '#8a7a68' : '#9a8460'; ctx.fillRect(x - 3, y - 3 + bob, 7, 3); ctx.fillStyle = d.male ? '#2a6a4a' : '#7a6448'; ctx.fillRect(x + fwd * 3 - (fwd < 0 ? 1 : 0), y - 5 + bob, 2, 2); ctx.fillStyle = '#e0a020'; ctx.fillRect(x + fwd * 5 - (fwd < 0 ? 1 : 0), y - 4 + bob, 1, 1); if (d.male) { ctx.fillStyle = '#f0f0f0'; ctx.fillRect(x + fwd * 3 - (fwd < 0 ? 1 : 0), y - 3 + bob, 2, 1); } }
      for (const sw of F.swans) { const x = Math.round(sw.x - cam.x), y = Math.round(sw.y - cam.y); if (!vis(x, y)) continue; ctx.fillStyle = 'rgba(220,235,250,0.35)'; ctx.fillRect(x - 6, y + 1, 12, 1); ctx.fillStyle = '#f4f4f0'; ctx.fillRect(x - 5, y - 4, 10, 4); ctx.fillRect(x + 3, y - 10, 2, 7); ctx.fillRect(x + 3, y - 11, 4, 2); ctx.fillStyle = '#e07020'; ctx.fillRect(x + 7, y - 10, 2, 1); ctx.fillStyle = '#d8d8d4'; ctx.fillRect(x - 5, y - 2, 8, 1); }
      for (const h of F.herons) { if (h.st === 'gone') continue; const x = Math.round(h.x - cam.x), y = Math.round(h.y - h.z - cam.y); if (!vis(x, y)) continue;
        if (h.st === 'stand') { ctx.fillStyle = '#5a5a60'; ctx.fillRect(x, y - 6, 1, 6); ctx.fillRect(x + 2, y - 6, 1, 6); ctx.fillStyle = '#9a9aa4'; ctx.fillRect(x - 2, y - 13, 6, 7); ctx.fillStyle = '#b8b8c0'; const st = h.strike > 0 ? 4 : 0; ctx.fillRect(x + 2, y - 19 + st, 2, 6); ctx.fillRect(x + 3, y - 20 + st, 3, 2); ctx.fillStyle = '#d8c040'; ctx.fillRect(x + 6, y - 19 + st, 3, 1); ctx.fillStyle = '#2a2a30'; ctx.fillRect(x + 3, y - 21 + st, 3, 1); }
        else { const f = Math.floor(tk * 3) % 2, d = h.vx > 0 ? 1 : -1; ctx.fillStyle = '#9a9aa4'; ctx.fillRect(x - 4, y - 2, 8, 3); ctx.fillStyle = '#8a8a94'; ctx.fillRect(x - 10, y - (f ? 6 : 0), 7, 2); ctx.fillRect(x + 3, y - (f ? 6 : 0), 7, 2); ctx.fillStyle = '#b8b8c0'; ctx.fillRect(x + d * 4, y - 3, 3, 2); ctx.fillStyle = '#5a5a60'; ctx.fillRect(x - d * 8, y, 4, 1); } }
    });
    O.Waterfowl = { get flock() { return flock; } };
  }
  O.WaterfowlSetup = { setup };
})();
