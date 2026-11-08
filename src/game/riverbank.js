// The water's edge is busy. Someone sits on the bank with a rod, the float bobbing out on the water;
// it dips, they strike, and now and then a fish comes flapping silver out onto the grass. The women
// kneel at the edge with their baskets and beat the linen on a flat stone with a paddle, rinse it, and
// spread it white on the grass to bleach. Children skim stones, counting the hops.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const resv = [], jobs = [], rings = [], fishes = [], linen = []; let cool = 6, cache = null;
    const DV = [[0, 1], [-1, 0], [1, 0], [0, -1]];
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.mount && !q.ridingOut && !['mounted courier', 'knight', 'captain of the royal guard', 'master of horse'].includes(q.job?.role) && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._bank && !q._repair && !q.visitor && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    // land tiles with water straight ahead of them, near the player
    function banks(s) {
      const w = s.world; if (!w.ter || !w.TER) return []; const P = game.player, cx = Math.floor(P.x / T / 8), cy = Math.floor(P.y / T / 8), key = (w.placeId || 'x') + ':' + cx + ':' + cy;
      if (cache && cache.key === key && cache.s === s) return cache.list; const list = [], WA = w.TER.WATER;
      const ok = (x, y) => x > 1 && y > 1 && x < w.W - 2 && y < w.H - 2;
      for (let ty = cy * 8 - 20; ty < cy * 8 + 20; ty++) for (let tx = cx * 8 - 26; tx < cx * 8 + 26; tx++) {
        if (!ok(tx, ty) || (tx + ty) % 2) continue; const i = ty * w.W + tx, t = w.ter[i]; if (t === WA || t === w.TER.BRIDGE || w.solid[i]) continue;
        for (let d = 0; d < 4; d++) { const [dx, dy] = DV[d]; if (!ok(tx + dx * 3, ty + dy * 3)) continue; if (w.ter[(ty + dy) * w.W + tx + dx] === WA && w.ter[(ty + dy * 2) * w.W + tx + dx * 2] === WA && w.ter[(ty + dy * 3) * w.W + tx + dx * 3] === WA) { list.push({ tx, ty, d }); break; } }
      }
      cache = { key, s, list }; return list;
    }
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function release(j, why) {
      const a = j.q.agent; if (a) { a.forceAnim = null; if (!(O.npcUI && O.npcUI.talking && O.npcUI.talking() === j.q)) a.frozen = false; }
      j.q._bank = false; jobs.splice(jobs.indexOf(j), 1); void why;
    }
    function ring(x, y, r) { rings.push({ x, y, t: 0, r: r || 6 }); }
    function begin(s, q, b, kind) {
      q._bank = true; const giveUp = game.t + 50; for (const o of resv) if (o.t < game.t) resv.splice(resv.indexOf(o), 1); resv.push({ tx: b.tx, ty: b.ty, t: game.t + 60 });
      O.Errands.send(s, q, [b.tx, b.ty], { anim: 'idle', secs: 0.3, face: b.d, giveUp, after: (ok) => {
        if (!ok || !q.agent) { q._bank = false; return; } const a = q.agent; a.frozen = true; a.path = null; a.dir = b.d;
        const [dx, dy] = DV[b.d], j = { s, q, kind, b, t: 0, x: a.x, y: a.y, dx, dy, len: kind === 'angle' ? 80 + Math.random() * 60 : kind === 'wash' ? 70 + Math.random() * 30 : 30 + Math.random() * 20, next: 4 + Math.random() * 6, caught: 0, hops: 0 };
        j.fx = a.x + dx * 26 + (dy ? 6 : 0); j.fy = a.y + dy * 22 - (dx ? 2 : 0);
        jobs.push(j);
        if (kind === 'wash') { j.cloth = []; }
      } });
    }
    const taken = (b) => jobs.some((j) => Math.abs(j.b.tx - b.tx) < 3 && Math.abs(j.b.ty - b.ty) < 3) || resv.some((o) => o.t > game.t && Math.abs(o.tx - b.tx) < 3 && Math.abs(o.ty - b.ty) < 3);
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world) return;
      for (const r of rings.slice()) { r.t += dt; if (r.t > 1.4) rings.splice(rings.indexOf(r), 1); }
      for (const f of fishes.slice()) { f.t += dt; if (f.t < f.fly) { const k = f.t / f.fly; f.x = f.x0 + (f.x1 - f.x0) * k; f.y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 26; } else { f.x = f.x1; f.y = f.y1; } if (f.t > f.fly + 2.5) fishes.splice(fishes.indexOf(f), 1); }
      if (game.scene) return; const h = s.minute / 60;
      for (const j of jobs.slice()) {
        j.t += dt; const a = j.q.agent;
        if (j.s !== s || j.q.alive === false || !a || (s.raining && j.kind !== 'angle') || j.t > j.len || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === j.q)) {
          if (j.kind === 'angle' && j.caught && j.s === s && near(a.x, a.y, 260)) O.Speech && O.Speech.say(j.q, j.caught > 1 ? `${j.caught} for the pot.` : 'One for the pot.', 2.5);
          if (j.kind === 'wash' && j.s === s) for (const c of j.cloth) c.gather = true;
          release(j); continue;
        }
        a.dir = j.b.d; a.path = null; a.mount = null;
        if (j.kind === 'angle') {
          j.next -= dt; a.forceAnim = j.strike > 0 ? 'pickup' : 'fish'; if (j.strike > 0) j.strike -= dt;
          if (j.bite > 0) { j.bite -= dt; if (Math.random() < dt * 4) ring(j.fx, j.fy, 3); if (j.bite <= 0) { j.strike = 0.7; if (Math.random() < 0.55) { j.caught++; fishes.push({ x0: j.fx, y0: j.fy, x1: j.x - j.dy * 10 + (Math.random() - 0.5) * 6, y1: j.y + 2 + j.caught, x: j.fx, y: j.fy, t: 0, fly: 0.7, big: Math.random() < 0.2 }); ring(j.fx, j.fy, 8); if (near(j.x, j.y, 260)) { O.sfx && O.sfx('splash', 0.35); if (Math.random() < 0.5) O.Speech && O.Speech.say(j.q, pick(['Got you!', 'Ha! A fat one.', 'Come here, my beauty.', 'Supper.']), 2); } } else if (near(j.x, j.y, 200) && Math.random() < 0.4) O.Speech && O.Speech.say(j.q, pick(['Missed him.', 'Took the worm, the devil.', 'Too slow.']), 2); } }
          else if (j.next <= 0) { j.bite = 1 + Math.random(); j.next = 9 + Math.random() * 14; }
        } else if (j.kind === 'wash') {
          const ph = Math.floor(j.t / 6) % 3; a.forceAnim = ph === 1 ? 'hammer' : 'scrub';
          if (ph === 1 && Math.random() < dt * 2.2 && near(j.x, j.y, 240)) O.sfx && O.sfx('smack', 0.1);
          if (Math.random() < dt * 1.2) ring(j.x + j.dx * 14, j.y + j.dy * 12, 4);
          if (j.cloth.length < 4 && j.t > 12 + j.cloth.length * 14) { const side = j.dy ? 1 : 0, n = j.cloth.length + 1; const c = { s, x: j.x - j.dx * 18 + (side ? n * 14 - 34 : -j.dx * n * 4), y: j.y - j.dy * 16 + (side ? 0 : n * 10 - 22), w: 10 + Math.floor(Math.random() * 6), h: 6 + Math.floor(Math.random() * 3), t: 0, gather: false }; j.cloth.push(c); linen.push(c); a.forceAnim = 'pickup'; }
          if (j.chat == null && j.t > 20) { j.chat = true; const other = jobs.find((o) => o !== j && o.kind === 'wash' && o.s === s && Math.hypot(o.x - j.x, o.y - j.y) < 120); if (other && near(j.x, j.y, 260)) { O.Speech && O.Speech.say(j.q, pick(['Did you hear about the miller\'s girl?', 'My hands are raw with this cold water.', 'Mind your shift doesn\'t float off again.', 'Look at the state of his collars.']), 3); setTimeout(() => O.Speech && O.Speech.say(other.q, pick(['Never!', 'Hush, she\'ll hear.', 'Men.', 'Ha!']), 2), 2600); } }
        } else {
          j.next -= dt; a.forceAnim = j.throwT > 0 ? 'attack' : 'idle'; if (j.throwT > 0) j.throwT -= dt;
          if (j.next <= 0) { j.next = 3 + Math.random() * 3; j.throwT = 0.35; const hops = 1 + Math.floor(Math.random() * 6); j.stone = { t: 0, hops, k: 0, x: j.x + j.dx * 10, y: j.y + j.dy * 8 }; }
          if (j.stone) { const st = j.stone; st.t += dt; const hop = Math.floor(st.t / 0.28); if (hop > st.k && st.k < st.hops) { st.k = hop; const d = 20 + st.k * 16 - st.k * st.k; ring(j.x + j.dx * (14 + d * st.k * 0.6) + j.dy * st.k * 2, j.y + j.dy * (12 + d * st.k * 0.5) + j.dx * st.k, 3 + st.k * 0.4); if (near(j.x, j.y, 200)) O.sfx && O.sfx('splash', 0.08); }
            if (st.k >= st.hops && st.t > st.hops * 0.28 + 0.3) { if (near(j.x, j.y, 220) && (st.hops >= 4 || Math.random() < 0.3)) O.Speech && O.Speech.say(j.q, st.hops >= 5 ? `${st.hops}! Did you see?` : st.hops >= 4 ? `Four!` : pick(['Plop.', 'Rubbish stone.', 'Again.']), 1.8); j.best = Math.max(j.best || 0, st.hops); j.stone = null; } }
        }
      }
      for (const c of linen.slice()) { c.t += dt; if (c.gather) { c.fade = (c.fade || 0) + dt; if (c.fade > 1.5) linen.splice(linen.indexOf(c), 1); } else if (c.t > 400 || c.s !== s) linen.splice(linen.indexOf(c), 1); }
      // starting new work at the water
      cool -= dt; if (cool > 0) return; cool = 5 + Math.random() * 5;
      if (h < 6.5 || h > 19 || s.raining || game.isNight && game.isNight() || jobs.filter((j) => j.s === s).length >= 5) return;
      const B = banks(s); if (!B.length) return; const P = game.player;
      const kinds = ['angle', 'angle']; if (s.season !== 'winter') kinds.push('wash', 'wash'); if (s.season === 'summer' || s.season === 'spring') kinds.push('skim');
      const kind = pick(kinds); if (jobs.filter((j) => j.kind === kind && j.s === s).length >= (kind === 'skim' ? 1 : 2)) return;
      const want = (q) => free(q) && q.activity && ['stroll', 'socialise', 'idle', 'home', 'rest', 'wait-work', 'play', 'pastime-none'].includes(q.activity.act) && (kind === 'skim' ? q.age >= 6 && q.age <= 14 : kind === 'wash' ? q.sex === 'f' && q.age >= 15 && q.age <= 65 : q.age >= 10) && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 520;
      const cand = s.people.filter(want); if (!cand.length) return; const q = pick(cand);
            let best = null, bd = 1e9; for (const b of B) { if (taken(b)) continue; const d = Math.hypot(b.tx * T + 8 - q.agent.x, b.ty * T + 8 - q.agent.y) + Math.random() * 60; if (d < bd) { bd = d; best = b; } }
      if (best && bd < 700) begin(s, q, best, kind);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000;
      for (const c of linen) { if (c.s !== s) continue; const x = Math.round(c.x - cam.x), y = Math.round(c.y - cam.y); ctx.globalAlpha = c.fade ? Math.max(0, 1 - c.fade / 1.5) : 1; ctx.fillStyle = '#ecebe2'; ctx.fillRect(x - (c.w >> 1), y - (c.h >> 1), c.w, c.h); ctx.fillStyle = '#d4d2c6'; ctx.fillRect(x - (c.w >> 1), y + (c.h >> 1) - 1, c.w, 1); ctx.globalAlpha = 1; }
      ctx.strokeStyle = 'rgba(230,240,255,0.7)'; ctx.lineWidth = 1;
      for (const r of rings) { const k = r.t / 1.4, x = Math.round(r.x - cam.x), y = Math.round(r.y - cam.y); ctx.globalAlpha = 0.8 * (1 - k); ctx.beginPath(); ctx.ellipse(x, y, r.r * (0.4 + k), r.r * (0.4 + k) * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (const j of jobs) {
        if (j.s !== s) continue; const a = j.q.agent, x = Math.round(j.x - cam.x), y = Math.round(j.y - cam.y);
        if (j.kind === 'angle') {
          const bob = j.bite > 0 ? (Math.sin(tk * 18) > 0 ? 2 : 0) : Math.round(Math.sin(tk * 2 + j.x) * 0.6), fx = Math.round(j.fx - cam.x), fy = Math.round(j.fy - cam.y) + bob;
          const hx = x + j.dx * 6 + (j.dy ? 4 : 0), hy = y - 16 + (j.dy < 0 ? -2 : 0), tipX = x + j.dx * 20 + (j.dy ? 8 : 0), tipY = y - 28 + j.dy * 6 - (j.strike > 0 ? 6 : 0);
          ctx.strokeStyle = '#6a4a2c'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tipX, tipY); ctx.stroke();
          ctx.strokeStyle = 'rgba(240,240,230,0.55)'; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.quadraticCurveTo((tipX + fx) / 2, Math.max(tipY, fy) + (j.strike > 0 ? -4 : 6), fx, fy); ctx.stroke();
          if (!(j.bite > 0 && Math.sin(tk * 18) > 0.6)) { ctx.fillStyle = '#d03030'; ctx.fillRect(fx - 1, fy - 2, 2, 2); ctx.fillStyle = '#f4f0e0'; ctx.fillRect(fx - 1, fy, 2, 1); }
          ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - j.dy * 10 - j.dx * 8 - 3, y - 4, 7, 5); ctx.fillStyle = '#5a4028'; ctx.fillRect(x - j.dy * 10 - j.dx * 8 - 3, y - 4, 7, 1);
        } else if (j.kind === 'wash') {
          const bx = x - j.dy * 12 - j.dx * 10, by = y - 2; ctx.fillStyle = '#9a7a4a'; ctx.fillRect(bx - 5, by - 6, 10, 7); ctx.fillStyle = '#b8945a'; ctx.fillRect(bx - 5, by - 6, 10, 1); ctx.fillStyle = '#e8e6dc'; ctx.fillRect(bx - 3, by - 8, 6, 2);
          const sx = x + j.dx * 12, sy = y + j.dy * 8 - 2; ctx.fillStyle = '#8a8680'; ctx.fillRect(sx - 5, sy - 1, 10, 4); ctx.fillStyle = '#a8a49c'; ctx.fillRect(sx - 5, sy - 1, 10, 1);
          if (a.forceAnim === 'scrub' || a.forceAnim === 'hammer') { ctx.fillStyle = '#e4e2d8'; ctx.fillRect(sx - 4 + Math.round(Math.sin(tk * 6) * 2), sy - 2, 7, 3); }
          if (a.forceAnim === 'hammer') { const up = Math.floor(tk * 6) % 2; ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x + j.dx * 6 + 3, y - 14 + (up ? -4 : 2), 2, 9); ctx.fillRect(x + j.dx * 6 + 2, y - 6 + (up ? -4 : 2), 4, 3); }
        } else if (j.stone) {
          const st = j.stone; if (st.t < 0.28 * (st.k + 1) && st.k < st.hops) { const d = 20 + st.k * 16 - st.k * st.k, f = (st.t % 0.28) / 0.28; const sx = Math.round(j.x + j.dx * (14 + d * st.k * 0.6 + f * 10) - cam.x), sy = Math.round(j.y + j.dy * (12 + d * st.k * 0.5 + f * 8) - cam.y - Math.sin(f * Math.PI) * 5); ctx.fillStyle = '#5a5650'; ctx.fillRect(sx, sy, 2, 2); }
        }
      }
      for (const f of fishes) { if (f.t > f.fly + 2.5) continue; const x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y), flap = f.t > f.fly && f.t < f.fly + 1.4 && Math.floor(f.t * 10) % 2; ctx.fillStyle = '#c8d4dc'; ctx.fillRect(x - (f.big ? 4 : 3), y - (flap ? 2 : 1), f.big ? 8 : 6, 2); ctx.fillStyle = '#8a9aa8'; ctx.fillRect(x + (f.big ? 4 : 3), y - 2, 2, 3); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const j = jobs.find((o) => o.q === q); if (!j) return '';
      if (j.kind === 'angle') return `You are sitting on the bank fishing with a rod and line${j.caught ? `; you have caught ${j.caught} so far` : ', and nothing biting yet'}. Keep your voice down or you'll scare them off.`;
      if (j.kind === 'wash') return 'You are kneeling at the water\'s edge doing the washing, beating the linen on a stone and spreading it on the grass to bleach. Your hands are cold and red.';
      return `You are skimming stones on the water${j.best ? `; your best is ${j.best} hops` : ''}.`;
    });
    O.Riverbank = { jobs, linen, banks: () => banks(cur()), start: (kind) => { const s = cur(); const B = banks(s); const q = s.people.find((x) => free(x) && (kind === 'skim' ? x.age >= 6 && x.age <= 14 : kind === 'wash' ? x.sex === 'f' && x.age >= 15 : x.age >= 16)); if (!q || !B.length) return null; let best = null, bd = 1e9; for (const b of B) { if (taken(b)) continue; const d = Math.hypot(b.tx * T - q.agent.x, b.ty * T - q.agent.y); if (d < bd) { bd = d; best = b; } } if (!best) return null; begin(s, q, best, kind); return q.name; } };
  }
  O.RiverbankSetup = { setup };
})();
