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
  // toward a warm bone. Three steps only — more would stop reading as pixel art.
  const SHADOW_TINT = [34, 40, 58];
  const LIGHT_TINT = [255, 248, 226];

  function buildRamp(hex) {
    const base = hexToRgb(hex);
    const dark = mixRgb([base[0] * 0.62, base[1] * 0.62, base[2] * 0.66].map(Math.round), SHADOW_TINT, 0.28);
    const light = mixRgb(base, LIGHT_TINT, 0.2);
    return [pack(dark[0], dark[1], dark[2]), pack(base[0], base[1], base[2]), pack(light[0], light[1], light[2])];
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
  const LIGHT = (function () {
    const v = [-0.42, 0.76, 0.5];
    const len = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
  })();

  const FACES = [
    { idx: [0, 1, 3, 2], n: [-1, 0, 0] }, // -X
    { idx: [4, 6, 7, 5], n: [1, 0, 0] },  // +X
    { idx: [0, 4, 5, 1], n: [0, -1, 0] }, // -Y
    { idx: [2, 3, 7, 6], n: [0, 1, 0] },  // +Y
    { idx: [0, 2, 6, 4], n: [0, 0, -1] }, // -Z
    { idx: [1, 5, 7, 3], n: [0, 0, 1] }   // +Z
  ];

  const _p = [0, 0, 0];
  const _n = [0, 0, 0];
  const _corners = new Float32Array(24);
  const _screen = new Float32Array(24);

  function shadeIndex(dot) {
    if (dot > 0.72) return 2;
    if (dot > 0.33) return 1;
    return 0;
  }

  function drawBox(target, matrix, box, colourRamp, camera, opts) {
    const x0 = box.x - 0.01, x1 = box.x + box.w + 0.01;
    const y0 = box.y - 0.01, y1 = box.y + box.h + 0.01;
    const z0 = box.z - 0.01, z1 = box.z + box.d + 0.01;

    // corner index = (xi<<2) | (yi<<1) | zi
    const xs = [x0, x1], ys = [y0, y1], zs = [z0, z1];
    for (let xi = 0; xi < 2; xi++) {
      for (let yi = 0; yi < 2; yi++) {
        for (let zi = 0; zi < 2; zi++) {
          const k = ((xi << 2) | (yi << 1) | zi) * 3;
          transformPoint(matrix, xs[xi], ys[yi], zs[zi], _p);
          // world -> view: pitch the whole world forward so we look down on it
          const vy = _p[1] * camera.cosPitch - _p[2] * camera.sinPitch;
          const vz = _p[1] * camera.sinPitch + _p[2] * camera.cosPitch;
          _corners[k] = _p[0];
          _corners[k + 1] = vy;
          _corners[k + 2] = vz;
          _screen[k] = camera.ox + _p[0] * camera.scale;
          _screen[k + 1] = camera.oy - vy * camera.scale;
          _screen[k + 2] = -vz;
        }
      }
    }

    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      transformDirection(matrix, face.n[0], face.n[1], face.n[2], _n);
      const ny = _n[1] * camera.cosPitch - _n[2] * camera.sinPitch;
      const nz = _n[1] * camera.sinPitch + _n[2] * camera.cosPitch;
      if (nz <= 0.015) continue; // facing away from the camera

      let colour;
      if (opts && opts.flat) {
        colour = colourRamp[1];
      } else {
        const dot = _n[0] * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        colour = colourRamp[shadeIndex(dot)];
      }

      const i0 = face.idx[0] * 3, i1 = face.idx[1] * 3;
      const i2 = face.idx[2] * 3, i3 = face.idx[3] * 3;
      const bias = opts && opts.depthBias ? opts.depthBias : 0;

      rasterTriangle(target,
        _screen[i0], _screen[i0 + 1], _screen[i0 + 2] - bias,
        _screen[i1], _screen[i1 + 1], _screen[i1 + 2] - bias,
        _screen[i2], _screen[i2 + 1], _screen[i2 + 2] - bias,
        colour);
      rasterTriangle(target,
        _screen[i0], _screen[i0 + 1], _screen[i0 + 2] - bias,
        _screen[i2], _screen[i2 + 1], _screen[i2 + 2] - bias,
        _screen[i3], _screen[i3 + 1], _screen[i3 + 2] - bias,
        colour);
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
    createTarget, clearTarget, drawBox, traceOutline, blit,
    fillRect, strokeRect, fillEllipse, createPresenter, makeCamera,
    rasterTriangle
  };
})(window);
