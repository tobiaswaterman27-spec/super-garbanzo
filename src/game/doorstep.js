// Housework done out of doors, where you can see it. A woman comes out with a bowl and scatters grain,
// and the hens come running from all over the yard; someone sits on the step plucking a fowl for the pot
// with the feathers blowing about; the butter is churned by the door, the plunger going up and down;
// kindling is split on the block with the chips flying; a rug is hung over the line and beaten till the
// dust comes out of it in clouds.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const jobs = [], puffs = []; let cool = 5;
    const OFF = ['home', 'idle', 'rest', 'stroll', 'socialise', 'pastime-none', 'wait-work'];
    const free = (q) => q && q.alive !== false && q.agent && (!q.agent.hidden || (q.agent.inside != null && q.agent.inside === q.home)) && !q.agent.frozen && !q.agent.mount && !q.errand && !q._bit && !q._scene && !q._bank && !q._repair && !q._tree && !q._door && !q.visitor && q.activity && OFF.includes(q.activity.act) && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const say = (q, t) => q.agent && near(q.agent.x, q.agent.y, 240) && O.Speech && O.Speech.say(q, t, 2.4);
    const ANIM = { hens: 'pour', pluck: 'sit', churn: 'pitch', kindling: 'chop', rug: 'attack', rushes: 'pitch', copper: 'mix' };
    const LEN = { hens: 30, pluck: 50, churn: 60, kindling: 45, rug: 40, rushes: 36, copper: 55 };
    function release(j) { const a = j.q.agent; if (a) { a.forceAnim = null; if (!(O.npcUI && O.npcUI.talking && O.npcUI.talking() === j.q)) a.frozen = false; } j.q._door = false; jobs.splice(jobs.indexOf(j), 1); }
    function begin(s, q, b, kind) {
      const side = Math.random() < 0.5 ? -1 : 1, tx = b.doorX + side * (kind === 'rug' ? 2 : 1), ty = b.doorY + 1, w = s.world; if (w.solid[ty * w.W + tx] || w.solid[ty * w.W + tx + side]) return false;
      q._door = true;
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.3, face: 0, giveUp: game.t + 45, after: (ok) => {
        if (!ok || !q.agent) { q._door = false; return; } const a = q.agent; a.frozen = true; a.path = null; a.dir = kind === 'kindling' || kind === 'churn' ? (side > 0 ? 2 : 1) : 0;
        const j = { s, q, b, kind, side, t: 0, x: a.x, y: a.y, len: LEN[kind] * (0.8 + Math.random() * 0.5), n: 0, next: 1 };
        if (kind === 'hens') { j.hens = []; for (let i = 0; i < 4 + Math.floor(Math.random() * 4); i++) { const ang = Math.random() * Math.PI * 2, d = 70 + Math.random() * 60; j.hens.push({ x: a.x + Math.cos(ang) * d, y: a.y + Math.sin(ang) * d * 0.6, seed: O.hash('hen', b.id, i) % 1000, ft: Math.random() * 3, dir: 1, mv: false, peck: 0 }); } j.grain = []; }
        jobs.push(j);
      } });
      return true;
    }
    game.hooks.update.push((dt) => {
      for (const p of puffs.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'feather') { p.vy = Math.min(10, p.vy + 6 * dt); p.vx += Math.sin(p.t * 3 + p.ph) * 12 * dt; } else if (p.kind === 'chip') { p.vy += 140 * dt; if (p.t > 0.35) { p.vx = 0; p.vy = 0; } } if (p.t > p.life) puffs.splice(puffs.indexOf(p), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return;
      for (const j of jobs.slice()) {
        j.t += dt; const a = j.q.agent;
        if (j.s !== s || j.q.alive === false || !a || j.t > j.len || (s.raining && j.kind !== 'pluck') || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === j.q)) { if (j.s === s && j.t > j.len && j.kind === 'churn') say(j.q, 'There. It\'s come.'); release(j); continue; }
        j.next -= dt; a.forceAnim = ANIM[j.kind];
        if (j.kind === 'hens') {
          if (j.next <= 0) { j.next = 1.4 + Math.random(); if (j.grain.length < 14) for (let i = 0; i < 3; i++) j.grain.push({ x: a.x + (Math.random() - 0.5) * 50, y: a.y + 6 + Math.random() * 22, n: 2 }); if (!j.said && j.t > 1) { j.said = 1; say(j.q, pick(['Chook chook chook!', 'Here, my girls!', 'Come on then.'])); } }
          for (const h of j.hens) { h.ft += dt; if (h.peck > 0) { h.peck -= dt; continue; } const g = j.grain.reduce((m, gr) => (!m || Math.hypot(gr.x - h.x, gr.y - h.y) < Math.hypot(m.x - h.x, m.y - h.y) ? gr : m), null); if (!g) { h.mv = false; continue; } const dx = g.x - h.x, dy = g.y - h.y, d = Math.hypot(dx, dy); if (d < 3) { h.mv = false; h.peck = 0.6 + Math.random() * 0.6; g.n--; if (g.n <= 0) j.grain.splice(j.grain.indexOf(g), 1); } else { h.mv = true; const v = d > 40 ? 46 : 22; h.x += dx / d * v * dt; h.y += dy / d * v * dt; h.dir = dx > 0 ? 2 : 1; } }
          if (Math.random() < dt * 0.5 && near(a.x, a.y, 200)) O.animalCall && O.animalCall('chicken', 0.15);
        } else if (j.kind === 'pluck') {
          if (j.next <= 0) { j.next = 0.25 + Math.random() * 0.35; j.n++; puffs.push({ kind: 'feather', x: a.x + 6, y: a.y - 12, vx: (Math.random() - 0.3) * 14, vy: -6 - Math.random() * 6, t: 0, life: 3 + Math.random() * 2, ph: Math.random() * 6, c: Math.random() < 0.5 ? '#f4f0e6' : '#c8a878' }); }
        } else if (j.kind === 'churn') {
          if (j.next <= 0) { j.next = 0.6; if (near(a.x, a.y, 160) && Math.random() < 0.3) O.sfx && O.sfx('pour', 0.06); }
          if (!j.said && j.t > 20) { j.said = 1; say(j.q, pick(['Come, butter, come.', 'My arms!', 'It\'s turning, I can feel it.'])); }
        } else if (j.kind === 'kindling') {
          if (j.next <= 0) { j.next = 1; j.n++; for (let i = 0; i < 3; i++) puffs.push({ kind: 'chip', x: a.x + j.side * 12, y: a.y - 6, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 30, t: 0, life: 6, c: '#c8a070' }); if (near(a.x, a.y, 220)) O.sfx && O.sfx('chop', 0.15); }
        } else if (j.kind === 'copper') {
          if (j.next <= 0) { j.next = 0.25; puffs.push({ kind: 'dust', x: a.x + j.side * 12 + (Math.random() - 0.5) * 6, y: a.y - 14, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 8, t: 0, life: 2, c: '#f0f0f4' }); }
          if (!j.said && j.t > 12) { j.said = 1; say(j.q, pick(['Washday. My poor hands.', 'More lye in that, it\'s grey still.', 'Mind, it\'s scalding!'])); }
        } else if (j.kind === 'rushes') {
          // old floor rushes forked out onto a heap, then fresh green ones carried in
          const fresh = j.t > j.len / 2; a.forceAnim = fresh ? 'carry' : 'pitch'; if (!fresh && j.next <= 0) { j.next = 0.9; j.n++; for (let i = 0; i < 4; i++) puffs.push({ kind: 'chip', x: a.x + j.side * 6, y: a.y - 14, vx: j.side * (20 + Math.random() * 30), vy: -30 - Math.random() * 20, t: 0, land: 0.4, life: 8, c: Math.random() < 0.5 ? '#8a7a4a' : '#6a5a3a' }); }
          if (fresh && !j.said) { j.said = 1; say(j.q, pick(['Fresh rushes. Smell that.', 'Out with the old, fleas and all.', 'Sweet sedge and a bit of mint.'])); }
        } else if (j.kind === 'rug') {
          if (j.next <= 0) { j.next = 0.7 + Math.random() * 0.3; const rx = a.x + j.side * 18; for (let i = 0; i < 4; i++) puffs.push({ kind: 'dust', x: rx + (Math.random() - 0.5) * 12, y: a.y - 18 + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 16 + 6, vy: -4 - Math.random() * 6, t: 0, life: 1.6, c: '#b8a888' }); if (near(a.x, a.y, 220)) O.sfx && O.sfx('smack', 0.14); if (!j.said && j.t > 8) { j.said = 1; say(j.q, pick(['Look at the dirt in it!', 'Atchoo!', 'Half the road\'s in this rug.'])); } }
        }
      }
      // new work by the door
      cool -= dt; if (cool > 0) return; cool = 6 + Math.random() * 6;
      const h = s.minute / 60; if (h < 7.5 || h > 18 || s.raining || (game.isNight && game.isNight()) || jobs.filter((j) => j.s === s).length >= 4) return;
      const P = game.player, houses = s.world.buildings.filter((b) => b.type === 'house' && !b.site && !b.ruined && b.doorX != null && Math.abs(b.doorX * T - P.x) < 420 && Math.abs(b.doorY * T - P.y) < 300 && !jobs.some((j) => j.b === b)); if (!houses.length) return;
      const b = pick(houses), folk = s.people.filter((q) => q.home === b.id && free(q) && q.age >= 10 && (q.agent.inside === b.id || Math.hypot(q.agent.x - b.doorX * T, q.agent.y - b.doorY * T) < 300)); if (!folk.length) return;
      const q = pick(folk), kinds = ['hens', 'kindling', 'rug']; if (q.age >= 14) kinds.push('pluck', 'churn'); if (s.season === 'spring' || s.season === 'autumn') kinds.push('rushes'); if (q.age >= 14 && s.weekday === 0) kinds.push('copper', 'copper'); const k = pick(kinds);
      if (k === 'kindling' && q.age < 13) return; begin(s, q, b, k);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000;
      for (const j of jobs) {
        if (j.s !== s) continue; const a = j.q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); if (x < -80 || y < -80 || x > ctx.canvas.width + 80 || y > ctx.canvas.height + 80) continue;
        if (j.kind === 'hens') { ctx.fillStyle = '#d8c070'; for (const g of j.grain) ctx.fillRect(Math.round(g.x - cam.x), Math.round(g.y - cam.y), 1, 1); for (const h of j.hens) { try { const an = h.mv ? 'walk' : h.peck > 0 ? 'graze' : 'idle', HA = O.Animals.HANIMS[an], fr = O.Animals.animal('chicken', h.seed, h.dir, h.mv, Math.floor(h.ft * HA.fps) % HA.frames, an); if (O.occluded && O.occluded(h.x, h.y)) continue; ctx.drawImage(fr, Math.round(h.x - (fr.ox ?? fr.width / 2) - cam.x), Math.round(h.y - (fr.gy ?? fr.height) - cam.y)); } catch (e) { /* */ } } ctx.fillStyle = '#9a7a4a'; ctx.fillRect(x + 4, y - 14, 6, 3); }
        else if (j.kind === 'pluck') { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 8, y - 4, 16, 4); ctx.fillStyle = '#f0e8d8'; ctx.fillRect(x + 3, y - 12, 6, 4); ctx.fillStyle = '#d0a070'; ctx.fillRect(x + 8, y - 11, 2, 2); ctx.fillStyle = '#9a7a4a'; ctx.fillRect(x - 14, y - 5, 6, 5); }
        else if (j.kind === 'churn') { const cx = x + j.side * 9, up = Math.round((Math.sin(tk * 5) + 1) * 3); ctx.fillStyle = '#8a6239'; ctx.fillRect(cx - 4, y - 14, 8, 14); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(cx - 4, y - 10, 8, 1); ctx.fillRect(cx - 4, y - 4, 8, 1); ctx.fillStyle = '#5a4028'; ctx.fillRect(cx - 1, y - 24 - up, 2, 12); ctx.fillRect(cx - 3, y - 25 - up, 6, 2); }
        else if (j.kind === 'kindling') { const bx = x + j.side * 12; ctx.fillStyle = '#7a5232'; ctx.fillRect(bx - 5, y - 6, 10, 6); ctx.fillStyle = '#c8a070'; ctx.fillRect(bx - 5, y - 6, 10, 1); ctx.fillStyle = '#9a7a4a'; for (let i = 0; i < Math.min(9, j.n); i++) ctx.fillRect(x - j.side * 10 + (i % 3) * 3 - 3, y - 2 - Math.floor(i / 3) * 2, 3, 1); }
        else if (j.kind === 'copper') { const cx = x + j.side * 12, tk2 = performance.now() / 1000; ctx.fillStyle = Math.floor(tk2 * 8) % 2 ? '#ff8a20' : '#ffc040'; ctx.fillRect(cx - 4, y - 3, 8, 3); ctx.fillStyle = '#7a4a2a'; ctx.fillRect(cx - 7, y - 11, 14, 8); ctx.fillStyle = '#a86a3a'; ctx.fillRect(cx - 7, y - 11, 14, 1); ctx.fillStyle = '#e8e4dc'; ctx.fillRect(cx - 5, y - 12, 10, 2); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + j.side * 4, y - 16); ctx.lineTo(cx + Math.round(Math.sin(tk2 * 3) * 3), y - 11); ctx.stroke(); }
        else if (j.kind === 'rushes') { const hx = x + j.side * 16; ctx.fillStyle = '#7a6a3a'; ctx.fillRect(hx - 5, y - 2 - Math.min(5, j.n), 11, 2 + Math.min(5, j.n)); if (j.t > j.len / 2) { ctx.fillStyle = '#6a9a3a'; ctx.fillRect(x - 6, y - 34, 12, 4); ctx.fillStyle = '#8aba5a'; ctx.fillRect(x - 6, y - 34, 12, 1); } }
        else if (j.kind === 'rug') { const rx = x + j.side * 18; ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rx - 14, y - 24); ctx.lineTo(rx + 14, y - 24); ctx.stroke(); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(rx - 15, y - 25, 1, 25); ctx.fillRect(rx + 14, y - 25, 1, 25); const sw = Math.round(Math.sin(tk * 9) * (j.next > 0.55 ? 1 : 0)); ctx.fillStyle = '#8a2a2a'; ctx.fillRect(rx - 10 + sw, y - 24, 20, 14); ctx.fillStyle = '#c8a050'; ctx.fillRect(rx - 8 + sw, y - 21, 16, 1); ctx.fillRect(rx - 8 + sw, y - 14, 16, 1); ctx.fillStyle = '#2a4a6a'; ctx.fillRect(rx - 3 + sw, y - 19, 6, 4); }
      }
      for (const p of puffs) { const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y); if (p.kind === 'dust') { const k = p.t / p.life; ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = p.c; const r = 1 + Math.floor(k * 4); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; } else { ctx.globalAlpha = p.kind === 'chip' ? Math.min(1, (p.life - p.t)) : 1; ctx.fillStyle = p.c; ctx.fillRect(x, y, p.kind === 'chip' ? 2 : 2, 1); ctx.globalAlpha = 1; } }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!q._door) return ''; const j = jobs.find((o) => o.q === q); if (!j) return ''; return { hens: 'You are out by your door scattering grain for the hens.', pluck: 'You are sitting by your door plucking a fowl for the pot, feathers everywhere.', churn: 'You are churning butter by your door; your arms ache.', kindling: 'You are splitting kindling on the block by your door.', rug: 'You have hung the rug over the line by your door and are beating the dust out of it.', rushes: 'You are changing the rushes on your floor: the old ones forked out on the heap, fresh green ones carried in.', copper: 'It is washday: you have the copper boiling over a fire by your door and are stirring the linen in the lye with a paddle.' }[j.kind]; });
    O.Doorstep = { jobs, start: (kind) => { const s = cur(), P = game.player; const hs = s.world.buildings.filter((b) => b.type === 'house' && !b.site && b.doorX != null && !jobs.some((j) => j.b === b)).sort((x, y) => Math.hypot(x.doorX * T - P.x, x.doorY * T - P.y) - Math.hypot(y.doorX * T - P.x, y.doorY * T - P.y)); for (const b of hs.slice(0, 60)) { const q = s.people.find((x) => x.home === b.id && free(x) && x.age >= 14); if (q && begin(s, q, b, kind)) return q.first; } return null; } };
  }
  O.DoorstepSetup = { setup };
})();
