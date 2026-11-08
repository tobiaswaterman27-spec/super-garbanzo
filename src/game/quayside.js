// The fishers' landing. By every fishery the nets hang drying on poles, stirring in the wind, with floats
// of cork along their edges; a fisher sits on an upturned basket mending a net across his knees, the
// needle going in and out; and at a trestle the fishwife guts the catch with quick strokes of the knife,
// tossing the scraps, while the gulls wheel and cry over her and swoop down to snatch them.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const jobs = [], gulls = [], scraps = []; let cool = 5;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const busy = (q) => !q || q.alive === false || !q.agent || q.agent.frozen || q.errand || q._bit || q._scene || q._quay || talking(q);
    const spot = (b) => { if (b._quay !== undefined) return b._quay; const w = cur().world; const ok = (tx, ty) => tx > 1 && ty > 1 && tx < w.W - 2 && ty < w.H - 2 && !w.solid[ty * w.W + tx] && w.ter[ty * w.W + tx] !== w.TER.WATER; for (const [dx, dy] of [[2, 1], [-3, 1], [3, 2], [-4, 2], [1, 3], [-2, 3]]) { const tx = b.doorX + dx, ty = b.doorY + dy; if (ok(tx, ty) && ok(tx + 1, ty) && ok(tx - 1, ty)) return (b._quay = { tx, ty }); } return (b._quay = null); };
    function release(j) { const a = j.q.agent; if (a) { a.forceAnim = null; if (!talking(j.q)) a.frozen = false; } j.q._quay = false; jobs.splice(jobs.indexOf(j), 1); }
    function begin(s, q, b, kind) {
      const sp = spot(b); if (!sp) return false; const tx = kind === 'gut' ? sp.tx : sp.tx - 2, ty = sp.ty + (kind === 'gut' ? 1 : 0);
      if (s.world.solid[ty * s.world.W + tx]) return false; q._quay = true;
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.2, face: 3, giveUp: game.t + 45, after: (ok) => { if (!ok || !q.agent) { q._quay = false; return; } const a = q.agent; a.frozen = true; a.path = null; a.dir = 3; jobs.push({ s, q, b, kind, t: 0, len: 50 + Math.random() * 30, next: 1 }); } });
      return true;
    }
    game.hooks.update.push((dt) => {
      for (const sc of scraps.slice()) { sc.t += dt; if (sc.t < 0.4) { sc.x += sc.vx * dt; sc.y += sc.vy * dt; sc.vy += 200 * dt; } if (sc.t > 12 || sc.taken) scraps.splice(scraps.indexOf(sc), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return;
      for (const j of jobs.slice()) {
        j.t += dt; const a = j.q.agent;
        if (j.s !== s || !a || j.t > j.len || s.raining || j.q.alive === false || talking(j.q)) { release(j); continue; }
        j.next -= dt;
        if (j.kind === 'mend') { a.forceAnim = Math.floor(j.t / 6) % 4 === 3 ? 'look' : 'weave'; }
        else { a.forceAnim = 'cleave'; if (j.next <= 0) { j.next = 1.2 + Math.random(); j.gutted = (j.gutted || 0) + 1; if (Math.random() < 0.6) scraps.push({ x: a.x + 12, y: a.y - 8, vx: 20 + Math.random() * 30, vy: -40, t: 0, s }); if (near(a.x, a.y, 200)) O.sfx && O.sfx('cleave', 0.08); }
          // the gulls come to her
          if (gulls.filter((g) => g.j === j).length < 3 && Math.random() < dt * 0.5) gulls.push({ j, s, x: a.x + (Math.random() - 0.5) * 200, y: a.y - 80 - Math.random() * 40, z: 40, ang: Math.random() * 6, st: 'circle', t: 0, r: 30 + Math.random() * 20 });
          if (!j.said && j.t > 15) { j.said = 1; near(a.x, a.y, 240) && O.Speech && O.Speech.say(j.q, pick(['Get off, you thieving devils!', 'Fresh herring! Fresh!', 'Shoo! Shoo!']), 2.4); } }
      }
      for (const g of gulls.slice()) { g.t += dt; const a = g.j.q.agent; if (g.s !== s || !jobs.includes(g.j) && g.st !== 'leave') { g.st = 'leave'; }
        if (g.st === 'circle') { g.ang += dt * 1.3; const cx = a.x + 14, cy = a.y - 50; g.x += ((cx + Math.cos(g.ang) * g.r) - g.x) * dt * 2; g.y += ((cy + Math.sin(g.ang) * g.r * 0.5) - g.y) * dt * 2; const sc = scraps.find((x) => x.s === s && !x.claimed && x.t > 0.4 && Math.hypot(x.x - g.x, x.y - g.y) < 120); if (sc && Math.random() < dt * 0.8) { sc.claimed = true; g.st = 'dive'; g.tg = sc; } if (Math.random() < dt * 0.15 && near(g.x, g.y, 300)) O.sfx && O.sfx('gull', 0.5); }
        else if (g.st === 'dive') { const dx = g.tg.x - g.x, dy = g.tg.y - 4 - g.y, d = Math.hypot(dx, dy); if (d < 3) { g.tg.taken = true; g.st = 'circle'; g.carry = 1.5; } else { g.x += dx / d * 110 * dt; g.y += dy / d * 110 * dt; } }
        else { g.y -= 60 * dt; g.x += 40 * dt; if (g.t > 30 || g.y < (a ? a.y : g.y) - 400) gulls.splice(gulls.indexOf(g), 1); continue; }
        if (g.carry > 0) g.carry -= dt; if (g.t > 120) g.st = 'leave'; }
      cool -= dt; if (cool > 0) return; cool = 8 + Math.random() * 6;
      const hr = s.minute / 60; if (hr < 7 || hr > 17.5 || s.raining) return;
      const P = game.player, bs = s.world.buildings.filter((b) => (b.type === 'fishery' || b.type === 'harbour') && b.doorX != null && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 520 && spot(b)); if (!bs.length) return;
      const b = pick(bs), bz = s.biz.get(b.id), ws = (bz ? bz.workers : []).map((id) => s.byId.get(id)).filter((q) => q && !busy(q) && q.age >= 14);
      const have = jobs.filter((j) => j.b === b).map((j) => j.kind), kind = !have.includes('gut') ? 'gut' : !have.includes('mend') ? 'mend' : null; if (!kind) return;
      const q = ws.length ? pick(ws) : s.people.find((x) => !busy(x) && x.home && x.age >= 16 && x.age < 65 && x.agent && !x.agent.hidden && x.agent.inside == null && ['stroll', 'idle'].includes(x.activity?.act) && Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) < 300);
      if (q) begin(s, q, b, kind);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000, W = ctx.canvas.width, H = ctx.canvas.height;
      for (const b of s.world.buildings) {
        if ((b.type !== 'fishery' && b.type !== 'harbour') || b.doorX == null) continue; const sp = spot(b); if (!sp) continue; const x = Math.round((sp.tx + 2) * T - cam.x), y = Math.round(sp.ty * T + 6 - cam.y); if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue;
        // net drying between two poles
        ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x, y - 26, 2, 26); ctx.fillRect(x + 26, y - 26, 2, 26); const sw = Math.sin(tk * 1.2 + b.id) * 1.5;
        ctx.strokeStyle = 'rgba(190,175,140,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const xx = x + 2 + i * 4; ctx.moveTo(xx, y - 24); ctx.lineTo(xx + sw, y - 8); } for (let r = 0; r <= 4; r++) { const yy = y - 24 + r * 4; ctx.moveTo(x + 2, yy); ctx.quadraticCurveTo(x + 14 + sw * r * 0.3, yy + 2, x + 26 + sw * r * 0.25, yy); } ctx.stroke();
        ctx.fillStyle = '#c8a060'; for (let i = 0; i < 5; i++) ctx.fillRect(x + 4 + i * 5 + Math.round(sw), y - 8, 2, 2);
        // the gutting trestle with its fish
        const tx = Math.round(sp.tx * T + 8 + 14 - cam.x), ty = Math.round((sp.ty + 1) * T + 4 - cam.y); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(tx - 8, ty - 9, 18, 3); ctx.fillRect(tx - 7, ty - 6, 2, 6); ctx.fillRect(tx + 7, ty - 6, 2, 6); ctx.fillStyle = '#c8d4dc'; for (let i = 0; i < 4; i++) ctx.fillRect(tx - 6 + i * 4, ty - 11, 3, 2); ctx.fillStyle = '#8a6a44'; ctx.fillRect(tx + 12, ty - 6, 7, 6);
      }
      for (const j of jobs) { if (j.s !== s || j.kind !== 'mend') continue; const a = j.q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); ctx.strokeStyle = 'rgba(190,175,140,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(x - 9 + i * 5, y - 10); ctx.lineTo(x - 7 + i * 5, y - 2); } ctx.moveTo(x - 10, y - 7); ctx.lineTo(x + 9, y - 6); ctx.moveTo(x - 10, y - 4); ctx.lineTo(x + 9, y - 3); ctx.stroke(); }
      ctx.fillStyle = '#a05050'; for (const sc of scraps) if (sc.s === s && !sc.taken) ctx.fillRect(Math.round(sc.x - cam.x), Math.round(sc.y - cam.y), 2, 1);
      for (const g of gulls) { if (g.s !== s) continue; const x = Math.round(g.x - cam.x), y = Math.round(g.y - cam.y), f = Math.floor(tk * (g.st === 'dive' ? 4 : 8) + g.r) % 2; ctx.fillStyle = '#f4f4f0'; ctx.fillRect(x - 1, y, 3, 2); ctx.fillStyle = '#d8d8d4'; ctx.fillRect(x - 5, y - (f ? 2 : 0), 4, 1); ctx.fillRect(x + 2, y - (f ? 2 : 0), 4, 1); ctx.fillStyle = '#e0b030'; ctx.fillRect(x + 2, y + 1, 1, 1); if (g.carry > 0) { ctx.fillStyle = '#a05050'; ctx.fillRect(x + 2, y + 2, 2, 1); } }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!q._quay) return ''; const j = jobs.find((o) => o.q === q); return j ? (j.kind === 'gut' ? `You are gutting the catch at the trestle by the fishery and fighting off the gulls${j.gutted ? `; ${j.gutted} done so far` : ''}.` : 'You are sitting mending a fishing net across your knees.') : ''; });
    O.Quayside = { jobs, gulls, start: (kind) => { const s = cur(), P = game.player; const b = s.world.buildings.filter((x) => (x.type === 'fishery' || x.type === 'harbour') && x.doorX != null && spot(x)).sort((x, y) => Math.hypot(x.doorX * T - P.x, x.doorY * T - P.y) - Math.hypot(y.doorX * T - P.x, y.doorY * T - P.y))[0]; if (!b) return null; const q = s.people.filter((x) => !busy(x) && x.age >= 16 && x.age < 65 && x.agent && !x.agent.mount).sort((x, y) => Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) - Math.hypot(y.agent.x - b.doorX * T, y.agent.y - b.doorY * T))[0]; return q && begin(s, q, b, kind) ? q.first + ' at the ' + b.type : null; }, where: () => { const s = cur(); const b = s.world.buildings.find((x) => (x.type === 'fishery' || x.type === 'harbour') && x.doorX != null && spot(x)); return b ? [b.doorX * T, b.doorY * T] : null; } };
  }
  O.QuaysideSetup = { setup };
})();
