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

  function poseIdle(model, t) {
    clearPose(model);
    const breath = Math.sin(t * 1.5);
    const sway = Math.sin(t * 0.41);

    model.bob = breath * 0.1;
    setRot(model, 'torso', 0.02 + breath * 0.016, sway * 0.025, 0);
    setRot(model, 'head', -0.026 - breath * 0.018, sway * 0.08, 0);

    const armSway = Math.sin(t * 1.5 + 0.7) * 0.03;
    setRot(model, 'armR', armSway, 0, 0.07);
    setRot(model, 'armL', armSway, 0, -0.07);
    setRot(model, 'foreR', -0.1 - breath * 0.025, 0, 0);
    setRot(model, 'foreL', -0.1 - breath * 0.025, 0, 0);
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

  function poseTalk(model, t) {
    poseIdle(model, t);
    const beat = Math.sin(t * 5.2);
    addRot(model, 'head', beat * 0.04, Math.sin(t * 1.9) * 0.055, 0);
    setRot(model, 'armR', -0.32 + beat * 0.07, 0, 0.2);
    setRot(model, 'foreR', -0.8 + beat * 0.1, 0, 0.1);
  }

  // A skid: weight thrown back against the direction of travel.
  function poseSkid(model, t, lean) {
    clearPose(model);
    model.bob = -0.3;
    setRot(model, 'torso', -0.3 * lean, 0, 0);
    setRot(model, 'head', 0.16 * lean, 0, 0);
    setRot(model, 'legR', -0.5 * lean, 0, 0);
    setRot(model, 'legL', 0.28 * lean, 0, 0);
    setRot(model, 'shinR', 0.25, 0, 0);
    setRot(model, 'shinL', 0.55, 0, 0);
    setRot(model, 'armR', -0.7, 0, 0.5);
    setRot(model, 'armL', -0.55, 0, -0.62);
    setRot(model, 'foreR', -0.5, 0, 0);
    setRot(model, 'foreL', -0.45, 0, 0);
  }

  // Recoil from a collision — the body folds around the impact for a moment.
  function poseStagger(model, t, amount) {
    poseIdle(model, t);
    addRot(model, 'torso', -0.35 * amount, 0.12 * amount, 0);
    addRot(model, 'head', 0.25 * amount, 0, 0);
    addRot(model, 'armR', -0.5 * amount, 0, 0.45 * amount);
    addRot(model, 'armL', -0.42 * amount, 0, -0.5 * amount);
    addRot(model, 'foreR', -0.5 * amount, 0, 0);
    addRot(model, 'legR', -0.2 * amount, 0, 0);
  }

  /* ---------- knockdowns ---------- */

  function createFall() {
    return {
      active: false,
      state: 'up',        // up | falling | down | rising
      pitch: 0, roll: 0,  // tip about the feet, in the actor's own frame
      pitchVel: 0, rollVel: 0,
      timer: 0,
      sprawl: null,
      blend: 0
    };
  }

  const FLAT = Math.PI / 2;
  const GRAVITY_TORQUE = 11.0;

  function randomSprawl(rng) {
    const r = function (a) { return (rng() - 0.5) * 2 * a; };
    return {
      armR: [-1.1 + r(0.5), r(0.3), 0.7 + r(0.4)],
      armL: [-0.9 + r(0.5), r(0.3), -0.75 + r(0.4)],
      foreR: [-0.7 + r(0.5), 0, r(0.3)],
      foreL: [-0.6 + r(0.5), 0, r(0.3)],
      legR: [-0.35 + r(0.4), 0, 0.32 + r(0.25)],
      legL: [0.3 + r(0.4), 0, -0.28 + r(0.25)],
      shinR: [0.5 + r(0.4), 0, 0],
      shinL: [0.35 + r(0.4), 0, 0],
      torso: [r(0.2), r(0.3), r(0.15)],
      head: [0.2 + r(0.25), r(0.4), r(0.2)]
    };
  }

  // dirX/dirY is the world-space push direction; force scales the tip impulse.
  function knockDown(actor, dirX, dirY, force) {
    const f = actor.fall;
    const len = Math.hypot(dirX, dirY) || 1;
    const wx = dirX / len, wy = dirY / len;

    // rotate the world push into the actor's own frame
    const cos = Math.cos(actor.yaw), sin = Math.sin(actor.yaw);
    const lx = wx * cos - wy * sin;
    const lz = wx * sin + wy * cos;

    const impulse = Math.max(2.6, Math.min(7.5, force));
    f.active = true;
    f.state = 'falling';
    // pushed forward tips the top forward (+pitch); pushed to +X tips to -roll
    f.pitchVel += lz * impulse;
    f.rollVel += -lx * impulse;
    f.timer = 0;
    f.sprawl = randomSprawl(actor.rng);
    actor.gait = 'idle';
    actor.speaking = false;
    actor.viseme = 'rest';
    return true;
  }

  function updateFall(actor, dt) {
    const f = actor.fall;
    if (!f.active) return;

    if (f.state === 'falling' || f.state === 'down') {
      // gravity keeps pulling it over once it is past upright
      f.pitchVel += Math.sin(f.pitch) * GRAVITY_TORQUE * dt;
      f.rollVel += Math.sin(f.roll) * GRAVITY_TORQUE * dt;
      f.pitch += f.pitchVel * dt;
      f.roll += f.rollVel * dt;

      const total = Math.hypot(f.pitch, f.roll);
      if (total >= FLAT) {
        // hit the ground: clamp flat and bleed off the remaining spin
        const scale = FLAT / total;
        f.pitch *= scale;
        f.roll *= scale;
        f.pitchVel *= -0.22;
        f.rollVel *= -0.22;
        if (Math.hypot(f.pitchVel, f.rollVel) < 0.6) {
          f.pitchVel = 0; f.rollVel = 0;
          if (f.state !== 'down') { f.state = 'down'; f.timer = 0.9 + actor.rng() * 1.1; }
        }
      }
      f.blend = Math.min(1, f.blend + dt * 6);

      if (f.state === 'down') {
        f.timer -= dt;
        if (f.timer <= 0) { f.state = 'rising'; f.timer = 0; }
      }
      return;
    }

    if (f.state === 'rising') {
      // spring back upright over about a second
      f.timer += dt;
      const k = Math.min(1, f.timer / 1.15);
      const ease = k * k * (3 - 2 * k);
      f.pitch *= (1 - ease * 0.35);
      f.roll *= (1 - ease * 0.35);
      f.blend = Math.max(0, 1 - ease);
      if (Math.abs(f.pitch) < 0.04 && Math.abs(f.roll) < 0.04 && k >= 1) {
        f.active = false;
        f.state = 'up';
        f.pitch = 0; f.roll = 0; f.pitchVel = 0; f.rollVel = 0; f.blend = 0;
      }
    }
  }

  function poseFallen(model, actor, t) {
    const f = actor.fall;
    poseIdle(model, t);
    if (!f.sprawl) return;

    if (f.state === 'rising') {
      // push up off the ground: knees under, torso folded forward
      const k = Math.min(1, f.timer / 1.15);
      const crouch = Math.sin(k * Math.PI);
      setRot(model, 'torso', 0.5 * crouch, 0, 0);
      setRot(model, 'head', -0.3 * crouch, 0, 0);
      setRot(model, 'legR', -0.8 * crouch, 0, 0.2 * crouch);
      setRot(model, 'legL', -0.45 * crouch, 0, -0.15 * crouch);
      setRot(model, 'shinR', 1.3 * crouch, 0, 0);
      setRot(model, 'shinL', 0.9 * crouch, 0, 0);
      setRot(model, 'armR', -0.9 * crouch, 0, 0.4 * crouch);
      setRot(model, 'armL', -0.8 * crouch, 0, -0.4 * crouch);
      setRot(model, 'foreR', -0.7 * crouch, 0, 0);
      setRot(model, 'foreL', -0.6 * crouch, 0, 0);
      return;
    }

    const blend = f.blend;
    for (const name in f.sprawl) {
      const v = f.sprawl[name];
      const b = model.bones[name];
      if (!b) continue;
      b.rot[0] += (v[0] - b.rot[0]) * blend;
      b.rot[1] += (v[1] - b.rot[1]) * blend;
      b.rot[2] += (v[2] - b.rot[2]) * blend;
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
      skidLean: 0,
      stagger: 0,
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
    if (actor.stagger > 0) actor.stagger = Math.max(0, actor.stagger - dt * 1.9);
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
    if (actor.fall.active) { poseFallen(model, actor, qTime); return; }
    if (actor.customPose) { applyPose(model, actor.customPose, actor.customBob || 0); return; }
    if (actor.stagger > 0.02) { poseStagger(model, qTime, actor.stagger); return; }
    if (actor.gait === 'skid') { poseSkid(model, qTime, actor.skidLean); return; }
    if (actor.gait === 'walk') poseWalk(model, qTime, false);
    else if (actor.gait === 'run') poseWalk(model, qTime, true);
    else if (actor.speaking) poseTalk(model, qTime);
    else poseIdle(model, qTime);
  }

  /* ---------- drawing ---------- */

  function drawModel(target, model, camera, opts) {
    const yaw = (opts && opts.yaw) || 0;
    const faceParts = opts && opts.faceParts;
    const scale = model.root.scale || 1;

    // yaw, then tip about the feet, then scale, then the vertical bob
    let base = R.rotationY(yaw);
    if (opts && opts.fallPitch) base = R.multiply(base, R.rotationX(opts.fallPitch));
    if (opts && opts.fallRoll) base = R.multiply(base, R.rotationZ(opts.fallRoll));
    base = R.multiply(base, R.scaling(scale));
    base = R.multiply(base, R.translation(0, model.bob || 0, 0));

    (function walk(node, parent) {
      let local = R.translation(node.origin[0], node.origin[1], node.origin[2]);
      if (node.rot[2]) local = R.multiply(local, R.rotationZ(node.rot[2]));
      if (node.rot[1]) local = R.multiply(local, R.rotationY(node.rot[1]));
      if (node.rot[0]) local = R.multiply(local, R.rotationX(node.rot[0]));
      const m = R.multiply(parent, local);

      for (let i = 0; i < node.parts.length; i++) {
        const p = node.parts[i];
        R.drawBox(target, m, p.box, R.ramp(p.colour), camera, p);
      }
      if (faceParts && node.name === 'head') {
        for (let i = 0; i < faceParts.length; i++) {
          const p = faceParts[i];
          R.drawBox(target, m, p.box, R.ramp(p.colour), camera, p);
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

    const key = [
      qTime, qYaw, actor.gait, actor.blink > 0.5 ? 1 : actor.blink > 0 ? 2 : 0,
      actor.viseme, actor.speaking ? 1 : 0, actor.customPose ? 'p' + actor.animTime : '',
      f.active ? f.state + f.pitch.toFixed(2) + f.roll.toFixed(2) : '',
      actor.stagger.toFixed(2), actor.skidLean.toFixed(1)
    ].join('|');
    if (key === actor._key && !(opts && opts.force)) return target;
    actor._key = key;

    R.clearTarget(target);
    poseActor(actor, qTime);
    const face = CM.buildFaceParts(actor.model, {
      blink: actor.blink,
      viseme: actor.viseme,
      gaze: actor.gaze
    });
    drawModel(target, actor.model, camera, {
      yaw: qYaw,
      faceParts: face,
      fallPitch: f.active ? f.pitch : 0,
      fallRoll: f.active ? f.roll : 0
    });
    R.traceOutline(target, (opts && opts.outline) || OUTLINE);
    return target;
  }

  global.Rig = {
    JOINTS, DIRECTIONS, ANIM_FPS, YAW_STEPS,
    quantiseTime, quantiseYaw,
    clearPose, setRot, addRot, poseIdle, poseWalk, poseTalk, poseSkid, poseStagger,
    emptyPose, clonePose, applyPose, lerpPose, samplePoseTrack,
    yawForDirection, snapToEight, directionName, shortestAngle,
    createActor, rebuildActorModel, updateActorMotion, updateBlink,
    createFall, knockDown, updateFall, poseFallen,
    poseActor, drawModel, renderActor, OUTLINE
  };
})(window);
