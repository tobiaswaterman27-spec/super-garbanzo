// The open country isn't bare. Every field has its scarecrow, and crows that hop about the furrows and
// go up cawing when you come near; after harvest the fields stand with haystacks; along the roads out of
// town there's a wayside cross where travellers stop to cross themselves, and a milestone.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const H = (a, b, c) => O.hash('cs', a, b, c) % 1000 / 1000;
    let cache = null;
    function features(s) {
      const w = s.world; if (!w.ter || !w.TER) return null; const P = game.player, cx = Math.floor(P.x / T / 12), cy = Math.floor(P.y / T / 12), key = (w.placeId || 'x') + ':' + cx + ':' + cy;
      if (cache && cache.key === key) return cache; const out = { key, scare: [], hay: [], cross: [], crows: [] };
      for (let gy = cy - 2; gy <= cy + 2; gy++) for (let gx = cx - 3; gx <= cx + 3; gx++) {
        const tx = gx * 12 + 6, ty = gy * 12 + 6; if (tx < 2 || ty < 2 || tx >= w.W - 2 || ty >= w.H - 2) continue; const t = w.ter[ty * w.W + tx]; const solid = w.solid[ty * w.W + tx];
        if (t === w.TER.FIELD && !solid) { out.scare.push({ x: tx * T + 8, y: ty * T + 12 }); for (let i = 0; i < 4; i++) out.crows.push({ x: tx * T + 8 + (H(gx, gy, i) - 0.5) * 80, y: ty * T + 12 + (H(gy, gx, i) - 0.5) * 50, z: 0, st: 'ground', t: H(i, gx, gy) * 5, vx: 0, vy: 0, vz: 0, hx: 0, hy: 0 }); for (let i = 0; i < 3; i++) if (H(gx, i, gy) < 0.7) out.hay.push({ x: (tx + (H(i, gy, gx) - 0.5) * 8) * T, y: (ty + (H(gy, i, gx) - 0.5) * 6) * T }); }
        if (t === w.TER.ROAD && !solid && H(gx, gy, 99) < 0.12) { const nx = tx + 1; if (!w.solid[ty * w.W + nx] && w.ter[ty * w.W + nx] !== w.TER.ROAD) out.cross.push({ x: nx * T + 8, y: ty * T + 12, mile: H(gx, gy, 7) < 0.5 }); }
      }
      for (const c of out.crows) { c.hx = c.x; c.hy = c.y; }
      cache = out; return out;
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const F = features(s); if (!F) return; const P = game.player;
      for (const c of F.crows) { c.t += dt;
        if (c.st === 'ground') { const d = Math.hypot(P.x - c.x, P.y - c.y); let scare = d < 40; if (!scare) for (const q of s.people) { const a = q.agent; if (a && !a.hidden && a.inside == null && Math.abs(a.x - c.x) < 30 && Math.abs(a.y - c.y) < 30) { scare = true; break; } } if (scare) { c.st = 'fly'; c.vx = (c.x - P.x) * 1.5 + (Math.random() - 0.5) * 50; c.vy = (Math.random() - 0.5) * 40; c.vz = 60; c.air = 3 + Math.random() * 3; if (Math.random() < 0.3 && d < 200) O.animalCall && O.animalCall('crow', 0.25); } else if (Math.random() < dt * 0.5) { c.x += (Math.random() - 0.5) * 6; c.y += (Math.random() - 0.5) * 4; } }
        else { c.air -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z = Math.max(0, c.z + c.vz * dt); c.vz -= 18 * dt; if (c.air < 0) { c.vx += (c.hx - c.x) * dt; c.vy += (c.hy - c.y) * dt; if (c.vz < -15) c.vz = -15; if (c.z <= 0.5 && Math.hypot(c.x - c.hx, c.y - c.hy) < 40) { c.st = 'ground'; c.z = 0; } if (c.air < -10) { c.x = c.hx; c.y = c.hy; c.z = 0; c.st = 'ground'; } } } }
      if (Math.random() < 0.02) for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || !a.path || q._crossed === s.day) continue; const x = F.cross.find((c) => !c.mile && Math.hypot(c.x - a.x, c.y - a.y) < 24); if (x) { q._crossed = s.day; O.gesture && O.gesture(q, 'pray', 1.5); } }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || !s.world || game.scene || !cache) return; const F = cache, W = ctx.canvas.width, Hh = ctx.canvas.height, tk = performance.now() / 1000, season = s.season;
      const vis = (x, y) => x > -30 && y > -50 && x < W + 30 && y < Hh + 30;
      if (season === 'autumn' || (season === 'summer' && (s.weather?.dayOfSeason || 0) > 20)) for (const h of F.hay) { const x = Math.round(h.x - cam.x), y = Math.round(h.y - cam.y); if (!vis(x, y)) continue; ctx.fillStyle = '#c8a850'; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.quadraticCurveTo(x, y - 18, x + 8, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#a88838'; ctx.fillRect(x - 6, y - 4, 12, 1); ctx.fillRect(x - 4, y - 9, 8, 1); }
      for (const sc of F.scare) { const x = Math.round(sc.x - cam.x), y = Math.round(sc.y - cam.y); if (!vis(x, y)) continue; const sw = Math.round(Math.sin(tk * 1.4 + sc.x) * 1); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x, y - 22, 2, 22); ctx.fillRect(x - 8, y - 17 + sw, 18, 2); ctx.fillStyle = '#7a6a4a'; ctx.fillRect(x - 4, y - 18, 10, 9); ctx.fillStyle = '#d8c070'; ctx.fillRect(x - 2, y - 25, 6, 6); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 3, y - 27, 8, 2); ctx.fillStyle = '#d8c070'; ctx.fillRect(x - 9, y - 16 + sw, 2, 3); ctx.fillRect(x + 9, y - 16 + sw, 2, 3); }
      for (const c of F.crows) { const x = Math.round(c.x - cam.x), y = Math.round(c.y - c.z - cam.y); if (!vis(x, y)) continue; ctx.fillStyle = '#1a1a20'; if (c.st === 'ground') { const peck = Math.floor(c.t * 3 + c.hx) % 4 === 0; ctx.fillRect(x - 2, y - 3, 4, 2); ctx.fillRect(x + 1, y - (peck ? 2 : 4), 2, 2); } else { const f = Math.floor(c.t * 12) % 2; ctx.fillRect(x - 1, y, 3, 2); ctx.fillRect(x - 4, y - f, 3, 1); ctx.fillRect(x + 2, y - f, 3, 1); } }
      for (const x0 of F.cross) { const x = Math.round(x0.x - cam.x), y = Math.round(x0.y - cam.y); if (!vis(x, y)) continue; if (x0.mile) { ctx.fillStyle = '#9a968e'; ctx.fillRect(x - 3, y - 9, 6, 9); ctx.fillStyle = '#b8b4ac'; ctx.fillRect(x - 3, y - 9, 6, 2); ctx.fillStyle = '#5a5650'; ctx.fillRect(x - 1, y - 6, 2, 1); } else { ctx.fillStyle = '#8a8680'; ctx.fillRect(x - 4, y - 2, 9, 3); ctx.fillStyle = '#a8a49c'; ctx.fillRect(x - 1, y - 22, 3, 21); ctx.fillRect(x - 6, y - 17, 13, 3); ctx.fillStyle = '#c84060'; ctx.fillRect(x + 3, y - 3, 2, 2); } }
    });
    O.Countryside = { features: () => features(cur()) };
  }
  O.CountrysideSetup = { setup };
})();
