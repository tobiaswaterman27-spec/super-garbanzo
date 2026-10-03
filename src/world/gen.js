// Procedural settlements. Any place in the kingdom can be generated from its stats (kind, region,
// population, wealth) into a map with the same structure as Ashford, following how settlements
// grow: a through-road with exits at both ends, a green or market square where a track meets it,
// houses fronting the streets, a back lane, trades placed where they belong (the smith on the
// road, the mill by water, woodcutters at the forest edge, fishers on the shore, miners at the
// hill), farmland outside, woods beyond. Regional character comes from materials and land.
'use strict';
(function () {
  const T = 16, TER = O.Village.TER;
  const STYLE = {
    north: { walls: [['stone', 5], ['log', 2], ['timber', 1]], roofs: [['slate', 5], ['shingle', 2]], plasters: ['plaster', 'plasterWhite'], stoneMat: 'stoneNorth' },
    east: { walls: [['timber', 4], ['stone', 2], ['brick', 2]], roofs: [['tile', 5], ['slate', 2]], plasters: ['plasterWhite', 'plasterPink', 'plasterOchre'], stoneMat: 'stoneWarm' },
    south: { walls: [['timber', 4], ['stone', 2]], roofs: [['tile', 4], ['thatch', 3]], plasters: ['plasterOchre', 'plaster', 'plasterPink'], stoneMat: 'stoneWarm' },
    west: { walls: [['plank', 3], ['log', 2], ['timber', 2], ['stone', 1]], roofs: [['thatch', 4], ['shingle', 3]], plasters: ['plaster', 'plasterWhite'], stoneMat: 'stone' },
  };

  function makeSettlement(place) {
    const seed = O.hash('settle', place.id);
    const rng = O.RNG(seed);
    const town = place.kind === 'town' || place.kind === 'port' || place.pop > 600;
    const W = town ? 100 : 80, H = town ? 64 : 56;
    const ter = new Uint8Array(W * H), solid = new Uint8Array(W * H);
    const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) ter[y * W + x] = t; };
    const fill = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
    const st = STYLE[place.region] || STYLE.south;
    const coast = place.region === 'west';
    const shoreX = coast ? 9 : -1;

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = Math.min(y, H - 1 - y, W - 1 - x, coast ? 99 : x);
      if (edge < 3 || (O.fbm(x / 6, y / 6, seed & 255, 2) > 0.7 && (y < 10 || x > W - 10))) set(x, y, TER.FOREST);
      if (coast) { const sx = shoreX + Math.round(Math.sin(y / 6) * 1.5); if (x < sx) set(x, y, TER.WATER); else if (x < sx + 2) set(x, y, TER.SAND); }
    }
    const roadY = Math.floor(H / 2), laneY = roadY + 11, sqX = Math.floor(W / 2) - 8;
    fill(coast ? shoreX + 2 : 0, roadY, W - 1, roadY + 1, TER.ROAD);
    fill(sqX + 7, 4, sqX + 8, roadY - 1, TER.ROAD); // north track
    if (town) fill(sqX, roadY - 8, sqX + 15, roadY - 1, TER.COBBLE); else fill(sqX + 2, roadY - 6, sqX + 13, roadY - 1, TER.GRASS);
    fill(coast ? shoreX + 4 : 6, laneY, W - 8, laneY + 1, TER.ROAD);
    fill(sqX + 7, roadY + 2, sqX + 8, laneY - 1, TER.ROAD);
    // farmland south of the lane, or vineyard rows in the south
    const fy0 = laneY + 6, fy1 = H - 6;
    fill(W - 34, fy0, W - 8, fy1, TER.FIELD);
    fill(coast ? shoreX + 5 : 6, laneY + 3, coast ? shoreX + 18 : 22, laneY + 4, TER.YARD);

    const buildings = [], props = [], trees = [];
    let nextId = 1;
    const B = (o) => { const b = Object.assign({ id: nextId++, floors: 1, wealth: 0.5, condition: 0.9 }, o); b.y = b.bottom - b.d + 1; b.spec = Object.assign({ seed: O.hash('bld', seed, b.id), w: b.w, d: b.d, floors: b.floors, wealth: b.wealth, condition: b.condition }, b.look); buildings.push(b); return b; };
    const wealthAt = (x) => O.clamp(place.wealth + 0.2 * (1 - Math.min(1, Math.abs(x - (sqX + 8)) / 30)) + rng.float(-0.15, 0.15), 0.1, 0.95);
    const look = (wl, extra = {}) => Object.assign({ wall: rng.weighted(st.walls), roof: wl < 0.3 && place.region !== 'north' ? 'thatch' : rng.weighted(st.roofs), roofType: rng.chance(0.5) ? 'gable' : 'side', chimney: true, plaster: rng.pick(st.plasters), stoneMat: st.stoneMat, doorTile: 1 }, extra);
    const house = (x, bottom, w, d) => { const wl = wealthAt(x); return B({ type: 'house', name: 'House', x, bottom, w, d, wealth: wl, floors: wl > 0.65 && rng.chance(0.5) ? 2 : 1, condition: O.clamp(0.35 + wl * 0.6, 0.2, 1), look: look(wl, { doorTile: rng.int(0, w - 1) }) }); };

    // trades around the square (north side faces the cobbles/green)
    const top = roadY - (town ? 9 : 7);
    B({ type: 'tavern', name: `The ${rng.pick(['Golden', 'Drowned', 'Black', 'Merry', 'Old', 'Red'])} ${rng.pick(['Stag', 'Anchor', 'Goose', 'Plough', 'Boar', 'Bell'])}`, x: sqX, bottom: top, w: 6, d: 5, floors: 2, wealth: 0.65, look: look(0.65, { roofType: 'gable', sign: 'mug', doorTile: 2 }) });
    B({ type: 'bakery', name: 'Bakery', x: sqX + 10, bottom: top, w: 4, d: 4, wealth: 0.55, look: look(0.55, { sign: 'bread', shopWindow: true }) });
    B({ type: 'chapel', name: `Chapel of St. ${rng.pick(['Wilfrid', 'Brannoc', 'Petroc', 'Edith', 'Cuthbert', 'Agatha'])}`, x: sqX - 7, bottom: top, w: 5, d: 5, wealth: 0.6, look: { wall: 'stone', stoneMat: st.stoneMat, roof: 'slate', roofType: 'gable', sign: 'cross', doorTile: 2, wallH: 38, noFlowers: true } });
    // the main road's north side
    const rowBottom = roadY - 2;
    let x = coast ? shoreX + 4 : 4;
    const roadTrades = [
      { type: 'smithy', name: 'Smithy', w: 5, d: 4, look: { wall: 'stone', stoneMat: st.stoneMat, roof: 'slate', chimney: true, chimneyX: 0.8, sign: 'anvil', doorTile: 1 } },
      { type: 'store', name: 'General Store', w: 5, d: 4, look: look(0.55, { roofType: 'gable', sign: 'scales', doorTile: 2, shopWindow: true }) },
      { type: 'guard', name: town ? 'Watch House' : 'Watch Hut', w: town ? 5 : 4, d: 4, look: { wall: 'stone', stoneMat: st.stoneMat, roof: 'slate', roofType: 'gable', chimney: true, sign: 'shield', doorTile: 1, noFlowers: true } },
      { type: 'doctor', name: town ? "Physician's House" : "Herb-wife's Cottage", w: 4, d: 4, look: look(0.6, { sign: 'herb', doorTile: 1 }) },
    ];
    if (town) roadTrades.push({ type: 'stable', name: 'Stables', w: 5, d: 3, look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', bigDoor: true, doorTile: 2, chimney: false, noFlowers: true } });
    const rowSlots = [];
    while (x < W - 8) { const w = rng.int(3, 5); if (x + w >= sqX - 8 && x <= sqX + 15) { x = sqX + 17; continue; } rowSlots.push([x, w]); x += w + 1; }
    rng.next();
    for (const [sx, w] of rowSlots) {
      const tr = roadTrades.length && rng.chance(0.45) ? roadTrades.shift() : null;
      if (tr) B(Object.assign({ x: sx, bottom: rowBottom, wealth: 0.55, floors: tr.type === 'doctor' ? 2 : 1 }, tr, { w: Math.min(tr.w, w + 1) }));
      else house(sx, rowBottom, w, rng.int(3, 4));
    }
    while (roadTrades.length) { const tr = roadTrades.shift(); const sx = sqX + 17 + buildings.filter((b) => b.bottom === top).length * 6; B(Object.assign({ x: Math.min(W - 10, sx), bottom: top, wealth: 0.55 }, tr)); }
    // back lane, north side
    x = coast ? shoreX + 4 : 6;
    while (x < W - 12) { const w = rng.int(3, 4); if (x + w >= sqX + 6 && x <= sqX + 9) { x = sqX + 10; continue; } house(x, laneY - 1, w, rng.int(3, 4)); x += w + 1 + (rng.chance(0.2) ? 1 : 0); }
    // farm, mill, woodcutter, and the regional trade
    const fx = coast ? shoreX + 6 : 7;
    B({ type: 'farmhouse', name: 'Farm', x: fx, bottom: laneY + 2 + 3, w: 4, d: 3, wealth: 0.4, look: look(0.4, { doorTile: 1 }) });
    B({ type: 'barn', name: 'Barn', x: fx + 6, bottom: laneY + 2 + 3, w: 6, d: 4, wealth: 0.3, look: { wall: 'plank', plankMat: 'plankRed', roof: 'shingle', roofType: 'gable', bigDoor: true, doorTile: 2, noFlowers: true } });
    B({ type: 'mill', name: place.region === 'south' || place.region === 'east' ? 'Windmill' : 'Mill', x: W - 14, bottom: laneY - 1, w: 4, d: 4, floors: 2, wealth: 0.5, look: { wall: 'stone', stoneMat: st.stoneMat, roof: 'thatch', roofType: 'gable', doorTile: 1, noFlowers: true } });
    B({ type: 'woodcutter', name: "Woodcutter's Hut", x: sqX + 1, bottom: 9, w: 3, d: 3, wealth: 0.25, condition: 0.6, look: { wall: 'log', roof: 'shingle', roofType: 'gable', chimney: true, doorTile: 1 } });
    if (coast) for (let i = 0; i < 3; i++) B({ type: i ? 'house' : 'fishery', name: i ? 'House' : 'Fishery', x: shoreX + 3 + i * 5, bottom: roadY - 13 + (i % 2), w: 4, d: 3, wealth: 0.35, look: { wall: 'plank', plankMat: 'plank', roof: 'thatch', roofType: 'side', chimney: true, doorTile: 1, noFlowers: true } });
    if (place.region === 'north') B({ type: 'mine', name: `${place.name} Mine`, x: W - 22, bottom: 10, w: 5, d: 3, wealth: 0.3, condition: 0.6, look: { wall: 'stone', stoneMat: 'stoneDark', roof: 'shingle', roofType: 'side', bigDoor: true, doorTile: 2, chimney: false, noFlowers: true } });

    for (const b of buildings) {
      for (let yy = b.y; yy <= b.bottom; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) { if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; solid[yy * W + xx] = 1; if (ter[yy * W + xx] === TER.FOREST || ter[yy * W + xx] === TER.FIELD) set(xx, yy, TER.GRASS); }
      b.doorX = b.x + b.spec.doorTile; b.doorY = b.bottom + 1;
      if (ter[b.doorY * W + b.doorX] === TER.GRASS || ter[b.doorY * W + b.doorX] === TER.FOREST) set(b.doorX, b.doorY, TER.YARD);
    }

    const P = (kind, tx, ty, opts = {}) => { const p = Object.assign({ kind, x: tx * T + 8, y: ty * T + 14, seed: rng.int(1, 1e6), v: 0, solid: true }, opts); props.push(p); if (p.solid) solid[ty * W + tx] = 1; return p; };
    P('well', sqX + 8, roadY - 4, { y: (roadY - 4) * T + 15 }); solid[(roadY - 4) * W + sqX + 7] = 1;
    if (town) { P('stall', sqX + 3, roadY - 2, { v: 1 }); solid[(roadY - 2) * W + sqX + 2] = 1; solid[(roadY - 2) * W + sqX + 4] = 1; P('stall', sqX + 12, roadY - 2, { v: 2 }); solid[(roadY - 2) * W + sqX + 11] = 1; solid[(roadY - 2) * W + sqX + 13] = 1; }
    P('lamp', sqX, roadY - 1); P('lamp', sqX + 15, roadY - 1); P('signpost', sqX + 9, roadY + 2, { solid: false }); P('bench', sqX + 2, roadY - 5, { solid: false });
    for (let xx = W - 34; xx <= W - 8; xx++) P('fenceH', xx, fy0 - 1, { solid: xx !== W - 20 });
    for (let yy = fy0; yy <= fy1; yy++) for (let xx = W - 34; xx <= W - 8; xx++) props.push({ kind: place.region === 'south' && xx > W - 20 ? 'cabbage' : 'wheat', x: xx * T + 8, y: yy * T + 15, seed: 1, v: 2, solid: false, flat: true, field: place.region === 'south' && xx > W - 20 ? 'cabbage' : 'wheat' });
    if (coast) for (let i = 0; i < 4; i++) P('boat', shoreX - 1, roadY - 12 + i * 5, { solid: true, seed: i });
    if (place.region === 'north') { P('cart', W - 15, 11, { v: 1 }); for (let i = 0; i < 6; i++) P('rock', W - 26 + i * 2, 12 + (i % 2), { solid: true }); }
    P('hay', fx + 13, laneY + 7); P('woodpile', sqX + 4, 8);

    const occupied = (xx, yy) => solid[yy * W + xx] || (ter[yy * W + xx] !== TER.GRASS && ter[yy * W + xx] !== TER.FOREST);
    for (let yy = 1; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      if (occupied(xx, yy)) continue;
      let near = false; for (const b of buildings) if (xx >= b.x - 2 && xx <= b.x + b.w + 1 && yy >= b.y - 3 && yy <= b.bottom + 2) near = true;
      const forest = ter[yy * W + xx] === TER.FOREST, r = rng.next();
      if (!near && (forest ? r < 0.33 : r < 0.02) && Math.abs(yy - roadY) > 1 && (xx + yy) % 2 === 0) {
        const kind = place.region === 'north' ? rng.weighted([['pine', 5], ['birch', 1]]) : place.region === 'west' ? rng.weighted([['pine', 2], ['oak', 2]]) : rng.weighted([['oak', 4], ['birch', 1], ['pine', 1]]);
        trees.push({ kind, x: xx * T + 8 + rng.int(-3, 3), y: yy * T + 14, seed: rng.int(1, 1e6) }); solid[yy * W + xx] = 1;
      } else if (!near && r < (forest ? 0.4 : 0.05)) props.push({ kind: rng.weighted([['bush', 2], ['rock', 1]]), x: xx * T + 8, y: yy * T + 13, seed: rng.int(1, 1e6), solid: false });
      else if (r < 0.18) props.push({ kind: r < 0.06 ? 'flowers' : 'grass', x: xx * T + rng.int(2, 14), y: yy * T + rng.int(4, 14), seed: rng.int(1, 30), solid: false, flat: true });
    }
    for (let i = 0; i < W * H; i++) if (ter[i] === TER.WATER) solid[i] = 1;
    const zones = {
      square: [sqX + 1, roadY - 6, sqX + 14, roadY - 1], bench: [sqX + 2, roadY - 5], farm: [W - 33, fy0, W - 9, fy1], wood: [sqX - 6, 3, sqX + 12, 9], east: [W - 1, roadY],
      patrol: [[sqX + 8, roadY], [Math.max(6, sqX - 20), roadY], [Math.max(8, sqX - 20), laneY], [sqX + 8, laneY], [Math.min(W - 10, sqX + 30), laneY], [Math.min(W - 6, sqX + 34), roadY], [sqX + 8, roadY - 3]],
    };
    return { zones, name: place.name, placeId: place.id, region: place.region, W, H, T, ter, solid, buildings, props, trees, TER, seed, roadY, exits: { west: [coast ? shoreX + 3 : 0, roadY], east: [W - 1, roadY] }, generated: true };
  }

  O.Gen = { makeSettlement, STYLE };
})();
