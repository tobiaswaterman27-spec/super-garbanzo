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
  const HM = global.HorseModel;
  const V = global.Vehicle;

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
  const FALL_SPEED = 104;      // scenery at nearly full sprint floors you
  const CHEST_H = 20;          // contact heights, in model units
  const TALK_RANGE = 40;
  const CHAT_NOTICE = 110;     // far enough to catch someone's eye
  const CHAT_CLOSE = 20;       // how close they actually stand to talk
  const CHAT_BREAK = 54;       // drift further apart than this and it is over
  const GREET_RANGE = 70;
  const COMFORT_RANGE = 24;

  /* ---------- mounted play ---------- */

  const MOUNT_RANGE = 26;      // how close you have to be to swing up
  const MOUNT_TIME = 0.42;     // how long the swing takes
  const HORSE_BUF = { w: 176 * PIXEL, h: 152 * PIXEL, ox: 88 * PIXEL, oy: 128 * PIXEL };
  const CART_BUF = { w: 192 * PIXEL, h: 136 * PIXEL, ox: 96 * PIXEL, oy: 112 * PIXEL };
  const DEBRIS_BUF = { w: 40 * PIXEL, h: 40 * PIXEL, ox: 20 * PIXEL, oy: 26 * PIXEL };
  const HORSE_R = 11;
  const CART_R = 12;
  // A galloping horse hits far harder than a sprinting man, so scenery that
  // only trips you on foot puts a horse down.
  const HORSE_FALL_SPEED = 150;
  const HITCH_RANGE = 34;

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
      horses: [],
      carts: [],
      debris: [],
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
    /* `hardness` is how much of an impact the object gives back. A trunk does
     * not move, so all of it goes into the cart; a barrel tips over and takes
     * most of it with it. */
    function addProp(sprite, x, y, r, tall, hardness) {
      world.props.push({
        sprite: sprite, x: x, y: y, footY: sprite.footY, r: r,
        shadowR: r * 1.5, tall: !!tall,
        hardness: hardness === undefined ? 1 : hardness
      });
    }

    for (let i = 0; i < 34; i++) {
      const x = 40 + rng() * (WORLD_W - 80);
      const y = 40 + rng() * (WORLD_H - 80);
      if (Math.abs(y - pathCentre(x)) < 36) continue; // keep the road clear
      addProp(treeSprites[Math.floor(rng() * treeSprites.length)], x, y, 7.5, true, 1.0);
    }
    for (let i = 0; i < 22; i++) {
      addProp(rockSprites[Math.floor(rng() * rockSprites.length)],
        40 + rng() * (WORLD_W - 80), 40 + rng() * (WORLD_H - 80), 4.5, false, 0.8);
    }
    addProp(cartSprite, WORLD_W * 0.46, pathCentre(WORLD_W * 0.46) - 26, 10, false, 0.55);
    addProp(barrelSprite, WORLD_W * 0.42, WORLD_H * 0.5, 4, false, 0.35);
    addProp(barrelSprite, WORLD_W * 0.435, WORLD_H * 0.52, 4, false, 0.35);
    addProp(barrelSprite, WORLD_W * 0.415, WORLD_H * 0.535, 4, false, 0.35);

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

    /* horses, loose on the grass near where the player starts */
    for (let i = 0; i < 5; i++) {
      const hr = CM.makeRng((seed + 4001 + i * 733) >>> 0);
      const h = HM.createEntity(HM.randomHorse(hr),
        player.x + (rng() - 0.5) * 300, player.y + 60 + (rng() - 0.5) * 260,
        (seed + 4001 + i * 733) >>> 0);
      h.yaw = Math.floor(rng() * 4) * (Math.PI / 2);
      h.targetYaw = h.yaw;
      h.buffer = R.createTarget(HORSE_BUF.w, HORSE_BUF.h);
      world.horses.push(h);
    }

    /* one of each cart, parked where you can get to them */
    const cartTypes = ['cart', 'chestCart', 'luxuryCart'];
    for (let i = 0; i < cartTypes.length; i++) {
      const c = V.create(cartTypes[i],
        player.x - 90 + i * 78, player.y - 66 + (i % 2) * 26,
        (seed + 9001 + i * 311) >>> 0);
      c.yaw = Math.PI / 2;
      c.buffer = R.createTarget(CART_BUF.w, CART_BUF.h);
      world.carts.push(c);
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
    // Once you are on the floor a knee-high rock no longer stops you — you
    // slide over it. Otherwise tripping over something low pins you against
    // the very thing you were supposed to go over the top of.
    // A horse on its side slides over low scenery the same way a person does;
    // a cart is a cart whatever state it is in.
    const down = a.isHorse ? HM.isDown(a) : (a.fall ? Rig.isDown(a) : false);
    for (let i = 0; i < world.props.length; i++) {
      const p = world.props[i];
      if (down && !p.tall) continue;
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
   * Scenery at full sprint floors you; villagers never do. */
  function reactToProp(player, impact) {
    if (!impact.prop || impact.speed < NUDGE_SPEED) return;
    if (player.hitCooldown > 0) return;
    player.hitCooldown = 0.4;
    const n = impact;

    if (impact.speed > FALL_SPEED) {
      // Full throttle into scenery puts you on the floor, but which way you go
      // depends on what you hit. Something tall stops you dead and you land
      // back off it; something low takes your legs and you go over the top of
      // it, still travelling.
      if (impact.prop.tall) {
        Rig.knockDown(player, n.nx, n.ny, 3.2 + impact.speed / 40);
        player.vx = n.nx * impact.speed * 0.2;
        player.vy = n.ny * impact.speed * 0.2;
      } else {
        Rig.knockDown(player, -n.nx, -n.ny, 2.6 + impact.speed / 52);
        player.vx = -n.nx * impact.speed * 0.34;
        player.vy = -n.ny * impact.speed * 0.34;
      }
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
      if (list[i].mount || list[i].seat) continue;
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


  /* ================== horses, carts and wreckage ================== */

  /* Where on the ground the saddle sits, once the horse's own yaw is applied.
   * The rider is drawn as a separate model planted at this point rather than
   * modelled into the horse, so the same villager you built in the forge is
   * the one sitting up there. */
  function saddleWorld(h) {
    const sp = HM.saddlePoint(h.model);
    return { x: h.x + sp.z * Math.sin(h.yaw), y: h.y + sp.z * Math.cos(h.yaw), lift: sp.y };
  }

  function hitchWorld(h) {
    // just behind the horse, where the shafts of a cart meet it
    const back = -HM.dimensionsFor(h.horse).bodyLen * 0.62 * h.model.root.scale;
    return { x: h.x + back * Math.sin(h.yaw), y: h.y + back * Math.cos(h.yaw) };
  }

  function horseSpeeds(h) { return HM.topSpeed(h.horse); }

  function gaitFor(h, speed) {
    const t = horseSpeeds(h);
    if (speed < 4) return 'idle';
    if (speed < t.walk * 1.15) return 'walk';
    if (speed < t.run * 0.68) return 'trot';
    return 'gallop';
  }

  /* ---------- mounting ---------- */

  function nearestHorse(world, range) {
    let best = null, bestD = range === undefined ? MOUNT_RANGE : range;
    for (let i = 0; i < world.horses.length; i++) {
      const h = world.horses[i];
      if (h.rider || HM.isDown(h)) continue;
      const d = Math.hypot(h.x - world.player.x, (h.y - world.player.y) * 1.4);
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  }

  function mount(world, h) {
    const p = world.player;
    h.rider = p;
    p.mount = h;
    p.mountTime = 0;
    p.vx = 0; p.vy = 0;
    p.gait = 'idle';
    p.gesture = null;
    p.yaw = h.yaw;
    p.targetYaw = h.yaw;
    if (world.box.open) D.close(world.box);
    return true;
  }

  function dismount(world) {
    const p = world.player;
    const h = p.mount;
    if (!h) return false;
    // step off to the near side, and inherit a little of the horse's motion
    const side = h.yaw + Math.PI / 2;
    p.x = h.x + Math.cos(side) * 14;
    p.y = h.y - Math.sin(side) * 10;
    p.vx = h.vx * 0.3;
    p.vy = h.vy * 0.3;
    p.mount = null;
    p.seat = null;
    p.mountTime = 0;
    h.rider = null;
    h.vx *= 0.4; h.vy *= 0.4;
    return true;
  }

  /* Throws the rider clear. Used when the horse goes down under them. */
  function unseat(world, h, dirX, dirY, force) {
    const p = h.rider;
    if (!p) return;
    p.mount = null;
    p.seat = null;
    p.mountTime = 0;
    h.rider = null;
    p.x = h.x; p.y = h.y;
    const len = Math.hypot(dirX, dirY) || 1;
    Rig.knockDown(p, dirX / len, dirY / len, 4.2 + force * 0.5);
    p.vx = (dirX / len) * (30 + force * 9);
    p.vy = (dirY / len) * (30 + force * 9);
    if (world.box.open) D.close(world.box);
  }



  /* Horses are solid to each other and to people on foot. */
  function separateHorses(world) {
    for (let i = 0; i < world.horses.length; i++) {
      const a = world.horses[i];
      if (HM.isDown(a)) continue;
      for (let j = i + 1; j < world.horses.length; j++) {
        const b = world.horses[j];
        if (HM.isDown(b)) continue;
        const dx = b.x - a.x, dy = (b.y - a.y) * 1.4;
        const d = Math.hypot(dx, dy);
        const min = HORSE_R * 2;
        if (d >= min || d === 0) continue;
        const nx = dx / d, ny = dy / d / 1.4;
        const push = (min - d) * 0.5;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
      // a person on foot cannot stand inside a horse
      const p = world.player;
      if (!p.mount && !p.seat && !Rig.isDown(p)) {
        const dx = p.x - a.x, dy = (p.y - a.y) * 1.4;
        const d = Math.hypot(dx, dy);
        const min = HORSE_R + PLAYER_R;
        if (d < min && d > 0) {
          p.x += (dx / d) * (min - d);
          p.y += (dy / d / 1.4) * (min - d);
        }
      }
    }
  }

  /* What E would do if you pressed it right now — and the world draws a hint
   * from this, so the prompt and the action can never disagree. */
  function promptFor(world) {
    const p = world.player;
    if (Rig.isDown(p)) return null;
    if (p.mount) {
      const c = nearestCart(world, p.mount, HITCH_RANGE);
      // Whatever E happens to do from up here, the label is the horse's name.
      const named = { name: p.mount.horse.name, at: p.mount };
      if (c && !p.mount.cart) return { kind: 'hitch', at: named.at, name: named.name };
      if (p.mount.cart) return { kind: 'unhitch', at: named.at, name: named.name };
      return { kind: 'dismount', at: named.at, name: named.name };
    }
    if (p.seat) {
      const h2 = p.seat.hitch;
      return { kind: 'standup', at: p.seat, name: h2 ? h2.horse.name : null };
    }
    const h = nearestHorse(world);
    if (h) return { kind: 'mount', at: h, name: h.horse.name };
    const bench = nearestBench(world);
    if (bench) {
      const h2 = bench.hitch;
      return { kind: 'board', at: bench, name: h2 ? h2.horse.name : null };
    }
    const npc = nearestTalkable(world);
    if (npc) return { kind: 'talk', at: npc, name: npc.character.name };
    return null;
  }

  /* A parked cart is scenery to anyone on foot: solid, and hard enough to run
   * into that a sprint puts you over it — the same rule every other object in
   * the world follows. It takes the damage too, so you can break a cart apart
   * by throwing yourself at it. */
  function reactToCart(world, p) {
    if (Rig.isDown(p)) return;
    for (let i = 0; i < world.carts.length; i++) {
      const c = world.carts[i];
      if (c.rider === p) continue;
      const dx = p.x - c.x, dy = (p.y - c.y) * 1.5;
      const d = Math.hypot(dx, dy);
      const min = CART_R + PLAYER_R;
      if (d >= min || d === 0) continue;
      const nx = dx / d, ny = dy / d / 1.5;
      p.x += nx * (min - d);
      p.y += ny * (min - d);

      const into = -(p.vx * nx + p.vy * ny);
      if (into <= 0) continue;
      p.vx += nx * into; p.vy += ny * into;
      p.vx *= 0.5; p.vy *= 0.5;
      if (into < NUDGE_SPEED || p.hitCooldown > 0) continue;
      p.hitCooldown = 0.4;
      damageCart(world, c, 8 + into * 0.22, -nx, -ny);
      if (into > FALL_SPEED) {
        Rig.knockDown(p, nx, ny, 3.0 + into / 42);
        p.vx = nx * into * 0.2; p.vy = ny * into * 0.2;
      } else if (into > TRIP_SPEED) {
        Rig.shove(p, nx, ny, 22 + into * 0.24);
      }
    }
  }

  /* ---------- hitching and riding on the cart ---------- */

  function nearestCart(world, from, range) {
    let best = null, bestD = range;
    for (let i = 0; i < world.carts.length; i++) {
      const c = world.carts[i];
      if (c.hitch || c.broken) continue;
      const d = Math.hypot(c.x - from.x, (c.y - from.y) * 1.3);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function hitchCart(world, h, c) {
    h.cart = c;
    c.hitch = h;
    // snap the cart in line behind the horse so it does not whip round
    const hp = hitchWorld(h);
    const shaft = c.def.length * 0.5 + 14;
    c.x = hp.x - Math.sin(h.yaw) * shaft;
    c.y = hp.y - Math.cos(h.yaw) * shaft;
    c.yaw = h.yaw;
    c.vx = h.vx; c.vy = h.vy;
    return true;
  }

  function unhitchCart(world, h) {
    const c = h.cart;
    if (!c) return false;
    c.hitch = null;
    h.cart = null;
    c.vx *= 0.4; c.vy *= 0.4;
    return true;
  }

  // The driver's bench, reachable on foot from beside a hitched cart.
  function nearestBench(world) {
    let best = null, bestD = MOUNT_RANGE + 6;
    for (let i = 0; i < world.carts.length; i++) {
      const c = world.carts[i];
      if (c.broken || c.rider) continue;
      const d = Math.hypot(c.x - world.player.x, (c.y - world.player.y) * 1.3);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function takeSeat(world, c) {
    const p = world.player;
    c.rider = p;
    p.seat = c;
    p.vx = 0; p.vy = 0;
    p.gait = 'idle';
    p.gesture = null;
    return true;
  }

  function leaveSeat(world) {
    const p = world.player;
    const c = p.seat;
    if (!c) return false;
    const side = c.yaw + Math.PI / 2;
    p.x = c.x + Math.cos(side) * 16;
    p.y = c.y - Math.sin(side) * 11;
    p.vx = c.vx * 0.3; p.vy = c.vy * 0.3;
    c.rider = null;
    p.seat = null;
    return true;
  }

  const EDGE = 24;
  function clampToWorld(e) {
    if (e.x < EDGE) { e.x = EDGE; if (e.vx < 0) e.vx = 0; }
    if (e.x > WORLD_W - EDGE) { e.x = WORLD_W - EDGE; if (e.vx > 0) e.vx = 0; }
    if (e.y < EDGE) { e.y = EDGE; if (e.vy < 0) e.vy = 0; }
    if (e.y > WORLD_H - EDGE) { e.y = WORLD_H - EDGE; if (e.vy > 0) e.vy = 0; }
  }

  /* ---------- horse movement ---------- */

  function updateHorse(world, h, dt) {
    h.hitCooldown = Math.max(0, h.hitCooldown - dt);

    if (HM.isDown(h)) {
      HM.updateFall(h, dt);
      h.vx = 0; h.vy = 0;
      h.animTime += dt;
      return;
    }

    const speeds = horseSpeeds(h);
    let dx = 0, dy = 0, sprint = false;

    const drivenFromSaddle = h.rider === world.player && world.player.mountTime >= MOUNT_TIME;
    const drivenFromBench = h.cart && h.cart.rider === world.player;
    if (drivenFromSaddle || drivenFromBench) {
      const input = world.input;
      if (!world.box.open) { dx = input.dx; dy = input.dy; sprint = input.sprint; }
    } else if (!h.rider && !drivenFromBench) {
      // loose horses drift about and graze
      h.wanderTimer -= dt;
      if (h.wanderTimer <= 0) {
        h.wanderTimer = 3 + h.rng() * 7;
        h.wanderDir = h.rng() < 0.45 ? 0 : h.rng() * Math.PI * 2;
      }
      if (h.wanderDir) { dx = Math.sin(h.wanderDir); dy = Math.cos(h.wanderDir); }
    }

    const pulling = h.cart && !h.cart.broken ? 1 + h.cart.def.mass * 0.55 : 1;
    const target = (sprint ? speeds.run : speeds.walk) / pulling;
    const accel = (sprint ? 300 : 210) / pulling;

    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      const tx = dx * target, ty = dy * target;
      const ax = tx - h.vx, ay = ty - h.vy;
      const mag = Math.hypot(ax, ay);
      if (mag > 0) {
        const step = Math.min(mag, accel * dt);
        h.vx += (ax / mag) * step;
        h.vy += (ay / mag) * step;
      }
      // A horse turns by swinging its whole body round, so the facing eases
      // toward the heading instead of snapping to eight directions the way a
      // person on foot does.
      h.targetYaw = Rig.yawForDirection(dx, dy);
    } else {
      const sp = Math.hypot(h.vx, h.vy);
      if (sp > 0) {
        const next = Math.max(0, sp - 380 * dt);
        h.vx = (h.vx / sp) * next;
        h.vy = (h.vy / sp) * next;
      }
    }

    const turn = Rig.shortestAngle(h.yaw, h.targetYaw);
    const rate = (h.rider ? 4.2 : 2.4) * dt;
    h.yaw += Math.abs(turn) < rate ? turn : Math.sign(turn) * rate;

    h.x += h.vx * dt;
    h.y += h.vy * dt;
    clampToWorld(h);

    const speed = Math.hypot(h.vx, h.vy);
    h.gait = gaitFor(h, speed);
    h.animTime += dt * (h.gait === 'idle' ? 1 : 1);

    // scenery
    const impact = resolvePropCollisions(world, h, HORSE_R);
    if (impact.prop && impact.speed > NUDGE_SPEED && h.hitCooldown <= 0) {
      h.hitCooldown = 0.5;
      if (impact.speed > HORSE_FALL_SPEED && impact.prop.tall) {
        const f = 5 + impact.speed / 30;
        if (h.rider) unseat(world, h, -impact.nx, -impact.ny, impact.speed / 22);
        HM.knockDown(h, impact.nx, impact.ny, f);
        if (h.cart) damageCart(world, h.cart, 26 + impact.speed * 0.2, impact.nx, impact.ny);
      } else if (impact.speed > TRIP_SPEED) {
        h.vx *= 0.3; h.vy *= 0.3;
      }
    }

    // villagers: a horse at speed scatters them, and scales with its bulk
    const powerOf = HM.power(h.horse);
    for (let i = 1; i < world.actors.length; i++) {
      const a = world.actors[i];
      if (Rig.isDown(a) || a.hitCooldown > 0) continue;
      const ddx = a.x - h.x, ddy = (a.y - h.y) * 1.5;
      const d = Math.hypot(ddx, ddy);
      if (d >= HORSE_R + 8 || d === 0) continue;
      const nx = ddx / d, ny = ddy / d / 1.5;
      const push = (HORSE_R + 8 - d);
      a.x += nx * push; a.y += ny * push;
      if (speed > NUDGE_SPEED) {
        if (speed > TRIP_SPEED) {
          Rig.knockDown(a, nx, ny, (2.6 + speed / 26) * powerOf);
          if (a.brain) { a.brain.state = 'downed'; a.brain.timer = 0; }
        } else {
          Rig.stumble(a, nx, ny, (50 + speed * 0.8) * powerOf, 0.7);
        }
        a.hitCooldown = 0.5;
        if (world.talkingTo === a) D.close(world.box);
      }
    }
  }

  /* ---------- carts ---------- */

  /* A trailed cart is not steered — it is dragged. The hitch keeps it a fixed
   * distance behind the horse, and the body swings toward wherever the hitch
   * has pulled it. At speed that swing overshoots, which is what throws the
   * back end out on a hard turn and puts it into the scenery. */
  function updateCart(world, c, dt) {
    c.hitCooldown = Math.max(0, c.hitCooldown - dt);
    c.hitFlash = Math.max(0, c.hitFlash - dt);

    const h = c.hitch;
    if (h && !HM.isDown(h)) {
      const hp = hitchWorld(h);
      const shaft = c.def.length * 0.5 + 14;
      let dx = c.x - hp.x, dy = c.y - hp.y;
      let d = Math.hypot(dx, dy);
      if (d < 1e-3) { dx = -Math.sin(h.yaw); dy = -Math.cos(h.yaw); d = 1; }
      const nx = dx / d, ny = dy / d;

      const prevX = c.x, prevY = c.y;
      // hold the shaft length exactly; the cart is rigidly coupled, not sprung
      c.x = hp.x + nx * shaft;
      c.y = hp.y + ny * shaft;
      c.vx = (c.x - prevX) / Math.max(dt, 1e-4);
      c.vy = (c.y - prevY) / Math.max(dt, 1e-4);

      /* The body lags the hitch line, and carries angular momentum of its own.
       * A rigid "point along the shaft" cart never swings, however fast you
       * turn; letting the tail overshoot and settle back is what makes a hard
       * turn throw the back end wide and put it into whatever is there. */
      const want = Rig.yawForDirection(-nx, -ny);
      const sp = Math.hypot(c.vx, c.vy);
      const turn = Rig.shortestAngle(c.yaw, want);
      // springy, with damping that drops off at speed — fast means loose
      const spring = 14 + sp * 0.05;
      const damp = Math.max(2.4, 7.0 - sp * 0.030);
      c.spin = (c.spin || 0) + (turn * spring - (c.spin || 0) * damp) * dt;
      const maxSpin = 7.5;
      if (c.spin > maxSpin) c.spin = maxSpin;
      if (c.spin < -maxSpin) c.spin = -maxSpin;
      c.yaw += c.spin * dt;
      // A cart can jackknife; it cannot fold flat against its own shafts and
      // swing round through the horse.
      const off = Rig.shortestAngle(want, c.yaw);
      const LIMIT = 1.22;
      if (Math.abs(off) > LIMIT) {
        c.yaw = want - Math.sign(off) * LIMIT;
        c.spin *= -0.25;
      }
      c.sway = (c.sway || 0) * 0.86 + c.spin * 0.09;
      // and the tail physically swings out to the side of the shaft line
      const lat = Math.max(-1, Math.min(1, c.spin * 0.16));
      c.x += -ny * lat * sp * dt * 0.55;
      c.y += nx * lat * sp * dt * 0.55;
    } else {
      const sp = Math.hypot(c.vx, c.vy);
      if (sp > 0) {
        const next = Math.max(0, sp - 260 * dt);
        c.vx = (c.vx / sp) * next; c.vy = (c.vy / sp) * next;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.spin = (c.spin || 0) * Math.max(0, 1 - 3.4 * dt);
      c.yaw += c.spin * dt;
      c.sway = (c.sway || 0) * 0.9;
    }
    clampToWorld(c);

    /* Bounce. A cart on wooden axles does not glide: it pitches over ruts at
     * a rate set by how fast it is going, and lurches when the tail swings.
     * Quantised to the same 12fps clock as everything else so it does not
     * reintroduce the crawl. */
    const rolling = Math.hypot(c.vx, c.vy);
    c.rollT = (c.rollT || 0) + rolling * dt * 0.06;
    const jolt = Math.sin(c.rollT * 6.1) * 0.55 + Math.sin(c.rollT * 2.7) * 0.35;
    c.bounce = jolt * Math.min(1, rolling / 60) * (1 + (c.stage || 0) * 0.45)
      + Math.abs(c.sway || 0) * 0.8;
    c.lean = (c.sway || 0) * 0.22;

    if (c.broken) return;

    /* Scenery: the cart takes the damage, not the horse, and how much depends
     * on three things — how fast it hit, what it hit, and whether it was
     * swinging. A cart that clips a barrel head-on is barely scratched; the
     * same cart whipping round sideways into a trunk loses a wheel. */
    const impact = resolvePropCollisions(world, c, CART_R);
    if (impact.prop && impact.speed > 24 && c.hitCooldown <= 0) {
      c.hitCooldown = 0.35;
      // the component of travel across the cart's own axis: its swing
      const fwdX = Math.sin(c.yaw), fwdY = Math.cos(c.yaw);
      const lateral = Math.abs(c.vx * fwdY - c.vy * fwdX);
      const swing = 1 + Math.min(1.8, lateral / 70) + Math.abs(c.sway || 0) * 1.6;
      const hardness = impact.prop.hardness === undefined ? 1 : impact.prop.hardness;
      const weak = c.def.frail || 1;
      damageCart(world, c, (7 + impact.speed * 0.30) * swing * hardness * weak,
        impact.nx, impact.ny);
      if (h) { h.vx *= 0.72 - hardness * 0.12; h.vy *= 0.72 - hardness * 0.12; }
      // a broadside hit throws the tail of the cart round
      c.sway = (c.sway || 0) - (c.vx * fwdY - c.vy * fwdX) / 240;
    }

    // and it knocks people down as readily as the horse does
    for (let i = 1; i < world.actors.length; i++) {
      const a = world.actors[i];
      if (Rig.isDown(a) || a.hitCooldown > 0) continue;
      const ddx = a.x - c.x, ddy = (a.y - c.y) * 1.5;
      const d = Math.hypot(ddx, ddy);
      if (d >= CART_R + 7 || d === 0) continue;
      const nx = ddx / d, ny = ddy / d / 1.5;
      a.x += nx * (CART_R + 7 - d); a.y += ny * (CART_R + 7 - d);
      const sp = Math.hypot(c.vx, c.vy);
      if (sp > TRIP_SPEED) {
        Rig.knockDown(a, nx, ny, 2.8 + sp / 28);
        if (a.brain) { a.brain.state = 'downed'; a.brain.timer = 0; }
        a.hitCooldown = 0.5;
      }
    }
  }

  /* Damage sheds boards as it goes. Each stage the cart drops into throws off
   * a plank or two on the spot, so you can see it coming apart rather than
   * only discovering it when it finally breaks. */
  function damageCart(world, c, amount, nx, ny) {
    if (c.broken) return;
    const before = c.stage;
    c.hp = Math.max(0, c.hp - amount);
    c.hitFlash = 0.18;
    c.stage = V.stageFor(c.hp, c.maxHp);
    if (c.stage !== before) {
      c.spriteStage = -1;
      const n = c.stage === 1 ? 2 : 3;
      for (let i = 0; i < n; i++) spawnDebris(world, c, 'plank', nx, ny, 0.8);
    }
    if (c.hp <= 0) breakCart(world, c, nx, ny);
  }

  function breakCart(world, c, nx, ny) {
    c.broken = true;
    const list = V.wreckage(c.type);
    for (let i = 0; i < list.length; i++) {
      spawnDebris(world, c, list[i], nx, ny, 1);
    }
    if (c.hitch) { c.hitch.cart = null; c.hitch = null; }
    if (c.rider) {
      const p = c.rider;
      p.seat = null;
      c.rider = null;
      Rig.knockDown(p, nx || 1, ny || 0, 4.0);
      p.x = c.x; p.y = c.y;
      p.vx = c.vx * 0.5; p.vy = c.vy * 0.5;
    }
    // the wreck itself stops being a thing in the world
    const idx = world.carts.indexOf(c);
    if (idx >= 0) world.carts.splice(idx, 1);
  }

  /* ---------- debris ---------- */

  /* Wreckage is a tumbling rigid body, not a ragdoll: a plank has no joints to
   * solve, it just spins, bounces and settles flat. Cheap enough that a cart
   * exploding into eighteen pieces costs nothing. */
  function spawnDebris(world, c, kind, nx, ny, force) {
    const rng = c.rng;
    const ang = rng() * Math.PI * 2;
    const spread = 18 + rng() * 34;
    const away = 0.35 + rng() * 0.75;
    world.debris.push({
      kind: kind,
      x: c.x + Math.cos(ang) * 4,
      y: c.y + Math.sin(ang) * 3,
      z: 9 + rng() * 9,               // height off the ground
      vx: Math.cos(ang) * spread + (nx || 0) * spread * away * force,
      vy: Math.sin(ang) * spread * 0.6 + (ny || 0) * spread * away * force,
      vz: 26 + rng() * 46 * force,
      pitch: rng() * Math.PI * 2,
      roll: rng() * Math.PI * 2,
      yaw: rng() * Math.PI * 2,
      spinP: (rng() - 0.5) * 15 * force,
      spinR: (rng() - 0.5) * 15 * force,
      spinY: (rng() - 0.5) * 9 * force,
      rest: 0,
      settled: false,
      buffer: null,
      _key: ''
    });
    if (world.debris.length > 140) world.debris.shift();
  }

  const DEBRIS_G = 190;

  function updateDebris(world, dt) {
    for (let i = 0; i < world.debris.length; i++) {
      const d = world.debris[i];
      if (d.settled) continue;
      d.vz -= DEBRIS_G * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      d.pitch += d.spinP * dt;
      d.roll += d.spinR * dt;
      d.yaw += d.spinY * dt;

      if (d.z <= 0) {
        d.z = 0;
        if (Math.abs(d.vz) < 22) {
          // come to rest lying flat, which is the only way a plank looks right
          d.vz = 0; d.vx *= 0.2; d.vy *= 0.2;
          d.spinP *= 0.2; d.spinR *= 0.2; d.spinY *= 0.3;
          d.rest += dt;
          if (d.rest > 0.35) {
            d.settled = true;
            d.pitch = Math.round(d.pitch / (Math.PI / 2)) * (Math.PI / 2);
            d.roll = Math.round(d.roll / (Math.PI / 2)) * (Math.PI / 2);
            d.vx = 0; d.vy = 0; d.spinP = 0; d.spinR = 0; d.spinY = 0;
          }
        } else {
          d.vz = -d.vz * 0.36;
          d.vx *= 0.6; d.vy *= 0.6;
          d.spinP *= 0.55; d.spinR *= 0.55;
          d.rest = 0;
        }
      }
      // friction while it skitters along the ground
      if (d.z <= 0.01) {
        const sp = Math.hypot(d.vx, d.vy);
        if (sp > 0) {
          const next = Math.max(0, sp - 150 * dt);
          d.vx = (d.vx / sp) * next; d.vy = (d.vy / sp) * next;
        }
      }
    }
  }

  /* ---------- player ---------- */

  /* Riding and driving both take the player's own movement code out of the
   * loop entirely: the horse or the cart owns where they are, and all that is
   * left is which pose to hold and which way to look. */
  function updateMountedPlayer(world, p, dt) {
    p.hitCooldown = Math.max(0, p.hitCooldown - dt);
    p.animTime += dt;
    Rig.updateBlink(p, dt);

    const h = p.mount;
    if (h) {
      const seat = saddleWorld(h);
      p.x = seat.x; p.y = seat.y;
      p.yaw = h.yaw; p.targetYaw = h.yaw;
      p.vx = h.vx; p.vy = h.vy;
      if (p.mountTime < MOUNT_TIME) {
        p.mountTime = Math.min(MOUNT_TIME, p.mountTime + dt);
        return;
      }
      // Hauling on the reins: the arms come back when you are asking for a
      // turn or pulling up, and settle when the horse is running straight.
      const want = Rig.shortestAngle(h.yaw, h.targetYaw);
      const braking = !world.input.dx && !world.input.dy && Math.hypot(h.vx, h.vy) > 30;
      p.rein = Math.max(0, Math.min(1,
        (p.rein || 0) * 0.86 + (Math.abs(want) * 1.4 + (braking ? 0.6 : 0)) * dt * 5));
      p.turn = want;
      return;
    }

    const c = p.seat;
    if (c) {
      const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
      const fwd = -c.def.length * 0.22;
      p.x = c.x + fwd * sy;
      p.y = c.y + fwd * cy;
      p.yaw = c.yaw; p.targetYaw = c.yaw;
      p.vx = c.vx; p.vy = c.vy;
      const h2 = c.hitch;
      const want = h2 ? Rig.shortestAngle(h2.yaw, h2.targetYaw) : 0;
      p.rein = Math.max(0, Math.min(1, (p.rein || 0) * 0.86 + Math.abs(want) * 7 * dt));
      p.turn = want;
      // the bench jolts over rough ground and with the cart's own sway
      // the driver rides the cart's own bounce rather than a separate wobble
      p.jolt = (c.bounce || 0) * 0.5;
    }
  }

  function updatePlayer(world, dt) {
    const p = world.player;
    if (p.mount || p.seat) { updateMountedPlayer(world, p, dt); return; }
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
    clampToWorld(p);

    const impact = resolvePropCollisions(world, p, PLAYER_R);
    reactToProp(p, impact);
    reactToCart(world, p);
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
        distance(a, partner) > CHAT_BREAK) {
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

  /* Catching someone's eye is not the same as talking to them. Two villagers
   * who decide to speak now walk over to each other first and only start once
   * they are close enough to be heard — standing sixty units apart shouting is
   * what made the old version read as two people ignoring each other. */
  function tryStartChat(world, a) {
    const brain = a.brain;
    brain.chatCooldown = (brain.chatCooldown || 0) - 1 / 60;
    if (brain.partner || brain.chatCooldown > 0 || a.gesture) return;
    let best = null, bestD = CHAT_NOTICE;
    for (let i = 1; i < world.actors.length; i++) {
      const other = world.actors[i];
      if (other === a || Rig.isDown(other) || other.gesture) continue;
      if (other.brain.partner || (other.brain.chatCooldown || 0) > 0) continue;
      if (other.brain.state !== 'pause' && other.brain.state !== 'wander') continue;
      const d = distance(a, other);
      if (d < bestD) { bestD = d; best = other; }
    }
    if (!best) return;
    if (bestD <= CHAT_CLOSE) { startChat(a, best); return; }
    // both of them commit to closing the gap, so neither wanders off
    [[a, best], [best, a]].forEach(function (pair) {
      pair[0].brain.state = 'closing';
      pair[0].brain.partner = pair[1];
      pair[0].brain.closeTimer = 7;
      pair[0].gesture = null;
    });
  }

  /* Walking over. They aim at the midpoint rather than at each other, so they
   * meet instead of one chasing the other across the field. */
  function updateClosing(world, a, dt) {
    const brain = a.brain;
    const other = brain.partner;
    brain.closeTimer -= dt;
    if (!other || Rig.isDown(other) || other.brain.partner !== a || brain.closeTimer <= 0) {
      abandonClosing(a);
      return;
    }
    const d = distance(a, other);
    if (d <= CHAT_CLOSE) {
      a.gait = 'idle';
      // wait for the other one to arrive before either starts talking
      if (other.brain.state === 'closing' || other.brain.state === 'chatting') {
        brain.partner = null;
        other.brain.partner = null;
        startChat(a, other);
      }
      return;
    }
    const mx = (a.x + other.x) / 2, my = (a.y + other.y) / 2;
    const dx = mx - a.x, dy = my - a.y;
    const len = Math.hypot(dx, dy) || 1;
    a.targetYaw = Rig.snapToEight(dx, dy);
    if (Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 0.7) {
      a.x += (dx / len) * SPEED.npc * dt;
      a.y += (dy / len) * SPEED.npc * dt;
      resolvePropCollisions(world, a, 6);
      clampVillager(a);
    }
    a.gait = 'walk';
  }

  function abandonClosing(a) {
    const other = a.brain.partner;
    [a, other].forEach(function (self) {
      if (!self || self.brain.state !== 'closing') return;
      self.brain.partner = null;
      self.brain.state = 'pause';
      self.brain.timer = 0.5 + self.rng() * 1.5;
      self.brain.chatCooldown = 6 + self.rng() * 8;
      self.gait = 'idle';
    });
    if (a.brain.partner) a.brain.partner = null;
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
      if (brain.state === 'closing') abandonClosing(a);
      else if (brain.partner) endChat(a, 6);
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

    if (brain.state === 'closing') {
      updateClosing(world, a, dt);
      Rig.updateActorMotion(a, dt);
      return;
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
  /* Everything E does, in the order it is offered. Riding beats talking:
   * standing next to your own horse and getting a conversation instead is
   * the kind of thing that makes a control feel broken. */
  function tryTalk(world) {
    if (world.box.open) { D.advance(world.box); return true; }
    const p = world.player;
    if (Rig.isDown(p)) return false;

    if (p.mount) {
      // in the saddle: hitch a cart if one is right behind, otherwise get off
      const c = nearestCart(world, p.mount, HITCH_RANGE);
      if (c && !p.mount.cart) { hitchCart(world, p.mount, c); return true; }
      if (p.mount.cart) { unhitchCart(world, p.mount); return true; }
      dismount(world);
      return true;
    }
    if (p.seat) { leaveSeat(world); return true; }

    const h = nearestHorse(world);
    if (h) { mount(world, h); return true; }

    const bench = nearestBench(world);
    if (bench) { takeSeat(world, bench); return true; }

    const npc = nearestTalkable(world);
    if (!npc) return false;
    // whoever they were chatting to is dropped
    if (npc.brain.state === 'closing') abandonClosing(npc);
    else if (npc.brain.partner) endChat(npc, 10);
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
          if (b.brain.state === 'closing') abandonClosing(b);
          else if (b.brain.partner) endChat(b, 6);
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
    // Horses move first: a mounted player is carried by the horse, so the
    // horse has to have taken its step before the rider is placed on it.
    for (let i = 0; i < world.horses.length; i++) updateHorse(world, world.horses[i], dt);
    for (let i = world.carts.length - 1; i >= 0; i--) updateCart(world, world.carts[i], dt);
    updatePlayer(world, dt);
    for (let i = 1; i < world.actors.length; i++) updateVillager(world, world.actors[i], dt);
    if (!world.player.mount && !world.player.seat) resolveActorCollisions(world);
    separateVillagers(world);
    resolveRagdollCollisions(world, dt);
    updateDebris(world, dt);
    separateHorses(world);
    D.update(world.box, dt);

    world.prompt = world.box.open ? null : promptFor(world);

    // Locked to the player at all times — no easing, no edge clamping. It
    // follows the *rounded* player position, which lands the player sprite on
    // the same exact pixel every frame; tracking the unrounded position makes
    // them jitter a pixel back and forth as they walk.
    world.camX = Math.round(world.player.x) - (VIEW_W >> 1);
    world.camY = Math.round(world.player.y) - (VIEW_H >> 1);

    // reins last: they are solved in screen space, so they need this frame's
    // camera and this frame's final positions for both ends
    for (let i = 0; i < world.horses.length; i++) updateReins(world, world.horses[i], dt);
  }

  /* ---------- drawing ---------- */

  const SHADOW = R.pack(26, 40, 26);
  const LABEL = R.pack(238, 232, 216);
  const LABEL_SHADOW = R.pack(20, 22, 28);

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



  /* ================== reins ==================
   *
   * A rein belongs to neither sprite: it spans the gap from the driver's hands
   * to the horse's bit, and those two are drawn into different buffers. So it
   * is solved and drawn in screen space instead — a short verlet rope with
   * both ends pinned, gravity pulling the middle down. That gives it the sag
   * of a slack rein at a standstill and the snap of a taut one when the horse
   * pulls away, for free, and it swings with the horse rather than being a
   * rigid line stuck between two points.
   */

  const REIN_POINTS = 6;
  const REIN_GRAV = 26;
  const REIN_ITER = 4;
  const REIN_COLOUR = R.pack(58, 42, 26);
  const REIN_LIGHT = R.pack(84, 62, 38);

  /* Screen position of a point given in a model's own space, for a model
   * standing at (ex, ey) in the world and rotated by `yaw`. The buffer's own
   * origin cancels out, so this does not care which sprite the model is in. */
  function projectModelPoint(world, ex, ey, yaw, lx, ly, lz) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const wx = lx * c + lz * s;
    const wz = -lx * s + lz * c;
    const cosP = Math.cos(CAM_PITCH), sinP = Math.sin(CAM_PITCH);
    return {
      x: (Math.round(ex) - world.camX) * PIXEL + wx * CAM_SCALE,
      y: (Math.round(ey) - world.camY) * PIXEL - (ly * cosP - wz * sinP) * CAM_SCALE
    };
  }

  /* Where the reins are held and where they end: the driver's two hands, and
   * the rings of the bit either side of the horse's mouth. */
  function reinAnchors(world, h) {
    const holder = h.rider || (h.cart && h.cart.rider);
    if (!holder || HM.isDown(h)) return null;

    /* The bit goes where the horse's mouth actually is, read off the posed
     * skeleton. Guessing it from the body dimensions puts it somewhere around
     * the withers, and the rein then spans about seven pixels. */
    HM.poseGait(h.model, HM.quantiseTime(h.animTime), h.gait);
    const j = HM.jointPositions(h.model, 0);
    const poll = j.poll, muzzle = j.muzzle;
    // a little back from the nose, where the bit sits in the mouth
    const bitY = muzzle[1] + (poll[1] - muzzle[1]) * 0.22;
    const bitZ = muzzle[2] + (poll[2] - muzzle[2]) * 0.22;
    const scale = h.model.root.scale || 1;
    const spread = h.model.dims.headW * 0.5 * scale + 0.7;

    let hx, hy, yaw, fwd, lift;
    if (h.rider === holder) {
      const sp = HM.saddlePoint(h.model);
      hx = holder.x; hy = holder.y; yaw = h.yaw;
      // hands out in front of the chest, which sits above the seat
      fwd = sp.z + 8.5;
      lift = seatHeight(holder, sp.y) + holder.model.dims.legTotal
        + holder.model.dims.torsoH * 0.62;
    } else {
      const c = h.cart;
      hx = holder.x; hy = holder.y; yaw = c.yaw;
      fwd = 7.0;
      lift = seatHeight(holder, c.def.deckY + c.def.sideH * 0.55 + 4.0)
        + holder.model.dims.legTotal + holder.model.dims.torsoH * 0.62 + (c.bounce || 0);
    }

    const hand = [];
    const bit = [];
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      hand.push(projectModelPoint(world, hx, hy, yaw, side * 3.2, lift, fwd));
      bit.push(projectModelPoint(world, h.x, h.y, h.yaw, side * spread, bitY, bitZ));
    }
    return { hand: hand, bit: bit };
  }

  function updateReins(world, h, dt) {
    const a = reinAnchors(world, h);
    if (!a) { h.reins = null; return; }
    if (!h.reins) {
      h.reins = [];
      for (let i = 0; i < 2; i++) {
        const pts = [];
        for (let k = 0; k < REIN_POINTS; k++) {
          const t = k / (REIN_POINTS - 1);
          pts.push({
            x: a.hand[i].x + (a.bit[i].x - a.hand[i].x) * t,
            y: a.hand[i].y + (a.bit[i].y - a.hand[i].y) * t,
            px: 0, py: 0
          });
          pts[k].px = pts[k].x; pts[k].py = pts[k].y;
        }
        h.reins.push(pts);
      }
    }
    // The camera moves under the rope; without this the whole rein lags a
    // frame behind the world every time the view scrolls.
    const shiftX = (world.camX - (h.reinCamX === undefined ? world.camX : h.reinCamX)) * PIXEL;
    const shiftY = (world.camY - (h.reinCamY === undefined ? world.camY : h.reinCamY)) * PIXEL;
    h.reinCamX = world.camX; h.reinCamY = world.camY;

    for (let i = 0; i < 2; i++) {
      const pts = h.reins[i];
      const span = Math.hypot(a.bit[i].x - a.hand[i].x, a.bit[i].y - a.hand[i].y);
      // a little longer than the gap, so it hangs slack until the horse pulls
      const seg = (span * 1.06 + 4) / (REIN_POINTS - 1);
      for (let k = 0; k < pts.length; k++) {
        const q = pts[k];
        q.x -= shiftX; q.y -= shiftY;
        q.px -= shiftX; q.py -= shiftY;
        const vx = (q.x - q.px) * 0.94, vy = (q.y - q.py) * 0.94;
        q.px = q.x; q.py = q.y;
        q.x += vx; q.y += vy + REIN_GRAV * dt;
      }
      for (let it = 0; it < REIN_ITER; it++) {
        pts[0].x = a.hand[i].x; pts[0].y = a.hand[i].y;
        pts[pts.length - 1].x = a.bit[i].x; pts[pts.length - 1].y = a.bit[i].y;
        for (let k = 0; k < pts.length - 1; k++) {
          const p0 = pts[k], p1 = pts[k + 1];
          const dx = p1.x - p0.x, dy = p1.y - p0.y;
          const d = Math.hypot(dx, dy) || 1e-5;
          const f = ((d - seg) / d) * 0.5;
          const ox = dx * f, oy = dy * f;
          if (k > 0) { p0.x += ox; p0.y += oy; }
          if (k + 1 < pts.length - 1) { p1.x -= ox; p1.y -= oy; }
        }
      }
      pts[0].x = a.hand[i].x; pts[0].y = a.hand[i].y;
      pts[pts.length - 1].x = a.bit[i].x; pts[pts.length - 1].y = a.bit[i].y;
    }
  }

  function drawReins(target, h) {
    if (!h.reins) return;
    for (let i = 0; i < 2; i++) {
      const pts = h.reins[i];
      // the far rein is drawn a shade lighter, so the two read as two
      const col = i ? REIN_COLOUR : REIN_LIGHT;
      for (let k = 0; k < pts.length - 1; k++) {
        R.drawLine(target, pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y, col, PIXEL);
      }
    }
  }

  /* ---------- drawing horses, carts and wreckage ---------- */

  /* Each sprite buffer needs its own camera, because a camera's ox/oy is where
   * the model's origin lands *inside that buffer*. Reusing the actor camera
   * for a bigger horse buffer draws the horse at the villager's origin and the
   * sprite is then blitted as though its feet were somewhere else entirely. */
  const HORSE_CAM = R.makeCamera(CAM_PITCH, CAM_SCALE, HORSE_BUF.ox, HORSE_BUF.oy);
  const CART_CAM = R.makeCamera(CAM_PITCH, CAM_SCALE, CART_BUF.ox, CART_BUF.oy);
  const DEBRIS_CAM = R.makeCamera(CAM_PITCH, CAM_SCALE, DEBRIS_BUF.ox, DEBRIS_BUF.oy);

  /* The rider is composited into the horse's own buffer rather than drawn as a
   * separate sprite. They share a z-buffer that way, so the near stirrup
   * covers the leg and the far one does not — which is the whole reason the
   * horse is a 3D model and not a sprite sheet. */
  function renderMount(h) {
    const camera = HORSE_CAM;
    const rider = h.rider;
    const qYaw = HM.quantiseYaw(h.yaw);
    const qTime = HM.quantiseTime(h.animTime);
    const riderKey = rider
      ? [rider.character.name, HM.quantiseTime(rider.animTime),
        rider.blink > 0.5 ? 1 : rider.blink > 0 ? 2 : 0,
        Math.round((rider.rein || 0) * 4),
        Math.round((rider.mountTime || 0) / MOUNT_TIME * 6)].join(',')
      : '-';
    const key = HM.isDown(h) ? null : [qTime, qYaw, h.gait, riderKey].join('|');
    if (key !== null && key === h._key) return h.buffer;
    h._key = key === null ? '' : key;

    R.clearTarget(h.buffer);
    if (HM.isDown(h) && h.fall.p) {
      HM.drawRagdoll(h.buffer, h.model, camera, h.fall);
    } else {
      HM.poseGait(h.model, qTime, h.gait);
      Rig.drawModel(h.buffer, h.model, camera, { yaw: qYaw });
      if (rider) drawRider(h.buffer, rider, h, camera, qYaw);
    }
    R.traceOutline(h.buffer, Rig.OUTLINE);
    return h.buffer;
  }

  /* drawModel applies `offset` in world space, after the model's own yaw, so
   * the saddle point has to be rotated into world space here. Passing the raw
   * model-space offset leaves the rider pinned to world north while the horse
   * turns underneath them. */
  function seatOffset(yaw, forward, lift) {
    return [forward * Math.sin(yaw), lift, forward * Math.cos(yaw)];
  }

  /* The rider's model has its origin at the feet, so planting it at the
   * saddle height leaves them hovering a whole leg above the horse. What has
   * to sit on the saddle is the pelvis. */
  function seatHeight(rider, saddleY) {
    const scale = rider.model.root.scale || 1;
    return saddleY - rider.model.dims.legTotal * scale;
  }

  function drawRider(target, rider, h, camera, qYaw) {
    const sp = HM.saddlePoint(h.model);
    const seatY = seatHeight(rider, sp.y);
    const face = CM.buildFaceParts(rider.model, {
      blink: rider.blink, viseme: rider.viseme, gaze: rider.gaze
    });
    if (rider.mountTime !== undefined && rider.mountTime < MOUNT_TIME) {
      // still swinging up: the rider rises from beside the horse to the seat
      const k = rider.mountTime / MOUNT_TIME;
      Rig.poseMount(rider.model, k);
      const off = seatOffset(qYaw, sp.z, seatY * (0.2 + 0.8 * k));
      // swings in from the near side as they rise
      off[0] += Math.cos(qYaw) * (1 - k) * 13;
      off[2] += -Math.sin(qYaw) * (1 - k) * 13;
      Rig.drawModel(target, rider.model, camera, { yaw: qYaw, faceParts: face, offset: off });
      return;
    }
    Rig.poseRide(rider.model, HM.quantiseTime(rider.animTime), {
      gait: h.gait, rein: rider.rein || 0, turn: rider.turn || 0
    });
    Rig.drawModel(target, rider.model, camera, {
      yaw: qYaw, faceParts: face, offset: seatOffset(qYaw, sp.z, seatY)
    });
  }

  function renderCart(c) {
    const camera = CART_CAM;
    const qYaw = HM.quantiseYaw(c.yaw);
    const driver = c.rider;
    const driverKey = driver
      ? [driver.character.name, HM.quantiseTime(driver.animTime),
        driver.blink > 0.5 ? 1 : 0, Math.round((driver.rein || 0) * 4),
        Math.round((driver.jolt || 0) * 3)].join(',')
      : '-';
    const qBounce = Math.round((c.bounce || 0) * 2) / 2;
    const qLean = Math.round((c.lean || 0) * 12) / 12;
    const key = [qYaw, c.stage, c.hitFlash > 0 ? 1 : 0, qBounce, qLean, driverKey].join('|');
    if (key === c._key) return c.buffer;
    c._key = key;

    if (c.spriteStage !== c.stage) {
      // parts are rebuilt only when the damage stage changes, not per frame
      c.parts = V.buildParts(c.type, c.stage, CM.makeRng(c.seed >>> 0));
      c.spriteStage = c.stage;
    }
    R.clearTarget(c.buffer);
    let m = R.rotationY(qYaw);
    if (qLean) m = R.multiply(m, R.rotationZ(qLean));
    m = R.multiply(m, R.translation(0, qBounce, 0));
    for (let i = 0; i < c.parts.length; i++) {
      const pt = c.parts[i];
      R.drawMesh(c.buffer, m, pt.mesh,
        R.ramp(c.hitFlash > 0 ? CM.shade(pt.colour, 0.35) : pt.colour), camera, pt);
    }
    if (driver) {
      const face = CM.buildFaceParts(driver.model, {
        blink: driver.blink, viseme: driver.viseme, gaze: driver.gaze
      });
      Rig.poseDrive(driver.model, HM.quantiseTime(driver.animTime), {
        rein: driver.rein || 0, turn: driver.turn || 0, jolt: driver.jolt || 0
      });
      Rig.drawModel(c.buffer, driver.model, camera, {
        yaw: qYaw, faceParts: face,
        offset: seatOffset(qYaw, -c.def.length * 0.22,
          seatHeight(driver, c.def.deckY + c.def.sideH * 0.55 + 4.0) + qBounce)
      });
    }
    R.traceOutline(c.buffer, Rig.OUTLINE);
    return c.buffer;
  }

  const DEBRIS_STEP = Math.PI / 8;
  function renderDebris(world, d) {
    const camera = DEBRIS_CAM;
    const qp = Math.round(d.pitch / DEBRIS_STEP) * DEBRIS_STEP;
    const qr = Math.round(d.roll / DEBRIS_STEP) * DEBRIS_STEP;
    const qy = Math.round(d.yaw / DEBRIS_STEP) * DEBRIS_STEP;
    const key = [d.kind, qp, qr, qy].join('|');
    if (d.buffer && key === d._key) return d.buffer;
    d._key = key;
    if (!d.buffer) d.buffer = R.createTarget(DEBRIS_BUF.w, DEBRIS_BUF.h);
    if (!world._debrisMesh) world._debrisMesh = {};
    if (!world._debrisMesh[d.kind]) world._debrisMesh[d.kind] = V.debrisMesh(d.kind);
    R.clearTarget(d.buffer);
    let m = R.multiply(R.rotationY(qy), R.rotationX(qp));
    m = R.multiply(m, R.rotationZ(qr));
    const parts = world._debrisMesh[d.kind];
    for (let i = 0; i < parts.length; i++) {
      R.drawMesh(d.buffer, m, parts[i].mesh, R.ramp(parts[i].colour), camera, parts[i]);
    }
    R.traceOutline(d.buffer, Rig.OUTLINE);
    return d.buffer;
  }

  const HP_GOOD = R.pack(126, 168, 84);
  const HP_WARN = R.pack(196, 154, 62);
  const HP_BAD = R.pack(178, 66, 52);
  const HP_BACK = R.pack(28, 26, 30);
  const HP_EDGE = R.pack(74, 66, 58);

  function bar(target, x, y, w, h, frac, colour) {
    R.fillRect(target, x - PIXEL, y - PIXEL, w + PIXEL * 2, h + PIXEL * 2, HP_EDGE);
    R.fillRect(target, x, y, w, h, HP_BACK);
    R.fillRect(target, x, y, Math.round(w * Math.max(0, Math.min(1, frac)) / PIXEL) * PIXEL, h, colour);
  }

  function drawCartHealth(target, c) {
    const w = 72 * PIXEL, h = 5 * PIXEL;
    const x = Math.round((VIEW_W - 72) / 2) * PIXEL, y = 12 * PIXEL;
    const col = c.stage === 0 ? HP_GOOD : c.stage === 1 ? HP_WARN : HP_BAD;
    bar(target, x, y, w, h, c.hp / c.maxHp, col);
    const label = c.def.label;
    T.drawShadowed(target, label, x + w + 4 * PIXEL, y - PIXEL, LABEL, LABEL_SHADOW);
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
      // a rider is drawn into the horse's buffer, not on their own
      if (a.mount || a.seat) continue;
      if (a.x - cx < -70 || a.x - cx > VIEW_W + 70 || a.y - cy < -110 || a.y - cy > VIEW_H + 70) continue;
      drawables.push({ y: a.y, actor: a });
    }
    for (let i = 0; i < world.horses.length; i++) {
      const h = world.horses[i];
      if (h.x - cx < -110 || h.x - cx > VIEW_W + 110 || h.y - cy < -130 || h.y - cy > VIEW_H + 90) continue;
      drawables.push({ y: h.y, horse: h });
    }
    for (let i = 0; i < world.carts.length; i++) {
      const c = world.carts[i];
      if (c.x - cx < -120 || c.x - cx > VIEW_W + 120 || c.y - cy < -120 || c.y - cy > VIEW_H + 90) continue;
      drawables.push({ y: c.y, cart: c });
    }
    for (let i = 0; i < world.debris.length; i++) {
      const d = world.debris[i];
      if (d.x - cx < -40 || d.x - cx > VIEW_W + 40 || d.y - cy < -60 || d.y - cy > VIEW_H + 40) continue;
      drawables.push({ y: d.y, debris: d });
    }
    drawables.sort(function (a, b) { return a.y - b.y; });

    for (let i = 0; i < drawables.length; i++) {
      const d = drawables[i];
      if (d.horse) {
        const h = d.horse;
        const down = HM.isDown(h) ? 1 : 0;
        R.fillEllipse(target, (Math.round(h.x) - cx) * PIXEL, (Math.round(h.y) - cy) * PIXEL,
          (13 + down * 6) * PIXEL, (5 + down * 2) * PIXEL, SHADOW, 0.32);
        R.blit(target, renderMount(h),
          (Math.round(h.x) - cx) * PIXEL - HORSE_BUF.ox,
          (Math.round(h.y) - cy) * PIXEL - HORSE_BUF.oy);
        if (h.rider) drawReins(target, h);
      } else if (d.cart) {
        const c = d.cart;
        R.fillEllipse(target, (Math.round(c.x) - cx) * PIXEL, (Math.round(c.y) - cy) * PIXEL,
          16 * PIXEL, 6 * PIXEL, SHADOW, 0.3);
        R.blit(target, renderCart(c),
          (Math.round(c.x) - cx) * PIXEL - CART_BUF.ox,
          (Math.round(c.y) - cy) * PIXEL - CART_BUF.oy);
        if (c.rider && c.hitch) drawReins(target, c.hitch);
      } else if (d.debris) {
        const b = d.debris;
        R.fillEllipse(target, (Math.round(b.x) - cx) * PIXEL, (Math.round(b.y) - cy) * PIXEL,
          5 * PIXEL, 2 * PIXEL, SHADOW, 0.22);
        R.blit(target, renderDebris(world, b),
          (Math.round(b.x) - cx) * PIXEL - DEBRIS_BUF.ox,
          (Math.round(b.y) - cy) * PIXEL - DEBRIS_BUF.oy - Math.round(b.z * CAM_SCALE));
      } else if (d.prop) {
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

    /* No hints. A horse gets its name over its head, the same way a villager
     * does, and nothing else — the controls are not a tutorial and the stats
     * are the animal's business, not a readout. */
    const pr = world.prompt;
    if (pr && pr.name) {
      const at = pr.at;
      const nx = (Math.round(at.x) - cx) * PIXEL - Math.round(T.measure(pr.name) / 2);
      const ny = (Math.round(at.y) - cy) * PIXEL - (pr.kind === 'talk' ? 58 : 66) * PIXEL;
      T.drawShadowed(target, pr.name, nx, ny, LABEL, LABEL_SHADOW);
    }

    // the cart's condition, while you are the one driving it
    const driven = world.player.seat || (world.player.mount && world.player.mount.cart);
    if (driven && !driven.broken) drawCartHealth(target, driven);


    D.draw(world.box, target);
  }

  global.World = {
    VIEW_W, VIEW_H, RENDER_W, RENDER_H, PIXEL, WORLD_W, WORLD_H,
    ACTOR_BUF, CAM_PITCH, CAM_SCALE,
    SPEED, TALK_RANGE, NUDGE_SPEED, TRIP_SPEED, FALL_SPEED, TEST_PAGES,
    createWorld, update, draw, tryTalk, nearestTalkable, distance, beginConversation,
    mount, dismount, hitchCart, unhitchCart, takeSeat, leaveSeat,
    nearestHorse, nearestCart, damageCart, breakCart, promptFor,
    MOUNT_RANGE, HITCH_RANGE, HORSE_FALL_SPEED
  };
})(window);
