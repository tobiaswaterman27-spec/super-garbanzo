// The seasons, seen. In winter everyone's breath smokes in the cold air and folk stamp and blow on
// their hands. In autumn leaves come spinning down and drift into heaps by the walls; someone rakes
// them up, and children charge through the heaps and send them flying. In spring blossom petals blow
// along the street, and on fine days in spring and summer butterflies wander over the grass.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const puffs = [], drift = [], heaps = [], flies = [];
    let rk = 10;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const P = game.player, season = s.season, day = !(game.isNight && game.isNight()), cold = season === 'winter' || (s.weather && /snow|frost|blizzard/.test(s.weather.kind || ''));
      // breath
      if (cold) for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || !near(a.x, a.y, 330)) continue; if (Math.random() < dt * (a.anim === 'run' ? 1.6 : 0.6)) puffs.push({ x: a.x + (a.dir === 1 ? -4 : a.dir === 2 ? 4 : 0), y: a.y - (q.age < 13 ? 16 : 22), t: 0, vx: (a.dir === 1 ? -6 : a.dir === 2 ? 6 : 0) + (Math.random() - 0.5) * 4 }); if (Math.random() < dt * 0.02 && !a.frozen && !a.path) O.gesture && O.gesture(q, pick(['shake', 'wipe']), 1.2); }
      if (cold && Math.random() < dt * 0.7) puffs.push({ x: P.x + (P.dir === 1 ? -4 : 4), y: P.y - 22, t: 0, vx: (Math.random() - 0.5) * 4 });
      for (const p of puffs.slice()) { p.t += dt; p.x += p.vx * dt; p.y -= 6 * dt; if (p.t > 1.1) puffs.splice(puffs.indexOf(p), 1); }
      // drifting leaves and petals
      const kind = season === 'autumn' ? 'leaf' : season === 'spring' && day ? 'petal' : null;
      if (kind && drift.length < (kind === 'leaf' ? 26 : 16) && Math.random() < dt * (kind === 'leaf' ? 5 : 3)) drift.push({ x: P.x - 320 + Math.random() * 200, y: P.y - 220 + Math.random() * 400, vx: 18 + Math.random() * 20, vy: 6 + Math.random() * 8, t: 0, ph: Math.random() * 6, c: kind === 'leaf' ? pick(['#c86a2a', '#d8a030', '#a04a20', '#b88a3a']) : pick(['#f8d8e0', '#ffffff', '#f0c8d8']), kind });
      for (const d of drift.slice()) { d.t += dt; d.x += (d.vx + Math.sin(d.t * 2 + d.ph) * 14) * dt; d.y += (d.vy + Math.cos(d.t * 3 + d.ph) * 6) * dt; if (d.t > 12 || !near(d.x, d.y, 700) || !kind) drift.splice(drift.indexOf(d), 1); }
      // leaf heaps by the walls in autumn
      if (season === 'autumn' && heaps.length < 6 && Math.random() < dt * 0.8) { const x = P.x + (Math.random() - 0.5) * 500, y = P.y + (Math.random() - 0.5) * 340; if (!game.solidAt(x, y - 1) && game.solidAt(x, y - 18)) heaps.push({ x, y, n: 10, scat: [] }); }
      if (season !== 'autumn') heaps.length = 0;
      for (const h of heaps.slice()) { for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || q.age >= 13 || a.anim !== 'run') continue; if (Math.hypot(a.x - h.x, a.y - h.y) < 10 && h.n > 0) { for (let i = 0; i < 8; i++) h.scat.push({ x: h.x, y: h.y - 2, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 40, t: 0, c: pick(['#c86a2a', '#d8a030', '#a04a20']) }); h.n = Math.max(0, h.n - 5); if (Math.random() < 0.4) O.Speech && O.Speech.say(q, pick(['Wheee!', 'Crunch!', 'Leaves!']), 1.2); } }
        for (const l of h.scat.slice()) { l.t += dt; l.x += l.vx * dt; l.y += l.vy * dt; l.vy += 60 * dt; l.vx *= 1 - dt; if (l.t > 1.2) h.scat.splice(h.scat.indexOf(l), 1); } if (h.n <= 0 && !h.scat.length) heaps.splice(heaps.indexOf(h), 1); }
      // someone rakes
      rk -= dt; if (rk <= 0 && season === 'autumn' && day && O.Errands) { rk = 40 + Math.random() * 40; const h = heaps.find((x) => x.n < 10); const q = h && s.people.find((x) => x.age >= 14 && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && Math.hypot(x.agent.x - h.x, x.agent.y - h.y) < 160); if (q) O.Errands.send(s, q, [Math.floor(h.x / T), Math.floor(h.y / T)], { anim: 'sweep', secs: 6, face: 0, giveUp: game.t + 40, after: (ok) => { if (ok) h.n = 12; } }); }
      // butterflies
      const bfly = day && (season === 'summer' || season === 'spring') && !s.raining;
      if (bfly && flies.length < 6 && Math.random() < dt * 0.4) { const x = P.x + (Math.random() - 0.5) * 520, y = P.y + (Math.random() - 0.5) * 360; const w = s.world, tx = Math.floor(x / T), ty = Math.floor(y / T); if (!w.solid[ty * w.W + tx]) flies.push({ x, y, t: 0, c: pick(['#f0e060', '#ffffff', '#e8a040', '#a0c0f0']), ph: Math.random() * 6, life: 15 + Math.random() * 15 }); }
      for (const f of flies.slice()) { f.t += dt; f.x += Math.sin(f.t * 1.3 + f.ph) * 22 * dt; f.y += Math.cos(f.t * 0.9 + f.ph) * 14 * dt; if (f.t > f.life || !bfly) flies.splice(flies.indexOf(f), 1); }
    });
    game.hooks.drawGround.push((ctx, cam) => { if (game.scene) return; for (const h of heaps) { const x = Math.round(h.x - cam.x), y = Math.round(h.y - cam.y); for (let i = 0; i < h.n; i++) { ctx.fillStyle = ['#c86a2a', '#d8a030', '#a04a20', '#b88a3a'][i % 4]; ctx.fillRect(x - 6 + ((i * 7) % 12), y - 2 - ((i * 3) % 4), 2, 1); } } });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return;
      for (const p of puffs) { ctx.globalAlpha = 0.55 * (1 - p.t / 1.1); ctx.fillStyle = '#f0f4f8'; const r = 1 + Math.floor(p.t * 2.5); ctx.fillRect(Math.round(p.x - cam.x) - Math.floor(r / 2), Math.round(p.y - cam.y) - Math.floor(r / 2), r, r); } ctx.globalAlpha = 1;
      for (const d of drift) { ctx.fillStyle = d.c; const f = Math.floor(d.t * 6 + d.ph) % 2; ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y), f ? 2 : 1, f ? 1 : 2); }
      for (const h of heaps) for (const l of h.scat) { ctx.fillStyle = l.c; ctx.fillRect(Math.round(l.x - cam.x), Math.round(l.y - cam.y), 2, 1); }
      for (const f of flies) { const x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y), w = Math.floor(f.t * 10) % 2; ctx.fillStyle = f.c; ctx.fillRect(x - (w ? 2 : 1), y, w ? 2 : 1, 2); ctx.fillRect(x + 1, y, w ? 2 : 1, 2); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x, y, 1, 2); }
    });
    O.SeasonsFx = { puffs, drift, heaps, flies };
  }
  O.SeasonsFxSetup = { setup };
})();
