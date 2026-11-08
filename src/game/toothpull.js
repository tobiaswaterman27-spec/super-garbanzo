// The barber draws a tooth. Now and then a sufferer with a swollen jaw comes to the barber, who sets a
// stool outside his door in the light, sits them on it, and goes in with the pincers while a few idlers
// gather to watch; there's a howl, a struggle, a heave, and up comes the tooth, held high for the
// crowd, who cheer. The patient goes off holding their jaw, a penny lighter.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let J = null, cool = 30, pulled = 0, why = '';
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const say = (q, t, d) => q && q.agent && near(q.agent.x, q.agent.y, 300) && O.Speech && O.Speech.say(q, t, d || 2.2);
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._tooth && !talking(q);
    function endJob() { if (!J) return; for (const q of [J.barber, J.pt, ...J.watch]) { if (!q || !q.agent) continue; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._tooth = false; } J = null; }
    function send(s, q, tx, ty, face, then) { q._tooth = true; O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.2, face, giveUp: game.t + 45, after: (ok) => { if (!ok || !q.agent || !J) { q._tooth = false; return; } q.agent.frozen = true; q.agent.path = null; q.agent.dir = face; then && then(); } }); }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return;
      if (J) { const j = J; j.t += dt; if (j.s !== s || j.t > 90 || s.raining || [j.barber, j.pt].some((q) => q.alive === false || talking(q))) { endJob(); return; }
        if (j.ready >= 2 && !j.go) { j.go = true; j.t0 = j.t; say(j.barber, pick(['Open wide. Wider.', 'Sit still and think of the Lord.', 'This won\'t hurt. Much.'])); }
        if (j.go) { const k = j.t - j.t0, b = j.barber.agent, p = j.pt.agent;
          b.forceAnim = k < 4 ? 'look' : k < 9 ? (Math.floor(k * 3) % 2 ? 'pickup' : 'take') : k < 12 ? 'celebrate' : 'idle';
          p.forceAnim = k < 4 ? 'sit' : k < 9 ? (Math.floor(k * 5) % 2 ? 'hurt' : 'shocked') : k < 12 ? 'hurt' : 'wipe'; p.x = j.sx + (k > 4 && k < 9 ? Math.sin(k * 20) * 1.5 : 0);
          if (k > 5 && !j.yell) { j.yell = 1; say(j.pt, pick(['AAAARGH!', 'Mmmph! MMMPH!', 'Ow ow ow OW!']), 2); if (near(p.x, p.y, 300)) O.sfx && O.sfx('hurt', 0.25); }
          if (k > 9 && !j.out) { j.out = 1; pulled++; j.tooth = { x: b.x, y: b.y - 34 }; say(j.barber, pick(['There she is! Rotten to the root!', 'Look at that! A beauty!']), 2.4); for (const w of j.watch) { if (w.agent) { w.agent.forceAnim = 'celebrate'; } } setTimeout(() => j.watch[0] && say(j.watch[0], pick(['Huzzah!', 'Ha! He went white as a sheet!', 'Better you than me.']), 2), 900); try { const hp = s.household(j.pt), hb = s.household(j.barber); if (hp && hb && hp !== hb && hp.money >= 1) { hp.money -= 1; hb.money += 1; } } catch (e) { /* */ } }
          if (k > 9 && k < 12) for (const w of j.watch) if (w.agent) w.agent.forceAnim = Math.floor(k * 4) % 2 ? 'celebrate' : 'laugh';
          if (k > 14) { say(j.pt, pick(['Ohh, my jaw...', 'Never again.', 'Thank you. I think.']), 2); endJob(); } }
        else for (const w of j.watch) if (w.agent && w.agent.frozen) w.agent.forceAnim = 'look';
        return; }
      cool -= dt; if (cool > 0) return; cool = 60 + Math.random() * 60;
      const hr = s.minute / 60; if (hr < 9 || hr > 16 || s.raining) { why = 'hour'; return; }
      const P = game.player, bz = [...s.biz.values()].find((z) => z.type === 'barber' && (z.workers || []).length); if (!bz) { why = 'no barber'; return; } const b = s.building(bz.b?.id ?? bz.id); if (!b || b.doorX == null || Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) > 600) { why = 'far'; return; }
      const barber = bz.workers.map((id) => s.byId.get(id)).find(free); if (!barber) { why = 'barber busy'; return; }
      const pt = s.people.find((x) => free(x) && x !== barber && x.age >= 16 && x.agent && !x.agent.hidden && x.agent.inside == null && ['stroll', 'idle', 'socialise', 'wait-work', 'shop', 'market', 'home', 'pastime-none'].includes(x.activity?.act) && Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) < 700); if (!pt) { why = 'no patient'; cool = 20; return; }
      const sx = (b.doorX + 2) * T + 8, sy = (b.doorY + 2) * T + 8, w = s.world; if (w.solid[Math.floor(sy / T) * w.W + Math.floor(sx / T)]) { why = 'stool spot blocked'; return; }
      J = { s, b, barber, pt, watch: [], t: 0, ready: 0, sx, sy, go: false };
      if (barber.agent.inside != null) { barber.agent.x = b.doorX * T + 8; barber.agent.y = (b.doorY + 1) * T + 8; barber.agent.inside = null; barber.agent.hidden = false; }
      say(pt, pick(['Barber! My tooth! I can\'t bear it another day!', 'It\'s this one at the back. Pull it, for pity\'s sake.']), 2.6);
      send(s, barber, Math.floor(sx / T) + 1, Math.floor(sy / T), 1, () => { J && J.ready++; });
      send(s, pt, Math.floor(sx / T), Math.floor(sy / T), 0, () => { if (!J) return; J.ready++; pt.agent.x = sx; pt.agent.y = sy; });
      const lookers = s.people.filter((x) => free(x) && x !== barber && x !== pt && x.agent && !x.agent.hidden && x.agent.inside == null && x.age >= 8 && ['stroll', 'idle', 'socialise', 'play', 'shop', 'market', 'wait-work'].includes(x.activity?.act) && Math.hypot(x.agent.x - sx, x.agent.y - sy) < 480).slice(0, 3);
      lookers.forEach((x, i) => { J.watch.push(x); send(s, x, Math.floor(sx / T) - 2 + i * 2, Math.floor(sy / T) + 2, 3); });
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene || !J || J.s !== s) return; const x = Math.round(J.sx - cam.x), y = Math.round(J.sy - cam.y);
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 6, y - 7, 12, 3); ctx.fillRect(x - 5, y - 4, 2, 5); ctx.fillRect(x + 3, y - 4, 2, 5);
      if (J.go) { const b = J.barber.agent, k = J.t - J.t0; if (k > 4 && k < 12) { ctx.fillStyle = '#8a8a90'; const px = Math.round(b.x - 6 - cam.x), py = Math.round(b.y - 22 - cam.y); ctx.fillRect(px, py, 5, 1); ctx.fillRect(px, py + 2, 5, 1); } if (J.tooth && k < 14) { ctx.fillStyle = '#f0ecd8'; const tx = Math.round(b.x + 4 - cam.x), ty = Math.round(b.y - 38 - cam.y); ctx.fillRect(tx, ty, 3, 3); ctx.fillRect(tx, ty + 3, 1, 2); ctx.fillRect(tx + 2, ty + 3, 1, 2); } }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!J || !q._tooth) return ''; if (q === J.barber) return 'You are the barber, about to draw a bad tooth outside your shop with the pincers while folk watch.'; if (q === J.pt) return J.out ? 'You have just had a tooth pulled by the barber in the street. Your jaw throbs and you can hardly talk.' : 'You have a raging toothache and the barber is about to pull the tooth, here in the street. You are terrified.'; return 'You are watching the barber pull a tooth in the street, for the fun of it.'; });
    O.ToothPull = { get why() { return why; }, get job() { return J; }, get pulled() { return pulled; }, soon: () => { cool = 0; } };
  }
  O.ToothPullSetup = { setup };
})();
