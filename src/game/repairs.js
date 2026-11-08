// Houses get looked after. By day someone props a ladder against a house front and goes up it to mend
// the thatch or a loose shingle, hammering away up there, bundles of reed or a basket of pegs at the
// ladder's foot; another limewashes a wall with a long brush and a bucket of white, the wall brighter
// where they've been.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let job = null, cool = 20; const washed = [];
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q.visitor && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene || !O.Errands) return; const P = game.player, h = s.minute / 60;
      if (job) { const j = job; j.t += dt; const a = j.q.agent; if (j.s !== s || j.q.alive === false || j.t > 70 || s.raining || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === j.q)) { a.lift = 0; a.forceAnim = null; a.frozen = false; j.q._repair = false; job = null; cool = 60; return; }
        if (j.kind === 'roof') { const up = Math.min(1, j.t / 2.5), down = j.t > 58 ? Math.min(1, (j.t - 58) / 2.5) : 0; a.lift = Math.round(26 * (up - down)); a.forceAnim = j.t < 2.5 || j.t > 58 ? 'carry' : 'hammer'; a.dir = 0; if (j.t > 2.5 && j.t < 58 && Math.random() < dt * 1.6 && Math.hypot(a.x - P.x, a.y - P.y) < 260) O.sfx && O.sfx('smack', 0.12); if (j.t > 60.5) { a.lift = 0; a.forceAnim = null; a.frozen = false; j.q._repair = false; job = null; cool = 90; } }
        else { a.forceAnim = 'scrub'; a.dir = 0; const k = Math.min(1, j.t / 40); j.prog = k; a.x = j.x0 + Math.sin(j.t * 0.25) * 10; if (j.t > 42) { washed.push({ s, x: j.x0, y: j.y0, b: j.b }); a.forceAnim = null; a.frozen = false; j.q._repair = false; job = null; cool = 90; } }
        return; }
      cool -= dt; if (cool > 0 || h < 8 || h > 17 || s.raining || s.weekday === 6) return; cool = 15;
      const houses = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 380);
      const b = pick(houses); if (!b) return; const tx = b.doorX + (Math.random() < 0.5 ? -1 : 1), ty = b.doorY + 1; if (s.world.solid[ty * s.world.W + tx]) return;
      const q = s.people.find((x) => free(x) && x.age >= 18 && x.age <= 60 && (/builder|carpenter|thatcher|labourer|roofer/.test(x.job?.role || '') || (x.home === b.id && x.sex === 'm')) && Math.hypot(x.agent.x - P.x, x.agent.y - P.y) < 600);
      if (!q) return; const kind = Math.random() < 0.6 ? 'roof' : 'wash'; q._repair = true;
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.4, face: 0, giveUp: game.t + 60, after: (ok) => { if (!ok) { q._repair = false; return; } q.agent.frozen = true; q.agent.path = null; job = { s, q, kind, b, t: 0, x0: q.agent.x, y0: q.agent.y }; } });
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      for (const w of washed) { if (w.s !== s) continue; const x = Math.round(w.x - cam.x), y = Math.round(w.y - cam.y); ctx.fillStyle = 'rgba(250,248,240,0.35)'; ctx.fillRect(x - 12, y - 30, 24, 14); }
      const j = job; if (!j || j.s !== s) return; const a = j.q.agent, x = Math.round(j.x0 - cam.x), y = Math.round(j.y0 - cam.y);
      if (j.kind === 'roof') { ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x - 3, y - 44); ctx.moveTo(x + 5, y); ctx.lineTo(x + 3, y - 44); ctx.stroke(); for (let i = 0; i < 8; i++) { const yy = y - 4 - i * 5; ctx.beginPath(); ctx.moveTo(x - 5 + i * 0.25, yy); ctx.lineTo(x + 5 - i * 0.25, yy); ctx.stroke(); } ctx.fillStyle = '#c8a850'; ctx.fillRect(x + 8, y - 5, 8, 5); ctx.fillStyle = '#a88838'; ctx.fillRect(x + 8, y - 3, 8, 1); }
      else { ctx.fillStyle = `rgba(250,248,240,${0.35 * (j.prog || 0)})`; ctx.fillRect(x - 12, y - 30, 24, 14); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x + 8, y - 6, 6, 6); ctx.fillStyle = '#f4f2ea'; ctx.fillRect(x + 8, y - 6, 6, 1); const bx = Math.round(a.x - cam.x); ctx.strokeStyle = '#6a4a2c'; ctx.beginPath(); ctx.moveTo(bx + 4, y - 14); ctx.lineTo(bx + 2, y - 30); ctx.stroke(); ctx.fillStyle = '#e8e4d8'; ctx.fillRect(bx, y - 32, 4, 3); }
    });
    O.Repairs = { get job() { return job; }, washed };
  }
  O.RepairsSetup = { setup };
})();
