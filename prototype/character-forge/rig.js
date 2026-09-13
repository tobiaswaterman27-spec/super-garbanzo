/* rig.js — posing, animation, knockdowns and drawing the bone tree.
 *
 * Two quantisation rules do most of the visual work here:
 *
 *   1. Poses are sampled at ANIM_FPS, not at the display refresh rate.
 *   2. Yaw is snapped to YAW_STEPS discrete angles before rendering.
 *
 * Without them the model rotates and breathes by fractions of a pixel every
 * frame, so every box edge flickers between two pixel columns at 60Hz. That
 * shimmer is what makes a rendered-to-pixels character read as mush instead of
 * as pixel art, and it destroys the depth cues the shading is trying to give.
 * Real sprite work runs at 8-12fps with a fixed set of facing angles; this
 * reproduces that discipline on a model that is genuinely 3D underneath.
 */
(function (global) {
  'use strict';

  const R = global.Render;
  const CM = global.CharacterModel;

  const ANIM_FPS = 12;
  const YAW_STEPS = 16;
  const YAW_STEP = (Math.PI * 2) / YAW_STEPS;

  function quantiseTime(t) { return Math.floor(t * ANIM_FPS) / ANIM_FPS; }
  function quantiseYaw(y) { return Math.round(y / YAW_STEP) * YAW_STEP; }

  const JOINTS = [
    { name: 'head', label: 'Head', axes: ['Nod', 'Turn', 'Tilt'] },
    { name: 'torso', label: 'Torso', axes: ['Lean', 'Twist', 'Side'] },
    { name: 'armR', label: 'Right arm', axes: ['Swing', 'Rotate', 'Raise'] },
    { name: 'foreR', label: 'Right forearm', axes: ['Bend', 'Twist', 'Side'] },
    { name: 'armL', label: 'Left arm', axes: ['Swing', 'Rotate', 'Raise'] },
    { name: 'foreL', label: 'Left forearm', axes: ['Bend', 'Twist', 'Side'] },
    { name: 'legR', label: 'Right leg', axes: ['Swing', 'Rotate', 'Side'] },
    { name: 'shinR', label: 'Right shin', axes: ['Bend', 'Twist', 'Side'] },
    { name: 'legL', label: 'Left leg', axes: ['Swing', 'Rotate', 'Side'] },
    { name: 'shinL', label: 'Left shin', axes: ['Bend', 'Twist', 'Side'] }
  ];

  function clearPose(model) {
    for (const name in model.bones) {
      const r = model.bones[name].rot;
      r[0] = 0; r[1] = 0; r[2] = 0;
    }
    model.bob = 0;
  }

  function setRot(model, name, x, y, z) {
    const b = model.bones[name];
    if (!b) return;
    b.rot[0] = x; b.rot[1] = y; b.rot[2] = z;
  }

  function addRot(model, name, x, y, z) {
    const b = model.bones[name];
    if (!b) return;
    b.rot[0] += x; b.rot[1] += y; b.rot[2] += z;
  }

  /* ---------- built-in cycles ----------
   *
   * Sign conventions:
   *   rot[0] on a limb: positive swings it BACKWARD (-Z), negative forward.
   *   rot[0] on the torso: positive leans forward.
   *   rot[2] on an arm: positive pushes the elbow away from the ribs.
   */

  // Deliberately motionless. A breathing cycle at this scale cannot move less
  // than a whole pixel, so every "subtle" sway became a visible crawl across
  // the whole model. Idle characters hold perfectly still; only their eyes and
  // mouth move.
  function poseIdle(model) {
    clearPose(model);
    model.bob = 0;
    setRot(model, 'torso', 0.02, 0, 0);
    setRot(model, 'armR', 0, 0, 0.07);
    setRot(model, 'armL', 0, 0, -0.07);
    setRot(model, 'foreR', -0.1, 0, 0);
    setRot(model, 'foreL', -0.1, 0, 0);
  }

  function poseWalk(model, t, run) {
    clearPose(model);
    const swingScale = model.dims.legSwing;
    const rate = run ? 12.4 : 7.6;
    const p = t * rate;
    const swing = (run ? 1.05 : 0.66) * swingScale;
    const armSwing = run ? 0.9 : 0.48;

    model.bob = Math.abs(Math.sin(p)) * (run ? 0.9 : 0.45) - 0.22;

    setRot(model, 'legR', -Math.sin(p) * swing, 0, 0);
    setRot(model, 'legL', Math.sin(p) * swing, 0, 0);
    setRot(model, 'shinR', Math.max(0, Math.sin(p - 0.55)) * (run ? 1.55 : 0.92), 0, 0);
    setRot(model, 'shinL', Math.max(0, Math.sin(p - 0.55 + Math.PI)) * (run ? 1.55 : 0.92), 0, 0);

    setRot(model, 'armR', Math.sin(p) * armSwing, 0, 0.08);
    setRot(model, 'armL', -Math.sin(p) * armSwing, 0, -0.08);
    const elbow = run ? 1.15 : 0.3;
    setRot(model, 'foreR', -elbow - Math.max(0, Math.sin(p)) * 0.3, 0, 0);
    setRot(model, 'foreL', -elbow - Math.max(0, -Math.sin(p)) * 0.3, 0, 0);

    const lean = run ? 0.26 : 0.05;
    setRot(model, 'torso', lean + Math.abs(Math.sin(p)) * 0.02, Math.sin(p) * 0.08, 0);
    setRot(model, 'head', -lean * 0.8, -Math.sin(p) * 0.045, 0);
  }

  // Speaking is carried entirely by the visemes; the body stays still for the
  // same reason idle does.
  function poseTalk(model) {
    poseIdle(model);
  }

  /* ---------- ragdoll ----------
   *
   * A real articulated ragdoll: sixteen verlet particles joined by distance
   * constraints, falling under gravity onto a ground plane. Limbs swing and
   * settle independently, which a single rigid body tipping about the feet
   * could never do.
   *
   * The simulation runs in actor-local model units with y = 0 as the ground.
   * It is re-centred on the pelvis each frame and the drift handed back to the
   * actor's world position, so a body that tumbles actually travels.
   */

  const JOINT_NAMES = [
    'pelvis', 'chest', 'neck', 'headTop',
    'shoulderR', 'elbowR', 'handR', 'shoulderL', 'elbowL', 'handL',
    'hipR', 'kneeR', 'footR', 'hipL', 'kneeL', 'footL'
  ];

  // [a, b, stiffness] — the bracing links keep the torso from folding flat.
  const RAGDOLL_LINKS = [
    ['pelvis', 'chest', 1], ['chest', 'neck', 1], ['neck', 'headTop', 1],
    ['chest', 'shoulderR', 1], ['shoulderR', 'elbowR', 1], ['elbowR', 'handR', 1],
    ['chest', 'shoulderL', 1], ['shoulderL', 'elbowL', 1], ['elbowL', 'handL', 1],
    ['pelvis', 'hipR', 1], ['hipR', 'kneeR', 1], ['kneeR', 'footR', 1],
    ['pelvis', 'hipL', 1], ['hipL', 'kneeL', 1], ['kneeL', 'footL', 1],
    ['shoulderR', 'shoulderL', 0.9], ['hipR', 'hipL', 0.9],
    ['shoulderR', 'pelvis', 0.55], ['shoulderL', 'pelvis', 0.55],
    ['chest', 'hipR', 0.55], ['chest', 'hipL', 0.55],
    ['neck', 'shoulderR', 0.7], ['neck', 'shoulderL', 0.7],
    // loose limits so elbows and knees cannot hyperextend into the torso
    ['shoulderR', 'handR', 0.12], ['shoulderL', 'handL', 0.12],
    ['hipR', 'footR', 0.12], ['hipL', 'footL', 0.12]
  ];

  const PARTICLE_RADIUS = { headTop: 2.4, chest: 1.9, pelvis: 1.8 };
  const GRAVITY = 130;         // model units per second squared
  const SUBSTEP = 1 / 120;
  const ITERATIONS = 8;

  // Which segment drives each bone, and whether the bone's local +Y or -Y runs
  // along it. Arms and legs hang along -Y; the torso and head rise along +Y.
  const BONE_SEGMENTS = [
    { bone: 'pelvis', from: 'pelvis', to: 'chest', axis: 1 },
    { bone: 'torso', from: 'pelvis', to: 'chest', axis: 1 },
    { bone: 'head', from: 'neck', to: 'headTop', axis: 1 },
    { bone: 'armR', from: 'shoulderR', to: 'elbowR', axis: -1 },
    { bone: 'foreR', from: 'elbowR', to: 'handR', axis: -1 },
    { bone: 'armL', from: 'shoulderL', to: 'elbowL', axis: -1 },
    { bone: 'foreL', from: 'elbowL', to: 'handL', axis: -1 },
    { bone: 'legR', from: 'hipR', to: 'kneeR', axis: -1 },
    { bone: 'shinR', from: 'kneeR', to: 'footR', axis: -1 },
    { bone: 'legL', from: 'hipL', to: 'kneeL', axis: -1 },
    { bone: 'shinL', from: 'kneeL', to: 'footL', axis: -1 }
  ];

  // Walks the posed bone tree and reports where each joint actually is, in
  // model units with the feet at the origin. Used both to seed the ragdoll and
  // to give it something to stand back up into.
  const _jp = [0, 0, 0];
  function jointPositions(model, yaw) {
    const d = model.dims;
    const base = R.rotationY(yaw);

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

    at('pelvis', 0, 0, 0, 'pelvis');
    at('torso', 0, d.torsoH * 0.92, 0, 'chest');
    at('head', 0, 0, 0, 'neck');
    at('head', 0, d.headH, 0, 'headTop');
    at('armR', 0, 0, 0, 'shoulderR');
    at('armR', 0, -d.upperArmH, 0, 'elbowR');
    at('foreR', 0, -d.lowerArmH, 0, 'handR');
    at('armL', 0, 0, 0, 'shoulderL');
    at('armL', 0, -d.upperArmH, 0, 'elbowL');
    at('foreL', 0, -d.lowerArmH, 0, 'handL');
    at('legR', 0, 0, 0, 'hipR');
    at('legR', 0, -d.upperLegH, 0, 'kneeR');
    at('shinR', 0, -d.lowerLegH, 0, 'footR');
    at('legL', 0, 0, 0, 'hipL');
    at('legL', 0, -d.upperLegH, 0, 'kneeL');
    at('shinL', 0, -d.lowerLegH, 0, 'footL');
    return out;
  }

  function createFall() {
    return {
      active: false,
      mode: 'soft',      // soft = jostled but stays upright; full = goes down
      state: 'up',       // up | falling | down | rising
      p: null, links: null, timer: 0, still: 0, rise: 0
    };
  }

  /* How hard each joint is dragged back toward where the animation says it
   * should be. The feet and hips are held firmly so a soft hit cannot topple
   * anyone; the further up the body, the more freely it swings. */
  const SOFT_PULL = {
    footR: 1, footL: 1, hipR: 0.9, hipL: 0.9, pelvis: 0.85,
    kneeR: 0.7, kneeL: 0.7,
    chest: 0.3, neck: 0.26, headTop: 0.2,
    shoulderR: 0.32, shoulderL: 0.32,
    elbowR: 0.18, elbowL: 0.18, handR: 0.13, handL: 0.13
  };
  const SOFT_TIME = 0.8;

  /* Getting up, as poses rather than a straight interpolation back to
   * standing: face down with the arms planted, push the hips up, come onto a
   * knee, then stand. The physics still runs underneath, so the limbs collide
   * with the ground on the way through. */
  function getupKeys() {
    const k = [];
    function frame(spec) {
      const pose = emptyPose();
      for (const name in spec) pose[name] = spec[name].slice();
      k.push(pose);
    }
    frame({ torso: [1.15, 0, 0], head: [-0.55, 0, 0],
      armR: [1.0, 0, 0.55], armL: [1.0, 0, -0.55], foreR: [-1.5, 0, 0], foreL: [-1.5, 0, 0],
      legR: [-1.15, 0, 0.3], legL: [-1.0, 0, -0.3], shinR: [1.8, 0, 0], shinL: [1.7, 0, 0] });
    frame({ torso: [0.95, 0, 0], head: [-0.5, 0, 0],
      armR: [0.35, 0, 0.4], armL: [0.35, 0, -0.4], foreR: [-0.5, 0, 0], foreL: [-0.5, 0, 0],
      legR: [-1.45, 0, 0.22], legL: [-1.3, 0, -0.22], shinR: [2.0, 0, 0], shinL: [1.9, 0, 0] });
    frame({ torso: [0.4, 0, 0], head: [-0.18, 0, 0],
      armR: [-0.25, 0, 0.3], armL: [0.15, 0, -0.2], foreR: [-0.7, 0, 0], foreL: [-0.3, 0, 0],
      legR: [-1.0, 0, 0.16], legL: [-0.25, 0, -0.12], shinR: [1.5, 0, 0], shinL: [0.45, 0, 0] });
    frame({ torso: [0.12, 0, 0], head: [-0.05, 0, 0],
      armR: [0, 0, 0.12], armL: [0, 0, -0.12], foreR: [-0.2, 0, 0], foreL: [-0.2, 0, 0],
      legR: [-0.2, 0, 0.06], legL: [-0.05, 0, -0.04], shinR: [0.3, 0, 0], shinL: [0.1, 0, 0] });
    frame({ torso: [0.02, 0, 0], armR: [0, 0, 0.07], armL: [0, 0, -0.07],
      foreR: [-0.1, 0, 0], foreL: [-0.1, 0, 0] });
    return k;
  }
  const GETUP_KEYS = getupKeys();
  const RISE_TIME = 1.9;

  function distanceBetween(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }

  // dirX/dirY is the world push direction (world y is depth, which is local z).
  function applyImpulse(actor, dirX, dirY, force, mode) {
    const f = actor.fall;
    const model = actor.model;

    // pose the model as it currently stands, then read the joints off it
    poseActor(actor, quantiseTime(actor.animTime));
    const joints = jointPositions(model, actor.yaw);

    // A soft jostle already in progress can be escalated to a real fall.
    const reuse = f.active && f.p;
    const p = reuse ? f.p : {};
    const len = Math.hypot(dirX, dirY) || 1;
    const px = dirX / len, pz = dirY / len;
    const cap = mode === 'soft' ? 5.0 : 9.0;
    const impulse = Math.max(1.0, Math.min(cap, force)) * SUBSTEP *
      (mode === 'soft' ? 6.0 : 7.5);

    let tallest = 1;
    for (let i = 0; i < JOINT_NAMES.length; i++) {
      const k = JOINT_NAMES[i];
      if (joints[k] && joints[k][1] > tallest) tallest = joints[k][1];
    }

    for (let i = 0; i < JOINT_NAMES.length; i++) {
      const k = JOINT_NAMES[i];
      const j = joints[k];
      if (!j) continue;
      if (!reuse) {
        p[k] = { x: j[0], y: j[1], z: j[2], px: j[0], py: j[1], pz: j[2],
          r: PARTICLE_RADIUS[k] || 1.2 };
      }
      const q = p[k];
      // A push that scales with height topples rather than slides: the feet
      // barely move, the shoulders take the hit.
      const lever = 0.25 + 1.5 * (q.y / tallest);
      q.px -= px * impulse * lever;
      q.pz -= pz * impulse * lever;
      q.py -= impulse * 0.16 * lever;
    }

    if (!reuse) {
      const links = [];
      for (let i = 0; i < RAGDOLL_LINKS.length; i++) {
        const a = RAGDOLL_LINKS[i][0], b = RAGDOLL_LINKS[i][1];
        if (!joints[a] || !joints[b]) continue;
        links.push({ a: a, b: b, len: distanceBetween(joints[a], joints[b]),
          stiff: RAGDOLL_LINKS[i][2] });
      }
      f.links = links;
      f.p = p;
    }

    f.active = true;
    f.mode = mode;
    f.state = mode === 'soft' ? 'jostled' : 'falling';
    f.timer = mode === 'soft' ? SOFT_TIME : 0;
    f.still = 0;
    f.rise = 0;
    actor.gait = 'idle';
    actor.speaking = false;
    actor.viseme = 'rest';
    return true;
  }

  // Jostled but still on their feet: the body reacts, nobody goes down.
  function nudge(actor, dirX, dirY, force) {
    if (actor.fall.active && actor.fall.mode === 'full') return false;
    return applyImpulse(actor, dirX, dirY, force, 'soft');
  }

  // Knocked off their feet entirely.
  function knockDown(actor, dirX, dirY, force) {
    return applyImpulse(actor, dirX, dirY, force, 'full');
  }

  function simulate(f, dt, gravityScale) {
    const p = f.p;
    const gStep = GRAVITY * (gravityScale === undefined ? 1 : gravityScale) * dt * dt;

    for (const k in p) {
      const q = p[k];
      const vx = (q.x - q.px) * 0.992;
      const vy = (q.y - q.py) * 0.992;
      const vz = (q.z - q.pz) * 0.992;
      q.px = q.x; q.py = q.y; q.pz = q.z;
      q.x += vx;
      q.y += vy - gStep;
      q.z += vz;
    }

    for (let it = 0; it < ITERATIONS; it++) {
      const links = f.links;
      for (let i = 0; i < links.length; i++) {
        const l = links[i];
        const a = p[l.a], b = p[l.b];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const dist = Math.hypot(dx, dy, dz) || 1e-6;
        // the loose limit links only push apart, never pull together
        if (l.stiff < 0.2 && dist >= l.len) continue;
        const k = ((dist - l.len) / dist) * 0.5 * l.stiff;
        const ox = dx * k, oy = dy * k, oz = dz * k;
        a.x += ox; a.y += oy; a.z += oz;
        b.x -= ox; b.y -= oy; b.z -= oz;
      }
      for (const key in p) {
        const q = p[key];
        if (q.y < q.r) {
          q.y = q.r;
          // ground friction, applied by dragging the previous position forward
          q.px += (q.x - q.px) * 0.4;
          q.pz += (q.z - q.pz) * 0.4;
        }
      }
    }
  }

  function kineticEnergy(f) {
    let e = 0;
    for (const k in f.p) {
      const q = f.p[k];
      e += (q.x - q.px) * (q.x - q.px) + (q.y - q.py) * (q.y - q.py) + (q.z - q.pz) * (q.z - q.pz);
    }
    return e;
  }

  // Drags every particle toward where a given pose says the joint belongs.
  // Moving the previous position by the same amount makes this a pure
  // correction, so it repositions the body without wiping out its momentum —
  // which is what leaves the wobble in.
  function pullToward(f, target, strength, perJoint) {
    for (const key in f.p) {
      const q = f.p[key];
      const t = target[key];
      if (!t) continue;
      const k = Math.min(1, strength * (perJoint ? (perJoint[key] || 0.3) : 1));
      const dx = (t[0] - q.x) * k, dy = (t[1] - q.y) * k, dz = (t[2] - q.z) * k;
      q.x += dx; q.y += dy; q.z += dz;
      q.px += dx; q.py += dy; q.pz += dz;
    }
  }

  function standingTarget(actor) {
    poseActor(actor, quantiseTime(actor.animTime));
    return jointPositions(actor.model, actor.yaw);
  }

  function updateFall(actor, dt) {
    const f = actor.fall;
    if (!f.active || !f.p) return;

    /* ---- jostled: reacts, recovers, never falls ---- */
    if (f.mode === 'soft') {
      let acc = Math.min(dt, 0.05);
      while (acc > 0) {
        const step = Math.min(SUBSTEP, acc);
        simulate(f, step, 0.25);
        acc -= step;
      }
      const target = standingTarget(actor);
      pullToward(f, target, Math.min(1, dt * 16), SOFT_PULL);

      f.timer -= dt;
      if (f.timer <= 0 || kineticEnergy(f) < 0.004) {
        f.active = false;
        f.state = 'up';
        f.p = null;
      }
      return;
    }

    /* ---- getting back up, under its own power ---- */
    if (f.state === 'rising') {
      f.rise += dt / RISE_TIME;
      const k = Math.min(1, f.rise);

      let acc = Math.min(dt, 0.05);
      while (acc > 0) {
        const step = Math.min(SUBSTEP, acc);
        simulate(f, step, 0.55);
        acc -= step;
      }

      // walk the get-up keyframes and haul the body toward each in turn
      const seg = k * (GETUP_KEYS.length - 1);
      const i = Math.min(GETUP_KEYS.length - 2, Math.floor(seg));
      const pose = lerpPose(GETUP_KEYS[i], GETUP_KEYS[i + 1], seg - i);
      applyPose(actor.model, pose, 0);
      const target = jointPositions(actor.model, actor.yaw);
      pullToward(f, target, Math.min(1, dt * (5 + 22 * k)));

      if (k >= 1) {
        f.active = false;
        f.state = 'up';
        f.p = null;
      }
      return;
    }

    /* ---- going down ---- */
    let acc = Math.min(dt, 0.05);
    while (acc > 0) {
      const step = Math.min(SUBSTEP, acc);
      simulate(f, step, 1);
      acc -= step;
    }

    // hand the pelvis drift back to the actor so a tumbling body travels
    const pelvis = f.p.pelvis;
    const dx = pelvis.x, dz = pelvis.z;
    if (dx || dz) {
      for (const k in f.p) {
        const q = f.p[k];
        q.x -= dx; q.z -= dz;
        q.px -= dx; q.pz -= dz;
      }
      actor.x += dx;
      actor.y += dz;
    }

    if (f.state === 'falling') {
      if (kineticEnergy(f) < 0.02) {
        f.still += dt;
        if (f.still > 0.3) { f.state = 'down'; f.timer = 0.5 + actor.rng() * 0.7; }
      } else {
        f.still = 0;
      }
    } else if (f.state === 'down') {
      f.timer -= dt;
      if (f.timer <= 0) { f.state = 'rising'; f.rise = 0; }
    }
  }

  // Down on the ground, as opposed to merely jostled.
  function isDown(actor) { return actor.fall.active && actor.fall.mode === 'full'; }

  /* ---------- drawing a ragdoll ---------- */

  // Builds a bone matrix that runs from `from` to `to`, with `refLateral`
  // pinning the roll so knees and elbows keep pointing somewhere sensible.
  function segmentMatrix(from, to, axisSign, refLateral) {
    let ax = (to[0] - from[0]) * axisSign;
    let ay = (to[1] - from[1]) * axisSign;
    let az = (to[2] - from[2]) * axisSign;
    const alen = Math.hypot(ax, ay, az) || 1e-6;
    ax /= alen; ay /= alen; az /= alen;

    let rx = refLateral[0], ry = refLateral[1], rz = refLateral[2];
    const dot = rx * ax + ry * ay + rz * az;
    rx -= ax * dot; ry -= ay * dot; rz -= az * dot;
    let rlen = Math.hypot(rx, ry, rz);
    if (rlen < 1e-4) {
      // reference ran parallel to the bone; pick any perpendicular
      rx = Math.abs(ay) < 0.9 ? 0 : 1; ry = Math.abs(ay) < 0.9 ? 1 : 0; rz = 0;
      const d2 = rx * ax + ry * ay + rz * az;
      rx -= ax * d2; ry -= ay * d2; rz -= az * d2;
      rlen = Math.hypot(rx, ry, rz) || 1e-6;
    }
    rx /= rlen; ry /= rlen; rz /= rlen;

    // Z = X cross Y, giving a right-handed basis so normals are not mirrored
    const fx = ry * az - rz * ay;
    const fy = rz * ax - rx * az;
    const fz = rx * ay - ry * ax;

    const m = R.identity();
    m[0] = rx; m[1] = ax; m[2] = fx; m[3] = from[0];
    m[4] = ry; m[5] = ay; m[6] = fy; m[7] = from[1];
    m[8] = rz; m[9] = az; m[10] = fz; m[11] = from[2];
    return m;
  }

  function drawRagdoll(target, model, camera, fall, faceParts) {
    const p = fall.p;
    const scale = model.root.scale || 1;
    const scaleM = R.scaling(scale);

    const sr = p.shoulderR, sl = p.shoulderL;
    let lateral = [sl.x - sr.x, sl.y - sr.y, sl.z - sr.z];
    const ll = Math.hypot(lateral[0], lateral[1], lateral[2]);
    if (ll < 1e-4) lateral = [1, 0, 0];
    else { lateral = [lateral[0] / ll, lateral[1] / ll, lateral[2] / ll]; }

    for (let i = 0; i < BONE_SEGMENTS.length; i++) {
      const seg = BONE_SEGMENTS[i];
      const bone = model.bones[seg.bone];
      if (!bone) continue;
      const a = p[seg.from], b = p[seg.to];
      if (!a || !b) continue;

      const m = R.multiply(scaleM,
        segmentMatrix([a.x, a.y, a.z], [b.x, b.y, b.z], seg.axis, lateral));

      for (let k = 0; k < bone.parts.length; k++) {
        const part = bone.parts[k];
        R.drawMesh(target, m, part.mesh, R.ramp(part.colour), camera, part);
      }
      if (faceParts && seg.bone === 'head') {
        for (let k = 0; k < faceParts.length; k++) {
          const part = faceParts[k];
          R.drawMesh(target, m, part.mesh, R.ramp(part.colour), camera, part);
        }
      }
    }
  }

  /* ---------- custom poses and keyframes ---------- */

  function emptyPose() {
    const pose = {};
    for (let i = 0; i < JOINTS.length; i++) pose[JOINTS[i].name] = [0, 0, 0];
    return pose;
  }

  function clonePose(pose) {
    const out = {};
    for (const k in pose) out[k] = [pose[k][0], pose[k][1], pose[k][2]];
    return out;
  }

  function applyPose(model, pose, bob) {
    clearPose(model);
    for (const name in pose) {
      const v = pose[name];
      setRot(model, name, v[0], v[1], v[2]);
    }
    model.bob = bob || 0;
  }

  function lerpPose(a, b, t) {
    const out = {};
    for (const k in a) {
      const va = a[k], vb = b[k] || a[k];
      out[k] = [
        va[0] + (vb[0] - va[0]) * t,
        va[1] + (vb[1] - va[1]) * t,
        va[2] + (vb[2] - va[2]) * t
      ];
    }
    return out;
  }

  function samplePoseTrack(frames, t, duration) {
    if (!frames.length) return emptyPose();
    if (frames.length === 1) return frames[0].pose;
    const wrapped = ((t % duration) + duration) % duration;
    const step = duration / frames.length;
    const i = Math.min(frames.length - 1, Math.floor(wrapped / step));
    const j = (i + 1) % frames.length;
    return lerpPose(frames[i].pose, frames[j].pose, (wrapped - i * step) / step);
  }

  /* ---------- directions ---------- */

  // Ordered by increasing yaw so directionName() can index straight into it.
  // Yaw 0 faces the camera (south); yaw grows clockwise on screen.
  const DIRECTIONS = [
    { id: 'S', label: 'South', dx: 0, dy: 1 },
    { id: 'SE', label: 'South-east', dx: 0.7071, dy: 0.7071 },
    { id: 'E', label: 'East', dx: 1, dy: 0 },
    { id: 'NE', label: 'North-east', dx: 0.7071, dy: -0.7071 },
    { id: 'N', label: 'North', dx: 0, dy: -1 },
    { id: 'NW', label: 'North-west', dx: -0.7071, dy: -0.7071 },
    { id: 'W', label: 'West', dx: -1, dy: 0 },
    { id: 'SW', label: 'South-west', dx: -0.7071, dy: 0.7071 }
  ];

  function yawForDirection(dx, dy) { return Math.atan2(dx, dy); }

  function snapToEight(dx, dy) {
    const step = Math.PI / 4;
    return Math.round(Math.atan2(dx, dy) / step) * step;
  }

  function directionName(yaw) {
    const step = Math.PI / 4;
    let i = Math.round(yaw / step) % 8;
    if (i < 0) i += 8;
    return DIRECTIONS[i].id;
  }

  function shortestAngle(from, to) {
    let diff = (to - from) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  /* ---------- actors ---------- */

  function createActor(character, x, y, seed) {
    const model = CM.buildModel(character);
    return {
      character: character,
      model: model,
      x: x, y: y,
      vx: 0, vy: 0,
      yaw: 0,
      targetYaw: 0,
      gait: 'idle',          // idle | walk | run | skid
      animTime: Math.random() * 10,
      rng: CM.makeRng(seed === undefined ? (Math.random() * 0xffffffff) >>> 0 : seed),
      blink: 0,
      blinkPhase: 0,
      blinkTimer: 1 + Math.random() * 4,
      blinkQueue: 0,
      viseme: 'rest',
      gaze: 0,
      speaking: false,
      fall: createFall(),
      brain: null,
      buffer: null,
      _key: ''
    };
  }

  function rebuildActorModel(actor) {
    actor.model = CM.buildModel(actor.character);
    actor._key = '';
  }

  const TURN_RATE = 11.0;

  function updateActorMotion(actor, dt) {
    const diff = shortestAngle(actor.yaw, actor.targetYaw);
    const maxStep = TURN_RATE * dt;
    if (Math.abs(diff) <= maxStep) actor.yaw = actor.targetYaw;
    else actor.yaw += Math.sign(diff) * maxStep;

    actor.animTime += dt;
    updateFall(actor, dt);
    updateBlink(actor, dt);
  }

  function updateBlink(actor, dt) {
    if (actor.blink > 0) {
      actor.blinkPhase += dt;
      const p = actor.blinkPhase / 0.17;
      if (p >= 1) {
        actor.blink = 0;
        if (actor.blinkQueue > 0) { actor.blinkQueue--; actor.blinkTimer = 0.09; }
        else actor.blinkTimer = 2.0 + actor.rng() * 4.5;
      } else {
        actor.blink = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
      }
      return;
    }
    actor.blinkTimer -= dt;
    if (actor.blinkTimer <= 0) {
      actor.blink = 0.001;
      actor.blinkPhase = 0;
      actor.blinkQueue = actor.rng() < 0.18 ? 1 : 0;
    }
  }

  function poseActor(actor, qTime) {
    const model = actor.model;
    if (actor.customPose) { applyPose(model, actor.customPose, actor.customBob || 0); return; }
    if (actor.gait === 'walk') poseWalk(model, qTime, false);
    else if (actor.gait === 'run') poseWalk(model, qTime, true);
    else poseIdle(model);
  }

  /* ---------- drawing ---------- */

  function drawModel(target, model, camera, opts) {
    const yaw = (opts && opts.yaw) || 0;
    const faceParts = opts && opts.faceParts;
    const scale = model.root.scale || 1;

    // Yaw, then scale, then the bob — and the bob is rounded to a whole screen
    // pixel. A sub-pixel bob does nothing except flip an edge row on and off as
    // it crosses a boundary, which reads as the model quietly crawling.
    const pixel = scale * camera.scale;
    const bob = pixel > 0 ? Math.round((model.bob || 0) * pixel) / pixel : 0;
    let base = R.multiply(R.rotationY(yaw), R.scaling(scale));
    base = R.multiply(base, R.translation(0, bob, 0));

    (function walk(node, parent) {
      let local = R.translation(node.origin[0], node.origin[1], node.origin[2]);
      if (node.rot[2]) local = R.multiply(local, R.rotationZ(node.rot[2]));
      if (node.rot[1]) local = R.multiply(local, R.rotationY(node.rot[1]));
      if (node.rot[0]) local = R.multiply(local, R.rotationX(node.rot[0]));
      const m = R.multiply(parent, local);

      for (let i = 0; i < node.parts.length; i++) {
        const p = node.parts[i];
        R.drawMesh(target, m, p.mesh, R.ramp(p.colour), camera, p);
      }
      if (faceParts && node.name === 'head') {
        for (let i = 0; i < faceParts.length; i++) {
          const p = faceParts[i];
          R.drawMesh(target, m, p.mesh, R.ramp(p.colour), camera, p);
        }
      }
      for (let i = 0; i < node.children.length; i++) walk(node.children[i], m);
    })(model.root, base);
  }

  const OUTLINE = R.pack(17, 19, 27);

  // Renders one actor into its own buffer and outlines it. Both the pose clock
  // and the facing angle are quantised first; if neither moved since the last
  // frame the existing buffer is reused untouched, which is both cheaper and
  // exactly what keeps the pixels still.
  function renderActor(actor, target, camera, opts) {
    const qTime = quantiseTime(actor.animTime);
    const qYaw = quantiseYaw((opts && opts.yaw !== undefined) ? opts.yaw : actor.yaw);
    const f = actor.fall;

    // A ragdoll changes every frame, so it never reuses a cached buffer.
    const key = f.active ? null : [
      qTime, qYaw, actor.gait, actor.blink > 0.5 ? 1 : actor.blink > 0 ? 2 : 0,
      actor.viseme, actor.customPose ? 'p' + actor.animTime : ''
    ].join('|');
    if (key !== null && key === actor._key && !(opts && opts.force)) return target;
    actor._key = key === null ? '' : key;

    R.clearTarget(target);
    const face = CM.buildFaceParts(actor.model, {
      blink: actor.blink,
      viseme: actor.viseme,
      gaze: actor.gaze
    });

    if (f.active && f.p) {
      drawRagdoll(target, actor.model, camera, f, face);
    } else {
      poseActor(actor, qTime);
      drawModel(target, actor.model, camera, { yaw: qYaw, faceParts: face });
    }
    R.traceOutline(target, (opts && opts.outline) || OUTLINE);
    return target;
  }

  global.Rig = {
    JOINTS, DIRECTIONS, ANIM_FPS, YAW_STEPS,
    quantiseTime, quantiseYaw,
    clearPose, setRot, addRot, poseIdle, poseWalk, poseTalk,
    emptyPose, clonePose, applyPose, lerpPose, samplePoseTrack,
    yawForDirection, snapToEight, directionName, shortestAngle,
    createActor, rebuildActorModel, updateActorMotion, updateBlink,
    createFall, knockDown, nudge, applyImpulse, updateFall, isDown,
    jointPositions, segmentMatrix, drawRagdoll,
    poseActor, drawModel, renderActor, OUTLINE
  };
})(window);
