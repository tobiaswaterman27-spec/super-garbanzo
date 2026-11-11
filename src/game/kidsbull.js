// Playing at bulls. The day a bull gets loose, the children can talk of nothing else, and by afternoon
// they're playing it in the lane: one is the bull, fingers up for horns, bellowing and charging; the rest
// scatter shrieking; and the biggest has a bit of string for a rope and finally "ropes" the bull, to
// cheers, and then it's someone else's turn to be the bull.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let G = null, played = 0, lastDay = -1;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._kidbull && !q._bit && !q._scene && !talking(q);
    function end() { if (!G) return; for (const q of G.kids) { q._kidbull = false; if (q.agent) q.agent.forceAnim = null; } G = null; }
    function runTo(s, q, x, y, anim) { O.Errands.send(s, q, [Math.floor(x / T), Math.floor(y / T)], { anim, secs: 0.4, face: 0, sprint: true, giveUp: game.t + 6 }); }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (G) { G.t += dt; G.next -= dt; if (G.s !== s || G.t > 45 || G.kids.some((q) => talking(q) || q.alive === false)) { end(); return; }
        if (G.next <= 0) { G.next = 2.2; const bull = G.kids[G.bi], ba = bull.agent;
          if (G.t > 30 && !G.roped) { G.roped = true; const rp = G.kids[(G.bi + 1) % G.kids.length]; if (!rp.errand) runTo(s, rp, ba.x + 10, ba.y, 'pitch'); if (near(ba.x, ba.y, 300)) { O.Speech && O.Speech.say(rp, pick(['GOT him! Hold still, bull!', 'Roped! I roped the bull!']), 2); setTimeout(() => O.Speech && O.Speech.say(bull, 'Moo... no fair!', 1.6), 1800); } return; }
          if (G.roped) { if (G.t > 38) { played++; end(); } return; }
          // the bull charges at someone; they scatter
          const victim = pick(G.kids.filter((q) => q !== bull)); if (!bull.errand) runTo(s, bull, victim.agent.x, victim.agent.y, 'shake');
          for (const q of G.kids) { if (q === bull || q.errand) continue; const a = q.agent, ang = Math.atan2(a.y - ba.y, a.x - ba.x) + (Math.random() - 0.5); runTo(s, q, a.x + Math.cos(ang) * 50, a.y + Math.sin(ang) * 36, 'laugh'); }
          if (Math.random() < 0.4 && near(ba.x, ba.y, 300)) O.Speech && O.Speech.say(Math.random() < 0.5 ? bull : victim, pick(['MOOOO! I\'m the bull!', 'Aaah! The bull! Run!', 'Can\'t catch me!', 'Grrr! Moo!']), 1.6); }
        return; }
      if (lastDay === s.day || hr < 12 || hr > 18) return; const caught = (O.LooseBull && O.LooseBull.caught) || 0; if (caught && s._bullCount !== caught) { s._bullCount = caught; s._bullDay = s.day; } if (s._bullDay !== s.day) return;
      const kids = s.people.filter((q) => able(q) && q.age >= 5 && q.age <= 11 && !q.agent.hidden && q.agent.inside == null && near(q.agent.x, q.agent.y, 360)).slice(0, 4); if (kids.length < 3) return;
      lastDay = s.day; for (const q of kids) q._kidbull = true; G = { s, kids, bi: Math.floor(Math.random() * kids.length), t: 0, next: 0 };
    });
    O.KidsBull = { get game() { return G; }, get played() { return played; }, start: () => { const s = cur(); s._bullDay = s.day; s._bullCount = (O.LooseBull && O.LooseBull.caught) || 1; lastDay = -1; } };
  }
  O.KidsBullSetup = { setup };
})();
