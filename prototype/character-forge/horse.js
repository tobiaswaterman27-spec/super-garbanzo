/* horse.js — procedural horses: breeding stock, model, gaits and ragdoll.
 *
 * A horse is built the same way a villager is: a seeded record of traits, a
 * bone tree generated from it, and poses that rotate the bones. The one thing
 * done differently is the skeleton's orientation. Every bone's mesh is defined
 * running along its own local +Y or -Y from its joint, exactly as the
 * character's arms hang from the shoulders, even though a horse is a
 * horizontal animal. That costs a couple of rotations in the standing pose and
 * buys the ragdoll for free: the fall solver only needs two joint positions per
 * bone to place it, so the same meshes serve both.
 */
(function (global) {
  'use strict';

  const R = global.Render;
  const G = global.Geo;
  const CM = global.CharacterModel;
  const Rig = global.Rig;

  const MAX_NAME_LENGTH = 15;

  /* ---------- breeding stock ---------- */

  // Coat, and the mane/tail that conventionally goes with it. Points are the
  // lower legs, muzzle and ear tips — on most horses they are darker than the
  // body, which is what stops a horse reading as one flat silhouette.
  const COATS = [
    { id: 'bay', label: 'Bay', body: '#7a4a26', mane: '#241812', points: '#2b1d14', weight: 5 },
    { id: 'chestnut', label: 'Chestnut', body: '#96522a', mane: '#b4753d', points: '#7b421f', weight: 4 },
    { id: 'liver', label: 'Liver chestnut', body: '#5e3320', mane: '#7a4a2c', points: '#4a2718', weight: 2 },
    { id: 'black', label: 'Black', body: '#2e2822', mane: '#1b1713', points: '#1b1713', weight: 3 },
    { id: 'seal', label: 'Seal brown', body: '#3e3026', mane: '#241b15', points: '#241b15', weight: 2 },
    { id: 'grey', label: 'Grey', body: '#9a9690', mane: '#c8c4bd', points: '#6d6a65', weight: 3 },
    { id: 'steel', label: 'Steel grey', body: '#6f7076', mane: '#4a4b50', points: '#45464b', weight: 2 },
    { id: 'dun', label: 'Dun', body: '#b08c55', mane: '#3a2d1e', points: '#3a2d1e', weight: 3 },
    { id: 'buckskin', label: 'Buckskin', body: '#c09a5c', mane: '#241812', points: '#2b1d14', weight: 2 },
    { id: 'palomino', label: 'Palomino', body: '#c79a52', mane: '#e6ddc4', points: '#a67f3f', weight: 2 },
    { id: 'cream', label: 'Cream', body: '#d6c49a', mane: '#e8e0cb', points: '#b3a37c', weight: 1 },
    { id: 'roan', label: 'Strawberry roan', body: '#a3705a', mane: '#6a4334', points: '#6a4334', weight: 2 },
    { id: 'white', label: 'White', body: '#ddd9d0', mane: '#ecebe5', points: '#b6b2a9', weight: 1 }
  ];

  // Size drives everything physical: how tall the model stands, how fast it
  // runs, and how hard it hits. A draught horse is not a fast pony.
  const SIZES = [
    { id: 'pony', label: 'Pony', scale: 0.74, power: 0.80, weight: 2 },
    { id: 'small', label: 'Small', scale: 0.88, power: 0.92, weight: 3 },
    { id: 'standard', label: 'Standard', scale: 1.0, power: 1.0, weight: 5 },
    { id: 'tall', label: 'Tall', scale: 1.1, power: 1.06, weight: 3 },
    { id: 'draught', label: 'Draught', scale: 1.22, power: 1.2, weight: 2 }
  ];

  const BREEDS = [
    { id: 'rouncey', label: 'Rouncey', speed: 0.5, stamina: 0.6, temper: 0.5, weight: 5 },
    { id: 'courser', label: 'Courser', speed: 0.85, stamina: 0.55, temper: 0.35, weight: 3 },
    { id: 'destrier', label: 'Destrier', speed: 0.7, stamina: 0.7, temper: 0.25, weight: 2 },
    { id: 'palfrey', label: 'Palfrey', speed: 0.6, stamina: 0.65, temper: 0.8, weight: 3 },
    { id: 'hackney', label: 'Hackney', speed: 0.55, stamina: 0.7, temper: 0.7, weight: 3 },
    { id: 'carthorse', label: 'Carthorse', speed: 0.3, stamina: 0.9, temper: 0.85, weight: 4 },
    { id: 'hobby', label: 'Hobby', speed: 0.75, stamina: 0.8, temper: 0.6, weight: 2 }
  ];

  // Face and leg white. Kept separate from the coat so a bay and a grey can
  // both turn up with a blaze and four socks.
  const MARKINGS = [
    { id: 'none', label: 'None', weight: 5 },
    { id: 'star', label: 'Star', weight: 3 },
    { id: 'stripe', label: 'Stripe', weight: 2 },
    { id: 'blaze', label: 'Blaze', weight: 3 },
    { id: 'snip', label: 'Snip', weight: 1 }
  ];

  const NAMES = [
    'Aldith', 'Ambrose', 'Arrow', 'Bayard', 'Bellows', 'Bracken', 'Briar',
    'Cinder', 'Clover', 'Copper', 'Dapple', 'Dunstan', 'Ember', 'Fallow',
    'Fenwick', 'Flint', 'Gallant', 'Gauntlet', 'Grimsby', 'Harrow', 'Hazel',
    'Hollow', 'Jasper', 'Juniper', 'Kestrel', 'Larkspur', 'Maple', 'Marrow',
    'Mortimer', 'Nettle', 'Oakwell', 'Pepper', 'Quill', 'Rowan', 'Rushlight',
    'Saffron', 'Sorrel', 'Sparrow', 'Starling', 'Tansy', 'Thistle', 'Thorn',
    'Tinder', 'Vesper', 'Willow', 'Wren', 'Bramble', 'Chalk', 'Dusty', 'Errant'
  ];

  function pickW(rng, list) {
    let total = 0;
    for (let i = 0; i < list.length; i++) total += list[i].weight || 1;
    let r = rng() * total;
    for (let i = 0; i < list.length; i++) {
      r -= list[i].weight || 1;
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function indexOf(list, id) {
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return 0;
  }

  function randomHorse(rng) {
    rng = rng || CM.makeRng((Math.random() * 0xffffffff) >>> 0);
    const coat = pickW(rng, COATS);
    const size = pickW(rng, SIZES);
    const breed = pickW(rng, BREEDS);
    const marking = pickW(rng, MARKINGS);

    // Attributes wander around the breed's baseline, so two coursers are not
    // the same horse. Age bends them: a young horse has not filled out and an
    // old one has lost a step.
    const age = 3 + Math.floor(rng() * 17);
    const prime = 1 - Math.min(1, Math.abs(age - 9) / 14) * 0.25;
    function roll(base, spread) {
      return Math.max(0.05, Math.min(1, base + (rng() - 0.5) * spread));
    }
    return {
      name: NAMES[Math.floor(rng() * NAMES.length)],
      coat: coat.id,
      size: size.id,
      breed: breed.id,
      marking: marking.id,
      socks: rng() < 0.42 ? 1 + Math.floor(rng() * 4) : 0,
      saddle: rng() < 0.55,
      saddleColour: rng() < 0.5 ? '#6b4526' : '#4b3220',
      age: age,
      speed: roll(breed.speed, 0.22) * prime,
      stamina: roll(breed.stamina, 0.22) * prime,
      temper: roll(breed.temper, 0.3)
    };
  }

  function resolve(h) {
    const coat = COATS[indexOf(COATS, h.coat)];
    const size = SIZES[indexOf(SIZES, h.size)];
    const breed = BREEDS[indexOf(BREEDS, h.breed)];
    return {
      coat: coat, size: size, breed: breed,
      body: coat.body,
      belly: CM.shade(coat.body, 0.12),
      mane: coat.mane,
      points: coat.points,
      hoof: '#3a3229',
      white: '#e4e0d6',
      saddle: h.saddleColour || '#6b4526',
      strap: '#3d2a18',
      brass: '#b08840'
    };
  }

  /* ---------- proportions ---------- */

  function dimensionsFor(h) {
    const size = SIZES[indexOf(SIZES, h.size)];
    return {
      bodyLen: 33,        // croup to chest, along the spine
      bodyW: 12.0,
      bodyH: 13.2,
      legY: 26,           // height of the shoulder/hip joints
      upperLeg: 13.5,
      lowerLeg: 10.5,
      hoofH: 2.4,
      legW: 3.7,
      neckLen: 12.5,
      neckW: 8.2,
      headLen: 12.5,
      headW: 5.8,
      headH: 7.2,
      tailLen: 13,
      scale: size.scale,
      power: size.power
    };
  }

  /* ---------- the model ---------- */

  function bone(name, origin) {
    return { name: name, origin: origin, rot: [0, 0, 0], parts: [], children: [] };
  }
  function part(mesh, colour) { return { mesh: mesh, colour: colour }; }

  const NECK_ANGLE = 0.95;   // radians up from the spine
  const HEAD_ANGLE = 1.05;   // radians forward off the neck, muzzle a touch low
  const TAIL_ANGLE = 1.95;

  function buildModel(h) {
    const d = dimensionsFor(h);
    const c = resolve(h);
    const root = bone('root', [0, 0, 0]);
    root.scale = d.scale;

    /* ---- barrel: croup at local y=0, chest at y=bodyLen ---- */
    const body = bone('body', [0, d.legY, -d.bodyLen / 2]);
    body.rot[0] = Math.PI / 2;   // local +Y now runs forward along +Z
    const halfW = d.bodyW / 2, halfH = d.bodyH / 2;
    // The barrel is deepest at the girth, just behind the shoulder, and
    // narrows to the loins — one taper each way rather than a single slab.
    body.parts.push(part(G.superellipsoid(0, d.bodyLen * 0.56, 0,
      halfW, d.bodyLen * 0.5, halfH, 0.66, 7, 12), c.body));
    body.parts.push(part(G.superellipsoid(0, d.bodyLen * 0.30, halfH * 0.42,
      halfW * 0.88, d.bodyLen * 0.30, halfH * 0.7, 0.7, 5, 10), c.belly));
    // withers, the ridge where the neck meets the back
    body.parts.push(part(G.superellipsoid(0, d.bodyLen * 0.88, -halfH * 0.52,
      halfW * 0.62, 4.6, halfH * 0.56, 0.7, 5, 9), c.body));
    // chest
    body.parts.push(part(G.superellipsoid(0, d.bodyLen * 0.97, halfH * 0.18,
      halfW * 0.82, 3.8, halfH * 0.82, 0.7, 5, 9), c.body));
    root.children.push(body);

    /* ---- neck and head ---- */
    const neck = bone('neck', [0, d.bodyLen * 0.9, -halfH * 0.5]);
    neck.rot[0] = -NECK_ANGLE;
    neck.parts.push(part(G.taper(-d.neckW / 2, -1.5, -d.neckW / 2 - 0.4,
      d.neckW, d.neckLen + 1.5, d.neckW + 0.8, 0.70), c.body));
    // crest: the mane lies along the top of the neck, not around it
    // throat, filling the hollow under the neck where the taper alone leaves
    // a hard corner
    neck.parts.push(part(G.superellipsoid(0, d.neckLen * 0.45, d.neckW * 0.3,
      d.neckW / 2 - 1.0, d.neckLen * 0.48, 2.0, 0.7, 5, 9), c.body));
    // The mane lies along the crest, and the crest moves inward as the neck
    // tapers. Pinning it at one z offset leaves it hanging off the back of the
    // neck like a fin, so it is laid down in segments that follow the taper.
    const NECK_TOP = 0.70;
    const crestBase = -(d.neckW + 0.8) / 2;
    for (let i = 0; i < 5; i++) {
      const t0 = i / 5, t1 = (i + 1) / 5;
      const zc = crestBase * (1 - t0 * (1 - NECK_TOP));
      const w = 3.6 - t0 * 1.1;
      neck.parts.push(part(G.slab(-w / 2, -1.0 + t0 * (d.neckLen + 1.2), zc - 1.1,
        w, (t1 - t0) * (d.neckLen + 1.2) + 0.5, 2.6, 0.75, 1), c.mane));
    }
    body.children.push(neck);

    const head = bone('head', [0, d.neckLen, 0]);
    head.rot[0] = HEAD_ANGLE;
    // A horse's head is a wedge: deep through the jowl where it meets the
    // neck, narrowing along the face to a blunt muzzle. Built as one rounded
    // mass plus a taper rather than a single box, or it reads as a brick.
    head.parts.push(part(G.superellipsoid(0, d.headLen * 0.22, 0.2,
      d.headW / 2 + 0.5, d.headLen * 0.3, d.headH / 2 + 0.4, 0.62, 6, 10), c.body));
    head.parts.push(part(G.taper(-d.headW / 2, d.headLen * 0.3, -d.headH / 2 + 0.2,
      d.headW, d.headLen * 0.62, d.headH - 0.4, 0.72), c.body));
    // muzzle and nostrils
    head.parts.push(part(G.superellipsoid(0, d.headLen * 0.95, -0.2,
      (d.headW - 1.6) / 2, 1.7, (d.headH - 1.8) / 2, 0.66, 4, 9), c.points));
    // jowl, the round cheek behind the eye
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      head.parts.push(part(G.superellipsoid(s2 * (d.headW / 2 - 0.5), d.headLen * 0.2, 0.6,
        1.5, 2.6, 2.4, 0.7, 4, 8), c.body));
    }
    // forelock, hanging between the ears
    head.parts.push(part(G.slab(-1.8, d.headLen * 0.02, -d.headH / 2 - 0.7,
      3.6, 3.8, 2.2, 0.7, 1), c.mane));
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      // ears, swept back off the poll
      head.parts.push(part(G.pyramid(s2 * 1.7 - 0.8, d.headLen * 0.02, -1.9,
        1.6, 3.2, 1.6), c.points));
      // eyes, set on the sides of the skull the way a prey animal's are
      head.parts.push(part(G.superellipsoid(s2 * (d.headW / 2 + 0.1), d.headLen * 0.3, -0.7,
        0.7, 1.0, 0.9, 0.6, 4, 7), '#17120e'));
    }
    // face white
    if (h.marking === 'blaze' || h.marking === 'stripe') {
      const w = h.marking === 'blaze' ? 2.8 : 1.3;
      head.parts.push(part(G.slab(-w / 2, d.headLen * 0.12, -d.headH / 2 - 0.45,
        w, d.headLen * 0.8, 1.1, 0.9, 1), c.white));
    } else if (h.marking === 'star') {
      head.parts.push(part(G.superellipsoid(0, d.headLen * 0.16, -d.headH / 2 - 0.2,
        1.4, 1.6, 0.8, 0.7, 4, 7), c.white));
    } else if (h.marking === 'snip') {
      head.parts.push(part(G.superellipsoid(0, d.headLen * 0.88, -d.headH / 2 + 0.4,
        1.1, 1.4, 0.8, 0.7, 4, 7), c.white));
    }
    neck.children.push(head);

    /* ---- tail ---- */
    const tail = bone('tail', [0, d.bodyLen * 0.06, -halfH * 0.55]);
    tail.rot[0] = TAIL_ANGLE;
    // dock, then a rope of hair. Narrow — a wide taper seen edge-on at this
    // camera angle reads as a plank nailed to the horse.
    tail.parts.push(part(G.superellipsoid(0, 1.4, 0, 1.7, 2.2, 1.7, 0.7, 4, 8), c.body));
    tail.parts.push(part(G.superellipsoid(0, d.tailLen * 0.42, 0,
      1.5, d.tailLen * 0.34, 1.5, 0.75, 5, 9), c.mane));
    tail.parts.push(part(G.superellipsoid(0, d.tailLen * 0.86, 0,
      1.1, d.tailLen * 0.3, 1.1, 0.75, 5, 9), c.mane));
    body.children.push(tail);

    /* ---- legs ---- */
    const legs = [
      ['legFL', -1, d.bodyLen * 0.34], ['legFR', 1, d.bodyLen * 0.34],
      ['legBL', -1, -d.bodyLen * 0.34], ['legBR', 1, -d.bodyLen * 0.34]
    ];
    for (let i = 0; i < legs.length; i++) {
      const name = legs[i][0], side = legs[i][1], z = legs[i][2];
      const rear = name[3] === 'B';
      const sock = h.socks > i;
      const upper = bone(name, [side * (d.bodyW / 2 - d.legW / 2 + 0.3), d.legY, z]);
      // haunch or shoulder mass at the top of the leg, then the cannon bone
      upper.parts.push(part(G.superellipsoid(0, -3.6, rear ? -1.4 : 0.5,
        d.legW / 2 + 1.1, 5.2, d.legW / 2 + (rear ? 2.4 : 1.2), 0.66, 5, 9), c.body));
      upper.parts.push(part(G.taper(-d.legW / 2, -d.upperLeg, -d.legW / 2,
        d.legW, d.upperLeg, d.legW, 1.18), c.body));
      root.children.push(upper);

      const lower = bone(name.replace('leg', 'shin'), [0, -d.upperLeg, 0]);
      const lw = d.legW * 0.68;
      lower.parts.push(part(G.superellipsoid(0, -0.4, 0,
        d.legW / 2 * 0.9, 1.6, d.legW / 2 * 0.9, 0.5, 3, 7), sock ? c.white : c.body));
      lower.parts.push(part(G.slab(-lw / 2, -d.lowerLeg, -lw / 2,
        lw, d.lowerLeg, lw, 0.9, 1), sock ? c.white : c.points));
      // fetlock and hoof
      lower.parts.push(part(G.superellipsoid(0, -d.lowerLeg + 0.4, 0,
        lw * 0.62, 1.4, lw * 0.62, 0.5, 3, 7), sock ? c.white : c.points));
      lower.parts.push(part(G.taper(-lw / 2 - 0.5, -d.lowerLeg - d.hoofH, -lw / 2 - 0.5,
        lw + 1.0, d.hoofH, lw + 1.0, 1.12), c.hoof));
      upper.children.push(lower);
    }

    /* ---- tack ---- */
    if (h.saddle) {
      const sy = d.legY + halfH * 0.72;
      const sz = d.bodyLen * 0.06;
      body.parts.push(part(G.superellipsoid(0, d.bodyLen * 0.56, -halfH * 0.86,
        halfW * 0.92, 5.2, 2.2, 0.4, 4, 9), c.saddle));
      // cantle and pommel, front and back of the seat
      body.parts.push(part(G.superellipsoid(0, d.bodyLen * 0.56 - 5.0, -halfH * 1.05,
        halfW * 0.7, 1.3, 2.0, 0.45, 3, 7), c.saddle));
      body.parts.push(part(G.superellipsoid(0, d.bodyLen * 0.56 + 5.0, -halfH * 1.02,
        halfW * 0.6, 1.2, 1.8, 0.45, 3, 7), c.saddle));
      // girth around the barrel
      body.parts.push(part(G.slab(-halfW - 0.2, d.bodyLen * 0.54, -halfH - 0.2,
        d.bodyW + 0.4, 2.0, d.bodyH + 0.4, 0.5, 1), c.strap));
      void sy; void sz;
      // stirrups
      for (let s = -1; s <= 1; s += 2) {
        body.parts.push(part(G.slab(s * halfW * 0.95 - 0.5, d.bodyLen * 0.54, -halfH * 0.4,
          1.0, 1.4, 5.6, 1, 1), c.strap));
        body.parts.push(part(G.slab(s * halfW * 0.95 - 1.2, d.bodyLen * 0.52, halfH * 0.22,
          2.4, 2.2, 1.0, 1, 1), c.brass));
      }
    }
    // bridle and reins — the reins are what the rider actually holds
    head.parts.push(part(G.slab(-d.headW / 2 - 0.2, d.headLen * 0.5, -d.headH / 2 - 0.2,
      d.headW + 0.4, 1.1, d.headH + 0.4, 0.6, 1), c.strap));
    head.parts.push(part(G.slab(-d.headW / 2 - 0.2, d.headLen * 0.16, -d.headH / 2 - 0.2,
      d.headW + 0.4, 1.0, d.headH + 0.4, 0.6, 1), c.strap));

    const bones = {};
    (function index(node) {
      bones[node.name] = node;
      for (let i = 0; i < node.children.length; i++) index(node.children[i]);
    })(root);

    return { root: root, bones: bones, dims: d, colours: c, horse: h };
  }

  /* ---------- where the rider sits ---------- */

  // In world units from the horse's own origin, before the model scale.
  function saddlePoint(model) {
    const d = model.dims;
    return {
      x: 0,
      y: (d.legY + d.bodyH * 0.5 + 1.6) * d.scale,
      z: d.bodyLen * 0.06 * d.scale
    };
  }

  function reinPoint(model) {
    const d = model.dims;
    return {
      y: (d.legY + d.bodyH * 0.42 + d.neckLen * 0.55) * d.scale,
      z: (d.bodyLen * 0.4 + 3) * d.scale
    };
  }


  /* ================= gaits ================= */

  const ANIM_FPS = 12;
  const YAW_STEPS = 16;
  const YAW_STEP = (Math.PI * 2) / YAW_STEPS;
  function quantiseTime(t) { return Math.floor(t * ANIM_FPS) / ANIM_FPS; }
  function quantiseYaw(y) { return Math.round(y / YAW_STEP) * YAW_STEP; }

  const LEGS = ['legFL', 'legFR', 'legBL', 'legBR'];
  const SHINS = ['shinFL', 'shinFR', 'shinBL', 'shinBR'];
  // Diagonal pairs: a horse moves front-left with hind-right. Getting this
  // wrong is the difference between a trot and a pantomime horse.
  const PHASE = { legFL: 0, legBR: 0, legFR: 0.5, legBL: 0.5 };

  function setRot(model, name, x, y, z) {
    const b = model.bones[name];
    if (!b) return;
    b.rot[0] = x || 0; b.rot[1] = y || 0; b.rot[2] = z || 0;
  }

  function clearPose(model) {
    for (const k in model.bones) {
      const r = model.bones[k].rot;
      r[0] = 0; r[1] = 0; r[2] = 0;
    }
    setRot(model, 'body', Math.PI / 2, 0, 0);
    setRot(model, 'neck', -NECK_ANGLE, 0, 0);
    setRot(model, 'head', HEAD_ANGLE, 0, 0);
    setRot(model, 'tail', TAIL_ANGLE, 0, 0);
    model.bob = 0;
  }

  const GAITS = {
    idle: { rate: 0.9, swing: 0.0, knee: 0.0, bob: 0.0, lift: 0, neck: 0 },
    walk: { rate: 4.4, swing: 0.30, knee: 0.34, bob: 0.5, lift: 0.10, neck: 0.05 },
    trot: { rate: 7.2, swing: 0.46, knee: 0.62, bob: 1.1, lift: 0.16, neck: 0.09 },
    gallop: { rate: 9.2, swing: 0.78, knee: 1.05, bob: 2.2, lift: 0.26, neck: 0.20 }
  };

  function poseGait(model, t, gait) {
    clearPose(model);
    const g = GAITS[gait] || GAITS.idle;
    const p = t * g.rate;

    if (gait === 'idle') {
      // breathing: the barrel lifts, the head nods, nothing else moves
      const breath = Math.sin(t * 1.5);
      model.bob = breath * 0.16;
      setRot(model, 'neck', -NECK_ANGLE + breath * 0.028, 0, 0);
      setRot(model, 'head', HEAD_ANGLE + Math.sin(t * 1.1) * 0.05, 0, 0);
      setRot(model, 'tail', TAIL_ANGLE + Math.sin(t * 0.7) * 0.09, 0, 0);
      return;
    }

    for (let i = 0; i < LEGS.length; i++) {
      const name = LEGS[i];
      const ph = (p + PHASE[name] * Math.PI * 2) % (Math.PI * 2);
      const swing = Math.sin(ph) * g.swing;
      // the knee only folds on the half of the cycle where the foot is off
      // the ground; a leg bending while it carries weight reads as a limp
      const fold = Math.max(0, Math.cos(ph)) * g.knee;
      const rear = name[3] === 'B';
      setRot(model, name, swing, 0, 0);
      setRot(model, SHINS[i], rear ? -fold * 0.8 : fold, 0, 0);
    }

    // At a gallop the whole animal gathers and extends, so the bob runs at
    // the stride rate rather than at twice it.
    const bobPhase = gait === 'gallop' ? p : p * 2;
    model.bob = Math.sin(bobPhase) * g.bob;
    const reach = Math.sin(p) * g.neck;
    setRot(model, 'neck', -NECK_ANGLE - Math.abs(reach) * 0.5 - g.lift * 0.3, 0, 0);
    setRot(model, 'head', HEAD_ANGLE + reach * 0.6, 0, 0);
    setRot(model, 'tail', TAIL_ANGLE - g.lift * 1.6 - Math.sin(p * 0.7) * 0.12, 0, 0);
  }

  // A horse pulling up short or refusing: front end comes off the ground.
  function poseRear(model, k) {
    clearPose(model);
    const lift = Math.sin(Math.min(1, k) * Math.PI) * 1.05;
    setRot(model, 'body', Math.PI / 2 - lift, 0, 0);
    setRot(model, 'legFL', -1.1 - lift * 0.4, 0, 0);
    setRot(model, 'legFR', -0.8 - lift * 0.5, 0, 0);
    setRot(model, 'shinFL', 1.3, 0, 0);
    setRot(model, 'shinFR', 1.0, 0, 0);
    setRot(model, 'neck', -NECK_ANGLE - lift * 0.3, 0, 0);
    model.bob = lift * 3;
  }

  /* ================= joints ================= */

  const JOINT_NAMES = [
    'croup', 'withers', 'poll', 'muzzle', 'tailTip',
    'rootFL', 'kneeFL', 'hoofFL', 'rootFR', 'kneeFR', 'hoofFR',
    'rootBL', 'kneeBL', 'hoofBL', 'rootBR', 'kneeBR', 'hoofBR'
  ];

  // Which bone each drawn segment runs along, and whether its mesh climbs the
  // bone's local +Y or hangs down -Y. Same contract as the character rig, so
  // the ragdoll can place every part from two points.
  const BONE_SEGMENTS = [
    { bone: 'body', from: 'croup', to: 'withers', axis: 1 },
    { bone: 'neck', from: 'withers', to: 'poll', axis: 1 },
    { bone: 'head', from: 'poll', to: 'muzzle', axis: 1 },
    { bone: 'tail', from: 'croup', to: 'tailTip', axis: 1 },
    { bone: 'legFL', from: 'rootFL', to: 'kneeFL', axis: -1 },
    { bone: 'shinFL', from: 'kneeFL', to: 'hoofFL', axis: -1 },
    { bone: 'legFR', from: 'rootFR', to: 'kneeFR', axis: -1 },
    { bone: 'shinFR', from: 'kneeFR', to: 'hoofFR', axis: -1 },
    { bone: 'legBL', from: 'rootBL', to: 'kneeBL', axis: -1 },
    { bone: 'shinBL', from: 'kneeBL', to: 'hoofBL', axis: -1 },
    { bone: 'legBR', from: 'rootBR', to: 'kneeBR', axis: -1 },
    { bone: 'shinBR', from: 'kneeBR', to: 'hoofBR', axis: -1 }
  ];

  const PARTICLE_R = {
    croup: 5.5, withers: 5.5, poll: 3.2, muzzle: 2.4, tailTip: 1.4,
    rootFL: 3.0, rootFR: 3.0, rootBL: 3.0, rootBR: 3.0,
    kneeFL: 2.0, kneeFR: 2.0, kneeBL: 2.0, kneeBR: 2.0,
    hoofFL: 1.8, hoofFR: 1.8, hoofBL: 1.8, hoofBR: 1.8
  };

  /* Walks the posed tree and reports where each named joint has ended up, in
   * world units with the hooves at y=0. */
  const _jp = [0, 0, 0];
  function jointPositions(model, yaw, tiltPitch, tiltRoll) {
    const d = model.dims;
    const scale = model.root.scale || 1;
    let base = R.rotationY(yaw);
    // Tilt about the hooves, so a get-up can aim at a body that is still on
    // its side rather than at one that is already standing.
    if (tiltPitch) base = R.multiply(base, R.rotationX(tiltPitch));
    if (tiltRoll) base = R.multiply(base, R.rotationZ(tiltRoll));
    base = R.multiply(base, R.scaling(scale));
    base = R.multiply(base, R.translation(0, model.bob || 0, 0));

    (function walk(node, parent) {
      let local = R.translation(node.origin[0], node.origin[1], node.origin[2]);
      if (node.rot[2]) local = R.multiply(local, R.rotationZ(node.rot[2]));
      if (node.rot[1]) local = R.multiply(local, R.rotationY(node.rot[1]));
      if (node.rot[0]) local = R.multiply(local, R.rotationX(node.rot[0]));
      node._m = R.multiply(parent, local);
      for (let i = 0; i < node.children.length; i++) walk(node.children[i], node._m);
    })(model.root, base);

    const out = {};
    function at(boneName, lx, ly, lz, key) {
      const b = model.bones[boneName];
      if (!b) return;
      R.transformPoint(b._m, lx, ly, lz, _jp);
      out[key] = [_jp[0], _jp[1], _jp[2]];
    }

    at('body', 0, 0, 0, 'croup');
    at('body', 0, d.bodyLen * 0.9, -d.bodyH * 0.25, 'withers');
    at('neck', 0, d.neckLen, 0, 'poll');
    at('head', 0, d.headLen, 0, 'muzzle');
    at('tail', 0, d.tailLen, 0, 'tailTip');
    const legs = ['FL', 'FR', 'BL', 'BR'];
    for (let i = 0; i < legs.length; i++) {
      at('leg' + legs[i], 0, 0, 0, 'root' + legs[i]);
      at('leg' + legs[i], 0, -d.upperLeg, 0, 'knee' + legs[i]);
      at('shin' + legs[i], 0, -d.lowerLeg - d.hoofH, 0, 'hoof' + legs[i]);
    }
    return out;
  }

  /* ================= ragdoll ================= */

  const LINKS = [
    ['croup', 'withers', 1], ['withers', 'poll', 1], ['poll', 'muzzle', 1],
    ['croup', 'tailTip', 0.5],
    ['withers', 'rootFL', 1], ['withers', 'rootFR', 1],
    ['croup', 'rootBL', 1], ['croup', 'rootBR', 1],
    ['rootFL', 'rootFR', 0.95], ['rootBL', 'rootBR', 0.95],
    ['rootFL', 'rootBL', 0.8], ['rootFR', 'rootBR', 0.8],
    ['croup', 'rootFL', 0.55], ['croup', 'rootFR', 0.55],
    ['withers', 'rootBL', 0.55], ['withers', 'rootBR', 0.55],
    ['rootFL', 'kneeFL', 1], ['kneeFL', 'hoofFL', 1],
    ['rootFR', 'kneeFR', 1], ['kneeFR', 'hoofFR', 1],
    ['rootBL', 'kneeBL', 1], ['kneeBL', 'hoofBL', 1],
    ['rootBR', 'kneeBR', 1], ['kneeBR', 'hoofBR', 1],
    // loose limits: a leg can fold, it cannot fold through the animal
    ['rootFL', 'hoofFL', 0.12], ['rootFR', 'hoofFR', 0.12],
    ['rootBL', 'hoofBL', 0.12], ['rootBR', 'hoofBR', 0.12],
    ['withers', 'tailTip', 0.1]
  ];

  const GRAVITY = 130;
  const SUBSTEP = 1 / 120;
  const ITERATIONS = 8;
  const MAX_STEP = 1.05;   // model units per 120Hz substep, ~126 units/second
  const STILL_TIME = 1.4;

  function createFall() {
    return { active: false, p: null, links: null, state: 'up', still: 0, rise: 0, timer: 0,
      risePitch: 0, riseRoll: 0, vol: null };
  }

  function knockDown(entity, dirX, dirY, force) {
    const f = entity.fall;
    const model = entity.model;
    poseGait(model, quantiseTime(entity.animTime), entity.gait === 'idle' ? 'idle' : entity.gait);
    const joints = jointPositions(model, entity.yaw);
    const len = Math.hypot(dirX, dirY) || 1;
    const px = dirX / len, pz = dirY / len;
    const p = {};
    const impulse = Math.max(1, Math.min(11, force)) * SUBSTEP * 4.4;

    for (let i = 0; i < JOINT_NAMES.length; i++) {
      const k = JOINT_NAMES[i];
      const j = joints[k];
      if (!j) continue;
      const q = { x: j[0], y: j[1], z: j[2], px: 0, py: 0, pz: 0, r: PARTICLE_R[k] || 2 };
      // The push goes in through the flank and the whole animal rolls with it,
      // so the top of the body travels further than the feet.
      const high = Math.max(0, Math.min(1, j[1] / 34));
      q.px = q.x - px * impulse * (0.5 + high);
      q.pz = q.z - pz * impulse * (0.5 + high);
      q.py = q.y - impulse * 0.12 * high;
      p[k] = q;
    }

    const links = [];
    for (let i = 0; i < LINKS.length; i++) {
      const a = LINKS[i][0], b = LINKS[i][1];
      if (!joints[a] || !joints[b]) continue;
      const dx = joints[a][0] - joints[b][0];
      const dy = joints[a][1] - joints[b][1];
      const dz = joints[a][2] - joints[b][2];
      links.push({ a: a, b: b, len: Math.hypot(dx, dy, dz), stiff: LINKS[i][2] });
    }

    // Centre the body on the entity before anything else. The solver works in
    // a local frame whose origin is the middle of the barrel, and hands back
    // how far that middle moved each step; if it does not start at zero, the
    // very first step hands back the model's own layout as if it were motion.
    recentre(p);

    f.p = p;
    f.links = links;
    f.active = true;
    f.state = 'falling';
    f.still = 0;
    f.rise = 0;
    f.timer = 0;
    entity.gait = 'idle';
    return true;
  }

  /* Midpoint of the barrel, in whatever frame the particles are currently in. */
  function bodyMid(p) {
    const c = p.croup, w = p.withers;
    return { x: (c.x + w.x) * 0.5, z: (c.z + w.z) * 0.5 };
  }

  function recentre(p) {
    const m = bodyMid(p);
    for (const k in p) {
      const q = p[k];
      q.x -= m.x; q.z -= m.z;
      q.px -= m.x; q.pz -= m.z;
    }
    return m;
  }


  /* ---------- solid body ---------- */

  /* The same problem the villagers had: the distance constraints are happy to
   * let a foreleg swing straight through the barrel, and every bone is drawn
   * as a box spanning two particles, so a segment crossing the body is a leg
   * visibly inside the horse. The barrel is an elliptical column along the
   * spine — a horse is far deeper than it is wide — plus a neck capsule, and
   * every limb is sampled along its length rather than only at the joints. */
  function bodyVolumes(d) {
    return {
      barrelW: d.bodyW / 2 + d.legW * 0.44,
      barrelH: d.bodyH / 2 + d.legW * 0.44,
      neckR: d.neckW * 0.5 + d.legW * 0.2,
      legR: d.legW * 0.5
    };
  }

  const LIMB_SEGMENTS = [
    { a: 'rootFL', b: 'kneeFL', root: true }, { a: 'kneeFL', b: 'hoofFL', root: false },
    { a: 'rootFR', b: 'kneeFR', root: true }, { a: 'kneeFR', b: 'hoofFR', root: false },
    { a: 'rootBL', b: 'kneeBL', root: true }, { a: 'kneeBL', b: 'hoofBL', root: false },
    { a: 'rootBR', b: 'kneeBR', root: true }, { a: 'kneeBR', b: 'hoofBR', root: false }
  ];

  const LIMB_PAIRS = [
    [['rootFL', 'kneeFL'], ['rootFR', 'kneeFR']], [['kneeFL', 'hoofFL'], ['kneeFR', 'hoofFR']],
    [['rootBL', 'kneeBL'], ['rootBR', 'kneeBR']], [['kneeBL', 'hoofBL'], ['kneeBR', 'hoofBR']],
    [['kneeFL', 'hoofFL'], ['kneeBL', 'hoofBL']], [['kneeFR', 'hoofFR'], ['kneeBR', 'hoofBR']]
  ];

  const _hf = { ox: 0, oy: 0, oz: 0, len: 1, ax: 0, ay: 0, az: 1,
    lx: 1, ly: 0, lz: 0, ux: 0, uy: 1, uz: 0 };

  /* Barrel frame: the spine runs croup to withers, the lateral axis across
   * the shoulders, and up is their cross product. Without a real frame the
   * barrel can only be a round tube, which either lets legs through at the
   * belly or holds them out at the flanks. */
  function barrelFrame(p) {
    const a = p.croup, b = p.withers;
    if (!a || !b) return null;
    let ax = b.x - a.x, ay = b.y - a.y, az = b.z - a.z;
    const al = Math.hypot(ax, ay, az);
    if (al < 1e-5) return null;
    ax /= al; ay /= al; az /= al;

    let lx = p.rootFL.x - p.rootFR.x, ly = p.rootFL.y - p.rootFR.y, lz = p.rootFL.z - p.rootFR.z;
    const dot = lx * ax + ly * ay + lz * az;
    lx -= ax * dot; ly -= ay * dot; lz -= az * dot;
    let ll = Math.hypot(lx, ly, lz);
    if (ll < 1e-4) {
      lx = Math.abs(ax) < 0.9 ? 1 : 0; ly = 0; lz = Math.abs(ax) < 0.9 ? 0 : 1;
      const d2 = lx * ax + ly * ay + lz * az;
      lx -= ax * d2; ly -= ay * d2; lz -= az * d2;
      ll = Math.hypot(lx, ly, lz) || 1;
    }
    lx /= ll; ly /= ll; lz /= ll;

    _hf.ox = a.x; _hf.oy = a.y; _hf.oz = a.z; _hf.len = al;
    _hf.ax = ax; _hf.ay = ay; _hf.az = az;
    _hf.lx = lx; _hf.ly = ly; _hf.lz = lz;
    _hf.ux = ay * lz - az * ly;
    _hf.uy = az * lx - ax * lz;
    _hf.uz = ax * ly - ay * lx;
    return _hf;
  }

  const _push = { x: 0, y: 0, z: 0 };

  function barrelEscape(fr, v, x, y, z) {
    const dx = x - fr.ox, dy = y - fr.oy, dz = z - fr.oz;
    const s = dx * fr.ax + dy * fr.ay + dz * fr.az;
    // Only the run of the barrel itself. The legs are rooted at its ends, so
    // testing them against those is the solver fighting the skeleton.
    if (s < fr.len * 0.16 || s > fr.len * 0.94) return false;
    const u = dx * fr.lx + dy * fr.ly + dz * fr.lz;
    const w = dx * fr.ux + dy * fr.uy + dz * fr.uz;
    const nu = u / v.barrelW, nw = w / v.barrelH;
    const m = Math.hypot(nu, nw);
    if (m >= 1) return false;
    const k = m < 1e-4 ? 1 : 1 / m;
    const eu = u * k - u, ew = w * k - w;
    _push.x = fr.lx * eu + fr.ux * ew;
    _push.y = fr.ly * eu + fr.uy * ew;
    _push.z = fr.lz * eu + fr.uz * ew;
    return true;
  }

  function capsuleEscape(a, b, r, x, y, z) {
    const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z;
    const len2 = bx * bx + by * by + bz * bz || 1e-6;
    let t = ((x - a.x) * bx + (y - a.y) * by + (z - a.z) * bz) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = a.x + bx * t, cy = a.y + by * t, cz = a.z + bz * t;
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const d = Math.hypot(dx, dy, dz);
    if (d >= r) return false;
    if (d < 1e-4) { _push.x = 0; _push.y = r; _push.z = 0; return true; }
    const k = (r - d) / d;
    _push.x = dx * k; _push.y = dy * k; _push.z = dz * k;
    return true;
  }

  const SAMPLES = [0.22, 0.45, 0.68, 0.86, 1.0];

  function separateLimbs(f, dims) {
    const p = f.p;
    const v = f.vol || (f.vol = bodyVolumes(dims));
    const fr = barrelFrame(p);

    for (let i = 0; i < LIMB_SEGMENTS.length; i++) {
      const seg = LIMB_SEGMENTS[i];
      const a = p[seg.a], b = p[seg.b];
      if (!a || !b) continue;
      let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0, any = false;
      for (let j = 0; j < SAMPLES.length; j++) {
        const t = SAMPLES[j];
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
        let ex = 0, ey = 0, ez = 0, hit = false;
        if (fr && barrelEscape(fr, v, x, y, z)) {
          ex += _push.x; ey += _push.y; ez += _push.z; hit = true;
        }
        if (!seg.root && capsuleEscape(p.withers, p.poll, v.neckR, x, y, z)) {
          ex += _push.x; ey += _push.y; ez += _push.z; hit = true;
        }
        if (!hit) continue;
        any = true;
        // a root end is welded to the body, so it only takes a token share
        const wa = seg.root ? (1 - t) * 0.45 : (1 - t);
        const wb = seg.root ? 1 : t;
        const sum = wa + wb || 1;
        ax += ex * wa / sum; ay += ey * wa / sum; az += ez * wa / sum;
        bx += ex * wb / sum; by += ey * wb / sum; bz += ez * wb / sum;
      }
      if (!any) continue;
      const n = SAMPLES.length;
      if (!seg.root) { a.x += ax / n; a.y += ay / n; a.z += az / n; }
      b.x += bx / n; b.y += by / n; b.z += bz / n;
    }

    // and the legs against each other, so they cannot scissor through
    for (let i = 0; i < LIMB_PAIRS.length; i++) {
      const A = LIMB_PAIRS[i][0], B = LIMB_PAIRS[i][1];
      const a0 = p[A[0]], a1 = p[A[1]], b0 = p[B[0]], b1 = p[B[1]];
      if (!a0 || !a1 || !b0 || !b1) continue;
      const want = v.legR * 2;
      const ux = a1.x - a0.x, uy = a1.y - a0.y, uz = a1.z - a0.z;
      const vx = b1.x - b0.x, vy = b1.y - b0.y, vz = b1.z - b0.z;
      const wx = a0.x - b0.x, wy = a0.y - b0.y, wz = a0.z - b0.z;
      const uu = ux * ux + uy * uy + uz * uz;
      const uv = ux * vx + uy * vy + uz * vz;
      const vv = vx * vx + vy * vy + vz * vz;
      const uw = ux * wx + uy * wy + uz * wz;
      const vw = vx * wx + vy * wy + vz * wz;
      const den = uu * vv - uv * uv;
      let sa, tb;
      if (den < 1e-8) { sa = 0; tb = vv < 1e-8 ? 0 : vw / vv; }
      else { sa = (uv * vw - vv * uw) / den; tb = (uu * vw - uv * uw) / den; }
      sa = sa < 0 ? 0 : sa > 1 ? 1 : sa;
      tb = tb < 0 ? 0 : tb > 1 ? 1 : tb;
      let dx = (a0.x + ux * sa) - (b0.x + vx * tb);
      let dy = (a0.y + uy * sa) - (b0.y + vy * tb);
      let dz = (a0.z + uz * sa) - (b0.z + vz * tb);
      let d = Math.hypot(dx, dy, dz);
      if (d >= want) continue;
      if (d < 1e-4) { dx = 1; dy = 0; dz = 0; d = 1; }
      const k = (want - d) / d * 0.5 * 0.6;
      const px = dx * k, py = dy * k, pz = dz * k;
      a0.x += px * (1 - sa); a0.y += py * (1 - sa); a0.z += pz * (1 - sa);
      a1.x += px * sa; a1.y += py * sa; a1.z += pz * sa;
      b0.x -= px * (1 - tb); b0.y -= py * (1 - tb); b0.z -= pz * (1 - tb);
      b1.x -= px * tb; b1.y -= py * tb; b1.z -= pz * tb;
    }
  }

  function simulate(f, dt, dims) {
    const p = f.p;
    const gStep = GRAVITY * dt * dt;
    for (const k in p) {
      const q = p[k];
      let vx = (q.x - q.px) * 0.992, vy = (q.y - q.py) * 0.992, vz = (q.z - q.pz) * 0.992;
      // A constraint resolving against a hoof the ground is holding can fling
      // a particle a long way in one substep. Capping the step keeps a hard
      // landing from turning into the horse being launched across the map.
      const sp = Math.hypot(vx, vy, vz);
      if (sp > MAX_STEP) { const s2 = MAX_STEP / sp; vx *= s2; vy *= s2; vz *= s2; }
      q.px = q.x; q.py = q.y; q.pz = q.z;
      q.x += vx; q.y += vy - gStep; q.z += vz;
    }
    for (let it = 0; it < ITERATIONS; it++) {
      for (let i = 0; i < f.links.length; i++) {
        const l = f.links[i];
        const a = p[l.a], b = p[l.b];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const dist = Math.hypot(dx, dy, dz) || 1e-6;
        if (l.stiff < 0.2 && dist >= l.len) continue;
        const k = ((dist - l.len) / dist) * 0.5 * l.stiff;
        a.x += dx * k; a.y += dy * k; a.z += dz * k;
        b.x -= dx * k; b.y -= dy * k; b.z -= dz * k;
      }
      separateLimbs(f, dims);
      for (const key in p) {
        const q = p[key];
        if (q.y < q.r * 0.34) {
          q.y = q.r * 0.34;
          q.px += (q.x - q.px) * 0.74;
          q.pz += (q.z - q.pz) * 0.74;
        }
      }
    }
  }

  function energy(f) {
    let e = 0;
    for (const k in f.p) {
      const q = f.p[k];
      e += (q.x - q.px) * (q.x - q.px) + (q.y - q.py) * (q.y - q.py) + (q.z - q.pz) * (q.z - q.pz);
    }
    return e;
  }

  const RISE_TIME = 1.9;
  const RISE_DRIFT = 6;    // model units per second a get-up may travel
  const FALL_DRIFT = 130;  // and a crash slide — under its own gallop speed

  /* Reads which way the animal is lying and points the get-up at that, rather
   * than at whatever heading it had before it went down. Dragging a prone
   * horse through a ninety degree turn each frame, against hooves the ground
   * friction is holding, is what made it plough across the field. */
  function beginRise(entity) {
    const f = entity.fall;
    const c = f.p.croup, w = f.p.withers;
    let ax = w.x - c.x, ay = w.y - c.y, az = w.z - c.z;
    const flat = Math.hypot(ax, az);
    if (flat > 0.4) entity.yaw = Math.atan2(ax, az);
    entity.targetYaw = entity.yaw;

    // how far the spine is from level, split into the animal's own pitch and
    // roll so the target starts lying down and eases upright
    const L = Math.hypot(ax, ay, az) || 1;
    ax /= L; ay /= L; az /= L;
    const cy = Math.cos(entity.yaw), sy = Math.sin(entity.yaw);
    const side = ax * cy - az * sy;
    f.risePitch = Math.atan2(ay, flat / L || 1e-6) - Math.PI / 2;
    f.riseRoll = Math.asin(Math.max(-1, Math.min(1, side)));
    const lean = Math.hypot(f.risePitch, f.riseRoll);
    if (lean > Math.PI / 2) {
      const sc = (Math.PI / 2) / lean;
      f.risePitch *= sc;
      f.riseRoll *= sc;
    }
  }

  function updateFall(entity, dt) {
    const f = entity.fall;
    if (!f.active || !f.p) return;

    let acc = Math.min(dt, 0.05);
    while (acc > 0) {
      const step = Math.min(SUBSTEP, acc);
      simulate(f, step, entity.model.dims);
      acc -= step;
    }

    /* Hand the body's drift back to the entity, so the world sees the horse
     * slide across the ground rather than the sprite sliding out of its own
     * position. Rate-limited: a crash can throw a horse a long way, but a horse
     * heaving itself upright travels barely at all, and without a limit the
     * solver's fight with the get-up pose reads as the animal dragging itself
     * across the field. Whatever is held back stays as particle offset and is
     * delivered over the following frames, so a real slide still arrives — it
     * just cannot arrive faster than a horse can move. */
    const m = bodyMid(f.p);
    const cap = (f.state === 'rising' ? RISE_DRIFT : FALL_DRIFT) * dt;
    const travelled = Math.hypot(m.x, m.z);
    let gx = m.x, gz = m.z;
    if (travelled > cap) {
      const scale = cap / travelled;
      gx = m.x * scale; gz = m.z * scale;
    }
    entity.x += gx;
    entity.y += gz;
    for (const key in f.p) {
      const q = f.p[key];
      q.x -= gx; q.z -= gz; q.px -= gx; q.pz -= gz;
    }

    if (f.state === 'falling') {
      // Either it has settled, or it has been thrashing long enough that it
      // is never going to — a horse pinballing off scenery for fifteen
      // seconds is a solver that will not converge, not an animal.
      f.timer += dt;
      f.still = energy(f) < 0.7 ? f.still + dt : 0;
      if (f.still > STILL_TIME || f.timer > 3.6) {
        f.state = 'rising';
        f.rise = 0;
        beginRise(entity);
      }
      return;
    }

    /* Getting up: a horse rolls onto its chest, gets its forelegs under it and
     * heaves. Pull the joints toward the standing pose, fastest at the end. */
    f.rise += dt / RISE_TIME;
    const k = Math.min(1, f.rise);
    const ease = k * k * (3 - 2 * k);
    poseGait(entity.model, 0, 'idle');
    const target = jointPositions(entity.model, entity.yaw,
      f.risePitch * (1 - ease), f.riseRoll * (1 - ease));
    // The standing pose has its own barrel midpoint, nowhere near the origin.
    // Pulling toward it uncentred means every single frame hands that offset
    // back as drift — which is a horse that walks itself across the field
    // while lying on its side.
    const tm = {
      x: (target.croup[0] + target.withers[0]) * 0.5,
      z: (target.croup[2] + target.withers[2]) * 0.5
    };
    for (const key in target) { target[key][0] -= tm.x; target[key][2] -= tm.z; }
    const pull = Math.min(1, dt * (1.6 + 8 * k));
    for (const key in f.p) {
      const q = f.p[key], t = target[key];
      if (!t) continue;
      const ty = Math.max(t[1], q.r * 0.34);
      const dx = (t[0] - q.x) * pull, dy = (ty - q.y) * pull, dz = (t[2] - q.z) * pull;
      q.x += dx; q.y += dy; q.z += dz;
      q.px += dx; q.py += dy; q.pz += dz;
    }
    separateLimbs(f, entity.model.dims);
    if (k >= 1) {
      let worst = 0;
      for (const key in f.p) {
        const q = f.p[key], t = target[key];
        if (!t) continue;
        const e = Math.hypot(t[0] - q.x, t[1] - q.y, t[2] - q.z);
        if (e > worst) worst = e;
      }
      if (worst < 0.8 || f.rise > 2.2) {
        f.active = false;
        f.state = 'up';
        f.p = null;
      }
    }
    void ease;
  }

  function isDown(entity) { return !!(entity.fall && entity.fall.active); }

  function drawRagdoll(target, model, camera, fall) {
    const p = fall.p;
    const scale = model.root.scale || 1;
    const scaleM = R.scaling(scale);
    const l = p.rootFL, r = p.rootFR;
    let lat = [l.x - r.x, l.y - r.y, l.z - r.z];
    const ll = Math.hypot(lat[0], lat[1], lat[2]);
    lat = ll < 1e-4 ? [1, 0, 0] : [lat[0] / ll, lat[1] / ll, lat[2] / ll];

    for (let i = 0; i < BONE_SEGMENTS.length; i++) {
      const seg = BONE_SEGMENTS[i];
      const bone = model.bones[seg.bone];
      const a = p[seg.from], b = p[seg.to];
      if (!bone || !a || !b) continue;
      const m = R.multiply(scaleM,
        Rig.segmentMatrix([a.x, a.y, a.z], [b.x, b.y, b.z], seg.axis, lat));
      for (let k = 0; k < bone.parts.length; k++) {
        const pt = bone.parts[k];
        R.drawMesh(target, m, pt.mesh, R.ramp(pt.colour), camera, pt);
      }
    }
  }

  /* ================= entity ================= */

  function createEntity(h, x, y, seed) {
    const model = buildModel(h);
    // parent links, so jointPositions can walk back up the chain
    (function link(node, parent) {
      node._parent = parent || null;
      for (let i = 0; i < node.children.length; i++) link(node.children[i], node);
    })(model.root, null);
    return {
      isHorse: true,
      horse: h,
      model: model,
      x: x, y: y,
      vx: 0, vy: 0,
      yaw: 0, targetYaw: 0,
      gait: 'idle',
      animTime: Math.random() * 10,
      rider: null,
      cart: null,
      hitCooldown: 0,
      wanderTimer: 1 + Math.random() * 4,
      wanderDir: 0,
      fall: createFall(),
      buffer: null,
      rng: CM.makeRng(seed === undefined ? (Math.random() * 0xffffffff) >>> 0 : seed),
      _key: ''
    };
  }

  // Top speed and shove force both scale with the animal. A draught horse at a
  // gallop is not the same collision as a pony at a trot.
  function topSpeed(h) {
    const size = SIZES[indexOf(SIZES, h.size)];
    return { walk: 46 + h.speed * 18, run: 150 + h.speed * 95 * size.power };
  }

  function power(h) {
    const size = SIZES[indexOf(SIZES, h.size)];
    return size.power * (0.85 + h.speed * 0.3);
  }

  function renderHorse(entity, target, camera, opts) {
    const f = entity.fall;
    const qYaw = quantiseYaw(entity.yaw);
    const qTime = quantiseTime(entity.animTime);
    const key = f.active ? null :
      [qTime, qYaw, entity.gait, entity.rider ? 1 : 0].join('|');
    if (key !== null && key === entity._key && !(opts && opts.force)) return target;
    entity._key = key === null ? '' : key;

    R.clearTarget(target);
    if (f.active && f.p) {
      drawRagdoll(target, entity.model, camera, f);
    } else {
      poseGait(entity.model, qTime, entity.gait);
      Rig.drawModel(target, entity.model, camera, { yaw: qYaw });
    }
    return target;
  }

  global.HorseModel = {
    MAX_NAME_LENGTH, COATS, SIZES, BREEDS, MARKINGS, NAMES, GAITS,
    randomHorse, resolve, dimensionsFor, buildModel, saddlePoint, reinPoint,
    indexOf, pickW, quantiseTime, quantiseYaw,
    clearPose, poseGait, poseRear, jointPositions, JOINT_NAMES, BONE_SEGMENTS,
    createFall, knockDown, updateFall, isDown, drawRagdoll,
    createEntity, topSpeed, power, renderHorse,
    NECK_ANGLE, HEAD_ANGLE, TAIL_ANGLE
  };
})(window);
