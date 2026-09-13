/* world.js — the test scene.
 *
 * Movement is velocity-based rather than position-based: input steers a
 * velocity, friction bleeds it off, and a hard direction change at speed costs
 * control instead of turning on a pin. Obstacles and villagers are solid, and
 * running into a villager fast enough puts them on the ground.
 */
(function (global) {
  'use strict';

  const R = global.Render;
  const T = global.Text;
  const CM = global.CharacterModel;
  const Rig = global.Rig;
  const D = global.Dialogue;

  const VIEW_W = 320, VIEW_H = 180;
  // Large enough that the camera can stay locked to the player without ever
  // running off the edge of the generated ground.
  const WORLD_W = 1200, WORLD_H = 800;

  // The same camera pitch as the forge preview at a fraction of its scale, so
  // a villager in the world is the forge model sized down rather than a
  // differently-proportioned one.
  const ACTOR_BUF = { w: 112, h: 104, ox: 56, oy: 80 };
  const CAM_PITCH = 0.26;
  const CAM_SCALE = 1.35;

  const SPEED = { walk: 52, run: 112, npc: 26 };
  const ACCEL = 520;           // px/s^2 while steering
  const SKID_ACCEL = 165;      // reduced authority through a hard turn
  const FRICTION = 420;        // px/s^2 once input stops
  const SKID_FRICTION = 150;   // you slide before you stop

  const PLAYER_R = 6.5;
  const NUDGE_SPEED = 30;      // above this, a bump visibly jostles you
  const TRIP_SPEED = 62;       // above this, an obstacle trips you
  const FALL_SPEED = 104;      // only a tree, at nearly full sprint, floors you
  const CHEST_H = 20;          // contact heights, in model units
  const SHIN_H = 7;
  const TALK_RANGE = 40;
  const COMFORT_RANGE = 24;

  const TEST_PAGES = ['test123 test123', 'test123 test123', 'test123 test123'];

  /* ---------- ground ---------- */

  const GRASS = ['#4a6b3a', '#53743f', '#456535', '#5c7d46', '#3f5c32'].map(function (h) {
    const c = R.hexToRgb(h);
    return R.pack(c[0], c[1], c[2]);
  });
  const DIRT = ['#7d6844', '#8a7450', '#6f5c3c', '#937d57'].map(function (h) {
    const c = R.hexToRgb(h);
    return R.pack(c[0], c[1], c[2]);
  });

  function pathCentre(x) {
    return WORLD_H * 0.6 + Math.sin(x * 0.008) * 48 + Math.sin(x * 0.028) * 9;
  }

  function buildGround(seed) {
    const rng = CM.makeRng(seed);
    const buf = new Uint32Array(WORLD_W * WORLD_H);

    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        const n = Math.sin(x * 0.09) * Math.cos(y * 0.11) + Math.sin((x + y) * 0.05) * 0.6;
        let idx = n > 0.8 ? 3 : n > 0.15 ? 1 : n > -0.5 ? 0 : 2;
        if (rng() < 0.05) idx = 4;
        buf[y * WORLD_W + x] = GRASS[idx];
      }
    }

    for (let x = 0; x < WORLD_W; x++) {
      const centre = pathCentre(x);
      const halfWidth = 14 + Math.sin(x * 0.02) * 3;
      for (let y = Math.floor(centre - halfWidth); y < centre + halfWidth; y++) {
        if (y < 0 || y >= WORLD_H) continue;
        const edge = Math.abs(y - centre) / halfWidth;
        if (edge > 0.86 && rng() < 0.55) continue;
        buf[y * WORLD_W + x] = DIRT[edge > 0.6 ? 2 : (rng() < 0.25 ? 1 : 0)];
      }
    }
    for (let y = 0; y < WORLD_H * 0.62; y++) {
      const centre = WORLD_W * 0.38 + Math.sin(y * 0.014) * 20;
      for (let x = Math.floor(centre - 10); x < centre + 10; x++) {
        if (x < 0 || x >= WORLD_W) continue;
        const edge = Math.abs(x - centre) / 10;
        if (edge > 0.8 && rng() < 0.5) continue;
        buf[y * WORLD_W + x] = DIRT[edge > 0.6 ? 2 : 0];
      }
    }

    for (let i = 0; i < 2600; i++) {
      const x = Math.floor(rng() * WORLD_W), y = Math.floor(rng() * WORLD_H);
      const isDirt = DIRT.indexOf(buf[y * WORLD_W + x]) >= 0;
      const c = isDirt ? DIRT[3] : GRASS[rng() < 0.5 ? 3 : 4];
      const len = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < len; k++) {
        const yy = y - k;
        if (yy >= 0) buf[yy * WORLD_W + x] = c;
      }
    }
    return buf;
  }

  /* ---------- props ---------- */

  const G = global.Geo;

  function renderBoxes(boxes, bufW, bufH, ox, oy, scale) {
    const target = R.createTarget(bufW, bufH);
    target.footY = oy;   // where the ground line sits inside the sprite
    R.clearTarget(target);
    const camera = R.makeCamera(CAM_PITCH, scale, ox, oy);
    const identity = R.identity();
    for (let i = 0; i < boxes.length; i++) {
      R.drawMesh(target, identity, boxes[i].mesh, R.ramp(boxes[i].colour), camera, {});
    }
    R.traceOutline(target, Rig.OUTLINE);
    return target;
  }

  function makeTree(rng) {
    const boxes = [];
    // Roughly three times a person, so running into one is obviously running
    // into something you cannot go over.
    const trunkH = 36 + rng() * 14;
    boxes.push({ mesh: G.slab(-2.4, 0, -2.4, 4.8, trunkH, 4.8, 0.62, 1), colour: '#4d3726' });
    const clumps = 7 + Math.floor(rng() * 4);
    for (let i = 0; i < clumps; i++) {
      const s = 8 + rng() * 6;
      const a = (i / clumps) * Math.PI * 2 + rng();
      const rad = i === 0 ? 0 : 4.5 + rng() * 4;
      boxes.push({
        mesh: G.superellipsoid(Math.cos(a) * rad, trunkH - 2 + rng() * 8 + s / 2, Math.sin(a) * rad,
          s / 2, s / 2, s / 2, 0.8, 4, 8),
        colour: rng() < 0.5 ? '#39572f' : '#2f4a28'
      });
    }
    return renderBoxes(boxes, 104, 136, 52, 128, CAM_SCALE);
  }

  function makeRock(rng) {
    const B = global.Parts.box;
    const boxes = [];
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const s = 3.5 + rng() * 4;
      boxes.push({
        mesh: G.superellipsoid((rng() - 0.5) * 4, rng() * 2 + s * 0.4, (rng() - 0.5) * 4,
          s / 2, s * 0.42, s / 2, 0.55, 4, 8),
        colour: rng() < 0.5 ? '#6d6a63' : '#5a5750'
      });
    }
    return renderBoxes(boxes, 44, 44, 22, 36, CAM_SCALE);
  }

  function makeBarrel() {
    const B = global.Parts.box;
    const boxes = [];
    // barrels bulge in the middle
    boxes.push({ mesh: G.superellipsoid(0, 4.2, 0, 3.6, 4.3, 3.6, 0.45, 5, 10), colour: '#6b4a2c' });
    boxes.push({ mesh: G.superellipsoid(0, 2.0, 0, 3.7, 0.55, 3.7, 0.4, 3, 10), colour: '#4a4038' });
    boxes.push({ mesh: G.superellipsoid(0, 6.4, 0, 3.7, 0.55, 3.7, 0.4, 3, 10), colour: '#4a4038' });
    return renderBoxes(boxes, 40, 48, 20, 40, CAM_SCALE);
  }

  function makeCart() {
    const B = global.Parts.box;
    const boxes = [];
    boxes.push({ mesh: B(-9, 4.5, -5, 18, 3.5, 10), colour: '#6b4f31' });
    boxes.push({ mesh: B(-9, 8, -5, 18, 2.5, 1), colour: '#5a4128' });
    boxes.push({ mesh: B(-9, 8, 4, 18, 2.5, 1), colour: '#5a4128' });
    for (let i = 0; i < 2; i++) {
      const z = i === 0 ? -5.5 : 5.5;
      // round cartwheels
      boxes.push({ mesh: G.superellipsoid(-9, 4.4, z, 0.9, 4.4, 4.4, 0.95, 4, 10), colour: '#43301e' });
      boxes.push({ mesh: G.superellipsoid(9, 4.4, z, 0.9, 4.4, 4.4, 0.95, 4, 10), colour: '#43301e' });
    }
    return renderBoxes(boxes, 72, 60, 36, 48, CAM_SCALE);
  }

  /* ---------- world construction ---------- */

  function createWorld(playerCharacter, seed) {
    seed = seed === undefined ? 20260913 : seed;
    const rng = CM.makeRng(seed);

    const world = {
      w: WORLD_W, h: WORLD_H,
      ground: buildGround(seed),
      props: [],
      actors: [],
      camX: 0, camY: 0,
      box: D.create(),
      talkingTo: null,
      prompt: null,
      input: { dx: 0, dy: 0, sprint: false },
      seed: seed
    };

    const treeSprites = [makeTree(rng), makeTree(rng), makeTree(rng), makeTree(rng)];
    const rockSprites = [makeRock(rng), makeRock(rng)];
    const barrelSprite = makeBarrel();
    const cartSprite = makeCart();

    // `tall` decides what happens when you hit it at speed: you go over a low
    // obstacle, you bounce off a tall one.
    function addProp(sprite, x, y, r, tall) {
      world.props.push({
        sprite: sprite, x: x, y: y, footY: sprite.footY, r: r,
        shadowR: r * 1.5, tall: !!tall
      });
    }

    for (let i = 0; i < 34; i++) {
      const x = 40 + rng() * (WORLD_W - 80);
      const y = 40 + rng() * (WORLD_H - 80);
      if (Math.abs(y - pathCentre(x)) < 36) continue; // keep the road clear
      addProp(treeSprites[Math.floor(rng() * treeSprites.length)], x, y, 6, true);
    }
    for (let i = 0; i < 22; i++) {
      addProp(rockSprites[Math.floor(rng() * rockSprites.length)],
        40 + rng() * (WORLD_W - 80), 40 + rng() * (WORLD_H - 80), 4.5, false);
    }
    addProp(cartSprite, WORLD_W * 0.46, pathCentre(WORLD_W * 0.46) - 26, 10, false);
    addProp(barrelSprite, WORLD_W * 0.42, WORLD_H * 0.5, 4, false);
    addProp(barrelSprite, WORLD_W * 0.435, WORLD_H * 0.52, 4, false);
    addProp(barrelSprite, WORLD_W * 0.415, WORLD_H * 0.535, 4, false);

    /* player */
    const player = Rig.createActor(playerCharacter, WORLD_W * 0.4, WORLD_H * 0.55, 1);
    player.isPlayer = true;
    player.buffer = R.createTarget(ACTOR_BUF.w, ACTOR_BUF.h);
    world.actors.push(player);
    world.player = player;

    /* villagers */
    for (let i = 0; i < 8; i++) {
      const ch = CM.randomCharacter(rng);
      const a = Rig.createActor(ch,
        player.x + (rng() - 0.5) * 420, player.y + (rng() - 0.5) * 280,
        (seed + i * 977) >>> 0);
      a.buffer = R.createTarget(ACTOR_BUF.w, ACTOR_BUF.h);
      a.brain = { state: 'pause', timer: 0.5 + rng() * 2.5, dirIndex: Math.floor(rng() * 8),
        gestureCooldown: rng() * 5 };
      world.actors.push(a);
    }

    return world;
  }

  /* ---------- helpers ---------- */

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // The player is held inside the region where the camera can stay centred on
  // them without showing anything outside the generated ground.
  // The camera is locked to the player, so the player has to stay inside the
  // region where a full viewport of generated ground exists around them.
  // Letting them past that edge leaves blank bands on screen.
  function clampPlayer(a) {
    a.x = Math.max(VIEW_W / 2, Math.min(WORLD_W - VIEW_W / 2, a.x));
    a.y = Math.max(VIEW_H / 2, Math.min(WORLD_H - VIEW_H / 2, a.y));
  }

  function clampVillager(a) {
    a.x = Math.max(20, Math.min(WORLD_W - 20, a.x));
    a.y = Math.max(26, Math.min(WORLD_H - 14, a.y));
  }

  /* ---------- collision ---------- */

  // Pushes `a` out of any prop it overlaps. Returns the worst closing speed and
  // the prop that caused it, so the caller can decide how hard to react.
  function resolvePropCollisions(world, a, radius) {
    let worst = 0, hit = null, hx = 0, hy = 0;
    for (let i = 0; i < world.props.length; i++) {
      const p = world.props[i];
      const dx = a.x - p.x, dy = (a.y - p.y) * 1.6; // props are wider than deep
      const dist = Math.hypot(dx, dy);
      const min = radius + p.r;
      if (dist >= min || dist === 0) continue;

      const nx = dx / dist, ny = dy / dist;
      const push = min - dist;
      a.x += nx * push;
      a.y += ny * push / 1.6;

      const into = -(a.vx * nx + a.vy * ny);
      if (into > 0) {
        if (into > worst) { worst = into; hit = p; hx = nx; hy = ny / 1.6; }
        // kill the component heading into the obstacle, bleed the rest
        a.vx += nx * into;
        a.vy += ny * into;
        a.vx *= 0.55;
        a.vy *= 0.55;
      }
    }
    return { speed: worst, prop: hit, nx: hx, ny: hy };
  }

  // Everything that happens to the player when they run into scenery.
  function reactToProp(player, impact) {
    if (!impact.prop || impact.speed < NUDGE_SPEED) return;
    if (player.hitCooldown > 0) return;
    player.hitCooldown = 0.4;
    const n = impact;
    const tall = impact.prop.tall;

    if (tall && impact.speed > FALL_SPEED) {
      // Hitting a tree at nearly full sprint is the one thing that actually
      // puts the player on the ground.
      Rig.knockDown(player, n.nx, n.ny, 3.2 + impact.speed / 40);
      player.vx = n.nx * impact.speed * 0.2;
      player.vy = n.ny * impact.speed * 0.2;
      return;
    }

    if (impact.speed > TRIP_SPEED) {
      // Anything knee-high catches your legs and pitches you over the top of
      // it; a tree stops you dead and you stumble back off it. Either way you
      // stay on your feet.
      if (tall) Rig.trip(player, n.nx, n.ny, 2.6 + impact.speed / 48);
      else Rig.trip(player, -n.nx, -n.ny, 2.8 + impact.speed / 44);
      return;
    }

    Rig.nudge(player, n.nx, n.ny, 0.7 + impact.speed / 90, tall ? CHEST_H : SHIN_H);
  }

  function resolveActorCollisions(world) {
    const player = world.player;
    for (let i = 1; i < world.actors.length; i++) {
      const a = world.actors[i];
      if (Rig.isDown(a) && Rig.isDown(player)) continue;

      const dx = a.x - player.x, dy = (a.y - player.y) * 1.5;
      const dist = Math.hypot(dx, dy);
      const min = PLAYER_R + 7;
      if (dist >= min || dist === 0) continue;

      const nx = dx / dist, ny = dy / dist / 1.5;
      const speed = Math.hypot(player.vx, player.vy);

      // Push apart first, so nobody ends up standing inside anybody.
      const push = (min - dist) * 0.5;
      a.x += nx * push; a.y += ny * push;
      player.x -= nx * push; player.y -= ny * push;

      // Running into someone moves them out of the way. The body takes a
      // small knock at the height it was hit, but the reaction you actually
      // read is the displacement — a person rooted to the spot waving their
      // limbs looks like a flail however the limbs are tuned.
      if (speed > NUDGE_SPEED && !Rig.isDown(a) && a.hitCooldown <= 0) {
        if (speed > FALL_SPEED) {
          // flat out: they go over
          Rig.knockDown(a, nx, ny, 2.4 + speed / 38);
          if (a.brain) { a.brain.state = 'downed'; a.brain.timer = 0; }
        } else if (speed > TRIP_SPEED) {
          // a proper shoulder charge: they stagger several steps away
          Rig.stumble(a, nx, ny, 70 + speed * 0.5, 0.7);
          Rig.nudge(a, nx, ny, 1.0, CHEST_H);
        } else {
          // a bump in passing: they step aside
          Rig.shove(a, nx, ny, 14 + speed * 0.18);
          Rig.nudge(a, nx, ny, 0.6, CHEST_H);
        }
        a.hitCooldown = 0.45;
        if (world.talkingTo === a) D.close(world.box);

        // The player brushes past or stumbles; they never flail.
        if (speed > TRIP_SPEED) {
          Rig.stumble(player, -nx, -ny, 20, 0.4);
          Rig.nudge(player, -nx, -ny, 0.7, CHEST_H);
          player.vx *= 0.62;
          player.vy *= 0.62;
        } else {
          player.vx *= 0.88;
          player.vy *= 0.88;
        }
        player.hitCooldown = 0.45;
      }
    }
  }

  /* ---------- player ---------- */

  function updatePlayer(world, dt) {
    const p = world.player;
    const locked = world.box.open || Rig.isDown(p);
    const input = world.input;
    let dx = locked ? 0 : input.dx;
    let dy = locked ? 0 : input.dy;

    const speed = Math.hypot(p.vx, p.vy);
    let sliding = false;

    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;

      // How much of the current motion agrees with where the player now wants
      // to go. Reversing at speed means sliding, not pivoting.
      const agree = speed > 4 ? (p.vx * dx + p.vy * dy) / speed : 1;
      sliding = speed > SPEED.walk * 1.2 && agree < 0.25;

      const target = input.sprint ? SPEED.run : SPEED.walk;
      const accel = sliding ? SKID_ACCEL : ACCEL;
      const tx = dx * target, ty = dy * target;
      const ax = tx - p.vx, ay = ty - p.vy;
      const mag = Math.hypot(ax, ay);
      if (mag > 0) {
        const step = Math.min(mag, accel * dt);
        p.vx += (ax / mag) * step;
        p.vy += (ay / mag) * step;
      }
      // face the way you are steering, but hold your facing through a skid
      if (!sliding) p.targetYaw = Rig.snapToEight(dx, dy);
    } else if (speed > 0) {
      const decel = (speed > SPEED.walk * 1.25 ? SKID_FRICTION : FRICTION) * dt;
      const next = Math.max(0, speed - decel);
      p.vx = (p.vx / speed) * next;
      p.vy = (p.vy / speed) * next;
      sliding = speed > SPEED.walk * 1.3;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    Rig.applyShove(p, dt);

    const impact = resolvePropCollisions(world, p, PLAYER_R);
    reactToProp(p, impact);
    clampPlayer(p);

    // Sliding to a halt uses the still pose. A dedicated skid animation read as
    // a jumble at this size, and legs pumping while you slide backwards looks
    // worse than legs that have simply stopped.
    const nowSpeed = Math.hypot(p.vx, p.vy);
    if (Rig.isDown(p)) p.gait = 'idle';
    else if (p.stumbleTime > 0) p.gait = 'walk';
    else if (sliding) p.gait = 'idle';
    else if (nowSpeed > SPEED.walk * 1.25) p.gait = 'run';
    else if (nowSpeed > 6) p.gait = 'walk';
    else p.gait = 'idle';

    Rig.updateActorMotion(p, dt);
  }

  /* ---------- villagers ---------- */

  /* A villager standing about picks something to do now and then: waving at a
   * neighbour, flinching from someone sprinting at them, or just shifting a
   * load. These are the only thing besides eyes and mouth that moves a
   * standing character, and they read as intent rather than as drift. */
  function chooseGesture(world, a) {
    const player = world.player;
    const playerSpeed = Math.hypot(player.vx, player.vy);
    if (playerSpeed > TRIP_SPEED && distance(a, player) < 76) return 'fear';

    for (let i = 1; i < world.actors.length; i++) {
      const other = world.actors[i];
      if (other === a || Rig.isDown(other)) continue;
      if (distance(a, other) < 74) return a.rng() < 0.5 ? 'wave' : 'greet';
    }
    const idle = ['ponder', 'carry', 'laugh', 'greet'];
    return idle[Math.floor(a.rng() * idle.length)];
  }

  function updateVillager(world, a, dt) {
    const brain = a.brain;
    const player = world.player;

    Rig.applyShove(a, dt);

    // Shoved hard enough to have to catch themselves: they walk it off,
    // facing the way they are being pushed.
    if (a.stumbleTime > 0 && !Rig.isDown(a)) {
      a.gesture = null;
      a.gait = 'walk';
      if (a.shoveX || a.shoveY) a.targetYaw = Rig.yawForDirection(a.shoveX, a.shoveY);
      clampVillager(a);
      Rig.updateActorMotion(a, dt);
      if (brain.state === 'wander' || brain.state === 'pause') brain.timer = 0.5 + a.rng();
      return;
    }

    // While down, the ragdoll itself moves the body — it hands its drift back
    // to the actor position each step, so nothing else should push it.
    if (Rig.isDown(a)) {
      a.vx = 0; a.vy = 0;
      a.gait = 'idle';
      brain.state = 'downed';
      Rig.updateActorMotion(a, dt);
      clampVillager(a);
      return;
    }
    if (brain.state === 'downed') {
      // just got back up — shake it off before wandering again
      brain.state = 'pause';
      brain.timer = 0.7 + a.rng() * 1.2;
      a.vx = 0; a.vy = 0;
    }

    if (brain.state === 'approach' || brain.state === 'face' || brain.state === 'talk') {
      const d = distance(a, player);
      const dx = player.x - a.x, dy = player.y - a.y;
      a.targetYaw = Rig.yawForDirection(dx, dy);

      if (brain.state === 'approach') {
        if (d > COMFORT_RANGE) {
          const len = Math.hypot(dx, dy) || 1;
          a.x += (dx / len) * SPEED.npc * dt;
          a.y += (dy / len) * SPEED.npc * dt;
          a.gait = 'walk';
          clampVillager(a);
        } else {
          brain.state = 'face';
          a.gait = 'idle';
        }
      } else {
        a.gait = 'idle';
      }

      if (brain.state === 'face' && Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 0.25) {
        brain.state = 'talk';
        beginConversation(world, a);
      }
      Rig.updateActorMotion(a, dt);
      return;
    }

    brain.timer -= dt;
    if (brain.state === 'pause') {
      a.gait = 'idle';

      brain.gestureCooldown = (brain.gestureCooldown || 0) - dt;
      if (!a.gesture && brain.gestureCooldown <= 0 && a.rng() < 0.55) {
        Rig.startGesture(a, chooseGesture(world, a));
        brain.gestureCooldown = 3.5 + a.rng() * 6;
        brain.timer = Math.max(brain.timer, a.gesture.duration + 0.4);
      }

      if (brain.timer <= 0) {
        brain.state = 'wander';
        brain.timer = 1.2 + a.rng() * 3.2;
        brain.dirIndex = Math.floor(a.rng() * 8);
      }
    } else if (brain.state === 'wander') {
      a.gesture = null;
      const dir = Rig.DIRECTIONS[brain.dirIndex];
      a.targetYaw = Rig.yawForDirection(dir.dx, dir.dy);
      if (Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 0.5) {
        a.x += dir.dx * SPEED.npc * dt;
        a.y += dir.dy * SPEED.npc * dt;
        const bx = a.x, by = a.y;
        resolvePropCollisions(world, a, 6);
        clampVillager(a);
        if (Math.abs(a.x - bx) > 0.01 || Math.abs(a.y - by) > 0.01) brain.timer = 0;
      }
      a.gait = 'walk';
      if (brain.timer <= 0) { brain.state = 'pause'; brain.timer = 0.8 + a.rng() * 3.5; }
    }
    Rig.updateActorMotion(a, dt);
  }

  /* ---------- conversation ---------- */

  function beginConversation(world, npc) {
    npc.speaking = true;
    world.talkingTo = npc;
    D.start(world.box, TEST_PAGES, npc.character.name, {
      onLetter: function (letter) {
        npc.viseme = letter ? CM.visemeForLetter(letter) : 'rest';
      },
      onClose: function () {
        npc.speaking = false;
        npc.viseme = 'rest';
        if (npc.brain.state !== 'downed') {
          npc.brain.state = 'pause';
          npc.brain.timer = 1.0 + npc.rng() * 2.0;
        }
        world.talkingTo = null;
      }
    });
  }

  function nearestTalkable(world) {
    let best = null, bestD = TALK_RANGE;
    for (let i = 1; i < world.actors.length; i++) {
      const a = world.actors[i];
      if (Rig.isDown(a) || a.brain.state === 'downed') continue;
      const d = distance(a, world.player);
      if (d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  // Bound to E / Enter. Returns true if it did something.
  function tryTalk(world) {
    if (world.box.open) { D.advance(world.box); return true; }
    if (Rig.isDown(world.player)) return false;
    const npc = nearestTalkable(world);
    if (!npc) return false;
    npc.brain.state = distance(npc, world.player) > COMFORT_RANGE ? 'approach' : 'face';
    world.player.targetYaw = Rig.snapToEight(npc.x - world.player.x, npc.y - world.player.y);
    world.player.vx = 0; world.player.vy = 0;
    return true;
  }

  function update(world, dt) {
    updatePlayer(world, dt);
    for (let i = 1; i < world.actors.length; i++) updateVillager(world, world.actors[i], dt);
    resolveActorCollisions(world);
    D.update(world.box, dt);

    world.prompt = world.box.open ? null : nearestTalkable(world);

    // Locked to the player at all times — no easing, no edge clamping. It
    // follows the *rounded* player position, which lands the player sprite on
    // the same exact pixel every frame; tracking the unrounded position makes
    // them jitter a pixel back and forth as they walk.
    world.camX = Math.round(world.player.x) - (VIEW_W >> 1);
    world.camY = Math.round(world.player.y) - (VIEW_H >> 1);
  }

  /* ---------- drawing ---------- */

  const SHADOW = R.pack(26, 40, 26);
  const LABEL = R.pack(238, 232, 216);
  const LABEL_SHADOW = R.pack(20, 22, 28);
  const PROMPT = R.pack(232, 198, 116);

  function drawGround(world, target) {
    const cx = world.camX, cy = world.camY;
    for (let y = 0; y < VIEW_H; y++) {
      const sy = cy + y;
      if (sy < 0 || sy >= WORLD_H) continue;
      const srow = sy * WORLD_W;
      const trow = y * VIEW_W;
      for (let x = 0; x < VIEW_W; x++) {
        const sx = cx + x;
        if (sx < 0 || sx >= WORLD_W) continue;
        target.colour[trow + x] = world.ground[srow + sx];
      }
    }
  }

  function draw(world, target, camera) {
    R.clearTarget(target);
    drawGround(world, target);

    const cx = world.camX, cy = world.camY;
    const drawables = [];

    for (let i = 0; i < world.props.length; i++) {
      const p = world.props[i];
      if (p.x - cx < -60 || p.x - cx > VIEW_W + 60 || p.y - cy < -110 || p.y - cy > VIEW_H + 60) continue;
      drawables.push({ y: p.y, prop: p });
    }
    for (let i = 0; i < world.actors.length; i++) {
      const a = world.actors[i];
      if (a.x - cx < -70 || a.x - cx > VIEW_W + 70 || a.y - cy < -110 || a.y - cy > VIEW_H + 70) continue;
      drawables.push({ y: a.y, actor: a });
    }
    drawables.sort(function (a, b) { return a.y - b.y; });

    for (let i = 0; i < drawables.length; i++) {
      const d = drawables[i];
      if (d.prop) {
        const p = d.prop;
        R.fillEllipse(target, Math.round(p.x) - cx, Math.round(p.y) - cy,
          p.shadowR, p.shadowR * 0.4, SHADOW, 0.3);
        R.blit(target, p.sprite, Math.round(p.x) - cx - Math.round(p.sprite.w / 2),
          Math.round(p.y) - cy - p.footY);
      } else {
        const a = d.actor;
        const down = Rig.isDown(a) ? 1 : 0;
        R.fillEllipse(target, Math.round(a.x) - cx, Math.round(a.y) - cy,
          7 + down * 7, 3 + down * 2, SHADOW, 0.34);
        Rig.renderActor(a, a.buffer, camera, {});
        R.blit(target, a.buffer, Math.round(a.x) - cx - ACTOR_BUF.ox, Math.round(a.y) - cy - ACTOR_BUF.oy);
      }
    }

    // name plate and the talk prompt for whoever is in reach
    const npc = world.prompt;
    if (npc) {
      const name = npc.character.name;
      const nx = Math.round(npc.x) - cx - Math.round(T.measure(name) / 2);
      const ny = Math.round(npc.y) - cy - 58;
      T.drawShadowed(target, name, nx, ny, LABEL, LABEL_SHADOW);
      const hint = 'E  talk';
      T.drawShadowed(target, hint, Math.round(npc.x) - cx - Math.round(T.measure(hint) / 2),
        ny - 11, PROMPT, LABEL_SHADOW);
    }

    D.draw(world.box, target);
  }

  global.World = {
    VIEW_W, VIEW_H, WORLD_W, WORLD_H, ACTOR_BUF, CAM_PITCH, CAM_SCALE,
    SPEED, TALK_RANGE, NUDGE_SPEED, TRIP_SPEED, FALL_SPEED, TEST_PAGES,
    createWorld, update, draw, tryTalk, nearestTalkable, distance, beginConversation
  };
})(window);
