// The changing of the watch. At six in the morning and six at night the guard turns over outside the watch
// house: the men coming off line up on one side and those coming on on the other, they knock fists to
// brows, the news is passed ("All quiet?" "A drunk at the Bell, nothing worse"), the keys go across (and
// at dusk the lantern), and the tired shift goes off home yawning while the fresh one takes up the day.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let C = null, changes = 0; const done = new Set();
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._watch && !q._bit && !q._scene && !q._office && !talking(q) && !(q.health && q.health.illness);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._watch = false; }
    function end(home) { if (!C) return; const c = C; C = null; for (const q of [...c.off, ...c.on]) rel(q);
      if (home) for (const q of c.off) { const hb = c.s.building(q.home); if (hb && hb.doorX != null) O.Errands.send(c.s, q, [hb.doorX, hb.doorY + 1], { anim: 'idle', secs: 0.3, face: 0, giveUp: game.t + 90 }); } }
    function house(s) { for (const [id, bz] of s.biz) if (bz.type === 'guard') { const b = s.building(id); if (b && b.doorX != null) return [b, bz]; } return null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (C) { C.t += dt; if (C.s !== s || C.t > 70 || [...C.off, ...C.on].some((q) => talking(q) || q.alive === false)) { end(false); return; }
        const all = [...C.off, ...C.on];
        if (C.phase === 'form' && (all.every((q) => q.agent.frozen) || C.t > 25)) { C.phase = 'stand'; C.st = 0; for (const q of all) if (!q.agent.frozen) { rel(q); } C.off = C.off.filter((q) => q._watch); C.on = C.on.filter((q) => q._watch); if (!C.off.length || !C.on.length) { end(false); return; } }
        if (C.phase === 'stand') { C.st += dt; const st = C.st;
          C.off.forEach((q, i) => { q.agent.dir = 1; q.agent.forceAnim = st < 1.6 ? 'bow' : st > 11 ? (i ? 'stretch' : 'yawn') : (i === 0 && st > 7 && st < 9 ? 'give' : (Math.floor(st / 3) + i) % 3 === 0 ? 'talk' : 'idle'); });
          C.on.forEach((q, i) => { q.agent.dir = 2; q.agent.forceAnim = st < 1.6 ? 'bow' : (i === 0 && st > 7.5 && st < 9.5 ? 'take' : (Math.floor(st / 3) + i) % 3 === 1 ? 'nod' : 'idle'); });
          if (st > 1.6 && !C.s1) { C.s1 = true; if (near(C.x, C.y, 320)) { O.Speech && O.Speech.say(C.on[0], pick(['Anything to report?', 'All quiet?', 'How was it?']), 2.2); setTimeout(() => C && O.Speech && O.Speech.say(C.off[0], C.dusk ? pick(['Quiet. A cart lost a wheel by the bridge, that\'s all.', 'Two lads fighting at the market. Sent them home with sore ears.', 'Nothing worth the telling. Keep your eyes on the tavern.']) : pick(['A drunk at the tavern, nothing worse.', 'Dogs barking all night by the mill. Nothing there.', 'Cold. Cold and quiet. You\'re welcome to it.']), 3), 2400); } }
          if (st > 7.5 && !C.keys) { C.keys = true; if (near(C.x, C.y, 320)) { O.sfx && O.sfx('coins', 0.15); O.Speech && O.Speech.say(C.off[0], C.dusk ? 'The keys, and the lantern. She\'s yours.' : 'The keys. I\'m for my bed.', 2.4); } }
          if (st > 13) { changes++; end(true); } }
        return; }
      // six in the morning and six at night, if you are about the watch house
      const shift = hr >= 17.85 && hr < 18.3 ? 'dusk' : hr >= 5.85 && hr < 6.3 ? 'dawn' : null; if (!shift) return; const key = s.day + shift; if (done.has(key)) return;
      const H = house(s); if (!H) return; const [b, bz] = H; if (!near(b.doorX * T, b.doorY * T, 520)) return; done.add(key);
      const men = (bz.workers || []).map((id) => s.byId.get(id)).filter((q) => q && able(q) && /guard/.test(q.job?.role || ''));
      const goingOff = shift === 'dusk' ? 'day' : 'night', off = men.filter((q) => (q.shift || 'day') === goingOff).slice(0, 2), on = men.filter((q) => (q.shift || 'day') !== goingOff).slice(0, 2); if (!off.length || !on.length) return;
      const x = b.doorX * T + 8, y = (b.doorY + 2) * T + 8; C = { s, b, off, on, t: 0, phase: 'form', x, y, dusk: shift === 'dusk' };
      const w = s.world; [...off.map((q, i) => [q, -2 - i]), ...on.map((q, i) => [q, 2 + i])].forEach(([q, dx]) => { q._watch = true; const a = q.agent; if (a.inside != null) { const hb = s.building(a.inside); if (hb && hb.doorX != null) { a.x = hb.doorX * T + 8; a.y = (hb.doorY + 1) * T + 8; } a.inside = null; a.hidden = false; }
        let tx = b.doorX + dx, ty = b.doorY + 2; if (w.solid[ty * w.W + tx]) ty = b.doorY + 1;
        O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.1, face: dx < 0 ? 1 : 2, giveUp: game.t + 25, after: (ok) => { if (!C || !q._watch) return; if (!ok) { rel(q); return; } a.frozen = true; a.path = null; } }); });
    });
    // the lantern handed across at dusk, and the keys on their ring
    game.hooks.drawWorld.push((ctx, cam) => { if (!C || game.scene || C.s !== cur() || C.phase !== 'stand') return; const who = C.st > 8.5 ? C.on[0] : C.off[0]; if (!who || !who.agent) return; const a = who.agent, x = Math.round(a.x - cam.x) + (a.dir === 1 ? 5 : -6), y = Math.round(a.y - cam.y) - 14;
      ctx.fillStyle = '#8a8a90'; ctx.fillRect(x, y, 3, 1); ctx.fillRect(x + 1, y + 1, 1, 3); if (C.dusk) { ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - 1, y - 9, 5, 7); ctx.fillStyle = Math.floor(performance.now() / 150) % 2 ? '#f0c060' : '#e0a040'; ctx.fillRect(x, y - 8, 3, 5); } });
    (O.extraLines = O.extraLines || []).push((s, q) => !C || !q._watch ? '' : C.off.includes(q) ? 'You are handing over the watch at the end of your shift, and you are tired and want your bed.' : 'You are coming on watch and taking over from the shift going off.');
    O.WatchChange = { get change() { return C; }, get changes() { return changes; }, done };
  }
  O.WatchChangeSetup = { setup };
})();
