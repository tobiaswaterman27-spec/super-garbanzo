// A town under quarantine. While the pestilence is in the place and the council has shut it up, those who
// must go out go with a cloth or a posy of herbs held over the nose and mouth and keep their distance;
// pots of juniper and rosemary smoulder at the corners of the square to cleanse the air, their smoke
// hanging low; and on the steps of the marked houses the parish bread lies waiting to be taken in.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const smoke = []; let acc = 0;
    const fires = (s) => { if (!s.Z || !s.Z.square) return []; const [x0, y0, x1, y1] = s.Z.square; return [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => [x * 16 + 8, y * 16 + 12]); };
    game.hooks.update.push((dt) => {
      for (const p of smoke.slice()) { p.t += dt; p.y -= 6 * dt; p.x += (3 + Math.sin(p.t + p.ph) * 4) * dt; if (p.t > 4) smoke.splice(smoke.indexOf(p), 1); }
      const s = cur(); if (!s || !s.quarantine || game.scene) return; acc += dt; if (acc < 0.2) return; acc = 0;
      for (const [x, y] of fires(s)) if (Math.hypot(x - game.player.x, y - game.player.y) < 500) smoke.push({ x: x + (Math.random() - 0.5) * 4, y: y - 8, t: 0, ph: Math.random() * 6 });
      // folk keep their distance: two out of doors who come close step apart
      if (Math.random() < 0.2) for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || !a.path) continue; const o = s.people.find((r) => r !== q && r.agent && !r.agent.hidden && r.agent.inside == null && Math.hypot(r.agent.x - a.x, r.agent.y - a.y) < 14); if (o && Math.random() < 0.3) { O.gesture && O.gesture(q, 'shake', 0.8); break; } }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || !s.quarantine || game.scene) return; const P = game.player, tk = performance.now() / 1000;
      // the herb fires
      for (const [x0, y0] of fires(s)) { const x = Math.round(x0 - cam.x), y = Math.round(y0 - cam.y); if (x < -20 || y < -40 || x > ctx.canvas.width + 20 || y > ctx.canvas.height + 20) continue; ctx.fillStyle = '#4a4a50'; ctx.fillRect(x - 5, y - 6, 10, 6); ctx.fillStyle = '#5a5a60'; ctx.fillRect(x - 5, y - 6, 10, 1); ctx.fillStyle = Math.floor(tk * 6) % 2 ? '#c86020' : '#e08030'; ctx.fillRect(x - 3, y - 8, 6, 2); ctx.fillStyle = '#4a7a3a'; ctx.fillRect(x - 2, y - 9, 1, 1); ctx.fillRect(x + 2, y - 9, 1, 1); }
      for (const p of smoke) { ctx.globalAlpha = 0.35 * (1 - p.t / 4); ctx.fillStyle = '#c8ccc0'; const r = 2 + Math.floor(p.t * 1.5); ctx.fillRect(Math.round(p.x - cam.x) - r, Math.round(p.y - cam.y) - r, r * 2, r); } ctx.globalAlpha = 1;
      // cloths held to the face
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || q.age < 8 || Math.abs(a.x - P.x) > 420 || Math.abs(a.y - P.y) > 300) continue; if (O.occluded && O.occluded(a.x, a.y)) continue; if (a.dir === 3) continue; const x = Math.round(a.x - cam.x) + (a.dir === 1 ? -3 : a.dir === 2 ? 2 : -2), y = Math.round(a.y - cam.y) - (a.lift || 0) - (q.age < 13 ? 20 : 26); ctx.fillStyle = q.id % 3 ? '#ece8dc' : '#7aa060'; ctx.fillRect(x, y, 4, 3); ctx.fillStyle = '#d8c8a8'; ctx.fillRect(x + (a.dir === 1 ? 3 : 0), y + 2, 1, 2); }
      // the parish bread on the steps of marked houses
      const sick = new Set(s.people.filter((p) => p.health && p.health.illness?.kind === 'pestilence').map((p) => p.home));
      for (const b of s.world.buildings) { if (!sick.has(b.id) || b.doorX == null) continue; const x = Math.round(b.doorX * 16 + 8 - cam.x), y = Math.round((b.doorY + 1) * 16 + 4 - cam.y); if (x < -20 || y < -20 || x > ctx.canvas.width + 20 || y > ctx.canvas.height + 20) continue; ctx.fillStyle = '#c89a5a'; ctx.fillRect(x + 4, y - 3, 4, 3); ctx.fillStyle = '#a87a40'; ctx.fillRect(x + 4, y - 1, 4, 1); }
    });
    O.PlagueTown = { fires: () => fires(cur()) };
  }
  O.PlagueTownSetup = { setup };
})();
