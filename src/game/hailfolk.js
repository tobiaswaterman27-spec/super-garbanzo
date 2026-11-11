// Hail. When it comes rattling down, folk out of doors don't stroll: they throw their arms over their heads
// or hold a basket or a sack up for a roof and run for the nearest door, yelping as it stings; and when it
// stops, the children are out at once, scooping up the white pellets from the gutters, comparing sizes, and
// throwing them at each other.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let was = false, acc = 0, ran = 0, after = 0, gathered = 0; const ducked = new Set();
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene || !s.weather) return; const hail = s.weather.kind === 'hail'; acc += dt;
      if (hail) { if (acc < 0.6) return; acc = 0; ducked.forEach((id) => { const q = s.byId.get(id); if (q && q.agent && !q.errand) ducked.delete(id); });
        // those out of doors cover their heads and run for the nearest door
        let n = 0; for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || q.errand || talking(q) || ducked.has(q.id) || !near(a.x, a.y, 420)) continue; if (++n > 4) break;
          let best = null, bd = 1e9; for (const b of s.world.buildings) { if (b.doorX == null) continue; const d = Math.hypot(b.doorX * T - a.x, b.doorY * T - a.y); if (d < bd) { bd = d; best = b; } } if (!best || bd > 260) continue;
          ducked.add(q.id); ran++; O.Errands.send(s, q, [best.doorX, best.doorY + 1], { anim: 'block', secs: 3, face: 3, sprint: true, giveUp: game.t + 15 }); if (Math.random() < 0.25) O.Speech && O.Speech.say(q, pick(['Ow! Ow! It stings!', 'Hail! Get in, get in!', 'God\'s teeth, it\'s like stones!']), 1.6); }
        was = true; return; }
      // when it stops, the children are out after the hailstones
      if (was) { was = false; after = 25; ducked.clear(); const kids = s.people.filter((q) => q.age >= 5 && q.age <= 12 && q.agent && !q.agent.frozen && !q.errand && !talking(q) && (q.agent.inside == null ? near(q.agent.x, q.agent.y, 360) : (() => { const b = s.building(q.agent.inside); return b && b.doorX != null && b.type === 'house' && near(b.doorX * T, b.doorY * T, 360); })())).slice(0, 4);
        kids.forEach((q, i) => { const a = q.agent; if (a.inside != null) { const b = s.building(a.inside); a.inside = null; a.hidden = false; a.x = b.doorX * T + 8; a.y = (b.doorY + 1) * T + 8; } const tx = Math.floor(a.x / T) + Math.round((Math.random() - 0.5) * 6), ty = Math.floor(a.y / T) + 1 + Math.round(Math.random() * 3); gathered++;
          O.Errands.send(s, q, [tx, ty], { anim: 'pickup', secs: 2.5, face: 0, sprint: true, giveUp: game.t + 20, after: (ok) => { if (!ok) return; O.gesture && O.gesture(q, i % 2 ? 'celebrate' : 'attack', 1.2); if (i === 0 && near(q.agent.x, q.agent.y, 300)) O.Speech && O.Speech.say(q, pick(['Look at this one! Big as a pea!', 'They\'re cold! Feel!', 'Hailstone fight!']), 2); } }); }); }
      if (after > 0) after -= dt; });
    // the white pellets lying in the gutters for a while after
    game.hooks.drawGround.push((ctx, cam) => { const s = cur(); if (!s || game.scene || !(after > 0 || (s.weather && s.weather.kind === 'hail'))) return; const W = ctx.canvas.width, H = ctx.canvas.height, k = s.weather.kind === 'hail' ? 1 : Math.max(0, after / 25);
      ctx.fillStyle = `rgba(240,244,248,${0.8 * k})`; const ox = Math.floor(cam.x / 7), oy = Math.floor(cam.y / 7); for (let gy = 0; gy < H / 7 + 1; gy++) for (let gx = 0; gx < W / 7 + 1; gx++) { const h = ((gx + ox) * 73856093 ^ (gy + oy) * 19349663) >>> 0; if (h % 9) continue; ctx.fillRect(Math.round((gx + ox) * 7 - cam.x + (h % 5)), Math.round((gy + oy) * 7 - cam.y + ((h >> 3) % 5)), 1, 1); } });
    O.HailFolk = { get ran() { return ran; }, get gathered() { return gathered; } };
  }
  O.HailFolkSetup = { setup };
})();
