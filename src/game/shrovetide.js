// Shrove Tuesday. On the last day before Lent the town lets go: in the afternoon the men and lads turn out
// for the camp-ball, a whole mob of them after a pig's bladder through the streets, one end of the town
// against the other, shoving and tumbling, with the goals at the two ends and the old folk shouting from
// the doorways; the ball goes where it likes and so do they. And at the doors the women toss pancakes, the
// last of the eggs and butter, high off the pan. If you get near the ball, you kick it too.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let G = null, forced = false, games = 0; const flips = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._shrove && !q._bit && !q._scene && !talking(q) && !(q.health && q.health.illness);
    const shroveDay = (s) => forced || (s.season === 'winter' && ((s.weather && s.weather.dayOfSeason) || 0) === 13);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._shrove = false; }
    function end() { if (!G) return; for (const m of G.men) rel(m.q); for (const c of G.cooks) rel(c.q); G = null; }
    function step(a, tx, ty, v, dt) { const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1) return; const st = Math.min(d, v * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; a.stuck = a.stuck || 0;
      if (!game.solidAt(nx, ny - 2) || a.stuck > 1.5) { a.x = nx; a.y = ny; if (a.stuck > 1.5 && !game.solidAt(nx, ny - 2)) a.stuck = 0; } else if (!game.solidAt(nx, a.y - 2)) a.x = nx; else if (!game.solidAt(a.x, ny - 2)) a.y = ny; else a.stuck += dt; a.dir = O.dirOf(dx, dy); }
    function begin(s) { if (!s.Z || !s.Z.square) return false; const [x0, y0, x1, y1] = s.Z.square, cx = (x0 + x1) * 8 + 8, cy = (y0 + y1) * 8 + 8;
      const pool = s.people.filter((q) => able(q) && q.age >= 14 && q.age <= 50 && (q.sex === 'm' || q.age < 20) && q.agent.inside == null && !q.agent.hidden && Math.hypot(q.agent.x - cx, q.agent.y - cy) < 900).slice(0, 14); if (pool.length < 6) return false;
      const w = s.world, goal = (dir) => { for (let d = 26; d > 8; d--) { const tx = Math.floor(cx / T) + dir * d, ty = Math.floor(cy / T); if (tx > 2 && tx < w.W - 2 && !w.solid[ty * w.W + tx]) return tx * T + 8; } return cx + dir * 140; };
      G = { s, ball: { x: cx, y: cy, vx: 0, vy: 0 }, men: pool.map((q, i) => ({ q, side: i % 2 ? 1 : -1, off: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 24], cool: 0 })), goals: [goal(-1), goal(1)], cy, score: [0, 0], t: 0, cooks: [], cheer: 0 };
      for (const m of G.men) { const a = m.q.agent; m.q._shrove = true; a.frozen = true; a.path = null; a.stuck = 0; if (Math.hypot(a.x - cx, a.y - cy) > 400) { a.x = cx + (Math.random() - 0.5) * 200; a.y = cy + (Math.random() - 0.5) * 120; if (game.solidAt(a.x, a.y - 2)) { a.x = cx; a.y = cy; } } }
      // the women at their doors with the pans
      for (const b of w.buildings) { if (G.cooks.length >= 3) break; if (b.type !== 'house' || b.doorX == null || Math.hypot(b.doorX * T - game.player.x, b.doorY * T - game.player.y) > 380) continue; const q = s.people.find((x) => x.home === b.id && x.sex === 'f' && x.age >= 16 && able(x)); if (!q) continue; const a = q.agent; a.inside = null; a.hidden = false; a.x = b.doorX * T + 8; a.y = (b.doorY + 1) * T + 8; a.frozen = true; a.path = null; a.dir = 0; q._shrove = true; G.cooks.push({ q, next: 1 + Math.random() * 3 }); }
      if (near(cx, cy, 500)) { const c = G.men[0].q; O.Speech && O.Speech.say(c, 'The ball\'s up! East end against west!', 2.6); O.sfx && O.sfx('handbell', 0.3); }
      games++; return true; }
    game.hooks.update.push((dt) => {
      for (const f of flips.slice()) { f.t += dt; if (f.t > 1.1) flips.splice(flips.indexOf(f), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (G) { G.t += dt; if (G.s !== s || hr >= 16.5 || G.men.filter((m) => m.q._shrove).length < 4) { end(); return; }
        const B = G.ball; B.x += B.vx * dt; B.y += B.vy * dt; const fr = Math.pow(0.35, dt); B.vx *= fr; B.vy *= fr; if (game.solidAt(B.x, B.y - 2)) { B.x -= B.vx * dt * 2; B.y -= B.vy * dt * 2; B.vx *= -0.6; B.vy *= -0.6; if (game.solidAt(B.x, B.y - 2)) { B.x = G.goals[0] / 2 + G.goals[1] / 2; B.y = G.cy; } }
        // a goal
        for (const [i, gx] of G.goals.entries()) if ((i === 0 && B.x < gx) || (i === 1 && B.x > gx)) { G.score[1 - i]++; G.cheer = 4; const sc = G.men.find((m) => m.side === (i === 0 ? -1 : 1) * -1) || G.men[0]; if (near(B.x, B.y, 520)) { O.Speech && O.Speech.say(sc.q, pick(['GOAL! GOAL!', 'Ours! It\'s ours!', 'Get in there!']), 2); O.sfx && O.sfx('handbell', 0.4); } B.x = (G.goals[0] + G.goals[1]) / 2; B.y = G.cy; B.vx = B.vy = 0; break; }
        if (G.cheer > 0) G.cheer -= dt;
        for (const m of G.men) { const q = m.q, a = q.agent; if (!q._shrove) continue; if (talking(q)) { rel(q); continue; } m.cool -= dt;
          if (G.cheer > 0) { a.forceAnim = 'celebrate'; continue; }
          const tx = B.x + m.off[0] * (Math.hypot(a.x - B.x, a.y - B.y) < 40 ? 0.3 : 1), ty = B.y + m.off[1] * 0.6; step(a, tx, ty, 58 + (q.id % 5) * 4, dt); a.forceAnim = 'run';
          if (Math.hypot(a.x - B.x, a.y - B.y) < 9 && m.cool <= 0) { m.cool = 0.6 + Math.random() * 0.5; const toward = m.side > 0 ? G.goals[1] : G.goals[0]; const ang = Math.atan2(G.cy - B.y + (Math.random() - 0.5) * 60, toward - B.x) + (Math.random() - 0.5) * 1.6; const v = 90 + Math.random() * 70; B.vx = Math.cos(ang) * v; B.vy = Math.sin(ang) * v * 0.7; a.forceAnim = 'attack'; if (Math.random() < 0.25 && near(a.x, a.y, 260)) O.sfx && O.sfx('smack', 0.15);
            if (Math.random() < 0.06) { a.forceAnim = 'hurt'; m.cool = 1.6; if (near(a.x, a.y, 260)) O.Speech && O.Speech.say(q, pick(['Ow! My shin!', 'Who did that?!', 'Get off me, you great ox!']), 1.8); } } }
        // you can kick it too
        const P = game.player; if (!P.locked && Math.hypot(P.x - B.x, P.y - B.y) < 10 && !(G.pc > 0)) { const d = O.Char.DIRV ? O.Char.DIRV[P.dir] || [1, 0] : [1, 0]; B.vx = d[0] * 150 + (Math.random() - 0.5) * 30; B.vy = d[1] * 110; G.pc = 0.5; G.kicks = (G.kicks || 0) + 1; O.sfx && O.sfx('smack', 0.25); } if (G.pc > 0) G.pc -= dt;
        // pancakes tossed at the doors
        for (const c of G.cooks) { const a = c.q.agent; if (!c.q._shrove) continue; c.next -= dt; a.forceAnim = c.next < 0.6 ? 'cook' : 'idle'; if (c.next <= 0) { c.next = 3 + Math.random() * 4; flips.push({ s, x: a.x + 6, y: a.y - 14, t: 0 }); if (Math.random() < 0.3 && near(a.x, a.y, 260)) O.Speech && O.Speech.say(c.q, pick(['Up she goes!', 'Who wants a pancake?', 'Mind the floor... oh, blast it.']), 1.8); } }
        return; }
      if (!shroveDay(s) || hr < 13 || hr >= 16 || (s.weather && s.weather.raining)) return; if (s._shroveDone === s.day && !forced) return; if (!s.Z || !s.Z.square) return; const [x0, y0, x1, y1] = s.Z.square; if (!near((x0 + x1) * 8, (y0 + y1) * 8, 700)) return;
      s._shroveDone = s.day; begin(s); forced = false;
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; const s = cur();
      if (G && G.s === s) { const B = G.ball, x = Math.round(B.x - cam.x), y = Math.round(B.y - cam.y); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 3, y + 1, 7, 2); const h = Math.min(6, Math.hypot(B.vx, B.vy) / 25); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(x - 3, y - 5 - h, 6, 5); ctx.fillStyle = '#c8b088'; ctx.fillRect(x - 2, y - 2 - h, 4, 1); ctx.fillStyle = '#8a6a44'; ctx.fillRect(x, y - 6 - h, 1, 1);
        // the goal marks at the two ends: a post with a rag
        for (const gx of G.goals) { const px = Math.round(gx - cam.x), py = Math.round(G.cy - cam.y); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(px, py - 26, 2, 26); ctx.fillStyle = gx < B.x ? '#c83030' : '#3050c8'; ctx.fillRect(px + 2, py - 26, 6, 4); } }
      for (const f of flips) { if (f.s !== s) continue; const k = f.t / 1.1, x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y - Math.sin(k * Math.PI) * 18); ctx.fillStyle = '#d8a850'; const w = Math.max(1, Math.round(5 * Math.abs(Math.cos(k * Math.PI * 3)))); ctx.fillRect(x - Math.floor(w / 2), y, w, 2); ctx.fillStyle = '#3a3a3a'; ctx.fillRect(Math.round(f.x - cam.x) - 3, Math.round(f.y - cam.y) + 2, 7, 1); } });
    (O.extraLines = O.extraLines || []).push((s, q) => !G || !q._shrove ? (shroveDay(s) ? 'It is Shrove Tuesday, the last day before Lent: pancakes, and the camp-ball in the streets this afternoon.' : '') : G.cooks.some((c) => c.q === q) ? 'It is Shrove Tuesday and you are tossing pancakes at your door.' : `You are playing in the Shrovetide camp-ball through the streets, muddy and bruised and loving it. The score is ${G.score[0]} to ${G.score[1]}.`);
    O.Shrovetide = { get game() { return G; }, get games() { return games; }, force: () => { forced = true; const s = cur(); if (s) s._shroveDone = -1; }, stop: end };
  }
  O.ShrovetideSetup = { setup };
})();
