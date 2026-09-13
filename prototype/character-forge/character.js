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
      facialHair: 'stubble',
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
      bootColour: 'brown'
    };
  }

  function randomCharacter(rng, forcedSex) {
    rng = rng || makeRng((Math.random() * 0xffffffff) >>> 0);
    const sex = forcedSex || (rng() < 0.5 ? 'male' : 'female');
    const female = sex === 'female';

    const hair = pickWeighted(rng, P.HAIR_STYLES, function (s) {
      return female ? s.femaleBias : 1 - s.femaleBias;
    });

    // Facial hair is drawn only for male characters; the creator still exposes
    // every option to the player regardless of the sex they picked.
    const facial = female
      ? 'none'
      : pickWeighted(rng, P.FACIAL_HAIR, function (s) { return s.maleBias; }).id;

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
      facialHair: facial,
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

  function resolve(ch) {
    const skin = hexOf(P.SKIN_TONES, ch.skin);
    const hair = hexOf(P.HAIR_COLOURS, ch.hairColour);
    return {
      skin: skin,
      skinDark: shade(skin, -0.32),
      hair: hair,
      hairDark: shade(hair, -0.22),
      eye: hexOf(P.EYE_COLOURS, ch.eyeColour),
      tunic: hexOf(P.CLOTH_COLOURS, ch.tunicColour),
      trouser: hexOf(P.CLOTH_COLOURS, ch.trouserColour),
      boot: hexOf(P.LEATHER_COLOURS, ch.bootColour),
      belt: shade(hexOf(P.LEATHER_COLOURS, ch.bootColour), -0.12),
      eyeShape: entryOf(P.EYE_SHAPES, ch.eyeShape),
      brow: entryOf(P.BROW_SHAPES, ch.brow),
      nose: entryOf(P.NOSE_SHAPES, ch.nose),
      hairStyle: entryOf(P.HAIR_STYLES, ch.hairStyle),
      facialHair: entryOf(P.FACIAL_HAIR, ch.facialHair)
    };
  }

  function shade(hex, amount) {
    const rgb = global.Render.hexToRgb(hex);
    const target = amount < 0 ? [14, 16, 24] : [255, 250, 236];
    const t = Math.abs(amount);
    const out = global.Render.mixRgb(rgb, target, t);
    return '#' + out.map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  /* ---------- dimensions ---------- */

  function dimensionsFor(ch) {
    const male = ch.sex === 'male';
    const bulk = 0.9 + ch.build * 0.26;
    const headW = 8, headH = 8, headD = 7.4;
    const neckH = 1.7;
    const torsoH = male ? 11.4 : 10.9;
    // Stylised proportions: a large head and a short leg carry far better at
    // ~45px tall than anatomically correct ones, which read as spindly.
    const upperLegH = 5.8, lowerLegH = 5.6;
    const upperArmH = 5.3, lowerArmH = 4.9;
    const garment = ch.garment;

    return {
      male: male,
      headW: headW, headH: headH, headD: headD, neckH: neckH,
      torsoH: torsoH,
      torsoW: (male ? 7.5 : 6.8) * bulk,
      torsoD: (male ? 4.4 : 4.1) * bulk,
      hipW: (male ? 6.9 : 7.2) * bulk,
      armW: (male ? 3.0 : 2.6) * bulk,
      upperArmH: upperArmH, lowerArmH: lowerArmH,
      legW: (male ? 3.5 : 3.2) * bulk,
      upperLegH: upperLegH, lowerLegH: lowerLegH,
      legTotal: upperLegH + lowerLegH,
      // A long skirt restrains the stride; trousers do not.
      legSwing: (garment === 'dress' || garment === 'robe') ? 0.55 : 1,
      heightScale: (male ? 1 : 0.955) * (0.9 + ch.height * 0.2)
    };
  }

  /* ---------- the box model ---------- */

  function bone(name, origin) {
    return { name: name, origin: origin, rot: [0, 0, 0], parts: [], children: [] };
  }

  function part(box, colour, opts) {
    const p = { box: box, colour: colour };
    if (opts) { for (const k in opts) p[k] = opts[k]; }
    return p;
  }

  function buildModel(ch) {
    const d = dimensionsFor(ch);
    const c = resolve(ch);
    const B = P.box;

    const sleeved = ch.garment !== 'jerkin';
    const armSleeveH = sleeved ? d.upperArmH : 0;

    const root = bone('root', [0, 0, 0]);
    root.scale = d.heightScale;

    const pelvis = bone('pelvis', [0, d.legTotal, 0]);
    root.children.push(pelvis);

    /* torso */
    const torso = bone('torso', [0, 0, 0]);
    torso.parts.push(part(
      B(-d.torsoW / 2, 0, -d.torsoD / 2, d.torsoW, d.torsoH, d.torsoD), c.tunic));
    // neck
    torso.parts.push(part(
      B(-1.5, d.torsoH - 0.2, -1.4, 3.0, d.neckH + 0.4, 2.8), c.skin));
    // belt
    torso.parts.push(part(
      B(-d.torsoW / 2 - 0.15, 0.6, -d.torsoD / 2 - 0.15, d.torsoW + 0.3, 1.2, d.torsoD + 0.3), c.belt));
    if (ch.garment === 'jerkin') {
      torso.parts.push(part(
        B(-d.torsoW / 2 - 0.2, 2.2, -d.torsoD / 2 - 0.2, d.torsoW + 0.4, d.torsoH - 3.4, d.torsoD + 0.4),
        c.boot));
    }
    pelvis.children.push(torso);

    /* skirt, hung from the pelvis so it stays put while the legs swing */
    if (ch.garment === 'dress' || ch.garment === 'robe') {
      const len = ch.garment === 'dress' ? 7.4 : 5.6;
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        const w = d.hipW + 0.6 + i * 1.5;
        const dep = d.torsoD + 0.8 + i * 1.1;
        pelvis.parts.push(part(
          B(-w / 2, -len * (i + 1) / steps, -dep / 2, w, len / steps + 0.2, dep), c.tunic));
      }
    }

    /* head */
    const head = bone('head', [0, d.torsoH + d.neckH, 0]);
    head.parts.push(part(B(-d.headW / 2, 0, -d.headD / 2, d.headW, d.headH, d.headD), c.skin));
    // ears
    head.parts.push(part(B(-d.headW / 2 - 0.7, 3.2, -0.9, 0.8, 2.2, 1.9), c.skin));
    head.parts.push(part(B(d.headW / 2 - 0.1, 3.2, -0.9, 0.8, 2.2, 1.9), c.skin));

    const hairBoxes = c.hairStyle.build(d.headW, d.headH, d.headD);
    for (let i = 0; i < hairBoxes.length; i++) head.parts.push(part(hairBoxes[i], c.hair));

    const beardBoxes = c.facialHair.build(d.headW, d.headH, d.headD);
    for (let i = 0; i < beardBoxes.length; i++) head.parts.push(part(beardBoxes[i], c.hairDark));

    // nose is a real protruding box, not a decal, so profiles read correctly
    head.parts.push(part(
      B(-c.nose.w / 2, 2.2, d.headD / 2 - 0.2, c.nose.w, c.nose.h, c.nose.len + 0.2), c.skin));

    torso.children.push(head);

    /* arms — character's right is -X */
    const shoulderY = d.torsoH - 1.0;
    const shoulderX = d.torsoW / 2 + d.armW / 2 - 0.55;
    for (let s = 0; s < 2; s++) {
      const right = s === 0;
      const sign = right ? -1 : 1;
      const upper = bone(right ? 'armR' : 'armL', [sign * shoulderX, shoulderY, 0]);
      upper.parts.push(part(
        B(-d.armW / 2, -d.upperArmH, -d.armW / 2, d.armW, d.upperArmH, d.armW),
        sleeved ? c.tunic : c.skin));

      const fore = bone(right ? 'foreR' : 'foreL', [0, -d.upperArmH, 0]);
      fore.parts.push(part(
        B(-d.armW / 2 * 0.92, -d.lowerArmH, -d.armW / 2 * 0.92, d.armW * 0.92, d.lowerArmH, d.armW * 0.92),
        c.skin));
      // hand
      fore.parts.push(part(
        B(-d.armW / 2 - 0.1, -d.lowerArmH - 1.6, -d.armW / 2 - 0.1, d.armW + 0.2, 1.7, d.armW + 0.2),
        c.skin));
      upper.children.push(fore);
      torso.children.push(upper);
    }

    /* legs */
    const hipX = d.legW / 2 + 0.25;
    for (let s = 0; s < 2; s++) {
      const right = s === 0;
      const sign = right ? -1 : 1;
      const upper = bone(right ? 'legR' : 'legL', [sign * hipX, 0, 0]);
      upper.parts.push(part(
        B(-d.legW / 2, -d.upperLegH, -d.legW / 2, d.legW, d.upperLegH, d.legW), c.trouser));

      const shin = bone(right ? 'shinR' : 'shinL', [0, -d.upperLegH, 0]);
      shin.parts.push(part(
        B(-d.legW / 2 * 0.94, -d.lowerLegH, -d.legW / 2 * 0.94, d.legW * 0.94, d.lowerLegH, d.legW * 0.94),
        c.trouser));
      // boot, with a toe that runs forward past the shin
      shin.parts.push(part(
        B(-d.legW / 2 - 0.2, -d.lowerLegH - 0.1, -d.legW / 2 - 0.2, d.legW + 0.4, 2.2, d.legW + 1.8),
        c.boot));
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

  // Mouth shapes keyed by the sound a letter is standing in for. Crude by
  // design: at this pixel scale anything finer is invisible.
  const VISEMES = {
    rest: { w: 2.1, h: 0.5 },
    closed: { w: 2.0, h: 0.42 },
    ah: { w: 2.5, h: 1.9 },
    eh: { w: 2.9, h: 1.1 },
    oh: { w: 1.7, h: 1.7 },
    oo: { w: 1.2, h: 1.2 },
    ee: { w: 3.0, h: 0.7 },
    ff: { w: 2.3, h: 0.6 },
    ll: { w: 2.0, h: 1.3 }
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
    const key = String(letter).toLowerCase();
    return LETTER_VISEME[key] || 'rest';
  }

  // state: { blink: 0..1 how closed, viseme: key, gaze: -1..1 }
  function buildFaceParts(model, state) {
    const ch = model.character;
    const c = model.colours;
    const d = model.dims;
    const B = P.box;
    const out = [];

    const front = d.headD / 2;
    const shape = c.eyeShape;
    const eyeY = 3.85;
    const gap = 0.55;
    const blink = state && state.blink ? state.blink : 0;
    const gaze = state && state.gaze ? state.gaze : 0;

    for (let s = 0; s < 2; s++) {
      const sign = s === 0 ? -1 : 1;
      const x = sign < 0 ? -(gap + shape.w) : gap;

      if (blink > 0.55) {
        // eyelid: a single dark line where the eye was
        out.push(part(B(x, eyeY + shape.h * 0.42, front - 0.06, shape.w, 0.42, 0.22),
          c.skinDark, { flat: true }));
      } else {
        const openH = shape.h * (1 - blink);
        out.push(part(B(x, eyeY + (shape.h - openH) / 2, front - 0.06, shape.w, openH, 0.2),
          '#d9d3c6', { flat: true }));
        // a large iris — at this scale mostly-white eyes read as startled
        const pupilW = Math.min(1.35, shape.w * 0.62);
        const pupilH = Math.min(openH, 1.25);
        out.push(part(B(
          x + (shape.w - pupilW) / 2 + gaze * (shape.w - pupilW) * 0.5,
          eyeY + (shape.h - pupilH) / 2,
          front + 0.08, pupilW, pupilH, 0.16), c.eye, { flat: true }));
      }

      // brow
      const brow = c.brow;
      const innerY = eyeY + shape.h + 0.5 + brow.inner;
      const outerY = eyeY + shape.h + 0.5 + brow.outer;
      const halfW = shape.w / 2;
      const innerX = sign < 0 ? x + halfW : x;
      const outerX = sign < 0 ? x : x + halfW;
      out.push(part(B(innerX, innerY, front - 0.04, halfW + 0.15, brow.thick, 0.2),
        c.hairDark, { flat: true }));
      out.push(part(B(outerX, outerY, front - 0.04, halfW + 0.15, brow.thick, 0.2),
        c.hairDark, { flat: true }));
    }

    // mouth
    const v = VISEMES[(state && state.viseme) || 'rest'] || VISEMES.rest;
    const widthGene = 0.75 + ch.mouthWidth * 0.5;
    const mw = v.w * widthGene;
    out.push(part(B(-mw / 2, 1.55 - (v.h - 0.5) * 0.4, front - 0.06, mw, v.h, 0.22),
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
