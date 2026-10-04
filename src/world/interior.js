// Interior layouts. Every enterable building gets rooms in proportion to its exterior footprint
// (three tiles inside for every tile outside — four for churches, which must seat the parish), one
// scene per floor. A chimney means a fireplace, oven or forge beneath it; two floors mean stairs in
// the same corner of both.
//
// Furniture is arranged the way people arrange it: beds against the walls with their heads to the
// wall, a table in the middle of the room with a chair for everyone in the household, the hearth on
// the back wall where the chimney is, cupboards and chests along the walls. A house gets the beds
// its family needs — a double bed for a couple, a bed each for the others (small children share),
// a cradle for a baby. Every piece is checked as it goes in: if it would cut off the door, the
// stairs or anything else that has to be reached, it is not placed there.
//
// Workplaces where nobody lives get no beds at all, and more to do instead.
'use strict';
(function () {
  const T = 16;
  const SIZE = { partH: [1, 1], partV: [1, 1], throne: [2, 2], bed: [2, 3], double: [3, 3], medbed: [2, 3], cradle: [2, 2], table: [3, 2], longtable: [5, 2], chair: [1, 1], stool: [1, 1], bench: [3, 1], fireplace: [3, 1], oven: [3, 2], forge: [3, 2], anvil: [1, 1],
    cupboard: [2, 1], dresser: [2, 1], wardrobe: [2, 1], bookcase: [2, 1], chest: [2, 1], shelf: [3, 1], counter: [4, 1], workbench: [3, 1], doughtable: [3, 1], butcherblock: [3, 1], rack: [2, 1], desk: [2, 1],
    altar: [4, 1], millstone: [3, 2], loom: [3, 2], spinning: [2, 1], stairs: [2, 3], cauldron: [1, 1], washtub: [1, 1], plant: [1, 1], candlestand: [1, 1], barrel: [1, 1], crate: [1, 1], sack: [1, 1], hay: [1, 1], woodpile: [1, 1], cell: [4, 4] };
  const foot = (kind, rot, width) => { if (kind === 'bed' && rot) return [3, 2]; if (kind === 'pew' || kind === 'bar') return [width || 5, 1]; if (kind === 'rug') return [width || 3, 2]; if (kind === 'bench' && width) return [width, 1]; return SIZE[kind] || [1, 1]; };
  const FOOT = SIZE;
  const CONTAINER = { cupboard: 15, dresser: 12, wardrobe: 15, chest: 12, barrel: 5, crate: 5, sack: 2 };
  // pieces that must stay reachable (you have to get to a bed, a chest, a workstation)
  const NEEDS_ACCESS = new Set(['bed', 'double', 'medbed', 'cradle', 'fireplace', 'oven', 'forge', 'anvil', 'cupboard', 'dresser', 'wardrobe', 'bookcase', 'chest', 'shelf', 'counter', 'workbench', 'doughtable', 'butcherblock', 'rack', 'desk', 'altar', 'millstone', 'loom', 'spinning', 'stairs', 'cauldron', 'barrel', 'crate', 'sack', 'bar', 'cell', 'pew', 'bench']);

  function scaleFor(b) { return b.type === 'chapel' ? 4 : 3; }

  function layoutFor(b, floor, sim) {
    const S = scaleFor(b), w = b.w * S, d = b.d * S, rng = O.RNG(O.hash('int', b.id, floor));
    const grid = new Uint8Array(w * d);
    const items = [];
    const dc = floor === 0 ? Math.min(w - 2, b.spec.doorTile * S + Math.floor((S - 2) / 2)) : -1; // the doorway is two tiles wide
    const keepClear = new Set(); // tiles nothing may stand on: the way in, the foot of the stairs
    if (floor === 0) for (let y = d - 2; y < d; y++) for (let x = dc - 1; x <= dc + 2; x++) keepClear.add(y * w + x);
    const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < d;
    // the strip of floor in front of every piece is kept clear, so nothing ever stands in front of
    // anything else: you can get to every bed, chest, shelf and hearth, and see it
    const front = new Uint8Array(w * d);
    const free = (x, y, fw, fh, o) => {
      if (x < 0 || y < 0 || x + fw > w || y + fh > d) return false;
      const loose = o && (o.seat || o.partition || o.flat);
      for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) { if (grid[yy * w + xx] || keepClear.has(yy * w + xx)) return false; if (!loose && front[yy * w + xx]) return false; }
      // and the new piece's own front must be open floor
      if (!loose && y + fh < d) for (let xx = x; xx < x + fw; xx++) if (grid[(y + fh) * w + xx] && !items.some((it) => it.partition && it.tx === xx && it.ty === y + fh)) return false;
      return true;
    };
    // flood from the door (or the stairs up here) over open floor
    let startTiles = [];
    const reach = () => {
      const seen = new Uint8Array(w * d), q = [];
      for (const [x, y] of startTiles) if (inb(x, y) && !grid[y * w + x]) { seen[y * w + x] = 1; q.push(x, y); }
      for (let i = 0; i < q.length; i += 2) { const x = q[i], y = q[i + 1]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || seen[ny * w + nx] || grid[ny * w + nx]) continue; seen[ny * w + nx] = 1; q.push(nx, ny); } }
      return seen;
    };
    const touches = (it, seen) => { for (let y = it.ty - 1; y <= it.ty + it.fh; y++) for (let x = it.tx - 1; x <= it.tx + it.fw; x++) { const edge = (y === it.ty - 1 || y === it.ty + it.fh) !== (x === it.tx - 1 || x === it.tx + it.fw); if (edge && inb(x, y) && seen[y * w + x]) return true; } return false; };
    const ok = () => {
      if (!startTiles.length) return true;
      const seen = reach();
      for (const it of items) if (it.access && !touches(it, seen)) return false;
      let open = 0, got = 0; for (let i = 0; i < w * d; i++) if (!grid[i]) { open++; if (seen[i]) got++; }
      return got >= open * 0.85;
    };
    const put = (kind, x, y, o = {}) => {
      const [fw, fh] = foot(kind, o.rot, o.width);
      if (!free(x, y, fw, fh, o)) return null;
      const it = Object.assign({ kind, tx: x, ty: y, fw, fh, v: 0, rot: 0, seed: rng.int(1, 9999), id: items.length }, o);
      if (!o.flat) for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) grid[yy * w + xx] = 1;
      it.access = NEEDS_ACCESS.has(kind) && !o.noAccess;
      items.push(it);
      if (!o.flat && !ok()) { items.pop(); for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) grid[yy * w + xx] = 0; return null; }
      // reserve the floor in front of it (tables keep theirs for the chairs that go round them)
      if (!o.flat && !o.seat && !o.partition && !o.table && y + fh < d) for (let xx = x; xx < x + fw; xx++) front[(y + fh) * w + xx] = 1;
      if (CONTAINER[kind] && !o.noContainer && !it.container) it.container = { slots: CONTAINER[kind] };
      return it;
    };
    const tryPut = (kind, cands, o) => { for (const [x, y] of cands) { const r = put(kind, x, y, o); if (r) return r; } return null; };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    // places along the back wall, avoiding the windows for tall pieces
    const winCols = new Set(); { const nW = Math.min(Math.max(1, Math.floor(b.w / 2) + 1), Math.max(1, Math.floor(w / 4))); for (let i = 0; i < nW; i++) { const c = Math.floor(((i + 0.5) * w) / nW); winCols.add(c - 1); winCols.add(c); } }
    const backWall = (fw, tall) => { const c = []; for (let x = 0; x <= w - fw; x++) c.push([x, 0]); const clear = (x) => { for (let k = x; k < x + fw; k++) if (winCols.has(k)) return false; return true; }; shuffle(c); return tall ? c.sort((a, b2) => (clear(b2[0]) ? 1 : 0) - (clear(a[0]) ? 1 : 0)) : c; };
    const leftWall = (fw, fh) => { const c = []; for (let y = 1; y <= d - fh - 1; y++) c.push([0, y]); return c; };
    const rightWall = (fw, fh) => { const c = []; for (let y = 1; y <= d - fh - 1; y++) c.push([w - fw, y]); return c; };
    const corners = (fw, fh) => [[0, 0], [w - fw, 0], [0, d - fh - 2], [w - fw, d - fh - 2]];
    const anywhere = (fw = 1, fh = 1) => { const c = []; for (let y = 1; y <= d - fh; y++) for (let x = 0; x <= w - fw; x++) c.push([x, y]); return shuffle(c); };
    const wallDist = ([x, y], fw, fh) => Math.min(x, w - fw - x, y, d - fh - y + 3);
    const nearWalls = (fw = 1, fh = 1) => anywhere(fw, fh).sort((a, c) => wallDist(a, fw, fh) - wallDist(c, fw, fh));
    const centre = (fw, fh) => { const c = []; for (let y = 2; y <= d - fh - 2; y++) for (let x = 1; x <= w - fw - 1; x++) c.push([x, y]); return c.sort((a, c2) => Math.hypot(a[0] + fw / 2 - w / 2, a[1] + fh / 2 - d / 2 + 0.5) - Math.hypot(c2[0] + fw / 2 - w / 2, c2[1] + fh / 2 - d / 2 + 0.5)); };

    const wealth = b.wealth, wv = wealth > 0.66 ? 2 : wealth > 0.36 ? 1 : 0;
    const chimneyX = b.sprite?.chimney ? O.clamp(Math.round(((b.sprite.chimney.x - b.sprite.OV) / (b.w * T)) * w) - 1, 0, w - 3) : null;
    const hhs = sim ? (b.households || (b.household ? [b.household] : [])).map((id) => sim.households[id - 1]).filter((h) => h && !h.gone && h.home === b.id) : [];
    const people = sim ? hhs.flatMap((h) => h.members.map((id) => sim.byId.get(id)).filter((p) => p && p.alive !== false)) : [];
    const lives = people.length > 0 || (!sim && ['house', 'farmhouse', 'manor', 'mansion', 'townhouse', 'keep', 'tenement', 'woodcutter', 'builder', 'weaver', 'tailor', 'cobbler', 'chandler', 'cooper'].includes(b.type));
    const members = people.length || 2;
    const twoFloors = b.floors >= 2;
    const stairsX = b.spec.doorTile * S >= w / 2 ? 0 : w - 2; // the corner away from the door, same on every floor
    // the stairs go in first, so everything else keeps clear of them
    // stairwells: the flight up from floor k stands in corner k (alternating sides), and arrives at
    // the same spot on the floor above, where the flight down stands
    const otherX = stairsX === 0 ? w - 2 : 0;
    const cornerOf = (k) => (k % 2 ? otherX : stairsX);
    const nFloors = b.floors || 1;
    const stairPiece = (x, up) => {
      const st = { kind: 'stairs', tx: x, ty: 0, fw: 2, fh: 3, v: up ? 0 : 1, rot: 0, seed: 1, id: items.length, stairs: up ? 1 : 0, access: true };
      for (let yy = 0; yy < 3; yy++) for (let xx = x; xx < x + 2; xx++) grid[yy * w + xx] = 1;
      items.push(st);
      for (let xx = x; xx < x + 2; xx++) keepClear.add(3 * w + xx);
    };
    if (twoFloors) {
      if (floor > 0) stairPiece(cornerOf(floor - 1), false);
      if (floor < nFloors - 1 && (nFloors > 2)) stairPiece(cornerOf(floor), true);
      else if (floor === 0) stairPiece(stairsX, true);
    }
    startTiles = floor === 0 ? [[dc, d - 1], [dc + 1, d - 1]] : [[cornerOf(floor - 1), 3], [cornerOf(floor - 1) + 1, 3]];

    const homeFloor = !twoFloors || floor === 1;
    const living = floor === 0;
    // beds for the people who actually sleep here
    function bedPlan() {
      if (!people.length) return ['double', 'bed'];
      const plan = []; const done = new Set();
      const kids = [];
      for (const p of people) {
        if (done.has(p.id)) continue;
        const sp = p.spouse && people.find((q) => q.id === p.spouse);
        if (sp) { plan.push('double'); done.add(p.id); done.add(sp.id); continue; }
        done.add(p.id);
        if (p.age < 3) plan.push('cradle'); else if (p.age < 14) kids.push(p); else plan.push('bed');
      }
      for (let i = 0; i < kids.length; i += kids.length > 2 ? 2 : 1) plan.push('bed'); // young brothers and sisters share
      return plan;
    }
    const beds = (plan) => {
      let placed = 0;
      for (const kind of plan || bedPlan()) {
        let it = null;
        if (kind === 'double') it = tryPut('double', backWall(3, true), { v: wv, bed: true, slots: 2 }) || tryPut('double', [...leftWall(3, 3), ...rightWall(3, 3)], { v: wv, bed: true, slots: 2 });
        else if (kind === 'cradle') it = tryPut('cradle', nearWalls(2, 2), { v: wv, bed: true, slots: 1, cradle: true });
        else it = tryPut('bed', backWall(2, true), { v: wv, bed: true, slots: 1 }) || tryPut('bed', leftWall(3, 2), { v: wv, bed: true, slots: 1, rot: 1 }) || tryPut('bed', rightWall(3, 2), { v: wv, bed: true, slots: 1, rot: 2 });
        if (it) placed++;
      }
      return placed;
    };
    const hearth = () => { if (chimneyX != null) return put('fireplace', chimneyX, 0, { v: wv }) || tryPut('fireplace', backWall(3), { v: wv }); return null; };
    // a table with a seat for everyone: chairs face the table from all four sides
    const dining = (n, opts = {}) => {
      const kind = n > 6 ? 'longtable' : 'table', [fw, fh] = SIZE[kind];
      const t = tryPut(kind, opts.at || centre(fw, fh), { v: wv, table: true }); if (!t) return null;
      const seat = wv >= 1 ? 'chair' : 'stool';
      const spots = [];
      for (let x = t.tx; x < t.tx + fw; x++) { spots.push([x, t.ty - 1, 0]); spots.push([x, t.ty + fh, 3]); }
      for (let y = t.ty; y < t.ty + fh; y++) { spots.push([t.tx - 1, y, 2]); spots.push([t.tx + fw, y, 1]); }
      let k = 0;
      for (const [x, y, r] of spots.sort((a, c) => (a[2] === 0 || a[2] === 3 ? 0 : 1) - (c[2] === 0 || c[2] === 3 ? 0 : 1))) { if (k >= n) break; if (put(seat, x, y, { seat: true, rot: r, v: wv, noAccess: true })) k++; }
      return t;
    };
    const storage = () => { tryPut(wv >= 1 ? 'dresser' : 'cupboard', backWall(2, true), { v: wv, pantry: true }); tryPut('chest', [...backWall(2), ...nearWalls(2, 1)], { v: wv, valuables: true }); if (rng.chance(0.6)) tryPut('barrel', nearWalls(), { pantry: true }); };
    const shelf = (goods, o = {}) => { const s = tryPut('shelf', backWall(3, true), Object.assign({ shop: true, goods }, o)); if (s) O.Furn.setGoods(s.seed, goods); return s; };
    const counterAtFront = (o = {}) => tryPut('counter', [[Math.max(0, Math.floor(w / 2) - 2), Math.floor(d / 2)], [1, Math.floor(d / 2)], [w - 5, Math.floor(d / 2)], ...anywhere(4, 1)], Object.assign({ counter: true }, o));
    const homeExtras = () => {
      if (wv >= 1) tryPut('rug', centre(3, 2).slice(3), { flat: true, width: 3 });
      if (rng.chance(0.5)) tryPut('spinning', nearWalls(2, 1));
      if (rng.chance(0.5)) tryPut('washtub', nearWalls());
      if (wv >= 1 && rng.chance(0.6)) tryPut('plant', nearWalls());
      if (wv >= 2) { tryPut('bookcase', backWall(2, true), { v: wv }); tryPut('candlestand', nearWalls()); }
      // the kitchen corner by the hearth, and the clutter of a lived-in house
      const fp = items.find((i) => i.kind === 'fireplace');
      if (fp) { tryPut('woodpile', [[fp.tx - 1, 0], [fp.tx + 3, 0], [fp.tx - 1, 1], [fp.tx + 3, 1]]); tryPut('cauldron', [[fp.tx + 3, 1], [fp.tx - 1, 1], ...nearWalls()], { work: ['cook'] }); }
      tryPut('bench', [...leftWall(3, 1).map(([x, y]) => [x, y]), ...nearWalls(3, 1)], { seat: true, rot: 0, noAccess: true });
      for (let i = 0; i < 2; i++) tryPut(rng.pick(['barrel', 'sack', 'crate']), nearWalls(), { pantry: true });
      if (rng.chance(0.5)) tryPut('loom', nearWalls(3, 2));
    };
    // business buildings: the family's rooms go upstairs (or into a back corner when there is no upstairs)
    const familyQuarters = () => { if (!lives) return; if (twoFloors && floor === 1) { beds(); dining(members, {}); storage(); } else if (!twoFloors) { beds(); storage(); } };

    // ---- the royal castle: four storeys of real rooms divided by inner walls ----
    const inRect = (x0, y0, x1, y1, fw, fh) => { const c = []; for (let y = y0; y <= y1 - fh + 1; y++) for (let x = x0; x <= x1 - fw + 1; x++) c.push([x, y]); return shuffle(c); };
    const rowOf = (x0, x1, y, fw) => { const c = []; for (let x = x0; x <= x1 - fw + 1; x++) c.push([x, y]); return shuffle(c); };
    const edgeOf = (x0, y0, x1, y1, fw, fh) => inRect(x0, y0, x1, y1, fw, fh).sort((a, c) => Math.min(a[0] - x0, x1 - a[0] - fw + 1, a[1] - y0, y1 - a[1] - fh + 1) - Math.min(c[0] - x0, x1 - c[0] - fw + 1, c[1] - y0, y1 - c[1] - fh + 1));
    const wallRow = (y, x0, x1, gaps, v) => { for (let x = x0; x <= x1; x++) if (!gaps.some((g) => x >= g && x < g + 2)) put('partH', x, y, { v, partition: true, noAccess: true }); };
    const wallCol = (x, y0, y1, gaps, v) => { for (let y = y0; y <= y1; y++) if (!gaps.some((g) => y >= g && y < g + 2)) put('partV', x, y, { v, partition: true, noAccess: true }); };
    const roomBeds = (room, plan) => { let n = 0; for (const kind of plan) { const rr = room; let it = null;
      if (kind === 'double') it = tryPut('double', rowOf(rr[0], rr[2], rr[1], 3), { v: 1, bed: true, slots: 2 }) || tryPut('double', edgeOf(rr[0], rr[1], rr[2], rr[3], 3, 3), { v: 1, bed: true, slots: 2 });
      else if (kind === 'cradle') it = tryPut('cradle', edgeOf(rr[0], rr[1], rr[2], rr[3], 2, 2), { v: 1, bed: true, slots: 1, cradle: true });
      else it = tryPut('bed', rowOf(rr[0], rr[2], rr[1], 2), { v: 1, bed: true, slots: 1 }) || tryPut('bed', edgeOf(rr[0], rr[1], rr[2], rr[3], 2, 3), { v: 1, bed: true, slots: 1 });
      if (it) n++; } return n; };
    const planFor = (ppl) => { const out = [], done = new Set(); let kids = 0; for (const q of ppl) { if (done.has(q.id)) continue; done.add(q.id); const sp = q.spouse && ppl.find((x) => x.id === q.spouse); if (sp) { done.add(sp.id); out.push('double'); } else if (q.age < 3) out.push('cradle'); else if (q.age < 14) kids++; else out.push('bed'); } for (let i = 0; i < kids; i += 2) out.push('bed'); return out; };
    function royal() {
      const W1 = Math.floor(w * 0.3), W2 = w - 1 - Math.floor(w * 0.3), MID = Math.floor(d / 2) - 1;
      const royals = people.filter((q) => q.royal), staff = people.filter((q) => !q.royal);
      if (floor === 0) {
        // the great hall in the middle, the kitchens to one side, the steward's hall and armoury to the other
        wallCol(W1, 0, d - 1, [MID], 1); wallCol(W2, 0, d - 1, [MID], 1);
        const hx0 = W1 + 1, hx1 = W2 - 1, hc = Math.floor((hx0 + hx1) / 2);
        put('throne', hc - 1, 1, { v: 2, lord: true, seat: true, rot: 3 });
        tryPut('fireplace', [[hx0 + 2, 0], [hx0 + 4, 0]], { v: 2 }); tryPut('fireplace', [[hx1 - 4, 0], [hx1 - 6, 0]], { v: 2 });
        put('rug', hc - 1, 4, { flat: true, width: 3 }); put('rug', hc - 1, 8, { flat: true, width: 3 }); put('rug', hc - 1, 12, { flat: true, width: 3 });
        for (const [tx, ty] of [[hx0 + 2, 6], [hx1 - 6, 6], [hx0 + 2, 13], [hx1 - 6, 13]]) {
          const t = put('longtable', tx, ty, { v: 2, table: true }); if (!t) continue;
          for (let x = t.tx; x < t.tx + 5; x++) { put('chair', x, t.ty - 1, { seat: true, rot: 0, v: 2, noAccess: true }); put('chair', x, t.ty + 2, { seat: true, rot: 3, v: 2, noAccess: true }); }
        }
        for (let i = 0; i < 6; i++) tryPut('candlestand', edgeOf(hx0, 1, hx1, d - 4, 1, 1), {});
        for (let i = 0; i < 2; i++) tryPut('plant', edgeOf(hx0, 1, hx1, d - 4, 1, 1), {});
        // kitchens
        const kx1 = W1 - 1, kroom = [0, 3, kx1, d - 1];
        tryPut('fireplace', rowOf(2, kx1, 0, 3), { v: 1, work: ['cook'] });
        tryPut('oven', rowOf(2, kx1, 0, 3), { work: ['master cook', 'cook'], fire: true }); tryPut('oven', rowOf(2, kx1, 0, 3), { work: ['cook'], fire: true });
        for (let i = 0; i < 3; i++) tryPut('cauldron', edgeOf(...kroom, 1, 1), { work: i ? ['scullion'] : ['cook'] });
        tryPut('doughtable', inRect(2, 5, kx1 - 2, d - 6, 3, 1), { work: ['master cook'] }); tryPut('doughtable', inRect(2, 5, kx1 - 2, d - 6, 3, 1), { work: ['cook'] });
        tryPut('butcherblock', edgeOf(...kroom, 3, 1), { work: ['cook'] }); tryPut('washtub', edgeOf(...kroom, 1, 1), { work: ['scullion'] }); tryPut('washtub', edgeOf(...kroom, 1, 1), { work: ['scullion'] });
        for (let i = 0; i < 8; i++) tryPut(['barrel', 'sack', 'crate'][i % 3], edgeOf(...kroom, 1, 1), { pantry: true });
        tryPut('woodpile', edgeOf(...kroom, 1, 1), {}); tryPut('dresser', rowOf(2, kx1, 0, 2), { v: 1, pantry: true });
        // the servants eat at a long table in the kitchen
        const st = tryPut('longtable', inRect(2, d - 9, kx1 - 2, d - 4, 5, 2), { v: 1, table: true });
        if (st) for (let x = st.tx; x < st.tx + 5; x++) { put('bench', x, st.ty - 1, { seat: true, rot: 0, v: 1, noAccess: true, width: 1 }); }
        // steward's hall and armoury
        const ex0 = W2 + 1, eroom = [ex0, 0, w - 1, d - 1];
        tryPut('desk', rowOf(ex0, w - 3, 0, 2), { v: 2, work: ['steward', 'chamberlain'] });
        tryPut('chest', edgeOf(...eroom, 2, 1), { v: 2, valuables: true, container: { slots: 24 } }); tryPut('chest', edgeOf(...eroom, 2, 1), { v: 2, valuables: true });
        for (let i = 0; i < 4; i++) tryPut('rack', rowOf(ex0, w - 1, 0, 2), {});
        tryPut('bookcase', edgeOf(...eroom, 2, 1), { v: 2 }); tryPut('bench', edgeOf(...eroom, 3, 1), { seat: true, rot: 0 });
        for (let i = 0; i < 3; i++) tryPut('barrel', edgeOf(...eroom, 1, 1), {});
        return;
      }
      if (floor === 1) {
        // the servants' floor: a long corridor with rooms either side
        const cy0 = MID - 2, cy1 = MID + 2, rw = Math.floor(w / 6);
        const doors = []; for (let i = 0; i < 6; i++) doors.push(i * rw + Math.floor(rw / 2) - 1);
        wallRow(cy0, 0, w - 1, doors, 0); wallRow(cy1, 0, w - 1, doors, 0);
        for (let i = 1; i < 6; i++) { wallCol(i * rw, 0, cy0 - 1, [], 0); wallCol(i * rw, cy1 + 1, d - 1, [], 0); }
        const rooms = []; for (let i = 0; i < 6; i++) { rooms.push([i * rw + (i ? 1 : 0), 0, (i + 1) * rw - 1, cy0 - 1]); rooms.push([i * rw + (i ? 1 : 0), cy1 + 1, i === 5 ? w - 1 : (i + 1) * rw - 1, d - 1]); }
        // the households living here: each family gets a room; the unmarried share by twos and threes
        const hhRes = hhs.filter((h) => h.servants);
        const fams = hhRes.filter((h) => h.members.length > 1), singles = hhRes.filter((h) => h.members.length === 1).map((h) => sim.byId.get(h.members[0])).filter(Boolean);
        let ri = 0;
        for (const h of fams) { if (ri >= rooms.length) break; const ppl = h.members.map((m) => sim.byId.get(m)).filter(Boolean); roomBeds(rooms[ri], planFor(ppl)); tryPut('chest', edgeOf(...rooms[ri], 2, 1), { v: 1, valuables: true }); ri++; }
        let left = singles.length || 8;
        while (left > 0 && ri < rooms.length) { const k = Math.min(3, left); left -= roomBeds(rooms[ri], Array(k).fill('bed')) || k; tryPut('chest', edgeOf(...rooms[ri], 2, 1), { v: 1 }); tryPut('candlestand', edgeOf(...rooms[ri], 1, 1), {}); ri++; }
        for (; ri < rooms.length; ri++) { tryPut('crate', edgeOf(...rooms[ri], 1, 1), {}); tryPut('sack', edgeOf(...rooms[ri], 1, 1), {}); tryPut('washtub', edgeOf(...rooms[ri], 1, 1), {}); }
        return;
      }
      if (floor === 2) {
        // the royal apartments: the king and queen's bedchamber, the royal children's rooms, the solar
        wallCol(W1, 0, d - 1, [MID], 2); wallCol(W2, 0, d - 1, [MID], 2);
        wallRow(MID - 2, 0, W1 - 1, [Math.floor(W1 / 2)], 2); wallRow(MID - 2, W2 + 1, w - 1, [W2 + Math.floor((w - W2) / 2)], 2);
        const cx0 = W1 + 1, cx1 = W2 - 1;
        const pair = royals.filter((q) => q.title === 'King' || q.title === 'Queen' || (q.spouse && royals.some((x) => x.id === q.spouse) && q.age > 25));
        roomBeds([cx0, 0, cx1, d - 1], pair.length ? planFor(pair) : ['double']);
        tryPut('fireplace', rowOf(cx0, cx1, 0, 3), { v: 2 }); tryPut('wardrobe', rowOf(cx0, cx1, 0, 2), { v: 2 }); tryPut('wardrobe', rowOf(cx0, cx1, 0, 2), { v: 2 });
        put('rug', Math.floor((cx0 + cx1) / 2) - 1, MID, { flat: true, width: 3 });
        tryPut('chest', edgeOf(cx0, 0, cx1, d - 1, 2, 1), { v: 2, valuables: true, container: { slots: 24 } });
        for (let i = 0; i < 4; i++) tryPut('candlestand', edgeOf(cx0, 0, cx1, d - 1, 1, 1), {});
        tryPut('desk', edgeOf(cx0, 0, cx1, d - 1, 2, 1), { v: 2 }); tryPut('plant', edgeOf(cx0, 0, cx1, d - 1, 1, 1), {});
        // the children's rooms to the west
        const kids = royals.filter((q) => !pair.includes(q));
        roomBeds([0, 0, W1 - 1, MID - 3], planFor(kids.slice(0, Math.ceil(kids.length / 2))).concat(kids.length ? [] : ['bed']));
        roomBeds([0, MID - 1, W1 - 1, d - 1], planFor(kids.slice(Math.ceil(kids.length / 2))).concat(['bed']));
        for (const rr of [[0, 0, W1 - 1, MID - 3], [0, MID - 1, W1 - 1, d - 1]]) { tryPut('wardrobe', edgeOf(...rr, 2, 1), { v: 2 }); tryPut('chest', edgeOf(...rr, 2, 1), { v: 2 }); tryPut('candlestand', edgeOf(...rr, 1, 1), {}); }
        // the solar and the ladies' chamber to the east
        const so = [W2 + 1, 0, w - 1, MID - 3], la = [W2 + 1, MID - 1, w - 1, d - 1];
        tryPut('bookcase', edgeOf(...so, 2, 1), { v: 2 }); tryPut('bookcase', edgeOf(...so, 2, 1), { v: 2 }); tryPut('desk', edgeOf(...so, 2, 1), { v: 2 });
        tryPut('table', inRect(so[0] + 2, so[1] + 2, so[2] - 2, so[3] - 1, 3, 2), { v: 2, table: true }); tryPut('loom', edgeOf(...la, 3, 2), { work: ['lady-in-waiting'] }); tryPut('spinning', edgeOf(...la, 2, 1), { work: ['lady-in-waiting'] });
        for (let i = 0; i < 3; i++) tryPut('chair', edgeOf(...la, 1, 1), { seat: true, rot: 3, v: 2, noAccess: true });
        tryPut('dresser', edgeOf(...la, 2, 1), { v: 2, work: ['maid'] }); tryPut('washtub', edgeOf(...la, 1, 1), { work: ['maid'] });
        return;
      }
      // the top floor: guest chambers, the private chapel, the armoury and treasury
      wallCol(W1, 0, d - 1, [MID], 1); wallCol(W2, 0, d - 1, [MID], 1);
      const cx0 = W1 + 1, cx1 = W2 - 1, cc = Math.floor((cx0 + cx1) / 2);
      put('altar', cc - 2, 0, { v: 2 });
      for (let y = 4; y < d - 4; y += 3) { put('pew', cx0 + 2, y, { width: Math.max(3, cc - cx0 - 4), seat: true, rot: 0, v: 2 }); put('pew', cc + 2, y, { width: Math.max(3, cx1 - cc - 3), seat: true, rot: 0, v: 2 }); }
      for (let i = 0; i < 4; i++) tryPut('candlestand', edgeOf(cx0, 0, cx1, d - 1, 1, 1), {});
      roomBeds([0, 0, W1 - 1, d - 1], ['double', 'bed', 'bed']); tryPut('wardrobe', edgeOf(0, 0, W1 - 1, d - 1, 2, 1), { v: 2 });
      const ar = [W2 + 1, 0, w - 1, d - 1];
      for (let i = 0; i < 6; i++) tryPut('rack', rowOf(ar[0], ar[2], 0, 2), {});
      for (let i = 0; i < 3; i++) tryPut('chest', edgeOf(...ar, 2, 1), { v: 2, valuables: true, container: { slots: 18 } });
    }

    // ---- a manor: the hall, the kitchen and the parlour below; the family's chambers and the
    // servants' rooms above ----
    function manor() {
      const W1 = Math.floor(w / 3), W2 = w - 1 - Math.floor(w / 3), MID = Math.floor(d / 2) - 1;
      const fam = people.filter((q) => q.gentry), staff = people.filter((q) => !q.gentry);
      if (floor === 0) {
        wallCol(W1, 0, d - 1, [MID], 2); wallCol(W2, 0, d - 1, [MID], 2);
        const k = [0, 0, W1 - 1, d - 1], h = [W1 + 1, 0, W2 - 1, d - 1], pa = [W2 + 1, 0, w - 1, d - 1];
        tryPut('fireplace', rowOf(k[0], k[2], 0, 3), { v: 1, work: ['cook'] }); tryPut('oven', rowOf(k[0], k[2], 0, 3), { work: ['cook'], fire: true });
        tryPut('cauldron', edgeOf(...k, 1, 1), { work: ['cook'] }); tryPut('doughtable', inRect(k[0] + 1, 3, k[2] - 1, d - 4, 3, 1), { work: ['cook'] }); tryPut('washtub', edgeOf(...k, 1, 1), { work: ['maid'] });
        for (let i = 0; i < 5; i++) tryPut(['barrel', 'sack', 'crate'][i % 3], edgeOf(...k, 1, 1), { pantry: true });
        tryPut('dresser', rowOf(k[0], k[2], 0, 2), { v: 1, pantry: true });
        const st = tryPut('table', inRect(k[0] + 2, d - 7, k[2] - 2, d - 4, 3, 2), { v: 1, table: true }); if (st) for (let x = st.tx; x < st.tx + 3; x++) put('stool', x, st.ty - 1, { seat: true, rot: 0, v: 1, noAccess: true });
        tryPut('fireplace', rowOf(h[0] + 1, h[2] - 1, 0, 3), { v: 2 });
        const t = tryPut('longtable', inRect(h[0] + 2, 4, h[2] - 2, d - 5, 5, 2), { v: 2, table: true });
        if (t) for (let x = t.tx; x < t.tx + 5; x++) { put('chair', x, t.ty - 1, { seat: true, rot: 0, v: 2, noAccess: true }); put('chair', x, t.ty + 2, { seat: true, rot: 3, v: 2, noAccess: true }); }
        tryPut('dresser', rowOf(h[0], h[2], 0, 2), { v: 2 }); for (let i = 0; i < 3; i++) tryPut('candlestand', edgeOf(...h, 1, 1), {}); tryPut('plant', edgeOf(...h, 1, 1), {});
        tryPut('desk', rowOf(pa[0], pa[2] - 2, 0, 2), { v: 2, work: ['steward'] }); tryPut('bookcase', rowOf(pa[0], pa[2] - 2, 0, 2), { v: 2 }); tryPut('bookcase', edgeOf(...pa, 2, 1), { v: 2 });
        tryPut('chest', edgeOf(...pa, 2, 1), { v: 2, valuables: true, container: { slots: 18 } });
        put('rug', pa[0] + 3, MID, { flat: true, width: 3 }); for (let i = 0; i < 3; i++) tryPut('chair', inRect(pa[0] + 1, MID - 2, pa[2] - 1, MID + 3, 1, 1), { seat: true, rot: 3, v: 2, noAccess: true });
        return;
      }
      wallCol(W1, 0, d - 1, [MID], 2); wallCol(W2, 0, d - 1, [MID], 2); wallRow(MID - 1, W2 + 1, w - 1, [W2 + 3], 0);
      const lord = fam.filter((q) => q.title === 'Lord' || q.title === 'Lady');
      roomBeds([0, 0, W1 - 1, d - 1], lord.length ? planFor(lord) : ['double']);
      tryPut('wardrobe', rowOf(0, W1 - 1, 0, 2), { v: 2 }); tryPut('chest', edgeOf(0, 0, W1 - 1, d - 1, 2, 1), { v: 2, valuables: true }); tryPut('candlestand', edgeOf(0, 0, W1 - 1, d - 1, 1, 1), {}); put('rug', 3, MID + 1, { flat: true, width: 3 });
      const kids = fam.filter((q) => !lord.includes(q));
      roomBeds([W1 + 1, 0, W2 - 1, d - 1], kids.length ? planFor(kids) : ['bed']); tryPut('wardrobe', rowOf(W1 + 1, W2 - 1, 0, 2), { v: 2 }); tryPut('chest', edgeOf(W1 + 1, 0, W2 - 1, d - 1, 2, 1), { v: 2 });
      // the servants' rooms: families together, the unmarried by twos
      const srv = hhs.filter((hh) => !hh.members.some((m) => sim.byId.get(m)?.gentry));
      const rooms = [[W2 + 1, 0, w - 1, MID - 2], [W2 + 1, MID, w - 1, d - 1]];
      let ri = 0;
      for (const hh of srv.filter((x) => x.members.length > 1)) { if (ri >= rooms.length) break; roomBeds(rooms[ri], planFor(hh.members.map((m) => sim.byId.get(m)).filter(Boolean))); ri++; }
      const singles = srv.filter((x) => x.members.length === 1).length;
      if (ri < rooms.length) roomBeds(rooms[ri], Array(Math.max(1, Math.min(3, singles))).fill('bed'));
      for (const rr of rooms) tryPut('chest', edgeOf(...rr, 2, 1), { v: 1 });
      void staff;
    }

    if (b.royal) royal(); else if (b.manor) manor(); else switch (b.type) {
      case 'house': case 'farmhouse': case 'woodcutter':
        if (living) { hearth(); dining(members); }
        if (homeFloor) beds();
        storage();
        if (living) homeExtras();
        if (b.type === 'farmhouse') { tryPut('sack', nearWalls(), { stockOf: 'farm' }); tryPut('sack', nearWalls(), { stockOf: 'farm' }); tryPut('barrel', nearWalls()); }
        if (b.type === 'woodcutter') { tryPut('woodpile', nearWalls()); tryPut('woodpile', nearWalls()); tryPut('rack', backWall(2, true)); }
        break;
      case 'bakery':
        if (floor === 0) {
          (chimneyX != null && put('oven', chimneyX, 0, { work: ['baker', 'apprentice'], fire: true })) || tryPut('oven', backWall(3), { work: ['baker', 'apprentice'], fire: true });
          shelf(['bread'], { stockGood: 'bread' });
          tryPut('doughtable', [...backWall(3), ...nearWalls(3, 1)], { work: ['apprentice', 'baker'] });
          tryPut('doughtable', nearWalls(3, 1), { work: ['baker'] });
          counterAtFront({ work: ['shopkeeper'] });
          for (let i = 0; i < 3; i++) tryPut('sack', nearWalls(), { stockOf: 'flour', container: { slots: 2 } });
          tryPut('woodpile', nearWalls()); tryPut('woodpile', nearWalls());
        }
        familyQuarters();
        break;
      case 'smithy': case 'armourer':
        if (floor === 0) {
          (chimneyX != null && put('forge', chimneyX, 0, { work: [b.type === 'smithy' ? 'blacksmith' : 'armourer'], fire: true })) || tryPut('forge', backWall(3), { work: ['blacksmith', 'armourer'], fire: true });
          tryPut('anvil', centre(1, 1), { work: ['blacksmith', 'apprentice', 'armourer'] });
          tryPut('rack', backWall(2, true), { stockGood: b.type === 'smithy' ? 'tools' : 'helm', shop: true });
          if (b.type === 'armourer') tryPut('rack', backWall(2, true), { stockGood: 'sword', shop: true });
          tryPut('workbench', nearWalls(3, 1), { work: ['apprentice'] });
          tryPut('washtub', nearWalls()); // the quench
          counterAtFront({});
          tryPut('barrel', nearWalls()); tryPut('woodpile', nearWalls()); tryPut('crate', nearWalls(), { stockOf: 'iron' });
        }
        familyQuarters();
        break;
      case 'tavern':
        if (floor === 0) {
          hearth();
          const bar = tryPut('bar', [[Math.max(0, Math.floor(w / 2) - 3), 3], [1, 3], ...anywhere(6, 1)], { width: 6, counter: true, work: ['innkeeper', 'server'] });
          for (let i = 0; i < 5; i++) tryPut('barrel', backWall(1), { stockOf: 'ale', container: { slots: 5 } });
          tryPut('dresser', backWall(2, true), { v: 1 });
          // tables through the room, four to six drinkers at each
          const tz = []; for (let y = (bar ? bar.ty + 4 : 6); y <= d - 5; y += 5) for (let x = 1; x <= w - 5; x += 6) tz.push([x + 1, y]);
          for (const at of tz) dining(rng.chance(0.5) ? 6 : 4, { at: [at] });
          tryPut('cauldron', nearWalls(), { work: ['cook'] });
          tryPut('woodpile', nearWalls());
        } else {
          // guest rooms: beds along the walls, a chest for the lodgers, the landlord's family
          for (let i = 0; i < 6; i++) tryPut('bed', backWall(2, true), { bed: true, slots: 1, v: 1, rent: i < 4 }) || tryPut('bed', leftWall(3, 2), { bed: true, slots: 1, v: 1, rent: i < 4, rot: 1 }) || tryPut('bed', rightWall(3, 2), { bed: true, slots: 1, v: 1, rent: i < 4, rot: 2 });
          tryPut('chest', nearWalls(2, 1), { valuables: true, rentChest: true });
          if (lives) beds();
          tryPut('washtub', nearWalls()); tryPut('table', centre(3, 2), { table: true, v: 1 });
          storage();
        }
        break;
      case 'store':
        if (floor === 0) {
          shelf(['cabbage', 'firewood', 'flour'], { stockGood: 'cabbage' });
          shelf(['flour', 'cabbage'], { stockGood: 'flour' });
          counterAtFront({ work: ['shopkeeper'] });
          for (let i = 0; i < 5; i++) tryPut(rng.pick(['crate', 'barrel', 'sack']), nearWalls(), { stockOf: 'store' });
        }
        familyQuarters();
        break;
      case 'doctor':
        if (floor === 0) {
          shelf(['medicine', 'herbs'], { stockGood: 'medicine' });
          tryPut('desk', [...backWall(2), ...nearWalls(2, 1)], { work: ['physician'] });
          for (let i = 0; i < 2; i++) tryPut('medbed', [...backWall(2, true), ...nearWalls(2, 3)], { medbed: true, bed: true, slots: 1, work: ['herbalist'] });
          tryPut('bench', nearWalls(3, 1), { seat: true, waiting: true });
          tryPut('cauldron', nearWalls(), {}); tryPut('chest', nearWalls(2, 1), { valuables: true });
        }
        familyQuarters();
        break;
      case 'chapel': {
        // everything mirrors about the aisle: the altar and its cross on the centre line, the candlesticks
        // and the two blocks of pews either side
        const even = w % 2 === 0, mid = Math.floor(w / 2);
        put('altar', even ? mid - 2 : mid - 2, 1, { work: ['priest'], candles: true });
        for (const x of even ? [mid - 4, mid + 3] : [mid - 4, mid + 4]) tryPut('candlestand', [[x, 1]]);
        // pews in two blocks either side of the aisle, enough for the parish
        const pw = Math.floor((w - 4) / 2);
        for (let y = 5; y <= d - 4; y += 2) { put('pew', 1, y, { pew: true, width: pw, seats: pw }); put('pew', w - 1 - pw, y, { pew: true, width: pw, seats: pw }); }
        put('chest', 0, 0, { valuables: true, alms: true }); put('chest', w - 2, 0, { valuables: true });
        break;
      }
      case 'mill':
        if (floor === 0) {
          put('millstone', Math.floor(w / 2) - 1, 2, { work: ['miller', 'labourer'] });
          for (let i = 0; i < 6; i++) tryPut('sack', nearWalls(), { stockOf: i % 2 ? 'flour' : 'wheat', container: { slots: 2 } });
          tryPut('crate', nearWalls()); tryPut('workbench', nearWalls(3, 1), { work: ['labourer'] });
        }
        familyQuarters();
        break;
      case 'guard': {
        tryPut('desk', [...backWall(2), ...centre(2, 1)], { work: ['guard captain', 'guard'] });
        tryPut('rack', backWall(2, true)); tryPut('rack', backWall(2, true));
        put('cell', w - 4, d - 6, { cell: true }) || tryPut('cell', corners(4, 4), { cell: true });
        tryPut('bench', nearWalls(3, 1), { seat: true });
        dining(4);
        tryPut('chest', nearWalls(2, 1), { valuables: true, evidence: true });
        tryPut('bed', backWall(2, true), { bed: true, slots: 1 }); // the night watch's cot
        break;
      }
      case 'barn':
        for (let i = 0; i < 10; i++) tryPut('hay', nearWalls(), {});
        for (let i = 0; i < 4; i++) tryPut('sack', nearWalls(), { stockOf: 'wheat', container: { slots: 2 } });
        tryPut('crate', nearWalls()); tryPut('barrel', nearWalls()); tryPut('rack', backWall(2, true));
        break;
      case 'hideout': {
        const lvl = b.level || 1;
        hearth();
        for (let i = 0; i < Math.min(O.Gangs.LEVELS[lvl].beds, 8); i++) tryPut('bed', backWall(2, true), { bed: true, slots: 1, v: 0, gangBed: true }) || tryPut('bed', leftWall(3, 2), { bed: true, slots: 1, v: 0, gangBed: true, rot: 1 }) || tryPut('bed', rightWall(3, 2), { bed: true, slots: 1, v: 0, gangBed: true, rot: 2 });
        dining(5);
        tryPut('chest', [...backWall(2), ...nearWalls(2, 1)], { gangStash: true, noContainer: true });
        if (lvl >= 2) { tryPut('rack', backWall(2, true)); tryPut('workbench', nearWalls(3, 1)); }
        if (lvl >= 3) { tryPut('desk', nearWalls(2, 1)); tryPut('rug', centre(3, 2), { flat: true, width: 3 }); }
        tryPut('barrel', nearWalls()); tryPut('woodpile', nearWalls());
        break;
      }
      case 'butcher':
        if (floor === 0) {
          tryPut('butcherblock', [...backWall(3), ...nearWalls(3, 1)], { work: ['butcher', 'apprentice'] });
          tryPut('rack', backWall(2, true), { stockGood: 'meat', shop: true });
          counterAtFront({});
          for (let i = 0; i < 2; i++) tryPut('barrel', nearWalls(), { stockOf: 'meat', container: { slots: 4 } });
          tryPut('washtub', nearWalls());
        }
        familyQuarters();
        break;
      case 'jeweller':
        if (floor === 0) {
          tryPut('desk', [...backWall(2), ...nearWalls(2, 1)], { work: ['jeweller'] });
          shelf(['ring', 'brooch'], { stockGood: 'ring' });
          counterAtFront({});
          tryPut('chest', [...backWall(2), ...nearWalls(2, 1)], { valuables: true, strongbox: true, container: { slots: 20 } });
          tryPut('stool', nearWalls(), { seat: true, work: ['night watchman'] });
          tryPut('candlestand', nearWalls());
        }
        familyQuarters();
        break;
      case 'apothecary':
        if (floor === 0) {
          shelf(['medicine', 'herbs'], { stockGood: 'medicine' });
          shelf(['herbs'], { stockGood: 'herbs' });
          tryPut('cauldron', nearWalls(), { work: ['apothecary'] });
          tryPut('workbench', nearWalls(3, 1), { work: ['apothecary'] });
          counterAtFront({});
          tryPut('plant', nearWalls()); tryPut('plant', nearWalls());
        }
        familyQuarters();
        break;
      case 'carpenter':
        if (floor === 0) {
          tryPut('workbench', [...backWall(3), ...nearWalls(3, 1)], { work: ['carpenter'] });
          tryPut('workbench', nearWalls(3, 1), { work: ['apprentice'] });
          for (let i = 0; i < 3; i++) tryPut('woodpile', nearWalls(), { stockOf: 'logs' });
          tryPut('table', centre(3, 2), { stockGood: 'furniture', shop: true, table: true }); tryPut('chair', nearWalls(), { shop: true, rot: 0 });
          tryPut('rack', backWall(2, true));
        }
        familyQuarters();
        break;
      case 'builder':
        if (floor === 0) {
          tryPut('workbench', [...backWall(3), ...nearWalls(3, 1)], { work: ['master builder'] });
          tryPut('workbench', nearWalls(3, 1), { work: ['labourer', 'builder'] });
          for (let i = 0; i < 3; i++) tryPut('woodpile', nearWalls(), { stockOf: 'logs' });
          for (let i = 0; i < 2; i++) tryPut('crate', nearWalls(), { stockOf: 'stone' });
          tryPut('rack', backWall(2, true)); tryPut('rack', backWall(2, true));
          tryPut('table', centre(3, 2), { stockGood: 'planks', shop: true, table: true });
        }
        familyQuarters();
        break;
      case 'weaver': case 'tailor': case 'cobbler': case 'chandler': case 'cooper': case 'tanner': case 'potter': {
        const T2 = b.type, master = O.Data.BUSINESS[T2].jobs[0][0], second = (O.Data.BUSINESS[T2].jobs[1] || [])[0];
        if (floor === 0) {
          if (T2 === 'weaver') { tryPut('loom', [...backWall(3), ...nearWalls(3, 2)], { work: ['weaver'] }); tryPut('spinning', nearWalls(2, 1), { work: ['spinner'] }); tryPut('loom', nearWalls(3, 2)); }
          else if (T2 === 'chandler') { tryPut('cauldron', nearWalls(), { work: ['chandler'], fire: true }); tryPut('rack', backWall(2, true)); }
          else { tryPut('workbench', [...backWall(3), ...nearWalls(3, 1)], { work: [master] }); if (second) tryPut('workbench', nearWalls(3, 1), { work: [second] }); }
          if (T2 === 'cooper') { tryPut('barrel', nearWalls()); tryPut('barrel', nearWalls()); tryPut('woodpile', nearWalls(), { stockOf: 'planks' }); }
          for (let i = 0; i < 2; i++) tryPut(T2 === 'weaver' || T2 === 'tailor' ? 'sack' : 'crate', nearWalls(), { stockOf: O.Data.BUSINESS[T2].recipes[0] && Object.keys(O.Data.BUSINESS[T2].recipes[0].inp)[0] });
          counterAtFront({ work: [master] });
          tryPut('table', centre(3, 2), { stockGood: O.Data.BUSINESS[T2].sells[0], shop: true, table: true });
        }
        familyQuarters();
        break;
      }
      case 'sawmill':
        tryPut('workbench', [...backWall(3), ...nearWalls(3, 1)], { work: ['sawyer', 'labourer'] });
        tryPut('workbench', nearWalls(3, 1), { work: ['labourer'] });
        for (let i = 0; i < 5; i++) tryPut('woodpile', nearWalls(), { stockOf: i % 2 ? 'logs' : 'planks' });
        tryPut('rack', backWall(2, true)); familyQuarters();
        break;
      case 'quarry': case 'mine':
        tryPut('desk', [...backWall(2), ...nearWalls(2, 1)], { work: ['quarry master'] });
        tryPut('rack', backWall(2, true), { work: ['quarryman'] }); tryPut('anvil', nearWalls(), { work: ['quarryman'] });
        for (let i = 0; i < 6; i++) tryPut('crate', nearWalls(), { stockOf: 'stone' });
        tryPut('barrel', nearWalls()); tryPut('bench', nearWalls(3, 1), { seat: true });
        break;
      case 'warehouse':
        for (let i = 0; i < Math.floor((w * d) / 10); i++) tryPut(rng.pick(['crate', 'crate', 'barrel', 'sack']), nearWalls(), { stockOf: 'warehouse' });
        tryPut('desk', nearWalls(2, 1), { work: ['warehouse master'] });
        tryPut('chest', nearWalls(2, 1), { valuables: true });
        break;
      case 'townhall':
        if (floor === 0) {
          tryPut('desk', [[Math.floor(w / 2) - 1, 1], ...backWall(2)], { work: ['magistrate'] });
          for (let i = 0; i < 2; i++) tryPut('desk', [[2 + i * (w - 6), 3], ...nearWalls(2, 1)], { work: ['clerk'] });
          { const pw = Math.floor((w - 4) / 2); for (let y = 6; y <= d - 4; y += 2) { put('pew', 1, y, { pew: true, width: pw, seats: pw }); put('pew', w - 1 - pw, y, { pew: true, width: pw, seats: pw }); } }
          tryPut('bookcase', backWall(2, true)); tryPut('chest', nearWalls(2, 1), { valuables: true, treasury: true });
          if (wv >= 1) tryPut('rug', [[Math.floor(w / 2) - 1, 3]], { flat: true, width: 3 });
        } else { dining(8); tryPut('bookcase', backWall(2, true)); tryPut('bookcase', backWall(2, true)); tryPut('shelf', backWall(3, true)); }
        break;
      case 'morgue':
        for (let x = 1; x + 2 <= w - 1; x += 3) tryPut('medbed', [[x, 0]], { slab: true });
        tryPut('desk', nearWalls(2, 1), { work: ['undertaker'] }); tryPut('candlestand', nearWalls()); tryPut('candlestand', nearWalls()); tryPut('shelf', backWall(3, true)); tryPut('chest', nearWalls(2, 1));
        break;
      case 'hospital':
        for (let x = 0; x + 2 <= w; x += 3) { tryPut('medbed', [[x, 0]], { medbed: true, bed: true, slots: 1, work: ['nurse'] }); tryPut('medbed', [[x, d - 6]], { medbed: true, bed: true, slots: 1 }); }
        tryPut('desk', nearWalls(2, 1), { work: ['physician'] }); tryPut('shelf', backWall(3, true), { stockGood: 'medicine', shop: true });
        tryPut('cauldron', nearWalls(), {}); tryPut('bench', nearWalls(3, 1), { seat: true, waiting: true }); tryPut('washtub', nearWalls());
        break;
      case 'school':
        tryPut('desk', [[Math.floor(w / 2) - 1, 1], ...backWall(2)], { work: ['teacher'] });
        for (let y = 4; y <= d - 4; y += 2) for (const x of [1, w - 4]) put('pew', x, y, { pew: true, width: 3, seats: 3 });
        tryPut('bookcase', backWall(2, true));
        break;
      case 'tenement':
        if (floor === 0) hearth();
        beds();
        dining(Math.min(8, members));
        for (let i = 0; i < 2; i++) tryPut('sack', nearWalls(), { pantry: true });
        tryPut('chest', nearWalls(2, 1), { valuables: true });
        break;
      case 'mansion': case 'townhouse': case 'keep':
        if (floor === 0) {
          hearth(); tryPut('rug', centre(3, 2), { flat: true, width: 3 });
          dining(Math.max(members, b.type === 'keep' ? (b.royal ? 20 : 12) : 6));
          tryPut('dresser', backWall(2, true), { v: 2, pantry: true }); tryPut('bookcase', backWall(2, true), { v: 2 });
          tryPut('candlestand', nearWalls()); tryPut('candlestand', nearWalls()); tryPut('plant', nearWalls());
          if (b.type === 'keep') { tryPut('desk', [[Math.floor(w / 2) - 1, 1]], { v: 2, lord: true }); tryPut('rack', backWall(2, true)); tryPut('rack', backWall(2, true)); tryPut('barrel', nearWalls()); tryPut('barrel', nearWalls()); }
        } else {
          beds(); tryPut('wardrobe', backWall(2, true), { v: 2 }); tryPut('chest', nearWalls(2, 1), { v: 2, valuables: true, container: { slots: 18 } });
          tryPut('rug', centre(3, 2), { flat: true, width: 3 }); tryPut('desk', nearWalls(2, 1)); tryPut('candlestand', nearWalls());
        }
        storage();
        break;
      case 'kitchen':
        if (floor === 0) {
          hearth(); tryPut('oven', backWall(3), { work: ['cook', 'master cook'], fire: true });
          tryPut('cauldron', nearWalls(), { work: ['cook'] }); tryPut('cauldron', nearWalls(), { work: ['scullion'] });
          tryPut('doughtable', nearWalls(3, 1), { work: ['master cook'] }); tryPut('doughtable', centre(3, 1), { work: ['cook'] });
          tryPut('butcherblock', nearWalls(2, 1), { work: ['cook'] }); tryPut('washtub', nearWalls(), { work: ['scullion'] });
          for (let i = 0; i < 4; i++) tryPut(rng.pick(['barrel', 'sack', 'crate']), nearWalls(), { pantry: true });
          tryPut('woodpile', nearWalls()); tryPut('woodpile', nearWalls());
          tryPut('longtable', centre(4, 1), { work: ['scullion'] });
        }
        break;
      default: storage(); familyQuarters();
    }
    // a chimney always has a fire beneath it
    if (chimneyX != null && floor === 0 && !items.some((i) => i.kind === 'fireplace' || i.kind === 'oven' || i.kind === 'forge')) hearth();
    // portraits of the family's notable dead hang on the back wall, clear of the windows and tall pieces
    if (b.portraits && b.portraits.length && floor === 0) {
      const taken = new Set(); for (const it of items) if (it.ty === 0) for (let x = it.tx; x < it.tx + it.fw; x++) taken.add(x);
      for (const pr of b.portraits.slice(-3)) {
        let best = null;
        for (let x = 1; x < w - 1; x++) { if (taken.has(x) || winCols.has(x)) continue; if (best == null || Math.abs(x - w / 2) < Math.abs(best - w / 2)) best = x; }
        if (best == null) break; taken.add(best); taken.add(best - 1); taken.add(best + 1);
        items.push({ kind: 'portrait', tx: best, ty: 0, fw: 1, fh: 1, v: wealth > 0.5 ? 1 : 0, seed: pr.seed, id: items.length, portrait: pr, flat: true });
      }
    }
    items.forEach((it, i) => (it.id = i));
    return { b, floor, w, d, items, grid, floors: b.floors, dc, scale: S, reachable: reach(), stairsX };
  }

  // Cached interior per building/floor (furniture is fixed; stock visuals update live).
  const cache = new Map();
  function interior(b, floor, sim) {
    const key = b.id + ':' + floor;
    if (cache.has(key)) return cache.get(key);
    const L = layoutFor(b, floor, sim);
    const wallKind = b.spec.wall === 'stone' || b.spec.wall === 'log' || b.spec.wall === 'plank' ? b.spec.wall : 'timber';
    const floorKind = ['smithy', 'chapel', 'guard', 'mill', 'quarry', 'mine', 'armourer', 'warehouse', 'townhall', 'keep', 'hospital', 'manor'].includes(b.type) ? 'stone' : b.type === 'barn' || (b.type === 'house' && b.wealth < 0.3) ? 'dirt' : 'wood';
    L.room = O.Furn.room({ w: L.w, d: L.d, wall: wallKind, floor: floorKind, wealth: b.wealth, seed: b.id * 3 + floor, windows: Math.max(1, Math.floor(b.w / 2) + 1), doorTile: floor === 0 ? L.dc : -5 });
    cache.set(key, L);
    return L;
  }

  O.Interior = { interior, layoutFor, FOOT, foot, invalidate: (b) => { for (const k of [...cache.keys()]) if (k.startsWith(b.id + ':')) cache.delete(k); } };
})();
