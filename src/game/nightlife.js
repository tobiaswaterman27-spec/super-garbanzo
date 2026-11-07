// The night has its own life. At dusk bats come out and flicker round the roofs; moths dance round
// every lit lantern; on summer nights fireflies wink in the grass at the town's edge, and an owl calls.
// The watch walk their rounds with a lantern swinging, a pool of light going with them. And now and
// then someone hurries through the dark with a lantern on an errand that won't wait: the midwife
// called to a birth, the priest with his little bell going to the dying, a father running for the
// physician; a dog barks as they pass.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const isWatch = (q) => /guard|sergeant|watch|captain|constable/.test(q.job?.role || '');
    const night = () => game.isNight && game.isNight();
    const bats = [], flies = [], lanterns = new Set(); let owl = 20, runner = null, rcool = 15, lastHr = -1;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const h = s.minute / 60, P = game.player;
      // bats at dusk and early night
      const batTime = (h >= 19.3 && h < 23) || (h >= 4.5 && h < 5.6);
      if (batTime && bats.length < 6 && Math.random() < dt * 0.5) bats.push({ x: P.x + (Math.random() - 0.5) * 500, y: P.y - 80 - Math.random() * 150, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 40, t: 0, life: 15 + Math.random() * 20 });
      for (const b of bats.slice()) { b.t += dt; b.vx += (Math.random() - 0.5) * 300 * dt; b.vy += (Math.random() - 0.5) * 200 * dt; const sp = Math.hypot(b.vx, b.vy); if (sp > 90) { b.vx *= 90 / sp; b.vy *= 90 / sp; } b.x += b.vx * dt; b.y += b.vy * dt; if (b.t > b.life || !batTime || !near(b.x, b.y, 700)) bats.splice(bats.indexOf(b), 1); }
      // fireflies in summer
      const ffTime = night() && (s.season === 'summer' || s.season === 'spring') && !s.raining;
      if (ffTime && flies.length < 18 && Math.random() < dt * 2) { const x = P.x + (Math.random() - 0.5) * 520, y = P.y + (Math.random() - 0.5) * 360; const tx = Math.floor(x / T), ty = Math.floor(y / T), w = s.world; if (!w.solid[ty * w.W + tx] && (!w.ter || w.ter[ty * w.W + tx] !== (w.TER && w.TER.ROAD))) flies.push({ x, y, t: Math.random() * 6, life: 8 + Math.random() * 10, ph: Math.random() * 6 }); }
      for (const f of flies.slice()) { f.t += dt; f.x += Math.sin(f.t * 0.7 + f.ph) * 6 * dt; f.y += Math.cos(f.t * 0.9 + f.ph) * 4 * dt; if (f.t > f.life || !ffTime) flies.splice(flies.indexOf(f), 1); }
      // an owl
      if (night()) { owl -= dt; if (owl <= 0) { owl = 30 + Math.random() * 60; O.animalCall && O.animalCall('owl', 0.35); } }
      // the watch call the hours
      const hr = Math.floor(h); if (night() && hr !== lastHr) { const first = lastHr < 0; lastHr = hr; if (!first) { const w = s.people.filter((q) => isWatch(q) && q.agent && !q.agent.hidden && q.agent.inside == null).sort((a, b) => Math.hypot(a.agent.x - P.x, a.agent.y - P.y) - Math.hypot(b.agent.x - P.x, b.agent.y - P.y))[0]; if (w && near(w.agent.x, w.agent.y, 450)) { const N = ['Twelve', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven'][hr % 12]; say(w, pick([`${N} o'clock, and all's well!`, `${N} o'clock! A fine${s.raining ? ', wet' : ''} night, and all's well!`, `${N} o'clock! Look to your fires and candles!`]), 3); O.gesture && O.gesture(w, 'ringbell', 2); } } } else if (!night()) lastHr = -1;
      // the watch carry lanterns
      lanterns.clear(); if (night()) for (const q of s.people) if (isWatch(q) && q.agent && !q.agent.hidden && q.agent.inside == null && near(q.agent.x, q.agent.y, 600)) lanterns.add(q);
      // a night errand
      if (runner) { const r = runner; r.t += dt; if (!r.q.errand || r.q.alive === false || r.t > 90) { lanterns.delete(r.q); runner = null; } else { lanterns.add(r.q); if (r.kind === 'priest' && near(r.q.agent.x, r.q.agent.y, 300)) { r.bell = (r.bell || 0) - dt; if (r.bell <= 0) { r.bell = 2; O.sfx && O.sfx('handbell', 0.08); } } if (Math.random() < dt * 0.3) for (const q of s.people) if (q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && Math.hypot(q.agent.x - r.q.agent.x, q.agent.y - r.q.agent.y) < 60 && !q.errand && q !== r.q) O.gesture && O.gesture(q, r.kind === 'priest' ? 'pray' : 'look', 2); } }
      else if (night() && h > 21.5 || h < 4) { rcool -= dt; if (rcool <= 0 && O.Errands) { rcool = 90 + Math.random() * 120; const kind = pick(['midwife', 'priest', 'physician']);
          const role = { midwife: /midwife|nurse/, priest: /priest|friar|chaplain/, physician: /physician|doctor|apothecary/ }[kind]; let q = s.people.find((x) => role.test(x.job?.role || '') && x.alive !== false && x.agent && !x.errand && !x._scene);
          if (kind === 'physician' && Math.random() < 0.5) q = s.people.find((x) => x.age >= 20 && x.age < 50 && x.sex === 'm' && x.alive !== false && x.agent && !x.errand && near(x.agent.x, x.agent.y, 600)) || q;
          const homes = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && near(b.doorX * T, b.doorY * T, 520)); const b = pick(homes);
          if (q && b && q.agent) { if (q.agent.inside != null) { const from = s.building(q.agent.inside); if (from && from.doorX != null) { q.agent.x = from.doorX * T + 8; q.agent.y = (from.doorY + 1) * T + 8; } q.agent.inside = null; q.agent.hidden = false; }
            O.Errands.send(s, q, [b.doorX, b.doorY + 1], { sprint: true, anim: kind === 'priest' ? 'pray' : 'open', secs: 2, face: 0, giveUp: game.t + 80, at: () => { if (O.sfx && near(q.agent.x, q.agent.y, 300)) O.sfx('door', 0.4); }, after: () => { if (q.agent) { q.agent.inside = b.id; q.agent.hidden = true; } } });
            runner = { q, kind, t: 0 }; if (Math.random() < 0.6) setTimeout(() => say(q, kind === 'midwife' ? 'Hot water, and plenty of it!' : kind === 'priest' ? 'Make way. I go to the dying.' : 'The physician! Where\'s the physician?', 2.2), 800); if (Math.random() < 0.5) setTimeout(() => O.animalCall && O.animalCall('dog', 0.3), 1500); } } }
    });
    // light and drawing
    // homes where people are still up show a glow at the shutters and door
    (O.extraLights = O.extraLights || []).push((pools, cam) => { const s = cur(); if (!s || !game.lit) return; const h = s.minute / 60; if (h > 23.5 || h < 4.5) return; let n = 0; for (const b of s.world.buildings) { if (n > 40 || !game.lit.has(b.id) || b.doorX == null || ['smithy', 'bakery', 'armourer', 'tavern'].includes(b.type)) continue; const x = b.doorX * 16 + 8 - cam.x, y = b.doorY * 16 + 4 - cam.y; if (x < -40 || y < -40 || x > game.vw + 40 || y > game.vh + 40) continue; pools.push([x, y, 16]); n++; } });
    (O.extraLights = O.extraLights || []).push((pools, cam) => { for (const q of lanterns) { const a = q.agent; pools.push([a.x + 6 - cam.x, a.y - 14 - cam.y, 26]); } });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; const s = cur(); const tk = performance.now() / 1000;
      for (const q of lanterns) { const a = q.agent, x = Math.round(a.x - cam.x) + (a.dir === 1 ? -7 : 6), y = Math.round(a.y - cam.y) - 12 + Math.round(Math.sin(tk * 6 + q.id) * 1); ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 1, y - 5, 4, 1); ctx.fillRect(x - 1, y - 4, 1, 4); ctx.fillRect(x + 2, y - 4, 1, 4); ctx.fillStyle = Math.floor(tk * 8) % 3 ? '#ffc050' : '#ffa830'; ctx.fillRect(x, y - 4, 2, 4); }
      for (const b of bats) { const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y), f = Math.floor(b.t * 16) % 2; ctx.fillStyle = '#1a1418'; ctx.fillRect(x, y, 2, 1); ctx.fillRect(x - 2, y - f, 2, 1); ctx.fillRect(x + 2, y - f, 2, 1); }
      for (const f of flies) { const on = Math.sin(f.t * 3 + f.ph) > 0.3; if (!on) continue; ctx.fillStyle = 'rgba(220,255,140,0.9)'; ctx.fillRect(Math.round(f.x - cam.x), Math.round(f.y - cam.y), 1, 1); ctx.fillStyle = 'rgba(200,255,120,0.3)'; ctx.fillRect(Math.round(f.x - cam.x) - 1, Math.round(f.y - cam.y) - 1, 3, 3); }
      // moths round the lit lamps
      const L = s && s.world && s.world._lamps; if (L && night()) for (const l of L) if (l.lit) { for (let i = 0; i < 3; i++) { const a = tk * (2 + i) + i * 2, r = 4 + i * 2; ctx.fillStyle = 'rgba(240,230,210,0.8)'; ctx.fillRect(Math.round(l.x - cam.x + Math.cos(a) * r), Math.round(l.y - 28 - cam.y + Math.sin(a * 1.3) * r * 0.7), 1, 1); } }
    });
    O.NightLife = { bats, flies, lanterns, get runner() { return runner; } };
  }
  O.NightLifeSetup = { setup };
})();
