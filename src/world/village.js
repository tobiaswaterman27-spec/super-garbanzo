// The first playable settlement: Ashford, a small southern village on a river crossing.
// Layout follows how villages actually grew: a through-road and river crossing, a square where the
// north track meets the road, houses fronting the streets, a back lane, a farm on the edge and
// woodland beyond.
'use strict';
(function () {
  const T = 16;
  const TER = { GRASS: 0, ROAD: 1, COBBLE: 2, FIELD: 3, WATER: 4, SAND: 5, FOREST: 6, YARD: 7, BRIDGE: 8 };

  function makeVillage(seed = 7) {
    const W = 96, H = 64;
    const rng = O.RNG(seed);
    const ter = new Uint8Array(W * H);
    const solid = new Uint8Array(W * H);
    const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) ter[y * W + x] = t; };
    const fill = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };

    // woodland margins
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (edge < 3 || x > 86 || O.fbm(x / 6, y / 6, seed, 2) > 0.7 && (y < 14 || x < 6)) set(x, y, TER.FOREST);
    }
    // roads
    fill(0, 30, W - 1, 31, TER.ROAD);          // King's Road (through-road)
    fill(45, 4, 46, 29, TER.ROAD);             // North track to the woodcutters
    fill(8, 41, 76, 42, TER.ROAD);             // Mill Lane
    fill(45, 32, 46, 40, TER.ROAD);            // lane connector
    fill(20, 43, 21, 51, TER.ROAD);            // farm track
    fill(37, 22, 55, 29, TER.COBBLE);          // village square
    fill(8, 52, 34, 54, TER.YARD);             // farmyard
    // fields
    fill(6, 56, 34, 61, TER.FIELD);
    fill(49, 45, 72, 57, TER.FIELD);
    // river with sandy banks and a bridge
    for (let y = 0; y < H; y++) {
      const wob = Math.round(Math.sin(y / 7) * 1.2);
      for (let x = 79 + wob; x <= 84 + wob; x++) set(x, y, x === 79 + wob || x === 84 + wob ? TER.SAND : TER.WATER);
    }
    fill(78, 30, 85, 31, TER.BRIDGE);

    const buildings = [], props = [], trees = [];
    let nextId = 1;
    const B = (o) => {
      const b = Object.assign({ id: nextId++, floors: 1, wealth: 0.5, condition: 0.9 }, o);
      b.y = b.bottom - b.d + 1;
      b.spec = Object.assign({ seed: O.hash('bld', seed, b.id), w: b.w, d: b.d, floors: b.floors, wealth: b.wealth, condition: b.condition }, b.look);
      buildings.push(b);
      return b;
    };
    const rich = (x) => 0.35 + 0.4 * (1 - Math.min(1, Math.abs(x - 46) / 40)); // wealth falls off from the square
    const house = (x, bottom, w, d, extra = {}) => {
      const wl = O.clamp(rich(x) + rng.float(-0.2, 0.2), 0.1, 0.95);
      const wall = rng.weighted([['timber', 5], ['stone', 2], ['log', wl < 0.35 ? 3 : 0.5], ['plank', 1]]);
      const roof = wl < 0.35 ? 'thatch' : rng.weighted([['thatch', 3], ['shingle', 2], ['tile', wl > 0.6 ? 2 : 0.5], ['slate', 1]]);
      return B(Object.assign({ type: 'house', name: 'House', x, bottom, w, d, wealth: wl, condition: O.clamp(0.4 + wl * 0.6 + rng.float(-0.2, 0.2), 0.2, 1),
        look: { wall, roof, roofType: rng.chance(0.45) ? 'gable' : 'side', chimney: rng.chance(0.85), plaster: rng.pick(['plaster', 'plaster', 'plasterOchre', 'plasterPink', 'plasterWhite']), doorTile: rng.int(0, w - 1) } }, extra));
    };

    // Square, north edge (fronts on the cobbles)
    house(33, 21, 4, 4);
    B({ type: 'tavern', name: 'The Crooked Lantern', x: 38, bottom: 21, w: 6, d: 5, floors: 2, wealth: 0.7, look: { wall: 'timber', plaster: 'plasterOchre', roof: 'tile', roofType: 'gable', chimney: true, sign: 'mug', doorTile: 2 } });
    B({ type: 'bakery', name: "Hobb's Bakery", x: 48, bottom: 21, w: 4, d: 4, wealth: 0.6, look: { wall: 'timber', roof: 'thatch', chimney: true, chimneyX: 0.2, sign: 'bread', doorTile: 1, shopWindow: true } });
    house(52, 21, 4, 4);
    // King's Road, north side
    house(4, 28, 4, 3); house(9, 28, 4, 4); house(14, 28, 3, 3); house(18, 28, 5, 4, { floors: 2 }); house(24, 28, 4, 4);
    B({ type: 'smithy', name: 'Ashford Smithy', x: 30, bottom: 28, w: 5, d: 4, wealth: 0.5, look: { wall: 'stone', roof: 'slate', chimney: true, chimneyX: 0.8, sign: 'anvil', doorTile: 1 } });
    B({ type: 'guard', name: 'Watch House', x: 57, bottom: 28, w: 5, d: 4, wealth: 0.55, look: { wall: 'stone', stoneMat: 'stoneNorth', roof: 'slate', roofType: 'gable', chimney: true, sign: 'shield', doorTile: 2, noFlowers: true } });
    B({ type: 'doctor', name: "Physician's House", x: 63, bottom: 28, w: 4, d: 4, floors: 2, wealth: 0.7, look: { wall: 'timber', plaster: 'plasterWhite', roof: 'tile', chimney: true, sign: 'herb', doorTile: 1 } });
    house(68, 28, 4, 4); house(73, 28, 4, 3);
    // Mill Lane, north side
    house(8, 40, 4, 4); house(13, 40, 4, 3); house(18, 40, 4, 4); house(23, 40, 3, 3);
    B({ type: 'store', name: 'General Store', x: 28, bottom: 40, w: 5, d: 4, wealth: 0.55, look: { wall: 'timber', plaster: 'plasterPink', roof: 'shingle', roofType: 'gable', chimney: true, sign: 'scales', doorTile: 2, shopWindow: true } });
    house(34, 40, 4, 4); house(39, 40, 5, 4, { floors: 2 }); house(48, 40, 4, 4); house(53, 40, 4, 3); house(58, 40, 4, 4);
    B({ type: 'chapel', name: 'Chapel of St. Aldric', x: 63, bottom: 40, w: 5, d: 5, wealth: 0.6, look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'slate', roofType: 'gable', sign: 'cross', doorTile: 2, wallH: 38, noFlowers: true } });
    house(69, 40, 4, 3);
    B({ type: 'mill', name: 'Ashford Mill', x: 74, bottom: 40, w: 4, d: 4, floors: 2, wealth: 0.5, look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'thatch', roofType: 'gable', doorTile: 1, noFlowers: true } });
    // Farm
    B({ type: 'farmhouse', name: 'Marsh Farm', x: 10, bottom: 51, w: 4, d: 3, wealth: 0.4, look: { wall: 'timber', roof: 'thatch', chimney: true, doorTile: 1 } });
    B({ type: 'barn', name: 'Marsh Barn', x: 23, bottom: 51, w: 6, d: 5, wealth: 0.3, look: { wall: 'plank', plankMat: 'plankRed', roof: 'shingle', roofType: 'gable', bigDoor: true, doorTile: 2, noFlowers: true } });
    // Woodcutter
    B({ type: 'woodcutter', name: "Woodcutter's Hut", x: 40, bottom: 9, w: 3, d: 3, wealth: 0.25, condition: 0.6, look: { wall: 'log', roof: 'shingle', roofType: 'gable', chimney: true, doorTile: 1 } });

    // stables and paddock east of the square, beside the King's Road
    B({ type: 'stable', name: 'Ashford Stables', x: 10, bottom: 34, w: 5, d: 3, wealth: 0.5, look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', roofType: 'side', bigDoor: true, doorTile: 2, chimney: false, noFlowers: true } });
    // hidden clearings in the woods: an abandoned camp anyone bold enough could claim, and the Crows' den
    B({ type: 'hideout', name: 'Abandoned camp', x: 8, bottom: 9, w: 3, d: 2, wealth: 0.2, condition: 0.6, level: 0, unclaimed: true, look: { wall: 'log', roof: 'shingle', roofType: 'gable', doorTile: 1, noFlowers: true } });
    B({ type: 'hideout', name: "The Crows' den", x: 89, bottom: 47, w: 3, d: 2, wealth: 0.2, condition: 0.6, level: 1, gang: 'crows', look: { wall: 'log', roof: 'thatch', roofType: 'gable', doorTile: 1, noFlowers: true } });

    // footprints, doorsteps
    for (const b of buildings) {
      for (let y = b.y; y <= b.bottom; y++) for (let x = b.x; x < b.x + b.w; x++) { solid[y * W + x] = 1; if (ter[y * W + x] === TER.FOREST) set(x, y, TER.GRASS); }
      b.doorX = b.x + b.spec.doorTile; b.doorY = b.bottom + 1;
      if (ter[b.doorY * W + b.doorX] === TER.GRASS || ter[b.doorY * W + b.doorX] === TER.FOREST) set(b.doorX, b.doorY, TER.YARD);
      if (b.type === 'hideout') for (let y = b.y - 1; y <= b.bottom + 2; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) if (ter[y * W + x] === TER.FOREST) set(x, y, TER.GRASS);
    }
    // woodcutter path
    fill(41, 10, 44, 10, TER.ROAD);

    // ---- props ----
    const P = (kind, tx, ty, opts = {}) => { const p = Object.assign({ kind, x: tx * T + 8, y: ty * T + 14, seed: rng.int(1, 1e6), v: 0, solid: true }, opts); props.push(p); if (p.solid) solid[ty * W + tx] = 1; return p; };
    P('well', 46, 25, { y: 25 * T + 15 }); solid[25 * W + 45] = 1;
    P('stall', 40, 27, { v: 1 }); solid[27 * W + 39] = 1; solid[27 * W + 41] = 1;
    P('stall', 51, 27, { v: 2 }); solid[27 * W + 50] = 1; solid[27 * W + 52] = 1;
    P('stall', 40, 24, { v: 3 }); solid[24 * W + 39] = 1; solid[24 * W + 41] = 1;
    P('crate', 43, 27); P('barrel', 53, 24); P('sack', 49, 27, { solid: false }); P('bench', 37, 23, { solid: false });
    P('lamp', 37, 29); P('lamp', 55, 29); P('signpost', 47, 32, { solid: false });
    // smithy yard
    P('anvil', 35, 29, { solid: false }); P('woodpile', 29, 28); P('barrel', 35, 27);
    // tavern
    P('barrel', 37, 21); P('barrel', 44, 21); P('crate', 44, 20, { solid: true });
    // bakery
    P('sack', 52, 22, { solid: false }); P('woodpile', 47, 20);
    // guard house
    P('banner', 56, 29, { solid: false }); P('banner', 62, 29, { solid: false });
    // farm
    P('hay', 30, 52); P('hay', 31, 54); P('cart', 17, 53, { v: 1 }); P('trough', 15, 54); P('woodpile', 9, 52);
    for (let x = 6; x <= 34; x++) { P('fenceH', x, 55, { solid: x !== 20 && x !== 21 }); }
    for (let x = 49; x <= 72; x++) if (x !== 60) P('fenceH', x, 44, { solid: true });
    // paddock fence by the stables, and a small pasture west of the King's Road houses
    for (let x = 16; x <= 22; x++) { P('fenceH', x, 32, { solid: true }); P('fenceH', x, 36, { solid: true }); }
    for (let y = 33; y <= 35; y++) { P('fenceV', 22, y, { solid: true }); }
    P('trough', 21, 35, { solid: true }); P('hay', 21, 33);
    for (let x = 2; x <= 7; x++) { P('fenceH', x, 32, { solid: true }); P('fenceH', x, 36, { solid: true }); }
    for (let y = 33; y <= 35; y++) { P('fenceV', 2, y, { solid: true }); P('fenceV', 7, y, { solid: true }); }
    // chapel graves
    for (let i = 0; i < 5; i++) P('gravestone', 68 + (i % 3), 37 - Math.floor(i / 3), { solid: true });
    // woodcutter
    P('woodpile', 43, 8); P('stump', 38, 10); P('stump', 37, 7); P('cart', 44, 11);
    // crops
    for (let y = 56; y <= 61; y++) for (let x = 6; x <= 34; x++) if (x % 1 === 0) props.push({ kind: x < 20 ? 'wheat' : 'cabbage', x: x * T + 8, y: y * T + 15, seed: 1, v: 3, solid: false, flat: true });
    for (let y = 45; y <= 57; y++) for (let x = 49; x <= 72; x++) props.push({ kind: y < 51 ? 'sprout' : 'wheat', x: x * T + 8, y: y * T + 15, seed: 1, v: y < 51 ? 1 : 2, solid: false, flat: true });

    // ---- trees & scatter ----
    const occupied = (x, y) => solid[y * W + x] || ter[y * W + x] !== TER.GRASS && ter[y * W + x] !== TER.FOREST;
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
      const t = ter[y * W + x];
      if (occupied(x, y)) continue;
      // keep a clear ring around buildings so roofs aren't buried in canopy
      let near = false; for (const b of buildings) if (x >= b.x - 2 && x <= b.x + b.w + 1 && y >= b.y - 3 && y <= b.bottom + (b.type === 'hideout' ? 3 : 2)) near = true;
      const forest = t === TER.FOREST;
      const r = rng.next();
      if (!near && (forest ? r < 0.33 : r < 0.025) && !(y >= 29 && y <= 32) && (x + y) % 2 === 0) {
        const kind = y < 18 || x > 86 ? rng.weighted([['pine', 3], ['oak', 2], ['birch', 1]]) : rng.weighted([['oak', 4], ['birch', 1], ['pine', 1]]);
        trees.push({ kind, x: x * T + 8 + rng.int(-3, 3), y: y * T + 14, seed: rng.int(1, 1e6) });
        solid[y * W + x] = 1;
      } else if (!near && r < (forest ? 0.42 : 0.05)) props.push({ kind: rng.weighted([['bush', 2], ['rock', 1], ['stump', forest ? 1 : 0.2]]), x: x * T + 8, y: y * T + 13, seed: rng.int(1, 1e6), solid: false });
      else if (r < 0.2) props.push({ kind: r < 0.07 ? 'flowers' : 'grass', x: x * T + rng.int(2, 14), y: y * T + rng.int(4, 14), seed: rng.int(1, 30), solid: false, flat: true });
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = ter[y * W + x]; if (t === TER.WATER) solid[y * W + x] = 1; }
    for (let x = 78; x <= 85; x++) { solid[30 * W + x] = 0; solid[31 * W + x] = 0; }

    return { name: 'Ashford', placeId: 'ashford', river: true, region: 'south', W, H, T, ter, solid, buildings, props, trees, TER, seed, roadY: 30, exits: { west: [0, 30], east: [W - 1, 30] } };
  }

  O.Village = { makeVillage, TER };
})();
