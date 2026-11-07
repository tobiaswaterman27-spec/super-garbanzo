// Children playing, really playing: not a line of text but a game you can stand and watch. When there
// are children about with nothing to do, they get up a game near where they are:
// - football with a pig's-bladder ball: they run to it, kick it, it bounces and rolls, they shout;
// - skipping: two turn the rope (you see it swing), one jumps it, counting, till they trip;
// - hopscotch: a grid scratched in the dirt, a stone thrown, a child hopping up and back;
// - hoop and stick: a child bowling a hoop down the street, running after it;
// - tag: whoever's "it" chases, the others scatter, a touch and it's someone else;
// - leapfrog: a line of bent backs and the last one vaulting over each in turn;
// - hide and seek: one counts with their face to a wall, the others run and hide behind the houses, and
//   the seeker goes looking and finds them one by one.
// Their parents call them in at dusk; a game ends when they tire of it.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const sp = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.6);
    const games = [];
    const free = (q) => q && q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand && !q._scene && !q._playing && q.age >= 4 && q.age <= 13 && q.alive !== false && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) && (!q.activity || ['play', 'stroll', 'socialise', 'idle', 'home', 'rest'].includes(q.activity.act));
    const open = (x, y) => !game.solidAt(x - 4, y - 3) && !game.solidAt(x + 3, y - 3) && !game.solidAt(x - 4, y) && !game.solidAt(x + 3, y);
    function spot(x, y, w, h) { // somewhere clear enough to play: the square if it's near, else open ground close by
      const s = cur(), z = s && s.world.zones && s.world.zones.square;
      if (z) { const sx0 = z[0] * T, sy0 = z[1] * T, sx1 = (z[2] + 1) * T, sy1 = (z[3] + 1) * T; if (Math.hypot((sx0 + sx1) / 2 - x, (sy0 + sy1) / 2 - y) < 420) for (let k = 0; k < 30; k++) { const cx = sx0 + w / 2 + 8 + Math.random() * Math.max(1, sx1 - sx0 - w - 16), cy = sy0 + h / 2 + 8 + Math.random() * Math.max(1, sy1 - sy0 - h - 16); let ok = true; for (let dx = -w / 2; dx <= w / 2 && ok; dx += 8) for (let dy = -h / 2 - 20; dy <= h / 2 + 10 && ok; dy += 8) if (!open(cx + dx, cy + dy)) ok = false; if (ok && !games.some((g) => Math.hypot(g.cx - cx, g.cy - cy) < 90)) return [cx, cy]; } }
      for (let r = 0; r < 120; r += 12) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r; let ok = true; for (let dx = -w / 2 - 8; dx <= w / 2 + 8 && ok; dx += 8) for (let dy = -h / 2 - 20; dy <= h / 2 + 10 && ok; dy += 8) if (!open(cx + dx, cy + dy)) ok = false; if (ok && !games.some((g) => Math.hypot(g.cx - cx, g.cy - cy) < 90)) return [cx, cy]; }
      return null;
    }
    // move a child toward a point, at a child's run
    function steer(q, tx, ty, dt, speed = 70) { const a = q.agent, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 2) { if (a.anim === 'run' || a.anim === 'walk') a.anim = 'idle'; return true; } const st = Math.min(d, speed * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; if (open(nx, ny)) { a.x = nx; a.y = ny; } else if (open(nx, a.y)) a.x = nx; else if (open(a.x, ny)) a.y = ny; a.anim = speed > 50 ? 'run' : 'walk'; a.dir = O.dirOf(dx, dy); return false; }
    const take = (kids) => { for (const q of kids) { q._playing = true; q.agent.frozen = true; q.agent.path = null; q.agent.goal = null; q.agent.lift = 0; } };
    const release = (g) => { for (const q of g.kids) { q._playing = false; q.agent.frozen = false; q.agent.lift = 0; q.agent.hidden = false; q.agent.anim = 'idle'; q.agent.carrying = null; } };

    const KINDS = {
      football: { n: [3, 6], w: 90, h: 50, init(g) { g.ball = { x: g.cx, y: g.cy, vx: 0, vy: 0, z: 0, vz: 0 }; },
        update(g, dt) { const b = g.ball; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 1 - dt * 1.3; b.vy *= 1 - dt * 1.3; b.vz -= 260 * dt; b.z = Math.max(0, b.z + b.vz * dt); if (b.z === 0 && b.vz < 0) b.vz = -b.vz * 0.45; if (!open(b.x, b.y)) { b.vx = -b.vx * 0.6; b.vy = -b.vy * 0.6; b.x += b.vx * dt * 2; b.y += b.vy * dt * 2; }
          if (Math.hypot(b.x - g.cx, b.y - g.cy) > 110) { b.vx += (g.cx - b.x) * dt * 0.8; b.vy += (g.cy - b.y) * dt * 0.8; }
          g.kids.forEach((q, i) => { const chaser = i === g.near || i === (g.near + 1) % g.kids.length; const tx = chaser ? b.x - 6 : g.cx + Math.cos(i * 2.1 + g.t * 0.3) * 40, ty = chaser ? b.y : g.cy + Math.sin(i * 2.1 + g.t * 0.3) * 22; steer(q, tx, ty, dt, chaser ? 80 : 40);
            if (Math.hypot(q.agent.x - b.x, q.agent.y - b.y) < 9 && b.z < 6 && g.t - (g.kick || 0) > 0.5) { g.kick = g.t; const tgt = g.kids[(i + 1 + Math.floor(Math.random() * (g.kids.length - 1))) % g.kids.length]; const dx = tgt.agent.x - b.x, dy = tgt.agent.y - b.y, d = Math.hypot(dx, dy) || 1; b.vx = dx / d * (90 + Math.random() * 70); b.vy = dy / d * (60 + Math.random() * 50); b.vz = 40 + Math.random() * 80; O.gesture && O.gesture(q, 'attack', 0.35); O.sfx && O.sfx('smack', 0.15); if (Math.random() < 0.15) sp(q, pick(['To me!', 'Mine!', 'Kick it!', 'Goal!', 'Ow, my toe!'])); } });
          g.near = g.kids.map((q, i) => [i, Math.hypot(q.agent.x - b.x, q.agent.y - b.y)]).sort((a, c) => a[1] - c[1])[0][0]; },
        draw(g, ctx, cam) { const b = g.ball, x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y); ctx.fillStyle = 'rgba(28,20,44,0.3)'; ctx.fillRect(x - 2, y, 5, 2); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 4, y - 6 - Math.round(b.z), 8, 6); ctx.fillStyle = '#e0d0a8'; ctx.fillRect(x - 3, y - 5 - Math.round(b.z), 6, 4); ctx.fillStyle = '#b09878'; ctx.fillRect(x - 1, y - 3 - Math.round(b.z), 3, 1); } },
      skipping: { n: [3, 4], w: 60, h: 20, init(g) { g.count = 0; g.jumper = 2; },
        update(g, dt) { const [a, b] = g.kids; steer(a, g.cx - 22, g.cy, dt, 40); steer(b, g.cx + 22, g.cy, dt, 40); a.agent.dir = 2; b.agent.dir = 1; a.agent.anim = 'idle'; b.agent.anim = 'idle';
          g.ang = (g.ang || 0) + dt * 6.5; const j = g.kids[g.jumper] || g.kids[2]; for (let i = 2; i < g.kids.length; i++) { const q = g.kids[i]; if (q !== j) { steer(q, g.cx + (i - 2) * 10, g.cy + 14, dt, 40); q.agent.dir = 3; } }
          if (j) { steer(j, g.cx, g.cy, dt, 40); const ph = Math.sin(g.ang), low = Math.cos(g.ang) > 0.85; j.agent.lift = Math.max(0, -Math.sin(g.ang * 1) * 7) ; j.agent.anim = 'idle'; j.agent.dir = 0;
            if (Math.floor(g.ang / (Math.PI * 2)) > g.count) { g.count++; if (g.count % 3 === 0) sp(j, String(g.count), 0.9); if (Math.random() < 0.06) { sp(j, pick(['Oh! Caught my foot!', 'Not fair, you turned it fast!']), 1.5); g.count = 0; j.agent.lift = 0; g.jumper = 2 + ((g.jumper - 1) % Math.max(1, g.kids.length - 2)); } } void ph; void low; } },
        draw(g, ctx, cam) { const [a, b] = g.kids; const x0 = a.agent.x + 5, x1 = b.agent.x - 5, y = a.agent.y - 18; const sag = Math.sin(g.ang || 0) * 16; ctx.strokeStyle = '#6a4424'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Math.round(x0 - cam.x), Math.round(y - cam.y)); ctx.quadraticCurveTo(Math.round((x0 + x1) / 2 - cam.x), Math.round(y + sag + 8 - cam.y), Math.round(x1 - cam.x), Math.round(y - cam.y)); ctx.stroke(); } },
      hopscotch: { n: [2, 3], w: 30, h: 80, init(g) { g.turn = 0; g.step = 0; g.dirn = 1; },
        update(g, dt) { const q = g.kids[g.turn % g.kids.length]; g.kids.forEach((z, i) => { if (z !== q) { steer(z, g.cx + 18, g.cy + 28 + i * 6, dt, 40); z.agent.dir = 1; z.agent.anim = 'idle'; } });
          g.hop = (g.hop || 0) + dt; const sq = g.step, ty = g.cy + 30 - sq * 12; steer(q, g.cx + (sq === 3 || sq === 6 ? (sq % 2 ? -5 : 5) : 0), ty, dt, 90); q.agent.lift = Math.abs(Math.sin(g.hop * 7)) * 5; q.agent.dir = g.dirn > 0 ? 3 : 0;
          if (g.hop > 0.45) { g.hop = 0; g.step += g.dirn; if (g.step >= 6) g.dirn = -1; if (g.step < 0) { g.step = 0; g.dirn = 1; q.agent.lift = 0; g.turn++; if (Math.random() < 0.4) sp(q, pick(['My go!', 'Your turn.', 'Didn\'t touch the line!', 'You trod on it!'])); } } },
        drawGround(g, ctx, cam) { ctx.strokeStyle = 'rgba(240,232,210,0.85)'; ctx.lineWidth = 1.5; for (let k = 0; k < 7; k++) { const y = g.cy + 30 - k * 12 - 6, two = k === 3 || k === 6; if (two) { ctx.strokeRect(Math.round(g.cx - 11 - cam.x) + 0.5, Math.round(y - cam.y) + 0.5, 10, 11); ctx.strokeRect(Math.round(g.cx + 1 - cam.x) + 0.5, Math.round(y - cam.y) + 0.5, 10, 11); } else ctx.strokeRect(Math.round(g.cx - 5 - cam.x) + 0.5, Math.round(y - cam.y) + 0.5, 10, 11); } } },
      hoop: { n: [1, 2], w: 120, h: 20, init(g) { g.hx = g.cx - 50; g.dirn = 1; },
        update(g, dt) { g.hx += g.dirn * 55 * dt; if (!open(g.hx + g.dirn * 10, g.cy) || Math.abs(g.hx - g.cx) > 70) { g.dirn = -g.dirn; } g.kids.forEach((q, i) => { steer(q, g.hx - g.dirn * (10 + i * 12), g.cy + i * 6, dt, 70); if (Math.random() < dt * 0.6) O.gesture && O.gesture(q, 'attack', 0.3); }); g.roll = (g.roll || 0) + dt * 10; },
        draw(g, ctx, cam) { const x = Math.round(g.hx - cam.x), y = Math.round(g.cy - 6 - cam.y); ctx.strokeStyle = '#6a4424'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.5, 2.5, 7, 0, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#5a3d26'; ctx.fillRect(x + Math.round(Math.sin(g.roll) * 2), y - 5, 1, 1); } },
      tag: { n: [3, 6], w: 100, h: 60, init(g) { g.it = 0; g.since = 0; },
        update(g, dt) { g.since += dt; const it = g.kids[g.it]; const prey = g.kids.filter((q) => q !== it).sort((a, b) => Math.hypot(a.agent.x - it.agent.x, a.agent.y - it.agent.y) - Math.hypot(b.agent.x - it.agent.x, b.agent.y - it.agent.y));
          steer(it, prey[0].agent.x, prey[0].agent.y, dt, 78);
          for (const q of prey) { const dx = q.agent.x - it.agent.x, dy = q.agent.y - it.agent.y, d = Math.hypot(dx, dy) || 1; const tx = O.clamp(q.agent.x + dx / d * 40, g.cx - 60, g.cx + 60), ty = O.clamp(q.agent.y + dy / d * 30, g.cy - 35, g.cy + 35); steer(q, tx, ty, dt, d < 50 ? 74 : 30); }
          if (Math.hypot(prey[0].agent.x - it.agent.x, prey[0].agent.y - it.agent.y) < 8 && g.since > 1) { g.since = 0; O.gesture && O.gesture(it, 'point', 0.5); sp(it, pick(['Tag! You\'re it!', 'Got you!', 'It!'])); g.it = g.kids.indexOf(prey[0]); } } },
      leapfrog: { n: [3, 5], w: 100, h: 20, init(g) { g.leaper = g.kids.length - 1; g.t2 = 0; },
        update(g, dt) { const L = g.kids.length; g.t2 += dt; g.kids.forEach((q, i) => { if (i === g.leaper) return; steer(q, g.cx - 40 + i * 16, g.cy, dt, 50); q.agent.anim = 'crouch'; q.agent.dir = 2; });
          const q = g.kids[g.leaper], k = g.t2 / 0.6, over = Math.floor(k), ph = k - over; const order = g.kids.map((_, i) => i).filter((i) => i !== g.leaper);
          if (over >= order.length) { q.agent.lift = 0; g.leaper = (g.leaper + 1) % L; g.t2 = 0; return; }
          const from = g.cx - 40 + order[over] * 16 - 10, to = from + 16; q.agent.x = from + (to - from) * ph; q.agent.y = g.cy; q.agent.lift = Math.sin(ph * Math.PI) * 12; q.agent.anim = 'run'; q.agent.dir = 2;
          if (ph < 0.05 && Math.random() < 0.3) sp(q, pick(['Hup!', 'Over!', 'Keep your head down!']), 0.8); } },
      hideseek: { n: [3, 5], w: 40, h: 40, init(g) { g.phase = 'count'; g.t2 = 0; g.found = []; const s = cur(); g.spots = g.kids.slice(1).map(() => { const b = pick(s.world.buildings.filter((x) => x.doorX != null && Math.hypot(x.doorX * T - g.cx, x.doorY * T - g.cy) < 180)); return b ? [b.x * T - 6, b.bottom * T + 10] : [g.cx + 60, g.cy]; }); },
        update(g, dt) { g.t2 += dt; const seeker = g.kids[0], others = g.kids.slice(1);
          if (g.phase === 'count') { steer(seeker, g.cx, g.cy, dt, 40); seeker.agent.dir = 3; seeker.agent.anim = 'look'; if (Math.floor(g.t2) !== g.lastN && g.t2 < 9) { g.lastN = Math.floor(g.t2); if (g.lastN % 3 === 0) sp(seeker, `${(g.lastN + 1) * 5}...`, 0.9); } others.forEach((q, i) => { const [x, y] = g.spots[i]; if (steer(q, x, y, dt, 75)) { q.agent.anim = 'crouch'; q.agent.hidden = true; } }); if (g.t2 > 9) { g.phase = 'seek'; sp(seeker, 'Coming, ready or not!', 1.6); g.t2 = 0; } }
          else { const left = others.filter((q) => !g.found.includes(q)); if (!left.length) { g.over = true; return; } const q = left[0], [x, y] = g.spots[others.indexOf(q)]; if (steer(seeker, x + 8, y, dt, 55)) { q.agent.hidden = false; g.found.push(q); sp(seeker, `Found you, ${q.first}!`, 1.4); O.gesture && O.gesture(q, 'laugh', 1); } }
          if (g.phase === 'seek') for (const q of g.found) steer(q, g.cx + 10, g.cy + 10, dt, 40); } },
    };

    let next = 6;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      for (const g of games.slice()) {
        g.t += dt; let end = g.t > g.len || g.over || game.scene || s.minute / 60 >= 19.5 || g.kids.some((q) => !q.agent || q.alive === false || q._fighting);
        if (!end) { try { KINDS[g.kind].update(g, dt); } catch (e) { console.error(e); end = true; } }
        if (end) { release(g); games.splice(games.indexOf(g), 1); if (g.kids[0] && Math.random() < 0.5) sp(g.kids[0], pick(['I\'m tired.', 'Mam\'s calling.', 'Again tomorrow!', 'I won anyway.']), 1.4); }
      }
      next -= dt; if (next > 0) return; next = 10 + Math.random() * 10;
      if (game.scene || games.length >= 2) return; const h = s.minute / 60; if (h < 8 || h >= 19 || /rain|heavy|storm|snow|blizzard/.test(s.weather?.kind || '')) return;
      const P = game.player, kids = s.people.filter((q) => free(q) && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 380);
      if (kids.length < 1) return;
      // children near each other make a group
      const lead = pick(kids), group = kids.filter((q) => Math.hypot(q.agent.x - lead.agent.x, q.agent.y - lead.agent.y) < 160).slice(0, 6);
      const can = Object.entries(KINDS).filter(([, k]) => group.length >= k.n[0]); if (!can.length) return;
      const [kind, K] = pick(can), cast = group.slice(0, K.n[1]); const at = spot(lead.agent.x, lead.agent.y, K.w, K.h); if (!at) return;
      take(cast); const g = { kind, kids: cast, cx: at[0], cy: at[1], t: 0, len: 45 + Math.random() * 45 }; K.init(g); games.push(g);
      if (Math.random() < 0.6) sp(cast[0], { football: 'Who\'s got the ball?', skipping: 'You turn, I\'ll jump!', hopscotch: 'I\'ll draw the squares.', hoop: 'Watch my hoop go!', tag: 'Not it!', leapfrog: 'Leapfrog! Backs down!', hideseek: 'I\'ll seek! Go hide!' }[kind], 1.8);
    });
    game.hooks.drawGround.push((ctx, cam) => { if (game.scene) return; for (const g of games) { const K = KINDS[g.kind]; if (K.drawGround) K.drawGround(g, ctx, cam); } });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; ctx.save(); for (const g of games) { const K = KINDS[g.kind]; if (K.draw) try { K.draw(g, ctx, cam); } catch (e) { /* */ } } ctx.restore(); });
    O.KidsPlay = { games, KINDS, start: (kind) => { const s = cur(), P = game.player; const K = KINDS[kind]; const kids = s.people.filter((q) => free(q)).sort((a, b) => Math.hypot(a.agent.x - P.x, a.agent.y - P.y) - Math.hypot(b.agent.x - P.x, b.agent.y - P.y)).slice(0, K.n[1]); if (kids.length < K.n[0]) return null; const at = spot(P.x + 40, P.y, K.w, K.h); if (!at) return null; take(kids); const g = { kind, kids, cx: at[0], cy: at[1], t: 0, len: 60 }; K.init(g); games.push(g); return g; } };
  }
  O.KidsPlaySetup = { setup };
})();
