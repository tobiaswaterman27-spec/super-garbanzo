// Lights in the dark streets. After dusk most honest folk who must go out carry a light: a horn lantern
// swinging from the hand, or a pitch torch held up, flaring and dropping sparks, each with its own little
// pool of light moving along the street with them. Thieves and gang hands creep without one.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const sparks = []; let lit = [];
    const watch = (q) => /guard|watch|constable|sergeant|captain/.test(q.job?.role || '');
    const shady = (q) => q.gang || q.gangId || q._night || q._smug || /thief|cutpurse/.test(q.job?.role || '');
    const night = () => game.isNight && game.isNight();
    game.hooks.update.push((dt) => {
      for (const p of sparks.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 50 * dt; if (p.t > 0.6) sparks.splice(sparks.indexOf(p), 1); }
      const s = cur(); lit = []; if (!s || game.scene || !night()) return; const P = game.player;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || q.age < 12 || watch(q) || shady(q)) continue; if (!a.path && !q.errand) continue; if (Math.abs(a.x - P.x) > 420 || Math.abs(a.y - P.y) > 300) continue;
        const kind = (q.id % 10) < 6 ? 'lantern' : (q.id % 10) < 8 ? 'torch' : null; if (!kind) continue; lit.push([q, kind]);
        if (kind === 'torch' && Math.random() < dt * 6) { const d = a.dir === 2 ? 1 : a.dir === 1 ? -1 : 0; sparks.push({ x: a.x + d * 7 + 2, y: a.y - 30, vx: (Math.random() - 0.5) * 16, vy: -10 - Math.random() * 14, t: 0 }); } }
    });
    (O.extraLights = O.extraLights || []).push((pools, cam) => { for (const [q, kind] of lit) { const a = q.agent; const fl = kind === 'torch' ? Math.sin(performance.now() / 70 + q.id) * 3 : Math.sin(performance.now() / 300 + q.id); pools.push([a.x - cam.x, a.y - 14 - cam.y, (kind === 'torch' ? 40 : 30) + fl]); } });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene || !lit.length) return; const tk = performance.now() / 1000;
      for (const [q, kind] of lit) { const a = q.agent; if (O.occluded && O.occluded(a.x, a.y)) continue; const d = a.dir === 2 ? 1 : a.dir === 1 ? -1 : (a.dir === 3 ? 1 : -1), x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y) - (a.lift || 0), sw = Math.round(Math.sin(tk * 7 + q.id) * (a.path ? 1.5 : 0.4));
        if (kind === 'lantern') { const lx = x + d * 7 + sw, ly = y - 13; ctx.fillStyle = '#4a3a2a'; ctx.fillRect(lx, ly - 4, 1, 3); ctx.fillStyle = '#5a4a3a'; ctx.fillRect(lx - 2, ly - 1, 5, 6); ctx.fillStyle = Math.floor(tk * 6 + q.id) % 4 ? '#ffd27a' : '#ffe8a8'; ctx.fillRect(lx - 1, ly, 3, 4); ctx.fillStyle = 'rgba(255,210,120,0.25)'; ctx.fillRect(lx - 4, ly - 2, 9, 9); }
        else { const tx = x + d * 7 + 1, ty = y - 26; ctx.fillStyle = '#5a3a20'; ctx.fillRect(tx, ty, 2, 10); const f = Math.floor(tk * 12 + q.id) % 3; ctx.fillStyle = '#ff8a20'; ctx.fillRect(tx - 1, ty - 4 - f, 4, 4 + f); ctx.fillStyle = '#ffe070'; ctx.fillRect(tx, ty - 3 - (f > 1 ? 1 : 0), 2, 3); ctx.fillStyle = 'rgba(255,170,80,0.22)'; ctx.fillRect(tx - 5, ty - 9, 12, 12); } }
      ctx.fillStyle = '#ffb040'; for (const p of sparks) ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 1, 1);
    });
    O.NightWalkers = { get lit() { return lit.length; } };
  }
  O.NightWalkersSetup = { setup };
})();
