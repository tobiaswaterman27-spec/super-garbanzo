// Grown folk at play, seen: on Sunday afternoons, holy days and summer evenings,
// - quoits: iron rings pitched at a peg in the ground, a clink when one rings it;
// - the butts: men at archery practice, as the law bids, arrows flying into a straw target;
// - bowls: wooden balls rolled up the green at the little jack, bending in;
// - wrestling: two men grappling in a ring of shouting watchers till one is thrown;
// - nine men's morris: a board scratched on the bench, two old heads bent over it, counters moving;
// - skittles outside the tavern: a wooden ball bowled, the pins going down with a clatter.
// Ask to join any of them and you're in (and may win a coin, or lose one).
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const sp = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.6);
    const games = [];
    const open = (x, y) => !game.solidAt(x - 4, y - 3) && !game.solidAt(x + 3, y - 3) && !game.solidAt(x - 4, y) && !game.solidAt(x + 3, y);
    const free = (q) => q && q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand && !q._scene && !q._playing && !q._fighting && q.age >= 15 && q.alive !== false && !q.job?.onShift && !q.visitor && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) && (!q.activity || ['stroll', 'socialise', 'idle', 'home', 'rest', 'pastime'].includes(q.activity.act));
    function steer(q, tx, ty, dt, speed = 45) { const a = q.agent, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 2) { if (a.anim === 'walk' || a.anim === 'run') a.anim = 'idle'; return true; } const st = Math.min(d, speed * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; if (open(nx, ny)) { a.x = nx; a.y = ny; } else if (open(nx, a.y)) a.x = nx; else if (open(a.x, ny)) a.y = ny; a.anim = 'walk'; a.dir = O.dirOf(dx, dy); return false; }
    function spot(x, y, w, h) { for (let r = 0; r < 160; r += 12) for (let k = 0; k < 14; k++) { const ang = k / 14 * Math.PI * 2, cx = x + Math.cos(ang) * r, cy = y + Math.sin(ang) * r; let ok = true; for (let dx = -w / 2 - 6; dx <= w / 2 + 6 && ok; dx += 8) for (let dy = -h / 2 - 16; dy <= h / 2 + 8 && ok; dy += 8) if (!open(cx + dx, cy + dy)) ok = false; if (ok && !games.some((g) => Math.hypot(g.cx - cx, g.cy - cy) < 100) && !(O.KidsPlay && O.KidsPlay.games.some((g) => Math.hypot(g.cx - cx, g.cy - cy) < 90))) return [cx, cy]; } return null; }
    const take = (qs) => { for (const q of qs) { q._playing = true; q.agent.frozen = true; q.agent.path = null; } };
    const release = (g) => { for (const q of g.ppl) { q._playing = false; q.agent.frozen = false; q.agent.anim = 'idle'; q.agent.lift = 0; } };
    const throwArc = (g, from, to, kind, dur, done) => g.fly.push({ x0: from[0], y0: from[1], x1: to[0], y1: to[1], t: 0, dur, kind, done });

    const KINDS = {
      quoits: { n: [2, 4], w: 70, h: 20, init(g) { g.peg = [g.cx + 30, g.cy]; g.turn = 0; g.wait = 1; g.score = new Map(); },
        update(g, dt) { g.ppl.forEach((q, i) => { steer(q, g.cx - 30, g.cy - 8 + i * 6); if (i === g.turn % g.ppl.length) q.agent.dir = 2; }); g.wait -= dt; if (g.wait > 0) return; g.wait = 2.6;
          const q = g.ppl[g.turn % g.ppl.length]; g.turn++; O.gesture && O.gesture(q, 'attack', 0.5); const ring = Math.random() < 0.3, to = ring ? g.peg : [g.peg[0] + (Math.random() - 0.5) * 24, g.peg[1] + (Math.random() - 0.5) * 12];
          throwArc(g, [q.agent.x + 6, q.agent.y - 14], to, 'quoit', 0.8, () => { g.down.push({ x: to[0], y: to[1], t: 0 }); if (ring) { O.sfx && O.sfx('catch', 0.4); g.score.set(q.id, (g.score.get(q.id) || 0) + 1); sp(q, pick(['Ringer!', 'Ha! On the peg!', 'Clink!'])); } else if (Math.random() < 0.3) sp(q, pick(['Short.', 'Wide, curse it.', 'Leaner!'])); }); },
        drawGround(g, ctx, cam) { const [px, py] = g.peg; ctx.fillStyle = '#5a3d26'; ctx.fillRect(Math.round(px - cam.x), Math.round(py - 6 - cam.y), 2, 6); for (const d of g.down) { ctx.strokeStyle = '#7a7e88'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(Math.round(d.x - cam.x) + 0.5, Math.round(d.y - cam.y), 3.5, 1.6, 0, 0, Math.PI * 2); ctx.stroke(); } } },
      butts: { n: [2, 4], w: 120, h: 24, init(g) { g.target = [g.cx + 55, g.cy - 2]; g.turn = 0; g.wait = 1.5; },
        update(g, dt) { g.ppl.forEach((q, i) => { steer(q, g.cx - 50, g.cy - 8 + i * 8); q.agent.dir = 2; if (!q.app.outfit.backItem && !q._bowSet) { q._bowSet = true; } }); g.wait -= dt; if (g.wait > 0) return; g.wait = 2.2;
          const q = g.ppl[g.turn % g.ppl.length]; g.turn++; O.gesture && O.gesture(q, 'point', 0.6); O.sfx && O.sfx('whoosh', 0.35); const r = Math.random() * (1 - ((q.skills && q.skills.archery) || 0.2) * 0.6), a = Math.random() * Math.PI * 2, to = [g.target[0] + Math.cos(a) * r * 9, g.target[1] - 8 + Math.sin(a) * r * 9];
          throwArc(g, [q.agent.x + 6, q.agent.y - 16], to, 'arrow', 0.45, () => { g.stuck.push({ x: to[0], y: to[1] }); if (g.stuck.length > 10) g.stuck.shift(); if (r < 0.2) sp(q, pick(['The gold!', 'Clout! Dead centre!'])); else if (r > 0.8 && Math.random() < 0.5) sp(q, pick(['Wind took it.', 'Fletching\'s bad.'])); O.sfx && O.sfx('smack', 0.2); }); },
        draw(g, ctx, cam) { const [tx, ty] = g.target, x = Math.round(tx - cam.x), y = Math.round(ty - 8 - cam.y); ctx.fillStyle = '#c9a456'; ctx.fillRect(x - 7, y - 7, 14, 15); ctx.fillStyle = '#e8e0cc'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3f5a7a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#b8352a'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e0c050'; ctx.fillRect(x - 1, y - 1, 2, 2); ctx.fillStyle = '#5a3d26'; ctx.fillRect(x - 6, y + 8, 2, 6); ctx.fillRect(x + 4, y + 8, 2, 6);
          for (const a of g.stuck) { const sx = Math.round(a.x - cam.x), sy = Math.round(a.y - cam.y); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(sx - 4, sy, 4, 1); ctx.fillStyle = '#e8e0cc'; ctx.fillRect(sx - 6, sy - 1, 2, 3); } } },
      bowls: { n: [2, 4], w: 100, h: 30, init(g) { g.jack = [g.cx + 35, g.cy]; g.turn = 0; g.wait = 1; g.balls = []; },
        update(g, dt) { g.ppl.forEach((q, i) => { steer(q, g.cx - 40, g.cy - 8 + i * 7); if (i === g.turn % g.ppl.length) q.agent.dir = 2; }); for (const b of g.balls) if (b.v > 0) { b.x += b.vx * dt; b.y += b.vy * dt + Math.sin(b.t * 2) * b.bias * dt; b.t += dt; b.vx *= 1 - dt * 1.2; b.vy *= 1 - dt * 1.2; b.v = Math.hypot(b.vx, b.vy); if (b.v < 4) b.v = 0; }
          g.wait -= dt; if (g.wait > 0) return; g.wait = 3.5; if (g.balls.length >= 8) { const best = g.balls.slice().sort((a, b) => Math.hypot(a.x - g.jack[0], a.y - g.jack[1]) - Math.hypot(b.x - g.jack[0], b.y - g.jack[1]))[0]; sp(best.by, 'Mine\'s nearest! The end to me.'); g.balls = []; return; }
          const q = g.ppl[g.turn % g.ppl.length]; g.turn++; O.gesture && O.gesture(q, 'crouch', 0.8); const sp0 = 58 + Math.random() * 18; g.balls.push({ x: q.agent.x + 6, y: q.agent.y, vx: sp0, vy: (Math.random() - 0.5) * 8, v: sp0, t: 0, bias: (Math.random() - 0.5) * 12, by: q, col: ['#5a3d26', '#7a4a2c', '#3a2a1a', '#8a6239'][g.ppl.indexOf(q) % 4] }); },
        drawGround(g, ctx, cam) { const [jx, jy] = g.jack; ctx.fillStyle = '#e8e0cc'; ctx.fillRect(Math.round(jx - cam.x) - 1, Math.round(jy - cam.y) - 1, 3, 3); for (const b of g.balls) { ctx.fillStyle = 'rgba(28,20,44,0.3)'; ctx.fillRect(Math.round(b.x - cam.x) - 3, Math.round(b.y - cam.y) + 1, 6, 2); ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(Math.round(b.x - cam.x), Math.round(b.y - cam.y) - 2, 3, 0, Math.PI * 2); ctx.fill(); } } },
      wrestling: { n: [4, 8], w: 60, h: 40, init(g) { g.a = g.ppl[0]; g.b = g.ppl[1]; g.round = 0; },
        update(g, dt) { const ring = g.ppl.slice(2); ring.forEach((q, i) => { const ang = i / ring.length * Math.PI * 2; steer(q, g.cx + Math.cos(ang) * 34, g.cy + Math.sin(ang) * 22); q.agent.dir = O.dirOf(g.cx - q.agent.x, g.cy - q.agent.y); if (Math.random() < dt * 0.4) { O.gesture && O.gesture(q, 'celebrate', 1); if (Math.random() < 0.3) sp(q, pick([`Throw him, ${g.a.first}!`, `Come on, ${g.b.first}!`, 'Hold! Hold!'])); } });
          g.round += dt; const sway = Math.sin(g.round * 3) * 4; steer(g.a, g.cx - 6 + sway, g.cy, dt, 30); steer(g.b, g.cx + 6 + sway, g.cy, dt, 30); g.a.agent.dir = 2; g.b.agent.dir = 1; g.a.agent.anim = 'shake'; g.b.agent.anim = 'shake';
          if (g.round > 14) { const win = Math.random() < 0.5 ? g.a : g.b, lose = win === g.a ? g.b : g.a; lose.agent.anim = 'lie'; O.gesture && O.gesture(win, 'celebrate', 2); sp(win, 'Down he goes!'); cur().relate(lose, win, 0.02); g.over = true; O.sfx && O.sfx('smack', 0.6); } } },
      morris: { n: [2, 2], w: 20, h: 16, bench: true, init(g) { g.pieces = []; g.turn = 0; g.wait = 2; },
        update(g, dt) { g.ppl.forEach((q, i) => { steer(q, g.cx + (i ? 12 : -12), g.cy); q.agent.dir = i ? 1 : 2; q.agent.anim = 'crouch'; }); g.wait -= dt; if (g.wait > 0) return; g.wait = 3; const q = g.ppl[g.turn % 2]; g.turn++; O.gesture && O.gesture(q, 'place', 0.6); const pts = []; for (const r of [6, 4, 2]) for (const [ix, iy] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]) pts.push([ix * r, iy * r * 0.6]); if (g.pieces.length < 14) { const fr = pts.filter((p) => !g.pieces.some((x) => x.p === p.join())); const p = pick(fr); if (p) g.pieces.push({ p: p.join(), x: p[0], y: p[1], who: g.turn % 2 }); } else { g.pieces.splice(Math.floor(Math.random() * g.pieces.length), 1); if (Math.random() < 0.4) sp(q, pick(['A mill! I take one.', 'Hmm.', 'You didn\'t see that coming.']), 1.6); } },
        drawGround(g, ctx, cam) { const x = Math.round(g.cx - cam.x), y = Math.round(g.cy - 4 - cam.y); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 9, y - 6, 18, 12); ctx.strokeStyle = '#e8d8b0'; ctx.lineWidth = 0.6; for (const r of [6, 4, 2]) ctx.strokeRect(x - r + 0.5, y - r * 0.6 + 0.5, r * 2, r * 1.2); for (const pc of g.pieces) { ctx.fillStyle = pc.who ? '#e8e0cc' : '#2a2426'; ctx.fillRect(x + Math.round(pc.x) - 1, y + Math.round(pc.y) - 1, 2, 2); } } },
      skittles: { n: [2, 4], w: 90, h: 20, init(g) { g.pins = Array.from({ length: 9 }, (_, i) => ({ x: g.cx + 30 + (i % 3) * 4, y: g.cy - 4 + Math.floor(i / 3) * 4, down: false })); g.turn = 0; g.wait = 1.5; },
        update(g, dt) { g.ppl.forEach((q, i) => { steer(q, g.cx - 35, g.cy - 6 + i * 7); if (i === g.turn % g.ppl.length) q.agent.dir = 2; }); if (g.ball) { g.ball.x += 90 * dt; if (g.ball.x > g.cx + 28) { const n = 2 + Math.floor(Math.random() * 7); g.pins.filter((p) => !p.down).slice(0, n).forEach((p) => { p.down = true; }); O.sfx && O.sfx('smack', 0.5); const all = g.pins.every((p) => p.down); sp(g.ball.by, all ? 'All nine! Pay up!' : `${n} down.`); g.ball = null; if (all || Math.random() < 0.3) setTimeout(() => g.pins.forEach((p) => { p.down = false; }), 1500); } return; }
          g.wait -= dt; if (g.wait > 0) return; g.wait = 3; const q = g.ppl[g.turn % g.ppl.length]; g.turn++; O.gesture && O.gesture(q, 'crouch', 0.6); g.ball = { x: q.agent.x + 6, y: g.cy, by: q }; },
        draw(g, ctx, cam) { for (const p of g.pins) { const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y); ctx.fillStyle = '#e8dcc0'; if (p.down) ctx.fillRect(x - 2, y - 1, 5, 2); else { ctx.fillRect(x, y - 6, 2, 6); ctx.fillRect(x - 1, y - 2, 4, 2); } } if (g.ball) { ctx.fillStyle = '#5a3d26'; ctx.beginPath(); ctx.arc(Math.round(g.ball.x - cam.x), Math.round(g.ball.y - 2 - cam.y), 3, 0, Math.PI * 2); ctx.fill(); } } },
    };
    let next = 12;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      for (const g of games.slice()) { g.t += dt; for (const f of g.fly.slice()) { f.t += dt; if (f.t >= f.dur) { g.fly.splice(g.fly.indexOf(f), 1); f.done && f.done(); } } let end = g.t > g.len || g.over || game.scene || g.ppl.some((q) => !q.agent || q.alive === false || q._fighting);
        if (!end) { try { KINDS[g.kind].update(g, dt); } catch (e) { console.error(e); end = true; } } if (end) { setTimeout(() => release(g), g.over ? 2500 : 0); games.splice(games.indexOf(g), 1); } }
      next -= dt; if (next > 0) return; next = 14 + Math.random() * 14;
      if (game.scene || games.length >= 2) return; const h = s.minute / 60, sunday = s.weekday === 6;
      const leisure = (sunday && h >= 12.5 && h < 18.5) || (h >= 18 && h < 20.5 && s.season !== 'winter') || (O.Festivals && O.Festivals.today && O.Festivals.today(s));
      if (!leisure || /rain|heavy|storm|snow|blizzard/.test(s.weather?.kind || '')) return;
      const P = game.player, ppl = s.people.filter((q) => free(q) && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 420);
      const can = Object.entries(KINDS).filter(([k, K]) => ppl.length >= K.n[0] && !(k === 'morris' && !ppl.some((q) => q.age >= 50)) && !(k === 'butts' && !(sunday || h < 19)) && !(k === 'skittles' && !s.tavernId)); if (!can.length) return;
      const [kind, K] = pick(can); let cast = kind === 'morris' ? ppl.filter((q) => q.age >= 45).slice(0, 2) : kind === 'wrestling' || kind === 'butts' ? ppl.filter((q) => q.sex === 'm').slice(0, K.n[1]) : ppl.slice(0, K.n[1]); if (cast.length < K.n[0]) return;
      let near = [cast[0].agent.x, cast[0].agent.y]; if (kind === 'skittles') { const tv = s.building(s.tavernId); if (tv) near = [tv.doorX * T + 8, (tv.doorY + 3) * T]; }
      const at = spot(near[0], near[1], K.w, K.h); if (!at) return;
      take(cast); const g = { kind, ppl: cast, cx: at[0], cy: at[1], t: 0, len: 60 + Math.random() * 60, fly: [], down: [], stuck: [] }; K.init(g); games.push(g);
      if (Math.random() < 0.6) sp(cast[0], { quoits: 'A game of quoits? Penny a ringer.', butts: 'Come on, lads, the law says we shoot of a Sunday.', bowls: 'Who\'ll roll an end?', wrestling: 'Who\'ll try a fall with me?', morris: 'Set the board up, old friend.', skittles: 'Set them up! Nine pins!' }[kind], 2);
    });
    const drawFly = (g, ctx, cam) => { for (const f of g.fly) { const k = f.t / f.dur, x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * (f.kind === 'arrow' ? 6 : 18); ctx.save(); ctx.translate(Math.round(x - cam.x), Math.round(y - cam.y)); if (f.kind === 'arrow') { ctx.rotate(Math.atan2(f.y1 - f.y0, f.x1 - f.x0)); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(-5, 0, 10, 1); ctx.fillStyle = '#e8e0cc'; ctx.fillRect(-6, -1, 2, 3); } else { ctx.strokeStyle = '#7a7e88'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 2, k * 6, 0, Math.PI * 2); ctx.stroke(); } ctx.restore(); } };
    game.hooks.drawGround.push((ctx, cam) => { if (game.scene) return; for (const g of games) { const K = KINDS[g.kind]; if (K.drawGround) try { K.drawGround(g, ctx, cam); } catch (e) { /* */ } } });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; ctx.save(); for (const g of games) { const K = KINDS[g.kind]; try { if (K.draw) K.draw(g, ctx, cam); drawFly(g, ctx, cam); } catch (e) { /* */ } } ctx.restore(); });
    // asking to join
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      const g = q && games.find((x) => x.ppl.includes(q));
      if (g && typeof text === 'string' && /\b(can i (join|play|have a go|try)|deal me in|let me (try|play|have a go)|i'?ll (play|have a go|wrestle|take you on)|my turn)\b/i.test(text) && O.AI && O.AI.ready) {
        const s = cur(), K = { quoits: 'archery', butts: 'archery', bowls: 'bowls', wrestling: 'fighting', morris: 'gambling', skittles: 'bowls' }[g.kind], sk = PS.skills[K] || 0;
        const win = Math.random() < 0.35 + sk * 0.5; PS.skills[K] = Math.min(1, sk + 0.02); const stake = 1;
        const P = game.player, now = performance.now(); P.gest = { anim: g.kind === 'wrestling' ? 'shake' : g.kind === 'morris' ? 'place' : g.kind === 'butts' ? 'point' : 'attack', from: now, until: now + 1800 };
        if (win) { PS.money += stake; const hh = s.household(q); if (hh) hh.money -= stake; } else if (PS.money >= stake) { PS.money -= stake; const hh = s.household(q); if (hh) hh.money += stake; }
        s.relate(q, { id: 0 }, 0.06);
        const line = { quoits: win ? 'A ringer, first throw! Here\'s your penny.' : 'Short! A penny to me.', butts: win ? 'In the gold! You\'ve shot before.' : 'Missed the butt entirely. Keep your elbow up.', bowls: win ? 'Kissed the jack. That end\'s yours.' : 'Too much weight on it. Mine\'s nearer.', wrestling: win ? 'Ugh! You threw me fair.' : 'Down you go! Better luck next fall.', morris: win ? 'A mill, and I never saw it. Your game.' : 'Three in a row. I win, young one.', skittles: win ? 'All nine! Well bowled.' : 'Two pins. Mine was better.' }[g.kind];
        setTimeout(() => { (q._conv = q._conv || []).push({ who: 'p', t: text }, { who: 'q', t: line }); render(line); }, 1800); return Promise.resolve();
      }
      return _say.apply(this, arguments);
    };
    O.AdultPlay = { games, KINDS, start: (kind) => { const s = cur(), P = game.player, K = KINDS[kind]; const ppl = s.people.filter((q) => free(q) && (kind !== 'morris' || q.age >= 45) && (!['wrestling', 'butts'].includes(kind) || q.sex === 'm')).sort((a, b) => Math.hypot(a.agent.x - P.x, a.agent.y - P.y) - Math.hypot(b.agent.x - P.x, b.agent.y - P.y)).slice(0, K.n[1]); if (ppl.length < K.n[0]) return null; const at = spot(P.x + 40, P.y - 30, K.w, K.h); if (!at) return null; take(ppl); const g = { kind, ppl, cx: at[0], cy: at[1], t: 0, len: 90, fly: [], down: [], stuck: [] }; K.init(g); games.push(g); return g; } };
  }
  O.AdultPlaySetup = { setup };
})();
