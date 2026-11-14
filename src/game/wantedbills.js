// Wanted bills. Once the watch are after you, it's on paper: a bill nailed to the notice board and the
// tavern door with your likeness drawn on it (as the witnesses described you: change your clothes or wear
// a mask and it stops looking like you) and the reward in big figures. A watchman comes round with a
// hammer and nails them up, fresh ones every morning. Townsfolk stop and read them, and then look at the
// faces round them: if yours matches, someone points and runs for the watch. Tear a bill down if you dare,
// but not where the watch can see.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState, J = O.Justice;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const lvl = () => (PS.wantedLevel ? PS.wantedLevel() : 0);
    let posted = new Map(), rAcc = 6, pAcc = 0, nailed = 0, readN = 0, spotted = 0, torn = 0, likeness = null; const going = new Set();
    // where bills go: every notice board, and the doors of the tavern and the watch house
    function spots(s) { if (s._billSpots) return s._billSpots; const out = []; for (const pr of s.world.props || []) if (pr.kind === 'noticeboard') out.push({ x: pr.x + 9, y: pr.y - 12, gy: pr.y + 6, k: 'nb' + pr.x });
      for (const b of s.world.buildings) if (b.doorX != null && /tavern|inn|guard|watch/.test(b.type || '')) out.push({ x: b.doorX * T + 8 + 14, y: (b.doorY + 1) * T - 18, gy: (b.doorY + 1) * T + 4, k: 'b' + b.id });
      return (s._billSpots = out.slice(0, 6)); }
    const crimes = (s) => (s.crimes || []).filter((c) => c.perp === 'player' && c.investigated && !c.closed && !c.accused);
    const profile = (s) => { const o = crimes(s); return o.length ? o[o.length - 1].profile : null; };
    const reward = (s) => 10 + crimes(s).length * 8 + (PS.bounty ? 30 : 0);
    const looksLike = (s) => { const pf = profile(s); if (!pf) return PS.bounty ? 0.7 : 0; try { return J.matchScore(pf, J.lookOf(game.player.a)); } catch (e) { return 0; } };
    // the likeness, drawn once from how you looked when they posted it
    function headOf(app) { try { const fr = O.Char.frame(app, 2, 'idle', 0), hy = O.Char.headY(app), top = Math.max(0, Math.round(hy.cy - hy.ry - 5)); const c = document.createElement('canvas'); c.width = 12; c.height = 12; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.filter = 'grayscale(1) sepia(0.6) contrast(1.3)'; x.drawImage(fr, 8, top, 16, 16, 0, 0, 12, 12); return c; } catch (e) { return null; } }
    function drawLikeness() { likeness = headOf(game.player._baseA || game.player.a); }
    const bills = (s) => { const P = posted.get(s.world.placeId); return P && P.day >= 0 ? P.list : []; };
    // the watch nail them up, every morning while you're wanted
    game.hooks.update.push((dt) => { pAcc -= dt; if (pAcc > 0) return; pAcc = 2; const s = cur(); if (!s || !s.world) return; const w = lvl(), P = posted.get(s.world.placeId);
      if (w < 1) { if (P && P.list.length) posted.set(s.world.placeId, { day: s.day, list: [] }); return; }
      if (P && P.day === s.day) return; if (s.minute / 60 < 7) return; posted.set(s.world.placeId, { day: s.day, list: [] }); if (w >= 2 || !likeness) drawLikeness();
      for (const sp of spots(s)) { const bill = { ...sp, face: w >= 2, reward: reward(s), desc: PS.soughtFor ? PS.soughtFor() : '' };
        const g = s.people.find((q) => q.job?.role?.startsWith('guard') && q.agent && !q.errand && !talking(q) && q.activity?.act !== 'sleep' && near(q.agent.x, q.agent.y, 600));
        if (g && near(sp.x, sp.y, 400) && !going.has(sp.k)) { going.add(sp.k); O.Errands.send(s, g, [Math.floor(sp.x / T), Math.floor(sp.gy / T)], { anim: 'hammer', secs: 2.2, face: 6, giveUp: game.t + 50, after: () => { going.delete(sp.k); bills(s).push(bill); nailed++; O.sfx && near(sp.x, sp.y, 300) && O.sfx('smack', 0.3); if (near(sp.x, sp.y, 300)) say(g, pick(['There. Let\'s see how far they get now.', 'Wanted, dead or... well, wanted.']), 2); } }); }
        else { bills(s).push(bill); nailed++; } } });
    // a thief of the town with a price on his head gets a bill too, by the watch house, with his face on it
    const rogueBills = new Map(); let rogueTaken = 0;
    function rogues(s) { let R = rogueBills.get(s.world.placeId); if (R && R.day === s.day) return R.list; const sp = spots(s).find((x) => x.k[0] === 'b') || spots(s)[0]; if (!sp || !O.Bounties) return []; let offs = []; try { offs = O.Bounties.offers(s, 'watch').filter((o) => o.kind === 'thief'); } catch (e) { /* */ }
      R = { day: s.day, list: offs.slice(0, 2).map((o, i) => { const q = s.byId.get(o.target); return q ? { o, q, x: sp.x + 16 * (i + 1) * (sp.k[0] === 'b' ? 1 : -1), y: sp.y, gy: sp.gy, face: headOf(q.app) } : null; }).filter(Boolean) }; rogueBills.set(s.world.placeId, R); return R.list; }
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (!s || game.scene) return; for (const b of rogues(s)) { if (!near(b.x, b.y, 460) || (O.occluded && O.occluded(b.x, b.gy))) continue; const x = Math.round(b.x - 7 - cam.x), y = Math.round(b.y - 9 - cam.y), gone = b.q.jailUntil || b.q.alive === false || b.taken;
      ctx.fillStyle = '#c8b88a'; ctx.fillRect(x, y, 14, 18); ctx.fillStyle = '#e8dcb4'; ctx.fillRect(x + 1, y + 1, 12, 16); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 6, y - 1, 2, 2); if (b.face) ctx.drawImage(b.face, x + 2, y + 3, 10, 10); ctx.fillStyle = '#7a1a1a'; ctx.fillRect(x + 2, y + 14, 10, 2);
      if (gone) { ctx.fillStyle = '#9a1a1a'; for (let k = 0; k < 12; k++) { ctx.fillRect(x + 1 + k, y + 3 + k, 1, 1); ctx.fillRect(x + 12 - k, y + 3 + k, 1, 1); } } } });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked) return null; const b = rogues(s).find((b) => near(b.x, b.gy, 22) && !b.taken && !b.q.jailUntil && b.q.alive !== false); if (!b) return null;
      return { type: 'custom', d: 2, x: b.x, y: b.y - 22, label: `Take down ${b.q.first}'s bill and claim the bounty (₳${b.o.reward})`, act: () => { if (PS.contract) { ui('You already have a contract. See it through or give it up first.', 'info'); return; } P.anim = 'take'; setTimeout(() => { P.anim = 'idle'; }, 700); b.taken = true; rogueTaken++; O.Bounties.take(s, b.o); } }; });
    // folk read them, and look about
    game.hooks.update.push((dt) => { rAcc -= dt; if (rAcc > 0) return; rAcc = 6 + Math.random() * 6; const s = cur(); if (!s || game.scene) return; const L = bills(s); if (!L.length) return;
      for (const b of L) { if (!near(b.x, b.y, 320)) continue; const q = s.people.find((z) => z.age >= 12 && z.agent && !z.agent.hidden && z.agent.inside == null && !z.errand && !z.agent.frozen && !talking(z) && !z.gang && !z._coup && !/guard/.test(z.job?.role || '') && Math.hypot(z.agent.x - b.x, z.agent.y - b.gy) < 70 && z._bill !== s.day); if (!q) continue; q._bill = s.day;
        O.Errands.send(s, q, [Math.floor(b.x / T), Math.floor(b.gy / T) + 1], { anim: 'look', secs: 2, face: 6, giveUp: game.t + 14, after: (ok) => { if (!ok) return; readN++; if (near(b.x, b.y, 240)) say(q, pick([`₳${b.reward} for that one. I could use ₳${b.reward}.`, 'Wanted. Hm. I\'ll keep my eyes open.', 'Ugly-looking sort.']), 2);
          // now: the face in front of them
          const P = game.player; if (b.face && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 110 && !game.scene && looksLike(s) >= 0.6 && Math.random() < 0.5) setTimeout(() => spot(s, q), 1200); } }); break; } });
    function spot(s, q) { if (!q.agent || q.errand || q.alive === false) return; spotted++; O.gesture && O.gesture(q, 'point', 1.4); say(q, pick(['It\'s them! The one off the bill!', 'Watch! Watch! Over here!', 'That\'s the face on the bill!']), 2.4); ui(`${q.first} has looked from the bill to your face, and is running for the watch.`, 'warn');
      const g = s.people.filter((z) => z.job?.role?.startsWith('guard') && z.agent && !z.agent.hidden && z.activity?.act !== 'sleep').sort((a, c) => Math.hypot(a.agent.x - q.agent.x, a.agent.y - q.agent.y) - Math.hypot(c.agent.x - q.agent.x, c.agent.y - q.agent.y))[0];
      if (!g) return; O.Errands.send(s, q, [Math.floor(g.agent.x / T), Math.floor(g.agent.y / T)], { anim: 'point', secs: 1.2, sprint: true, giveUp: game.t + 30, after: (ok) => { if (!ok) return; say(g, 'Where? Show me.', 1.6); if (O.Law && !O.Law.chasing() && lvl() >= 1 && Math.hypot(g.agent.x - game.player.x, g.agent.y - game.player.y) < 400) O.Law.startChase(g); } }); }
    // the bills themselves
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (!s || game.scene) return; for (const b of bills(s)) { if (!near(b.x, b.y, 460) || (O.occluded && O.occluded(b.x, b.gy))) continue; const x = Math.round(b.x - 7 - cam.x), y = Math.round(b.y - 9 - cam.y);
      ctx.fillStyle = '#c8b88a'; ctx.fillRect(x, y, 14, 18); ctx.fillStyle = '#e8dcb4'; ctx.fillRect(x + 1, y + 1, 12, 16); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 2, y + 2, 10, 1); ctx.fillRect(x + 6, y - 1, 2, 2);
      if (b.face && likeness) ctx.drawImage(likeness, x + 2, y + 3, 10, 10); else { ctx.fillStyle = '#8a7a5a'; ctx.fillRect(x + 5, y + 4, 4, 4); ctx.fillRect(x + 4, y + 8, 6, 4); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 6, y + 5, 2, 1); }
      ctx.fillStyle = '#7a1a1a'; ctx.fillRect(x + 2, y + 14, 10, 2); } });
    // tear it down
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked) return null; const b = bills(s).find((b) => near(b.x, b.gy, 30)); if (!b) return null;
      return { type: 'custom', d: 1, x: b.x, y: b.y - 22, label: b.face ? 'Tear down the bill with your likeness on it' : 'Tear down the wanted bill', act: () => { P.anim = 'take'; setTimeout(() => { P.anim = 'idle'; }, 700); const L = bills(s), i = L.indexOf(b); if (i >= 0) L.splice(i, 1); torn++; O.sfx && O.sfx('cloth', 0.4);
        const g = s.people.find((z) => z.job?.role?.startsWith('guard') && z.agent && !z.agent.hidden && z.agent.inside == null && near(z.agent.x, z.agent.y, 130)); const w = s.people.find((z) => z.age >= 12 && z.agent && !z.agent.hidden && z.agent.inside == null && !/guard/.test(z.job?.role || '') && near(z.agent.x, z.agent.y, 90));
        if (g) { say(g, 'Oi! Leave that be! ...Hold on. It\'s you!', 2.2); if (O.Law && !O.Law.chasing()) O.Law.startChase(g); }
        else if (w) { O.gesture && O.gesture(w, 'shocked', 1.2); say(w, pick(['Here, you can\'t do that!', 'That\'s the watch\'s bill, that is.']), 2); ui('You rip it down and crumple it. Someone saw.', 'warn'); }
        else ui('You rip the bill down and stuff it in your shirt. They\'ll only put up another in the morning.', 'info'); } }; });
    // what the readers carry away with them
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!s || !bills(s).length || q._bill !== s.day) return ''; return `This morning you read a wanted bill: a reward of ${bills(s)[0].reward} aurin for the stranger${bills(s)[0].desc ? ', ' + bills(s)[0].desc : ''}.`; });
    O.WantedBills = { bills, spots, looksLike, spot, rogues, get rogueTaken() { return rogueTaken; }, get nailed() { return nailed; }, get read() { return readN; }, get spotted() { return spotted; }, get torn() { return torn; }, get likeness() { return likeness; } };
  }
  O.WantedBillsSetup = { setup };
})();
