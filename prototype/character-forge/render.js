/* render.js — orthographic software rasteriser with a z-buffer.
 *
 * Characters are real 3D box models. We rotate them, project orthographically
 * into a tiny pixel buffer, quantise the lighting into a 3-step ramp and trace
 * a silhouette outline. That is what makes a character read correctly from any
 * angle without hand-drawing a sprite sheet per direction.
 */
(function (global) {
  'use strict';

  /* ---------- 4x4 row-major matrices ---------- */

  function identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        out[r * 4 + c] =
          a[r * 4] * b[c] +
          a[r * 4 + 1] * b[4 + c] +
          a[r * 4 + 2] * b[8 + c] +
          a[r * 4 + 3] * b[12 + c];
      }
    }
    return out;
  }

  function translation(x, y, z) {
    const m = identity();
    m[3] = x; m[7] = y; m[11] = z;
    return m;
  }

  function scaling(s) {
    const m = identity();
    m[0] = s; m[5] = s; m[10] = s;
    return m;
  }

  function rotationX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = identity();
    m[5] = c; m[6] = -s; m[9] = s; m[10] = c;
    return m;
  }

  function rotationY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = identity();
    m[0] = c; m[2] = s; m[8] = -s; m[10] = c;
    return m;
  }

  function rotationZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = identity();
    m[0] = c; m[1] = -s; m[4] = s; m[5] = c;
    return m;
  }

  function transformPoint(m, x, y, z, out) {
    out[0] = m[0] * x + m[1] * y + m[2] * z + m[3];
    out[1] = m[4] * x + m[5] * y + m[6] * z + m[7];
    out[2] = m[8] * x + m[9] * y + m[10] * z + m[11];
    return out;
  }

  function transformDirection(m, x, y, z, out) {
    out[0] = m[0] * x + m[1] * y + m[2] * z;
    out[1] = m[4] * x + m[5] * y + m[6] * z;
    out[2] = m[8] * x + m[9] * y + m[10] * z;
    const len = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= len; out[1] /= len; out[2] /= len;
    return out;
  }

  /* ---------- colour ---------- */

  // Buffers are Uint32 in little-endian 0xAABBGGRR order so they can be
  // handed straight to ImageData without a per-channel copy.
  function pack(r, g, b, a) {
    return ((a === undefined ? 255 : a) << 24 | b << 16 | g << 8 | r) >>> 0;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mixRgb(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  // Shadows drift toward cold slate rather than pure black; highlights drift
  // toward a warm bone.
  const SHADOW_TINT = [34, 40, 58];
  const LIGHT_TINT = [255, 248, 226];

  function scaleRgb(c, f) {
    return [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f)];
  }

  // Five steps, because four is not enough to keep every pair of *adjacent*
  // faces distinct. A box can show its top plus two perpendicular sides at
  // once; if any two of those land on the same step the form goes flat and the
  // model reads as a silhouette with no depth.
  function buildRamp(hex) {
    const base = hexToRgb(hex);
    const s2 = mixRgb(scaleRgb(base, 0.44), SHADOW_TINT, 0.34);
    const s1 = mixRgb(scaleRgb(base, 0.68), SHADOW_TINT, 0.2);
    const l1 = mixRgb(base, LIGHT_TINT, 0.17);
    const l2 = mixRgb(base, LIGHT_TINT, 0.35);
    return [
      pack(s2[0], s2[1], s2[2]),
      pack(s1[0], s1[1], s1[2]),
      pack(base[0], base[1], base[2]),
      pack(l1[0], l1[1], l1[2]),
      pack(l2[0], l2[1], l2[2])
    ];
  }

  const rampCache = new Map();
  function ramp(hex) {
    let r = rampCache.get(hex);
    if (!r) { r = buildRamp(hex); rampCache.set(hex, r); }
    return r;
  }

  /* ---------- render target ---------- */

  function createTarget(w, h) {
    return {
      w: w,
      h: h,
      colour: new Uint32Array(w * h),
      depth: new Float32Array(w * h)
    };
  }

  function clearTarget(t) {
    t.colour.fill(0);
    t.depth.fill(Infinity);
  }

  /* ---------- triangle rasteriser ---------- */

  function rasterTriangle(t, ax, ay, az, bx, by, bz, cx, cy, cz, colour) {
    let minX = Math.floor(Math.min(ax, bx, cx));
    let maxX = Math.ceil(Math.max(ax, bx, cx));
    let minY = Math.floor(Math.min(ay, by, cy));
    let maxY = Math.ceil(Math.max(ay, by, cy));
    if (minX < 0) minX = 0;
    if (minY < 0) minY = 0;
    if (maxX > t.w - 1) maxX = t.w - 1;
    if (maxY > t.h - 1) maxY = t.h - 1;
    if (minX > maxX || minY > maxY) return;

    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-7) return;
    const invDet = 1 / det;

    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      const row = y * t.w;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const l0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) * invDet;
        if (l0 < -0.0001) continue;
        const l1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) * invDet;
        if (l1 < -0.0001) continue;
        const l2 = 1 - l0 - l1;
        if (l2 < -0.0001) continue;

        const z = l0 * az + l1 * bz + l2 * cz;
        const i = row + x;
        if (z < t.depth[i]) {
          t.depth[i] = z;
          t.colour[i] = colour;
        }
      }
    }
  }

  /* ---------- scene rendering ---------- */

  // Light lives in view space so the key light stays on the character's
  // upper-left no matter which way they turn — a sprite-sheet convention.
  // Faces are shaded by which way they point on screen, not by a dot product
  // against a light vector. A plain lambert term gives perpendicular faces the
  // same value whenever they sit at equal angles to the light, which is what
  // was flattening the models; banding by orientation cannot do that.
  //
  //   4  top          3  angled toward the key light (screen-left)
  //   2  square on    1  angled away (screen-right)      0  underside
  function shadeLevel(nx, ny, nz) {
    if (ny > 0.5) return 4;
    if (ny < -0.4) return 0;
    const azimuth = Math.atan2(nx, nz);
    if (azimuth < -0.35) return 3;
    if (azimuth > 0.35) return 1;
    return 2;
  }

  let _sx = new Float32Array(512);
  let _sy = new Float32Array(512);
  let _sz = new Float32Array(512);

  function ensureScratch(n) {
    if (_sx.length >= n) return;
    let size = _sx.length;
    while (size < n) size *= 2;
    _sx = new Float32Array(size);
    _sy = new Float32Array(size);
    _sz = new Float32Array(size);
  }

  const _p = [0, 0, 0];
  const _n = [0, 0, 0];

  /* Draws one convex mesh. Vertices are projected once, then each face is
   * culled, shaded by orientation and fan-triangulated. */
  function drawMesh(target, matrix, mesh, colourRamp, camera, opts) {
    const verts = mesh.verts;
    const count = verts.length / 3;
    ensureScratch(count);

    for (let i = 0; i < count; i++) {
      transformPoint(matrix, verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2], _p);
      // world -> view: pitch the whole world forward so we look down on it
      const vy = _p[1] * camera.cosPitch - _p[2] * camera.sinPitch;
      const vz = _p[1] * camera.sinPitch + _p[2] * camera.cosPitch;
      _sx[i] = camera.ox + _p[0] * camera.scale;
      _sy[i] = camera.oy - vy * camera.scale;
      _sz[i] = -vz;
    }

    const flat = !!(opts && opts.flat);
    const bias = (opts && opts.depthBias) ? opts.depthBias : 0;
    const faces = mesh.faces;

    for (let f = 0; f < faces.length; f++) {
      const face = faces[f];
      transformDirection(matrix, face.n[0], face.n[1], face.n[2], _n);
      const ny = _n[1] * camera.cosPitch - _n[2] * camera.sinPitch;
      const nz = _n[1] * camera.sinPitch + _n[2] * camera.cosPitch;
      if (nz <= 0.015) continue; // facing away from the camera

      const colour = flat ? colourRamp[2] : colourRamp[shadeLevel(_n[0], ny, nz)];
      const idx = face.i;
      const i0 = idx[0];
      for (let k = 1; k < idx.length - 1; k++) {
        const i1 = idx[k], i2 = idx[k + 1];
        rasterTriangle(target,
          _sx[i0], _sy[i0], _sz[i0] - bias,
          _sx[i1], _sy[i1], _sz[i1] - bias,
          _sx[i2], _sy[i2], _sz[i2] - bias,
          colour);
      }
    }
  }

  /* ---------- silhouette outline ---------- */

  function traceOutline(target, colour) {
    const { w, h, colour: buf } = target;
    const additions = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (buf[i] !== 0) continue;
        let touching = false;
        if (x > 0 && buf[i - 1] !== 0) touching = true;
        else if (x < w - 1 && buf[i + 1] !== 0) touching = true;
        else if (y > 0 && buf[i - w] !== 0) touching = true;
        else if (y < h - 1 && buf[i + w] !== 0) touching = true;
        if (touching) additions.push(i);
      }
    }
    for (let k = 0; k < additions.length; k++) buf[additions[k]] = colour;
  }

  /* ---------- blitting ---------- */

  function blit(dest, src, dx, dy) {
    for (let y = 0; y < src.h; y++) {
      const ty = dy + y;
      if (ty < 0 || ty >= dest.h) continue;
      const srow = y * src.w;
      const trow = ty * dest.w;
      for (let x = 0; x < src.w; x++) {
        const tx = dx + x;
        if (tx < 0 || tx >= dest.w) continue;
        const c = src.colour[srow + x];
        if (c !== 0) dest.colour[trow + tx] = c;
      }
    }
  }

  function fillRect(target, x, y, w, h, colour) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(target.w, (x + w) | 0), y1 = Math.min(target.h, (y + h) | 0);
    for (let py = y0; py < y1; py++) {
      const row = py * target.w;
      for (let px = x0; px < x1; px++) target.colour[row + px] = colour;
    }
  }

  function strokeRect(target, x, y, w, h, colour) {
    fillRect(target, x, y, w, 1, colour);
    fillRect(target, x, y + h - 1, w, 1, colour);
    fillRect(target, x, y, 1, h, colour);
    fillRect(target, x + w - 1, y, 1, h, colour);
  }

  function fillEllipse(target, cx, cy, rx, ry, colour, alpha) {
    const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(target.w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(target.h - 1, Math.ceil(cy + ry));
    const cr = colour & 255, cg = (colour >> 8) & 255, cb = (colour >> 16) & 255;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const i = y * target.w + x;
        const d = target.colour[i];
        if (alpha === undefined || alpha >= 1) { target.colour[i] = colour; continue; }
        const dr = d & 255, dg = (d >> 8) & 255, db = (d >> 16) & 255;
        target.colour[i] = pack(
          Math.round(dr + (cr - dr) * alpha),
          Math.round(dg + (cg - dg) * alpha),
          Math.round(db + (cb - db) * alpha)
        );
      }
    }
  }

  /* ---------- presenting a target to a canvas ---------- */

  function createPresenter(canvas, w, h) {
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    const image = ctx.createImageData(w, h);
    const view = new Uint32Array(image.data.buffer);
    const staging = document.createElement('canvas');
    staging.width = w;
    staging.height = h;
    const sctx = staging.getContext('2d');
    sctx.imageSmoothingEnabled = false;

    return function present(target) {
      view.set(target.colour);
      sctx.putImageData(image, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(staging, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
    };
  }

  function makeCamera(pitch, scale, ox, oy) {
    return {
      pitch: pitch,
      cosPitch: Math.cos(pitch),
      sinPitch: Math.sin(pitch),
      scale: scale,
      ox: ox,
      oy: oy
    };
  }

  global.Render = {
    identity, multiply, translation, scaling, rotationX, rotationY, rotationZ,
    transformPoint, transformDirection,
    pack, hexToRgb, mixRgb, ramp, buildRamp,
    createTarget, clearTarget, drawMesh, traceOutline, blit,
    fillRect, strokeRect, fillEllipse, createPresenter, makeCamera,
    rasterTriangle, shadeLevel
  };
})(window);
