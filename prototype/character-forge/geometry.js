/* geometry.js — mesh primitives.
 *
 * Everything used to be an axis-aligned box, which is why heads read as cubes
 * and hair read as slabs. These builders produce general convex meshes, so a
 * spike can taper to a point, a beard can hang and narrow, and a skull can be
 * a rounded solid.
 *
 * A mesh is { verts: [x,y,z, ...], faces: [{ i: [...], n: [x,y,z] }], aabb }.
 * Face normals are computed once at build time from the vertices and the
 * centroid, so every face points outward regardless of winding order.
 */
(function (global) {
  'use strict';

  function finish(verts, faces) {
    // centroid, used only to orient the normals outward
    let cx = 0, cy = 0, cz = 0;
    const n = verts.length / 3;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = verts[i * 3], y = verts[i * 3 + 1], z = verts[i * 3 + 2];
      cx += x; cy += y; cz += z;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    cx /= n; cy /= n; cz /= n;

    const kept = [];
    for (let f = 0; f < faces.length; f++) {
      const idx = faces[f];
      const ax = verts[idx[0] * 3], ay = verts[idx[0] * 3 + 1], az = verts[idx[0] * 3 + 2];
      const bx = verts[idx[1] * 3], by = verts[idx[1] * 3 + 1], bz = verts[idx[1] * 3 + 2];

      // find a third vertex that is not collinear with the first two
      let nx = 0, ny = 0, nz = 0;
      for (let k = 2; k < idx.length; k++) {
        const cx2 = verts[idx[k] * 3], cy2 = verts[idx[k] * 3 + 1], cz2 = verts[idx[k] * 3 + 2];
        const u = [bx - ax, by - ay, bz - az];
        const v = [cx2 - ax, cy2 - ay, cz2 - az];
        nx = u[1] * v[2] - u[2] * v[1];
        ny = u[2] * v[0] - u[0] * v[2];
        nz = u[0] * v[1] - u[1] * v[0];
        if (Math.hypot(nx, ny, nz) > 1e-6) break;
      }
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-6) continue;   // degenerate face, drop it
      nx /= len; ny /= len; nz /= len;

      // flip to face away from the centroid
      if ((ax - cx) * nx + (ay - cy) * ny + (az - cz) * nz < 0) {
        nx = -nx; ny = -ny; nz = -nz;
      }
      kept.push({ i: idx, n: [nx, ny, nz] });
    }

    return {
      verts: verts,
      faces: kept,
      aabb: { x: minX, y: minY, z: minZ, w: maxX - minX, h: maxY - minY, d: maxZ - minZ }
    };
  }

  /* ---------- box ---------- */

  /* Boxes are grown a hair on every face. Two that merely abut share an exact
   * edge, and rounding on either side of it can leave a one-pixel seam through
   * the model — a pinhole in the clothing that moves as the character turns.
   * Overlapping slightly costs nothing and closes them. */
  const SEAM = 0.012;

  function box(x, y, z, w, h, d) {
    x -= SEAM; y -= SEAM; z -= SEAM;
    w += SEAM * 2; h += SEAM * 2; d += SEAM * 2;
    const x1 = x + w, y1 = y + h, z1 = z + d;
    const verts = [
      x, y, z, x, y, z1, x, y1, z, x, y1, z1,
      x1, y, z, x1, y, z1, x1, y1, z, x1, y1, z1
    ];
    const faces = [
      [0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1],
      [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]
    ];
    return finish(verts, faces);
  }

  /* ---------- frustum ----------
   *
   * A box whose top face can be shrunk and shifted. Tapering to a small top
   * gives a spike or a lock of hair; tapering to zero gives a cone.
   */
  function taper(x, y, z, w, h, d, topScale, offX, offZ) {
    x -= SEAM; y -= SEAM; z -= SEAM;
    w += SEAM * 2; h += SEAM * 2; d += SEAM * 2;
    const ts = Math.max(0.001, topScale === undefined ? 0.4 : topScale);
    const ox = offX || 0, oz = offZ || 0;
    const cx = x + w / 2, cz = z + d / 2;
    const tw = w * ts, td = d * ts;
    const tx = cx + ox - tw / 2, tz = cz + oz - td / 2;
    const verts = [
      x, y, z, x, y, z + d, x + w, y, z + d, x + w, y, z,
      tx, y + h, tz, tx, y + h, tz + td, tx + tw, y + h, tz + td, tx + tw, y + h, tz
    ];
    const faces = [
      [0, 3, 2, 1], [4, 5, 6, 7],
      [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]
    ];
    return finish(verts, faces);
  }

  /* ---------- pyramid: four triangles to a point ---------- */

  function pyramid(x, y, z, w, h, d, offX, offZ) {
    const ox = offX || 0, oz = offZ || 0;
    const verts = [
      x, y, z, x, y, z + d, x + w, y, z + d, x + w, y, z,
      x + w / 2 + ox, y + h, z + d / 2 + oz
    ];
    const faces = [[0, 3, 2, 1], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
    return finish(verts, faces);
  }

  /* ---------- wedge: a triangular prism ---------- */

  function wedge(x, y, z, w, h, d) {
    // slopes from a full-depth base up to a ridge along the back edge
    const verts = [
      x, y, z, x, y, z + d, x + w, y, z + d, x + w, y, z,
      x, y + h, z, x + w, y + h, z
    ];
    const faces = [[0, 3, 2, 1], [0, 4, 5, 3], [1, 2, 5, 4], [0, 1, 4], [3, 5, 2]];
    return finish(verts, faces);
  }

  /* ---------- superellipsoid ----------
   *
   * One knob between a sphere and a cube. e near 1 is a ball (hair puffs,
   * berries); e near 0.3 is a rounded box, which is what a skull wants — a
   * hard cube head is the single biggest reason a character reads as wrong.
   */
  function superellipsoid(cx, cy, cz, rx, ry, rz, e, rings, segs, u0, u1) {
    rings = rings || 5;
    segs = segs || 8;
    const lo = u0 === undefined ? -Math.PI / 2 : u0;
    const hi = u1 === undefined ? Math.PI / 2 : u1;
    const EPS = 1e-4;
    const poleLo = lo <= -Math.PI / 2 + EPS;
    const poleHi = hi >= Math.PI / 2 - EPS;

    const p = function (v, exp) {
      const s = v < 0 ? -1 : 1;
      return s * Math.pow(Math.abs(v), exp);
    };

    const verts = [];
    const faces = [];
    const index = [];

    for (let i = 0; i <= rings; i++) {
      const u = lo + (i / rings) * (hi - lo);
      const cu = p(Math.cos(u), e), su = p(Math.sin(u), e);
      const atPole = (i === 0 && poleLo) || (i === rings && poleHi);
      const row = [];
      for (let j = 0; j < segs; j++) {
        if (atPole && j > 0) { row.push(row[0]); continue; }
        const v = -Math.PI + (j / segs) * Math.PI * 2;
        row.push(verts.length / 3);
        verts.push(
          cx + rx * cu * p(Math.cos(v), e),
          cy + ry * su,
          cz + rz * cu * p(Math.sin(v), e)
        );
      }
      index.push(row);
    }

    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segs; j++) {
        const j2 = (j + 1) % segs;
        const a = index[i][j], b = index[i][j2];
        const c = index[i + 1][j2], d = index[i + 1][j];
        const quad = [];
        if (a !== b) quad.push(a);
        if (b !== c) quad.push(b);
        if (c !== d) quad.push(c);
        if (d !== a) quad.push(d);
        if (quad.length >= 3) faces.push(quad);
      }
    }

    // A sliced-off end leaves the solid open, and an open shell shows its own
    // inside once it turns. Close each cut with a flat disc — the rim sits at
    // constant y, so a single planar face is enough.
    if (!poleLo) faces.push(index[0].slice().reverse());
    if (!poleHi) faces.push(index[rings].slice());

    return finish(verts, faces);
  }

  /* Latitude at which a superellipsoid of this shape passes through `y`.
   * Lets a hair dome be cut exactly at the hairline. */
  function latitudeAt(cy, ry, e, y) {
    const t = (y - cy) / ry;
    const clamped = Math.max(-1, Math.min(1, t));
    const s = clamped < 0 ? -1 : 1;
    return s * Math.asin(Math.min(1, Math.pow(Math.abs(clamped), 1 / e)));
  }

  /* A dome: the part of a superellipsoid above `fromY`, closed underneath. */
  function dome(cx, cy, cz, rx, ry, rz, e, fromY, rings, segs) {
    return superellipsoid(cx, cy, cz, rx, ry, rz, e, rings || 4, segs || 10,
      latitudeAt(cy, ry, e, fromY), Math.PI / 2);
  }

  /* ---------- a capsule-ish limb between two points in the same mesh ---------- */

  function slab(x, y, z, w, h, d, topScale, botScale, offX, offZ) {
    // like taper but the bottom can shrink too — used for hanging hair
    x -= SEAM; y -= SEAM; z -= SEAM;
    w += SEAM * 2; h += SEAM * 2; d += SEAM * 2;
    const bs = botScale === undefined ? 1 : botScale;
    const ts = topScale === undefined ? 1 : topScale;
    const cx = x + w / 2, cz = z + d / 2;
    const ox = offX || 0, oz = offZ || 0;
    const bw = w * bs, bd = d * bs, tw = w * ts, td = d * ts;
    const bx = cx - bw / 2, bz = cz - bd / 2;
    const tx = cx + ox - tw / 2, tz = cz + oz - td / 2;
    const verts = [
      bx, y, bz, bx, y, bz + bd, bx + bw, y, bz + bd, bx + bw, y, bz,
      tx, y + h, tz, tx, y + h, tz + td, tx + tw, y + h, tz + td, tx + tw, y + h, tz
    ];
    const faces = [
      [0, 3, 2, 1], [4, 5, 6, 7],
      [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]
    ];
    return finish(verts, faces);
  }

  function overlapsAabb(a, b) {
    const p = a.aabb, q = b.aabb;
    return p.x < q.x + q.w && q.x < p.x + p.w &&
           p.y < q.y + q.h && q.y < p.y + p.h &&
           p.z < q.z + q.d && q.z < p.z + p.d;
  }

  global.Geo = { finish, box, taper, pyramid, wedge, superellipsoid, dome, latitudeAt, slab, overlapsAabb };
})(window);
