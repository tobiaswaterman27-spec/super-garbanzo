// Interior layouts. Every enterable building gets rooms whose floor area equals its exterior
// footprint (w x d tiles), one scene per floor. A chimney means a fireplace or oven inside; two
// floors mean stairs. Furniture is placed by building type, and each piece knows what it is for:
// beds for sleeping, workstations for each trade, counters for trading, containers that hold the
// household's real pantry and purse or the business's real stock.
'use strict';
(function () {
  const T = 16;
  const F = () => O.Furn;
  const FOOT = { bed: [1, 2], medbed: [1, 2], table: [2, 1], chair: [1, 1], stool: [1, 1], fireplace: [2, 1], oven: [2, 1], forge: [2, 1], anvil: [1, 1], cupboard: [1, 1], wardrobe: [1, 1], chest: [1, 1], shelf: [2, 1], counter: [3, 1], bar: [4, 1], workbench: [2, 1], rack: [2, 1], desk: [2, 1], pew: [3, 1], altar: [2, 1], millstone: [2, 1], stairs: [1, 2], rug: [2, 1], cauldron: [1, 1], doughtable: [2, 1], barrel: [1, 1], crate: [1, 1], sack: [1, 1], hay: [1, 1], woodpile: [1, 1], cell: [2, 2] };
  const CONTAINER = { cupboard: 15, wardrobe: 15, chest: 12, barrel: 5, crate: 5, sack: 2 };

  function layoutFor(b, floor, sim) {
    // Interiors use a constant 2x scale of the exterior footprint: big buildings stay big and small
    // ones small, but people fit through the rooms.
    const w = b.w * 2, d = b.d * 2, rng = O.RNG(O.hash('int', b.id, floor));
    const grid = new Uint8Array(w * d);
    const items = [];
    const dc = floor === 0 ? b.spec.doorTile * 2 : -1;
    const reserved = (x, y) => (Math.abs(x - dc) <= 1 && y >= d - 3);
    const free = (x, y, fw, fh) => { if (x < 0 || y < 0 || x + fw > w || y + fh > d) return false; for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) if (grid[yy * w + xx] || reserved(xx, yy)) return false; return true; };
    const put = (kind, x, y, o = {}) => {
      const [fw, fh] = FOOT[kind] || [1, 1];
      if (!free(x, y, fw, fh)) return null;
      if (!o.flat) for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) grid[yy * w + xx] = 1;
      const it = Object.assign({ kind, tx: x, ty: y, fw, fh, v: 0, seed: rng.int(1, 9999), id: items.length }, o);
      if (CONTAINER[kind] && !o.noContainer) it.container = { slots: CONTAINER[kind] };
      items.push(it); return it;
    };
    const tryPut = (kind, cands, o) => { for (const [x, y] of cands) { const r = put(kind, x, y, o); if (r) return r; } return null; };
    const along = (y, fw = 1) => { const c = []; for (let x = 0; x <= w - fw; x++) c.push([x, y]); return c; };
    const anywhere = (fw = 1, fh = 1) => { const c = []; for (let y = 0; y <= d - fh; y++) for (let x = 0; x <= w - fw; x++) c.push([x, y]); return c.sort(() => rng.next() - 0.5); };
    const wealth = b.wealth, wv = wealth > 0.66 ? 2 : wealth > 0.36 ? 1 : 0;
    const chimneyX = b.sprite?.chimney ? O.clamp(Math.round(((b.sprite.chimney.x - b.sprite.OV) / (b.w * T)) * w) - 1, 0, w - 2) : null;
    const hh = sim && b.household ? sim.households[b.household - 1] : null;
    const members = hh ? hh.members.length : 2;
    const twoFloors = b.floors >= 2;
    const hasStairs = twoFloors;
    const stairsX = dc >= w - 2 ? 0 : w - 1;
    if (hasStairs) put('stairs', stairsX, 0, { stairs: floor === 0 ? 1 : 0 });

    const homeFloor = !twoFloors || floor === 1;
    const living = floor === 0;
    const beds = () => { const n = Math.min(Math.ceil(members / 2) + (members > 3 ? 1 : 0), 4); for (let i = 0; i < n; i++) tryPut('bed', [[0, 0], [w - 1, 0], [1, 0], [w - 2, 0], [0, d - 2], [w - 1, d - 2], ...anywhere(1, 2)], { v: wv, bed: true }); };
    const hearth = () => { if (chimneyX != null) put('fireplace', chimneyX, 0, { v: wv }); };
    const dining = () => { const t = tryPut('table', [[Math.floor(w / 2) - 1, Math.floor(d / 2)], ...anywhere(2, 1)], { v: wv, table: true }); if (t) { tryPut('chair', [[t.tx - 1, t.ty]], { seat: true }); tryPut('chair', [[t.tx + 2, t.ty]], { seat: true }); if (members > 2) tryPut('stool', [[t.tx, t.ty + 1], [t.tx + 1, t.ty + 1]], { seat: true }); } };
    const storage = () => { tryPut('cupboard', along(0), { v: wv, pantry: true }); tryPut('chest', [...along(0), ...anywhere()], { v: wv, valuables: true }); if (rng.chance(0.6)) tryPut('barrel', anywhere(), { pantry: true }); };
    const shelf = (goods, o = {}) => { const s = tryPut('shelf', along(0, 2), Object.assign({ shop: true, goods }, o)); if (s) O.Furn.setGoods(s.seed, goods); return s; };

    switch (b.type) {
      case 'house': case 'farmhouse':
        if (living) { hearth(); if (wv >= 2) put('rug', Math.max(0, Math.floor(w / 2) - 1), Math.max(1, d - 2), { flat: true }); dining(); }
        if (homeFloor) beds();
        storage();
        if (b.type === 'farmhouse') { tryPut('sack', anywhere(), { stockOf: 'farm' }); tryPut('barrel', anywhere()); }
        break;
      case 'bakery':
        put('oven', chimneyX ?? 0, 0, { work: ['baker', 'apprentice'], fire: true });
        shelf(['bread'], { stockGood: 'bread' });
        tryPut('doughtable', [[0, 1], [w - 2, 1], ...anywhere(2, 1)], { work: ['apprentice', 'baker'] });
        tryPut('counter', [[Math.max(0, w - 3), d - 2], [0, d - 2]], { counter: true });
        for (let i = 0; i < 3; i++) tryPut('sack', anywhere(), { stockOf: 'flour', container: { slots: 2 } });
        tryPut('woodpile', anywhere());
        beds(); storage();
        break;
      case 'smithy':
        put('forge', 0, 0, { work: ['blacksmith'], fire: true });
        tryPut('anvil', [[2, 1], [1, 1], ...anywhere()], { work: ['blacksmith', 'apprentice'] });
        tryPut('rack', along(0, 2), { stockGood: 'tools', shop: true });
        tryPut('workbench', [[w - 2, 1], ...anywhere(2, 1)], { work: ['apprentice'] });
        tryPut('counter', [[Math.max(0, w - 3), d - 2]], { counter: true });
        tryPut('barrel', anywhere()); tryPut('woodpile', anywhere());
        tryPut('bed', [[w - 1, 0], ...anywhere(1, 2)], { bed: true, v: wv }); tryPut('chest', anywhere(), { valuables: true });
        break;
      case 'tavern':
        if (floor === 0) {
          hearth();
          put('bar', w - 6, 2, { counter: true, work: ['innkeeper', 'server'] });
          for (let i = 0; i < 4; i++) tryPut('barrel', [[w - 2 - i, 0]], { stockOf: 'ale', container: { slots: 5 } });
          for (const ty of [5, 8]) for (const tx of [1, 5, 9]) { const t = put('table', tx, ty, { table: true, v: 1 }); if (t) { tryPut('stool', [[tx, ty - 1]], { seat: true }); tryPut('stool', [[tx + 1, ty - 1]], { seat: true }); tryPut('chair', [[tx + 2, ty]], { seat: true }); tryPut('chair', [[tx - 1, ty]], { seat: true }); } }
          tryPut('cauldron', [[2, 1], [3, 1], ...anywhere()], { work: ['cook'] });
          tryPut('woodpile', [[0, 1], ...anywhere()]);
        } else {
          for (let i = 0; i < 5; i++) tryPut('bed', [[1 + i * 2, 0], [1 + i * 2, 4], ...anywhere(1, 2)], { bed: true, v: 1, rent: i < 3 });
          tryPut('table', [[2, 7], ...anywhere(2, 1)], { table: true });
          tryPut('chest', anywhere(), { valuables: true, rentChest: true });
          storage();
        }
        break;
      case 'store':
        shelf(['cabbage', 'firewood', 'flour'], { stockGood: 'cabbage' });
        shelf(['flour', 'cabbage'], { stockGood: 'flour' });
        tryPut('counter', [[1, d - 2], [0, d - 2]], { counter: true, work: ['shopkeeper'] });
        for (let i = 0; i < 4; i++) tryPut(rng.pick(['crate', 'barrel', 'sack']), anywhere(), { stockOf: 'store' });
        beds(); storage();
        break;
      case 'doctor':
        if (floor === 0) {
          shelf(['medicine', 'herbs'], { stockGood: 'medicine' });
          tryPut('desk', [[0, 1], ...anywhere(2, 1)], { work: ['physician'] });
          tryPut('medbed', [[w - 2, 1], [0, 2], ...anywhere(1, 2)], { medbed: true, work: ['herbalist'] });
          for (let i = 0; i < 2; i++) tryPut('chair', anywhere(), { seat: true, waiting: true });
          tryPut('chest', anywhere(), { valuables: true });
        } else { beds(); storage(); }
        break;
      case 'chapel':
        put('altar', Math.floor(w / 2) - 1, 0, { work: ['priest'], candles: true });
        for (let y = 3; y < d - 2; y += 2) { put('pew', 1, y, { pew: true }); put('pew', w - 4, y, { pew: true }); }
        tryPut('chest', [[w - 1, 0], [0, 0]], { valuables: true, alms: true });
        break;
      case 'mill':
        if (floor === 0) {
          put('millstone', 1, 1, { work: ['miller', 'labourer'] });
          for (let i = 0; i < 5; i++) tryPut('sack', anywhere(), { stockOf: i % 2 ? 'flour' : 'wheat', container: { slots: 2 } });
          tryPut('crate', anywhere());
        } else { beds(); storage(); }
        break;
      case 'guard':
        tryPut('desk', [[1, 1], ...anywhere(2, 1)], { work: ['guard captain', 'guard'] });
        tryPut('rack', along(0, 2));
        put('cell', w - 2, d - 2, { cell: true });
        tryPut('bed', [[0, 0], ...anywhere(1, 2)], { bed: true });
        tryPut('chest', anywhere(), { valuables: true, evidence: true });
        break;
      case 'barn':
        for (let i = 0; i < 6; i++) tryPut('hay', anywhere(), {});
        for (let i = 0; i < 4; i++) tryPut('sack', anywhere(), { stockOf: 'wheat', container: { slots: 2 } });
        tryPut('crate', anywhere()); tryPut('barrel', anywhere());
        break;
      case 'hideout': {
        const lvl = b.level || 1;
        hearth();
        for (let i = 0; i < Math.min(O.Gangs.LEVELS[lvl].beds, 6); i++) tryPut('bed', [[i * 2, 0], [i * 2, d - 2], ...anywhere(1, 2)], { bed: true, v: 0, gangBed: true });
        const t = tryPut('table', [[Math.floor(w / 2) - 1, Math.floor(d / 2)], ...anywhere(2, 1)], { table: true, v: 0 });
        if (t) { tryPut('stool', [[t.tx - 1, t.ty]], { seat: true }); tryPut('stool', [[t.tx + 2, t.ty]], { seat: true }); tryPut('stool', [[t.tx, t.ty + 1]], { seat: true }); }
        tryPut('chest', [...along(0), ...anywhere()], { gangStash: true, noContainer: true });
        if (lvl >= 2) { tryPut('rack', along(0, 2)); tryPut('workbench', anywhere(2, 1)); }
        if (lvl >= 3) { tryPut('desk', anywhere(2, 1)); tryPut('rug', anywhere(2, 1), { flat: true }); }
        tryPut('barrel', anywhere()); tryPut('woodpile', anywhere());
        break;
      }
      case 'woodcutter':
        hearth(); tryPut('bed', [[0, 0], [w - 1, 0], ...anywhere(1, 2)], { bed: true }); tryPut('woodpile', anywhere()); tryPut('rack', along(0, 2)); tryPut('stool', anywhere(), { seat: true }); storage();
        break;
      default: storage();
    }
    return { b, floor, w, d, items, grid, floors: b.floors, dc };
  }

  // Cached interior per building/floor (furniture is fixed; stock visuals update live).
  const cache = new Map();
  function interior(b, floor, sim) {
    const key = b.id + ':' + floor;
    if (cache.has(key)) return cache.get(key);
    const L = layoutFor(b, floor, sim);
    const wallKind = b.spec.wall === 'stone' || b.spec.wall === 'log' || b.spec.wall === 'plank' ? b.spec.wall : 'timber';
    const floorKind = ['smithy', 'chapel', 'guard', 'mill'].includes(b.type) ? 'stone' : b.type === 'barn' || (b.type === 'house' && b.wealth < 0.3) ? 'dirt' : 'wood';
    L.room = O.Furn.room({ w: L.w, d: L.d, wall: wallKind, floor: floorKind, wealth: b.wealth, seed: b.id * 3 + floor, windows: Math.max(1, Math.floor(b.w / 2) + 1), doorTile: floor === 0 ? L.dc : -5 });
    cache.set(key, L);
    return L;
  }

  O.Interior = { interior, layoutFor, FOOT, invalidate: (b) => { for (const k of [...cache.keys()]) if (k.startsWith(b.id + ':')) cache.delete(k); } };
})();
