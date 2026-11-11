// Rough music. A town has its own justice for those it won't stand: when you're notorious and you come home
// of an evening, a knot of neighbours is waiting outside your house with pots and pans and ladles, beating
// them and jeering, hooting your name, until you show your face or they tire of it; and in the morning
// there's dung smeared on your door. Folk you've treated well hang back from it.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let R = null, times = 0; const marks = []; let last = -99;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const notorious = () => (PS.rep && (PS.rep.criminal > 0.55 || PS.rep.civilian < -0.4)) || !!PS.outlaw;
    function end() { if (!R) return; for (const q of R.crowd) { q._rough = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } } marks.push({ s: R.s, b: R.b, day: R.s.day }); R = null; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return;
      if (R) { R.t += dt; if (R.s !== s || R.t > 40 || R.crowd.some((q) => talking(q))) { end(); return; }
        R.crowd.forEach((q, i) => { const a = q.agent; if (!a.frozen) return; a.dir = 3; a.forceAnim = Math.floor(R.t * 3 + i) % 3 === 0 ? 'point' : 'hammer'; });
        R.beat -= dt; if (R.beat <= 0) { R.beat = 0.25 + Math.random() * 0.3; if (near(R.x, R.y, 400)) O.sfx && O.sfx('smack', 0.12 + Math.random() * 0.1, !!game.scene); }
        R.jeer -= dt; if (R.jeer <= 0) { R.jeer = 3 + Math.random() * 2; const q = pick(R.crowd); if (!game.scene && near(R.x, R.y, 400)) O.Speech && O.Speech.say(q, pick(['Thief! Thief! Come out and face us!', 'We know what you are!', 'Get out of our town!', 'Shame! Shame on this house!', 'Come out, you coward!']), 2.2); else if (game.scene && game.scene.b === R.b && Math.random() < 0.4) O.UI && O.UI.say && O.UI.say(pick(['Outside, the pans and the jeering go on and on.', 'Someone hammers on your shutters, hooting.', '"Come out and face us!"'])); }
        // show your face, and they back off muttering
        if (!game.scene && near(R.b.doorX * T, (R.b.doorY + 1) * T, 40) && R.t > 3 && !R.faced) { R.faced = true; R.t = 34; O.Speech && O.Speech.say(R.crowd[0], pick(['Aye, look at it. Not so bold now.', 'We\'ve said our piece. Mend your ways.']), 2.6); }
        return; }
      const hr = s.minute / 60; if (hr < 19 || hr > 22.5 || s.day - last < 3 || !notorious()) return;
      const b = s.world.buildings.find((x) => x.owner && x.owner.kind === 'player' && x.doorX != null && near(x.doorX * T, x.doorY * T, 300)); if (!b) return;
      const crowd = s.people.filter((q) => q.alive !== false && q.age >= 14 && q.agent && !q.agent.hidden && !q.agent.frozen && !q.errand && !q.gang && !talking(q) && (q.rel.get(0)?.affinity || 0) < 0.2 && !/guard|watch/.test(q.job?.role || '') && Math.hypot(q.agent.x - b.doorX * T, q.agent.y - b.doorY * T) < 600).slice(0, 5); if (crowd.length < 3) return;
      last = s.day; times++; const x = b.doorX * T + 8, y = (b.doorY + 3) * T;
      crowd.forEach((q, i) => { q._rough = true; O.Errands.send(s, q, [b.doorX - 2 + i, b.doorY + 2 + (i % 2)], { anim: 'idle', secs: 0.1, face: 3, sprint: true, giveUp: game.t + 25, after: (ok) => { if (!R || !q._rough) return; if (!ok) { q._rough = false; return; } q.agent.frozen = true; q.agent.path = null; } }); });
      R = { s, b, crowd, x, y, t: 0, beat: 2, jeer: 4 };
      try { O.TownTalk && O.TownTalk.tell(x, y, 'The neighbours gave the stranger rough music tonight, pans and all, outside their own door.', 'They say there was rough music outside the stranger\'s house.'); } catch (e) { /* */ } });
    // the pans in their hands, and the muck on the door after
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; const s = cur(); if (!s) return;
      if (R && R.s === s) for (const q of R.crowd) { const a = q.agent; if (!a.frozen) continue; const x = Math.round(a.x - cam.x) + 5, y = Math.round(a.y - cam.y) - 16; ctx.fillStyle = '#5a5a60'; ctx.fillRect(x - 1, y, 5, 3); ctx.fillStyle = '#3a3a40'; ctx.fillRect(x + 4, y + 1, 3, 1); }
      for (const m of marks.slice()) { if (m.s !== s) continue; if (s.day - m.day > 1) { marks.splice(marks.indexOf(m), 1); continue; } const sp = m.b.sprite; if (!sp || !sp.door) continue; const x = Math.round(m.b.x * T - sp.OV + sp.door.x - cam.x), y = Math.round((m.b.bottom + 1) * T - sp.H + sp.door.y - cam.y); ctx.fillStyle = '#4a3a20'; ctx.fillRect(x + 2, y + 6, 6, 3); ctx.fillRect(x + 4, y + 9, 3, 4); ctx.fillRect(x + 7, y + 4, 2, 3); } });
    O.RoughMusic = { get times() { return times; }, get on() { return R; }, marks, reset: () => { last = -99; } };
  }
  O.RoughMusicSetup = { setup };
})();
