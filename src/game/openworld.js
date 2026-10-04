// Walking the island. You are always in the region of the nearest settlement; when you walk far enough
// that another town is nearer, you are in that town's region instead. The two regions overlap and share
// the same countryside, so nothing changes on screen: the land, the road under your feet and the light
// stay exactly where they were. Only the people who come and go are now the next town's.
'use strict';
(function () {
  function setup(game, home) {
    const I = O.Island, T = 16;
    const now = () => home.day * 1440 + home.minute;
    let inTownShown = null, cool = 0;

    function switchTo(id) {
      const w0 = game.world, p = game.player;
      const [gx, gy] = I.toGlobal(w0, p.x, p.y);
      const leaving = O.Travel.visited.get(w0.placeId); if (leaving && leaving.sim !== home) leaving.leftAt = now();
      const v = O.Travel.ensure(id);
      if (v.leftAt != null && v.sim !== home) { const missed = Math.min(240, now() - v.leftAt); for (let i = 0; i < missed / 2; i++) v.sim.tick(2); v.leftAt = now(); }
      O.SimRef.cur = v.sim;
      game.load(v.world); O.applySeason && O.applySeason();
      const [lx, ly] = I.toLocal(v.world, gx, gy); p.x = lx; p.y = ly;
      if (p.mount) { p.mount.world = id; p.mount.x = p.x; p.mount.y = p.y; }
      game.update(0); // settle the camera on the same spot
    }
    O.OpenWorld = { switchTo };

    game.hooks.update.push((dt) => {
      cool = Math.max(0, cool - dt);
      const w = game.world; if (!w || !w.island || game.scene || cool > 0) return;
      const p = game.player, [gx, gy] = I.toGlobal(w, p.x, p.y), tx = gx / T, ty = gy / T;
      const own = I.ownerAt(tx, ty);
      if (own && own.id !== w.placeId) {
        const [cx, cy] = I.centre(w.placeId), [ox, oy] = I.centre(own.id);
        if (Math.hypot(tx - cx, ty - cy) > Math.hypot(tx - ox, ty - oy) + 3) { switchTo(own.id); cool = 0.5; return; }
      }
      // coming into a town, or leaving it for open country
      const tlx = p.x / T - w.ox, tly = p.y / T - w.oy, inside = tlx >= 0 && tly >= 0 && tlx < (w.townW || 1e9) && tly < (w.townH || 1e9);
      const key = inside ? w.placeId : null;
      if (key !== inTownShown) { if (key) O.UI.say(`You come into ${w.name}.`); else if (inTownShown) { const r = O.Eldoria.regionName(gx / T / I.U, gy / T / I.U); O.UI.say(`You leave ${O.Island.data().place(inTownShown)?.name || 'the town'} behind for ${r}.`); } inTownShown = key; }
    });
  }
  O.OpenWorldSetup = { setup };
})();
