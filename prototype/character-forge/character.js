/* character.js — the character record and the box model built from it.
 *
 * A character is a flat bag of traits. buildModel() turns that bag into a bone
 * tree; the face is rebuilt each frame from live state so blinking and mouth
 * shapes cost nothing structural.
 */
(function (global) {
  'use strict';

  const P = global.Parts;

  /* ---------- seeded randomness ---------- */

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, list) { return list[Math.floor(rng() * list.length) % list.length]; }

  function pickWeighted(rng, list, weightOf) {
    let total = 0;
    const weights = new Array(list.length);
    for (let i = 0; i < list.length; i++) {
      const w = Math.max(0.02, weightOf(list[i]));
      weights[i] = w;
      total += w;
    }
    let r = rng() * total;
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function indexOfId(list, id) {
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return 0;
  }

  /* ---------- the character record ---------- */

  const MAX_NAME_LENGTH = 15;

  function sanitiseName(raw) {
    let name = String(raw === undefined || raw === null ? '' : raw);
    name = name.replace(/[^A-Za-z' -]/g, '');
    name = name.replace(/\s+/g, ' ').replace(/^[\s'-]+/, '');
    return name.slice(0, MAX_NAME_LENGTH);
  }

  function defaultCharacter() {
    return {
      name: 'Aldric',
      surname: 'Blackwood',
      sex: 'male',
      skin: 'fair',
      hairStyle: 'crop',
      hairColour: 'darkbrown',
      moustache: 'none',
      beard: 'stubble',
      eyeColour: 'brown',
      eyeShape: 'even',
      brow: 'flat',
      nose: 'straight',
      mouthWidth: 0.5,
      height: 0.5,
      build: 0.5,
      garment: 'tunic',
      tunicColour: 'walnut',
      trouserColour: 'bark',
      bootColour: 'brown',
      leftHanded: false
    };
  }

  function randomCharacter(rng, forcedSex) {
    rng = rng || makeRng((Math.random() * 0xffffffff) >>> 0);
    const sex = forcedSex || (rng() < 0.5 ? 'male' : 'female');
    const female = sex === 'female';

    const hair = pickWeighted(rng, P.HAIR_STYLES, function (s) {
      return female ? s.femaleBias : 1 - s.femaleBias;
    });

    // Facial hair is only rolled for male characters; the creator still exposes
    // every option to the player whatever they picked.
    let beard = 'none', moustache = 'none';
    if (!female) {
      beard = pickWeighted(rng, P.BEARDS, function (s) { return s.maleBias; }).id;
      // a full or long beard nearly always comes with a moustache
      const heavy = beard === 'full' || beard === 'long';
      moustache = pickWeighted(rng, P.MOUSTACHES, function (s) {
        if (heavy && s.id === 'none') return 0.04;
        return s.maleBias;
      }).id;
    }

    const garment = pickWeighted(rng, P.GARMENTS, function (g) {
      return female ? g.femaleBias : 1 - g.femaleBias;
    });

    const names = female ? P.FEMALE_NAMES : P.MALE_NAMES;

    return {
      name: sanitiseName(pick(rng, names)),
      surname: pick(rng, P.SURNAMES),
      sex: sex,
      skin: pick(rng, P.SKIN_TONES).id,
      hairStyle: hair.id,
      hairColour: pick(rng, P.HAIR_COLOURS).id,
      moustache: moustache,
      beard: beard,
      eyeColour: pick(rng, P.EYE_COLOURS).id,
      eyeShape: pick(rng, P.EYE_SHAPES).id,
      brow: pick(rng, P.BROW_SHAPES).id,
      nose: pick(rng, P.NOSE_SHAPES).id,
      mouthWidth: 0.2 + rng() * 0.7,
      height: rng(),
      build: rng(),
      garment: garment.id,
      tunicColour: pick(rng, P.CLOTH_COLOURS).id,
      trouserColour: pick(rng, P.CLOTH_COLOURS).id,
      bootColour: pick(rng, P.LEATHER_COLOURS).id
    };
  }

  function randomName(rng, sex) {
    rng = rng || makeRng((Math.random() * 0xffffffff) >>> 0);
    return sanitiseName(pick(rng, sex === 'female' ? P.FEMALE_NAMES : P.MALE_NAMES));
  }

  /* ---------- resolving traits to values ---------- */

  function hexOf(list, id) { return list[indexOfId(list, id)].hex; }
  function entryOf(list, id) { return list[indexOfId(list, id)]; }

  function shade(hex, amount) {
    const rgb = global.Render.hexToRgb(hex);
    const target = amount < 0 ? [14, 16, 24] : [255, 250, 236];
    const out = global.Render.mixRgb(rgb, target, Math.abs(amount));
    return '#' + out.map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function resolve(ch) {
    const skin = hexOf(P.SKIN_TONES, ch.skin);
    const hair = hexOf(P.HAIR_COLOURS, ch.hairColour);
    const tunic = hexOf(P.CLOTH_COLOURS, ch.tunicColour);
    const boot = hexOf(P.LEATHER_COLOURS, ch.bootColour);
    return {
      skin: skin,
      skinDark: shade(skin, -0.3),
      skinDeep: shade(skin, -0.48),
      skinLight: shade(skin, 0.16),
      // the white of the eye picks up the skin tone, otherwise it glares on
      // darker complexions
      sclera: shade(shade(skin, 0.72), 0.2),
      // The mouth gets its own near-black rather than a shade of skin. A
      // darker skin tone is still a skin tone, and against the face it read as
      // a smudge instead of an opening.
      mouth: '#2a1618',
      lip: shade(skin, 0.3),
      hair: hair,
      hairDark: shade(hair, -0.2),
      eye: hexOf(P.EYE_COLOURS, ch.eyeColour),
      tunic: tunic,
      tunicDark: shade(tunic, -0.22),
      tunicLight: shade(tunic, 0.1),
      trouser: hexOf(P.CLOTH_COLOURS, ch.trouserColour),
      boot: boot,
      belt: shade(boot, -0.14),
      brass: P.BRASS,
      eyeShape: entryOf(P.EYE_SHAPES, ch.eyeShape),
      brow: entryOf(P.BROW_SHAPES, ch.brow),
      nose: entryOf(P.NOSE_SHAPES, ch.nose),
      hairStyle: entryOf(P.HAIR_STYLES, ch.hairStyle),
      moustache: entryOf(P.MOUSTACHES, ch.moustache || 'none'),
      beard: entryOf(P.BEARDS, ch.beard || 'none'),
      garment: entryOf(P.GARMENTS, ch.garment)
    };
  }

  /* ---------- dimensions ---------- */

  function dimensionsFor(ch) {
    const male = ch.sex === 'male';
    const bulk = 0.9 + ch.build * 0.26;
    const garment = entryOf(P.GARMENTS, ch.garment);

    return {
      male: male,
      headW: 8, headH: 8, headD: 7.4, neckH: 1.7,
      torsoH: male ? 11.4 : 10.9,
      torsoW: (male ? 7.5 : 6.8) * bulk,
      torsoD: (male ? 4.4 : 4.1) * bulk,
      hipW: (male ? 6.9 : 7.2) * bulk,
      armW: (male ? 3.0 : 2.6) * bulk,
      upperArmH: 5.3, lowerArmH: 4.9,
      legW: (male ? 3.5 : 3.2) * bulk,
      upperLegH: 5.8, lowerLegH: 5.6,
      legTotal: 11.4,
      // a long skirt restrains the stride; hose does not
      // A skirt both hides and restrains the legs; without shortening the
      // stride the thigh swings straight out through the cloth.
      legSwing: garment.skirt > 6 ? 0.34 : (garment.skirt > 0 ? 0.62 : 1),
      heightScale: (male ? 1 : 0.955) * (0.9 + ch.height * 0.2)
    };
  }

  /* ---------- the box model ---------- */

  function bone(name, origin) {
    return { name: name, origin: origin, rot: [0, 0, 0], parts: [], children: [] };
  }

  function part(mesh, colour, opts) {
    const p = { mesh: mesh, colour: colour };
    if (opts) { for (const k in opts) p[k] = opts[k]; }
    return p;
  }

  function buildModel(ch) {
    const d = dimensionsFor(ch);
    const c = resolve(ch);
    const g = c.garment;
    const B = P.box;
    const G = global.Geo;

    const root = bone('root', [0, 0, 0]);
    root.scale = d.heightScale;

    const pelvis = bone('pelvis', [0, d.legTotal, 0]);
    root.children.push(pelvis);

    /* ---- torso ---- */
    const torso = bone('torso', [0, 0, 0]);
    torso.parts.push(part(
      B(-d.torsoW / 2, 0, -d.torsoD / 2, d.torsoW, d.torsoH, d.torsoD), c.tunic));

    // neckline: a darker band where the tunic opens at the throat
    torso.parts.push(part(
      B(-d.torsoW / 2 - 0.12, d.torsoH - 1.6, -d.torsoD / 2 - 0.12,
        d.torsoW + 0.24, 1.5, d.torsoD + 0.24), c.tunicDark));
    // neck
    torso.parts.push(part(
      B(-1.5, d.torsoH - 0.3, -1.4, 3.0, d.neckH + 0.5, 2.8), c.skin));

    if (g.tabard) {
      // surcoat panels hanging front and back over the tunic
      torso.parts.push(part(
        B(-d.torsoW * 0.34, 1.2, d.torsoD / 2 - 0.05, d.torsoW * 0.68, d.torsoH - 3.0, 0.5), c.tunicDark));
      torso.parts.push(part(
        B(-d.torsoW * 0.34, 1.2, -d.torsoD / 2 - 0.45, d.torsoW * 0.68, d.torsoH - 3.0, 0.5), c.tunicDark));
    }

    if (g.hood) {
      // a hood pushed back off the head, sitting on the shoulders
      torso.parts.push(part(
        B(-d.torsoW / 2 + 0.3, d.torsoH - 3.0, -d.torsoD / 2 - 1.5,
          d.torsoW - 0.6, 3.4, 2.0), c.tunicDark));
    }

    pelvis.children.push(torso);

    /* ---- belt and skirt: the medieval silhouette ---- */
    if (g.belt) {
      pelvis.parts.push(part(
        B(-d.torsoW / 2 - 0.2, 0.3, -d.torsoD / 2 - 0.2, d.torsoW + 0.4, 1.3, d.torsoD + 0.4), c.belt));
      // buckle
      pelvis.parts.push(part(
        B(-0.7, 0.45, d.torsoD / 2 + 0.15, 1.4, 1.0, 0.35), c.brass));
    }

    // The tunic falls past the belt over the hose — this, more than any colour
    // choice, is what makes the silhouette read as medieval rather than modern.
    if (g.skirt > 0) {
      const steps = g.skirt > 6 ? 3 : 2;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        const w = d.hipW + 0.8 + t1 * (g.skirt > 6 ? 3.6 : 2.0);
        // Depth matters more than width: a thigh swings forward and back, so
        // this is what stops the legs passing through the cloth.
        const dep = d.torsoD + 2.6 + t1 * (g.skirt > 6 ? 3.4 : 2.6);
        pelvis.parts.push(part(
          B(-w / 2, 0.4 - g.skirt * t1, -dep / 2, w, g.skirt * (t1 - t0) + 0.25, dep), c.tunic));
      }
    }

    /* ---- head ---- */
    const head = bone('head', [0, d.torsoH + d.neckH, 0]);
    // A rounded solid, not a cube. A hard-edged box head is the single
    // biggest reason these characters read as wrong.
    head.parts.push(part(G.superellipsoid(0, d.headH / 2, 0,
      d.headW / 2, d.headH / 2, d.headD / 2, 0.42, 6, 12), c.skin));
    head.parts.push(part(G.superellipsoid(-d.headW / 2 - 0.15, 4.2, 0,
      0.55, 1.15, 0.95, 0.7, 3, 7), c.skin));
    head.parts.push(part(G.superellipsoid(d.headW / 2 + 0.15, 4.2, 0,
      0.55, 1.15, 0.95, 0.7, 3, 7), c.skin));

    const hairBoxes = c.hairStyle.build(d.headW, d.headH, d.headD);
    for (let i = 0; i < hairBoxes.length; i++) head.parts.push(part(hairBoxes[i], c.hair));

    const beardBoxes = c.beard.build(d.headW, d.headH, d.headD);
    for (let i = 0; i < beardBoxes.length; i++) head.parts.push(part(beardBoxes[i], c.hairDark));

    const moBoxes = c.moustache.build(d.headW, d.headH, d.headD);
    for (let i = 0; i < moBoxes.length; i++) head.parts.push(part(moBoxes[i], c.hairDark));

    // the nose is a real protruding box so profiles read correctly
    head.parts.push(part(
      G.slab(-c.nose.w / 2, NOSE_BOTTOM, d.headD / 2 - 0.55, c.nose.w, c.nose.h,
        c.nose.len + 0.75, 0.72, 1, 0, -c.nose.len * 0.35), c.skin));

    torso.children.push(head);

    /* ---- arms (character's right is -X) ---- */
    const shoulderY = d.torsoH - 1.0;
    const shoulderX = d.torsoW / 2 + d.armW / 2 - 0.55;
    const longSleeve = g.sleeves === 'long' || g.sleeves === 'wide';
    for (let s = 0; s < 2; s++) {
      const right = s === 0;
      const sign = right ? -1 : 1;
      const upper = bone(right ? 'armR' : 'armL', [sign * shoulderX, shoulderY, 0]);
      upper.parts.push(part(
        G.slab(-d.armW / 2, -d.upperArmH, -d.armW / 2, d.armW, d.upperArmH, d.armW, 1, 0.88),
        c.tunic));

      // Shoulder ball, so the top of the arm stays attached as it swings.
      upper.parts.push(part(G.superellipsoid(0, 0, 0,
        d.armW * 0.5, d.armW * 0.5, d.armW * 0.5, 0.6, 3, 7), c.tunic));
      if (g.sleeves === 'wide') {
        // meets the flared cuff below, so the two never leave a step
        upper.parts.push(part(
          G.slab(-(d.armW + 1.1) / 2, -d.upperArmH, -(d.armW + 1.1) / 2,
            d.armW + 1.1, d.upperArmH * 0.62, d.armW + 1.1, 0.78, 1), c.tunic));
      }

      const fore = bone(right ? 'foreR' : 'foreL', [0, -d.upperArmH, 0]);
      const foreW = d.armW * 0.92;

      // The bare arm, full length, always. Building the forearm out of a
      // sleeve piece and a skin piece instead meant neither reached the joint,
      // so the cloth appeared to stop short of the elbow.
      fore.parts.push(part(
        G.slab(-foreW / 2, -d.lowerArmH, -foreW / 2, foreW, d.lowerArmH, foreW, 1, 0.85),
        c.skin));

      // Elbow ball at the joint itself. Without it the forearm swings away
      // from the flat underside of the upper arm and opens a visible gap.
      fore.parts.push(part(G.superellipsoid(0, 0, 0,
        d.armW * 0.47, d.armW * 0.47, d.armW * 0.47, 0.6, 3, 7),
        longSleeve ? c.tunic : c.skin));

      if (longSleeve) {
        // Laid over the top of the arm, running from the elbow down. It has to
        // reach well past the joint: a flared cuff that merely touches the
        // elbow leaves a lip, and the lip opens into a hole as the arm bends.
        const flare = g.sleeves === 'wide' ? 1.4 : 0.34;
        const cuff = d.lowerArmH * (g.sleeves === 'wide' ? 0.84 : 0.56);
        fore.parts.push(part(
          G.slab(-(foreW + flare) / 2, -cuff, -(foreW + flare) / 2,
            foreW + flare, cuff + 1.3, foreW + flare, 1, 0.9), c.tunic));
      }
      fore.parts.push(part(
        G.superellipsoid(0, -d.lowerArmH - 0.75, 0,
          d.armW / 2 + 0.15, 0.95, d.armW / 2 + 0.15, 0.6, 3, 7), c.skin));
      upper.children.push(fore);
      torso.children.push(upper);
    }

    /* ---- legs ---- */
    const hipX = d.legW / 2 + 0.25;
    for (let s = 0; s < 2; s++) {
      const right = s === 0;
      const sign = right ? -1 : 1;
      const upper = bone(right ? 'legR' : 'legL', [sign * hipX, 0, 0]);
      upper.parts.push(part(
        G.slab(-d.legW / 2, -d.upperLegH, -d.legW / 2, d.legW, d.upperLegH, d.legW, 1, 0.9),
        c.trouser));
      upper.parts.push(part(G.superellipsoid(0, 0, 0,
        d.legW * 0.5, d.legW * 0.5, d.legW * 0.5, 0.6, 3, 7), c.trouser));

      const shin = bone(right ? 'shinR' : 'shinL', [0, -d.upperLegH, 0]);
      const shinW = d.legW * 0.94;
      // Knee ball, for the same reason as the elbow.
      shin.parts.push(part(G.superellipsoid(0, 0, 0,
        d.legW * 0.48, d.legW * 0.48, d.legW * 0.48, 0.6, 3, 7), c.trouser));
      shin.parts.push(part(
        G.slab(-shinW / 2, -d.lowerLegH, -shinW / 2, shinW, d.lowerLegH, shinW, 1, 0.82),
        c.trouser));
      // a turned-down boot cuff, then the boot itself with a toe
      shin.parts.push(part(
        B(-d.legW / 2 - 0.25, -d.lowerLegH + 1.6, -d.legW / 2 - 0.25,
          d.legW + 0.5, 0.9, d.legW + 0.5), c.belt));
      shin.parts.push(part(
        B(-d.legW / 2 - 0.2, -d.lowerLegH - 0.1, -d.legW / 2 - 0.2,
          d.legW + 0.4, 2.0, d.legW + 1.8), c.boot));
      upper.children.push(shin);
      pelvis.children.push(upper);
    }

    const bones = {};
    (function index(node) {
      bones[node.name] = node;
      for (let i = 0; i < node.children.length; i++) index(node.children[i]);
    })(root);

    return { root: root, bones: bones, dims: d, colours: c, character: ch };
  }

  /* ---------- the face, rebuilt per frame ---------- */

  // Fixed vertical layout — see the map at the top of parts.js.
  const EYE_Y = 3.75;
  const EYE_INNER = 0.95;   // half-gap between the pair, keeps brows apart too
  const NOSE_BOTTOM = 2.5;
  const MOUTH_Y = 1.15;

  const VISEMES = {
    rest: { w: 3.3, h: 1.3 },
    closed: { w: 3.1, h: 1.1 },
    ah: { w: 3.5, h: 2.8 },
    eh: { w: 3.9, h: 2.0 },
    oh: { w: 2.7, h: 2.6 },
    oo: { w: 2.2, h: 2.1 },
    ee: { w: 4.1, h: 1.5 },
    ff: { w: 3.3, h: 1.4 },
    ll: { w: 3.1, h: 2.2 }
  };

  const LETTER_VISEME = {
    a: 'ah', e: 'eh', i: 'ee', o: 'oh', u: 'oo', y: 'ee',
    m: 'closed', b: 'closed', p: 'closed',
    f: 'ff', v: 'ff', w: 'oo', q: 'oo',
    l: 'll', t: 'll', d: 'll', n: 'll',
    s: 'ee', z: 'ee', c: 'ee', x: 'ee', j: 'ee', g: 'eh',
    k: 'eh', h: 'ah', r: 'oh'
  };

  function visemeForLetter(letter) {
    if (!letter) return 'rest';
    return LETTER_VISEME[String(letter).toLowerCase()] || 'rest';
  }

  // state: { blink: 0..1 how closed, viseme: key, gaze: -1..1 }
  function buildFaceParts(model, state) {
    const ch = model.character;
    const c = model.colours;
    const d = model.dims;
    const B = P.box;
    const out = [];

    const front = d.headD / 2 + 0.08;
    const shape = c.eyeShape;
    const brow = c.brow;
    const blink = state && state.blink ? state.blink : 0;
    const gaze = state && state.gaze ? state.gaze : 0;

    for (let s = 0; s < 2; s++) {
      const sign = s === 0 ? -1 : 1;
      const x = sign < 0 ? -(EYE_INNER + shape.w) : EYE_INNER;

      if (blink > 0.5) {
        // closed lid: a crease line with a hint of lash below it
        out.push(part(B(x - 0.15, EYE_Y + shape.h * 0.4, front - 0.08, shape.w + 0.3, 0.45, 0.24),
          c.skinDeep, { flat: true }));
      } else {
        const openH = shape.h * (1 - blink);
        const midY = EYE_Y + (shape.h - openH) / 2;
        // socket: a dark rim that gives the eye an edge instead of floating
        out.push(part(B(x - 0.15, midY - 0.15, front - 0.1, shape.w + 0.3, openH + 0.3, 0.2),
          c.skinDeep, { flat: true }));
        out.push(part(B(x, midY, front - 0.04, shape.w, openH, 0.2),
          c.sclera, { flat: true }));
        // iris, then a darker pupil inside it
        const irisW = Math.min(1.45, shape.w * 0.66);
        const irisH = Math.min(openH, 1.35);
        const irisX = x + (shape.w - irisW) / 2 + gaze * (shape.w - irisW) * 0.5;
        const irisY = midY + (openH - irisH) / 2;
        out.push(part(B(irisX, irisY, front + 0.06, irisW, irisH, 0.16), c.eye, { flat: true }));
        // Only worth drawing when it lands on at least a whole pixel; below
        // that it flickers in and out as the head turns.
        if (irisH > 1.05) {
          out.push(part(B(irisX + irisW * 0.26, irisY + irisH * 0.22, front + 0.14,
            irisW * 0.48, irisH * 0.52, 0.12), '#1a151a', { flat: true }));
        }
      }

      // Brow, drawn as two segments so it can tilt. `gap` pushes the inner end
      // outward from the centre line — without it the pair met as a monobrow.
      const innerY = EYE_Y + shape.h + 0.2 + brow.inner;
      const outerY = EYE_Y + shape.h + 0.2 + brow.outer;
      const segW = shape.w * 0.55;
      const innerEdge = sign < 0 ? -(EYE_INNER + brow.gap + segW) : EYE_INNER + brow.gap;
      const outerEdge = sign < 0 ? -(EYE_INNER + brow.gap + segW * 2) : EYE_INNER + brow.gap + segW;
      out.push(part(B(innerEdge, innerY, front - 0.06, segW, brow.thick, 0.22),
        c.hairDark, { flat: true }));
      out.push(part(B(outerEdge, outerY, front - 0.06, segW, brow.thick, 0.22),
        c.hairDark, { flat: true }));
    }

    // nostrils, sunk into the front face of the nose
    const noseFront = front - 0.25 + c.nose.len + 0.25;
    const nostrilX = c.nose.w / 2 - 0.42;
    out.push(part(B(-nostrilX, NOSE_BOTTOM + 0.12, noseFront - 0.12, 0.36, 0.34, 0.2),
      c.skinDeep, { flat: true }));
    out.push(part(B(nostrilX - 0.36, NOSE_BOTTOM + 0.12, noseFront - 0.12, 0.36, 0.34, 0.2),
      c.skinDeep, { flat: true }));

    // mouth, with a lit lower lip beneath it so it is not just a dark slot
    const v = VISEMES[(state && state.viseme) || 'rest'] || VISEMES.rest;
    const mw = v.w * (0.75 + ch.mouthWidth * 0.5);
    const my = MOUTH_Y - (v.h - 0.5) * 0.35;
    out.push(part(B(-mw / 2, my, front - 0.06, mw, v.h, 0.26), c.mouth, { flat: true }));
    // A lit lower lip beneath and a shadowed upper lip above. Three bands of
    // real contrast is the least that still reads as a mouth once the head is
    // only about eleven pixels across.
    out.push(part(B(-mw / 2 + 0.1, my - 0.75, front - 0.05, mw - 0.2, 0.7, 0.24),
      c.lip, { flat: true }));
    out.push(part(B(-mw / 2 + 0.2, my + v.h, front - 0.05, mw - 0.4, 0.42, 0.22),
      c.skinDark, { flat: true }));

    return out;
  }

  global.CharacterModel = {
    MAX_NAME_LENGTH: MAX_NAME_LENGTH,
    makeRng, pick, pickWeighted, sanitiseName,
    defaultCharacter, randomCharacter, randomName,
    dimensionsFor, buildModel, buildFaceParts, visemeForLetter,
    resolve, shade, indexOfId
  };
})(window);
