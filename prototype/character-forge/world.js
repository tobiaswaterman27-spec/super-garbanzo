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
  const CB = global.Combat;
  const I = global.Items;

  // The field of view in world units, and how many art pixels each unit gets.
  // Raising PIXEL makes the pixels smaller and more numerous — finer pixel
  // art, same amount of world on screen.
  const VIEW_W = 320, VIEW_H = 180;
  const PIXEL = 3;
  const RENDER_W = VIEW_W * PIXEL, RENDER_H = VIEW_H * PIXEL;
  // Large enough that the camera can stay locked to the player without ever
  // running off the edge of the generated ground.
  // Room to run. A chase that ends at the edge of the map after four seconds
  // is not a chase, so the field is far larger than the village needs.
  const WORLD_W = 2600, WORLD_H = 1800;
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

    /* The field noise varies over world units, not over art pixels, so it is
     * evaluated once per world unit and filled into the PIXEL x PIXEL block —
     * nine times fewer trig calls for an identical result. The speckle stays
     * per pixel, because that is the grass texture. */
    for (let wy = 0; wy < WORLD_H; wy++) {
      const y = wy;
      const cosY = Math.cos(y * 0.11);
      for (let wx = 0; wx < WORLD_W; wx++) {
        const n = Math.sin(wx * 0.09) * cosY + Math.sin((wx + y) * 0.05) * 0.6;
        const base = n > 0.8 ? 3 : n > 0.15 ? 1 : n > -0.5 ? 0 : 2;
        for (let sy = 0; sy < PIXEL; sy++) {
          const row = (wy * PIXEL + sy) * GROUND_W + wx * PIXEL;
          for (let sx = 0; sx < PIXEL; sx++) {
            buf[row + sx] = rng() < 0.05 ? 4 : base;
          }
        }
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
      arrows: [],
      blood: [],
      loot: [],            // items lying on the grass
      container: null,      // the chest you have open, if any
      ui: { open: false, hover: null, drag: null, mx: 0, my: 0 },
      time: 0,
      wanted: 0,
      reputation: 0,
      reputationCriminal: 0,
      lastSeenAt: -999,
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
    player._id = 'player';
    player.leftHanded = !!playerCharacter.leftHanded;
    // You start with nothing. Everything you carry, you took from somewhere.
    player.buffer = R.createTarget(ACTOR_BUF.w, ACTOR_BUF.h);
    world.actors.push(player);
    world.player = player;

    /* villagers, and among them the watch */
    const GUARD_KIT = ['sword', 'club', 'spear', 'sword', 'bow'];
    /* Enough of them that seating eleven in the carts and on horseback still
     * leaves a village walking about. */
    for (let i = 0; i < 26; i++) {
      const ch = CM.randomCharacter(rng);
      const guard = i < 6;
      if (guard) {
        // the livery: a guard off duty is just a person, but on duty they are
        // unmistakably one of them
        ch.tunic = 'slate';
        ch.trouser = 'charcoal';
        ch.garment = 'surcoat';
      }
      const a = Rig.createActor(ch,
        player.x + (rng() - 0.5) * 900, player.y + (rng() - 0.5) * 620,
        (seed + i * 977) >>> 0);
      a._id = 'v' + i;
      a.buffer = R.createTarget(ACTOR_BUF.w, ACTOR_BUF.h);
      a.leftHanded = rng() < 0.12;
      a.brain = { state: 'pause', timer: 0.5 + rng() * 2.5, dirIndex: Math.floor(rng() * 8),
        gestureCooldown: rng() * 5, partner: null, chatCooldown: rng() * 8,
        guard: guard, guardState: 'patrol' };
      if (guard) {
        const kit = GUARD_KIT[i % GUARD_KIT.length];
        a.inv[I.HAND] = I.stack(kit, 1);
        if (kit === 'bow') I.add(a.inv, 'arrow', 18);
        else a.inv[I.SHIELD] = I.stack('shield', 1);
        // A guard always keeps a slot free. It is what lets them put the
        // weapon away and deal with something without killing anybody.
        a.stowed = undefined;
        a.alert = true;
      }
      // Villagers are not armed. A town where every baker is carrying a club
      // turns any incident into a brawl, and it makes the watch meaningless.
      if (rng() < 0.6) I.add(a.inv, 'coin', 3 + Math.floor(rng() * 30));
      world.actors.push(a);
    }

    /* horses, loose on the grass near where the player starts */
    for (let i = 0; i < 9; i++) {
      const hr = CM.makeRng((seed + 4001 + i * 733) >>> 0);
      const h = HM.createEntity(HM.randomHorse(hr),
        player.x + (rng() - 0.5) * 300, player.y + 60 + (rng() - 0.5) * 260,
        (seed + 4001 + i * 733) >>> 0);
      h.yaw = Math.floor(rng() * 4) * (Math.PI / 2);
      h.targetYaw = h.yaw;
      h.buffer = R.createTarget(HORSE_BUF.w, HORSE_BUF.h);
      world.horses.push(h);
    }

    /* People are out and about, and they travel together. Two up on a horse,
     * a cart with three in the back, two riding on the chest cart and one
     * alone in the carriage — which is rather the point of a carriage. */
    let next = 8;
    function spare() {
      while (next < world.actors.length) {
        const a = world.actors[next++];
        if (a && !a.brain.guard && !a.mount && !a.seat) return a;
      }
      return null;
    }

    const ridden = world.horses[0];
    if (ridden) {
      const rider = spare();
      if (rider) {
        rider.mount = ridden; ridden.rider = rider;
        rider.mountTime = MOUNT_TIME;
        rider.x = ridden.x; rider.y = ridden.y;
        rider.brain.rides = true;
        rider.brain.rideTimer = 2 + rng() * 5;
        const pillion = spare();
        if (pillion) {
          ridden.pillion = pillion;
          pillion.carriedBy = ridden;
          pillion.x = ridden.x; pillion.y = ridden.y;
        }
      }
    }

    /* one of each cart, parked where you can get to them */
    const cartTypes = ['cart', 'chestCart', 'luxuryCart'];
    for (let i = 0; i < cartTypes.length; i++) {
      const c = V.create(cartTypes[i],
        player.x - 90 + i * 78, player.y - 66 + (i % 2) * 26,
        (seed + 9001 + i * 311) >>> 0);
      c.yaw = Math.PI / 2;
      c.buffer = R.createTarget(CART_BUF.w, CART_BUF.h);
      if (c.def.chest) {
        // something to actually find, so the container is worth opening
        c.store = I.createInventory(I.CHEST_SLOTS, false);
        const loot = ['sword', 'axe', 'mace', 'dagger', 'club', 'spear',
          'greatsword', 'poleaxe', 'bow', 'crossbow', 'shield', 'buckler'];
        for (let k = 0; k < loot.length; k++) I.add(c.store, loot[k], 1);
        I.add(c.store, 'arrow', 40);
        I.add(c.store, 'bolt', 25);
        I.add(c.store, 'bandage', 4);
      }
      world.carts.push(c);
    }

    // each cart gets a horse in the shafts, a driver and its passengers
    const LOAD = { cart: 3, chestCart: 2, luxuryCart: 1 };
    for (let i = 0; i < world.carts.length; i++) {
      const c = world.carts[i];
      const h = world.horses[2 + i];
      if (!h || h.rider) continue;
      hitchCart(world, h, c);
      const driver = spare();
      if (!driver) continue;
      c.rider = driver;
      driver.seat = c;
      driver.brain.drives = true;
      driver.brain.rideTimer = 2 + rng() * 6;
      driver.x = c.x; driver.y = c.y;
      c.riders = [];
      const n = LOAD[c.type] || 1;
      for (let k = 0; k < n; k++) {
        const pass = spare();
        if (!pass) break;
        pass.carriedBy = c;
        pass.x = c.x; pass.y = c.y;
        c.riders.push(pass);
      }
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
    /* You cannot trip over a tree you are already lying against. The ragdoll
     * hands its drift back as movement, which carried the body into the trunk
     * and read as a fresh impact, so the player was knocked down again every
     * time they nearly got up — the freeze was being floored on a loop, not a
     * pose that stopped animating. */
    if (Rig.isDown(player)) return;
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
      // Anyone being carried sits at their vehicle's own position, so several
      // of them share a point by design. Pushing those apart would drag the
      // passengers out of the cart they are sitting in.
      if (list[i].mount || list[i].seat || list[i].carriedBy) continue;
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.mount || b.seat || b.carriedBy) continue;
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
      /* A shoulder is not a weapon. Running into someone drives them back on
       * their heels with their arms up — it does not put them on the floor,
       * however fast you were going. Before this, sprinting through a line of
       * guards flattened all of them, which turned every chase into a walk. */
      if (speed > NUDGE_SPEED && !Rig.isDown(a) && a.hitCooldown <= 0) {
        const side = (nx * Math.cos(a.yaw) - ny * Math.sin(a.yaw)) > 0 ? 1 : -1;
        if (chasing(a)) {
          // you cannot body-check your way past the watch
          Rig.stumble(a, nx, ny, 30, 0.22);
          player.vx *= 0.7; player.vy *= 0.7;
          a.hitCooldown = 0.35;
          continue;
        }
        if (speed > TRIP_SPEED) {
          Rig.stumble(a, nx, ny, 70 + speed * 0.5, 0.7);
          a.reaction = { kind: 'stagger', k: 0, t: 0, side: side,
            duration: 0.34 + Math.min(0.3, speed / 500) };
          a.attack = null;
        } else {
          // a bump in passing: they step aside
          Rig.shove(a, nx, ny, 14 + speed * 0.18);
          Rig.nudge(a, nx, ny, 0.6, CHEST_H);
        }
        a.hitCooldown = 0.45;
        if (world.talkingTo === a) D.close(world.box);
        /* Walking into someone is not a crime. Barging them hard enough to
         * put them off their feet is. The watch does not care that you were
         * standing near a person; it cares that you shoved one. */
        if (speed > TRIP_SPEED) {
          witness(world, player, a, 'shove', a.x, a.y);
          reactToHit(world, a, player, { severity: 'minor', zone: 'chest' });
        }

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

        /* Two horses meeting at speed is a collision, not a nudge. The one
         * carrying less momentum into it goes over, and whoever is on it goes
         * with it. */
        // A trot into a standing horse is enough to put one of them over; it
        // does not have to be two gallops meeting head on.
        const closing = Math.max(
          (a.vx - b.vx) * nx + (a.vy - b.vy) * ny,
          Math.max(Math.hypot(a.vx, a.vy), Math.hypot(b.vx, b.vy)) * 0.72);
        if (closing > 62 && a.hitCooldown <= 0 && b.hitCooldown <= 0) {
          const aPow = HM.power(a.horse) * Math.hypot(a.vx, a.vy);
          const bPow = HM.power(b.horse) * Math.hypot(b.vx, b.vy);
          const loser = aPow < bPow ? a : b;
          const winner = loser === a ? b : a;
          const sx = loser === a ? -nx : nx, sy = loser === a ? -ny : ny;
          if (loser.rider) unseat(world, loser, sx, sy, closing / 26);
          HM.knockDown(loser, sx, sy, 3.2 + closing / 32);
          winner.vx *= 0.55; winner.vy *= 0.55;
          a.hitCooldown = 0.7; b.hitCooldown = 0.7;
          bleedAt(world, loser.x, loser.y, 1.2, 'blunt');
        }
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



  /* ================== inventory ==================
   *
   * Drawn into the same pixel buffer as the world, because a DOM panel over a
   * pixel-art game looks like a DOM panel over a pixel-art game. The world
   * keeps running behind it: opening your bag is not a pause button.
   */

  const SLOT = 21;            // view units
  const SLOT_GAP = 2;
  const UI = {
    panel: R.pack(38, 33, 29, 242),
    panelEdge: R.pack(92, 78, 60),
    slot: R.pack(58, 51, 44),
    slotEdge: R.pack(24, 21, 19),
    slotHot: R.pack(96, 84, 62),
    handSlot: R.pack(70, 57, 40),
    text: R.pack(238, 232, 216),
    dim: R.pack(168, 156, 136),
    shadow: R.pack(18, 16, 20),
    tip: R.pack(26, 22, 30, 246),
    tipEdge: R.pack(120, 100, 70)
  };

  const ICON_CAM = R.makeCamera(0.34, 1.05 * PIXEL, 0, 0);

  function slotRect(x, y) {
    return { x: x, y: y, w: SLOT, h: SLOT };
  }

  /* The player's own layout: shield on the left, the four-by-two block in the
   * middle, weapon on the right. Being left-handed swaps which hand holds
   * what, not where the slots sit — moving them would mean relearning the
   * grid for no reason at all. */
  function playerSlots(ox, oy) {
    const out = [];
    const gridW = I.GRID_COLS * SLOT + (I.GRID_COLS - 1) * SLOT_GAP;
    const gx = ox + SLOT + 10;
    for (let r = 0; r < I.GRID_ROWS; r++) {
      for (let c = 0; c < I.GRID_COLS; c++) {
        out.push({ index: r * I.GRID_COLS + c,
          x: gx + c * (SLOT + SLOT_GAP), y: oy + r * (SLOT + SLOT_GAP) });
      }
    }
    const midY = oy + (I.GRID_ROWS * SLOT + (I.GRID_ROWS - 1) * SLOT_GAP - SLOT) / 2;
    out.push({ index: I.SHIELD, x: ox, y: midY, hand: 'shield' });
    out.push({ index: I.HAND, x: gx + gridW + 10, y: midY, hand: 'weapon' });
    return out;
  }

  function chestSlots(ox, oy) {
    const out = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        const i = r * 3 + c;
        if (i >= I.CHEST_SLOTS) continue;
        out.push({ index: i, x: ox + c * (SLOT + SLOT_GAP), y: oy + r * (SLOT + SLOT_GAP) });
      }
    }
    return out;
  }

  function layout(world) {
    const playerW = SLOT * 2 + 20 + I.GRID_COLS * SLOT + (I.GRID_COLS - 1) * SLOT_GAP;
    const playerH = I.GRID_ROWS * SLOT + (I.GRID_ROWS - 1) * SLOT_GAP;
    if (!world.container) {
      const ox = Math.round((VIEW_W - playerW) / 2);
      const oy = Math.round(VIEW_H - playerH - 22);
      return { player: playerSlots(ox, oy), chest: null,
        playerBox: { x: ox - 7, y: oy - 13, w: playerW + 14, h: playerH + 20 } };
    }
    // side by side: the chest on the left, what you are carrying on the right
    const chestW = 3 * SLOT + 2 * SLOT_GAP;
    const chestH = 5 * SLOT + 4 * SLOT_GAP;
    const gap = 16;
    const totalW = chestW + gap + playerW;
    const ox = Math.round((VIEW_W - totalW) / 2);
    const oy = Math.round((VIEW_H - chestH) / 2) + 4;
    const py = oy + Math.round((chestH - playerH) / 2);
    return {
      chest: chestSlots(ox, oy),
      player: playerSlots(ox + chestW + gap, py),
      chestBox: { x: ox - 7, y: oy - 13, w: chestW + 14, h: chestH + 20 },
      playerBox: { x: ox + chestW + gap - 7, y: py - 13, w: playerW + 14, h: playerH + 20 }
    };
  }

  function hitSlot(world, vx, vy) {
    const lay = layout(world);
    for (const side of ['player', 'chest']) {
      const list = lay[side];
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const sl = list[i];
        if (vx >= sl.x && vx < sl.x + SLOT && vy >= sl.y && vy < sl.y + SLOT) {
          return { side: side, index: sl.index, x: sl.x, y: sl.y };
        }
      }
    }
    return null;
  }

  function invOf(world, side) {
    return side === 'chest' ? (world.container ? world.container.store : null)
      : world.player.inv;
  }

  function drawPanel(target, box) {
    R.fillRect(target, (box.x - 1) * PIXEL, (box.y - 1) * PIXEL,
      (box.w + 2) * PIXEL, (box.h + 2) * PIXEL, UI.panelEdge);
    R.fillRect(target, box.x * PIXEL, box.y * PIXEL, box.w * PIXEL, box.h * PIXEL, UI.panel);
  }

  function drawSlot(target, sl, inv, hot, hand) {
    const x = sl.x * PIXEL, y = sl.y * PIXEL, s = SLOT * PIXEL;
    R.fillRect(target, x - PIXEL, y - PIXEL, s + PIXEL * 2, s + PIXEL * 2, UI.slotEdge);
    R.fillRect(target, x, y, s, s, hot ? UI.slotHot : (hand ? UI.handSlot : UI.slot));
    const st = inv ? inv[sl.index] : null;
    if (!st) return;
    drawIcon(target, st.id, sl.x + SLOT / 2, sl.y + SLOT / 2);
    if (st.count > 1) {
      const label = String(st.count);
      T.drawShadowed(target, label,
        x + s - T.measure(label) - PIXEL, y + s - 9 * PIXEL, UI.text, UI.shadow);
    }
  }

  const _iconBuf = {};
  function drawIcon(target, id, cxView, cyView) {
    // one buffer per item type, drawn once and blitted thereafter
    let buf = _iconBuf[id];
    if (!buf) {
      const size = (SLOT - 3) * PIXEL;
      buf = _iconBuf[id] = R.createTarget(size, size);
      R.clearTarget(buf);
      const view = I.iconView(id);
      const cam = R.makeCamera(0.34, 1.05 * PIXEL * view.scale, size / 2, size / 2 + 2 * PIXEL);
      let m = R.multiply(R.rotationY(view.yaw), R.rotationX(view.pitch));
      const parts = I.iconParts(id);
      for (let i = 0; i < parts.length; i++) {
        R.drawMesh(buf, m, parts[i].mesh, R.ramp(parts[i].colour), cam, parts[i]);
      }
      R.traceOutline(buf, Rig.OUTLINE);
    }
    R.blit(target, buf, Math.round(cxView * PIXEL - buf.w / 2),
      Math.round(cyView * PIXEL - buf.h / 2));
  }

  /* The name of whatever is under the cursor, in a little box above it. */
  function drawTooltip(target, world, label, vx, vy) {
    const w = T.measure(label) / PIXEL + 8;
    const h = 13;
    let x = vx + 5, y = vy - h - 3;
    if (x + w > VIEW_W - 2) x = VIEW_W - 2 - w;
    if (y < 2) y = vy + 8;
    R.fillRect(target, (x - 1) * PIXEL, (y - 1) * PIXEL, (w + 2) * PIXEL, (h + 2) * PIXEL, UI.tipEdge);
    R.fillRect(target, x * PIXEL, y * PIXEL, w * PIXEL, h * PIXEL, UI.tip);
    T.drawShadowed(target, label, (x + 4) * PIXEL, (y + 3) * PIXEL, UI.text, UI.shadow);
    void world;
  }

  function drawInventory(world, target) {
    const ui = world.ui;
    const lay = layout(world);
    if (lay.chestBox) {
      drawPanel(target, lay.chestBox);
      T.drawShadowed(target, world.container.def.label,
        lay.chestBox.x * PIXEL + 4 * PIXEL, lay.chestBox.y * PIXEL + 2 * PIXEL,
        UI.text, UI.shadow);
      const store = world.container.store;
      for (let i = 0; i < lay.chest.length; i++) {
        const sl = lay.chest[i];
        const hot = ui.hover && ui.hover.side === 'chest' && ui.hover.index === sl.index;
        drawSlot(target, sl, store, hot, false);
      }
    }
    drawPanel(target, lay.playerBox);
    T.drawShadowed(target, world.player.character.name,
      lay.playerBox.x * PIXEL + 4 * PIXEL, lay.playerBox.y * PIXEL + 2 * PIXEL,
      UI.text, UI.shadow);
    for (let i = 0; i < lay.player.length; i++) {
      const sl = lay.player[i];
      const hot = ui.hover && ui.hover.side === 'player' && ui.hover.index === sl.index;
      drawSlot(target, sl, world.player.inv, hot, !!sl.hand);
    }

    // the stack on the cursor, and the name of whatever is under it
    if (ui.drag) {
      drawIcon(target, ui.drag.id, ui.mx, ui.my);
      if (ui.drag.count > 1) {
        const label = String(ui.drag.count);
        T.drawShadowed(target, label, (ui.mx + 5) * PIXEL, (ui.my + 2) * PIXEL,
          UI.text, UI.shadow);
      }
    } else if (ui.hover) {
      const inv = invOf(world, ui.hover.side);
      const st = inv ? inv[ui.hover.index] : null;
      if (st) {
        const d = I.def(st.id);
        drawTooltip(target, world, d ? d.label : st.id, ui.mx, ui.my);
      }
    }
  }

  /* ---------- inventory input ---------- */

  function openInventory(world) {
    world.ui.open = true;
    return true;
  }

  function closeInventory(world) {
    const ui = world.ui;
    // anything still on the cursor goes back where there is room, or on the floor
    if (ui.drag) {
      const left = I.add(world.player.inv, ui.drag.id, ui.drag.count);
      if (left > 0) spawnItem(world, world.player.x, world.player.y, ui.drag.id, left, 0, 0, 0.3);
      ui.drag = null;
    }
    ui.open = false;
    world.container = null;
    return true;
  }

  function invVisible(world) { return world.ui.open || !!world.container; }

  function invMove(world, vx, vy) {
    world.ui.mx = vx; world.ui.my = vy;
    world.ui.hover = hitSlot(world, vx, vy);
  }

  function invClick(world, vx, vy) {
    const ui = world.ui;
    invMove(world, vx, vy);
    const hit = ui.hover;
    if (!hit) {
      // clicking outside drops what you are holding
      if (ui.drag) {
        spawnItem(world, world.player.x, world.player.y, ui.drag.id, ui.drag.count, 0, 0, 0.4);
        ui.drag = null;
      }
      return true;
    }
    const inv = invOf(world, hit.side);
    if (!inv) return false;

    if (!ui.drag) {
      const st = inv[hit.index];
      if (!st) return false;
      // Lifting something out of someone else's chest is theft, whether or
      // not you have decided yet where to put it.
      if (hit.side === 'chest') reportTheft(world, world.player.x, world.player.y);
      ui.drag = { id: st.id, count: st.count, from: hit.side, fromIndex: hit.index };
      inv[hit.index] = null;
      return true;
    }
    // placing: hands only take what belongs in them
    const d = I.def(ui.drag.id);
    const isHand = hit.side === 'player' && (hit.index === I.HAND || hit.index === I.SHIELD);
    if (isHand) {
      if (hit.index === I.HAND && !(d && d.hand)) return false;
      if (hit.index === I.SHIELD && !(d && d.shield)) return false;
      // you cannot hold a shield and a weapon that needs both hands
      if (hit.index === I.SHIELD && I.held(world.player.inv)
        && I.held(world.player.inv).twoHanded) return false;
      if (hit.index === I.HAND && d.twoHanded && world.player.inv[I.SHIELD]) return false;
    }
    const there = inv[hit.index];
    if (there && there.id === ui.drag.id) {
      const room = d.stack - there.count;
      const take = Math.min(room, ui.drag.count);
      there.count += take;
      ui.drag.count -= take;
      if (ui.drag.count <= 0) ui.drag = null;
      return true;
    }
    inv[hit.index] = { id: ui.drag.id, count: ui.drag.count };
    ui.drag = there ? { id: there.id, count: there.count } : null;
    return true;
  }

  /* ---------- containers ---------- */

  /* Reachable only from the chest end of the cart. The shaft end is where a
   * horse goes, and pressing the same key in the same place for two different
   * things is how you end up hitching a horse when you meant to open a box. */
  function nearestChest(world) {
    const p = world.player;
    let best = null, bestD = 26;
    for (let i = 0; i < world.carts.length; i++) {
      const c = world.carts[i];
      if (!c.store || c.broken) continue;
      // the chest sits a little behind the middle; the shafts run forward
      const back = -c.def.length * 0.06;
      const cx = c.x + back * Math.sin(c.yaw);
      const cy = c.y + back * Math.cos(c.yaw);
      const d = Math.hypot(cx - p.x, (cy - p.y) * 1.4);
      // and you have to be behind the axle line, not out in front of it
      const ahead = (p.x - c.x) * Math.sin(c.yaw) + (p.y - c.y) * Math.cos(c.yaw);
      if (ahead > c.def.length * 0.3) continue;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function openContainer(world, cart) {
    world.container = cart;
    world.ui.open = false;
    world.player.vx = 0; world.player.vy = 0;
    if (world.box.open) D.close(world.box);
    return true;
  }

  function closeContainer(world) {
    world.container = null;
    return true;
  }

  /* ---------- the player swinging ---------- */

  function playerAttack(world) {
    const p = world.player;
    if (world.container) return false;
    if (world.box.open) return false;
    return beginAttack(world, p);
  }

  function playerAim(world, yaw) {
    world.player.aimYaw = yaw;
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
    if (h.body) {
      const before = h.body.dead;
      CB.updateBody(h, dt);
      if (h.body.dead && !before) killHorse(world, h, 0.4, 0.2);
      if (h.body.bleed > 0.1) {
        h.dripTimer = (h.dripTimer || 0) - dt;
        if (h.dripTimer <= 0) {
          h.dripTimer = 0.5;
          bleedAt(world, h.x + (Math.random() - 0.5) * 9, h.y + (Math.random() - 0.5) * 6,
            HM.isDown(h) ? 3.4 : 1.6, 'edged');
        }
      }
    }
    if (h.dead) {
      // a dead horse lies where it fell, like everything else
      if (HM.isDown(h)) {
        if (h.fall.state === 'rising') { h.fall.state = 'falling'; h.fall.still = 0; }
        HM.updateFall(h, dt);
      }
      h.vx = 0; h.vy = 0;
      return;
    }

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
    const npcDriver = h.cart && h.cart.rider && h.cart.rider !== world.player
      ? h.cart.rider : null;
    if (npcDriver && npcDriver.brain) {
      // a carter ambling between nowhere and nowhere
      const br = npcDriver.brain;
      br.rideTimer = (br.rideTimer || 0) - dt;
      if (br.rideTimer <= 0) {
        br.rideTimer = 5 + npcDriver.rng() * 9;
        br.rideDir = npcDriver.rng() < 0.2 ? null : npcDriver.rng() * Math.PI * 2;
      }
      if (br.rideDir === null || br.rideDir === undefined) {
        h.npcDrive = { dx: 0, dy: 0, sprint: false };
      } else {
        const want = br.rideDir;
        const clear = steerAround(world, h, want, 46);
        const use = clear === null ? want + Math.PI : clear;
        h.npcDrive = { dx: Math.sin(use), dy: Math.cos(use), sprint: false };
        h.targetYaw = use;
      }
    }
    if (drivenFromSaddle || drivenFromBench) {
      const input = world.input;
      if (!world.box.open) { dx = input.dx; dy = input.dy; sprint = input.sprint; }
    } else if (h.npcDrive && (h.rider || npcDriver)) {
      dx = h.npcDrive.dx; dy = h.npcDrive.dy; sprint = h.npcDrive.sprint;
    } else if (h.spooked > 0) {
      // bolting after being struck
      h.spooked -= dt;
      dx = Math.sin(h.wanderDir); dy = Math.cos(h.wanderDir); sprint = true;
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
        /* Being ridden down is not being bumped into. It does real damage,
         * scaled by the animal, and the watch treats it as what it is. */
        /* Only a rider who meant it does damage. A villager ambling past on a
         * horse jostles you; before this, a wandering NPC rider was clubbing
         * guards off their feet mid-chase and nobody could see why. */
        const rider = h.rider === world.player ? h.rider : null;
        if (rider) {
          const roll = CB.rollDamage(CB.weapon('club'), a, {
            rng: a.rng || Math.random, aim: 0.55,
            charge: (0.8 + speed / 130) * powerOf
          });
          roll.knock = 1.4;
          const cy2 = Math.cos(a.yaw), sy2 = Math.sin(a.yaw);
          const local = [-(nx * cy2 - ny * sy2), -(nx * sy2 + ny * cy2)];
          const res = CB.applyDamage(a, roll, local, a.rng);
          if (res) {
            splash(world, a, roll, nx, ny);
            dropFromHit(world, a, res.severity, nx, ny);
            reactToHit(world, a, rider, res);
            if (rider === world.player) {
              witness(world, rider, a, res.severity === 'fatal' ? 'kill' : 'mountedShove',
                a.x, a.y);
            }
          }
        }
        if (speed > TRIP_SPEED && !chasing(a)) {
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


  /* ================== combat ================== */

  const SEE_RANGE = 150;        // how far a guard notices a crime
  const SEE_RANGE_CIVIL = 120;
  const SHOUT_RANGE = 200;      // how far a guard passes it on
  const GUARD_GIVE_UP = 26;     // seconds of losing you before they stop
  const WANTED_DECAY = 0.9;     // per minute, while unseen
  const BLOOD_MAX = 260;

  /* Crimes, and what each is worth in wanted level and in what people think
   * of you afterwards. Shoving someone is a crime; it is just a small one. */
  const CRIMES = {
    theft: { wanted: 9, rep: -3, alarm: 0.35, label: 'theft' },
    shove: { wanted: 4, rep: -1, alarm: 0.25, label: 'assault' },
    mountedShove: { wanted: 16, rep: -5, alarm: 0.75, label: 'riding someone down' },
    strike: { wanted: 12, rep: -3, alarm: 0.6, label: 'assault' },
    wound: { wanted: 26, rep: -8, alarm: 0.9, label: 'wounding' },
    kill: { wanted: 70, rep: -30, alarm: 1, label: 'murder' },
    horseKill: { wanted: 10, rep: -4, alarm: 0.4, label: 'killing a horse' }
  };

  function isGuard(a) { return !!(a.brain && a.brain.guard); }

  /* A guard in pursuit is braced and running hard. Barging them, tripping
   * over them, or another guard going down beside them all stagger them —
   * none of it lays them out. Only a real blow does that. Without this a
   * chase collapses in a heap the moment two of them collide. */
  function chasing(a) {
    if (!a.brain || !a.brain.guard) return false;
    return a.brain.guardState === 'chase' || a.brain.guardState === 'rousing';
  }

  /* ---------- swinging ---------- */

  function canAttack(a) {
    if (Rig.isDown(a) || (a.body && (a.body.dead || a.body.dying))) return false;
    if (a.attack || a.attackCooldown > 0) return false;
    if (a.mount && a.mountTime < MOUNT_TIME) return false;
    return true;
  }

  function beginAttack(world, a) {
    if (!canAttack(a)) return false;
    const w = I.heldWeapon(a.inv);
    if (a.stamina < w.stamina * 0.5) return false;
    if (w.ranged) {
      // no ammunition, no shot — and nocking is a beat of its own before the
      // draw, so an arrow is visibly fetched rather than conjured
      const ammo = w.id === 'crossbow' ? 'bolt' : 'arrow';
      if (I.countOf(a.inv, ammo) <= 0) return false;
      if (!a.nocked) {
        a.reaction = { kind: 'nock', k: 0, t: 0,
          duration: w.id === 'crossbow' ? 0.55 : 0.36, nock: true };
        return true;
      }
      // face the shot: you loose where you are looking
      if (a.aimYaw !== undefined) { a.yaw = a.aimYaw; a.targetYaw = a.aimYaw; }
    }
    a.stamina = Math.max(0, a.stamina - w.stamina);
    const duration = w.swing + w.recover;
    a.attack = {
      weapon: w,
      anim: w.anim,
      t: 0,
      duration: duration,
      // The blow lands when the animation shows it landing, not on a separate
      // timer. Otherwise an axe connects while the arm is still going up.
      hitAt: duration * Rig.attackHitFraction(w.anim),
      landed: false
    };
    a.gesture = null;
    a.alert = true;
    if (!a.reaction || !a.reaction.nock) a.reaction = null;
    return true;
  }

  /* The nock finishing is what arms the shot. */
  function serviceNock(world, a) {
    const r = a.reaction;
    if (!r || !r.nock) return;
    if (r.t < r.duration) return;
    a.nocked = true;
    a.reaction = null;
    beginAttack(world, a);
  }

  function updateAttack(world, a, dt) {
    a.attackCooldown = Math.max(0, a.attackCooldown - dt);
    serviceNock(world, a);
    a.stamina = Math.min(100, a.stamina + dt * (a.gait === 'run' ? 6 : 16));
    const atk = a.attack;
    if (!atk) return;
    const was = atk.t;
    atk.t += dt;
    if (!atk.landed && was < atk.hitAt && atk.t >= atk.hitAt) {
      atk.landed = true;
      if (atk.weapon.ranged) loose(world, a, atk.weapon);
      else resolveSwing(world, a, atk.weapon);
    }
    if (atk.t >= atk.duration) {
      a.attack = null;
      // A short breath between swings, longer for a crossbow which has to be
      // spanned again. Never long enough to feel like waiting.
      a.attackCooldown = atk.weapon.id === 'crossbow' ? 0.35 : 0.08;
    }
  }

  /* A melee blow sweeps a cone in front of the attacker and takes the first
   * thing in it. Reach and arc come off the weapon, so a dagger really does
   * have to be up close and a poleaxe really does clear a room. */
  function resolveSwing(world, a, w) {
    const fx = Math.sin(a.yaw), fy = Math.cos(a.yaw);
    const mounted = !!a.mount;
    const reach = w.reach + (mounted ? 14 : 0);
    let best = null, bestD = 1e9;

    /* An NPC swings at the person they are actually fighting and at nobody
     * else. Without this, five guards converging on you spend the fight
     * cutting each other down — which is both wrong and hands you the chase. */
    const only = a.brain ? a.brain.target : null;
    const wantsHorse = !!(only && only.isHorse);

    for (let i = 0; i < world.actors.length; i++) {
      if (wantsHorse) break;
      const t = world.actors[i];
      if (t === a || !t.body || t.body.dead) continue;
      if (only && t !== only) continue;
      if (!only && a.brain && isGuard(a) && isGuard(t)) continue;
      if (t.mount === a.mount && a.mount) continue;
      const dx = t.x - a.x, dy = (t.y - a.y) * 1.35;
      const d = Math.hypot(dx, dy);
      if (d > reach + 8) continue;
      const dot = (dx / (d || 1)) * fx + (dy / (d || 1)) * fy;
      if (d > 4 && Math.acos(Math.max(-1, Math.min(1, dot))) > w.arc) continue;
      if (d < bestD) { bestD = d; best = t; }
    }
    // horses are in reach too, and a sword across a horse is a real thing
    let bestHorse = null, bestHD = 1e9;
    for (let i = 0; i < world.horses.length; i++) {
      const h = world.horses[i];
      if (h === a.mount || h.dead) continue;
      // An NPC cuts at the thing it chose and nothing else; only the player
      // swings at whatever happens to be in front of them.
      if (only) { if (only !== h) continue; }
      else if (a.brain) continue;
      const dx = h.x - a.x, dy = (h.y - a.y) * 1.35;
      const d = Math.hypot(dx, dy);
      if (d > reach + 12) continue;
      const dot = (dx / (d || 1)) * fx + (dy / (d || 1)) * fy;
      if (d > 4 && Math.acos(Math.max(-1, Math.min(1, dot))) > w.arc) continue;
      if (d < bestHD) { bestHD = d; bestHorse = h; }
    }

    if (best && bestD <= bestHD) { strike(world, a, best, w, 1); return true; }
    if (bestHorse) { strikeHorse(world, a, bestHorse, w, 1); return true; }
    return false;
  }

  /* How well the blow was thrown: standing your ground and facing them beats
   * flailing while running away. */
  function witnessTarget(world, a, target) { void world; void a; void target; }

  function aimQuality(a, target) {
    const speed = Math.hypot(a.vx || 0, a.vy || 0);
    const dx = target.x - a.x, dy = target.y - a.y;
    const want = Rig.yawForDirection(dx, dy);
    const off = Math.abs(Rig.shortestAngle(a.yaw, want));
    let q = 1 - off / Math.PI - Math.min(0.35, speed / 300);
    if (a.mount) q += 0.1;
    return Math.max(0.05, Math.min(1, q));
  }

  /* Whether the blow landed on the shield. A shield covers the front and the
   * off-hand side; it covers nothing behind, which is why getting round
   * someone is worth doing. */
  function shieldBlocks(target, nx, ny) {
    if (!target.inv || !I.shieldOf(target.inv)) return 0;
    if (Rig.isDown(target) || (target.body && target.body.dying)) return 0;
    // the direction the blow came from, relative to where they are facing
    const fx = Math.sin(target.yaw), fy = Math.cos(target.yaw);
    const facing = -(nx * fx + ny * fy);          // 1 = straight at their front
    if (facing < 0.1) return 0;                   // from behind or the far side
    const side = -(nx * fy - ny * fx);            // which side it came from
    const offHand = target.leftHanded ? 1 : -1;
    const onShield = facing * 0.6 + Math.max(0, side * offHand) * 0.55;
    if (onShield < 0.4) return 0;
    const small = I.shieldOf(target.inv).small;
    return Math.min(small ? 0.7 : 0.94, onShield * (small ? 0.75 : 1));
  }

  function strike(world, a, target, w, charge) {
    const rng = a.rng || Math.random;
    const roll = CB.rollDamage(w, target, {
      rng: rng, aim: aimQuality(a, target), charge: charge || 1,
      defenceless: Rig.isDown(target) || !!target.reaction
    });
    const dx = target.x - a.x, dy = target.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;

    const blocked = shieldBlocks(target, nx, ny);
    if (blocked > 0) {
      roll.amount *= 1 - blocked;
      roll.bleed *= 1 - blocked * 1.1;
      roll.knock *= 1 - blocked * 0.5;
      if (blocked > 0.6) {
        // caught square: it rings off the boss and shoves them back
        Rig.stumble(target, nx, ny, 18 + roll.knock * 30, 0.3);
        target.reaction = { kind: 'stagger', k: 0, t: 0, duration: 0.34,
          side: (nx * Math.cos(target.yaw) - ny * Math.sin(target.yaw)) > 0 ? 1 : -1 };
        if (target === world.player) witnessTarget(world, a, target);
        return;
      }
    }
    // the blow's direction in the target's own frame, so the wound lands on
    // the side it came from
    const cy = Math.cos(target.yaw), sy = Math.sin(target.yaw);
    const local = [-(nx * cy - ny * sy), -(nx * sy + ny * cy)];
    const res = CB.applyDamage(target, roll, local, rng);
    if (!res) return;

    splash(world, target, roll, nx, ny);
    knockFrom(world, a, target, roll, nx, ny, res.severity);
    dropFromHit(world, target, res.severity, nx, ny);
    reactToHit(world, target, a, res);
    witness(world, a, target, res.severity === 'fatal' ? 'kill'
      : res.severity === 'serious' ? 'wound' : 'strike', target.x, target.y);
  }

  /* Getting hit does not put you on the floor. It drives you backwards with
   * your arms up, and you stay on your feet — you only go down if the blow
   * was genuinely serious, or if it killed you. Anything else is a hobble. */
  function knockFrom(world, a, target, roll, nx, ny, severity) {
    if (Rig.isDown(target)) return;
    const body = target.body;
    const fatal = severity === 'fatal' || (body && (body.dead || body.dying));
    const serious = severity === 'serious';
    const side = (nx * Math.cos(target.yaw) - ny * Math.sin(target.yaw)) > 0 ? 1 : -1;

    if (chasing(target) && !fatal && !serious) {
      // a running guard eats a light blow and keeps coming
      Rig.stumble(target, nx, ny, 22 + roll.knock * 30, 0.26);
      target.reaction = { kind: 'stagger', k: 0, t: 0, side: side, duration: 0.26 };
      if (world.talkingTo === target) D.close(world.box);
      return;
    }
    if (fatal || (serious && roll.knock > 0.7) || roll.amount > 52) {
      Rig.knockDown(target, nx, ny, 2.2 + roll.knock * 2.2 + roll.amount / 26);
      if (target.brain) { target.brain.state = 'downed'; target.brain.timer = 0; }
      target.hitCooldown = 0.5;
    } else {
      // driven back on their heels, arms thrown up
      const push = 26 + roll.knock * 55 + roll.amount * 0.7;
      Rig.stumble(target, nx, ny, push, 0.34 + roll.knock * 0.3);
      target.reaction = { kind: 'stagger', k: 0, t: 0, side: side,
        duration: 0.32 + Math.min(0.4, roll.amount / 90) };
      target.attack = null;
    }
    if (world.talkingTo === target) D.close(world.box);
  }

  /* ---------- arrows ---------- */

  function loose(world, a, w) {
    const ammo = w.id === 'crossbow' ? 'bolt' : 'arrow';
    if (I.countOf(a.inv, ammo) <= 0) return false;
    I.take(a.inv, ammo, 1);
    a.nocked = false;
    const aim = a.aimYaw === undefined ? a.yaw : a.aimYaw;
    // a shot from a moving horse scatters
    const spread = (a.mount ? 0.09 : 0.03) + Math.min(0.08, Math.hypot(a.vx || 0, a.vy || 0) / 1600);
    const yaw = aim + ((a.rng ? a.rng() : Math.random()) - 0.5) * spread * 2;
    world.arrows.push({
      x: a.x, y: a.y, z: (a.mount ? 34 : 19),
      vx: Math.sin(yaw) * w.ranged,
      vy: Math.cos(yaw) * w.ranged,
      vz: 14,
      yaw: yaw,
      kind: ammo,
      weapon: w,
      owner: a,
      life: 0,
      stuck: false
    });
    return true;
  }

  const ARROW_G = 130;

  function updateArrows(world, dt) {
    for (let i = world.arrows.length - 1; i >= 0; i--) {
      const ar = world.arrows[i];
      ar.life += dt;
      if (ar.stuck) {
        if (ar.life > 14) world.arrows.splice(i, 1);
        continue;
      }
      const px = ar.x, py = ar.y;
      ar.vz -= ARROW_G * dt;
      ar.x += ar.vx * dt;
      ar.y += ar.vy * dt;
      ar.z += ar.vz * dt;
      ar.pitch = Math.atan2(ar.vz, Math.hypot(ar.vx, ar.vy));

      let hit = null, hitHorse = null;
      for (let k = 0; k < world.actors.length; k++) {
        const t = world.actors[k];
        if (t === ar.owner || !t.body || t.body.dead) continue;
        if (ar.owner.brain && isGuard(ar.owner) && isGuard(t)) continue;
        if (t.mount && t.mount === ar.owner.mount) continue;
        const d = Math.hypot(t.x - ar.x, (t.y - ar.y) * 1.4);
        const low = t.mount ? 16 : 0, high = t.mount ? 52 : 34;
        if (d < 8 && ar.z > low && ar.z < high) { hit = t; break; }
      }
      if (!hit) {
        for (let k = 0; k < world.horses.length; k++) {
          const h = world.horses[k];
          if (h === ar.owner.mount || h.dead) continue;
          const d = Math.hypot(h.x - ar.x, (h.y - ar.y) * 1.4);
          if (d < 13 && ar.z > 14 && ar.z < 42) { hitHorse = h; break; }
        }
      }

      if (hit) {
        const dx = hit.x - px, dy = hit.y - py;
        const d = Math.hypot(dx, dy) || 1;
        const rng = ar.owner.rng || Math.random;
        const roll = CB.rollDamage(ar.weapon, hit, { rng: rng, aim: 0.7 });
        const cy = Math.cos(hit.yaw), sy = Math.sin(hit.yaw);
        const nx = dx / d, ny = dy / d;
        const stopped = shieldBlocks(hit, nx, ny);
        if (stopped > 0.55) {
          // it sticks in the shield and does nothing
          Rig.stumble(hit, nx, ny, 10, 0.2);
          world.arrows.splice(i, 1);
          continue;
        }
        roll.amount *= 1 - stopped;
        roll.bleed *= 1 - stopped;
        const local = [-(nx * cy - ny * sy), -(nx * sy + ny * cy)];
        const res = CB.applyDamage(hit, roll, local, rng);
        if (res) {
          splash(world, hit, roll, nx, ny);
          knockFrom(world, ar.owner, hit, roll, nx, ny, res.severity);
          dropFromHit(world, hit, res.severity, nx, ny);
          reactToHit(world, hit, ar.owner, res);
          witness(world, ar.owner, hit, res.severity === 'fatal' ? 'kill'
            : res.severity === 'serious' ? 'wound' : 'strike', hit.x, hit.y);
        }
        world.arrows.splice(i, 1);
        continue;
      }
      if (hitHorse) {
        strikeHorse(world, ar.owner, hitHorse, ar.weapon, 1);
        world.arrows.splice(i, 1);
        continue;
      }
      if (ar.z <= 0) {
        ar.z = 0; ar.stuck = true; ar.life = 0;
        ar.pitch = -0.9;
      }
      if (ar.x < 0 || ar.x > WORLD_W || ar.y < 0 || ar.y > WORLD_H) {
        world.arrows.splice(i, 1);
      }
    }
  }

  /* ---------- horses take hits too ---------- */

  function strikeHorse(world, a, h, w, charge) {
    if (!h.body) h.body = CB.createBody();
    if (h.body.dead) return;
    const rng = a.rng || Math.random;
    const roll = CB.rollDamage(w, h, { rng: rng, aim: 0.75, charge: charge || 1 });
    // a horse is a big animal; the same blow does proportionally less
    roll.amount *= 0.72;
    h.body.hp = Math.max(0, h.body.hp - roll.amount);
    h.body.bleed += roll.bleed * 0.8;
    const dx = h.x - a.x, dy = h.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    bleedAt(world, h.x, h.y, roll.bleed > 0.1 ? 3.5 : 2, roll.kind);
    if (h.body.hp <= 0) {
      killHorse(world, h, dx / d, dy / d);
      witness(world, a, h, 'horseKill', h.x, h.y);
    } else {
      if (!HM.isDown(h) && (roll.knock > 0.7 || roll.amount > 30)) {
        if (h.rider) unseat(world, h, -dx / d, -dy / d, 3);
        HM.knockDown(h, dx / d, dy / d, 3 + roll.amount / 12);
      }
      // it bolts
      h.spooked = 4 + rng() * 5;
      h.wanderDir = Math.atan2(dx / d, dy / d);
      witness(world, a, h, 'strike', h.x, h.y);
    }
  }

  function killHorse(world, h, nx, ny) {
    h.dead = true;
    h.body.dead = true;
    h.body.bleed = 0;
    if (h.rider) unseat(world, h, -nx, -ny, 4);
    if (h.cart) unhitchCart(world, h);
    if (!HM.isDown(h)) HM.knockDown(h, nx, ny, 5.5);
    bleedAt(world, h.x, h.y, 9, 'edged');
  }

  /* ---------- blood ---------- */

  function splash(world, target, roll, nx, ny) {
    if (roll.kind === 'blunt' && roll.amount < 26) return;
    const n = roll.kind === 'blunt' ? 1 : 2 + Math.floor(roll.amount / 18);
    const rng = target.rng || Math.random;
    for (let i = 0; i < n; i++) {
      world.blood.push({
        x: target.x + nx * (2 + rng() * 9) + (rng() - 0.5) * 8,
        y: target.y + ny * (2 + rng() * 6) + (rng() - 0.5) * 5,
        r: 1.4 + rng() * 2.6,
        age: 0
      });
    }
    trimBlood(world);
  }

  function bleedAt(world, x, y, r, kind) {
    world.blood.push({ x: x, y: y, r: r, age: 0 });
    void kind;
    trimBlood(world);
  }

  function trimBlood(world) {
    while (world.blood.length > BLOOD_MAX) world.blood.shift();
  }

  /* A bleeding body leaves a trail, and a pool where it lies. */
  function updateBleedTrail(world, a, dt) {
    const body = a.body;
    if (!body || body.dead || body.bleed <= 0.12) return;
    a.dripTimer = (a.dripTimer || 0) - dt;
    if (a.dripTimer > 0) return;
    a.dripTimer = 0.55 / Math.min(4, body.bleed + 0.4);
    const rng = a.rng || Math.random;
    world.blood.push({
      x: a.x + (rng() - 0.5) * 7,
      y: a.y + (rng() - 0.5) * 5,
      r: Rig.isDown(a) ? 2.2 + rng() * 3.4 : 1.0 + rng() * 1.3,
      age: 0
    });
    trimBlood(world);
  }


  /* ================== being hit ==================
   *
   * hit -> pain -> assess -> respond. The assessment is what makes two
   * villagers behave differently: the same punch reads as an outrage to a
   * brave guard and as a reason to be somewhere else to a frightened baker.
   */

  const RESPONSES = ['fight', 'backAway', 'flee', 'cower', 'callHelp', 'protect',
    'surrender', 'collapse'];

  function chooseResponse(world, victim, attacker, res) {
    const body = victim.body;
    const brain = victim.brain;
    const ch = victim.character;
    const brave = ch ? (ch.brave === undefined ? bravery(victim) : ch.brave) : 0.5;
    const armed = !!(victim.inv && victim.inv[I.HAND]);
    const hurt = 1 - body.hp / CB.MAX_HP;

    if (body.dying || body.hp <= 0) return 'collapse';
    if (body.hp < 26 && brave < 0.75) return 'surrender';

    // someone they care about is being hurt in front of them handled elsewhere;
    // this is their own skin
    const willFight = brave + (armed ? 0.3 : 0) + (isGuard(victim) ? 0.45 : 0)
      - hurt * 0.9 - (res.severity === 'serious' ? 0.3 : 0);
    if (willFight > 0.72) return 'fight';
    if (willFight > 0.42) return brain && brain.guard ? 'fight' : 'backAway';
    if (brave < 0.22) return 'cower';
    if (hurt > 0.4 || res.severity !== 'minor') return 'flee';
    return world.actors.some(function (o) { return isGuard(o) && distance(o, victim) < 220; })
      ? 'callHelp' : 'flee';
  }

  function bravery(a) {
    // derived once from the seeded rng, so a given villager is consistently
    // the sort of person who stands their ground or is not
    if (a._brave === undefined) a._brave = a.rng ? a.rng() : Math.random();
    return a._brave;
  }

  function reactToHit(world, victim, attacker, res) {
    const brain = victim.brain;
    victim.gesture = null;
    if (brain && brain.partner) {
      if (brain.state === 'closing') abandonClosing(victim); else endChat(victim, 20);
    }
    if (world.talkingTo === victim) D.close(world.box);

    const body = victim.body;
    victim.alert = true;
    victim.lastAttacker = attacker;
    victim.threatTimer = 16;

    if (victim === world.player) {
      // the player reacts by being hurt, not by being told what to do
      return;
    }
    if (!brain) return;

    const choice = chooseResponse(world, victim, attacker, res);
    brain.response = choice;
    brain.responseTimer = 3 + (victim.rng ? victim.rng() : Math.random()) * 4;
    brain.target = attacker;

    if (choice === 'collapse') {
      brain.state = 'downed';
      if (!Rig.isDown(victim)) Rig.knockDown(victim, 0.4, 0.2, 2.6);
      return;
    }
    // a serious wound gets clutched whatever else they decide to do
    if (res.severity === 'serious' && !Rig.isDown(victim)) {
      victim.reaction = { kind: 'clutch', k: 0, zone: res.zone, t: 0,
        duration: 1.1 + Math.random() * 0.8 };
    } else if (choice === 'cower' || choice === 'surrender') {
      victim.reaction = { kind: choice === 'cower' ? 'guard' : 'surrender', k: 0, t: 0,
        duration: choice === 'surrender' ? 6 : 2.5 };
    }
    brain.state = 'react';
    if (choice === 'callHelp') shout(world, victim, attacker);
  }

  function updateReaction(a, dt) {
    const r = a.reaction;
    if (!r) return;
    r.t += dt;
    // eases in, holds, eases out
    const inK = Math.min(1, r.t / 0.18);
    const outK = Math.min(1, Math.max(0, (r.duration - r.t) / 0.3));
    r.k = Math.min(inK, outK);
    if (r.t >= r.duration) a.reaction = null;
  }

  /* ================== dropping things ================== */

  function dropFromHit(world, victim, severity, nx, ny) {
    if (!victim.inv) return;
    const rng = victim.rng || Math.random;
    let n = 0;
    if (severity === 'fatal') n = 99;
    else if (severity === 'serious') n = 1 + Math.floor(rng() * 3);
    else if (severity === 'wounded') n = rng() < 0.45 ? 1 : 0;
    else n = rng() < 0.12 ? 1 : 0;
    if (n <= 0) return;
    const loose = I.shakeLoose(victim.inv, rng, n, severity === 'fatal');
    for (let i = 0; i < loose.length; i++) {
      spawnItem(world, victim.x, victim.y, loose[i].id, loose[i].count, nx, ny,
        severity === 'fatal' ? 1 : 0.6);
    }
    // they will want it back, once it is safe to bend down
    if (victim.brain && loose.length) victim.brain.wantsPickup = 5 + rng() * 6;
  }

  function spawnItem(world, x, y, id, count, nx, ny, force, owner) {
    const f = force === undefined ? 0.6 : force;
    const ang = Math.random() * Math.PI * 2;
    const spread = 10 + Math.random() * 26 * f;
    world.loot.push({
      id: id, count: count || 1,
      owner: owner || null,
      x: x + Math.cos(ang) * 3, y: y + Math.sin(ang) * 2,
      z: 9 + Math.random() * 7,
      vx: Math.cos(ang) * spread + (nx || 0) * 30 * f,
      vy: Math.sin(ang) * spread * 0.6 + (ny || 0) * 30 * f,
      vz: 22 + Math.random() * 40 * f,
      pitch: Math.random() * 6.28, roll: Math.random() * 6.28, yaw: Math.random() * 6.28,
      spinP: (Math.random() - 0.5) * 12, spinR: (Math.random() - 0.5) * 12,
      spinY: (Math.random() - 0.5) * 8,
      rest: 0, settled: false, buffer: null, _key: ''
    });
    if (world.loot.length > 220) world.loot.shift();
  }

  const ITEM_G = 190;

  function updateGroundItems(world, dt) {
    const list = world.loot;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (d.settled) continue;
      d.vz -= ITEM_G * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.pitch += d.spinP * dt; d.roll += d.spinR * dt; d.yaw += d.spinY * dt;
      if (d.z <= 0) {
        d.z = 0;
        if (Math.abs(d.vz) < 20) {
          d.vz = 0; d.vx *= 0.2; d.vy *= 0.2;
          d.spinP *= 0.2; d.spinR *= 0.2; d.spinY *= 0.3;
          d.rest += dt;
          if (d.rest > 0.3) {
            d.settled = true;
            d.pitch = Math.round(d.pitch / (Math.PI / 2)) * (Math.PI / 2);
            d.roll = Math.round(d.roll / (Math.PI / 2)) * (Math.PI / 2);
            d.vx = 0; d.vy = 0; d.spinP = 0; d.spinR = 0; d.spinY = 0;
          }
        } else {
          d.vz = -d.vz * 0.34; d.vx *= 0.6; d.vy *= 0.6; d.rest = 0;
        }
      }
      if (d.z <= 0.01) {
        const sp = Math.hypot(d.vx, d.vy);
        if (sp > 0) {
          const next = Math.max(0, sp - 150 * dt);
          d.vx = (d.vx / sp) * next; d.vy = (d.vy / sp) * next;
        }
      }
    }
  }

  function nearestGroundItem(world, a, range) {
    let best = -1, bestD = range === undefined ? 22 : range;
    const list = world.loot;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      const d = Math.hypot(g.x - a.x, (g.y - a.y) * 1.4);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function pickUp(world, a, index) {
    const list = world.loot;
    const g = list[index];
    if (!g || !a.inv) return false;
    const room = I.roomFor(a.inv, g.id, g.count);
    if (room <= 0) return false;
    // Taking something that belongs to someone else, in front of them, is
    // theft. Picking up a plank off a wrecked cart is not.
    if (a === world.player && g.owner) reportTheft(world, g.x, g.y);
    I.add(a.inv, g.id, room);
    g.count -= room;
    if (g.count <= 0) list.splice(index, 1);
    return true;
  }

  /* Someone has to see it. Theft with nobody watching is just a quiet day. */
  function reportTheft(world, x, y) {
    world.theftCooldown = world.theftCooldown || 0;
    if (world.time < world.theftCooldown) return;
    world.theftCooldown = world.time + 1.2;
    witness(world, world.player, null, 'theft', x, y);
  }


  /* ================== who saw it ==================
   *
   * Two separate numbers, because they answer different questions. Wanted is
   * how hard the guards are looking for you right now and it cools off.
   * Reputation is what people think of you and it does not.
   */

  function witness(world, attacker, victim, crimeId, x, y) {
    if (attacker !== world.player) return;
    const crime = CRIMES[crimeId];
    if (!crime) return;

    let seen = false;
    for (let i = 1; i < world.actors.length; i++) {
      const o = world.actors[i];
      if ((victim && o === victim) || !o.body || o.body.dead || Rig.isDown(o)) continue;
      const d = distance(o, world.player);
      const range = isGuard(o) ? SEE_RANGE : SEE_RANGE_CIVIL;
      if (d > range) continue;
      // facing matters: someone with their back to it only half sees it
      const want = Rig.yawForDirection(world.player.x - o.x, world.player.y - o.y);
      const facing = Math.abs(Rig.shortestAngle(o.yaw, want)) < 1.5;
      if (!facing && d > range * 0.45) continue;
      seen = true;
      // What they took away from it is not always what happened. This is the
      // raw material the investigation will eventually work from.
      o.saw = {
        crime: crime.label,
        at: world.time,
        // one witness in four mistakes the detail
        weapon: (o.rng ? o.rng() : Math.random()) < 0.75
          ? (I.held(world.player.inv) || { label: 'bare hands' }).label : 'a weapon',
        sure: 0.35 + (o.rng ? o.rng() : Math.random()) * 0.65
      };
      if (isGuard(o)) {
        alertGuard(world, o, x, y, crime.alarm);
      } else {
        civilianAlarm(world, o, crime.alarm, x, y);
      }
    }

    world.wanted = Math.min(100, world.wanted + crime.wanted * (seen ? 1 : 0.18));
    world.reputation = Math.max(-100, Math.min(100, world.reputation + crime.rep));
    if (seen) world.lastSeenAt = world.time;
    if (crimeId === 'kill' || crimeId === 'wound') world.reputationCriminal =
      Math.min(100, (world.reputationCriminal || 0) + (crimeId === 'kill' ? 9 : 3));
    void victim;
  }

  function shout(world, caller, attacker) {
    for (let i = 1; i < world.actors.length; i++) {
      const o = world.actors[i];
      if (o === caller || !isGuard(o)) continue;
      if (distance(o, caller) > SHOUT_RANGE) continue;
      alertGuard(world, o, attacker.x, attacker.y, 0.8);
    }
    caller.gesture = null;
  }

  /* Nobody reacts the instant something happens, and five men do not all
   * react on the same frame. A guard who sees it takes a beat to register it;
   * one who only hears it shouted takes longer, and further off is longer
   * still. The rng is the guard's own, so a jumpy one is consistently jumpy
   * and the group fans out instead of moving as a block. */
  function alertGuard(world, g, x, y, alarm) {
    const brain = g.brain;
    if (brain.guardState === 'chase' || brain.guardState === 'rousing') {
      // Already coming, or already getting to his feet: update where he is
      // headed, but do not restart his clock. Re-rolling the delay every time
      // somebody shouts again means he never actually sets off.
      brain.chaseX = x; brain.chaseY = y;
      brain.giveUp = Math.max(brain.giveUp, GUARD_GIVE_UP * (0.6 + alarm * 0.7));
      return;
    }
    // Each guard has his own reaction time, rolled once, so the same man is
    // always the quick one and the group fans out rather than moving as a
    // block. Distance and second-hand news both add to it.
    if (brain.reactionTime === undefined) {
      brain.reactionTime = 0.2 + (g.rng ? g.rng() : Math.random()) * 1.25;
    }
    const far = Math.min(1, distance(g, world.player) / SEE_RANGE);
    const delay = brain.reactionTime + far * 0.7 + (1 - alarm) * 1.1;

    brain.guardState = 'rousing';
    brain.rouse = delay;
    brain.target = world.player;
    brain.chaseX = x; brain.chaseY = y;
    brain.giveUp = GUARD_GIVE_UP * (0.6 + alarm * 0.7);
    brain.response = null;
    g.alert = true;
    g.gesture = null;
    if (brain.partner) {
      if (brain.state === 'closing') abandonClosing(g); else endChat(g, 30);
    }
  }

  /* The beat before they move: they turn and look at it, then go. */
  function updateRousing(world, g, dt) {
    const brain = g.brain;
    brain.rouse -= dt;
    g.gait = 'idle';
    g.vx = 0; g.vy = 0;
    g.targetYaw = Rig.yawForDirection(brain.chaseX - g.x, brain.chaseY - g.y);
    if (brain.rouse <= 0) {
      brain.guardState = 'chase';
      brain.spreadTimer = 0.2 + (g.rng ? g.rng() : Math.random()) * 0.6;
    }
  }

  function civilianAlarm(world, c, alarm, x, y) {
    const brain = c.brain;
    if (!brain) return;
    if (brain.partner) {
      if (brain.state === 'closing') abandonClosing(c); else endChat(c, 25);
    }
    const brave = bravery(c);
    brain.state = 'react';
    brain.response = alarm > 0.7 && brave < 0.6 ? 'flee'
      : alarm > 0.4 ? 'backAway' : 'cower';
    brain.responseTimer = 4 + alarm * 6;
    brain.target = world.player;
    brain.fleeFrom = { x: x, y: y };
    if (alarm > 0.55 && brave < 0.35) {
      c.reaction = { kind: 'guard', k: 0, t: 0, duration: 1.4 };
    }
  }

  /* Guards pass a chase on to whoever they run past, and clear civilians out
   * of the way as they come through. */
  function guardSpread(world, g, dt) {
    g.brain.spreadTimer = (g.brain.spreadTimer || 0) - dt;
    if (g.brain.spreadTimer > 0) return;
    g.brain.spreadTimer = 1.2;
    for (let i = 1; i < world.actors.length; i++) {
      const o = world.actors[i];
      if (o === g || !o.brain || Rig.isDown(o) || (o.body && o.body.dead)) continue;
      const d = distance(o, g);
      if (isGuard(o)) {
        if (d < SHOUT_RANGE && o.brain.guardState !== 'chase') {
          alertGuard(world, o, g.brain.chaseX, g.brain.chaseY, 0.7);
        }
      } else if (d < 90 && o.brain.state !== 'react') {
        o.brain.state = 'react';
        o.brain.response = 'backAway';
        o.brain.responseTimer = 1.6 + (o.rng ? o.rng() : Math.random()) * 2;
        o.brain.fleeFrom = { x: g.x, y: g.y };
      }
    }
  }

  function updateWanted(world, dt) {
    world.time += dt;
    const unseen = world.time - (world.lastSeenAt || -999);
    if (unseen > 12 && world.wanted > 0) {
      world.wanted = Math.max(0, world.wanted - WANTED_DECAY / 60 * dt * 60);
    }
    // any guard actively chasing keeps it hot
    for (let i = 1; i < world.actors.length; i++) {
      const g = world.actors[i];
      if (isGuard(g) && g.brain.guardState === 'chase'
        && distance(g, world.player) < SEE_RANGE) {
        world.lastSeenAt = world.time;
        break;
      }
    }
  }



  /* ---------- what the watch is prepared to do ----------
   *
   * A guard who draws steel on someone who shoved a fishmonger is not a
   * guard, he is the problem. So the response is graded: below the line they
   * put the weapon away and give you a shove to say stop, and they take it
   * back out only when you have earned it.
   */

  const LETHAL_WANTED = 45;

  function guardIntent(world, g) {
    // already bleeding from you, or you are wanted for something real
    const hurt = g.body && g.body.hp < CB.MAX_HP * 0.72;
    return (world.wanted >= LETHAL_WANTED || hurt) ? 'lethal' : 'restrain';
  }

  /* Stowing a weapon puts it in a general slot, which is why guards are given
   * one free: a guard who cannot put his sword away has no way to be lenient. */
  function stowWeapon(a) {
    if (!a.inv || !a.inv[I.HAND]) return false;
    const limit = I.generalRange(a.inv);
    for (let i = 0; i < limit; i++) {
      if (a.inv[i]) continue;
      a.inv[i] = a.inv[I.HAND];
      a.inv[I.HAND] = null;
      a.stowed = i;
      return true;
    }
    return false;
  }

  function drawWeapon(a) {
    if (!a.inv || a.inv[I.HAND]) return false;
    const i = a.stowed;
    if (i === undefined || !a.inv[i]) return false;
    a.inv[I.HAND] = a.inv[i];
    a.inv[i] = null;
    a.stowed = undefined;
    return true;
  }

  /* One beat of reaching for the belt, so the weapon does not teleport into
   * or out of the hand. */
  function startSwap(world, a, putting) {
    a.reaction = { kind: putting ? 'sheathe' : 'draw', k: 0, t: 0, duration: 0.42,
      swap: putting ? 'stow' : 'draw', done: false };
    a.attack = null;
  }

  function serviceSwap(a) {
    const r = a.reaction;
    if (!r || !r.swap || r.done) return;
    if (r.t < r.duration * 0.55) return;
    r.done = true;
    if (r.swap === 'stow') stowWeapon(a); else drawWeapon(a);
  }


  /* ---------- getting round things ----------
   *
   * Villagers used to walk into a tree and keep walking. Rather than a path
   * graph for a field with thirty trees in it, they look a short way down the
   * heading they want and, if it is blocked, fan out either side until they
   * find one that is clear. It is enough to make them walk round things, and
   * it costs nothing.
   */

  const LOOK_AHEAD = 30;
  const FAN = [0, 0.4, -0.4, 0.85, -0.85, 1.35, -1.35, 1.9, -1.9];

  function blockedAhead(world, a, yaw, reach) {
    const fx = Math.sin(yaw), fy = Math.cos(yaw);
    for (let step = 12; step <= reach; step += 9) {
      const px = a.x + fx * step, py = a.y + fy * step;
      for (let i = 0; i < world.props.length; i++) {
        const pr = world.props[i];
        const dx = px - pr.x, dy = (py - pr.y) * 1.6;
        if (Math.hypot(dx, dy) < pr.r + 8) return true;
      }
      for (let i = 0; i < world.carts.length; i++) {
        const c = world.carts[i];
        if (Math.hypot(px - c.x, (py - c.y) * 1.4) < CART_R + 7) return true;
      }
      if (px < 24 || px > WORLD_W - 24 || py < 30 || py > WORLD_H - 18) return true;
    }
    return false;
  }

  /* The nearest clear heading to the one they wanted, or null if they are
   * boxed in on every side. */
  function steerAround(world, a, wantYaw, reach) {
    const r = reach === undefined ? LOOK_AHEAD : reach;
    for (let i = 0; i < FAN.length; i++) {
      const yaw = wantYaw + FAN[i];
      if (!blockedAhead(world, a, yaw, r)) return yaw;
    }
    return null;
  }

  /* ================== guards ==================
   *
   * A guard is an ordinary villager with a job. Off duty they wander and chat
   * like anyone else; on duty they wear the livery, watch a patch, and if they
   * see something they come for you — on foot, or on a horse if one is handy.
   */

  /* Faster flat out than a sprinting player. A guard who cannot catch you is
   * scenery, and the whole point of a wanted level is that it costs you
   * something. Turning still slows them, so weaving buys real distance. */
  const GUARD_SPEED = { walk: 34, run: 152 };

  function updateGuard(world, g, dt) {
    const brain = g.brain;
    const player = world.player;
    const state = brain.guardState || 'patrol';

    if (state === 'patrol') {
      // back to carrying it openly once the fuss is over
      if (!g.inv[I.HAND] && g.stowed !== undefined
        && (!g.reaction || !g.reaction.swap)) {
        startSwap(world, g, false);
      }
      serviceSwap(g);
      // watching: notice a crime already in progress, or a body on the ground
      if (world.wanted > 8 && distance(g, player) < SEE_RANGE
        && !Rig.isDown(player) && armedAndOpen(world, player)) {
        alertGuard(world, g, player.x, player.y, 0.5);
      }
      return false;
    }

    // chasing
    brain.giveUp -= dt;
    const d = distance(g, player);
    const sees = d < SEE_RANGE && !Rig.isDown(player);
    if (sees) {
      brain.chaseX = player.x; brain.chaseY = player.y;
      brain.giveUp = GUARD_GIVE_UP;
    }
    guardSpread(world, g, dt);

    // get on a horse if the quarry is mounted and one is standing about
    if (!g.mount && player.mount && d > 90) {
      const h = freeHorseNear(world, g, 110);
      if (h) { mountNpc(world, g, h); }
    }
    // and get off to fight
    if (g.mount && d < 34 && !player.mount) { dismountNpc(world, g); }

    if (brain.giveUp <= 0) {
      brain.guardState = 'patrol';
      brain.state = 'pause';
      brain.timer = 1.5;
      if (g.mount) dismountNpc(world, g);
      return true;
    }

    /* Draw or stow to match what this is worth. Doing it here rather than at
     * the moment of the swing means you can see them decide. */
    const intent = guardIntent(world, g);
    const armed = !!g.inv[I.HAND];
    if (!g.reaction || !g.reaction.swap) {
      if (intent === 'restrain' && armed) { startSwap(world, g, true); }
      else if (intent === 'lethal' && !armed && g.stowed !== undefined) {
        startSwap(world, g, false);
      }
    }
    serviceSwap(g);
    // They put it away on the move. Stopping to do it hands you the distance
    // back, which is the one thing a pursuit cannot afford.
    const swapping = !!(g.reaction && g.reaction.swap);

    const w = I.heldWeapon(g.inv);
    const dx = brain.chaseX - g.x, dy = brain.chaseY - g.y;
    const len = Math.hypot(dx, dy) || 1;
    g.targetYaw = Rig.yawForDirection(dx, dy);
    g.aimYaw = g.targetYaw;

    if (g.mount) {
      /* A guard on a horse fights from it with whatever is in his hand, not
       * only with a bow. And he has two things he can go for: you, or the
       * animal under you. Killing the horse is often the better move — it is
       * a bigger target, and it ends the chase — so he weighs it. */
      const h = g.mount;
      const mounted = w.reach + 14;
      const quarryHorse = player.mount;

      if (quarryHorse && !g.brain.aimAt) {
        // decided once per chase, not re-rolled every frame
        g.brain.aimAt = (g.rng ? g.rng() : Math.random()) < (w.ranged ? 0.45 : 0.6)
          ? 'horse' : 'rider';
      }
      if (!quarryHorse) g.brain.aimAt = null;
      const atHorse = g.brain.aimAt === 'horse' && quarryHorse && !quarryHorse.dead;
      const mark = atHorse ? quarryHorse : player;
      const md = distance(g, mark);
      g.targetYaw = Rig.yawForDirection(mark.x - g.x, mark.y - g.y);
      g.aimYaw = g.targetYaw;
      h.targetYaw = g.targetYaw;
      g.brain.mark = mark;

      // ride alongside to swing, or hold off at a distance to shoot
      const hold = w.ranged ? Math.min(w.range * 0.55, 150) : mounted * 0.7;
      const want = (sees && md < hold) ? 0 : 1;
      h.npcDrive = { dx: (dx / len) * want, dy: (dy / len) * want, sprint: md > hold * 1.3 };

      if (!sees || !canAttack(g)) return true;
      if (w.ranged) {
        if (md < w.range) beginAttack(world, g);
      } else if (md < mounted) {
        // the swing itself is resolved against whichever they chose
        g.brain.target = mark;
        beginAttack(world, g);
      }
      return true;
    }
    g.brain.aimAt = null;
    if (g.brain.mark) { g.brain.target = player; g.brain.mark = null; }

    if (w.ranged && sees && d < w.range && d > 40 && !swapping) {
      if (canAttack(g)) beginAttack(world, g);
      g.gait = 'idle';
      return true;
    }
    if (d < w.reach * 0.85 + 8) {
      // a guard restraining you stops the moment you are on the ground or
      // badly hurt; only a lethal one keeps going
      const done = intent === 'restrain'
        && (Rig.isDown(player) || (player.body && player.body.hp < CB.MAX_HP * 0.45));
      if (sees && !done && !swapping && canAttack(g)) beginAttack(world, g);
      if (done) { brain.giveUp = Math.min(brain.giveUp, 2.5); }
      g.gait = 'idle';
      return true;
    }
    /* Run them down. A guard in pursuit turns faster than a villager
     * ambling about and does not stop dead to do it — waiting to be square on
     * before taking a step is how a chase turns into a stroll. */
    const clearYaw = steerAround(world, g, g.targetYaw, 34);
    if (clearYaw !== null) g.targetYaw = clearYaw;
    const turn = Rig.shortestAngle(g.yaw, g.targetYaw);
    const rate = 7.5 * dt;
    g.yaw += Math.abs(turn) < rate ? turn : Math.sign(turn) * rate;
    g.targetYaw = g.yaw;
    /* Flat out until they are close enough to swing, and not a step slower.
     * Throttling back at some fixed distance means that whenever you ease off
     * they ease off with you, and the moment you go again they are behind —
     * which reads as the watch politely pacing you rather than chasing you. */
    const facing = Math.max(0.25, 1 - Math.abs(turn) / 2.2);
    const closeEnough = w.reach * 0.85 + 8;
    const sp = (d > closeEnough ? GUARD_SPEED.run : GUARD_SPEED.walk * 1.6) * facing;
    g.x += Math.sin(g.yaw) * sp * dt;
    g.y += Math.cos(g.yaw) * sp * dt;
    resolvePropCollisions(world, g, 6);
    clampVillager(g);
    g.gait = d > closeEnough ? 'run' : 'walk';
    return true;
  }

  function armedAndOpen(world, p) {
    const d = I.held(p.inv);
    return !!(d && d.weapon && d.weapon !== 'fists');
  }

  function freeHorseNear(world, a, range) {
    let best = null, bestD = range;
    for (let i = 0; i < world.horses.length; i++) {
      const h = world.horses[i];
      if (h.rider || HM.isDown(h) || h.dead) continue;
      const d = distance(h, a);
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  }

  function mountNpc(world, a, h) {
    h.rider = a;
    a.mount = h;
    a.mountTime = MOUNT_TIME;   // an npc does not need the swing-up beat
    a.vx = 0; a.vy = 0;
    a.gait = 'idle';
  }

  function dismountNpc(world, a) {
    const h = a.mount;
    if (!h) return;
    const side = h.yaw + Math.PI / 2;
    a.x = h.x + Math.cos(side) * 14;
    a.y = h.y - Math.sin(side) * 10;
    a.mount = null;
    h.rider = null;
    h.npcDrive = null;
  }

  /* ---------- how a villager who has been hurt behaves ---------- */

  function updateResponse(world, a, dt) {
    const brain = a.brain;
    brain.responseTimer -= dt;
    const target = brain.target || world.player;
    const from = brain.fleeFrom || target;
    const dx = a.x - from.x, dy = a.y - from.y;
    const away = Math.hypot(dx, dy) || 1;
    const hurt = a.body ? 1 - a.body.hp / CB.MAX_HP : 0;
    const speed = SPEED.npc * (1 + (1 - hurt) * 2.6);

    switch (brain.response) {
      case 'fight': {
        const d = distance(a, target);
        a.targetYaw = Rig.yawForDirection(target.x - a.x, target.y - a.y);
        a.aimYaw = a.targetYaw;
        const w = I.heldWeapon(a.inv);
        if (d < w.reach * 0.85 + 8) {
          if (canAttack(a) && Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 0.8) {
            beginAttack(world, a);
          }
          a.gait = 'idle';
        } else if (Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 1.0) {
          a.x += ((target.x - a.x) / (d || 1)) * speed * dt;
          a.y += ((target.y - a.y) / (d || 1)) * speed * dt;
          a.gait = 'walk';
          clampVillager(a);
        }
        break;
      }
      case 'flee': {
        const away2 = steerAround(world, a, Rig.yawForDirection(dx, dy), 38);
        a.targetYaw = away2 === null ? Rig.yawForDirection(dx, dy) : away2;
        if (Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 1.2) {
          a.x += Math.sin(a.yaw) * speed * 1.35 * dt;
          a.y += Math.cos(a.yaw) * speed * 1.35 * dt;
          resolvePropCollisions(world, a, 6);
          clampVillager(a);
        }
        a.gait = 'run';
        break;
      }
      case 'backAway': {
        // keeping their eyes on it while they go
        a.targetYaw = Rig.yawForDirection(-dx, -dy);
        a.x += (dx / away) * speed * 0.55 * dt;
        a.y += (dy / away) * speed * 0.55 * dt;
        clampVillager(a);
        a.gait = 'walk';
        break;
      }
      case 'callHelp': {
        a.targetYaw = Rig.yawForDirection(-dx, -dy);
        a.gait = 'idle';
        a.speaking = true;
        babble(a);
        brain.shoutTimer = (brain.shoutTimer || 0) - dt;
        if (brain.shoutTimer <= 0) { brain.shoutTimer = 1.4; shout(world, a, target); }
        break;
      }
      case 'protect': {
        const friend = brain.protecting;
        if (friend) {
          const fd = distance(a, friend);
          a.targetYaw = Rig.yawForDirection(friend.x - a.x, friend.y - a.y);
          if (fd > 20) {
            a.x += ((friend.x - a.x) / (fd || 1)) * speed * dt;
            a.y += ((friend.y - a.y) / (fd || 1)) * speed * dt;
            a.gait = 'walk';
          } else { a.gait = 'idle'; }
        }
        break;
      }
      case 'surrender':
      case 'cower':
      default: {
        a.gait = 'idle';
        a.targetYaw = Rig.yawForDirection(-dx, -dy);
        if (!a.reaction) {
          a.reaction = { kind: brain.response === 'surrender' ? 'surrender' : 'guard',
            k: 0, t: 0, duration: Math.max(0.6, brain.responseTimer) };
        }
        break;
      }
    }

    if (brain.responseTimer <= 0) {
      hush(a);
      brain.response = null;
      brain.state = 'pause';
      brain.timer = 0.8 + (a.rng ? a.rng() : Math.random()) * 2;
    }
  }

  /* Once the fighting stops, people go and get their things back. */
  function tryRecoverItems(world, a, dt) {
    const brain = a.brain;
    if (!brain.wantsPickup || brain.wantsPickup <= 0) return false;
    // not while anyone is still swinging nearby
    if (a.threatTimer > 0 || brain.response) { brain.wantsPickup -= dt * 0.3; return false; }
    const idx = nearestGroundItem(world, a, 90);
    if (idx < 0) { brain.wantsPickup = 0; return false; }
    const g = world.loot[idx];
    const d = Math.hypot(g.x - a.x, (g.y - a.y) * 1.4);
    if (d < 13) {
      pickUp(world, a, idx);
      brain.wantsPickup -= 1.5;
      a.gait = 'idle';
      return true;
    }
    a.targetYaw = Rig.snapToEight(g.x - a.x, g.y - a.y);
    if (Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 0.9) {
      const len = Math.hypot(g.x - a.x, g.y - a.y) || 1;
      a.x += ((g.x - a.x) / len) * SPEED.npc * dt;
      a.y += ((g.y - a.y) / len) * SPEED.npc * dt;
      clampVillager(a);
    }
    a.gait = 'walk';
    brain.wantsPickup -= dt * 0.25;
    return true;
  }

  /* Someone sees a body. They do not step over it. */
  function noticeCasualties(world, a, dt) {
    const brain = a.brain;
    brain.scanTimer = (brain.scanTimer || 0) - dt;
    if (brain.scanTimer > 0) return false;
    brain.scanTimer = 1.5 + (a.rng ? a.rng() : Math.random());
    for (let i = 1; i < world.actors.length; i++) {
      const o = world.actors[i];
      if (o === a || !o.body) continue;
      if (!o.body.dead && !o.body.dying) continue;
      if (o.seenBy && o.seenBy[a._id]) continue;
      if (distance(a, o) > 110) continue;
      o.seenBy = o.seenBy || {};
      o.seenBy[a._id] = true;
      const brave = bravery(a);
      brain.state = 'react';
      brain.target = o;
      brain.fleeFrom = { x: o.x, y: o.y };
      brain.response = isGuard(a) ? 'callHelp' : (brave < 0.4 ? 'flee' : 'callHelp');
      brain.responseTimer = 4 + Math.random() * 4;
      if (!isGuard(a)) a.reaction = { kind: 'guard', k: 0, t: 0, duration: 1.2 };
      return true;
    }
    return false;
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
      // Shooting from the saddle means letting go of the reins. They stay
      // buckled to the bit and hang, which is exactly what the rope solver
      // already does once nothing is pinning the near end.
      const shooting = !!(p.attack && p.attack.weapon.ranged)
        || !!(p.reaction && p.reaction.nock);
      p.reinsDropped = shooting;
      p.rein = shooting ? 0 : Math.max(0, Math.min(1,
        (p.rein || 0) * 0.86 + (Math.abs(want) * 1.4 + (braking ? 0.6 : 0)) * dt * 5));
      p.turn = want;
      // the horse keeps its head while you shoot over it
      if (shooting) { p.yaw = p.aimYaw === undefined ? h.yaw : p.aimYaw; }
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
    if (p.body && p.body.dead) {
      // down for good. No hospitals yet, so the body stays where it fell.
      if (!Rig.isDown(p)) Rig.knockDown(p, 0.3, 0.2, 2.4);
      else if (p.fall.state === 'rising') { p.fall.state = 'falling'; p.fall.still = 0; }
      if (p.mount) dismount(world);
      if (p.seat) leaveSeat(world);
      p.vx = 0; p.vy = 0;
      p.gait = 'idle';
      if (world.box.open) D.close(world.box);
      if (invVisible(world)) closeInventory(world);
      Rig.updateFall(p, dt);
      return;
    }
    if (p.body && p.body.dying) {
      if (!Rig.isDown(p)) Rig.knockDown(p, 0.3, 0.2, 2.2);
      p.vx = 0; p.vy = 0;
      p.gait = 'idle';
      Rig.updateActorMotion(p, dt);
      return;
    }
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
    const want = Rig.yawForDirection(mx - a.x, my - a.y);
    const clear = steerAround(world, a, want, 26);
    a.targetYaw = clear === null ? want : clear;
    if (Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 0.7) {
      a.x += Math.sin(a.yaw) * SPEED.npc * dt;
      a.y += Math.cos(a.yaw) * SPEED.npc * dt;
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

    updateAttack(world, a, dt);
    updateReaction(a, dt);
    a.threatTimer = Math.max(0, (a.threatTimer || 0) - dt);
    updateBleedTrail(world, a, dt);
    const died = CB.updateBody(a, dt);
    if (died === 'died') {
      // everything they were carrying goes on the floor with them
      const all = I.contents(a.inv);
      for (let k = 0; k < all.length; k++) {
        spawnItem(world, a.x, a.y, all[k].id, all[k].count, 0, 0, 0.5);
      }
      I.clearAll(a.inv);
      a.gesture = null;
      hush(a);
    }
    if (a.body.dead) {
      // a body stays where it fell. Nothing picks it up; there is nowhere yet
      // for it to be taken.
      if (!Rig.isDown(a)) Rig.knockDown(a, 0.3, 0.2, 2.2);
      else if (a.fall.state === 'rising') { a.fall.state = 'falling'; a.fall.still = 0; }
      a.vx = 0; a.vy = 0;
      a.gait = 'idle';
      brain.state = 'dead';
      Rig.updateFall(a, dt);
      clampVillager(a);
      return;
    }
    if (a.body.dying) {
      // on the floor, going. They stop trying to do anything else.
      if (!Rig.isDown(a)) Rig.knockDown(a, 0.3, 0.2, 2.0);
      a.vx = 0; a.vy = 0;
      a.gait = 'idle';
      brain.state = 'downed';
      Rig.updateActorMotion(a, dt);
      clampVillager(a);
      return;
    }

    /* Being carried: they sit where the vehicle is and take no part in
     * anything on the ground. They are drawn into its sprite, so all that has
     * to happen here is keeping their position and their blinking honest. */
    if (a.carriedBy) {
      const v = a.carriedBy;
      const gone = v.broken || v.dead || (v.body && v.body.dead) || HM.isDown(v);
      if (gone) {
        // turfed out when the thing carrying them comes apart
        if (v.riders) {
          const at = v.riders.indexOf(a);
          if (at >= 0) v.riders.splice(at, 1);
        }
        if (v.pillion === a) v.pillion = null;
        a.carriedBy = null;
        Rig.stumble(a, Math.cos(a.yaw), Math.sin(a.yaw), 40, 0.5);
        brain.state = 'react';
        brain.response = 'flee';
        brain.responseTimer = 4;
        brain.fleeFrom = { x: v.x, y: v.y };
      } else {
        a.x = v.x; a.y = v.y;
        a.yaw = v.yaw; a.targetYaw = v.yaw;
        a.gait = 'idle';
        Rig.updateBlink(a, dt);
        a.animTime += dt;
        return;
      }
    }

    // an npc riding a horse steers it and does nothing else on foot
    if (a.mount) {
      a.x = a.mount.x; a.y = a.mount.y; a.yaw = a.mount.yaw;
      if (brain.guard) {
        updateGuard(world, a, dt);
      } else if (brain.rides) {
        // ambling about: a heading held for a while, then a new one
        brain.rideTimer -= dt;
        if (brain.rideTimer <= 0) {
          brain.rideTimer = 4 + a.rng() * 8;
          brain.rideDir = a.rng() < 0.25 ? null : a.rng() * Math.PI * 2;
        }
        const d = brain.rideDir;
        if (d === null || d === undefined) {
          a.mount.npcDrive = { dx: 0, dy: 0, sprint: false };
        } else {
          const clear = steerAround(world, a.mount, d, 46);
          const use = clear === null ? d + Math.PI : clear;
          a.mount.npcDrive = { dx: Math.sin(use), dy: Math.cos(use), sprint: a.rng() < 0.004 };
          a.mount.targetYaw = use;
        }
      }
      Rig.updateBlink(a, dt);
      a.animTime += dt;
      return;
    }

    if (brain.guard && brain.guardState === 'rousing' && !Rig.isDown(a)) {
      updateRousing(world, a, dt);
      Rig.updateActorMotion(a, dt);
      return;
    }

    if (brain.guard && brain.guardState === 'chase' && !Rig.isDown(a)) {
      updateGuard(world, a, dt);
      Rig.updateActorMotion(a, dt);
      return;
    }

    Rig.applyShove(a, dt);

    // Shoved hard enough to have to catch themselves: they walk it off,
    // facing the way they are being pushed.
    if (a.stumbleTime > 0 && !Rig.isDown(a)) {
      a.gesture = null;
      a.gait = a.reaction && a.reaction.kind === 'stagger' ? 'idle' : 'walk';
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

    if (brain.state === 'react') {
      updateResponse(world, a, dt);
      Rig.updateActorMotion(a, dt);
      return;
    }

    if (brain.guard) updateGuard(world, a, dt);
    if (noticeCasualties(world, a, dt)) { Rig.updateActorMotion(a, dt); return; }
    if (tryRecoverItems(world, a, dt)) { Rig.updateActorMotion(a, dt); return; }

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
      if (a.attack) { Rig.updateActorMotion(a, dt); return; }

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
      const want = Rig.yawForDirection(dir.dx, dir.dy);
      const clear = steerAround(world, a, want);
      if (clear === null) {
        // boxed in: turn round and pick somewhere else
        brain.timer = 0;
        brain.dirIndex = (brain.dirIndex + 4) % 8;
        a.gait = 'idle';
      } else {
        a.targetYaw = clear;
        if (Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 0.5) {
          a.x += Math.sin(a.yaw) * SPEED.npc * dt;
          a.y += Math.cos(a.yaw) * SPEED.npc * dt;
          resolvePropCollisions(world, a, 6);
          clampVillager(a);
        }
        a.gait = 'walk';
      }
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

    if (world.container) { closeContainer(world); return true; }

    // A chest on a cart is opened from the chest end, not from the shafts
    const chest = nearestChest(world);
    if (chest && !p.mount) { openContainer(world, chest); return true; }

    // then anything lying on the grass
    const gi = nearestGroundItem(world, p, 24);
    if (gi >= 0 && !p.mount) { return pickUp(world, p, gi); }

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
        if (chasing(b)) {
          // braced: shoved aside, not taken down with them
          const ddx = b.x - a.x, ddy = (b.y - a.y) * 1.5;
          const dd = Math.hypot(ddx, ddy);
          if (dd < 15 && dd > 0) {
            Rig.stumble(b, ddx / dd, ddy / dd / 1.5, 34, 0.3);
            b.hitCooldown = 0.4;
          }
          continue;
        }
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
    updateAttack(world, world.player, dt);
    updateReaction(world.player, dt);
    world.player.threatTimer = Math.max(0, (world.player.threatTimer || 0) - dt);
    CB.updateBody(world.player, dt);
    updateBleedTrail(world, world.player, dt);
    for (let i = 1; i < world.actors.length; i++) updateVillager(world, world.actors[i], dt);
    if (!world.player.mount && !world.player.seat) resolveActorCollisions(world);
    separateVillagers(world);
    resolveRagdollCollisions(world, dt);
    updateDebris(world, dt);
    updateGroundItems(world, dt);
    updateArrows(world, dt);
    updateWanted(world, dt);
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
    for (let i = 0; i < world.horses.length; i++) {
      updateReins(world, world.horses[i], dt);
      updateTraces(world, world.horses[i], dt);
    }
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

    // A rider who has dropped the reins is not holding them: the near end
    // falls to the saddle bow and the rope hangs from the bit.
    const dropped = !!holder.reinsDropped;
    let hx, hy, yaw, fwd, lift;
    if (h.rider === holder) {
      const sp = HM.saddlePoint(h.model);
      hx = holder.x; hy = holder.y; yaw = h.yaw;
      // hands out in front of the chest, which sits above the seat
      fwd = sp.z + (dropped ? 2.0 : 8.5);
      lift = seatHeight(holder, sp.y) + holder.model.dims.legTotal
        + holder.model.dims.torsoH * (dropped ? 0.05 : 0.62);
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

  /* The cart is roped to the horse. Two traces run from the shaft tips to the
   * harness, solved the same way the reins are — they sag when the cart is
   * rolling free and go taut the moment the horse pulls. */
  function traceAnchors(world, h) {
    const c = h.cart;
    if (!c || c.broken || HM.isDown(h)) return null;
    const d = HM.dimensionsFor(h.horse);
    const scale = h.model.root.scale || 1;
    const harnessY = (d.legY + d.bodyH * 0.18) * scale;
    const harnessZ = -d.bodyLen * 0.34 * scale;
    const spread = d.bodyW * 0.42 * scale;
    const shaftOut = c.def.length * 0.5 + 15;
    const shaftSide = c.def.width * 0.5 - 3.5;
    const shaftY = c.def.deckY - 1.0 + (c.bounce || 0);
    const front = [], back = [];
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      back.push(projectModelPoint(world, h.x, h.y, h.yaw, side * spread, harnessY, harnessZ));
      front.push(projectModelPoint(world, c.x, c.y, c.yaw, side * shaftSide, shaftY, shaftOut));
    }
    return { hand: front, bit: back };
  }

  function updateTraces(world, h, dt) {
    const a = traceAnchors(world, h);
    if (!a) { h.traces = null; return; }
    h.traces = solveRope(h.traces, a, world, h, dt, 'traceCam');
  }

  /* One rope solver, used by both the reins and the traces. */
  function solveRope(rope, a, world, h, dt, camKey) {
    if (!rope) {
      rope = [];
      for (let i = 0; i < 2; i++) {
        const pts = [];
        for (let k = 0; k < REIN_POINTS; k++) {
          const t = k / (REIN_POINTS - 1);
          const q = {
            x: a.hand[i].x + (a.bit[i].x - a.hand[i].x) * t,
            y: a.hand[i].y + (a.bit[i].y - a.hand[i].y) * t,
            px: 0, py: 0
          };
          q.px = q.x; q.py = q.y;
          pts.push(q);
        }
        rope.push(pts);
      }
      h[camKey] = { x: world.camX, y: world.camY };
    }
    const cam = h[camKey] || (h[camKey] = { x: world.camX, y: world.camY });
    const shiftX = (world.camX - cam.x) * PIXEL;
    const shiftY = (world.camY - cam.y) * PIXEL;
    cam.x = world.camX; cam.y = world.camY;

    for (let i = 0; i < 2; i++) {
      const pts = rope[i];
      const span = Math.hypot(a.bit[i].x - a.hand[i].x, a.bit[i].y - a.hand[i].y);
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
    return rope;
  }

  function drawRope(target, rope, near, far) {
    if (!rope) return;
    for (let i = 0; i < 2; i++) {
      const pts = rope[i];
      const col = i ? far : near;
      for (let k = 0; k < pts.length - 1; k++) {
        R.drawLine(target, pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y, col, PIXEL);
      }
    }
  }

  const TRACE_COLOUR = R.pack(74, 54, 32);
  const TRACE_LIGHT = R.pack(102, 78, 48);

  function drawTraces(target, h) { drawRope(target, h.traces, TRACE_LIGHT, TRACE_COLOUR); }

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
        rider.attack ? rider.attack.anim + Math.round(rider.attack.t * 30) : '',
        rider.reaction ? rider.reaction.kind + Math.round(rider.reaction.k * 6) : '',
        rider.inv && rider.inv[8] ? rider.inv[8].id : '',
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
      // the pillion goes on first, so the rider in front overlaps them
      if (h.pillion) drawPassenger(h.buffer, h.pillion, camera, qYaw,
        pillionOffset(h), h.gait, 0.42);
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

  /* Where a passenger sits, in the vehicle's own space: behind the saddle on
   * a horse, in rows down the bed of a cart. */
  function pillionOffset(h) {
    const d = HM.dimensionsFor(h.horse);
    const scale = h.model.root.scale || 1;
    return { fwd: -d.bodyLen * 0.20 * scale, lift: (d.legY + d.bodyH * 0.5 + 1.2) * scale };
  }

  function benchSeats(c) {
    const L = c.def.length;
    // the driver has the front; passengers fill the bed behind them
    if (c.def.cushions) return [{ x: 0, z: -L * 0.02 }];
    if (c.def.chest) return [{ x: -5.5, z: L * 0.28 }, { x: 5.5, z: L * 0.28 }];
    return [{ x: -5.5, z: L * 0.06 }, { x: 5.5, z: L * 0.06 }, { x: 0, z: -L * 0.22 }];
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
      /* Up and over, not through. They start on the ground clear of the
       * horse's flank and swing in along an arc, so at no point is the rider
       * inside the animal. */
      const clear = h.model.dims.bodyW * 0.5 * (h.model.root.scale || 1) + 7;
      const ease = k * k * (3 - 2 * k);
      const lateral = clear * (1 - ease);
      const rise = seatY * ease + Math.sin(k * Math.PI) * 5.5;
      const off = seatOffset(qYaw, sp.z, rise);
      off[0] += Math.cos(qYaw) * lateral;
      off[2] += -Math.sin(qYaw) * lateral;
      Rig.drawModel(target, rider.model, camera, { yaw: qYaw, faceParts: face, offset: off });
      return;
    }
    if (rider.attack) {
      Rig.poseAttack(rider.model, rider.attack.anim,
        rider.attack.t / rider.attack.duration,
        rider.leftHanded ? 'L' : 'R', 'idle', HM.quantiseTime(rider.animTime));
      // legs stay round the horse whatever the arms are doing
      Rig.setRot(rider.model, 'legR', -0.92, 0, -0.36);
      Rig.setRot(rider.model, 'legL', -0.92, 0, 0.36);
      Rig.setRot(rider.model, 'shinR', 1.28, 0, 0.1);
      Rig.setRot(rider.model, 'shinL', 1.28, 0, -0.1);
    } else if (rider.reaction && rider.reaction.nock) {
      Rig.poseNock(rider.model, rider.reaction.k, rider.leftHanded ? 'L' : 'R');
      Rig.setRot(rider.model, 'legR', -0.92, 0, -0.36);
      Rig.setRot(rider.model, 'legL', -0.92, 0, 0.36);
      Rig.setRot(rider.model, 'shinR', 1.28, 0, 0.1);
      Rig.setRot(rider.model, 'shinL', 1.28, 0, -0.1);
    } else {
      Rig.poseRide(rider.model, HM.quantiseTime(rider.animTime), {
        gait: h.gait, rein: rider.rein || 0, turn: rider.turn || 0
      });
    }
    Rig.drawModel(target, rider.model, camera, {
      yaw: qYaw, faceParts: face, offset: seatOffset(qYaw, sp.z, seatY),
      extra: Rig.actorExtras(rider)
    });
  }

  /* Anyone being carried, posed sitting and planted at their seat. */
  function drawPassenger(target, who, camera, qYaw, seat, gait, jolt) {
    const face = CM.buildFaceParts(who.model, {
      blink: who.blink, viseme: who.viseme, gaze: who.gaze
    });
    if (seat.astride) {
      Rig.poseRide(who.model, HM.quantiseTime(who.animTime),
        { gait: gait, rein: 0, turn: 0 });
    } else {
      Rig.poseDrive(who.model, HM.quantiseTime(who.animTime),
        { rein: 0, turn: 0, jolt: jolt || 0 });
    }
    Rig.drawModel(target, who.model, camera, {
      yaw: qYaw, faceParts: face,
      offset: seatOffset(qYaw, seat.fwd, seatHeight(who, seat.lift)),
      extra: Rig.actorExtras(who)
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
    let riderKey2 = '';
    if (c.riders) {
      for (let i = 0; i < c.riders.length; i++) {
        riderKey2 += c.riders[i].character.name + HM.quantiseTime(c.riders[i].animTime) + ';';
      }
    }
    const key = [qYaw, c.stage, c.hitFlash > 0 ? 1 : 0, qBounce, qLean,
      driverKey, riderKey2].join('|');
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
    if (c.riders && c.riders.length) {
      const seats = benchSeats(c);
      for (let i = 0; i < c.riders.length && i < seats.length; i++) {
        const st = seats[i];
        drawPassenger(c.buffer, c.riders[i], camera, qYaw,
          { fwd: st.z, lift: c.def.deckY + c.def.sideH * 0.4 + 3.2 + qBounce },
          'idle', qBounce * 0.5);
      }
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

  const BLOOD_COL = R.pack(96, 18, 26);

  function renderGroundItem(world, g) {
    const qp = Math.round(g.pitch / DEBRIS_STEP) * DEBRIS_STEP;
    const qr = Math.round(g.roll / DEBRIS_STEP) * DEBRIS_STEP;
    const qy = Math.round(g.yaw / DEBRIS_STEP) * DEBRIS_STEP;
    const key = [g.id, qp, qr, qy].join('|');
    if (g.buffer && key === g._key) return g.buffer;
    g._key = key;
    if (!g.buffer) g.buffer = R.createTarget(DEBRIS_BUF.w, DEBRIS_BUF.h);
    R.clearTarget(g.buffer);
    let m = R.multiply(R.rotationY(qy), R.rotationX(qp));
    m = R.multiply(m, R.rotationZ(qr));
    const view = I.iconView(g.id);
    if (view.scale !== 1) m = R.multiply(m, R.scaling(view.scale));
    const parts = I.iconParts(g.id);
    for (let i = 0; i < parts.length; i++) {
      R.drawMesh(g.buffer, m, parts[i].mesh, R.ramp(parts[i].colour), DEBRIS_CAM, parts[i]);
    }
    R.traceOutline(g.buffer, Rig.OUTLINE);
    return g.buffer;
  }

  function renderArrow(world, ar) {
    const qy = Math.round(ar.yaw / DEBRIS_STEP) * DEBRIS_STEP;
    const qp = Math.round((ar.pitch || 0) / DEBRIS_STEP) * DEBRIS_STEP;
    const key = [ar.kind, qy, qp].join('|');
    if (ar.buffer && key === ar._key) return ar.buffer;
    ar._key = key;
    if (!ar.buffer) ar.buffer = R.createTarget(DEBRIS_BUF.w, DEBRIS_BUF.h);
    R.clearTarget(ar.buffer);
    // the shaft lies along its flight, nose down as it falls
    let m = R.multiply(R.rotationY(qy), R.rotationX(Math.PI / 2 + qp));
    const parts = I.iconParts(ar.kind);
    for (let i = 0; i < parts.length; i++) {
      R.drawMesh(ar.buffer, m, parts[i].mesh, R.ramp(parts[i].colour), DEBRIS_CAM, parts[i]);
    }
    R.traceOutline(ar.buffer, Rig.OUTLINE);
    return ar.buffer;
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

    // Blood goes down before anything stands on it. It is flat on the ground,
    // so it has no business in the depth sort.
    for (let i = 0; i < world.blood.length; i++) {
      const b = world.blood[i];
      if (b.x - cx < -20 || b.x - cx > VIEW_W + 20 || b.y - cy < -20 || b.y - cy > VIEW_H + 20) continue;
      R.fillEllipse(target, (Math.round(b.x) - cx) * PIXEL, (Math.round(b.y) - cy) * PIXEL,
        b.r * PIXEL, b.r * 0.55 * PIXEL, BLOOD_COL, 0.82);
    }

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
    for (let i = 0; i < world.loot.length; i++) {
      const g = world.loot[i];
      if (g.x - cx < -40 || g.x - cx > VIEW_W + 40 || g.y - cy < -60 || g.y - cy > VIEW_H + 40) continue;
      drawables.push({ y: g.y, item: g });
    }
    for (let i = 0; i < world.arrows.length; i++) {
      const ar = world.arrows[i];
      if (ar.x - cx < -40 || ar.x - cx > VIEW_W + 40 || ar.y - cy < -60 || ar.y - cy > VIEW_H + 40) continue;
      drawables.push({ y: ar.y, arrow: ar });
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
        if (h.cart) drawTraces(target, h);
      } else if (d.cart) {
        const c = d.cart;
        R.fillEllipse(target, (Math.round(c.x) - cx) * PIXEL, (Math.round(c.y) - cy) * PIXEL,
          16 * PIXEL, 6 * PIXEL, SHADOW, 0.3);
        R.blit(target, renderCart(c),
          (Math.round(c.x) - cx) * PIXEL - CART_BUF.ox,
          (Math.round(c.y) - cy) * PIXEL - CART_BUF.oy);
        if (c.rider && c.hitch) drawReins(target, c.hitch);
      } else if (d.item) {
        const g = d.item;
        R.fillEllipse(target, (Math.round(g.x) - cx) * PIXEL, (Math.round(g.y) - cy) * PIXEL,
          4 * PIXEL, 1.8 * PIXEL, SHADOW, 0.2);
        R.blit(target, renderGroundItem(world, g),
          (Math.round(g.x) - cx) * PIXEL - DEBRIS_BUF.ox,
          (Math.round(g.y) - cy) * PIXEL - DEBRIS_BUF.oy - Math.round(g.z * CAM_SCALE));
      } else if (d.arrow) {
        const ar = d.arrow;
        R.blit(target, renderArrow(world, ar),
          (Math.round(ar.x) - cx) * PIXEL - DEBRIS_BUF.ox,
          (Math.round(ar.y) - cy) * PIXEL - DEBRIS_BUF.oy - Math.round(ar.z * CAM_SCALE));
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
    if (invVisible(world)) drawInventory(world, target);
  }

  global.World = {
    VIEW_W, VIEW_H, RENDER_W, RENDER_H, PIXEL, WORLD_W, WORLD_H,
    ACTOR_BUF, CAM_PITCH, CAM_SCALE,
    SPEED, TALK_RANGE, NUDGE_SPEED, TRIP_SPEED, FALL_SPEED, TEST_PAGES,
    createWorld, update, draw, tryTalk, nearestTalkable, distance, beginConversation,
    playerAttack, playerAim, beginAttack, openContainer, closeContainer, nearestChest,
    nearestGroundItem, pickUp, spawnItem, strike, witness, CRIMES, isGuard,
    openInventory, closeInventory, invVisible, invMove, invClick, layout,
    shieldBlocks, knockFrom, stowWeapon, drawWeapon, guardIntent,
    mount, dismount, hitchCart, unhitchCart, takeSeat, leaveSeat,
    nearestHorse, nearestCart, damageCart, breakCart, promptFor,
    MOUNT_RANGE, HITCH_RANGE, HORSE_FALL_SPEED
  };
})(window);
