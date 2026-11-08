// The town's small creatures. Pigeons strut and peck about the square and burst up in a clatter of
// wings when someone runs through them (or you do), wheel round, and settle again. Cats doze on
// doorsteps, wash, stretch, wander from step to step, and bolt when a child comes running (children
// will chase them). Hens scratch about the cottage yards and scatter squawking from anyone in a hurry.
// After rain, puddles stand in the ruts, and children stamp in them.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const ok = (x, y) => !game.solidAt(x, y - 1);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function life(s) {
      const w = s.world; if (w._critters) return w._critters; const r = O.RNG(O.hash('critters', s.world.placeId || 'home')); const out = { birds: [], cats: [], hens: [], puddles: [] };
      if (s.Z && s.Z.square) { const [x0, y0, x1, y1] = s.Z.square; const n = 8 + r.int(0, 6); for (let i = 0; i < n; i++) { const x = (x0 + r.next() * (x1 - x0)) * T, y = (y0 + r.next() * (y1 - y0)) * T + 8; if (ok(x, y)) out.birds.push({ x, y, hx: x, hy: y, z: 0, vx: 0, vy: 0, vz: 0, st: 'ground', t: r.next() * 5, c: r.pick(['#8a8a96', '#6e6e7a', '#9a9aa6', '#5a5a64', '#d8d8dc']), dir: r.chance(0.5) ? 1 : -1 }); } }
      const houses = w.buildings.filter((b) => b.type === 'house' && b.doorX != null);
      for (let i = 0; i < Math.min(5, houses.length); i++) { const b = houses[r.int(0, houses.length - 1)]; const x = (b.doorX + (r.chance(0.5) ? 1 : -1)) * T + 8, y = (b.doorY + 1) * T + 6; if (ok(x, y) && !out.cats.some((c) => Math.hypot(c.x - x, c.y - y) < 30)) out.cats.push({ x, y, home: [x, y], st: 'doze', t: r.next() * 10, seed: r.int(1, 9999), dir: r.chance(0.5) ? 1 : 2, ft: 0 }); }
      const yards = w.buildings.filter((b) => (b.type === 'farmhouse' || (b.type === 'house' && b.wealth < 0.5)) && b.doorX != null).slice(0, 4);
      for (const b of yards) { const n = 2 + r.int(0, 3); for (let i = 0; i < n; i++) { const x = (b.doorX + r.int(-2, 2)) * T + 8, y = (b.doorY + 1 + r.int(0, 1)) * T + 8; if (ok(x, y)) out.hens.push({ x, y, home: [x, y], tx: x, ty: y, seed: r.int(1, 9999), dir: 1, ft: r.next() * 3, moving: false, flap: 0 }); } }
      return (w._critters = out);
    }
    const movers = (s) => { const out = []; for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null) continue; const fast = a.anim === 'run' || a.forceAnim === 'run' || a.sprint; out.push([a.x, a.y, fast, q.age < 13, q]); } const P = game.player; out.push([P.x, P.y, !!P.running || P.anim === 'run', false, null]); return out; };
    let ft = 0, rainWas = false;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const L = life(s); ft += dt;
      const P = game.player; if (!near(P.x, P.y, 2000)) return;
      const M = movers(s).filter((m) => near(m[0], m[1], 520));
      // pigeons
      for (const b of L.birds) { b.t += dt;
        if (b.st === 'ground') { const scare = M.find((m) => { const d = Math.hypot(m[0] - b.x, m[1] - b.y); return d < (m[2] ? 30 : 13); }); if (scare) { b.st = 'fly'; b.vx = (b.x - scare[0]) * 2 + (Math.random() - 0.5) * 60; b.vy = (b.y - scare[1]) * 1.2 + (Math.random() - 0.5) * 30; b.vz = 55 + Math.random() * 30; b.air = 2 + Math.random() * 2.5; if (near(b.x, b.y, 200) && Math.random() < 0.3) O.sfx && O.sfx('whoosh', 0.12); for (const o of L.birds) if (o !== b && o.st === 'ground' && Math.hypot(o.x - b.x, o.y - b.y) < 40 && Math.random() < 0.7) { o.st = 'fly'; o.vx = (o.x - scare[0]) * 2 + (Math.random() - 0.5) * 60; o.vy = (o.y - scare[1]) + (Math.random() - 0.5) * 30; o.vz = 50 + Math.random() * 30; o.air = 2 + Math.random() * 3; } continue; }
          if (Math.random() < dt * 0.6) { const nx = b.x + (Math.random() - 0.5) * 8, ny = b.y + (Math.random() - 0.5) * 5; if (ok(nx, ny) && Math.hypot(nx - b.hx, ny - b.hy) < 50) { b.dir = nx > b.x ? 1 : -1; b.x = nx; b.y = ny; } } }
        else { b.air -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z = Math.max(0, b.z + b.vz * dt); b.vz -= 25 * dt; b.vx *= 1 - dt * 0.6; b.vy *= 1 - dt * 0.6; if (b.air < 0) { const dx = b.hx + (Math.random() - 0.5) * 30 - b.x, dy = b.hy + (Math.random() - 0.5) * 20 - b.y; b.vx += dx * dt * 2; b.vy += dy * dt * 2; if (b.vz < -20) b.vz = -20; if (b.z <= 0.5 && Math.hypot(dx, dy) < 30 && ok(b.x, b.y)) { b.st = 'ground'; b.z = 0; } if (b.air < -8) { b.x = b.hx; b.y = b.hy; b.z = 0; b.st = 'ground'; } } } }
      // cats
      for (const c of L.cats) { c.t += dt; c.ft += dt;
        const kid = M.find((m) => m[3] && m[2] && Math.hypot(m[0] - c.x, m[1] - c.y) < 50);
        if (kid && c.st !== 'flee') { c.st = 'flee'; c.from = kid; c.t = 0; if (kid[4] && Math.random() < 0.4) { kid[4]._chaseCat = c; O.Speech && O.Speech.say(kid[4], pick(['Here, puss!', 'Come back, kitty!', 'Got you! ...no.']), 1.4); } }
        if (c.st === 'flee') { const dx = c.x - c.from[0], dy = c.y - c.from[1], d = Math.hypot(dx, dy) || 1; const nx = c.x + dx / d * 95 * dt, ny = c.y + dy / d * 70 * dt; if (ok(nx, ny)) { c.x = nx; c.y = ny; } else if (ok(nx, c.y)) c.x = nx; else if (ok(c.x, ny)) c.y = ny; c.dir = dx > 0 ? 2 : 1; c.moving = true; if (c.t > 2.2) { c.st = 'walk'; c.t = 0; c.to = c.home; } continue; }
        if (c.st === 'walk') { const dx = c.to[0] - c.x, dy = c.to[1] - c.y, d = Math.hypot(dx, dy); if (d < 2 || c.t > 20) { c.st = 'doze'; c.t = 0; c.moving = false; c.x = d < 40 ? c.to[0] : c.x; c.y = d < 40 ? c.to[1] : c.y; } else { const nx = c.x + dx / d * 18 * dt, ny = c.y + dy / d * 18 * dt; if (ok(nx, ny)) { c.x = nx; c.y = ny; } else { c.x = c.to[0]; c.y = c.to[1]; } c.dir = dx > 0 ? 2 : 1; c.moving = true; } continue; }
        c.moving = false; if (c.t > 20 + (c.seed % 15) && Math.random() < dt * 0.05) { const o = pick(L.cats); c.st = 'walk'; c.t = 0; c.to = Math.random() < 0.5 && o ? [o.home[0] + 12, o.home[1]] : c.home; } }
      // a dog spots a cat
      if (Math.random() < dt * 0.15) { const id = s.world.placeId; for (const c of L.cats) { if (c.st === 'flee') continue; const dog = (O.fauna || []).find((f) => f.kind === 'dog' && f.world === id && !f.dead && !f.mine && Math.hypot(f.x - c.x, f.y - c.y) < 90); if (dog) { c.st = 'flee'; c.from = [dog.x, dog.y]; c.t = 0; dog.tx = c.x; dog.ty = c.y; dog._chaseCat = 1.5; if (Math.hypot(c.x - P.x, c.y - P.y) < 250) { O.animalCall && O.animalCall('dog', 0.35); setTimeout(() => O.animalCall && O.animalCall('cat', 0.3), 400); } break; } } }
      for (const f of O.fauna || []) if (f._chaseCat > 0) { f._chaseCat -= dt; const c = L.cats.find((k) => k.st === 'flee'); if (c) { const dx = c.x - f.x, dy = c.y - f.y, d = Math.hypot(dx, dy) || 1; f.x += dx / d * 70 * dt; f.y += dy / d * 50 * dt; f.dir = dx > 0 ? 2 : 1; f.moving = true; } }
      // hens
      for (const h of L.hens) { h.ft += dt; const scare = M.find((m) => Math.hypot(m[0] - h.x, m[1] - h.y) < (m[2] ? 36 : 14));
        if (scare) { h.flap = 0.8; const dx = h.x - scare[0], dy = h.y - scare[1], d = Math.hypot(dx, dy) || 1; h.tx = h.x + dx / d * 30; h.ty = h.y + dy / d * 18; if (Math.random() < dt * 3 && near(h.x, h.y, 180)) O.animalCall && O.animalCall('chicken', 0.3); }
        h.flap = Math.max(0, h.flap - dt); const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy);
        if (d > 1.5) { const sp = h.flap > 0 ? 70 : 14, nx = h.x + dx / d * sp * dt, ny = h.y + dy / d * sp * dt; if (ok(nx, ny)) { h.x = nx; h.y = ny; } else { h.tx = h.x; h.ty = h.y; } h.dir = dx > 0 ? 2 : 1; h.moving = true; }
        else { h.moving = false; if (Math.random() < dt * 0.3) { h.tx = h.home[0] + (Math.random() - 0.5) * 40; h.ty = h.home[1] + (Math.random() - 0.5) * 20; } } }
      // puddles: after rain they stand a while; children stamp in them
      const raining = !!s.raining || (s.weather && /rain|storm/.test(s.weather.kind || ''));
      if (raining && L.puddles.length < 10 && Math.random() < dt * 0.5) { const x = P.x + (Math.random() - 0.5) * 500, y = P.y + (Math.random() - 0.5) * 340; if (ok(x, y) && ok(x + 10, y)) L.puddles.push({ x, y, r: 5 + Math.random() * 6, life: 1 }); }
      if (!raining) for (const pd of L.puddles.slice()) { pd.life -= dt / 240; if (pd.life <= 0) L.puddles.splice(L.puddles.indexOf(pd), 1); }
      if (rainWas && !raining) for (const q of s.people) { if (q.age >= 4 && q.age < 11 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && L.puddles.length && Math.random() < 0.3) { const pd = pick(L.puddles); if (Math.hypot(pd.x - q.agent.x, pd.y - q.agent.y) < 200 && O.Errands) O.Errands.send(s, q, [Math.floor(pd.x / T), Math.floor(pd.y / T)], { anim: 'celebrate', secs: 4, face: 0, giveUp: game.t + 40, at: () => { pd.splash = 1; O.Speech && O.Speech.say(q, pick(['SPLASH!', 'Ha! Look at me!', 'Mam\'ll kill me...']), 1.6); } }); } }
      rainWas = raining;
      for (const pd of L.puddles) if (pd.splash) pd.splash = Math.max(0, pd.splash - dt * 0.5);
    });
    game.hooks.drawGround.push((ctx, cam) => {
      const s = cur(); if (!s || !s.world || !s.world._critters || game.scene) return; const L = s.world._critters;
      for (const pd of L.puddles) { const x = Math.round(pd.x - cam.x), y = Math.round(pd.y - cam.y); ctx.globalAlpha = 0.5 * Math.min(1, pd.life * 3); ctx.fillStyle = '#5a6a7a'; ctx.beginPath(); ctx.ellipse(x, y, pd.r, pd.r * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#a8b8c8'; ctx.fillRect(x - Math.round(pd.r / 2), y - 1, Math.round(pd.r / 2), 1); if (pd.splash) { ctx.fillStyle = '#c8d8e8'; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, rr = (1 - pd.splash) * 10 + 3; ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.5 - pd.splash * 4), 1, 1); } } ctx.globalAlpha = 1; }
      for (const b of L.birds) { if (b.st !== 'ground') continue; const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y); if (x < -5 || y < -5 || x > ctx.canvas.width + 5 || y > ctx.canvas.height + 5) continue; const peck = Math.floor(b.t * 3 + b.hx) % 4 === 0; ctx.fillStyle = b.c; ctx.fillRect(x - 2, y - 3, 4, 2); ctx.fillRect(x + (b.dir > 0 ? 1 : -2), y - (peck ? 2 : 4), 2, 2); ctx.fillStyle = '#c86a5a'; ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); ctx.fillStyle = '#5a8a7a'; ctx.fillRect(x + (b.dir > 0 ? 1 : -1), y - 3, 1, 1); }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || !s.world || !s.world._critters || game.scene) return; const L = s.world._critters; ctx.save();
      for (const b of L.birds) { if (b.st === 'ground') continue; const x = Math.round(b.x - cam.x), y = Math.round(b.y - b.z - cam.y), f = Math.floor(b.t * 14) % 2; ctx.fillStyle = b.c; ctx.fillRect(x - 1, y, 3, 2); ctx.fillRect(x - 3, y - (f ? 2 : 0), 2, 1); ctx.fillRect(x + 2, y - (f ? 2 : 0), 2, 1); }
      const draw = (kind, a) => { const x = a.x - cam.x, y = a.y - cam.y; if (x < -20 || y < -20 || x > ctx.canvas.width + 20 || y > ctx.canvas.height + 20) return; const an = a.moving ? 'walk' : kind === 'cat' && a.st === 'doze' ? 'idle' : 'graze', H = O.Animals.HANIMS[an]; try { const fr = O.Animals.animal(kind, a.seed, a.dir, !!a.moving, Math.floor((a.ft || a.t || 0) * H.fps) % H.frames, an); ctx.drawImage(fr, Math.round(x - (fr.ox ?? fr.width / 2)), Math.round(y - (fr.gy ?? fr.height))); } catch (e) { /* */ } };
      for (const c of L.cats) draw('cat', c); for (const h of L.hens) draw('chicken', h);
      ctx.restore();
    });
    O.TownBirds = { life: () => life(cur()) };
  }
  O.TownBirdsSetup = { setup };
})();
