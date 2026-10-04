// The roads of Eldoria, walked. Every settlement has a way out for each road that leaves it, on the
// side that faces where the road goes. Walk out of town and you are on that road: a stretch of
// real country, drawn from the island itself — the forest, the farms, the rocks under the peaks,
// the marsh — with the rivers it crosses (by a bridge, or a ford where there is none), the ruins
// that stand near it, other travellers and the caravans that use it, and on the wilder roads a camp
// of one of the rival gangs that live in the wild places. Walk to the far end and you arrive.
'use strict';
(function () {
  const T = 16, TER = O.Village.TER;
  const E = () => O.Eldoria;
  const GANGS = { blackpine: 'the Blackpine Wolves', frostwood: 'the Frostwood Knives', greenwood: 'the Greenwood Foxes', peaks: 'the Ravens of the Peaks', kingsforest: "the King's Poachers", marsh: 'the Marsh Rats', moor: 'the Moor Riders' };

  // ---------- a way out of town for every road ----------
  function attachExits(world, K) {
    const place = K.place(world.placeId); if (!place) return;
    const W = world.W, H = world.H, { ter, solid } = world;
    world.exits = world.exits || {};
    const legacy = { west: world.exits.west, east: world.exits.east };
    const used = { east: 0, west: 0, north: 0, south: 0 };
    const inBuilding = (x, y) => world.buildings.some((b) => x >= b.x - 1 && x < b.x + b.w + 1 && y >= b.y - 1 && y <= b.bottom + 1);
    const propAt = (x, y) => world.props.find((p) => p.solid && Math.floor(p.x / T) === x && Math.floor((p.y - 1) / T) === y);
    for (const id of K.neighbours(place.id).sort()) {
      if (world.exits[id]) continue;
      const q = K.place(id), dx = q.x - place.x, dy = q.y - place.y, len = Math.hypot(dx, dy) || 1;
      const ranked = [['east', dx], ['west', -dx], ['south', dy], ['north', -dy]].sort((a, b) => b[1] - a[1]).map((s) => s[0]);
      const side = ranked.find((s) => used[s] === 0) || ranked[0];
      const k = used[side]++;
      // where on that edge: an existing road if there is one, otherwise towards the destination
      let x, y;
      const along = side === 'east' || side === 'west' ? H : W;
      const fixed = side === 'east' ? W - 1 : side === 'south' ? H - 1 : 0;
      const at = (i) => (side === 'east' || side === 'west' ? [fixed, i] : [i, fixed]);
      const roads = []; for (let i = 2; i < along - 2; i++) { const [xx, yy] = at(i); if (ter[yy * W + xx] === TER.ROAD || ter[yy * W + xx] === TER.BRIDGE) roads.push(i); }
      let pos;
      if (roads.length && k === 0 && legacy[side]) pos = side === 'east' || side === 'west' ? legacy[side][1] : legacy[side][0];
      else if (roads.length && k === 0) pos = roads[Math.floor(roads.length / 2)];
      else { const slant = (side === 'east' || side === 'west' ? dy : dx) / len; pos = Math.round(O.clamp(along / 2 + slant * along * 0.35 + (k ? (k % 2 ? 10 : -10) : 0), 4, along - 5)); }
      [x, y] = at(pos);
      // carve a road from the edge to the town's own roads
      const seen = new Int32Array(W * H).fill(-1), qx = [x], qy = [y]; seen[y * W + x] = y * W + x;
      let hit = null;
      for (let i = 0; i < qx.length && i < 6000; i++) {
        const cx = qx[i], cy = qy[i];
        if ((ter[cy * W + cx] === TER.ROAD || ter[cy * W + cx] === TER.BRIDGE || ter[cy * W + cx] === TER.COBBLE) && !(cx === x && cy === y)) { hit = [cx, cy]; break; }
        for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + ddx, ny = cy + ddy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] >= 0) continue;
          if (inBuilding(nx, ny) || propAt(nx, ny) || ter[ny * W + nx] === TER.WATER) continue;
          seen[ny * W + nx] = cy * W + cx; qx.push(nx); qy.push(ny);
        }
      }
      if (hit) {
        let c = hit[1] * W + hit[0];
        while (c !== y * W + x) { const px = c % W, py = (c / W) | 0; if (ter[c] !== TER.BRIDGE && ter[c] !== TER.COBBLE) ter[c] = TER.ROAD; solid[c] = 0; world.trees = world.trees.filter((t) => !(Math.abs(Math.floor(t.x / T) - px) <= 0 && Math.abs(Math.floor((t.y - 1) / T) - py) <= 0)); c = seen[c]; }
        ter[y * W + x] = TER.ROAD; solid[y * W + x] = 0;
      }
      world.exits[id] = { x, y, side };
    }
    if (world.cityWalls && !world._walled) cityWalls(world);
  }

  // A city's walls go up once its roads are laid: a curtain round the whole place, towers every so
  // often, and a gatehouse wherever a road passes through
  function cityWalls(world) {
    world._walled = true;
    const W = world.W, H = world.H, { ter, solid } = world, m = 3;
    const inBuilding = (x, y) => world.buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y <= b.bottom);
    const isRoad = (x, y) => [TER.ROAD, TER.BRIDGE, TER.COBBLE].includes(ter[y * W + x]);
    const clear = (x, y) => { world.trees = world.trees.filter((t) => !(Math.floor(t.x / T) === x && Math.floor((t.y - 1) / T) === y)); world.props = world.props.filter((p) => !(Math.floor(p.x / T) === x && Math.floor((p.y - 1) / T) === y)); };
    const put = (kind, x, y, extra) => { clear(x, y); world.props.push(Object.assign({ kind, x: x * T + 8, y: y * T + (kind === 'wallV' ? 15 : 14), seed: x * 31 + y, v: 0, solid: kind !== 'gatearch', wall: true }, extra)); if (kind !== 'gatearch') solid[y * W + x] = 1; };
    const ring = [];
    for (let x = m; x <= W - 1 - m; x++) ring.push([x, m, 'h'], [x, H - 1 - m, 'h']);
    for (let y = m + 1; y < H - 1 - m; y++) ring.push([m, y, 'v'], [W - 1 - m, y, 'v']);
    for (const [x, y, o] of ring) {
      if (ter[y * W + x] === TER.WATER || inBuilding(x, y) || world.buildings.some((b) => b.doorX === x && b.doorY === y)) continue; // a postern gap where a house door meets the wall
      if (isRoad(x, y)) {
        // a gate only where a road passes through the wall; a road running along the line is walled over
        const crosses = o === 'h' ? isRoad(x, y - 1) || isRoad(x, y + 1) : isRoad(x - 1, y) || isRoad(x + 1, y);
        const prevGate = world.props.some((p) => p.kind === 'gatearch' && Math.abs(Math.floor(p.x / T) - x) + Math.abs(Math.floor((p.y - 1) / T) - y) === 1);
        if (crosses && !prevGate) { put('gatearch', x, y, { y: y * T + 15 }); continue; }
        if (crosses && prevGate) continue; // the other half of a two-wide gateway
      }
      const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRoad(x + dx, y + dy) && !(o === 'h' ? dy : dx));
      const corner = (x === m || x === W - 1 - m) && (y === m || y === H - 1 - m);
      const tower = corner || nearRoad || (o === 'h' ? (x - m) % 12 === 0 : (y - m) % 10 === 0);
      put(tower ? 'tower' : o === 'h' ? 'wallH' : 'wallV', x, y);
    }
    world.dirtyStatics = true;
  }

  // ---------- a stretch of road ----------
  function makeRoadWorld(K, a, b) {
    const rd = K.road(a, b), A0 = K.place(a), B0 = K.place(b);
    const horiz = Math.abs(B0.x - A0.x) >= Math.abs(B0.y - A0.y);
    let P0 = A0, P1 = B0; if (horiz ? B0.x < A0.x : B0.y < A0.y) { P0 = B0; P1 = A0; }
    const seed = O.hash('road', P0.id, P1.id), rng = O.RNG(seed);
    const dx = P1.x - P0.x, dy = P1.y - P0.y, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
    const L = Math.round(O.clamp(dl * 6, 60, 180)), Wd = 36;
    const W = horiz ? L : Wd, H = horiz ? Wd : L;
    const ter = new Uint8Array(W * H), solid = new Uint8Array(W * H);
    const idx = (u, v) => (horiz ? v * W + u : u * W + v);
    const xy = (u, v) => (horiz ? [u, v] : [v, u]);
    const mapAt = (u, v) => { const t = u / (L - 1); return [P0.x + dx * t + nx * (v - Wd / 2) * 0.22, P0.y + dy * t + ny * (v - Wd / 2) * 0.22]; };
    // the land first, then a road that keeps to dry ground where it can and crosses water only where it must
    const KIND = new Array(L * Wd); for (let u = 0; u < L; u++) for (let v = 0; v < Wd; v++) KIND[u * Wd + v] = E().terrainAt(...mapAt(u, v));
    const wet = (u, v) => { const k = KIND[u * Wd + O.clamp(v, 0, Wd - 1)]; return k === 'sea' || k === 'lake' || k === 'river' || k === 'marsh' && false; };
    const base = (u) => { const e = Math.min(u, L - 1 - u); const k = O.clamp(e / 8, 0, 1); return Math.round(Wd / 2 + k * (Math.sin(u / 19 + (seed % 7)) * 3.2 + (O.fbm(u / 23, 1, seed & 255, 2) - 0.5) * 6)); };
    const MIDS = new Int16Array(L);
    for (let u = 0; u < L; u++) {
      let m = base(u);
      if (wet(u, m) || wet(u, m + 1)) for (let k = 1; k <= 9; k++) { if (m - k > 3 && !wet(u, m - k) && !wet(u, m - k + 1)) { m -= k; break; } if (m + k < Wd - 4 && !wet(u, m + k) && !wet(u, m + k + 1)) { m += k; break; } }
      MIDS[u] = m;
    }
    for (let u = 1; u < L; u++) MIDS[u] = O.clamp(MIDS[u], MIDS[u - 1] - 1, MIDS[u - 1] + 1); // no sudden jumps
    for (let u = L - 2; u >= 0; u--) MIDS[u] = O.clamp(MIDS[u], MIDS[u + 1] - 1, MIDS[u + 1] + 1);
    MIDS[0] = MIDS[1]; MIDS[L - 1] = MIDS[L - 2];
    const mid = (u) => MIDS[O.clamp(Math.round(u), 0, L - 1)];
    const trees = [], props = [], buildings = [];
    const crossings = [];
    for (let u = 0; u < L; u++) {
      const m = mid(u);
      for (let v = 0; v < Wd; v++) {
        const [mx, my] = mapAt(u, v), kind = KIND[u * Wd + v], i = idx(u, v), [x, y] = xy(u, v);
        let t = TER.GRASS;
        if (kind === 'sea' || kind === 'lake' || kind === 'river') t = TER.WATER;
        else if (kind === 'beach') t = TER.SAND;
        else if (kind === 'forest') t = TER.FOREST;
        else if (kind === 'mountain' || kind === 'peak') t = O.noise2(x * 0.4, y * 0.4, 3) > 0.45 ? TER.YARD : TER.GRASS;
        else if (kind === 'farm') t = (Math.floor(u / 7) + Math.floor(v / 5)) % 3 === 0 ? TER.GRASS : TER.FIELD;
        else if (kind === 'marsh') t = O.noise2(x * 0.3, y * 0.3, 5) > 0.62 ? TER.WATER : TER.GRASS;
        ter[i] = t;
        // the road itself, two tiles wide
        if (Math.abs(v - m) <= 0.5 || v === m + 1) {
          if (t === TER.WATER) { ter[i] = rd.bridge || kind === 'river' && rng.chance(0.0) ? TER.BRIDGE : rd.bridge ? TER.BRIDGE : TER.SAND; if (v === m) crossings.push({ u, bridge: rd.bridge, kind }); }
          else ter[i] = TER.ROAD;
          continue;
        }
        if (t === TER.WATER) { solid[i] = 1; continue; }
        const near = Math.abs(v - m) <= 2;
        if (near) continue;
        const r = rng.next();
        const tx = x * T + 8, ty = y * T + 14;
        if (kind === 'forest' && r < 0.34 && (x + y) % 2 === 0) { const g = E().regionAt(mx, my); trees.push({ kind: g && (g.r.cold || g.r.dark) ? 'pine' : rng.weighted([['oak', 3], ['birch', 1], ['pine', 1]]), x: tx + rng.int(-3, 3), y: ty, seed: rng.int(1, 1e6) }); solid[i] = 1; }
        else if ((kind === 'mountain' || kind === 'peak') && r < 0.12) { props.push({ kind: 'rock', x: tx, y: ty - 1, seed: rng.int(1, 1e6), v: 0, solid: true }); solid[i] = 1; }
        else if ((kind === 'mountain' || kind === 'peak') && r < 0.16 && (x + y) % 2 === 0) { trees.push({ kind: 'pine', x: tx, y: ty, seed: rng.int(1, 1e6) }); solid[i] = 1; }
        else if (kind === 'farm' && t === TER.FIELD && (y % 2 === 0)) props.push({ kind: (Math.floor(u / 7) + Math.floor(v / 5)) % 2 ? 'wheat' : 'cabbage', x: tx, y: ty + 1, seed: 1, v: 2, solid: false, field: true });
        else if (kind === 'grass' && r < 0.03 && (x + y) % 2 === 0) { trees.push({ kind: rng.weighted([['oak', 4], ['birch', 1], ['pine', 1]]), x: tx, y: ty, seed: rng.int(1, 1e6) }); solid[i] = 1; }
        else if (kind === 'moor' && r < 0.08) props.push({ kind: 'bush', x: tx, y: ty - 1, seed: rng.int(1, 1e6), v: 0, solid: false });
        else if (r < (kind === 'forest' ? 0.42 : 0.05)) props.push({ kind: rng.weighted([['bush', 2], ['rock', 1], ['stump', kind === 'forest' ? 1 : 0.2]]), x: tx, y: ty - 1, seed: rng.int(1, 1e6), v: 0, solid: false });
        else if (r < 0.2) props.push({ kind: r < 0.07 ? 'flowers' : 'grass', x: x * T + rng.int(2, 14), y: y * T + rng.int(4, 14), seed: rng.int(1, 30), solid: false, flat: true });
      }
    }
    // signposts at each end, and milestones along the way
    const post = (u, v) => { const [x, y] = xy(u, v); props.push({ kind: 'signpost', x: x * T + 8, y: y * T + 14, seed: 3, v: 0, solid: false }); };
    post(3, mid(3) - 2); post(L - 4, mid(L - 4) + 3);
    for (let u = 30; u < L - 20; u += 40) { const [x, y] = xy(u, mid(u) + 2); props.push({ kind: 'rock', x: x * T + 8, y: y * T + 13, seed: 77 + u, v: 0, solid: false, milestone: true }); }
    // ruins near the road
    const ruins = [];
    for (const ru of E().RUINS) {
      const t = ((ru.x - P0.x) * dx + (ru.y - P0.y) * dy) / (dl * dl); if (t < 0.15 || t > 0.85) continue;
      const off = (ru.x - P0.x) * nx + (ru.y - P0.y) * ny; if (Math.abs(off) > 16) continue;
      const u = Math.round(t * (L - 1)), side = off > 0 ? 1 : -1, v = O.clamp(mid(u) + side * 8, 4, Wd - 8);
      const [bx, by] = xy(u, v);
      const spec = { seed: seed + 5, w: 5, d: 4, floors: 2, wealth: 0.6, condition: 0.2, wall: 'stone', stoneMat: 'stoneDark', roof: 'slate', roofType: 'gable', doorTile: 2, noFlowers: true };
      const bld = { id: 900 + ruins.length, type: 'ruin', name: ru.name, x: bx - 2, bottom: by, y: by - 3, w: 5, d: 4, floors: 2, wealth: 0.6, condition: 0.2, ruined: true, spec, ruinNote: ru.note };
      buildings.push(bld); ruins.push(bld);
      for (let yy = bld.y; yy <= bld.bottom; yy++) for (let xx = bld.x; xx < bld.x + bld.w; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) solid[yy * W + xx] = 1;
      trees.splice(0, trees.length, ...trees.filter((tr) => !(Math.abs(tr.x / T - (bx)) < 5 && Math.abs(tr.y / T - by) < 5)));
    }
    // a rival gang's camp off a wild and dangerous road
    let camp = null;
    const midKind = E().terrainAt(...mapAt(Math.floor(L / 2), Wd / 2));
    if (rd.danger >= 0.25 && ['forest', 'mountain', 'peak', 'marsh', 'moor'].includes(midKind)) {
      const g = E().regionAt(...mapAt(Math.floor(L / 2), Wd / 2));
      const gang = GANGS[g ? g.r.id : midKind === 'marsh' ? 'marsh' : 'moor'] || 'the Road Wolves';
      const u = Math.floor(L * (0.4 + rng.next() * 0.2)), side = rng.chance(0.5) ? 1 : -1, v = O.clamp(mid(u) + side * 7, 4, Wd - 6);
      const [bx, by] = xy(u, v);
      const spec = { seed: seed + 9, w: 3, d: 2, floors: 1, wealth: 0.2, condition: 0.6, wall: 'log', roof: 'thatch', roofType: 'side', doorTile: 1, noFlowers: true };
      const bld = { id: 950, type: 'hideout', name: `${gang.replace(/^the /, 'The ')}' camp`, x: bx - 1, bottom: by, y: by - 1, w: 3, d: 2, floors: 1, wealth: 0.2, condition: 0.6, level: 0, gang: 'rival', rivalGang: gang, spec };
      buildings.push(bld);
      for (let yy = bld.y - 1; yy <= bld.bottom + 2; yy++) for (let xx = bld.x - 2; xx < bld.x + bld.w + 2; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) { solid[yy * W + xx] = yy <= bld.bottom && xx >= bld.x && xx < bld.x + bld.w ? 1 : 0; if (ter[yy * W + xx] === TER.FOREST) ter[yy * W + xx] = TER.YARD; }
      trees.splice(0, trees.length, ...trees.filter((tr) => !(Math.abs(tr.x / T - bx) < 4 && Math.abs(tr.y / T - by) < 4)));
      camp = { gang, u, v, x: bx, y: by + 2, b: bld };
    }
    for (const b of buildings) { b.doorX = b.x + b.spec.doorTile; b.doorY = b.bottom + 1; }
    const [ax, ay] = xy(0, mid(0)), [zx, zy] = xy(L - 1, mid(L - 1));
    const exits = { [P0.id]: { x: ax, y: ay, side: horiz ? 'west' : 'north' }, [P1.id]: { x: zx, y: zy, side: horiz ? 'east' : 'south' } };
    const roadName = rd.name || 'the road';
    return {
      name: `${roadName.replace(/^the /, 'The ')}`, placeId: `road:${P0.id}|${P1.id}`, region: P0.region, W, H, T, ter, solid, buildings, props, trees, TER, seed, roadY: horiz ? mid(Math.floor(L / 2)) : null, exits, zones: {},
      road: { a: P0.id, b: P1.id, horiz, L, mid, xy, rd, camp, ruins, crossings, actors: [], travellers: [], name: roadName },
    };
  }

  // ---------- a stand-in "simulation" for the open road ----------
  // Nobody lives on the road. While you walk it, the town you left keeps living in the background,
  // and the shared clock and weather come from home.
  function roadSim(world, home, left) {
    const s = Object.create(home);
    Object.assign(s, { world, people: [], households: [], biz: new Map(), dead: [], byId: new Map(), marks: [], dropped: [], bodies: [], carries: [], puffs: [], build: { sites: [], tickMinute() {}, siteInfo() { return { stage: 10, prog: 1 }; } }, gangs: home.gangs, roadLeft: left });
    s.tick = function (dtm) { if (left && left !== home) left.tick(dtm); };
    s.where = () => world.road.name;
    s.seers = () => [];
    s.building = (id) => world.buildings.find((b) => b.id === id);
    return s;
  }

  function setup(game, home) {
    const K = home.kingdom, PS = O.PlayerState;
    const roads = new Map();
    const roadFor = (a, b) => { const key = [a, b].sort().join('|'); if (!roads.has(key)) roads.set(key, makeRoadWorld(K, a, b)); return roads.get(key); };
    O.Roads.roadFor = roadFor;

    // walking off the edge of a town onto a road, or off the end of a road into a town
    let cooldown = 0;
    game.hooks.update.push((dt) => {
      cooldown = Math.max(0, cooldown - dt);
      if (game.scene || cooldown > 0 || !game.world.exits || game.player.locked) return;
      const w = game.world, p = game.player, tx = p.x / T, ty = p.y / T;
      for (const [id, ex] of Object.entries(w.exits)) {
        if (!ex || ex.x == null || !K.place(id)) continue;
        const atEdge = ex.side === 'west' ? tx < 0.9 : ex.side === 'east' ? tx > w.W - 0.9 : ex.side === 'north' ? ty < 1.1 : ty > w.H - 0.6;
        const near = ex.side === 'west' || ex.side === 'east' ? Math.abs(ty - (ex.y + 0.8)) < 2.6 : Math.abs(tx - (ex.x + 0.5)) < 2.6;
        if (!atEdge || !near) continue;
        const rd = w.road ? null : K.road(w.placeId, id);
        if (rd && rd.damaged) { O.UI.say(`The road to ${K.place(id).name} is closed: storm damage. Men are at work on it.`); cooldown = 3; p.x -= ex.side === 'east' ? 12 : ex.side === 'west' ? -12 : 0; p.y -= ex.side === 'south' ? 12 : ex.side === 'north' ? -12 : 0; return; }
        cooldown = 1.5;
        if (w.road) arriveFromRoad(w, id); else setOut(w.placeId, id);
        return;
      }
    });

    function placeAt(world, ex, inward = 2) {
      const p = game.player;
      const d = ex.side === 'west' ? [inward, 0] : ex.side === 'east' ? [-inward, 0] : ex.side === 'north' ? [0, inward] : [0, -inward];
      p.x = (ex.x + d[0]) * T + 8; p.y = (ex.y + d[1]) * T + 10;
      p.dir = ex.side === 'west' ? 2 : ex.side === 'east' ? 1 : ex.side === 'north' ? 0 : 3;
      if (p.mount) { p.mount.x = p.x; p.mount.y = p.y; }
    }

    function setOut(from, to) {
      const rw = roadFor(from, to);
      const left = O.SimRef.cur;
      const v = O.Travel.visited.get(from); if (v) v.leftAt = home.day * 1440 + home.minute;
      O.SimRef.cur = roadSim(rw, home, left === home ? null : left);
      game.load(rw); O.applySeason && O.applySeason();
      placeAt(rw, rw.exits[from]);
      spawnTravellers(rw);
      const other = K.place(to);
      O.UI.say(`You take ${rw.road.name} towards ${other.name}.`);
    }
    function arriveFromRoad(rw, to) {
      const from = rw.road.a === to ? rw.road.b : rw.road.a;
      O.Travel.arrive(from, to, true);
    }
    O.Roads.setOut = setOut;

    // ---------- people on the road ----------
    function spawnTravellers(rw) {
      const R = rw.road, rng = O.RNG(home.day * 13 + rw.seed);
      R.actors = []; R.travellers = [];
      const n = 2 + rng.int(0, 3);
      for (let i = 0; i < n; i++) {
        const role = rng.pick(['merchant', 'villager', 'farmer', 'courier', 'priest', 'farmhand', 'woodcutter']);
        const a = O.Char.makeAppearance(O.hash('trav', rw.seed, home.day, i), { role, age: rng.int(17, 64) });
        const u = rng.int(10, R.L - 10), dirn = rng.chance(0.5) ? 1 : -1;
        const tr = { a, u, v: R.mid(u) + (dirn > 0 ? 0 : 1), dirn, speed: 22 + rng.int(0, 14), ft: rng.next(), anim: 'walk', traveller: true, x: 0, y: 0, dir: 0, name: rng.pick(O.Data.NAMES[a.sex === 'm' ? 'm' : 'f']), role };
        R.travellers.push(tr);
      }
      // the gang's people round their fire
      if (R.camp) {
        R.gangsters = [];
        for (let i = 0; i < 4; i++) { const a = O.Char.makeAppearance(O.hash('gang', rw.seed, i), { role: 'outlaw', age: 20 + i * 6, sex: i === 3 ? 'f' : 'm' }); const [x, y] = R.xy(R.camp.u + (i % 2 ? 2 : -2), R.camp.v + (i < 2 ? 2 : 3)); R.gangsters.push({ a, x: x * T + 8, y: y * T + 10, dir: i % 2 ? 1 : 2, anim: i === 0 ? 'idle' : 'talk', ft: i * 0.4, gangster: true }); }
        R.robbedToday = R.robbedToday === home.day ? home.day : null;
      }
    }
    const caravanCart = () => O.Env.prop('cart', 5, 1);
    game.hooks.update.push((dt) => {
      const w = game.world, R = w.road; if (!R) return;
      const pl = game.player;
      for (const tr of R.travellers) {
        tr.ft += dt; tr.chatCd = Math.max(0, (tr.chatCd || 0) - dt);
        // two travellers meeting on the road stop to pass the time of day; so does one you walk up to
        if (!tr.pause && !tr.chatCd) {
          const near = R.travellers.find((o) => o !== tr && !o.chatCd && Math.abs(o.u - tr.u) < 1.6 && o.dirn !== tr.dirn);
          if (near) { tr.pause = near.pause = 4 + ((tr.u * 7) % 4); tr.with = near; near.with = tr; }
          else if (Math.hypot(pl.x - tr.x, pl.y - tr.y) < 30) { tr.pause = 2.5; tr.with = pl; }
        }
        if (tr.pause) {
          tr.pause = Math.max(0, tr.pause - dt); tr.anim = 'talk';
          const o = tr.with; if (o) tr.dir = O.dirOf(o.x - tr.x, o.y - tr.y);
          if (!tr.pause) { tr.chatCd = 12; tr.with = null; tr.anim = 'walk'; }
          continue;
        }
        tr.anim = 'walk';
        tr.u += tr.dirn * tr.speed * dt / T;
        if (tr.u < 1 || tr.u > R.L - 2) { tr.dirn *= -1; tr.u = O.clamp(tr.u, 1, R.L - 2); }
        // follow the road's line smoothly: blend between the bends rather than stepping a tile sideways
        const u0 = Math.floor(tr.u), f = tr.u - u0, lane = tr.dirn > 0 ? 0.3 : 1.2;
        const target = R.mid(u0) * (1 - f) + R.mid(u0 + 1) * f + lane;
        tr.vs = tr.vs == null ? target : tr.vs + (target - tr.vs) * Math.min(1, dt * 3);
        const [x, y] = R.horiz ? [tr.u, tr.vs] : [tr.vs, tr.u];
        const nx = x * T + 8, ny = y * T + 10;
        if (tr.x || tr.y) tr.dir = O.dirOf(nx - tr.x, ny - tr.y);
        tr.x = nx; tr.y = ny;
      }
      for (const g of R.gangsters || []) g.ft += dt;
      // caravans of the realm on this road
      const cars = K.caravans.filter((c) => { const a = c.path[c.leg], b = c.path[c.leg + 1]; return b && ((a === R.a && b === R.b) || (a === R.b && b === R.a)); });
      R.carts = cars.map((c) => { const fwd = c.path[c.leg] === R.a; const t = O.clamp(c.prog, 0, 1), u = (fwd ? t : 1 - t) * (R.L - 1); const v = R.mid(Math.floor(u)) + 0.6; const [x, y] = R.horiz ? [u, v] : [v, u]; return { x: x * T + 8, y: y * T + 12, caravan: c, dir: fwd ? 2 : 1, cart: true }; });
      game.actors = [game.player, ...R.travellers, ...(R.gangsters || []), ...R.carts];
      // the rival gang wants a toll from anyone who passes their camp
      if (R.camp && !O.panelOpen && R.robbedToday !== home.day) {
        const [cx, cy] = R.xy(R.camp.u, R.mid(R.camp.u)), d = Math.hypot(game.player.x - (cx * T + 8), game.player.y - (cy * T + 8));
        if (d < 70) { R.robbedToday = home.day; O.Roads.ambush(R); }
      }
    });
    const _frame = game.actorFrame.bind(game);
    game.actorFrame = (a) => {
      if (a.cart) { const sp = caravanCart(); const c = sp.canvas; c.ox = sp.ox; c.gy = sp.oy; return c; }
      return _frame(a);
    };

    // a rival gang stops you on the road
    O.Roads.ambush = (R) => {
      const gang = R.camp.gang, toll = 6 + Math.round(home.rng.next() * 18 + R.rd.danger * 20);
      O.Panels.open(`${gang.replace(/^the /, 'The ')}`, `<p class="speech">“That's far enough. This is our road. Purse or blood.”</p><p class="caption">Four of ${gang} come out from their camp beside ${R.name.replace(/^The /, 'the ')}.</p>
        <div class="topics"><button data-b="pay">Pay ${toll}d</button><button data-b="fight">Fight</button><button data-b="flee">${game.player.mount ? 'Spur your horse on' : 'Run for it'}</button>${PS.rep.criminal > 0.3 ? '<button data-b="talk">Speak their language</button>' : ''}</div>`, (r) => {
        const done = (msg, bad) => { O.Panels.close(); if (msg) O.UI.say(msg, bad ? 'bad' : ''); };
        r.querySelector('[data-b=pay]').onclick = () => { const paid = Math.min(PS.money, toll); PS.money -= paid; done(`You hand over ${paid}d. They let you by, laughing.`, true); };
        r.querySelector('[data-b=fight]').onclick = () => {
          const armed = O.Combat && O.Combat.armed(); const win = home.rng.chance(0.3 + (armed ? 0.25 : 0) + (PS.hp > 70 ? 0.1 : 0));
          PS.hp = Math.max(5, PS.hp - (win ? 15 : 35));
          (PS.wounds = PS.wounds || []).push({ kind: armed ? 'slash' : 'bruise', sev: win ? 0.4 : 0.8, day: home.day, part: 'torso', seed: 7 });
          if (win) { const loot = 5 + home.rng.int(0, 20); PS.money += loot; PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.03); R.camp.beaten = home.day; done(`You drive them back to their fire and take ${loot}d from the one who fell.`); }
          else { const lost = Math.floor(PS.money * 0.5); PS.money -= lost; done(`They beat you bloody and take ${lost}d.`, true); }
        };
        r.querySelector('[data-b=flee]').onclick = () => { const ok = home.rng.chance(game.player.mount ? 0.85 : 0.4); if (ok) done('You break away and leave them cursing in the road.'); else { const lost = Math.floor(PS.money * 0.3); PS.money -= lost; PS.hp = Math.max(5, PS.hp - 15); done(`They catch you. You lose ${lost}d and some skin.`, true); } };
        const tk = r.querySelector('[data-b=talk]'); if (tk) tk.onclick = () => done(`“Ah — one of us. Go on, then.” They wave you past, and tell you which caravans run soft.`);
      });
    };

    // talk to travellers, read the signposts, look round the ruins
    O.roadCandidate = () => {
      const w = game.world, R = w.road; if (!R || game.scene) return null;
      const p = game.player; let best = null, bd = 26;
      for (const tr of R.travellers) { const d = Math.hypot(tr.x - p.x, tr.y - p.y); if (d < bd) { bd = d; best = { type: 'traveller', tr, d, x: tr.x, y: tr.y - 44 }; } }
      for (const b of w.buildings) if (b.ruined) { const d = Math.hypot(b.doorX * T + 8 - p.x, (b.doorY) * T - p.y); if (d < 40 && d < bd) { bd = d; best = { type: 'ruin', b, d, x: b.doorX * T + 8, y: b.doorY * T - 30 }; } }
      for (const pr of w.props) if (pr.kind === 'signpost') { const d = Math.hypot(pr.x - p.x, pr.y - p.y); if (d < 22 && d < bd) { bd = d; best = { type: 'signpost', d, x: pr.x, y: pr.y - 30 }; } }
      return best;
    };
    O.roadLabel = (c) => c.type === 'traveller' ? `Talk to the ${c.tr.role === 'villager' ? 'traveller' : c.tr.role}` : c.type === 'ruin' ? `Look around ${c.b.name}` : 'Read the signpost';
    O.roadAct = (c) => {
      const w = game.world, R = w.road;
      if (c.type === 'signpost') { const a = K.place(R.a), b = K.place(R.b); O.UI.say(`${R.name.replace(/^the /, 'The ')}: ${a.name} one way, ${b.name} the other.`); return; }
      if (c.type === 'traveller') {
        const tr = c.tr, to = K.place(tr.dirn > 0 ? R.b : R.a);
        const lines = [`Bound for ${to.name}. Long way yet.`, `Mind ${R.camp ? R.camp.gang : 'the woods'} further on.`, `I hear ${K.news.length ? K.news[K.news.length - 1].text.charAt(0).toLowerCase() + K.news[K.news.length - 1].text.slice(1) : 'little worth the telling'}`, `Fine weather for walking, if it holds.`, `${to.name}? Good ale there.`];
        O.UI.dialog.open({ name: tr.name, color: '#8a6a4a', text: lines[(Math.floor(tr.u) + home.day) % lines.length], options: [] });
        return;
      }
      if (c.type === 'ruin') {
        const b = c.b;
        const found = b._searched !== home.day && home.rng.chance(0.25) ? home.rng.pick(['herbs', 'bread', 'dagger']) : null;
        b._searched = home.day;
        if (found && PS.add(found)) O.UI.say(`${b.ruinNote.charAt(0).toUpperCase() + b.ruinNote.slice(1)}. Among the fallen stones you find a ${O.Data.GOODS[found].name.toLowerCase()}.`);
        else O.UI.say(`${b.name.charAt(0).toUpperCase() + b.name.slice(1)}: ${b.ruinNote}. Wind in the empty windows, and nothing else.`);
      }
    };
  }

  O.Roads = { attachExits, makeRoadWorld, roadSim, setup, GANGS };
})();
