// Grist to the mill. Through the day folk bring their corn to be ground: a sack of wheat on the shoulder
// carried to the mill door; the miller comes out, hefts it, takes his toll with the toll-dish (a scoop
// for himself, as is his right, and never a small one, they grumble), carries it in, and by and by
// hands back the flour, and they go home white to the elbows.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const jobs = []; let cool = 20, ground = 0; const dust = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._grist && !q._bit && !q._scene && !q._office && !talking(q);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._grist = false; }
    function drop(j) { rel(j.q); if (j.m) rel(j.m); jobs.splice(jobs.indexOf(j), 1); }
    game.hooks.update.push((dt) => {
      for (const d of dust.slice()) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; if (d.t > 1.2) dust.splice(dust.indexOf(d), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      for (const j of jobs.slice()) { j.t += dt; if (j.s !== s || j.t > 120 || talking(j.q) || (j.m && talking(j.m))) { drop(j); continue; } if (j.phase !== 'door') continue;
        j.k += dt; const qa = j.q.agent, ma = j.m.agent; qa.dir = 2; ma.dir = 1;
        // hand over the sack; the toll; in it goes; out comes the flour
        qa.forceAnim = j.k < 1.6 ? 'give' : j.k < 9 ? (Math.floor(j.k) % 4 === 0 ? 'look' : 'idle') : j.k < 10.6 ? 'take' : 'nod';
        ma.forceAnim = j.k < 1.6 ? 'take' : j.k < 4 ? 'pour' : j.k < 7.5 ? 'carry' : j.k < 9 ? 'idle' : j.k < 10.6 ? 'give' : 'nod';
        if (j.k > 1.6 && !j.toll) { j.toll = true; qa.carrying = null; ma.carrying = { good: 'wheat', qty: 1 }; if (near(qa.x, qa.y, 300)) { O.Speech && O.Speech.say(j.m, pick(['A fair toll, mind, as the law allows.', 'One dish for the mill. That\'s the custom.', 'Good dry corn, this. It\'ll grind sweet.']), 2.6); if (Math.random() < 0.5) setTimeout(() => O.Speech && O.Speech.say(j.q, pick(['A fair toll? That dish has a false bottom.', 'Every miller has a golden thumb, they say.', 'Don\'t heap it, now!']), 2.2), 2700); } }
        if (j.k > 2 && j.k < 4) for (let i = 0; i < 2; i++) dust.push({ x: ma.x - 6, y: ma.y - 14, vx: (Math.random() - 0.5) * 12, vy: -6 - Math.random() * 8, t: 0 });
        if (j.k > 9 && !j.back) { j.back = true; ma.carrying = { good: 'flour', qty: 1 }; for (let i = 0; i < 8; i++) dust.push({ x: ma.x, y: ma.y - 16, vx: (Math.random() - 0.5) * 18, vy: -8 - Math.random() * 8, t: 0 }); }
        if (j.k > 10.6 && !j.gone) { j.gone = true; ma.carrying = null; ground++; const q = j.q, hb = s.building(q.home); rel(j.m); j.m = null; rel(q); jobs.splice(jobs.indexOf(j), 1); try { const hh = s.household(q); if (hh && hh.pantry) hh.pantry.flour = (hh.pantry.flour || 0) + 2; } catch (e) { /* */ }
          if (hb && hb.doorX != null) O.Errands.send(s, q, [hb.doorX, hb.doorY + 1], { anim: 'place', secs: 1, face: 0, giveUp: game.t + 90, carry: { good: 'flour', qty: 2 } }); } }
      cool -= dt; if (cool > 0) return; cool = 70 + Math.random() * 80; if (hr < 8 || hr > 17 || jobs.length >= 2) return;
      for (const bz of s.biz.values()) { if (bz.type !== 'mill' || bz.open === false) continue; const b = s.building(bz.b?.id ?? bz.id); if (!b || b.doorX == null || !near(b.doorX * T, b.doorY * T, 460) || jobs.some((j) => j.b === b)) continue;
        const m = (bz.workers || []).concat(bz.owner != null ? [bz.owner] : []).map((id) => s.byId.get(id)).find((x) => able(x) && x.age >= 16); if (!m) continue;
        const q = s.people.filter((x) => able(x) && x.age >= 16 && !x.agent.hidden && x.agent.inside == null && !(bz.workers || []).includes(x.id) && Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) < 600).sort((x, y) => Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) - Math.hypot(y.agent.x - b.doorX * T, y.agent.y - b.doorY * T))[0]; if (!q) continue;
        const w = s.world, tx = w.solid[(b.doorY + 1) * w.W + b.doorX - 1] ? b.doorX + 1 : b.doorX - 1; q._grist = true;
        const j = { s, b, q, m, t: 0, k: 0, phase: 'walk' }; jobs.push(j);
        O.Errands.send(s, q, [tx, b.doorY + 1], { anim: 'idle', secs: 0.1, face: 0, giveUp: game.t + 60, carry: { good: 'wheat', qty: 2 }, after: (ok) => { if (!jobs.includes(j)) { q._grist = false; return; } if (!ok) { drop(j); return; } const qa = q.agent; qa.frozen = true; qa.path = null; qa.carrying = { good: 'wheat', qty: 2 };
          // the miller comes to the door, white with flour
          const ma = m.agent; if (!able2(m)) { j.m = null; drop(j); return; } m._grist = true; if (ma.inside != null) { ma.inside = null; ma.hidden = false; } ma.x = b.doorX * T + 8 + (tx < b.doorX ? 6 : -6); ma.y = (b.doorY + 1) * T + 8; if (tx > b.doorX) { ma.x = b.doorX * T + 8; } ma.frozen = true; ma.path = null; j.phase = 'door'; j.k = 0;
          if (near(qa.x, qa.y, 300)) O.Speech && O.Speech.say(q, pick(['Two bushel to grind, miller.', 'Will you take my corn today?', 'Is the stone turning? I\'ve wheat for you.']), 2.4); } });
        break; }
    });
    const able2 = (m) => m && m.alive !== false && m.agent && !m.agent.frozen && !m.errand && !m._grist && !talking(m);
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene || !dust.length) return; for (const d of dust) { ctx.globalAlpha = Math.max(0, 0.7 * (1 - d.t / 1.2)); ctx.fillStyle = '#f0ece0'; ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y), 1, 1); } ctx.globalAlpha = 1; });
    (O.extraLines = O.extraLines || []).push((s, q) => { const j = jobs.find((x) => x.q === q || x.m === q); return !j ? '' : j.q === q ? 'You have brought your corn to the mill to be ground, and you suspect the miller of taking too big a toll, as all millers do.' : 'A customer has brought corn to your mill, and you are taking your toll and grinding it.'; });
    O.MillGrist = { jobs, get ground() { return ground; }, soon: () => { cool = 0; } };
  }
  O.MillGristSetup = { setup };
})();
