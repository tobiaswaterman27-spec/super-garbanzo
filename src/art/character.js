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
      case 'child': m = { headRx: 5.2, headRy: 5.1, torso: 7, leg: 8, armU: 3.6, armL: 3.4, shW: 8, waistW: 8, hipW: 8.5, limbR: 1.45, legR: 1.7 }; break;
      case 'olderChild': m = { headRx: 5.4, headRy: 5.3, torso: 8, leg: 10, armU: 4.2, armL: 4, shW: 9, waistW: 8.5, hipW: 9, limbR: 1.5, legR: 1.8 }; break;
      case 'teen': m = { headRx: 5.6, headRy: 5.5, torso: 10, leg: 13, armU: 4.9, armL: 4.8, shW: 10.5, waistW: 9, hipW: 9.5, limbR: 1.55, legR: 1.95 }; break;
      default: m = { headRx: 5.8, headRy: 5.7, torso: 11, leg: 14, armU: 5.3, armL: 5.2, shW: 12, waistW: 10, hipW: 10.5, limbR: 1.65, legR: 2.05 };
    }
    m.stage = st;
    if (st !== 'child' && st !== 'olderChild' && st !== 'baby') {
      m.leg += Math.round(h * 1.6); m.torso += Math.round(h * 0.8);
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
      case 'outlaw': o.over = P.mat(rng.pick([C.darkBrown, C.forest, C.black, C.greyWool])); o.overLen = 1; o.hat = 'hood'; o.hatMat = P.mat(rng.pick([C.forest, C.darkBrown, C.black, C.russet])); o.item = rng.pick(['dagger', 'sword', null]); o.boots = true; o.cloak = rng.chance(0.5) ? o.hatMat : null; o.backItem = rng.chance(0.4) ? 'bow' : null; break;
      case 'fisher': o.hat = 'cap'; o.hatMat = P.mat(C.woad); o.item = 'net'; break;
      case 'courier': o.item = 'satchel'; o.hat = 'feather'; o.hatMat = P.mat(col()); break;
      case 'child': o.item = null; break;
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

  // ---------- Poses ----------
  // Returns joints in frame coords for the canonical "right-facing" side view or the front/back view.
  const ANIMS = {
    idle: { frames: 4, fps: 3 }, walk: { frames: 6, fps: 9 }, run: { frames: 6, fps: 13 },
    sit: { frames: 2, fps: 1.5 }, work: { frames: 4, fps: 6 }, eat: { frames: 4, fps: 3 },
    talk: { frames: 4, fps: 4 }, carry: { frames: 6, fps: 9 }, wave: { frames: 4, fps: 6 },
    crouch: { frames: 2, fps: 2 }, sweep: { frames: 4, fps: 5 }, sleep: { frames: 2, fps: 1 }, lie: { frames: 1, fps: 1 },
  };

  function pose(m, dir, anim, f) {
    const nF = ANIMS[anim]?.frames || 1, t = (f / nF) * Math.PI * 2;
    const side = dir === 1 || dir === 2;
    const cx = 16;
    const p = { cx, side, dir, anim, f, bob: 0, lean: 0, headTurn: 0, mouth: 0, blink: false };
    let hipY = GROUND - m.leg - 1;
    let legSwingA = 0, legSwingB = 0, liftA = 0, liftB = 0, armA = 0, armB = 0, elbowA = 0.15, elbowB = 0.15;
    let handAOverride = null, handBOverride = null, kneeBendA = 0, kneeBendB = 0, sitting = false, crouch = 0;

    switch (anim) {
      case 'idle':
        p.bob = f === 2 ? 1 : 0; p.blink = f === 3 && false; armA = armB = 0.04 * (f === 2 ? 1 : 0); break;
      case 'walk': case 'carry': {
        const s = Math.sin(t);
        legSwingA = s * 0.42; legSwingB = -s * 0.42;
        liftA = Math.max(0, -Math.cos(t)) * 1.5; liftB = Math.max(0, Math.cos(t)) * 1.5;
        kneeBendA = Math.max(0, -Math.cos(t)) * 0.55; kneeBendB = Math.max(0, Math.cos(t)) * 0.55;
        armA = -s * 0.45; armB = s * 0.45;
        p.bob = Math.abs(Math.cos(t)) > 0.7 ? 0 : 1;
        break;
      }
      case 'run': {
        const s = Math.sin(t);
        legSwingA = s * 0.75; legSwingB = -s * 0.75;
        liftA = Math.max(0, -Math.cos(t)) * 3; liftB = Math.max(0, Math.cos(t)) * 3;
        kneeBendA = 0.3 + Math.max(0, -Math.cos(t)) * 1.1; kneeBendB = 0.3 + Math.max(0, Math.cos(t)) * 1.1;
        armA = -s * 0.85; armB = s * 0.85; elbowA = elbowB = 1.5;
        p.bob = Math.abs(Math.cos(t)) > 0.7 ? -1 : 1; p.lean = 1.5;
        break;
      }
      case 'sit': sitting = true; p.bob = f === 1 ? 1 : 0; break;
      case 'crouch': crouch = 4; break;
      case 'sleep': sitting = false; break;
      default: break;
    }
    if (m.stoop) p.lean += 0.8;
    if (sitting) hipY = GROUND - 9;
    hipY += crouch;
    hipY += p.bob;
    const shY = hipY - m.torso;
    p.hipY = hipY; p.shY = shY; p.sitting = sitting; p.crouch = crouch;
    p.headCy = shY - 1 - m.headRy + 1 + (m.stoop ? 1 : 0);
    p.headCx = cx + (side ? p.lean * 0.8 + (m.stoop ? 1 : 0) : 0);

    const legLen = m.leg; const up = legLen * 0.52, lo = legLen - up;
    if (side) {
      // side view: x is the facing direction (right). A = near leg/arm, B = far leg/arm.
      const hx = cx + p.lean * 0.3;
      const leg = (swing, bend, lift) => {
        const kx = hx + Math.sin(swing) * up, ky = hipY + Math.cos(swing) * up;
        const la = swing - bend;
        let fx = kx + Math.sin(la) * lo, fy = ky + Math.cos(la) * lo;
        fy = Math.min(fy, GROUND - 1 - lift * 0.5);
        return { hip: [hx, hipY], knee: [kx, ky], foot: [fx, fy] };
      };
      if (sitting) {
        p.legA = { hip: [hx, hipY], knee: [hx + up, hipY], foot: [hx + up, hipY + lo] };
        p.legB = { hip: [hx - 0.5, hipY], knee: [hx + up - 0.5, hipY], foot: [hx + up - 0.5, hipY + lo] };
      } else if (crouch) {
        p.legA = { hip: [hx, hipY], knee: [hx + 3.5, hipY + up * 0.55], foot: [hx + 1, GROUND - 1] };
        p.legB = { hip: [hx - 0.5, hipY], knee: [hx + 2, hipY + up * 0.6], foot: [hx - 2.5, GROUND - 1] };
      } else { p.legA = leg(legSwingA, kneeBendA, liftA); p.legB = leg(legSwingB, kneeBendB, liftB); }
      const sx = cx + p.lean * 0.7, sy = shY + 1.5;
      const arm = (swing, elbow) => {
        const ex = sx + Math.sin(swing) * m.armU, ey = sy + Math.cos(swing) * m.armU;
        const la = swing + elbow; return { sh: [sx, sy], el: [ex, ey], hand: [ex + Math.sin(la) * m.armL, ey + Math.cos(la) * m.armL] };
      };
      p.armA = arm(armA, elbowA); p.armB = arm(armB, elbowB);
    } else {
      // front/back view: A = viewer's left side, B = viewer's right
      const hipOff = m.hipW / 2 - m.legR + 0.1;
      const leg = (sgn, lift, swing) => {
        const hx = cx + sgn * hipOff;
        // moving toward the viewer the foot drops a pixel; away, it lifts and tucks
        const fy = GROUND - 1 - lift + Math.max(0, swing) * 1.2;
        const ky = hipY + up - lift * 0.5;
        return { hip: [hx, hipY], knee: [hx + sgn * 0.2, ky], foot: [hx + sgn * 0.3, Math.min(GROUND - 1, fy)] };
      };
      if (sitting) {
        const sgn = [-1, 1];
        p.legA = { hip: [cx - hipOff, hipY], knee: [cx - hipOff, hipY + 2.5], foot: [cx - hipOff, hipY + 2.5 + lo] };
        p.legB = { hip: [cx + hipOff, hipY], knee: [cx + hipOff, hipY + 2.5], foot: [cx + hipOff, hipY + 2.5 + lo] };
        void sgn;
      } else if (crouch) {
        p.legA = { hip: [cx - hipOff, hipY], knee: [cx - hipOff - 2, hipY + 3], foot: [cx - hipOff - 0.5, GROUND - 1] };
        p.legB = { hip: [cx + hipOff, hipY], knee: [cx + hipOff + 2, hipY + 3], foot: [cx + hipOff + 0.5, GROUND - 1] };
      } else {
        p.legA = leg(-1, liftA, dir === 3 ? -legSwingA : legSwingA);
        p.legB = leg(1, liftB, dir === 3 ? -legSwingB : legSwingB);
      }
      const shOff = m.shW / 2 - m.limbR * 0.55;
      const arm = (sgn, swing, elbow) => {
        const sx = cx + sgn * shOff, sy = shY + 1.6;
        const fwd = dir === 3 ? -swing : swing; // + = toward viewer
        const ex = sx + sgn * 0.6, ey = sy + m.armU - Math.abs(fwd) * 0.6;
        const hx = ex + sgn * (0.3 + elbow * 0.3), hy = ey + m.armL - Math.abs(fwd) * 1.1 - elbow * 1.6;
        return { sh: [sx, sy], el: [ex, ey], hand: [hx, hy], fwd };
      };
      p.armA = arm(-1, armA, elbowA); p.armB = arm(1, armB, elbowB);
    }

    // action overrides (right hand = tool hand)
    const toolArm = side ? 'armA' : (dir === 0 ? 'armA' : 'armB');
    const A = p[toolArm];
    if (anim === 'work') {
      // hammering: raise -> strike -> recoil
      const ph = [0, 1, 2, 1][f];
      if (side) {
        const sx = A.sh[0], sy = A.sh[1];
        const ang = [-2.4, -1.4, 0.6][ph] ?? 0.6; // radians from straight down
        const ex = sx + Math.sin(ang + Math.PI) * 0 + Math.cos(ang) * 0, ey = sy;
        void ex; void ey;
        const e = [sx + Math.sin(-ang + Math.PI) * -m.armU * 0.9, sy + Math.cos(ang) * m.armU * 0.9];
        const handA = ang + 0.5;
        A.el = e; A.hand = [e[0] + Math.sin(-handA + Math.PI) * -m.armL, e[1] + Math.cos(handA) * m.armL];
        if (ph === 0) { A.el = [sx + 1.5, sy - 3]; A.hand = [sx + 2.5, sy - 7.5]; }
        if (ph === 1) { A.el = [sx + 3.2, sy - 1.5]; A.hand = [sx + 6.5, sy - 3]; }
        if (ph === 2) { A.el = [sx + 3, sy + 2.5]; A.hand = [sx + 7, sy + 4]; }
        p.toolAngle = [-0.9, 0.3, 1.4][ph];
      } else {
        const sx = A.sh[0], sy = A.sh[1], sg = sx < 16 ? -1 : 1;
        if (ph === 0) { A.el = [sx + sg * 1.5, sy - 3.5]; A.hand = [sx + sg * 1, sy - 8]; }
        if (ph === 1) { A.el = [sx + sg * 2, sy - 1]; A.hand = [sx + sg * 1, sy - 4]; }
        if (ph === 2) { A.el = [sx + sg * 1, sy + 3.5]; A.hand = [sx - sg * 1, sy + 6.5]; }
        p.toolAngle = [-1.2, -0.3, 1.2][ph];
      }
      p.bob = 0;
    }
    if (anim === 'eat') {
      const up = f === 1 || f === 2;
      const sx = A.sh[0], sy = A.sh[1];
      if (side) { A.el = [sx + 2.6, sy + 3.5]; A.hand = up ? [sx + 3.5, p.headCy + 3] : [sx + 5.5, sy + 4]; }
      else { const sg = sx < 16 ? -1 : 1; A.el = [sx + sg * 1, sy + 4]; A.hand = up ? [sx - sg * 2.5, p.headCy + 3.5] : [sx - sg * 1.5, sy + 6]; }
      p.mouth = f === 2 ? 1 : 0;
    }
    if (anim === 'talk') {
      p.mouth = f % 2;
      if (f >= 2) {
        const sx = A.sh[0], sy = A.sh[1];
        if (side) { A.el = [sx + 2, sy + 4]; A.hand = [sx + 6, sy + 3 - (f === 3 ? 1 : 0)]; }
        else { const sg = sx < 16 ? -1 : 1; A.el = [sx + sg * 1.5, sy + 4]; A.hand = [sx + sg * 3, sy + 3 + (f === 3 ? -1 : 0)]; }
      }
    }
    if (anim === 'wave') {
      const sx = A.sh[0], sy = A.sh[1];
      const sg = side ? 1 : (sx < 16 ? -1 : 1);
      A.el = [sx + sg * 2.5, sy - 2.5]; A.hand = [sx + sg * (f % 2 ? 4.5 : 2.5), sy - 7];
    }
    if (anim === 'carry') {
      for (const k of ['armA', 'armB']) {
        const a = p[k], sx = a.sh[0], sy = a.sh[1];
        if (side) { a.el = [sx + 1.2, sy + 3.8]; a.hand = [sx + 5, sy + 5]; }
        else { const sg = sx < 16 ? -1 : 1; a.el = [sx + sg * 0.6, sy + 4]; a.hand = [sx - sg * 1.2, sy + 6.5]; }
      }
      p.carrying = true;
    }
    if (anim === 'sweep') {
      const sx = A.sh[0], sy = A.sh[1]; const s = [0, 1, 2, 1][f];
      if (side) { A.el = [sx + 1.5, sy + 4]; A.hand = [sx + 3 + s, sy + 7]; }
      else { const sg = sx < 16 ? -1 : 1; A.el = [sx + sg * 0.8, sy + 4]; A.hand = [sx + sg * (s - 1), sy + 8]; }
      p.toolAngle = (s - 1) * 0.3;
    }
    if (anim === 'sit' && !side) {
      for (const k of ['armA', 'armB']) { const a = p[k]; a.el = [a.sh[0] + (a.sh[0] < 16 ? -0.5 : 0.5), a.sh[1] + m.armU]; a.hand = [a.el[0] + (a.sh[0] < 16 ? 1.5 : -1.5), a.el[1] + 3.5]; }
    }
    if (anim === 'sit' && side) { for (const k of ['armA', 'armB']) { const a = p[k]; a.el = [a.sh[0] + 0.5, a.sh[1] + m.armU]; a.hand = [a.el[0] + 4, a.el[1] + 1]; } }
    if (anim === 'crouch') {
      for (const k of ['armA', 'armB']) { const a = p[k]; if (side) { a.el = [a.sh[0] + 2, a.sh[1] + 3.5]; a.hand = [a.sh[0] + 5, a.sh[1] + 7]; } else { const sg = a.sh[0] < 16 ? -1 : 1; a.el = [a.sh[0] + sg, a.sh[1] + 4]; a.hand = [a.sh[0] - sg * 0.5, a.sh[1] + 8]; } }
    }
    p.toolArm = toolArm;
    return p;
  }

  // ---------- Coverage: which material covers a body region ----------
  function coverage(a) {
    const o = a.outfit, skin = a.skin;
    const top = o.armour === 'mail' ? P.mat(P.metal.iron, 'metal') : (o.over ?? o.shirt);
    const sleeveMat = o.armour === 'mail' ? P.mat(P.metal.iron, 'metal') : (o.overLen >= 2 ? o.over : o.shirt);
    const isChild = a.stage === 'child' || a.stage === 'olderChild' || a.stage === 'baby';
    return {
      upperArm: (u) => (o.sleeves === 'none' ? skin : sleeveMat),
      lowerArm: (u) => (o.sleeves === 'short' ? (u < 0.15 ? sleeveMat : skin) : (u < 0.82 ? sleeveMat : skin)),
      cuff: o.sleeves === 'long' ? 0.82 : 0.15,
      upperLeg: () => o.legs,
      lowerLeg: (u) => {
        if (o.shoes && o.boots && u > 0.35) return o.shoes;
        if (!o.shoes) return u > 0.55 ? skin : o.legs;
        if (isChild && u > 0.5) return skin;
        return o.legs;
      },
      foot: () => o.shoes ?? skin,
      top,
      waist: o.legs,
    };
  }

  // ---------- Renderer ----------
  function render(a, dir, anim, f) {
    const m = bodyMetrics(a);
    const p = pose(m, dir, anim, f);
    const B = new O.MatBuffer(FW, FH);
    B.mirror = dir === 1; // left = mirrored right (geometry only; shading uses the shared light)
    const cov = coverage(a);
    const o = a.outfit;
    const side = p.side, back = dir === 3;
    if (anim === 'sleep') return renderSleeping(a, m, B);

    // --- behind-body layers ---
    if (o.cloak && !side && back === false) { /* front: cloak shows as shoulder drape later */ }
    if (o.cloak && (back || side)) drawCloak(B, a, m, p, true);
    if (o.backItem && !back) drawBackItem(B, a, m, p, true);
    if (!back && longHair(a.hairStyle)) drawHair(B, a, m, p, 'back');

    // --- far limbs (side view) ---
    if (side) {
      B.part(G.FARLIMB);
      drawLeg(B, a, m, p.legB, cov, -1, p);
      drawArm(B, a, m, p.armB, cov, -1, p, false);
    }

    // --- legs ---
    B.part(G.LEGS);
    if (!side) { drawLeg(B, a, m, p.legA, cov, 0, p); drawLeg(B, a, m, p.legB, cov, 0, p); }
    else drawLeg(B, a, m, p.legA, cov, 0, p);

    // --- torso ---
    drawTorso(B, a, m, p, cov);

    // --- skirt / long tunic over legs ---
    drawSkirt(B, a, m, p);

    // --- arms ---
    B.part(G.ARMS);
    if (!side) {
      // In front view the arms sit beside the torso; if the tool arm crosses in front draw it last.
      drawArm(B, a, m, p.armA, cov, 0, p, p.toolArm === 'armA');
      drawArm(B, a, m, p.armB, cov, 0, p, p.toolArm === 'armB');
    }

    // --- head ---
    drawHead(B, a, m, p);
    drawHair(B, a, m, p, 'front');
    drawHat(B, a, m, p);

    if (o.backItem && back) drawBackItem(B, a, m, p, false);
    if (o.cloak && !side && !back) drawCloak(B, a, m, p, false);

    // --- near arm last in side view (over torso) ---
    if (side) { B.part(G.ARMS); drawArm(B, a, m, p.armA, cov, 0, p, true); }

    if (p.carrying) drawCarried(B, a, m, p);
    return B.toCanvas();
  }

  function longHair(s) { return s === 'long' || s === 'braid' || s === 'tied' || s === 'veil' || s === 'curly'; }

  function drawLeg(B, a, m, L, cov, bias, p) {
    const r = m.legR;
    B.capsule(L.hip[0], L.hip[1], L.knee[0], L.knee[1], r, r * 0.92, cov.upperLeg, { shadeBias: bias });
    B.capsule(L.knee[0], L.knee[1], L.foot[0], L.foot[1], r * 0.92, r * 0.8, cov.lowerLeg, { shadeBias: bias });
    // knee crease when bent
    const bent = Math.abs((L.knee[0] - L.hip[0]) * (L.foot[1] - L.knee[1]) - (L.knee[1] - L.hip[1]) * (L.foot[0] - L.knee[0]));
    if (bent > 6) B.tweak(L.knee[0] + (p.side ? -1 : 0), L.knee[1], -1);
    // boot cuff highlight
    const o = a.outfit;
    if (o.boots && o.shoes) {
      const u = 0.35, bx = L.knee[0] + (L.foot[0] - L.knee[0]) * u, by = L.knee[1] + (L.foot[1] - L.knee[1]) * u;
      for (let dx = -2; dx <= 2; dx++) if (B.get(Math.floor(bx + dx), Math.floor(by) + 1) === o.shoes) B.tweak(bx + dx, by + 1, 1);
    }
    // foot
    const fm = cov.foot();
    const fx = L.foot[0], fy = L.foot[1];
    if (p.side) {
      B.capsule(fx - 0.5, fy + 0.4, fx + 2.3, fy + 0.6, 1.25, 1.1, fm, { shadeBias: bias });
    } else {
      const toward = p.dir === 0;
      B.capsule(fx - 0.7, fy + 0.5, fx + 0.7, fy + 0.5, toward ? 1.55 : 1.4, toward ? 1.55 : 1.4, fm, { shadeBias: bias });
    }
  }

  function drawArm(B, a, m, A, cov, bias, p, isToolArm) {
    const r = m.limbR;
    B.capsule(A.sh[0], A.sh[1], A.el[0], A.el[1], r * 1.08, r, cov.upperArm, { shadeBias: bias });
    B.capsule(A.el[0], A.el[1], A.hand[0], A.hand[1], r, r * 0.85, cov.lowerArm, { shadeBias: bias });
    // hand: slightly rounder blob
    B.capsule(A.hand[0], A.hand[1], A.hand[0], A.hand[1] + 0.4, r * 0.95, r * 0.95, a.skin, { shadeBias: bias });
    // elbow fold in sleeve
    const o = a.outfit;
    if (o.sleeves === 'long') B.tweak(A.el[0], A.el[1] + (p.side ? 0 : 0.6), -1);
    // tool
    if (isToolArm && o.item && !p.carrying && p.anim !== 'sleep') { B.part(G.ITEM); drawItem(B, a, o.item, A, p); B.part(G.ARMS); }
  }

  function drawTorso(B, a, m, p, cov) {
    const o = a.outfit, side = p.side, cx = side ? p.cx + p.lean * 0.5 : p.cx;
    const top = p.shY, bot = p.hipY + 2, waistY = top + Math.round(m.torso * 0.62);
    const sw = side ? Math.max(6.5, m.shW * 0.62) : m.shW, ww = side ? Math.max(6, m.waistW * 0.62) : m.waistW, hw = side ? Math.max(6.5, m.hipW * 0.66) : m.hipW;
    const tunicLen = o.over && o.overLen === 1 ? 4 : 0;
    B.part(G.TORSO);
    // neck
    B.capsule(p.headCx, p.headCy + m.headRy - 1.5, cx, top + 1, 1.6, 1.8, a.skin);
    // hips/trousers
    B.trap(cx, waistY, bot, ww, hw, cov.waist, { tilt: side ? -1 : 0 });
    // upper body (chest) — slight chest forward in side view
    const chestMat = (px, py) => {
      if (o.tabard && !side && Math.abs(px - cx) < sw * 0.28) return o.tabard;
      if (o.tabard && side && px < cx + 1 && px > cx - 2.5) return o.tabard;
      if (!o.over && !o.armour) return o.shirt;
      // open collar showing shirt
      if (!back(p) && !side && py < top + 2.5 && Math.abs(px - cx) < 1.6 && o.over && !o.armour) return o.shirt;
      return cov.top;
    };
    B.trap(side ? cx + 0.6 : cx, top, waistY + 0.5, sw, ww, chestMat, { round: 2.2, tilt: side ? -1 : 0 });
    // tunic/robe below waist
    if (tunicLen || o.overLen >= 2) {
      const len = o.overLen >= 3 ? GROUND - waistY - 1 : o.overLen === 2 ? m.leg * 0.75 + 2 : tunicLen + 1;
      const flare = o.overLen >= 2 ? 3 : 1.5;
      B.part(G.SKIRT);
      const sway = p.anim === 'walk' || p.anim === 'run' ? Math.sin((p.f / 6) * Math.PI * 2) * 0.6 : 0;
      B.trap(cx + (side ? sway : 0), waistY, Math.min(GROUND - 1, waistY + len), ww + 0.5, hw + flare, (px, py) => (o.tabard && !side && Math.abs(px - cx) < sw * 0.28 ? o.tabard : o.over));
      // hem detail & folds
      foldLines(B, cx, waistY + 2, Math.min(GROUND - 1, waistY + len), hw + flare, o.over, side);
      B.part(G.TORSO);
    }
    // chainmail texture
    if (o.armour === 'mail') {
      const mm = P.mat(P.metal.iron, 'metal');
      for (let y = top; y <= waistY + 4; y++) for (let x = 0; x < FW; x++) if (B.get(x, y) === mm && ((x + y) % 2 === 0)) B.tweak(x, y, -1);
    }
    // apron
    if (o.apron) {
      const aw = side ? 2.6 : Math.max(5, m.waistW - 3), ax = side ? cx + 2.2 : cx;
      const ay0 = side ? waistY - 1 : top + 3, ay1 = Math.min(GROUND - 3, waistY + m.leg * 0.62);
      B.part(G.SKIRT);
      if (side) B.trap(ax, waistY, ay1, 2.2, 3, o.apron, { tilt: -1 });
      else {
        B.trap(ax, ay0, waistY, aw - 1, aw, o.apron, { round: 1 });
        B.trap(ax, waistY, ay1, aw, aw + 1.5, o.apron);
        foldLines(B, ax, waistY + 2, ay1, aw + 1.5, o.apron, false);
      }
      // neck strap
      if (!side && !back(p)) { B.plot(ax - aw / 2 + 1, ay0 - 1, o.apron, 2); B.plot(ax + aw / 2 - 1, ay0 - 1, o.apron, 2); }
      B.part(G.TORSO);
    }
    // belt
    if (o.belt) {
      B.part(G.TORSO);
      const by = waistY;
      for (let x = 0; x < FW; x++) {
        const mm = B.get(x, by);
        if (mm >= 0 && mm !== a.skin && B.get(x, by - 1) >= 0) B.plot(x, by, o.belt, 2), B.plot(x, by + 1, o.belt, 1);
      }
      if (!side && !back(p)) { B.plot(cx - 1, by, o.buckle, 4); B.plot(cx, by, o.buckle, 3); B.plot(cx - 1, by + 1, o.buckle, 2); B.plot(cx, by + 1, o.buckle, 2); }
      if (o.pouch) {
        const px = side ? cx - 2 : cx + ww / 2 - 1;
        if (!back(p)) { B.part(G.ITEM); B.blob(px, by + 3, 1.6, 1.6, P.mat(C.leather)); B.part(G.TORSO); }
      }
      if (a.outfit.sideItem === 'sword') {
        B.part(G.ITEM);
        const sx = side ? cx - 1.5 : cx - ww / 2 - 0.5, sy = by + 1;
        const scab = P.mat(C.darkLeather);
        B.capsule(sx, sy, sx - (side ? 4 : 1), sy + 9, 0.8, 0.7, scab);
        B.plot(sx + (side ? 1 : 0), sy - 1, P.mat(P.metal.brass, 'metal'), 3);
        B.part(G.TORSO);
      }
    }
    // trim on wealthy clothes (collar + hem line)
    if (o.trim && o.over) {
      for (let x = 0; x < FW; x++) if (B.get(x, top) === o.over || B.get(x, top) === cov.top) B.plot(x, top, o.trim, 3);
    }
    // chest folds / creases for cloth (a couple of shadow pixels make clothing read as fabric)
    if (!side && !o.armour) {
      B.tweak(cx - 2, waistY - 2, -1); B.tweak(cx + 2, waistY - 1, -1);
      if (back(p)) { B.tweak(cx, top + 3, -1); B.tweak(cx, top + 4, -1); }
    }
    if (side && !o.armour) { B.tweak(cx - 1, waistY - 2, -1); }
  }

  function back(p) { return p.dir === 3; }

  function foldLines(B, cx, y0, y1, w, mt, side) {
    if (side) return;
    const n = Math.max(1, Math.floor(w / 3.5));
    for (let k = 0; k < n; k++) {
      const fx = Math.floor(cx - w / 2 + 1.5 + ((k + 0.5) * (w - 3)) / n);
      for (let y = Math.floor(y0); y < y1; y++) if (B.get(fx, y) === mt) B.tweak(fx, y, -1);
      if (B.get(fx + 1, Math.floor(y1) - 1) === mt) B.tweak(fx + 1, y1 - 1, 1);
    }
    // hem: darken the bottom row
    for (let x = Math.floor(cx - w / 2 - 1); x <= cx + w / 2 + 1; x++) if (B.get(x, Math.floor(y1)) === mt) B.tweak(x, Math.floor(y1), -1);
  }

  function drawSkirt(B, a, m, p) {
    const o = a.outfit; if (!o.skirt) return;
    const side = p.side, cx = side ? p.cx + p.lean * 0.4 : p.cx;
    const waistY = p.shY + Math.round(m.torso * 0.62);
    const hemY = p.sitting ? p.hipY + 5 : GROUND - 2 - (o.skirtLen ? 0 : 5);
    B.part(G.SKIRT);
    let sway = 0;
    if (p.anim === 'walk' || p.anim === 'run' || p.anim === 'carry') sway = Math.sin((p.f / 6) * Math.PI * 2) * (side ? 1.2 : 0.6);
    const wb = side ? m.hipW * 0.75 + 3 : m.hipW + 4;
    if (side) {
      // in side view the skirt flares and its hem follows the stride
      const inside = (px, py) => {
        if (py < waistY || py > hemY) return false;
        const t = (py - waistY) / (hemY - waistY);
        const hw = (m.waistW * 0.62) / 2 + t * (wb - m.waistW * 0.62) / 2;
        return Math.abs(px - (cx + sway * t)) <= hw;
      };
      const normal = (px, py) => { const t = (py - waistY) / (hemY - waistY); const hw = (m.waistW * 0.62) / 2 + t * (wb - m.waistW * 0.62) / 2; const nx = O.clamp((px - cx - sway * t + 1) / (hw + 0.5), -1, 1); return [nx, 0.1, Math.sqrt(Math.max(0.05, 1 - nx * nx))]; };
      B.shape(cx - wb, waistY, cx + wb, hemY, inside, normal, o.skirt);
    } else {
      B.trap(cx + sway * 0.4, waistY, hemY, m.waistW, wb, o.skirt);
      foldLines(B, cx, waistY + 3, hemY, wb, o.skirt, false);
    }
    if (o.trim) for (let x = 0; x < FW; x++) if (B.get(x, Math.floor(hemY)) === o.skirt) B.plot(x, hemY, o.trim, 2);
    // bodice laces for dresses
    if (o.over && !side && !back(p)) {
      const top = p.shY;
      for (let y = top + 3; y < waistY; y += 2) B.plot(cx - 0.5, y, o.shirt, 3);
    }
  }

  function drawHead(B, a, m, p) {
    B.part(G.HEAD);
    const hx = p.headCx, hy = p.headCy;
    const rx = m.headRx, ry = m.headRy;
    const jaw = 0.18 + a.genes.face.jaw * 0.5;
    B.blob(hx, hy, rx, ry, a.skin, { power: 2.3, jaw });
    const f = a.genes.face, dir = p.dir;
    // ears
    if (dir === 0 || dir === 3) {
      const ey = Math.floor(hy + 0.5);
      B.plot(hx - rx - 0.6, ey, a.skin, dir === 0 ? 2 : 1); B.plot(hx + rx, ey, a.skin, 1);
      if (f.ears) { B.plot(hx - rx - 0.6, ey + 1, a.skin, 1); B.plot(hx + rx, ey + 1, a.skin, 1); }
    }
    if (dir === 3) return;
    const eyeY = Math.floor(hy + 0.5);
    const blink = p.anim === 'idle' && p.f === 3 && (a.variant % 3 === 0);
    const elder = a.stage === 'elder';
    const plotFlat = (x, y, mt, s) => { B.plot(x, y, mt, s, 1); };
    if (dir === 0) {
      const gap = 2 + f.eyeGap; // distance from centre
      const lx = Math.floor(hx - gap - 1), rxp = Math.floor(hx + gap);
      const eye = (x, mirrorSide) => {
        if (blink) { plotFlat(x, eyeY + 1, a.skin, 0); plotFlat(x + 1, eyeY + 1, a.skin, 0); return; }
        if (f.eyeType === 0) { // round dark eyes with catchlight
          plotFlat(x + (mirrorSide ? 1 : 0), eyeY, a.eyeDark, 2); plotFlat(x + (mirrorSide ? 1 : 0), eyeY + 1, a.eyes, 1);
          plotFlat(x + (mirrorSide ? 0 : 1), eyeY, a.eyeWhite, 3); plotFlat(x + (mirrorSide ? 0 : 1), eyeY + 1, a.eyeWhite, 2);
        } else if (f.eyeType === 1) { // iris + white, 2x2
          plotFlat(x, eyeY, a.eyeDark, 1); plotFlat(x + 1, eyeY, a.eyeDark, 1);
          plotFlat(x, eyeY + 1, mirrorSide ? a.eyeWhite : a.eyes, mirrorSide ? 2 : 2); plotFlat(x + 1, eyeY + 1, mirrorSide ? a.eyes : a.eyeWhite, 2);
        } else { // narrow eyes with lid
          plotFlat(x, eyeY + 1, a.eyeDark, 1); plotFlat(x + 1, eyeY + 1, a.eyes, 2);
          plotFlat(x, eyeY, a.skin, 1); plotFlat(x + 1, eyeY, a.skin, 1);
        }
      };
      eye(lx, false); eye(rxp, true);
      // brows
      const browM = a.hairStyle === 'bald' ? a.lip : a.hair;
      const by = eyeY - 1 - (f.eyeType === 2 ? 0 : 0);
      if (f.brow > 0 || elder) { plotFlat(lx, by, browM, 1); plotFlat(lx + 1, by, browM, f.brow > 1 ? 1 : 2); plotFlat(rxp, by, browM, f.brow > 1 ? 1 : 2); plotFlat(rxp + 1, by, browM, 1); }
      // nose: shadow on the right of the bridge (light from the left)
      const nx = Math.floor(hx), ny = eyeY + 2;
      plotFlat(nx, ny, a.skin, 1); if (f.nose >= 1) plotFlat(nx, ny - 1, a.skin, 2); if (f.nose === 2) plotFlat(nx - 1, ny, a.skin, 3);
      // mouth
      const my = eyeY + 4 - (ry < 5.3 ? 1 : 0);
      if (p.mouth) { plotFlat(nx - 1, my, a.eyeDark, 1); plotFlat(nx, my, a.eyeDark, 1); plotFlat(nx - 1, my + 1, a.lip, 1); plotFlat(nx, my + 1, a.lip, 1); }
      else { plotFlat(nx - 1, my, a.lip, 1); plotFlat(nx, my, a.lip, 2); if (a.sex === 'f') plotFlat(nx + 1, my, a.lip, 3); }
      // cheeks
      if (a.sex === 'f' || a.stage === 'child') { plotFlat(lx - 1, eyeY + 2, a.lip, 3); plotFlat(rxp + 2, eyeY + 2, a.lip, 3); }
      if (f.freckles) { plotFlat(lx, eyeY + 2, a.skin, 1); plotFlat(rxp + 1, eyeY + 2, a.skin, 1); }
      if (elder) { plotFlat(lx - 1, eyeY + 3, a.skin, 1); plotFlat(rxp + 2, eyeY + 3, a.skin, 1); plotFlat(nx - 2, my - 1, a.skin, 1); plotFlat(nx + 1, my - 1, a.skin, 1); }
      drawBeard(B, a, m, p, nx, my);
    } else {
      // profile (right-facing canonical): eye near the front, nose bump past the outline
      const front = Math.floor(hx + rx - 0.5);
      const ex = front - 2;
      if (blink) plotFlat(ex, eyeY + 1, a.skin, 0);
      else { plotFlat(ex, eyeY, a.eyeDark, 1); plotFlat(ex, eyeY + 1, a.eyes, 2); plotFlat(ex - 1, eyeY + 1, a.eyeWhite, 2); }
      const browM = a.hairStyle === 'bald' ? a.lip : a.hair;
      if (f.brow > 0 || elder) { plotFlat(ex, eyeY - 1, browM, 1); plotFlat(ex - 1, eyeY - 1, browM, 1); }
      B.part(G.HEAD);
      B.plot(front + 1, eyeY + 1, a.skin, 3); B.plot(front + 1, eyeY + 2, a.skin, 2); if (f.nose === 2) B.plot(front + 2, eyeY + 2, a.skin, 2);
      const my = eyeY + 4 - (ry < 5.3 ? 1 : 0);
      plotFlat(front - 1, my, p.mouth ? a.eyeDark : a.lip, 1); if (p.mouth) plotFlat(front - 1, my + 1, a.lip, 1);
      // ear
      const earX = Math.floor(hx - 1);
      plotFlat(earX, eyeY, a.skin, 2); plotFlat(earX, eyeY + 1, a.skin, 1); plotFlat(earX + 1, eyeY + 1, a.skin, 3);
      if (a.sex === 'f' || a.stage === 'child') plotFlat(ex - 1, eyeY + 2, a.lip, 3);
      if (elder) plotFlat(ex - 2, eyeY + 2, a.skin, 1);
      drawBeard(B, a, m, p, front - 1, my);
    }
  }

  function drawBeard(B, a, m, p, mx, my) {
    const b = a.beard; if (!b || b === 'none') return;
    const H = a.hair;
    const hx = p.headCx, hy = p.headCy, rx = m.headRx, ry = m.headRy;
    B.part(G.HAIR);
    if (p.dir === 0) {
      if (b === 'stubble') { for (let x = Math.floor(hx - rx + 2); x <= hx + rx - 2; x++) if ((x + my) % 2 === 0) B.tweak(x, my + 1, -1); return; }
      if (b === 'moustache' || b === 'goatee' || b === 'full' || b === 'long') { for (let x = mx - 2; x <= mx + 1; x++) B.plot(x, my - 1, H, x === mx - 2 ? 2 : 1); }
      if (b === 'goatee') { B.plot(mx - 1, my + 1, H, 2); B.plot(mx, my + 1, H, 1); B.plot(mx - 1, my + 2, H, 1); }
      if (b === 'full' || b === 'long') {
        const len = b === 'long' ? 4 : 2;
        const top = my - 2; // sideburns start beside the nose, never over the eyes
        const inside = (px, py) => {
          if (py < top || py > hy + ry + len) return false;
          const t = (py - top) / (hy + ry + len - top);
          const w = (rx + 0.2) * (1 - t * t * 0.7);
          const dx = Math.abs(px - hx);
          if (py < my && dx < rx - 1.5) return false; // cheeks stay clear above the mouth
          if (py >= my - 1 && py < my + 1 && dx < 2.2 && py > my - 1) return false; // mouth gap
          return dx <= w;
        };
        const normal = (px, py) => { const nx = (px - hx) / (rx + 1); return [nx, 0.3, Math.sqrt(Math.max(0.1, 1 - nx * nx))]; };
        B.shape(hx - rx - 1, hy, hx + rx + 1, hy + ry + len + 1, inside, normal, H, { maxShade: 3 });
        // re-draw mouth line on top so the face stays readable
        B.plot(mx - 1, my, a.lip, 0, 1); B.plot(mx, my, a.lip, 0, 1);
        for (let y = Math.floor(hy + 2); y < hy + ry + len; y += 2) B.tweak(hx + ((y % 4) - 1), y, -1);
      }
    } else if (p.dir !== 3) {
      if (b === 'stubble') { B.tweak(mx - 1, my + 1, -1); B.tweak(mx - 3, my, -1); return; }
      if (b !== 'goatee') { B.plot(mx, my - 1, H, 1); B.plot(mx + 1, my - 1, H, 2); }
      if (b === 'full' || b === 'long' || b === 'goatee') {
        const len = b === 'long' ? 4 : 2;
        for (let y = my; y <= hy + ry + len - 1; y++) for (let x = Math.floor(hx - 1); x <= mx + 1; x++) {
          if (B.get(x, y) === a.skin || y > hy + ry - 1) if (x > hx - 1 + (y - my) * 0.4 && !(y === my && x >= mx - 1)) B.plot(x, y, H, y % 2 ? 1 : 2);
        }
      }
    }
  }

  // Hair is drawn as a cap over the cranium plus style-specific volume.
  function drawHair(B, a, m, p, layer) {
    const st = a.hairStyle; const H = a.hair;
    const hx = p.headCx, hy = p.headCy, rx = m.headRx, ry = m.headRy;
    const dir = p.dir, side = p.side, back = dir === 3;
    const hatCovers = a.outfit.hat === 'hood' || a.outfit.hat === 'kettle' || st === 'veil';
    const strands = (px, py) => { // vertical strand highlights for texture
      const k = Math.floor(px) + (a.variant % 3);
      return k % 3 === 0 ? 1 : 0;
    };
    const hairNormal = (px, py) => {
      const nx = (px - hx) / (rx + 1.5), ny = (py - hy) / (ry + 1.5);
      return [nx, ny, Math.sqrt(Math.max(0.1, 1 - nx * nx - ny * ny))];
    };
    if (layer === 'back') {
      if (st === 'bald') return;
      B.part(G.BACK);
      const len = st === 'long' || st === 'veil' ? 9 : st === 'curly' ? 6 : st === 'tied' || st === 'braid' ? 0 : 4;
      if (len) {
        const top = hy, bot = hy + ry + len;
        const inside = (px, py) => py >= top && py <= bot && Math.abs(px - hx) <= rx + (st === 'curly' ? 1.5 : 0.8) - ((py - top) / (bot - top)) * 1.5;
        B.shape(hx - rx - 2, top, hx + rx + 2, bot, inside, hairNormal, st === 'veil' ? P.mat(C.white) : H);
      }
      return;
    }
    if (st === 'bald' && !hatCovers) {
      // bald: a little scalp shine already from head shading; add side fringe in hair colour
      if (a.age > 40) {
        B.part(G.HAIR);
        if (!side) for (let y = Math.floor(hy - 1); y <= hy + 1; y++) { B.plot(hx - rx, y, H, 1); B.plot(hx + rx - 1, y, H, 1); }
        else for (let y = Math.floor(hy - 1); y <= hy + 1; y++) { B.plot(hx - rx, y, H, 1); B.plot(hx - rx + 1, y, H, 2); }
      }
      return;
    }
    if (st === 'veil') { // wimple/veil covers hair entirely
      B.part(G.HAIR);
      const V = P.mat(C.white);
      const inside = (px, py) => {
        const dx = (px - hx) / (rx + 1), dy = (py - (hy - 0.5)) / (ry + 1);
        const inHood = dx * dx + dy * dy <= 1;
        if (!inHood) return false;
        if (back) return true;
        // open face
        if (side) return px < hx + 0.5 || py < hy - ry + 2.5;
        return !(Math.abs(px - hx) < rx - 1.2 && py > hy - ry + 2.5);
      };
      B.shape(hx - rx - 2, hy - ry - 2, hx + rx + 2, hy + ry + 2, inside, hairNormal, V);
      return;
    }
    if (a.outfit.hat === 'hood' || a.outfit.hat === 'kettle') {
      // under a hood/helmet only a fringe shows
      if (!back && !side) { B.part(G.HAIR); for (let x = Math.floor(hx - rx + 1); x < hx + rx - 1; x++) B.plot(x, hy - ry + 3, H, (x % 2) + 1); }
      return;
    }
    B.part(G.HAIR);
    // hairline: how far down the forehead the hair comes
    const fringe = st === 'messy' || st === 'shaggy' ? 3.6 : st === 'crop' ? 2.2 : st === 'bob' ? 3.4 : 2.8;
    const sideDown = st === 'crop' ? 0.5 : st === 'short' ? 1 : st === 'messy' || st === 'shaggy' ? 2.6 : st === 'bob' ? 5 : 3;
    const vol = st === 'curly' ? 1.0 : st === 'shaggy' || st === 'messy' ? 0.8 : st === 'crop' ? 0.2 : 0.6;
    const inside = (px, py) => {
      const dx = (px - hx) / (rx + vol), dy = (py - (hy - 0.3)) / (ry + vol);
      if (dx * dx + dy * dy > 1) return false;
      const rel = py - (hy - ry); // 0 at crown
      if (back) return rel < ry * 2 - 2.5 + (st === 'crop' ? -2 : 0);
      if (side) {
        // right-facing: hair covers back of head down to nape, front only at top
        const frontEdge = hx + rx * 0.35;
        if (px > frontEdge) return rel < fringe - 0.5;
        if (px > hx - 1.2) return rel < fringe + 1.2 + (st === 'bob' ? 1.5 : 0) && !(px > hx - 1 && px < hx + 1 && rel > fringe);
        return rel < ry * 2 - 2 + (st === 'crop' ? -2 : 0);
      }
      // front: crown + fringe + side locks beside the face
      if (rel < fringe) {
        if (st === 'messy' || st === 'shaggy') return !((Math.floor(px) + a.variant) % 4 === 0 && rel > fringe - 1);
        return true;
      }
      const edge = Math.abs(px - hx) > rx - 1.2;
      return edge && rel < fringe + sideDown;
    };
    B.shape(hx - rx - 2, hy - ry - 2, hx + rx + 2, hy + ry + 2, inside, hairNormal, H, { maxShade: 3 });
    // strand texture
    for (let y = Math.floor(hy - ry - 2); y < hy + ry + 2; y++) for (let x = Math.floor(hx - rx - 2); x < hx + rx + 2; x++) {
      if (B.get(x, y) === H && strands(x, y) && (y + a.variant) % 2 === 0) B.tweak(x, y, (x < hx ? 1 : -1));
    }
    // curls: dot texture
    if (st === 'curly') for (let y = Math.floor(hy - ry - 2); y < hy + ry + 2; y++) for (let x = Math.floor(hx - rx - 2); x < hx + rx + 2; x++) if (B.get(x, y) === H && (x * 3 + y * 5) % 7 === 0) B.tweak(x, y, -1);
    // bun / tie / braid volumes
    if (st === 'bun') {
      const bx = back || !side ? hx : hx - rx + 0.5, by = hy - ry + (back || !side ? -0.5 : 1.5);
      B.blob(bx, by, 2.2, 2, H, { power: 2 });
    }
    if ((st === 'tied' || st === 'braid') && (back || side)) {
      const bx = back ? hx : hx - rx + 0.6;
      const len = st === 'braid' ? 10 : 6;
      B.part(G.HAIR);
      for (let i = 0; i < len; i++) {
        const y = hy + 1 + i, w = st === 'braid' ? 1.3 : 1.5 - i * 0.05;
        B.capsule(bx, y, bx - (side ? 0.15 * i : 0), y + 1, w, w, H);
        if (st === 'braid' && i % 2) B.tweak(bx, y, -1);
      }
    }
    if ((st === 'long' || st === 'curly') && back) {
      const inside2 = (px, py) => py >= hy && py <= hy + ry + (st === 'long' ? 9 : 6) && Math.abs(px - hx) <= rx + 0.6 - (py - hy) * 0.08;
      B.shape(hx - rx - 2, hy, hx + rx + 2, hy + ry + 10, inside2, hairNormal, H, { maxShade: 3 });
      for (let y = Math.floor(hy); y < hy + ry + 9; y++) for (let x = Math.floor(hx - rx); x < hx + rx; x++) if (B.get(x, y) === H && x % 3 === 0) B.tweak(x, y, -1);
    }
    if ((st === 'long' || st === 'curly') && side) {
      const inside2 = (px, py) => py >= hy && py <= hy + ry + (st === 'long' ? 8 : 5) && px <= hx + 0.5 && px >= hx - rx - 0.6;
      B.shape(hx - rx - 2, hy, hx + 1, hy + ry + 9, inside2, hairNormal, H, { maxShade: 3 });
    }
    if ((st === 'long' || st === 'curly') && !side && !back) {
      // locks falling in front of the shoulders
      for (const sg of [-1, 1]) {
        const x0 = hx + sg * (rx - 0.6);
        B.capsule(x0, hy + 1, x0 + sg * 0.6, hy + ry + (st === 'long' ? 6 : 3), 1.3, 1.1, H);
      }
    }
  }

  function drawHat(B, a, m, p) {
    const o = a.outfit; if (!o.hat) return;
    const hx = p.headCx, hy = p.headCy, rx = m.headRx, ry = m.headRy;
    const side = p.side, back = p.dir === 3;
    const M = o.hatMat;
    B.part(G.HAT);
    const top = hy - ry;
    switch (o.hat) {
      case 'cap': {
        const inside = (px, py) => { const dx = (px - hx) / (rx + 0.6), dy = (py - (top + 3)) / 3.6; return dx * dx + dy * dy <= 1 && py <= top + 3.5; };
        B.shape(hx - rx - 1, top - 2, hx + rx + 1, top + 4, inside, (px, py) => [(px - hx) / (rx + 1), -0.5, 0.7], M);
        for (let x = Math.floor(hx - rx); x <= hx + rx; x++) if (B.get(x, Math.floor(top + 3)) === M) B.tweak(x, top + 3, -1);
        if (side) { B.plot(hx + rx, top + 3, M, 2); B.plot(hx + rx + 1, top + 3, M, 1); }
        break;
      }
      case 'coif': {
        const inside = (px, py) => { const dx = (px - hx) / (rx + 0.5), dy = (py - (top + 3.5)) / 4.2; return dx * dx + dy * dy <= 1 && py < top + 4.2; };
        B.shape(hx - rx - 1, top - 2, hx + rx + 1, top + 5, inside, (px, py) => [(px - hx) / (rx + 1), -0.4, 0.75], M);
        break;
      }
      case 'straw': {
        // wide brim ellipse + low crown, woven texture
        const by = top + 3.2;
        B.shape(hx - rx - 4, by - 2, hx + rx + 4, by + 2, (px, py) => { const dx = (px - hx) / (rx + 3.6), dy = (py - by) / 1.6; return dx * dx + dy * dy <= 1; }, (px, py) => [(px - hx) / (rx + 4) * 0.6, -0.8, 0.5], M);
        B.shape(hx - rx, top - 2, hx + rx, by, (px, py) => { const dx = (px - hx) / (rx - 0.6), dy = (py - by) / 4.6; return dx * dx + dy * dy <= 1 && py <= by - 0.5; }, (px, py) => [(px - hx) / rx, -0.4, 0.8], M);
        for (let y = Math.floor(top - 2); y < by + 2; y++) for (let x = Math.floor(hx - rx - 4); x < hx + rx + 4; x++) if (B.get(x, y) === M && (x + y * 2) % 3 === 0) B.tweak(x, y, -1);
        // hat band
        const band = P.mat(C.madder);
        for (let x = Math.floor(hx - rx + 1); x < hx + rx - 1; x++) if (B.get(x, Math.floor(by) - 1) === M) B.plot(x, by - 1, band, 2);
        break;
      }
      case 'hood': {
        const inside = (px, py) => {
          const dx = (px - hx) / (rx + 1.5), dy = (py - (hy - 0.5)) / (ry + 1.6);
          let inH = dx * dx + dy * dy <= 1;
          // drape onto shoulders
          if (!inH && py > hy && py < p.shY + 3 && Math.abs(px - hx) < rx + 2.5 - (p.shY + 3 - py) * 0.2) inH = true;
          if (!inH) return false;
          if (back) return true;
          if (side) return !(px > hx - 0.5 && py > hy - ry + 2.2 && py < hy + ry);
          return !(Math.abs(px - hx) < rx - 1.3 && py > hy - ry + 2.2 && py < hy + ry);
        };
        B.shape(hx - rx - 4, hy - ry - 3, hx + rx + 4, p.shY + 4, inside, (px, py) => { const nx = (px - hx) / (rx + 3); return [nx, (py - hy) / (ry + 4), Math.sqrt(Math.max(0.1, 1 - nx * nx))]; }, M);
        // inner shadow rim around the face
        if (!back) for (let y = Math.floor(hy - ry + 2); y < hy + ry; y++) for (let x = 0; x < FW; x++) if (B.get(x, y) === M && (B.get(x + 1, y) === a.skin || B.get(x - 1, y) === a.skin)) B.tweak(x, y, -2);
        if (back) { B.tweak(hx, hy + ry, -1); B.tweak(hx, hy + ry + 1, -1); B.plot(hx, hy - ry - 2, M, 2); }
        break;
      }
      case 'kettle': { // kettle helmet: dome + brim, metal
        const by = top + 3.5;
        B.shape(hx - rx - 3, by - 1.5, hx + rx + 3, by + 1.5, (px, py) => { const dx = (px - hx) / (rx + 2.6), dy = (py - by) / 1.2; return dx * dx + dy * dy <= 1; }, (px, py) => [(px - hx) / (rx + 3) * 0.8, -0.6, 0.5], M);
        B.shape(hx - rx, top - 2, hx + rx, by, (px, py) => { const dx = (px - hx) / (rx - 0.2), dy = (py - by) / 5; return dx * dx + dy * dy <= 1 && py < by; }, (px, py) => { const nx = (px - hx) / rx, ny = (py - by) / 5; return [nx, ny, Math.sqrt(Math.max(0.1, 1 - nx * nx - ny * ny))]; }, M);
        break;
      }
      case 'feather': {
        const inside = (px, py) => { const dx = (px - hx) / (rx + 0.8), dy = (py - (top + 2.5)) / 3.2; return dx * dx + dy * dy <= 1 && py <= top + 3.2; };
        B.shape(hx - rx - 1, top - 2, hx + rx + 1, top + 4, inside, (px, py) => [(px - hx) / (rx + 1), -0.5, 0.7], M);
        const F = P.mat(C.white);
        const fx = side ? hx - rx + 1 : hx + rx - 2;
        B.capsule(fx, top + 1, fx - (side ? 3 : -3), top - 4, 0.9, 0.6, F);
        break;
      }
      case 'crown': {
        const G1 = P.mat(P.metal.gold, 'metal');
        for (let x = Math.floor(hx - rx + 1); x < hx + rx - 1; x++) { B.plot(x, top + 1, G1, 3); B.plot(x, top + 2, G1, 2); if (x % 2 === 0) B.plot(x, top, G1, 4); }
        break;
      }
      default: break;
    }
  }

  function drawCloak(B, a, m, p, behind) {
    const o = a.outfit, M = o.cloak; if (!M) return;
    const cx = p.cx, top = p.shY - 0.5, bot = Math.min(GROUND - 3, p.hipY + m.leg * 0.6);
    if (behind) {
      B.part(G.BACK);
      if (p.dir === 3) {
        B.trap(cx, top, bot, m.shW + 1, m.shW + 5, M, { round: 2 });
        foldLines(B, cx, top + 4, bot, m.shW + 5, M, false);
      } else { // side: cloak hangs behind the back
        const sway = p.anim === 'run' ? -3 : p.anim === 'walk' ? -1 : 0;
        B.part(G.BACK);
        B.trap(cx - 3 + sway * 0.5, top, bot, 4, 6 + Math.abs(sway), M, { round: 1.5, tilt: 1 });
      }
    } else {
      // front: cloak falls behind the arms, visible at the outer edges + clasp
      B.part(G.BACK);
      for (const sg of [-1, 1]) B.trap(cx + sg * (m.shW / 2 + 0.2), top + 1, bot, 2.4, 3.4, M);
      B.part(G.ARMS);
      const clasp = P.mat(P.metal.gold, 'metal');
      B.plot(cx - 2, top + 1, clasp, 4); B.plot(cx + 1, top + 1, clasp, 3);
    }
  }

  function drawBackItem(B, a, m, p, behind) {
    const it = a.outfit.backItem; if (!it) return;
    B.part(behind ? G.BACK : G.BACKITEM);
    const W = P.mat(P.wood.oak, 'wood'), S = P.mat(C.linen);
    if (it === 'bow') {
      const x = p.side ? p.cx - 3 : p.cx + (p.dir === 3 ? -1 : 2), y0 = p.shY - 3, y1 = p.hipY + 3;
      for (let y = y0; y <= y1; y++) { const t = (y - y0) / (y1 - y0); const bend = Math.sin(t * Math.PI) * 2.2; B.plot(x + bend * (p.side ? -1 : 1), y, W, 2 + (t < 0.5 ? 1 : 0)); B.plot(x, y, S, 3); }
    }
  }

  // Items held in the tool hand; angle comes from the pose for work swings.
  function drawItem(B, a, it, A, p) {
    const hx = A.hand[0], hy = A.hand[1];
    const W = P.mat(P.wood.oak, 'wood'), Wd = P.mat(P.wood.dark, 'wood'), I = P.mat(P.metal.iron, 'metal'), St = P.mat(P.metal.steel, 'metal');
    const ang = p.toolAngle ?? (p.side ? 0.35 : 0.15); // 0 = pointing up
    const dirx = p.side ? 1 : (A.sh[0] < 16 ? -1 : 1);
    const ux = Math.sin(ang) * dirx, uy = -Math.cos(ang);
    const along = (d) => [hx + ux * d, hy + uy * d];
    switch (it) {
      case 'hammer': {
        const [x1, y1] = along(6); B.capsule(...along(-1.5), x1, y1, 0.7, 0.7, W);
        const px = -uy, py = ux; B.capsule(x1 - px * 2, y1 - py * 2, x1 + px * 2, y1 + py * 2, 1.2, 1.2, I); break;
      }
      case 'axe': {
        const [x1, y1] = along(8); B.capsule(...along(-2), x1, y1, 0.7, 0.7, W);
        const px = -uy * dirx, py = ux * dirx; B.capsule(x1 - ux, y1 - uy, x1 + px * 2.6 * dirx - ux, y1 + py * 2.6 - uy, 1.6, 1.1, St); break;
      }
      case 'pitchfork': case 'hoe': case 'scythe': case 'spear': {
        const L = it === 'spear' ? 15 : 14;
        const a0 = along(-6), a1 = along(L - 6);
        B.capsule(a0[0], a0[1], a1[0], a1[1], 0.6, 0.6, it === 'spear' ? Wd : W);
        if (it === 'pitchfork') { const px = -uy, py = ux; for (const k of [-1.5, 0, 1.5]) B.capsule(a1[0] + px * k, a1[1] + py * k, a1[0] + px * k + ux * 3, a1[1] + py * k + uy * 3, 0.45, 0.45, I); B.capsule(a1[0] - px * 1.6, a1[1] - py * 1.6, a1[0] + px * 1.6, a1[1] + py * 1.6, 0.5, 0.5, I); }
        if (it === 'hoe') { B.capsule(a1[0], a1[1], a1[0] + dirx * 2.5, a1[1] + 1.5, 0.9, 0.7, I); }
        if (it === 'scythe') { for (let k = 0; k < 6; k++) B.plot(a1[0] + dirx * k, a1[1] + Math.sin(k / 5 * Math.PI) * -1.5 + k * 0.3, St, 3 - (k > 3 ? 1 : 0)); }
        if (it === 'spear') { const t = along(L - 6 + 3); B.capsule(a1[0], a1[1], t[0], t[1], 1.1, 0.3, St); }
        break;
      }
      case 'sword': { const t = along(10); B.capsule(...along(1), t[0], t[1], 0.8, 0.5, St); const px = -uy, py = ux; const g = along(1); B.capsule(g[0] - px * 1.8, g[1] - py * 1.8, g[0] + px * 1.8, g[1] + py * 1.8, 0.6, 0.6, P.mat(P.metal.brass, 'metal')); break; }
      case 'dagger': { const t = along(5); B.capsule(...along(1), t[0], t[1], 0.7, 0.4, St); break; }
      case 'bread': B.blob(hx + dirx * 1.5, hy, 2.4, 1.5, P.mat('#c48a45', 'wood'), { power: 2 }); break;
      case 'mug': B.blob(hx + dirx, hy - 0.5, 1.4, 1.8, P.mat(P.wood.walnut, 'wood'), { power: 3 }); B.plot(hx + dirx, hy - 2, P.mat(C.white), 3); break;
      case 'basket': { const bm = P.mat('#b08850', 'wood'); B.blob(hx, hy + 2, 2.8, 2, bm, { power: 3 }); for (let x = -2; x <= 2; x++) B.tweak(hx + x, hy + 2 + (x % 2), -1); break; }
      case 'book': B.blob(hx + dirx, hy + 0.5, 1.6, 2, P.mat(C.crimson), { power: 4 }); break;
      case 'satchel': break; // carried at hip, drawn with belt pouch
      case 'sack': B.blob(hx, hy + 2, 2.5, 3, P.mat(C.linen), { power: 2 }); break;
      case 'net': { const nm = P.mat('#9a8a6a', 'cloth'); for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) B.plot(hx + dirx * (k - 1), hy + 1 + j * 1.5 + (k % 2) * 0.7, nm, 2); break; }
      default: break;
    }
  }

  function drawCarried(B, a, m, p) {
    B.part(G.ITEM);
    const crate = P.mat(P.wood.pine, 'wood');
    if (p.side) {
      const x = p.armA.hand[0] - 1, y = p.armA.hand[1] - 3;
      if (p.dir === 3) return;
      B.blob(x, y, 3.4, 3.2, crate, { power: 6 });
      for (let i = -3; i <= 3; i++) B.tweak(x + i, y, -1);
    } else if (p.dir === 0) {
      const y = p.armA.hand[1] - 2.5;
      B.blob(p.cx, y, 4.6, 3.4, crate, { power: 6 });
      for (let i = -4; i <= 4; i++) B.tweak(p.cx + i, y, -1);
      B.tweak(p.cx - 2, y - 2, 1); B.tweak(p.cx + 2, y + 1, -1);
      // hands over crate edges
      B.part(G.ARMS);
      for (const h of [p.armA.hand, p.armB.hand]) B.capsule(h[0], h[1] - 1, h[0], h[1] - 0.5, m.limbR * 0.95, m.limbR * 0.95, a.skin);
    }
  }

  function renderSleeping(a, m, B) {
    // sleeping: lying under a blanket, shown at the bed — drawn as head on pillow + blanket shape
    B.mirror = false;
    const blanket = P.mat(P.cloth.woad);
    B.part(G.TORSO);
    B.blob(16, 34, 9, 6, blanket, { power: 3 });
    B.part(G.HEAD);
    B.blob(16, 25, m.headRx, m.headRy * 0.9, a.skin, { power: 2.3, jaw: 0.2 });
    const eyeY = 26; B.plot(13, eyeY, a.skin, 0, 1); B.plot(14, eyeY, a.skin, 0, 1); B.plot(18, eyeY, a.skin, 0, 1); B.plot(19, eyeY, a.skin, 0, 1);
    B.part(G.HAIR);
    if (a.hairStyle !== 'bald') B.shape(8, 17, 24, 24, (px, py) => { const dx = (px - 16) / (m.headRx + 0.6), dy = (py - 24) / (m.headRy * 0.9 + 0.5); return dx * dx + dy * dy <= 1 && py < 23; }, (px, py) => [(px - 16) / 7, -0.5, 0.7], a.hair, { maxShade: 3 });
    return B.toCanvas();
  }

  // ---------- Sprite sheet cache ----------
  // Frames are generated lazily and kept in a bounded LRU so thousands of NPCs can exist while only
  // the nearby ones hold pixel data.
  const cache = new Map(); const MAX = 6000;
  function frame(a, dir, anim, f) {
    const key = a.seed + ':' + a.cacheVer + ':' + dir + anim + f;
    let c = cache.get(key);
    if (c) { cache.delete(key); cache.set(key, c); return c; }
    if (anim === 'lie') {
      // lying on the ground: the standing frame turned through exactly 90 degrees (pixel-perfect)
      const src = render(a, 0, 'idle', 0); c = document.createElement('canvas'); c.width = 48; c.height = 48;
      const x = c.getContext('2d'); x.translate(2, 47); x.rotate(-Math.PI / 2); x.drawImage(src, 0, 0); c.ox = 24;
    } else c = render(a, dir, anim, f);
    cache.set(key, c);
    if (cache.size > MAX) cache.delete(cache.keys().next().value);
    return c;
  }
  function invalidate(a) { a.cacheVer = (a.cacheVer || 0) + 1; }

  // Build a full sprite sheet canvas: rows = anim x dir, cols = frames.
  function sheet(a, anims = Object.keys(ANIMS)) {
    const rows = []; anims.filter((an) => an !== 'lie').forEach((an) => [0, 1, 2, 3].forEach((d) => rows.push([an, d])));
    const maxF = Math.max(...anims.map((an) => ANIMS[an].frames)); anims = anims.filter((an) => an !== 'lie');
    const c = document.createElement('canvas'); c.width = FW * maxF; c.height = FH * rows.length;
    const ctx = c.getContext('2d');
    rows.forEach(([an, d], r) => { for (let f = 0; f < ANIMS[an].frames; f++) ctx.drawImage(frame(a, d, an, f), f * FW, r * FH); });
    return { canvas: c, rows, fw: FW, fh: FH };
  }

  O.Char = { makeAppearance, randomGenes, inheritGenes, bodyMetrics, ageStage, outfitFor, render, frame, sheet, invalidate, ANIMS, FW, FH, GROUND, HAIR_STYLES_M, HAIR_STYLES_F, BEARDS };
})();
