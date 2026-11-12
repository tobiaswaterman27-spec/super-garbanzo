// Join the children. Stand by a game long enough and you're part of it: a ball that rolls to your feet can be
// sent back with a good kick (to cheers, or jeers if you scuff it); you can take a turn at the skipping
// rope, be "it" at tag, or bend your back at leapfrog. The children take to someone who plays, and say so at
// home; and their mothers think the better of you for it.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const played = new Map(); let kicks = 0, joins = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const like = (s, kids) => { for (const k of kids) { const r = k.rel.get(0) || { affinity: 0, familiar: 0 }; r.affinity = Math.min(1, r.affinity + 0.08); r.familiar = Math.min(1, (r.familiar || 0) + 0.1); k.rel.set(0, r); } const mums = new Set(kids.map((k) => k.home)); for (const q of s.people) if (q.age >= 18 && mums.has(q.home)) { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; r.affinity = Math.min(1, r.affinity + 0.03); q.rel.set(0, r); } };
    const say = (q, t) => O.Speech && O.Speech.say(q, t, 1.8);
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, KP = O.KidsPlay; if (!KP || game.scene || P.locked) return null; const s = cur();
      for (const g of KP.games) { if (!g.kids || !g.kids.length) continue;
        if (g.kind === 'football' && g.ball && near(g.ball.x, g.ball.y, 22) && g.ball.z < 2) return { type: 'custom', d: 22, x: g.ball.x, y: g.ball.y - 20, label: 'Kick the ball back to them', act: () => { const b = g.ball, k = pick(g.kids), good = Math.random() < 0.75; kicks++; P.anim = 'attack'; setTimeout(() => { P.anim = 'idle'; }, 500); O.sfx && O.sfx('smack', 0.3);
          if (good) { const dx = k.agent.x - b.x, dy = k.agent.y - b.y, d = Math.hypot(dx, dy) || 1; b.vx = dx / d * 150; b.vy = dy / d * 110; b.vz = 90; say(k, pick(['Good kick, mister!', 'Again! Again!', 'Ooh, high!'])); like(s, g.kids); }
          else { b.vx = (Math.random() - 0.5) * 60; b.vy = 40; b.vz = 10; say(k, pick(['Ha! You scuffed it!', 'My granny kicks better than that!'])); } } };
        if (g.kind !== 'football' && near(g.cx, g.cy, 50) && played.get(g) !== true) { const lbl = { skipping: 'Take a turn at the skipping rope', tag: 'Join in their game of tag', leapfrog: 'Bend your back for leapfrog', hopscotch: 'Try a hop at the hopscotch', hoop: 'Have a go with the hoop', hideseek: 'Help them seek' }[g.kind]; if (!lbl) continue;
          return { type: 'custom', d: 50, x: g.cx, y: g.cy - 26, label: lbl, act: () => { played.set(g, true); joins++; like(s, g.kids); P.anim = { skipping: 'celebrate', tag: 'run', leapfrog: 'crouch', hopscotch: 'celebrate', hoop: 'run', hideseek: 'look' }[g.kind] || 'celebrate'; P.locked = true; setTimeout(() => { P.locked = false; P.anim = 'idle'; }, 2200);
            const k = pick(g.kids); say(k, { skipping: 'One, two, three... you tripped! Ha!', tag: 'You\'re it! You\'re it!', leapfrog: 'Get down lower! I can\'t get over!', hopscotch: 'You stepped on the line!', hoop: 'Faster! Faster!', hideseek: 'I see Wat behind the barrel!' }[g.kind]); setTimeout(() => say(pick(g.kids), 'Will you play tomorrow?'), 2000);
            try { s.remember(k, 'A grown-up stranger played with us in the lane.', 'social', 0.5); } catch (e) { /* */ } } }; } }
      return null; });
    O.PlayWithKids = { get kicks() { return kicks; }, get joins() { return joins; } };
  }
  O.PlayWithKidsSetup = { setup };
})();
