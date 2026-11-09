// Fighting the flood. When the river is out, people don't just wait: householders whose floors are under
// water stand at their doors bailing it out with buckets, the water flying in arcs; men heap sacks of earth
// along the edge of the flood to hold it back, the bank of sacks growing; and those who can carry their
// chest and bedding up to higher ground.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const jobs = [], drops = [], sacks = []; let cool = 3, bailed = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._flood && !talking(q) && q.age >= 14;
    function release(j) { const a = j.q.agent; if (a) { a.forceAnim = null; if (!talking(j.q)) a.frozen = false; } j.q._flood = false; jobs.splice(jobs.indexOf(j), 1); }
    function edgeNear(s, F, tx, ty, r) { const w = s.world; for (let rr = 1; rr <= r; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const x = tx + dx, y = ty + dy; if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1) continue; const i = y * w.W + x; if (w.solid[i] || F.tiles.has(i)) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => F.tiles.has((y + b) * w.W + x + a))) return [x, y]; } return null; }
    game.hooks.update.push((dt) => {
      for (const d of drops.slice()) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 200 * dt; if (d.t > 0.6) drops.splice(drops.indexOf(d), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const F = s.floodState;
      for (const j of jobs.slice()) { j.t += dt; const a = j.q.agent; if (j.s !== s || !F || !F.tiles || !a || j.t > 70 || talking(j.q)) { release(j); continue; }
        if (j.kind === 'bail') { a.forceAnim = Math.floor(j.t * 1.2) % 2 ? 'pour' : 'pickup'; if (Math.random() < dt * 1.5) { bailed++; for (let i = 0; i < 8; i++) drops.push({ x: a.x + j.dx * 6, y: a.y - 12, vx: j.dx * (40 + Math.random() * 40) + (Math.random() - 0.5) * 20, vy: -50 - Math.random() * 30, t: 0 }); if (near(a.x, a.y, 260)) O.sfx && O.sfx('splash', 0.2); } }
        else { a.forceAnim = 'pitch'; if (Math.random() < dt * 0.5) { const g = sacks.find((x) => x.s === s && Math.hypot(x.x - j.sx, x.y - j.sy) < 6); if (g) g.n = Math.min(6, g.n + 1); else sacks.push({ s, x: j.sx, y: j.sy, n: 1 }); if (near(a.x, a.y, 260)) O.sfx && O.sfx('dig', 0.15); } }
        if (!j.said && j.t > 6 && near(a.x, a.y, 300)) { j.said = true; O.Speech && O.Speech.say(j.q, j.kind === 'bail' ? pick(['It\'s in the kitchen! The flour!', 'Bail, children, bail!', 'Every year the same!']) : pick(['More sacks! Hold it here!', 'Pile them higher!', 'Lord, look at it rising.']), 2.4); } }
      for (const g of sacks.slice()) if (g.s !== s || !F || !F.tiles) sacks.splice(sacks.indexOf(g), 1);
      cool -= dt; if (cool > 0) return; cool = 3 + Math.random() * 3; if (!F || !F.tiles || !F.tiles.size || jobs.filter((j) => j.s === s).length >= 5) return;
      const P = game.player, w = s.world;
      if (Math.random() < 0.6) { // a household bails
        const hs = w.buildings.filter((b) => b.type === 'house' && b.doorX != null && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 420 && !jobs.some((j) => j.b === b) && (() => { for (let yy = b.y; yy <= b.bottom; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) if (F.tiles.has(yy * w.W + xx)) return true; return false; })()); if (!hs.length) return;
        const b = pick(hs), q = s.people.find((x) => x.home === b.id && free(x)); if (!q) return; const spot = edgeNear(s, F, b.doorX, b.doorY + 1, 4); if (!spot) return;
        const a = q.agent; if (a.inside != null) { a.inside = null; a.hidden = false; } a.x = spot[0] * T + 8; a.y = spot[1] * T + 10; a.frozen = true; a.path = null; q._flood = true; const dx = Math.sign(b.doorX - spot[0]) || 1; a.dir = dx > 0 ? 1 : 2; jobs.push({ s, q, b, kind: 'bail', t: 0, dx: -dx });
      } else { // men heap sacks along the edge
        const tx = Math.floor(P.x / T), ty = Math.floor(P.y / T), spot = edgeNear(s, F, tx, ty, 14); if (!spot) return;
        const q = s.people.find((x) => free(x) && x.sex === 'm' && x.age < 60 && x.agent && !x.agent.hidden && x.agent.inside == null && Math.hypot(x.agent.x - spot[0] * T, x.agent.y - spot[1] * T) < 500); if (!q) return; q._flood = true;
        O.Errands.send(s, q, spot, { anim: 'idle', secs: 0.1, face: 0, giveUp: game.t + 40, after: (ok) => { if (!ok || !q.agent) { q._flood = false; return; } q.agent.frozen = true; q.agent.path = null; jobs.push({ s, q, kind: 'sack', t: 0, sx: spot[0] * T + 8, sy: spot[1] * T + 14 }); } });
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (!s || game.scene) return;
      for (const g of sacks) { if (g.s !== s) continue; const x = Math.round(g.x - cam.x), y = Math.round(g.y - cam.y); for (let i = 0; i < g.n; i++) { ctx.fillStyle = i % 2 ? '#8a7a5a' : '#9a8a64'; ctx.fillRect(x - 7 + (i % 3) * 5, y - 3 - Math.floor(i / 3) * 3, 5, 3); } }
      ctx.fillStyle = 'rgba(150,160,150,0.85)'; for (const d of drops) ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y), 1, 1);
      for (const j of jobs) { if (j.s !== s || j.kind !== 'bail') continue; const a = j.q.agent; ctx.fillStyle = '#7a5a3a'; ctx.fillRect(Math.round(a.x + j.dx * 6 - cam.x) - 2, Math.round(a.y - 14 - cam.y), 4, 4); } });
    (O.extraLines = O.extraLines || []).push((s, q) => { const j = jobs.find((x) => x.q === q); return j ? (j.kind === 'bail' ? 'The river is in your house! You are bailing it out of the door with a bucket.' : 'The river is out and you are heaping sacks of earth along the edge to hold the flood back.') : ''; });
    O.FloodFolk = { jobs, sacks, get bailed() { return bailed; } };
  }
  O.FloodFolkSetup = { setup };
})();
