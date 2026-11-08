// The trees have their work too. In autumn there's a ladder up the apple tree and someone in the branches
// filling a basket, an apple thudding down now and then; under the oaks a swineherd knocks the acorns
// down with a long pole for his pigs, who root and grunt beneath (the pannage). In winter and early
// spring the trees are lopped with a billhook and the twigs bound into faggots for the oven. In summer
// at midday the field hands sit in the shade of a tree with their bread and a jug.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const jobs = [], bits = []; let cool = 8;
    const RIDE = ['mounted courier', 'knight', 'captain of the royal guard', 'master of horse'];
    const OFF = ['stroll', 'socialise', 'idle', 'home', 'rest', 'wait-work', 'play', 'pastime-none', 'labour', 'fieldwork'];
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.agent.mount && !q.ridingOut && !RIDE.includes(q.job?.role) && !q.errand && !q._bit && !q._scene && !q._bank && !q._repair && !q._tree && !q.visitor && q.activity && OFF.includes(q.activity.act) && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const say = (q, t, d) => near(q.agent.x, q.agent.y, 260) && O.Speech && O.Speech.say(q, t, d || 2.5);
    const kindFor = (s, tr) => { const se = s.season, h = s.minute / 60; if (se === 'summer' && h > 11.3 && h < 13.6) return 'noon'; if (se === 'autumn') return tr.kind === 'apple' ? 'pick' : tr.kind === 'oak' ? 'beat' : null; if (se === 'winter' || (se === 'spring' && (s.weather?.dayOfSeason || 0) < 14)) return tr.kind === 'pine' ? null : 'lop'; return null; };
    function spot(s, tr) { const w = s.world, tx = Math.floor(tr.x / T), ty = Math.floor((tr.y - 6) / T) + 1; if (tx < 1 || ty < 1 || tx >= w.W - 1 || ty >= w.H - 1 || w.solid[ty * w.W + tx] || w.ter[ty * w.W + tx] === w.TER.WATER) return null; return [tx, ty]; }
    function release(j) {
      for (const q of j.ppl) { const a = q.agent; if (a) { a.forceAnim = null; a.lift = 0; if (!(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)) a.frozen = false; } q._tree = false; }
      jobs.splice(jobs.indexOf(j), 1);
    }
    function begin(s, tr, kind, ppl) {
      const sp = spot(s, tr); if (!sp) return false; tr._busy = game.t + 90;
      const j = { s, tr, kind, ppl: [], t: -1, len: kind === 'noon' ? 70 + Math.random() * 30 : 60 + Math.random() * 40, n: 0, pigs: [], next: 2 };
      ppl.forEach((q, i) => {
        q._tree = true; const off = kind === 'noon' ? [[0, 0], [-1, 0], [1, 0]][i] : [[0, 0], [1, 0]][i] || [0, 0];
        O.Errands.send(s, q, [sp[0] + off[0], sp[1] + off[1]], { anim: 'idle', secs: 0.3, face: 3, giveUp: game.t + 50, after: (ok) => { if (!ok || !q.agent || j.done) { q._tree = false; return; } const a = q.agent; a.frozen = true; a.path = null; a.dir = kind === 'noon' ? 0 : 3; j.ppl.push(q); if (j.t < 0) { j.t = 0; jobs.push(j); } q._treeX = a.x; } });
      });
      if (kind === 'beat') for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) j.pigs.push({ x: tr.x + (Math.random() - 0.5) * 40, y: tr.y + 10 + Math.random() * 16, seed: O.hash('pig', tr.x, i) % 1000, dir: Math.random() < 0.5 ? 1 : 2, ft: Math.random() * 3, mv: 0 });
      return true;
    }
    function drop(x, y, kind) { bits.push({ x, y, z: 30 + Math.random() * 16, vz: 0, vx: (Math.random() - 0.5) * 14, kind, t: 0 }); }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world) return;
      for (const b of bits.slice()) { b.t += dt; if (b.z > 0) { b.vz -= (b.kind === 'leaf' ? 20 : 160) * dt; if (b.kind === 'leaf' && b.vz < -12) b.vz = -12; b.z = Math.max(0, b.z + b.vz * dt); b.x += (b.kind === 'leaf' ? Math.sin(b.t * 4) * 12 : b.vx) * dt; } if (b.t > (b.kind === 'apple' || b.kind === 'acorn' ? 30 : 6)) bits.splice(bits.indexOf(b), 1); }
      if (game.scene) return;
      for (const j of jobs.slice()) {
        j.t += dt; const lead = j.ppl[0];
        if (j.s !== s || !lead || j.t > j.len || s.raining || j.ppl.some((q) => q.alive === false || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q))) { j.done = true; if (j.s === s && lead && j.kind === 'pick' && j.n) say(lead, `That's ${j.n} for the loft.`); release(j); continue; }
        const a = lead.agent, tr = j.tr; for (const q of j.ppl) q.agent.path = null;
        if (j.kind === 'pick') {
          const up = Math.min(1, j.t / 2.5), down = j.t > j.len - 3 ? Math.min(1, (j.t - (j.len - 3)) / 2.5) : 0; a.lift = Math.round(24 * (up - down)); a.forceAnim = up < 1 || down > 0 ? 'carry' : 'pickup'; a.dir = 3;
          j.next -= dt; if (j.next <= 0 && up >= 1 && !down) { j.next = 1.5 + Math.random() * 2; if (Math.random() < 0.8) j.n++; else { drop(tr.x + (Math.random() - 0.5) * 20, tr.y + 4, 'apple'); if (near(tr.x, tr.y, 240)) O.sfx && O.sfx('place', 0.15); } }
          const helper = j.ppl[1]; if (helper) { helper.agent.forceAnim = Math.floor(j.t / 4) % 2 ? 'pickup' : 'idle'; if (!j.chat && j.t > 15) { j.chat = 1; say(helper, pick(['Mind you don\'t fall.', 'There\'s a big one, to your left!', 'Throw it down, I\'ll catch it.'])); } }
        } else if (j.kind === 'beat') {
          j.next -= dt; a.forceAnim = j.swing > 0 ? 'attack' : 'idle'; if (j.swing > 0) j.swing -= dt; a.dir = 3;
          if (j.next <= 0) { j.next = 1.4 + Math.random() * 1.6; j.swing = 0.35; for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) drop(tr.x + (Math.random() - 0.5) * 34, tr.y + 2 + Math.random() * 10, Math.random() < 0.6 ? 'acorn' : 'leaf'); if (near(tr.x, tr.y, 240)) { O.sfx && O.sfx('smack', 0.12); if (Math.random() < 0.25) O.animalCall && O.animalCall('pig', 0.2); } if (!j.chat && j.t > 8) { j.chat = 1; say(lead, pick(['Come on then, my lovelies.', 'Fat for the winter, you\'ll be.', 'Sooey!'])); } }
          for (const p of j.pigs) { p.ft += dt; if (p.mv > 0) { p.mv -= dt; p.x += (p.dir === 2 ? 8 : -8) * dt; } else if (Math.random() < dt * 0.4) { const nut = bits.find((b) => b.kind === 'acorn' && b.z === 0 && Math.abs(b.y - p.y) < 20); if (nut) { p.dir = nut.x > p.x ? 2 : 1; p.mv = Math.min(2, Math.abs(nut.x - p.x) / 8); if (Math.abs(nut.x - p.x) < 6) bits.splice(bits.indexOf(nut), 1); } else { p.dir = Math.random() < 0.5 ? 1 : 2; p.mv = Math.random() * 1.5; } } }
        } else if (j.kind === 'lop') {
          j.next -= dt; a.forceAnim = 'chop'; a.dir = 3; if (j.next <= 0) { j.next = 0.9 + Math.random(); drop(tr.x + (Math.random() - 0.5) * 24, tr.y, 'twig'); if (near(tr.x, tr.y, 240)) O.sfx && O.sfx('chop', 0.12); if (Math.random() < 0.15) j.n++; }
          const helper = j.ppl[1]; if (helper) helper.agent.forceAnim = Math.floor(j.t / 5) % 2 ? 'pickup' : 'carry';
        } else {
          j.ppl.forEach((q, i) => { const ph = Math.floor((j.t + i * 3) / 7) % 4; q.agent.forceAnim = ph === 1 ? 'eat' : ph === 2 ? 'drink' : ph === 3 && i === 0 && j.t > 40 ? 'doze' : 'sit'; q.agent.dir = 0; });
          if (!j.chat && j.t > 10 && j.ppl.length > 1) { j.chat = 1; say(j.ppl[0], pick(['Pass the jug.', 'Hot as an oven out there.', 'Another hour and then back to it.', 'My back, my back.'])); setTimeout(() => j.ppl[1] && say(j.ppl[1], pick(['Here.', 'Don\'t drink it all.', 'It\'s the cheese that does it.']), 2), 2400); }
        }
      }
      // new work
      cool -= dt; if (cool > 0) return; cool = 7 + Math.random() * 6;
      const h = s.minute / 60; if (h < 7 || h > 17.5 || s.raining || (game.isNight && game.isNight()) || jobs.filter((j) => j.s === s).length >= 3) return;
      const P = game.player, trees = (s.world.trees || []).filter((tr) => tr.kind !== 'pine' && !(tr._busy > game.t) && Math.abs(tr.x - P.x) < 420 && Math.abs(tr.y - P.y) < 300); if (!trees.length) return;
      const tr = pick(trees), kind = kindFor(s, tr); if (!kind) return;
      const cand = s.people.filter((q) => free(q) && q.age >= (kind === 'pick' ? 9 : 14) && Math.hypot(q.agent.x - tr.x, q.agent.y - tr.y) < 600);
      if (!cand.length) return; cand.sort((x, y) => Math.hypot(x.agent.x - tr.x, x.agent.y - tr.y) - Math.hypot(y.agent.x - tr.x, y.agent.y - tr.y));
      let lead = kind === 'beat' ? cand.find((q) => /swine|herd/.test(q.job?.role || '')) || cand.find((q) => q.sex === 'm' && q.age < 60) : kind === 'lop' ? cand.find((q) => q.sex === 'm' && q.age < 60) : cand.find((q) => q.age >= 14 && q.age < 55);
      if (!lead) return; const ppl = [lead];
      const more = kind === 'noon' ? 2 : kind === 'beat' ? 0 : 1; for (const q of cand) { if (ppl.length > more) break; if (q !== lead && Math.random() < 0.7) ppl.push(q); }
      begin(s, tr, kind, ppl);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000, W = ctx.canvas.width, H = ctx.canvas.height;
      for (const b of bits) { const x = Math.round(b.x - cam.x), y = Math.round(b.y - b.z - cam.y); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue; ctx.fillStyle = b.kind === 'apple' ? '#c83a2a' : b.kind === 'acorn' ? '#8a6a3a' : b.kind === 'twig' ? '#6a4a2c' : (Math.floor(b.x) % 2 ? '#c8781a' : '#a8501a'); if (b.kind === 'twig') ctx.fillRect(x - 2, y, 5, 1); else ctx.fillRect(x, y, 2, b.kind === 'leaf' ? 1 : 2); }
      for (const j of jobs) {
        if (j.s !== s || !j.ppl.length) continue; const tr = j.tr, x = Math.round(tr.x - cam.x), y = Math.round(tr.y - cam.y); if (x < -80 || y < -80 || x > W + 80 || y > H + 80) continue;
        const a = j.ppl[0].agent, ax = Math.round(a.x - cam.x), ay = Math.round(a.y - cam.y);
        if (j.kind === 'pick') { ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax - 5, ay + 1); ctx.lineTo(ax - 3, ay - 40); ctx.moveTo(ax + 5, ay + 1); ctx.lineTo(ax + 3, ay - 40); ctx.stroke(); for (let i = 0; i < 7; i++) { const yy = ay - 3 - i * 5; ctx.beginPath(); ctx.moveTo(ax - 5 + i * 0.3, yy); ctx.lineTo(ax + 5 - i * 0.3, yy); ctx.stroke(); }
          const bx = ax + 12, by = ay; ctx.fillStyle = '#9a7a4a'; ctx.fillRect(bx - 5, by - 7, 10, 7); ctx.fillStyle = '#b8945a'; ctx.fillRect(bx - 5, by - 7, 10, 1); ctx.fillStyle = '#c83a2a'; for (let i = 0; i < Math.min(8, j.n); i++) ctx.fillRect(bx - 4 + (i % 4) * 2, by - 8 - Math.floor(i / 4), 2, 2); }
        else if (j.kind === 'beat') { const sw = j.swing > 0; ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax + 3, ay - 14); ctx.lineTo(ax + (sw ? 2 : 10), ay - (sw ? 50 : 42)); ctx.stroke(); if (sw) { const lx = x + Math.round(Math.sin(tk * 30) * 2); ctx.fillStyle = 'rgba(40,70,30,0.25)'; ctx.fillRect(lx - 12, y - 52, 24, 3); }
          for (const p of j.pigs) { try { const an = p.mv > 0 ? 'walk' : 'graze', HA = O.Animals.HANIMS[an], fr = O.Animals.animal('pig', p.seed, p.dir, p.mv > 0, Math.floor(p.ft * HA.fps) % HA.frames, an); const px = p.x - cam.x, py = p.y - cam.y; if (O.occluded && O.occluded(p.x, p.y)) continue; ctx.drawImage(fr, Math.round(px - (fr.ox ?? fr.width / 2)), Math.round(py - (fr.gy ?? fr.height))); } catch (e) { /* */ } } }
        else if (j.kind === 'lop') { const n = Math.min(4, j.n + 1); for (let i = 0; i < n; i++) { const fx = ax + 20 + i * 3, fy = ay + 4 - i * 2; ctx.fillStyle = '#7a5a3a'; ctx.fillRect(fx - 5, fy - 3, 11, 3); ctx.fillStyle = '#5a4028'; ctx.fillRect(fx - 1, fy - 3, 1, 3); } }
        else { const cx = ax, cy = ay + 6; ctx.fillStyle = '#e8e2d0'; ctx.fillRect(cx - 7, cy - 2, 14, 5); ctx.fillStyle = '#c89a5a'; ctx.fillRect(cx - 4, cy - 2, 5, 2); ctx.fillStyle = '#e8d8a0'; ctx.fillRect(cx + 2, cy - 1, 3, 2); ctx.fillStyle = '#8a6a4a'; ctx.fillRect(cx + 9, cy - 6, 4, 7); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(cx + 9, cy - 6, 4, 1);
          ctx.fillStyle = 'rgba(20,30,10,0.18)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 30, 10, 0, 0, Math.PI * 2); ctx.fill(); }
      }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => {
      if (!q._tree) return ''; const j = jobs.find((o) => o.ppl.includes(q)); if (!j) return '';
      return { pick: `You are picking apples from the tree${j.n ? `; ${j.n} in the basket so far` : ''}.`, beat: 'You are knocking acorns down from the oak with a long pole for the pigs to eat (the pannage).', lop: 'You are lopping the tree with a billhook and binding the twigs into faggots for the oven.', noon: 'You are sitting in the shade of a tree at midday with your bread and a jug, resting from the field work.' }[j.kind] || '';
    });
    O.TreeWork = { jobs, bits, start: (kind) => { const s = cur(), P = game.player; const trees = (s.world.trees || []).filter((tr) => (kind === 'pick' ? tr.kind === 'apple' : kind === 'beat' ? tr.kind === 'oak' : tr.kind !== 'pine') && spot(s, tr) && !(tr._busy > game.t)).sort((x, y) => Math.hypot(x.x - P.x, x.y - P.y) - Math.hypot(y.x - P.x, y.y - P.y)); const tr = trees[0]; if (!tr) return null; const cand = s.people.filter((q) => free(q) && q.age >= 14).sort((x, y) => Math.hypot(x.agent.x - tr.x, x.agent.y - tr.y) - Math.hypot(y.agent.x - tr.x, y.agent.y - tr.y)); if (!cand.length) return null; const ppl = cand.slice(0, kind === 'noon' ? 3 : kind === 'beat' ? 1 : 2); begin(s, tr, kind, ppl); return tr.kind + ' with ' + ppl.map((q) => q.first).join(', '); } };
  }
  O.TreeWorkSetup = { setup };
})();
