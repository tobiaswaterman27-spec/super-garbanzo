// The stable yard. The horses in the paddock by the stable door are looked after where you can see it: a
// groom brushes one down in long strokes, the dust and loose hair coming off it, and it stands easy,
// tail swishing; he holds a bucket for another to drink, picks out a hoof, bent double with the foot
// between his knees; and by the door he mucks out, forking the old straw onto a steaming heap.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const jobs = [], bits = [], heaps = new Map(); let cool = 6;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const busy = (q) => !q || q.alive === false || !q.agent || q.agent.frozen || q.errand || q._bit || q._scene || q._stable || q._door || q._bank || q._tree || q._repair || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    function release(j) { const a = j.q.agent; if (a) { a.forceAnim = null; if (!(O.npcUI && O.npcUI.talking && O.npcUI.talking() === j.q)) a.frozen = false; } j.q._stable = false; if (j.h) j.h.tied = false; jobs.splice(jobs.indexOf(j), 1); }
    function begin(s, q, b, kind, h) {
      let tx, ty, face = 0;
      if (h) { const side = h.x > b.doorX * T ? -1 : 1; tx = Math.floor((h.x + side * 18) / T); ty = Math.floor(h.y / T); face = side > 0 ? 1 : 2; if (kind === 'hoof') { tx = Math.floor((h.x - (h.dir === 1 ? -14 : 14)) / T); } }
      else { tx = b.doorX + (Math.random() < 0.5 ? -1 : 1); ty = b.doorY + 1; face = 0; }
      const w = s.world; if (tx < 1 || ty < 1 || w.solid[ty * w.W + tx]) return false;
      q._stable = true; q._stableH = h || null; if (h) h.tied = true;
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.3, face, giveUp: game.t + 45, after: (ok) => {
        if (!ok || !q.agent) { q._stable = false; if (h) h.tied = false; return; } const a = q.agent; a.frozen = true; a.path = null;
        if (h) a.dir = h.x > a.x ? 2 : 1; else a.dir = tx < b.doorX ? 2 : 1;
        jobs.push({ s, q, b, kind, h, t: 0, len: kind === 'muck' ? 50 : kind === 'groom' ? 40 : 22, next: 0.5 });
      } });
      return true;
    }
    game.hooks.update.push((dt) => {
      for (const p of bits.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'straw' ? 120 : 10) * dt; if (p.kind === 'straw' && p.t > 0.4) { p.vx = 0; p.vy = 0; } if (p.t > p.life) bits.splice(bits.indexOf(p), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return;
      // a groom whose errand was taken over by something else: let go of him and the horse
      if (Math.random() < dt) for (const q of s.people) if (q._stable && !q.errand && !jobs.some((j) => j.q === q)) { q._stable = false; if (q._stableH) q._stableH.tied = false; q._stableH = null; }
      for (const j of jobs.slice()) {
        j.t += dt; const a = j.q.agent;
        if (j.s !== s || j.t > j.len || !a || j.q.alive === false || s.raining || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === j.q) || (j.h && (j.h.stabled || j.h === game.player.mount))) { release(j); continue; }
        j.next -= dt;
        if (j.h) { j.h.anim = j.kind === 'water' ? 'graze' : 'idle'; j.h.tx = null; }
        if (j.kind === 'groom') { a.forceAnim = 'scrub'; if (j.next <= 0) { j.next = 0.4; bits.push({ kind: 'hair', x: j.h.x + (Math.random() - 0.5) * 16, y: j.h.y - 14 - Math.random() * 6, vx: (Math.random() - 0.5) * 8, vy: -4, t: 0, life: 1.2, c: Math.random() < 0.5 ? '#c8b090' : '#8a6a4a' }); if (near(a.x, a.y, 200) && Math.random() < 0.15) O.animalCall && O.animalCall('horse', 0.12); } if (!j.said && j.t > 10) { j.said = 1; near(a.x, a.y, 240) && O.Speech && O.Speech.say(j.q, pick(['Stand up, there\'s a good lad.', 'Easy, easy.', 'Look at the shine on you.']), 2.4); } }
        else if (j.kind === 'water') { a.forceAnim = 'idle'; if (j.next <= 0) { j.next = 1.6; if (near(a.x, a.y, 160)) O.sfx && O.sfx('drink', 0.1); } }
        else if (j.kind === 'hoof') { a.forceAnim = Math.floor(j.t / 3) % 2 ? 'crouch' : 'scrub'; if (j.next <= 0) { j.next = 0.7; bits.push({ kind: 'straw', x: a.x + (a.dir === 2 ? 6 : -6), y: a.y - 4, vx: (Math.random() - 0.5) * 20, vy: -20, t: 0, life: 3, c: '#6a4a30' }); } }
        else { a.forceAnim = 'pitch'; const hk = j.b.id; if (j.next <= 0) { j.next = 1.1; heaps.set(hk, Math.min(14, (heaps.get(hk) || 2) + 0.25)); for (let i = 0; i < 4; i++) bits.push({ kind: 'straw', x: a.x + (a.dir === 2 ? 8 : -8), y: a.y - 18, vx: (a.dir === 2 ? 1 : -1) * (20 + Math.random() * 30), vy: -30 - Math.random() * 20, t: 0, life: 2.5, c: Math.random() < 0.5 ? '#d8c070' : '#9a7a40' }); } if (!j.said && j.t > 15) { j.said = 1; near(a.x, a.y, 240) && O.Speech && O.Speech.say(j.q, pick(['Phew. Smells like spring.', 'Good muck for the gardens, this.', 'Every blessed day.']), 2.4); } }
      }
      cool -= dt; if (cool > 0) return; cool = 8 + Math.random() * 6;
      const hr = s.minute / 60; if (hr < 7 || hr > 18 || s.raining || jobs.filter((j) => j.s === s).length >= 2) return;
      const P = game.player, sb = s.world.buildings.filter((b) => b.type === 'stable' && b.doorX != null && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 520); if (!sb.length) return;
      const b = pick(sb), bz = s.biz.get(b.id); const ws = (bz ? bz.workers : []).map((id) => s.byId.get(id)).filter((q) => q && !busy(q) && q.activity?.act === 'work');
      const q = ws.length ? pick(ws) : s.people.find((x) => !busy(x) && x.home && x.age >= 12 && x.age < 60 && x.activity?.act === 'stroll' && Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) < 250); if (!q) return;
      const hs = (O.horsesAll ? O.horsesAll() : []).filter((h) => h.stable === b.id && !h.stabled && !h.tied && h !== P.mount && (h.world || 'ashford') === s.world.placeId && Math.hypot(h.x - b.doorX * T, h.y - b.doorY * T) < 140);
      const kind = hs.length ? pick(['groom', 'groom', 'water', 'hoof', 'muck']) : 'muck';
      begin(s, q, b, kind, kind === 'muck' ? null : pick(hs));
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000;
      for (const b of s.world.buildings) { if (b.type !== 'stable' || b.doorX == null) continue; const n = Math.round(heaps.get(b.id) || 3), x = Math.round((b.doorX + 2) * T - cam.x), y = Math.round((b.doorY + 1) * T + 4 - cam.y); if (x < -40 || y < -40 || x > ctx.canvas.width + 40 || y > ctx.canvas.height + 40) continue; ctx.fillStyle = '#5a4028'; ctx.beginPath(); ctx.moveTo(x - 4 - n, y); ctx.quadraticCurveTo(x, y - n * 0.9 - 2, x + 4 + n, y); ctx.fill(); ctx.fillStyle = '#9a7a40'; ctx.fillRect(x - 2, y - Math.round(n * 0.5), 3, 1); ctx.fillRect(x + 2, y - Math.round(n * 0.3), 2, 1); if (s.season === 'winter' || s.minute < 9 * 60) { const k = (tk * 0.6) % 1; ctx.globalAlpha = 0.25 * (1 - k); ctx.fillStyle = '#e8e8ec'; ctx.fillRect(x - 1 + Math.round(Math.sin(tk) * 2), y - n - 2 - Math.round(k * 8), 2, 2); ctx.globalAlpha = 1; } }
      for (const j of jobs) {
        if (j.s !== s) continue; const a = j.q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y), d = a.dir === 2 ? 1 : -1;
        if (j.kind === 'water') { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x + d * 10 - 3, y - 10, 7, 6); ctx.fillStyle = '#6a8ab0'; ctx.fillRect(x + d * 10 - 2, y - 10, 5, 1); }
        else if (j.kind === 'muck') { const up = Math.floor(tk * 4) % 2; ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - d * 2, y - 8); ctx.lineTo(x + d * 10, y - (up ? 22 : 4)); ctx.stroke(); ctx.fillStyle = '#9a9aa0'; ctx.fillRect(x + d * 10 - 1, y - (up ? 24 : 5), 3, 2); }
        else if (j.kind === 'groom') { ctx.fillStyle = '#7a5232'; ctx.fillRect(x + d * 8 - 2 + Math.round(Math.sin(tk * 6) * 2), y - 16, 4, 2); }
      }
      for (const p of bits) { ctx.globalAlpha = Math.min(1, p.life - p.t); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), p.kind === 'straw' ? 2 : 1, 1); } ctx.globalAlpha = 1;
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!q._stable) return ''; const j = jobs.find((o) => o.q === q); return j ? { groom: 'You are brushing down a horse in the stable yard.', water: 'You are holding a bucket for a horse to drink.', hoof: 'You are picking out a horse\'s hoof, its foot between your knees.', muck: 'You are mucking out the stable, forking the old straw onto the heap.' }[j.kind] : ''; });
    O.StableYard = { jobs, start: (kind) => { const s = cur(), P = game.player; const b = s.world.buildings.filter((x) => x.type === 'stable').sort((x, y) => Math.hypot(x.doorX * T - P.x, x.doorY * T - P.y) - Math.hypot(y.doorX * T - P.x, y.doorY * T - P.y))[0]; if (!b) return null; const q = s.people.filter((x) => !busy(x) && x.age >= 14 && x.age < 60 && x.agent && !x.agent.mount).sort((x, y) => Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) - Math.hypot(y.agent.x - b.doorX * T, y.agent.y - b.doorY * T))[0]; if (!q) return null; const hs = (O.horsesAll ? O.horsesAll() : []).filter((h) => h.stable === b.id && !h.stabled && !h.tied && (h.world || 'ashford') === s.world.placeId); const h = kind === 'muck' ? null : hs[0]; if (kind !== 'muck' && !h) return 'no horse'; return begin(s, q, b, kind, h) ? q.first : null; } };
  }
  O.StableYardSetup = { setup };
})();
