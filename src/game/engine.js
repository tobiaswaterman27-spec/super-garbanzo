// Game engine: world view, input, player movement, camera, depth-sorted rendering and lighting.
// Renders at native pixel resolution into a small canvas that is scaled by an integer factor with
// smoothing disabled, so every world pixel is the same size on screen.
'use strict';
(function () {
  const Ch = O.Char;

  class Game {
    constructor(container) {
      this.el = container;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'game-canvas';
      this.canvas.tabIndex = 0;
      this.canvas.setAttribute('aria-label', 'Game view. Move with WASD or arrow keys, hold Shift to run.');
      container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.keys = new Set();
      this.t = 0; this.last = 0;
      this.clock = { day: 1, minute: 8 * 60 + 30, speed: 1 }; // game minutes per real second
      this.season = 'summer';
      this.particles = [];
      this.touch = { x: 0, y: 0, active: false };
      this.running = false;
      this.hooks = { update: [], drawWorld: [], hud: [], drawGround: [], drawTop: [] };
      this.weatherTint = [1, 1, 1]; this.snowAlpha = 0;
      this.keyHandlers = [];
      this.scene = null;
    }

    load(world, playerAppearance) {
      this.world = world;
      const T = world.T;
      if (world.chunked) { this.ground = null; if (world._chunkSeason !== this.season) { world._chunks = new Map(); world._chunkSeason = this.season; } }
      else { this.ground = world._ground && world._groundSeason === this.season ? world._ground : O.Terrain.renderGround(world, this.season); world._ground = this.ground; world._groundSeason = this.season; }
      for (const b of world.buildings) if (!b.sprite) b.sprite = b.ruined ? O.Env.ruin(b.spec) : b.type === 'hideout' ? O.Env.hideout(b.level, b.spec) : O.Env.building(b.spec);
      for (const t of world.trees) if (!t.sprite || t.sprite.season !== this.season) { t.sprite = O.Env.tree(t.seed, t.kind, this.season); t.sprite.season = this.season; }
      for (const p of world.props) if (!p.sprite) p.sprite = O.Env.prop(p.kind, p.seed, p.v);
      // no invisible walls: ground is solid only where something stands on it (a roof that hides you shows your outline instead)
      if (!world._clean) this.clearStray(world);
      this.rebuildStatics();
      if (!this.player) this.player = { x: (46 * T) + 8, y: 32 * T + 4, dir: 0, anim: 'idle', ft: 0, a: playerAppearance, speed: 0 };
      this.actors = [this.player];
      this.particles = [];
    }

    // Nobody walks where a roof would hide them: the ground just behind a building, as far back as its
    // roof rises over a person's head, is closed off (roads, bridges and doorsteps stay open).
    clearStray(world) {
      world._clean = true;
      const T = world.T, W = world.W, H = world.H, R = world.TER || {}, ok = new Uint8Array(W * H);
      const mark = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) ok[y * W + x] = 1; };
      for (let i = 0; i < W * H; i++) if (world.ter[i] === R.WATER) ok[i] = 1;
      for (const b of world.buildings) for (let y = b.y; y <= b.bottom; y++) for (let x = b.x; x < b.x + b.w; x++) mark(x, y);
      for (const t of world.trees) mark(Math.floor(t.x / T), Math.floor((t.y - 1) / T));
      for (const q of world.props) {
        const sp = q.sprite || (q.sprite = O.Env.prop(q.kind, q.seed, q.v)), x0 = Math.floor((q.x - (sp.ox || 8)) / T), x1 = Math.floor((q.x - (sp.ox || 8) + (sp.W || 16) - 1) / T), y = Math.floor((q.y - 1) / T);
        for (let x = x0; x <= x1; x++) { mark(x, y); mark(x, y - 1); }
      }
      let n = 0; for (let i = 0; i < W * H; i++) if (world.solid[i] && !ok[i]) { world.solid[i] = 0; n++; }
      if (n) { const s = O.SimRef && O.SimRef.cur; if (s && s.world === world && s.path) { s.path.recost && s.path.recost(); s.path.clear && s.path.clear(); } }
    }
    blockBehind(world) {
      const T = world.T, W = world.W, R = world.TER || {}, doors = new Set(world.buildings.filter((b) => b.doorX != null).map((b) => b.doorY * W + b.doorX));
      world._behind = [];
      for (const b of world.buildings) {
        const sp = b.sprite; if (!sp || b.site || b.ruined) continue;
        const top = (b.bottom + 1) * T - sp.H;
        for (let r = b.y - 1; r >= 0; r--) {
          const head = r * T + 10 - 30; if (head + 8 < top) break; // they'd be seen from here back
          for (let x = b.x; x < b.x + b.w; x++) {
            const i = r * W + x; if (x < 0 || x >= W || world.solid[i]) continue;
            const t = world.ter[i]; if (t === R.ROAD || t === R.COBBLE || t === R.BRIDGE || t === R.WATER || doors.has(i) || doors.has(i - W)) continue;
            world.solid[i] = 1; world._behind.push(i);
          }
        }
      }
      const s = O.SimRef && O.SimRef.cur; if (s && s.world === world && s.path) { s.path.recost(); s.path.clear(); }
    }

    rebuildStatics() {
      const world = this.world, T = world.T;
      // depth-sorted static drawables (base y); dynamic actors are merged per frame
      this.statics = [];
      for (const b of world.buildings) this.statics.push({ y: (b.bottom + 1) * T, b });
      for (const t of world.trees) this.statics.push({ y: t.y, t });
      for (const p of world.props) this.statics.push({ y: p.y, p });
      this.statics.sort((a, b) => a.y - b.y);
      this.flatProps = this.statics.filter((s) => s.p && s.p.flat);
      this.statics = this.statics.filter((s) => !(s.p && s.p.flat));
      for (const t of world.trees) if (!t.sprite) t.sprite = O.Env.tree(t.seed, t.kind, this.season);
      for (const p of world.props) if (!p.sprite) p.sprite = O.Env.prop(p.kind, p.seed, p.v);
      world.dirtyStatics = false;
    }

    setPlayerAppearance(a) { if (this.player) this.player.a = a; }

    start() {
      if (this.running) return; this.running = true;
      this.bindInput(); this.resize();
      this._resize = () => this.resize(); window.addEventListener('resize', this._resize);
      const loop = (ts) => { if (!this.running) return; const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000); this.last = ts; this.update(dt); this.draw(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    stop() { this.running = false; this.last = 0; }

    resize() {
      const r = this.el.getBoundingClientRect();
      const W = Math.max(200, r.width), H = Math.max(200, r.height);
      this.scale = Math.max(2, Math.min(4, Math.floor(Math.min(W / 420, H / 270))));
      this.vw = Math.ceil(W / this.scale); this.vh = Math.ceil(H / this.scale);
      this.canvas.width = this.vw; this.canvas.height = this.vh;
      this.canvas.style.width = this.vw * this.scale + 'px'; this.canvas.style.height = this.vh * this.scale + 'px';
      this.ctx.imageSmoothingEnabled = false;
      this.light = document.createElement('canvas'); this.light.width = this.vw; this.light.height = this.vh;
    }

    bindInput() {
      if (this._bound) return; this._bound = true;
      const map = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ShiftLeft: 'run', ShiftRight: 'run' };
      window.addEventListener('keydown', (e) => {
        if (!this.running || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        const k = map[e.code]; if (k) { this.keys.add(k); e.preventDefault(); }
        if (!e.repeat) for (const h of this.keyHandlers) if (h(e)) { e.preventDefault(); break; }
      });
      window.addEventListener('keyup', (e) => { const k = map[e.code]; if (k) this.keys.delete(k); });
      window.addEventListener('blur', () => this.keys.clear());
      // touch joystick: drag anywhere on the view
      const c = this.canvas;
      const pos = (e) => { const r = c.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [t.clientX - r.left, t.clientY - r.top]; };
      c.addEventListener('touchstart', (e) => { const [x, y] = pos(e); this.touch = { ox: x, oy: y, x: 0, y: 0, active: true }; e.preventDefault(); }, { passive: false });
      c.addEventListener('touchmove', (e) => { if (!this.touch.active) return; const [x, y] = pos(e); this.touch.x = x - this.touch.ox; this.touch.y = y - this.touch.oy; e.preventDefault(); }, { passive: false });
      c.addEventListener('touchend', () => { this.touch.active = false; this.touch.x = this.touch.y = 0; });
    }

    solidAt(px, py) {
      const w = this.world, tx = Math.floor(px / w.T), ty = Math.floor(py / w.T);
      if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H) return true;
      return w.solid[ty * w.W + tx] === 1;
    }
    // feet box 8x4 centred on (x, y)
    blocked(x, y) { if (this.scene) return this.scene.blocked(x, y); return this.solidAt(x - 4, y - 3) || this.solidAt(x + 3, y - 3) || this.solidAt(x - 4, y) || this.solidAt(x + 3, y); }

    update(dt) {
      this.t += dt;
      // clock
      this.clock.minute += dt * this.clock.speed;
      if (this.clock.minute >= 1440) { this.clock.minute -= 1440; this.clock.day++; }
      const p = this.player;
      let mx = 0, my = 0;
      if (this.keys.has('l')) mx -= 1; if (this.keys.has('r')) mx += 1; if (this.keys.has('u')) my -= 1; if (this.keys.has('d')) my += 1;
      let run = this.keys.has('run');
      if (this.touch.active) { const m = Math.hypot(this.touch.x, this.touch.y); if (m > 12) { mx = this.touch.x / m; my = this.touch.y / m; run = m > 70; } }
      if (p.locked) mx = my = 0;
      let len = Math.hypot(mx, my);
      // sitting: stay put in the seat until you move, then stand up where you were
      if (p.sitting) {
        const s = p.sitting;
        if (!this.scene || this.scene.b.id !== s.b || this.scene.floor !== s.floor) p.sitting = null;
        else if (len > 0) { p.sitting = null; p.x = s.sx; p.y = s.sy; p.anim = 'idle'; len = 0; mx = my = 0; }
        else { p.x = s.x; p.y = s.y; p.dir = s.dir; p.anim = 'sit'; }
      }
      if (len > 0) {
        mx /= len; my /= len;
        const sp = this.speedFor ? this.speedFor(run) : run ? 92 : 50;
        const nx = p.x + mx * sp * dt, ny = p.y + my * sp * dt;
        if (!this.blocked(nx, p.y)) p.x = nx;
        if (!this.blocked(p.x, ny)) p.y = ny;
        p.dir = O.dirOf(mx, my);
        if (!p.swinging) p.anim = p.mount ? 'sit' : run ? 'run' : 'walk';
      } else if (!p.sitting && !p.swinging && (p.anim === 'walk' || p.anim === 'run')) p.anim = 'idle';
      p.moving = len > 0;
      // never trapped: if you're standing inside something solid (a sign set down, a cart, a door shut on
      // you), you're eased out to the nearest open ground
      if (!this.scene && !p.mount && !p.sitting && !p.inBed && this.blocked(p.x, p.y)) {
        p._stuckT = (p._stuckT || 0) + dt;
        if (p._stuckT > 0.4) { p._stuckT = 0; outer: for (let r = 4; r <= 64; r += 4) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (!this.blocked(x, y)) { p.x = x; p.y = y; break outer; } } }
      } else p._stuckT = 0;
      for (const a of this.actors) a.ft += dt;
      // chimney smoke
      this.hearthT = (this.hearthT || 0) - dt; if (this.hearthT <= 0) { this.hearthT = 1; this.updateHearths(); }
      for (const b of this.world.buildings) {
        if (!b.sprite || !b.sprite.chimney || !this.lit.has(b.id) || Math.random() > dt * 3) continue;
        const sx = b.x * this.world.T - b.sprite.OV + b.sprite.chimney.x, sy = (b.bottom + 1) * this.world.T - b.sprite.H + b.sprite.chimney.y;
        this.particles.push({ x: sx, y: sy, vx: 3 + Math.random() * 3, vy: -7 - Math.random() * 3, life: 0, max: 3 + Math.random() * 2, r: 1 });
      }
      this.particles = this.particles.filter((q) => { q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx += dt * 1.5; return q.life < q.max; });
      for (const h of this.hooks.update) h(dt);
      // camera
      const T = this.world.T;
      if (this.scene) { this.scene.update(dt); }
      if (this.scene) { this.cam = this.scene.camera(); return; }
      // on the island the camera simply follows you: there is no edge but the sea
      if (this.world.island) this.cam = { x: Math.round(p.x - this.vw / 2), y: Math.round(p.y - 20 - this.vh / 2) };
      else this.cam = {
        x: Math.round(O.clamp(p.x - this.vw / 2, 0, this.world.W * T - this.vw)),
        y: Math.round(O.clamp(p.y - 20 - this.vh / 2, 0, this.world.H * T - this.vh)),
      };
    }

    // Big regions keep their ground in chunks of 16 x 16 tiles. A chunk not yet painted shows its
    // plain ground colours at once, and is painted properly a moment later in the background.
    chunk(w, cx, cy, urgent) {
      const CH = 16, key = cx + ',' + cy, T = w.T;
      w._chunks = w._chunks || new Map();
      let e = w._chunks.get(key);
      if (!e) {
        const x0 = cx * CH, y0 = cy * CH, cw = Math.min(CH, w.W - x0), ch = Math.min(CH, w.H - y0);
        const c = document.createElement('canvas'); c.width = cw * T; c.height = ch * T; const g = c.getContext('2d');
        const Q = ['#5d8a3e', '#466e36', '#9a7a52', '#8e8a84', '#6e4e32', '#3c6c96', '#c8b07a', '#a08a62', '#8a6239'];
        const TR = w.TER, col = (t) => (t === TR.GRASS ? Q[0] : t === TR.FOREST ? Q[1] : t === TR.ROAD ? Q[2] : t === TR.COBBLE ? Q[3] : t === TR.FIELD ? Q[4] : t === TR.WATER ? Q[5] : t === TR.SAND ? Q[6] : t === TR.YARD ? Q[7] : t === TR.BRIDGE ? Q[8] : Q[0]);
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { g.fillStyle = col(w.ter[(y0 + y) * w.W + x0 + x]); g.fillRect(x * T, y * T, T, T); }
        // a little texture straight away (light and dark flecks), so ground waiting to be painted doesn't read as flat colour
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) for (let k = 0; k < 5; k++) {
          const h = ((x0 + x) * 73856093 ^ (y0 + y) * 19349663 ^ k * 83492791) >>> 0;
          g.fillStyle = h & 1 ? 'rgba(255,255,230,0.10)' : 'rgba(20,30,10,0.16)'; g.fillRect(x * T + (h >>> 3) % 14, y * T + (h >>> 9) % 14, 2 + (h >>> 15) % 3, 2);
        }
        e = { canvas: c, ready: false, x0, y0, cw, ch };
        w._chunks.set(key, e);
      }
      if (!e.ready && !e.queued) {
        e.queued = true;
        const season = this.season;
        const game = this;
        // ground for a region you've already walked out of isn't worth painting any more
        // painted in two halves so no single step holds up a frame for long
        const job = (function* () {
          const c = document.createElement('canvas'); c.width = e.cw * T; c.height = e.ch * T; const g = c.getContext('2d');
          const h1 = Math.ceil(e.ch / 2);
          for (const [y, h] of [[0, h1], [h1, e.ch - h1]]) {
            if (game.world !== w) { e.queued = false; return; }
            if (h > 0) g.drawImage(O.Terrain.renderGround(w, season, { x: e.x0, y: e.y0 + y, w: e.cw, h }), 0, y * T);
            yield;
          }
          e.canvas = c; e.ready = true;
        })();
        if (O.Prefetch) O.Prefetch.add('chunk:' + (w.placeId || '') + key + season, job, urgent); else { job.next(); }
      }
      return e;
    }
    drawChunks(ctx, cam) {
      const w = this.world, T = w.T, CS = 16 * T;
      const cx0 = Math.floor(cam.x / CS), cy0 = Math.floor(cam.y / CS), cx1 = Math.floor((cam.x + this.vw) / CS), cy1 = Math.floor((cam.y + this.vh) / CS);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        if (cx < 0 || cy < 0 || cx * 16 >= w.W || cy * 16 >= w.H) continue;
        const e = this.chunk(w, cx, cy, true); ctx.drawImage(e.canvas, cx * CS - cam.x, cy * CS - cam.y);
      }
      // paint ahead: the ring of chunks just beyond the view
      for (let cy = cy0 - 2; cy <= cy1 + 2; cy++) for (let cx = cx0 - 2; cx <= cx1 + 2; cx++) if (cx >= 0 && cy >= 0 && cx * 16 < w.W && cy * 16 < w.H) this.chunk(w, cx, cy, false);
    }

    // a soft oval shadow on the ground
    shadow(ctx, cx, cy, rx, ry) {
      for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(1 - (y / (ry + 0.5)) ** 2)); ctx.fillRect(cx - w, cy + y - 1, w * 2, 1); }
    }

    actorFrame(a) {
      const A = Ch.ANIMS[a.anim] || Ch.ANIMS.idle;
      const f = Math.floor(a.ft * A.fps) % A.frames;
      return Ch.frame(a.a, a.dir, a.anim, f);
    }

    draw() {
      if (this.scene) { this.scene.draw(this.ctx); for (const h of this.hooks.drawTop) h(this.ctx, this.cam, true); return; }
      const { ctx, cam, vw, vh } = this, w = this.world, T = w.T;
      if (w.chunked) { if (w.island) { ctx.fillStyle = '#30587e'; ctx.fillRect(0, 0, vw, vh); } this.drawChunks(ctx, cam); } else ctx.drawImage(this.ground, cam.x, cam.y, vw, vh, 0, 0, vw, vh);
      const inView = (x, y, wd, ht) => x + wd >= cam.x && x <= cam.x + vw && y + ht >= cam.y && y <= cam.y + vh;
      for (const s of this.flatProps) { const p = s.p, sp = p.sprite; const x = p.x - sp.ox, y = p.y - sp.oy; if (inView(x, y, sp.W, sp.H)) ctx.drawImage(sp.canvas, x - cam.x, y - cam.y); }
      for (const h of this.hooks.drawGround) h(ctx, cam);
      // depth-sort statics + actors (actors inserted by feet y)
      const actors = this.actors.filter((a) => !a.hidden && !(a._suppressUntil > this.t)).slice().sort((a, b) => a.y - b.y);
      let ai = 0;
      const drawActor = (a) => {
        if (a.paint) { a.paint(ctx, cam); return; }
        if (a.mount && this.riderDraw) { this.riderDraw(ctx, a); a._sx = null; return; }
        const fr = this.actorFrame(a), ox = fr.ox ?? 16;
        const fx = Math.round(a.x - ox - cam.x), fy = Math.round(a.y - (fr.gy ?? Ch.GROUND) - cam.y);
        if (fx < -50 || fy < -60 || fx > vw + 40 || fy > vh + 60) return;
        ctx.fillStyle = 'rgba(28,20,44,0.32)';
        if (a.horse || a.animal) { const sd = a.dir === 1 || a.dir === 2 ? 1 : a.dir >= 4 ? 0.75 : 0.4, rx = Math.round((a.horse ? 17 : fr.width * 0.3) * sd + 3); this.shadow(ctx, Math.round(a.x - cam.x), Math.round(a.y - cam.y), rx, a.horse ? 3 : 2); }
        else if (fr.ox) ctx.fillRect(fx + 6, fy + Ch.GROUND - 1, 36, 3);
        else { ctx.fillRect(fx + 11, fy + Ch.GROUND - 1, 10, 3); ctx.fillRect(fx + 9, fy + Ch.GROUND, 14, 1); }
        ctx.drawImage(fr, fx, fy);
        if (fr.front) ctx.drawImage(fr.front, fx, fy);
        if (this.drawWounds && !fr.ox && a.a && !a.horse && !a.animal) this.drawWounds(ctx, a, fx, fy);
        a._sx = fx; a._sy = fy;
      };
      // whatever stands in front of you (a roof, a tree) fades so you can see yourself behind it
      const P0 = this.player, px0 = P0.x - 9, px1 = P0.x + 9, py0 = P0.y - 36, py1 = P0.y - 2, dtF = Math.min(0.1, this.t - (this._fadeT || this.t)); this._fadeT = this.t;
      const fadeOf = () => 1; const fadeOld = (o, x, y, wd, ht) => { const cover = !P0.hidden && o.y > P0.y + 1 && x < px1 && x + wd > px0 && y < py1 && y + ht > py0; const tgt = cover ? 0.42 : 1; o._fade = o._fade == null ? 1 : o._fade + (tgt - o._fade) * Math.min(1, dtF * 8); return o._fade; };
      P0._drawn = false;
      for (const s of this.statics) {
        while (ai < actors.length && actors[ai].y < s.y) { if (actors[ai] === P0) P0._drawn = true; drawActor(actors[ai++]); }
        if (s.b) {
          const b = s.b, sp = b.sprite; if (!sp) continue;
          const x = b.x * T - sp.OV, y = (b.bottom + 1) * T - sp.H;
          const fa = fadeOf(s, x, y, sp.W, sp.H - 6); if (fa < 0.99) ctx.globalAlpha = fa;
          if (inView(x, y, sp.W, sp.H)) { ctx.drawImage(sp.canvas, x - cam.x, y - cam.y); if (this.snowAlpha > 0.04 && sp.roofMask) { ctx.globalAlpha = this.snowAlpha; ctx.drawImage(sp.roofMask, x - cam.x, y - cam.y); ctx.globalAlpha = 1; } if (this.drawDoor) this.drawDoor(ctx, b, cam); }
          ctx.globalAlpha = 1;
        } else {
          const o = s.t || s.p, sp = o.sprite, x = o.x - sp.ox, y = o.y - sp.oy;
          const fa = s.t ? fadeOf(s, x, y, sp.W, sp.H) : 1; if (fa < 0.99) ctx.globalAlpha = fa;
          if (inView(x, y, sp.W, sp.H)) { ctx.drawImage(sp.canvas, x - cam.x, y - cam.y); if (this.snowAlpha > 0.04) { const m = sp.snowMask || (sp.snowMask = O.snowMaskOf(sp.canvas)); if (m) { ctx.globalAlpha = this.snowAlpha; ctx.drawImage(m, x - cam.x, y - cam.y); ctx.globalAlpha = 1; } } }
          ctx.globalAlpha = 1;
        }
      }
      while (ai < actors.length) drawActor(actors[ai++]);
      ctx.globalAlpha = 1;
      for (const h of this.hooks.drawWorld) h(ctx, cam);
      // smoke
      for (const q of this.particles) {
        const a = 0.45 * (1 - q.life / q.max), sz = q.life > 1.5 ? 3 : 2;
        ctx.fillStyle = `rgba(214,210,206,${a.toFixed(2)})`; ctx.fillRect(Math.round(q.x - cam.x), Math.round(q.y - cam.y), sz, sz);
      }
      this.drawLighting();
      for (const h of this.hooks.drawTop) h(ctx, cam);
    }

    // Which hearths are burning. There are no lamps in the streets and no glow in the windows:
    // a fire is lit when somebody is home to tend it, to cook in the morning, at midday and in the
    // evening, all day in the cold months, and in the trades that live by fire during working hours.
    updateHearths() {
      const sim = this.sim, lit = this.lit || (this.lit = new Set()); lit.clear();
      if (!sim || this.world !== sim.world) { for (const b of this.world.buildings) if (b.sprite?.chimney && (b.id * 7 + Math.floor(this.clock.minute / 90)) % 3) lit.add(b.id); return; }
      const inside = new Map(), dark = this.isNight();
      for (const q of sim.people) if (q.agent) q.agent.torch = false; // the watch go without lights; only lamps and hearths glow
      for (const q of sim.people) if (q.alive !== false && q.agent && q.agent.inside != null) inside.set(q.agent.inside, (inside.get(q.agent.inside) || 0) + 1);
      const h = this.clock.minute / 60, cold = sim.season === 'Winter' || sim.season === 'Autumn' && (h < 8 || h > 18);
      for (const b of this.world.buildings) {
        if (!b.sprite?.chimney || b.ruined || b.site) continue;
        const n = inside.get(b.id) || 0;
        let on;
        if (b.type === 'bakery') on = h >= 3 && h < 16;
        else if (b.type === 'smithy' || b.type === 'armourer') on = n > 0 && h >= 6.5 && h < 18.5;
        else if (b.type === 'tavern') on = h >= 8 && h < 24 && n > 0;
        else if (b.rivalGang) on = true;
        else on = n > 0 && (cold ? h >= 5 && h < 23 : (h >= 5.5 && h < 8.5) || (h >= 11.5 && h < 13) || (h >= 17 && h < 21.5));
        if (on) lit.add(b.id);
      }
    }

    // Day/night: ambient tint multiplied over the frame, with stepped pixel light pools punched out
    // around lamps and lit windows.
    ambient() {
      const h = this.clock.minute / 60;
      const keys = [[0, [52, 60, 112]], [4.5, [58, 66, 118]], [6, [236, 170, 140]], [7.5, [255, 250, 244]], [17, [255, 246, 232]], [19, [240, 160, 120]], [20.5, [90, 86, 140]], [22, [56, 62, 114]], [24, [52, 60, 112]]];
      for (let i = 0; i < keys.length - 1; i++) {
        const [h0, c0] = keys[i], [h1, c1] = keys[i + 1];
        if (h >= h0 && h <= h1) { const t = (h - h0) / (h1 - h0); return c0.map((v, k) => Math.round((v + (c1[k] - v) * t) * this.weatherTint[k])); }
      }
      return [255, 255, 255];
    }
    isNight() { const h = this.clock.minute / 60; return h < 6.2 || h > 19.3; }

    drawLightingWith(amb, pools) {
      const { ctx, vw, vh } = this;
      if (!this.light) return;
      const L = this.light, lc = L.getContext('2d');
      lc.globalCompositeOperation = 'source-over';
      lc.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`; lc.fillRect(0, 0, vw, vh);
      lc.globalCompositeOperation = 'lighter';
      for (const [x, y, r, kind] of pools) {
        if (x < -r * 1.4 || y < -r || x > vw + r * 1.4 || y > vh + r) continue;
        lc.fillStyle = kind === 'day' ? 'rgba(60,60,70,0.33)' : 'rgba(110,80,30,0.33)';
        for (let k = 3; k >= 1; k--) {
          const rr = Math.round((r * k) / 3), ry = Math.round(rr * 0.75);
          for (let yy = -ry; yy <= ry; yy++) { const ww = Math.round(rr * 1.3 * Math.sqrt(1 - (yy * yy) / (ry * ry || 1))); lc.fillRect(Math.round(x - ww), Math.round(y + yy), ww * 2, 1); }
        }
      }
      ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(L, 0, 0); ctx.globalCompositeOperation = 'source-over';
    }

    drawLighting() {
      if (!this.light) return;
      const amb = this.ambient(); if (amb[0] > 250 && amb[1] > 245 && amb[2] > 235) return;
      const { ctx, cam, vw, vh } = this, w = this.world, T = w.T;
      const L = this.light, lc = L.getContext('2d');
      lc.globalCompositeOperation = 'source-over';
      lc.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`; lc.fillRect(0, 0, vw, vh);
      const night = this.isNight();
      const pools = [];
      if (night || amb[2] > amb[0]) {
        for (const s of this.statics) {
          if (s.b && s.b.fire) pools.push([(s.b.x + s.b.w / 2) * T - cam.x, s.b.bottom * T - 30 - cam.y, 40 + s.b.fire.i * 60]);
          if (s.b && s.b.sprite?.campfire && this.lit?.has(s.b.id)) pools.push([s.b.x * T - s.b.sprite.OV + s.b.sprite.campfire.x - cam.x, (s.b.bottom + 1) * T - s.b.sprite.H + s.b.sprite.campfire.y - cam.y, 30]);
          // the smith's forge and the baker's oven throw light out of the open door
          if (s.b && s.b.sprite?.door && this.lit?.has(s.b.id) && ['smithy', 'bakery', 'armourer', 'tavern'].includes(s.b.type)) { const d = s.b.sprite.door; pools.push([s.b.x * T - s.b.sprite.OV + d.x + d.w / 2 - cam.x, (s.b.bottom + 1) * T - s.b.sprite.H + d.y + d.h - cam.y, 18]); }
        }
        // the watch carry torches at night
        if (night) for (const a of this.actors) if (!a.hidden && a.torch) pools.push([a.x - cam.x, a.y - 30 - cam.y, 30]);
        if (night && O.extraLights && !this.scene) for (const f of O.extraLights) f(pools, cam);
        if (night && this.player.torch && !this.scene) pools.push([this.player.x - cam.x, this.player.y - 30 - cam.y, 34]);
      }
      lc.globalCompositeOperation = 'lighter';
      for (const [x, y, r] of pools) {
        if (x < -r || y < -r || x > vw + r || y > vh + r) continue;
        for (let k = 3; k >= 1; k--) { // stepped rings, pixel-art friendly
          const rr = Math.round((r * k) / 3);
          lc.fillStyle = `rgba(110,80,30,0.33)`;
          const ry = Math.round(rr * 0.75);
          for (let yy = -ry; yy <= ry; yy++) { const ww = Math.round(rr * 1.3 * Math.sqrt(1 - (yy * yy) / (ry * ry || 1))); lc.fillRect(Math.round(x - ww), Math.round(y + yy), ww * 2, 1); }
        }
      }
      ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(L, 0, 0); ctx.globalCompositeOperation = 'source-over';
      if (night) { // torch flames
        const fl = (x, y) => { const k = Math.floor(this.t * 10) % 2; ctx.fillStyle = '#ffb040'; ctx.fillRect(x - 1, y - 2 - k, 3, 3 + k); ctx.fillStyle = '#fff2a0'; ctx.fillRect(x, y - 1, 1, 2); };
        for (const a of this.actors) if (!a.hidden && a.torch) fl(Math.round(a.x + 6 - cam.x), Math.round(a.y - 33 - cam.y));
      }
    }

    enterBuilding(b, floor = 0, fromStairs = false) {
      O.releaseLeavers && O.releaseLeavers();
      if (!this.scene) this.outdoorPos = { x: this.player.x, y: this.player.y };
      this.scene = new O.Indoor(this, this.sim, b, floor);
      this.scene.enterAt(fromStairs);
      this.scene.placeActors();
      this.player.inside = b.id;
      if (b.royal) O.jobEvent && O.jobEvent('floor', { floor });
      this.onSceneChange && this.onSceneChange();
    }
    // into a room off a castle hallway, and back out to the hallway by its door
    enterRoom(room) {
      O.releaseLeavers && O.releaseLeavers();
      this.scene = new O.Indoor(this, this.sim, room, 0);
      this.scene.enterAt(false); this.scene.placeActors(); this.player.inside = room.id;
      this.onSceneChange && this.onSceneChange();
    }
    exitBuilding() {
      if (!this.scene) return; // already outside
      O.releaseLeavers && O.releaseLeavers();
      const b = this.scene.b;
      if (b.parent) {
        this.scene = new O.Indoor(this, this.sim, b.parent, b.roomFloor || 0);
        const door = this.scene.L.items.find((i) => i.kind === 'roomdoor' && i.room === b.roomKey);
        if (door) { const [x, y] = this.scene.anchor(door); this.player.x = x; this.player.y = door.front ? y - 18 : y + 16; } else this.scene.enterAt(false);
        this.player.dir = door && door.front ? 3 : 0; this.scene.placeActors(); this.onSceneChange && this.onSceneChange();
        return;
      }
      this.scene = null; this.player.inside = null;
      const T = this.world.T;
      this.player.x = b.doorX * T + 8; this.player.y = b.doorY * T + 10; this.player.dir = 0;
      this.onSceneChange && this.onSceneChange();
    }

    timeString() {
      const m = Math.floor(this.clock.minute), hh = Math.floor(m / 60), mm = m % 60;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }

  O.Game = Game;
})();

// Snow settles on the tops of things: for any sprite, the pixels with open sky above them (and a few
// on the sunlit upper faces) turn white. Built once per sprite and kept.
O.snowMaskOf = function (src) {
  try {
    const w = src.width, h = src.height, sc = src.getContext('2d'), d = sc.getImageData(0, 0, w, h).data;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const cx = c.getContext('2d'), out = cx.createImageData(w, h), o = out.data;
    const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (!d[i + 3]) continue;
      const open1 = !A(x, y - 1), open2 = !A(x, y - 2), open3 = !A(x, y - 3), lum = d[i] + d[i + 1] + d[i + 2];
      // drifts on every upward edge, and clumps on the sunlit upper faces of leaves and stone
      let s = open1 ? 2 : open2 ? 2 : open3 ? 1 : lum > 330 && y < h * 0.65 && ((x * 7 + y * 3) % 3 === 0) ? 1 : lum > 280 && y < h * 0.5 && ((x * 5 + y) % 4 === 0) ? 1 : 0;
      if (!s) continue;
      const v = s === 2 ? 248 : 228; o[i] = v - 6; o[i + 1] = v - 2; o[i + 2] = Math.min(255, v + 6); o[i + 3] = 255;
    }
    cx.putImageData(out, 0, 0); return c;
  } catch (e) { return null; }
};
