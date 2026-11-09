// The bird-scarer. In spring, while the seed is in the ground, and again as the corn ripens, a child is
// set to stand out in the field all day with a wooden clapper, waving their arms and rattling it and
// singing out "Shoo, crows!" whenever the birds come down, and up they go cawing, to settle again at the far
// end. A penny a day for it, and very dull.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let J = null, cool = 10, scares = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    function end() { if (!J) return; const a = J.q.agent; if (a) { a.forceAnim = null; if (!talking(J.q)) a.frozen = false; } J.q._scarer = false; J = null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60, season = s.season === 'spring' || s.season === 'summer';
      if (J) { J.t += dt; const a = J.q.agent; if (J.s !== s || !a || !season || hr > 18 || s.raining || talking(J.q) || J.t > 240) { end(); return; }
        J.next -= dt; const F = O.Countryside && O.Countryside.features(); const crows = F ? F.crows.filter((c) => c.st === 'ground' && Math.hypot(c.x - a.x, c.y - a.y) < 140) : [];
        if (crows.length && J.next <= 0) { J.next = 2.5; J.wave = 1.4; scares++; for (const c of crows) { c.st = 'fly'; c.vx = (c.x - a.x) * 1.5 + (Math.random() - 0.5) * 40; c.vy = (Math.random() - 0.5) * 30; c.vz = 60; c.air = 3 + Math.random() * 3; } if (near(a.x, a.y, 300)) { O.sfx && O.sfx('smack', 0.15); setTimeout(() => O.sfx && O.sfx('smack', 0.15), 150); setTimeout(() => O.sfx && O.sfx('smack', 0.12), 300); O.animalCall && O.animalCall('crow', 0.25); if (Math.random() < 0.5) O.Speech && O.Speech.say(J.q, pick(['Shoo, crows! Shoo!', 'Hoo-ah! Get off!', 'Away with you, black devils!']), 1.8); } }
        if (J.wave > 0) { J.wave -= dt; a.forceAnim = Math.floor(J.wave * 6) % 2 ? 'wave' : 'celebrate'; } else { a.forceAnim = Math.floor(J.t / 6) % 5 === 4 ? 'yawn' : Math.floor(J.t / 6) % 5 === 2 ? 'sit' : 'idle'; if (!J.bored && J.t > 60 && near(a.x, a.y, 260)) { J.bored = true; O.Speech && O.Speech.say(J.q, pick(['So boring...', 'I\'d rather be at the river.', 'One more hour.']), 2); } }
        return; }
      cool -= dt; if (cool > 0) return; cool = 20 + Math.random() * 20; if (!season || hr < 8 || hr > 16 || s.raining) return;
      const F = O.Countryside && O.Countryside.features(); if (!F || !F.scare.length) return; const P = game.player, spot = F.scare.filter((x) => Math.hypot(x.x - P.x, x.y - P.y) < 500)[0]; if (!spot) return;
      const q = s.people.find((x) => x.age >= 7 && x.age <= 12 && x.agent && !x.agent.frozen && !x.errand && !x._bit && !x._scene && !x._playing && !x._kid2 && !x._scarer && !talking(x) && ((!x.agent.hidden && x.agent.inside == null) || x.agent.inside === x.home) && ['play', 'idle', 'home', 'stroll', 'pastime-none'].includes(x.activity?.act) && Math.hypot(x.agent.x - spot.x, x.agent.y - spot.y) < 800); if (!q) return;
      q._scarer = true; const tx = Math.floor((spot.x + 30) / T), ty = Math.floor(spot.y / T);
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.2, face: 0, giveUp: game.t + 60, after: (ok) => { if (!ok || !q.agent) { q._scarer = false; return; } q.agent.frozen = true; q.agent.path = null; q.agent.dir = 0; J = { s, q, t: 0, next: 1, wave: 0 }; } });
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (!J || game.scene || J.s !== cur()) return; const a = J.q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); const up = J.wave > 0 && Math.floor(J.wave * 6) % 2; ctx.fillStyle = '#8a6a44'; ctx.fillRect(x + 5, y - (up ? 26 : 16), 2, 6); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 4, y - (up ? 26 : 16), 4, 2); });
    (O.extraLines = O.extraLines || []).push((s, q) => J && J.q === q ? 'You have been set to scare the crows off the sown field all day with a wooden clapper, for a penny. It is very dull.' : '');
    O.BirdScarer = { get job() { return J; }, get scares() { return scares; }, soon: () => { cool = 0; } };
  }
  O.BirdScarerSetup = { setup };
})();
