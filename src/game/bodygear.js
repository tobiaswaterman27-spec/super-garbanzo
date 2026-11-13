// What you carry shows on you. Your satchel hangs at your hip on a strap across the chest, flat when it's
// empty of all but a crust and bulging with a bread end poking out when you're laden; pedlars, carriers,
// pilgrims and anyone on the road wear theirs too. Folk notice a fat satchel, and so do cutpurses.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const level = (n) => n <= 0 ? 0 : n <= 2 ? 1 : n <= 6 ? 2 : 3;
    const ROAD = /pedlar|peddler|chapman|trader|carrier|messenger|pilgrim|tinker|drover|packman|merchant/;
    let tick = 0; const done = new WeakSet();
    function setPack(app, v) { if (!app || !app.outfit || (app.outfit.pack || 0) === v) return; app.outfit.pack = v; O.Char.invalidate(app); }
    game.hooks.update.push((dt) => { tick -= dt; if (tick > 0) return; tick = 0.5; const P = game.player;
      if (P && P.a) setPack(P.a, level((PS.items || []).length));
      const s = cur(); if (!s || !s.people) return;
      for (const q of s.people) { if (!q.app || done.has(q)) continue; done.add(q); if (q.age >= 14 && (q.visitor || ROAD.test(q.job?.role || ''))) setPack(q.app, q.visitor ? 2 : 1); } });
    (O.extraLines = O.extraLines || []).push(() => { const n = (PS.items || []).length; return n >= 7 ? 'The player\'s satchel is bulging: they are carrying a good deal.' : ''; });
    O.BodyGear = { level };
  }
  O.BodyGearSetup = { setup };
})();
