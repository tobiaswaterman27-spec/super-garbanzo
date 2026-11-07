// Every place keeps beasts, not only home. The first time you come to a town, village, castle or
// hamlet its farmyards fill: hens and a pig or two by each farmhouse, sheep and cows on the grass
// beyond, goats at a cottage, a dog or a cat at the better houses. They graze and wander, are driven
// into the barn at night and out in the morning (the same as at home), and can be milked and fed.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const seeded = new Set();
    function stock(s) {
      const w = s.world, id = w.placeId; if (!id || seeded.has(id)) return; seeded.add(id);
      O.fauna = O.fauna || []; if (O.fauna.some((f) => f.world === id)) return;
      const r = O.RNG(O.hash('pasture', id)), fauna = O.fauna;
      const open = (x, y) => x > 1 && y > 1 && x < w.W - 2 && y < w.H - 2 && !w.solid[y * w.W + x] && (!w.ter || !w.TER || (w.ter[y * w.W + x] !== w.TER.WATER && w.ter[y * w.W + x] !== w.TER.ROAD));
      const add = (kind, n, z) => { for (let i = 0; i < n; i++) { let x = 0, y = 0, k = 0; do { x = r.int(z.x0, z.x1); y = r.int(z.y0, z.y1); } while (!open(x, y) && k++ < 20); if (!open(x, y)) continue; fauna.push({ world: id, kind, seed: r.int(1, 9999), z, x: x * T + 8, y: y * T + 12, dir: r.int(0, 7), ft: r.next() * 2, tx: null, wait: r.next() * 4, speed: kind === 'chicken' ? 14 : kind === 'cow' ? 8 : 11 }); } };
      const zoneAt = (cx, cy, rx, ry) => ({ x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry });
      const freeArea = (cx, cy, need) => { for (let rr = 3; rr < 14; rr += 2) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr); let ok = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (open(x + dx, y + dy)) ok++; if (ok >= need) return [x, y]; } return null; };
      const farms = w.buildings.filter((b) => (b.type === 'farmhouse' || b.type === 'barn') && b.doorX != null).slice(0, 4);
      for (const b of farms) { const yard = freeArea(b.doorX, b.doorY + 2, 18); if (yard) { add('chicken', 4 + r.int(0, 3), zoneAt(yard[0], yard[1], 3, 2)); if (r.chance(0.7)) add('pig', 1 + r.int(0, 1), zoneAt(yard[0], yard[1], 2, 1)); }
        const fld = freeArea(b.doorX + (r.chance(0.5) ? 8 : -8), b.doorY + 6, 30); if (fld) { add('sheep', 3 + r.int(0, 4), zoneAt(fld[0], fld[1], 4, 2)); if (r.chance(0.6)) add('cow', 1 + r.int(0, 2), zoneAt(fld[0], fld[1], 4, 2)); } }
      if (!farms.length) { const sq = s.Z && s.Z.square; if (sq) { const yard = freeArea(sq[2] + 8, sq[3] + 6, 20); if (yard) { add('chicken', 5, zoneAt(yard[0], yard[1], 3, 2)); add('goat', 2, zoneAt(yard[0], yard[1], 3, 2)); } } }
      const houses = w.buildings.filter((b) => b.type === 'house' && b.doorX != null);
      for (const b of houses.filter((x) => x.wealth > 0.45).slice(0, 4)) add(r.chance(0.6) ? 'dog' : 'cat', 1, { x0: b.x - 1, y0: b.bottom + 1, x1: b.x + b.w, y1: b.bottom + 2 });
      for (const b of houses.filter((x) => x.wealth <= 0.45).slice(0, 2)) add('goat', 1, { x0: b.x - 1, y0: b.bottom + 1, x1: b.x + b.w, y1: b.bottom + 2 });
    }
    game.hooks.update.push(() => { const s = cur(); if (s && s.world && !game.scene) stock(s); });
    O.Pastures = { stock: () => stock(cur()), seeded };
  }
  O.PasturesSetup = { setup };
})();
