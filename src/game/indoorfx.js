// Rooms that breathe. Indoors the hearth throws up sparks and its smoke curls into the chimney; the pot
// on the fire and the brewer's vat steam; the forge spits; the oven door glows; the cradle rocks; and in
// many a house the cat lies curled by the fire, its ear twitching. Dust hangs in the light by the
// windows on a sunny day.
'use strict';
(function () {
  function setup(game) {
    const parts = []; let last = null, cat = null;
    game.hooks.drawTop.push((ctx, cam, inScene) => {
      const sc = game.scene; if (!inScene || !sc || !sc.L || !sc.anchor) { parts.length = 0; return; }
      if (last !== sc) { last = sc; parts.length = 0; const fire = sc.L.items.find((i) => i.kind === 'fireplace'); cat = fire && sc.b && sc.b.type === 'house' && (sc.b.id % 3) !== 0 ? { it: fire, seed: sc.b.id * 7 + 3, ft: 0 } : null; }
      const tk = performance.now() / 1000, dt = 1 / 60;
      for (const it of sc.L.items) { const k = it.kind; if (k !== 'fireplace' && k !== 'cauldron' && k !== 'oven' && k !== 'forge' && k !== 'vat' && k !== 'cradle') continue; let ax, ay; try { [ax, ay] = sc.anchor(it); } catch (e) { continue; }
        if (k === 'fireplace' || k === 'forge') { if (Math.random() < (k === 'forge' ? 0.5 : 0.25)) parts.push({ x: ax + (Math.random() - 0.5) * 10, y: ay - 14, vx: (Math.random() - 0.5) * 14, vy: -20 - Math.random() * 30, t: 0, life: 0.6 + Math.random() * 0.5, c: Math.random() < 0.5 ? '#ffb040' : '#ffe080', s: 1 }); }
        if (k === 'cauldron' || k === 'vat' || (k === 'fireplace' && (it.id || 0) % 2 === 0)) { if (Math.random() < 0.3) parts.push({ x: ax + (Math.random() - 0.5) * 8, y: ay - (k === 'fireplace' ? 18 : 12), vx: (Math.random() - 0.5) * 4, vy: -10 - Math.random() * 6, t: 0, life: 1.4, c: 'rgba(235,235,240,0.45)', s: 2 }); }
        if (k === 'oven') { const x = Math.round(ax - cam.x), y = Math.round(ay - cam.y); ctx.fillStyle = `rgba(255,${140 + Math.floor(Math.sin(tk * 3) * 20)},60,0.35)`; ctx.fillRect(x - 5, y - 10, 10, 5); }
        if (k === 'cradle') { it._rock = Math.sin(tk * 1.6) * 1.2; } }
      for (const p of parts.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) parts.splice(parts.indexOf(p), 1); }
      if (parts.length > 200) parts.splice(0, parts.length - 200);
      for (const p of parts) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), p.s, p.s); } ctx.globalAlpha = 1;
      if (cat) { cat.ft += dt; let ax, ay; try { [ax, ay] = sc.anchor(cat.it); } catch (e) { return; } const x = ax + 18 - cam.x, y = ay + 10 - cam.y; try { const H = O.Animals.HANIMS.idle, fr = O.Animals.animal('cat', cat.seed, 1, false, Math.floor(cat.ft * H.fps) % H.frames, 'idle'); ctx.drawImage(fr, Math.round(x - (fr.ox ?? fr.width / 2)), Math.round(y - (fr.gy ?? fr.height))); } catch (e) { /* */ } }
      // dust in the window light, by day
      if (!(game.isNight && game.isNight()) && sc.R && sc.R.windows) for (const w of sc.R.windows.slice(0, 4)) { for (let i = 0; i < 4; i++) { const x = Math.round(w.x + w.w / 2 + Math.sin(tk * 0.4 + i * 2 + w.x) * 6 - cam.x), y = Math.round(w.y + w.h + 6 + ((tk * 4 + i * 7) % 22) - cam.y); ctx.fillStyle = 'rgba(255,240,200,0.35)'; ctx.fillRect(x, y, 1, 1); } }
    });
  }
  O.IndoorFxSetup = { setup };
})();
