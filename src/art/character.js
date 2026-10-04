// Modular procedural character renderer.
//
// A character is an `Appearance` (genetics + body + face + outfit). Each animation frame is built by:
//   1. computing a skeleton pose (joints) for the direction/animation/frame
//   2. rasterising body segments as shaded capsules/blobs; every segment asks the outfit which
//      material covers it at each point along its length (skin, sleeve, trousers, boot...),
//      so clothing layers share the exact limb geometry and can't leave gaps or float
//   3. drawing detail layers (face, hair, folds, belt, apron, hats, held tools)
//   4. resolving AO + selective outline in the MatBuffer
//
// Frame size is 32x48. Feet rest on y=45. Directions: 0=down(front) 1=left 2=right 3=up(back).
'use strict';
(function () {
  const FW = 32, FH = 48, GROUND = 45;
  const P = O.Pal;
  const G = { BACK: 1, LEGS: 2, TORSO: 3, ARMS: 4, HEAD: 5, HAIR: 6, HAT: 7, ITEM: 8, FARLIMB: 9, SKIRT: 10, BACKITEM: 11 };

  // ---------- Appearance generation ----------
  const HAIR_STYLES_M = ['short', 'crop', 'messy', 'bald', 'long', 'tied', 'curly', 'shaggy'];
  const HAIR_STYLES_F = ['long', 'bun', 'braid', 'tied', 'curly', 'short', 'bob', 'veil'];
  const BEARDS = ['none', 'none', 'stubble', 'full', 'moustache', 'goatee', 'long'];

  function ageStage(age) {
    if (age < 3) return 'baby';
    if (age < 8) return 'child';
    if (age < 13) return 'olderChild';
    if (age < 18) return 'teen';
    if (age < 25) return 'youngAdult';
    if (age < 45) return 'adult';
    if (age < 65) return 'mature';
    return 'elder';
  }

  // Body metrics for an age/height/build. All in pixels. Children keep proportionally bigger heads.
  function bodyMetrics(a) {
    const st = ageStage(a.age);
    const h = a.height || 0, b = a.build || 0; // -1..1 genes
    let m;
    switch (st) {
      case 'baby': m = { headRx: 4.6, headRy: 4.5, torso: 5, leg: 5, armU: 2.6, armL: 2.4, shW: 7, waistW: 7.5, hipW: 7.5, limbR: 1.4, legR: 1.6 }; break;
      case 'child': m = { headRx: 6.2, headRy: 6.1, torso: 7, leg: 8, armU: 3.6, armL: 3.4, shW: 8, waistW: 8, hipW: 8.5, limbR: 1.45, legR: 1.7 }; break;
      case 'olderChild': m = { headRx: 6.4, headRy: 6.3, torso: 8, leg: 10, armU: 4.2, armL: 4, shW: 9, waistW: 8.5, hipW: 9, limbR: 1.5, legR: 1.8 }; break;
      case 'teen': m = { headRx: 6.6, headRy: 6.7, torso: 10.5, leg: 13.5, armU: 5, armL: 4.8, shW: 10.5, waistW: 9, hipW: 9.5, limbR: 1.55, legR: 1.95 }; break;
      default: m = { headRx: 6.9, headRy: 7.0, torso: 12, leg: 15, armU: 5.6, armL: 5.4, shW: 13.4, waistW: 10, hipW: 10.5, limbR: 1.65, legR: 2.05 };
    }
    m.stage = st;
    if (st !== 'child' && st !== 'olderChild' && st !== 'baby') {
      m.leg += Math.round(h * 1.4); m.torso += Math.round(h * 0.8);
      m.armL += h * 0.5; m.armU += h * 0.4;
    }
    m.shW += b * 1.6; m.waistW += b * 2.2; m.hipW += b * 1.4; m.limbR += b * 0.22; m.legR += b * 0.25;
    if (a.sex === 'f' && st !== 'child' && st !== 'baby') { m.shW -= 1; m.waistW -= 0.8; m.hipW += 0.7; m.limbR -= 0.08; }
    if (st === 'elder') { m.stoop = 1; m.leg -= 1; }
    if (st === 'mature') m.waistW += 0.6;
    return m;
  }

  // Simplified fictional genetics. Genes are numbers; children blend parents with mutation.
  function randomGenes(rng, region) {
    const skinBias = { north: 0.15, east: 0.4, south: 0.55, west: 0.35 }[region] ?? 0.4;
    const skin = O.clamp(Math.round((skinBias + (rng.next() - 0.5) * 0.7) * 7), 0, 7);
    const hairKeys = Object.keys(P.hair).filter((k) => k !== 'grey' && k !== 'white');
    return {
      skin,
      hair: rng.pick(hairKeys),
      hairCurl: rng.next(),
      eyes: rng.pick(Object.keys(P.eyes)),
      height: rng.float(-1, 1),
      build: rng.float(-1, 1),
      face: { eyeGap: rng.int(0, 1), eyeType: rng.int(0, 2), nose: rng.int(0, 2), jaw: rng.float(0, 0.35), brow: rng.int(0, 2), ears: rng.int(0, 1), freckles: rng.chance(0.15) },
    };
  }
  function inheritGenes(rng, mum, dad) {
    const pick = (a, b) => (rng.chance(0.5) ? a : b);
    const darkerHair = (a, b) => { const order = Object.keys(P.hair); return order.indexOf(a) < order.indexOf(b) ? a : b; };
    return {
      skin: O.clamp(Math.round((mum.skin + dad.skin) / 2 + rng.float(-0.8, 0.8)), 0, 7),
      // dark hair is mildly dominant; occasional throwback to a random tone (older generations)
      hair: rng.chance(0.08) ? rng.pick(Object.keys(P.hair).slice(0, 9)) : rng.chance(0.55) ? darkerHair(mum.hair, dad.hair) : pick(mum.hair, dad.hair),
      hairCurl: O.clamp((mum.hairCurl + dad.hairCurl) / 2 + rng.float(-0.2, 0.2), 0, 1),
      eyes: rng.chance(0.06) ? rng.pick(Object.keys(P.eyes)) : pick(mum.eyes, dad.eyes),
      height: O.clamp((mum.height + dad.height) / 2 + rng.float(-0.4, 0.4), -1, 1),
      build: O.clamp((mum.build + dad.build) / 2 + rng.float(-0.4, 0.4), -1, 1),
      face: {
        eyeGap: pick(mum.face.eyeGap, dad.face.eyeGap), eyeType: pick(mum.face.eyeType, dad.face.eyeType),
        nose: pick(mum.face.nose, dad.face.nose), jaw: (mum.face.jaw + dad.face.jaw) / 2 + rng.float(-0.05, 0.05),
        brow: pick(mum.face.brow, dad.face.brow), ears: pick(mum.face.ears, dad.face.ears), freckles: rng.chance(0.5) ? mum.face.freckles : dad.face.freckles,
      },
    };
  }

  // Outfits by role & wealth. Returns material choices; rendering decides coverage.
  const C = P.cloth;
  function outfitFor(rng, role, sex, wealth, stage) {
    const rich = wealth > 0.66, poor = wealth < 0.33;
    const poorCols = [C.undyed, C.linen, C.wool, C.brown, C.greyWool, C.sage, C.olive, C.tan];
    const midCols = [C.russet, C.ochre, C.woad, C.forest, C.brown, C.mustard, C.teal, C.madder, C.sky, C.rose];
    const richCols = [C.crimson, C.navy, C.purple, C.black, C.plum, C.forest, C.teal];
    const col = () => rng.pick(poor ? poorCols : rich ? richCols : midCols.concat(poorCols.slice(0, 3)));
    const o = {
      shirt: P.mat(rng.pick([C.linen, C.undyed, C.white, C.linen])), sleeves: 'long',
      over: null, overLen: 0, legs: P.mat(rng.pick([C.brown, C.darkBrown, C.greyWool, C.wool, C.olive, C.tan, C.navy])),
      skirt: null, skirtLen: 0, shoes: P.mat(rng.pick([C.leather, C.darkLeather, C.tan])), boots: rng.chance(0.5),
      belt: P.mat(rng.pick([C.darkLeather, C.leather])), buckle: P.mat(P.metal.brass, 'metal'),
      apron: null, hat: null, hatMat: null, hood: null, cloak: null, trim: null, item: null, backItem: null, armour: null, tabard: null, pouch: rng.chance(0.5),
    };
    if (rich) o.trim = P.mat(rng.pick([P.metal.gold, C.white, C.mustard]), rng.chance(0.5) ? 'metal' : 'cloth');
    if (sex === 'f' && stage !== 'child') {
      o.skirt = P.mat(col()); o.skirtLen = 1; o.shirt = P.mat(rng.pick([C.linen, C.white, C.undyed]));
      o.over = rng.chance(0.75) ? P.mat(col()) : null; o.overLen = 0; o.dress = true;
    } else {
      o.over = rng.chance(0.85) ? P.mat(col()) : null; o.overLen = rng.chance(0.6) ? 1 : 0; // tunic to thigh
    }
    if (stage === 'child' || stage === 'olderChild' || stage === 'baby') { o.boots = false; if (rng.chance(0.25)) o.shoes = null; o.belt = rng.chance(0.5) ? o.belt : null; }
    switch (role) {
      case 'blacksmith': o.apron = P.mat(C.darkLeather); o.sleeves = 'short'; o.item = 'hammer'; o.over = sex === 'f' ? o.over : P.mat(C.greyWool); o.boots = true; break;
      case 'baker': o.apron = P.mat(C.white); o.hat = 'coif'; o.hatMat = P.mat(C.white); o.sleeves = 'short'; o.item = rng.chance(0.5) ? 'bread' : null; break;
      case 'farmer': o.hat = rng.chance(0.6) ? 'straw' : null; o.hatMat = P.mat('#d6b45e'); o.item = rng.pick(['pitchfork', 'scythe', 'hoe']); o.boots = true; break;
      case 'farmhand': o.hat = rng.chance(0.3) ? 'straw' : null; o.hatMat = P.mat('#d6b45e'); o.item = rng.pick(['pitchfork', 'basket', 'hoe']); break;
      case 'guard': o.armour = 'mail'; o.tabard = P.mat(C.madder); o.hat = 'kettle'; o.hatMat = P.mat(P.metal.iron, 'metal'); o.item = 'spear'; o.boots = true; o.legs = P.mat(C.darkBrown); o.sideItem = 'sword'; break;
      case 'innkeeper': o.apron = P.mat(C.linen); o.item = rng.chance(0.5) ? 'mug' : null; break;
      case 'merchant': o.hat = rng.chance(0.6) ? 'cap' : null; o.hatMat = P.mat(col()); o.cloak = rng.chance(0.3) ? P.mat(col()) : null; o.pouch = true; break;
      case 'doctor': o.over = P.mat(C.black); o.overLen = 2; o.hat = 'cap'; o.hatMat = P.mat(C.black); o.item = 'satchel'; break;
      case 'priest': o.over = P.mat(C.black); o.overLen = 3; o.skirt = null; o.hood = null; o.belt = P.mat(C.linen); o.item = 'book'; break;
      case 'woodcutter': o.item = 'axe'; o.hat = rng.chance(0.4) ? 'hood' : null; o.hatMat = P.mat(C.forest); o.boots = true; break;
      case 'miller': o.apron = P.mat(C.linen); o.hat = 'cap'; o.hatMat = P.mat(C.linen); o.item = 'sack'; break;
      case 'noble': o.over = P.mat(rng.pick(richCols)); o.overLen = sex === 'f' ? 0 : 1; o.cloak = P.mat(rng.pick(richCols)); o.trim = P.mat(P.metal.gold, 'metal'); o.hat = rng.chance(0.5) ? 'feather' : null; o.hatMat = P.mat(rng.pick(richCols)); o.boots = true; break;
      case 'royal': o.over = P.mat(rng.pick([C.crimson, C.purple, C.plum])); o.overLen = sex === 'f' ? 0 : 2; if (sex === 'f') o.skirt = P.mat(rng.pick([C.crimson, C.purple, C.woad])); o.cloak = P.mat(C.white); o.trim = P.mat(P.metal.gold, 'metal'); o.hat = 'crown'; o.boots = true; o.pouch = false; break;
      case 'builder': o.apron = P.mat(C.darkLeather); o.sleeves = 'short'; o.hat = rng.chance(0.6) ? 'cap' : 'hood'; o.hatMat = P.mat(rng.pick([C.brown, C.linen, C.greyWool])); o.item = rng.chance(0.5) ? 'hammer' : null; o.boots = true; break;
      case 'servant': o.over = P.mat(rng.pick([C.greyWool, C.navy, C.brown])); o.overLen = sex === 'f' ? 0 : 1; o.apron = P.mat(C.white); o.hat = sex === 'f' ? 'coif' : null; o.hatMat = P.mat(C.white); o.item = null; o.pouch = false; break;
      case 'outlaw': o.over = P.mat(rng.pick([C.darkBrown, C.forest, C.black, C.greyWool])); o.overLen = 1; o.hat = 'hood'; o.hatMat = P.mat(rng.pick([C.forest, C.darkBrown, C.black, C.russet])); o.item = rng.pick(['dagger', 'sword', null]); o.boots = true; o.cloak = rng.chance(0.5) ? o.hatMat : null; o.backItem = rng.chance(0.4) ? 'bow' : null; break;
      case 'fisher': o.hat = 'cap'; o.hatMat = P.mat(C.woad); o.item = 'net'; break;
      case 'bard': o.over = P.mat(rng.pick([C.crimson, C.purple, C.teal, C.plum])); o.overLen = 1; o.hat = 'feather'; o.hatMat = P.mat(rng.pick([C.woad, C.olive, C.rose])); o.item = 'lute'; o.boots = true; o.trim = P.mat(P.metal.brass, 'metal'); break;
      case 'courier': o.item = 'satchel'; o.hat = 'feather'; o.hatMat = P.mat(col()); break;
      case 'child': o.item = null; break;
      case 'undertaker': o.over = P.mat(C.black); o.overLen = 2; o.hat = 'cap'; o.hatMat = P.mat(C.black); o.item = null; o.boots = true; break;
      case 'bearer': o.over = P.mat(C.linen); o.overLen = 1; o.apron = null; o.item = null; o.sleeves = 'short'; break;
      case 'sweeper': o.apron = P.mat(C.greyWool); o.item = 'broom'; o.hat = rng.chance(0.5) ? 'cap' : null; o.hatMat = P.mat(C.brown); break;
      default: break;
    }
    return o;
  }

  function makeAppearance(seed, opts = {}) {
    const rng = O.RNG(seed);
    const sex = opts.sex || (rng.chance(0.5) ? 'm' : 'f');
    const age = opts.age ?? rng.int(18, 70);
    const genes = opts.genes || randomGenes(rng, opts.region);
    const wealth = opts.wealth ?? rng.next();
    const stage = ageStage(age);
    const greyChance = O.clamp((age - 40) / 30, 0, 1);
    let hairKey = genes.hair;
    if (rng.next() < greyChance) hairKey = age > 68 ? 'white' : 'grey';
    let hairStyle = opts.hairStyle || rng.pick(sex === 'm' ? HAIR_STYLES_M : HAIR_STYLES_F);
    if (genes.hairCurl > 0.78 && hairStyle !== 'bald' && hairStyle !== 'veil') hairStyle = rng.chance(0.6) ? 'curly' : hairStyle;
    if (sex === 'm' && age > 45 && rng.chance(0.25)) hairStyle = 'bald';
    const beard = sex === 'm' && age >= 18 ? (opts.beard || rng.pick(BEARDS)) : 'none';
    return {
      seed, sex, age, stage, genes, wealth, role: opts.role || 'villager',
      skin: P.mat(P.skin[genes.skin], 'skin'), lip: P.mat(P.skin[Math.min(7, genes.skin + 2)], 'skin'),
      hair: P.mat(P.hair[hairKey], 'hair'), hairStyle, beard, eyes: P.mat(P.eyes[genes.eyes], 'cloth'),
      eyeWhite: P.mat('#f2ece0', 'cloth'), eyeDark: P.mat('#1e1820', 'cloth'),
      height: genes.height, build: genes.build,
      outfit: opts.outfit || outfitFor(rng, opts.role || 'villager', sex, wealth, stage),
      variant: rng.int(0, 1000),
    };
  }

  // ---------- Directions ----------
  // Eight facings: 0 S (toward the viewer), 1 W, 2 E, 3 N (away), 4 SE, 5 SW, 6 NE, 7 NW.
  // West-facing views are the east-facing ones mirrored, so each pose is authored once.
  const DIRV = [[0, 1], [-1, 0], [1, 0], [0, -1], [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71]];
  function dirOf(dx, dy) {
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 0;
    const a = Math.atan2(dy, dx), k = Math.round(a / (Math.PI / 4)); // 0 = east, 2 = south
    return [1, 7, 3, 6, 2, 4, 0, 5, 1][k + 4] ?? 0;
  }
  const dir4 = (d) => (d < 4 ? d : d === 4 || d === 6 ? 2 : 1);
  const VIEW = { 0: [0, false], 1: [90, true], 2: [90, false], 3: [180, false], 4: [40, false], 5: [40, true], 6: [140, false], 7: [140, true] };
  const K = 0.38; // how far "away from the viewer" reads as "up the screen"
  const CX = 16;
  function viewOf(dir) {
    const [deg, mirror] = VIEW[dir] || VIEW[0];
    const a = (deg * Math.PI) / 180, Fx = Math.sin(a), Fz = -Math.cos(a);
    return { dir, Fx, Fz, Rx: Fz, Rz: -Fx, mirror, front: Fz < -0.3, back: Fz > 0.3, side: Math.abs(Fx) > 0.95 };
  }
  // body space: x = the character's right, y = down, z = forward. Returns screen x, y and depth (+ = away)
  function proj(V, p) {
    const wx = p[0] * V.Rx + p[2] * V.Fx, wz = p[0] * V.Rz + p[2] * V.Fz;
    return [CX + wx, p[1] - wz * K, wz];
  }
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
  const nrm = (a) => { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  // ---------- Animations ----------
  const ANIMS = {
    idle: { frames: 4, fps: 3 }, walk: { frames: 8, fps: 11 }, run: { frames: 8, fps: 15 },
    sit: { frames: 2, fps: 1.5 }, work: { frames: 4, fps: 6 }, eat: { frames: 4, fps: 3 },
    talk: { frames: 4, fps: 4 }, carry: { frames: 8, fps: 10 }, wave: { frames: 4, fps: 6 },
    crouch: { frames: 2, fps: 2 }, sweep: { frames: 4, fps: 5 }, sleep: { frames: 2, fps: 1 }, lie: { frames: 1, fps: 1 },
    drink: { frames: 4, fps: 2.5 }, read: { frames: 2, fps: 1 }, celebrate: { frames: 4, fps: 5 }, mourn: { frames: 2, fps: 1 },
    point: { frames: 2, fps: 2 }, dig: { frames: 4, fps: 4 }, cook: { frames: 4, fps: 4 },
    attack: { frames: 4, fps: 12 }, open: { frames: 3, fps: 6 }, pickup: { frames: 2, fps: 3 }, hurt: { frames: 2, fps: 8 },
    stretcher: { frames: 8, fps: 9 }, ride: { frames: 1, fps: 1 }, doze: { frames: 2, fps: 0.5 },
  };

  // Two-bone reach: the elbow (or knee) bends toward `pole`.
  function ik(a, target, l1, l2, pole) {
    let d = sub(target, a); let dl = len3(d);
    const maxL = l1 + l2 - 0.05; if (dl > maxL) { d = nrm(d).map((c) => c * maxL); dl = maxL; target = add(a, d); }
    const u = nrm(d), x = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    let pp = sub(pole, u.map((c) => c * (pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2])));
    if (len3(pp) < 1e-3) pp = [0, 0, -1];
    pp = nrm(pp);
    return [add(add(a, u, x), pp, h), target];
  }

  // Joints in body space for one frame. Every animation is defined once and projected to all 8 views.
  function pose(m, anim, f, a) {
    const nF = ANIMS[anim]?.frames || 1, ph = (f / nF) * Math.PI * 2;
    const P = { anim, f, mouth: 0, blink: false, lean: 0, headFwd: 0, headDown: 0, bob: 0, held: null, toolDir: null };
    const thigh = m.leg * 0.5, shin = m.leg * 0.5 - 0.4, hh = m.hipW / 2 - m.legR * 0.85, shHalf = m.shW / 2 - m.limbR * 0.55;
    // legs: swing (+ forward), knee bend, sideways spread
    const leg = (s, swing, bend, spread = 0) => {
      const hip = [s * hh, 0, 0];
      const knee = add(hip, nrm([s * Math.sin(spread), Math.cos(swing), Math.sin(swing)]), thigh);
      const ankle = add(knee, nrm([s * Math.sin(spread) * 0.4, Math.cos(swing - bend), Math.sin(swing - bend)]), shin);
      return { hip, knee, ankle, s };
    };
    let L = { R: leg(1, 0, 0.04), L: leg(-1, 0, 0.04) };
    let lift = 0; // extra hop (running)
    let arms = null; // { R: {swing, bend, abd} | {target} }
    const relaxed = (s, swing = 0, bend = 0.18, abd = 0.07) => ({ swing, bend, abd });
    switch (anim) {
      case 'idle': {
        P.bob = f === 2 ? 0.6 : 0; P.blink = f === 3 && a.variant % 2 === 0;
        arms = { R: relaxed(1, 0.02, 0.2), L: relaxed(-1, 0.02, 0.2) }; break;
      }
      case 'walk': case 'carry': case 'stretcher': {
        const sR = Math.sin(ph), sL = -sR;
        L = { R: leg(1, 0.44 * sR, 0.1 + 0.85 * Math.max(0, Math.cos(ph)) ** 2), L: leg(-1, 0.44 * sL, 0.1 + 0.85 * Math.max(0, Math.cos(ph + Math.PI)) ** 2) };
        arms = { R: relaxed(1, -0.55 * sR, 0.28 + 0.35 * Math.max(0, -sR)), L: relaxed(-1, -0.55 * sL, 0.28 + 0.35 * Math.max(0, -sL)) };
        P.lean = 0.4; break;
      }
      case 'run': {
        const sR = Math.sin(ph), sL = -sR;
        L = { R: leg(1, 0.78 * sR, 0.35 + 1.5 * Math.max(0, Math.cos(ph)) ** 1.5), L: leg(-1, 0.78 * sL, 0.35 + 1.5 * Math.max(0, Math.cos(ph + Math.PI)) ** 1.5) };
        arms = { R: relaxed(1, -0.95 * sR, 1.45, 0.12), L: relaxed(-1, -0.95 * sL, 1.45, 0.12) };
        lift = Math.abs(Math.cos(ph)) > 0.75 ? 1 : 0; P.lean = 1.8; P.headFwd = 0.6; break;
      }
      case 'sit': case 'doze': {
        L = { R: leg(1, 1.45, 1.45, 0.06), L: leg(-1, 1.45, 1.45, 0.06) };
        P.bob = f === 1 ? 0.5 : 0; P.sitting = true; if (anim === 'doze') { P.blink = true; P.headDown = 1; } break;
      }
      case 'sleep': P.blink = true; break;
      case 'crouch': case 'pickup': {
        L = { R: leg(1, 1.25, 2.3, 0.18), L: leg(-1, 0.9, 2.0, 0.18) }; P.lean = 2.2; P.headDown = 1; break;
      }
      case 'hurt': { L = { R: leg(1, -0.1, 0.25), L: leg(-1, 0.15, 0.3) }; P.lean = f ? -1.2 : -0.6; P.blink = true; P.mouth = 1; break; }
      case 'dig': L = { R: leg(1, 0.35, 0.5), L: leg(-1, -0.15, 0.2) }; P.lean = 1.5; break;
      case 'attack': L = { R: leg(1, f === 1 || f === 2 ? 0.35 : 0.1, 0.25), L: leg(-1, -0.25, 0.15) }; P.lean = f === 1 || f === 2 ? 1.4 : 0.2; break;
      case 'mourn': case 'read': P.headDown = 1; break;
      case 'ride': L = { R: leg(1, 0.6, 1.0, 0.55), L: leg(-1, 0.6, 1.0, 0.55) }; P.lean = 0.3; break;
      default: break;
    }
    if (m.stoop) { P.lean += 1; P.headFwd += 0.8; }
    // stand the lowest foot on the ground
    const drop = Math.max(L.R.ankle[1], L.L.ankle[1]);
    const hipY = GROUND - 0.6 - drop - lift + P.bob;
    for (const k of ['R', 'L']) for (const j of ['hip', 'knee', 'ankle']) L[k][j] = [L[k][j][0], L[k][j][1] + hipY, L[k][j][2]];
    const shY = hipY - m.torso;
    P.hipY = hipY; P.shY = shY; P.waistY = shY + Math.round(m.torso * 0.6); P.legs = L;
    const leanZ = P.lean;
    const stg = a && a.stage, neckLen = stg === 'adult' || stg === 'elder' ? 1.5 : stg === 'teen' ? 1.2 : 0.4; // a grown neck between head and shoulders
    const head = [0, shY - 1.2 - neckLen - m.headRy + 0.6 + P.headDown * 0.8, leanZ * 1.1 + P.headFwd + P.headDown * 0.8];
    P.head = head;
    const shoulder = (s) => [s * shHalf, shY + 1.3, leanZ * 0.95];
    const fwdArm = (s, swing, bend, abd) => {
      const sh = shoulder(s);
      const el = add(sh, nrm([s * Math.sin(abd), Math.cos(abd) * Math.cos(swing), Math.cos(abd) * Math.sin(swing)]), m.armU);
      const a2 = swing + bend;
      const hand = add(el, nrm([s * Math.sin(abd) * 0.5 - s * Math.max(0, Math.sin(a2)) * 0.35, Math.cos(a2), Math.sin(a2)]), m.armL);
      return { sh, el, hand, s, fa: a2 };
    };
    const reach = (s, target, pole) => {
      const sh = shoulder(s);
      const [el, hand] = ik(sh, target, m.armU, m.armL, pole || [s * 0.8, 0.5, -0.6]);
      const d = sub(hand, el); return { sh, el, hand, s, fa: Math.atan2(d[2], d[1]) };
    };
    const A = {};
    if (arms) { A.R = fwdArm(1, arms.R.swing, arms.R.bend, arms.R.abd); A.L = fwdArm(-1, arms.L.swing, arms.L.bend, arms.L.abd); }
    else { A.R = fwdArm(1, 0.02, 0.2, 0.07); A.L = fwdArm(-1, 0.02, 0.2, 0.07); }
    const chest = shY + 4, mouth = [0.4, head[1] + m.headRy * 0.55, head[2] + m.headRy * 0.9];
    const D = m.shW * 0.27;
    // the right hand is the tool hand
    switch (anim) {
      case 'work': { // hammering: raise, swing, strike, recover
        const k = [0, 1, 2, 1][f], sw = [2.75, 1.7, 0.75][k], bd = [0.75, 0.45, 0.15][k];
        A.R = fwdArm(1, sw, bd, 0.12); P.toolDir = [0, -Math.sin(A.R.fa + 0.25), Math.cos(A.R.fa + 0.25)];
        A.L = reach(-1, [-1.2, chest + 3, D + 3.2]); P.lean = 0; break;
      }
      case 'attack': { // wind up over the shoulder, strike forward, follow through, recover
        const it = a.outfit.item, armed = ['sword', 'axe', 'dagger', 'hammer', 'spear', 'pitchfork', 'hoe', 'scythe'].includes(it) || P.weapon;
        if (armed) {
          const sw = [2.8, 1.55, 0.55, 1.2][f], bd = [0.6, 0.12, 0.1, 0.35][f];
          A.R = fwdArm(1, sw, bd, [0.25, 0.05, -0.12, 0.1][f]); P.toolDir = [[0.2, 0, -1], [-0.1, -0.35, 1], [-0.2, 0.6, 0.8], [0, -0.6, 0.8]][f];
          A.L = reach(-1, [-2, chest + 2, D + 2]);
        } else { // fists
          const out = f === 1 || f === 2;
          A.R = reach(1, out ? [0.6, shY + 2.5, D + m.armU + m.armL - 1.2] : [1.6, shY + 1.5, D + 2.5], [1, 0.6, -0.3]);
          A.L = reach(-1, [-1.4, shY + 1, D + 2.6], [-1, 0.6, -0.3]);
          P.fist = true;
        }
        P.mouth = f === 1 ? 1 : 0; break;
      }
      case 'open': { const r = [4.5, 7.2, 7.6][f]; A.R = reach(1, [1.4, chest + 1.5, D + r]); break; }
      case 'pickup': { A.R = reach(1, [1.5, GROUND - 2 - (f ? 0 : 1.5), D + 4]); A.L = reach(-1, [-2.5, P.legs.L.knee[1] - 1, P.legs.L.knee[2] + 1]); break; }
      case 'crouch': { A.R = reach(1, [2.2, P.legs.R.knee[1] + 1, P.legs.R.knee[2] + 0.5]); A.L = reach(-1, [-2.2, P.legs.L.knee[1] + 1, P.legs.L.knee[2] + 0.5]); break; }
      case 'sit': case 'doze': { for (const s of [1, -1]) A[s > 0 ? 'R' : 'L'] = reach(s, [s * 2.2, hipY - 1.2, 5.5]); break; }
      case 'eat': case 'drink': {
        const up = f === 1 || f === 2;
        A.R = reach(1, up ? mouth : [1.6, chest + 3, D + 3], [1, 0.8, -0.2]);
        if (anim === 'drink') P.held = 'mug';
        P.mouth = anim === 'eat' && f === 2 ? 1 : 0; break;
      }
      case 'talk': {
        P.mouth = f % 2;
        if (f >= 2) A.R = reach(1, [2.6, chest + (f === 3 ? 0.5 : 1.5), D + 3.8]);
        break;
      }
      case 'wave': A.R = reach(1, [f % 2 ? 5.5 : 3.8, shY - 6.5, 1.5], [1, 0.4, -0.4]); P.mouth = 1; break;
      case 'carry': case 'stretcher': {
        const y = anim === 'stretcher' ? hipY + 1 : chest + 2.5;
        A.R = reach(1, [2.8, y, D + 3.6]); A.L = reach(-1, [-2.8, y, D + 3.6]); P.carrying = anim === 'carry'; break;
      }
      case 'sweep': { const k = [0, 1, 2, 1][f]; A.R = reach(1, [1.5, chest + 1, D + 2.5]); A.L = reach(-1, [-0.5, chest + 5, D + 3 + k]); P.held = 'broom'; P.toolHand = 'L'; P.toolDir = [0.15, 0.85, 0.5 - k * 0.15]; break; }
      case 'read': { A.R = reach(1, [1.6, chest + 3, D + 3.2]); A.L = reach(-1, [-1.6, chest + 3, D + 3.2]); P.held = 'book'; P.book = true; break; }
      case 'celebrate': { const hi = f % 2 === 0; for (const s of [1, -1]) A[s > 0 ? 'R' : 'L'] = reach(s, [s * (hi ? 4.5 : 3.6), shY - (hi ? 8 : 6.5), 1], [s, 0.4, -0.3]); P.bob = hi ? -1 : 0; P.mouth = 1; break; }
      case 'mourn': { A.R = reach(1, [0.6, hipY - 1, D + 1.8]); A.L = reach(-1, [-0.6, hipY - 1, D + 1.8]); P.blink = true; break; }
      case 'point': A.R = reach(1, [1.5, shY + 1.5 - f, 12]); P.mouth = f; break;
      case 'dig': { const k = [0, 1, 2, 1][f]; A.R = reach(1, [1.2, chest + k * 1.5, D + 3]); A.L = reach(-1, [-0.2, chest + 4 + k * 1.5, D + 3.5]); P.held = 'spade'; P.toolDir = [0, 0.95, 0.35]; break; }
      case 'cook': { const k = f % 4; A.R = reach(1, [1.2 + (k % 2), chest + 4 + (k > 1 ? 0.6 : 0), D + 4]); P.held = 'ladle'; P.toolDir = [0, 0.9, 0.3]; break; }
      case 'ride': A.R = reach(1, [1.8, hipY - 2.5, D + 5]); A.L = reach(-1, [-1.8, hipY - 2.5, D + 5]); break;
      case 'hurt': A.R = fwdArm(1, -0.3, 0.6, 0.25); A.L = fwdArm(-1, -0.3, 0.6, 0.25); break;
      default: break;
    }
    P.arms = A; P.D = D;
    return P;
  }

  // ---------- Coverage: which material covers a limb at a point along it ----------
  function coverage(a) {
    const o = a.outfit, skin = a.skin;
    const mail = o.armour === 'mail' ? P.mat(P.metal.iron, 'metal') : null;
    const top = mail ?? (o.over ?? o.shirt);
    const sleeveMat = mail ?? (o.overLen >= 2 ? o.over : o.shirt);
    const isChild = a.stage === 'child' || a.stage === 'olderChild' || a.stage === 'baby';
    return {
      upperArm: () => (o.sleeves === 'none' ? skin : sleeveMat),
      lowerArm: (u) => (o.sleeves === 'short' ? (u < 0.12 ? sleeveMat : skin) : (u < 0.86 ? sleeveMat : skin)),
      upperLeg: () => o.legs,
      lowerLeg: (u) => {
        if (o.shoes && o.boots && u > 0.42) return o.shoes;
        if (!o.shoes) return u > 0.55 ? skin : o.legs;
        if (isChild && u > 0.55) return skin;
        return o.legs;
      },
      foot: () => o.shoes ?? skin,
      top, mail,
    };
  }

  // ---------- Renderer ----------
  // The frame is assembled back to front: hair and cloak behind, the far leg and arm, the body,
  // the head, then the near arm and whatever it holds.
  function render(a, dir, anim, f) {
    const m = bodyMetrics(a), V = viewOf(dir), p = pose(m, anim, f, a);
    const B = new O.MatBuffer(FW, FH); B.mirror = V.mirror;
    const cov = coverage(a), o = a.outfit;
    const S = { a, m, V, p, cov, o, B };
    // projected joints
    const pj = (pt) => proj(V, pt);
    S.pj = pj;
    const hc = pj(p.head); S.hc = hc;
    // which hand holds the tool
    const toolSide = p.toolHand || 'R';
    const held = p.held || (p.carrying ? null : o.item);
    const limbDepth = (L) => (pj(L.knee || L.el)[2] + pj(L.ankle || L.hand)[2]) / 2;
    const legs = ['R', 'L'].map((k) => ({ k, L: p.legs[k], d: limbDepth(p.legs[k]) })).sort((x, y) => y.d - x.d);
    const arms = ['R', 'L'].map((k) => ({ k, A: p.arms[k], d: (pj(p.arms[k].el)[2] + pj(p.arms[k].hand)[2] * 1.4 + pj(p.arms[k].sh)[2] * 0.6) / 3 })).sort((x, y) => y.d - x.d);

    // behind everything: long hair down the back, the cloak, a bow on the back (when seen from the front)
    if (!V.back) { drawLongHair(S, 'back'); drawCloak(S, 'behind'); drawBackItem(S, 'behind'); }
    if (V.back && p.carrying) drawCarried(S);
    // arms that are behind the body
    for (const ar of arms) if (ar.d > 0.9) drawArm(S, ar, ar.k === toolSide ? held : null, G.FARLIMB);
    // legs, far first
    legs.forEach((lg, i) => drawLeg(S, lg, i === 0 && Math.abs(lg.d) > 0.6 ? G.FARLIMB : G.LEGS));
    drawTorso(S);
    drawLowerGarment(S);
    drawBeltThings(S);
    if (V.back) { drawLongHair(S, 'back'); drawCloak(S, 'over'); drawBackItem(S, 'over'); }
    if (held === 'lute') drawLute(S);
    drawHead(S);
    if (!V.back) drawLongHair(S, 'front');
    drawHat(S);
    if (!V.back && p.carrying) drawCarried(S);
    if (o.cloak && V.front) drawCloak(S, 'clasp');
    for (const ar of arms) if (ar.d <= 0.9) drawArm(S, ar, ar.k === toolSide ? held : null, G.ARMS);
    if (p.book) drawBook(S);
    return B.toCanvas();
  }

  function longHair(s) { return s === 'long' || s === 'braid' || s === 'tied' || s === 'veil' || s === 'curly'; }

  function drawLeg(S, lg, group) {
    const { B, m, cov, V } = S, L = lg.L, bias = group === G.FARLIMB ? -1 : 0;
    B.part(group);
    const h = S.pj(L.hip), k = S.pj(L.knee), an = S.pj(L.ankle);
    const r = m.legR;
    B.capsule(h[0], h[1], k[0], k[1], r, r * 0.9, cov.upperLeg, { shadeBias: bias });
    B.capsule(k[0], k[1], an[0], an[1], r * 0.9, r * 0.72, cov.lowerLeg, { shadeBias: bias });
    // knee crease when bent
    const bend = Math.abs((L.knee[2] - L.hip[2]) * (L.ankle[1] - L.knee[1]) - (L.knee[1] - L.hip[1]) * (L.ankle[2] - L.knee[2]));
    if (bend > 5) B.tweak(k[0], k[1], -1);
    // boot top
    const o = S.a.outfit;
    if (o.boots && o.shoes) { const u = 0.42, bx = k[0] + (an[0] - k[0]) * u, by = k[1] + (an[1] - k[1]) * u; for (let dx = -2; dx <= 2; dx++) if (B.get(Math.floor(bx + dx), Math.floor(by)) === o.shoes) B.tweak(bx + dx, by, 1); }
    // foot points the way the body faces; the sole rests flat
    const toe = S.pj([L.ankle[0], L.ankle[1] + 0.3, L.ankle[2] + 2.3]);
    const fm = cov.foot();
    B.capsule(an[0], an[1] + 0.2, toe[0], toe[1], 1.3, 1.15, fm, { shadeBias: bias });
    // sole line
    const sx0 = Math.min(an[0], toe[0]) - 1, sx1 = Math.max(an[0], toe[0]) + 1, sy = Math.floor(Math.max(an[1] + 0.2, toe[1]) + 1.1);
    for (let x = Math.floor(sx0); x <= sx1; x++) if (B.get(x, sy) === fm) B.tweak(x, sy, -1);
  }

  function drawArm(S, ar, held, group) {
    const { B, m, cov, p, a } = S, A = ar.A, bias = group === G.FARLIMB ? -1 : 0;
    B.part(group);
    const sh = S.pj(A.sh), el = S.pj(A.el), hd = S.pj(A.hand);
    const r = m.limbR;
    B.capsule(sh[0], sh[1], el[0], el[1], r * 1.08, r * 0.98, cov.upperArm, { shadeBias: bias });
    B.capsule(el[0], el[1], hd[0], hd[1], r * 0.98, r * 0.85, cov.lowerArm, { shadeBias: bias });
    if (a.outfit.sleeves === 'long') {
      B.tweak(el[0], el[1], -1);
      // the cuff: a turned-back band of the sleeve just above the hand
      const u = 0.8, cx = el[0] + (hd[0] - el[0]) * u, cy = el[1] + (hd[1] - el[1]) * u;
      for (let dx = -2; dx <= 2; dx++) if (B.get(Math.floor(cx + dx), Math.floor(cy)) === cov.lowerArm) B.tweak(cx + dx, cy, -1);
    }
    if (held && p.anim !== 'sleep' && held !== 'lute' && held !== 'book') { B.part(G.ITEM); drawItem(S, held, A, hd); B.part(group); }
    B.capsule(hd[0], hd[1], hd[0], hd[1] + 0.3, r * (p.fist ? 1.1 : 0.98), r * 0.95, a.skin, { shadeBias: bias });
  }

  // Cylindrical body pieces (torso, skirts, cloaks). For each screen pixel find the point on the body's
  // elliptical cross-section facing the viewer; materials and folds are then chosen in body space so
  // an apron stays on the front and a seam stays at the back whichever way the figure turns.
  function bodyShape(S, y0, y1, prof, matFn, opts = {}) {
    const { B, V } = S;
    let minx = 99, maxx = -99;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) { const q = prof(y + 0.5); if (!q) continue; const cx = CX + q.z * V.Fx + (q.x || 0) * V.Rx, e = Math.hypot(q.hw * V.Rx, q.hd * V.Fx); minx = Math.min(minx, cx - e); maxx = Math.max(maxx, cx + e); }
    if (minx > maxx) return;
    const pick = opts.inner ? 1 : -1;
    const info = {};
    const inside = (px, py) => {
      const q = prof(py); if (!q) return false;
      const cx = CX + q.z * V.Fx + (q.x || 0) * V.Rx, A = q.hw * V.Rx, Bv = q.hd * V.Fx, e = Math.hypot(A, Bv);
      if (Math.abs(px - cx) > e) return false;
      const u = O.clamp((px - cx) / e, -1, 1), dl = Math.atan2(Bv, A), ac = Math.acos(u);
      let best = null;
      for (const ph of [dl + ac, dl - ac]) {
        const wz = q.hw * Math.cos(ph) * V.Rz + q.hd * Math.sin(ph) * V.Fz;
        if (!best || pick * wz > pick * best.wz) best = { ph, wz };
      }
      const lx = q.hw * Math.cos(best.ph), lz = q.hd * Math.sin(best.ph);
      if (opts.accept && !opts.accept(lx, py, lz, q)) return false;
      let nlx = Math.cos(best.ph) / q.hw, nlz = Math.sin(best.ph) / q.hd; const nl = Math.hypot(nlx, nlz) || 1; nlx /= nl; nlz /= nl;
      info.lx = lx; info.lz = lz; info.q = q; info.ph = best.ph; info.u = u;
      info.n = [nlx * V.Rx + nlz * V.Fx, (opts.ny || 0) + ((py - y0) / Math.max(1, y1 - y0)) * 0.35 - 0.2, -(nlx * V.Rz + nlz * V.Fz) * (opts.inner ? -0.6 : 1)];
      return true;
    };
    B.shape(minx - 1, y0, maxx + 1, y1, inside, () => { const n = info.n; const l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l, Math.max(0.12, n[2] / l)]; }, (px, py) => matFn(info.lx, py, info.lz, info));
  }

  function drawTorso(S) {
    const { B, a, m, p, o, cov } = S;
    const top = p.shY, waist = p.waistY, bot = p.hipY + 1.6, lean = p.lean;
    const D = p.D;
    const prof = (y) => {
      if (y < top || y > bot) return null;
      let hw, hd;
      if (y < waist) { const t = (y - top) / (waist - top); hw = (m.shW + (m.waistW - m.shW) * Math.pow(t, 1.3)) / 2; hd = D * (1 - t * 0.12) + (a.sex === 'f' && t > 0.2 && t < 0.6 && a.stage !== 'child' ? 0.4 : 0); const r = 2.2, k = y - top; if (k < r) hw -= r - Math.sqrt(Math.max(0, r * r - (r - k) * (r - k))); }
      else { const t = (y - waist) / (bot - waist); hw = (m.waistW + (m.hipW - m.waistW) * Math.min(1, t * 1.6)) / 2; hd = D * 0.92; }
      return { hw: Math.max(1, hw), hd, z: lean * (p.hipY - y) / (p.hipY - top) };
    };
    const tunicDown = o.over && o.overLen >= 1;
    const mat = (lx, y, lz, info) => {
      const front = lz > 0, ax = Math.abs(lx), hw = info.q.hw;
      if (o.belt && y >= waist && y < waist + 1.6) return front && ax < 1.1 ? o.buckle : o.belt;
      if (y >= waist + 1) {
        if (o.tabard && ax < hw * 0.5) return o.tabard;
        if (o.apron && front && ax < hw * 0.62) return o.apron;
        return tunicDown || o.skirt ? (o.skirt && !tunicDown ? o.skirt : o.over) : o.legs;
      }
      if (o.tabard && ax < hw * 0.5 && y > top + 1) return o.tabard;
      if (o.apron && front && ax < hw * 0.55 && y > top + 3) return o.apron;
      if (cov.mail) return cov.mail;
      if (o.over && !o.dress && front && ax < 1.3 - (y - top) * 0.25 && y < top + 3.2) return o.shirt; // open neck
      if (o.dress && o.over && front && y < top + 2.2 && ax < hw * 0.7) return o.shirt; // chemise above the bodice
      return cov.top;
    };
    B.part(G.TORSO);
    // neck
    const nb = S.pj([0, top + 1, lean * 0.95]), nt = S.pj([0, S.p.head[1] + m.headRy * 0.6, S.p.head[2] * 0.9]);
    B.capsule(nt[0], nt[1], nb[0], nb[1], 1.7, 1.9, a.skin);
    bodyShape(S, top, bot, prof, mat);
    // texture: mail rings, folds, seams, laces, buttons
    const ys = Math.floor(top), ye = Math.ceil(bot);
    for (let y = ys; y <= ye; y++) for (let x = 0; x < FW; x++) {
      const mm = B.get(x, y);
      if (cov.mail && mm === cov.mail && (x + y) % 2 === 0) B.tweak(x, y, -1);
    }
    const front = S.V.front || S.V.side;
    const fx = (lx, y, lz) => S.pj([lx, y, lz + lean * (p.hipY - y) / (p.hipY - top)]);
    if (S.V.Fz < 0.2) {
      if (o.dress && o.over) for (let y = top + 3; y < waist; y += 2) { const q = fx(0, y, D * 1.02); if (B.get(Math.floor(q[0]), Math.floor(q[1])) === o.over) B.plot(q[0], q[1], o.shirt, 3, 1); }
      else if (o.over && !cov.mail && !o.tabard && !o.apron && a.wealth > 0.45) for (let y = top + 3.5; y < waist - 1; y += 2.5) { const q = fx(0, y, D * 1.02); if (B.get(Math.floor(q[0]), Math.floor(q[1])) === o.over) B.plot(q[0], q[1], o.trim || o.buckle, 3, 1); }
      // chest fold under the arms
      for (const s of [1, -1]) { const q = fx(s * (m.waistW / 2 - 1.4), waist - 1.5, D * 0.8); B.tweak(q[0], q[1], -1); }
    }
    if (S.V.back) { for (let y = top + 2; y < waist; y++) { const q = fx(0, y, -D); B.tweak(q[0], q[1], -1); } }
    void front;
    // trim at the collar
    if (o.trim && o.over) for (let x = 0; x < FW; x++) { const mm = B.get(x, Math.floor(top + 0.5)); if (mm === o.over || mm === cov.top) B.plot(x, top + 0.5, o.trim, 3); }
  }

  // tunic skirts, coats, robes, dresses and the leather apron below the waist
  function drawLowerGarment(S) {
    const { B, m, p, o, a } = S;
    const waist = p.waistY;
    let mat = null, hem = 0, flare = 0;
    if (o.skirt) { mat = o.skirt; hem = p.sitting ? p.hipY + 5 : GROUND - 1.5 - (o.skirtLen ? 0 : 5); flare = 4; }
    else if (o.over && o.overLen >= 3) { mat = o.over; hem = GROUND - 1.5; flare = 3; }
    else if (o.over && o.overLen === 2) { mat = o.over; hem = p.hipY + m.leg * 0.62; flare = 3; }
    else if (o.over && o.overLen === 1) { mat = o.over; hem = p.hipY + 4.5; flare = 1.6; }
    const walking = ['walk', 'run', 'carry', 'stretcher'].includes(p.anim);
    const sway = walking ? Math.sin((p.f / 8) * Math.PI * 2) * (p.anim === 'run' ? 1.4 : 0.8) : 0;
    if (mat) {
      if (p.sitting) hem = Math.min(hem, p.hipY + 5);
      const top = waist + 1;
      const prof = (y) => {
        if (y < top || y > hem) return null;
        const t = (y - top) / Math.max(1, hem - top);
        const hw = m.hipW / 2 + 0.4 + t * flare + (p.sitting ? 1 : 0), hd = p.D * 0.95 + t * flare * 0.8 + (p.sitting ? 3 : 0);
        return { hw, hd, z: p.lean * (p.hipY - y) / (p.hipY - p.shY) + sway * t * t + (p.sitting ? 2.5 * t : 0), x: 0 };
      };
      B.part(G.SKIRT);
      const folds = Math.max(4, Math.round(m.hipW / 1.6));
      const tab = o.tabard, apron = o.apron;
      bodyShape(S, top, hem, prof, (lx, y, lz, info) => {
        const ax = Math.abs(lx);
        if (tab && ax < info.q.hw * 0.45) return tab;
        if (apron && lz > 0 && ax < info.q.hw * 0.55 && y < waist + m.leg * 0.62) return apron;
        return mat;
      });
      // folds follow the cloth round the body
      for (let y = Math.floor(top + 2); y <= hem; y++) for (let x = 0; x < FW; x++) {
        const mm = B.get(x, y); if (mm !== mat) continue;
        const k = ((x * 7 + (a.variant % 5)) % folds);
        if (k === 0 && y > top + 2) B.tweak(x, y, -1);
        if (y === Math.floor(hem)) B.tweak(x, y, -1);
      }
      if (o.trim && o.skirt) for (let x = 0; x < FW; x++) if (B.get(x, Math.floor(hem)) === mat) B.plot(x, hem, o.trim, 2);
    } else if (o.apron && S.V.Fz < 0.5) {
      // an apron over trousers: a flat panel from the waist to the knee, on the front
      B.part(G.SKIRT);
      const aw = Math.max(2.4, m.waistW / 2 - 0.8), y1 = Math.min(GROUND - 4, waist + m.leg * 0.62);
      const z0 = p.D + 0.4 + p.lean * (p.hipY - waist) / (p.hipY - p.shY), z1 = p.D + 1 + sway * 0.4;
      const c = [S.pj([-aw, waist + 1, z0]), S.pj([aw, waist + 1, z0]), S.pj([aw + 0.8, y1, z1]), S.pj([-aw - 0.8, y1, z1])];
      const n = [S.V.Fx * 0.9, 0.1, Math.max(0.2, -S.V.Fz)];
      B.poly(c.map((q) => [q[0], q[1]]), n, o.apron);
      for (let y = Math.floor(waist + 3); y < y1; y++) for (let x = 0; x < FW; x++) if (B.get(x, y) === o.apron && (x + (a.variant % 3)) % 4 === 0) B.tweak(x, y, -1);
    }
  }

  // belt pouch and a sword at the hip
  function drawBeltThings(S) {
    const { B, p, o, m, V } = S;
    if (o.pouch && o.belt) {
      const q = S.pj([m.waistW / 2 - 0.2, p.waistY + 2.6, p.D * 0.5]);
      if (q[2] < 1.5) { B.part(G.ITEM); B.blob(q[0], q[1], 1.5, 1.7, P.mat(C.leather), { power: 2.4 }); B.tweak(q[0], q[1] - 1, -1); }
    }
    if (o.sideItem === 'sword') {
      const a0 = S.pj([-(m.hipW / 2 + 0.6), p.waistY + 1, 0.8]), a1 = S.pj([-(m.hipW / 2 + 1.2), p.waistY + 10, -3]);
      if ((a0[2] + a1[2]) / 2 < 1.5 || V.back) {
        B.part(G.ITEM); B.capsule(a0[0], a0[1], a1[0], a1[1], 0.85, 0.7, P.mat(C.darkLeather));
        B.plot(a0[0], a0[1] - 1, P.mat(P.metal.brass, 'metal'), 3); B.plot(a0[0], a0[1] - 2, P.mat(P.metal.steel, 'metal'), 3);
      }
    }
  }

  // ---------- Head ----------
  // The head is an ellipsoid; each pixel is mapped back to a point on it in body space, so the
  // hairline, beard and face stay put on the skull as it turns. Features are stamped at projected
  // points, with the front view exactly symmetric about the centre line.
  function headFrame(S) {
    const { m, V } = S, rx = m.headRx, ry = m.headRy, rd = rx * 1.1;
    const e = Math.hypot(rx * V.Rx, rd * V.Fx);
    return { rx, ry, rd, e, cx: S.hc[0], cy: S.hc[1] };
  }
  // point on the head (unit body-space direction) -> screen
  function headPt(S, H, lx, ly, lz) {
    const { V } = S;
    const wx = lx * H.rx * V.Rx + lz * H.rd * V.Fx, wz = lx * V.Rz + lz * V.Fz;
    return [H.cx + wx, H.cy + ly * H.ry, wz];
  }
  // a screen pixel on the head -> body-space unit direction
  function headLocal(S, H, px, py, grow = 0) {
    const { V } = S;
    const dx = (px - H.cx) / (H.e + grow), dy = (py - H.cy) / (H.ry + grow);
    const z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    const wx = dx, wz = -z;
    return { lx: wx * V.Rx + wz * V.Rz, ly: dy, lz: wx * V.Fx + wz * V.Fz, dx, dy, z };
  }

  const HAIRLINE = { // [front hairline, side drop, back drop, volume]
    short: [-0.45, 0.1, 0.7, 0.7], crop: [-0.55, -0.1, 0.45, 0.35], messy: [-0.3, 0.2, 0.75, 1.1], shaggy: [-0.28, 0.35, 0.9, 1.1],
    long: [-0.45, 1.2, 1.2, 0.8], tied: [-0.5, 0.15, 0.8, 0.5], curly: [-0.42, 0.6, 1, 1.4], bun: [-0.5, 0.1, 0.65, 0.5],
    braid: [-0.5, 0.2, 0.8, 0.5], bob: [-0.2, 0.55, 0.7, 0.9], bald: [-2, -2, -2, 0], veil: [-0.5, 1.2, 1.2, 0.9],
  };
  function hairAt(st, l, variant) {
    const [fl, sd, bd] = HAIRLINE[st] || HAIRLINE.short;
    // three bands round the skull: the back (down to the nape), the ear band (sideburns) and the
    // front, where the hairline rises over the temples to the forehead
    const back = O.clamp((-l.lz - 0.15) / 0.3, 0, 1), fwd = O.clamp((l.lz + 0.02) / 0.22, 0, 1);
    let line = sd + (bd - sd) * back;
    line += (Math.min(sd, fl + 0.18) - line) * fwd;
    const face = fwd * O.clamp((0.78 - Math.abs(l.lx)) / 0.3, 0, 1);
    line += (fl - line) * face;
    if (st === 'messy' || st === 'shaggy') line += ((Math.floor((l.lx + 1) * 9) + variant) % 3 === 0 ? 0.12 : 0) * face;
    if (st === 'bob' && face > 0.5) line = fl + (Math.abs(l.lx) > 0.45 ? 0.6 : 0);
    // never over the eyes
    if (face > 0.6 && Math.abs(l.lx) < 0.62 && l.ly > -0.18) return false;
    return l.ly < line;
  }
  function beardAt(b, l) {
    if (!b || b === 'none' || b === 'stubble') return false;
    if (l.lz < -0.25) return false;
    const ax = Math.abs(l.lx);
    if (b === 'moustache') return l.lz > 0.55 && ax < 0.42 && l.ly > 0.44 && l.ly < 0.56;
    if (b === 'goatee') return (l.lz > 0.55 && ax < 0.42 && l.ly > 0.44 && l.ly < 0.56) || (l.lz > 0.5 && ax < 0.28 && l.ly > 0.66);
    // full / long: jaw, chin, sideburns and moustache, mouth left clear
    if (l.ly > 0.56 && l.ly < 0.68 && ax < 0.26 && l.lz > 0.6) return false;
    if (l.ly > 0.44 && l.lz > 0.2) return true;
    return ax > 0.72 && l.ly > -0.05 && l.lz > -0.25 && l.lz < 0.5;
  }

  function drawHead(S) {
    const { B, a, V } = S, H = headFrame(S), st = a.hairStyle, o = a.outfit;
    const hatCovers = o.hat === 'hood' || o.hat === 'kettle' || st === 'veil';
    const style = hatCovers ? (o.hat === 'kettle' ? 'crop' : 'bald') : st;
    const vol = (HAIRLINE[style] || HAIRLINE.short)[3];
    const jaw = 0.2 + a.genes.face.jaw * 0.5;
    const insideHead = (px, py) => {
      const dx = (px - H.cx) / H.e, dy = (py - H.cy) / H.ry;
      const jw = dy > 0 ? 1 - jaw * dy * dy * (0.4 + 0.6 * Math.abs(V.Fz)) : 1;
      // chin juts forward in profile
      const chin = V.side && dy > 0.3 && (px - H.cx) > 0 ? 0.12 : 0;
      return (dx / (jw + chin)) ** 2 + dy * dy <= 1;
    };
    // outer hair volume behind the skull silhouette
    if (style !== 'bald' && vol > 0) {
      B.part(G.HAIR);
      B.shape(H.cx - H.e - vol - 1, H.cy - H.ry - vol - 1, H.cx + H.e + vol + 1, H.cy + H.ry + vol, (px, py) => {
        if (insideHead(px, py)) return false;
        const dx = (px - H.cx) / (H.e + vol), dy = (py - H.cy) / (H.ry + vol);
        if (dx * dx + dy * dy > 1) return false;
        const l = headLocal(S, H, px, py, vol);
        if (l.ly > 0.25 && !longHair(style)) return false;
        return hairAt(style, l, a.variant) && !(l.lz > 0.35 && l.ly > -0.1);
      }, (px, py) => { const l = headLocal(S, H, px, py, vol); return [l.dx, l.dy, l.z]; }, a.hair, { maxShade: 3 });
    }
    // skull, face and hair painted on it
    B.part(G.HEAD);
    const lc = {};
    B.shape(H.cx - H.e - 1, H.cy - H.ry - 1, H.cx + H.e + 1, H.cy + H.ry + 1, (px, py) => { if (!insideHead(px, py)) return false; Object.assign(lc, headLocal(S, H, px, py)); return true; },
      () => [lc.dx, lc.dy, Math.max(0.2, lc.z)],
      () => (style !== 'bald' && hairAt(style, lc, a.variant) ? a.hair : beardAt(a.beard, lc) ? a.hair : a.skin));
    // hair strands and curls
    for (let y = Math.floor(H.cy - H.ry - 3); y < H.cy + H.ry + 2; y++) for (let x = Math.floor(H.cx - H.e - 3); x < H.cx + H.e + 3; x++) {
      if (B.get(x, y) !== a.hair) continue;
      if (st === 'curly' && (x * 3 + y * 5) % 7 === 0) B.tweak(x, y, -1);
      else if ((x + (a.variant % 3)) % 3 === 0 && (y + a.variant) % 2 === 0) B.tweak(x, y, x < H.cx ? 1 : -1);
    }
    drawFace(S, H);
    // bun on top / back
    if (st === 'bun' && !hatCovers) { const q = headPt(S, H, 0, -0.75, -0.55); B.part(G.HAIR); B.blob(q[0], q[1], 2.3, 2.1, a.hair, { power: 2 }); B.tweak(q[0], q[1], -1); }
    // ponytail / braid hanging behind
    if ((st === 'tied' || st === 'braid') && !hatCovers && !V.front) {
      const q0 = headPt(S, H, 0, 0.1, -1.05), n = st === 'braid' ? 11 : 7; B.part(G.HAIR);
      for (let i = 0; i < n; i++) { const y = q0[1] + i, w = st === 'braid' ? 1.25 : 1.5 - i * 0.06; B.capsule(q0[0] - V.Fx * i * 0.12, y, q0[0] - V.Fx * (i + 1) * 0.12, y + 1, w, w, a.hair); if (st === 'braid' && i % 2) B.tweak(q0[0], y, -1); }
    }
  }

  function drawFace(S, H) {
    const { B, a, p, V } = S, f = a.genes.face, elder = a.stage === 'elder';
    const plot = (x, y, mt, s) => B.plot(x, y, mt, s, 1);
    const isSkin = (x, y) => B.get(Math.floor(x), Math.floor(y)) === a.skin || B.get(Math.floor(x), Math.floor(y)) === a.hair;
    const blink = p.blink || (p.anim === 'idle' && p.f === 3 && a.variant % 3 === 0);
    // eyes: centres at whole-pixel boundaries in the front view so both eyes are exact mirror images
    const eyeY = H.cy + H.ry * 0.1;
    const nose = headPt(S, H, 0, 0.36, 0.8);
    const browM = a.hairStyle === 'bald' || a.hairStyle === 'veil' ? a.lip : a.hair;
    const gap = 0.36 + f.eyeGap * 0.04;
    for (const s of [1, -1]) {
      const q = headPt(S, H, s * gap, 0.1, 0.62), wf = -q[2];
      if (wf < 0.18) continue;
      const ex = Math.round(q[0]), ey = Math.floor(eyeY);
      const outer = q[0] < nose[0] - 0.3 ? -1 : q[0] > nose[0] + 0.3 ? 1 : (s > 0 ? -1 : 1) * (V.mirror ? -1 : 1);
      const cols = wf > 0.55 ? [ex - 1, ex] : [outer < 0 ? ex - 1 : ex];
      if (!isSkin(cols[0], ey)) continue;
      if (blink) { for (const x of cols) plot(x, ey, a.skin, 0); }
      else {
        // one clean eye: a dark pupil over the iris on the inner side, the white beside it, a lid shadow above
        const inner = cols.length > 1 ? (outer < 0 ? cols[1] : cols[0]) : cols[0], outerCol = cols.length > 1 ? (outer < 0 ? cols[0] : cols[1]) : null;
        // two pixels tall: the dark pupil with a glint, the coloured iris under it, the white beside
        // a detailed eye, two wide and three tall: the lid line, then the white beside the dark pupil,
        // then the coloured iris under the pupil
        if (outerCol != null) {
          plot(inner, ey - 1, a.eyeDark, 1); plot(outerCol, ey - 1, a.eyeDark, 1);
          plot(outerCol, ey, a.eyeWhite, 3); plot(inner, ey, a.eyeDark, 0);
          plot(inner, ey + 1, a.eyes, 2); plot(outerCol, ey + 1, a.eyes, 1);
        } else { plot(inner, ey - 1, a.eyeDark, 1); plot(inner, ey, a.eyeDark, 0); plot(inner, ey + 1, a.eyes, 2); }
        if (a.sex === 'f' && a.stage !== 'child' && outerCol != null) { const lx = outerCol + (outerCol > inner ? 1 : -1); if (isSkin(lx, ey - 1)) plot(lx, ey - 1, a.eyeDark, 1); } // lashes
        if (f.eyeType === 1) plot(inner, ey + 1, a.skin, 1); // heavy lower lid
      }
      // brow
      const by = ey - 3 - (H.ry > 6.5 ? 1 : 0);
      if (f.brow > 0 || elder || a.sex === 'm') {
        const bc = wf > 0.55 ? [ex - 1, ex] : cols;
        for (const x of bc) if (isSkin(x, by)) plot(x, by, browM, a.sex === 'f' ? 2 : f.brow > 1 ? 0 : 1);
        if (f.brow > 1 && wf > 0.55) { const ox = outer < 0 ? bc[0] - 1 : bc[bc.length - 1] + 1; if (isSkin(ox, by + 1)) plot(ox, by + 1, browM, 1); }
      }
      // cheeks and lines
      const ch = headPt(S, H, s * 0.62, 0.48, 0.65);
      if (-ch[2] > 0.3 && (a.sex === 'f' || a.stage === 'child' || a.stage === 'baby') && isSkin(ch[0], ch[1])) plot(ch[0], ch[1], a.lip, 3);
      if (f.freckles && -ch[2] > 0.3) { plot(ch[0] - s * 0.6, ch[1] - 1, a.skin, 1); }
      if (elder && -ch[2] > 0.3) { plot(ch[0], ch[1] + 1, a.skin, 1); plot(Math.round(q[0]) + outer * 1.5, ey, a.skin, 1); }
    }
    // nose: in profile a bump past the outline, otherwise a shadow beside the bridge
    const nw = -nose[2];
    const ny = Math.floor(eyeY) + 2;
    if (V.side || Math.abs(V.Fx) > 0.6 && !V.back) {
      // a small nose: one pixel just past the cheek in profile, a shaded bridge in three-quarter view
      if (nw > -0.2) {
        const dir = V.mirror ? -1 : 1;
        if (V.side) { const edge = Math.round(H.cx + dir * (H.e - 0.2)); B.part(G.HEAD); if (B.get(edge, ny) !== a.skin) B.plot(edge, ny, a.skin, 2); if (f.nose === 2) B.plot(edge, ny - 1, a.skin, 3); }
        else { const nx = Math.round(nose[0]); plot(nx, ny, a.skin, 1); plot(nx, ny - 1, a.skin, 3); }
      }
    } else if (nw > 0.4) {
      const nx = Math.round(nose[0]);
      plot(nx, ny, a.skin, 1); if (f.nose >= 1) plot(nx, ny - 1, a.skin, 2); plot(nx - 1, ny, a.skin, 3);
    }
    // mouth
    const mq = headPt(S, H, 0, 0.62, 0.8);
    if (-mq[2] > 0 || V.side) {
      const my = Math.floor(eyeY) + 4 + (H.ry > 6.5 ? 1 : 0) - (H.ry < 5.3 ? 1 : 0);
      const mxc = V.side ? Math.round(H.cx + H.e * 0.68) : Math.round(mq[0]);
      const wide = -mq[2] > 0.55;
      const xs = wide ? [mxc - 1, mxc] : [mxc - (V.side ? 0 : 1)];
      if (p.mouth) { for (const x of xs) plot(x, my, a.eyeDark, 1); for (const x of xs) plot(x, my + 1, a.lip, 1); }
      else { for (const x of xs) plot(x, my, a.lip, a.sex === 'f' ? 2 : 1); if (wide) for (const x of xs) if (B.get(x, my + 1) === a.skin) B.tweak(x, my + 1, 1); }
      if (a.beard === 'stubble') for (let x = mxc - 3; x <= mxc + 2; x++) for (const yy of [my + 1, my + 2]) if (B.get(x, yy) === a.skin && (x + yy) % 2 === 0) B.tweak(x, yy, -1);
    }
    // ears, unless covered
    const hidesEars = longHair(a.hairStyle) || a.hairStyle === 'bob' || a.hairStyle === 'shaggy' || a.outfit.hat === 'hood' || a.outfit.hat === 'kettle';
    if (!hidesEars) for (const s of [1, -1]) {
      const q = headPt(S, H, s * 1, 0.12, -0.05);
      if (q[2] > 0.5) continue;
      B.part(G.HEAD);
      if (Math.abs(V.Fx) > 0.9) { // profile: the ear sits mid-head
        const ex = Math.round(q[0]) - 1, ey = Math.floor(eyeY);
        B.plot(ex, ey, a.skin, 2); B.plot(ex, ey + 1, a.skin, 1); B.plot(ex + 1, ey + 1, a.skin, 3); B.plot(ex + 1, ey, a.skin, 3);
      } else {
        const side = q[0] < H.cx ? -1 : 1, ex = side < 0 ? Math.floor(H.cx - H.e) - 1 + 0 : Math.ceil(H.cx + H.e);
        if (Math.abs(q[0] - H.cx) < H.e * 0.82) continue;
        const ey = Math.floor(eyeY);
        B.plot(side < 0 ? ex + 1 : ex - 1, ey + 1, a.skin, 1); // a small ear tucked against the head, not a handle
      }
    }
    // a long beard falls below the chin
    if ((a.beard === 'long' || a.beard === 'full') && !V.back) {
      const c = headPt(S, H, 0, 0.92, 0.45), len = a.beard === 'long' ? 4.5 : 1.6;
      B.part(G.HAIR);
      B.shape(c[0] - 4, c[1] - 1, c[0] + 4, c[1] + len + 1, (px, py) => { const t = (py - c[1]) / (len + 0.5); if (t < 0 || t > 1) return false; return Math.abs(px - c[0]) <= (H.e * 0.62) * (1 - t * 0.7) * (V.side ? 0.6 : 1); }, () => [0, 0.3, 0.9], a.hair, { maxShade: 3 });
      for (let y = Math.floor(c[1]); y < c[1] + len; y += 2) B.tweak(c[0] + ((y % 3) - 1), y, -1);
    }
  }

  // Long hair hanging behind the head and shoulders, and the locks that fall over the shoulders in front.
  function drawLongHair(S, layer) {
    const { B, a, V, m } = S, st = a.hairStyle;
    if (!(st === 'long' || st === 'curly' || st === 'veil') || a.outfit.hat === 'hood') return;
    const H = headFrame(S), mt = st === 'veil' ? P.mat(C.white) : a.hair;
    const len = st === 'curly' ? 6 : 10;
    if (layer === 'back') {
      B.part(G.BACK);
      const zb = -H.rd * 0.55;
      const pts = [[-H.rx * 0.95, H.cy, zb], [H.rx * 0.95, H.cy, zb], [H.rx * 0.8 + (st === 'curly' ? 1 : 0), H.cy + H.ry + len, zb - 1.5], [-H.rx * 0.8 - (st === 'curly' ? 1 : 0), H.cy + H.ry + len, zb - 1.5]];
      const c = pts.map((q) => S.pj([q[0], q[1], q[2] + S.p.head[2]]));
      B.poly(c.map((q) => [q[0], q[1]]), (px, py) => [O.clamp((px - H.cx) / 6, -1, 1) * 0.8, 0.1, 0.6], mt, { maxShade: 3 });
      for (let y = Math.floor(H.cy); y < H.cy + H.ry + len + 1; y++) for (let x = 0; x < FW; x++) if (B.get(x, y) === mt && (x + (a.variant % 3)) % 3 === 0) B.tweak(x, y, -1);
    } else if (V.front || V.side) {
      B.part(G.HAIR);
      for (const s of [1, -1]) {
        const q0 = S.pj([s * H.rx * 0.88, H.cy + 1, S.p.head[2] + 0.6]), q1 = S.pj([s * (H.rx * 0.95), H.cy + H.ry + (st === 'curly' ? 3.5 : 6), S.p.head[2] + 1.6]);
        if ((q0[2] + q1[2]) / 2 > -0.2 && !V.side) continue;
        if (V.side && s < 0) continue;
        B.capsule(q0[0], q0[1], q1[0], q1[1], 1.35, 1.1, mt);
      }
      void m;
    }
  }

  function drawHat(S) {
    const { B, a, V, p } = S, o = a.outfit; if (!o.hat) return;
    const H = headFrame(S), M = o.hatMat;
    B.part(G.HAT);
    const dome = (grow, below, matFn) => B.shape(H.cx - H.e - grow - 1, H.cy - H.ry - grow - 1, H.cx + H.e + grow + 1, H.cy + H.ry, (px, py) => {
      const dx = (px - H.cx) / (H.e + grow), dy = (py - H.cy) / (H.ry + grow); if (dx * dx + dy * dy > 1) return false;
      const l = headLocal(S, H, px, py, grow); return below(l);
    }, (px, py) => { const dx = (px - H.cx) / (H.e + grow), dy = (py - H.cy) / (H.ry + grow); return [dx, dy, Math.sqrt(Math.max(0.1, 1 - dx * dx - dy * dy))]; }, matFn || M);
    const brim = (y, r, mt) => { const ry = Math.max(1.1, r * K * 0.42); B.shape(H.cx - r - 1, y - ry - 1, H.cx + r + 1, y + ry + 1, (px, py) => ((px - H.cx) / r) ** 2 + ((py - y) / ry) ** 2 <= 1, (px, py) => [((px - H.cx) / r) * 0.5, -0.7, 0.5], mt || M); };
    const top = H.cy - H.ry;
    switch (o.hat) {
      case 'cap': dome(0.7, (l) => l.ly < -0.3 + (l.lz < 0 ? 0.1 : 0)); if (V.front || V.side) { const q = headPt(S, H, 0, -0.32, 1); B.plot(q[0], q[1], M, 1); if (V.side) B.plot(q[0] + 1, q[1], M, 1); } break;
      case 'coif': dome(0.6, (l) => l.ly < -0.15 || (Math.abs(l.lx) > 0.72 && l.ly < 0.45 && l.lz < 0.4)); break;
      case 'straw': {
        const by = top + 2.6; brim(by, H.e + 3.8);
        for (let y = Math.floor(by - 3); y < by + 3; y++) for (let x = 0; x < FW; x++) if (B.get(x, y) === M && (x + y * 2) % 3 === 0) B.tweak(x, y, -1);
        dome(0.3, (l) => l.ly < -0.42);
        const band = P.mat(C.madder); for (let x = Math.floor(H.cx - H.e); x <= H.cx + H.e; x++) if (B.get(x, Math.floor(by) - 1) === M) B.plot(x, by - 1, band, 2);
        break;
      }
      case 'hood': {
        // a cowl round the face that drapes onto the shoulders
        B.shape(H.cx - H.e - 4, H.cy - H.ry - 3, H.cx + H.e + 4, p.shY + 4, (px, py) => {
          const dx = (px - H.cx) / (H.e + 1.4), dy = (py - (H.cy - 0.4)) / (H.ry + 1.5);
          let inH = dx * dx + dy * dy <= 1;
          if (!inH && py > H.cy && py < p.shY + 3.5 && Math.abs(px - H.cx) < H.e + 2.6 - (p.shY + 3.5 - py) * 0.25) inH = true;
          if (!inH) return false;
          if (V.back) return true;
          const l = headLocal(S, H, O.clamp(px, H.cx - H.e + 0.01, H.cx + H.e - 0.01), O.clamp(py, H.cy - H.ry + 0.01, H.cy + H.ry - 0.01));
          return !(l.lz > 0.25 && Math.abs(l.lx) < 0.7 && l.ly > -0.55 && l.ly < 0.95 && py < H.cy + H.ry);
        }, (px, py) => { const nx = (px - H.cx) / (H.e + 3); return [nx, (py - H.cy) / (H.ry + 4), Math.sqrt(Math.max(0.1, 1 - nx * nx))]; }, M);
        if (!V.back) for (let y = Math.floor(H.cy - H.ry + 1); y < H.cy + H.ry; y++) for (let x = 0; x < FW; x++) if (B.get(x, y) === M && (B.get(x + 1, y) === a.skin || B.get(x - 1, y) === a.skin || B.get(x, y + 1) === a.skin)) B.tweak(x, y, -2);
        if (V.back) { B.tweak(H.cx, H.cy + H.ry, -1); B.tweak(H.cx, H.cy + H.ry + 1, -1); }
        break;
      }
      case 'kettle': { const by = top + 2.8; brim(by, H.e + 2.6); dome(0.4, (l) => l.ly < -0.3); for (let x = Math.floor(H.cx - H.e); x <= H.cx + H.e; x++) if (B.get(x, Math.floor(by)) === M) B.tweak(x, by, -1); break; }
      case 'feather': {
        dome(0.8, (l) => l.ly < -0.38);
        const q = headPt(S, H, -0.7, -0.6, -0.3), F = P.mat(C.white);
        const t = [q[0] - 3 * (V.Fx || 0.4) * (V.mirror ? 1 : 1), q[1] - 5];
        B.capsule(q[0], q[1], t[0], t[1], 0.9, 0.55, F); B.tweak(t[0], t[1], -1);
        break;
      }
      case 'crown': {
        const G1 = P.mat(P.metal.gold, 'metal');
        dome(0.6, (l) => l.ly < -0.42 && l.ly > -0.62, G1);
        for (const s of [-0.5, 0, 0.5]) { const q = headPt(S, H, s, -0.72, 0.6); if (q[2] < 0.3) { B.plot(q[0], q[1], G1, 4); B.plot(q[0], q[1] - 1, G1, 3); } }
        break;
      }
      default: break;
    }
  }

  function drawCloak(S, layer) {
    const { B, a, m, p, V } = S, M = a.outfit.cloak; if (!M) return;
    const top = p.shY - 0.3, bot = Math.min(GROUND - 3, p.hipY + m.leg * 0.62);
    const walking = ['walk', 'run', 'carry'].includes(p.anim);
    const trail = walking ? (p.anim === 'run' ? 2.6 : 1) : 0;
    const prof = (y) => { if (y < top || y > bot) return null; const t = (y - top) / (bot - top); return { hw: m.shW / 2 + 0.6 + t * 2.4, hd: p.D + 0.8 + t * 1.6, z: p.lean * (1 - t) - trail * t * t }; };
    if (layer === 'clasp') { B.part(G.ITEM); const q = S.pj([0, top + 1.2, p.D + 0.6 + p.lean]); const cl = P.mat(P.metal.gold, 'metal'); B.plot(q[0] - 1, q[1], cl, 4); B.plot(q[0], q[1], cl, 3); return; }
    B.part(G.BACK);
    // the cloak covers the back half of the body; from the front we see its lining at the sides
    bodyShape(S, top, bot, prof, () => M, { accept: (lx, y, lz) => lz < (layer === 'over' ? 0.3 : 99), inner: layer === 'behind' && V.front });
    for (let y = Math.floor(top + 3); y <= bot; y++) for (let x = 0; x < FW; x++) if (B.get(x, y) === M && (x * 5 + a.variant) % 6 === 0) B.tweak(x, y, -1);
  }

  function drawBackItem(S, layer) {
    const { B, a, p, V } = S, it = a.outfit.backItem; if (!it) return;
    if ((layer === 'over') !== V.back) return;
    B.part(layer === 'over' ? G.BACKITEM : G.BACK);
    const W = P.mat(P.wood.oak, 'wood'), St = P.mat(C.linen);
    if (it === 'bow') {
      const z = -p.D - 1.2, n = 12;
      for (let i = 0; i <= n; i++) { const t = i / n, bend = Math.sin(t * Math.PI) * 2.2; const q = S.pj([-3 + 6 * t, p.shY - 3 + (p.hipY + 6 - p.shY) * t, z - bend]); B.plot(q[0], q[1], W, t < 0.5 ? 3 : 2); }
      const s0 = S.pj([-3, p.shY - 3, z]), s1 = S.pj([3, p.hipY + 3, z]); B.capsule(s0[0], s0[1], s1[0], s1[1], 0.3, 0.3, St);
    }
  }

  function drawCarried(S) {
    const { B, p, V } = S;
    B.part(G.ITEM);
    const crate = P.mat(P.wood.pine, 'wood');
    const c = S.pj([0, p.shY + 5, p.D + 3.8 + p.lean]);
    const w = Math.hypot(4.6 * V.Rx, 3.2 * V.Fx), h = 3.4;
    B.blob(c[0], c[1], w, h, crate, { power: 6 });
    for (let x = Math.floor(c[0] - w); x <= c[0] + w; x++) B.tweak(x, c[1], -1);
    B.tweak(c[0] - 2, c[1] - 2, 1);
  }

  function drawBook(S) {
    const { B, p, V } = S;
    if (V.back) return;
    B.part(G.ITEM);
    const c = S.pj([0, p.shY + 6.5, p.D + 3.8]);
    const w = Math.max(1.5, Math.hypot(3.2 * V.Rx, 1 * V.Fx));
    B.blob(c[0], c[1], w, 2, P.mat(C.crimson), { power: 4 });
    for (let x = Math.floor(c[0] - w + 1); x < c[0] + w - 0.5; x++) B.plot(x, c[1] - 1, P.mat(C.white), 3);
  }

  function drawLute(S) {
    const { B, p, V } = S;
    const lm = P.mat('#b07a3a', 'wood'), nk = P.mat(P.wood.dark, 'wood'), hole = P.mat('#2a1a10', 'wood');
    const body = S.pj([1.4, p.waistY + 1, p.D + 2.4]), neck = S.pj([-3.5, p.shY - 2, p.D + 2]);
    B.part(V.back ? G.BACK : G.ITEM);
    B.capsule(body[0], body[1], neck[0], neck[1], 0.75, 0.6, nk); B.plot(neck[0], neck[1] - 1, nk, 3);
    if (V.back) return;
    const w = Math.max(1.6, Math.hypot(3.3 * V.Rx, 1.2 * V.Fx));
    B.blob(body[0], body[1], w, 3, lm, { power: 2.2 });
    if (w > 2.4) { B.plot(body[0], body[1] - 1, hole, 0); B.plot(body[0] - 1, body[1] - 1, hole, 0); }
    for (let k = -1; k <= 1; k++) { const t = (k + 2) / 4; B.plot(body[0] + (neck[0] - body[0]) * t * 0.6, body[1] + (neck[1] - body[1]) * t * 0.6, P.mat('#e8dcc0', 'cloth'), 3); }
  }

  // Held items. The tool's direction is posed in body space and projected, so a spear held forward
  // shortens as the figure turns toward you.
  function drawItem(S, it, A, hd) {
    const { B, p, V } = S;
    const hx = hd[0], hy = hd[1];
    const W = P.mat(P.wood.oak, 'wood'), Wd = P.mat(P.wood.dark, 'wood'), I = P.mat(P.metal.iron, 'metal'), St = P.mat(P.metal.steel, 'metal');
    // default carrying angles: long tools upright and a little forward, short ones hang
    const long = ['pitchfork', 'hoe', 'scythe', 'spear', 'broom', 'spade'].includes(it);
    const td = p.toolDir || (long ? [0, -0.92, 0.38] : it === 'sword' || it === 'dagger' || it === 'axe' || it === 'hammer' ? [0, 0.35, 0.95] : [0, 0, 1]);
    const t3 = nrm(td);
    const sv = [t3[0] * V.Rx + t3[2] * V.Fx, t3[1] - (t3[0] * V.Rz + t3[2] * V.Fz) * K];
    const ux = sv[0], uy = sv[1];
    const along = (d) => [hx + ux * d, hy + uy * d];
    const px = -uy, py = ux; // perpendicular on screen
    const fs = (V.mirror ? -1 : 1);
    switch (it) {
      case 'hammer': { const [x1, y1] = along(6); B.capsule(...along(-1.5), x1, y1, 0.7, 0.7, W); B.capsule(x1 - px * 2, y1 - py * 2, x1 + px * 2, y1 + py * 2, 1.2, 1.2, I); break; }
      case 'axe': { const [x1, y1] = along(8); B.capsule(...along(-2), x1, y1, 0.7, 0.7, W); B.capsule(x1 - ux, y1 - uy, x1 + px * 2.6 - ux, y1 + py * 2.6 - uy, 1.6, 1.1, St); break; }
      case 'pitchfork': case 'hoe': case 'scythe': case 'spear': case 'broom': case 'spade': {
        const L = it === 'spear' ? 16 : 14;
        const a0 = along(-5), a1 = along(L - 5);
        B.capsule(a0[0], a0[1], a1[0], a1[1], 0.6, 0.6, it === 'spear' ? Wd : W);
        if (it === 'pitchfork') { for (const k of [-1.5, 0, 1.5]) B.capsule(a1[0] + px * k, a1[1] + py * k, a1[0] + px * k + ux * 3, a1[1] + py * k + uy * 3, 0.45, 0.45, I); B.capsule(a1[0] - px * 1.6, a1[1] - py * 1.6, a1[0] + px * 1.6, a1[1] + py * 1.6, 0.5, 0.5, I); }
        if (it === 'hoe') B.capsule(a1[0], a1[1], a1[0] + px * 2.5 * fs + ux, a1[1] + py * 2.5 + uy, 0.9, 0.7, I);
        if (it === 'scythe') for (let k = 0; k < 6; k++) B.plot(a1[0] + px * k * 0.9, a1[1] + py * k * 0.9 + Math.sin((k / 5) * Math.PI) * -1.2, St, 3 - (k > 3 ? 1 : 0));
        if (it === 'spear') { const t = along(L - 5 + 3); B.capsule(a1[0], a1[1], t[0], t[1], 1.1, 0.3, St); }
        if (it === 'broom') { const b = along(L - 3); B.capsule(a1[0] - px * 1.5, a1[1] - py * 1.5, b[0] + px * 2, b[1] + py * 2, 1.2, 1.4, P.mat('#c8a050', 'wood')); }
        if (it === 'spade') B.blob(a1[0], a1[1] + 0.5, 1.6, 2, I, { power: 3 });
        break;
      }
      case 'sword': { const t = along(11); B.capsule(...along(1), t[0], t[1], 0.8, 0.45, St); const g = along(1); B.capsule(g[0] - px * 1.8, g[1] - py * 1.8, g[0] + px * 1.8, g[1] + py * 1.8, 0.6, 0.6, P.mat(P.metal.brass, 'metal')); B.plot(...along(-1), Wd, 2); break; }
      case 'dagger': { const t = along(5.5); B.capsule(...along(1), t[0], t[1], 0.7, 0.4, St); break; }
      case 'bread': B.blob(hx + ux * 1.5, hy + 0.5, 2.4, 1.5, P.mat('#c48a45', 'wood'), { power: 2 }); break;
      case 'mug': B.blob(hx + ux * 0.8, hy - 0.5, 1.4, 1.8, P.mat(P.wood.walnut, 'wood'), { power: 3 }); B.plot(hx + ux * 0.8, hy - 2, P.mat(C.white), 3); break;
      case 'basket': { const bm = P.mat('#b08850', 'wood'); B.blob(hx, hy + 2, 2.8, 2, bm, { power: 3 }); for (let x = -2; x <= 2; x++) B.tweak(hx + x, hy + 2 + (x % 2), -1); break; }
      case 'book': B.blob(hx + ux, hy + 0.5, 1.6, 2, P.mat(C.crimson), { power: 4 }); break;
      case 'ladle': { const a1 = along(6); B.capsule(hx, hy, a1[0], a1[1], 0.5, 0.5, W); B.blob(a1[0], a1[1], 1.2, 1, I, { power: 2 }); break; }
      case 'sack': B.blob(hx, hy + 2.5, 2.5, 3, P.mat(C.linen), { power: 2 }); break;
      case 'net': { const nm = P.mat('#9a8a6a', 'cloth'); for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) B.plot(hx + (k - 1), hy + 1 + j * 1.5 + (k % 2) * 0.7, nm, 2); break; }
      default: break;
    }
  }

  // ---------- Sprite sheet cache ----------
  // Frames are generated lazily and kept in a bounded LRU so thousands of NPCs can exist while only
  // the nearby ones hold pixel data.
  const cache = new Map(); const MAX = 8000;
  function frame(a, dir, anim, f) {
    const key = a.seed + ':' + a.cacheVer + ':' + dir + anim + f;
    let c = cache.get(key);
    if (c) { cache.delete(key); cache.set(key, c); return c; }
    if (anim === 'lie') {
      // lying on the ground: the standing frame turned through exactly 90 degrees (pixel-perfect)
      const src = render(a, 0, 'sleep', 0); c = document.createElement('canvas'); c.width = 48; c.height = 48;
      const x = c.getContext('2d'); x.translate(2, 47); x.rotate(-Math.PI / 2); x.drawImage(src, 0, 0); c.ox = 24;
    } else c = render(a, dir, anim in ANIMS ? anim : 'idle', f % (ANIMS[anim]?.frames || 1));
    cache.set(key, c);
    if (cache.size > MAX) cache.delete(cache.keys().next().value);
    return c;
  }
  // where the hips sit in a frame (riders are placed on a saddle by their hips)
  const hipCache = new Map();
  function hipY(a, anim) { const k = a.seed + anim + a.age; if (!hipCache.has(k)) hipCache.set(k, pose(bodyMetrics(a), anim, 0, a).hipY); return hipCache.get(k); }
  // where the head sits in a standing frame (to lay a sleeper's head on a pillow)
  function headY(a) { const m = bodyMetrics(a); return { cy: pose(m, 'sleep', 0, a).head[1], ry: m.headRy }; }
  function invalidate(a) { a.cacheVer = (a.cacheVer || 0) + 1; }

  // Build a full sprite sheet canvas: rows = anim x dir, cols = frames.
  function sheet(a, anims = Object.keys(ANIMS), dirs = [0, 4, 2, 6, 3, 7, 1, 5]) {
    anims = anims.filter((an) => an !== 'lie');
    const rows = []; anims.forEach((an) => dirs.forEach((d) => rows.push([an, d])));
    const maxF = Math.max(...anims.map((an) => ANIMS[an].frames));
    const c = document.createElement('canvas'); c.width = FW * maxF; c.height = FH * rows.length;
    const ctx = c.getContext('2d');
    rows.forEach(([an, d], r) => { for (let f = 0; f < ANIMS[an].frames; f++) ctx.drawImage(frame(a, d, an, f), f * FW, r * FH); });
    return { canvas: c, rows, fw: FW, fh: FH };
  }

  O.Char = { makeAppearance, randomGenes, inheritGenes, bodyMetrics, ageStage, outfitFor, render, frame, sheet, invalidate, ANIMS, FW, FH, GROUND, HAIR_STYLES_M, HAIR_STYLES_F, BEARDS, dirOf, dir4, DIRV, hipY, headY };
  O.dirOf = dirOf; O.dir4 = dir4;
})();
