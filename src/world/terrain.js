// Ground renderer: turns the terrain tile map into one pixel-art canvas.
// Tile borders are sampled through a noise warp so roads, fields and banks meet with organic,
// hand-drawn-looking edges while staying 1px crisp. Static shadows are baked in as one mask so
// overlapping shadows never stack darker.
'use strict';
(function () {
  const P = O.Pal;
  function renderGround(world, season = 'summer') {
    const { W, H, T, ter, TER } = world;
    const pw = W * T, ph = H * T;
    const c = document.createElement('canvas'); c.width = pw; c.height = ph;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(pw, ph); const d = img.data;
    const grassHex = { summer: '#5d8a3e', spring: '#679a42', autumn: '#7a8a42', winter: '#dfe6ea' }[season];
    const R = {
      grass: P.makeRamp(grassHex, 0.75), forest: P.makeRamp(season === 'winter' ? '#cfd8de' : '#466e36', 0.75), road: P.makeRamp('#9a7a52', 0.8),
      cobble: P.makeRamp('#8e8a84', 1.0), field: P.makeRamp('#6e4e32', 0.9), water: P.makeRamp('#3f6f9a', 0.8), sand: P.makeRamp('#c8b07a', 0.7),
      yard: P.makeRamp('#a08a62', 0.75), plank: P.makeRamp('#8a6239', 1),
    };
    const tAt = (x, y) => { x = O.clamp(x, 0, W - 1); y = O.clamp(y, 0, H - 1); return ter[y * W + x]; };
    const sample = (px, py) => {
      const base = tAt(Math.floor(px / T), Math.floor(py / T));
      if (base === TER.BRIDGE) return base;
      const wet = base === TER.WATER || base === TER.SAND;
      const amp = wet ? 13 : 7, per = wet ? 16 : 7;
      const wx = px + (O.noise2(px / per, py / per, 41) - 0.5) * amp + (wet ? (O.noise2(px / 5, py / 5, 47) - 0.5) * 3 : 0), wy = py + (O.noise2(px / per, py / per, 43) - 0.5) * amp;
      const t = tAt(Math.floor(wx / T), Math.floor(wy / T));
      return t === TER.BRIDGE ? base : t;
    };
    const tmap = new Uint8Array(pw * ph);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) tmap[y * pw + x] = sample(x + 0.5, y + 0.5);
    const at = (x, y) => (x < 0 || y < 0 || x >= pw || y >= ph ? -1 : tmap[y * pw + x]);
    const LAND = new Set([TER.GRASS, TER.FOREST, TER.ROAD, TER.YARD, TER.FIELD, TER.SAND].filter((v) => v != null));
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const baseOf = (k) => (k === TER.GRASS ? R.grass : k === TER.FOREST ? R.forest : k === TER.ROAD ? R.road : k === TER.YARD ? R.yard : k === TER.FIELD ? R.field : R.sand)[2];

    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const t = tmap[y * pw + x];
      let col;
      const n = O.fbm(x / 10, y / 10, 7, 3), f = O.noise2(x * 1.9, y * 1.9, 3);
      switch (t) {
        case TER.GRASS: case TER.FOREST: {
          const r = t === TER.GRASS ? R.grass : R.forest;
          let s = n > 0.6 ? 3 : n > 0.42 ? 2 : 1;
          if (f > 0.9) s = Math.min(4, s + 1); else if (f < 0.07) s = Math.max(0, s - 1);
          // blade marks: short vertical light/dark pairs
          if (O.noise2(x * 3.3, y * 1.1, 9) > 0.9) s = 3;
          col = r[s]; break;
        }
        case TER.ROAD: case TER.YARD: {
          const r = t === TER.ROAD ? R.road : R.yard;
          let s = n > 0.58 ? 3 : n > 0.4 ? 2 : 1;
          if (f > 0.93) s = 4; else if (f < 0.05) s = 0;
          // wheel ruts along the King's Road
          if (t === TER.ROAD && y >= 30 * T && y < 32 * T) { const ly = y - 30 * T; if (ly === 9 || ly === 22) s = Math.max(0, s - 1); }
          // darker edge where road meets grass
          const g = (k) => k === TER.GRASS || k === TER.FOREST;
          if (g(at(x, y - 1)) || g(at(x - 1, y))) s = Math.max(0, s - 1);
          col = r[s]; break;
        }
        case TER.COBBLE: {
          const row = Math.floor(y / 5), off = row % 2 ? 3 : 0, cx = (x + off) % 6, cy = y % 5;
          const sid = O.noise2(Math.floor((x + off) / 6), row, 17);
          let s = sid > 0.6 ? 3 : sid > 0.3 ? 2 : 1;
          if (cx === 0 || cy === 0) s = 0; else if (cx === 1 || cy === 1) s = Math.min(4, s + 1); else if (cx === 5 || cy === 4) s = Math.max(1, s - 1);
          col = R.cobble[s]; break;
        }
        case TER.FIELD: {
          const r = y % 4; let s = r === 0 ? 3 : r === 3 ? 0 : 2; if (f > 0.9) s = 4; if (n < 0.35 && s === 2) s = 1;
          col = R.field[s]; break;
        }
        case TER.WATER: {
          // depth: how far to the nearest bank, sampled in rings; shallows are lighter and greener
          const land = (xx, yy) => { const k = at(xx, yy); return k !== TER.WATER && k !== -1 && k !== TER.BRIDGE; };
          let depth = 4;
          for (const [r, dd] of [[1, 0], [3, 1], [6, 2], [10, 3]]) { if (land(x - r, y) || land(x + r, y) || land(x, y - r) || land(x, y + r) || land(x - r, y - r) || land(x + r, y + r) || land(x - r, y + r) || land(x + r, y - r)) { depth = dd; break; } }
          const WC = [[214, 230, 228], [110, 168, 184], [74, 136, 172], [60, 112, 156], [48, 92, 138]];
          col = WC[depth].slice();
          // the waterline: broken foam, not a ruled line
          if (depth === 0) { if (BAYER[(x & 3) + ((y & 3) << 2)] < 9) col = [96, 152, 172]; }
          else {
            // gentle drifting ripples: short soft highlights and darker troughs scattered by noise
            const rip = O.noise2(x / 9, y / 2.6, 61), dot = O.noise2(x * 0.7, y * 0.7, 63);
            if (rip > 0.74) col = col.map((c, i) => Math.min(255, c + [18, 22, 22][i]));
            else if (rip < 0.2) col = col.map((c) => c - 10);
            if (dot > 0.94 && depth > 1) col = [196, 222, 236];
            const tint = (n - 0.5) * 10; col = col.map((c) => Math.round(c + tint));
          }
          break;
        }
        case TER.SAND: {
          let s = n > 0.55 ? 3 : 2; if (f > 0.9) s = 4; if (f < 0.1) s = 1;
          if ([at(x - 1, y), at(x + 1, y)].includes(TER.WATER)) s = 0; // wet edge
          col = R.sand[s]; break;
        }
        case TER.BRIDGE: {
          const tx = Math.floor(x / T), ty = Math.floor(y / T), top = tAt(tx, ty - 1) === TER.BRIDGE ? ty - 1 : ty; const lx = x % T, ly = y - top * T; let s = lx % 4 === 0 ? 0 : lx % 4 === 1 ? 3 : 2;
          if (ly < 3 || ly > 28) s = ly === 0 || ly === 31 ? 0 : ly < 3 ? 3 : 1; // rails
          if (O.noise2(x * 0.3, y * 2, 5) > 0.8 && s === 2) s = 1;
          col = R.plank[s]; break;
        }
        default: col = [255, 0, 255];
      }
      // soft edges: where one kind of ground meets another, the two mingle over a few pixels
      // (ordered dithering keeps it crisp)
      if (LAND.has(t)) {
        let nb = -1, k = 1;
        for (; k <= 3 && nb < 0; k++) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) { const u = at(x + dx, y + dy); if (u !== t && LAND.has(u)) { nb = u; break; } }
        if (nb >= 0) { const wgt = (4 - (k - 1)) / 9; if (BAYER[(x & 3) + ((y & 3) << 2)] / 16 < wgt) { const nc = baseOf(nb); col = [(col[0] + nc[0]) >> 1, (col[1] + nc[1]) >> 1, (col[2] + nc[2]) >> 1]; } }
      }
      const i = (y * pw + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    bakeShadows(ctx, world, pw, ph);
    return c;
  }

  // Light comes from the upper-left, so every static object casts toward the lower-right.
  function bakeShadows(ctx, world, pw, ph) {
    const m = document.createElement('canvas'); m.width = pw; m.height = ph;
    const mc = m.getContext('2d'); mc.fillStyle = '#000';
    const T = world.T;
    for (const b of world.buildings) {
      const s = 6 + b.floors * 6;
      const x0 = b.x * T, x1 = (b.x + b.w) * T, y0 = b.y * T, y1 = (b.bottom + 1) * T;
      mc.beginPath(); mc.moveTo(x1, y0 + 4); mc.lineTo(x1 + s, y0 + 4 + s * 0.5); mc.lineTo(x1 + s, y1 + 3); mc.lineTo(x0 + s, y1 + 3); mc.lineTo(x0, y1); mc.lineTo(x1, y1); mc.closePath(); mc.fill();
    }
    const ellipse = (cx, cy, rx, ry) => { for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry))); mc.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1); } };
    for (const t of world.trees) ellipse(t.x + 7, t.y - 2, t.kind === 'pine' ? 10 : 15, t.kind === 'pine' ? 4 : 6);
    for (const p of world.props) if (!p.flat && p.kind !== 'grass') ellipse(p.x + 3, p.y, p.kind === 'well' || p.kind === 'stall' ? 15 : 7, 3);
    // crisp mask -> single translucent layer
    const id = mc.getImageData(0, 0, pw, ph); for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > 100 ? 255 : 0; mc.putImageData(id, 0, 0);
    mc.globalCompositeOperation = 'source-in'; mc.fillStyle = 'rgb(28,20,44)'; mc.fillRect(0, 0, pw, ph);
    ctx.globalAlpha = 0.32; ctx.drawImage(m, 0, 0); ctx.globalAlpha = 1;
  }

  O.Terrain = { renderGround };
})();
