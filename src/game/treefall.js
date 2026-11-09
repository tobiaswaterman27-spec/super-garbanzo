// Timber! When a woodcutter fells a tree near you it no longer simply isn't there any more: there's a
// creak, the woodcutter steps back and shouts, and the tree leans, tilts faster and comes down with a
// crash and a burst of leaves, leaving the stump.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const falls = [], bits = []; let known = null, kw = null, t = 0, felled = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    game.hooks.update.push((dt) => {
      for (const f of falls.slice()) { f.t += dt; if (f.t > 0.4 && !f.crashed && f.ang >= 1.45) { f.crashed = true; if (near(f.x, f.y, 400)) { O.sfx && O.sfx('chop', 0.8); setTimeout(() => O.sfx && O.sfx('smack', 0.6), 80); } for (let i = 0; i < 24; i++) bits.push({ x: f.x + f.dir * (10 + Math.random() * 30), y: f.y - Math.random() * 10, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, t: 0, c: Math.random() < 0.6 ? f.leaf : '#8a6a44' }); }
        const acc = 0.5 + f.ang * 2.5; if (f.t > 1.2) f.ang = Math.min(1.5, f.ang + acc * dt); if (f.t > 6) falls.splice(falls.indexOf(f), 1); }
      for (const b of bits.slice()) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 120 * dt; if (b.t > 1.5) bits.splice(bits.indexOf(b), 1); }
      const s = cur(); if (!s || !s.world || game.scene) { known = null; return; } t += dt; if (t < 0.5) return; t = 0;
      const w = s.world, P = game.player, mine = new Map(); for (const tr of w.trees || []) if (Math.abs(tr.x - P.x) < 460 && Math.abs(tr.y - P.y) < 320) mine.set(tr, true);
      if (known && kw === w) for (const tr of known.keys()) { if (mine.has(tr) || w.trees.includes(tr)) continue; const stump = (w.props || []).find((p) => p.kind === 'stump' && p.x === tr.x && p.y === tr.y); if (!stump) continue;
        const cutter = s.people.find((q) => q.agent && !q.agent.hidden && Math.hypot(q.agent.x - tr.x, q.agent.y - tr.y) < 60 && /wood|forest|charcoal/.test(q.job?.role || ''));
        const dir = cutter ? (cutter.agent.x < tr.x ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1); felled++;
        falls.push({ x: tr.x, y: tr.y, kind: tr.kind, dir, ang: 0, t: 0, leaf: tr.kind === 'pine' ? '#2a5a3a' : tr.kind === 'birch' ? '#8ab05a' : s.season === 'autumn' ? '#c8781a' : '#4a8a3a' });
        if (cutter && near(tr.x, tr.y, 360)) { O.Speech && O.Speech.say(cutter, 'Timber! Stand clear!', 2); O.gesture && O.gesture(cutter, 'point', 1.4); O.sfx && O.sfx('saw', 0.3); } }
      known = mine; kw = w;
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return;
      for (const f of falls) { const x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y), a = f.ang * f.dir, fade = f.t > 4 ? Math.max(0, 1 - (f.t - 4) / 2) : 1; ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y - 3); ctx.rotate(a);
        ctx.fillStyle = f.kind === 'birch' ? '#e8e4dc' : '#6a4a2c'; ctx.fillRect(-2, -34, 5, 34); if (f.kind === 'birch') { ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-2, -26, 2, 1); ctx.fillRect(1, -16, 2, 1); }
        ctx.fillStyle = f.leaf; if (f.kind === 'pine') { for (let i = 0; i < 4; i++) ctx.fillRect(-8 + i * 2, -50 + i * 6, 17 - i * 4, 6); } else { ctx.beginPath(); ctx.ellipse(0, -44, 14, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(3, -40, 10, 7, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore(); ctx.globalAlpha = 1; }
      for (const b of bits) { ctx.globalAlpha = Math.max(0, 1 - b.t / 1.5); ctx.fillStyle = b.c; ctx.fillRect(Math.round(b.x - cam.x), Math.round(b.y - cam.y), 2, 1); } ctx.globalAlpha = 1;
    });
    O.TreeFall = { falls, get felled() { return felled; } };
  }
  O.TreeFallSetup = { setup };
})();
