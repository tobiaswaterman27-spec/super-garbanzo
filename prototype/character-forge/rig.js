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
  /* ================= attacking ================= *
   *
   * One pose function per swing shape, all driven by the same clock: `k` runs
   * 0 to 1 across wind-up and follow-through, and the blow lands at `hit`.
   * Keeping the landing fraction explicit means the animation and the damage
   * agree about when contact happens, rather than the damage firing on a timer
   * while the arm is still going back.
   */

  const ATTACKS = {
    // a short straight punch
    jab: {
      hit: 0.45,
      pose: function (model, k, side) {
        const wind = Math.min(1, k / 0.45);
        const punch = k < 0.45 ? 0 : Math.min(1, (k - 0.45) / 0.3);
        const back = k < 0.45 ? 0 : Math.max(0, (k - 0.75) / 0.25);
        const reach = punch - back;
        setRot(model, 'arm' + side, -0.5 * wind - 1.05 * reach, 0, side === 'R' ? 0.2 : -0.2);
        setRot(model, 'fore' + side, -1.6 + 1.45 * reach, 0, 0);
        setRot(model, 'arm' + (side === 'R' ? 'L' : 'R'), -0.35, 0, side === 'R' ? -0.3 : 0.3);
        setRot(model, 'fore' + (side === 'R' ? 'L' : 'R'), -1.5, 0, 0);
        setRot(model, 'torso', 0.06, (side === 'R' ? -0.3 : 0.3) * (wind - reach * 1.6), 0);
      }
    },
    // horizontal cut across the body
    slash: {
      hit: 0.52,
      pose: function (model, k, side) {
        const sgn = side === 'R' ? 1 : -1;
        const wind = Math.min(1, k / 0.52);
        const cut = k < 0.52 ? 0 : Math.min(1, (k - 0.52) / 0.34);
        const sweep = -1.15 * wind + 2.5 * cut;
        setRot(model, 'arm' + side, -0.55 - 0.5 * wind + 0.95 * cut, 0, sgn * (0.95 - sweep * 0.42));
        setRot(model, 'fore' + side, -0.55 - 0.8 * wind + 0.7 * cut, 0, 0);
        setRot(model, 'arm' + (side === 'R' ? 'L' : 'R'), -0.3, 0, -sgn * 0.35);
        setRot(model, 'fore' + (side === 'R' ? 'L' : 'R'), -0.9, 0, 0);
        setRot(model, 'torso', 0.08, sgn * (0.55 * wind - 1.05 * cut), 0);
        setRot(model, 'head', 0, sgn * (-0.2 * wind + 0.4 * cut), 0);
        model.bob = -0.25 * cut;
      }
    },
    // raised overhead and brought straight down
    overhead: {
      hit: 0.58,
      pose: function (model, k, side) {
        const sgn = side === 'R' ? 1 : -1;
        const wind = Math.min(1, k / 0.58);
        const fall = k < 0.58 ? 0 : Math.min(1, (k - 0.58) / 0.3);
        setRot(model, 'arm' + side, -2.5 * wind + 3.3 * fall, 0, sgn * 0.3);
        setRot(model, 'fore' + side, -1.5 * wind + 1.4 * fall, 0, 0);
        setRot(model, 'arm' + (side === 'R' ? 'L' : 'R'), -2.1 * wind + 2.8 * fall, 0, -sgn * 0.28);
        setRot(model, 'fore' + (side === 'R' ? 'L' : 'R'), -1.3 * wind + 1.2 * fall, 0, 0);
        setRot(model, 'torso', -0.22 * wind + 0.58 * fall, 0, 0);
        setRot(model, 'head', 0.18 * wind - 0.3 * fall, 0, 0);
        model.bob = 0.5 * wind - 0.9 * fall;
      }
    },
    // short hard stab
    stab: {
      hit: 0.42,
      pose: function (model, k, side) {
        const sgn = side === 'R' ? 1 : -1;
        const wind = Math.min(1, k / 0.42);
        const drive = k < 0.42 ? 0 : Math.min(1, (k - 0.42) / 0.26);
        const back = Math.max(0, (k - 0.72) / 0.28);
        const reach = drive - back;
        setRot(model, 'arm' + side, 0.5 * wind - 1.6 * reach, 0, sgn * (0.5 - reach * 0.4));
        setRot(model, 'fore' + side, -2.0 * wind + 1.9 * reach, 0, 0);
        setRot(model, 'torso', 0.05, sgn * (0.35 * wind - 0.55 * reach), 0);
        setRot(model, 'arm' + (side === 'R' ? 'L' : 'R'), -0.25, 0, -sgn * 0.3);
        setRot(model, 'fore' + (side === 'R' ? 'L' : 'R'), -1.1, 0, 0);
      }
    },
    // two hands driving a shaft forward
    thrust: {
      hit: 0.46,
      pose: function (model, k, side) {
        const sgn = side === 'R' ? 1 : -1;
        const wind = Math.min(1, k / 0.46);
        const drive = k < 0.46 ? 0 : Math.min(1, (k - 0.46) / 0.3);
        const back = Math.max(0, (k - 0.76) / 0.24);
        const reach = drive - back;
        setRot(model, 'armR', -0.35 + 0.45 * wind - 1.5 * reach, 0, 0.42 - reach * 0.3);
        setRot(model, 'foreR', -1.75 + 1.55 * reach, 0, 0);
        setRot(model, 'armL', -0.35 + 0.45 * wind - 1.5 * reach, 0, -0.42 + reach * 0.3);
        setRot(model, 'foreL', -1.75 + 1.55 * reach, 0, 0);
        setRot(model, 'torso', 0.1, sgn * (0.28 * wind - 0.42 * reach), 0);
        model.bob = -0.4 * reach;
      }
    },
    // nock, draw, loose
    draw: {
      hit: 0.78,
      pose: function (model, k, side) {
        const sgn = side === 'R' ? 1 : -1;
        const pull = Math.min(1, k / 0.78);
        const loose = k < 0.78 ? 0 : Math.min(1, (k - 0.78) / 0.22);
        // bow arm out straight, string hand back past the cheek
        setRot(model, 'arm' + (side === 'R' ? 'L' : 'R'), -1.5, 0, -sgn * 0.12);
        setRot(model, 'fore' + (side === 'R' ? 'L' : 'R'), -0.12, 0, 0);
        setRot(model, 'arm' + side, -1.1 - 0.25 * pull, 0, sgn * (0.5 + 0.35 * pull));
        setRot(model, 'fore' + side, -0.7 - 1.5 * pull + 1.7 * loose, 0, 0);
        setRot(model, 'torso', 0.02, sgn * (0.5 + 0.18 * pull - 0.3 * loose), 0);
        setRot(model, 'head', 0, sgn * (-0.45 - 0.1 * pull), 0);
      }
    },
    // crossbow: already spanned, so it is raise, sight, release
    aim: {
      hit: 0.62,
      pose: function (model, k, side) {
        const sgn = side === 'R' ? 1 : -1;
        const up = Math.min(1, k / 0.62);
        const kick = k < 0.62 ? 0 : Math.min(1, (k - 0.62) / 0.2) * (1 - Math.min(1, (k - 0.72) / 0.28));
        setRot(model, 'arm' + side, -1.35 * up + 0.2 * kick, 0, sgn * 0.3);
        setRot(model, 'fore' + side, -0.55 * up - 0.25 * kick, 0, 0);
        setRot(model, 'arm' + (side === 'R' ? 'L' : 'R'), -1.2 * up, 0, -sgn * 0.5);
        setRot(model, 'fore' + (side === 'R' ? 'L' : 'R'), -0.85 * up, 0, 0);
        setRot(model, 'torso', 0.03, sgn * 0.42 * up, 0);
        setRot(model, 'head', 0, sgn * -0.35 * up, 0);
      }
    },
    // a big two-handed swing, for clubs and the like
    swing: {
      hit: 0.5,
      pose: function (model, k, side) {
        const sgn = side === 'R' ? 1 : -1;
        const wind = Math.min(1, k / 0.5);
        const cut = k < 0.5 ? 0 : Math.min(1, (k - 0.5) / 0.35);
        setRot(model, 'arm' + side, -1.9 * wind + 2.5 * cut, 0, sgn * (0.7 - cut * 0.5));
        setRot(model, 'fore' + side, -1.2 * wind + 1.0 * cut, 0, 0);
        setRot(model, 'arm' + (side === 'R' ? 'L' : 'R'), -0.3, 0, -sgn * 0.3);
        setRot(model, 'fore' + (side === 'R' ? 'L' : 'R'), -1.0, 0, 0);
        setRot(model, 'torso', 0.05, sgn * (0.42 * wind - 0.8 * cut), 0);
        model.bob = -0.3 * cut;
      }
    }
  };

  /* Where the blow lands, as a fraction through the animation. */
  function attackHitFraction(anim) {
    const a = ATTACKS[anim] || ATTACKS.slash;
    return a.hit;
  }

  function poseAttack(model, anim, k, side, gait, t) {
    clearPose(model);
    // feet keep doing whatever the legs were doing; you can swing while walking
    if (gait === 'walk' || gait === 'run') {
      const swingScale = model.dims.legSwing;
      const rate = gait === 'run' ? 12.4 : 7.6;
      const pp = t * rate;
      const amount = (gait === 'run' ? 1.05 : 0.66) * swingScale;
      setRot(model, 'legR', -Math.sin(pp) * amount, 0, 0);
      setRot(model, 'legL', Math.sin(pp) * amount, 0, 0);
      setRot(model, 'shinR', Math.max(0, Math.sin(pp - 0.55)) * 0.92, 0, 0);
      setRot(model, 'shinL', Math.max(0, Math.sin(pp - 0.55 + Math.PI)) * 0.92, 0, 0);
    } else {
      // braced: front foot forward, weight through it
      setRot(model, 'leg' + side, -0.22, 0, 0);
      setRot(model, 'leg' + (side === 'R' ? 'L' : 'R'), 0.26, 0, 0);
      setRot(model, 'shin' + (side === 'R' ? 'L' : 'R'), 0.2, 0, 0);
    }
    const a = ATTACKS[anim] || ATTACKS.slash;
    a.pose(model, Math.max(0, Math.min(1, k)), side);
  }

  /* Both hands up over the head, the thing every frightened person does. */
  function poseGuard(model, k, side) {
    clearPose(model);
    const g = Math.max(0, Math.min(1, k));
    setRot(model, 'armR', -1.55 * g, 0, 0.55 * g);
    setRot(model, 'armL', -1.55 * g, 0, -0.55 * g);
    setRot(model, 'foreR', -1.5 * g, 0, 0);
    setRot(model, 'foreL', -1.5 * g, 0, 0);
    setRot(model, 'torso', 0.16 * g, 0, 0);
    setRot(model, 'head', 0.2 * g, 0, 0);
    void side;
  }

  /* Clutching a wound. `zone` says where the hand goes, which is what makes
   * it read as pain in a place rather than a generic hurt animation. */
  function poseClutch(model, k, zone, side) {
    clearPose(model);
    const g = Math.max(0, Math.min(1, k));
    const sgn = side === 'R' ? 1 : -1;
    if (zone === 'head') {
      setRot(model, 'arm' + side, -1.95 * g, 0, sgn * 0.35 * g);
      setRot(model, 'fore' + side, -1.75 * g, 0, 0);
      setRot(model, 'head', 0.3 * g, 0, 0);
    } else if (zone === 'leg') {
      setRot(model, 'arm' + side, -0.95 * g, 0, sgn * 0.5 * g);
      setRot(model, 'fore' + side, -0.6 * g, 0, 0);
      setRot(model, 'torso', 0.65 * g, 0, 0);
      setRot(model, 'leg' + side, -0.3 * g, 0, 0);
    } else {
      // chest, gut or arm: hand across the body onto the wound
      setRot(model, 'arm' + side, -1.05 * g, 0, sgn * 0.75 * g);
      setRot(model, 'fore' + side, -1.85 * g, 0, 0);
      setRot(model, 'torso', 0.34 * g, sgn * -0.2 * g, 0);
      setRot(model, 'head', 0.22 * g, 0, 0);
    }
    setRot(model, 'arm' + (side === 'R' ? 'L' : 'R'), -0.3 * g, 0, -sgn * 0.25 * g);
    setRot(model, 'fore' + (side === 'R' ? 'L' : 'R'), -0.8 * g, 0, 0);
    model.bob = -0.55 * g;
  }

  /* Taking a hit and staying on your feet: driven backwards, arms thrown up,
   * head turned away. A punch should not put anyone on the floor — it should
   * put them on their back foot. */
  function poseStagger(model, k, dirSide) {
    clearPose(model);
    const g = Math.max(0, Math.min(1, k));
    const lurch = Math.sin(g * Math.PI);
    const side = dirSide || 0;
    setRot(model, 'torso', -0.42 * lurch, side * 0.3 * lurch, side * 0.18 * lurch);
    setRot(model, 'head', -0.3 * lurch, side * 0.4 * lurch, 0);
    // arms fly up and out, which is what people actually do
    setRot(model, 'armR', -1.45 * lurch, 0, 0.85 * lurch);
    setRot(model, 'armL', -1.35 * lurch, 0, -0.95 * lurch);
    setRot(model, 'foreR', -1.1 * lurch, 0, 0);
    setRot(model, 'foreL', -1.25 * lurch, 0, 0);
    // back foot goes out to catch the weight
    setRot(model, 'legR', 0.55 * lurch, 0, 0.12 * lurch);
    setRot(model, 'legL', -0.35 * lurch, 0, -0.1 * lurch);
    setRot(model, 'shinR', 0.5 * lurch, 0, 0);
    setRot(model, 'shinL', 0.2 * lurch, 0, 0);
    model.bob = -1.1 * lurch;
  }

  /* Reaching across to draw from the belt, or putting something away. */
  function poseSheathe(model, k, side, putting) {
    clearPose(model);
    const g = Math.max(0, Math.min(1, k));
    const reach = Math.sin(g * Math.PI);
    const sgn = side === 'R' ? 1 : -1;
    setRot(model, 'arm' + side, -0.15 - 0.55 * reach, 0, sgn * (0.2 + 0.7 * reach));
    setRot(model, 'fore' + side, -0.4 - 1.5 * reach, 0, 0);
    setRot(model, 'torso', 0.12 * reach, sgn * -0.28 * reach, 0);
    setRot(model, 'head', 0.16 * reach, sgn * -0.3 * reach, 0);
    void putting;
  }

  /* Nocking an arrow, or laying a bolt in the groove. */
  function poseNock(model, k, side) {
    clearPose(model);
    const g = Math.max(0, Math.min(1, k));
    const sgn = side === 'R' ? 1 : -1;
    // reach to the quiver at the hip, bring it up to the string
    const grab = Math.min(1, g / 0.45);
    const lift = Math.max(0, (g - 0.45) / 0.55);
    setRot(model, 'arm' + (side === 'R' ? 'L' : 'R'), -1.3 * lift - 0.2, 0, -sgn * 0.14);
    setRot(model, 'fore' + (side === 'R' ? 'L' : 'R'), -0.2, 0, 0);
    setRot(model, 'arm' + side, 0.5 * grab - 1.6 * lift, 0, sgn * (0.55 - 0.15 * lift));
    setRot(model, 'fore' + side, -0.5 - 1.4 * grab + 0.9 * lift, 0, 0);
    setRot(model, 'torso', 0.16 * grab - 0.08 * lift, sgn * 0.3 * lift, 0);
    setRot(model, 'head', 0.1 * grab, sgn * -0.2 * lift, 0);
  }

  /* A shield up, and a weapon held ready rather than hanging. */
  function poseReady(model, side, shield) {
    const sgn = side === 'R' ? 1 : -1;
    setRot(model, 'arm' + side, -0.55, 0, sgn * 0.42);
    setRot(model, 'fore' + side, -1.15, 0, 0);
    if (shield) {
      setRot(model, 'arm' + (side === 'R' ? 'L' : 'R'), -1.0, 0, -sgn * 0.15);
      setRot(model, 'fore' + (side === 'R' ? 'L' : 'R'), -1.35, 0, 0);
    }
    setRot(model, 'torso', 0.05, sgn * 0.22, 0);
  }

  /* In the saddle. The thighs come forward and open around the barrel, the
   * knees fold back under, and the hands stay out in front on the reins. The
   * rider rises with the gait rather than sitting rigid, because a figure
   * bolted to a moving horse is the thing that makes riding look wrong. */
  function poseRide(model, t, opts) {
    clearPose(model);
    const o = opts || {};
    const gait = o.gait || 'idle';
    const rate = gait === 'gallop' ? 9.2 : gait === 'trot' ? 7.2 : gait === 'walk' ? 4.4 : 0;
    const amp = gait === 'gallop' ? 0.85 : gait === 'trot' ? 0.55 : gait === 'walk' ? 0.2 : 0;
    const p = t * rate;
    const rise = rate ? Math.abs(Math.sin(p)) : 0;
    const lean = (o.lean || 0) + (gait === 'gallop' ? 0.42 : gait === 'trot' ? 0.2 : 0.06);
    const rein = o.rein || 0;

    model.bob = rise * amp - amp * 0.4;

    // legs astride
    setRot(model, 'legR', -0.92, 0, -0.36);
    setRot(model, 'legL', -0.92, 0, 0.36);
    setRot(model, 'shinR', 1.28 + rise * 0.08, 0, 0.1);
    setRot(model, 'shinL', 1.28 + rise * 0.08, 0, -0.1);

    // hands forward on the reins, pulled back when the rider hauls on them
    const reach = -1.02 + rein * 0.55;
    setRot(model, 'armR', reach, 0, 0.16);
    setRot(model, 'armL', reach, 0, -0.16);
    setRot(model, 'foreR', -0.62 - rein * 0.5, 0, 0);
    setRot(model, 'foreL', -0.62 - rein * 0.5, 0, 0);

    setRot(model, 'torso', lean - rise * 0.06, (o.turn || 0) * 0.12, 0);
    setRot(model, 'head', -lean * 0.75, -(o.turn || 0) * 0.2, 0);
  }

  /* Swinging up into the saddle: k runs 0 to 1. The rider reaches for the
   * pommel, kicks the outside leg over, and lands astride. */
  function poseMount(model, k) {
    clearPose(model);
    const e = k < 0.5 ? (k / 0.5) : 1;
    const land = k < 0.5 ? 0 : (k - 0.5) / 0.5;
    model.bob = Math.sin(Math.min(1, k) * Math.PI) * 2.6;
    setRot(model, 'armR', -1.9 + land * 0.9, 0, 0.3);
    setRot(model, 'armL', -1.6 + land * 0.6, 0, -0.3);
    setRot(model, 'foreR', -0.5, 0, 0);
    setRot(model, 'foreL', -0.7, 0, 0);
    // the outside leg swings up and over, the inside one takes the weight
    setRot(model, 'legR', -0.4 - e * 0.6, 0, -e * 1.1 + land * 0.75);
    setRot(model, 'legL', -0.2 - e * 0.55, 0, e * 0.25 + land * 0.1);
    setRot(model, 'shinR', 0.5 + land * 0.8, 0, 0);
    setRot(model, 'shinL', 0.9 + land * 0.4, 0, 0);
    setRot(model, 'torso', 0.34 - land * 0.1, 0, -0.18 + land * 0.18);
  }

  /* Sitting on a cart's bench, reins in hand. Knees together and forward,
   * back straighter than in the saddle. */
  function poseDrive(model, t, opts) {
    clearPose(model);
    const o = opts || {};
    const jolt = o.jolt || 0;
    const rein = o.rein || 0;
    model.bob = jolt;
    setRot(model, 'legR', -1.32, 0, -0.12);
    setRot(model, 'legL', -1.32, 0, 0.12);
    setRot(model, 'shinR', 1.42, 0, 0);
    setRot(model, 'shinL', 1.42, 0, 0);
    const reach = -0.88 + rein * 0.6;
    setRot(model, 'armR', reach, 0, 0.2);
    setRot(model, 'armL', reach, 0, -0.2);
    setRot(model, 'foreR', -0.7 - rein * 0.45, 0, 0);
    setRot(model, 'foreL', -0.7 - rein * 0.45, 0, 0);
    setRot(model, 'torso', 0.1 + jolt * 0.05, (o.turn || 0) * 0.1, 0);
    setRot(model, 'head', -0.06, -(o.turn || 0) * 0.18, 0);
  }

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
  function jointPositions(model, yaw, tiltPitch, tiltRoll) {
    const d = model.dims;
    let base = R.rotationY(yaw);
    // Tilt about the feet. Getting up needs targets for a body that is still
    // lying down, not for one that is already standing.
    if (tiltPitch) base = R.multiply(base, R.rotationX(tiltPitch));
    if (tiltRoll) base = R.multiply(base, R.rotationZ(tiltRoll));

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
      p: null, links: null, timer: 0, still: 0, rise: 0, settle: 0
    };
  }

  /* How hard each joint is dragged back toward where the animation says it
   * should be. The feet and hips are held firmly so a soft hit cannot topple
   * anyone; the further up the body, the more freely it swings. */
  /* A jostle is an arms-only reaction. Everything from the shoulders inward is
   * held exactly on the animated pose, so a knock never moves a character's
   * legs or neck — only a fall or a stumble does that. Letting the torso join
   * in is what kept reading as a flail. */
  const SOFT_PULL = {
    footR: 1, footL: 1, hipR: 1, hipL: 1, pelvis: 1,
    kneeR: 1, kneeL: 1,
    chest: 1, neck: 1, headTop: 1,
    shoulderR: 0.85, shoulderL: 0.85,
    elbowR: 0.26, elbowL: 0.26, handR: 0.19, handL: 0.19
  };
  const SOFT_TIME = 0.5;

  // How close every joint has to be to the animated pose before control is
  // handed back. Switching on a timer instead leaves the body wherever the
  // physics happened to put it and the model jumps — that is the teleport.
  const SETTLE_EPSILON = 0.22;

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
    frame({ torso: [0.62, 0, 0], head: [-0.4, 0, 0],
      armR: [1.0, 0, 0.55], armL: [1.0, 0, -0.55], foreR: [-1.5, 0, 0], foreL: [-1.5, 0, 0],
      legR: [-1.15, 0, 0.3], legL: [-1.0, 0, -0.3], shinR: [1.8, 0, 0], shinL: [1.7, 0, 0] });
    frame({ torso: [0.72, 0, 0], head: [-0.42, 0, 0],
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
  const RISE_TIME = 1.5;

  function distanceBetween(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }

  // dirX/dirY is the world push direction (world y is depth, which is local z).
  function applyImpulse(actor, dirX, dirY, force, mode, opts) {
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
    const full = mode === 'full';
    const cap = full ? 9.0 : 5.0;
    const impulse = Math.max(0.6, Math.min(cap, force)) * SUBSTEP * (full ? 7.5 : 1.9);
    // Arms go up. A body that falls with its arms at its sides reads as a
    // dropped plank, so the hands and elbows get a good deal more of the
    // impulse than the trunk does, thrown up and out.
    const FLAIL = { handR: 3.2, handL: 3.2, elbowR: 2.1, elbowL: 2.1, headTop: 1.4 };

    let tallest = 1;
    for (let i = 0; i < JOINT_NAMES.length; i++) {
      const k = JOINT_NAMES[i];
      if (joints[k] && joints[k][1] > tallest) tallest = joints[k][1];
    }

    // Where the hit landed, in the actor's own frame: out on the side the
    // push came from, at whatever height the caller says it struck. Given
    // one, the impulse falls off with distance from that point, so bumping
    // someone's shoulder moves their shoulder rather than all of them.
    // jointPositions() already applies the actor's yaw, so particle space is
    // world-aligned and the push direction needs no further rotation.
    const contactY = opts && opts.contactY;
    const localised = typeof contactY === 'number';
    const cx = -px * 4.2, cy = contactY, cz = -pz * 4.2;
    const SIGMA2 = 2 * 7 * 7;

    for (let i = 0; i < JOINT_NAMES.length; i++) {
      const k = JOINT_NAMES[i];
      const j = joints[k];
      if (!j) continue;
      if (!reuse) {
        p[k] = { x: j[0], y: j[1], z: j[2], px: j[0], py: j[1], pz: j[2],
          r: PARTICLE_RADIUS[k] || 1.2 };
      }
      const q = p[k];
      let weight;
      if (localised) {
        const dx = q.x - cx, dy = q.y - cy, dz = q.z - cz;
        weight = 2.6 * Math.exp(-(dx * dx + dy * dy + dz * dz) / SIGMA2);
      } else {
        // whole-body shove: scales with height, so it topples rather than slides
        weight = 0.25 + 1.5 * (q.y / tallest);
      }
      q.px -= px * impulse * weight;
      q.pz -= pz * impulse * weight;
      q.py -= impulse * 0.16 * weight;
      const fl = FLAIL[k];
      if (fl && full) {
        const spin = (i % 2 ? 1 : -1) * impulse * fl;
        q.px -= pz * spin * 0.5;
        q.pz += px * spin * 0.5;
        q.py -= impulse * fl * 0.55;
      }
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
      f.body = bodyVolumes(actor.model.dims);
    }

    f.active = true;
    f.mode = mode;
    f.state = full ? 'falling' : 'jostled';
    f.timer = full ? 0 : SOFT_TIME;
    f.still = 0;
    f.rise = 0;
    f.settle = 0;
    f.riseReady = false;
    actor.gait = 'idle';
    actor.speaking = false;
    actor.viseme = 'rest';
    return true;
  }

  // Jostled but still on their feet: the body reacts, nobody goes down.
  // `contactY` localises the reaction to the height the hit landed at.
  function nudge(actor, dirX, dirY, force, contactY) {
    if (actor.fall.active && actor.fall.mode === 'full') return false;
    return applyImpulse(actor, dirX, dirY, force, 'soft',
      contactY === undefined ? null : { contactY: contactY });
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
      separateLimbs(f);
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

  /* ------------------------------------------------------------------ *
   * Solid-body separation.
   *
   * The distance constraints alone are perfectly happy to let an arm swing
   * straight through the chest or the two legs scissor through each other,
   * because nothing in the solver knows the body has any volume. Since every
   * bone is drawn as a box spanning two particles, a segment that crosses the
   * torso is a limb visibly inside the body.
   *
   * So each frame we treat the body as solids and push overlapping parts
   * apart: an elliptical torso column (wide, shallow — a person is not a
   * cylinder), a head sphere, and the limbs as capsules against each other.
   * ------------------------------------------------------------------ */

  function bodyVolumes(d) {
    return {
      // Padded just under where an arm hangs at rest, so a limb lying along
      // the body touches the surface instead of being held off it — any more
      // and the solver splays the arms permanently.
      torsoX: d.torsoW / 2 + d.armW * 0.30,
      torsoZ: d.torsoD / 2 + d.armW * 0.30,
      headR: d.headW * 0.5 + d.armW * 0.2,
      armR: d.armW * 0.5,
      legR: d.legW * 0.5
    };
  }

  const DEFAULT_BODY = { torsoX: 4.6, torsoZ: 3.1, headR: 4.9, armR: 1.5, legR: 1.75 };

  // Limb segments tested against the torso and head, with which end is
  // anchored to the body itself (that end never moves — it *is* the torso).
  const LIMB_SEGMENTS = [
    { a: 'shoulderR', b: 'elbowR', rootA: true, vsHead: false },
    { a: 'elbowR', b: 'handR', rootA: false, vsHead: true },
    { a: 'shoulderL', b: 'elbowL', rootA: true, vsHead: false },
    { a: 'elbowL', b: 'handL', rootA: false, vsHead: true },
    { a: 'hipR', b: 'kneeR', rootA: true, vsHead: false },
    { a: 'kneeR', b: 'footR', rootA: false, vsHead: true },
    { a: 'hipL', b: 'kneeL', rootA: true, vsHead: false },
    { a: 'kneeL', b: 'footL', rootA: false, vsHead: true }
  ];

  // Limb pairs that must not pass through one another. Same-side arm/leg is
  // included: an arm sweeping through its own thigh reads just as wrong as
  // the legs crossing.
  const LIMB_PAIRS = [
    ['armR', 'armL'], ['armR', 'foreL'], ['foreR', 'armL'], ['foreR', 'foreL'],
    ['legR', 'legL'], ['legR', 'shinL'], ['shinR', 'legL'], ['shinR', 'shinL'],
    ['foreR', 'legR'], ['foreR', 'legL'], ['foreL', 'legL'], ['foreL', 'legR'],
    ['foreR', 'shinR'], ['foreL', 'shinL']
  ];

  const LIMB_BONES = {
    armR: ['shoulderR', 'elbowR', 'armR'], foreR: ['elbowR', 'handR', 'armR'],
    armL: ['shoulderL', 'elbowL', 'armR'], foreL: ['elbowL', 'handL', 'armR'],
    legR: ['hipR', 'kneeR', 'legR'], shinR: ['kneeR', 'footR', 'legR'],
    legL: ['hipL', 'kneeL', 'legR'], shinL: ['kneeL', 'footL', 'legR']
  };

  // Scratch frame, reused every iteration — this runs 8 times per substep.
  const _fr = {
    ox: 0, oy: 0, oz: 0, len: 1,
    ux: 0, uy: 1, uz: 0, lx: 1, ly: 0, lz: 0, fx: 0, fy: 0, fz: 1
  };

  /* Builds the torso's own axes: up along pelvis->neck, lateral across the
   * shoulders, forward as the cross product. Without a real frame the torso
   * can only be a round column, and a round column either lets arms through
   * at the front or holds them out at the sides. */
  function torsoFrame(p) {
    const a = p.pelvis, b = p.neck || p.chest;
    if (!a || !b) return null;
    let ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    const ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-5) return null;
    ux /= ul; uy /= ul; uz /= ul;

    let lx, ly, lz;
    const sr = p.shoulderR, sl = p.shoulderL;
    if (sr && sl) { lx = sr.x - sl.x; ly = sr.y - sl.y; lz = sr.z - sl.z; }
    else { lx = 1; ly = 0; lz = 0; }
    const dot = lx * ux + ly * uy + lz * uz;
    lx -= ux * dot; ly -= uy * dot; lz -= uz * dot;
    let ll = Math.hypot(lx, ly, lz);
    if (ll < 1e-4) {
      // shoulders collapsed onto the spine: any perpendicular will do
      lx = Math.abs(ux) < 0.9 ? 1 : 0; ly = 0; lz = Math.abs(ux) < 0.9 ? 0 : 1;
      const d2 = lx * ux + ly * uy + lz * uz;
      lx -= ux * d2; ly -= uy * d2; lz -= uz * d2;
      ll = Math.hypot(lx, ly, lz) || 1;
    }
    lx /= ll; ly /= ll; lz /= ll;

    _fr.ox = a.x; _fr.oy = a.y; _fr.oz = a.z;
    _fr.len = ul;
    _fr.ux = ux; _fr.uy = uy; _fr.uz = uz;
    _fr.lx = lx; _fr.ly = ly; _fr.lz = lz;
    _fr.fx = uy * lz - uz * ly;
    _fr.fy = uz * lx - ux * lz;
    _fr.fz = ux * ly - uy * lx;
    return _fr;
  }

  // Push accumulator: a sample point can be pushed by torso and head in the
  // same pass, and both ends of a segment share what their samples ask for.
  const _push = { x: 0, y: 0, z: 0, hit: false };

  /* How far this point has to move to sit outside the torso column. */
  function torsoEscape(fr, body, x, y, z) {
    const dx = x - fr.ox, dy = y - fr.oy, dz = z - fr.oz;
    const s = dx * fr.ux + dy * fr.uy + dz * fr.uz;
    // The column starts above the hip block, not at the pelvis: the thighs
    // are *rooted* inside the pelvis, so testing them against it has the
    // solver fighting the skeleton's own geometry forever.
    if (s < fr.len * 0.3 || s > fr.len + 0.4) return false;
    const u = dx * fr.lx + dy * fr.ly + dz * fr.lz;
    const v = dx * fr.fx + dy * fr.fy + dz * fr.fz;
    const nu = u / body.torsoX, nv = v / body.torsoZ;
    const m = Math.hypot(nu, nv);
    if (m >= 1) return false;
    // scale out to the ellipse surface along the ray through the axis
    const k = m < 1e-4 ? 1 : 1 / m;
    const tu = u * k, tv = v * k;
    const eu = tu - u, ev = tv - v;
    _push.x = fr.lx * eu + fr.fx * ev;
    _push.y = fr.ly * eu + fr.fy * ev;
    _push.z = fr.lz * eu + fr.fz * ev;
    return true;
  }

  function headEscape(p, body, x, y, z) {
    const h = p.headTop, n = p.neck;
    if (!h || !n) return false;
    // the skull sits between the neck and the crown particle
    const cx = (h.x + n.x) * 0.5, cy = (h.y + n.y) * 0.5, cz = (h.z + n.z) * 0.5;
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const d = Math.hypot(dx, dy, dz);
    if (d >= body.headR) return false;
    const k = d < 1e-4 ? 0 : (body.headR - d) / d;
    if (d < 1e-4) { _push.x = 0; _push.y = body.headR; _push.z = 0; return true; }
    _push.x = dx * k; _push.y = dy * k; _push.z = dz * k;
    return true;
  }

  const SAMPLES = [0.25, 0.55, 0.8, 1.0];

  /* Samples each limb segment along its length rather than only at the
   * joints. Testing endpoints alone is what let a forearm lie across the
   * chest with both the elbow and the hand clear of it. */
  function separateLimbs(f) {
    const p = f.p;
    const body = f.body || DEFAULT_BODY;
    const fr = torsoFrame(p);

    for (let i = 0; i < LIMB_SEGMENTS.length; i++) {
      const seg = LIMB_SEGMENTS[i];
      const a = p[seg.a], b = p[seg.b];
      if (!a || !b) continue;
      let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0, any = false;

      for (let j = 0; j < SAMPLES.length; j++) {
        const t = SAMPLES[j];
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const z = a.z + (b.z - a.z) * t;
        let ex = 0, ey = 0, ez = 0, hit = false;
        if (fr && torsoEscape(fr, body, x, y, z)) {
          ex += _push.x; ey += _push.y; ez += _push.z; hit = true;
        }
        if (seg.vsHead && headEscape(p, body, x, y, z)) {
          ex += _push.x; ey += _push.y; ez += _push.z; hit = true;
        }
        if (!hit) continue;
        any = true;
        // Share the correction between the ends by how close the sample is to
        // each. A root end is welded to the torso, so it only takes a token
        // share — but not none: you cannot get a thigh out of your own chest
        // without your hips moving, and pushing only the knee leaves the
        // middle of the limb buried.
        const wa = seg.rootA ? (1 - t) * 0.3 : (1 - t);
        const wb = seg.rootA ? 1 : t;
        const sum = wa + wb || 1;
        ax += ex * wa / sum; ay += ey * wa / sum; az += ez * wa / sum;
        bx += ex * wb / sum; by += ey * wb / sum; bz += ez * wb / sum;
      }

      if (!any) continue;
      const n = SAMPLES.length;
      if (!seg.rootA) { a.x += ax / n; a.y += ay / n; a.z += az / n; }
      b.x += bx / n; b.y += by / n; b.z += bz / n;
    }

    separateLimbPairs(p, body);
  }

  // Closest points between two segments, then push them apart along that line.
  function separateLimbPairs(p, body) {
    for (let i = 0; i < LIMB_PAIRS.length; i++) {
      const A = LIMB_BONES[LIMB_PAIRS[i][0]], B = LIMB_BONES[LIMB_PAIRS[i][1]];
      const a0 = p[A[0]], a1 = p[A[1]], b0 = p[B[0]], b1 = p[B[1]];
      if (!a0 || !a1 || !b0 || !b1) continue;
      const want = body[A[2]] + body[B[2]];

      const ux = a1.x - a0.x, uy = a1.y - a0.y, uz = a1.z - a0.z;
      const vx = b1.x - b0.x, vy = b1.y - b0.y, vz = b1.z - b0.z;
      const wx = a0.x - b0.x, wy = a0.y - b0.y, wz = a0.z - b0.z;
      const uu = ux * ux + uy * uy + uz * uz;
      const uv = ux * vx + uy * vy + uz * vz;
      const vv = vx * vx + vy * vy + vz * vz;
      const uw = ux * wx + uy * wy + uz * wz;
      const vw = vx * wx + vy * wy + vz * wz;
      const den = uu * vv - uv * uv;
      let s, t;
      if (den < 1e-8) { s = 0; t = vv < 1e-8 ? 0 : vw / vv; }
      else { s = (uv * vw - vv * uw) / den; t = (uu * vw - uv * uw) / den; }
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      t = t < 0 ? 0 : t > 1 ? 1 : t;

      const cax = a0.x + ux * s, cay = a0.y + uy * s, caz = a0.z + uz * s;
      const cbx = b0.x + vx * t, cby = b0.y + vy * t, cbz = b0.z + vz * t;
      let dx = cax - cbx, dy = cay - cby, dz = caz - cbz;
      let d = Math.hypot(dx, dy, dz);
      if (d >= want) continue;
      if (d < 1e-4) { dx = 1; dy = 0; dz = 0; d = 1; }
      // half each, softened — limbs are flesh, they can graze
      const k = (want - d) / d * 0.5 * 0.6;
      const px = dx * k, py = dy * k, pz = dz * k;
      a0.x += px * (1 - s); a0.y += py * (1 - s); a0.z += pz * (1 - s);
      a1.x += px * s; a1.y += py * s; a1.z += pz * s;
      b0.x -= px * (1 - t); b0.y -= py * (1 - t); b0.z -= pz * (1 - t);
      b1.x -= px * t; b1.y -= py * t; b1.z -= pz * t;
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
  function pullToward(f, target, strength, perJoint, damp) {
    for (const key in f.p) {
      const q = f.p[key];
      const t = target[key];
      if (!t) continue;
      // A weight of 1 in an explicit table means pinned: put the joint exactly
      // on the pose and stop it dead. Only ever from a table — treating a
      // missing table as "pin everything" turned the get-up and the settle
      // into instant snaps, which is what made characters teleport upright.
      const weight = perJoint
        ? (perJoint[key] === undefined ? 0.3 : perJoint[key])
        : 1;

      if (perJoint && weight >= 1) {
        q.x = t[0]; q.y = t[1]; q.z = t[2];
        q.px = t[0]; q.py = t[1]; q.pz = t[2];
        continue;
      }

      const k = Math.min(1, strength * weight);
      const dx = (t[0] - q.x) * k, dy = (t[1] - q.y) * k, dz = (t[2] - q.z) * k;
      q.x += dx; q.y += dy; q.z += dz;
      // Moving the previous position by the same amount makes this a pure
      // correction, leaving the body's momentum — and so its wobble — intact.
      q.px += dx; q.py += dy; q.pz += dz;
      if (damp) {
        q.px += (q.x - q.px) * damp;
        q.py += (q.y - q.py) * damp;
        q.pz += (q.z - q.pz) * damp;
      }
    }
  }

  // Blends the last of the way back onto the animated pose with gravity out of
  // the picture and the motion damped, so it always converges. Returns true
  // once every joint has arrived.
  function settleOntoPose(f, target, dt) {
    pullToward(f, target, Math.min(1, dt * 16), null, 0.45);
    separateLimbs(f);
    return worstError(f, target) < SETTLE_EPSILON;
  }

  function standingTarget(actor) {
    poseActor(actor, quantiseTime(actor.animTime));
    return jointPositions(actor.model, actor.yaw);
  }

  // Furthest any joint currently sits from where the animation wants it.
  function worstError(f, target) {
    let worst = 0;
    for (const key in f.p) {
      const q = f.p[key], t = target[key];
      if (!t) continue;
      const d = Math.hypot(t[0] - q.x, t[1] - q.y, t[2] - q.z);
      if (d > worst) worst = d;
    }
    return worst;
  }

  function updateFall(actor, dt) {
    const f = actor.fall;
    if (!f.active || !f.p) return;

    /* ---- jostled: the arms swing, nothing else moves ---- */
    if (f.mode !== 'full') {
      const target = standingTarget(actor);

      if (f.timer > 0) {
        let acc = Math.min(dt, 0.05);
        while (acc > 0) {
          const step = Math.min(SUBSTEP, acc);
          simulate(f, step, 0.25);
          acc -= step;
        }
        pullToward(f, target, Math.min(1, dt * 16), SOFT_PULL);
        separateLimbs(f);
        f.timer -= dt;
        return;
      }

      f.settle = (f.settle || 0) + dt;
      if (settleOntoPose(f, target, dt) || f.settle > 1.5) {
        f.active = false;
        f.state = 'up';
        f.settle = 0;
        f.p = null;
      }
      return;
    }

    /* ---- getting back up, under its own power ---- */
    if (f.state === 'rising') {
      if (!f.riseReady) {
        // Read which way the body is actually lying, so the get-up starts from
        // there. Pulling a prone body toward an upright pose is the teleport:
        // the very first target is already standing.
        const pel = f.p.pelvis, ch = f.p.chest;
        let ux = ch.x - pel.x, uy = ch.y - pel.y, uz = ch.z - pel.z;
        const L = Math.hypot(ux, uy, uz) || 1;
        ux /= L; uy /= L; uz /= L;
        const cy = Math.cos(actor.yaw), sy = Math.sin(actor.yaw);
        const side = ux * cy - uz * sy;
        const fwd = ux * sy + uz * cy;
        f.riseRoll = Math.asin(Math.max(-1, Math.min(1, -side)));
        f.risePitch = Math.atan2(fwd, uy);
        // Never tilt past flat. Someone who landed chest-down has their chest
        // below their pelvis, which reads as a tilt beyond ninety degrees, and
        // the get-up target then points the whole body into the ground.
        const lean = Math.hypot(f.risePitch, f.riseRoll);
        if (lean > Math.PI / 2) {
          const s = (Math.PI / 2) / lean;
          f.risePitch *= s;
          f.riseRoll *= s;
        }
        f.riseReady = true;
      }

      f.rise += dt / RISE_TIME;
      const k = Math.min(1, f.rise);
      const ease = k * k * (3 - 2 * k);

      let acc = Math.min(dt, 0.05);
      while (acc > 0) {
        const step = Math.min(SUBSTEP, acc);
        simulate(f, step, 0.55);
        acc -= step;
      }

      // walk the get-up keyframes, with the whole body righting itself from
      // however it landed toward vertical as the sequence plays
      const seg = k * (GETUP_KEYS.length - 1);
      const i = Math.min(GETUP_KEYS.length - 2, Math.floor(seg));
      const pose = lerpPose(GETUP_KEYS[i], GETUP_KEYS[i + 1], seg - i);
      applyPose(actor.model, pose, 0);
      const target = jointPositions(actor.model, actor.yaw,
        f.risePitch * (1 - ease), f.riseRoll * (1 - ease));

      // Lift the target itself off the floor before pulling toward it. The
      // keyframe's own forward lean adds to the body's tilt, which can aim a
      // joint well under the ground; correcting afterwards just moved the
      // snap somewhere else.
      for (const key in target) {
        const q = f.p[key];
        if (q && target[key][1] < q.r) target[key][1] = q.r;
      }
      pullToward(f, target, Math.min(1, dt * (2.5 + 9 * k)));
      // The pull aims at a keyframe, and a keyframe can put an arm where the
      // body is. Separate again afterwards or the last word each frame is the
      // pose, not the solid.
      separateLimbs(f);

      if (k >= 1) {
        // Blend the last of the way onto the pose rather than cutting over on
        // the clock, which is what made the model jump at the end.
        f.settle = (f.settle || 0) + dt;
        if (settleOntoPose(f, target, dt) || f.settle > 1.5) {
          f.active = false;
          f.state = 'up';
          f.settle = 0;
          f.p = null;
        }
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
      if (kineticEnergy(f) < 0.05) {
        f.still += dt;
        if (f.still > 0.15) { f.state = 'down'; f.timer = 0.18 + actor.rng() * 0.28; }
      } else {
        f.still = 0;
      }
    } else if (f.state === 'down') {
      f.timer -= dt;
      if (f.timer <= 0) { f.state = 'rising'; f.rise = 0; f.riseReady = false; }
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

  function drawRagdoll(target, model, camera, fall, faceParts, extra) {
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
      if (extra && extra[seg.bone]) {
        const list = extra[seg.bone];
        for (let k = 0; k < list.length; k++) {
          const part = list[k];
          const mm = part.at ? R.multiply(m, part.at) : m;
          R.drawMesh(target, mm, part.mesh, R.ramp(part.colour), camera, part);
        }
      }
    }
  }

  /* ---------- gestures ----------
   *
   * Deliberate, occasional actions layered over the still idle pose. They are
   * the one thing besides eyes and mouth allowed to move a standing character,
   * because they read as someone doing something rather than as drift.
   *
   * Each returns bone rotations to add to the idle pose; an envelope eases
   * them in and out so nothing snaps.
   */

  const TWO_PI = Math.PI * 2;

  const GESTURES = {
    wave: {
      duration: 2.1,
      label: 'Wave',
      pose: function (t) {
        return {
          armR: [-0.25, 0, -2.35],
          foreR: [0, 0, Math.sin(t * TWO_PI * 3) * 0.45 - 0.6],
          head: [0, 0.16, 0],
          torso: [0, 0.05, 0]
        };
      }
    },
    fear: {
      duration: 1.7,
      label: 'Alarm',
      pose: function (t) {
        const flinch = 1 - Math.min(1, t * 3);
        return {
          armR: [-1.45, 0, -0.42], foreR: [-1.35, 0, 0],
          armL: [-1.45, 0, 0.42], foreL: [-1.35, 0, 0],
          torso: [-0.26 - flinch * 0.1, 0, 0],
          head: [0.22, 0, 0]
        };
      }
    },
    laugh: {
      duration: 2.2,
      label: 'Laugh',
      pose: function (t) {
        const rock = Math.sin(t * TWO_PI * 3.2);
        return {
          torso: [0.2 + rock * 0.15, 0, 0],
          head: [-0.3 + rock * 0.1, 0, 0],
          armR: [-0.85, 0, 0.7], foreR: [-1.6, 0, 0],
          armL: [0.15, 0, -0.2]
        };
      }
    },
    ponder: {
      duration: 2.6,
      label: 'Ponder',
      pose: function (t) {
        return {
          armR: [-1.25, 0, 0.5], foreR: [-1.95, 0, 0.15],
          head: [0.08, 0.12, 0.14],
          torso: [0.04, 0.06, 0]
        };
      }
    },
    carry: {
      duration: 3.2,
      label: 'Carry',
      pose: function (t) {
        const sway = Math.sin(t * TWO_PI) * 0.05;
        return {
          armR: [-0.28, 0, 0.16], foreR: [-1.5 + sway, 0, 0.1],
          armL: [-0.28, 0, -0.16], foreL: [-1.5 - sway, 0, -0.1]
        };
      }
    },
    greet: {
      duration: 1.6,
      label: 'Nod',
      pose: function (t) {
        const nod = Math.sin(t * TWO_PI * 1.5);
        return { head: [nod * 0.26, 0, 0], torso: [nod * 0.06, 0, 0] };
      }
    }
  };

  const GESTURE_IDS = Object.keys(GESTURES);

  function startGesture(actor, id) {
    const g = GESTURES[id];
    if (!g) return false;
    actor.gesture = { id: id, t: 0, duration: g.duration };
    return true;
  }

  function applyGesture(model, gesture, qTime) {
    poseIdle(model);
    const g = GESTURES[gesture.id];
    if (!g) return;
    const t = Math.min(gesture.duration, quantiseTime(gesture.t));
    const phase = t / gesture.duration;
    // ease in and out so a gesture never starts or ends on a jump
    const env = Math.min(1, phase / 0.14) * Math.min(1, (1 - phase) / 0.18);
    const offs = g.pose(phase);
    for (const name in offs) {
      const v = offs[name];
      addRot(model, name, v[0] * env, v[1] * env, v[2] * env);
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
      shoveX: 0, shoveY: 0, stumbleTime: 0, hitCooldown: 0,
      gesture: null,
      fall: createFall(),
      brain: null,
      buffer: null,
      // combat and carrying, filled in by whoever creates the actor
      body: global.Combat ? global.Combat.createBody() : null,
      inv: global.Items ? global.Items.createInventory(undefined, true) : null,
      leftHanded: false,
      attack: null,
      attackCooldown: 0,
      stamina: 100,
      _key: ''
    };
  }

  function rebuildActorModel(actor) {
    actor.model = CM.buildModel(actor.character);
    actor._key = '';
  }

  /* Being shoved moves the whole character. A bump should push someone aside,
   * not leave them rooted to the spot waving their arms — that reads as a
   * flail no matter how the limbs are tuned. */
  function shove(actor, dirX, dirY, speed) {
    const len = Math.hypot(dirX, dirY) || 1;
    actor.shoveX += (dirX / len) * speed;
    actor.shoveY += (dirY / len) * speed;
  }

  // A stumble: shoved hard enough that they have to put their feet down. The
  // walk cycle runs for the duration so the legs actually catch them.
  function stumble(actor, dirX, dirY, speed, duration) {
    shove(actor, dirX, dirY, speed);
    actor.stumbleTime = Math.max(actor.stumbleTime || 0, duration === undefined ? 0.55 : duration);
  }

  function applyShove(actor, dt) {
    if (actor.stumbleTime > 0) actor.stumbleTime = Math.max(0, actor.stumbleTime - dt);
    // One reaction per contact. Bodies stay overlapped for many frames while
    // they are pushed apart, and re-reacting on each of those frames stacks
    // into a shove several times the size of the one that was intended.
    if (actor.hitCooldown > 0) actor.hitCooldown = Math.max(0, actor.hitCooldown - dt);
    if (!actor.shoveX && !actor.shoveY) return;
    actor.x += actor.shoveX * dt;
    actor.y += actor.shoveY * dt;
    const decay = Math.exp(-dt * 5.5);
    actor.shoveX *= decay;
    actor.shoveY *= decay;
    if (Math.abs(actor.shoveX) < 0.6 && Math.abs(actor.shoveY) < 0.6) {
      actor.shoveX = 0;
      actor.shoveY = 0;
    }
  }

  const TURN_RATE = 11.0;

  function updateActorMotion(actor, dt) {
    const diff = shortestAngle(actor.yaw, actor.targetYaw);
    const maxStep = TURN_RATE * dt;
    if (Math.abs(diff) <= maxStep) actor.yaw = actor.targetYaw;
    else actor.yaw += Math.sign(diff) * maxStep;

    actor.animTime += dt;
    if (actor.gesture) {
      actor.gesture.t += dt;
      if (actor.gesture.t >= actor.gesture.duration) actor.gesture = null;
    }
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
        else actor.blinkTimer = 5.0 + actor.rng() * 7.0;
      } else {
        actor.blink = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
      }
      return;
    }
    actor.blinkTimer -= dt;
    if (actor.blinkTimer <= 0) {
      actor.blink = 0.001;
      actor.blinkPhase = 0;
      actor.blinkQueue = actor.rng() < 0.07 ? 1 : 0;
    }
  }

  function poseActor(actor, qTime) {
    const model = actor.model;
    if (actor.customPose) { applyPose(model, actor.customPose, actor.customBob || 0); return; }
    const side = actor.leftHanded ? 'L' : 'R';
    if (actor.attack) {
      poseAttack(model, actor.attack.anim, actor.attack.t / actor.attack.duration,
        side, actor.gait, qTime);
      return;
    }
    if (actor.reaction) {
      const r = actor.reaction;
      if (r.kind === 'clutch') { poseClutch(model, r.k, r.zone, side); return; }
      if (r.kind === 'stagger') { poseStagger(model, r.k, r.side || 0); return; }
      if (r.kind === 'sheathe' || r.kind === 'draw') { poseSheathe(model, r.k, side); return; }
      if (r.kind === 'nock') { poseNock(model, r.k, side); return; }
      if (r.kind === 'guard' || r.kind === 'surrender') { poseGuard(model, r.k, side); return; }
    }
    if (actor.gait === 'walk') poseWalk(model, qTime, false);
    else if (actor.gait === 'run') poseWalk(model, qTime, true);
    else if (actor.gesture) applyGesture(model, actor.gesture, qTime);
    else {
      poseIdle(model);
      // someone holding a weapon holds it ready, not dangling
      const I = global.Items;
      if (I && actor.inv && actor.inv[I.HAND] && actor.alert) {
        poseReady(model, actor.leftHanded ? 'L' : 'R', !!actor.inv[I.SHIELD]);
      }
    }
  }

  /* ---------- drawing ---------- */

  function drawModel(target, model, camera, opts) {
    const yaw = (opts && opts.yaw) || 0;
    const faceParts = opts && opts.faceParts;
    const offset = opts && opts.offset;
    const extra = opts && opts.extra;
    const scale = model.root.scale || 1;

    // Yaw, then scale, then the bob — and the bob is rounded to a whole screen
    // pixel. A sub-pixel bob does nothing except flip an edge row on and off as
    // it crosses a boundary, which reads as the model quietly crawling.
    const pixel = scale * camera.scale;
    const bob = pixel > 0 ? Math.round((model.bob || 0) * pixel) / pixel : 0;
    let base = R.multiply(R.rotationY(yaw), R.scaling(scale));
    base = R.multiply(base, R.translation(0, bob, 0));
    // A world-space offset applied after the yaw, so a rider can be planted on
    // a saddle that is itself already rotated.
    if (offset) base = R.multiply(R.translation(offset[0], offset[1], offset[2]), base);

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
      // A held weapon hangs off the forearm at the hand, and a wound is
      // stitched to whichever bone took it — both follow the limb, which is
      // the whole point of drawing them here instead of over the sprite.
      if (extra && extra[node.name]) {
        const list = extra[node.name];
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          const mm = p.at ? R.multiply(m, p.at) : m;
          R.drawMesh(target, mm, p.mesh, R.ramp(p.colour), camera, p);
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
  /* What hangs off this actor's bones beyond their own body: the weapon in
   * their hand, a shield on the other arm, and every wound they are carrying.
   * Collected per frame so a swing, a bleed and a dropped sword all show up
   * without anyone having to remember to rebuild the model. */
  const _handM = {};
  function handMatrix(model, side) {
    const key = side + (model.dims.lowerArmH | 0);
    if (!_handM[key]) {
      _handM[key] = R.translation(0, -model.dims.lowerArmH - 0.9, 0);
    }
    return _handM[key];
  }

  function actorExtras(actor) {
    const I = global.Items, C = global.Combat;
    let out = null;
    if (I && actor.inv) {
      const mainSide = actor.leftHanded ? 'L' : 'R';
      const offSide = actor.leftHanded ? 'R' : 'L';
      const hand = actor.inv[I.HAND];
      if (hand) {
        const parts = I.iconParts(hand.id);
        if (parts && parts.length) {
          const at = handMatrix(actor.model, mainSide);
          const list = (out = out || {})['fore' + mainSide] = [];
          for (let i = 0; i < parts.length; i++) {
            list.push({ mesh: parts[i].mesh, colour: parts[i].colour, at: at });
          }
        }
      }
      const sh = actor.inv[I.SHIELD];
      if (sh) {
        const parts = I.iconParts(sh.id);
        if (parts && parts.length) {
          const at = R.multiply(handMatrix(actor.model, offSide), R.rotationX(1.45));
          const list = (out = out || {})['fore' + offSide] = [];
          for (let i = 0; i < parts.length; i++) {
            list.push({ mesh: parts[i].mesh, colour: parts[i].colour, at: at });
          }
        }
      }
    }
    if (C && actor.body && actor.body.wounds.length) {
      const byBone = C.woundParts(actor.model, actor.body.wounds);
      if (byBone) {
        out = out || {};
        for (const bone in byBone) {
          const dst = out[bone] || (out[bone] = []);
          const src = byBone[bone];
          for (let i = 0; i < src.length; i++) dst.push(src[i]);
        }
      }
    }
    return out;
  }

  function renderActor(actor, target, camera, opts) {
    const qTime = quantiseTime(actor.animTime);
    const qYaw = quantiseYaw((opts && opts.yaw !== undefined) ? opts.yaw : actor.yaw);
    const f = actor.fall;

    // A ragdoll changes every frame, so it never reuses a cached buffer.
    const key = f.active ? null : [
      qTime, qYaw, actor.gait, actor.blink > 0.5 ? 1 : actor.blink > 0 ? 2 : 0,
      actor.viseme, actor.customPose ? 'p' + actor.animTime : '',
      actor.gesture ? actor.gesture.id + quantiseTime(actor.gesture.t) : '',
      actor.attack ? actor.attack.anim + Math.round(actor.attack.t * 40) : '',
      actor.body ? actor.body.wounds.length + ':' + Math.round(actor.body.bleed * 4) : '',
      actor.inv && actor.inv[8] ? actor.inv[8].id : '',
      actor.inv && actor.inv[9] ? actor.inv[9].id : '',
      actor.reaction ? actor.reaction.kind + Math.round((actor.reaction.k || 0) * 8) : ''
    ].join('|');
    if (key !== null && key === actor._key && !(opts && opts.force)) return target;
    actor._key = key === null ? '' : key;

    R.clearTarget(target);
    const face = CM.buildFaceParts(actor.model, {
      blink: actor.blink,
      viseme: actor.viseme,
      gaze: actor.gaze
    });

    const extra = actorExtras(actor);
    if (f.active && f.p) {
      drawRagdoll(target, actor.model, camera, f, face, extra);
    } else {
      poseActor(actor, qTime);
      drawModel(target, actor.model, camera, { yaw: qYaw, faceParts: face, extra: extra });
    }
    R.traceOutline(target, (opts && opts.outline) || OUTLINE);
    return target;
  }

  global.Rig = {
    JOINTS, DIRECTIONS, ANIM_FPS, YAW_STEPS,
    quantiseTime, quantiseYaw,
    clearPose, setRot, addRot, poseIdle, poseWalk, poseTalk,
    poseRide, poseMount, poseDrive,
    ATTACKS, poseAttack, attackHitFraction, poseGuard, poseClutch, poseReady,
    poseStagger, poseSheathe, poseNock,
    emptyPose, clonePose, applyPose, lerpPose, samplePoseTrack,
    yawForDirection, snapToEight, directionName, shortestAngle,
    createActor, rebuildActorModel, updateActorMotion, updateBlink,
    createFall, knockDown, nudge, applyImpulse, updateFall, isDown,
    shove, stumble, applyShove,
    GESTURES, GESTURE_IDS, startGesture, applyGesture,
    jointPositions, segmentMatrix, drawRagdoll, actorExtras,
    poseActor, drawModel, renderActor, OUTLINE
  };
})(window);
