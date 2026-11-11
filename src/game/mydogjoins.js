// Your dog joins in. A dog of your own at heel isn't just company: when a bull is loose you can send a dog
// that knows how to herd to turn it, and it does (heading it, nipping at its heels, until it stands for the
// rope); and if you're feeling wicked you can set it on the goose girl's geese, which scatter in a white
// honking explosion while she screams at you.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let J = null, turned = 0, scattered = 0;
    const mine = () => (O.fauna || []).find((f) => f.mine && f.kind === 'dog' && !f.dead && f.mode === 'heel');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    game.hooks.update.push((dt) => { if (!J) return; const d = J.dog; J.t += dt; d._held = game.t + 0.5; d.tx = null;
      const T = J.kind === 'bull' ? (O.LooseBull && O.LooseBull.bull) : (O.GooseGirl && O.GooseGirl.flock); if (!T || J.t > 14) { J = null; return; }
      const tx = J.kind === 'bull' ? T.bull.x + Math.cos(J.t * 3) * 22 : T.geese[0].x + Math.cos(J.t * 4) * 14, ty = J.kind === 'bull' ? T.bull.y + Math.sin(J.t * 3) * 14 : T.geese[0].y + Math.sin(J.t * 4) * 10;
      const dx = tx - d.x, dy = ty - d.y, dd = Math.hypot(dx, dy); if (dd > 2) { const v = Math.min(dd, 110 * dt); d.x += dx / dd * v; d.y += dy / dd * v; d.moving = true; d.dir = dx > 0 ? 2 : 1; }
      if (Math.random() < dt * 2.5 && near(d.x, d.y, 300)) O.animalCall && O.animalCall('dog', 0.35);
      if (J.kind === 'bull' && J.t > 4 && T.phase === 'loose') { T.bull.paw = 3; T.t = Math.max(T.t, 22); for (const q of T.men) { q.agent.x += (T.bull.x - q.agent.x) * 0.3; q.agent.y += (T.bull.y - q.agent.y) * 0.3; } }
      if (J.kind === 'geese' && !J.done) { J.done = true; for (const g of T.geese) { g.chase = 0; g.x += (Math.random() - 0.5) * 60; g.y += (Math.random() - 0.5) * 40; } } });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, d = mine(); if (!d || J || game.scene || P.locked) return null;
      const B = O.LooseBull && O.LooseBull.bull; if (B && B.phase === 'loose' && near(B.bull.x, B.bull.y, 160) && ((d.skills || {}).herd || 0) >= 2) return { type: 'custom', d: 999, x: P.x, y: P.y - 30, label: `Send ${d.name || 'your dog'} to turn the bull`, act: () => { J = { kind: 'bull', dog: d, t: 0 }; turned++; d.bond = Math.min(1, (d.bond || 0) + 0.05); O.UI && O.UI.say && O.UI.say(`${d.name || 'Your dog'} goes in low and quick, and the bull swings round to face it and stands.`, 'good'); if (B.men[0]) setTimeout(() => O.Speech && O.Speech.say(B.men[0], pick(['Good dog! Hold him there!', 'Whose dog is that? A fine worker!']), 2.2), 1500); } };
      const G = O.GooseGirl && O.GooseGirl.flock; if (G && near(G.geese[0].x, G.geese[0].y, 120)) return { type: 'custom', d: 999, x: P.x, y: P.y - 30, label: `Set ${d.name || 'your dog'} on the geese`, act: () => { J = { kind: 'geese', dog: d, t: 0 }; scattered++; O.sfx && O.sfx('honk', 0.4); setTimeout(() => O.Speech && O.Speech.say(G.girl, pick(['You WRETCH! Call it off! Call it off!', 'My geese! I\'ll tell my father on you!', 'Devil take you and your cur!']), 2.6), 600); if (O.PlayerState.rep) O.PlayerState.rep.civilian = Math.max(-1, (O.PlayerState.rep.civilian || 0) - 0.01); } };
      return null; });
    O.MyDogJoins = { get turned() { return turned; }, get scattered() { return scattered; } };
  }
  O.MyDogJoinsSetup = { setup };
})();
