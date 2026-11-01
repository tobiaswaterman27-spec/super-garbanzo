// The hue and cry. When the watch gives chase it isn't one man puffing after you: the nearest guards
// take it up. One runs you down, others read where you're heading and cut across to meet you there,
// one makes for the way out of town and holds it, and when two or three are near they spread and close
// in from different sides. Lose them and they go to where you were last seen, cast about, and ask the
// people standing there; your friends may point the wrong way. Keep still behind the hay or a stack of
// barrels and they may pass you by. Get away, and for a day or two the watch have sharper eyes.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const isWatch = (q) => /^guard|sergeant|watch|constable/.test(q.job?.role || '') && !q.agent.hidden && q.alive !== false && q.activity?.act !== 'sleep' && !q.health?.illness && !q.isPlayer;
    let sq = null; // { members: [{ q, role, path, pi, re }], seen: {x,y,t}, vel, mode, lostT, searchT, asked }
    const say = (q, t) => O.Speech && O.Speech.say(q, t, 3, 'angry');
    function begin(lead) {
      const s = cur(), P = game.player;
      const others = s.people.filter((q) => q !== lead && isWatch(q) && q.agent.inside == null && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 720).sort((a, b) => Math.hypot(a.agent.x - P.x, a.agent.y - P.y) - Math.hypot(b.agent.x - P.x, b.agent.y - P.y)).slice(0, 5);
      const roles = ['cut', 'cut', 'hold', 'chase', 'cut'];
      sq = { members: others.map((q, i) => ({ q, role: roles[i], path: null, pi: 0, re: 0 })), seen: { x: P.x, y: P.y, t: 0 }, vel: [0, 0], last: [P.x, P.y], mode: 'chase', lostT: 0, searchT: 0, asked: 0, t: 0 };
      for (const m of sq.members) { m.q.agent.chasing = true; m.q.agent.path = null; }
      O.sfx && O.sfx('horn', 1, false);
      setTimeout(() => { for (const m of sq ? sq.members.slice(0, 2) : []) say(m.q, m.role === 'hold' ? 'I\'ll hold the road!' : ['Cut them off!', 'This way! Head them off!', 'Round the back, quick!'][m.q.id % 3]); }, 600);
    }
    function release(escaped) {
      if (!sq) return; for (const m of sq.members) { const a = m.q.agent; a.chasing = false; a.path = null; a.goal = null; a.anim = 'idle'; }
      if (escaped) { const s = cur(); PS.alert = { place: s.world.placeId, until: s.day + 2 }; s.log('The watch lost the stranger in the lanes. They are on the alert.', 'crime'); }
      sq = null;
    }
    // can the watch see you? (keeping still beside cover, only from close by)
    function visible() {
      const s = cur(), P = game.player; if (game.scene) return false;
      const hidden = !P.moving && s.world.props.some((pr) => /hay|haycock|stook|barrel|crate|woodpile|cart|bush/.test(pr.kind) && Math.hypot(pr.x - P.x, pr.y - P.y) < 18);
      const reach = hidden ? 46 : 210, lead = O.Law.lead();
      return [lead, ...sq.members.map((m) => m.q)].some((q) => q && !q.agent.hidden && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < reach);
    }
    // a walkable tile near a point
    function ground(s, x, y) {
      const w = s.world; let tx = Math.floor(x / T), ty = Math.floor(y / T);
      for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = tx + dx, Y = ty + dy; if (X < 1 || Y < 1 || X >= w.W - 1 || Y >= w.H - 1) continue; const i = Y * w.W + X; if (!w.solid[i] && (!w.ter || w.ter[i] !== w.TER.WATER)) return [X, Y]; }
      return [tx, ty];
    }
    function step(m, tx, ty, speed, dt) {
      const s = cur(), a = m.q.agent; m.re -= dt;
      if (m.re <= 0 || !m.path || m.goal !== tx + ',' + ty) { m.re = 0.6; m.goal = tx + ',' + ty; const [gx, gy] = ground(s, tx, ty); m.path = s.path.find(Math.floor(a.x / T), Math.floor((a.y - 1) / T), gx, gy) || []; m.pi = 0; m.end = [gx * T + 8, gy * T + 10]; }
      let budget = speed * dt, moved = false;
      while (budget > 0) {
        let px, py; if (m.pi < m.path.length) { [px, py] = m.path[m.pi]; px = px * T + 8; py = py * T + 10; } else if (m.end) { [px, py] = m.end; } else break;
        const dx = px - a.x, dy = py - a.y, d = Math.hypot(dx, dy);
        if (d <= budget) { a.x = px; a.y = py; budget -= d; moved = true; if (m.pi < m.path.length) m.pi++; else { m.end = null; break; } }
        else { a.x += (dx / d) * budget; a.y += (dy / d) * budget; budget = 0; moved = true; }
        if (d > 0.01) a.dir = O.dirOf(dx, dy);
      }
      a.anim = moved ? 'run' : 'look';
    }
    // the way out of town in the direction you're running: a road tile at the town's edge
    function exitAhead(s, P, vel) {
      const w = s.world, sp = Math.hypot(vel[0], vel[1]) || 1, ux = vel[0] / sp, uy = vel[1] / sp;
      for (let k = 10; k < 40; k += 2) { const x = P.x + ux * k * T, y = P.y + uy * k * T, tx = Math.floor(x / T), ty = Math.floor(y / T), i = ty * w.W + tx; if (w.ter && (w.ter[i] === w.TER.BRIDGE || (w.ter[i] === w.TER.ROAD && k > 18))) return [x, y]; }
      return [P.x + ux * 14 * T, P.y + uy * 14 * T];
    }
    let t0 = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !O.Law) return;
      const lead = O.Law.lead();
      if (lead && !sq) begin(lead);
      if (!lead && sq) release(sq.mode === 'search'); // (the lead gave up the search: you got away)
      if (!sq) return;
      const P = game.player; sq.t += dt;
      // where you're heading
      t0 += dt; if (t0 > 0.3) { sq.vel = [(P.x - sq.last[0]) / t0, (P.y - sq.last[1]) / t0]; sq.last = [P.x, P.y]; t0 = 0; }
      const seen = visible();
      if (game.scene) { sq.seen = { x: game.scene.b.doorX * T + 8, y: (game.scene.b.doorY + 1) * T + 8, t: sq.t }; } // (they saw you go in)
      else if (seen) { sq.seen = { x: P.x, y: P.y, t: sq.t }; sq.mode = 'chase'; sq.lostT = 0; }
      else { sq.lostT += dt; if (sq.lostT > 3 && sq.mode === 'chase') { sq.mode = 'search'; sq.searchT = 0; for (const m of sq.members.slice(0, 1)) say(m.q, 'Where did they go? Spread out!'); } }
      // bystanders call out where you went
      if (seen && Math.random() < dt * 0.5) { const by = s.people.find((q) => !q.agent.hidden && q.agent.inside == null && !isWatch(q) && q.age >= 10 && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 70 && ((q.rel.get(0) || {}).affinity || 0) < 0.25); if (by) { O.Speech && O.Speech.say(by, ['Stop, thief!', 'There they go!', 'That way!'][by.id % 3], 2.2); O.gesture && O.gesture(by, 'point', 1.4); } }
      // the search: cast about where you were last seen; ask whoever's standing there
      if (sq.mode === 'search') {
        sq.searchT += dt;
        if (!sq.asked && sq.searchT > 4) { sq.asked = 1; const by = s.people.filter((q) => !q.agent.hidden && q.agent.inside == null && !isWatch(q) && q.age >= 10).sort((a, b) => Math.hypot(a.agent.x - sq.seen.x, a.agent.y - sq.seen.y) - Math.hypot(b.agent.x - sq.seen.x, b.agent.y - sq.seen.y))[0];
          if (by && Math.hypot(by.agent.x - sq.seen.x, by.agent.y - sq.seen.y) < 200) { const m0 = sq.members[0]; m0 && say(m0.q, 'You! Which way did they go?'); const friend = ((by.rel.get(0) || {}).affinity || 0) > 0.3;
            setTimeout(() => { if (!sq) return; if (friend) { O.Speech && O.Speech.say(by, ['Over the bridge, I think.', 'I saw nobody.', 'That way, toward the mill.'][by.id % 3], 3); sq.seen = { x: sq.seen.x - sq.vel[0] * 6, y: sq.seen.y - sq.vel[1] * 6, t: sq.t }; s.relate && s.relate(by, { id: 0 }, 0.05); s.remember(by, 'Sent the watch the wrong way for the stranger.', 'crime', 1.2, 0.1); }
              else { O.Speech && O.Speech.say(by, 'That way!', 2.5); O.gesture && O.gesture(by, 'point', 1.5); sq.seen = { x: P.x + (Math.random() - 0.5) * 60, y: P.y + (Math.random() - 0.5) * 60, t: sq.t }; } }, 1200); } }
        if (sq.searchT > 28) { const ld = O.Law.lead(); release(true); if (ld) O.Law.endChase(true); return; }
      }
      // each to their part
      const near = [O.Law.lead(), ...sq.members.map((m) => m.q)].filter((q) => q && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 90);
      sq.members.forEach((m, i) => {
        const a = m.q.agent; if (a.hidden || m.q.alive === false) return;
        const d = Math.hypot(a.x - P.x, a.y - P.y);
        if (sq.mode === 'chase' && !game.scene && d < 12) { const ld = O.Law.lead(); release(false); if (ld) ld.agent.chasing = true; O.Law.arrestBy(m.q); return; }
        let tx, ty, sp = 80;
        if (sq.mode === 'search' || game.scene) { const ang = (m.q.id * 2.4 + sq.searchT * 0.3) % 6.28, r = Math.min(90, 20 + sq.searchT * 4); tx = sq.seen.x + Math.cos(ang) * r; ty = sq.seen.y + Math.sin(ang) * r; sp = 62; }
        else if (near.length >= 2 && d < 90) { const ang = (i / Math.max(1, sq.members.length)) * 6.28 + Math.atan2(sq.vel[1], sq.vel[0]); tx = P.x + Math.cos(ang) * 14; ty = P.y + Math.sin(ang) * 14; sp = 84; } // close in from all sides
        else if (m.role === 'chase') { tx = P.x; ty = P.y; sp = 84; }
        else if (m.role === 'hold') { if (!m.hold) m.hold = exitAhead(s, P, sq.vel); [tx, ty] = m.hold; sp = 86; }
        else { tx = P.x + sq.vel[0] * 2.4; ty = P.y + sq.vel[1] * 2.4; sp = 82; } // where you'll be in a moment
        step(m, tx, ty, sp, dt);
      });
    });
    O.Pursuit = {
      holding: () => !!(sq && sq.mode === 'chase'),
      target: () => (sq && sq.mode === 'search' ? [sq.seen.x, sq.seen.y] : null), // (lost: the lead goes where you were last seen, not where you are)
      rangeMul: () => { const s = cur(); return PS.alert && s && PS.alert.place === s.world.placeId && s.day <= PS.alert.until ? 1.6 : 1; },
      state: () => sq && { mode: sq.mode, members: sq.members.map((m) => [m.q.first, m.role, Math.round(m.q.agent.x), Math.round(m.q.agent.y)]) },
    };
  }
  O.PursuitSetup = { setup };
})();
