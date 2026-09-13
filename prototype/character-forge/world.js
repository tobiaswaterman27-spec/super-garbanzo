/* world.js — the test scene.
 *
 * A patch of ground, some props, a player and a handful of randomly generated
 * villagers. The NPC brain is deliberately small: wander, pause, and respond to
 * being spoken to by turning toward the player or closing the distance first.
 */
(function (global) {
  'use strict';

  const R = global.Render;
  const T = global.Text;
  const CM = global.CharacterModel;
  const Rig = global.Rig;
  const D = global.Dialogue;

  const VIEW_W = 320, VIEW_H = 180;
  const WORLD_W = 760, WORLD_H = 460;

  const ACTOR_BUF = { w: 56, h: 74, ox: 28, oy: 64 };
  const CAM_PITCH = 0.30;
  const CAM_SCALE = 1.35;

  const SPEED = { walk: 46, run: 84, npc: 27 };
  const INTERACT_RANGE = 78;   // how close the player must be to start a chat
  const COMFORT_RANGE = 30;    // how close the NPC wants to stand while talking

  const TEST_PAGES = ['test123 test123', 'test123 test123', 'test123 test123'];

  /* ---------- ground ---------- */

  const GRASS = ['#4a6b3a', '#53743f', '#456535', '#5c7d46', '#3f5c32'].map(function (h) {
    const c = R.hexToRgb(h.length === 7 ? h : '#4a6b3a');
    return R.pack(c[0], c[1], c[2]);
  });
  const DIRT = ['#7d6844', '#8a7450', '#6f5c3c', '#937d57'].map(function (h) {
    const c = R.hexToRgb(h);
    return R.pack(c[0], c[1], c[2]);
  });

  function buildGround(seed) {
    const rng = CM.makeRng(seed);
    const buf = new Uint32Array(WORLD_W * WORLD_H);

    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        // clumpy value noise, quantised to the grass ramp
        const n = Math.sin(x * 0.09) * Math.cos(y * 0.11) + Math.sin((x + y) * 0.05) * 0.6;
        let idx = n > 0.8 ? 3 : n > 0.15 ? 1 : n > -0.5 ? 0 : 2;
        if (rng() < 0.05) idx = 4;
        buf[y * WORLD_W + x] = GRASS[idx];
      }
    }

    // a worn path running east-west, with a branch heading north
    for (let x = 0; x < WORLD_W; x++) {
      const centre = WORLD_H * 0.62 + Math.sin(x * 0.014) * 26 + Math.sin(x * 0.05) * 5;
      const halfWidth = 13 + Math.sin(x * 0.03) * 3;
      for (let y = Math.floor(centre - halfWidth); y < centre + halfWidth; y++) {
        if (y < 0 || y >= WORLD_H) continue;
        const edge = Math.abs(y - centre) / halfWidth;
        if (edge > 0.86 && rng() < 0.55) continue; // ragged edges
        buf[y * WORLD_W + x] = DIRT[edge > 0.6 ? 2 : (rng() < 0.25 ? 1 : 0)];
      }
    }
    for (let y = 0; y < WORLD_H * 0.66; y++) {
      const centre = WORLD_W * 0.36 + Math.sin(y * 0.02) * 14;
      for (let x = Math.floor(centre - 9); x < centre + 9; x++) {
        if (x < 0 || x >= WORLD_W) continue;
        const edge = Math.abs(x - centre) / 9;
        if (edge > 0.8 && rng() < 0.5) continue;
        buf[y * WORLD_W + x] = DIRT[edge > 0.6 ? 2 : 0];
      }
    }

    // tufts and pebbles
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(rng() * WORLD_W), y = Math.floor(rng() * WORLD_H);
      const on = buf[y * WORLD_W + x];
      const isDirt = DIRT.indexOf(on) >= 0;
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

  function renderBoxes(boxes, bufW, bufH, ox, oy, scale) {
    const target = R.createTarget(bufW, bufH);
    R.clearTarget(target);
    const camera = R.makeCamera(CAM_PITCH, scale, ox, oy);
    const identity = R.identity();
    for (let i = 0; i < boxes.length; i++) {
      R.drawBox(target, identity, boxes[i], R.ramp(boxes[i].colour), camera, {});
    }
    R.traceOutline(target, Rig.OUTLINE);
    return target;
  }

  function makeTree(rng) {
    const B = global.Parts.box;
    const boxes = [];
    const trunkH = 13 + rng() * 5;
    const t = B(-1.6, 0, -1.6, 3.2, trunkH, 3.2); t.colour = '#4d3726'; boxes.push(t);
    const clumps = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < clumps; i++) {
      const s = 5 + rng() * 4;
      const a = (i / clumps) * Math.PI * 2 + rng();
      const rad = i === 0 ? 0 : 3.2 + rng() * 2.4;
      const c = B(Math.cos(a) * rad - s / 2, trunkH - 1 + rng() * 5, Math.sin(a) * rad - s / 2, s, s, s);
      c.colour = rng() < 0.5 ? '#39572f' : '#2f4a28';
      boxes.push(c);
    }
    return renderBoxes(boxes, 64, 76, 32, 66, CAM_SCALE);
  }

  function makeRock(rng) {
    const B = global.Parts.box;
    const boxes = [];
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const s = 3 + rng() * 4;
      const b = B(-s / 2 + (rng() - 0.5) * 4, rng() * 2, -s / 2 + (rng() - 0.5) * 4, s, s * 0.8, s);
      b.colour = rng() < 0.5 ? '#6d6a63' : '#5a5750';
      boxes.push(b);
    }
    return renderBoxes(boxes, 40, 40, 20, 34, CAM_SCALE);
  }

  function makeBarrel(rng) {
    const B = global.Parts.box;
    const boxes = [];
    const b = B(-3, 0, -3, 6, 8, 6); b.colour = '#6b4a2c'; boxes.push(b);
    const h1 = B(-3.2, 1.6, -3.2, 6.4, 1.1, 6.4); h1.colour = '#4a4038'; boxes.push(h1);
    const h2 = B(-3.2, 5.4, -3.2, 6.4, 1.1, 6.4); h2.colour = '#4a4038'; boxes.push(h2);
    return renderBoxes(boxes, 32, 40, 16, 34, CAM_SCALE);
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
      hovered: null,
      input: { dx: 0, dy: 0, run: false },
      seed: seed
    };

    const treeSprites = [makeTree(rng), makeTree(rng), makeTree(rng)];
    const rockSprites = [makeRock(rng), makeRock(rng)];
    const barrelSprite = makeBarrel(rng);

    function addProp(sprite, x, y, footY, shadowR) {
      world.props.push({ sprite: sprite, x: x, y: y, footY: footY, shadowR: shadowR });
    }

    for (let i = 0; i < 11; i++) {
      const x = 30 + rng() * (WORLD_W - 60);
      const y = 30 + rng() * (WORLD_H - 60);
      // keep the path clear
      const pathY = WORLD_H * 0.62 + Math.sin(x * 0.014) * 26;
      if (Math.abs(y - pathY) < 34) continue;
      addProp(treeSprites[Math.floor(rng() * treeSprites.length)], x, y, 66, 8);
    }
    for (let i = 0; i < 7; i++) {
      addProp(rockSprites[Math.floor(rng() * rockSprites.length)],
        30 + rng() * (WORLD_W - 60), 30 + rng() * (WORLD_H - 60), 34, 5);
    }
    addProp(barrelSprite, WORLD_W * 0.42, WORLD_H * 0.52, 34, 4);
    addProp(barrelSprite, WORLD_W * 0.44, WORLD_H * 0.55, 34, 4);

    /* player */
    const player = Rig.createActor(playerCharacter, WORLD_W * 0.38, WORLD_H * 0.62, 1);
    player.isPlayer = true;
    player.buffer = R.createTarget(ACTOR_BUF.w, ACTOR_BUF.h);
    world.actors.push(player);
    world.player = player;

    /* villagers */
    for (let i = 0; i < 5; i++) {
      const ch = CM.randomCharacter(rng);
      const a = Rig.createActor(ch, 60 + rng() * (WORLD_W - 120), 60 + rng() * (WORLD_H - 120), (seed + i * 977) >>> 0);
      a.buffer = R.createTarget(ACTOR_BUF.w, ACTOR_BUF.h);
      a.brain = {
        state: 'pause',
        timer: 0.5 + rng() * 2.5,
        dirIndex: Math.floor(rng() * 8)
      };
      world.actors.push(a);
    }

    return world;
  }

  /* ---------- simulation ---------- */

  function clampToWorld(a) {
    a.x = Math.max(18, Math.min(WORLD_W - 18, a.x));
    a.y = Math.max(24, Math.min(WORLD_H - 12, a.y));
  }

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function updatePlayer(world, dt) {
    const p = world.player;
    const input = world.input;
    // movement is locked while a conversation is on screen
    const locked = world.box.open;
    let dx = locked ? 0 : input.dx;
    let dy = locked ? 0 : input.dy;

    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      // snap the facing to one of eight compass directions, but move freely
      p.targetYaw = Rig.snapToEight(dx, dy);
      const speed = input.run ? SPEED.run : SPEED.walk;
      p.x += dx * speed * dt;
      p.y += dy * speed * dt;
      p.gait = input.run ? 'run' : 'walk';
      clampToWorld(p);
    } else {
      p.gait = 'idle';
    }
    Rig.updateActorMotion(p, dt);
  }

  function updateVillager(world, a, dt) {
    const brain = a.brain;
    const player = world.player;

    if (brain.state === 'approach' || brain.state === 'face' || brain.state === 'talk') {
      const d = distance(a, player);
      const dx = player.x - a.x, dy = player.y - a.y;
      a.targetYaw = Rig.yawForDirection(dx, dy); // look straight at them, not snapped

      if (brain.state === 'approach') {
        if (d > COMFORT_RANGE) {
          const len = Math.hypot(dx, dy) || 1;
          a.x += (dx / len) * SPEED.npc * dt;
          a.y += (dy / len) * SPEED.npc * dt;
          a.gait = 'walk';
          clampToWorld(a);
        } else {
          brain.state = 'face';
          a.gait = 'idle';
        }
      } else {
        a.gait = 'idle';
      }

      if (brain.state === 'face') {
        // wait until they have actually turned before speaking
        if (Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 0.2) {
          brain.state = 'talk';
          beginConversation(world, a);
        }
      }
      Rig.updateActorMotion(a, dt);
      return;
    }

    brain.timer -= dt;
    if (brain.state === 'pause') {
      a.gait = 'idle';
      if (brain.timer <= 0) {
        brain.state = 'wander';
        brain.timer = 1.2 + a.rng() * 3.2;
        brain.dirIndex = Math.floor(a.rng() * 8);
        const dir = Rig.DIRECTIONS[brain.dirIndex];
        a.targetYaw = Rig.yawForDirection(dir.dx, dir.dy);
      }
    } else if (brain.state === 'wander') {
      const dir = Rig.DIRECTIONS[brain.dirIndex];
      a.targetYaw = Rig.yawForDirection(dir.dx, dir.dy);
      // only actually walk once mostly turned, so they don't crab sideways
      const turned = Math.abs(Rig.shortestAngle(a.yaw, a.targetYaw)) < 0.5;
      if (turned) {
        a.x += dir.dx * SPEED.npc * dt;
        a.y += dir.dy * SPEED.npc * dt;
        const before = { x: a.x, y: a.y };
        clampToWorld(a);
        if (a.x !== before.x || a.y !== before.y) brain.timer = 0; // hit the edge, turn around
      }
      a.gait = 'walk';
      if (brain.timer <= 0) {
        brain.state = 'pause';
        brain.timer = 0.8 + a.rng() * 3.5;
      }
    }
    Rig.updateActorMotion(a, dt);
  }

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
        npc.brain.state = 'pause';
        npc.brain.timer = 1.0 + npc.rng() * 2.0;
        world.talkingTo = null;
      }
    });
  }

  // Called on a click in the viewport. Returns true if it started a chat.
  function tryInteract(world, worldX, worldY) {
    if (world.box.open) { D.advance(world.box); return true; }

    const npc = actorAt(world, worldX, worldY);
    if (!npc) return false;
    if (distance(npc, world.player) > INTERACT_RANGE) return false;

    npc.brain.state = distance(npc, world.player) > COMFORT_RANGE ? 'approach' : 'face';
    // the player looks back at whoever they just addressed
    world.player.targetYaw = Rig.snapToEight(npc.x - world.player.x, npc.y - world.player.y);
    return true;
  }

  function actorAt(world, worldX, worldY) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < world.actors.length; i++) {
      const a = world.actors[i];
      if (a.isPlayer) continue;
      // generous pick box around the body
      const dx = Math.abs(a.x - worldX);
      const dy = worldY - a.y;
      if (dx < 13 && dy < 8 && dy > -52) {
        const d = Math.hypot(a.x - worldX, a.y - worldY);
        if (d < bestD) { bestD = d; best = a; }
      }
    }
    return best;
  }

  function update(world, dt) {
    updatePlayer(world, dt);
    for (let i = 0; i < world.actors.length; i++) {
      const a = world.actors[i];
      if (!a.isPlayer) updateVillager(world, a, dt);
    }
    D.update(world.box, dt);

    // camera follows the player, clamped to the world edges
    const targetX = world.player.x - VIEW_W / 2;
    const targetY = world.player.y - VIEW_H / 2 - 10;
    world.camX = Math.max(0, Math.min(WORLD_W - VIEW_W, targetX));
    world.camY = Math.max(0, Math.min(WORLD_H - VIEW_H, targetY));
  }

  /* ---------- drawing ---------- */

  const SHADOW = R.pack(26, 40, 26);
  const LABEL = R.pack(238, 232, 216);
  const LABEL_SHADOW = R.pack(24, 26, 32);
  const HINT = R.pack(226, 190, 108);

  function drawGround(world, target) {
    const cx = Math.floor(world.camX), cy = Math.floor(world.camY);
    for (let y = 0; y < VIEW_H; y++) {
      const sy = cy + y;
      const srow = sy * WORLD_W;
      const trow = y * VIEW_W;
      for (let x = 0; x < VIEW_W; x++) {
        target.colour[trow + x] = world.ground[srow + cx + x];
      }
    }
  }

  function draw(world, target, camera) {
    R.clearTarget(target);
    drawGround(world, target);

    const cx = Math.floor(world.camX), cy = Math.floor(world.camY);

    // one depth-sorted list of everything that stands on the ground
    const drawables = [];
    for (let i = 0; i < world.props.length; i++) {
      const p = world.props[i];
      drawables.push({ y: p.y, prop: p });
    }
    for (let i = 0; i < world.actors.length; i++) {
      drawables.push({ y: world.actors[i].y, actor: world.actors[i] });
    }
    drawables.sort(function (a, b) { return a.y - b.y; });

    const playerNear = [];

    for (let i = 0; i < drawables.length; i++) {
      const d = drawables[i];
      if (d.prop) {
        const p = d.prop;
        R.fillEllipse(target, p.x - cx, p.y - cy, p.shadowR, p.shadowR * 0.42, SHADOW, 0.3);
        R.blit(target, p.sprite, Math.round(p.x - cx - p.sprite.w / 2), Math.round(p.y - cy - p.footY));
      } else {
        const a = d.actor;
        R.fillEllipse(target, a.x - cx, a.y - cy, 7, 3, SHADOW, 0.34);
        Rig.renderActor(a, a.buffer, camera, {});
        R.blit(target, a.buffer, Math.round(a.x - cx - ACTOR_BUF.ox), Math.round(a.y - cy - ACTOR_BUF.oy));
        if (!a.isPlayer && !world.box.open) {
          const dist = distance(a, world.player);
          if (dist <= INTERACT_RANGE) playerNear.push({ a: a, dist: dist });
        }
      }
    }

    // name labels for anyone close enough to talk to
    for (let i = 0; i < playerNear.length; i++) {
      const a = playerNear[i].a;
      const name = a.character.name;
      const w = T.measure(name);
      const lx = Math.round(a.x - cx - w / 2);
      const ly = Math.round(a.y - cy - 62);
      T.drawShadowed(target, name, lx, ly, LABEL, LABEL_SHADOW);
    }

    if (!world.box.open && playerNear.length) {
      const hint = 'Click a villager to talk';
      T.drawShadowed(target, hint, Math.round((VIEW_W - T.measure(hint)) / 2), VIEW_H - 14, HINT, LABEL_SHADOW);
    }

    D.draw(world.box, target);
  }

  global.World = {
    VIEW_W, VIEW_H, WORLD_W, WORLD_H, ACTOR_BUF, CAM_PITCH, CAM_SCALE,
    INTERACT_RANGE, TEST_PAGES,
    createWorld, update, draw, tryInteract, actorAt, distance, beginConversation
  };
})(window);
