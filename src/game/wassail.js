// Wassailing. On winter evenings a little band of the young goes round the houses with a lantern on a pole,
// stops at each door and sings ("Wassail, wassail, all over the town!"), the notes going up into the cold
// air, and the door opens and the goodwife comes out with a bit of cake or a penny, or the goodman with a
// cup, and they cheer and go on to the next.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let W = null, cool = 30, doors = 0; const notes = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._wassail && !talking(q) && ((!q.agent.hidden && q.agent.inside == null) || q.agent.inside === q.home) && ['home', 'idle', 'stroll', 'socialise', 'play', 'pastime-none', 'rest'].includes(q.activity?.act);
    function end() { if (!W) return; for (const q of W.band) { const a = q.agent; if (!a) continue; a.forceAnim = null; if (!talking(q)) a.frozen = false; q._wassail = false; } if (W.host && W.host.agent) { W.host.agent.forceAnim = null; W.host.agent.frozen = false; W.host._wassail = false; } W = null; }
    function next() { const s = W.s, lead = W.band[0]; if (!W.stops.length) { end(); return; } const b = W.stops.shift(); W.b = b; W.phase = 'walk'; lead.agent.frozen = false;
      O.Errands.send(s, lead, [b.doorX, b.doorY + 2], { anim: 'idle', secs: 0.1, face: 3, giveUp: game.t + 60, after: (ok) => { if (!W) return; if (!ok) { next(); return; } lead.agent.frozen = true; lead.agent.path = null; W.phase = 'sing'; W.t = 0; } }); }
    game.hooks.update.push((dt) => {
      for (const n of notes.slice()) { n.t += dt; n.y -= 14 * dt; n.x += Math.sin(n.t * 3 + n.ph) * 6 * dt; if (n.t > 2.4) notes.splice(notes.indexOf(n), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (W) { W.t += dt; W.all += dt; const lead = W.band[0]; if (W.s !== s || !lead.agent || W.all > 300 || hr > 21.5 || s.raining || W.band.some(talking)) { end(); return; }
        // the others follow the lantern-bearer in a little huddle
        W.trail.push([lead.agent.x, lead.agent.y]); if (W.trail.length > 60) W.trail.shift();
        W.band.slice(1).forEach((q, i) => { const a = q.agent; a.frozen = true; a.path = null; const k = Math.max(0, W.trail.length - 1 - (i + 1) * 8), [tx, ty] = W.trail[k]; const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d > 1) { a.x += dx * Math.min(1, dt * 5); a.y += dy * Math.min(1, dt * 5); a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : dy > 0 ? 0 : 3; a.forceAnim = 'walk'; } else a.forceAnim = W.phase === 'sing' ? (Math.floor(W.t * 2 + i) % 3 ? 'talk' : 'celebrate') : 'idle'; });
        if (W.phase === 'sing') { lead.agent.forceAnim = 'talk'; lead.agent.dir = 3; for (const q of W.band.slice(1)) q.agent.dir = 3; if (Math.random() < dt * 4) notes.push({ x: lead.agent.x + (Math.random() - 0.5) * 30, y: lead.agent.y - 30, t: 0, ph: Math.random() * 6 });
          if (!W.sang && W.t > 0.5) { W.sang = true; near(lead.agent.x, lead.agent.y, 300) && O.Speech && O.Speech.say(lead, pick(['Wassail, wassail, all over the town!', 'Our toast it is white and our ale it is brown!', 'Here we come a-wassailing among the leaves so green!', 'Love and joy come to you, and to you your wassail too!']), 4); }
          if (W.t > 6 && !W.host && !W.gave) { W.gave = true; const h = s.people.find((x) => x.home === W.b.id && x.age >= 18 && x.agent && x.agent.inside === W.b.id && !x.agent.frozen && !x.errand && !talking(x)); if (h) { W.host = h; h._wassail = true; O.Errands.send(s, h, [W.b.doorX, W.b.doorY + 1], { anim: 'give', secs: 2, face: 0, giveUp: game.t + 15, after: () => { if (!W) { h._wassail = false; return; } near(h.agent.x, h.agent.y, 300) && O.Speech && O.Speech.say(h, pick(['Here, bless you all. A bit of cake.', 'A penny for the lantern, and God keep you.', 'Have a sup of this, it\'s cold out.']), 3); doors++; try { const hh = s.household(h); if (hh && hh.money >= 1) hh.money -= 1; } catch (e) { /* */ } setTimeout(() => { if (W) near(lead.agent.x, lead.agent.y, 300) && O.Speech && O.Speech.say(W.band[1] || lead, 'Hurrah! God bless this house!', 2); }, 1500); h._wassail = false; } }); } }
          if (W.t > 13) { W.sang = false; W.gave = false; W.host = null; next(); } }
        return; }
      cool -= dt; if (cool > 0) return; cool = 40 + Math.random() * 30;
      if (s.season !== 'winter' || hr < 17 || hr > 20.5 || s.raining) return;
      const P = game.player, young = s.people.filter((q) => free(q) && q.age >= 9 && q.age <= 22 && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 600); if (young.length < 3) return;
      const band = young.slice(0, 4), houses = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 500 && !band.some((q) => q.home === b.id)).sort(() => Math.random() - 0.5).slice(0, 4); if (houses.length < 2) return;
      for (const q of band) { q._wassail = true; if (q.agent.inside != null) { const hb = s.building(q.agent.inside); if (hb && hb.doorX != null) { q.agent.x = hb.doorX * T + 8; q.agent.y = (hb.doorY + 1) * T + 8; } q.agent.inside = null; q.agent.hidden = false; } }
      const lead = band[0]; W = { s, band, stops: houses, t: 0, all: 0, trail: [[lead.agent.x, lead.agent.y]], phase: 'walk' }; next();
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      if (W && W.s === s) { const a = W.band[0].agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 5, y - 14); ctx.lineTo(x + 7, y - 40); ctx.stroke(); ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x + 4, y - 44, 6, 6); ctx.fillStyle = Math.floor(performance.now() / 150) % 3 ? '#ffd27a' : '#ffe8a8'; ctx.fillRect(x + 5, y - 43, 4, 4); }
      ctx.fillStyle = '#f8f0c0'; for (const n of notes) { ctx.globalAlpha = Math.max(0, 1 - n.t / 2.4); const x = Math.round(n.x - cam.x), y = Math.round(n.y - cam.y); ctx.fillRect(x, y, 2, 2); ctx.fillRect(x + 1, y - 4, 1, 4); } ctx.globalAlpha = 1;
    });
    (O.extraLights = O.extraLights || []).push((pools, cam) => { if (W && W.s === cur()) { const a = W.band[0].agent; pools.push([a.x + 7 - cam.x, a.y - 40 - cam.y, 34]); } });
    (O.extraLines = O.extraLines || []).push((s, q) => W && W.band.includes(q) ? 'You are out wassailing with your friends, going door to door singing for cake and pennies in the cold.' : '');
    O.Wassail = { get band() { return W; }, get doors() { return doors; }, soon: () => { cool = 0; } };
  }
  O.WassailSetup = { setup };
})();
