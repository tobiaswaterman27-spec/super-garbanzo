// A* on the tile grid. Roads are cheap, fields and woods are slow, solid tiles are impassable.
'use strict';
(function () {
  function makePathfinder(world) {
    const { W, H, ter, solid, TER } = world;
    const cost = new Float32Array(W * H);
    const recost = () => {
      for (let i = 0; i < W * H; i++) {
        const t = ter[i];
        cost[i] = solid[i] ? 0 : t === TER.ROAD || t === TER.COBBLE || t === TER.BRIDGE ? 1 : t === TER.YARD ? 1.2 : t === TER.FIELD ? 3 : t === TER.FOREST ? 2.6 : t === TER.SAND ? 1.8 : 1.6;
      }
    };
    recost();
    const cache = new Map();
    const g = new Float32Array(W * H), from = new Int32Array(W * H), closed = new Int32Array(W * H), stamp = new Int32Array(W * H);
    let run = 0;
    function find(sx, sy, tx, ty) {
      const key = sx + ',' + sy + '>' + tx + ',' + ty;
      if (cache.has(key)) return cache.get(key);
      run++;
      const start = sy * W + sx, goal = ty * W + tx;
      const open = [];
      const push = (i, f) => { open.push([f, i]); let k = open.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (open[p][0] <= open[k][0]) break; [open[p], open[k]] = [open[k], open[p]]; k = p; } };
      const pop = () => { const top = open[0]; const last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === k) break; [open[m], open[k]] = [open[k], open[m]]; k = m; } } return top; };
      const h = (i) => Math.abs((i % W) - tx) + Math.abs(((i / W) | 0) - ty);
      stamp[start] = run; g[start] = 0; from[start] = -1;
      push(start, h(start));
      let found = false, iter = 0;
      const LIMIT = Math.max(20000, Math.min(160000, (W * H) >> 1)); // a big city with one bridge needs a long search
      while (open.length && iter++ < LIMIT) {
        const [, i] = pop();
        if (i === goal) { found = true; break; }
        if (closed[i] === run) continue;
        closed[i] = run;
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          const c = j === goal ? Math.max(1, cost[j]) : cost[j]; if (!c) continue;
          if (dx && dy && (!cost[y * W + nx] || !cost[ny * W + x])) continue; // no corner cutting
          const ng = g[i] + c * (dx && dy ? 1.414 : 1);
          if (closed[j] !== run && (stamp[j] !== run || ng < g[j])) { stamp[j] = run; g[j] = ng; from[j] = i; push(j, ng + h(j) * 1.15); }
        }
      }
      let path = null;
      if (found) { path = []; for (let i = goal; i !== -1 && i !== start; i = from[i]) path.push([i % W, (i / W) | 0]); path.reverse(); }
      if (cache.size > 4000) cache.clear();
      cache.set(key, path);
      return path;
    }
    return { find, recost, clear: () => cache.clear() };
  }
  O.Path = { makePathfinder };
})();
