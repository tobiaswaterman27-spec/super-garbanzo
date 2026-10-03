// Material raster: shapes are rasterised into a buffer of (material, shade, group, order)
// rather than straight to RGBA. A final pass then resolves:
//   - lighting from per-pixel normals (quantised into the material's ramp)
//   - ambient occlusion where a part in front touches a part behind (reads as depth)
//   - a 1px selective outline around the silhouette, tinted from the neighbouring material
// Everything is sampled at pixel centres, so the output is crisp with no anti-aliasing.
'use strict';
(function () {
  // Light comes from the upper-left, slightly toward the viewer — shared by characters and world.
  const L = (() => { const v = [-0.5, -0.62, 0.6]; const m = Math.hypot(...v); return v.map((c) => c / m); })();

  function shadeFromNormal(nx, ny, nz, kind) {
    const lam = nx * L[0] + ny * L[1] + nz * L[2];
    let s;
    if (kind === 'metal') s = lam > 0.9 ? 4 : lam > 0.66 ? 3 : lam > 0.35 ? 2 : 1;
    else if (kind === 'skin') s = lam > 0.97 ? 4 : lam > 0.6 ? 3 : lam > 0.22 ? 2 : 1;
    else s = lam > 0.95 ? 4 : lam > 0.66 ? 3 : lam > 0.28 ? 2 : 1;
    return s;
  }

  class MatBuffer {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.mat = new Int16Array(w * h).fill(-1);
      this.shade = new Int8Array(w * h);
      this.group = new Int8Array(w * h);
      this.order = new Int16Array(w * h);
      this.noOutline = new Uint8Array(w * h);
      this.flat = new Uint8Array(w * h); // pixels that never receive AO (face details etc.)
      this.curOrder = 0; this.curGroup = 0;
      this.mirror = false; // when true, x is mirrored at plot time (for left-facing poses)
    }
    part(group) { this.curGroup = group; this.curOrder++; return this; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    plot(x, y, m, s, flat = 0) {
      x = Math.floor(x); y = Math.floor(y);
      if (this.mirror) x = this.w - 1 - x;
      if (!this.inb(x, y) || m < 0) return;
      const i = y * this.w + x;
      this.mat[i] = m; this.shade[i] = s; this.group[i] = this.curGroup; this.order[i] = this.curOrder; this.flat[i] = flat;
    }
    get(x, y) { if (this.mirror) x = this.w - 1 - x; return this.inb(x, y) ? this.mat[y * this.w + x] : -1; }
    clear(x, y) { if (this.mirror) x = this.w - 1 - x; if (this.inb(x, y)) this.mat[y * this.w + x] = -1; }
    // Darken/lighten an already painted pixel (folds, seams, creases).
    tweak(x, y, d) {
      if (this.mirror) x = this.w - 1 - x;
      if (!this.inb(x, y)) return; const i = y * this.w + x;
      if (this.mat[i] < 0) return; this.shade[i] = O.clamp(this.shade[i] + d, 0, 4);
    }

    // Capsule between a and b with radius r (r may taper ra->rb). matFn(u, side) chooses material per
    // position along the limb (u 0..1), so a sleeve can end exactly at the wrist and boots can start
    // mid-shin; the same limb geometry is used for skin and clothes so they can never mis-cover.
    capsule(ax, ay, bx, by, ra, rb, matFn, opts = {}) {
      const minx = Math.floor(Math.min(ax, bx) - Math.max(ra, rb) - 1), maxx = Math.ceil(Math.max(ax, bx) + Math.max(ra, rb) + 1);
      const miny = Math.floor(Math.min(ay, by) - Math.max(ra, rb) - 1), maxy = Math.ceil(Math.max(ay, by) + Math.max(ra, rb) + 1);
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1e-6;
      const bias = opts.shadeBias || 0;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5;
        let u = ((px - ax) * dx + (py - ay) * dy) / len2; u = O.clamp(u, 0, 1);
        const cx = ax + dx * u, cy = ay + dy * u, ox = px - cx, oy = py - cy;
        const r = ra + (rb - ra) * u, d = Math.hypot(ox, oy);
        if (d > r) continue;
        const m = typeof matFn === 'function' ? matFn(u) : matFn;
        if (m == null || m < 0) continue;
        const dn = d / (r || 1), nx = d ? (ox / d) * dn : 0, ny = d ? (oy / d) * dn : 0, nz = Math.sqrt(Math.max(0, 1 - dn * dn));
        const kind = O.Pal.mats[m].kind;
        this.plot(x, y, m, O.clamp(shadeFromNormal(nx, ny, nz, kind) + bias, 0, 4));
      }
    }

    // Generic filled shape: inside(px,py) -> bool, normal(px,py) -> [nx,ny,nz], matFn(px,py) -> mat id.
    shape(x0, y0, x1, y1, inside, normal, matFn, opts = {}) {
      const bias = opts.shadeBias || 0;
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const px = x + 0.5, py = y + 0.5;
        if (!inside(px, py)) continue;
        const m = typeof matFn === 'function' ? matFn(px, py) : matFn;
        if (m == null || m < 0) continue;
        const [nx, ny, nz] = normal(px, py);
        const kind = O.Pal.mats[m].kind;
        let s = shadeFromNormal(nx, ny, nz, kind) + bias;
        if (opts.maxShade != null) s = Math.min(s, opts.maxShade);
        this.plot(x, y, m, O.clamp(s, 0, 4));
      }
    }

    // Superellipse (rounded box) with spherical-ish normals. jaw narrows the lower half (heads).
    blob(cx, cy, rx, ry, matFn, opts = {}) {
      const p = opts.power || 2.2, jaw = opts.jaw || 0, flatTop = opts.flatTop || 0;
      const inside = (px, py) => {
        let ex = rx; const ty = (py - cy) / ry;
        if (ty > 0) ex = rx * (1 - jaw * ty * ty);
        if (ty < 0 && flatTop) ex = rx * (1 + flatTop * ty * ty * 0.3);
        const nx = Math.abs((px - cx) / ex), ny = Math.abs(ty);
        return Math.pow(nx, p) + Math.pow(ny, p) <= 1;
      };
      const normal = (px, py) => {
        const nx = (px - cx) / (rx + 0.5), ny = (py - cy) / (ry + 0.5);
        const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        return [nx, ny, Math.max(z, 0.15)];
      };
      this.shape(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, inside, normal, matFn, opts);
    }

    // Trapezoid body piece (torso, skirt): top width wt, bottom width wb, cylindrical shading.
    trap(cx, y0, y1, wt, wb, matFn, opts = {}) {
      const round = opts.round || 0;
      const halfAt = (py) => { const t = O.clamp((py - y0) / (y1 - y0), 0, 1); return (wt + (wb - wt) * t) / 2; };
      const inside = (px, py) => {
        if (py < y0 || py > y1) return false;
        const hw = halfAt(py), dx = Math.abs(px - cx);
        if (dx > hw) return false;
        if (round) { // round top corners
          const cyTop = y0 + round, cxIn = hw - round;
          if (py < cyTop && dx > cxIn) return Math.hypot(dx - cxIn, py - cyTop) <= round;
        }
        return true;
      };
      const tilt = opts.tilt || 0; // shifts the shading centre (side views)
      const normal = (px, py) => {
        const hw = halfAt(py);
        const nx = O.clamp((px - cx - tilt) / (hw + 0.6), -1, 1);
        const ny = -0.25 + ((py - y0) / (y1 - y0)) * 0.45;
        return [nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny * 0.5))];
      };
      this.shape(cx - Math.max(wt, wb) / 2 - 1, y0, cx + Math.max(wt, wb) / 2 + 1, y1, inside, normal, matFn, opts);
    }

    // Filled polygon with a constant normal (roof planes, gables, flat panels).
    poly(pts, nrm, matFn, opts = {}) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const inside = (px, py) => {
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      const n = typeof nrm === 'function' ? nrm : () => nrm;
      this.shape(x0 - 1, y0 - 1, x1 + 1, y1 + 1, inside, n, matFn, opts);
    }
    rect(x, y, w, h, m, s) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.plot(xx, yy, m, s); }
    // Set shade explicitly on painted pixels inside a rect (patterned textures).
    shadeAt(x, y, s) { if (this.mirror) x = this.w - 1 - x; if (!this.inb(x, y)) return; const i = y * this.w + x; if (this.mat[i] >= 0) this.shade[i] = O.clamp(s, 0, 4); }
    matAt(x, y) { return this.inb(x, y) ? this.mat[y * this.w + x] : -1; }

    // Resolve to RGBA ImageData-compatible pixel array.
    resolve(opts = {}) {
      const { w, h, mat, shade, group, order } = this;
      const out = new Uint8ClampedArray(w * h * 4);
      const pal = O.Pal.mats;
      const ao = opts.ao !== false;
      const sh = new Int8Array(shade);
      if (ao) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = y * w + x; if (mat[i] < 0 || this.flat[i]) continue;
          // front part neighbouring a back part of a different group casts a 1px contact shadow
          const nb = [[0, -1], [-1, 0], [1, 0], [0, 1]];
          for (const [ddx, ddy] of nb) {
            const nx = x + ddx, ny = y + ddy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx; if (mat[j] < 0) continue;
            if (group[j] !== group[i] && order[j] > order[i] && group[j] !== 0) { sh[i] = Math.max(0, sh[i] - 1); break; }
          }
        }
      }
      for (let i = 0; i < w * h; i++) {
        if (mat[i] < 0) continue; const c = pal[mat[i]][sh[i]];
        out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
      }
      if (opts.outline !== false) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = y * w + x; if (mat[i] >= 0) continue;
          // pick the neighbour material; below-neighbour (top edge of a shape) gets the lit outline
          let m = -1, lit = false;
          const up = y > 0 ? mat[i - w] : -1, dn = y < h - 1 ? mat[i + w] : -1;
          const lf = x > 0 ? mat[i - 1] : -1, rt = x < w - 1 ? mat[i + 1] : -1;
          if (up >= 0) m = up; else if (rt >= 0) { m = rt; lit = true; } else if (lf >= 0) m = lf; else if (dn >= 0) { m = dn; lit = true; }
          if (m < 0) continue;
          if (this.noOutline[up >= 0 ? i - w : rt >= 0 ? i + 1 : lf >= 0 ? i - 1 : i + w]) continue;
          const c = lit ? pal[m].outlineLit : pal[m].outline;
          out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
        }
      }
      return out;
    }

    toCanvas(opts) {
      const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(this.w, this.h); img.data.set(this.resolve(opts));
      ctx.putImageData(img, 0, 0);
      return c;
    }
  }

  O.MatBuffer = MatBuffer;
  O.shadeFromNormal = shadeFromNormal;
  O.LIGHT = L;
})();
