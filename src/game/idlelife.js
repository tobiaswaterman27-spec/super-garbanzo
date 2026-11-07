// Nobody just stands. Anyone left waiting in the open with nothing to do finds some small business,
// and you can see it:
// - children kick a pebble along, throw a stick and run for it, shoot marbles into a scratched ring,
//   spin till they're dizzy, frog-hop, draw in the dirt, give each other piggybacks, play clapping games;
// - grown folk eat an apple and toss the core, gather in a knot to talk (nods, laughs, shrugs, hands
//   going), scatter crumbs for the sparrows, shake a stone out of a shoe, count their coins, juggle;
// - the old sit down on the ground by a wall and nod off.
// Only near you (nobody watches the rest), and they drop it the moment they've somewhere to be.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const bits = []; const ground = []; // ground: scratched rings, dirt drawings, crumbs, cores
    const open = (x, y) => !game.solidAt(x - 3, y - 2) && !game.solidAt(x + 3, y - 2);
    const IDLE_ACTS = ['stroll', 'socialise', 'idle', 'home', 'rest', 'wait-work', 'play', 'festival', 'pastime-none'];
    const idleNow = (q) => { const a = q.agent; return a && !a.hidden && a.inside == null && !a.path && !a.frozen && !a.chasing && !a.talking && !q.errand && !q._scene && !q._playing && !q._fighting && !q._bit && q.alive !== false && !q.visitor && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) && q.activity && IDLE_ACTS.includes(q.activity.act); };
    const near = (q, r) => Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < r;
    function take(b) { for (const q of b.ppl) { q._bit = b; q.agent.frozen = true; } bits.push(b); }
    function release(b) { const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); for (const q of b.ppl) { if (q._bit !== b) continue; q._bit = null; const a = q.agent; a.forceAnim = null; a.lift = 0; if (!q._cp && !(q === tq || (tq && (tq._group || []).includes(q)))) a.frozen = false; } }
    function move(q, tx, ty, dt, sp, anim) { const a = q.agent, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1.5) return true; const st = Math.min(d, sp * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; if (open(nx, ny)) { a.x = nx; a.y = ny; } else return true; a.forceAnim = anim || 'walk'; a.dir = O.dirOf(dx, dy); return false; }
    const anim = (q, k) => { q.agent.forceAnim = k; };
    const say = (q, t) => O.Speech && Math.random() < 0.5 && O.Speech.say(q, t, 1.5);

    // ------------------------------------------------------------------ what can be done, and by whom
    const BITS = {
      // children
      pebble: { who: 'kid', len: [10, 16], init(b) { const q = b.ppl[0]; b.st = { x: q.agent.x + 6, y: q.agent.y, vx: 0 }; b.dir = Math.random() < 0.5 ? 1 : -1; b.go = 0; },
        update(b, dt) { const q = b.ppl[0], st = b.st; st.x += st.vx * dt; st.vx *= 1 - dt * 2.5; if (!open(st.x, st.y)) { st.vx = -st.vx; b.dir = -b.dir; st.x += st.vx * dt * 2; }
          const tx = st.x - b.dir * 6; if (move(q, tx, st.y, dt, 50, 'run') && Math.abs(st.vx) < 8) { O.gesture && O.gesture(q, 'attack', 0.3); st.vx = b.dir * (40 + Math.random() * 30); if (Math.random() < 0.2) b.dir = -b.dir; O.sfx && near(q, 200) && Math.random() < 0.3 && O.sfx('place', 0.15); } },
        draw(b, ctx, cam) { ctx.fillStyle = '#8a8478'; ctx.fillRect(Math.round(b.st.x - cam.x) - 1, Math.round(b.st.y - cam.y) - 2, 3, 2); } },
      stick: { who: 'kid', len: [12, 18], init(b) { b.stage = 'aim'; b.w = 0.6; },
        update(b, dt) { const q = b.ppl[0], a = q.agent; b.w -= dt;
          if (b.stage === 'aim' && b.w <= 0) { O.gesture && O.gesture(q, 'attack', 0.4); const ang = Math.random() * Math.PI * 2; let tx = a.x + Math.cos(ang) * 50, ty = a.y + Math.sin(ang) * 30; if (!open(tx, ty)) { tx = a.x - Math.cos(ang) * 40; ty = a.y - Math.sin(ang) * 25; } if (!open(tx, ty)) { b.w = 1; return; } b.fly = { x0: a.x + 5, y0: a.y - 12, x1: tx, y1: ty, t: 0, dur: 0.7 }; b.stage = 'fly'; O.sfx && near(q, 200) && O.sfx('whoosh', 0.15); }
          else if (b.stage === 'fly') { b.fly.t += dt; if (b.fly.t >= b.fly.dur) { b.down = [b.fly.x1, b.fly.y1]; b.fly = null; b.stage = 'fetch'; } }
          else if (b.stage === 'fetch') { if (move(q, b.down[0] - 4, b.down[1], dt, 60, 'run')) { O.gesture && O.gesture(q, 'pickup', 0.5); b.down = null; b.stage = 'aim'; b.w = 0.8; } } },
        draw(b, ctx, cam) { ctx.fillStyle = '#6a4a2c'; if (b.fly) { const f = b.fly, k = f.t / f.dur, x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 20, r = k * 12; ctx.save(); ctx.translate(Math.round(x - cam.x), Math.round(y - cam.y)); ctx.rotate(r); ctx.fillRect(-4, 0, 8, 1); ctx.restore(); } else if (b.down) ctx.fillRect(Math.round(b.down[0] - cam.x) - 4, Math.round(b.down[1] - cam.y) - 1, 8, 1); } },
      marbles: { who: 'kid', n: [1, 2], len: [14, 22], init(b) { const q = b.ppl[0]; b.ring = [q.agent.x + 14, q.agent.y + 2]; b.m = Array.from({ length: 5 }, () => ({ x: b.ring[0] + (Math.random() - 0.5) * 6, y: b.ring[1] + (Math.random() - 0.5) * 4, vx: 0, vy: 0, c: pick(['#3f5a7a', '#b8352a', '#e0c050', '#5a8a4a', '#e8e0cc']) })); b.w = 1.2; b.turn = 0; ground.push({ kind: 'ring', x: b.ring[0], y: b.ring[1], t: 0, life: 90 }); },
        update(b, dt) { b.ppl.forEach((q, i) => { anim(q, 'crouch'); q.agent.dir = i ? 1 : 2; if (i) { q.agent.x = b.ring[0] + 14; } }); for (const m of b.m) { m.x += m.vx * dt; m.y += m.vy * dt; m.vx *= 1 - dt * 3; m.vy *= 1 - dt * 3; }
          b.w -= dt; if (b.w > 0) return; b.w = 2.2; const q = b.ppl[b.turn++ % b.ppl.length]; O.gesture && O.gesture(q, 'place', 0.4); const m = pick(b.m); const s = (q.agent.x < b.ring[0] ? 1 : -1); m.vx = s * (14 + Math.random() * 16); m.vy = (Math.random() - 0.5) * 10; if (Math.hypot(m.x + m.vx * 0.4 - b.ring[0], m.y - b.ring[1]) > 7 && Math.random() < 0.3) say(q, pick(['Knocked it out!', 'Mine now.', 'Fudging! You moved your hand!'])); O.sfx && near(q, 160) && O.sfx('place', 0.08); },
        draw(b, ctx, cam) { for (const m of b.m) { ctx.fillStyle = m.c; ctx.fillRect(Math.round(m.x - cam.x), Math.round(m.y - cam.y) - 1, 2, 2); } } },
      spin: { who: 'kid', len: [6, 9], init(b) { b.k = 0; },
        update(b, dt) { const q = b.ppl[0]; b.k += dt; if (b.k < 4) { q.agent.dir = Math.floor(b.k * 8) % 4; anim(q, 'celebrate'); } else { anim(q, b.k < 6 ? 'shake' : 'laugh'); const nx = q.agent.x + Math.sin(b.k * 7) * 12 * dt; if (open(nx, q.agent.y)) q.agent.x = nx; if (b.k > 4 && !b.said) { b.said = 1; say(q, pick(['The ground\'s going round!', 'Whoooa.', 'Dizzy!'])); } } } },
      hop: { who: 'kid', len: [8, 12], init(b) { b.k = 0; b.vx = Math.random() < 0.5 ? 1 : -1; },
        update(b, dt) { const q = b.ppl[0], a = q.agent; b.k += dt; const ph = (b.k * 1.8) % 1; a.lift = Math.sin(ph * Math.PI) * 6; anim(q, ph < 0.15 || ph > 0.85 ? 'crouch' : 'celebrate'); const nx = a.x + b.vx * 18 * dt; if (open(nx, a.y)) a.x = nx; else b.vx = -b.vx; a.dir = b.vx > 0 ? 2 : 1; if (b.k > 0.1 && !b.said) { b.said = 1; say(q, pick(['Ribbit!', 'I\'m a frog!'])); } } },
      scrawl: { who: 'kid', len: [12, 18], init(b) { const q = b.ppl[0]; b.g = { kind: 'scrawl', x: q.agent.x + 7, y: q.agent.y + 1, lines: [], t: 0, life: 240 }; ground.push(b.g); b.w = 0; },
        update(b, dt) { const q = b.ppl[0]; anim(q, 'crouch'); q.agent.dir = 2; b.w -= dt; if (b.w > 0) return; b.w = 0.5; O.gesture && O.gesture(q, 'place', 0.4); const L = b.g.lines, last = L.length ? L[L.length - 1] : [0, 0, 0, 0]; const x0 = L.length % 4 === 0 ? (Math.random() - 0.5) * 10 : last[2], y0 = L.length % 4 === 0 ? (Math.random() - 0.5) * 6 : last[3]; L.push([x0, y0, Math.max(-6, Math.min(6, x0 + (Math.random() - 0.5) * 7)), Math.max(-4, Math.min(4, y0 + (Math.random() - 0.5) * 5))]); if (L.length === 6) say(q, pick(['That\'s a horse.', 'That\'s you, that is.', 'A dragon!'])); } },
      piggy: { who: 'kid', n: [2, 2], len: [10, 16], init(b) { b.ang = 0; b.c = [b.ppl[0].agent.x, b.ppl[0].agent.y]; },
        update(b, dt) { const [car, rider] = b.ppl; b.ang += dt * 1.1; const tx = b.c[0] + Math.cos(b.ang) * 22, ty = b.c[1] + Math.sin(b.ang) * 12; if (!move(car, tx, ty, dt, 34, 'carry')) { /* */ } else b.ang += 0.3; rider.agent.x = car.agent.x; rider.agent.y = car.agent.y + 0.5; rider.agent.lift = 9; rider.agent.dir = car.agent.dir; anim(rider, Math.sin(b.ang * 3) > 0.6 ? 'celebrate' : 'sit'); if (Math.random() < dt * 0.15) say(rider, pick(['Faster!', 'Gee up!', 'Giddy-up, horse!'])); } },
      clap: { who: 'kid', n: [2, 2], len: [8, 12], init(b) { b.k = 0; const [x, y] = [b.ppl[0].agent.x, b.ppl[0].agent.y]; b.c = [x + 7, y]; },
        update(b, dt) { const [u, v] = b.ppl; b.k += dt; move(u, b.c[0] - 6, b.c[1], dt, 30); move(v, b.c[0] + 6, b.c[1], dt, 30); if (Math.abs(u.agent.x - (b.c[0] - 6)) < 2 && Math.abs(v.agent.x - (b.c[0] + 6)) < 2) { u.agent.dir = 2; v.agent.dir = 1; const beat = Math.floor(b.k * 3) % 4; anim(u, beat % 2 ? 'wave' : 'gesture'); anim(v, beat % 2 ? 'wave' : 'gesture'); if (beat === 1 && O.sfx && near(u, 160) && Math.random() < dt * 6) O.sfx('smack', 0.06); if (b.k > 1 && !b.said && (b.said = 1)) say(u, pick(['Pat-a-cake, pat-a-cake...', 'Ring-a-ring...', 'One, two, buckle my shoe...'])); } } },
      // grown folk
      apple: { who: 'adult', len: [8, 12], init(b) { b.k = 0; },
        update(b, dt) { const q = b.ppl[0]; b.k += dt; if (b.k < 6.5) { anim(q, 'eat'); } else if (!b.tossed) { b.tossed = true; O.gesture && O.gesture(q, 'attack', 0.4); const a = q.agent, tx = a.x + (Math.random() < 0.5 ? -1 : 1) * 30, ty = a.y + 6; b.fly = { x0: a.x + 5, y0: a.y - 14, x1: tx, y1: ty, t: 0, dur: 0.6 }; } else anim(q, 'wipe'); if (b.fly) { b.fly.t += dt; if (b.fly.t >= b.fly.dur) { ground.push({ kind: 'core', x: b.fly.x1, y: b.fly.y1, t: 0, life: 120 }); b.fly = null; } } },
        draw(b, ctx, cam) { const q = b.ppl[0], a = q.agent; if (!b.tossed) { const big = b.k < 2 ? 3 : b.k < 4.5 ? 2.5 : 1.8; ctx.fillStyle = b.red ? '#b8352a' : (b.red = Math.random() < 0.5 ? 1 : 0, '#7aa04a'); ctx.beginPath(); ctx.arc(Math.round(a.x - cam.x + (a.dir === 1 ? -4 : 4)), Math.round(a.y - cam.y - 14 - (a.lift || 0)), big, 0, Math.PI * 2); ctx.fill(); } if (b.fly) { const f = b.fly, k = f.t / f.dur; ctx.fillStyle = '#d8c890'; ctx.fillRect(Math.round(f.x0 + (f.x1 - f.x0) * k - cam.x), Math.round(f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 14 - cam.y), 2, 3); } } },
      knot: { who: 'adult', n: [2, 4], len: [16, 28], init(b) { const xs = b.ppl.map((q) => q.agent.x), ys = b.ppl.map((q) => q.agent.y); b.c = [xs.reduce((a, c) => a + c) / xs.length, ys.reduce((a, c) => a + c) / ys.length]; b.spk = 0; b.w = 0; },
        update(b, dt) { const n = b.ppl.length; b.ppl.forEach((q, i) => { const ang = i / n * Math.PI * 2 + 0.4, tx = b.c[0] + Math.cos(ang) * 9, ty = b.c[1] + Math.sin(ang) * 5; if (move(q, tx, ty, dt, 30)) { q.agent.dir = O.dirOf(b.c[0] - q.agent.x, b.c[1] - q.agent.y); if (i === b.spk) anim(q, Math.floor(b.w * 2) % 3 ? 'talk' : 'gesture'); else if (q.agent.forceAnim === 'walk' || !q.agent.forceAnim) anim(q, 'idle'); } });
          b.w -= dt; if (b.w > 0) return; b.w = 2.5 + Math.random() * 2; const others = b.ppl.filter((_, i) => i !== b.spk); for (const o of others) anim(o, pick(['nod', 'idle', 'laugh', 'shrug', 'idle', 'nod', 'scratch'])); b.spk = Math.floor(Math.random() * n); if (Math.random() < 0.15) O.sfx && near(b.ppl[0], 180) && b.ppl.some((q) => q.agent.forceAnim === 'laugh') && 0; } },
      crumbs: { who: 'adult', len: [14, 20], init(b) { const q = b.ppl[0]; b.at = [q.agent.x + 12, q.agent.y + 3]; b.birds = []; b.k = 0; ground.push(b.g = { kind: 'crumbs', x: b.at[0], y: b.at[1], t: 0, life: 40 }); },
        update(b, dt) { const q = b.ppl[0]; b.k += dt; q.agent.dir = 2; anim(q, b.k < 3 ? 'give' : (Math.floor(b.k) % 5 === 0 ? 'place' : 'crouch')); if (b.k > 2 && b.birds.length < 5 && Math.random() < dt * 1.5) { const s = Math.random() < 0.5 ? -1 : 1; b.birds.push({ x: b.at[0] + s * 70, y: b.at[1] - 50, tx: b.at[0] + (Math.random() - 0.5) * 12, ty: b.at[1] + (Math.random() - 0.5) * 5, k: 0 }); }
          for (const bd of b.birds) { bd.k += dt; if (b.leave) { bd.x += (bd.x > b.at[0] ? 1 : -1) * 80 * dt; bd.y -= 60 * dt; continue; } const d = Math.hypot(bd.tx - bd.x, bd.ty - bd.y); if (d > 1) { const st = Math.min(d, 70 * dt); bd.x += (bd.tx - bd.x) / d * st; bd.y += (bd.ty - bd.y) / d * st; bd.fly = true; } else { bd.fly = false; if (Math.random() < dt * 0.8) { bd.tx = b.at[0] + (Math.random() - 0.5) * 12; bd.ty = b.at[1] + (Math.random() - 0.5) * 5; } } }
          if (b.t > b.len - 2.5 && !b.leave) { b.leave = true; anim(q, 'idle'); } },
        draw(b, ctx, cam) { for (const bd of b.birds) { const x = Math.round(bd.x - cam.x), y = Math.round(bd.y - cam.y); ctx.fillStyle = '#6a5240'; if (bd.fly) { const f = Math.floor(bd.k * 12) % 2; ctx.fillRect(x - 2, y - (f ? 1 : 0), 2, 1); ctx.fillRect(x + 1, y - (f ? 1 : 0), 2, 1); ctx.fillRect(x, y, 1, 1); } else { const peck = Math.floor(bd.k * 3 + bd.tx) % 3 === 0; ctx.fillRect(x - 1, y - 2, 3, 2); ctx.fillStyle = '#4a3a2c'; ctx.fillRect(x + (peck ? 2 : 1), y - (peck ? 1 : 3), 1, 1); } } } },
      shoe: { who: 'adult', len: [5, 7], init(b) { b.k = 0; },
        update(b, dt) { const q = b.ppl[0]; b.k += dt; anim(q, b.k < 1.5 ? 'crouch' : b.k < 4 ? 'shake' : 'idle'); if (b.k > 1.5 && !b.said && (b.said = 1)) say(q, pick(['Blasted stone.', 'Hole in me sole again.'])); } },
      coins: { who: 'adult', len: [6, 9], init(b) { b.k = 0; },
        update(b, dt) { const q = b.ppl[0]; b.k += dt; anim(q, 'count'); },
        draw(b, ctx, cam) { const a = b.ppl[0].agent, f = Math.floor(b.k * 4) % 3; ctx.fillStyle = '#e0c050'; ctx.fillRect(Math.round(a.x - cam.x + (a.dir === 1 ? -5 : 3)), Math.round(a.y - cam.y - 11 - f), 2, 1); if (f === 2) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(Math.round(a.x - cam.x + (a.dir === 1 ? -5 : 3)), Math.round(a.y - cam.y - 13), 1, 1); } } },
      juggle: { who: 'adult', len: [10, 14], when: (q) => (q.traits || []).includes('social') || /minstrel|jester|bard|player/.test(q.job?.role || '') || q.id % 9 === 0, init(b) { b.k = 0; },
        update(b, dt) { const q = b.ppl[0]; b.k += dt; anim(q, 'juggle'); q.agent.dir = 0; if (b.k > 0.5 && !b.said && (b.said = 1) && Math.random() < 0.3) say(q, 'Hup! Hup!'); if (b.k > 7 && !b.drop && Math.random() < dt * 0.15) { b.drop = true; say(q, 'Ah, drat.'); } },
        draw(b, ctx, cam) { if (b.drop) return; const a = b.ppl[0].agent, x = a.x - cam.x, y = a.y - cam.y - 20; for (let i = 0; i < 3; i++) { const ph = b.k * 3.4 + i * 2.09, bx = Math.cos(ph) * 5, by = -Math.abs(Math.sin(ph)) * 9; ctx.fillStyle = ['#b8352a', '#e0c050', '#3f5a7a'][i]; ctx.fillRect(Math.round(x + bx) - 1, Math.round(y + by) - 1, 2, 2); } } },
      // the old
      doze: { who: 'old', len: [30, 50], init(b) { b.k = 0; },
        update(b, dt) { const q = b.ppl[0]; b.k += dt; anim(q, b.k < 2 ? 'sit' : b.k > b.len - 3 ? 'stretch' : 'doze'); q.agent.dir = 0; } },
      spindle: { who: 'old', len: [30, 50], when: (q) => q.sex === 'f', init(b) { b.k = 0; b.yarn = 0; },
        update(b, dt) { const q = b.ppl[0]; b.k += dt; anim(q, Math.floor(b.k / 6) % 5 === 4 ? 'look' : 'spin'); q.agent.dir = 0; b.yarn = Math.min(8, b.yarn + dt * 0.15); if (b.k > 3 && !b.said && (b.said = 1) && Math.random() < 0.4) say(q, pick(['My eyes aren\'t what they were.', 'Wool for my grandson\'s stockings.', 'Spin, spin, the day goes in.'])); },
        draw(b, ctx, cam) { const a = b.ppl[0].agent, x = Math.round(a.x - cam.x) + 6, y = Math.round(a.y - cam.y) - 6; const sp = Math.floor(performance.now() / 70) % 4; ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x - 2, y - 10); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1 + (sp % 2), 1, 4); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x - 1, y + 1, 3, Math.max(1, Math.round(b.yarn / 3))); ctx.fillStyle = '#d8d0c0'; ctx.fillRect(x - 6, y - 14, 4, 5); } },
      dance: { who: 'fest', n: [2, 2], len: [12, 18], init(b) { b.c = [(b.ppl[0].agent.x + b.ppl[1].agent.x) / 2, (b.ppl[0].agent.y + b.ppl[1].agent.y) / 2]; b.ang = 0; },
        update(b, dt) { b.ang += dt * 2.6; b.ppl.forEach((q, i) => { const a = b.ang + i * Math.PI, tx = b.c[0] + Math.cos(a) * 6, ty = b.c[1] + Math.sin(a) * 3.5; const qa = q.agent; if (Math.hypot(tx - qa.x, ty - qa.y) > 8) move(q, tx, ty, dt, 40); else if (open(tx, ty)) { qa.x = tx; qa.y = ty; } qa.dir = O.dirOf(b.c[0] - qa.x, b.c[1] - qa.y); anim(q, 'dance'); qa.lift = Math.abs(Math.sin(b.ang * 2)) * 1.5; }); } },
    };
    const whoOf = (q) => q.activity?.act === 'festival' ? 'fest' : q.age < 13 ? 'kid' : q.age >= 62 ? 'old' : 'adult';

    function begin(kind, lead, s) {
      const K = BITS[kind]; const want = K.n ? K.n[0] + Math.floor(Math.random() * (K.n[1] - K.n[0] + 1)) : 1; const ppl = [lead];
      if (want > 1) { for (const q of s.people) { if (ppl.length >= want) break; if (q === lead || !idleNow(q) || whoOf(q) !== whoOf(lead)) continue; if (Math.hypot(q.agent.x - lead.agent.x, q.agent.y - lead.agent.y) < 70) ppl.push(q); } }
      if (K.n && ppl.length < K.n[0]) return null;
      const b = { kind, ppl, t: 0, len: K.len[0] + Math.random() * (K.len[1] - K.len[0]), acts: ppl.map((q) => q.activity) };
      take(b); try { K.init(b); } catch (e) { release(b); bits.splice(bits.indexOf(b), 1); return null; } return b;
    }
    const BY = { kid: ['pebble', 'stick', 'marbles', 'spin', 'hop', 'scrawl', 'piggy', 'clap', 'marbles', 'stick'], adult: ['apple', 'knot', 'knot', 'knot', 'crumbs', 'shoe', 'coins', 'juggle', 'knot'], old: ['doze', 'crumbs', 'knot', 'doze', 'spindle', 'spindle'], fest: ['dance', 'dance', 'knot', 'apple', 'juggle'] };

    let scan = 1;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      for (const g of ground.slice()) { g.t += dt; if (g.t > g.life) ground.splice(ground.indexOf(g), 1); }
      for (const b of bits.slice()) {
        b.t += dt; const end = b.t > b.len || game.scene || b.ppl.some((q, i) => (q.activity && q.activity.act) !== (b.acts[i] && b.acts[i].act) || q.alive === false || q._fighting || q.errand || q._scene || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) || q._bit !== b || q._cp || q.agent.inside != null || q.agent.hidden);
        if (!end) { try { BITS[b.kind].update(b, dt); } catch (e) { console.error(e); b.t = 1e9; } }
        if (end || b.t >= 1e9) { release(b); bits.splice(bits.indexOf(b), 1); }
      }
      scan -= dt; if (scan > 0 || game.scene) return; scan = 0.7;
      if (bits.length >= 14) return;
      const cand = s.people.filter((q) => idleNow(q) && near(q, 420) && (q._idleSince ||= performance.now()) && performance.now() - q._idleSince > 2500);
      for (const q of s.people) if (!idleNow(q)) q._idleSince = 0;
      if (!cand.length) return;
      const q = pick(cand); const w = whoOf(q); const opts = BY[w].filter((k) => !BITS[k].when || BITS[k].when(q));
      const kind = pick(opts); begin(kind, q, s);
    });
    game.hooks.drawGround.push((ctx, cam) => {
      if (game.scene) return;
      for (const g of ground) { const x = Math.round(g.x - cam.x), y = Math.round(g.y - cam.y), fade = Math.min(1, (g.life - g.t) / 10); ctx.globalAlpha = 0.6 * fade;
        if (g.kind === 'ring') { ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(x + 0.5, y, 7, 4, 0, 0, Math.PI * 2); ctx.stroke(); }
        else if (g.kind === 'scrawl') { ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 0.8; ctx.beginPath(); for (const [a, b2, c, d] of g.lines) { ctx.moveTo(x + a, y + b2); ctx.lineTo(x + c, y + d); } ctx.stroke(); }
        else if (g.kind === 'crumbs') { ctx.fillStyle = '#d8c090'; for (let i = 0; i < 7; i++) ctx.fillRect(x + ((i * 37) % 11) - 5, y + ((i * 17) % 5) - 2, 1, 1); }
        else if (g.kind === 'core') { ctx.globalAlpha = fade; ctx.fillStyle = '#c8b070'; ctx.fillRect(x, y - 2, 2, 3); }
        ctx.globalAlpha = 1; }
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; ctx.save(); for (const b of bits) { const K = BITS[b.kind]; if (K.draw) try { K.draw(b, ctx, cam); } catch (e) { /* */ } } ctx.restore(); });
    (O.extraLines = O.extraLines || []).push((s, q) => { const b = q._bit; if (!b) return ''; return { pebble: 'You were kicking a pebble along.', stick: 'You were throwing a stick and running for it.', marbles: 'You were playing marbles.', spin: 'You were spinning round till you were dizzy.', hop: 'You were frog-hopping.', scrawl: 'You were drawing in the dirt with a stick.', piggy: 'You were playing piggyback.', clap: 'You were playing a clapping game.', apple: 'You were eating an apple.', knot: 'You were standing chatting with neighbours.', crumbs: 'You were feeding the sparrows.', shoe: 'You had a stone in your shoe.', coins: 'You were counting your coins.', juggle: 'You were juggling, for the fun of it.', doze: 'You had sat down by the wall and nodded off; you\'ve just been woken.', spindle: 'You were sitting spinning wool with your spindle.', dance: 'You were dancing.' }[b.kind] || ''; });
    O.IdleLife = { bits, ground, start: (kind, q) => begin(kind, q, cur()), BITS };
  }
  O.IdleLifeSetup = { setup };
})();
