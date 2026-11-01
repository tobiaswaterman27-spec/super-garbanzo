// Small things that fly, living in the world rather than painted on the glass. Butterflies flutter
// from flower to flower over the grass, wings opening and shutting, and settle a while before going
// on. Birds go over in a loose skein, wings beating, their shadows sliding over the ground beneath.
// On summer nights fireflies hang and drift in the grass, each glowing and fading on its own; bats
// flit and jink at dusk. All of them stay where they are when you walk on, as real things do.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, hour = () => game.clock.minute / 60;
    const wet = (k) => ['rain', 'heavy', 'storm', 'hail', 'snow'].includes(k);
    const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return c; };
    // ---- sprites
    const BF_COLS = [['#f2e6c8', '#3a2a20'], ['#e8a838', '#3a2a20'], ['#f0f0f8', '#60606a'], ['#b8d0f0', '#2a3040'], ['#e87850', '#3a2a20']];
    const bfSprite = BF_COLS.map(([wing, edge]) => [0, 1, 2].map((f) => cv(9, 7, (x) => {
      x.fillStyle = '#2a2018'; x.fillRect(4, 2, 1, 4); // body
      const span = [4, 2, 1][f]; // open, half, shut
      x.fillStyle = wing; x.fillRect(4 - span, 1, span, 3); x.fillRect(5, 1, span, 3); x.fillRect(4 - Math.max(1, span - 1), 4, Math.max(1, span - 1), 2); x.fillRect(5, 4, Math.max(1, span - 1), 2);
      x.fillStyle = edge; if (span > 1) { x.fillRect(4 - span, 1, 1, 1); x.fillRect(4 + span, 1, 1, 1); }
    })));
    const birdSprite = [0, 1, 2, 3].map((f) => cv(11, 6, (x) => {
      x.fillStyle = '#2c2630'; x.fillRect(4, 2, 3, 2); x.fillRect(7, 2, 1, 1); // body and head
      const up = [0, 1, 2, 1][f];
      if (up === 0) { x.fillRect(1, 1, 3, 1); x.fillRect(7, 1, 3, 1); x.fillRect(0, 0, 1, 1); x.fillRect(10, 0, 1, 1); }
      else if (up === 1) { x.fillRect(1, 2, 3, 1); x.fillRect(7, 2, 3, 1); }
      else { x.fillRect(1, 3, 3, 1); x.fillRect(7, 3, 3, 1); x.fillRect(0, 4, 1, 1); x.fillRect(10, 4, 1, 1); }
    }));
    const batSprite = [0, 1].map((f) => cv(9, 5, (x) => { x.fillStyle = '#1a1418'; x.fillRect(3, 1, 3, 3); x.fillRect(3, 0, 1, 1); x.fillRect(5, 0, 1, 1); if (f) { x.fillRect(0, 0, 3, 1); x.fillRect(6, 0, 3, 1); x.fillRect(1, 1, 2, 1); x.fillRect(6, 1, 2, 1); } else { x.fillRect(0, 3, 3, 1); x.fillRect(6, 3, 3, 1); x.fillRect(1, 2, 2, 1); x.fillRect(6, 2, 2, 1); } }));
    const glow = cv(9, 9, (x) => { const g = x.createRadialGradient(4.5, 4.5, 0, 4.5, 4.5, 4.5); g.addColorStop(0, 'rgba(240,255,150,1)'); g.addColorStop(0.35, 'rgba(210,255,110,0.55)'); g.addColorStop(1, 'rgba(180,255,90,0)'); x.fillStyle = g; x.fillRect(0, 0, 9, 9); });

    // ---- the living
    let bfs = [], birds = null, flies = [], bats = [], world = null, birdT = 15;
    const view = () => ({ x0: game.cam.x - 40, y0: game.cam.y - 40, x1: game.cam.x + game.vw + 40, y1: game.cam.y + game.vh + 40 });
    const grassAt = (w, x, y) => { if (!w.ter) return false; const tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H) return false; return w.ter[ty * w.W + tx] === w.TER.GRASS && !w.solid[ty * w.W + tx]; };
    const spot = (w, v) => { for (let k = 0; k < 30; k++) { const x = v.x0 + 40 + Math.random() * (v.x1 - v.x0 - 80), y = v.y0 + 40 + Math.random() * (v.y1 - v.y0 - 80); if (grassAt(w, x, y)) return [x, y]; } return null; };
    game.hooks.update.push((dt) => {
      const s = cur(), w = game.world; if (!s || game.scene || !w || !game.cam) { return; }
      if (w !== world) { world = w; bfs = []; flies = []; bats = []; birds = null; }
      const h = hour(), W = s.weather || {}, fair = !wet(W.kind) && W.kind !== 'fog', v = view();
      const inView = (o) => o.x > v.x0 - 60 && o.x < v.x1 + 60 && o.y > v.y0 - 60 && o.y < v.y1 + 60;
      // butterflies: by day in spring and summer
      const wantBf = fair && (s.season === 'spring' || s.season === 'summer') && h > 8 && h < 18 ? 4 : 0;
      bfs = bfs.filter(inView); while (bfs.length < wantBf) { const p = spot(w, v); if (!p) break; bfs.push({ x: p[0], y: p[1], z: 6, tx: p[0], ty: p[1], rest: 0, t: Math.random() * 9, c: Math.floor(Math.random() * BF_COLS.length) }); }
      if (!wantBf) bfs.length = 0;
      for (const b of bfs) {
        b.t += dt;
        if (b.rest > 0) { b.rest -= dt; b.z = Math.max(0, b.z - dt * 20); continue; }
        if (Math.hypot(b.tx - b.x, b.ty - b.y) < 3) { if (Math.random() < 0.4) b.rest = 2 + Math.random() * 4; const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 50; b.tx = b.x + Math.cos(a) * r; b.ty = b.y + Math.sin(a) * r * 0.7; }
        const d = Math.hypot(b.tx - b.x, b.ty - b.y), sp = 22; b.x += ((b.tx - b.x) / d) * sp * dt + Math.sin(b.t * 7) * 0.3; b.y += ((b.ty - b.y) / d) * sp * dt; b.z = 6 + Math.sin(b.t * 5) * 3;
      }
      // a skein of birds now and then, by day
      birdT -= dt;
      if (!birds && birdT < 0 && fair && h > 6 && h < 19.5) {
        birdT = 35 + Math.random() * 50; const dir = Math.random() < 0.5 ? 1 : -1, n = 3 + Math.floor(Math.random() * 5), y0 = v.y0 + 60 + Math.random() * (v.y1 - v.y0 - 160);
        birds = { vx: dir * (55 + Math.random() * 15), vy: (Math.random() - 0.5) * 12, list: Array.from({ length: n }, (_, i) => ({ x: (dir > 0 ? v.x0 - 30 : v.x1 + 30) - dir * (Math.ceil(i / 2) * 12), y: y0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 7, ph: i * 0.7 })) };
        if (Math.random() < 0.5) O.Sound && O.Sound.play('bird', 0.3);
      }
      if (birds) { for (const b of birds.list) { b.x += birds.vx * dt; b.y += birds.vy * dt; b.ph += dt; } if (birds.list.every((b) => (birds.vx > 0 ? b.x > v.x1 + 80 : b.x < v.x0 - 80))) birds = null; }
      // fireflies: summer nights over grass
      const wantFl = fair && s.season === 'summer' && (h > 20.8 || h < 2) ? 18 : 0;
      flies = flies.filter(inView); while (flies.length < wantFl) { const p = spot(w, v); if (!p) break; flies.push({ x: p[0], y: p[1], ox: p[0], oy: p[1], t: Math.random() * 20, sp: 0.4 + Math.random() * 0.8 }); }
      if (!wantFl) flies.length = 0;
      for (const f of flies) { f.t += dt; f.x = f.ox + Math.sin(f.t * 0.3 * f.sp + f.ox) * 18; f.y = f.oy + Math.cos(f.t * 0.23 * f.sp + f.oy) * 10; }
      // bats at dusk
      const wantBat = fair && s.season !== 'winter' && h > 19.4 && h < 21.6 ? 3 : 0;
      bats = bats.filter(inView); while (bats.length < wantBat) bats.push({ x: v.x0 + Math.random() * (v.x1 - v.x0), y: v.y0 + Math.random() * (v.y1 - v.y0), vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 90, t: 0 });
      if (!wantBat) bats.length = 0;
      for (const b of bats) { b.t += dt; if (Math.random() < dt * 2.5) { b.vx = (Math.random() - 0.5) * 160; b.vy = (Math.random() - 0.5) * 100; } b.x += b.vx * dt; b.y += b.vy * dt; }
    });
    O.Critters = { get butterflies() { return bfs; }, get birds() { return birds; }, get flies() { return flies; }, get bats() { return bats; } };
    // butterflies and their shadows sit among things on the ground; birds and bats are over everything
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; const t = performance.now() / 1000;
      for (const b of bfs) {
        const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y);
        ctx.fillStyle = 'rgba(28,20,44,0.18)'; ctx.fillRect(x - 2, y, 4, 1);
        const f = b.rest > 0 ? (Math.floor(t * 1.5 + b.c) % 4 === 0 ? 1 : 2) : Math.floor(t * 14 + b.c) % 3;
        ctx.drawImage(bfSprite[b.c][f], x - 4, Math.round(y - b.z) - 4);
      }
    });
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      if (indoor || game.scene) return; const t = performance.now() / 1000;
      for (const f of flies) { const on = Math.sin(f.t * 1.7 * f.sp + f.ox); if (on < 0.15) continue; ctx.globalAlpha = Math.min(1, on); ctx.drawImage(glow, Math.round(f.x - cam.x) - 4, Math.round(f.y - cam.y) - 12); }
      ctx.globalAlpha = 1;
      if (birds) for (const b of birds.list) {
        const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y), f = Math.floor(t * 7 + b.ph * 3) % 4;
        ctx.fillStyle = 'rgba(28,20,44,0.15)'; ctx.fillRect(x - 3 + 18, y + 46, 6, 1); // its shadow on the ground, well below and to one side
        const im = birdSprite[f]; ctx.save(); if (birds.vx < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); } ctx.drawImage(im, x - 5, y - 3); ctx.restore();
      }
      for (const b of bats) ctx.drawImage(batSprite[Math.floor(t * 12 + b.x) % 2], Math.round(b.x - cam.x) - 4, Math.round(b.y - cam.y) - 2);
    });
  }
  O.CrittersSetup = { setup };
})();
