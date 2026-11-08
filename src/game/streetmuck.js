// The streets are not clean. Where horses go they leave their droppings, steaming on a cold morning; the
// flies find them by noon; and the council's sweeper (or, with no sweeper, a gardener who wants it for
// the beds) comes along with a shovel and a barrow and scoops them up.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const heaps = []; let t = 0, cool = 10, scooped = 0; const lastAt = new WeakMap();
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    function drop(s, x, y) { if (heaps.filter((h) => h.s === s).length > 30) return; const w = s.world, tx = Math.floor(x / T), ty = Math.floor(y / T); const tr = w.ter[ty * w.W + tx]; if (tr === w.TER.WATER || tr === w.TER.BRIDGE) return; heaps.push({ s, x: x + (Math.random() - 0.5) * 6, y: y + 2, born: s.day * 1440 + s.minute, seed: Math.floor(Math.random() * 1000) }); }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; t += dt;
      if (t > 1) { t = 0;
        // horses (ridden, walking, in harness) leave their mark now and then
        const mounts = []; for (const h of (O.horsesAll ? O.horsesAll() : [])) if ((h.world || 'ashford') === s.world.placeId && !h.stabled) mounts.push(h); for (const q of s.people) if (q.agent && q.agent.mount && !q.agent.hidden) mounts.push(q.agent);
        for (const m of mounts) { const last = lastAt.get(m); const moved = last ? Math.hypot(m.x - last[0], m.y - last[1]) : 0; lastAt.set(m, [m.x, m.y]); if (moved > 4 && Math.random() < 0.012) drop(s, m.x - 6, m.y); }
        // old ones dry up and crumble away after a day or two
        const now = s.day * 1440 + s.minute; for (const h of heaps.slice()) if (h.s === s && now - h.born > 2400) heaps.splice(heaps.indexOf(h), 1);
      }
      // the sweeper's round
      cool -= dt; if (cool > 0) return; cool = 8 + Math.random() * 8;
      const hr = s.minute / 60; if (hr < 7 || hr > 18) return; const P = game.player, mine = heaps.filter((h) => h.s === s && !h.claimed && near(h.x, h.y, 500)); if (!mine.length) return;
      const h = mine.sort((a, b) => a.born - b.born)[0];
      const q = s.people.find((x) => x.job?.role === 'sweeper' && x.agent && x.activity?.act !== 'sleep' && !x.agent.frozen && !x.errand && !talking(x)) || s.people.find((x) => x.age >= 12 && x.age < 60 && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && !x._bit && !x._scene && !talking(x) && ['stroll', 'idle', 'socialise', 'wait-work', 'play'].includes(x.activity?.act) && Math.hypot(x.agent.x - h.x, x.agent.y - h.y) < 320);
      if (!q) return; h.claimed = q;
      O.Errands.send(s, q, [Math.floor(h.x / T), Math.floor(h.y / T)], { anim: 'dig', secs: 1.6, face: 0, giveUp: game.t + 50, after: (ok) => { h.claimed = null; if (!ok) return; const i = heaps.indexOf(h); if (i >= 0) heaps.splice(i, 1); scooped++; if (near(q.agent.x, q.agent.y, 200)) { O.sfx && O.sfx('dig', 0.1); if (Math.random() < 0.3) O.Speech && O.Speech.say(q, q.job?.role === 'sweeper' ? pick(['Another one. Lovely.', 'Somebody\'s horse ate well.', 'Mind your feet!']) : pick(['Good for the cabbages, this.', 'Waste not.']), 2.2); } } });
    });
    game.hooks.drawGround.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const now = s.day * 1440 + s.minute, tk = performance.now() / 1000, cold = s.season === 'winter' || s.minute < 8 * 60;
      for (const h of heaps) { if (h.s !== s) continue; const x = Math.round(h.x - cam.x), y = Math.round(h.y - cam.y); if (x < -10 || y < -10 || x > ctx.canvas.width + 10 || y > ctx.canvas.height + 10) continue; const age = now - h.born, dry = age > 900;
        ctx.fillStyle = dry ? '#7a6a4a' : '#5a4428'; ctx.fillRect(x - 2, y - 1, 5, 2); ctx.fillRect(x - 1, y - 2, 3, 1); ctx.fillStyle = dry ? '#8a7a5a' : '#6a5030'; ctx.fillRect(x + 2, y, 2, 1);
        if (!dry && cold && age < 60) { const k = (tk * 0.7 + h.seed) % 1; ctx.globalAlpha = 0.3 * (1 - k); ctx.fillStyle = '#e8e8ec'; ctx.fillRect(x + Math.round(Math.sin(tk + h.seed) * 1.5), y - 3 - Math.round(k * 6), 1, 2); ctx.globalAlpha = 1; }
        if (age > 120 && !dry && s.season !== 'winter') { ctx.fillStyle = '#1a1a1a'; for (let i = 0; i < 2; i++) { const a = tk * (5 + i) + h.seed + i * 2; ctx.fillRect(Math.round(x + Math.cos(a) * 4), Math.round(y - 4 + Math.sin(a * 1.3) * 2), 1, 1); } } }
    });
    O.StreetMuck = { heaps, get scooped() { return scooped; }, drop: (x, y) => drop(cur(), x, y) };
  }
  O.StreetMuckSetup = { setup };
})();
