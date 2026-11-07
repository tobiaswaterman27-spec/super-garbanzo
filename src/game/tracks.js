// Marks on the ground. When snow lies, everyone who walks leaves footprints that fill in slowly; in the
// mud after rain the prints are dark and wet; and on a dry summer road a running child or a hurrying
// man kicks up little puffs of dust. Your own feet leave them too.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const prints = [], dust = [];
    let tick = 0; const last = new WeakMap();
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; tick -= dt;
      const W = s.weather || {}, snow = (W.snowCover || 0) > 0.2, wet = !snow && (s.raining || (s.world._critters && s.world._critters.puddles.length > 2)), dry = !snow && !wet && (s.season === 'summer' || s.season === 'autumn');
      for (const p of prints.slice()) { p.t += dt; if (p.t > p.life) prints.splice(prints.indexOf(p), 1); }
      for (const d of dust.slice()) { d.t += dt; d.x += d.vx * dt; d.y -= 5 * dt; if (d.t > 0.6) dust.splice(dust.indexOf(d), 1); }
      if (tick > 0) return; tick = 0.18;
      if (!snow && !wet && !dry) return;
      const P = game.player, walkers = [];
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.mount) continue; if (Math.hypot(a.x - P.x, a.y - P.y) > 360) continue; walkers.push([a, a.anim === 'run' || a.sprint, q.age < 13]); }
      walkers.push([P, P.running || P.anim === 'run', false]);
      for (const [a, run, small] of walkers) {
        const l = last.get(a); if (l && Math.hypot(a.x - l[0], a.y - l[1]) < (small ? 5 : 7)) continue; const side = l ? (l[2] ? -1 : 1) : 1; last.set(a, [a.x, a.y, side > 0]);
        if (!l) continue; const moving = Math.hypot(a.x - l[0], a.y - l[1]) > 0.5; if (!moving) continue;
        const dx = a.x - l[0], dy = a.y - l[1], dd = Math.hypot(dx, dy) || 1, nx = -dy / dd, ny = dx / dd;
        if (snow || wet) { if (prints.length < 500) prints.push({ x: a.x + nx * side * 2, y: a.y + ny * side * 1.2, t: 0, life: snow ? 70 : 30, wet: !snow, small }); }
        else if (run && dust.length < 80 && s.world.ter && s.world.TER) { const tx = Math.floor(a.x / 16), ty = Math.floor(a.y / 16), t = s.world.ter[ty * s.world.W + tx]; if (t === s.world.TER.ROAD || t === s.world.TER.YARD || t === s.world.TER.SAND || t === s.world.TER.FIELD) for (let i = 0; i < 2; i++) dust.push({ x: a.x - dx / dd * 4 + (Math.random() - 0.5) * 4, y: a.y - 1, vx: -dx / dd * 6 + (Math.random() - 0.5) * 6, t: 0 }); }
      }
    });
    game.hooks.drawGround.push((ctx, cam) => {
      if (game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height;
      for (const p of prints) { const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y); if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue; const k = 1 - p.t / p.life; ctx.globalAlpha = (p.wet ? 0.5 : 0.75) * k; ctx.fillStyle = p.wet ? '#3a2a1e' : '#7a88a8'; ctx.fillRect(x, y, p.small ? 1 : 2, p.small ? 1 : 2); }
      ctx.globalAlpha = 1;
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; for (const d of dust) { ctx.globalAlpha = 0.45 * (1 - d.t / 0.6); ctx.fillStyle = '#c8b090'; const r = 1 + Math.floor(d.t * 4); ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y) - r, r, r); } ctx.globalAlpha = 1; });
    O.Tracks = { prints, dust };
  }
  O.TracksSetup = { setup };
})();
