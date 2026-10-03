// Weather rendering: puddles and snow on the ground, snow on roofs, cloud shadows, rain and snow
// particles with splashes, rolling fog and lightning. All drawn on the pixel grid.
'use strict';
(function () {
  function setup(game, sim) {
    const W = sim.weather, world = sim.world, T = world.T;
    const pw = world.W * T, ph = world.H * T;
    let puddles = null, snowLevels = [], fogTex = null;
    const drops = [], flakes = [], splashes = [];

    function makePuddles() {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const ctx = c.getContext('2d'), id = ctx.createImageData(pw, ph), d = id.data;
      const { ter, TER } = world;
      for (let y = 1; y < ph - 1; y++) for (let x = 1; x < pw - 1; x++) {
        const t = ter[Math.floor(y / T) * world.W + Math.floor(x / T)];
        if (t !== TER.ROAD && t !== TER.YARD && t !== TER.COBBLE && t !== TER.FIELD) continue;
        const n = O.fbm(x / 9, y / 5, 77, 2);
        if (n < 0.66) continue;
        const i = (y * pw + x) * 4;
        const edge = O.fbm((x - 1) / 9, (y - 1) / 5, 77, 2) < 0.66;
        const col = edge ? [150, 170, 190] : n > 0.72 ? [70, 84, 104] : [86, 100, 118];
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0); return c;
    }
    function makeSnow(level) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const ctx = c.getContext('2d'), id = ctx.createImageData(pw, ph), d = id.data;
      const { ter, TER } = world;
      const ramp = O.Pal.makeRamp('#e6ecf2', 0.6);
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
        const t = ter[Math.floor(y / T) * world.W + Math.floor(x / T)];
        if (t === TER.WATER) continue;
        const n = O.fbm(x / 14, y / 14, 31, 3) * 0.8 + O.noise2(x * 0.9, y * 0.9, 3) * 0.2;
        const thr = (t === TER.ROAD || t === TER.COBBLE ? 0.25 : 0) + (1 - level);
        if (n < thr) continue;
        const i = (y * pw + x) * 4, s = n > thr + 0.25 ? 4 : n > thr + 0.08 ? 3 : 2;
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
      const k = W.kind;
      game.weatherTint = k === 'storm' ? [0.62, 0.64, 0.74] : k === 'heavy' ? [0.72, 0.75, 0.84] : k === 'rain' ? [0.8, 0.83, 0.9] : k === 'cloudy' ? [0.88, 0.9, 0.94] : k === 'fog' ? [0.9, 0.92, 0.95] : k === 'snow' ? [0.9, 0.93, 1] : k === 'heat' ? [1, 0.97, 0.9] : [1, 1, 1];
      game.snowAlpha = O.clamp(W.snowCover * 1.3 - 0.1, 0, 0.95);
      if (k === 'storm' && Math.random() < dt * 0.25) W.flash = 1;
      W.flash = Math.max(0, W.flash - dt * 2.5);
      // particles in screen space
      const vw = game.vw, vh = game.vh;
      const rainN = W.raining ? Math.round((W.kind === 'rain' ? 70 : W.kind === 'heavy' ? 150 : 200) * (vw * vh) / (480 * 300)) : 0;
      while (drops.length < rainN) drops.push({ x: Math.random() * (vw + 40) - 20, y: Math.random() * vh - vh, l: 3 + Math.random() * 3, v: 220 + Math.random() * 80, end: Math.random() * vh });
      if (drops.length > rainN) drops.length = rainN;
      const wind = W.wind * 60;
      for (const d of drops) {
        d.y += d.v * dt; d.x += wind * dt;
        if (d.y > d.end) { if (splashes.length < 80) splashes.push({ x: d.x, y: d.end, t: 0 }); d.y = -Math.random() * 40; d.x = Math.random() * (vw + 40) - 20 - wind * 0.4; d.end = Math.random() * vh + 10; }
      }
      for (const s of splashes) s.t += dt;
      while (splashes.length && splashes[0].t > 0.18) splashes.shift();
      const snowN = W.kind === 'snow' ? Math.round(110 * (vw * vh) / (480 * 300)) : 0;
      while (flakes.length < snowN) flakes.push({ x: Math.random() * vw, y: Math.random() * vh, v: 14 + Math.random() * 14, ph: Math.random() * 6, s: Math.random() < 0.3 ? 2 : 1 });
      if (flakes.length > snowN) flakes.length = snowN;
      for (const f of flakes) { f.y += f.v * dt; f.x += Math.sin(game.t * 1.5 + f.ph) * 8 * dt + wind * 0.2 * dt; if (f.y > vh) { f.y = -2; f.x = Math.random() * vw; } }
    });

    game.hooks.drawGround.push((ctx, cam) => {
      if (W.wet > 0.05) { if (!puddles) puddles = makePuddles(); ctx.globalAlpha = Math.min(0.85, W.wet); ctx.drawImage(puddles, cam.x, cam.y, game.vw, game.vh, 0, 0, game.vw, game.vh); ctx.globalAlpha = 1; }
      if (W.snowCover > 0.05) {
        const lv = Math.min(3, Math.floor(W.snowCover * 4));
        if (!snowLevels[lv]) snowLevels[lv] = makeSnow((lv + 1) / 4);
        ctx.drawImage(snowLevels[lv], cam.x, cam.y, game.vw, game.vh, 0, 0, game.vw, game.vh);
      }
    });

    // drifting cloud shadows over the world
    game.hooks.drawWorld.push((ctx, cam) => {
      const k = W.kind; if (!(k === 'cloudy' || k === 'rain' || k === 'heavy' || k === 'storm')) return;
      ctx.fillStyle = 'rgba(24,22,44,0.13)';
      const drift = game.t * (6 + W.wind * 20);
      for (let i = 0; i < 7; i++) {
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
