// Heavy loads go on wheels. Whoever is carrying a real load through the streets (a delivery of logs or
// stone, sacks of grain or flour, iron bars, planks, bales of wool) pushes it on a two-wheeled handcart,
// the load heaped on the bed, the wheels turning and the axle creaking; a lighter load is still carried.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const HEAVY = { logs: ['#7a5232', '#8a6239'], stone: ['#a8a49c', '#8a8680'], wheat: ['#d8b850', '#c8a840'], flour: ['#e8e0d0', '#d0c8b8'], iron: ['#6a6a70', '#5a5a60'], planks: ['#b08a5a', '#9a7a4a'], wool: ['#ece8dc', '#d8d4c8'], cloth: ['#8a6a9a', '#6a8aaa'], meal: ['#d8c8a0', '#c8b890'], cabbage: ['#6a9a44', '#4a7a30'], ore: ['#6a5a50', '#5a4a40'], clay: ['#a8704a', '#8a5a3a'], hay: ['#c8b060', '#b0983a'], firewood: ['#7a5232', '#6a4a2c'], fish: ['#c8d4dc', '#a8b4bc'], ale: ['#7a5a3a', '#6a4a2c'], barrels: ['#7a5a3a', '#6a4a2c'] };
    let carts = 0; const wheel = new WeakMap(); let creak = 0;
    const GEN = ['#b8a070', '#9a8460'], colours = (g) => HEAVY[g] || (g === 'salt' ? ['#f0f0ec', '#d8d8d4'] : g === 'bread' ? ['#c89a5a', '#a87a40'] : GEN);
    const loaded = (a) => { const c = a && a.carrying; return c && typeof c === 'object' && c.good && !c.board && !c.firewood && ((HEAVY[c.good] && (c.qty || 1) >= 2) || (c.qty || 1) >= 4); };
    game.hooks.update.push((dt) => { creak -= dt; const s = cur(); if (!s || game.scene) return; let n = 0; const P = game.player;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || !loaded(a)) continue; if (Math.abs(a.x - P.x) > 420 || Math.abs(a.y - P.y) > 300) continue; n++; const w = wheel.get(a) || { ang: 0, x: a.x, y: a.y }; const moved = Math.hypot(a.x - w.x, a.y - w.y); w.ang += moved / 3; w.x = a.x; w.y = a.y; wheel.set(a, w); if (moved > 0.5 && creak <= 0 && Math.hypot(a.x - P.x, a.y - P.y) < 160) { creak = 1.5 + Math.random() * 2; O.sfx && O.sfx('saw', 0.03); } }
      carts = n; });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const P = game.player;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || !loaded(a)) continue; if (Math.abs(a.x - P.x) > 420 || Math.abs(a.y - P.y) > 300) continue; if (O.occluded && O.occluded(a.x, a.y)) continue;
        const c = a.carrying, [c1, c2] = colours(c.good), d = a.dir === 1 ? -1 : a.dir === 2 ? 1 : 0, up = a.dir === 3, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y), ang = (wheel.get(a) || { ang: 0 }).ang;
        // the cart goes in front of whoever pushes it
        const cx = x + (d ? d * 15 : 0), cy = y + (d ? 0 : up ? -9 : 9), wide = !d;
        const bw = wide ? 14 : 16, bh = 5, n = Math.min(6, Math.max(2, Math.round((c.qty || 2) / 2)));
        ctx.strokeStyle = '#5a4028'; ctx.lineWidth = 1; ctx.beginPath(); if (d) { ctx.moveTo(x + d * 4, y - 12); ctx.lineTo(cx - d * 7, cy - 7); } else { ctx.moveTo(x - 3, y - 12); ctx.lineTo(cx - 5, cy - 6); ctx.moveTo(x + 3, y - 12); ctx.lineTo(cx + 5, cy - 6); } ctx.stroke();
        ctx.fillStyle = '#7a5a3a'; ctx.fillRect(cx - (bw >> 1), cy - 9, bw, bh); ctx.fillStyle = '#5a4028'; ctx.fillRect(cx - (bw >> 1), cy - 5, bw, 1);
        for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect(cx - (bw >> 1) + 1 + (i % 3) * Math.floor((bw - 2) / 3), cy - 12 - Math.floor(i / 3) * 3, Math.floor((bw - 2) / 3), 3); }
        // wheels
        const wx = wide ? [cx - 7, cx + 6] : [cx]; for (const w0 of wx) { ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(w0, cy - 3, 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8a6a44'; ctx.beginPath(); ctx.moveTo(w0 + Math.cos(ang) * 3, cy - 3 + Math.sin(ang) * 3); ctx.lineTo(w0 - Math.cos(ang) * 3, cy - 3 - Math.sin(ang) * 3); ctx.stroke(); } }
    });
    O.Handcarts = { get carts() { return carts; } };
  }
  O.HandcartsSetup = { setup };
})();
