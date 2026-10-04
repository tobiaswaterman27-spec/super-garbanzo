// Personal space. People in the street don't walk through one another, through you, or through the
// horses and animals: anyone who comes too close is eased aside a little each frame (never into a wall,
// a tree or a bush), so a crowd parts and flows instead of passing through itself.
'use strict';
(function () {
  function setup(game) {
    const R = 9; // how close two people may stand, in pixels
    game.hooks.update.push(() => {
      const w = game.world, sim = O.SimRef.cur; if (!w || game.scene || !sim || sim.world !== w) return;
      const cam = game.cam || { x: 0, y: 0 }, x0 = cam.x - 80, y0 = cam.y - 80, x1 = cam.x + game.vw + 80, y1 = cam.y + game.vh + 80;
      // who's about: walking or standing townsfolk (not those sitting, lying, fighting or held in talk)
      const movers = [], fixed = [];
      for (const q of sim.people) {
        const a = q.agent; if (!a || a.hidden || q.alive === false) continue;
        if (a.x < x0 || a.y < y0 || a.x > x1 || a.y > y1) continue;
        if (a.frozen || a.chasing || a.anim === 'sit' || a.anim === 'lie' || a.anim === 'doze' || a.offPath) fixed.push(a); else movers.push(a);
      }
      for (const a of game.actors) if ((a.horse || a.animal || a.traveller || a.gangster || a.cart) && a.x > x0 && a.y > y0 && a.x < x1 && a.y < y1) fixed.push(a);
      if (!game.player.hidden) fixed.push(game.player);
      if (!movers.length) return;
      // a coarse grid so each person only looks at their neighbours
      const grid = new Map(), key = (x, y) => (Math.floor(x / 24) * 4096 + Math.floor(y / 24));
      for (const a of [...movers, ...fixed]) { const k = key(a.x, a.y); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(a); }
      const free = (x, y) => !game.solidAt(x - 3, y - 2) && !game.solidAt(x + 3, y - 2) && !game.solidAt(x, y);
      for (const a of movers) {
        if (a.lane && game.t > (a.laneT || 0)) a.lane = 0; // back to the middle once they're by
        let px = 0, py = 0;
        const gx = Math.floor(a.x / 24), gy = Math.floor(a.y / 24);
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const c = grid.get((gx + i) * 4096 + gy + j); if (!c) continue;
          for (const o of c) {
            if (o === a) continue;
            const r = o.horse || o.cart ? R + 9 : o.animal ? R + 2 : R;
            const dx = a.x - o.x, dy = (a.y - o.y) * 1.6, d = Math.hypot(dx, dy);
            // someone in the way ahead (coming the other way, or standing): step to your own right in good time,
            // as they will to theirs, instead of pressing face to face
            if (a.path && d < r * 2.6 && d > 0) {
              const hv = O.Char.DIRV[a.dir] || [0, 1], ahead = -(dx * hv[0] + dy / 1.6 * hv[1]), side = -dx * -hv[1] + -dy / 1.6 * hv[0];
              const oh = O.Char.DIRV[o.dir] || [0, 0], facing = !o.path || hv[0] * oh[0] + hv[1] * oh[1] < -0.3;
              if (ahead > 0 && Math.abs(side) < r && facing) { const k = (1 - d / (r * 2.6)) * 1.4; px += -hv[1] * k; py += hv[0] * k * 1.6; a.lane = 8; a.laneT = game.t + 1.2; }
            }
            if (d >= r || d === 0) { if (d === 0) px += (a.person ? a.person.id % 2 : 1) ? 1 : -1; continue; }
            const push = (r - d) / r;
            px += dx / d * push; py += dy / d * push;
          }
        }
        if (!px && !py) continue;
        const step = 0.9, nx = a.x + px * step, ny = a.y + py * step * 0.6;
        if (free(nx, ny)) { a.x = nx; a.y = ny; } else if (free(nx, a.y)) a.x = nx; else if (free(a.x, ny)) a.y = ny;
      }
    });
  }
  O.Crowd = { setup };
})();
