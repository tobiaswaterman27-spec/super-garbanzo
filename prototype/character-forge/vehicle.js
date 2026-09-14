/* vehicle.js — carts, the damage they take, and the wreckage they leave.
 *
 * A cart is built from a parts list rather than a finished mesh, so the three
 * damage stages are the same cart with planks removed, tilted or snapped
 * rather than three separately modelled wrecks. That is also what makes the
 * debris honest: a plank that falls off the deck is a plank that was on the
 * deck a moment ago, and the count that hits the ground at the end is the
 * count the cart was built from.
 */
(function (global) {
  'use strict';

  const G = global.Geo;
  const CM = global.CharacterModel;

  /* ---------- the three carts ---------- */

  const TYPES = {
    cart: {
      id: 'cart', label: 'Cart',
      wood: '#7d5c36', woodDark: '#5e441f', iron: '#4a4540',
      hp: 100, mass: 1, length: 30, width: 19, deckY: 11,
      sideH: 6.5, chest: false, cushion: false, frail: 1,
      drops: { plank: 8, wheel: 4 }
    },
    chestCart: {
      id: 'chestCart', label: 'Chest cart',
      wood: '#6f5330', woodDark: '#523b1c', iron: '#4a4540',
      hp: 130, mass: 1.25, length: 32, width: 20, deckY: 11,
      // low sides, so the chest is the thing you see rather than a box
      // peeking over a fence
      sideH: 5.0, chest: true, cushion: false, frail: 0.85,
      // a heavier body, plus whatever was in the chest
      drops: { plank: 12, wheel: 4, wheelLoose: 3 }
    },
    luxuryCart: {
      id: 'luxuryCart', label: 'Luxury carriage',
      wood: '#241f1d', woodDark: '#15110f', iron: '#3a3530', trim: '#a8842f',
      cushion: '#8e2230', cushionDark: '#6a1622',
      hp: 110, mass: 1.15, length: 32, width: 20, deckY: 12,
      // lighter build, finer joinery: it comes apart more readily
      sideH: 10.5, chest: false, cushions: true, frail: 1.25,
      drops: { plank: 8, wheel: 4, leather: 4, feather: 6 }
    }
  };

  /* A wheel is a prism, not an ellipsoid. A superellipsoid squashed along one
   * axis gives a lens — round from the side, pointed at the rim — and at this
   * resolution that reads as a block under the cart rather than as a wheel.
   * Twelve flat faces around the rim is what makes it turn into a circle. */
  function wheelMesh(cx, cy0, cz0, radius, halfWidth, sides) {
    const verts = [];
    const faces = [];
    const n = sides || 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cy = cy0 + Math.cos(a) * radius, cz = cz0 + Math.sin(a) * radius;
      verts.push(cx - halfWidth, cy, cz);
      verts.push(cx + halfWidth, cy, cz);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push([i * 2, j * 2, j * 2 + 1, i * 2 + 1]);   // rim
    }
    const left = [], right = [];
    for (let i = 0; i < n; i++) { left.push(i * 2); right.push(i * 2 + 1); }
    faces.push(left);
    faces.push(right.slice().reverse());
    return G.finish(verts, faces);
  }

  /* A cartwheel is an iron tyre over a wooden felloe, spokes, and a hub that
   * stands proud of both faces. Built in that order so the spokes read as
   * spokes: they have to span from the hub out to the rim with daylight
   * between them, not sit as four studs on a disc. */
  function wheelParts(x, y, z, radius, halfWidth, rim, iron) {
    const out = [];
    const hubR = radius * 0.26;
    const rimIn = radius * 0.80;

    // iron tyre, then the felloe just inside it
    out.push({ mesh: ringMesh(x, y, z, radius, radius * 0.90, halfWidth * 0.62, 12),
      colour: iron, tag: 'wheel' });
    out.push({ mesh: ringMesh(x, y, z, radius * 0.92, rimIn, halfWidth, 12),
      colour: rim, tag: 'wheel' });

    // spokes, hub to felloe
    const SPOKES = 8;
    for (let k = 0; k < SPOKES; k++) {
      const a = (k / SPOKES) * Math.PI * 2 + Math.PI / SPOKES;
      const ca = Math.cos(a), sa = Math.sin(a);
      const mid = (hubR + rimIn) * 0.5;
      const len = rimIn - hubR;
      out.push({
        mesh: spokeMesh(x, y + ca * mid, z + sa * mid, halfWidth * 0.52,
          len * 0.5, 0.62, a),
        colour: rim, tag: 'wheel'
      });
    }

    // hub, standing proud of both faces, with an iron band round it
    out.push({ mesh: wheelMesh(x, y, z, hubR, halfWidth * 1.55, 10), colour: rim, tag: 'wheel' });
    out.push({ mesh: wheelMesh(x, y, z, hubR * 0.78, halfWidth * 1.75, 8), colour: iron, tag: 'wheel' });
    return out;
  }

  /* An annulus: the rim with a hole in it, so you can see through the spokes. */
  function ringMesh(cx, cy0, cz0, outer, inner, halfWidth, sides) {
    const verts = [];
    const faces = [];
    const n = sides || 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      verts.push(cx - halfWidth, cy0 + ca * outer, cz0 + sa * outer);
      verts.push(cx + halfWidth, cy0 + ca * outer, cz0 + sa * outer);
      verts.push(cx - halfWidth, cy0 + ca * inner, cz0 + sa * inner);
      verts.push(cx + halfWidth, cy0 + ca * inner, cz0 + sa * inner);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a0 = i * 4, b0 = j * 4;
      faces.push([a0, b0, b0 + 1, a0 + 1]);             // outer rim
      faces.push([a0 + 2, a0 + 3, b0 + 3, b0 + 2]);     // inner bore
      faces.push([a0, a0 + 2, b0 + 2, b0]);             // left face
      faces.push([a0 + 1, b0 + 1, b0 + 3, a0 + 3]);     // right face
    }
    return G.finish(verts, faces);
  }

  /* One spoke, a slim bar lying in the wheel's plane at the given angle. */
  function spokeMesh(cx, cy, cz, halfWidth, halfLen, halfThick, angle) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const verts = [];
    const faces = [];
    for (let i = 0; i < 4; i++) {
      const u = (i & 1) ? halfLen : -halfLen;
      const v = (i & 2) ? halfThick : -halfThick;
      const py = cy + ca * u - sa * v;
      const pz = cz + sa * u + ca * v;
      verts.push(cx - halfWidth, py, pz);
      verts.push(cx + halfWidth, py, pz);
    }
    const q = [0, 2, 6, 4];
    faces.push([q[0], q[1], q[2], q[3]]);
    faces.push([q[3] + 1, q[2] + 1, q[1] + 1, q[0] + 1]);
    for (let i = 0; i < 4; i++) {
      const a0 = q[i], b0 = q[(i + 1) % 4];
      faces.push([a0, b0, b0 + 1, a0 + 1]);
    }
    return G.finish(verts, faces);
  }

  /* ---------- parts, tagged so damage can take them away ---------- */

  function part(mesh, colour, tag) {
    return { mesh: mesh, colour: colour, tag: tag || 'frame' };
  }

  /* Builds the full cart. `stage` 0-2 is how battered it is: planks go
   * missing, the sides sag and the ironwork shows through. */
  function buildParts(type, stage, rng) {
    const t = TYPES[type];
    const parts = [];
    const L = t.length, W = t.width, deck = t.deckY;
    const halfL = L / 2, halfW = W / 2;

    // Which deck planks and side boards have been knocked out. Seeded off the
    // cart so a given cart loses the same boards each time it is redrawn.
    const gone = {};
    if (stage > 0) {
      const n = stage === 1 ? 2 : 5;
      for (let i = 0; i < n; i++) gone['d' + Math.floor(rng() * 7)] = true;
      for (let i = 0; i < stage * 2; i++) gone['s' + Math.floor(rng() * 8)] = true;
    }

    /* chassis rails — these never break off; without them there is no cart */
    for (let s = -1; s <= 1; s += 2) {
      parts.push(part(G.box(s * (halfW - 1.6) - 0.9, deck - 2.2, -halfL, 1.8, 2.2, L),
        t.woodDark, 'frame'));
    }
    // axles
    for (let i = 0; i < 2; i++) {
      const z = i ? halfL - 5.5 : -halfL + 5.5;
      parts.push(part(G.box(-halfW - 1.0, deck - 3.4, z - 1.0, W + 2.0, 1.9, 2.0),
        t.iron, 'frame'));
    }

    /* deck planks, laid across the rails */
    const planks = 7;
    for (let i = 0; i < planks; i++) {
      if (gone['d' + i]) continue;
      const z = -halfL + 1.2 + (i + 0.5) * ((L - 2.4) / planks);
      const sag = stage > 1 && (i % 3 === 0) ? -0.9 : 0;
      parts.push(part(G.box(-halfW + 0.6, deck + sag, z - (L - 2.4) / planks / 2 + 0.25,
        W - 1.2, 1.1, (L - 2.4) / planks - 0.5), t.wood, 'plank'));
    }

    /* sideboards */
    const boards = t.cushions ? 3 : 2;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < boards; i++) {
        const idx = (s > 0 ? 0 : 4) + i;
        if (gone['s' + idx]) continue;
        const y = deck + 1.1 + i * (t.sideH / boards);
        const lean = stage > 1 && i === boards - 1 ? 0.8 : 0;
        parts.push(part(G.box(s * (halfW - 1.2) - 0.7 - lean * s, y, -halfL + 1.0,
          1.4, t.sideH / boards - 0.3, L - 2.0), t.wood, 'plank'));
      }
    }
    // front and tail boards
    for (let e = -1; e <= 1; e += 2) {
      if (stage > 1 && e > 0) continue;   // the tailgate is the first thing to go
      parts.push(part(G.box(-halfW + 0.8, deck + 1.1, e * (halfL - 1.4) - 0.7,
        W - 1.6, t.sideH - 0.4, 1.4), t.wood, 'plank'));
    }

    /* type-specific fittings */
    if (t.chest) {
      /* Planked box, a domed lid banded in iron, corner straps, a hasp and a
       * lockplate. A plain cube on the deck reads as a crate; it is the
       * curved lid and the ironwork that say chest. */
      const cw = W - 5.0, cl = 13, ch = 8.6;
      const cz = -cl / 2 - 1.5;
      const body = stage > 1 ? t.woodDark : '#5a4227';
      const band = '#3b3530';
      const brass = '#9c7b32';
      const y0 = deck + 1.1;
      parts.push(part(G.box(-cw / 2, y0, cz, cw, ch, cl), body, 'chest'));
      // vertical plank grooves down the front and back
      for (let i = -1; i <= 1; i++) {
        parts.push(part(G.box(i * cw * 0.26 - 0.3, y0 + 0.4, cz - 0.28, 0.6, ch - 0.8, 0.4),
          '#4a3620', 'chest'));
        parts.push(part(G.box(i * cw * 0.26 - 0.3, y0 + 0.4, cz + cl - 0.12, 0.6, ch - 0.8, 0.4),
          '#4a3620', 'chest'));
      }
      // iron corner straps
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = 0; sz <= 1; sz++) {
          parts.push(part(G.box(sx * (cw / 2 - 0.9) - 0.45, y0, cz + sz * (cl - 0.9) - 0.2,
            0.9, ch, 1.1), band, 'chest'));
        }
      }
      // domed lid: three courses, each narrower and taller than the last
      const tilt = stage > 1 ? 2.2 : 0;
      const lid = [[1.00, 1.5], [0.88, 1.3], [0.68, 1.1], [0.40, 0.8]];
      let ly = y0 + ch + tilt;
      for (let i = 0; i < lid.length; i++) {
        const f = lid[i][0], hgt = lid[i][1];
        parts.push(part(G.box(-cw / 2 * f - 0.3, ly, cz + (cl * (1 - f)) / 2 - 0.3,
          cw * f + 0.6, hgt, cl * f + 0.6), i === 0 ? '#4a3620' : body, 'chest'));
        ly += hgt;
      }
      // the band over the crown of the lid, and the hasp and lock at the front
      parts.push(part(G.box(-cw * 0.09, y0 + ch + tilt, cz - 0.4,
        cw * 0.18, ly - (y0 + ch + tilt), cl + 0.8), band, 'chest'));
      parts.push(part(G.box(-1.5, y0 + ch - 2.4 + tilt * 0.4, cz - 0.55, 3.0, 3.0, 0.7),
        brass, 'chest'));
      parts.push(part(G.box(-0.8, y0 + ch - 3.4 + tilt * 0.4, cz - 0.75, 1.6, 1.6, 0.5),
        band, 'chest'));
    }
    if (t.cushions) {
      // a bench with padded cushions, and gilt trim along the top rail
      const by = deck + 1.1;
      parts.push(part(G.box(-W / 2 + 2.2, by, -halfL + 4, W - 4.4, 4.0, 9), t.woodDark, 'frame'));
      if (stage < 2) {
        parts.push(part(G.superellipsoid(0, by + 5.2, -halfL + 8.5,
          (W - 5.6) / 2, 1.9, 4.6, 0.42, 4, 8), t.cushion, 'cushion'));
        parts.push(part(G.superellipsoid(0, by + 8.2, -halfL + 4.6,
          (W - 6.4) / 2, 3.2, 1.7, 0.42, 4, 8), stage ? t.cushionDark : t.cushion, 'cushion'));
      } else {
        // burst: the stuffing is out and only the base pad is left
        parts.push(part(G.box(-(W - 7) / 2, by + 4.2, -halfL + 5.5, W - 7, 1.6, 6), t.cushionDark, 'cushion'));
      }
      for (let s = -1; s <= 1; s += 2) {
        parts.push(part(G.box(s * (halfW - 1.3) - 0.75, deck + t.sideH + 0.8, -halfL + 1.2,
          1.5, 1.0, L - 2.4), t.trim, 'frame'));
      }
    }

    /* wheels — four, and they stay on until the cart breaks */
    const wheelR = 7.6;
    for (let i = 0; i < 4; i++) {
      const s = i % 2 ? 1 : -1;
      const z = i < 2 ? -halfL + 5.5 : halfL - 5.5;
      // a stage-2 cart rides on a buckled wheel, sitting lower on that corner
      const wobble = stage > 1 && i === 3 ? 1.6 : 0;
      const ws = wheelParts(s * (halfW + 1.2), deck - 3.4 + wobble, z,
        wheelR * (stage > 1 && i === 3 ? 0.88 : 1), 1.5, t.woodDark, t.iron);
      for (let k = 0; k < ws.length; k++) parts.push(ws[k]);
    }

    /* shafts running forward to the horse */
    for (let s = -1; s <= 1; s += 2) {
      parts.push(part(G.box(s * (halfW - 3.5) - 0.75, deck - 1.4, halfL - 1, 1.5, 1.5, 15),
        t.woodDark, 'frame'));
    }
    return parts;
  }

  /* ---------- debris ---------- */

  const DEBRIS = {
    plank: { label: 'Plank', colour: '#7d5c36', w: 9, h: 1.1, d: 2.4 },
    wheel: { label: 'Wheel', colour: '#5e441f', r: 6.4 },
    leather: { label: 'Leather', colour: '#6b4526', w: 5.5, h: 0.8, d: 4.2 },
    feather: { label: 'Feathers', colour: '#e0d9c6', w: 2.6, h: 0.7, d: 1.8 }
  };

  function debrisMesh(kind) {
    const d = DEBRIS[kind];
    if (kind === 'wheel') {
      return wheelParts(0, 0, 0, d.r, 1.4, d.colour, '#4a4540');
    }
    if (kind === 'feather') {
      return [{ mesh: G.superellipsoid(0, 0, 0, d.w / 2, d.h / 2, d.d / 2, 0.55, 3, 7), colour: d.colour }];
    }
    return [{ mesh: G.box(-d.w / 2, -d.h / 2, -d.d / 2, d.w, d.h, d.d), colour: d.colour }];
  }

  /* What a cart throws out when it finally comes apart. Deliberately a fixed
   * list per type rather than "whatever is left", so breaking a cart always
   * yields the same haul. */
  function wreckage(type) {
    const drops = TYPES[type].drops;
    const out = [];
    for (const kind in drops) {
      const n = drops[kind];
      const k = kind === 'wheelLoose' ? 'wheel' : kind;
      for (let i = 0; i < n; i++) out.push(k);
    }
    return out;
  }

  function stageFor(hp, maxHp) {
    const f = hp / maxHp;
    if (f > 0.66) return 0;
    if (f > 0.33) return 1;
    return 2;
  }

  function create(type, x, y, seed) {
    const t = TYPES[type];
    return {
      type: type,
      def: t,
      x: x, y: y,
      vx: 0, vy: 0,
      yaw: 0,
      hp: t.hp,
      maxHp: t.hp,
      stage: 0,
      hitFlash: 0,
      hitCooldown: 0,
      shedPlanks: 0,      // planks already shaken loose, so each stage sheds once
      broken: false,
      hitch: null,        // the horse pulling it
      rider: null,
      sprite: null,
      spriteStage: -1,
      rng: CM.makeRng(seed === undefined ? (Math.random() * 0xffffffff) >>> 0 : seed),
      seed: seed === undefined ? 1 : seed
    };
  }

  global.Vehicle = {
    TYPES, DEBRIS, buildParts, debrisMesh, wreckage, stageFor, create,
    wheelMesh, ringMesh, spokeMesh, wheelParts
  };
})(window);
