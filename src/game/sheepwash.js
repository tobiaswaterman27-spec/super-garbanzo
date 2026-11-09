// Sheep-washing. In late spring, before the shearing, the flock is driven down to the river; two men
// stand in the water up to their waists and the sheep are pushed in one at a time from the bank, ducked
// right under, scrubbed and let go to scramble out, shake themselves and stand dripping, while the rest
// bleat on the bank waiting their turn.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let J = null, cool = 20, washed = 0; const splash = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._bank && !q._wash && !talking(q) && !q.agent.mount;
    function end() { if (!J) return; for (const q of J.men) { const a = q.agent; if (!a) continue; a.forceAnim = null; if (J.home.has(q)) { a.x = J.home.get(q)[0]; a.y = J.home.get(q)[1]; } if (!talking(q)) a.frozen = false; q._wash = false; } J = null; }
    game.hooks.update.push((dt) => {
      for (const p of splash.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; if (p.t > 0.5) splash.splice(splash.indexOf(p), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (J) { J.t += dt; if (J.s !== s || J.t > 120 || s.raining || J.men.some(talking) || (J.men.length >= 2 && !J.sheep.length && !J.cur)) { if (J.men.length >= 2 && !J.sheep.length && near(J.x, J.y, 300)) O.Speech && O.Speech.say(J.men[0], 'That\'s the lot. Clean as a christening.', 2.4); end(); return; }
        if (J.men.length < 2) return;
        // in the water, either side of the dunking place
        J.men.forEach((q, i) => { const a = q.agent; a.x = J.wx + (i ? 10 : -10) * (J.dy ? 1 : 0) + (J.dx ? J.dx * 4 : 0); a.y = J.wy + (J.dx ? (i ? 6 : -6) : 0); a.dir = J.dy ? (J.dy > 0 ? 3 : 0) : (i ? 1 : 2); a.forceAnim = J.cur && J.cur.ph === 'dunk' ? 'scrub' : 'idle'; });
        if (!J.cur && J.sheep.length) { J.cur = J.sheep.shift(); J.cur.ph = 'in'; J.cur.t = 0; }
        if (J.cur) { const c = J.cur; c.t += dt; c.ft += dt;
          if (c.ph === 'in') { c.x += (J.wx - c.x) * Math.min(1, dt * 3); c.y += (J.wy - c.y) * Math.min(1, dt * 3); if (c.t > 1.2) { c.ph = 'dunk'; c.t = 0; } }
          else if (c.ph === 'dunk') { c.z = Math.sin(c.t * 4) > 0.3 ? 6 : 0; if (Math.random() < dt * 8) splash.push({ x: J.wx + (Math.random() - 0.5) * 12, y: J.wy - 2, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 30, t: 0 }); if (Math.random() < dt * 2 && near(J.wx, J.wy, 260)) O.sfx && O.sfx('splash', 0.2); if (c.t > 4) { c.ph = 'out'; c.t = 0; c.z = 0; washed++; if (Math.random() < 0.4 && near(J.wx, J.wy, 260)) O.animalCall && O.animalCall('sheep', 0.35); } }
          else { c.x += (J.ox - c.x) * Math.min(1, dt * 1.5); c.y += (J.oy - c.y) * Math.min(1, dt * 1.5); if (c.t > 2) { J.done.push(c); J.cur = null; } } }
        for (const sh of J.sheep) sh.ft += dt; for (const sh of J.done) sh.ft += dt;
        if (!J.said && J.t > 10) { J.said = true; near(J.x, J.y, 260) && O.Speech && O.Speech.say(J.men[1], pick(['Hold her! Hold her!', 'In you go, my beauty.', 'Cold enough to stop your heart, this.']), 2.4); }
        return; }
      cool -= dt; if (cool > 0) return; cool = 50 + Math.random() * 40;
      if (s.season !== 'spring' || hr < 9 || hr > 16 || s.raining || !O.Riverbank) return;
      const P = game.player, W0 = s.world, B = O.Riverbank.banks().filter((b) => Math.hypot(b.tx * T - P.x, b.ty * T - P.y) < 420 && [W0.TER.GRASS, W0.TER.SAND].includes(W0.ter[b.ty * W0.W + b.tx])); if (!B.length) return; const b = pick(B);
      const men = s.people.filter((q) => free(q) && q.sex === 'm' && q.age >= 16 && q.age < 55 && ((!q.agent.hidden && q.agent.inside == null) || q.agent.inside === q.home) && (/shepherd|farm|herd|labour/.test(q.job?.role || '') || ['stroll', 'idle', 'home', 'labour', 'fieldwork'].includes(q.activity?.act)) && Math.hypot(q.agent.x - b.tx * T, q.agent.y - b.ty * T) < 700).slice(0, 2); if (men.length < 2) return;
      const DV = [[0, 1], [-1, 0], [1, 0], [0, -1]], [dx, dy] = DV[b.d], x = b.tx * T + 8, y = b.ty * T + 10;
      J = { s, men: [], home: new Map(), t: 0, x, y, dx, dy, wx: x + dx * 22, wy: y + dy * 18, ox: x - dx * 30 + (dy ? 30 : 0), oy: y - dy * 26 + (dx ? 20 : 0), sheep: [], done: [], cur: null };
      for (let i = 0; i < 5; i++) J.sheep.push({ x: x - dx * 20 + (dy ? (i - 2) * 12 : 0), y: y - dy * 16 + (dx ? (i - 2) * 8 : 0) - (i % 2) * 4, seed: O.hash('washsheep', i, s.day) % 1000, ft: Math.random() * 3, z: 0, dir: dx > 0 ? 2 : 1 });
      men.forEach((q) => { q._wash = true; O.Errands.send(s, q, [b.tx, b.ty], { anim: 'idle', secs: 0.2, face: b.d, giveUp: game.t + 50, after: (ok) => { if (!ok || !q.agent || !J) { q._wash = false; return; } J.home.set(q, [q.agent.x, q.agent.y]); q.agent.frozen = true; q.agent.path = null; J.men.push(q); } }); });
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!J || game.scene || J.s !== s) return;
      const draw = (sh, wet) => { try { const an = sh === J.cur && sh.ph !== 'dunk' ? 'walk' : 'graze', HA = O.Animals.HANIMS[an], fr = O.Animals.animal('sheep', sh.seed, sh.dir, an === 'walk', Math.floor(sh.ft * HA.fps) % HA.frames, an); const x = Math.round(sh.x - (fr.ox ?? fr.width / 2) - cam.x), y = Math.round(sh.y - (fr.gy ?? fr.height) - cam.y) + (sh.z || 0); if (sh.z) { ctx.save(); ctx.beginPath(); ctx.rect(x - 4, 0, fr.width + 8, Math.round(sh.y - cam.y) - 2); ctx.clip(); ctx.drawImage(fr, x, y); ctx.restore(); } else ctx.drawImage(fr, x, y); if (wet) { ctx.fillStyle = 'rgba(200,220,240,0.7)'; ctx.fillRect(Math.round(sh.x - cam.x) - 3, Math.round(sh.y - cam.y) + 1, 1, 2); } } catch (e) { /* */ } };
      for (const sh of J.sheep) draw(sh, false); for (const sh of J.done) draw(sh, true); if (J.cur) draw(J.cur, J.cur.ph !== 'in');
      if (J.men.length >= 2) { ctx.strokeStyle = 'rgba(220,235,250,0.6)'; ctx.lineWidth = 1; for (const q of J.men) { const a = q.agent; ctx.beginPath(); ctx.ellipse(Math.round(a.x - cam.x), Math.round(a.y - 6 - cam.y), 7, 2, 0, 0, Math.PI * 2); ctx.stroke(); } }
      ctx.fillStyle = 'rgba(210,228,245,0.85)'; for (const p of splash) ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 1, 1);
    });
    (O.extraLines = O.extraLines || []).push((s, q) => J && J.men.includes(q) ? 'You are standing waist-deep in the cold river washing the sheep one by one before the shearing.' : '');
    O.SheepWash = { get job() { return J; }, get washed() { return washed; }, soon: () => { cool = 0; } };
  }
  O.SheepWashSetup = { setup };
})();
