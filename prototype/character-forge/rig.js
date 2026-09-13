/* rig.js — posing, animation and drawing the bone tree.
 *
 * Built-in cycles (idle, walk, run, talk) write joint rotations every frame.
 * The pose editor writes the same joint rotations by hand, so anything you can
 * animate procedurally you can also key by hand and play back.
 */
(function (global) {
  'use strict';

  const R = global.Render;
  const CM = global.CharacterModel;

  /* Joints exposed to the pose editor, in the order they appear in the panel. */
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

  /* ---------- built-in cycles ---------- */

  // Sign conventions, once, so the cycles below read cleanly:
  //   rot[0] on a limb: positive swings it BACKWARD (-Z), negative forward.
  //   rot[0] on the torso: positive leans forward.
  //   rot[2] on an arm: positive pushes the elbow away from the ribs.

  function poseIdle(model, t, actor) {
    clearPose(model);
    const breath = Math.sin(t * 1.5);
    const sway = Math.sin(t * 0.41);

    model.bob = breath * 0.14;
    setRot(model, 'torso', 0.022 + breath * 0.02, sway * 0.03, 0);
    setRot(model, 'head', -0.03 - breath * 0.022, sway * 0.11, Math.sin(t * 0.29) * 0.03);

    const armSway = Math.sin(t * 1.5 + 0.7) * 0.035;
    setRot(model, 'armR', armSway, 0, 0.07 + breath * 0.015);
    setRot(model, 'armL', armSway, 0, -0.07 - breath * 0.015);
    setRot(model, 'foreR', -0.1 - breath * 0.03, 0, 0);
    setRot(model, 'foreL', -0.1 - breath * 0.03, 0, 0);
  }

  function poseWalk(model, t, actor, run) {
    clearPose(model);
    const swingScale = model.dims.legSwing;
    const rate = run ? 11.5 : 7.4;
    const p = t * rate;
    const swing = (run ? 1.0 : 0.68) * swingScale;
    const armSwing = run ? 0.85 : 0.5;

    model.bob = Math.abs(Math.sin(p)) * (run ? 0.85 : 0.45) - 0.2;

    setRot(model, 'legR', -Math.sin(p) * swing, 0, 0);
    setRot(model, 'legL', Math.sin(p) * swing, 0, 0);
    setRot(model, 'shinR', Math.max(0, Math.sin(p - 0.55)) * (run ? 1.5 : 0.95), 0, 0);
    setRot(model, 'shinL', Math.max(0, Math.sin(p - 0.55 + Math.PI)) * (run ? 1.5 : 0.95), 0, 0);

    setRot(model, 'armR', Math.sin(p) * armSwing, 0, 0.08);
    setRot(model, 'armL', -Math.sin(p) * armSwing, 0, -0.08);
    const elbow = run ? 1.1 : 0.3;
    setRot(model, 'foreR', -elbow - Math.max(0, Math.sin(p)) * 0.3, 0, 0);
    setRot(model, 'foreL', -elbow - Math.max(0, -Math.sin(p)) * 0.3, 0, 0);

    const lean = run ? 0.24 : 0.05;
    setRot(model, 'torso', lean + Math.abs(Math.sin(p)) * 0.02, Math.sin(p) * 0.09, 0);
    setRot(model, 'head', -lean * 0.75, -Math.sin(p) * 0.05, 0);
  }

  function poseTalk(model, t, actor) {
    poseIdle(model, t, actor);
    // a small emphasis nod on the beat, plus one hand lifted while speaking
    const beat = Math.sin(t * 5.2);
    const head = model.bones.head;
    head.rot[0] += beat * 0.045;
    head.rot[1] += Math.sin(t * 1.9) * 0.06;
    setRot(model, 'armR', -0.35 + beat * 0.08, 0, 0.22);
    setRot(model, 'foreR', -0.85 + beat * 0.12, 0, 0.1);
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

  // Samples a keyframe list at time t (seconds), looping.
  function samplePoseTrack(frames, t, duration) {
    if (!frames.length) return emptyPose();
    if (frames.length === 1) return frames[0].pose;
    const wrapped = ((t % duration) + duration) % duration;
    const step = duration / frames.length;
    const i = Math.min(frames.length - 1, Math.floor(wrapped / step));
    const j = (i + 1) % frames.length;
    const local = (wrapped - i * step) / step;
    return lerpPose(frames[i].pose, frames[j].pose, local);
  }

  /* ---------- actors ---------- */

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
    const yaw = Math.atan2(dx, dy);
    const step = Math.PI / 4;
    const snapped = Math.round(yaw / step) * step;
    return snapped;
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

  function createActor(character, x, y, seed) {
    const model = CM.buildModel(character);
    return {
      character: character,
      model: model,
      x: x, y: y,
      yaw: 0,
      targetYaw: 0,
      gait: 'idle',          // idle | walk | run
      animTime: Math.random() * 10,
      rng: CM.makeRng(seed === undefined ? (Math.random() * 0xffffffff) >>> 0 : seed),
      blink: 0,
      blinkTimer: 1 + Math.random() * 4,
      blinkQueue: 0,
      viseme: 'rest',
      gaze: 0,
      speaking: false,
      brain: null
    };
  }

  function rebuildActorModel(actor) {
    actor.model = CM.buildModel(actor.character);
  }

  const TURN_RATE = 9.5; // rad/s — fast enough to feel responsive, slow enough to read

  function updateActorMotion(actor, dt) {
    const diff = shortestAngle(actor.yaw, actor.targetYaw);
    const maxStep = TURN_RATE * dt;
    if (Math.abs(diff) <= maxStep) actor.yaw = actor.targetYaw;
    else actor.yaw += Math.sign(diff) * maxStep;

    actor.animTime += dt;
    updateBlink(actor, dt);
  }

  function updateBlink(actor, dt) {
    if (actor.blink > 0) {
      actor.blinkPhase += dt;
      const d = 0.17;
      const p = actor.blinkPhase / d;
      if (p >= 1) {
        actor.blink = 0;
        if (actor.blinkQueue > 0) {
          actor.blinkQueue--;
          actor.blinkTimer = 0.09;
        } else {
          actor.blinkTimer = 2.0 + actor.rng() * 4.5;
        }
      } else {
        // close fast, open a touch slower
        actor.blink = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
      }
      return;
    }
    actor.blinkTimer -= dt;
    if (actor.blinkTimer <= 0) {
      actor.blink = 0.001;
      actor.blinkPhase = 0;
      // people often blink twice
      actor.blinkQueue = actor.rng() < 0.18 ? 1 : 0;
    }
  }

  function poseActor(actor) {
    const model = actor.model;
    if (actor.customPose) {
      applyPose(model, actor.customPose, actor.customBob || 0);
      return;
    }
    if (actor.gait === 'walk') poseWalk(model, actor.animTime, actor, false);
    else if (actor.gait === 'run') poseWalk(model, actor.animTime, actor, true);
    else if (actor.speaking) poseTalk(model, actor.animTime, actor);
    else poseIdle(model, actor.animTime, actor);
  }

  /* ---------- drawing ---------- */

  function drawModel(target, model, camera, opts) {
    const yaw = (opts && opts.yaw) || 0;
    const faceParts = opts && opts.faceParts;
    const scale = model.root.scale || 1;

    let base = R.multiply(R.rotationY(yaw), R.scaling(scale));
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

  // Renders one actor into its own buffer, outlines it, and returns the buffer
  // so the caller can depth-sort and blit it into the scene.
  function renderActor(actor, target, camera, opts) {
    R.clearTarget(target);
    poseActor(actor);
    const face = CM.buildFaceParts(actor.model, {
      blink: actor.blink,
      viseme: actor.viseme,
      gaze: actor.gaze
    });
    drawModel(target, actor.model, camera, {
      yaw: (opts && opts.yaw !== undefined) ? opts.yaw : actor.yaw,
      faceParts: face
    });
    R.traceOutline(target, (opts && opts.outline) || OUTLINE);
    return target;
  }

  global.Rig = {
    JOINTS, DIRECTIONS,
    clearPose, setRot, poseIdle, poseWalk, poseTalk,
    emptyPose, clonePose, applyPose, lerpPose, samplePoseTrack,
    yawForDirection, snapToEight, directionName, shortestAngle,
    createActor, rebuildActorModel, updateActorMotion, updateBlink,
    poseActor, drawModel, renderActor, OUTLINE
  };
})(window);
