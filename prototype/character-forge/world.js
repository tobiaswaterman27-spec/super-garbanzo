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

  // The field of view in world units, and how many art pixels each unit gets.
  // Raising PIXEL makes the pixels smaller and more numerous — finer pixel
  // art, same amount of world on screen.
  const VIEW_W = 320, VIEW_H = 180;
  const PIXEL = 3;
  const RENDER_W = VIEW_W * PIXEL, RENDER_H = VIEW_H * PIXEL;
  // Large enough that the camera can stay locked to the player without ever
  // running off the edge of the generated ground.
  const WORLD_W = 1200, WORLD_H = 800;
  const GROUND_W = WORLD_W * PIXEL, GROUND_H = WORLD_H * PIXEL;

  // The same camera pitch as the forge preview at a fraction of its scale, so
  // a villager in the world is the forge model sized down rather than a
  // differently-proportioned one.
  const ACTOR_BUF = {
    w: 112 * PIXEL, h: 104 * PIXEL, ox: 56 * PIXEL, oy: 80 * PIXEL
  };
  const CAM_PITCH = 0.26;
  const CAM_SCALE = 1.35 * PIXEL;

  const SPEED = { walk: 52, run: 112, npc: 26 };
  const ACCEL = 520;           // px/s^2 while steering
  const SKID_ACCEL = 165;      // reduced authority through a hard turn
  const FRICTION = 680;        // px/s^2 once input stops
  const SKID_FRICTION = 380;   // a short slide, not a long one

  const PLAYER_R = 6.5;
  const NUDGE_SPEED = 30;      // above this, a bump visibly jostles you
  const TRIP_SPEED = 62;       // above this, an obstacle trips you
  const FALL_SPEED = 104;      // only a tree, at nearly full sprint, floors you
  const CHEST_H = 20;          // contact heights, in model units
  const TALK_RANGE = 40;
  const CHAT_RANGE = 62;       // how close two villagers get talking
  const GREET_RANGE = 70;
  const COMFORT_RANGE = 24;

  const TEST_PAGES = ['test123 test123', 'test123 test123', 'test123 test123'];

  /* ---------- ground ---------- */

  const GRASS = ['#4a6b3a', '#53743f', '#456535', '#5c7d46', '#3f5c32'];
  const DIRT = ['#7d6844', '#8a7450', '#6f5c3c', '#937d57'];

  // One flat palette so the ground can be stored as one byte per pixel. At
  // three pixels per world unit a full-colour buffer would be 34MB.
  const GROUND_PALETTE = GRASS.concat(DIRT).map(function (h) {
    const c = R.hexToRgb(h);
    return R.pack(c[0], c[1], c[2]);
  });
  const DIRT0 = GRASS.length;

  function pathCentre(x) {
    return WORLD_H * 0.6 + Math.sin(x * 0.008) * 48 + Math.sin(x * 0.028) * 9;
  }

  function buildGround(seed) {
    const rng = CM.makeRng(seed);
    const buf = new Uint8Array(GROUND_W * GROUND_H);
    const inv = 1 / PIXEL;

    for (let py = 0; py < GROUND_H; py++) {
      const y = py * inv;
      const row = py * GROUND_W;
      for (let px = 0; px < GROUND_W; px++) {
        const x = px * inv;
        const n = Math.sin(x * 0.09) * Math.cos(y * 0.11) + Math.sin((x + y) * 0.05) * 0.6;
        let idx = n > 0.8 ? 3 : n > 0.15 ? 1 : n > -0.5 ? 0 : 2;
        if (rng() < 0.05) idx = 4;
        buf[row + px] = idx;
      }
    }

    // the road, and the track running north off it
    for (let px = 0; px < GROUND_W; px++) {
      const x = px * inv;
      const centre = pathCentre(x);
      const halfWidth = 14 + Math.sin(x * 0.02) * 3;
      const from = Math.floor((centre - halfWidth) * PIXEL);
      const to = Math.ceil((centre + halfWidth) * PIXEL);
      for (let py = from; py < to; py++) {
        if (py < 0 || py >= GROUND_H) continue;
        const edge = Math.abs(py * inv - centre) / halfWidth;
        if (edge > 0.86 && rng() < 0.55) continue;
        buf[py * GROUND_W + px] = DIRT0 + (edge > 0.6 ? 2 : (rng() < 0.25 ? 1 : 0));
      }
    }
    for (let py = 0; py < GROUND_H * 0.62; py++) {
      const y = py * inv;
      const centre = WORLD_W * 0.38 + Math.sin(y * 0.014) * 20;
      const from = Math.floor((centre - 10) * PIXEL), to = Math.ceil((centre + 10) * PIXEL);
      for (let px = from; px < to; px++) {
        if (px < 0 || px >= GROUND_W) continue;
        const edge = Math.abs(px * inv - centre) / 10;
        if (edge > 0.8 && rng() < 0.5) continue;
        buf[py * GROUND_W + px] = DIRT0 + (edge > 0.6 ? 2 : 0);
      }
    }

    // tufts and pebbles, now at the finer pixel size
    for (let i = 0; i < 2600 * PIXEL; i++) {
      const px = Math.floor(rng() * GROUND_W), py = Math.floor(rng() * GROUND_H);
      const on = buf[py * GROUND_W + px];
      const c = on >= DIRT0 ? DIRT0 + 3 : (rng() < 0.5 ? 3 : 4);
      const len = 1 + Math.floor(rng() * 2 * PIXEL);
      for (let k = 0; k < len; k++) {
        const yy = py - k;
        if (yy >= 0) buf[yy * GROUND_W + px] = c;
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
    const trunkH = 34 + rng() * 13;
    const tw = 7.6 + rng() * 1.6;                 // a trunk you clearly cannot pass
    boxes.push({ mesh: G.slab(-tw / 2, 0, -tw / 2, tw, trunkH, tw, 0.62, 1), colour: '#4d3726' });
    // a flare at the base so it meets the ground like a tree, not a post
    boxes.push({
      mesh: G.taper(-(tw + 2.6) / 2, 0, -(tw + 2.6) / 2, tw + 2.6, 5.5, tw + 2.6, 0.72),
      colour: '#42301f'
    });

    /* Canopy: two rings of clumps plus a crown, so the top reads as a mass of
     * leaves rather than a handful of separate blobs. The lower ring is
     * pushed out and down to give the silhouette a wide, heavy skirt. */
    const dark = ['#2f4a28', '#274123', '#345127'];
    const light = ['#3d5f31', '#446a36', '#39572f'];
    function clump(x, y, z, s, lit) {
      boxes.push({
        mesh: G.superellipsoid(x, y, z, s / 2, s / 2 * 0.86, s / 2, 0.78, 5, 10),
        colour: (lit ? light : dark)[Math.floor(rng() * 3)]
      });
    }
    // Each clump is wider than the gap to its neighbour, so the ring reads as
    // one mass of foliage. Spaced any further and you just see the individual
    // balls the canopy is built from.
    const base = trunkH - 3;
    const lower = 7 + Math.floor(rng() * 2);
    for (let i = 0; i < lower; i++) {
      const a = (i / lower) * Math.PI * 2 + rng() * 0.4;
      const rad = 8.5 + rng() * 1.8;
      const s = 15 + rng() * 4;
      clump(Math.cos(a) * rad, base + 1 + rng() * 2, Math.sin(a) * rad, s, false);
    }
    const upper = 6;
    for (let i = 0; i < upper; i++) {
      const a = (i / upper) * Math.PI * 2 + rng() * 0.4 + 0.5;
      const rad = 5 + rng() * 1.8;
      const s = 14 + rng() * 4;
      clump(Math.cos(a) * rad, base + 8 + rng() * 2.5, Math.sin(a) * rad, s, rng() < 0.65);
    }
    // crown, and a filler under it so the two rings never show daylight
    clump(0, base + 5, 0, 16 + rng() * 2, false);
    clump(rng() * 2 - 1, base + 14 + rng() * 2, rng() * 2 - 1, 14 + rng() * 3, true);
    return renderBoxes(boxes, 128 * PIXEL, 168 * PIXEL, 64 * PIXEL, 158 * PIXEL, CAM_SCALE);
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
    return renderBoxes(boxes, 44 * PIXEL, 44 * PIXEL, 22 * PIXEL, 36 * PIXEL, CAM_SCALE);
  }

  function makeBarrel() {
    const B = global.Parts.box;
    const boxes = [];
    // barrels bulge in the middle
    boxes.push({ mesh: G.superellipsoid(0, 4.2, 0, 3.6, 4.3, 3.6, 0.45, 5, 10), colour: '#6b4a2c' });
    boxes.push({ mesh: G.superellipsoid(0, 2.0, 0, 3.7, 0.55, 3.7, 0.4, 3, 10), colour: '#4a4038' });
    boxes.push({ mesh: G.superellipsoid(0, 6.4, 0, 3.7, 0.55, 3.7, 0.4, 3, 10), colour: '#4a4038' });
    return renderBoxes(boxes, 40 * PIXEL, 48 * PIXEL, 20 * PIXEL, 40 * PIXEL, CAM_SCALE);
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
    return renderBoxes(boxes, 72 * PIXEL, 60 * PIXEL, 36 * PIXEL, 48 * PIXEL, CAM_SCALE);
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
    function addProp(sprite, x, y, r, tall, tree) {
      world.props.push({
        sprite: sprite, x: x, y: y, footY: sprite.footY, r: r,
        shadowR: r * 1.5, tall: !!tall, tree: !!tree
      });
    }

    for (let i = 0; i < 34; i++) {
      const x = 40 + rng() * (WORLD_W - 80);
      const y = 40 + rng() * (WORLD_H - 80);
      if (Math.abs(y - pathCentre(x)) < 36) continue; // keep the road clear
      addProp(treeSprites[Math.floor(rng() * treeSprites.length)], x, y, 7.5, true, true);
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
        gestureCooldown: rng() * 5, partner: null, chatCooldown: rng() * 8 };
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

  /* Everything that happens to the player when they run into scenery.
   *
   * The player never plays a hit reaction on the body — no arm swing, no
   * jostle. Watching your own character's arms wobble every time you clip a
   * barrel reads as a glitch, not as impact. What the player feels is the
   * movement: you are stopped, turned off the thing, or put on the floor.
   * A tree at full sprint is the one and only thing that floors you. */
  function reactToProp(player, impact) {
    if (!impact.prop || impact.speed < NUDGE_SPEED) return;
    if (player.hitCooldown > 0) return;
    player.hitCooldown = 0.4;
    const n = impact;

    if (impact.prop.tree && impact.speed > FALL_SPEED) {
      // Full throttle into a tree. The only thing in the game that floors you.
      Rig.knockDown(player, n.nx, n.ny, 3.2 + impact.speed / 40);
      player.vx = n.nx * impact.speed * 0.2;
      player.vy = n.ny * impact.speed * 0.2;
      return;
    }

    if (impact.speed > TRIP_SPEED) {
      if (impact.prop.tall) {
        // Clipping a trunk turns you off it and kills the run.
        Rig.shove(player, n.nx, n.ny, 26 + impact.speed * 0.28);
      } else {
        // Something knee-high: a short stumble and you pull up at it.
        Rig.stumble(player, n.nx, n.ny, 14, 0.5);
      }
    }
  }

  /* Villagers are solid to each other, not just to the player. Without this
   * two of them walking the same line simply occupy the same spot and you
   * watch one body slide through the other. No reaction, no knockdown — they
   * just cannot share the ground. */
  function separateVillagers(world) {
    const list = world.actors;
    for (let i = 1; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.x - a.x, dy = (b.y - a.y) * 1.5;
        const dist = Math.hypot(dx, dy);
        const min = 13;
        if (dist >= min) continue;

        let nx, ny;
        if (dist < 1e-4) {
          // exactly coincident: pick a side off their index so they don't
          // jitter against each other forever
          nx = (i % 2) ? 1 : -1; ny = 0;
        } else {
          nx = dx / dist; ny = dy / dist / 1.5;
        }
        // A body on the floor is dead weight — the one still standing steps
        // around it rather than shoving it along the ground.
        const aDown = Rig.isDown(a), bDown = Rig.isDown(b);
        if (aDown && bDown) continue;
        const push = (min - dist) * 0.5;
        const wa = bDown ? 1 : aDown ? 0 : 0.5;
        const wb = 1 - wa;
        a.x -= nx * push * wa * 2; a.y -= ny * push * wa * 2;
        b.x += nx * push * wb * 2; b.y += ny * push * wb * 2;
      }
    }
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

        // The player brushes past or stumbles. No reaction is played on their
        // body at all — only where they end up changes.
        if (speed > TRIP_SPEED) {
          Rig.stumble(player, -nx, -ny, 20, 0.4);
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

  /* ---------- villagers talking to each other ---------- */

  // Mouth shapes for someone mid-sentence. There are no words behind it; at
  // this scale a plausible run of shapes is indistinguishable from one.
  const BABBLE = 'aeioumbpflstrwdnkgh';

  function babble(a) {
    a.speaking = true;
    a.viseme = CM.visemeForLetter(BABBLE[Math.floor(a.animTime * 7) % BABBLE.length]);
  }

  function hush(a) {
    a.speaking = false;
    a.viseme = 'rest';
  }

  function startChat(a, b) {
    const length = 9 + a.rng() * 12;
    [[a, b], [b, a]].forEach(function (pair, i) {
      const self = pair[0];
      self.brain.state = 'chatting';
      self.brain.partner = pair[1];
      self.brain.chatTimer = length;
      self.brain.turnTimer = 1.5 + a.rng() * 1.6;
      self.brain.speakingTurn = i === 0;
      self.gesture = null;
    });
  }

  function endChat(a, cooldown) {
    const partner = a.brain.partner;
    [a, partner].forEach(function (self) {
      if (!self) return;
      hush(self);
      self.brain.partner = null;
      self.brain.chatCooldown = cooldown === undefined ? 12 + self.rng() * 18 : cooldown;
      if (self.brain.state === 'chatting') {
        self.brain.state = 'pause';
        self.brain.timer = 0.6 + self.rng() * 1.5;
      }
    });
  }

  function updateChat(world, a, dt) {
    const brain = a.brain;
    const partner = brain.partner;

    // anything that breaks the pair breaks the conversation
    if (!partner || Rig.isDown(partner) || partner.brain.partner !== a ||
        distance(a, partner) > CHAT_RANGE * 1.8) {
      endChat(a, 4);
      return;
    }

    a.gait = 'idle';
    a.targetYaw = Rig.yawForDirection(partner.x - a.x, partner.y - a.y);

    brain.turnTimer -= dt;
    if (brain.turnTimer <= 0) {
      // hand the floor over
      brain.speakingTurn = !brain.speakingTurn;
      partner.brain.speakingTurn = !brain.speakingTurn;
      brain.turnTimer = partner.brain.turnTimer = 1.5 + a.rng() * 1.8;
    }

    if (brain.speakingTurn) {
      babble(a);
      if (!a.gesture && a.rng() < 0.004) Rig.startGesture(a, 'laugh');
    } else {
      hush(a);
      // listening: the odd nod or laugh, not constant motion
      if (!a.gesture && a.rng() < 0.006) {
        Rig.startGesture(a, a.rng() < 0.4 ? 'laugh' : 'greet');
      }
    }

    brain.chatTimer -= dt;
    if (brain.chatTimer <= 0) {
      Rig.startGesture(a, 'greet');
      endChat(a);
    }
  }

  // Villagers only gesture for a reason: they wave at someone arriving, and
  // they flinch at someone sprinting at them. Nothing fires at random.
  function reactiveGesture(world, a, dt) {
    const brain = a.brain;
    brain.gestureCooldown = (brain.gestureCooldown || 0) - dt;
    if (a.gesture || brain.gestureCooldown > 0) return;

    const player = world.player;
    if (Math.hypot(player.vx, player.vy) > TRIP_SPEED && distance(a, player) < 76) {
      Rig.startGesture(a, 'fear');
      brain.gestureCooldown = 4 + a.rng() * 4;
      return;
    }

    // someone they know has just come into range
    let nearest = Infinity;
    for (let i = 1; i < world.actors.length; i++) {
      const other = world.actors[i];
      if (other === a || Rig.isDown(other)) continue;
      const d = distance(a, other);
      if (d < nearest) nearest = d;
    }
    const was = brain.nearDist === undefined ? Infinity : brain.nearDist;
    brain.nearDist = nearest;
    if (was > GREET_RANGE * 1.25 && nearest <= GREET_RANGE) {
      Rig.startGesture(a, a.rng() < 0.65 ? 'wave' : 'greet');
      brain.gestureCooldown = 10 + a.rng() * 14;
    }
  }

  function tryStartChat(world, a) {
    const brain = a.brain;
    brain.chatCooldown = (brain.chatCooldown || 0) - 1 / 60;
    if (brain.partner || brain.chatCooldown > 0 || a.gesture) return;
    for (let i = 1; i < world.actors.length; i++) {
      const other = world.actors[i];
      if (other === a || Rig.isDown(other) || other.gesture) continue;
      if (other.brain.partner || (other.brain.chatCooldown || 0) > 0) continue;
      if (other.brain.state !== 'pause' && other.brain.state !== 'wander') continue;
      if (distance(a, other) > CHAT_RANGE) continue;
      startChat(a, other);
      return;
    }
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
      if (brain.partner) endChat(a, 6);
      a.vx = 0; a.vy = 0;
      a.gesture = null;
      hush(a);
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

    if (brain.state === 'chatting') {
      updateChat(world, a, dt);
      Rig.updateActorMotion(a, dt);
      return;
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

      reactiveGesture(world, a, dt);
      tryStartChat(world, a);
      if (brain.state === 'chatting') return;
      if (a.gesture) brain.timer = Math.max(brain.timer, 0.3);

      if (brain.timer <= 0) {
        brain.state = 'wander';
        brain.timer = 1.2 + a.rng() * 3.2;
        brain.dirIndex = Math.floor(a.rng() * 8);
      }
    } else if (brain.state === 'wander') {
      reactiveGesture(world, a, dt);
      if (a.gesture) { a.gait = 'idle'; Rig.updateActorMotion(a, dt); return; }
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
      if (a.stumbleTime > 0) continue;
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
    // whoever they were chatting to is dropped
    if (npc.brain.partner) endChat(npc, 10);
    npc.gesture = null;
    npc.brain.state = distance(npc, world.player) > COMFORT_RANGE ? 'approach' : 'face';
    world.player.targetYaw = Rig.snapToEight(npc.x - world.player.x, npc.y - world.player.y);
    world.player.vx = 0; world.player.vy = 0;
    return true;
  }

  /* Someone going down at speed takes out whoever they land on. */
  function resolveRagdollCollisions(world, dt) {
    for (let i = 0; i < world.actors.length; i++) {
      const a = world.actors[i];
      if (!Rig.isDown(a) || a.fall.state !== 'falling') continue;

      const speed = Math.hypot(a.x - (a._px === undefined ? a.x : a._px),
        a.y - (a._py === undefined ? a.y : a._py)) / Math.max(dt, 1e-4);
      if (speed < 40) continue;

      // Villagers only. A body landing on the player shoves them, it never
      // takes them down — the player is only ever floored by scenery.
      for (let j = 0; j < world.actors.length; j++) {
        const b = world.actors[j];
        if (b === a || Rig.isDown(b) || b.hitCooldown > 0) continue;
        const dx = b.x - a.x, dy = (b.y - a.y) * 1.5;
        const d = Math.hypot(dx, dy);
        if (d > 15 || d === 0) continue;
        const nx = dx / d, ny = dy / d / 1.5;
        if (b === world.player) {
          Rig.stumble(b, nx, ny, 22, 0.4);
          b.hitCooldown = 0.5;
          continue;
        }
        Rig.knockDown(b, nx, ny, 2.2 + speed / 45);
        if (b.brain) {
          if (b.brain.partner) endChat(b, 6);
          b.brain.state = 'downed';
          b.brain.timer = 0;
        }
        b.hitCooldown = 0.5;
      }
    }
    for (let i = 0; i < world.actors.length; i++) {
      world.actors[i]._px = world.actors[i].x;
      world.actors[i]._py = world.actors[i].y;
    }
  }

  function update(world, dt) {
    updatePlayer(world, dt);
    for (let i = 1; i < world.actors.length; i++) updateVillager(world, world.actors[i], dt);
    resolveActorCollisions(world);
    separateVillagers(world);
    resolveRagdollCollisions(world, dt);
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
    // The camera sits on whole world units, so this stays a straight copy —
    // no interpolation, which is what keeps the ground crisp.
    const sx0 = world.camX * PIXEL, sy0 = world.camY * PIXEL;
    const ground = world.ground;
    const out = target.colour;
    for (let y = 0; y < RENDER_H; y++) {
      const sy = sy0 + y;
      if (sy < 0 || sy >= GROUND_H) continue;
      const srow = sy * GROUND_W + sx0;
      const trow = y * RENDER_W;
      for (let x = 0; x < RENDER_W; x++) {
        out[trow + x] = GROUND_PALETTE[ground[srow + x]];
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
        R.fillEllipse(target, (Math.round(p.x) - cx) * PIXEL, (Math.round(p.y) - cy) * PIXEL,
          p.shadowR * PIXEL, p.shadowR * 0.4 * PIXEL, SHADOW, 0.3);
        R.blit(target, p.sprite, (Math.round(p.x) - cx) * PIXEL - Math.round(p.sprite.w / 2),
          (Math.round(p.y) - cy) * PIXEL - p.footY);
      } else {
        const a = d.actor;
        const down = Rig.isDown(a) ? 1 : 0;
        R.fillEllipse(target, (Math.round(a.x) - cx) * PIXEL, (Math.round(a.y) - cy) * PIXEL,
          (7 + down * 7) * PIXEL, (3 + down * 2) * PIXEL, SHADOW, 0.34);
        Rig.renderActor(a, a.buffer, camera, {});
        R.blit(target, a.buffer, (Math.round(a.x) - cx) * PIXEL - ACTOR_BUF.ox,
          (Math.round(a.y) - cy) * PIXEL - ACTOR_BUF.oy);
      }
    }

    // name plate and the talk prompt for whoever is in reach
    const npc = world.prompt;
    if (npc) {
      const name = npc.character.name;
      const nx = (Math.round(npc.x) - cx) * PIXEL - Math.round(T.measure(name) / 2);
      const ny = (Math.round(npc.y) - cy) * PIXEL - 58 * PIXEL;
      T.drawShadowed(target, name, nx, ny, LABEL, LABEL_SHADOW);
      const hint = 'E  talk';
      T.drawShadowed(target, hint, (Math.round(npc.x) - cx) * PIXEL - Math.round(T.measure(hint) / 2),
        ny - 11 * PIXEL, PROMPT, LABEL_SHADOW);
    }

    D.draw(world.box, target);
  }

  global.World = {
    VIEW_W, VIEW_H, RENDER_W, RENDER_H, PIXEL, WORLD_W, WORLD_H,
    ACTOR_BUF, CAM_PITCH, CAM_SCALE,
    SPEED, TALK_RANGE, NUDGE_SPEED, TRIP_SPEED, FALL_SPEED, TEST_PAGES,
    createWorld, update, draw, tryTalk, nearestTalkable, distance, beginConversation
  };
})(window);
