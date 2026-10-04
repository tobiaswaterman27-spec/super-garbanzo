// Interior layouts. Every enterable building gets rooms in proportion to its exterior footprint
// (three tiles inside for every tile outside, four for churches, which must seat the parish), one
// scene per floor. A chimney means a fireplace, oven or forge beneath it; two floors mean stairs in
// the same corner of both.
//
// Furniture is arranged the way people arrange it: beds against the walls with their heads to the
// wall, a table in the middle of the room with a chair for everyone in the household, the hearth on
// the back wall where the chimney is, cupboards and chests along the walls. A house gets the beds
// its family needs, a double bed for a couple, a bed each for the others (small children share),
// a cradle for a baby. Every piece is checked as it goes in: if it would cut off the door, the
// stairs or anything else that has to be reached, it is not placed there.
//
// Workplaces where nobody lives get no beds at all, and more to do instead.
'use strict';
(function () {
  const T = 16;
  const SIZE = { partH: [1, 1], partV: [1, 1], throne: [2, 2], bed: [2, 3], double: [3, 3], medbed: [2, 3], cradle: [2, 2], table: [3, 2], longtable: [5, 2], chair: [1, 1], stool: [1, 1], bench: [3, 1], fireplace: [3, 1], oven: [3, 2], forge: [3, 2], anvil: [1, 1],
    cupboard: [2, 1], dresser: [2, 1], wardrobe: [2, 1], bookcase: [2, 1], chest: [2, 1], shelf: [3, 1], counter: [4, 1], workbench: [3, 1], doughtable: [3, 1], butcherblock: [3, 1], rack: [2, 1], desk: [2, 1],
    altar: [4, 1], millstone: [3, 2], loom: [3, 2], spinning: [2, 1], stairs: [2, 3], cauldron: [1, 1], washtub: [1, 1], plant: [1, 1], candlestand: [1, 1], barrel: [1, 1], crate: [1, 1], sack: [1, 1], hay: [1, 1], woodpile: [1, 1], cell: [4, 4], vat: [2, 2], kiln: [3, 2], ballotbox: [1, 1], roomdoor: [2, 1] };
  const foot = (kind, rot, width) => { if (kind === 'bed' && rot) return [3, 2]; if (kind === 'pew' || kind === 'bar') return [width || 5, 1]; if (kind === 'rug') return [width || 3, 2]; if (kind === 'bench' && width) return [width, 1]; return SIZE[kind] || [1, 1]; };
  const FOOT = SIZE;
  const CONTAINER = { cupboard: 15, dresser: 12, wardrobe: 15, chest: 12, barrel: 5, crate: 5, sack: 2 };
  // pieces that must stay reachable (you have to get to a bed, a chest, a workstation)
  const NEEDS_ACCESS = new Set(['bed', 'double', 'medbed', 'cradle', 'fireplace', 'oven', 'forge', 'anvil', 'cupboard', 'dresser', 'wardrobe', 'bookcase', 'chest', 'shelf', 'counter', 'workbench', 'doughtable', 'butcherblock', 'rack', 'desk', 'altar', 'millstone', 'loom', 'spinning', 'stairs', 'cauldron', 'barrel', 'crate', 'sack', 'bar', 'cell', 'pew', 'bench', 'vat', 'kiln', 'ballotbox']);

  function scaleFor(b) { return b.type === 'chapel' ? 4 : 3; }

  // ---- the royal castle, laid out as a building of rooms ----
  // A long hallway below with doors to the throne room, the kitchens, the servants' hall, the steward's
  // hall, the guardroom and the chapel, and the grand stairs at the far end; above, the great hallway with
  // the council's long table and a door for everyone who lives in the castle (the monarch's bedchamber
  // and the royal children's rooms locked). Each room is its own place: you see only the one you're in.
  const castles = new WeakMap();
  function castlePlan(b, sim) {
    let c = castles.get(b); if (!c) { c = { map: new Map() }; castles.set(b, c); }
    const mk = (key, name, type, fl, w, d, extra) => { let r = c.map.get(key); if (!r) { r = { id: b.id, parent: b, roomKey: key, name, type, roomFloor: fl, w, d, floors: 1, wealth: b.wealth, condition: 1, spec: Object.assign({}, b.spec, { doorTile: Math.floor(w / 2) - 1, floors: 1 }), roomOwners: [] }; c.map.set(key, r); } Object.assign(r, extra || {}); return r; };
    const ground = [mk('throne', 'The throne room', 'throneroom', 0, 10, 6), mk('kitchen', 'The kitchens', 'castlekitchen', 0, 8, 5), mk('hall', "The servants' hall", 'servhall', 0, 8, 5),
      mk('steward', "The steward's hall", 'stewardroom', 0, 6, 4), mk('guardroom', 'The guardroom and armoury', 'guardroom', 0, 6, 4), mk('chapel', 'The castle chapel', 'castlechapel', 0, 7, 5)];
    // upstairs: the second floor for the household's lesser folk and their families, the third for those
    // who stand higher at court, the fourth for the monarch and the royal family
    const up = [];
    const hhs = sim ? sim.households.filter((h) => !h.gone && h.home === b.id) : [];
    for (const h of hhs) {
      const ppl = h.members.map((id) => sim.byId.get(id)).filter((p) => p && p.alive !== false); if (!ppl.length) continue;
      if (ppl.some((p) => p.royal)) {
        const pa = ppl.filter((p) => p.title === 'King' || p.title === 'Queen'), kids = ppl.filter((p) => !pa.includes(p));
        if (pa.length) up.push(mk('chamber:monarch', "The monarch's bedchamber", 'chamber', 4, 7, 5, { roomOwners: pa.map((p) => p.id), locked: 'monarch', wealth: 1, royalRoom: true }));
        for (const k of kids) up.push(mk('chamber:' + k.id, `${k.first}'s chamber`, 'chamber', 4, 5, 4, { roomOwners: [k.id], locked: 'royal', wealth: 0.95, royalRoom: true }));
      } else {
        const high = ppl.some((p) => HIGH.has(p.job?.role) || /^(Lord|Lady|Sir)\b/.test(p.title || ''));
        up.push(mk('chamber:hh' + h.id, `The ${h.surname} room`, 'chamber', high ? 3 : 2, ppl.length > 2 ? 6 : 4, 4, { roomOwners: ppl.map((p) => p.id), wealth: high ? 0.75 : 0.55 }));
      }
    }
    up.push(mk('chamber:guest', 'The guest chamber', 'chamber', 3, 5, 4, { roomOwners: [], wealth: 0.85 }));
    // the monarch's bedchamber is always kept, whoever holds the crown (you, if it's you)
    if (!up.some((r) => r.roomKey === 'chamber:monarch')) up.push(mk('chamber:monarch', "The monarch's bedchamber", 'chamber', 4, 7, 5, { roomOwners: [], locked: 'monarch', wealth: 1, royalRoom: true, playerRoom: true }));
    // nobody keeps a room in a castle they no longer live in
    for (const r of up) if (r.roomOwners.length && sim) r.roomOwners = r.roomOwners.filter((id) => { const q = sim.byId.get(id); return q && q.alive !== false && sim.households[q.household - 1]?.home === b.id; });
    const floors = [ground, [], up.filter((r) => r.roomFloor === 2), up.filter((r) => r.roomFloor === 3), up.filter((r) => r.roomFloor === 4)];
    return { ground, up, floors, all: [...ground, ...up] };
  }
  const HIGH = new Set(['steward', 'chamberlain', 'lady-in-waiting', 'captain of the royal guard', 'master of horse', 'herald', 'jester', 'master cook', 'butler', 'spy', 'treasurer', 'falconer']);
  const CASTLE_FLOORS = 5;
  const SLEEPY2 = new Set(['sleep', 'sick']);
  // where in the castle someone is right now: a hallway ('f0', 'f1') or a room's key
  function castleWhere(q, b, sim) {
    const act = q.activity?.act, role = q.job?.role || '', plan = castlePlan(b, sim);
    const mine = plan.up.find((r) => r.roomOwners.includes(q.id));
    if (act === 'court' || act === 'petition') return 'throne';
    if (act === 'feast') return 'f1';
    if (act === 'court' || act === 'work') { /* below */ }
    if (act === 'worship' || (act === 'work' && ['priest', 'chaplain'].includes(role))) return 'chapel';
    if (act === 'jailed') return 'guardroom';
    if (SLEEPY2.has(act)) return mine ? mine.roomKey : 'hall';
    if (act === 'work') {
      if (['cook', 'scullion', 'kitchen maid', 'baker', 'butler'].includes(role)) return 'kitchen';
      if (['steward', 'chamberlain', 'clerk', 'scribe', 'treasurer', 'magistrate'].includes(role)) return 'steward';
      if (/guard|sergeant|knight|captain/.test(role)) return 'f' + (q.id % CASTLE_FLOORS); // a guard on every floor
      if (['jester', 'page', 'herald', 'lady-in-waiting', 'minstrel', 'bard'].includes(role)) return 'throne';
      if (['maid', 'chambermaid'].includes(role)) return ['f2', 'f3', 'f4', 'hall'][q.id % 4];
      return 'hall';
    }
    if (act === 'eat') return q.royal && mine ? mine.roomKey : 'hall';
    if (act === 'home') return mine && (q.royal || (q.id + Math.floor((sim.minute || 0) / 90)) % 3) ? mine.roomKey : q.royal ? 'f4' : 'hall';
    return 'f0';
  }
  // going from one room to another, people cross the hallway: for a little while after they leave a room
  // they're out in the hall of that floor (so you can follow them out and see them go)
  const lastWhere = new Map();
  function castleWhereTransit(q, b, sim) {
    const key = castleWhere(q, b, sim), t = O.game ? O.game.t : 0, prev = lastWhere.get(q.id);
    if (!prev || prev.key === key) { if (!prev || !prev.transit || t > prev.transit.until) lastWhere.set(q.id, { key }); else return prev.transit.hall; return key; }
    if (prev.transit && t <= prev.transit.until) { prev.key = key; return prev.transit.hall; }
    const from = /^f\d$/.test(prev.key) ? null : castlePlan(b, sim).all.find((r) => r.roomKey === prev.key);
    if (from && key !== 'f' + (from.roomFloor || 0)) { lastWhere.set(q.id, { key, transit: { hall: 'f' + (from.roomFloor || 0), until: t + 10 } }); return 'f' + (from.roomFloor || 0); }
    lastWhere.set(q.id, { key }); return key;
  }
  O.Castle = { plan: castlePlan, where: castleWhereTransit };

  function layoutFor(b, floor, sim) {
    const S = scaleFor(b), rng = O.RNG(O.hash('int', b.id, floor, b.roomKey || ''));
    let w = b.w * S, d = b.d * S;
    let castleDoors = null;
    if (b.royal) { const pl = castlePlan(b, sim), n = (pl.floors[floor] || []).length, m = floor === 1 ? 0 : Math.ceil(n / 2); w = floor === 1 ? 30 : Math.max(24, m * 4 + 12); d = 10; castleDoors = pl.floors[floor] || []; } // a hallway, doors along both walls
    const grid = new Uint8Array(w * d);
    const items = [];
    const L = { carpets: null }; // carpets fitted to the floor, if any
    const dc = floor === 0 ? (b.royal ? Math.floor(w / 2) - 1 : Math.min(w - 2, b.spec.doorTile * S + Math.floor((S - 2) / 2))) : -1; // the doorway is two tiles wide
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
      return got >= open - 4; // a stray corner tile or two, never a room
    };
    const put = (kind, x, y, o = {}) => {
      if (b.removedFurn && floor === (o._floor ?? floor) && b.removedFurn.includes(floor + ':' + kind + '@' + x + ',' + y)) return null; // taken up by the owner
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
    const people = b.parent ? (b.roomOwners || []).map((id) => sim && sim.byId.get(id)).filter((p) => p && p.alive !== false) : sim ? hhs.flatMap((h) => h.members.map((id) => sim.byId.get(id)).filter((p) => p && p.alive !== false)) : [];
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
    // the grand stairs: up at one end, down at the other, turning back on each floor
    const castleUp = (k) => (k % 2 ? 1 : w - 4);
    if (b.royal) { if (floor > 0) stairPiece(castleUp(floor - 1), false); if (floor < CASTLE_FLOORS - 1) stairPiece(castleUp(floor), true); }
    else if (twoFloors) {
      if (floor > 0) stairPiece(cornerOf(floor - 1), false);
      if (floor < nFloors - 1 && (nFloors > 2)) stairPiece(cornerOf(floor), true);
      else if (floor === 0) stairPiece(stairsX, true);
    }
    startTiles = floor === 0 ? [[dc, d - 1], [dc + 1, d - 1]] : b.royal ? [[castleUp(floor - 1), 3], [castleUp(floor - 1) + 1, 3]] : [[cornerOf(floor - 1), 3], [cornerOf(floor - 1) + 1, 3]];

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
      if (!lives && !(plan && plan.length && plan.every((k) => k === 'bed') && b.type === 'tavern')) return 0; // nobody sleeps here: no beds
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
      if (fp) { tryPut('woodpile', [[fp.tx - 1, 0], [fp.tx + 3, 0], [fp.tx - 1, 1], [fp.tx + 3, 1]]); tryPut('cauldron', [[fp.tx + 3, 1], [fp.tx - 1, 1], [fp.tx + 3, 0], [fp.tx - 1, 0]], { work: ['cook'] }); } // the pot only ever by the fire
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
      const list = castleDoors || [];
      // doors along the back wall and the near wall, a candle beside each, kept clear of the stairs and the way in
      const slots = []; for (let x = 5; x + 2 <= w - 5; x += 4) slots.push(x);
      const back = slots.slice(), front = slots.filter((x) => floor !== 0 || Math.abs(x + 1 - (dc + 1)) > 3);
      const nb = Math.min(back.length, Math.max(Math.ceil(list.length / 2), list.length - front.length));
      L.carpets = [{ x: 0, y: 3, w: w, h: floor === 1 ? 2 : 4 }];
      list.forEach((r, i) => {
        const o = { room: r.roomKey, locked: r.locked || null, noAccess: true, label: r.name };
        if (i < nb) { const x = back[i]; put('roomdoor', x, 0, Object.assign(o, { v: 0 })); put('candlestand', x + 2, 0, {}); L.carpets.push({ x, y: 1, w: 2, h: 2 }); }
        else { const x = front[i - nb]; if (x == null) return; put('roomdoor', x, d - 1, Object.assign(o, { v: 2, front: true })); L.carpets.push({ x, y: 7, w: 2, h: d - 8 }); }
      });
      if (floor === 0) L.carpets.push({ x: dc, y: 7, w: 2, h: d - 7 });
      if (floor === 1) {
        // the long table where the council of the realm sits, chairs all round, on a great carpet
        const n = 3, tx = Math.floor(w / 2) - Math.floor(n * 5 / 2);
        L.carpets = [{ x: tx - 3, y: 1, w: n * 5 + 5, h: 7 }, { x: 0, y: 8, w: w, h: 2 }];
        for (let k = 0; k < n; k++) put('longtable', tx + k * 5, 3, { v: 2, table: true, council: true });
        for (let x = tx; x < tx + n * 5; x++) { put('chair', x, 2, { seat: true, rot: 0, v: 2, noAccess: true }); put('chair', x, 5, { seat: true, rot: 3, v: 2, noAccess: true }); }
        put('chair', tx - 1, 3, { seat: true, rot: 2, v: 2, noAccess: true, head: true });
        for (const x of [4, w - 6]) put('candlestand', x, 0, {});
      }
    }
    // the castle's rooms, each laid out as a place of its own
    function castleRoom() {
      switch (b.type) {
        case 'throneroom': {
          const hc = Math.floor(w / 2) - 1; put('throne', hc, 1, { v: 2, lord: true, seat: true, rot: 0 }); // facing down the hall
          L.carpets = [{ x: hc - 1, y: 3, w: 4, h: d - 3 }, { x: hc - 3, y: 0, w: 8, h: 4 }]; // the aisle up to the throne, and the dais
          for (const x of [2, w - 3]) for (let y = 2; y < d - 2; y += 4) tryPut('candlestand', [[x, y]], {});
          tryPut('bench', [[1, d - 3], [1, d - 5]], { seat: true, width: 3, rot: 0 }); tryPut('bench', [[w - 4, d - 3], [w - 4, d - 5]], { seat: true, width: 3, rot: 0 });
          tryPut('fireplace', [[2, 0], [w - 5, 0]], { v: 2 });
          break;
        }
        case 'castlekitchen':
          tryPut('fireplace', [[1, 0]], { v: 1 }); tryPut('oven', backWall(3), { work: ['cook', 'baker'] }); tryPut('cauldron', [[4, 1], [5, 1]], { work: ['cook'] });
          tryPut('doughtable', nearWalls(3, 1), { work: ['cook', 'baker'] }); tryPut('butcherblock', nearWalls(3, 1), { work: ['cook', 'scullion'] }); tryPut('washtub', nearWalls(), { work: ['scullion'] });
          tryPut('longtable', centre(5, 2), { v: 1, table: true }); for (let i = 0; i < 4; i++) tryPut(rng.pick(['barrel', 'sack', 'crate']), nearWalls(), { pantry: true });
          tryPut('dresser', backWall(2, true), { v: 1, pantry: true });
          break;
        case 'servhall':
          tryPut('fireplace', backWall(3), { v: 1 }); dining(10, {}); dining(6, {}); tryPut('bench', nearWalls(3, 1), { seat: true, width: 3 }); tryPut('barrel', nearWalls(), { stockOf: 'ale' }); tryPut('candlestand', nearWalls());
          break;
        case 'stewardroom':
          tryPut('desk', backWall(2), { v: 2, work: ['steward', 'chamberlain'] }); tryPut('desk', nearWalls(2, 1), { v: 1, work: ['clerk', 'scribe', 'treasurer'] });
          tryPut('bookcase', backWall(2, true), { v: 2 }); tryPut('bookcase', backWall(2, true), { v: 2 }); tryPut('chest', nearWalls(2, 1), { v: 2, valuables: true, container: { slots: 18 } }); tryPut('candlestand', nearWalls());
          break;
        case 'guardroom':
          tryPut('rack', backWall(2, true)); tryPut('rack', backWall(2, true)); tryPut('rack', backWall(2, true)); dining(4, {}); tryPut('barrel', nearWalls()); tryPut('chest', nearWalls(2, 1), { evidence: true });
          tryPut('cell', [[w - 5, d - 5], ...nearWalls(4, 4)], { cell: true });
          break;
        case 'castlechapel': {
          const mid = Math.floor(w / 2); put('altar', mid - 2, 0, { v: 2, work: ['priest'], candles: true });
          for (let y = 3; y < d - 2; y += 2) { put('pew', 1, y, { pew: true, width: Math.max(3, mid - 3), seats: 3 }); put('pew', mid + 2, y, { pew: true, width: Math.max(3, w - mid - 3), seats: 3 }); }
          tryPut('candlestand', [[mid - 4, 0]]); tryPut('candlestand', [[mid + 3, 0]]);
          break;
        }
        case 'chamber': default: {
          // like a house of their own: their beds, a chest and a wardrobe, a table, a candle, and for the royal rooms a fire and a rug
          if (people.length) beds(); else tryPut('double', backWall(3, true), { v: 2, bed: true, slots: 2 }); // the guest chamber's great bed
          tryPut('wardrobe', backWall(2, true), { v: wv }); tryPut('chest', nearWalls(2, 1), { v: wv, valuables: !!b.royalRoom, container: { slots: b.royalRoom ? 18 : 10 } });
          if (b.royalRoom) { tryPut('fireplace', backWall(3), { v: 2 }); put('rug', Math.floor(w / 2) - 2, Math.floor(d / 2), { flat: true, width: 4, rot: 4, v: 3 }); tryPut('desk', nearWalls(2, 1), { v: 2 }); }
          dining(Math.max(2, people.length), {}); tryPut('candlestand', nearWalls());
          break;
        }
      }
    }
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

    // pieces the owner has set down themselves come first, where they put them
    for (const f of (b.extraFurn || [])) if (f.floor === floor) put(f.kind, f.tx, f.ty, Object.assign({ owned: true, rot: f.rot || 0 }, f.kind === 'chair' || f.kind === 'stool' || f.kind === 'bench' ? { seat: true } : {}, ['bed', 'double', 'cradle'].includes(f.kind) ? { bed: true, slots: f.kind === 'double' ? 2 : 1 } : {}, ['table', 'longtable'].includes(f.kind) ? { table: true } : {}, f.kind === 'counter' || f.kind === 'bar' ? { counter: true } : {}));
    if (b.parent) castleRoom(); else if (b.royal) royal(); else if (b.manor) manor(); else switch (b.type) {
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
          for (const at of tz) dining(6, { at: [at] }); // a chair at every place round each table
          // the cook's pot hangs by the hearth, not out on the floor
          { const fp = items.find((i) => i.kind === 'fireplace'); if (fp) tryPut('cauldron', [[fp.tx + 3, 0], [fp.tx - 1, 0], [fp.tx + 3, 1], [fp.tx - 1, 1]], { work: ['cook'] }); }
          tryPut('woodpile', nearWalls());
        } else {
          // guest rooms: beds along the walls, a chest for the lodgers, the landlord's family
          // guest beds along the back wall, heads to the wall; the family's own beds after
          for (let i = 0; i < 6; i++) tryPut('bed', backWall(2, true), { bed: true, slots: 1, v: 1, rent: true });
          tryPut('chest', nearWalls(2, 1), { valuables: true, rentChest: true });
          if (lives) beds();
          tryPut('candlestand', nearWalls());
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
        break;
      }
      case 'gaol': {
        // a row of cells along the back, the gaoler's desk by the door, the keys on the rack, bread in a sack
        for (let i = 0; i < 3; i++) tryPut('cell', backWall(4, true), { cell: true });
        tryPut('desk', [...nearWalls(2, 1)], { work: ['gaoler', 'turnkey'] });
        tryPut('rack', nearWalls(2, 1)); tryPut('bench', nearWalls(3, 1), { seat: true });
        tryPut('sack', nearWalls(), { stockOf: 'bread' }); tryPut('barrel', nearWalls()); tryPut('chest', nearWalls(2, 1), { valuables: true, evidence: true });
        tryPut('candlestand', nearWalls());
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
          if (floor === 1 || people.length > 8) beds(); tryPut('wardrobe', backWall(2, true), { v: 2 }); tryPut('chest', nearWalls(2, 1), { v: 2, valuables: true, container: { slots: 18 } });
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
      default: {
        // any other trade: its equipment set out round the walls (the counter at the front), its goods on shelves
        const def = O.Data.BUSINESS[b.type];
        if (def && def.equip && floor === 0) {
          const roles = def.jobs.map((j) => j[0]);
          def.equip.forEach((k, i) => {
            const [fw, fh] = SIZE[k] || [1, 1], who = { work: i === 0 ? roles : roles.slice(Math.min(i, roles.length - 1)) };
            if (k === 'counter') counterAtFront({ work: [roles[0]] });
            else if (k === 'chair') tryPut('chair', nearWalls(), { seat: true, rot: 0, work: roles });
            else tryPut(k, [...backWall(fw), ...nearWalls(fw, fh)], Object.assign(who, ['kiln', 'oven', 'forge'].includes(k) ? { fire: true } : {}));
          });
          const goods = def.sells.filter((g) => !g.startsWith('fx_')).slice(0, 3);
          if (goods.length) shelf(goods, { stockGood: goods[0] });
          const ins = Object.keys(def.buys || {});
          for (let i = 0; i < 2; i++) tryPut(rng.pick(['crate', 'sack', 'barrel']), nearWalls(), { stockOf: ins[i % Math.max(1, ins.length)] });
        }
        storage(); familyQuarters();
      }
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
    return { b, floor, w, d, items, grid, floors: b.floors, dc, scale: S, reachable: reach(), stairsX, carpets: L.carpets };
  }

  // Cached interior per building/floor (furniture is fixed; stock visuals update live).
  const cache = new Map();
  // keyed by the building itself, not its number: building numbers repeat from town to town
  // (a WeakMap, not a field on the building: saved buildings must not bring an old number back after a reload)
  let iidN = 0; const iids = new WeakMap(); const iid = (b) => { let k = iids.get(b); if (!k) { k = ++iidN; iids.set(b, k); } return k; };
  // whether anyone lives there now: a house that's emptied (or filled) is laid out again
  const occupied = (b, sim) => sim ? (b.households || (b.household ? [b.household] : [])).some((id) => { const h = sim.households[id - 1]; return h && !h.gone && h.home === b.id && h.members.length; }) : 1;
  function interior(b, floor, sim) {
    const key = iid(b) + ':' + floor + ':' + (occupied(b, sim) ? 1 : 0);
    if (cache.has(key)) return cache.get(key);
    const L = layoutFor(b, floor, sim);
    const wallKind = (b.decor && b.decor.wall) || (b.spec.wall === 'stone' || b.spec.wall === 'log' || b.spec.wall === 'plank' ? b.spec.wall : 'timber');
    const floorKind = (b.decor && b.decor.floor) || ['smithy', 'chapel', 'guard', 'mill', 'quarry', 'mine', 'armourer', 'warehouse', 'townhall', 'keep', 'hospital', 'manor', 'throneroom', 'castlekitchen', 'guardroom', 'castlechapel', 'stewardroom', 'servhall'].includes(b.type) ? 'stone' : b.type === 'barn' || (b.type === 'house' && b.wealth < 0.3) ? 'dirt' : 'wood';
    L.room = O.Furn.room({ w: L.w, d: L.d, wall: wallKind, floor: floorKind, wealth: b.wealth, seed: b.id * 3 + floor, windows: Math.max(1, Math.floor(b.w / 2) + 1), doorTile: floor === 0 ? L.dc : -5, carpets: L.carpets });
    cache.set(key, L);
    return L;
  }

  O.Interior = { interior, layoutFor, FOOT, foot, invalidate: (b) => { for (const k of [...cache.keys()]) if (k.startsWith(iid(b) + ':')) cache.delete(k); } };
})();
