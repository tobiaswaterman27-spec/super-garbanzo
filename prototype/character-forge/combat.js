/* combat.js — weapons, wounds, blood and dying.
 *
 * Nothing here is deterministic. A mace that always killed in one hit would
 * be a rule rather than a fight, so every blow is
 *
 *     damage = weapon power x hit quality x target vulnerability x variation
 *
 * and the same swing can drop one villager and leave another standing. What
 * *is* deterministic is where the wound goes: the blow is resolved against a
 * height on the body, the wound is stitched to the bone it landed on, and it
 * bleeds from there until the bleeding stops — which is either because they
 * were bandaged, or because there is nothing left to bleed.
 */
(function (global) {
  'use strict';

  const G = global.Geo;
  const CM = global.CharacterModel;

  /* ================= weapons ================= */

  const BLOOD = '#6d1119';
  const BLOOD_DARK = '#48070d';
  /* A bruise is not blood. It is a different colour, it is flat, and it does
   * not run — which is the whole reason a fist reads differently from a
   * knife without anyone having to be told which one hit them. Three stages,
   * because a bruise that never changes colour is just a stain. */
  const BRUISE = ['#7a3b46', '#5d3b5c', '#6b5a3c'];
  const SHAFT = '#6b4c2a';
  const FLETCH = '#c9bda6';
  const STEEL = '#b9bec6';
  const STEEL_DARK = '#7d838c';
  const STEEL_EDGE = '#e6ebf2';   // the bright line down a sharpened edge
  const STEEL_DEEP = '#565b63';   // the shadow in a fuller or a socket
  const BRASS_LIT = '#d8b45c';
  const HAFT = '#6b4a29';
  const HAFT_DARK = '#4a3119';
  const LEATHER = '#4b3320';
  const BRASS = '#a8852f';
  const BONE_COL = '#ddd6c2';
  void BRASS_LIT;

  function part(mesh, colour) { return { mesh: mesh, colour: colour }; }

  /* An axe blade is a crescent, and a crescent is the one shape a stack of
   * boxes cannot fake. This lays a fan of quads from the eye out to a curved
   * edge and closes it into a solid, so the head is one piece of steel that
   * actually meets the haft. */
  function bladeMesh(y0, y1, reach, halfWidth, curve, back) {
    const verts = [];
    const faces = [];
    const N = 7;
    const ring = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // the edge bows out from the socket and sweeps back at both horns
      const bow = Math.sin(t * Math.PI);
      const y = y0 + (y1 - y0) * t;
      const z = -(back + reach * (0.35 + 0.65 * bow) * curve);
      ring.push([y, z]);
      verts.push(-halfWidth, y, -back);
      verts.push(halfWidth, y, -back);
      verts.push(-halfWidth * (0.45 + 0.3 * bow), y, z);
      verts.push(halfWidth * (0.45 + 0.3 * bow), y, z);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 4, b = (i + 1) * 4;
      faces.push([a, a + 2, b + 2, b]);           // left face
      faces.push([a + 1, b + 1, b + 3, a + 3]);   // right face
      faces.push([a + 2, a + 3, b + 3, b + 2]);   // the edge itself
      faces.push([a, b, b + 1, a + 1]);           // the back, against the haft
    }
    faces.push([0, 1, 3, 2]);
    faces.push([N * 4, N * 4 + 2, N * 4 + 3, N * 4 + 1]);
    return G.finish(verts, faces);
  }

  /* Every weapon is modelled in the hand's own space: the grip sits at the
   * origin and the business end runs along -Y, which is the direction the
   * forearm already points. That way one attachment point serves all of them
   * and a weapon needs no bone of its own. */
  const BUILD = {
    fists: function () { return []; },

    /* Every weapon is laid out from one set of numbers so the pieces meet:
     * the grip runs from GRIP_TOP down to GRIP_BOT, the guard sits exactly at
     * GRIP_TOP, and the blade starts where the guard ends. Eyeballing offsets
     * is what leaves a blade floating a unit clear of its own crossguard. */
    club: function () {
      const p = [];
      const gripBot = 1.6, gripTop = -6.0, headTop = -14.2;
      p.push(part(G.slab(-0.85, gripTop, -0.85, 1.7, gripBot - gripTop, 1.7, 0.9, 1), HAFT_DARK));
      // wrapped grip, in bands
      for (let i = 0; i < 4; i++) {
        p.push(part(G.slab(-0.98, gripBot - 1.0 - i * 1.7, -0.98, 1.96, 1.1, 1.96, 0.85, 1),
          i % 2 ? LEATHER : '#3a2617'));
      }
      /* The head is the point of a club, so it is genuinely fat: a long
       * swelling that starts halfway down the shaft and is nearly three times
       * its width at the crown. */
      p.push(part(G.taper(-0.85, gripTop, -0.85, 1.7, 3.0, 1.7, 1.75), HAFT));
      p.push(part(G.slab(-1.5, gripTop - 3.0, -1.5, 3.0, 2.0, 3.0, 0.8, 1), HAFT));
      p.push(part(G.taper(-1.5, gripTop - 6.4, -1.5, 3.0, 3.4, 3.0, 1.45), HAFT));
      p.push(part(G.slab(-2.2, gripTop - 7.2, -2.2, 4.4, (gripTop - 7.2) - headTop, 4.4, 0.72, 1), HAFT));
      p.push(part(G.superellipsoid(0, headTop + 0.6, 0, 2.2, 1.5, 2.2, 0.55, 4, 9), HAFT));
      // iron bands and studs round the crown
      p.push(part(G.slab(-2.35, gripTop - 8.4, -2.35, 4.7, 0.9, 4.7, 0.85, 1), STEEL_DARK));
      p.push(part(G.slab(-2.35, headTop + 1.6, -2.35, 4.7, 0.9, 4.7, 0.85, 1), STEEL_DARK));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        p.push(part(G.superellipsoid(Math.cos(a) * 2.1, headTop + 3.4, Math.sin(a) * 2.1,
          0.72, 0.72, 0.72, 0.5, 3, 7), STEEL));
      }
      return p;
    },

    dagger: function () {
      const p = [];
      const gripTop = -0.9, gripBot = 3.4, guardH = 0.9, bladeLen = 7.4;
      p.push(part(G.slab(-0.62, gripTop, -0.62, 1.24, gripBot - gripTop, 1.24, 0.8, 1), LEATHER));
      // wire wrap
      for (let i = 0; i < 4; i++) {
        p.push(part(G.box(-0.72, gripTop + 0.5 + i * 0.8, -0.72, 1.44, 0.32, 1.44), '#3a2617'));
      }
      // pommel, sitting on the end of the grip
      p.push(part(G.superellipsoid(0, gripBot + 0.5, 0, 0.85, 0.75, 0.85, 0.5, 3, 8), BRASS));
      // guard, its top face flush with the grip's bottom
      p.push(part(G.box(-1.7, gripTop - guardH, -0.55, 3.4, guardH, 1.1), BRASS));
      p.push(part(G.box(-1.9, gripTop - guardH, -0.4, 0.55, guardH + 0.4, 0.8), BRASS));
      p.push(part(G.box(1.35, gripTop - guardH, -0.4, 0.55, guardH + 0.4, 0.8), BRASS));
      // blade starts where the guard ends
      const b0 = gripTop - guardH;
      p.push(part(G.taper(-0.8, b0 - bladeLen, -0.32, 1.6, bladeLen, 0.64, 0.18), STEEL));
      p.push(part(G.box(-0.16, b0 - bladeLen + 1.2, -0.38, 0.32, bladeLen - 1.6, 0.76), STEEL_DEEP));
      // sharpened edges, catching the light down both sides
      p.push(part(G.box(-0.84, b0 - bladeLen + 0.8, -0.2, 0.26, bladeLen - 1.2, 0.4), STEEL_EDGE));
      p.push(part(G.box(0.58, b0 - bladeLen + 0.8, -0.2, 0.26, bladeLen - 1.2, 0.4), STEEL_EDGE));
      return p;
    },

    sword: function () {
      const p = [];
      const gripTop = -1.1, gripBot = 3.2, guardH = 1.0, bladeLen = 17.0;
      p.push(part(G.slab(-0.66, gripTop, -0.66, 1.32, gripBot - gripTop, 1.32, 0.85, 1), LEATHER));
      for (let i = 0; i < 5; i++) {
        p.push(part(G.box(-0.78, gripTop + 0.35 + i * 0.75, -0.78, 1.56, 0.28, 1.56), '#2f2317'));
      }
      p.push(part(G.superellipsoid(0, gripBot + 0.7, 0, 1.05, 0.95, 1.05, 0.45, 4, 8), BRASS));
      p.push(part(G.box(-0.5, gripBot - 0.1, -0.5, 1.0, 0.9, 1.0), BRASS));
      // crossguard: a bar with slightly swept tips, flush under the grip
      p.push(part(G.box(-3.2, gripTop - guardH, -0.6, 6.4, guardH, 1.2), STEEL_DARK));
      p.push(part(G.box(-3.7, gripTop - guardH - 0.5, -0.45, 0.7, guardH + 0.9, 0.9), STEEL_DARK));
      p.push(part(G.box(3.0, gripTop - guardH - 0.5, -0.45, 0.7, guardH + 0.9, 0.9), STEEL_DARK));
      // ricasso, then the blade, then the point
      const b0 = gripTop - guardH;
      p.push(part(G.box(-0.95, b0 - 2.0, -0.42, 1.9, 2.0, 0.84), STEEL_DARK));
      p.push(part(G.taper(-1.05, b0 - bladeLen, -0.46, 2.1, bladeLen - 2.0, 0.92, 0.66, 0, 0), STEEL));
      p.push(part(G.taper(-0.7, b0 - bladeLen - 2.1, -0.3, 1.4, 2.1, 0.6, 0.1), STEEL));
      // fuller down the centre, sunk into the flat
      p.push(part(G.box(-0.32, b0 - bladeLen + 1.0, -0.52, 0.64, bladeLen - 3.4, 1.04), STEEL_DEEP));
      // and a bright edge down each side, narrowing with the taper
      for (let i = 0; i < 6; i++) {
        const t0 = i / 6, t1 = (i + 1) / 6;
        const wid = 1.05 - t0 * 0.34;
        p.push(part(G.box(-wid, b0 - 2.0 - (bladeLen - 2.0) * t1, -0.22,
          0.24, (bladeLen - 2.0) / 6, 0.44), STEEL_EDGE));
        p.push(part(G.box(wid - 0.24, b0 - 2.0 - (bladeLen - 2.0) * t1, -0.22,
          0.24, (bladeLen - 2.0) / 6, 0.44), STEEL_EDGE));
      }
      // a brass collar where the blade meets the guard
      p.push(part(G.box(-1.15, b0 - 0.5, -0.55, 2.3, 0.55, 1.1), BRASS_LIT));
      return p;
    },

    axe: function () {
      const p = [];
      const haftTop = -13.0, haftBot = 3.0;
      p.push(part(G.slab(-0.78, haftTop, -0.78, 1.56, haftBot - haftTop, 1.56, 0.92, 1), HAFT));
      p.push(part(G.slab(-0.9, haftBot - 2.4, -0.9, 1.8, 2.4, 1.8, 0.85, 1), LEATHER));
      p.push(part(G.superellipsoid(0, haftBot + 0.3, 0, 1.0, 0.7, 1.0, 0.5, 3, 7), STEEL_DARK));
      // the eye: a collar clamped round the haft, which the head grows out of
      p.push(part(G.box(-1.0, haftTop - 0.6, -1.3, 2.0, 5.6, 2.6), STEEL_DARK));
      p.push(part(G.box(-1.15, haftTop + 3.6, -1.45, 2.3, 0.9, 2.9), STEEL_DARK));
      p.push(part(G.box(-1.15, haftTop - 0.9, -1.45, 2.3, 0.9, 2.9), STEEL_DARK));
      // one solid bearded blade sweeping out of the eye
      p.push(part(bladeMesh(haftTop - 1.2, haftTop + 4.4, 5.6, 0.75, 1, 1.0), STEEL_DARK));
      p.push(part(bladeMesh(haftTop - 1.1, haftTop + 4.3, 5.75, 0.5, 1, 1.0), STEEL));
      p.push(part(bladeMesh(haftTop - 1.0, haftTop + 4.2, 5.95, 0.24, 1, 1.0), STEEL_EDGE));
      p.push(part(G.box(-1.2, haftTop + 4.4, -1.5, 2.4, 0.7, 3.0), BRASS_LIT));
      // a short spike opposite the blade
      p.push(part(G.taper(-0.6, haftTop + 1.0, 1.2, 1.2, 2.4, 1.7, 0.3), STEEL_DARK));
      return p;
    },

    mace: function () {
      const p = [];
      const haftTop = -10.0, haftBot = 2.6;
      p.push(part(G.slab(-0.72, haftTop, -0.72, 1.44, haftBot - haftTop, 1.44, 0.9, 1), STEEL_DARK));
      for (let i = 0; i < 5; i++) {
        p.push(part(G.box(-0.84, haftBot - 1.0 - i * 1.5, -0.84, 1.68, 0.5, 1.68), LEATHER));
      }
      p.push(part(G.superellipsoid(0, haftBot + 0.4, 0, 0.95, 0.75, 0.95, 0.5, 3, 7), STEEL));
      // collar, head, cap — all touching
      p.push(part(G.box(-0.95, haftTop, -0.95, 1.9, 1.2, 1.9), STEEL));
      p.push(part(G.superellipsoid(0, haftTop - 2.4, 0, 1.9, 2.5, 1.9, 0.6, 5, 9), STEEL_DARK));
      // six flanges standing off the head
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const cx = Math.cos(a), cz = Math.sin(a);
        p.push(part(G.taper(cx * 1.5 - 0.42, haftTop - 4.3, cz * 1.5 - 0.42,
          0.84, 4.0, 0.84, 0.35, cx * 1.5, cz * 1.5), STEEL_DARK));
        p.push(part(G.taper(cx * 1.72 - 0.22, haftTop - 4.2, cz * 1.72 - 0.22,
          0.44, 3.7, 0.44, 0.3, cx * 1.5, cz * 1.5), STEEL_EDGE));
      }
      p.push(part(G.superellipsoid(0, haftTop - 5.1, 0, 1.15, 1.0, 1.15, 0.5, 3, 8), STEEL));
      return p;
    },

    spear: function () {
      const p = [];
      const shaftTop = -20.0, shaftBot = 9.0;
      p.push(part(G.slab(-0.58, shaftTop, -0.58, 1.16, shaftBot - shaftTop, 1.16, 0.94, 1), HAFT));
      // two grip wraps where the hands go
      p.push(part(G.slab(-0.7, -1.2, -0.7, 1.4, 2.6, 1.4, 0.88, 1), LEATHER));
      p.push(part(G.slab(-0.7, 4.4, -0.7, 1.4, 2.6, 1.4, 0.88, 1), LEATHER));
      p.push(part(G.box(-0.66, shaftBot - 0.9, -0.66, 1.32, 0.9, 1.32), STEEL_DARK));
      // socket, wings, then the head
      p.push(part(G.taper(-0.78, shaftTop, -0.78, 1.56, 2.6, 1.56, 1.25), STEEL_DARK));
      p.push(part(G.box(-1.7, shaftTop + 0.4, -0.35, 3.4, 0.8, 0.7), STEEL_DARK));
      p.push(part(G.taper(-1.0, shaftTop - 4.6, -0.4, 2.0, 4.6, 0.8, 0.9, 0, 0), STEEL));
      p.push(part(G.taper(-0.9, shaftTop - 7.4, -0.36, 1.8, 2.8, 0.72, 0.08), STEEL));
      p.push(part(G.box(-0.2, shaftTop - 6.6, -0.44, 0.4, 6.4, 0.88), STEEL_DEEP));
      p.push(part(G.box(-0.98, shaftTop - 6.2, -0.24, 0.26, 5.4, 0.48), STEEL_EDGE));
      p.push(part(G.box(0.72, shaftTop - 6.2, -0.24, 0.26, 5.4, 0.48), STEEL_EDGE));
      return p;
    },

    greatsword: function () {
      const p = [];
      const gripTop = -1.3, gripBot = 6.6, guardH = 1.2, bladeLen = 24.0;
      p.push(part(G.slab(-0.72, gripTop, -0.72, 1.44, gripBot - gripTop, 1.44, 0.88, 1), LEATHER));
      for (let i = 0; i < 8; i++) {
        p.push(part(G.box(-0.84, gripTop + 0.6 + i * 0.95, -0.84, 1.68, 0.3, 1.68), '#2f2317'));
      }
      p.push(part(G.superellipsoid(0, gripBot + 0.9, 0, 1.25, 1.1, 1.25, 0.45, 4, 9), BRASS));
      p.push(part(G.box(-0.55, gripBot - 0.1, -0.55, 1.1, 1.0, 1.1), BRASS));
      p.push(part(G.box(-4.4, gripTop - guardH, -0.7, 8.8, guardH, 1.4), STEEL_DARK));
      p.push(part(G.box(-4.9, gripTop - guardH - 0.7, -0.5, 0.8, guardH + 1.1, 1.0), STEEL_DARK));
      p.push(part(G.box(4.1, gripTop - guardH - 0.7, -0.5, 0.8, guardH + 1.1, 1.0), STEEL_DARK));
      const b0 = gripTop - guardH;
      // a long ricasso, the way a real greatsword is gripped above the guard
      p.push(part(G.box(-1.1, b0 - 3.4, -0.5, 2.2, 3.4, 1.0), STEEL_DARK));
      p.push(part(G.box(-1.6, b0 - 4.2, -0.5, 0.7, 1.0, 1.0), STEEL_DARK));
      p.push(part(G.box(0.9, b0 - 4.2, -0.5, 0.7, 1.0, 1.0), STEEL_DARK));
      p.push(part(G.taper(-1.35, b0 - bladeLen, -0.52, 2.7, bladeLen - 3.4, 1.04, 0.7, 0, 0), STEEL));
      p.push(part(G.taper(-0.95, b0 - bladeLen - 2.8, -0.36, 1.9, 2.8, 0.72, 0.1), STEEL));
      p.push(part(G.box(-0.38, b0 - bladeLen + 1.4, -0.6, 0.76, bladeLen - 5.6, 1.2), STEEL_DEEP));
      for (let i = 0; i < 7; i++) {
        const t0 = i / 7, t1 = (i + 1) / 7;
        const wid = 1.35 - t0 * 0.42;
        p.push(part(G.box(-wid, b0 - 3.4 - (bladeLen - 3.4) * t1, -0.26,
          0.28, (bladeLen - 3.4) / 7, 0.52), STEEL_EDGE));
        p.push(part(G.box(wid - 0.28, b0 - 3.4 - (bladeLen - 3.4) * t1, -0.26,
          0.28, (bladeLen - 3.4) / 7, 0.52), STEEL_EDGE));
      }
      p.push(part(G.box(-1.45, b0 - 0.6, -0.62, 2.9, 0.6, 1.24), BRASS_LIT));
      return p;
    },

    poleaxe: function () {
      const p = [];
      const shaftTop = -26.0, shaftBot = 7.0;
      p.push(part(G.slab(-0.68, shaftTop, -0.68, 1.36, shaftBot - shaftTop, 1.36, 0.94, 1), HAFT));
      p.push(part(G.slab(-0.8, -1.4, -0.8, 1.6, 3.0, 1.6, 0.88, 1), LEATHER));
      p.push(part(G.slab(-0.8, 3.2, -0.8, 1.6, 3.0, 1.6, 0.88, 1), LEATHER));
      // langets: the iron straps running down the shaft from the head
      p.push(part(G.box(-0.82, shaftTop + 2.0, -0.3, 0.42, 7.0, 0.6), STEEL_DARK));
      p.push(part(G.box(0.4, shaftTop + 2.0, -0.3, 0.42, 7.0, 0.6), STEEL_DARK));
      // the head: axe blade one side, hammer the other, spike on top
      p.push(part(G.box(-0.95, shaftTop - 0.4, -1.2, 1.9, 6.0, 2.4), STEEL_DARK));
      p.push(part(bladeMesh(shaftTop - 0.8, shaftTop + 5.0, 5.2, 0.7, 1, 1.0), STEEL_DARK));
      p.push(part(bladeMesh(shaftTop - 0.7, shaftTop + 4.9, 5.35, 0.46, 1, 1.0), STEEL));
      p.push(part(bladeMesh(shaftTop - 0.6, shaftTop + 4.8, 5.55, 0.22, 1, 1.0), STEEL_EDGE));
      // hammer poll on the far side, with a studded face
      p.push(part(G.box(-0.95, shaftTop + 1.0, 1.1, 1.9, 3.6, 2.6), STEEL));
      for (let i = 0; i < 4; i++) {
        const sx = (i & 1) ? 0.3 : -0.8, sy = (i & 2) ? 2.6 : 1.4;
        p.push(part(G.box(sx, shaftTop + sy, 3.6, 0.5, 0.5, 0.35), STEEL_DARK));
      }
      p.push(part(G.taper(-0.62, shaftTop - 4.6, -0.62, 1.24, 4.8, 1.24, 0.1), STEEL));
      return p;
    },

    /* A bow is a stave that bends. Segments are placed along a curve and each
     * one is long enough to overlap its neighbour, so the limb reads as one
     * piece of wood rather than as a row of blocks. */
    bow: function () {
      const p = [];
      const N = 9, SPAN = 17.0;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * 2 - 1;
        const y = -t * SPAN;
        const z = -(1 - t * t) * 3.4;
        if (prev) {
          const my = (y + prev.y) / 2, mz = (z + prev.z) / 2;
          const len = Math.hypot(y - prev.y, z - prev.z) * 0.62;
          const thick = 0.62 - Math.abs(t) * 0.22;
          p.push(part(G.slab(-thick, my - len, mz - thick, thick * 2, len * 2, thick * 2, 0.8, 1),
            Math.abs(t) > 0.82 ? HAFT_DARK : HAFT));
        }
        prev = { y: y, z: z };
      }
      // the grip, and horn nocks at the tips
      p.push(part(G.slab(-0.82, -2.4, -0.62 - 0.9, 1.64, 4.8, 1.9, 0.82, 1), LEATHER));
      p.push(part(G.superellipsoid(0, SPAN, 0, 0.55, 0.9, 0.55, 0.5, 3, 7), BONE_COL));
      p.push(part(G.superellipsoid(0, -SPAN, 0, 0.55, 0.9, 0.55, 0.5, 3, 7), BONE_COL));
      // string, straight between the nocks
      p.push(part(G.box(-0.16, -SPAN, -0.16, 0.32, SPAN * 2, 0.32), '#e6e0cc'));
      return p;
    },

    crossbow: function () {
      const p = [];
      const stockTop = -13.0, stockBot = 5.0, prodY = -11.4;
      // stock, tapering to the butt
      p.push(part(G.box(-0.95, stockTop, -1.1, 1.9, stockBot - stockTop, 2.2), HAFT));
      p.push(part(G.taper(-1.05, stockBot - 1.0, -1.35, 2.1, 3.2, 2.7, 0.75), HAFT_DARK));
      // the channel the bolt sits in
      p.push(part(G.box(-0.42, stockTop + 0.4, -1.3, 0.84, 9.0, 0.5), '#3a2617'));
      // prod, curving forward, built as overlapping segments
      const N = 7, SPAN = 8.2;
      for (let i = 0; i < N; i++) {
        const t = ((i + 0.5) / N) * 2 - 1;
        const x = t * SPAN;
        const z = -1.0 - (1 - t * t) * 1.8;
        const thick = 0.68 - Math.abs(t) * 0.2;
        p.push(part(G.slab(x - SPAN / N, prodY - thick, z - thick,
          (SPAN / N) * 2.1, thick * 2, thick * 2, 0.8, 1),
          Math.abs(t) > 0.8 ? STEEL_DARK : HAFT_DARK));
      }
      p.push(part(G.box(-1.5, prodY - 0.9, -1.4, 3.0, 1.8, 2.8), STEEL_DARK));
      // string across the tips, and the nut and trigger
      p.push(part(G.box(-SPAN, prodY - 0.18, -0.9, SPAN * 2, 0.36, 0.36), '#e6e0cc'));
      p.push(part(G.superellipsoid(0, stockTop + 5.4, -0.7, 0.85, 0.85, 0.7, 0.5, 3, 8), BONE_COL));
      p.push(part(G.box(-0.35, stockTop + 5.0, 0.2, 0.7, 2.6, 0.7), STEEL_DARK));
      p.push(part(G.box(-0.5, stockTop + 7.2, -0.4, 1.0, 0.8, 1.6), STEEL_DARK));
      return p;
    }
  };

  /* power        — the base of the damage roll
   * reach        — how far in front the blow lands, in model units
   * swing        — seconds from the start of the attack to the moment it lands
   * recover      — seconds after that before you can swing again
   * kind         — blunt staggers and knocks down; edged and pierce bleed
   * bleed        — how much a wound from this weapon bleeds, per second
   * arc          — how wide a cone it covers, in radians either side
   * gore         — whether a hit leaves a slash across the body */
  const WEAPONS = {
    // Reach has to clear the distance two people are held apart, or they can
    // stand toe to toe and still be out of range of each other.
    fists: { id: 'fists', label: 'Fists', kind: 'blunt', power: 7, reach: 17,
      swing: 0.17, recover: 0.16, bleed: 0.0, arc: 0.6, stamina: 2, anim: 'jab',
      gore: 0, knock: 0.35, twoHanded: false },
    club: { id: 'club', label: 'Club', kind: 'blunt', power: 17, reach: 19,
      swing: 0.24, recover: 0.30, bleed: 0.02, arc: 0.75, stamina: 5, anim: 'swing',
      gore: 0, knock: 0.85, twoHanded: false },
    dagger: { id: 'dagger', label: 'Dagger', kind: 'pierce', power: 23, reach: 19,
      swing: 0.13, recover: 0.16, bleed: 0.85, arc: 0.5, stamina: 3, anim: 'stab',
      gore: 0.4, knock: 0.15, twoHanded: false },
    sword: { id: 'sword', label: 'Sword', kind: 'edged', power: 31, reach: 27,
      swing: 0.21, recover: 0.28, bleed: 0.9, arc: 0.95, stamina: 6, anim: 'slash',
      gore: 1, knock: 0.45, twoHanded: false },
    axe: { id: 'axe', label: 'Axe', kind: 'edged', power: 39, reach: 24,
      swing: 0.31, recover: 0.40, bleed: 1.25, arc: 0.7, stamina: 8, anim: 'overhead',
      gore: 1, knock: 0.8, twoHanded: false },
    mace: { id: 'mace', label: 'Mace', kind: 'blunt', power: 43, reach: 21,
      swing: 0.33, recover: 0.44, bleed: 0.12, arc: 0.7, stamina: 9, anim: 'overhead',
      gore: 0, knock: 1.25, twoHanded: false },
    spear: { id: 'spear', label: 'Spear', kind: 'pierce', power: 34, reach: 40,
      swing: 0.22, recover: 0.34, bleed: 0.95, arc: 0.4, stamina: 6, anim: 'thrust',
      gore: 0.5, knock: 0.5, twoHanded: true },
    greatsword: { id: 'greatsword', label: 'Greatsword', kind: 'edged', power: 49,
      reach: 35, swing: 0.42, recover: 0.52, bleed: 1.5, arc: 1.25, stamina: 12,
      anim: 'slash', gore: 1, knock: 1.1, twoHanded: true },
    poleaxe: { id: 'poleaxe', label: 'Poleaxe', kind: 'edged', power: 52, reach: 42,
      swing: 0.48, recover: 0.58, bleed: 1.4, arc: 0.9, stamina: 13, anim: 'overhead',
      gore: 1, knock: 1.35, twoHanded: true },
    bow: { id: 'bow', label: 'Bow', kind: 'pierce', power: 29, reach: 0,
      swing: 0.52, recover: 0.45, bleed: 0.8, arc: 0, stamina: 5, anim: 'draw',
      gore: 0.3, knock: 0.2, twoHanded: true, ranged: 340, range: 260 },
    crossbow: { id: 'crossbow', label: 'Crossbow', kind: 'pierce', power: 45, reach: 0,
      swing: 0.36, recover: 1.5, bleed: 1.0, arc: 0, stamina: 6, anim: 'aim',
      gore: 0.4, knock: 0.35, twoHanded: true, ranged: 430, range: 300 }
  };

  const MELEE_IDS = ['club', 'dagger', 'sword', 'axe', 'mace', 'spear', 'greatsword', 'poleaxe'];
  const ALL_IDS = MELEE_IDS.concat(['bow', 'crossbow']);

  const _cache = {};
  function weaponParts(id) {
    if (!BUILD[id]) return [];
    if (!_cache[id]) _cache[id] = BUILD[id]();
    return _cache[id];
  }

  function weapon(id) { return WEAPONS[id] || WEAPONS.fists; }

  /* ================= the damage roll ================= */

  const MAX_HP = 100;
  // How much bare-handed punishment somebody takes before the skin goes.
  const SPLIT_AT = 26;

  /* Where on the body a blow landed, as a fraction of standing height, and
   * how badly that place takes it. Deciding this before the damage is what
   * lets the wound be stitched to the right bone afterwards. */
  const ZONES = [
    { id: 'head', bone: 'head', from: 0.82, to: 1.0, quality: 1.85, lethal: 2.2 },
    { id: 'chest', bone: 'torso', from: 0.58, to: 0.82, quality: 1.25, lethal: 1.5 },
    { id: 'gut', bone: 'torso', from: 0.44, to: 0.58, quality: 1.1, lethal: 1.25 },
    { id: 'arm', bone: 'armR', from: 0.60, to: 0.78, quality: 0.65, lethal: 0.5 },
    { id: 'leg', bone: 'legR', from: 0.0, to: 0.44, quality: 0.7, lethal: 0.45 }
  ];

  function zoneFor(id) {
    for (let i = 0; i < ZONES.length; i++) if (ZONES[i].id === id) return ZONES[i];
    return ZONES[1];
  }

  /* Rolls where a blow lands. Most blows go to the body; a careful attacker
   * (standing still, close, facing them) lands higher and better. */
  function rollZone(rng, aim) {
    const r = rng();
    const good = aim === undefined ? 0.5 : aim;
    if (r < 0.06 + good * 0.14) return zoneFor('head');
    if (r < 0.52 + good * 0.12) return zoneFor('chest');
    if (r < 0.70) return zoneFor('gut');
    if (r < 0.86) return zoneFor('arm');
    return zoneFor('leg');
  }

  /* damage = power x hit quality x vulnerability x variation.
   *
   * Hit quality folds in where it landed and how well it was thrown. Being
   * already hurt makes the next blow worse, which is what produces fights
   * that turn rather than fights that grind. */
  function rollDamage(w, target, opts) {
    const o = opts || {};
    const rng = o.rng || Math.random;
    const zone = o.zone || rollZone(rng, o.aim);
    // the health lives on the body, not on the actor that owns it
    const body = target.body || target;
    const hp = typeof body.hp === 'number' ? body.hp : MAX_HP;
    const hurt = 1 - Math.max(0, Math.min(1, hp / MAX_HP));
    const vulnerable = 1 + hurt * 0.75 + (o.defenceless ? 0.4 : 0)
      + (body.blocking ? -0.55 : 0);
    const variation = 0.72 + rng() * 0.62;
    const quality = zone.quality * (0.75 + (o.aim === undefined ? 0.5 : o.aim) * 0.5)
      * (o.charge || 1);
    const amount = w.power * quality * Math.max(0.15, vulnerable) * variation;
    return {
      amount: amount,
      zone: zone,
      // bleeding scales with how deep it went, not just how hard
      bleed: w.bleed * (0.6 + variation * 0.7) * zone.lethal * 0.7,
      knock: w.knock * variation * (zone.id === 'leg' ? 1.3 : 1),
      kind: w.kind,
      gore: w.gore
    };
  }

  /* ================= wounds ================= */

  /* A wound is a mark stitched to a bone, at a spot on that bone. It is drawn
   * with the body, so it turns with them, swings with the limb it is on, and
   * stays where the blow landed rather than floating at chest height. */
  /* A wound is a mark stitched to a bone. What it looks like is decided by
   * what made it, not by how much damage it did:
   *
   *   edged   a slash, laid along the line the blade travelled. Long, thin,
   *           and it runs.
   *   pierce  a small deep hole. Barely wider than the blade, dark, and it
   *           runs hard because a puncture does. An arrow leaves the shaft
   *           in it.
   *   blunt   a bruise. Broad, flat, soft, no run at all, and it changes
   *           colour over the days rather than shrinking much.
   *
   * `travel` is the direction the weapon was moving in the victim's own
   * frame, which is what a slash lies along; without it every cut on a body
   * is at a random angle and a row of them reads as a rash.
   */
  function makeWound(model, zone, dirLocal, opts) {
    const o = opts || {};
    const rng = o.rng || Math.random;
    const kind = o.kind || 'blunt';
    const gore = o.gore === undefined ? 0 : o.gore;
    const power = o.power === undefined ? 20 : o.power;
    const d = model.dims;
    /* A limb wound goes on the limb the blow actually reached. The zone table
     * names the right arm because it has to name one, but a sword coming in
     * from somebody's left does not land on their right arm. */
    let boneName = zone.bone;
    if (boneName === 'armR' && dirLocal[0] < 0) boneName = 'armL';
    if (boneName === 'legR' && dirLocal[0] < 0) boneName = 'legL';
    const bone = model.bones[boneName] ? boneName : 'torso';

    /* Which face of the body it landed on, and where that face is.
     *
     * This matters more than it sounds. A wound placed at some fraction of
     * the body's depth sits *inside* the body, and since the torso is wearing
     * a tunic over the top of that, it is invisible — which is exactly what
     * was happening: every cut in the game was being drawn under somebody's
     * shirt. It has to be put on the surface, and on the surface the blow
     * came from. */
    const onHead = bone === 'head';
    const onLimb = bone.indexOf('arm') === 0 || bone.indexOf('leg') === 0;
    let halfW, halfD;
    if (onHead) { halfW = d.headW * 0.5; halfD = d.headD * 0.5; }
    else if (onLimb) {
      const t = bone.indexOf('arm') === 0 ? d.armW : d.legW;
      // clothing sits on a limb too, just not as thickly
      halfW = t * 0.5 + 0.55; halfD = t * 0.5 + 0.55;
    } else {
      // the tunic, the surcoat and the belt all stand proud of the torso
      halfW = d.torsoW * 0.5 + 0.7; halfD = d.torsoD * 0.5 + 0.7;
    }

    const side = dirLocal[0], front = dirLocal[1];
    const useSide = Math.abs(side) > Math.abs(front);
    const face = useSide ? (side > 0 ? 'right' : 'left')
      : (front >= 0 ? 'front' : 'back');
    const jitter = (rng() - 0.5) * 0.7;

    let x, z;
    if (useSide) {
      x = (side > 0 ? 1 : -1) * (halfW + 0.2);
      z = jitter * halfD;
    } else {
      z = (front >= 0 ? 1 : -1) * (halfD + 0.2);
      x = jitter * halfW;
    }

    let y;
    if (bone === 'head') y = 1.5 + rng() * 4.5;
    else if (bone === 'torso') y = zone.id === 'gut' ? 1.0 + rng() * 3.0 : 4.5 + rng() * 5.5;
    else if (bone.indexOf('arm') === 0) y = -1.0 - rng() * 3.5;
    else y = -1.5 - rng() * 4.0;

    // how heavy the blow was, as a fraction of the worst thing in the game
    const heft = Math.max(0.2, Math.min(1.4, power / 45));
    const wound = {
      bone: bone,
      x: x, y: y, z: z,
      face: face,
      kind: kind,
      age: 0,
      run: 0,
      // Size is what heals. Everything drawn is scaled by it, so a wound
      // closing up is one number going down rather than a second set of
      // shapes.
      size: 1,
      day: 0,
      bruise: 0
    };

    if (kind === 'edged') {
      /* Along the swing. A cut lies across the body in the direction the
       * edge was travelling, which is why an overhead leaves a vertical one
       * and a horizontal slash leaves a belt across the chest. */
      const tx = o.travel ? o.travel[0] : (rng() - 0.5);
      const ty = o.travel ? o.travel[1] : 0.2;
      wound.angle = Math.atan2(ty, tx) + (rng() - 0.5) * 0.5;
      wound.w = (3.4 + gore * 3.2 + rng() * 2.6) * heft;
      wound.h = (0.75 + rng() * 0.4) * (0.7 + heft * 0.5);
      wound.maxRun = (4 + rng() * 5) * heft;
      wound.heal = 0.075;        // a fortnight or so
    } else if (kind === 'pierce') {
      wound.angle = 0;
      wound.w = (1.1 + rng() * 0.8) * (0.7 + heft * 0.4);
      wound.h = wound.w * (0.9 + rng() * 0.3);
      // a hole runs harder than it looks like it should
      wound.maxRun = (4.5 + rng() * 5.5) * heft;
      wound.heal = 0.055;        // the deepest, and the slowest
      if (o.shaft) {
        wound.shaft = true;
        wound.shaftLen = 5 + rng() * 3;
      }
    } else {
      /* A bruise. It comes up broad and flat, it does not bleed, and it takes
       * its time going — but it goes through the colours while it does. */
      wound.angle = (rng() - 0.5) * 0.8;
      wound.w = (2.2 + rng() * 1.8) * (0.6 + heft * 0.7);
      wound.h = wound.w * (0.65 + rng() * 0.4);
      wound.maxRun = 0;
      wound.heal = 0.22;         // four or five days
      wound.bruise = 1;
    }
    return wound;
  }

  /* ---------- healing ----------
   *
   * A wound is not permanent and it is not instant either. Each day it closes
   * a little, and when there is nothing left of it, it goes. A bruise passes
   * through its colours on the way out; a cut just gets shorter and stops
   * running.
   *
   * There are no days yet. This is driven by `advanceDay`, which nothing
   * calls on a timer — when the world grows a clock, that is the one line
   * that has to be hooked up to it.
   */
  const DAY = 1;

  function advanceDay(body, days) {
    if (!body || !body.wounds) return 0;
    const n = days === undefined ? 1 : days;
    let closed = 0;
    for (let i = body.wounds.length - 1; i >= 0; i--) {
      const wd = body.wounds[i];
      wd.day += n;
      wd.size -= (wd.heal === undefined ? 0.1 : wd.heal) * n;
      // the blood dries and stops running long before the cut has gone
      wd.run = Math.max(0, wd.run - n * 1.6);
      wd.maxRun = Math.max(0, wd.maxRun - n * 1.2);
      if (wd.size <= 0.12) { body.wounds.splice(i, 1); closed++; }
    }
    // and a night's rest does something for the rest of it
    body.hp = Math.min(MAX_HP, body.hp + n * 14);
    body.bleed = Math.max(0, body.bleed - n * 2);
    body.bruised = Math.max(0, (body.bruised || 0) - n * 1.2);
    return closed;
  }

  /* Rebuilt every frame the actor is drawn, like the face is. Cheap, and it
   * means a wound that is still spreading looks like it is still spreading. */
  function woundParts(model, wounds) {
    if (!wounds || !wounds.length) return null;
    const byBone = {};
    for (let i = 0; i < wounds.length; i++) {
      const wd = wounds[i];
      const list = byBone[wd.bone] || (byBone[wd.bone] = []);
      // Everything shrinks by the one number that heals.
      const size = wd.size === undefined ? 1 : Math.max(0, wd.size);
      const w = wd.w * size, h = wd.h * size;
      const ca = Math.cos(wd.angle), sa = Math.sin(wd.angle);

      /* A wound lies flat on the face it landed on. On the chest that is a
       * thin plate in Z; on somebody's flank it is a thin plate in X, and
       * drawing it in Z there would leave a blade of colour sticking out of
       * their side. `out` is which way is away from the body. */
      const sideFace = wd.face === 'left' || wd.face === 'right';
      const out = (wd.face === 'back' || wd.face === 'left') ? -1 : 1;
      /* Lays a slab of the given width and height on that face, `depth`
       * thick, standing `lift` clear of it. */
      const onFace = function (cx, cy, ww, hh, depth, lift) {
        const off = out * lift;
        return sideFace
          ? G.box(wd.x + off - (out > 0 ? 0 : depth), cy - hh * 0.5, cx - ww * 0.5,
            depth, hh, ww)
          : G.box(cx - ww * 0.5, cy - hh * 0.5, wd.z + off - (out > 0 ? 0 : depth),
            ww, hh, depth);
      };
      // where along the face this wound sits, in that face's own two axes
      const u0 = sideFace ? wd.z : wd.x;

      if (wd.kind === 'blunt') {
        /* A bruise: a broad flat patch that changes colour as it ages rather
         * than a cut that shrinks. Yellow-green by the time it is nearly
         * gone, which is the only honest way to draw one going. */
        const stage = wd.day >= 4 ? 2 : wd.day >= 2 ? 1 : 0;
        list.push(part(onFace(u0, wd.y, w, h, 0.4, 0), BRUISE[stage]));
        // and a darker heart to it while it is fresh
        if (wd.day < 3) {
          list.push(part(onFace(u0, wd.y, w * 0.5, h * 0.5, 0.45, 0.04), BRUISE[0]));
        }
        continue;
      }

      const col = BLOOD;
      if (wd.kind === 'pierce') {
        // a hole, not a line: one dark mark barely wider than what made it
        list.push(part(onFace(u0, wd.y, w, h, 0.5, 0), BLOOD_DARK));
        list.push(part(onFace(u0, wd.y, w * 0.55, h * 0.55, 0.55, 0.06), col));
        if (wd.shaft && size > 0.6) {
          /* An arrow does not disappear on contact. The shaft stands out of
           * them until somebody pulls it out, and it is the single clearest
           * way to read at a glance what hit whom. */
          /* Built as a stepped stack rather than one box, so the shaft
           * slopes down and out of them instead of pointing straight at the
           * camera. An arrow aimed exactly along the view axis projects to
           * about two pixels and reads as a smudge; one at an angle reads as
           * a stick, which is the entire point of leaving it in. */
          const len = wd.shaftLen * size;
          const SEG = 5;
          for (let k = 0; k < SEG; k++) {
            const t = k / SEG;
            const outAt = out * len * t;
            const dropAt = -len * 0.34 * t;      // it hangs as it comes out
            const seg = len / SEG + 0.3;
            list.push(part(sideFace
              ? G.box(wd.x + outAt, wd.y + dropAt - 0.28, u0 - 0.28, out * seg, 0.56, 0.56)
              : G.box(u0 - 0.28, wd.y + dropAt - 0.28, wd.z + outAt, 0.56, 0.56, out * seg),
            SHAFT));
          }
          // the flights, three of them, out at the far end
          const tipOut = out * len * 0.92;
          const tipY = -len * 0.34 * 0.92;
          for (let f = 0; f < 3; f++) {
            const ang = (f / 3) * Math.PI * 2;
            const fu = Math.cos(ang) * 0.6, fy = Math.sin(ang) * 0.6;
            list.push(part(sideFace
              ? G.box(wd.x + tipOut, wd.y + tipY + fy - 0.17, u0 + fu - 0.17, out * 1.7, 0.34, 0.34)
              : G.box(u0 + fu - 0.17, wd.y + tipY + fy - 0.17, wd.z + tipOut, 0.34, 0.34, out * 1.7),
            FLETCH));
          }
        }
      } else {
        // a slash, laid along the line the edge travelled
        const half = w / 2;
        const steps = w > 3 ? 6 : w > 1.6 ? 3 : 1;
        for (let k = 0; k < steps; k++) {
          const t = steps === 1 ? 0 : (k / (steps - 1) - 0.5) * 2;
          // deepest in the middle, tapering to nothing at both ends
          const taper = 0.55 + 0.45 * Math.cos(t * Math.PI * 0.5);
          const ou = ca * half * t, oy = sa * half * t;
          const th = h * taper;
          list.push(part(onFace(u0 + ou, wd.y + oy, th, th, 0.45, 0), col));
        }
      }

      // the run of blood below it, growing as they bleed
      if (wd.run > 0.3) {
        list.push(part(onFace(u0, wd.y - wd.run * 0.5, 0.9, wd.run, 0.4, 0.02), BLOOD_DARK));
      }
    }
    return byBone;
  }

  /* ================= bleeding out ================= */

  function createBody() {
    return {
      hp: MAX_HP,
      bleed: 0,            // hp per second
      wounds: [],
      dead: false,
      dying: false,
      deathTimer: 0,
      lastHitBy: null,
      lastHitAt: 0,
      pain: 0,
      // How much of a beating they have taken bare-handed. Fists do not cut
      // anybody open on the first punch; they do on the fifth.
      bruised: 0,
      blocking: false
    };
  }

  /* Applies a rolled blow. Returns what happened, so the caller can decide
   * how the victim reacts and whether anyone saw it. */
  function applyDamage(target, roll, dirLocal, rng, opts) {
    const body = target.body;
    if (!body || body.dead) return null;
    const o = opts || {};
    const rand = rng || Math.random;
    body.hp = Math.max(0, body.hp - roll.amount);
    body.bleed += roll.bleed;
    body.pain = Math.min(1, body.pain + roll.amount / 55);

    /* A punch marks somebody before it opens them. The first few leave
     * bruises; keep it up and the skin goes, which is the point at which a
     * fist fight starts producing blood. */
    let kind = roll.kind;
    let gore = roll.gore;
    if (kind === 'blunt') {
      body.bruised = (body.bruised || 0) + roll.amount;
      if (body.bruised > SPLIT_AT && rand() < 0.55) {
        // split. It is a small cut and it bleeds like one.
        kind = 'edged';
        gore = 0.2;
        body.bleed += 0.12 + rand() * 0.16;
        body.bruised -= SPLIT_AT * 0.5;
      }
    }

    const worthMarking = roll.bleed > 0.05 || roll.amount > 12
      || (roll.kind === 'blunt' && roll.amount > 4);
    if (worthMarking && body.wounds.length < 9) {
      body.wounds.push(makeWound(target.model, roll.zone, dirLocal, {
        kind: kind, gore: gore, power: o.power === undefined ? roll.amount * 1.6 : o.power,
        travel: o.travel, shaft: o.shaft, rng: rand
      }));
    }
    const severity = body.hp <= 0 ? 'fatal'
      : roll.amount > 34 || body.hp < 28 ? 'serious'
        : roll.amount > 14 ? 'wounded' : 'minor';
    if (body.hp <= 0 && !body.dying) {
      body.dying = true;
      body.deathTimer = 0.35 + (rng ? rng() : Math.random()) * 1.4;
    }
    return { severity: severity, amount: roll.amount, zone: roll.zone.id, roll: roll };
  }

  /* Bleeding is the other way to die. A blow that does not drop someone can
   * still finish them a minute later, which is why a dagger is dangerous. */
  function updateBody(actor, dt) {
    const body = actor.body;
    if (!body || body.dead) return null;
    body.pain = Math.max(0, body.pain - dt * 0.55);

    if (body.bleed > 0) {
      body.hp = Math.max(0, body.hp - body.bleed * dt);
      // it slows as it clots, unless the wound is wide open
      body.bleed = Math.max(0, body.bleed - dt * 0.055);
      for (let i = 0; i < body.wounds.length; i++) {
        const wd = body.wounds[i];
        wd.age += dt;
        if (wd.run < wd.maxRun) wd.run = Math.min(wd.maxRun, wd.run + dt * 1.4);
      }
      if (body.hp <= 0 && !body.dying) {
        body.dying = true;
        body.deathTimer = 0.6 + Math.random() * 1.2;
      }
    }

    if (body.dying && !body.dead) {
      body.deathTimer -= dt;
      if (body.deathTimer <= 0) {
        body.dead = true;
        // once the heart stops the bleeding stops with it
        body.bleed = 0;
        return 'died';
      }
    }
    return null;
  }

  function severityOf(body) {
    if (body.dead) return 'dead';
    if (body.dying) return 'dying';
    if (body.hp < 34 || body.bleed > 0.55) return 'serious';
    if (body.hp < 68) return 'wounded';
    return 'fine';
  }

  global.Combat = {
    WEAPONS, MELEE_IDS, ALL_IDS, ZONES, MAX_HP, BLOOD, BLOOD_DARK, BRUISE,
    DAY, SPLIT_AT,
    weapon, weaponParts, rollZone, rollDamage, zoneFor,
    createBody, applyDamage, updateBody, makeWound, woundParts, severityOf,
    advanceDay
  };
  void CM;
})(window);
