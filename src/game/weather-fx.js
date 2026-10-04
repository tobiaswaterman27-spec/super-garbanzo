// Weather rendering: puddles and snow on the ground, snow on roofs, cloud shadows, rain and snow
// particles with splashes, rolling fog and lightning. All drawn on the pixel grid.
'use strict';
(function () {
  function setup(game, sim) {
    const T = 16;
    let W = sim.weather, world = sim.world, pw = world.W * T, ph = world.H * T;
    const caches = new Map();
    let puddles = null, snowLevels = [], fogTex = null;
    const syncWorld = () => {
      if (world === game.world && W === sim.weather) return;
      if (world) caches.set(world, { puddles, snowLevels });
      world = game.world; W = sim.weather; pw = world.W * T; ph = world.H * T;
      const c = caches.get(world) || { puddles: null, snowLevels: [] }; puddles = c.puddles; snowLevels = c.snowLevels;
    };
    const drops = [], flakes = [], splashes = [], hail = [], bounces = [], bolts = [], thunders = [];

    // r = { x, y, w, h } in world pixels: a chunk of a big region, or the whole of a small map
    function makePuddles(r) {
      r = r || { x: 0, y: 0, w: pw, h: ph };
      const c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
      const ctx = c.getContext('2d'), id = ctx.createImageData(r.w, r.h), d = id.data;
      const { ter, TER } = world;
      for (let yy = 1; yy < r.h - 1; yy++) for (let xx = 1; xx < r.w - 1; xx++) {
        const x = r.x + xx, y = r.y + yy;
        const t = ter[Math.floor(y / T) * world.W + Math.floor(x / T)];
        if (t !== TER.ROAD && t !== TER.YARD && t !== TER.COBBLE && t !== TER.FIELD) continue;
        const n = O.fbm(x / 9, y / 5, 77, 2);
        if (n < 0.66) continue;
        const i = (yy * r.w + xx) * 4;
        const edge = O.fbm((x - 1) / 9, (y - 1) / 5, 77, 2) < 0.66;
        const col = edge ? [150, 170, 190] : n > 0.72 ? [70, 84, 104] : [86, 100, 118];
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0); return c;
    }
    function makeSnow(level, r) {
      r = r || { x: 0, y: 0, w: pw, h: ph };
      const c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
      const ctx = c.getContext('2d'), id = ctx.createImageData(r.w, r.h), d = id.data;
      const { ter, TER } = world;
      const ramp = O.Pal.makeRamp('#e6ecf2', 0.6);
      for (let yy = 0; yy < r.h; yy++) for (let xx = 0; xx < r.w; xx++) {
        const x = r.x + xx, y = r.y + yy;
        const t = ter[Math.floor(y / T) * world.W + Math.floor(x / T)];
        if (t === TER.WATER) continue;
        const n = O.fbm(x / 14, y / 14, 31, 3) * 0.8 + O.noise2(x * 0.9, y * 0.9, 3) * 0.2;
        const thr = (t === TER.ROAD || t === TER.COBBLE ? 0.25 : 0) + (1 - level);
        if (n < thr) continue;
        const i = (yy * r.w + xx) * 4, s = n > thr + 0.25 ? 4 : n > thr + 0.08 ? 3 : 2;
        d[i] = ramp[s][0]; d[i + 1] = ramp[s][1]; d[i + 2] = ramp[s][2]; d[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0); return c;
    }
    function makeFog() {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const ctx = c.getContext('2d'), id = ctx.createImageData(256, 128);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
        const n = O.fbm(x / 40, y / 14, 5, 3);
        const a = n > 0.62 ? 120 : n > 0.5 ? 80 : n > 0.4 ? 40 : 0;
        const i = (y * 256 + x) * 4; id.data[i] = 214; id.data[i + 1] = 218; id.data[i + 2] = 226; id.data[i + 3] = a;
      }
      ctx.putImageData(id, 0, 0); return c;
    }

    // tint the day by the weather (clouds darken, snow brightens to blue-white)
    game.hooks.update.push((dt) => {
      syncWorld();
      const k = W.kind, lv = W.level || 1;
      const dim = (a, b, c) => [a, b, c].map((v) => 1 - (1 - v) * (0.7 + lv * 0.15));
      game.weatherTint = k === 'storm' ? dim(0.62, 0.64, 0.74) : k === 'heavy' ? [0.72, 0.75, 0.84] : k === 'rain' ? dim(0.8, 0.83, 0.9) : k === 'hail' ? dim(0.76, 0.8, 0.88) : k === 'cloudy' ? dim(0.88, 0.9, 0.94) : k === 'fog' ? dim(0.9, 0.92, 0.95) : k === 'snow' ? dim(0.9, 0.93, 1) : k === 'heat' ? [1, 0.97, 0.9] : [1, 1, 1];
      game.snowAlpha = O.clamp(W.snowCover * 1.3 - 0.1 + (W.hailCover || 0) * 0.6, 0, 0.95);
      // lightning: a bolt somewhere in view, its thunder arriving after the light
      if (k === 'storm' && Math.random() < dt * (0.1 + lv * 0.08)) {
        W.flash = 0.6 + Math.random() * 0.4;
        const far = Math.random(), x0 = Math.random() * game.vw, pts = [[x0, -4]];
        let x = x0, y = -4; const yEnd = game.vh * (0.35 + Math.random() * 0.5);
        while (y < yEnd) { y += 4 + Math.random() * 7; x += (Math.random() - 0.5) * 12; pts.push([x, y]); }
        const branch = pts.length > 4 ? (() => { const s = pts[Math.floor(pts.length / 2)]; const b = [[s[0], s[1]]]; let bx = s[0], by = s[1]; for (let i = 0; i < 5; i++) { by += 5; bx += (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 5); b.push([bx, by]); } return b; })() : null;
        bolts.push({ pts, branch, t: 0, far });
        thunders.push({ t: 0.3 + far * 2.6, vol: 1 - far * 0.6 });
      }
      for (const b of bolts) b.t += dt;
      while (bolts.length && bolts[0].t > 0.35) bolts.shift();
      for (const th of thunders) { th.t -= dt; if (th.t <= 0 && !th.done) { th.done = true; if (!game.scene) O.Sound && O.Sound.play('thunder', th.vol); } }
      while (thunders.length && thunders[0].done) thunders.shift();
      W.flash = Math.max(0, W.flash - dt * 2.5);
      // particles in screen space
      const vw = game.vw, vh = game.vh;
      const rainN = W.raining && k !== 'hail' ? Math.round((k === 'rain' ? [30, 70, 120][lv - 1] : k === 'heavy' ? 160 : [120, 190, 260][lv - 1]) * (vw * vh) / (480 * 300)) : k === 'hail' && lv === 1 ? Math.round(40 * (vw * vh) / (480 * 300)) : 0;
      while (drops.length < rainN) drops.push({ x: Math.random() * (vw + 40) - 20, y: Math.random() * vh - vh, l: 3 + Math.random() * 3, v: 220 + Math.random() * 80, end: Math.random() * vh });
      if (drops.length > rainN) drops.length = rainN;
      const wind = W.wind * 60;
      for (const d of drops) {
        d.y += d.v * dt; d.x += wind * dt;
        if (d.y > d.end) { if (splashes.length < 80) splashes.push({ x: d.x, y: d.end, t: 0 }); d.y = -Math.random() * 40; d.x = Math.random() * (vw + 40) - 20 - wind * 0.4; d.end = Math.random() * vh + 10; }
      }
      for (const s of splashes) s.t += dt;
      while (splashes.length && splashes[0].t > 0.18) splashes.shift();
      const snowN = k === 'snow' ? Math.round([50, 110, 240][lv - 1] * (vw * vh) / (480 * 300)) : 0;
      while (flakes.length < snowN) flakes.push({ x: Math.random() * vw, y: Math.random() * vh, v: 14 + Math.random() * 14 + (lv === 3 ? 20 : 0), ph: Math.random() * 6, s: Math.random() < 0.3 ? 2 : 1 });
      if (flakes.length > snowN) flakes.length = snowN;
      const blow = lv === 3 && k === 'snow' ? 4 : 0.2;
      for (const f of flakes) { f.y += f.v * dt; f.x += Math.sin(game.t * 1.5 + f.ph) * 8 * dt + wind * blow * dt; if (f.y > vh) { f.y = -2; f.x = Math.random() * vw; } if (f.x > vw + 4) f.x = -4; }
      // hail: hard white pellets that bounce where they land
      const hailN = k === 'hail' ? Math.round([40, 90, 150][lv - 1] * (vw * vh) / (480 * 300)) : 0;
      while (hail.length < hailN) hail.push({ x: Math.random() * vw, y: -Math.random() * vh, v: 300 + Math.random() * 90, end: Math.random() * vh, s: lv === 3 && Math.random() < 0.4 ? 2 : 1 });
      if (hail.length > hailN) hail.length = hailN;
      for (const h of hail) { h.y += h.v * dt; h.x += wind * 0.5 * dt; if (h.y > h.end) { if (bounces.length < 120) bounces.push({ x: h.x, y: h.end, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 25, t: 0, s: h.s }); h.y = -Math.random() * 30; h.x = Math.random() * vw; h.end = Math.random() * vh + 6; } }
      for (const b of bounces) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 220 * dt; }
      while (bounces.length && bounces[0].t > 0.35) bounces.shift();
      if (k === 'hail' && Math.random() < dt * 6 * lv && !game.scene) O.Sound && O.Sound.play('hail', 0.6);
    });

    // moving water: ripples drift down the river, sparkles catch the light, foam laps at the banks
    game.hooks.drawGround.push((ctx, cam) => {
      const { ter, TER } = world; if (!ter || game.world !== world) return;
      const tx0 = Math.max(0, Math.floor(cam.x / T)), ty0 = Math.max(0, Math.floor(cam.y / T)), tx1 = Math.min(world.W - 1, Math.ceil((cam.x + game.vw) / T)), ty1 = Math.min(world.H - 1, Math.ceil((cam.y + game.vh) / T));
      const isW = (x, y) => x >= 0 && y >= 0 && x < world.W && y < world.H && ter[y * world.W + x] === TER.WATER;
      const t = game.t, frozen = W.snowCover > 0.75 && W.season === 'winter';
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (!isW(tx, ty)) continue;
        const horiz = isW(tx - 1, ty) || isW(tx + 1, ty), vert = isW(tx, ty - 1) || isW(tx, ty + 1);
        const fx = horiz && !vert ? 1 : !horiz && vert ? 0 : 0.7, fy = horiz && !vert ? 0 : !horiz && vert ? 1 : 0.7;
        const sp = frozen ? 0 : 9 + W.wind * 8;
        for (let k = 0; k < 3; k++) {
          const h = ((tx * 73856093) ^ (ty * 19349663) ^ (k * 83492791)) >>> 0;
          const ox = (h % 16), oy = ((h >> 4) % 16);
          const px = tx * T + ((ox + t * sp * fx) % 16 + 16) % 16, py = ty * T + ((oy + t * sp * fy * 0.6) % 16 + 16) % 16;
          const sx = Math.round(px - cam.x), sy = Math.round(py - cam.y);
          const tw = (Math.sin(t * 3 + h) + 1) / 2;
          // drifting ripples only away from the banks, so nothing outlines the tile edges
          const inner = isW(tx - 1, ty) && isW(tx + 1, ty) && isW(tx, ty - 1) && isW(tx, ty + 1);
          if (!inner && (ox < 4 || ox > 11 || oy < 4 || oy > 11)) continue;
          ctx.fillStyle = frozen ? 'rgba(236,244,250,0.5)' : `rgba(206,226,240,${(0.18 + tw * 0.3).toFixed(2)})`;
          ctx.fillRect(sx, sy, horiz && !vert ? 3 : 2, 1);
          if (tw > 0.92 && !frozen) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(sx + 1, sy, 1, 1); }
        }
        // (the foam at the banks is painted into the ground itself, following the true waterline)
      }
    });

    game.hooks.drawGround.push((ctx, cam) => {
      if (world.chunked) {
        // big regions: puddles and snow made chunk by chunk, only where you can see
        const CS = 256, cx0 = Math.floor(cam.x / CS), cy0 = Math.floor(cam.y / CS), cx1 = Math.floor((cam.x + game.vw) / CS), cy1 = Math.floor((cam.y + game.vh) / CS);
        const wc = world._wx || (world._wx = new Map());
        const lv = Math.min(3, Math.floor(W.snowCover * 4));
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
          const key = cx + ',' + cy, e = wc.get(key) || {}; wc.set(key, e);
          const r = { x: cx * CS, y: cy * CS, w: Math.min(CS, pw - cx * CS), h: Math.min(CS, ph - cy * CS) }; if (r.w <= 0 || r.h <= 0) continue;
          if (W.wet > 0.05) { if (!e.p) e.p = makePuddles(r); ctx.globalAlpha = Math.min(0.85, W.wet); ctx.drawImage(e.p, r.x - cam.x, r.y - cam.y); ctx.globalAlpha = 1; }
          if (W.snowCover > 0.05) { e.s = e.s || []; if (!e.s[lv]) e.s[lv] = makeSnow((lv + 1) / 4, r); ctx.drawImage(e.s[lv], r.x - cam.x, r.y - cam.y); }
        }
      } else {
      if (W.wet > 0.05) { if (!puddles) puddles = makePuddles(); ctx.globalAlpha = Math.min(0.85, W.wet); ctx.drawImage(puddles, cam.x, cam.y, game.vw, game.vh, 0, 0, game.vw, game.vh); ctx.globalAlpha = 1; }
      if (W.snowCover > 0.05) {
        const lv = Math.min(3, Math.floor(W.snowCover * 4));
        if (!snowLevels[lv]) snowLevels[lv] = makeSnow((lv + 1) / 4);
        ctx.drawImage(snowLevels[lv], cam.x, cam.y, game.vw, game.vh, 0, 0, game.vw, game.vh);
      }
      }
      // hailstones lying in drifts until they melt
      if ((W.hailCover || 0) > 0.04 && W.snowCover <= 0.05 && !world.chunked) { if (!snowLevels[0]) snowLevels[0] = makeSnow(0.25); ctx.globalAlpha = Math.min(0.8, W.hailCover * 1.6); ctx.drawImage(snowLevels[0], cam.x, cam.y, game.vw, game.vh, 0, 0, game.vw, game.vh); ctx.globalAlpha = 1; }
    });

    // drifting cloud shadows over the world
    game.hooks.drawWorld.push((ctx, cam) => {
      const k = W.kind; if (!(k === 'cloudy' || k === 'rain' || k === 'heavy' || k === 'storm' || k === 'hail')) return;
      const lv = W.level || 1; ctx.fillStyle = `rgba(24,22,44,${(0.07 + lv * 0.04).toFixed(2)})`;
      const drift = game.t * (6 + W.wind * 20);
      for (let i = 0; i < 4 + lv * 2; i++) {
        const cx = ((i * 431 + drift) % (pw + 400)) - 200 - cam.x, cy = ((i * 277) % ph) - cam.y;
        const rx = 70 + (i % 3) * 30, ry = 40 + (i % 2) * 18;
        if (cx < -rx * 1.5 || cx > game.vw + rx * 1.5 || cy < -ry * 1.5 || cy > game.vh + ry * 1.5) continue;
        for (let y = -ry; y <= ry; y += 1) { const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)) * (1 + 0.15 * Math.sin(y * 0.3 + i))); ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1); }
      }
    });

    game.hooks.drawTop.push((ctx, cam, indoor) => {
      if (indoor) return;
      if (drops.length) {
        ctx.fillStyle = 'rgba(190,206,232,0.55)';
        const sl = W.wind * 0.35;
        for (const d of drops) for (let k = 0; k < d.l; k++) ctx.fillRect(Math.round(d.x + k * sl), Math.round(d.y + k), 1, 1);
        ctx.fillStyle = 'rgba(210,222,240,0.7)';
        for (const s of splashes) { const r = s.t < 0.09 ? 1 : 2; ctx.fillRect(Math.round(s.x - r), Math.round(s.y), 1, 1); ctx.fillRect(Math.round(s.x + r), Math.round(s.y), 1, 1); if (r === 1) ctx.fillRect(Math.round(s.x), Math.round(s.y - 1), 1, 1); }
      }
      if (flakes.length) { ctx.fillStyle = '#f4f8ff'; for (const f of flakes) ctx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s); }
      if (hail.length || bounces.length) { ctx.fillStyle = '#eef4fa'; for (const h of hail) { ctx.fillRect(Math.round(h.x), Math.round(h.y), h.s, h.s + 1); } ctx.fillStyle = '#dce6f0'; for (const b of bounces) ctx.fillRect(Math.round(b.x), Math.round(b.y), b.s, b.s); }
      // a blizzard swallows the distance
      if (W.kind === 'snow' && (W.level || 1) === 3) { ctx.fillStyle = 'rgba(232,238,246,0.28)'; ctx.fillRect(0, 0, game.vw, game.vh); }
      for (const b of bolts) {
        const a = b.t < 0.08 ? 1 : 0.6 * (1 - b.t / 0.35);
        for (const [pts, w] of [[b.pts, 2], [b.branch, 1]]) { if (!pts) continue; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let j = 0; j <= n; j++) { const x = Math.round(x0 + (x1 - x0) * j / n), y = Math.round(y0 + (y1 - y0) * j / n); ctx.fillStyle = `rgba(200,210,255,${(a * 0.5).toFixed(2)})`; ctx.fillRect(x - 1, y, w + 2, 1); ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; ctx.fillRect(x, y, w, 1); } } }
      }
      if (W.kind === 'fog') {
        if (!fogTex) fogTex = makeFog();
        ctx.globalAlpha = 0.8;
        const ox = Math.floor(game.t * 4) % 512, oy = 0;
        for (let y = -((cam.y / 2) % 256) - 256; y < game.vh; y += 256) for (let x = -((cam.x / 2 + ox) % 512) - 512; x < game.vw; x += 512) ctx.drawImage(fogTex, Math.round(x), Math.round(y + oy), 512, 256);
        ctx.globalAlpha = 1;
      }
      if (W.flash > 0.02) { ctx.fillStyle = `rgba(235,240,255,${(W.flash * 0.55).toFixed(2)})`; ctx.fillRect(0, 0, game.vw, game.vh); }
    });
  }
  O.WeatherFX = { setup };
})();
