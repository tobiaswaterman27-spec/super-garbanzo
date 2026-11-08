// Hot days at the water. On a warm summer afternoon the children (and some of the lads) go down to the
// river or the pond and splash about in the shallows up to their waists, ducking each other, shrieking,
// throwing water, while a mother calls from the bank not to go out too far.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t) => O.Speech && O.Speech.say(q, t, 1.4);
    let swim = null, cool = 10; const drops = [];
    function shallows(s, near) { const w = s.world; if (!w.TER || !w.ter) return null; const water = (x, y) => w.ter[y * w.W + x] === w.TER.WATER; const px = Math.floor(near.x / T), py = Math.floor(near.y / T); let best = null, bd = 1e9;
      for (let y = py - 16; y < py + 16; y++) for (let x = px - 22; x < px + 22; x++) { if (x < 2 || y < 2 || x >= w.W - 2 || y >= w.H - 2 || !water(x, y)) continue; const bank = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => !water(x + dx, y + dy) && !w.solid[(y + dy) * w.W + x + dx]); if (!bank) continue; const d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = { tx: x, ty: y, bank: [x + bank[0], y + bank[1]] }; } } return best; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const h = s.minute / 60;
      for (const d of drops.slice()) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 90 * dt; if (d.t > 0.6) drops.splice(drops.indexOf(d), 1); }
      if (swim) { const sw = swim; sw.t += dt; const end = sw.s !== s || sw.t > 40 || h > 18 || s.raining;
        if (end) { for (const q of sw.ppl) { q._swim = false; q.agent.forceAnim = null; q.agent.frozen = false; const [bx, by] = sw.bank; q.agent.x = bx * T + 8; q.agent.y = by * T + 10; } swim = null; cool = 60; return; }
        sw.ppl.forEach((q, i) => { const a = q.agent; a.x = sw.c[0] + Math.cos(sw.t * 0.7 + i * 2) * 10 + (i - 1) * 6; a.y = sw.c[1] + Math.sin(sw.t * 0.9 + i) * 4; a.dir = Math.floor(sw.t * 0.5 + i) % 2 ? 1 : 2; a.forceAnim = Math.floor(sw.t * 1.5 + i) % 4 === 0 ? 'attack' : Math.floor(sw.t + i) % 3 === 0 ? 'celebrate' : 'wave'; if (a.forceAnim === 'attack' && Math.random() < dt * 4) for (let k = 0; k < 5; k++) drops.push({ x: a.x + (a.dir === 2 ? 6 : -6), y: a.y - 6, vx: (a.dir === 2 ? 1 : -1) * (20 + Math.random() * 30), vy: -40 - Math.random() * 30, t: 0 }); });
        if (Math.random() < dt * 0.15) say(pick(sw.ppl), pick(['It\'s freezing!', 'Ha! Got you!', 'Duck him!', 'Watch this!', 'Eeeee!']));
        return; }
      cool -= dt; if (cool > 0) return; cool = 15;
      const hot = s.season === 'summer' && h >= 13 && h < 17.5 && !s.raining && (!s.weather || !/rain|storm|fog/.test(s.weather.kind || ''));
      if (!hot) return; const P = game.player;
      const kids = s.people.filter((q) => q.age >= 7 && q.age <= 16 && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._playing && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 500).slice(0, 3);
      if (kids.length < 2) return; const sh = shallows(s, P); if (!sh) return;
      for (const q of kids) { q._swim = true; q.agent.frozen = true; q.agent.path = null; }
      swim = { s, ppl: kids, t: 0, c: [sh.tx * T + 8, sh.ty * T + 10], bank: sh.bank };
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; const tk = performance.now() / 1000;
      if (swim) for (const q of swim.ppl) { const a = q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); ctx.fillStyle = 'rgba(52,96,150,0.62)'; ctx.beginPath(); ctx.moveTo(x - 10, y + 1); for (let i = 0; i <= 10; i++) ctx.lineTo(x - 10 + i * 2, y - 9 + Math.sin(tk * 4 + i + q.id) * 0.8); ctx.lineTo(x + 10, y + 1); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(230,240,250,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(x, y - 9, 8 + Math.sin(tk * 3 + q.id) * 1.5, 2, 0, 0, Math.PI * 2); ctx.stroke(); }
      for (const d of drops) { ctx.fillStyle = 'rgba(220,235,250,0.9)'; ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y), 1, 2); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => q._swim ? 'You are splashing about in the river shallows on a hot afternoon, soaked and laughing.' : '');
    O.SummerPlay = { get swim() { return swim; } };
  }
  O.SummerPlaySetup = { setup };
})();
