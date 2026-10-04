// The whole island, built for walking. Every settlement on the map of Eldoria stands where the map puts
// it, twenty tiles to a map unit, in a region of real countryside: the forests, farmland, moors,
// marshes, hills, rivers, lakes and coast that the map shows, with the roads between the towns laid
// over it, bridges where they cross water, and the ruins of older times standing in the wild places.
//
// The island is too big to hold at once, so it is cut into regions: one round each settlement,
// reaching out past the halfway point to its neighbours. Neighbouring regions overlap, and the
// countryside in the overlap is the same in both (it is worked out from the island map, not stored),
// so walking from one region into the next is seamless: you are simply nearer the next town now.
'use strict';
(function () {
  const U = 20, T = 16, MARGIN = 64;
  const E = () => O.Eldoria, TER = () => O.Village.TER;
  let K = null;
  const towns = new Map(), regions = new Map();
  let RECTS = null;

  // the island's places and roads, straight from the map (the kingdom's own copies change with the
  // simulation; positions and roads never do)
  function data() {
    if (K) return K;
    const places = E().places((o) => o), roads = E().roads();
    K = { places, roads, place: (id) => places.find((p) => p.id === id), road: (a, b) => roads.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)), neighbours: (id) => roads.filter((r) => r.a === id || r.b === id).map((r) => (r.a === id ? r.b : r.a)) };
    return K;
  }
  function init() { data(); }
  const place = (id) => data().place(id);
  const centre = (id) => { const p = place(id); return [Math.round(p.x * U), Math.round(p.y * U)]; };

  // a settlement's own map, generated once (with its ways out towards every neighbour)
  function town(id) {
    if (towns.has(id)) return towns.get(id);
    const p = place(id);
    const w = id === 'ashford' ? O.Village.makeVillage(7) : O.Gen.makeSettlement(p);
    w.exits = id === 'ashford' ? w.exits : w.exits;
    O.Roads.attachExits(w, data());
    const [cx, cy] = centre(id);
    w.gx = cx - Math.floor(w.W / 2); w.gy = cy - Math.floor(w.H / 2);
    towns.set(id, w);
    return w;
  }
  // the global tile where a town's road towards a neighbour leaves its map
  function exitOf(id, nb) { const w = town(id), ex = w.exits[nb]; if (!ex) return centre(id); return [w.gx + ex.x, w.gy + ex.y, ex.side]; }

  // regions: every bit of land belongs to its nearest settlement; a region is that patch's bounding
  // box with a margin round it, and always the whole town
  function rects() {
    if (RECTS) return RECTS;
    const ps = data().places, box = new Map(ps.map((p) => [p.id, [1e9, 1e9, -1e9, -1e9]]));
    for (let uy = 0; uy < E().H; uy += 0.5) for (let ux = 0; ux < E().W; ux += 0.5) {
      if (!E().landAt(ux, uy)) continue;
      let best = null, bd = 1e9; for (const p of ps) { const d = (p.x - ux) ** 2 + (p.y - uy) ** 2; if (d < bd) { bd = d; best = p; } }
      const b = box.get(best.id); b[0] = Math.min(b[0], ux); b[1] = Math.min(b[1], uy); b[2] = Math.max(b[2], ux); b[3] = Math.max(b[3], uy);
    }
    RECTS = new Map();
    for (const p of ps) {
      const b = box.get(p.id); if (b[0] > b[2]) { b[0] = b[2] = p.x; b[1] = b[3] = p.y; }
      let x0 = Math.floor(b[0] * U) - MARGIN, y0 = Math.floor(b[1] * U) - MARGIN, x1 = Math.ceil(b[2] * U) + MARGIN, y1 = Math.ceil(b[3] * U) + MARGIN;
      RECTS.set(p.id, { x0, y0, x1, y1, own: b });
    }
    return RECTS;
  }
  function rectOf(id) {
    const r = rects().get(id), w = town(id);
    const x0 = Math.max(0, Math.min(r.x0, w.gx - 30)), y0 = Math.max(0, Math.min(r.y0, w.gy - 30));
    const x1 = Math.min(E().W * U, Math.max(r.x1, w.gx + w.W + 30)), y1 = Math.min(E().H * U, Math.max(r.y1, w.gy + w.H + 30));
    return { x0, y0, x1, y1 };
  }
  // who owns this global tile: the nearest settlement
  function ownerAt(gx, gy) { let best = null, bd = 1e9; for (const p of data().places) { const d = (p.x * U - gx) ** 2 + (p.y * U - gy) ** 2; if (d < bd) { bd = d; best = p; } } return best; }

  // ---------- the countryside ----------
  const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const KINDS = ['sea', 'beach', 'lake', 'river', 'peak', 'mountain', 'forest', 'farm', 'grass', 'moor', 'marsh'];
  // terrain sampled on a coarse grid and read back through a little noise, so boundaries wander
  function terrainGrid(x0, y0, w, h) {
    const S = 4, gw = Math.ceil(w / S) + 3, gh = Math.ceil(h / S) + 3, g = new Uint8Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) g[j * gw + i] = KINDS.indexOf(E().terrainAt((x0 + (i - 1) * S) / U, (y0 + (j - 1) * S) / U));
    // where the four samples round a tile agree it is that; where they don't (a shore, a wood's edge)
    // the land is asked again for that very tile, so edges run smooth instead of in steps
    return (gx, gy) => {
      const fx = (gx - x0) / S + 1, fy = (gy - y0) / S + 1, i = O.clamp(Math.floor(fx), 0, gw - 2), j = O.clamp(Math.floor(fy), 0, gh - 2);
      const a = g[j * gw + i]; if (a === g[j * gw + i + 1] && a === g[(j + 1) * gw + i] && a === g[(j + 1) * gw + i + 1]) return KINDS[a];
      const wx = gx + (O.noise2(gx / 7, gy / 7, 71) - 0.5) * 4, wy = gy + (O.noise2(gx / 7, gy / 7, 73) - 0.5) * 4;
      return E().terrainAt(wx / U, wy / U);
    };
  }

  // ---------- the roads ----------
  const roadCache = new Map();
  // A road finds its way from one town's way out to the other's the way roads really grew: round lakes and
  // the sea, over a river only where it must, skirting peaks and bog, through woods if it has to.
  const COST = { sea: 400, lake: 400, river: 14, peak: 9, mountain: 3.2, marsh: 2.6, forest: 1.5, moor: 1.2, beach: 1.4, farm: 1, grass: 1 };
  const OUT = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] };
  const costCache = new Map(); // what the land costs to cross, shared by every road
  const drive = (it) => { let r; do r = it.next(); while (!r.done); return r.value; };
  function* routeGen(A, B) {
    const S = 4, pad = 56, x0 = Math.floor((Math.min(A[0], B[0]) - pad) / S) * S, y0 = Math.floor((Math.min(A[1], B[1]) - pad) / S) * S, gw = Math.ceil((Math.abs(A[0] - B[0]) + 2 * pad) / S) + 1, gh = Math.ceil((Math.abs(A[1] - B[1]) + 2 * pad) / S) + 1;
    const cost = new Float32Array(gw * gh).fill(-1);
    const cAt = (i) => { if (cost[i] < 0) { const x = x0 + (i % gw) * S, y = y0 + Math.floor(i / gw) * S, key = x * 65536 + y; let c = costCache.get(key); if (c === undefined) { c = COST[E().terrainAt(x / U, y / U)] || 1; costCache.set(key, c); } cost[i] = c; } return cost[i]; };
    const idx = (p) => O.clamp(Math.round((p[1] - y0) / S), 0, gh - 1) * gw + O.clamp(Math.round((p[0] - x0) / S), 0, gw - 1);
    const s0 = idx(A), s1 = idx(B), bx = s1 % gw, by = Math.floor(s1 / gw);
    const g = new Float32Array(gw * gh).fill(Infinity), from = new Int32Array(gw * gh).fill(-1), done = new Uint8Array(gw * gh);
    // a small binary heap
    const hk = [], hv = [];
    const push = (k, v) => { hk.push(k); hv.push(v); let i = hk.length - 1; while (i > 0) { const pi = (i - 1) >> 1; if (hv[pi] <= hv[i]) break; [hk[i], hk[pi]] = [hk[pi], hk[i]]; [hv[i], hv[pi]] = [hv[pi], hv[i]]; i = pi; } };
    const pop = () => { const k = hk[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hk.length && hv[l] < hv[m]) m = l; if (r < hk.length && hv[r] < hv[m]) m = r; if (m === i) break; [hk[i], hk[m]] = [hk[m], hk[i]]; [hv[i], hv[m]] = [hv[m], hv[i]]; i = m; } } return k; };
    const hEst = (i) => { const dx = Math.abs(i % gw - bx), dy = Math.abs(Math.floor(i / gw) - by); return (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)); };
    g[s0] = 0; push(s0, hEst(s0));
    const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let n = 0;
    while (hk.length && n++ < 200000) {
      if (n % 3000 === 0) yield;
      const i = pop(); if (done[i]) continue; done[i] = 1; if (i === s1) break;
      const x = i % gw, y = Math.floor(i / gw);
      for (const [dx, dy, l] of N8) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue;
        const j = Y * gw + X; if (done[j]) continue;
        const ng = g[i] + l * (cAt(i) + cAt(j)) / 2;
        if (ng < g[j]) { g[j] = ng; from[j] = i; push(j, ng + hEst(j)); }
      }
    }
    const pts = []; for (let i = s1; i >= 0; i = from[i]) { pts.push([x0 + (i % gw) * S, y0 + Math.floor(i / gw) * S]); if (i === s0) break; }
    pts.reverse();
    if (pts.length < 2) return [A, B];
    // smooth the corners off (Chaikin), keeping the two ends where they are
    let line = [A, ...pts.slice(1, -1), B];
    for (let k = 0; k < 3; k++) { const o = [line[0]]; for (let i = 0; i < line.length - 1; i++) { const p = line[i], q = line[i + 1]; if (i > 0) o.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25]); if (i < line.length - 2) o.push([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]); } o.push(line[line.length - 1]); line = o; }
    return line;
  }
  const roadTiles = (rd) => drive(roadSteps(rd));
  // where along a road (in tiles from its first town) a point lies, in global tiles
  function pointAt(r, sd) {
    const c = r.cum, L = r.line; sd = O.clamp(sd, 0, r.total);
    let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= sd) lo = m; else hi = m; }
    const f = (sd - c[lo]) / ((c[hi] - c[lo]) || 1); return [L[lo][0] + (L[hi][0] - L[lo][0]) * f, L[lo][1] + (L[hi][1] - L[lo][1]) * f];
  }
  function* roadSteps(rd) {
    const key = rd.a + '|' + rd.b; if (roadCache.has(key)) return roadCache.get(key);
    const A = exitOf(rd.a, rd.b); yield;
    const B = exitOf(rd.b, rd.a); yield;
    // each end first leaves its town straight out of the gate
    const stub = (P) => { const d = OUT[P[2]] || [0, 0]; return [P[0] + d[0] * 8, P[1] + d[1] * 8]; };
    const A1 = stub(A), B1 = stub(B);
    const mid = yield* routeGen(A1, B1);
    if (roadCache.has(key)) return roadCache.get(key); // found meanwhile by someone in a hurry
    const line = [[A[0], A[1]], ...mid, [B[0], B[1]]];
    const out = [], seen = new Set();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1], steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t);
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const kk = (x + ox) + ',' + (y + oy); if (!seen.has(kk)) { seen.add(kk); out.push([x + ox, y + oy]); } }
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
    // the line itself, measured, so people and carts can walk it
    const cum = [0]; for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const r = { tiles: out, x0: x0 - 2, y0: y0 - 2, x1: x1 + 2, y1: y1 + 2, rd, line, cum, total: cum[cum.length - 1], key };
    // a rival gang's camp off a wild and dangerous road
    const [mx, my] = pointAt(r, r.total / 2), midKind = E().terrainAt(mx / U, my / U);
    if (rd.danger >= 0.25 && ['forest', 'mountain', 'peak', 'marsh', 'moor'].includes(midKind)) {
      const g = E().regionAt(mx / U, my / U), GN = (O.Roads && O.Roads.GANGS) || {};
      const gang = GN[g ? g.r.id : midKind === 'marsh' ? 'marsh' : 'moor'] || 'the Road Wolves';
      const s0 = r.total * (0.4 + hash(A[0], B[1], 31) * 0.2), [px, py] = pointAt(r, s0), [qx, qy] = pointAt(r, s0 + 2), d = Math.hypot(qx - px, qy - py) || 1, side = hash(A[1], B[0], 33) < 0.5 ? 1 : -1;
      r.camp = { gang, s: s0, x: Math.round(px - (qy - py) / d * 7 * side), y: Math.round(py + (qx - px) / d * 7 * side), rx: px, ry: py };
    }
    roadCache.set(key, r);
    return r;
  }

  // ---------- a region ----------
  // drop the items that fail, in one pass
  const keep = (arr, f) => { let n = 0; for (let k = 0; k < arr.length; k++) if (f(arr[k])) arr[n++] = arr[k]; arr.length = n; };
  // A region is built a slice at a time (the loader works through it between frames); asking for it
  // outright finishes whatever is left of that same build.
  const building = new Map();
  function region(id) {
    if (regions.has(id)) return regions.get(id);
    const it = regionSteps(id); let r; do r = it.next(); while (!r.done);
    return regions.get(id);
  }
  function* regionSteps(id) {
    if (regions.has(id)) return;
    let it = building.get(id); if (!it) { it = build(id); building.set(id, it); }
    for (;;) { const r = it.next(); if (r.done) break; yield; }
    building.delete(id);
  }
  function* build(id) {
    const TR = TER(), tw = town(id), R = rectOf(id), W = R.x1 - R.x0, H = R.y1 - R.y0;
    const ter = new Uint8Array(W * H), solid = new Uint8Array(W * H), trees = [], props = [], buildings = [];
    const kindAt = terrainGrid(R.x0, R.y0, W, H);
    const ox = tw.gx - R.x0, oy = tw.gy - R.y0;
    const inTown = (x, y) => x >= ox && y >= oy && x < ox + tw.W && y < oy + tw.H;
    // 1. the land itself
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (x === 0 && y % 40 === 39) yield;
      const gx = R.x0 + x, gy = R.y0 + y, k = kindAt(gx, gy), i = y * W + x, h = hash(gx, gy);
      let t = TR.GRASS;
      if (k === 'sea' || k === 'lake' || k === 'river') { t = TR.WATER; solid[i] = 1; }
      else if (k === 'beach') t = TR.SAND;
      else if (k === 'peak') t = TR.SAND;
      else if (k === 'forest') t = TR.FOREST;
      else if (k === 'farm') {
        // farmland is laid out in strips and plots with grass headlands between them
        const pw = 15, ph = 10, qx = Math.floor(gx / pw), qy = Math.floor(gy / ph), lx = gx - qx * pw, ly = gy - qy * ph, ph2 = hash(qx, qy, 9);
        if (lx > 0 && ly > 0 && ph2 < 0.62) { t = TR.FIELD; if (ph2 < 0.34 && ly % 2 === 1 && lx < pw - 1 && !inTown(x, y)) { const cab = ph2 < 0.12; props.push({ kind: cab ? 'cabbage' : 'wheat', x: x * T + 8, y: y * T + 15, seed: 1, v: cab ? 1 : 2, solid: false, flat: true, field: cab ? 'cabbage' : 'wheat', country: true }); } }
      }
      else if (k === 'marsh' && O.noise2(gx / 6, gy / 6, 13) > 0.72) { t = TR.WATER; solid[i] = 1; }
      ter[i] = t;
      if (inTown(x, y) || solid[i]) continue;
      // what grows and lies about
      const tree = (kind) => { trees.push({ kind, x: x * T + 8 + Math.round((h * 7) % 5) - 2, y: y * T + 14, seed: Math.floor(h * 24) + (kind === 'pine' ? 100 : kind === 'birch' ? 200 : 0), country: true }); solid[i] = 1; };
      const odd = (gx + gy) % 2 === 0;
      if (k === 'forest') { if (odd && h < 0.36) tree(E().regionAt(gx / U, gy / U)?.r?.cold || gy < 40 * U ? 'pine' : h < 0.09 ? 'birch' : h < 0.2 ? 'pine' : 'oak'); else if (h > 0.93) props.push({ kind: 'bush', x: x * T + 8, y: y * T + 13, seed: Math.floor(h * 99), solid: false }); }
      else if (k === 'mountain' || k === 'peak') { if (h < 0.06) { props.push({ kind: 'rock', x: x * T + 8, y: y * T + 13, seed: Math.floor(h * 999), solid: true }); solid[i] = 1; } else if (odd && h > 0.95 && k === 'mountain') tree('pine'); }
      else if (k === 'grass' || k === 'moor' || k === 'marsh') { if (odd && h < (k === 'moor' ? 0.004 : 0.018)) tree(h < 0.006 ? 'birch' : 'oak'); else if (h > (k === 'moor' ? 0.94 : 0.975)) props.push({ kind: h > 0.99 ? 'rock' : 'bush', x: x * T + 8, y: y * T + 13, seed: Math.floor(h * 99), solid: false }); }
      else if (k === 'farm' && t === TR.GRASS && odd && h < 0.006) tree('oak');
    }
    yield;
    // 2. the roads, and bridges where they cross water
    const roadSet = new Set(), camps = [], townRoad = new Set();
    const nearLake = (gx, gy) => [[0, 0], [9, 0], [-9, 0], [0, 9], [0, -9]].some(([a, b]) => E().lakeAt((gx + a) / U, (gy + b) / U) || !E().landAt((gx + a) / U, (gy + b) / U));
    for (const rd of data().roads) {
      // a road can stray at most so far from the line between its two towns
      const pa = place(rd.a), pb = place(rd.b), SL = 180;
      if (Math.max(pa.x, pb.x) * U + SL < R.x0 || Math.min(pa.x, pb.x) * U - SL > R.x1 || Math.max(pa.y, pb.y) * U + SL < R.y0 || Math.min(pa.y, pb.y) * U - SL > R.y1) continue;
      if (!roadCache.has(rd.a + '|' + rd.b)) { yield* roadSteps(rd); yield; } // each road is found once, a step at a time
      const r = roadTiles(rd);
      if (r.x1 < R.x0 || r.x0 > R.x1 || r.y1 < R.y0 || r.y0 > R.y1) continue;
      if (r.camp) camps.push(r);
      for (const [gx, gy] of r.tiles) {
        const x = gx - R.x0, y = gy - R.y0; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (inTown(x, y)) { townRoad.add(y * W + x); continue; } // settled with the town below
        const i = y * W + x; roadSet.add(i);
        ter[i] = ter[i] === TR.WATER && kindAt(gx, gy) === 'river' && !nearLake(gx, gy) ? TR.BRIDGE : TR.ROAD; solid[i] = 0; // a bridge over a river; a lake's edge is just filled in
      }
    }
    // where the road only clips a bank it runs on made ground; it takes a bridge only out over the water
    // (a run of bridge with land along one side is only clipping the bank; a crossing has water both sides)
    const seenB = new Set();
    for (const i0 of roadSet) if (ter[i0] === TR.BRIDGE && !seenB.has(i0)) {
      const run = [i0], nbs = new Set(); seenB.add(i0);
      for (let k = 0; k < run.length; k++) for (const j of [run[k] - 1, run[k] + 1, run[k] - W, run[k] + W]) { if (ter[j] === TR.BRIDGE && roadSet.has(j)) { if (!seenB.has(j)) { seenB.add(j); run.push(j); } } else if (!roadSet.has(j)) nbs.add(j); }
      let wet = 0, dry = 0; for (const j of nbs) if (ter[j] === TR.WATER) wet++; else dry++;
      if (dry * 3 >= wet || run.length <= 6) for (const i of run) ter[i] = TR.ROAD;
    }
    if (roadSet.size) {
      // nothing grows on the road
      keep(trees, (t) => { const i = Math.floor((t.y - 1) / T) * W + Math.floor(t.x / T); if (roadSet.has(i) || roadSet.has(i + 1) || roadSet.has(i - 1) || roadSet.has(i + W)) { solid[i] = ter[i] === TR.WATER ? 1 : 0; return false; } return true; });
      keep(props, (p) => !roadSet.has(Math.floor((p.y - 1) / T) * W + Math.floor(p.x / T)));
    }
    yield;
    // what in the town a passing road must go round: its buildings (and their doorsteps) and anything solid
    const busy = new Set(), kept = new Set();
    for (const b of tw.buildings) for (let y = b.y - 1; y <= b.bottom + 2; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) busy.add(y * tw.W + x);
    for (const p of tw.props) if (p.solid || p.fence) busy.add(Math.floor((p.y - 1) / T) * tw.W + Math.floor(p.x / T));
    // 3. the town itself, set into the land (its forest border gives way to the real countryside)
    for (let y = 0; y < tw.H; y++) for (let x = 0; x < tw.W; x++) {
      const li = y * tw.W + x, edge = Math.min(x, y, tw.W - 1 - x, tw.H - 1 - y), X = ox + x, Y = oy + y;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const i = Y * W + X;
      if (townRoad.has(i) && !busy.has(li) && (tw.ter[li] === TR.GRASS || tw.ter[li] === TR.FOREST)) { ter[i] = TR.ROAD; solid[i] = 0; kept.add(li); continue; } // a road passing over the town's open ground
      if (edge < 3 && tw.ter[li] === TR.FOREST && !busy.has(li)) continue; // keep the countryside's own edge (but never under a building)
      if (x < 13 && (tw.ter[li] === TR.WATER || tw.ter[li] === TR.SAND) && ter[i] !== TR.WATER) continue; // a coast town's sketched shore gives way to the island's real one
      ter[i] = tw.ter[li]; solid[i] = tw.solid[li];
    }
    const sx = ox * T, sy = oy * T;
    const shiftB = (b) => { b.x += ox; b.y += oy; b.bottom += oy; if (b.doorX != null) { b.doorX += ox; b.doorY += oy; } return b; };
    for (const b of tw.buildings) buildings.push(shiftB(b));
    const inTownPx = (px, py) => inTown(Math.floor(px / T), Math.floor((py - 1) / T));
    for (const p of tw.props) { p.x += sx; p.y += sy; props.push(p); }
    for (const t of tw.trees) {
      t.x += sx; t.y += sy;
      const tx = Math.floor(t.x / T) - ox, ty = Math.floor((t.y - 1) / T) - oy;
      if (Math.min(tx, ty, tw.W - 1 - tx, tw.H - 1 - ty) < 3) continue; // the town's border woods give way to the countryside's
      if (kept.has(ty * tw.W + tx) || kept.has(ty * tw.W + tx - 1) || kept.has(ty * tw.W + tx + 1)) continue; // felled for the road
      trees.push(t);
    }
    // countryside trees and stones that fell inside the town are cleared
    keep(trees, (t) => !(t.country && inTownPx(t.x, t.y)));
    // the border strip of the town keeps the countryside's trees off its roads
    const shiftZone = (z) => (Array.isArray(z) ? (Array.isArray(z[0]) ? z.map(shiftZone) : z.length === 4 ? [z[0] + ox, z[1] + oy, z[2] + ox, z[3] + oy] : [z[0] + ox, z[1] + oy]) : z);
    const zones = {}; for (const [k, v] of Object.entries(tw.zones || {})) zones[k] = shiftZone(v);
    if (id === 'ashford') Object.assign(zones, { square: [38 + ox, 23 + oy, 54 + ox, 29 + oy], bench: [37 + ox, 23 + oy], farm: [7 + ox, 56 + oy, 33 + ox, 61 + oy], wood: [34 + ox, 4 + oy, 44 + ox, 12 + oy], east: [95 + ox, 31 + oy], patrol: [[46, 30], [30, 31], [12, 30], [12, 41], [30, 42], [46, 41], [62, 42], [76, 30], [62, 30], [46, 24]].map(([a, c]) => [a + ox, c + oy]) });
    // the town's own streets that run out at its edge carry on as a lane to the nearest road, not into the grass
    if (roadSet.size) {
      const rlist = [...roadSet], ends = [];
      for (let y = 0; y < tw.H; y++) for (let x = 0; x < tw.W; x++) {
        if (Math.min(x, y, tw.W - 1 - x, tw.H - 1 - y) > 4) continue;
        const t = tw.ter[y * tw.W + x]; if (t !== TR.ROAD && t !== TR.COBBLE) continue;
        // only where the street stops: the next tile outward isn't street
        const out = [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]].filter(([a2, b2]) => Math.min(a2, b2, tw.W - 1 - a2, tw.H - 1 - b2) < Math.min(x, y, tw.W - 1 - x, tw.H - 1 - y));
        if (!out.length || out.some(([a2, b2]) => a2 >= 0 && b2 >= 0 && a2 < tw.W && b2 < tw.H && [TR.ROAD, TR.COBBLE].includes(tw.ter[b2 * tw.W + a2]))) continue;
        const X = ox + x, Y = oy + y; if (ends.some(([a, b]) => Math.abs(a - X) + Math.abs(b - Y) < 6)) continue;
        ends.push([X, Y]);
      }
      for (const [X, Y] of ends) {
        let best = null, bd = 90 * 90;
        for (const i of rlist) { const rx = i % W, ry = (i / W) | 0, d = (rx - X) ** 2 + (ry - Y) ** 2; if (d < bd) { bd = d; best = [rx, ry]; } }
        if (!best || bd < 16) continue;
        const n = Math.ceil(Math.sqrt(bd) * 2), lane = [];
        let ok = true;
        for (let k = 0; k <= n && ok; k++) {
          const t = k / n, bend = Math.sin(t * Math.PI) * 3 * (hash(X, Y, 5) - 0.5), x = Math.round(X + (best[0] - X) * t + bend * (best[1] - Y) / Math.sqrt(bd)), y = Math.round(Y + (best[1] - Y) * t - bend * (best[0] - X) / Math.sqrt(bd));
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const i = yy * W + xx; if (ter[i] === TR.WATER) { ok = false; break; } if (!inTown(xx, yy)) lane.push(i); }
        }
        if (!ok) continue;
        for (const i of lane) { ter[i] = TR.ROAD; solid[i] = 0; roadSet.add(i); }
      }
      keep(trees, (t) => !roadSet.has(Math.floor((t.y - 1) / T) * W + Math.floor(t.x / T)));
      keep(props, (p) => p.field || p.flat || !roadSet.has(Math.floor((p.y - 1) / T) * W + Math.floor(p.x / T)));
    }
    // 4. ruins of older times
    for (const ru of E().RUINS) {
      const gx = Math.round(ru.x * U), gy = Math.round(ru.y * U), x = gx - R.x0, y = gy - R.y0;
      if (x < 4 || y < 6 || x > W - 8 || y > H - 4 || inTown(x, y)) continue;
      if (ter[y * W + x] === TR.WATER) {
        // standing in the water: one broken tower in the shallows with its fallen stones about it
        props.push({ kind: 'tower', x: x * T + 8, y: y * T + 14, seed: gx * 7 + gy, v: 0, solid: true, ruinNote: ru.note, ruinName: ru.name });
        for (const [dx, dy] of [[-1, 1], [2, 0], [1, 2], [-2, -1]]) if (ter[(y + dy) * W + x + dx] === TR.WATER) props.push({ kind: 'rock', x: (x + dx) * T + 8, y: (y + dy) * T + 13, seed: gx + dx * 5 + dy, solid: true });
        continue;
      }
      const spec = { seed: gx * 7 + gy, w: 5, d: 4, floors: 2, wealth: 0.6, condition: 0.2, wall: 'stone', stoneMat: 'stoneDark', roof: 'slate', roofType: 'gable', doorTile: 2, noFlowers: true };
      const bld = { id: 9000 + buildings.length, type: 'ruin', name: ru.name, x: x - 2, bottom: y, y: y - 3, w: 5, d: 4, floors: 2, wealth: 0.6, condition: 0.2, ruined: true, spec, ruinNote: ru.note, doorX: x, doorY: y + 1 };
      buildings.push(bld);
      for (let yy = bld.y; yy <= bld.bottom; yy++) for (let xx = bld.x; xx < bld.x + bld.w; xx++) { const i = yy * W + xx; solid[i] = 1; if (ter[i] === TR.WATER) ter[i] = TR.GRASS; }
      keep(trees, (t) => !(Math.abs(t.x / T - x) < 5 && Math.abs(t.y / T - y) < 5));
    }
    yield;
    // 6. the trades that stand out of town, each where it belongs, and the cottages of the people who work them
    placeOutskirts(id, { W, H, R, ter, solid, trees, props, buildings, kindAt, inTown, roadSet, TR, tw, ox, oy });
    placeDens(id, { W, H, ter, solid, trees, props, buildings, inTown, TR, tw, ox, oy });
    // 5. the camps of the gangs that hold the wild roads
    for (const r of camps) {
      const c = r.camp, x = c.x - R.x0, y = c.y - R.y0;
      if (x < 4 || y < 4 || x > W - 6 || y > H - 4 || inTown(x, y)) continue;
      const spec = { seed: c.x * 7 + c.y + 9, w: 3, d: 2, floors: 1, wealth: 0.2, condition: 0.6, wall: 'log', roof: 'thatch', roofType: 'side', doorTile: 1, noFlowers: true };
      const bld = { id: 9500 + buildings.length, type: 'hideout', name: `${c.gang.replace(/^the /, 'The ')}' camp`, x: x - 1, bottom: y, y: y - 1, w: 3, d: 2, floors: 1, wealth: 0.2, condition: 0.6, level: 0, gang: 'rival', rivalGang: c.gang, spec, doorX: x, doorY: y + 1, roadKey: r.key };
      buildings.push(bld);
      for (let yy = bld.y - 1; yy <= bld.bottom + 2; yy++) for (let xx = bld.x - 2; xx < bld.x + bld.w + 2; xx++) { const i = yy * W + xx; solid[i] = yy <= bld.bottom && xx >= bld.x && xx < bld.x + bld.w ? 1 : 0; if (ter[i] === TR.FOREST || ter[i] === TR.WATER) ter[i] = TR.YARD; }
      keep(trees, (t) => !(Math.abs(t.x / T - x) < 4 && Math.abs(t.y / T - y) < 4));
      keep(props, (p) => !(p.country !== false && !p.field && Math.abs(p.x / T - x) < 3 && Math.abs(p.y / T - y) < 3 && (p.kind === 'bush' || p.kind === 'rock')));
    }
    // bushes, rocks and stumps are things you walk round, not through (unless one has ended up on a path)
    const doors = new Set(buildings.filter((b) => b.doorX != null).map((b) => b.doorY * W + b.doorX));
    for (const p of props) {
      if (p.flat || p.field || !(p.kind === 'bush' || p.kind === 'rock' || p.kind === 'stump')) continue;
      const i = Math.floor((p.y - 1) / T) * W + Math.floor(p.x / T), t = ter[i];
      if (t === TR.ROAD || t === TR.COBBLE || t === TR.BRIDGE || t === TR.YARD || doors.has(i) || doors.has(i - W)) { p.solid = false; continue; }
      p.solid = true; solid[i] = 1;
    }
    const world = Object.assign({}, tw, {
      W, H, T, ter, solid, buildings, props, trees, TER: TR, zones, ox, oy, gx0: R.x0, gy0: R.y0, chunked: true, island: true,
      roadY: (tw.roadY || 30) + oy, exits: {}, name: place(id).name, placeId: id, townW: tw.W, townH: tw.H,
    });
    world.pens = (tw.pens || []).map((p) => Object.assign({}, p, { z: [p.z[0] + ox, p.z[1] + oy, p.z[2] + ox, p.z[3] + oy] }));
    world.estates = (tw.estates || []).map((e) => Object.assign({}, e, { fields: [e.fields[0] + ox, e.fields[1] + oy, e.fields[2] + ox, e.fields[3] + oy] }));
    regions.set(id, world);
    return world;
  }

  // ---------- the outskirts ----------
  // Which of the realm's trades a place has round it, by its size and the land about it
  const TOWN_TRADES = ['posthouse', 'brewery', 'saddler', 'fletcher', 'scriptorium', 'barber', 'laundry', 'carrier', 'wainwright', 'ropewalk', 'glazier', 'agency', 'brickworks', 'dyer', 'moneylender', 'tollhouse'];
  function outskirtsFor(pl, tw) {
    const pop = pl.pop || 100, kind = pl.kind;
    const big = kind === 'capital' || kind === 'city', town = big || kind === 'town' || kind === 'port' || pop >= 300, village = !town && (kind === 'village' || pop >= 60);
    const list = [], has = new Set((tw ? tw.buildings : []).map((b) => b.type));
    // first whatever the place needs and hasn't got: a hall to govern from, the everyday trades
    const need = town || kind === 'mine' ? ['townhall', 'stable', 'butcher', 'carpenter', 'tailor', 'smithy'] : village || kind === 'castle' ? ['stable', 'butcher', 'carpenter', 'tailor', 'smithy'] : [];
    for (const t of need) if (!has.has(t)) list.push(t);
    if (town) list.push(...TOWN_TRADES.slice(0, big ? 16 : 11));
    else if (village) list.push('posthouse', 'brewery', 'carrier');
    list.push('apiary', 'lodge', 'charcoal', 'claypit', 'saltworks', 'peatcut', 'vineyard', 'boatyard', 'fishery', 'ferry');
    // a big place needs more than one of the common employers, so its people have work
    if (big) list.push('carrier', 'laundry', 'ropewalk', 'brickworks', 'carpenter', 'tailor', 'brewery', 'butcher');
    else if (town) list.push('carrier', 'laundry', 'carpenter');
    return list.filter((t) => O.Data.BUSINESS[t]).slice(0, big ? 38 : town ? 29 : village ? 14 : 4);
  }
  function placeOutskirts(id, C) {
    const { W, H, R, ter, solid, trees, props, buildings, kindAt, inTown, TR, tw, ox, oy } = C;
    const pl = place(id), rng = O.RNG(O.hash('outskirts', id)), D = O.Data;
    const tx0 = ox, ty0 = oy, tx1 = ox + tw.W, ty1 = oy + tw.H;
    const distTown = (x, y) => Math.max(tx0 - x, x - tx1, ty0 - y, y - ty1, 0);
    const isWater = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ter[y * W + x] === TR.WATER;
    const waterKind = (x, y, r) => { for (let k = 1; k <= r; k++) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k], [k, k], [-k, -k], [k, -k], [-k, k]]) if (isWater(x + dx, y + dy)) return kindAt(R.x0 + x + dx, R.y0 + y + dy); return null; };
    const forestAround = (x, y) => { let n = 0; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < H && ter[yy * W + xx] === TR.FOREST) n++; } return n / 49; };
    const fits = (x, bottom, w, d) => {
      for (let yy = bottom - d - 1; yy <= bottom + 2; yy++) for (let xx = x - 2; xx < x + w + 2; xx++) {
        if (xx < 2 || yy < 2 || xx >= W - 2 || yy >= H - 2 || inTown(xx, yy)) return false;
        const i = yy * W + xx, t = ter[i]; if (t === TR.WATER || t === TR.ROAD || t === TR.BRIDGE || t === TR.COBBLE) return false;
        if (buildings.some((b) => xx >= b.x - 1 && xx < b.x + b.w + 1 && yy >= b.y - 1 && yy <= b.bottom + 2)) return false;
      }
      return true;
    };
    const score = (site, x, y) => {
      const dt = distTown(x, y); if (dt < 3) return -1;
      switch (site) {
        case 'town': return dt <= 16 ? 30 - dt : -1;
        case 'shore': { const wk = waterKind(x, y, 4); return wk && dt < 45 ? 40 - dt * 0.5 : -1; }
        case 'coast': { const wk = waterKind(x, y, 4); return wk === 'sea' && dt < 70 ? 50 - dt * 0.4 : -1; }
        case 'river': { const wk = waterKind(x, y, 5); return (wk === 'river' || wk === 'lake' || wk === 'marsh') && dt < 50 ? 40 - dt * 0.5 : -1; }
        case 'woods': { const f = forestAround(x, y); return f > 0.35 && dt < 60 ? f * 40 - dt * 0.2 : -1; }
        case 'hills': { const k = kindAt(R.x0 + x, R.y0 + y); return (k === 'mountain') && dt < 60 ? 30 - dt * 0.3 : -1; }
        case 'moor': { const k = kindAt(R.x0 + x, R.y0 + y); return (k === 'moor' || k === 'marsh') && dt < 60 ? 30 - dt * 0.3 : -1; }
        case 'fields': { const k = kindAt(R.x0 + x, R.y0 + y); return (k === 'farm' || k === 'grass') && forestAround(x, y) < 0.2 && dt >= 6 && dt < 35 ? 30 - Math.abs(dt - 14) : -1; }
        default: return -1;
      }
    };
    const SITE = { fishery: 'shore' };
    let nid = 8000 + buildings.filter((b) => b.id >= 8000 && b.id < 9000).length;
    const roadIdx = [...C.roadSet];
    const lane = (x0, y0) => {
      // a footpath from the door to the nearest road, unless it would cross water
      let best = null, bd = 60 * 60; for (const i of roadIdx) { const rx = i % W, ry = (i / W) | 0, d = (rx - x0) ** 2 + (ry - y0) ** 2; if (d < bd) { bd = d; best = [rx, ry]; } }
      for (let y = Math.max(0, y0 - 40); y < Math.min(H, y0 + 40) && !best; y++) for (let x = Math.max(0, x0 - 40); x < Math.min(W, x0 + 40); x++) if (inTown(x, y) && ter[y * W + x] === TR.ROAD) { const d = (x - x0) ** 2 + (y - y0) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
      if (!best) return;
      const n = Math.ceil(Math.sqrt(bd) * 2), path = [];
      for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (best[0] - x0) * k / n), y = Math.round(y0 + (best[1] - y0) * k / n), i = y * W + x; if (ter[i] === TR.WATER) return; if (!inTown(x, y)) path.push(i); }
      for (const i of path) { if (ter[i] !== TR.ROAD) ter[i] = TR.YARD; solid[i] = 0; }
      const ps = new Set(path); keep(trees, (t) => !ps.has(Math.floor((t.y - 1) / T) * W + Math.floor(t.x / T)));
    };
    const build = (type, w, d, look, name, x, bottom, extra) => {
      const spec = Object.assign({ seed: O.hash('ob', id, nid), w, d, floors: (extra && extra.floors) || 1, wealth: 0.45, condition: 0.85, doorTile: Math.floor(w / 2) }, look);
      const b = Object.assign({ id: nid++, type, name, x, bottom, y: bottom - d + 1, w, d, floors: spec.floors, wealth: 0.45, condition: 0.85, spec, doorX: x + spec.doorTile, doorY: bottom + 1, outskirts: true }, extra || {});
      buildings.push(b);
      for (let yy = b.y - 2; yy <= b.bottom + 2; yy++) for (let xx = b.x - 2; xx < b.x + b.w + 2; xx++) { const i = yy * W + xx; const inside = yy >= b.y && yy <= b.bottom && xx >= b.x && xx < b.x + b.w; solid[i] = inside ? 1 : 0; if (ter[i] === TR.FOREST || ter[i] === TR.FIELD) ter[i] = TR.GRASS; }
      ter[b.doorY * W + b.doorX] = TR.YARD;
      keep(trees, (t) => !(t.x / T >= b.x - 2 && t.x / T < b.x + b.w + 2 && (t.y - 1) / T >= b.y - 2 && (t.y - 1) / T <= b.bottom + 3));
      keep(props, (p) => !(p.x / T >= b.x - 2 && p.x / T < b.x + b.w + 2 && (p.y - 1) / T >= b.y - 2 && (p.y - 1) / T <= b.bottom + 3));
      return b;
    };
    const step = 3;
    for (const type of outskirtsFor(pl, tw)) {
      const def = D.BUSINESS[type]; if (!def) continue;
      if (def.south && pl.region !== 'south') continue;
      if (type === 'fishery' && tw.buildings.some((b) => b.type === 'fishery')) continue;
      const site = SITE[type] || def.site || 'town', w = def.w || 4, d = def.d || 3;
      let best = null, bs = 0;
      for (let y = Math.max(4, ty0 - 70); y < Math.min(H - 4, ty1 + 70); y += step) for (let x = Math.max(4, tx0 - 70); x < Math.min(W - 4, tx1 + 70); x += step) {
        const sc = score(site, x, y) + rng.next() * 3; if (sc <= bs) continue;
        if (!fits(x, y, w, d)) continue; bs = sc; best = [x, y];
      }
      if (!best) continue;
      const LOOK2 = { townhall: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'slate', roofType: 'gable', chimney: true, sign: 'shield', floors: 2 }, stable: { wall: 'plank', plankMat: 'plank', roof: 'shingle', roofType: 'side', bigDoor: true }, butcher: { wall: 'timber', roof: 'tile', sign: 'scales' }, carpenter: { wall: 'plank', roof: 'shingle', sign: 'hammer' }, tailor: { wall: 'timber', roof: 'thatch', shopWindow: true }, smithy: { wall: 'stone', roof: 'slate', chimney: true, sign: 'anvil' } };
      const surname = O.Names ? rng.pick(O.Names.SUR) : 'Ward';
      const lk = Object.assign({ wall: 'timber', roof: 'thatch' }, def.look || LOOK2[type] || {});
      const b = build(type, w, d, lk, ['posthouse', 'tollhouse', 'townhall'].includes(type) ? `${pl.name} ${def.label}` : `${surname}'s ${def.label}`, best[0], best[1], { floors: def.floors || lk.floors || 1 });
      lane(b.doorX, b.doorY + 1);
      // a cottage nearby for the hands
      for (const [dx, dy] of [[w + 3, 0], [-7, 0], [0, 7], [w + 3, 6], [-7, 6]]) { const cx = best[0] + dx, cy = best[1] + dy; if (fits(cx, cy, 4, 3)) { const hb = build('house', 4, 3, { wall: rng.pick(['timber', 'plank', 'stone']), roof: rng.pick(['thatch', 'shingle']), chimney: true, doorTile: 1 }, 'Cottage', cx, cy); lane(hb.doorX, hb.doorY + 1); break; } }
    }
  }

  // the dens of the place's gangs, hidden off in the woods or out in the fields
  function placeDens(id, C) {
    const pl = place(id), pop = pl.pop || 100, big = pl.kind === 'capital' || pl.kind === 'city';
    const n = pop < 60 ? 0 : pop < 150 ? 1 : pop < 400 ? 2 : big ? 4 : 3;
    const { W, H, ter, solid, trees, props, buildings, inTown, TR, tw, ox, oy } = C, rng = O.RNG(O.hash('dens', id));
    const have = buildings.filter((b) => b.type === 'hideout' && !b.camp && !b.roadKey).length;
    for (let k = have; k < n; k++) {
      let best = null, bs = -1;
      for (let t = 0; t < 400; t++) {
        const x = Math.round(ox - 50 + rng.next() * (tw.W + 100)), y = Math.round(oy - 50 + rng.next() * (tw.H + 100));
        if (x < 4 || y < 4 || x > W - 6 || y > H - 4) continue;
        const dt = Math.max(ox - x, x - ox - tw.W, oy - y, y - oy - tw.H, 0); if (dt < 12 || dt > 50) continue;
        let okk = true; for (let yy = y - 3; yy <= y + 3 && okk; yy++) for (let xx = x - 3; xx <= x + 5 && okk; xx++) { const i = yy * W + xx; if (inTown(xx, yy) || ter[i] === TR.WATER || ter[i] === TR.ROAD || buildings.some((b) => xx >= b.x - 1 && xx < b.x + b.w + 1 && yy >= b.y - 1 && yy <= b.bottom + 2)) okk = false; }
        if (!okk) continue;
        let f = 0; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (ter[(y + j) * W + x + i] === TR.FOREST) f++;
        if (f > bs) { bs = f; best = [x, y]; }
      }
      if (!best) continue;
      const [x, y] = best, spec = { seed: O.hash('den', id, k), w: 3, d: 2, floors: 1, wealth: 0.2, condition: 0.6, wall: 'log', roof: 'thatch', roofType: 'gable', doorTile: 1, noFlowers: true };
      const b = { id: 8800 + k, type: 'hideout', name: 'A den in the woods', x: x - 1, bottom: y, y: y - 1, w: 3, d: 2, floors: 1, wealth: 0.2, condition: 0.6, level: 1, spec, doorX: x, doorY: y + 1, den: true };
      buildings.push(b);
      for (let yy = b.y - 1; yy <= b.bottom + 2; yy++) for (let xx = b.x - 2; xx < b.x + b.w + 2; xx++) { const i = yy * W + xx; solid[i] = yy <= b.bottom && xx >= b.x && xx < b.x + b.w ? 1 : 0; if (ter[i] === TR.FOREST) ter[i] = TR.YARD; }
      keep(trees, (t) => !(Math.abs(t.x / T - x) < 4 && Math.abs((t.y - 1) / T - y) < 4));
      keep(props, (p) => !(Math.abs(p.x / T - x) < 3 && Math.abs((p.y - 1) / T - y) < 3 && !p.flat));
    }
  }

  // where a global tile falls inside a region, and back
  const toGlobal = (w, px, py) => [px + w.gx0 * T, py + w.gy0 * T];
  const toLocal = (w, gx, gy) => [gx - w.gx0 * T, gy - w.gy0 * T];

  O.Island = { U, init, data, town, region, regionSteps, pointAt, cachedRoads: () => [...roadCache.values()], rectOf, ownerAt, centre, toGlobal, toLocal, roadTiles, exitOf };
})();
