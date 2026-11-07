// Boats on the water. Wherever there's river or lake near you, there's traffic on it by day: a
// fisherman sitting in a little boat with his line out (and now and then a fish flapping up out of
// the water), a man rowing across with the oars dipping and a wake behind, a flat barge poled slowly
// along with sacks and barrels aboard. They keep to the water and go about their business.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const boats = []; const wakes = [];
    const water = (w, x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 1 || ty < 1 || tx >= w.W - 1 || ty >= w.H - 1) return false; return w.TER && w.ter && w.ter[ty * w.W + tx] === w.TER.WATER; };
    const deep = (w, x, y) => water(w, x, y) && water(w, x - 10, y) && water(w, x + 10, y) && water(w, x, y - 6) && water(w, x, y + 6);
    let tick = 2, appSeed = 1;
    function spawn(s) {
      const w = s.world, P = game.player; let at = null; for (let k = 0; k < 40 && !at; k++) { const x = P.x + (Math.random() - 0.5) * 560, y = P.y + (Math.random() - 0.5) * 380; if (deep(w, x, y)) at = [x, y]; } if (!at) return;
      const kind = pick(['fisher', 'fisher', 'rower', 'barge']); const sex = 'm';
      const app = O.Char.makeAppearance(O.hash('boatman', appSeed++), { sex, age: 25 + (appSeed * 7) % 35, genes: O.Char.randomGenes(O.RNG(appSeed), s.world.region), role: kind === 'barge' ? 'labourer' : 'fisher', wealth: 0.3 });
      const ang = Math.random() * Math.PI * 2; boats.push({ kind, app, x: at[0], y: at[1], vx: Math.cos(ang), vy: Math.sin(ang) * 0.5, t: 0, life: 60 + Math.random() * 60, speed: kind === 'barge' ? 6 : kind === 'rower' ? 14 : 0, catchT: 6 + Math.random() * 10, fish: 0, dir: Math.cos(ang) > 0 ? 2 : 1 });
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const w = s.world; const day = !(game.isNight && game.isNight());
      tick -= dt; if (tick <= 0) { tick = 4; if (day && boats.length < 3 && w.TER && w.ter) spawn(s); }
      for (const b of boats.slice()) { b.t += dt;
        if (b.speed) { const nx = b.x + b.vx * b.speed * dt, ny = b.y + b.vy * b.speed * dt; if (deep(w, nx, ny)) { b.x = nx; b.y = ny; if (Math.random() < dt * 3) wakes.push({ x: b.x - b.vx * 12, y: b.y - b.vy * 6 + 2, t: 0 }); } else { const a = Math.atan2(b.vy, b.vx) + Math.PI * (0.5 + Math.random()); b.vx = Math.cos(a); b.vy = Math.sin(a) * 0.5; } b.dir = b.vx > 0 ? 2 : 1; }
        else { b.catchT -= dt; if (b.catchT <= 0) { b.catchT = 8 + Math.random() * 14; if (Math.random() < 0.5) { b.fish = 1.2; if (Math.hypot(b.x - game.player.x, b.y - game.player.y) < 220) O.sfx && O.sfx('splash', 0.2, false); } } if (b.fish > 0) b.fish -= dt; }
        if ((b.t > b.life || !day) && Math.hypot(b.x - game.player.x, b.y - game.player.y) > 300) boats.splice(boats.indexOf(b), 1); else if (Math.hypot(b.x - game.player.x, b.y - game.player.y) > 900) boats.splice(boats.indexOf(b), 1); }
      for (const k of wakes.slice()) { k.t += dt; if (k.t > 1.4) wakes.splice(wakes.indexOf(k), 1); }
    });
    game.hooks.drawGround.push((ctx, cam) => { if (game.scene) return; for (const k of wakes) { ctx.globalAlpha = 0.5 * (1 - k.t / 1.4); ctx.strokeStyle = '#d8e8f0'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(Math.round(k.x - cam.x), Math.round(k.y - cam.y), 2 + k.t * 6, 1 + k.t * 2, 0, 0, Math.PI * 2); ctx.stroke(); } ctx.globalAlpha = 1; });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; const tk = performance.now() / 1000;
      for (const b of boats) { const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y) + Math.round(Math.sin(tk * 1.6 + b.life) * 0.8); if (x < -40 || y < -40 || x > ctx.canvas.width + 40 || y > ctx.canvas.height + 40) continue; const L = b.kind === 'barge' ? 18 : 12;
        // the man (sitting, or standing to pole)
        try { const anim = b.kind === 'barge' ? 'pitch' : b.kind === 'rower' ? 'saw' : (b.fish > 0 ? 'celebrate' : 'fish'); const A = O.Char.ANIMS[anim] || O.Char.ANIMS.idle; const f = Math.floor(tk * A.fps) % A.frames; const fr = O.Char.frame(b.app, b.dir, anim, f); ctx.drawImage(fr, x - 16, y - (b.kind === 'barge' ? 46 : 40)); } catch (e) { /* */ }
        // the hull, over his legs
        ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.moveTo(x - L, y - 6); ctx.lineTo(x + L, y - 6); ctx.lineTo(x + L - 4, y + 2); ctx.lineTo(x - L + 4, y + 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - L, y - 7, L * 2, 2); ctx.fillStyle = 'rgba(200,220,235,0.6)'; ctx.fillRect(x - L + 3, y + 2, L * 2 - 6, 1);
        if (b.kind === 'barge') { ctx.fillStyle = '#c8b080'; ctx.fillRect(x - 14, y - 11, 6, 5); ctx.fillRect(x - 7, y - 10, 6, 4); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 6, y - 12, 6, 6); ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + (b.dir === 2 ? -4 : 4), y - 30); ctx.lineTo(x + (b.dir === 2 ? -12 : 12), y + 4); ctx.stroke(); }
        if (b.kind === 'rower') { const r = Math.sin(tk * 3) * 4; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 4, y - 10); ctx.lineTo(x - 14, y + 2 + r * 0.3); ctx.moveTo(x + 4, y - 10); ctx.lineTo(x + 14, y + 2 + r * 0.3); ctx.stroke(); }
        if (b.kind === 'fisher') { const tx = x + (b.dir === 2 ? 22 : -22); ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + (b.dir === 2 ? 4 : -4), y - 18); ctx.lineTo(tx, y - 28); ctx.stroke(); ctx.strokeStyle = 'rgba(230,230,230,0.7)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(tx, y - 28); ctx.lineTo(tx, y + 4); ctx.stroke(); if (b.fish > 0) { ctx.fillStyle = '#a8b8c8'; const fy = y - 6 - Math.sin((1.2 - b.fish) / 1.2 * Math.PI) * 12; ctx.fillRect(tx - 2, Math.round(fy), 4, 2); } else { ctx.fillStyle = '#e8e0d0'; ctx.fillRect(tx - 1, y + 3 + Math.round(Math.sin(tk * 2) * 0.6), 2, 1); } } }
    });
    O.Boats = { boats, spawn: () => spawn(cur()) };
  }
  O.BoatsSetup = { setup };
})();
