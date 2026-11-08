// A windy day. When it blows, leaves and bits of straw go skittering along the ground and whirling up,
// a loose shutter bangs somewhere, people out of doors put their heads down and lean into it, and now
// and then somebody's cap is snatched off and goes bowling away down the street with them running after
// it, grabbing, missing, and finally stamping on it, to the great amusement of whoever's watching.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const bits = [], hats = []; let bang = 5, hatCool = 15, brace = 4, chases = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const windOf = (s) => { const W = s.weather || {}; return Math.max(W.wind || 0, W.kind === 'storm' ? 0.9 : 0); };
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) { bits.length = 0; return; }
      const wind = windOf(s), dirx = (s.weather && s.weather.windDir) || 1, P = game.player, vw = game.vw || 600, vh = game.vh || 400;
      // blown bits
      if (wind > 0.55 && bits.length < 60 && Math.random() < dt * wind * 30) { const se = s.season; bits.push({ x: P.x - dirx * (vw / 2 + 20), y: P.y - vh / 2 + Math.random() * vh, z: Math.random() * 6, vz: 0, t: 0, c: se === 'autumn' ? pick(['#c8781a', '#a8501a', '#d8a030']) : se === 'winter' ? '#e8eef4' : pick(['#c8b070', '#8a7a50', '#6a8a3a']), ph: Math.random() * 6 }); }
      for (const b of bits.slice()) { b.t += dt; b.x += dirx * (60 + wind * 80) * dt; b.y += Math.sin(b.t * 4 + b.ph) * 10 * dt; b.vz += (Math.random() - 0.45) * 60 * dt; b.vz -= 20 * dt; b.z = Math.max(0, Math.min(30, b.z + b.vz * dt)); if (b.z === 0 && b.vz < 0) b.vz = 0; if (Math.abs(b.x - P.x) > vw) bits.splice(bits.indexOf(b), 1); }
      if (wind < 0.55) return;
      // a shutter bangs
      bang -= dt; if (bang <= 0) { bang = 3 + Math.random() * (8 - wind * 5); O.sfx && O.sfx('smack', 0.08 + wind * 0.08); }
      // folk brace against it
      brace -= dt; if (brace <= 0) { brace = 3 + Math.random() * 4; const q = s.people.find((x) => x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && x.age >= 8 && near(x.agent.x, x.agent.y, 260) && Math.random() < 0.3); if (q) { O.gesture && O.gesture(q, pick(['shake', 'wipe', 'look']), 1.4); if (Math.random() < 0.35) O.Speech && O.Speech.say(q, pick(['Hold onto your hat!', 'It\'ll have the roof off!', 'Blowing a gale.', 'Brr! Right through you, this wind.']), 2.2); } }
      // a cap blown off
      for (const h of hats.slice()) { h.t += dt; if (!h.down) { h.x += dirx * (70 + wind * 60) * dt * (h.t < 2.5 ? 1 : 0.4); h.z = Math.abs(Math.sin(h.t * 5)) * 8 * Math.max(0, 1 - h.t / 3); h.spin += dt * 12; const w = s.world, tx = Math.floor(h.x / T), ty = Math.floor(h.y / T); if (h.t > 3.2 || (tx >= 0 && tx < w.W && w.solid[ty * w.W + tx])) { h.down = true; h.z = 0; h.x -= dirx * 4; } }
        const q = h.q, a = q.agent; if (!a || h.t > 30 || talking(q)) { hats.splice(hats.indexOf(h), 1); if (a) a.frozen = false; q._hat = false; continue; }
        if (h.down && !h.sent) { h.sent = true; O.Errands.send(s, q, [Math.floor(h.x / T), Math.floor(h.y / T)], { anim: 'pickup', secs: 0.8, face: 0, sprint: true, giveUp: game.t + 20, after: (ok) => { q._hat = false; hats.splice(hats.indexOf(h), 1); if (ok) { O.Speech && near(a.x, a.y, 280) && O.Speech.say(q, pick(['Got you, you devil!', 'Ha! Not today.', 'Covered in muck now.']), 2); const w = s.people.find((x) => x !== q && x.agent && !x.agent.hidden && x.agent.inside == null && Math.hypot(x.agent.x - a.x, x.agent.y - a.y) < 120); if (w) setTimeout(() => { O.gesture && O.gesture(w, 'laugh', 1.6); }, 600); } } }); }
      }
      hatCool -= dt; if (hatCool > 0 || hats.length) return; hatCool = 25 + Math.random() * 30;
      const q = s.people.find((x) => x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && !x._hat && !x._bit && !x._scene && x.age >= 10 && x.age < 70 && x.app && (x.app.hat || x.app.headwear || x.age > 0) && near(x.agent.x, x.agent.y, 220) && !talking(x));
      if (!q) return; q._hat = true; chases++;
      hats.push({ q, x: q.agent.x, y: q.agent.y, z: 20, t: 0, spin: 0, c: pick(['#5a3a2a', '#3a4a6a', '#6a2a2a', '#4a5a3a', '#c8b890']), down: false, sent: false });
      O.gesture && O.gesture(q, 'shocked', 1); O.Speech && O.Speech.say(q, pick(['My cap!', 'Oi! Come back!', 'Not again!']), 1.8);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      for (const b of bits) { const x = Math.round(b.x - cam.x), y = Math.round(b.y - b.z - cam.y), f = Math.floor(b.t * 8 + b.ph) % 3; ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x, Math.round(b.y - cam.y) + 1, 3, 1); ctx.fillStyle = b.c; ctx.fillRect(x, y, f === 1 ? 2 : 3, f === 2 ? 1 : 2); }
      for (const h of hats) { const x = Math.round(h.x - cam.x), y = Math.round(h.y - 4 - h.z - cam.y), flip = Math.floor(h.spin) % 2; ctx.fillStyle = h.c; if (flip) { ctx.fillRect(x - 3, y - 2, 6, 3); ctx.fillRect(x - 4, y + 1, 8, 1); } else { ctx.fillRect(x - 1, y - 3, 3, 6); } }
    });
    O.Windy = { bits, hats, get chases() { return chases; }, gust: () => { hatCool = 0; } };
  }
  O.WindySetup = { setup };
})();
