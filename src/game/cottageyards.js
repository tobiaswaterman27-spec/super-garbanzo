// Every cottage has its yard. Against the side wall a woodpile, bigger in autumn, low by the end of
// winter; a water butt at the corner; where there's ground, a kitchen garden in a wattle fence, rows of
// leeks and cabbages and beans (bare dug earth in winter, seedlings in spring), and a bench by some doors.
// And the household works the garden: someone hoes between the rows, or waters with a can.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const mem = new WeakMap(), M = (o) => { let m = mem.get(o); if (!m) mem.set(o, (m = {})); return m; };
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const jobs = []; let cool = 6, why = '';
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    function yardOf(w, b) {
      if (M(b).yard !== undefined) return M(b).yard; const h = (k) => O.hash('yard', b.id, k);
      const open = (tx, ty) => { if (tx < 1 || ty < 1 || tx >= w.W - 1 || ty >= w.H - 1) return false; const i = ty * w.W + tx; const t = w.ter[i]; return !w.solid[i] && (t === w.TER.GRASS || t === w.TER.YARD); };
      const clear = (tx, ty) => open(tx, ty) && !w.buildings.some((o) => o !== b && tx >= o.x - 1 && tx <= o.x + o.w && ty >= o.y - 2 && ty <= o.bottom + 1) && !(w.props || []).some((p) => Math.abs(p.x - (tx * T + 8)) < 12 && Math.abs(p.y - (ty * T + 12)) < 12);
      const Y = { wood: null, butt: null, garden: null, bench: null };
      // woodpile against a side wall, at the front corner
      for (const tx of h(1) % 2 ? [b.x - 1, b.x + b.w] : [b.x + b.w, b.x - 1]) if (clear(tx, b.bottom)) { Y.wood = { x: tx * T + 8, y: b.bottom * T + 14, side: tx < b.x ? -1 : 1 }; break; }
      // water butt at the other front corner
      for (const tx of [b.x - 1, b.x + b.w]) if ((!Y.wood || Math.abs(tx * T + 8 - Y.wood.x) > 4) && clear(tx, b.bottom)) { Y.butt = { x: tx * T + 8, y: b.bottom * T + 13 }; break; }
      // a garden plot 3x2 beside the house front, on open grass
      if (h(2) % 3 !== 0) for (const [gx, gy] of [[b.x + b.w + 1, b.bottom], [b.x - 4, b.bottom], [b.x + b.w + 1, b.bottom - 2], [b.x - 4, b.bottom - 2]]) { let ok = true; for (let y = gy; y < gy + 2 && ok; y++) for (let x = gx; x < gx + 3 && ok; x++) if (!clear(x, y)) ok = false; if (ok) { Y.garden = { tx: gx, ty: gy, crop: ['cabbage', 'leek', 'bean'][h(3) % 3] }; break; } }
      if (!Y.garden && h(2) % 3 !== 0) for (const [gx, gy] of [[b.x + b.w + 2, b.bottom + 1], [b.x - 5, b.bottom + 1], [b.x + b.w + 1, b.bottom + 2], [b.x - 4, b.bottom + 2]]) { let ok = true; for (let y = gy; y < gy + 2 && ok; y++) for (let x = gx; x < gx + 3 && ok; x++) if (!clear(x, y)) ok = false; if (ok) { Y.garden = { tx: gx, ty: gy, crop: ['cabbage', 'leek', 'bean'][h(3) % 3] }; break; } }
      // a bench by the door
      if (h(4) % 3 === 0 && clear(b.doorX + 1, b.doorY)) Y.bench = { x: (b.doorX + 1) * T + 8, y: b.doorY * T + 14 };
      return (M(b).yard = Y);
    }
    function release(j) { const a = j.q.agent; if (a) { a.forceAnim = null; if (!talking(j.q)) a.frozen = false; } j.q._garden = false; jobs.splice(jobs.indexOf(j), 1); }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return;
      for (const j of jobs.slice()) { j.t += dt; const a = j.q.agent; if (j.s !== s || !a || j.t > j.len || s.raining || talking(j.q) || j.q.alive === false) { release(j); continue; } a.forceAnim = j.kind === 'water' ? 'pour' : 'hoe'; if (j.kind === 'hoe' && Math.random() < dt * 0.6 && near(a.x, a.y, 180)) O.sfx && O.sfx('dig', 0.06); }
      cool -= dt; if (cool > 0) return; cool = 7 + Math.random() * 6;
      const hr = s.minute / 60; if (hr < 7 || hr > 19 || s.raining || s.season === 'winter' || jobs.filter((j) => j.s === s).length >= 3) { why = 'time/weather'; return; }
      const P = game.player, w = s.world, hs = w.buildings.filter((b) => b.type === 'house' && b.doorX != null && Math.abs(b.doorX * T - P.x) < 520 && Math.abs(b.doorY * T - P.y) < 380 && yardOf(w, b).garden && !jobs.some((j) => j.b === b)); if (!hs.length) { why = 'no garden near'; return; }
      const freeAt = (b) => s.people.find((x) => x.home === b.id && x.age >= 10 && x.agent && !x.agent.frozen && !x.errand && !x._garden && !x._bit && !x._scene && !x._door && !talking(x) && ((!x.agent.hidden && x.agent.inside == null) || x.agent.inside === b.id) && ['home', 'idle', 'rest', 'stroll', 'pastime-none', 'pastime', 'play'].includes(x.activity?.act));
      const pairs = hs.map((b) => [b, freeAt(b)]).filter((x) => x[1]); if (!pairs.length) { why = 'nobody free near'; return; }
      const [b, q] = pick(pairs), Y = yardOf(w, b);
      const kind = s.season === 'summer' && Math.random() < 0.5 ? 'water' : 'hoe', tx = Y.garden.tx + 1 + (Math.random() < 0.5 ? -1 : 1), ty = Y.garden.ty + 2;
      if (w.solid[ty * w.W + tx]) { why = 'blocked'; return; } q._garden = true; why = 'sent ' + q.first;
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.2, face: 3, giveUp: game.t + 40, after: (ok) => { if (!ok || !q.agent) { q._garden = false; return; } q.agent.frozen = true; q.agent.path = null; q.agent.dir = 3; jobs.push({ s, q, b, kind, t: 0, len: 30 + Math.random() * 30 }); } });
    });
    const inView = (x, y, W, H) => x > -50 && y > -50 && x < W + 50 && y < H + 50;
    game.hooks.drawGround.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene || !s.world.ter) return; const w = s.world, W = ctx.canvas.width, H = ctx.canvas.height, se = s.season;
      for (const b of w.buildings) { if (b.type !== 'house' || b.site || b.ruined || b.doorX == null) continue; const bx = b.x * T - cam.x, by = b.bottom * T - cam.y; if (!inView(bx, by, W, H)) continue; const Y = yardOf(w, b); if (!Y.garden) continue;
        const x = Math.round(Y.garden.tx * T - cam.x), y = Math.round(Y.garden.ty * T - cam.y); ctx.fillStyle = '#6a4a30'; ctx.fillRect(x + 2, y + 2, 3 * T - 4, 2 * T - 4);
        for (let r = 0; r < 3; r++) { const ry = y + 6 + r * 9; ctx.fillStyle = '#5a3c26'; ctx.fillRect(x + 4, ry + 3, 3 * T - 8, 2); if (se === 'winter') continue; for (let i = 0; i < 6; i++) { const px = x + 6 + i * 7; const c = Y.garden.crop; if (se === 'spring') { ctx.fillStyle = '#7ab04a'; ctx.fillRect(px, ry + 1, 2, 2); continue; } if (c === 'cabbage') { ctx.fillStyle = se === 'autumn' && i % 2 ? '#5a7a3a' : '#6a9a4a'; ctx.fillRect(px - 1, ry - 1, 5, 4); ctx.fillStyle = '#8aba6a'; ctx.fillRect(px, ry, 3, 2); } else if (c === 'leek') { ctx.fillStyle = '#5a8a4a'; ctx.fillRect(px, ry - 4, 1, 6); ctx.fillRect(px + 2, ry - 3, 1, 5); ctx.fillStyle = '#e8e8d0'; ctx.fillRect(px, ry + 2, 3, 1); } else { ctx.fillStyle = '#6a5030'; ctx.fillRect(px + 1, ry - 8, 1, 10); ctx.fillStyle = '#5a9a3a'; ctx.fillRect(px - 1, ry - 6, 4, 5); if (se === 'summer') { ctx.fillStyle = '#e8e0f0'; ctx.fillRect(px, ry - 7, 1, 1); } } } }
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene || !s.world.ter) return; const w = s.world, W = ctx.canvas.width, H = ctx.canvas.height, se = s.season, dos = (s.weather && s.weather.dayOfSeason) || 0;
      const fill = se === 'autumn' ? 1 : se === 'winter' ? Math.max(0.25, 1 - dos / 30) : se === 'spring' ? 0.4 : 0.6;
      for (const b of w.buildings) { if (b.type !== 'house' || b.site || b.ruined || b.doorX == null) continue; const bx = b.x * T - cam.x, by = b.bottom * T - cam.y; if (!inView(bx, by, W, H)) continue; const Y = yardOf(w, b);
        if (Y.wood && !(O.occluded && O.occluded(Y.wood.x, Y.wood.y))) { const x = Math.round(Y.wood.x - cam.x), y = Math.round(Y.wood.y - cam.y), n = Math.max(3, Math.round(14 * fill)); for (let i = 0; i < n; i++) { const r = Math.floor(i / 4), c = i % 4, lx = x - 9 + c * 5 + (r % 2) * 2, ly = y - 3 - r * 3; ctx.fillStyle = (i + b.id) % 3 ? '#7a5232' : '#8a6239'; ctx.fillRect(lx, ly, 5, 3); ctx.fillStyle = '#c8a070'; ctx.fillRect(lx + (Y.wood.side > 0 ? 0 : 3), ly, 1, 3); } if (se === 'winter' && (s.weather?.snowCover || 0) > 0.3) { ctx.fillStyle = '#f0f4f8'; ctx.fillRect(x - 9, y - 4 - Math.floor((n - 1) / 4) * 3, 20, 1); } }
        if (Y.butt && !(O.occluded && O.occluded(Y.butt.x, Y.butt.y))) { const x = Math.round(Y.butt.x - cam.x), y = Math.round(Y.butt.y - cam.y); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 4, y - 10, 8, 10); ctx.fillStyle = '#5a4028'; ctx.fillRect(x - 4, y - 8, 8, 1); ctx.fillRect(x - 4, y - 3, 8, 1); ctx.fillStyle = se === 'winter' ? '#d0e4f4' : '#4a6a8a'; ctx.fillRect(x - 3, y - 10, 6, 1); }
        if (Y.bench && !(O.occluded && O.occluded(Y.bench.x, Y.bench.y))) { const x = Math.round(Y.bench.x - cam.x), y = Math.round(Y.bench.y - cam.y); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 7, y - 6, 14, 2); ctx.fillRect(x - 6, y - 4, 1, 4); ctx.fillRect(x + 5, y - 4, 1, 4); }
        if (Y.garden) { const x = Math.round(Y.garden.tx * T - cam.x), y = Math.round(Y.garden.ty * T - cam.y), gw = 3 * T, gh = 2 * T; ctx.fillStyle = '#8a6a44'; for (let xx = x; xx <= x + gw; xx += 4) { ctx.fillRect(xx, y - 4, 1, 5); ctx.fillRect(xx, y + gh - 5, 1, 6); } for (const yy of [y - 3, y - 1, y + gh - 4, y + gh - 2]) ctx.fillRect(x, yy, gw + 1, 1); for (let yy = y; yy < y + gh; yy += 4) { ctx.fillRect(x, yy - 3, 1, 4); ctx.fillRect(x + gw, yy - 3, 1, 4); } }
      }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!q._garden) return ''; const j = jobs.find((o) => o.q === q); return j ? (j.kind === 'water' ? 'You are watering your kitchen garden with a can.' : 'You are hoeing between the rows of your kitchen garden.') : ''; });
    O.CottageYards = { jobs, get why() { return why; }, yardOf: (b) => yardOf(cur().world, b) };
  }
  O.CottageYardsSetup = { setup };
})();
