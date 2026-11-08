// Things drawn by hand (riders, hounds, carts, sailors) go behind buildings like everyone else: a figure
// whose feet are in the strip of ground a building's front covers isn't drawn over that building.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    let cacheW = null, list = [];
    O.occluded = (x, y) => {
      const w = game.world; if (!w || game.scene) return false; if (w !== cacheW) { cacheW = w; list = w.buildings.filter((b) => b.sprite).map((b) => ({ x0: b.x * T - (b.sprite.OV || 0), x1: (b.x + b.w) * T + (b.sprite.OV || 0), y1: (b.bottom + 1) * T, y0: (b.bottom + 1) * T - b.sprite.H + 8 })); }
      for (const r of list) if (x > r.x0 + 2 && x < r.x1 - 2 && y < r.y1 - 2 && y > r.y0) return true;
      return false;
    };
  }
  O.OccludeSetup = { setup };
})();
