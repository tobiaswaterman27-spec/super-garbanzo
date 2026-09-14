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
  const STEEL = '#b9bec6';
  const STEEL_DARK = '#7d838c';
  const HAFT = '#6b4a29';
  const HAFT_DARK = '#4a3119';
  const LEATHER = '#4b3320';
  const BRASS = '#a8852f';

  function part(mesh, colour) { return { mesh: mesh, colour: colour }; }

  /* Every weapon is modelled in the hand's own space: the grip sits at the
   * origin and the business end runs along -Y, which is the direction the
   * forearm already points. That way one attachment point serves all of them
   * and a weapon needs no bone of its own. */
  const BUILD = {
    fists: function () { return []; },

    club: function () {
      const p = [];
      p.push(part(G.slab(-0.85, -1.2, -0.85, 1.7, 7.0, 1.7, 0.9, 1), HAFT));
      p.push(part(G.taper(-1.6, -8.2, -1.6, 3.2, 7.0, 3.2, 1.35), HAFT_DARK));
      p.push(part(G.slab(-0.95, -1.4, -0.95, 1.9, 1.4, 1.9, 0.8, 1), LEATHER));
      return p;
    },

    dagger: function () {
      const p = [];
      p.push(part(G.slab(-0.7, -0.6, -0.7, 1.4, 3.2, 1.4, 0.85, 1), LEATHER));
      p.push(part(G.box(-1.5, -1.0, -0.5, 3.0, 0.7, 1.0), BRASS));
      p.push(part(G.taper(-0.85, -7.8, -0.35, 1.7, 6.9, 0.7, 0.28), STEEL));
      p.push(part(G.superellipsoid(0, 2.9, 0, 0.75, 0.7, 0.75, 0.6, 3, 7), BRASS));
      return p;
    },

    sword: function () {
      const p = [];
      p.push(part(G.slab(-0.72, -0.4, -0.72, 1.44, 3.6, 1.44, 0.85, 1), LEATHER));
      // crossguard
      p.push(part(G.box(-3.4, -1.2, -0.55, 6.8, 0.95, 1.1), STEEL_DARK));
      // blade, with a fuller down the middle
      p.push(part(G.taper(-1.15, -17.5, -0.42, 2.3, 16.4, 0.84, 0.42), STEEL));
      p.push(part(G.box(-0.35, -16.0, -0.5, 0.7, 14.6, 1.0), STEEL_DARK));
      p.push(part(G.superellipsoid(0, 3.3, 0, 0.9, 0.85, 0.9, 0.55, 3, 7), BRASS));
      return p;
    },

    axe: function () {
      const p = [];
      p.push(part(G.slab(-0.8, -1.0, -0.8, 1.6, 11.5, 1.6, 0.9, 1), HAFT));
      // head: a bearded blade hanging off one side of the haft
      p.push(part(G.box(-0.9, -11.8, -1.1, 1.8, 3.6, 2.2), STEEL_DARK));
      p.push(part(G.taper(-0.6, -12.6, -6.4, 1.2, 5.2, 6.6, 1.0, 0, 2.6), STEEL));
      p.push(part(G.box(-0.7, -13.2, -6.9, 1.4, 4.4, 1.2), STEEL));
      p.push(part(G.slab(-0.9, -1.2, -0.9, 1.8, 1.6, 1.8, 0.8, 1), LEATHER));
      return p;
    },

    mace: function () {
      const p = [];
      p.push(part(G.slab(-0.82, -1.0, -0.82, 1.64, 9.0, 1.64, 0.9, 1), HAFT_DARK));
      p.push(part(G.superellipsoid(0, -10.6, 0, 2.5, 2.7, 2.5, 0.55, 4, 8), STEEL_DARK));
      // flanges
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        p.push(part(G.box(Math.cos(a) * 2.1 - 0.5, -12.2, Math.sin(a) * 2.1 - 0.5,
          1.0, 3.2, 1.0), STEEL));
      }
      p.push(part(G.superellipsoid(0, -13.4, 0, 1.2, 0.9, 1.2, 0.5, 3, 7), STEEL));
      return p;
    },

    spear: function () {
      const p = [];
      p.push(part(G.slab(-0.62, 6.0, -0.62, 1.24, 26.0, 1.24, 0.92, 1), HAFT));
      p.push(part(G.taper(-1.0, -24.5, -0.4, 2.0, 5.2, 0.8, 0.12), STEEL));
      p.push(part(G.box(-0.8, -19.6, -0.45, 1.6, 1.4, 0.9), STEEL_DARK));
      p.push(part(G.slab(-0.72, -1.0, -0.72, 1.44, 2.2, 1.44, 0.8, 1), LEATHER));
      return p;
    },

    greatsword: function () {
      const p = [];
      p.push(part(G.slab(-0.8, 0.4, -0.8, 1.6, 6.4, 1.6, 0.85, 1), LEATHER));
      p.push(part(G.box(-4.6, -1.4, -0.65, 9.2, 1.1, 1.3), STEEL_DARK));
      p.push(part(G.taper(-1.45, -25.0, -0.5, 2.9, 23.6, 1.0, 0.46), STEEL));
      p.push(part(G.box(-0.45, -23.0, -0.6, 0.9, 21.0, 1.2), STEEL_DARK));
      p.push(part(G.superellipsoid(0, 6.6, 0, 1.1, 1.1, 1.1, 0.5, 3, 8), BRASS));
      return p;
    },

    poleaxe: function () {
      const p = [];
      p.push(part(G.slab(-0.72, 4.0, -0.72, 1.44, 30.0, 1.44, 0.92, 1), HAFT));
      p.push(part(G.box(-0.85, -26.5, -1.0, 1.7, 4.2, 2.0), STEEL_DARK));
      p.push(part(G.taper(-0.6, -27.4, -6.0, 1.2, 5.6, 6.2, 1.0, 0, 2.4), STEEL));
      // hammer poll on the far side, and a spike on top
      p.push(part(G.box(-0.9, -27.0, 1.0, 1.8, 3.4, 2.6), STEEL));
      p.push(part(G.taper(-0.7, -31.5, -0.7, 1.4, 4.4, 1.4, 0.15), STEEL));
      return p;
    },

    bow: function () {
      const p = [];
      // a stave curving away from the hand, strung down the inside
      for (let i = -4; i <= 4; i++) {
        if (i === 0) continue;
        const t = i / 4;
        const y = -t * 13.5;
        const z = -(1 - t * t) * 2.8;
        p.push(part(G.slab(-0.55, y - 1.9, z - 0.55, 1.1, 3.8, 1.1, 0.85, 1),
          Math.abs(i) === 4 ? HAFT_DARK : HAFT));
      }
      p.push(part(G.slab(-0.72, -2.0, -0.9, 1.44, 4.0, 1.5, 0.8, 1), LEATHER));
      for (let i = -4; i < 4; i++) {
        const y0 = (i / 4) * -13.5, y1 = ((i + 1) / 4) * -13.5;
        p.push(part(G.box(-0.2, Math.min(y0, y1), 0.35, 0.4, Math.abs(y1 - y0), 0.4),
          '#ddd6c2'));
      }
      return p;
    },

    crossbow: function () {
      const p = [];
      p.push(part(G.box(-0.9, -12.5, -1.0, 1.8, 15.0, 2.0), HAFT));
      p.push(part(G.box(-7.5, -11.0, -0.7, 15.0, 1.2, 1.4), HAFT_DARK));
      p.push(part(G.box(-7.9, -11.4, -0.6, 1.2, 2.0, 1.2), STEEL_DARK));
      p.push(part(G.box(6.7, -11.4, -0.6, 1.2, 2.0, 1.2), STEEL_DARK));
      p.push(part(G.box(-6.9, -10.6, 0.1, 13.8, 0.4, 0.4), '#ddd6c2'));
      p.push(part(G.box(-0.7, 2.0, -0.9, 1.4, 2.6, 1.8), LEATHER));
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
    fists: { id: 'fists', label: 'Fists', kind: 'blunt', power: 7, reach: 12,
      swing: 0.17, recover: 0.16, bleed: 0.0, arc: 0.6, stamina: 2, anim: 'jab',
      gore: 0, knock: 0.35, twoHanded: false },
    club: { id: 'club', label: 'Club', kind: 'blunt', power: 17, reach: 19,
      swing: 0.24, recover: 0.30, bleed: 0.02, arc: 0.75, stamina: 5, anim: 'swing',
      gore: 0, knock: 0.85, twoHanded: false },
    dagger: { id: 'dagger', label: 'Dagger', kind: 'pierce', power: 23, reach: 14,
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
  function makeWound(model, zone, dirLocal, kind, gore, rng) {
    const d = model.dims;
    const bone = model.bones[zone.bone] ? zone.bone : 'torso';
    // a spot on the front-ish surface of that bone, offset by where the blow
    // came from, so a hit from the left lands on the left
    const spreadX = (zone.id === 'head' ? d.headW : d.torsoW) * 0.34;
    const x = (dirLocal[0] * 0.55 + (rng() - 0.5) * 0.5) * spreadX;
    const z = (dirLocal[1] * 0.5 + (rng() - 0.5) * 0.4)
      * (zone.id === 'head' ? d.headD : d.torsoD) * 0.52;
    let y;
    if (zone.bone === 'head') y = 1.5 + rng() * 4.5;
    else if (zone.bone === 'torso') y = zone.id === 'gut' ? 1.0 + rng() * 3.0 : 4.5 + rng() * 5.5;
    else if (zone.bone === 'armR') y = -1.0 - rng() * 3.5;
    else y = -1.5 - rng() * 4.0;

    const slash = kind === 'edged' && gore >= 1;
    return {
      bone: bone,
      x: x, y: y, z: z,
      // a slash is a long cut across the body; a stab or a bruise is a patch
      w: slash ? 5.5 + rng() * 4.5 : 1.6 + rng() * 1.6,
      h: slash ? 0.9 + rng() * 0.5 : 1.5 + rng() * 1.3,
      angle: slash ? (rng() - 0.5) * 1.4 : 0,
      kind: kind,
      age: 0,
      // how far the blood has run down from it
      run: 0,
      maxRun: slash ? 5 + rng() * 6 : 2 + rng() * 4
    };
  }

  /* Rebuilt every frame the actor is drawn, like the face is. Cheap, and it
   * means a wound that is still spreading looks like it is still spreading. */
  function woundParts(model, wounds) {
    if (!wounds || !wounds.length) return null;
    const byBone = {};
    for (let i = 0; i < wounds.length; i++) {
      const wd = wounds[i];
      const list = byBone[wd.bone] || (byBone[wd.bone] = []);
      const deep = wd.kind !== 'blunt';
      const col = deep ? BLOOD : BLOOD_DARK;
      const ca = Math.cos(wd.angle), sa = Math.sin(wd.angle);
      const half = wd.w / 2;
      const steps = wd.w > 3 ? 5 : 1;
      for (let k = 0; k < steps; k++) {
        const t = steps === 1 ? 0 : (k / (steps - 1) - 0.5) * 2;
        const ox = ca * half * t, oy = sa * half * t;
        list.push(part(G.box(wd.x + ox - wd.h * 0.5, wd.y + oy - wd.h * 0.5,
          wd.z - 0.2, wd.h, wd.h, 0.45), col));
      }
      // the run of blood below it, growing as they bleed
      if (wd.run > 0.3) {
        list.push(part(G.box(wd.x - 0.45, wd.y - wd.run, wd.z - 0.16,
          0.9, wd.run, 0.38), BLOOD_DARK));
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
      blocking: false
    };
  }

  /* Applies a rolled blow. Returns what happened, so the caller can decide
   * how the victim reacts and whether anyone saw it. */
  function applyDamage(target, roll, dirLocal, rng) {
    const body = target.body;
    if (!body || body.dead) return null;
    body.hp = Math.max(0, body.hp - roll.amount);
    body.bleed += roll.bleed;
    body.pain = Math.min(1, body.pain + roll.amount / 55);
    if (roll.bleed > 0.05 || roll.amount > 12) {
      if (body.wounds.length < 9) {
        body.wounds.push(makeWound(target.model, roll.zone, dirLocal,
          roll.kind, roll.gore, rng || Math.random));
      }
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
    WEAPONS, MELEE_IDS, ALL_IDS, ZONES, MAX_HP, BLOOD, BLOOD_DARK,
    weapon, weaponParts, rollZone, rollDamage, zoneFor,
    createBody, applyDamage, updateBody, makeWound, woundParts, severityOf
  };
  void CM;
})(window);
