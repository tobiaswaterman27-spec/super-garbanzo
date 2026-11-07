// Making way for the quality. When one of the gentry rides by (riders.js puts them on horseback),
// common folk near the road step aside and bow or bob a curtsy, children stare and point.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const gentle = (q) => q.age >= 16 && (/lord|lady|knight|baron|count|duke|earl|squire/.test(q.job?.role || '') || (!q.visitor && !!(q.gentry || q.title)));
    let t = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || game.scene) return; t -= dt; if (t > 0) return; t = 0.8;
      const P = game.player;
      for (const q of s.people) { const a = q.agent; if (!a || !a.mount || a.hidden || a.inside != null || !gentle(q) || Math.hypot(a.x - P.x, a.y - P.y) > 500) continue;
        for (const o of s.people) { if (o === q || gentle(o) || !o.agent || o.agent.hidden || o.agent.inside != null || o.agent.frozen || o.age < 6 || o._bowedTo === q || Math.hypot(o.agent.x - a.x, o.agent.y - a.y) > 70) continue; o._bowedTo = q; O.gesture && O.gesture(o, o.age < 12 ? 'point' : o.sex === 'f' ? 'curtsy' : 'bow', 1.3); } }
    });
    O.GentryRide = { gentle };
  }
  O.GentryRideSetup = { setup };
})();
