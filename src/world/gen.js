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
    if (place.kind === 'capital') return makeCity(place);
    if (place.kind === 'castle') return makeCastle(place);
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
    if (place.region === 'north' || place.region === 'west') B({ type: 'sawmill', name: 'Sawmill', x: sqX + 5, bottom: 9, w: 4, d: 3, wealth: 0.3, condition: 0.7, look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', roofType: 'side', bigDoor: true, doorTile: 2, chimney: false, noFlowers: true } });
    if (place.region === 'north') B({ type: 'quarry', name: `${place.name} Quarry`, x: W - 29, bottom: 10, w: 4, d: 3, wealth: 0.25, condition: 0.6, look: { wall: 'stone', stoneMat: 'stoneDark', roof: 'slate', roofType: 'side', bigDoor: true, doorTile: 1, chimney: false, noFlowers: true } });
    if (place.region === 'north') B({ type: 'mine', name: `${place.name} Mine`, x: W - 22, bottom: 10, w: 5, d: 3, wealth: 0.3, condition: 0.6, look: { wall: 'stone', stoneMat: 'stoneDark', roof: 'shingle', roofType: 'side', bigDoor: true, doorTile: 2, chimney: false, noFlowers: true } });

    for (const b of buildings) {
      for (let yy = b.y; yy <= b.bottom; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) { if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; solid[yy * W + xx] = 1; if (ter[yy * W + xx] === TER.FOREST || ter[yy * W + xx] === TER.FIELD) set(xx, yy, TER.GRASS); }
      b.doorX = b.x + b.spec.doorTile; b.doorY = b.bottom + 1;
      if (ter[b.doorY * W + b.doorX] === TER.GRASS || ter[b.doorY * W + b.doorX] === TER.FOREST) set(b.doorX, b.doorY, TER.YARD);
    }

    const P = (kind, tx, ty, opts = {}) => { const p = Object.assign({ kind, x: tx * T + 8, y: ty * T + 14, seed: rng.int(1, 1e6), v: 0, solid: true }, opts); props.push(p); if (p.solid) solid[ty * W + tx] = 1; return p; };
    P('well', sqX + 8, roadY - 4, { y: (roadY - 4) * T + 15 }); solid[(roadY - 4) * W + sqX + 7] = 1;
    if (town) { P('stall', sqX + 3, roadY - 2, { v: 1 }); solid[(roadY - 2) * W + sqX + 2] = 1; solid[(roadY - 2) * W + sqX + 4] = 1; P('stall', sqX + 12, roadY - 2, { v: 2 }); solid[(roadY - 2) * W + sqX + 11] = 1; solid[(roadY - 2) * W + sqX + 13] = 1; }
    P('signpost', sqX + 9, roadY + 2, { solid: false }); P('bench', sqX + 2, roadY - 5, { solid: false });
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

  // Kingsbridge: a walled city on a river, with a grand market, a wealthy quarter, workshops,
  // warehouses by the water, and a crowded poor quarter.
  function makeCity(place) {
    const W = 128, H = 88, seed = O.hash('city', place.id);
    const K = kit(place, W, H, seed), { rng, set, fill, B, look, P, free } = K;
    const roadY = 44, x0 = 6, y0 = 6, x1 = W - 7, y1 = H - 7, riverX = 70;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const edge = Math.min(x, y, W - 1 - x, H - 1 - y); set(x, y, edge < 3 ? TER.FOREST : TER.GRASS); }
    for (let y = 0; y < H; y++) { const wob = Math.round(Math.sin(y / 9) * 1.5); for (let x = riverX - 2 + wob; x <= riverX + 2 + wob; x++) set(x, y, x === riverX - 2 + wob || x === riverX + 2 + wob ? TER.SAND : TER.WATER); }
    fill(0, roadY, W - 1, roadY + 1, TER.ROAD);
    for (let x = riverX - 4; x <= riverX + 4; x++) { set(x, roadY, TER.BRIDGE); set(x, roadY + 1, TER.BRIDGE); }
    fill(riverX - 4, 24, riverX + 4, 25, TER.BRIDGE);
    // avenues and lanes inside the walls
    fill(40, y0 + 1, 41, y1 - 1, TER.ROAD); fill(96, y0 + 1, 97, y1 - 1, TER.ROAD);
    fill(x0 + 1, 24, W - 8, 25, TER.ROAD); fill(x0 + 1, 64, W - 8, 65, TER.ROAD);
    for (let x = riverX - 4; x <= riverX + 4; x++) { set(x, 24, TER.BRIDGE); set(x, 25, TER.BRIDGE); }
    fill(44, 30, 64, 43, TER.COBBLE); // the great market
    K.walls(x0, y0, x1, y1, [[x0, roadY + 1], [x1, roadY + 1]], 0);
    // market and civic buildings around the square
    B({ type: 'townhall', name: 'Guildhall of Kingsbridge', x: 48, bottom: 28, w: 8, d: 5, floors: 2, wealth: 0.85, look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'tile', roofType: 'gable', chimney: true, sign: 'scales', doorTile: 4, bigDoor: true, noFlowers: true } });
    B({ type: 'chapel', name: 'Cathedral of St. Brannoc', x: 58, bottom: 21, w: 8, d: 7, wealth: 0.9, look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'slate', roofType: 'gable', sign: 'cross', doorTile: 4, wallH: 46, bigDoor: true, noFlowers: true } });
    for (let i = 0; i < 8; i++) { const sx = 46 + (i % 4) * 5, sy = 33 + Math.floor(i / 4) * 5; P('stall', sx, sy, { v: i % 4 }); K.solid[sy * W + sx - 1] = 1; K.solid[sy * W + sx + 1] = 1; }
    P('noticeboard', 54, 42, { broadsheet: true }); // the broadsheet seller's board
    P('well', 55, 41, { y: 41 * T + 15 }); K.solid[41 * W + 54] = 1;
    // districts: [x range, y range, building mix]
    const lots = (xa, xb, bottom, mix, d = 4) => { let x = xa; while (x < xb) { const pick = rng.weighted(mix); const w = pick.w || rng.int(4, 5); if (x + w > xb) break; if (free(x, bottom, w, pick.d || d)) { const wl = pick.wealth ?? rng.float(0.3, 0.8); B(Object.assign({ x, bottom, w, d: pick.d || d, wealth: wl, floors: pick.floors || (wl > 0.6 ? 2 : 1), look: look(wl, Object.assign({ doorTile: Math.floor(w / 2) }, pick.look || {})), name: pick.name || 'House' }, { type: pick.type })); } x += w + 1; } };
    const noble = [[{ type: 'mansion', w: 6, d: 5, floors: 2, wealth: 0.92, name: 'Mansion', look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'tile', roofType: 'gable' } }, 3], [{ type: 'townhouse', w: 4, d: 4, floors: 3, wealth: 0.8, name: 'Townhouse' }, 4], [{ type: 'jeweller', w: 4, d: 4, floors: 2, wealth: 0.85, name: 'Aurifex the Jeweller', look: { sign: 'scales', shopWindow: true } }, 0.6], [{ type: 'apothecary', w: 4, d: 4, wealth: 0.7, name: 'Apothecary', look: { sign: 'herb' } }, 0.6], [{ type: 'school', w: 5, d: 4, wealth: 0.7, name: 'Cathedral School', look: { wall: 'stone', roof: 'slate' } }, 0.4]];
    const work = [[{ type: 'smithy', w: 5, name: 'Smithy', look: { wall: 'stone', roof: 'slate', sign: 'anvil' } }, 1], [{ type: 'armourer', w: 5, name: 'Armourer', look: { wall: 'stone', roof: 'slate', sign: 'sword' } }, 1], [{ type: 'carpenter', w: 5, name: 'Carpenter', look: { sign: 'scales' } }, 1], [{ type: 'butcher', w: 4, name: 'Butcher' }, 1], [{ type: 'bakery', w: 4, name: 'Bakery', look: { sign: 'bread' } }, 1.2], [{ type: 'store', w: 5, name: 'Chandlery', look: { sign: 'scales' } }, 1], [{ type: 'tavern', w: 6, d: 5, floors: 2, name: 'The King\'s Head', look: { sign: 'mug', roofType: 'gable', doorTile: 2 } }, 0.7], [{ type: 'house', w: 4 }, 3]];
    const ware = [[{ type: 'warehouse', w: 6, d: 5, name: 'River Warehouse', look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', bigDoor: true, chimney: false, noFlowers: true } }, 1]];
    const poor = [[{ type: 'tenement', w: 5, d: 4, floors: 3, wealth: 0.15, name: 'Tenement', look: { wall: 'timber', roof: 'thatch', roofType: 'side' } }, 3], [{ type: 'house', w: 3, d: 3, wealth: 0.12 }, 2], [{ type: 'tavern', w: 5, d: 4, floors: 2, wealth: 0.3, name: 'The Drowned Rat', look: { sign: 'mug', doorTile: 2 } }, 0.3]];
    const resi = [[{ type: 'house', w: 4 }, 5], [{ type: 'doctor', w: 5, d: 5, floors: 2, name: 'Physician', look: { sign: 'herb' } }, 0.3], [{ type: 'hospital', w: 7, d: 5, floors: 2, wealth: 0.6, name: "St. Agatha's Hospital", look: { wall: 'stone', roof: 'slate', roofType: 'gable', sign: 'cross', doorTile: 3 } }, 0.3], [{ type: 'guard', w: 6, d: 4, name: 'City Watch', look: { wall: 'stone', roof: 'slate', sign: 'shield', noFlowers: true } }, 0.4], [{ type: 'stable', w: 5, d: 3, name: 'City Stables', look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', bigDoor: true, chimney: false } }, 0.3]];
    for (const bottom of [13, 22]) { lots(8, 39, bottom, noble, 4); lots(42, 56, bottom, noble, 4); }
    for (const bottom of [13, 22, 33, 42]) lots(74, 95, bottom, bottom === 42 ? ware : work, bottom === 42 ? 5 : 4);
    for (const bottom of [13, 22, 33, 42]) lots(99, W - 9, bottom, work, 4);
    for (const bottom of [52, 62, 72, 79]) { lots(74, 95, bottom, poor, 4); lots(99, W - 9, bottom, poor, 4); }
    for (const bottom of [52, 62, 72, 79]) { lots(8, 39, bottom, resi, 4); lots(42, riverX - 5, bottom, resi, 4); }
    for (const bottom of [33, 42]) lots(8, 39, bottom, [...resi, ...noble.slice(1, 2)], 4);
    // essential trades a living city needs, wherever they fit
    const need = [['mill', 'Watermill', 4, 4], ['woodcutter', "Woodward's Yard", 4, 3], ['sawmill', 'Riverside Sawmill', 5, 3], ['farmhouse', 'Market Garden', 4, 3]];
    for (const [type, name, w, d] of need) { for (let tries = 0; tries < 60; tries++) { const x = rng.int(8, W - 14), bottom = rng.pick([13, 22, 33, 52, 62, 72]); if (free(x, bottom, w, d)) { B({ type, name, x, bottom, w, d, floors: type === 'mill' ? 2 : 1, wealth: 0.4, look: look(0.4) }); break; } } }
    if (!K.buildings.some((b) => b.type === 'guard')) B({ type: 'guard', name: 'City Watch', x: 42, bottom: 79, w: 6, d: 4, look: { wall: 'stone', roof: 'slate', sign: 'shield', noFlowers: true, doorTile: 2 } });
    if (!K.buildings.some((b) => b.type === 'doctor')) B({ type: 'doctor', name: 'Physician', x: 30, bottom: 79, w: 4, d: 4, floors: 2, look: look(0.6, { sign: 'herb' }) });
    P('signpost', 42, 46, { solid: false });
    K.scatter((x, y) => x > x0 && x < x1 && y > y0 && y < y1);
    return K.finish({ roadY, exits: { west: [0, roadY], east: [W - 1, roadY] }, river: true, zones: { square: [45, 31, 63, 42], bench: [46, 31], farm: [8, 82, 30, 84], wood: [2, 82, 20, 86], east: [W - 1, roadY], patrol: [[55, 44], [20, 44], [40, 24], [80, 24], [110, 44], [96, 64], [60, 64], [40, 44]] }, city: true });
  }

  // Thornbury: a curtain-walled castle with a keep, and its village outside the gate.
  function makeCastle(place) {
    const W = 96, H = 72, seed = O.hash('castle', place.id);
    const K = kit(place, W, H, seed), { rng, set, fill, B, look, P, free } = K;
    const roadY = 52, cx0 = 28, cy0 = 6, cx1 = 68, cy1 = 34, gateX = 48;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const edge = Math.min(x, y, W - 1 - x, H - 1 - y); set(x, y, edge < 3 || (O.fbm(x / 6, y / 6, seed & 255, 2) > 0.72 && (x < 18 || x > W - 18)) ? TER.FOREST : TER.GRASS); }
    fill(0, roadY, W - 1, roadY + 1, TER.ROAD);
    fill(gateX - 1, cy1 + 1, gateX, roadY - 1, TER.ROAD);
    fill(cx0 + 1, cy0 + 1, cx1 - 1, cy1 - 1, TER.YARD); // the bailey
    fill(gateX - 1, 22, gateX, cy1, TER.COBBLE);
    K.walls(cx0, cy0, cx1, cy1, [[gateX, cy1]], 1);
    B({ type: 'keep', name: 'The Keep of Thornbury', x: 42, bottom: 18, w: 9, d: 7, floors: 3, wealth: 0.95, look: { wall: 'stone', stoneMat: 'stoneNorth', roof: 'slate', roofType: 'gable', chimney: true, sign: 'shield', doorTile: 4, bigDoor: true, noFlowers: true, wallH: 56 } });
    P('tower', 41, 18, { v: 2 }); P('tower', 51, 18, { v: 2 });
    B({ type: 'guard', name: 'Barracks', x: 31, bottom: 15, w: 7, d: 4, wealth: 0.6, look: { wall: 'stone', stoneMat: 'stoneNorth', roof: 'slate', roofType: 'side', sign: 'shield', doorTile: 3, noFlowers: true } });
    B({ type: 'chapel', name: 'Castle Chapel', x: 56, bottom: 15, w: 5, d: 5, wealth: 0.8, look: { wall: 'stone', stoneMat: 'stoneNorth', roof: 'slate', roofType: 'gable', sign: 'cross', doorTile: 2, wallH: 38, noFlowers: true } });
    B({ type: 'stable', name: 'Castle Stables', x: 31, bottom: 30, w: 6, d: 3, wealth: 0.6, look: { wall: 'plank', plankMat: 'plank', roof: 'shingle', bigDoor: true, chimney: false, doorTile: 2, noFlowers: true } });
    B({ type: 'armourer', name: 'Castle Armoury', x: 56, bottom: 30, w: 6, d: 4, wealth: 0.6, look: { wall: 'stone', stoneMat: 'stoneNorth', roof: 'slate', chimney: true, sign: 'sword', doorTile: 2, noFlowers: true } });
    B({ type: 'tavern', name: 'The Great Hall', x: 40, bottom: 28, w: 6, d: 4, floors: 2, wealth: 0.8, look: { wall: 'stone', stoneMat: 'stoneNorth', roof: 'slate', roofType: 'gable', chimney: true, sign: 'mug', doorTile: 2 } });
    P('well', 51, 25, { y: 25 * T + 15 }); K.solid[25 * W + 50] = 1;
    P('banner', 46, 19, { solid: false }); P('banner', 50, 19, { solid: false });
    // the village outside the gate
    const v = [[{ type: 'house', w: 4 }, 6], [{ type: 'bakery', w: 4, name: 'Bakery', look: { sign: 'bread' } }, 0.5], [{ type: 'store', w: 5, name: 'Store', look: { sign: 'scales' } }, 0.5], [{ type: 'smithy', w: 5, name: 'Smithy', look: { wall: 'stone', roof: 'slate', sign: 'anvil' } }, 0.4], [{ type: 'doctor', w: 4, name: "Leech's House", look: { sign: 'herb' } }, 0.3], [{ type: 'mill', w: 4, floors: 2, name: 'Mill' }, 0.3], [{ type: 'farmhouse', w: 4, d: 3, name: 'Farm' }, 0.4], [{ type: 'woodcutter', w: 3, d: 3, name: "Forester's Hut" }, 0.3]];
    const lots = (xa, xb, bottom) => { let x = xa; while (x < xb) { const pick = rng.weighted(v); const w = pick.w; if (x + w > xb) break; if (free(x, bottom, w, pick.d || 4)) { const wl = rng.float(0.3, 0.6); B(Object.assign({ x, bottom, w, d: pick.d || 4, wealth: wl, floors: pick.floors || 1, look: look(wl, Object.assign({ doorTile: Math.floor(w / 2) }, pick.look || {})), name: pick.name || 'House' }, { type: pick.type })); } x += w + 1; } };
    lots(6, gateX - 3, roadY - 2); lots(gateX + 3, W - 6, roadY - 2); lots(6, W - 6, roadY + 10);
    for (const [type, name] of [['mill', 'Mill'], ['farmhouse', 'Farm'], ['woodcutter', "Forester's Hut"], ['bakery', 'Bakery'], ['store', 'Store'], ['doctor', "Leech's House"]]) if (!K.buildings.some((b) => b.type === type)) for (let t = 0; t < 80; t++) { const x = rng.int(6, W - 10), bottom = rng.pick([roadY - 2, roadY + 10, roadY + 16]); if (free(x, bottom, 4, 3)) { B({ type, name, x, bottom, w: 4, d: 3, wealth: 0.4, floors: 1, look: look(0.4) }); break; } }
    fill(8, roadY + 12, 40, H - 5, TER.FIELD);
    K.scatter((x, y) => x > cx0 && x < cx1 && y > cy0 && y < cy1);
    return K.finish({ roadY, exits: { west: [0, roadY], east: [W - 1, roadY] }, zones: { square: [gateX - 6, 22, gateX + 6, 32], bench: [gateX - 4, 23], farm: [9, roadY + 13, 39, H - 6], wood: [4, 4, 22, 20], east: [W - 1, roadY], patrol: [[gateX, 33], [gateX, 22], [36, 24], [62, 24], [gateX, roadY], [20, roadY], [76, roadY]] }, castle: true });
  }

  O.Gen = { makeSettlement, makeCity, makeCastle, STYLE };
})();
