// The abbey's day, outside its walls. Beside every abbey or priory there's a herb garden in neat beds,
// and a brother (or sister) hoes it; another tends the skeps with a veil over the head and the bees in a
// cloud about them; one walks up and down reading his book. And at noon and at evening they come out
// two by two in their habits and go in a line to the cross before the door, kneel, and chant, then go in.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const mem = new WeakMap(), M = (o) => { let m = mem.get(o); if (!m) mem.set(o, (m = {})); return m; };
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const HOLY = /abbot|abbess|prior|prioress|monk|nun|lay brother|lay sister/;
    const jobs = [], procs = []; let cool = 5;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const busy = (q) => !q || q.alive === false || !q.agent || q.agent.frozen || q.errand || q._bit || q._scene || q._abbey || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    const isHouse = (b) => b && (b.type === 'abbey' || b.type === 'priory') && b.doorX != null;
    // the herb garden goes on whichever side of the house has clear ground for it (or nowhere)
    const garden = (b) => { if (M(b).garden !== undefined) return M(b).garden; const w = cur().world; const clear = (tx0, ty0) => { for (let y = ty0; y < ty0 + 4; y++) for (let x = tx0; x < tx0 + 7; x++) { if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1) return false; const i = y * w.W + x; if (w.solid[i] || w.ter[i] === w.TER.WATER || w.ter[i] === w.TER.ROAD) return false; if (w.buildings.some((o) => x >= o.x - 1 && x <= o.x + o.w && y >= o.y - 3 && y <= o.bottom + 1)) return false; } return true; };
      for (const [tx, ty] of [[b.x + b.w + 1, b.bottom - 2], [b.x - 8, b.bottom - 2], [b.x + b.w + 1, b.bottom + 3], [b.x - 8, b.bottom + 3], [b.x + b.w + 3, b.bottom - 1], [b.x - 10, b.bottom - 1]]) if (clear(tx, ty)) return (M(b).garden = { x0: tx * T, y0: ty * T, w: 5 * T, h: 4 * T });
      return (M(b).garden = null); };
    const crossAt = (b) => [b.doorX * T + 8, (b.doorY + 4) * T];
    function release(q) { const a = q.agent; if (a) { a.forceAnim = null; if (!(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)) a.frozen = false; } q._abbey = false; }
    function endJob(j) { release(j.q); jobs.splice(jobs.indexOf(j), 1); }
    function begin(s, q, b, kind) {
      const G = garden(b), w = s.world; let tx, ty; if (!G && kind !== 'walk') kind = 'walk';
      if (kind === 'hoe') { tx = Math.floor((G.x0 + Math.random() * G.w) / T); ty = Math.floor((G.y0 + G.h) / T); }
      else if (kind === 'bees') { tx = Math.floor((G.x0 + G.w) / T) + 1; ty = Math.floor((G.y0 + 8) / T); }
      else { tx = b.doorX - 2; ty = b.doorY + 2; }
      if (tx < 1 || ty < 1 || tx >= w.W - 1 || ty >= w.H - 1 || w.solid[ty * w.W + tx]) return false;
      q._abbey = true;
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.3, face: 3, giveUp: game.t + 50, after: (ok) => { if (!ok || !q.agent) { q._abbey = false; return; } const a = q.agent; a.frozen = true; a.path = null; a.dir = kind === 'walk' ? 2 : 3; jobs.push({ s, q, b, kind, t: 0, len: 45 + Math.random() * 30, x0: a.x, y0: a.y }); } });
      return true;
    }
    function procession(s, b, ppl) {
      const [cx, cy] = crossAt(b), P = { s, b, ppl: [], t: 0, chant: 0 };
      ppl.slice(0, 6).forEach((q, i) => { q._abbey = true; const row = Math.floor(i / 2), col = i % 2; O.Errands.send(s, q, [Math.floor((cx + (col ? 10 : -10)) / T), Math.floor((cy - 10 - row * 14) / T)], { anim: 'idle', secs: 0.2, face: 0, giveUp: game.t + 60, after: (ok) => { if (!ok || !q.agent || P.done) { q._abbey = false; return; } q.agent.x = cx + (col ? 10 : -10); q.agent.y = cy - 6 - row * 14; q.agent.frozen = true; q.agent.path = null; q.agent.dir = 0; P.ppl.push(q); } }); });
      procs.push(P);
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      for (const j of jobs.slice()) {
        j.t += dt; const a = j.q.agent;
        if (j.s !== s || !a || j.t > j.len || s.raining || j.q.alive === false || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === j.q)) { endJob(j); continue; }
        if (j.kind === 'hoe') { a.forceAnim = 'hoe'; if (Math.random() < dt * 0.6 && near(a.x, a.y, 200)) O.sfx && O.sfx('dig', 0.08); }
        else if (j.kind === 'bees') { a.forceAnim = Math.floor(j.t / 5) % 2 ? 'pickup' : 'idle'; }
        else { a.forceAnim = 'read'; const k = j.t * 0.25; a.x = j.x0 + Math.sin(k) * 30; a.dir = Math.cos(k) > 0 ? 2 : 1; }
      }
      for (const P of procs.slice()) {
        P.t += dt; if (P.s !== s || P.t > 70 || P.ppl.some((q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)) { P.done = true; for (const q of P.ppl) release(q); procs.splice(procs.indexOf(P), 1); continue; }
        for (const q of P.ppl) { q.agent.forceAnim = P.t < 50 ? 'pray' : 'idle'; q.agent.dir = 0; }
        if (P.ppl.length && P.t > 6) { P.chant -= dt; if (P.chant <= 0) { P.chant = 6; const q = pick(P.ppl); if (near(q.agent.x, q.agent.y, 300) && O.Speech) O.Speech.say(q, pick(['Kyrie eleison.', 'Ave Maria, gratia plena...', 'Gloria Patri, et Filio...', 'Deo gratias.', 'Pater noster, qui es in caelis...']), 3.5); } }
      }
      cool -= dt; if (cool > 0) return; cool = 6 + Math.random() * 5;
      if (hr < 6 || hr > 19.5) return;
      const P = game.player, houses = s.world.buildings.filter((b) => isHouse(b) && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 600); if (!houses.length) return;
      const b = pick(houses), bz = s.biz.get(b.id), holy = (bz ? bz.workers : []).map((id) => s.byId.get(id)).filter((q) => q && HOLY.test(q.job?.role || '') && !busy(q));
      // the hours: noon and evening, a line to the cross
      const hour = Math.floor(hr), m = s.minute % 60; if ((hour === 12 || hour === 18) && m < 20 && !s.raining && !procs.some((x) => x.b === b) && M(b).lastProc !== s.day * 24 + hour && holy.length >= 2) { M(b).lastProc = s.day * 24 + hour; procession(s, b, holy); return; }
      if (s.raining || jobs.filter((j) => j.b === b).length >= 3 || !holy.length) return;
      const kind = s.season === 'winter' ? pick(['walk', 'walk', 'bees']) : pick(['hoe', 'hoe', 'bees', 'walk']); begin(s, pick(holy), b, kind);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000, W = ctx.canvas.width, H = ctx.canvas.height;
      for (const b of s.world.buildings) {
        if (!isHouse(b)) continue; const G = garden(b); if (G) { const gx = Math.round(G.x0 - cam.x), gy = Math.round(G.y0 - cam.y); if (gx > W + 40 || gy > H + 40 || gx + G.w < -40 || gy + G.h < -60) continue;
        // the herb beds (bare in winter)
        for (let r = 0; r < 3; r++) { const yy = gy + 6 + r * 18; ctx.fillStyle = '#6a4a30'; ctx.fillRect(gx, yy, G.w - 8, 8); ctx.fillStyle = '#8a6a4a'; ctx.fillRect(gx, yy, G.w - 8, 1); if (s.season !== 'winter') for (let i = 0; i < 10; i++) { const px = gx + 3 + i * 7, c = (r + i) % 3; ctx.fillStyle = c === 0 ? '#5a8a3a' : c === 1 ? '#7a9a5a' : '#6a7a40'; ctx.fillRect(px, yy - 2, 4, 4); if (s.season === 'summer' && (i + r) % 4 === 0) { ctx.fillStyle = r === 1 ? '#a070c0' : '#f0e070'; ctx.fillRect(px + 1, yy - 3, 2, 1); } } }
        // skeps on their bench, with bees about them by day
        const sx = gx + G.w + 4, sy = gy + 16; ctx.fillStyle = '#6a4a2c'; ctx.fillRect(sx - 2, sy, 24, 2); for (let i = 0; i < 3; i++) { const kx = sx + i * 8; ctx.fillStyle = '#c8a050'; ctx.beginPath(); ctx.ellipse(kx + 3, sy - 3, 3.5, 4.5, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(kx - 0.5, sy - 3, 7, 3); ctx.fillStyle = '#9a7a38'; ctx.fillRect(kx, sy - 5, 6, 1); ctx.fillRect(kx, sy - 2, 6, 1); ctx.fillStyle = '#2a2018'; ctx.fillRect(kx + 2, sy - 1, 2, 1); }
        if (s.season !== 'winter' && !s.raining && !(game.isNight && game.isNight())) { ctx.fillStyle = '#2a2010'; for (let i = 0; i < 10; i++) { const a = tk * (2 + i % 3) + i * 1.7; ctx.fillRect(Math.round(sx + 10 + Math.cos(a) * (6 + i % 5 * 2)), Math.round(sy - 8 + Math.sin(a * 1.3) * 5), 1, 1); } }
        }
        // the cross before the door
        const [cx, cy] = crossAt(b), x = Math.round(cx - cam.x), y = Math.round(cy - cam.y); ctx.fillStyle = '#8a8680'; ctx.fillRect(x - 4, y - 2, 9, 3); ctx.fillStyle = '#a8a49c'; ctx.fillRect(x - 1, y - 22, 3, 21); ctx.fillRect(x - 6, y - 17, 13, 3);
      }
      for (const j of jobs) { if (j.s !== s || j.kind !== 'bees') continue; const a = j.q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); ctx.fillStyle = 'rgba(240,240,232,0.85)'; ctx.fillRect(x - 5, y - 30, 10, 9); ctx.fillStyle = 'rgba(40,40,40,0.5)'; ctx.fillRect(x - 3, y - 26, 6, 2); ctx.fillStyle = '#2a2010'; for (let i = 0; i < 8; i++) { const a2 = tk * 3 + i; ctx.fillRect(Math.round(x + Math.cos(a2) * 10), Math.round(y - 20 + Math.sin(a2 * 1.4) * 8), 1, 1); } }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!q._abbey) return ''; const j = jobs.find((o) => o.q === q); if (j) return { hoe: 'You are hoeing the herb beds of your house.', bees: 'You are tending the bee skeps, veiled against stings.', walk: 'You are walking in the yard reading your book of hours.' }[j.kind]; return procs.some((P) => P.ppl.includes(q)) ? 'You are kneeling with your brethren at the cross before your house, chanting the office.' : ''; });
    O.AbbeyLife = { jobs, procs, start: (kind) => { const s = cur(), P = game.player; const b = s.world.buildings.filter(isHouse).sort((x, y) => Math.hypot(x.doorX * T - P.x, x.doorY * T - P.y) - Math.hypot(y.doorX * T - P.x, y.doorY * T - P.y))[0]; if (!b) return null; const bz = s.biz.get(b.id), holy = (bz ? bz.workers : []).map((id) => s.byId.get(id)).filter((q) => q && !busy(q)); if (!holy.length) return 'nobody free'; if (kind === 'proc') { procession(s, b, holy); return holy.length + ' in line'; } return begin(s, holy[0], b, kind) ? holy[0].first : null; }, find: () => { const s = cur(); const b = s.world.buildings.find(isHouse); return b ? [b.doorX * T, b.doorY * T] : null; } };
  }
  O.AbbeyLifeSetup = { setup };
})();
