// Horses wait. When a rider gets down and goes indoors (the courier into the inn, the knight into the
// hall, a gentleman into his house) the horse doesn't vanish: it stands tied to a post by the door, the
// rein looped round it, shifting its feet, swishing its tail, dropping its head to crop at the verge, until
// its rider comes out and mounts again. One who gets down in the street stands holding it by the bridle.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const tied = new Map(); const had = new Map(); let t = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.people) return; t += dt;
      for (const [q, h] of tied) { h.ft += dt; if (h.s !== s) { tied.delete(q); continue; } const a = q.agent;
        const back = !a || q.alive === false || a.mount || (a.inside == null && !a.hidden && Math.hypot(a.x - h.x, a.y - h.y) > 200) || (s.day * 1440 + s.minute) - h.since > 240;
        if (back) { tied.delete(q); continue; }
        if (!h.post && a.inside == null && !a.hidden) { h.dir = a.x > h.x ? 2 : 1; } // held by the bridle: turns to look at its rider
        if (!h.post && a.inside != null) { const b = s.building ? s.building(a.inside) : null; if (b && b.doorX != null && Math.hypot(b.doorX * T - h.x, b.doorY * T - h.y) < 200) { const side = (q.id % 2) ? 1 : -1; h.x = (b.doorX + side * 1.5) * T + 8; h.y = (b.doorY + 1) * T + 6; h.post = true; h.dir = side > 0 ? 1 : 2; } } // tied up at the door when they go in
        if (Math.random() < dt * 0.15) h.anim = h.anim === 'graze' ? 'idle' : (Math.random() < 0.6 ? 'graze' : 'idle'); }
      if (t < 0.25) return; t = 0;
      for (const q of s.people) { const a = q.agent; if (!a) continue; const m = a.mount;
        if (m) { had.set(q, { m, x: a.x, y: a.y }); continue; }
        const was = had.get(q); if (!was) continue; had.delete(q); if (tied.has(q)) continue;
        // just got down: where?
        let x = was.x, y = was.y, post = false, dir = 1;
        if (a.inside != null) { const b = s.building ? s.building(a.inside) : null; if (b && b.doorX != null) { const side = (q.id % 2) ? 1 : -1; x = (b.doorX + side * 1.5) * T + 8; y = (b.doorY + 1) * T + 6; post = true; dir = side > 0 ? 1 : 2; } }
        else { x = was.x + 14; y = was.y + 2; dir = 1; }
        const w = s.world, tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H || w.ter[ty * w.W + tx] === w.TER.WATER) continue;
        tied.set(q, { s, m: was.m, x, y, post, dir, anim: 'idle', ft: Math.random() * 3, since: s.day * 1440 + s.minute });
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height, tk = performance.now() / 1000;
      for (const [q, h] of tied) { if (h.s !== s) continue; const x = Math.round(h.x - cam.x), y = Math.round(h.y - cam.y); if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue; if (O.occluded && O.occluded(h.x, h.y)) continue;
        try { const HA = O.Animals.HANIMS[h.anim] || O.Animals.HANIMS.idle, fr = O.Animals.horse(h.m, h.dir, h.anim, Math.floor(h.ft * HA.fps) % HA.frames); ctx.drawImage(fr, Math.round(x - (fr.ox ?? fr.width / 2)), Math.round(y - (fr.gy ?? fr.height))); } catch (e) { continue; }
        const hx = x + (h.dir === 2 ? 14 : -14), hy = y - 18 + (h.anim === 'graze' ? 8 : 0);
        if (h.post) { const px = x + (h.dir === 2 ? 22 : -22); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(px - 1, y - 16, 3, 16); ctx.fillStyle = '#8a6239'; ctx.fillRect(px - 2, y - 17, 5, 2); ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + px) / 2, Math.max(hy, y - 12) + 3, px, y - 12); ctx.stroke(); }
        // the tail swishes
        if (Math.floor(tk * 1.3 + q.id) % 4 === 0) { ctx.fillStyle = 'rgba(40,30,20,0.6)'; const tx2 = x + (h.dir === 2 ? -16 : 16); ctx.fillRect(tx2 + Math.round(Math.sin(tk * 9) * 2), y - 14, 1, 6); }
      }
    });
    O.Hitching = { tied };
  }
  O.HitchingSetup = { setup };
})();
