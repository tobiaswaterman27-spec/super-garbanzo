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
      this.ground = O.Terrain.renderGround(world, this.season);
      for (const b of world.buildings) if (!b.sprite) b.sprite = b.type === 'hideout' ? O.Env.hideout(b.level, b.spec) : O.Env.building(b.spec);
      for (const t of world.trees) if (!t.sprite || t.sprite.season !== this.season) { t.sprite = O.Env.tree(t.seed, t.kind, this.season); t.sprite.season = this.season; }
      for (const p of world.props) if (!p.sprite) p.sprite = O.Env.prop(p.kind, p.seed, p.v);
      this.rebuildStatics();
      if (!this.player) this.player = { x: (46 * T) + 8, y: 32 * T + 4, dir: 0, anim: 'idle', ft: 0, a: playerAppearance, speed: 0 };
      this.actors = [this.player];
      this.particles = [];
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
      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len; my /= len;
        const sp = this.speedFor ? this.speedFor(run) : run ? 92 : 50;
        const nx = p.x + mx * sp * dt, ny = p.y + my * sp * dt;
        if (!this.blocked(nx, p.y)) p.x = nx;
        if (!this.blocked(p.x, ny)) p.y = ny;
        p.dir = Math.abs(mx) > Math.abs(my) + 0.01 ? (mx < 0 ? 1 : 2) : (my < 0 ? 3 : 0);
        p.anim = p.mount ? 'sit' : run ? 'run' : 'walk';
      } else if (p.anim === 'walk' || p.anim === 'run') p.anim = 'idle';
      p.moving = len > 0;
      for (const a of this.actors) a.ft += dt;
      // chimney smoke
      for (const b of this.world.buildings) {
        if (!b.sprite || !b.sprite.chimney || Math.random() > dt * 3) continue;
        const sx = b.x * this.world.T - b.sprite.OV + b.sprite.chimney.x, sy = (b.bottom + 1) * this.world.T - b.sprite.H + b.sprite.chimney.y;
        this.particles.push({ x: sx, y: sy, vx: 3 + Math.random() * 3, vy: -7 - Math.random() * 3, life: 0, max: 3 + Math.random() * 2, r: 1 });
      }
      this.particles = this.particles.filter((q) => { q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx += dt * 1.5; return q.life < q.max; });
      for (const h of this.hooks.update) h(dt);
      // camera
      const T = this.world.T;
      if (this.scene) { this.scene.update(dt); }
      if (this.scene) { this.cam = this.scene.camera(); return; }
      this.cam = {
        x: Math.round(O.clamp(p.x - this.vw / 2, 0, this.world.W * T - this.vw)),
        y: Math.round(O.clamp(p.y - 20 - this.vh / 2, 0, this.world.H * T - this.vh)),
      };
    }

    actorFrame(a) {
      const A = Ch.ANIMS[a.anim] || Ch.ANIMS.idle;
      const f = Math.floor(a.ft * A.fps) % A.frames;
      return Ch.frame(a.a, a.dir, a.anim, f);
    }

    draw() {
      if (this.scene) { this.scene.draw(this.ctx); for (const h of this.hooks.drawTop) h(this.ctx, this.cam, true); return; }
      const { ctx, cam, vw, vh } = this, w = this.world, T = w.T;
      ctx.drawImage(this.ground, cam.x, cam.y, vw, vh, 0, 0, vw, vh);
      const inView = (x, y, wd, ht) => x + wd >= cam.x && x <= cam.x + vw && y + ht >= cam.y && y <= cam.y + vh;
      for (const s of this.flatProps) { const p = s.p, sp = p.sprite; const x = p.x - sp.ox, y = p.y - sp.oy; if (inView(x, y, sp.W, sp.H)) ctx.drawImage(sp.canvas, x - cam.x, y - cam.y); }
      for (const h of this.hooks.drawGround) h(ctx, cam);
      // depth-sort statics + actors (actors inserted by feet y)
      const actors = this.actors.filter((a) => !a.hidden).slice().sort((a, b) => a.y - b.y);
      let ai = 0;
      const drawActor = (a) => {
        if (a.mount && this.riderDraw) { this.riderDraw(ctx, a); a._sx = null; return; }
        const fr = this.actorFrame(a), ox = fr.ox ?? 16;
        const fx = Math.round(a.x - ox - cam.x), fy = Math.round(a.y - (fr.gy ?? Ch.GROUND) - cam.y);
        if (fx < -50 || fy < -60 || fx > vw + 40 || fy > vh + 60) return;
        ctx.fillStyle = 'rgba(28,20,44,0.32)';
        if (a.horse) ctx.fillRect(fx + 12, fy + fr.gy - 1, 36, 3);
        else if (a.animal) ctx.fillRect(fx + Math.round(fr.width / 2) - 4, fy + fr.gy - 1, 8, 2);
        else if (fr.ox) ctx.fillRect(fx + 6, fy + Ch.GROUND - 1, 36, 3);
        else { ctx.fillRect(fx + 11, fy + Ch.GROUND - 1, 10, 3); ctx.fillRect(fx + 9, fy + Ch.GROUND, 14, 1); }
        ctx.drawImage(fr, fx, fy);
        a._sx = fx; a._sy = fy;
      };
      for (const s of this.statics) {
        while (ai < actors.length && actors[ai].y < s.y) drawActor(actors[ai++]);
        if (s.b) {
          const b = s.b, sp = b.sprite; if (!sp) continue;
          const x = b.x * T - sp.OV, y = (b.bottom + 1) * T - sp.H;
          if (inView(x, y, sp.W, sp.H)) { ctx.drawImage(sp.canvas, x - cam.x, y - cam.y); if (this.snowAlpha > 0.04 && sp.roofMask) { ctx.globalAlpha = this.snowAlpha; ctx.drawImage(sp.roofMask, x - cam.x, y - cam.y); ctx.globalAlpha = 1; } }
        } else {
          const o = s.t || s.p, sp = o.sprite, x = o.x - sp.ox, y = o.y - sp.oy;
          if (inView(x, y, sp.W, sp.H)) ctx.drawImage(sp.canvas, x - cam.x, y - cam.y);
        }
      }
      while (ai < actors.length) drawActor(actors[ai++]);
      // ghost of the player when hidden behind roofs/trees
      const p = this.player;
      if (p._sx != null) { ctx.globalAlpha = 0.28; ctx.drawImage(this.actorFrame(p), p._sx, p._sy); ctx.globalAlpha = 1; }
      for (const h of this.hooks.drawWorld) h(ctx, cam);
      // smoke
      for (const q of this.particles) {
        const a = 0.45 * (1 - q.life / q.max), sz = q.life > 1.5 ? 3 : 2;
        ctx.fillStyle = `rgba(214,210,206,${a.toFixed(2)})`; ctx.fillRect(Math.round(q.x - cam.x), Math.round(q.y - cam.y), sz, sz);
      }
      this.drawLighting();
      for (const h of this.hooks.drawTop) h(ctx, cam);
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
      const amb = this.ambient(); if (amb[0] > 250 && amb[1] > 245 && amb[2] > 235) return;
      const { ctx, cam, vw, vh } = this, w = this.world, T = w.T;
      const L = this.light, lc = L.getContext('2d');
      lc.globalCompositeOperation = 'source-over';
      lc.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`; lc.fillRect(0, 0, vw, vh);
      const night = this.isNight();
      const pools = [];
      if (night || amb[2] > amb[0]) {
        for (const s of this.statics) {
          if (s.p && s.p.kind === 'lamp') pools.push([s.p.x - cam.x, s.p.y - 26 - cam.y, 34]);
          if (s.b && s.b.sprite) for (const wd of s.b.sprite.windows) pools.push([s.b.x * T - s.b.sprite.OV + wd.x + wd.w / 2 - cam.x, (s.b.bottom + 1) * T - s.b.sprite.H + wd.y + wd.h + 6 - cam.y, 16]);
        }
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
      if (night) { // lit window panes on top
        ctx.fillStyle = '#ffd27a';
        for (const s of this.statics) if (s.b && s.b.sprite) { const b = s.b, sp = b.sprite, bx = b.x * T - sp.OV - cam.x, by = (b.bottom + 1) * T - sp.H - cam.y; if (bx > vw || by > vh || bx + sp.W < 0 || by + sp.H < 0) continue; for (const wd of sp.windows) { if ((b.id * 7 + wd.x) % 5 === 0) continue; ctx.fillRect(bx + wd.x, by + wd.y, wd.w, wd.h); ctx.fillStyle = '#c88a3a'; ctx.fillRect(bx + wd.x + Math.floor(wd.w / 2) - 0, by + wd.y, 1, wd.h); ctx.fillRect(bx + wd.x, by + wd.y + Math.floor(wd.h / 2), wd.w, 1); ctx.fillStyle = '#ffd27a'; } }
        for (const s of this.statics) if (s.p && s.p.kind === 'lamp') { ctx.fillStyle = '#ffe08a'; ctx.fillRect(s.p.x - 2 - cam.x, s.p.y - 27 - cam.y, 4, 4); }
      }
    }

    enterBuilding(b, floor = 0, fromStairs = false) {
      if (!this.scene) this.outdoorPos = { x: this.player.x, y: this.player.y };
      this.scene = new O.Indoor(this, this.sim, b, floor);
      this.scene.enterAt(fromStairs);
      this.scene.placeActors();
      this.player.inside = b.id;
      this.onSceneChange && this.onSceneChange();
    }
    exitBuilding() {
      const b = this.scene.b; this.scene = null; this.player.inside = null;
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
