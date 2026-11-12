// Pig-killing day. Early in the winter (and the odd late-autumn morning) a household that has fattened a
// pig on the acorns has it killed at first light; by the time the town is about, the carcass hangs from a
// ladder by the door, the scalding tub steams, neighbours scrape the bristle off with knives and pot-lids,
// the women stir the pudding over the fire, and the children kick the blown-up bladder about the lane.
// Lend a hand at the tub and you'll go home with a share; and the family sends a plate of fry round to the
// neighbours' doors, as is the custom, to be paid back in kind when their own pig's day comes.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState, G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._pigday && !q.visitor && !talking(q);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    let D = null, cool = 20, force = false, days = 0, helped = 0, plates = 0, lastDay = -9; const steam = [];
    const rel_ = (q) => { if (!q || !q._pigday) return; q._pigday = false; if (q.agent) { q.agent.forceAnim = null; q.agent.lift = 0; if (!talking(q)) q.agent.frozen = false; } };
    function end() { if (!D) return; for (const q of [...D.crew, ...D.kids]) rel_(q); if (D.you) game.player.anim = 'idle'; D = null; }
    const season = (s) => s.season === 'winter' ? (s.weather?.dayOfSeason ?? 9) <= 8 : s.season === 'autumn' && (s.weather?.dayOfSeason ?? 0) >= 20;
    function begin(s) { const P = game.player;
      const b = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && near(b.doorX * T, b.doorY * T, 360) && b.household).map((b) => [b, s.households[b.household - 1]]).filter(([b, h]) => h && !h.gone && h.members && h.members.some((id) => { const q = s.byId.get(id); return q && q.age >= 18 && q.alive !== false; })).sort(() => Math.random() - 0.5)[0]; if (!b) return false;
      const [house, hh] = b; const yx = (house.doorX + 2) * T + 8, yy = (house.doorY + 2) * T + 6; if (s.world.solid[(house.doorY + 2) * s.world.W + house.doorX + 2]) return false;
      days++; lastDay = s.day; D = { s, house, hh, x: yx, y: yy, t: 0, crew: [], kids: [], scraped: 0, you: false, youT: 0, gotShare: false, ball: { x: yx - 40, y: yy + 20, vx: 30, vy: 0, z: 0, vz: 0 }, sent: false, owner: hh.members.map((id) => s.byId.get(id)).find((q) => q && q.age >= 18 && q.alive !== false) };
      if (near(yx, yy, 400)) O.UI && O.UI.say && O.UI.say(`It's pig-killing day at the ${hh.surname || 'neighbours'}': the tub steaming, the carcass on the ladder, half the lane out to help.`, 'info');
      return true; }
    function muster(s) { if (D.crew.length >= 3) return; const q = (D.owner && free(D.owner) && !D.crew.includes(D.owner)) ? D.owner : s.people.filter((x) => free(x) && x.age >= 16 && x.age <= 65 && Math.hypot(x.agent.x - D.x, x.agent.y - D.y) < 380).sort((a, b) => (b.household === D.hh.id ? 1 : 0) - (a.household === D.hh.id ? 1 : 0))[0]; if (!q) return;
      const n = D.crew.length; q._pigday = true; D.crew.push(q); const spot = [[-1, 1], [1, 1], [-3, 0]][n]; const role = n === 2 ? 'pudding' : 'scrape';
      O.Errands.send(s, q, [Math.floor(D.x / T) + spot[0], Math.floor(D.y / T) + spot[1]], { anim: role === 'pudding' ? 'mix' : 'scrub', secs: 0.3, face: 0, giveUp: game.t + 40, after: (ok) => { if (!D || !D.crew.includes(q)) return; if (!ok) { rel_(q); D.crew.splice(D.crew.indexOf(q), 1); return; } q.agent.frozen = true; q.agent.path = null; q._pigrole = role; if (near(q.agent.x, q.agent.y, 300) && Math.random() < 0.6) say(q, role === 'pudding' ? pick(['Keep it stirring or it catches.', 'Blood, oats, onion and a pinch of pepper. My mother\'s way.']) : pick(['Hotter water! It won\'t shift.', 'Good fat on this one. Acorn-fed.', 'Mind the knife.']), 2.2); } }); }
    function kids(s) { if (D.kids.length >= 2) return; const k = s.people.filter((x) => free(x) && x.age >= 5 && x.age <= 12 && Math.hypot(x.agent.x - D.x, x.agent.y - D.y) < 360)[0]; if (!k) return; k._pigday = true; D.kids.push(k); const i = D.kids.length - 1;
      O.Errands.send(s, k, [Math.floor(D.x / T) - 3 + i * 5, Math.floor(D.y / T) + 2], { anim: 'celebrate', secs: 0.3, face: 0, giveUp: game.t + 30, after: (ok) => { if (!D || !D.kids.includes(k)) return; if (!ok) { rel_(k); return; } k.agent.frozen = true; k.agent.path = null; } }); }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return;
      for (const p of steam.slice()) { p.t += dt; p.y -= 10 * dt; p.x += Math.sin(p.t * 3) * 3 * dt; if (p.t > 2) steam.splice(steam.indexOf(p), 1); }
      if (D) { D.t += dt; if (D.s !== s || D.t > 420 || s.minute / 60 > 16) { end(); return; } if (game.scene) return;
        if (Math.random() < dt * 5) steam.push({ x: D.x + 4 + (Math.random() - 0.5) * 8, y: D.y - 10, t: 0 });
        D.mt = (D.mt || 0) - dt; if (D.mt <= 0 && D.scraped < 100) { D.mt = 5; muster(s); kids(s); }
        let rate = 0; for (const q of D.crew) if (q.agent.frozen && q._pigrole) { q.agent.forceAnim = q._pigrole === 'pudding' ? 'mix' : (Math.floor(D.t * 0.5 + q.id) % 4 === 0 ? 'wipe' : 'scrub'); q.agent.dir = O.dirOf(D.x - q.agent.x, D.y - 10 - q.agent.y); rate += q._pigrole === 'scrape' ? 1 : 0.3; }
        // the bladder ball, kicked between the children
        const ks = D.kids.filter((k) => k.agent.frozen); const bl = D.ball; if (ks.length === 2) { const tgt = ks[D.kick || 0].agent; bl.vx += (tgt.x - bl.x) * dt * 0.8; bl.vx *= 0.99; bl.x += bl.vx * dt; bl.vz -= 200 * dt; bl.z = Math.max(0, bl.z + bl.vz * dt); if (bl.z === 0) bl.vz = Math.abs(bl.vz) * 0.5; if (Math.abs(tgt.x - bl.x) < 6) { D.kick = 1 - (D.kick || 0); bl.vx = (ks[D.kick].agent.x - bl.x) * 1.2; bl.vz = 70; tgt.forceAnim = 'attack'; setTimeout(() => { if (tgt) tgt.forceAnim = 'celebrate'; }, 300); if (Math.random() < 0.3 && near(tgt.x, tgt.y, 260)) O.sfx && O.sfx('smack', 0.08); } }
        if (D.you) { if (!near(D.x, D.y + 4, 40)) { D.you = false; game.player.anim = 'idle'; } else { const P = game.player; P.anim = 'scrub'; P.dir = O.dirOf(D.x - P.x, D.y - 10 - P.y); rate += 1.2; D.youT += dt; } }
        D.scraped += rate * dt * 0.9;
        if (D.you && D.youT > 12 && !D.gotShare) { D.gotShare = true; helped++; if (G.meat && PS.canCarry && PS.canCarry('meat')) PS.add('meat'); const o = D.owner; if (o) { const r = relOf(o); r.affinity = Math.min(1, r.affinity + 0.12); r.familiar = Math.min(1, (r.familiar || 0) + 0.12); try { s.remember(o, 'The stranger came and helped us on pig-killing day.', 'kindness', 0.7); } catch (e) { /* */ } if (near(o.agent.x, o.agent.y, 300)) say(o, pick(['Here, take a joint home with you. You\'ve earned it.', 'Many hands! There\'s pudding tonight if you want it.']), 2.4); } O.UI && O.UI.say && O.UI.say('They wrap a joint of pork in a cloth for you: your share.', 'good'); }
        // done: the fry sent round to the neighbours
        if (D.scraped >= 100 && !D.sent) { D.sent = true; for (const q of D.crew) { q._pigrole = null; } const runner = D.crew.find((q) => q.household === D.hh.id) || D.crew[0]; const doors = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && b.id !== D.house.id && Math.hypot(b.doorX - D.house.doorX, b.doorY - D.house.doorY) < 14).slice(0, 2);
          for (const q of D.crew) if (q !== runner) rel_(q); for (const k of D.kids) rel_(k); D.kids = [];
          if (runner && doors.length) { const go = (i) => { if (!D || i >= doors.length) { if (D) { rel_(runner); D.done = true; } return; } const b = doors[i]; runner.agent.frozen = false; O.Errands.send(s, runner, [b.doorX, b.doorY + 1], { anim: 'give', secs: 1.2, face: 0, carry: { good: 'meat', qty: 1 }, giveUp: game.t + 40, after: (ok) => { if (ok && b.household) { plates++; const h = s.households[b.household - 1]; if (h && h.members) for (const id of h.members) { const z = s.byId.get(id); if (z) { try { s.relate(z, runner, 0.06); } catch (e) { /* */ } } } if (h) { h.pantry = h.pantry || {}; h.pantry.meat = (h.pantry.meat || 0) + 1; } } go(i + 1); } }); }; go(0); }
          else { rel_(runner); D.done = true; } }
        if (D.done && D.t > 60) end();
        return; }
      cool -= dt; if (cool > 0 && !force) return; cool = 50; if (game.scene) return; const hr = s.minute / 60; if (!force && (!season(s) || hr < 8 || hr > 13 || lastDay === s.day || Math.random() > 0.3)) return; force = false; begin(s); });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!D || D.you || D.scraped >= 100 || game.scene || P.locked || D.s !== cur()) return null; if (Math.hypot(D.x - P.x, D.y + 4 - P.y) > 36) return null;
      return { type: 'custom', d: 2, x: D.x, y: D.y - 36, label: 'Lend a hand at the scalding tub', act: () => { D.you = true; D.youT = 0; const q = D.crew[0]; if (q) say(q, pick(['Here, take a scraper. Work with the grain.', 'Good! Pour from the kettle, then scrape.']), 2.2); } }; });
    (O.extraLines = O.extraLines || []).push((s, q) => D && (D.crew.includes(q) || (D.hh && q.household === D.hh.id)) ? `It is pig-killing day at the ${D.hh.surname || ''} house: the pig hangs on the ladder, the tub is steaming and the neighbours are helping scrape it and make the puddings.` : '');
    game.hooks.drawWorld.push((ctx, cam) => { if (!D || game.scene || D.s !== cur()) return; const x = Math.round(D.x - cam.x), y = Math.round(D.y - cam.y);
      // the ladder against the wall, the carcass hanging from it
      if (D.scraped < 100 || !D.done) { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 22, y - 40, 2, 40); ctx.fillRect(x - 12, y - 40, 2, 40); for (let i = 0; i < 6; i++) ctx.fillRect(x - 22, y - 36 + i * 6, 12, 1);
        const pale = D.scraped > 60 ? '#f0d0c0' : D.scraped > 25 ? '#e2b8a6' : '#c9a08a'; ctx.fillStyle = pale; ctx.fillRect(x - 21, y - 34, 10, 20); ctx.fillRect(x - 20, y - 14, 3, 4); ctx.fillRect(x - 15, y - 14, 3, 4); ctx.fillRect(x - 19, y - 37, 6, 3); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x - 13, y - 34, 2, 20); ctx.fillStyle = '#8a7a6a'; ctx.fillRect(x - 17, y - 40, 1, 3); }
      // the scalding tub
      ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 6, y - 10, 16, 10); ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 6, y - 7, 16, 1); ctx.fillRect(x - 6, y - 3, 16, 1); ctx.fillStyle = '#a8b8c0'; ctx.fillRect(x - 5, y - 10, 14, 2);
      // the pudding pot on its fire, a few steps off
      const px = x - 44, py = y - 6; ctx.fillStyle = '#2a2a2a'; ctx.fillRect(px - 5, py - 7, 10, 7); ctx.fillStyle = '#5a1a1a'; ctx.fillRect(px - 4, py - 7, 8, 1); const fl = Math.floor(performance.now() / 120) % 3; ctx.fillStyle = ['#e8862a', '#f0b040', '#d0601a'][fl]; ctx.fillRect(px - 3, py, 2, 2); ctx.fillRect(px + 1, py, 2, 2 + (fl === 1 ? 1 : 0));
      ctx.fillStyle = 'rgba(240,240,240,0.5)'; for (const p of steam) ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 2, 2);
      // the bladder ball
      if (D.kids.length === 2) { const b = D.ball, bx = Math.round(b.x - cam.x), by = Math.round(b.y - cam.y); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(bx - 2, by, 5, 1); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(bx - 2, by - 4 - Math.round(b.z), 5, 4); ctx.fillStyle = '#c8b898'; ctx.fillRect(bx + 1, by - 2 - Math.round(b.z), 2, 2); } });
    O.PigDay = { get day() { return D; }, get days() { return days; }, get helped() { return helped; }, get plates() { return plates; }, soon: () => { cool = 0; force = true; } };
  }
  O.PigDaySetup = { setup };
})();
