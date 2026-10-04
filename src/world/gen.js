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

  // How many people the living simulation keeps for a place: every soul in a small place, a
  // representative share of a big one (the rest are counted, and traded for, in the kingdom).
  const simTarget = (place) => (place.pop <= 120 ? place.pop : Math.round(120 + (place.pop - 120) * 0.27));
  const HOMES = new Set(['farmhouse', 'tavern', 'bakery', 'smithy', 'doctor', 'woodcutter', 'mill', 'store', 'sawmill', 'butcher', 'jeweller', 'apothecary', 'carpenter', 'armourer', 'mansion', 'townhouse', 'builder', 'weaver', 'tailor', 'cobbler', 'chandler', 'cooper', 'tanner', 'potter']);
  const estPeople = (b) => (b.type === 'house' ? O.clamp(Math.round(b.w * b.d * (b.floors || 1) / 5), 1, 7) : b.type === 'tenement' ? Math.max(2, Math.floor(b.w * b.d * b.floors / 15)) * 3 : b.type === 'keep' ? 5 : HOMES.has(b.type) ? 3 : 0);
  // Pull down the houses furthest from the heart of the place until it holds about as many people
  // as it should: a place grows outward from its square, so its edges are where it thins.
  function trimTo(buildings, target, cx, cy, minHouses = 2) {
    let est = buildings.reduce((a, b) => a + estPeople(b), 0);
    const houses = buildings.filter((b) => b.type === 'house').sort((a, b) => Math.hypot(b.x + b.w / 2 - cx, b.bottom - cy) - Math.hypot(a.x + a.w / 2 - cx, a.bottom - cy));
    let left = houses.length;
    for (const h of houses) { if (est <= target || left <= minHouses) break; buildings.splice(buildings.indexOf(h), 1); est -= estPeople(h); left--; }
    return est;
  }

  function makeSettlement(place) {
    if (place.kind === 'capital') return makeCity(place);
    if (place.kind === 'castle') return makeCastle(place);
    if (place.kind === 'hamlet' || place.pop <= 70) return makeHamlet(place);
    const seed = O.hash('settle', place.id);
    const rng = O.RNG(seed);
    const town = place.kind === 'town' || place.kind === 'port' || place.kind === 'city' || place.pop > 600;
    const target = simTarget(place), upper = target > 140;
    // two streets hold about 0.9 people per tile of width; a third, upper street adds half again
    const W = O.clamp(Math.round(target / (upper ? 1.3 : 0.9) + 14), 76, 170), H = town || upper ? 64 : 56;
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
    B({ type: 'chapel', name: `Chapel of St. ${rng.pick(['Wilfrid', 'Brannoc', 'Petroc', 'Edith', 'Cuthbert', 'Agatha'])}`, x: sqX - 7, bottom: top, w: 5, d: 5, wealth: 0.6, look: { wall: 'stone', stoneMat: st.stoneMat, roof: 'slate', roofType: 'gable', sign: 'cross', doorTile: 2, wallH: 64, noFlowers: true } });
    // the main road's north side
    const rowBottom = roadY - 2;
    let x = coast ? shoreX + 4 : 4;
    const roadTrades = [
      { type: 'smithy', name: 'Smithy', w: 5, d: 4, look: { wall: 'stone', stoneMat: st.stoneMat, roof: 'slate', chimney: true, chimneyX: 0.8, sign: 'anvil', doorTile: 1 } },
      { type: 'store', name: 'General Store', w: 5, d: 4, look: look(0.55, { roofType: 'gable', sign: 'scales', doorTile: 2, shopWindow: true }) },
      { type: 'guard', name: town ? 'Watch House' : 'Watch Hut', w: town ? 5 : 4, d: 4, look: { wall: 'stone', stoneMat: st.stoneMat, roof: 'slate', roofType: 'gable', chimney: true, sign: 'shield', doorTile: 1, noFlowers: true } },
      { type: 'doctor', name: town ? "Physician's House" : "Herb-wife's Cottage", w: 4, d: 4, look: look(0.6, { sign: 'herb', doorTile: 1 }) },
    ];
    // bigger places have more trades: a butcher and a carpenter, an apothecary, an inn, a school, a second farm
    const extra = [];
    if (target >= 90) extra.push({ type: 'butcher', name: 'Butcher', w: 4, d: 4, look: look(0.5, { doorTile: 1, shopWindow: true }) }, { type: 'carpenter', name: 'Carpenter', w: 5, d: 4, look: look(0.5, { doorTile: 2, sign: 'scales' }) }, { type: 'tailor', name: 'Tailor', w: 4, d: 4, look: look(0.55, { doorTile: 1, shopWindow: true, sign: 'scales' }) });
    if (target >= 110) extra.push({ type: 'builder', name: "Builder's Yard", w: 5, d: 3, look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', roofType: 'side', bigDoor: true, doorTile: 2, chimney: true, chimneyX: 0.12, sign: 'hammer', noFlowers: true } });
    if (target >= 130) extra.push({ type: 'weaver', name: 'Weaver', w: 4, d: 4, look: look(0.5, { doorTile: 1 }) }, { type: 'cobbler', name: 'Cobbler', w: 4, d: 3, look: look(0.5, { doorTile: 1, shopWindow: true }) }, { type: 'chandler', name: 'Chandler', w: 4, d: 3, look: look(0.5, { doorTile: 1, shopWindow: true }) });
    if (target >= 130) extra.push({ type: 'tanner', name: 'Tannery', w: 5, d: 3, look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', roofType: 'side', chimney: false, doorTile: 2, noFlowers: true } }, { type: 'potter', name: 'Potter', w: 4, d: 3, look: look(0.45, { doorTile: 1, chimney: true }) });
    if (target >= 170) extra.push({ type: 'cooper', name: 'Cooper', w: 5, d: 4, look: look(0.5, { doorTile: 2, bigDoor: true }) });
    if (target >= 130) extra.push({ type: 'apothecary', name: 'Apothecary', w: 4, d: 4, look: look(0.6, { doorTile: 1, sign: 'herb', shopWindow: true }) }, { type: 'tavern', name: `The ${rng.pick(['Crown', 'White Hart', 'Swan', 'Black Bull', 'Three Tuns'])} Inn`, w: 6, d: 5, floors: 2, look: look(0.6, { roofType: 'gable', sign: 'mug', doorTile: 2 }) }, { type: 'farmhouse', name: 'Home Farm', w: 4, d: 3, look: look(0.4, { doorTile: 1 }) });
    if (target >= 170) extra.push({ type: 'school', name: 'Grammar School', w: 5, d: 4, look: { wall: 'stone', stoneMat: st.stoneMat, roof: 'slate', roofType: 'gable', doorTile: 2, noFlowers: true } }, { type: 'bakery', name: 'Bakery', w: 4, d: 4, look: look(0.55, { sign: 'bread', shopWindow: true, doorTile: 1 }) }, { type: 'store', name: 'Chandler', w: 5, d: 4, look: look(0.55, { sign: 'scales', shopWindow: true, doorTile: 2 }) });
    roadTrades.push(...extra);
    if (town) roadTrades.push({ type: 'stable', name: 'Stables', w: 5, d: 3, look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', bigDoor: true, doorTile: 2, chimney: false, noFlowers: true } });
    const rowSlots = [];
    while (x < W - 8) { const w = rng.int(3, 5); if (x + w >= sqX - 8 && x <= sqX + 15) { x = sqX + 17; continue; } rowSlots.push([x, w]); x += w + 1; }
    rng.next();
    for (const [sx, w] of rowSlots) {
      const tr = roadTrades.length && rng.chance(roadTrades.length > 5 ? 0.6 : 0.45) ? roadTrades.shift() : null;
      if (tr) B(Object.assign({ x: sx, bottom: rowBottom, wealth: 0.55, floors: tr.type === 'doctor' ? 2 : 1 }, tr, { w: Math.min(tr.w, w + 1) }));
      else house(sx, rowBottom, w, rng.int(3, 4));
    }
    const clear = (x0, bottom, w, d) => buildings.every((b) => x0 + w + 1 <= b.x || x0 - 1 >= b.x + b.w || bottom + 1 <= b.y || bottom - d >= b.bottom);
    while (roadTrades.length) {
      const tr = roadTrades.shift(); let placed = false;
      for (let sx = sqX + 17; sx < W - 10 && !placed; sx++) if (clear(sx, top, tr.w, tr.d)) { B(Object.assign({ x: sx, bottom: top, wealth: 0.55 }, tr)); placed = true; }
      for (let sx = coast ? shoreX + 4 : 4; sx < sqX - 9 && !placed; sx++) if (clear(sx, top, tr.w, tr.d) && sx + tr.w < sqX - 8) { B(Object.assign({ x: sx, bottom: top, wealth: 0.55 }, tr)); placed = true; }
    }
    // back lane, north side
    x = coast ? shoreX + 4 : 6;
    while (x < W - 12) { const w = rng.int(3, 4); if (x + w >= sqX + 6 && x <= sqX + 9) { x = sqX + 10; continue; } house(x, laneY - 1, w, rng.int(3, 4)); x += w + 1 + (rng.chance(0.2) ? 1 : 0); }
    // an upper street behind the square for the bigger places
    if (upper && H >= 64) {
      const uy = roadY - 15;
      fill(coast ? shoreX + 4 : 4, uy, W - 6, uy + 1, TER.ROAD);
      x = coast ? shoreX + 4 : 5;
      while (x < W - 10) { const w = rng.int(3, 5); if (x + w >= sqX + 6 && x <= sqX + 9) { x = sqX + 10; continue; } house(x, uy - 1, w, rng.int(3, 4)); x += w + 1; }
    }
    // farm, mill, woodcutter, and the regional trade
    const fx = coast ? shoreX + 6 : 7;
    B({ type: 'farmhouse', name: 'Farm', x: fx, bottom: laneY + 2 + 3, w: 4, d: 3, wealth: 0.4, look: look(0.4, { doorTile: 1 }) });
    B({ type: 'barn', name: 'Barn', x: fx + 6, bottom: laneY + 2 + 3, w: 6, d: 4, wealth: 0.3, look: { wall: 'plank', plankMat: 'plankRed', roof: 'shingle', roofType: 'gable', bigDoor: true, doorTile: 2, noFlowers: true } });
    B({ type: 'mill', name: place.region === 'south' || place.region === 'east' ? 'Windmill' : 'Mill', x: W - 14, bottom: laneY - 1, w: 4, d: 4, floors: 2, wealth: 0.5, look: { wall: 'stone', stoneMat: st.stoneMat, roof: 'thatch', roofType: 'gable', doorTile: 1, noFlowers: true } });
    B({ type: 'woodcutter', name: "Woodcutter's Hut", x: sqX + 1, bottom: 9, w: 3, d: 3, wealth: 0.25, condition: 0.6, look: { wall: 'log', roof: 'shingle', roofType: 'gable', chimney: true, doorTile: 1 } });
    if (coast) for (let i = 0; i < 3; i++) B({ type: i ? 'house' : 'fishery', name: i ? 'House' : 'Fishery', x: shoreX + 3 + i * 5, bottom: roadY - 13 + (i % 2), w: 4, d: 3, wealth: 0.35, look: { wall: 'plank', plankMat: 'plank', roof: 'thatch', roofType: 'side', chimney: true, doorTile: 1, noFlowers: true } });
    if (place.region === 'north' || place.region === 'west') B({ type: 'sawmill', name: 'Sawmill', x: sqX + 5, bottom: 9, w: 4, d: 3, wealth: 0.3, condition: 0.7, look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', roofType: 'side', bigDoor: true, doorTile: 2, chimney: false, noFlowers: true } });
    if (place.region === 'north') B({ type: 'quarry', name: `${place.name} Quarry`, x: W - 29, bottom: 10, w: 4, d: 3, wealth: 0.25, condition: 0.6, look: { wall: 'stone', stoneMat: 'stoneDark', roof: 'slate', roofType: 'side', bigDoor: true, doorTile: 1, chimney: false, noFlowers: true } });
    if (place.region === 'north') B({ type: 'mine', name: `${place.name} Mine`, x: W - 22, bottom: 10, w: 5, d: 3, wealth: 0.3, condition: 0.6, look: { wall: 'stone', stoneMat: 'stoneDark', roof: 'shingle', roofType: 'side', bigDoor: true, doorTile: 2, chimney: false, noFlowers: true } });

    trimTo(buildings, target, sqX + 8, roadY);
    for (const b of buildings) {
      for (let yy = b.y; yy <= b.bottom; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) { if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; solid[yy * W + xx] = 1; if (ter[yy * W + xx] === TER.FOREST || ter[yy * W + xx] === TER.FIELD) set(xx, yy, TER.GRASS); }
      b.doorX = b.x + b.spec.doorTile; b.doorY = b.bottom + 1;
      if (ter[b.doorY * W + b.doorX] === TER.GRASS || ter[b.doorY * W + b.doorX] === TER.FOREST) set(b.doorX, b.doorY, TER.YARD);
    }

    const P = (kind, tx, ty, opts = {}) => { const p = Object.assign({ kind, x: tx * T + 8, y: ty * T + 14, seed: rng.int(1, 1e6), v: 0, solid: true }, opts); props.push(p); if (p.solid) solid[ty * W + tx] = 1; return p; };
    // a builder's yard stacks its stock beside the shed
    for (const b of buildings.filter((x) => x.type === 'builder')) for (const [kind, tx, ty] of [['timberstack', b.x - 1, b.y - 1], ['stonepile', b.x + b.w, b.y - 1]]) { if (tx < 1 || ty < 1 || tx >= W - 1 || solid[ty * W + tx] || solid[ty * W + tx - 1] || solid[ty * W + tx + 1] || ter[ty * W + tx] === TER.ROAD) continue; P(kind, tx, ty); solid[ty * W + tx - 1] = 1; solid[ty * W + tx + 1] = 1; }
    P('well', sqX + 8, roadY - 4, { y: (roadY - 4) * T + 15 }); solid[(roadY - 4) * W + sqX + 7] = 1;
    if (town) { P('stall', sqX + 3, roadY - 2, { v: 1 }); solid[(roadY - 2) * W + sqX + 2] = 1; solid[(roadY - 2) * W + sqX + 4] = 1; P('stall', sqX + 12, roadY - 2, { v: 2 }); solid[(roadY - 2) * W + sqX + 11] = 1; solid[(roadY - 2) * W + sqX + 13] = 1; }
    P('signpost', sqX + 9, roadY + 2, { solid: false }); P('bench', sqX + 2, roadY - 5, { solid: false });
    for (let xx = W - 34; xx <= W - 8; xx++) P(xx === W - 20 ? 'fenceGate' : 'fenceH', xx, fy0 - 1, { solid: xx !== W - 20 });
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
    // no house may stand on another building's doorstep: such a house is cleared away
    for (const b of buildings.slice()) {
      const dx = b.doorX != null ? b.doorX : b.x + b.spec.doorTile, dy = b.doorY != null ? b.doorY : b.bottom + 1;
      const o = buildings.find((q) => q !== b && dx >= q.x && dx < q.x + q.w && dy >= q.y && dy <= q.bottom);
      const drop = o && (o.type === 'house' ? o : b.type === 'house' ? b : null);
      if (!drop) continue;
      buildings.splice(buildings.indexOf(drop), 1);
      for (let yy = drop.y; yy <= drop.bottom; yy++) for (let xx = drop.x; xx < drop.x + drop.w; xx++) if (!buildings.some((q) => xx >= q.x && xx < q.x + q.w && yy >= q.y && yy <= q.bottom)) solid[yy * W + xx] = 0;
    }
    const zones = {
      square: [sqX + 1, roadY - 6, sqX + 14, roadY - 1], bench: [sqX + 2, roadY - 5], farm: [W - 33, fy0, W - 9, fy1], wood: [sqX - 6, 3, sqX + 12, 9], east: [W - 1, roadY],
      patrol: [[sqX + 8, roadY], [Math.max(6, sqX - 20), roadY], [Math.max(8, sqX - 20), laneY], [sqX + 8, laneY], [Math.min(W - 10, sqX + 30), laneY], [Math.min(W - 6, sqX + 34), roadY], [sqX + 8, roadY - 3]],
    };
    return { zones, cityWalls: place.kind === 'city', name: place.name, placeId: place.id, region: place.region, W, H, T, ter, solid, buildings, props, trees, TER, seed, roadY, exits: { west: [coast ? shoreX + 3 : 0, roadY], east: [W - 1, roadY] }, generated: true };
  }

  // ---------------------------------------------------------------------------------------------
  // Shared builder for walled places: terrain, buildings, props, trees, walls with towers and gates.
  function kit(place, W, H, seed) {
    const rng = O.RNG(seed);
    const ter = new Uint8Array(W * H), solid = new Uint8Array(W * H);
    const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) ter[y * W + x] = t; };
    const fill = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
    const buildings = [], props = [], trees = [];
    let nextId = 1;
    const st = STYLE[place.region] || STYLE.east;
    const B = (o) => { const b = Object.assign({ id: nextId++, floors: 1, wealth: 0.6, condition: 0.9 }, o); b.y = b.bottom - b.d + 1; b.spec = Object.assign({ seed: O.hash('bld', seed, b.id), w: b.w, d: b.d, floors: b.floors, wealth: b.wealth, condition: b.condition }, b.look); buildings.push(b); return b; };
    const look = (wl, extra = {}) => Object.assign({ wall: rng.weighted(st.walls), roof: rng.weighted(st.roofs), roofType: rng.chance(0.5) ? 'gable' : 'side', chimney: true, plaster: rng.pick(st.plasters), stoneMat: st.stoneMat, doorTile: 1 }, extra);
    const P = (kind, tx, ty, opts = {}) => { const p = Object.assign({ kind, x: tx * T + 8, y: ty * T + 14, seed: rng.int(1, 1e6), v: 0, solid: true }, opts); props.push(p); if (p.solid && tx >= 0 && ty >= 0 && tx < W && ty < H) solid[ty * W + tx] = 1; return p; };
    const free = (x, bottom, w, d) => { for (const b of buildings) if (!(x + w + 1 <= b.x || x - 1 >= b.x + b.w || bottom + 2 <= b.y || bottom - d - 1 >= b.bottom)) return false; for (let yy = bottom - d + 1; yy <= bottom + 1; yy++) for (let xx = x; xx < x + w; xx++) { const t = ter[yy * W + xx]; if (t === TER.ROAD || t === TER.COBBLE || t === TER.WATER || t === TER.BRIDGE || solid[yy * W + xx]) { if (yy <= bottom) return false; } } return true; };
    // walls: a rectangle with towers at the corners and every so often, gates where roads cross
    function walls(x0, y0, x1, y1, gates, v = 0) {
      const gateAt = (x, y) => gates.some(([gx, gy]) => Math.abs(gx - x) <= 1 && Math.abs(gy - y) <= 1);
      for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) {
        if (gateAt(x, y)) continue;
        const tower = x === x0 || x === x1 || (x - x0) % 18 === 0;
        P(tower ? 'tower' : 'wallH', x, y, { v: tower && x === Math.floor((x0 + x1) / 2) ? 2 : v, wall: true });
      }
      for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) { if (gateAt(x, y)) continue; P((y - y0) % 16 === 0 ? 'tower' : 'wallV', x, y, { v, wall: true, y: y * T + 15 }); }
      for (const [gx, gy] of gates) { P('gatearch', gx, gy, { v, solid: false, y: gy * T + 15, x: gx * T + 8 }); P('tower', gx - 2, gy, { v }); P('tower', gx + 2, gy, { v }); }
    }
    function scatter(isIn) {
      for (let yy = 1; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        if (solid[yy * W + xx] || (ter[yy * W + xx] !== TER.GRASS && ter[yy * W + xx] !== TER.FOREST)) continue;
        let near = false; for (const b of buildings) if (xx >= b.x - 2 && xx <= b.x + b.w + 1 && yy >= b.y - 3 && yy <= b.bottom + 2) near = true;
        const r = rng.next(), forest = ter[yy * W + xx] === TER.FOREST, inside = isIn(xx, yy);
        if (!near && !inside && (forest ? r < 0.3 : r < 0.02) && (xx + yy) % 2 === 0) { trees.push({ kind: rng.weighted([['oak', 4], ['birch', 1], ['pine', 1]]), x: xx * T + 8, y: yy * T + 14, seed: rng.int(1, 1e6) }); solid[yy * W + xx] = 1; }
        else if (!near && r < (inside ? 0.01 : 0.05)) props.push({ kind: inside ? 'barrel' : rng.weighted([['bush', 2], ['rock', 1]]), x: xx * T + 8, y: yy * T + 13, seed: rng.int(1, 1e6), solid: inside });
        else if (!inside && r < 0.15) props.push({ kind: r < 0.05 ? 'flowers' : 'grass', x: xx * T + rng.int(2, 14), y: yy * T + rng.int(4, 14), seed: rng.int(1, 30), solid: false, flat: true });
      }
    }
    function finish(extra) {
      // no house may stand on another building's doorstep
      for (let pass = 0; pass < 2; pass++) for (const b of buildings.slice()) {
        const dx = b.x + b.spec.doorTile, dy = b.bottom + 1;
        const o = buildings.find((q) => q !== b && dx >= q.x && dx < q.x + q.w && dy >= q.y && dy <= q.bottom);
        if (!o) continue;
        const drop = o.type === 'house' ? o : b.type === 'house' ? b : null;
        if (drop) buildings.splice(buildings.indexOf(drop), 1);
      }
      for (const b of buildings) {
        for (let yy = b.y; yy <= b.bottom; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) { if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; solid[yy * W + xx] = 1; if (ter[yy * W + xx] === TER.FOREST || ter[yy * W + xx] === TER.FIELD) set(xx, yy, TER.GRASS); }
        b.doorX = b.x + b.spec.doorTile; b.doorY = b.bottom + 1;
        const t = ter[b.doorY * W + b.doorX]; if (t === TER.GRASS || t === TER.FOREST) set(b.doorX, b.doorY, TER.YARD);
        b.security = O.clamp((b.type === 'house' ? 0.1 + b.wealth * 0.35 : 0.3) + ({ mansion: 0.35, jeweller: 0.6, keep: 0.65, warehouse: 0.3, townhall: 0.4, townhouse: 0.15 }[b.type] || 0), 0, 0.95);
      }
      for (let i = 0; i < W * H; i++) if (ter[i] === TER.WATER) solid[i] = 1;
      return Object.assign({ name: place.name, placeId: place.id, region: place.region, W, H, T, ter, solid, buildings, props, trees, TER, seed, generated: true }, extra);
    }
    return { rng, ter, solid, set, fill, buildings, props, trees, B, look, P, free, walls, scatter, finish, st };
  }

  // A hamlet: a handful of cottages around a green with a well, a farm and its barn, a bakehouse and an
  // alehouse, and whatever the land gives — a woodward's hut, a fisher's shed — all along one road.
  function makeHamlet(place) {
    const target = simTarget(place), W = target > 40 ? 78 : 64, H = 46, seed = O.hash('hamlet', place.id);
    const K = kit(place, W, H, seed), { rng, set, fill, B, look, P } = K;
    const st = K.st, roadY = 24, cx = Math.floor(W / 2), res = place.produces || {};
    const coast = place.region === 'west' && (res.fish || 0) >= 10;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      set(x, y, edge < 3 || (O.fbm(x / 6, y / 6, seed & 255, 2) > 0.66 && (y < 9 || y > H - 8)) ? TER.FOREST : TER.GRASS);
      if (coast && x < 6 + Math.round(Math.sin(y / 5) * 1.2)) set(x, y, x < 4 + Math.round(Math.sin(y / 5) * 1.2) ? TER.WATER : TER.SAND);
    }
    fill(coast ? 6 : 0, roadY, W - 1, roadY + 1, TER.ROAD);
    // the green and the lane around it
    const gx0 = cx - 9, gx1 = cx + 9, gy0 = roadY - 10;
    fill(gx0, gy0, gx1, gy0, TER.ROAD); fill(gx0, gy0, gx0, roadY - 1, TER.ROAD); fill(gx1, gy0, gx1, roadY - 1, TER.ROAD);
    fill(gx0 + 1, gy0 + 1, gx1 - 1, roadY - 1, TER.GRASS);
    // south lane to the farm
    const ly = roadY + 9;
    fill(cx, roadY + 2, cx + 1, ly - 1, TER.ROAD); fill(10, ly, W - 10, ly, TER.ROAD);
    fill(W - 30, ly + 4, W - 9, H - 5, TER.FIELD);
    const lk = (wl, ex) => look(wl, Object.assign({ roof: wl < 0.45 && place.region !== 'north' ? 'thatch' : rng.weighted(st.roofs) }, ex || {}));
    // the village trades: farm, bakehouse, alehouse
    B({ type: 'farmhouse', name: 'Farm', x: 12, bottom: ly - 1, w: 4, d: 3, wealth: 0.4, look: lk(0.4, { doorTile: 1 }) });
    B({ type: 'barn', name: 'Barn', x: 18, bottom: ly - 1, w: 6, d: 4, wealth: 0.3, look: { wall: 'plank', plankMat: 'plankRed', roof: 'shingle', roofType: 'gable', bigDoor: true, doorTile: 2, noFlowers: true } });
    B({ type: 'tavern', name: `The ${rng.pick(['Plough', 'Wheatsheaf', 'Hare', 'Crook', 'Fleece', 'Lamb'])}`, x: gx0 + 1, bottom: gy0 - 1, w: 5, d: 4, wealth: 0.45, jobs: [['innkeeper', 1], ['server', 0], ['cook', 1]], look: lk(0.45, { roofType: 'gable', sign: 'mug', doorTile: 2 }) });
    B({ type: 'bakery', name: 'Bakehouse', x: gx1 - 4, bottom: gy0 - 1, w: 4, d: 3, wealth: 0.4, jobs: [['baker', 1], ['apprentice', 0]], look: lk(0.4, { sign: 'bread', doorTile: 1 }) });
    // a chapel of ease, the headman's house where wrongs are brought, and the herb-wife's cottage
    B({ type: 'chapel', name: `Chapel of St. ${rng.pick(['Brannoc', 'Petroc', 'Edith', 'Swithun', 'Agatha'])}`, x: cx - 2, bottom: gy0 - 1, w: 4, d: 4, wealth: 0.45, jobs: [['priest', 1], ['parish clerk', 0]], look: { wall: 'stone', stoneMat: st.stoneMat, roof: rng.chance(0.5) ? 'thatch' : 'slate', roofType: 'gable', sign: 'cross', doorTile: 2, wallH: 56, noFlowers: true } });
    B({ type: 'guard', name: "Headman's House", headman: true, x: gx1 + 3, bottom: roadY - 2, w: 4, d: 3, wealth: 0.45, jobs: [['guard captain', 1], ['guard', Math.max(0, ((place.gov && place.gov.size) || 1) - 1)]], look: lk(0.45, { sign: 'shield', doorTile: 1 }) });
    B({ type: 'doctor', name: "Herb-wife's Cottage", x: gx0 - 6, bottom: roadY - 2, w: 4, d: 3, wealth: 0.35, jobs: [['physician', 1], ['herbalist', 0], ['bearer', 0]], look: lk(0.35, { sign: 'herb', doorTile: 1 }) });
    if ((res.timber || 0) >= 8 || place.region === 'north') B({ type: 'woodcutter', name: "Woodward's Hut", x: W - 12, bottom: 9, w: 3, d: 3, wealth: 0.25, condition: 0.6, look: { wall: 'log', roof: 'shingle', roofType: 'gable', chimney: true, doorTile: 1 } });
    if ((res.fish || 0) >= 6) B({ type: 'fishery', name: "Fisher's Shed", x: coast ? 8 : 4, bottom: roadY - 3, w: 4, d: 3, wealth: 0.3, look: { wall: 'plank', plankMat: 'plank', roof: 'thatch', roofType: 'side', chimney: true, doorTile: 1, noFlowers: true } });
    if ((res.wool || 0) >= 6) P('fenceH', W - 18, roadY + 4, { solid: true });
    // cottages: around the green first, then out along the road and the lane
    const cot = (x, bottom, w, d) => { d = rng.chance(0.4) ? d + 1 : d; if (!K.free(x, bottom, w, d)) return; const wl = O.clamp(place.wealth + rng.float(-0.15, 0.1), 0.12, 0.7); B({ type: 'house', name: 'Cottage', x, bottom, w, d, wealth: wl, condition: O.clamp(0.35 + wl * 0.6, 0.2, 1), look: lk(wl, { doorTile: rng.int(0, w - 1) }) }); };
    for (let x = gx0 - 8; x >= (coast ? 9 : 3); x -= 5) cot(x, roadY - 2, 4, 3);
    for (let x = gx1 + 3; x < W - 6; x += 5) cot(x, roadY - 2, 4, 3);
    for (let x = gx0 + 8; x < gx1 - 6; x += 5) cot(x, gy0 - 1, 4, 3);
    for (let x = 27; x < W - 6; x += 5) if (Math.abs(x - cx) > 2) cot(x, ly - 1, 4, 3);
    for (let x = gx0 - 8; x >= 3; x -= 5) cot(x, gy0 - 1, 4, 3);
    trimTo(K.buildings, target, cx, roadY - 4, 1);
    P('well', cx, roadY - 5, { y: (roadY - 5) * T + 15 }); K.solid[(roadY - 5) * W + cx - 1] = 1;
    P('bench', cx - 4, roadY - 6, { solid: false }); P('signpost', cx + 3, roadY + 2, { solid: false });
    P('hay', 26, ly + 2); P('woodpile', 10, ly + 2);
    for (let xx = W - 30; xx <= W - 9; xx++) P(xx === W - 20 ? 'fenceGate' : 'fenceH', xx, ly + 3, { solid: xx !== W - 20 });
    for (let yy = ly + 4; yy <= H - 5; yy++) for (let xx = W - 30; xx <= W - 9; xx++) K.props.push({ kind: 'wheat', x: xx * T + 8, y: yy * T + 15, seed: 1, v: 2, solid: false, flat: true, field: 'wheat' });
    if (coast) for (let i = 0; i < 2; i++) P('boat', 3, roadY - 8 + i * 6, { solid: true, seed: i });
    K.scatter(() => false);
    return K.finish({ roadY, exits: { west: [coast ? 7 : 0, roadY], east: [W - 1, roadY] }, hamlet: true,
      zones: { square: [gx0 + 1, gy0 + 1, gx1 - 1, roadY - 1], bench: [cx - 4, roadY - 6], farm: [W - 29, ly + 4, W - 10, H - 6], wood: [W - 20, 3, W - 6, 9], east: [W - 1, roadY], patrol: [[cx, roadY], [8, roadY], [cx, gy0], [W - 8, roadY], [cx, ly]] } });
  }

  // Aurelia: a walled city on a river, with a grand market, a wealthy quarter, workshops,
  // warehouses by the water, and a crowded poor quarter.
  function makeCity(place) {
    const CW = 128, W = 186, H = 150, seed = O.hash('city', place.id);
    const K = kit(place, W, H, seed), { rng, set, fill, B, look, P, free } = K;
    const roadY = 44, x0 = 6, y0 = 6, x1 = W - 7, y1 = 81, riverX = 70;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const edge = Math.min(x, y, W - 1 - x, H - 1 - y); set(x, y, edge < 3 ? TER.FOREST : TER.GRASS); }
    for (let y = 0; y < H; y++) { const wob = Math.round(Math.sin(y / 9) * 1.5); for (let x = riverX - 2 + wob; x <= riverX + 2 + wob; x++) set(x, y, x === riverX - 2 + wob || x === riverX + 2 + wob ? TER.SAND : TER.WATER); }
    fill(0, roadY, W - 1, roadY + 1, TER.ROAD);
    for (let x = riverX - 4; x <= riverX + 4; x++) { set(x, roadY, TER.BRIDGE); set(x, roadY + 1, TER.BRIDGE); }
    fill(riverX - 4, 24, riverX + 4, 25, TER.BRIDGE);
    // avenues and lanes inside the walls
    fill(40, y0 + 1, 41, y1 - 1, TER.ROAD); fill(96, y0 + 1, 97, y1 - 1, TER.ROAD);
    fill(x0 + 1, 24, CW - 8, 25, TER.ROAD); fill(x0 + 1, 64, CW - 8, 65, TER.ROAD);
    for (let x = riverX - 4; x <= riverX + 4; x++) { set(x, 24, TER.BRIDGE); set(x, 25, TER.BRIDGE); }
    fill(44, 30, 64, 43, TER.COBBLE); // the great market
    K.walls(x0, y0, x1, y1, [[x0, roadY + 1], [x1, roadY + 1], [97, y1]], 0);
    // market and civic buildings around the square
    B({ type: 'townhall', name: 'Guildhall of Aurelia', x: 48, bottom: 28, w: 8, d: 5, floors: 2, wealth: 0.85, look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'tile', roofType: 'gable', chimney: true, sign: 'scales', doorTile: 4, bigDoor: true, noFlowers: true } });
    B({ type: 'chapel', name: 'Cathedral of St. Brannoc', x: 58, bottom: 21, w: 8, d: 7, wealth: 0.9, look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'slate', roofType: 'gable', sign: 'cross', doorTile: 4, wallH: 86, bigDoor: true, noFlowers: true } });
    for (let i = 0; i < 8; i++) { const sx = 46 + (i % 4) * 5, sy = 33 + Math.floor(i / 4) * 5; P('stall', sx, sy, { v: i % 4 }); K.solid[sy * W + sx - 1] = 1; K.solid[sy * W + sx + 1] = 1; }
    P('noticeboard', 54, 42, { broadsheet: true }); // the broadsheet seller's board
    P('well', 55, 41, { y: 41 * T + 15 }); K.solid[41 * W + 54] = 1;
    // districts: [x range, y range, building mix]
    const lots = (xa, xb, bottom, mix, d = 4) => { let x = xa; while (x < xb) { const pick = rng.weighted(mix); const w = pick.w || rng.int(4, 5); if (x + w > xb) break; if (free(x, bottom, w, pick.d || d)) { const wl = pick.wealth ?? rng.float(0.3, 0.8); B(Object.assign({ x, bottom, w, d: pick.d || d, wealth: wl, floors: pick.floors || (wl > 0.6 ? 2 : 1), look: look(wl, Object.assign({ doorTile: Math.floor(w / 2) }, pick.look || {})), name: pick.name || 'House' }, { type: pick.type })); } x += w + 1; } };
    const noble = [[{ type: 'mansion', w: 6, d: 5, floors: 2, wealth: 0.92, name: 'Mansion', look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'tile', roofType: 'gable' } }, 3], [{ type: 'townhouse', w: 4, d: 4, floors: 3, wealth: 0.8, name: 'Townhouse' }, 4], [{ type: 'jeweller', w: 4, d: 4, floors: 2, wealth: 0.85, name: 'Aurifex the Jeweller', look: { sign: 'scales', shopWindow: true } }, 0.6], [{ type: 'apothecary', w: 4, d: 4, wealth: 0.7, name: 'Apothecary', look: { sign: 'herb' } }, 0.6], [{ type: 'school', w: 5, d: 4, wealth: 0.7, name: 'Cathedral School', look: { wall: 'stone', roof: 'slate' } }, 0.4]];
    const work = [[{ type: 'smithy', w: 5, name: 'Smithy', look: { wall: 'stone', roof: 'slate', sign: 'anvil' } }, 1], [{ type: 'armourer', w: 5, name: 'Armourer', look: { wall: 'stone', roof: 'slate', sign: 'sword' } }, 1], [{ type: 'carpenter', w: 5, name: 'Carpenter', look: { sign: 'scales' } }, 1], [{ type: 'butcher', w: 4, name: 'Butcher' }, 1], [{ type: 'bakery', w: 4, name: 'Bakery', look: { sign: 'bread' } }, 1.2], [{ type: 'store', w: 5, name: 'Chandlery', look: { sign: 'scales' } }, 1], [{ type: 'tavern', w: 6, d: 5, floors: 2, name: 'The King\'s Head', look: { sign: 'mug', roofType: 'gable', doorTile: 2 } }, 0.7], [{ type: 'tailor', w: 4, name: 'Tailor', look: { sign: 'scales', shopWindow: true } }, 0.6], [{ type: 'weaver', w: 4, name: 'Weaver' }, 0.5], [{ type: 'cobbler', w: 4, name: 'Cobbler', look: { shopWindow: true } }, 0.5], [{ type: 'chandler', w: 4, name: 'Chandler', look: { shopWindow: true } }, 0.5], [{ type: 'cooper', w: 5, name: 'Cooper', look: { bigDoor: true } }, 0.4], [{ type: 'tanner', w: 5, name: 'Tannery', look: { wall: 'plank', roof: 'shingle', chimney: false } }, 0.3], [{ type: 'potter', w: 4, name: 'Potter' }, 0.4], [{ type: 'builder', w: 5, name: "Builder's Yard", look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', bigDoor: true, sign: 'hammer' } }, 0.3], [{ type: 'house', w: 4 }, 3]];
    const ware = [[{ type: 'warehouse', w: 6, d: 5, name: 'River Warehouse', look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', bigDoor: true, chimney: false, noFlowers: true } }, 1]];
    const poor = [[{ type: 'tenement', w: 5, d: 4, floors: 3, wealth: 0.15, name: 'Tenement', look: { wall: 'timber', roof: 'thatch', roofType: 'side' } }, 3], [{ type: 'house', w: 3, d: 3, wealth: 0.12 }, 2], [{ type: 'tavern', w: 5, d: 4, floors: 2, wealth: 0.3, name: 'The Drowned Rat', look: { sign: 'mug', doorTile: 2 } }, 0.3]];
    const resi = [[{ type: 'house', w: 4 }, 5], [{ type: 'doctor', w: 5, d: 5, floors: 2, name: 'Physician', look: { sign: 'herb' } }, 0.3], [{ type: 'hospital', w: 7, d: 5, floors: 2, wealth: 0.6, name: "St. Agatha's Hospital", look: { wall: 'stone', roof: 'slate', roofType: 'gable', sign: 'cross', doorTile: 3 } }, 0.3], [{ type: 'guard', w: 6, d: 4, name: 'City Watch', look: { wall: 'stone', roof: 'slate', sign: 'shield', noFlowers: true } }, 0.4], [{ type: 'stable', w: 5, d: 3, name: 'City Stables', look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', bigDoor: true, chimney: false } }, 0.3]];
    for (const bottom of [13, 22]) { lots(8, 39, bottom, noble, 4); lots(42, 56, bottom, noble, 4); }
    for (const bottom of [13, 22, 33, 42]) lots(74, 95, bottom, bottom === 42 ? ware : work, bottom === 42 ? 5 : 4);
    for (const bottom of [13, 22, 33, 42]) lots(99, CW - 9, bottom, work, 4);
    for (const bottom of [52, 62, 72, 79]) { lots(74, 95, bottom, poor, 4); lots(99, CW - 9, bottom, poor, 4); }
    for (const bottom of [52, 62, 72, 79]) { lots(8, 39, bottom, resi, 4); lots(42, riverX - 5, bottom, resi, 4); }
    for (const bottom of [33, 42]) lots(8, 39, bottom, [...resi, ...noble.slice(1, 2)], 4);
    // essential trades a living city needs, wherever they fit
    const need = [['mill', 'Watermill', 4, 4], ['woodcutter', "Woodward's Yard", 4, 3], ['sawmill', 'Riverside Sawmill', 5, 3], ['farmhouse', 'Market Garden', 4, 3]];
    for (const [type, name, w, d] of need) { for (let tries = 0; tries < 60; tries++) { const x = rng.int(8, CW - 14), bottom = rng.pick([13, 22, 33, 52, 62, 72]); if (free(x, bottom, w, d)) { B({ type, name, x, bottom, w, d, floors: type === 'mill' ? 2 : 1, wealth: 0.4, look: look(0.4) }); break; } } }
    if (!K.buildings.some((b) => b.type === 'guard')) B({ type: 'guard', name: 'City Watch', x: 42, bottom: 79, w: 6, d: 4, look: { wall: 'stone', roof: 'slate', sign: 'shield', noFlowers: true, doorTile: 2 } });
    if (!K.buildings.some((b) => b.type === 'doctor')) B({ type: 'doctor', name: 'Physician', x: 30, bottom: 79, w: 4, d: 4, floors: 2, look: look(0.6, { sign: 'herb' }) });
    // Aurelia Royal Castle, inside the city walls at their eastern end behind an inner curtain wall of
    // its own: the great castle of the king and queen, four storeys of halls, kitchens, servants'
    // quarters and royal apartments, with the Royal Guard, the royal chapel and stables, a servants'
    // hall for the married staff and the queen's garden. In front of its gatehouse is the royal market.
    const rx0 = 128, ry0 = y0, rx1 = x1, ry1 = 40, rgX = 153;
    fill(rx0 + 1, ry0 + 1, rx1 - 1, ry1 - 1, TER.YARD);
    fill(rgX - 1, ry1, rgX, roadY - 1, TER.COBBLE);
    fill(rgX - 1, 27, rgX, ry1 - 1, TER.COBBLE); fill(rx0 + 2, 33, rx1 - 2, 33, TER.COBBLE);
    for (let y = ry0 + 1; y < ry1; y++) P((y - ry0) % 8 === 0 ? 'tower' : 'wallV', rx0, y, { v: 1, wall: true, y: y * T + 15 });
    for (let x = rx0; x < rx1; x++) { if (Math.abs(x - rgX) <= 1) continue; P(x === rx0 || (x - rx0) % 10 === 0 ? 'tower' : 'wallH', x, ry1, { v: 1, wall: true }); }
    P('gatearch', rgX, ry1, { v: 1, solid: false, y: ry1 * T + 15, x: rgX * T + 8 }); P('tower', rgX - 2, ry1, { v: 2 }); P('tower', rgX + 2, ry1, { v: 2 });
    B({ type: 'keep', biz: 'palace', royal: true, lordly: true, name: 'Aurelia Royal Castle', x: rgX - 12, bottom: 26, w: 24, d: 10, floors: 4, wealth: 1, look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'slate', roofType: 'battlement', chimney: true, sign: 'shield', doorTile: 12, bigDoor: true, noFlowers: true, grand: true } });
    P('banner', rgX - 4, 27, { solid: false }); P('banner', rgX + 3, 27, { solid: false });
    B({ type: 'chapel', name: 'Royal Chapel', x: rx0 + 3, bottom: 18, w: 6, d: 6, wealth: 0.95, look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'slate', roofType: 'gable', sign: 'cross', doorTile: 3, wallH: 70, noFlowers: true } });
    B({ type: 'guard', name: 'Royal Guard', x: rx0 + 3, bottom: 30, w: 8, d: 5, wealth: 0.7, look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'slate', roofType: 'battlement', sign: 'shield', doorTile: 4, noFlowers: true } });
    B({ type: 'stable', name: 'Royal Stables', x: rx0 + 3, bottom: 38, w: 8, d: 3, wealth: 0.7, look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', bigDoor: true, chimney: false, doorTile: 3, noFlowers: true } });
    B({ type: 'tenement', name: "Servants' Hall", x: rx1 - 12, bottom: 38, w: 7, d: 4, floors: 2, wealth: 0.35, look: { wall: 'timber', roof: 'tile', roofType: 'side', doorTile: 3 } });
    // the queen's garden
    for (let x = rx1 - 11; x <= rx1 - 2; x++) for (const y of [9, 21]) P('bush', x, y, { solid: true });
    for (let x = rx1 - 10; x <= rx1 - 3; x++) for (let y = 10; y <= 20; y++) if ((x + y) % 2 === 0 && Math.abs(x - (rx1 - 6)) > 1) P('flowers', x, y, { solid: false, flat: true });
    P('well', rx1 - 6, 15, { y: 15 * T + 15 }); K.solid[15 * W + rx1 - 7] = 1;
    P('bench', rx1 - 9, 17, { solid: false }); P('bench', rx1 - 3, 13, { solid: false });
    // the royal market before the castle gate
    fill(rx0 + 2, ry1 + 2, rx1 - 2, 54, TER.COBBLE);
    for (let i = 0; i < 12; i++) { const sx = rx0 + 6 + (i % 6) * 8, sy = i < 6 ? ry1 + 3 : 50; if (Math.abs(sx - rgX) < 3) continue; P('stall', sx, sy, { v: i % 4 }); K.solid[sy * W + sx - 1] = 1; K.solid[sy * W + sx + 1] = 1; }
    P('well', rgX + 6, 52, { y: 52 * T + 15 }); K.solid[52 * W + rgX + 5] = 1;
    // the eastern quarter behind the royal market: knights' houses and townsfolk
    for (const bottom of [62, 71, 79]) lots(130, x1 - 2, bottom, bottom === 79 ? [...resi, ...noble] : work, 4);
    P('signpost', 42, 46, { solid: false });
    // ---- the great estates beyond the south gate, near the castle: manors with their land ----
    const ey = 104; // the estate road
    fill(96, y1, 97, ey, TER.ROAD); fill(4, ey, W - 5, ey + 1, TER.ROAD);
    for (let x = riverX - 4; x <= riverX + 4; x++) { set(x, ey, TER.BRIDGE); set(x, ey + 1, TER.BRIDGE); }
    const pens = [];
    const NOBLE = ['Ashcombe', 'Belmont', 'Courtenay', 'Dacre', 'Everard', 'Fitzwarren', 'Harcourt', 'Lisle', 'Montague', 'Neville', 'Ravensworth', 'Stafford', 'Talbot', 'Vere', 'Mortimer', 'Beaumont'];
    const estates = [];
    for (const [i, ex] of [[0, 8], [1, 100], [2, 140]]) {
      if (ex + 38 > W - 4) continue;
      const fam = NOBLE[(seed + i * 5) % NOBLE.length], hall = `${fam} ${['Hall', 'Manor', 'Court', 'House'][i % 4]}`;
      // the manor: a long house of two storeys, rooms for the family and the servants
      const m = B({ type: 'manor', biz: 'manor', lordly: true, estate: true, livesIn: true, manor: true, house: fam, name: hall, x: ex + 6, bottom: ey - 4, w: 15, d: 5, floors: 2, wealth: 0.9, look: { wall: rng.chance(0.5) ? 'stone' : 'timber', stoneMat: 'stoneWarm', plaster: 'plasterWhite', roof: rng.pick(['slate', 'tile']), roofType: 'side', chimney: true, chimneyX: 0.15, dormers: 4, doorTile: 7, bigDoor: false, noFlowers: false } });
      fill(m.x - 2, m.bottom + 1, m.x + m.w + 1, ey - 1, TER.YARD);
      // the walled garden before it
      for (let x = m.x - 3; x <= m.x + m.w + 2; x++) for (const y of [m.y - 2]) P('bush', x, y, { solid: true });
      for (let y = m.y - 1; y <= m.bottom; y++) { P('bush', m.x - 3, y, { solid: true }); P('bush', m.x + m.w + 2, y, { solid: true }); }
      // staff cottages on the land
      for (let k = 0; k < 2; k++) B({ type: 'house', name: 'Estate Cottage', staffHouse: true, estateOf: hall, x: ex + 24 + k * 6, bottom: ey + 6, w: 4, d: 3, wealth: 0.35, look: look(0.35, { roof: 'thatch', doorTile: 1 }) });
      // the home farm, its barn, fields and a paddock of beasts
      B({ type: 'farmhouse', name: `${fam} Home Farm`, x: ex + 4, bottom: ey + 6, w: 4, d: 3, wealth: 0.45, look: look(0.45, { doorTile: 1 }) });
      B({ type: 'barn', name: `${fam} Barn`, x: ex + 10, bottom: ey + 7, w: 6, d: 4, wealth: 0.4, look: { wall: 'plank', plankMat: 'plankRed', roof: 'shingle', roofType: 'gable', bigDoor: true, doorTile: 2, noFlowers: true } });
      const px0 = ex + 4, px1 = ex + 18, py0 = ey + 10, py1 = ey + 16;
      for (let x = px0 - 1; x <= px1 + 1; x++) { const cv = x === px0 - 1 ? 2 : x === px1 + 1 ? 3 : x % 2; P(x === px0 + 3 ? 'fenceGate' : 'fenceH', x, py0 - 1, { solid: x !== px0 + 3, v: cv }); P('fenceH', x, py1 + 1, { solid: true, v: cv }); }
      for (let y = py0; y <= py1; y++) { P('fenceV', px0 - 1, y, { solid: true, y: y * T + 15, v: y % 2 }); P('fenceV', px1 + 1, y, { solid: true, y: y * T + 15, v: y % 2 }); }
      P('trough', px1 - 1, py0 + 1); P('hay', px0 + 1, py1 - 1);
      pens.push({ kinds: rng.pick([['sheep', 'cow'], ['cow', 'pig'], ['sheep', 'horse'], ['cow', 'sheep', 'pig']]), z: [px0, py0, px1, py1] });
      pens.push({ kinds: ['chicken'], z: [ex + 4, ey + 2, ex + 16, ey + 3] });
      const fx0 = ex + 22, fx1 = ex + 36, fy0 = ey + 10, fy1 = ey + 24;
      fill(fx0, fy0, fx1, fy1, TER.FIELD);
      for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) K.props.push({ kind: (x + i) % 9 < 5 ? 'wheat' : 'cabbage', x: x * T + 8, y: y * T + 15, seed: 1, v: 2, solid: false, flat: true, field: (x + i) % 9 < 5 ? 'wheat' : 'cabbage' });
      estates.push({ hall, fields: [fx0, fy0, fx1, fy1] });
    }
    // keep the paddocks clear of trees and bushes
    const penTiles = []; for (const pen of pens) { const [a0, b0, a1, b1] = pen.z; for (let y = b0; y <= b1; y++) for (let x = a0; x <= a1; x++) if (!K.solid[y * W + x]) { K.solid[y * W + x] = 1; penTiles.push(y * W + x); } }
    K.scatter((x, y) => (x > x0 && x < x1 && y > y0 && y < y1) || (x > rx0 && x < rx1 && y > ry0 && y < ry1));
    for (const i of penTiles) K.solid[i] = 0;
    return K.finish({ roadY, exits: { west: [0, roadY], east: [W - 1, roadY] }, river: true, pens, estates, zones: { square: [45, 31, 63, 42], bench: [46, 31], farm: estates.length ? estates[0].fields : [8, 90, 30, 96], wood: [2, H - 10, 30, H - 4], east: [W - 1, roadY], patrol: [[55, 44], [20, 44], [40, 24], [80, 24], [110, 44], [96, 64], [60, 64], [40, 44]] }, city: true });
  }

  // Highmere: a curtain-walled castle with a keep, and its village outside the gate.
  function makeCastle(place) {
    const W = 96, H = 74, seed = O.hash('castle', place.id);
    const K = kit(place, W, H, seed), { rng, set, fill, B, look, P, free } = K;
    const short = place.name.replace(/ Castle$/, ''), SM = K.st.stoneMat;
    const sea = place.id === 'westcliff' || place.id === 'eastmarch'; // castles on the cliffs above the sea
    const roadY = 54, cx0 = 28, cy0 = 8, cx1 = 68, cy1 = 36, gateX = 48;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      set(x, y, edge < 3 || (O.fbm(x / 6, y / 6, seed & 255, 2) > 0.72 && (x < 18 || x > W - 18)) ? TER.FOREST : TER.GRASS);
      if (sea) { const sy = 4 + Math.round(Math.sin(x / 7) * 1.2); if (y < sy) set(x, y, TER.WATER); else if (y < sy + 2) set(x, y, TER.ROCK || TER.SAND); }
    }
    fill(0, roadY, W - 1, roadY + 1, TER.ROAD);
    fill(gateX - 1, cy1 + 1, gateX, roadY - 1, TER.ROAD);
    fill(cx0 + 1, cy0 + 1, cx1 - 1, cy1 - 1, TER.YARD); // the bailey
    fill(gateX - 1, 22, gateX, cy1, TER.COBBLE);
    K.walls(cx0, cy0, cx1, cy1, [[gateX, cy1]], 1);
    B({ type: 'keep', biz: 'keep', lordly: true, name: `The Keep of ${short}`, x: 42, bottom: 20, w: 9, d: 7, floors: 3, wealth: 0.95, look: { wall: 'stone', stoneMat: SM, roof: 'slate', roofType: 'battlement', chimney: true, sign: 'shield', doorTile: 4, bigDoor: true, noFlowers: true } });
    B({ type: 'guard', name: `${short} Barracks`, x: 31, bottom: 17, w: 7, d: 4, wealth: 0.6, look: { wall: 'stone', stoneMat: SM, roof: 'slate', roofType: 'battlement', sign: 'shield', doorTile: 3, noFlowers: true } });
    B({ type: 'chapel', name: 'Castle Chapel', x: 56, bottom: 17, w: 5, d: 5, wealth: 0.8, look: { wall: 'stone', stoneMat: SM, roof: 'slate', roofType: 'gable', sign: 'cross', doorTile: 2, wallH: 64, noFlowers: true } });
    B({ type: 'stable', name: 'Castle Stables', x: 31, bottom: 32, w: 6, d: 3, wealth: 0.6, look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', bigDoor: true, chimney: false, doorTile: 2, noFlowers: true } });
    B({ type: 'armourer', name: 'Castle Armoury', x: 56, bottom: 32, w: 6, d: 4, wealth: 0.6, look: { wall: 'stone', stoneMat: SM, roof: 'slate', roofType: 'battlement', chimney: true, sign: 'sword', doorTile: 2, noFlowers: true } });
    B({ type: 'tavern', name: 'The Great Hall', x: 40, bottom: 30, w: 6, d: 4, floors: 2, wealth: 0.8, look: { wall: 'stone', stoneMat: SM, roof: 'slate', roofType: 'battlement', chimney: true, sign: 'mug', doorTile: 2 } });
    P('well', 51, 27, { y: 27 * T + 15 }); K.solid[27 * W + 50] = 1;
    P('banner', 46, 21, { solid: false }); P('banner', 50, 21, { solid: false });
    // the castle garden
    for (let i = 0; i < 5; i++) P('flowers', 58 + i, 24, { solid: false, flat: true });
    // the village outside the gate
    const v = [[{ type: 'house', w: 4 }, 6], [{ type: 'bakery', w: 4, name: 'Bakery', look: { sign: 'bread' } }, 0.5], [{ type: 'store', w: 5, name: 'Store', look: { sign: 'scales' } }, 0.5], [{ type: 'smithy', w: 5, name: 'Smithy', look: { wall: 'stone', roof: 'slate', sign: 'anvil' } }, 0.4], [{ type: 'doctor', w: 4, name: "Leech's House", look: { sign: 'herb' } }, 0.3], [{ type: 'mill', w: 4, floors: 2, name: 'Mill' }, 0.3], [{ type: 'farmhouse', w: 4, d: 3, name: 'Farm' }, 0.4], [{ type: 'woodcutter', w: 3, d: 3, name: "Forester's Hut" }, 0.3]];
    const lots = (xa, xb, bottom) => { let x = xa; while (x < xb) { const pick = rng.weighted(v); const w = pick.w; if (x + w > xb) break; if (free(x, bottom, w, pick.d || 4)) { const wl = rng.float(0.3, 0.6); B(Object.assign({ x, bottom, w, d: pick.d || 4, wealth: wl, floors: pick.floors || 1, look: look(wl, Object.assign({ doorTile: Math.floor(w / 2) }, pick.look || {})), name: pick.name || 'House' }, { type: pick.type })); } x += w + 1; } };
    lots(6, gateX - 3, roadY - 2); lots(gateX + 3, W - 6, roadY - 2); lots(6, W - 6, roadY + 10);
    trimTo(K.buildings, simTarget(place), gateX, roadY, 3);
    for (const [type, name] of [['mill', 'Mill'], ['farmhouse', 'Farm'], ['woodcutter', "Forester's Hut"], ['bakery', 'Bakery'], ['store', 'Store'], ['doctor', "Leech's House"]]) if (!K.buildings.some((b) => b.type === type)) for (let t = 0; t < 80; t++) { const x = rng.int(6, W - 10), bottom = rng.pick([roadY - 2, roadY + 10, roadY + 16]); if (free(x, bottom, 4, 3)) { B({ type, name, x, bottom, w: 4, d: 3, wealth: 0.4, floors: 1, look: look(0.4) }); break; } }
    fill(8, roadY + 12, 40, H - 5, TER.FIELD);
    K.scatter((x, y) => x > cx0 && x < cx1 && y > cy0 && y < cy1);
    return K.finish({ roadY, exits: { west: [0, roadY], east: [W - 1, roadY] }, zones: { square: [gateX - 6, 24, gateX + 6, 34], bench: [gateX - 4, 25], farm: [9, roadY + 13, 39, H - 6], wood: [4, 6, 22, 22], east: [W - 1, roadY], patrol: [[gateX, 35], [gateX, 24], [36, 26], [62, 26], [gateX, roadY], [20, roadY], [76, roadY]] }, castle: true });
  }

  O.Gen = { makeSettlement, makeCity, makeCastle, makeHamlet, simTarget, STYLE };
})();
