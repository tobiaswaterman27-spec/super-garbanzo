/* app.js — the editor shell: controls, the preview stage and the world mode. */
(function () {
  'use strict';

  const R = window.Render;
  const P = window.Parts;
  const CM = window.CharacterModel;
  const Rig = window.Rig;
  const T = window.Text;
  const D = window.Dialogue;
  const W = window.World;

  /* ---------- preview stage geometry ---------- */

  const PV = { w: 132, h: 152, ox: 66, oy: 138, scale: 3.6, pitch: 0.26 };

  const state = {
    character: CM.defaultCharacter(),
    mode: 'forge',
    yaw: 0.45,
    turntable: true,
    animation: 'idle',
    poseFrames: [],
    poseDuration: 1.2,
    playingTrack: false,
    trackTime: 0,
    sprinting: false,
    editingPose: Rig.emptyPose(),
    world: null
  };

  const controls = [];
  let previewActor = null;
  let previewTarget = null;
  let actorTarget = null;
  let previewCamera = null;
  let presentPreview = null;
  let worldTarget = null;
  let worldCamera = null;
  let presentWorld = null;

  const el = function (id) { return document.getElementById(id); };

  /* ---------- small control factories ---------- */

  function field(labelText, valueText) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('div');
    label.className = 'field-label';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.appendChild(span);
    if (valueText !== undefined) {
      const v = document.createElement('var');
      v.textContent = valueText;
      label.appendChild(v);
      wrap.valueEl = v;
    }
    wrap.appendChild(label);
    return wrap;
  }

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

  function makeSelect(labelText, list, get, set) {
    const wrap = field(labelText);
    const sel = document.createElement('select');
    sel.id = 'sel-' + slug(labelText);
    for (let i = 0; i < list.length; i++) {
      const o = document.createElement('option');
      o.value = list[i].id;
      o.textContent = list[i].label;
      sel.appendChild(o);
    }
    sel.addEventListener('change', function () { set(sel.value); onCharacterChanged(); });
    wrap.appendChild(sel);
    controls.push(function () { sel.value = get(); });
    return wrap;
  }

  function makeSwatches(labelText, list, get, set) {
    const wrap = field(labelText, '');
    const row = document.createElement('div');
    row.className = 'swatches';
    const buttons = [];
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.id = 'sw-' + slug(labelText) + '-' + entry.id;
      b.style.background = entry.hex;
      b.title = entry.label;
      b.setAttribute('aria-label', labelText + ': ' + entry.label);
      b.addEventListener('click', function () { set(entry.id); onCharacterChanged(); });
      row.appendChild(b);
      buttons.push({ b: b, entry: entry });
    }
    wrap.appendChild(row);
    controls.push(function () {
      const current = get();
      for (let i = 0; i < buttons.length; i++) {
        const on = buttons[i].entry.id === current;
        buttons[i].b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && wrap.valueEl) wrap.valueEl.textContent = buttons[i].entry.label;
      }
    });
    return wrap;
  }

  function makeSlider(labelText, min, max, step, get, set, format) {
    const wrap = field(labelText, '');
    const input = document.createElement('input');
    input.type = 'range';
    input.id = 'rng-' + slug(labelText);
    input.min = min; input.max = max; input.step = step;
    input.addEventListener('input', function () {
      set(parseFloat(input.value));
      onCharacterChanged();
    });
    wrap.appendChild(input);
    controls.push(function () {
      const v = get();
      input.value = v;
      if (wrap.valueEl) wrap.valueEl.textContent = format ? format(v) : v.toFixed(2);
    });
    return wrap;
  }

  function makeSegmented(labelText, options, get, set) {
    const wrap = field(labelText);
    const row = document.createElement('div');
    row.className = 'segmented';
    const buttons = [];
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.id = 'seg-' + slug(labelText) + '-' + slug(opt.id);
      b.textContent = opt.label;
      b.addEventListener('click', function () { set(opt.id); onCharacterChanged(); });
      row.appendChild(b);
      buttons.push({ b: b, id: opt.id });
    }
    wrap.appendChild(row);
    controls.push(function () {
      const current = get();
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].b.setAttribute('aria-pressed', buttons[i].id === current ? 'true' : 'false');
      }
    });
    return wrap;
  }

  function group(title, note) {
    const g = document.createElement('div');
    g.className = 'group';
    const h = document.createElement('h2');
    h.appendChild(document.createTextNode(title));
    if (note) {
      const s = document.createElement('span');
      s.textContent = note;
      h.appendChild(s);
    }
    g.appendChild(h);
    return g;
  }

  const ch = function () { return state.character; };
  function setter(key) { return function (v) { state.character[key] = v; }; }
  function getter(key) { return function () { return state.character[key]; }; }

  /* ---------- panels ---------- */

  function buildIdentityPanel() {
    const panel = el('panel-identity');
    const g = group('Who they are');

    // name
    const nameField = field('Name', '0/15');
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'name-input';
    input.maxLength = CM.MAX_NAME_LENGTH;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', function () {
      const clean = CM.sanitiseName(input.value);
      if (clean !== input.value) {
        const at = input.selectionStart;
        input.value = clean;
        try { input.setSelectionRange(at - 1, at - 1); } catch (e) { /* ignore */ }
      }
      state.character.name = clean;
      onCharacterChanged();
    });
    nameField.appendChild(input);
    g.appendChild(nameField);
    controls.push(function () {
      if (document.activeElement !== input) input.value = state.character.name;
      if (nameField.valueEl) {
        nameField.valueEl.textContent = state.character.name.length + '/' + CM.MAX_NAME_LENGTH;
      }
    });

    const nameRow = document.createElement('div');
    nameRow.className = 'btn-row';
    const rollName = document.createElement('button');
    rollName.type = 'button';
    rollName.className = 'btn';
    rollName.id = 'roll-name';
    rollName.textContent = 'Random name';
    rollName.addEventListener('click', function () {
      state.character.name = CM.randomName(null, state.character.sex);
      onCharacterChanged();
    });
    const rollSurname = document.createElement('button');
    rollSurname.type = 'button';
    rollSurname.className = 'btn';
    rollSurname.id = 'roll-surname';
    rollSurname.addEventListener('click', function () {
      const rng = CM.makeRng((Math.random() * 0xffffffff) >>> 0);
      state.character.surname = CM.pick(rng, P.SURNAMES);
      onCharacterChanged();
    });
    controls.push(function () { rollSurname.textContent = 'House: ' + state.character.surname; });
    nameRow.appendChild(rollName);
    nameRow.appendChild(rollSurname);
    g.appendChild(nameRow);

    // sex
    g.appendChild(makeSegmented('Sex', [
      { id: 'male', label: 'Male' },
      { id: 'female', label: 'Female' }
    ], getter('sex'), function (v) {
      state.character.sex = v;
      // female characters default back to clean shaven, but every facial hair
      // option stays selectable below
      if (v === 'female') { state.character.moustache = 'none'; state.character.beard = 'none'; }
    }));

    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'Sex drives body proportions, the name pool and whether facial hair is rolled for generated villagers. Pronouns are a separate field, not yet wired up.';
    g.appendChild(note);

    panel.appendChild(g);
  }

  function buildFacePanel() {
    const panel = el('panel-face');

    const hair = group('Hair', P.HAIR_STYLES.length + ' styles');
    hair.appendChild(makeSelect('Style', P.HAIR_STYLES, getter('hairStyle'), setter('hairStyle')));
    hair.appendChild(makeSwatches('Hair colour', P.HAIR_COLOURS, getter('hairColour'), setter('hairColour')));
    panel.appendChild(hair);

    const facial = group('Facial hair', 'chosen separately');
    facial.appendChild(makeSelect('Moustache', P.MOUSTACHES, getter('moustache'), setter('moustache')));
    facial.appendChild(makeSelect('Beard', P.BEARDS, getter('beard'), setter('beard')));
    panel.appendChild(facial);

    const face = group('Face');
    face.appendChild(makeSwatches('Eye colour', P.EYE_COLOURS, getter('eyeColour'), setter('eyeColour')));
    face.appendChild(makeSelect('Eye shape', P.EYE_SHAPES, getter('eyeShape'), setter('eyeShape')));
    face.appendChild(makeSelect('Brow', P.BROW_SHAPES, getter('brow'), setter('brow')));
    face.appendChild(makeSelect('Nose', P.NOSE_SHAPES, getter('nose'), setter('nose')));
    face.appendChild(makeSlider('Mouth width', 0, 1, 0.01, getter('mouthWidth'), setter('mouthWidth'),
      function (v) { return Math.round(v * 100) + '%'; }));
    panel.appendChild(face);
  }

  function buildBodyPanel() {
    const panel = el('panel-body');

    const build = group('Build');
    build.appendChild(makeSwatches('Skin tone', P.SKIN_TONES, getter('skin'), setter('skin')));
    build.appendChild(makeSlider('Height', 0, 1, 0.01, getter('height'), setter('height'), function (v) {
      // roughly 1.55 m to 1.90 m across the range, for a sense of scale
      return (1.55 + v * 0.35).toFixed(2) + ' m';
    }));
    build.appendChild(makeSlider('Frame', 0, 1, 0.01, getter('build'), setter('build'), function (v) {
      return v < 0.3 ? 'Slight' : v < 0.7 ? 'Average' : 'Heavy';
    }));
    panel.appendChild(build);

    const clothes = group('Clothing');
    clothes.appendChild(makeSelect('Garment', P.GARMENTS, getter('garment'), setter('garment')));
    clothes.appendChild(makeSwatches('Tunic', P.CLOTH_COLOURS, getter('tunicColour'), setter('tunicColour')));
    clothes.appendChild(makeSwatches('Trousers', P.CLOTH_COLOURS, getter('trouserColour'), setter('trouserColour')));
    clothes.appendChild(makeSwatches('Boots', P.LEATHER_COLOURS, getter('bootColour'), setter('bootColour')));
    panel.appendChild(clothes);
  }

  function buildAnimPanel() {
    const panel = el('panel-anim');

    const playback = group('Playback');
    playback.appendChild(makeSegmented('Cycle', [
      { id: 'idle', label: 'Idle' },
      { id: 'walk', label: 'Walk' },
      { id: 'run', label: 'Run' },
      { id: 'talk', label: 'Talk' }
    ], function () { return state.animation; }, function (v) {
      state.animation = v;
      state.playingTrack = false;
      previewActor.gesture = null;
    }));

    const knockRow = document.createElement('div');
    knockRow.className = 'btn-row';
    const knockBtn = document.createElement('button');
    knockBtn.type = 'button';
    knockBtn.className = 'btn';
    knockBtn.id = 'knock-down';
    knockBtn.textContent = 'Knock down';
    knockBtn.addEventListener('click', function () {
      const angle = Math.random() * Math.PI * 2;
      Rig.knockDown(previewActor, Math.sin(angle), Math.cos(angle), 4 + Math.random() * 4);
    });

    const jostleBtn = document.createElement('button');
    jostleBtn.type = 'button';
    jostleBtn.className = 'btn';
    jostleBtn.id = 'jostle';
    jostleBtn.textContent = 'Jostle';
    jostleBtn.addEventListener('click', function () {
      const angle = Math.random() * Math.PI * 2;
      Rig.nudge(previewActor, Math.sin(angle), Math.cos(angle), 2 + Math.random() * 2.5);
    });

    const tripBtn = document.createElement('button');
    tripBtn.type = 'button';
    tripBtn.className = 'btn';
    tripBtn.id = 'trip';
    tripBtn.textContent = 'Trip';
    tripBtn.addEventListener('click', function () {
      const angle = Math.random() * Math.PI * 2;
      Rig.trip(previewActor, Math.sin(angle), Math.cos(angle), 3.5 + Math.random() * 2);
    });

    knockRow.appendChild(jostleBtn);
    knockRow.appendChild(tripBtn);
    knockRow.appendChild(knockBtn);
    playback.appendChild(knockRow);

    const gestureField = field('Gesture');
    const gestureRow = document.createElement('div');
    gestureRow.className = 'btn-row';
    Rig.GESTURE_IDS.forEach(function (id) {
      const g = document.createElement('button');
      g.type = 'button';
      g.className = 'btn';
      g.id = 'gesture-' + id;
      g.textContent = Rig.GESTURES[id].label;
      g.addEventListener('click', function () {
        state.animation = 'idle';
        state.playingTrack = false;
        previewActor.customPose = null;
        Rig.startGesture(previewActor, id);
        refreshControls();
      });
      gestureRow.appendChild(g);
    });
    gestureField.appendChild(gestureRow);
    playback.appendChild(gestureField);

    const facing = document.createElement('div');
    facing.className = 'field';
    const facingLabel = document.createElement('div');
    facingLabel.className = 'field-label';
    const fl = document.createElement('span');
    fl.textContent = 'Facing';
    const fv = document.createElement('var');
    facingLabel.appendChild(fl);
    facingLabel.appendChild(fv);
    facing.appendChild(facingLabel);

    const pad = document.createElement('div');
    pad.className = 'dirpad';
    const order = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'];
    const dirButtons = [];
    for (let i = 0; i < order.length; i++) {
      if (order[i] === null) {
        const sp = document.createElement('div');
        sp.className = 'spacer';
        pad.appendChild(sp);
        continue;
      }
      const dir = Rig.DIRECTIONS.filter(function (d) { return d.id === order[i]; })[0];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.id = 'dir-' + dir.id;
      b.textContent = dir.id;
      b.title = dir.label;
      b.addEventListener('click', function () {
        state.turntable = false;
        el('turn-spin').setAttribute('aria-pressed', 'false');
        previewActor.targetYaw = Rig.yawForDirection(dir.dx, dir.dy);
      });
      pad.appendChild(b);
      dirButtons.push({ b: b, id: dir.id });
    }
    facing.appendChild(pad);
    panel.appendChild(playback);
    playback.appendChild(facing);
    controls.push(function () {
      const name = Rig.directionName(previewActor ? previewActor.targetYaw : 0);
      fv.textContent = name;
      for (let i = 0; i < dirButtons.length; i++) {
        dirButtons[i].b.classList.toggle('is-active', !state.turntable && dirButtons[i].id === name);
      }
    });

    /* pose editor */
    const poseGroup = group('Pose the joints', 'radians');
    const poseHint = document.createElement('p');
    poseHint.className = 'hint';
    poseHint.textContent = 'Move a joint and the preview switches to your pose. Key it, move again, key it again — the frames play back as a loop.';
    poseGroup.appendChild(poseHint);

    for (let i = 0; i < Rig.JOINTS.length; i++) {
      poseGroup.appendChild(buildJointEditor(Rig.JOINTS[i]));
    }
    panel.appendChild(poseGroup);

    /* keyframes */
    const keyGroup = group('Keyframes');
    const keyRow = document.createElement('div');
    keyRow.className = 'btn-row';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn';
    addBtn.id = 'key-add';
    addBtn.textContent = 'Key this pose';
    addBtn.addEventListener('click', function () {
      state.poseFrames.push({ pose: Rig.clonePose(state.editingPose) });
      state.animation = 'pose';
      refreshKeyframes();
    });

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'btn';
    playBtn.id = 'key-play';
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', function () {
      if (state.poseFrames.length < 2) return;
      state.playingTrack = !state.playingTrack;
      state.trackTime = 0;
      state.animation = 'pose';
      refreshKeyframes();
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn btn--ghost';
    clearBtn.id = 'key-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', function () {
      state.poseFrames.length = 0;
      state.playingTrack = false;
      refreshKeyframes();
    });

    keyRow.appendChild(addBtn);
    keyRow.appendChild(playBtn);
    keyRow.appendChild(clearBtn);
    keyGroup.appendChild(keyRow);

    keyGroup.appendChild(makeSlider('Loop length', 0.3, 4, 0.1,
      function () { return state.poseDuration; },
      function (v) { state.poseDuration = v; },
      function (v) { return v.toFixed(1) + ' s'; }));

    const list = document.createElement('div');
    list.className = 'keyframes';
    list.id = 'keyframe-list';
    keyGroup.appendChild(list);

    const resetRow = document.createElement('div');
    resetRow.className = 'btn-row';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn--ghost';
    resetBtn.id = 'pose-reset';
    resetBtn.textContent = 'Reset joints';
    resetBtn.addEventListener('click', function () {
      state.editingPose = Rig.emptyPose();
      state.animation = 'idle';
      state.playingTrack = false;
      refreshControls();
    });
    resetRow.appendChild(resetBtn);
    keyGroup.appendChild(resetRow);

    panel.appendChild(keyGroup);

    function refreshKeyframes() {
      list.innerHTML = '';
      if (!state.poseFrames.length) {
        const p = document.createElement('p');
        p.className = 'empty';
        p.textContent = 'No keyframes yet.';
        list.appendChild(p);
      }
      for (let i = 0; i < state.poseFrames.length; i++) {
        const k = document.createElement('button');
        k.type = 'button';
        k.className = 'keyframe';
        k.innerHTML = '';
        const b = document.createElement('b');
        b.textContent = 'F' + (i + 1);
        k.appendChild(b);
        k.appendChild(document.createTextNode(' ×'));
        k.title = 'Remove keyframe ' + (i + 1);
        (function (index) {
          k.addEventListener('click', function () {
            state.poseFrames.splice(index, 1);
            if (state.poseFrames.length < 2) state.playingTrack = false;
            refreshKeyframes();
          });
        })(i);
        list.appendChild(k);
      }
      playBtn.textContent = state.playingTrack ? 'Stop' : 'Play';
      playBtn.disabled = state.poseFrames.length < 2;
      playBtn.style.opacity = state.poseFrames.length < 2 ? 0.45 : 1;
    }
    refreshKeyframes();
  }

  function buildJointEditor(joint) {
    const wrap = document.createElement('div');
    wrap.className = 'joint';
    const h = document.createElement('h3');
    h.textContent = joint.label;
    wrap.appendChild(h);

    for (let axis = 0; axis < 3; axis++) {
      const row = document.createElement('div');
      row.className = 'axis';
      const name = document.createElement('span');
      name.textContent = joint.axes[axis];
      const input = document.createElement('input');
      input.type = 'range';
      input.id = 'joint-' + joint.name + '-' + axis;
      input.min = -1.6; input.max = 1.6; input.step = 0.02;
      input.setAttribute('aria-label', joint.label + ' ' + joint.axes[axis]);
      const val = document.createElement('var');

      (function (a) {
        input.addEventListener('input', function () {
          state.editingPose[joint.name][a] = parseFloat(input.value);
          state.animation = 'pose';
          state.playingTrack = false;
          refreshControls();
        });
      })(axis);

      row.appendChild(name);
      row.appendChild(input);
      row.appendChild(val);
      wrap.appendChild(row);

      controls.push(function () {
        const v = state.editingPose[joint.name][axis];
        if (document.activeElement !== input) input.value = v;
        val.textContent = v.toFixed(2);
      });
    }
    return wrap;
  }

  /* ---------- tabs ---------- */

  function wireTabs() {
    const tabs = [
      ['tab-identity', 'panel-identity'],
      ['tab-face', 'panel-face'],
      ['tab-body', 'panel-body'],
      ['tab-anim', 'panel-anim']
    ];
    tabs.forEach(function (pair) {
      el(pair[0]).addEventListener('click', function () {
        tabs.forEach(function (other) {
          const selected = other[0] === pair[0];
          el(other[0]).setAttribute('aria-selected', selected ? 'true' : 'false');
          el(other[1]).hidden = !selected;
        });
      });
    });
  }

  /* ---------- preview rendering ---------- */

  const BACKDROP_TOP = R.hexToRgb('#12161f');
  const BACKDROP_BOTTOM = R.hexToRgb('#232b39');
  const FLOOR = R.pack(38, 46, 58);
  const FLOOR_SHADOW = R.pack(14, 17, 24);

  function drawPreview() {
    R.clearTarget(previewTarget);
    for (let y = 0; y < PV.h; y++) {
      const t = y / PV.h;
      const c = R.mixRgb(BACKDROP_TOP, BACKDROP_BOTTOM, t * t);
      R.fillRect(previewTarget, 0, y, PV.w, 1, R.pack(c[0], c[1], c[2]));
    }
    R.fillEllipse(previewTarget, PV.ox, PV.oy + 3, 42, 10, FLOOR, 1);
    R.fillEllipse(previewTarget, PV.ox, PV.oy + 3, 20, 5.5, FLOOR_SHADOW, 0.45);

    Rig.renderActor(previewActor, actorTarget, previewCamera, {});
    R.blit(previewTarget, actorTarget, 0, 0);

    presentPreview(previewTarget);
  }

  function updatePreviewActor(dt) {
    const a = previewActor;

    // A soft jostle plays over whatever cycle is selected; only a real fall
    // takes the animation over entirely.
    if (Rig.isDown(a)) {
      a.customPose = null;
      a.gait = 'idle';
      a.speaking = false;
      a.viseme = 'rest';
      Rig.updateActorMotion(a, dt);
      return;
    }

    if (state.animation === 'pose') {
      a.customPose = state.playingTrack && state.poseFrames.length > 1
        ? Rig.samplePoseTrack(state.poseFrames, state.trackTime, state.poseDuration)
        : state.editingPose;
      a.gait = 'idle';
      a.speaking = false;
      if (state.playingTrack) state.trackTime += dt;
    } else {
      a.customPose = null;
      a.gait = state.animation === 'walk' ? 'walk' : state.animation === 'run' ? 'run' : 'idle';
      a.speaking = state.animation === 'talk';
    }

    // the talk cycle drives the mouth through a plausible run of letters
    if (state.animation === 'talk') {
      const alphabet = 'aeioumbpflstrw';
      const i = Math.floor(a.animTime * 7) % alphabet.length;
      a.viseme = CM.visemeForLetter(alphabet[i]);
    } else if (!a.speaking) {
      a.viseme = 'rest';
    }

    if (state.turntable) a.targetYaw += dt * 0.55;
    Rig.updateActorMotion(a, dt);
  }

  function updateReadout() {
    const c = state.character;
    const hairLabel = P.HAIR_STYLES[CM.indexOfId(P.HAIR_STYLES, c.hairStyle)].label;
    const anim = previewActor.fall.active
      ? (previewActor.fall.mode === 'full'
        ? 'ragdoll ' + previewActor.fall.state
        : previewActor.fall.mode)
      : previewActor.gesture
        ? Rig.GESTURES[previewActor.gesture.id].label.toLowerCase()
      : state.animation === 'pose'
        ? (state.playingTrack ? 'track' : 'posed')
        : state.animation;
    el('readout').innerHTML = '';
    const bits = [
      [c.name || '(unnamed)', c.surname],
      ['facing', Rig.directionName(previewActor.yaw)],
      ['cycle', anim],
      ['hair', hairLabel]
    ];
    bits.forEach(function (pair) {
      const s = document.createElement('span');
      s.appendChild(document.createTextNode(pair[0] + ' '));
      const b = document.createElement('b');
      b.textContent = pair[1];
      s.appendChild(b);
      el('readout').appendChild(s);
    });
  }

  /* ---------- world mode ---------- */

  function enterWorld() {
    if (!state.world) {
      state.world = W.createWorld(state.character, 20260913);
    } else {
      state.world.player.character = state.character;
      Rig.rebuildActorModel(state.world.player);
    }
    setMode('world');
  }

  function setMode(mode) {
    state.mode = mode;
    const forge = mode === 'forge';
    el('preview-canvas').hidden = !forge;
    el('world-canvas').hidden = forge;
    el('forge-foot').hidden = !forge;
    el('world-foot').hidden = forge;
    el('readout').hidden = !forge;       // forge status has no place in the world
    el('mode-forge').classList.toggle('is-active', forge);
    el('mode-world').classList.toggle('is-active', !forge);
    document.body.classList.toggle('playing', !forge);
    if (!forge) {
      state.sprinting = false;
      lastMoveAt = 0;
      el('world-canvas').focus();
    }
  }

  const keys = Object.create(null);
  const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

  // WASD and the arrows are the same four directions, so a double-tap counts
  // whichever pair you use — W then Up works as well as W then W.
  const DIRECTION_OF = {
    w: 'up', arrowup: 'up',
    s: 'down', arrowdown: 'down',
    a: 'left', arrowleft: 'left',
    d: 'right', arrowright: 'right'
  };
  const TALK_KEYS = ['e', 'enter', ' ', 'spacebar'];
  const DOUBLE_TAP_MS = 330;
  // Coming to a stop ends the sprint, but only after a real pause. A
  // double-tap releases the key for a moment on its way to the second press,
  // and cancelling on that release meant the toggle could switch the sprint
  // on but never back off.
  const STOP_GRACE_MS = 200;
  const lastTap = Object.create(null);
  let lastMoveAt = 0;

  function toggleSprint() {
    state.sprinting = !state.sprinting;
  }

  function wireWorldInput() {
    const canvas = el('world-canvas');
    canvas.tabIndex = 0;

    window.addEventListener('keydown', function (e) {
      const k = e.key.toLowerCase();
      if (state.mode !== 'world') { keys[k] = true; return; }

      // Double-tapping any direction toggles the sprint; tapping that
      // direction twice again drops back to a walk, as does coming to a stop.
      // Tracking per direction rather than globally means that swinging from
      // W to D while turning a corner does not read as a double-tap.
      const direction = DIRECTION_OF[k];
      if (direction && !e.repeat) {
        const now = (window.performance || Date).now();
        if (now - (lastTap[direction] || 0) < DOUBLE_TAP_MS) {
          toggleSprint();
          lastTap[direction] = 0;
        } else {
          lastTap[direction] = now;
        }
      }
      keys[k] = true;

      if (TALK_KEYS.indexOf(k) >= 0) {
        e.preventDefault();
        if (state.world) W.tryTalk(state.world);
      }
      if (MOVE_KEYS.indexOf(k) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', function () {
      for (const k in keys) keys[k] = false;
      state.sprinting = false;
    });

    // Clicking only turns the page; talking is E, Enter or Space, up close.
    canvas.addEventListener('click', function () {
      if (state.world && state.world.box.open) D.advance(state.world.box);
    });
  }

  function readWorldInput(world) {
    let dx = 0, dy = 0;
    if (keys.a || keys.arrowleft) dx -= 1;
    if (keys.d || keys.arrowright) dx += 1;
    if (keys.w || keys.arrowup) dy -= 1;
    if (keys.s || keys.arrowdown) dy += 1;
    const now = (window.performance || Date).now();
    if (dx || dy) lastMoveAt = now;
    else if (now - lastMoveAt > STOP_GRACE_MS) state.sprinting = false;
    world.input.dx = dx;
    world.input.dy = dy;
    world.input.sprint = state.sprinting;
  }

  /* ---------- main loop ---------- */

  let last = 0;

  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;

    if (state.mode === 'forge') {
      updatePreviewActor(dt);
      drawPreview();
      updateReadout();
    } else if (state.world) {
      readWorldInput(state.world);
      W.update(state.world, dt);
      W.draw(state.world, worldTarget, worldCamera);
      presentWorld(worldTarget);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- glue ---------- */

  function refreshControls() {
    for (let i = 0; i < controls.length; i++) controls[i]();
  }

  function onCharacterChanged() {
    previewActor.character = state.character;
    Rig.rebuildActorModel(previewActor);
    refreshControls();
  }

  function randomiseAll() {
    const rng = CM.makeRng((Math.random() * 0xffffffff) >>> 0);
    state.character = CM.randomCharacter(rng);
    previewActor.character = state.character;
    Rig.rebuildActorModel(previewActor);
    refreshControls();
  }

  function start(restored) {
    if (restored && restored.character) state.character = restored.character;

    previewTarget = R.createTarget(PV.w, PV.h);
    actorTarget = R.createTarget(PV.w, PV.h);
    previewCamera = R.makeCamera(PV.pitch, PV.scale, PV.ox, PV.oy);
    presentPreview = R.createPresenter(el('preview-canvas'), PV.w, PV.h);

    worldTarget = R.createTarget(W.VIEW_W, W.VIEW_H);
    worldCamera = R.makeCamera(W.CAM_PITCH, W.CAM_SCALE, W.ACTOR_BUF.ox, W.ACTOR_BUF.oy);
    presentWorld = R.createPresenter(el('world-canvas'), W.VIEW_W, W.VIEW_H);

    previewActor = Rig.createActor(state.character, 0, 0, 99);
    previewActor.targetYaw = state.yaw;
    previewActor.yaw = state.yaw;

    buildIdentityPanel();
    buildFacePanel();
    buildBodyPanel();
    buildAnimPanel();
    wireTabs();
    wireWorldInput();

    el('randomise').addEventListener('click', randomiseAll);
    el('enter-world').addEventListener('click', enterWorld);
    el('mode-forge').addEventListener('click', function () { setMode('forge'); });
    el('mode-world').addEventListener('click', enterWorld);

    el('turn-left').addEventListener('click', function () {
      state.turntable = false;
      el('turn-spin').setAttribute('aria-pressed', 'false');
      previewActor.targetYaw -= Math.PI / 4;
    });
    el('turn-right').addEventListener('click', function () {
      state.turntable = false;
      el('turn-spin').setAttribute('aria-pressed', 'false');
      previewActor.targetYaw += Math.PI / 4;
    });
    el('turn-spin').addEventListener('click', function () {
      state.turntable = !state.turntable;
      el('turn-spin').setAttribute('aria-pressed', state.turntable ? 'true' : 'false');
      if (state.turntable) previewActor.targetYaw = previewActor.yaw;
    });

    refreshControls();

    T.whenReady(function () { /* glyphs rebuild against the pixel face */ });
    requestAnimationFrame(frame);

    window.__forge = state;

    if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
      window.claude.hot.snapshot(function () {
        return { character: state.character };
      });
    }
  }

  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
})();
