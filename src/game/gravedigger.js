// The grave is dug the day before. When someone dies, that afternoon the sexton (or a strong neighbour)
// goes out to the chapel yard with a spade and digs, the earth piling up beside a dark hole that stays
// open, roped round, until the burying next morning. Folk passing slow down and cross themselves.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const graves = []; // { s, x, y, depth, eventDay, who }
    function spotFor(s) { const w = s.world, stones = w.props.filter((p) => p.kind === 'gravestone'); const ch = s.building(s.chapelId); const base = stones.length ? stones[stones.length - 1] : ch && ch.doorX != null ? { x: (ch.x + ch.w + 1) * T, y: (ch.bottom) * T } : null; if (!base) return null;
      for (let r = 1; r < 6; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [r, r], [-r, r]]) { const tx = Math.floor(base.x / T) + dx, ty = Math.floor(base.y / T) + dy; if (tx < 1 || ty < 1 || tx >= w.W - 1 || ty >= w.H - 1 || w.solid[ty * w.W + tx] || w.props.some((p) => Math.floor(p.x / T) === tx && Math.floor(p.y / T) === ty) || graves.some((g) => Math.floor(g.x / T) === tx && Math.floor(g.y / T) === ty)) continue; return [tx, ty]; } return null; }
    let tick = 5;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.events || !O.Errands) return;
      for (const g of graves.slice()) if (g.s !== s || s.day > g.eventDay || (s.day === g.eventDay && s.minute > 12 * 60)) graves.splice(graves.indexOf(g), 1);
      tick -= dt; if (tick > 0) return; tick = 5; const h = s.minute / 60; if (h < 12 || h > 18) return;
      for (const e of s.events) { if (e.kind !== 'funeral' || e.day !== s.day + 1 || e._dug) continue;
        const at = spotFor(s); if (!at) { e._dug = true; continue; }
        const q = s.people.find((x) => /sexton|undertaker|gravedigger/.test(x.job?.role || '') && x.alive !== false && x.agent && !x.errand) || s.people.find((x) => x.sex === 'm' && x.age >= 20 && x.age <= 55 && !x.job?.onShift && x.alive !== false && x.agent && !x.errand && !x.agent.frozen && !x.visitor);
        if (!q) continue; e._dug = true; const g = { s, x: at[0] * T + 8, y: at[1] * T + 10, depth: 0, eventDay: e.day, who: e.name };
        if (q.agent.inside != null) { const b = s.building(q.agent.inside); if (b && b.doorX != null) { q.agent.x = b.doorX * T + 8; q.agent.y = (b.doorY + 1) * T + 8; } q.agent.inside = null; q.agent.hidden = false; }
        q._digging = g; O.Errands.send(s, q, [at[0] + 1, at[1]], { anim: 'dig', secs: 40, face: 1, giveUp: game.t + 120, at: () => { graves.push(g); g.digger = q; }, after: () => { q._digging = null; g.depth = 1; g.digger = null; } });
        break; }
      for (const g of graves) if (g.digger) { g.depth = Math.min(1, g.depth + 5 / 40); if (Math.random() < 0.3) for (const o of s.people) { if (o === g.digger || !o.agent || o.agent.hidden || o.agent.inside != null || o.agent.frozen || o._sawGrave === g || Math.hypot(o.agent.x - g.x, o.agent.y - g.y) > 70) continue; o._sawGrave = g; O.gesture && O.gesture(o, 'pray', 2); } }
    });
    game.hooks.drawGround.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000;
      for (const g of graves) { if (g.s !== s) continue; const x = Math.round(g.x - cam.x), y = Math.round(g.y - cam.y), d = g.depth;
        ctx.fillStyle = '#2a1e16'; ctx.fillRect(x - 5, y - 3, 10, Math.max(1, Math.round(5 * d))); ctx.fillStyle = '#5a4030'; ctx.fillRect(x - 6, y - 4, 12, 1);
        ctx.fillStyle = '#6a4a32'; const mh = Math.round(2 + d * 5); ctx.beginPath(); ctx.moveTo(x + 7, y + 2); ctx.lineTo(x + 11, y + 2 - mh); ctx.lineTo(x + 16, y + 2); ctx.closePath(); ctx.fill();
        if (g.digger && Math.floor(tk * 2) % 2) { ctx.fillStyle = '#6a4a32'; ctx.fillRect(x + 9 + Math.round(Math.sin(tk * 5) * 2), y - 6 - Math.round(Math.abs(Math.sin(tk * 5)) * 4), 2, 2); }
        if (d >= 1) { ctx.strokeStyle = '#a89060'; ctx.lineWidth = 0.6; ctx.strokeRect(x - 7.5, y - 5.5, 15, 9); } }
    });
    O.GraveDigger = { graves, spotFor: () => spotFor(cur()) };
  }
  O.GraveDiggerSetup = { setup };
})();
