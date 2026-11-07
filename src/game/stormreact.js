// Thunder makes people jump. When it cracks, folk out of doors flinch and look up, children squeal and
// run for home, a dog howls; someone crosses themselves.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const hook = () => { const S = O.Sound; if (!S || !S.play || S._storm) return; S._storm = true; const _p = S.play; S.play = function (k, v) { const r = _p.apply(this, arguments); try { if (k === 'thunder' && !game.scene) react(v || 1); } catch (e) { /* */ } return r; }; };
    function react(v) { const s = cur(); if (!s) return; let said = false;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || Math.hypot(a.x - game.player.x, a.y - game.player.y) > 450) continue;
        if (q.age < 12 && !a.frozen && !q.errand && O.Errands && Math.random() < 0.6 * v) { const b = s.building(q.home); if (b && b.doorX != null) { O.Errands.send(s, q, [b.doorX, b.doorY + 1], { sprint: true, anim: 'idle', secs: 0.3, face: 0, giveUp: game.t + 40, after: () => { q.agent.inside = b.id; q.agent.hidden = true; } }); if (!said && Math.random() < 0.5) { said = true; O.Speech && O.Speech.say(q, pick(['Eeek!', 'Mam!', 'I\'m going home!']), 1.2); } continue; } }
        O.gesture && O.gesture(q, Math.random() < 0.3 ? 'pray' : 'shocked', 1 + Math.random()); }
      if (Math.random() < 0.4) setTimeout(() => O.animalCall && O.animalCall('dog', 0.3), 600); }
    setTimeout(hook, 0); game.hooks.update.unshift(hook);
    O.StormReact = { react };
  }
  O.StormReactSetup = { setup };
})();
