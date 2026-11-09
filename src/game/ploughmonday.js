// Plough Monday. Early in the new year, before the ploughing starts again, the ploughboys drag a plough
// dressed in ribbons through the town from door to door, two in the traces and one with the box, crying
// "A penny for the ploughboys!" Most give; and if a house won't, the lads plough a furrow across its
// doorstep for meanness, and leave it there for all to see.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let R = null, forced = false, given = 0, ploughed = 0; const furrows = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._plough && !q._bit && !q._scene && !talking(q);
    const theDay = (s) => forced || (s.season === 'winter' && ((s.weather && s.weather.dayOfSeason) || 0) === 1);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._plough = false; }
    function end() { if (!R) return; for (const q of R.lads) rel(q); if (R.host) rel(R.host); R = null; }
    function step(a, tx, ty, v, dt) { const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1.5) return d; const st = Math.min(d, v * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; a.stuck = a.stuck || 0;
      if (!game.solidAt(nx, ny - 2) || a.stuck > 1.2) { a.x = nx; a.y = ny; } else if (!game.solidAt(nx, a.y - 2)) a.x = nx; else if (!game.solidAt(a.x, ny - 2)) a.y = ny; else a.stuck += dt; a.dir = O.dirOf(dx, dy); return d; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (R) { R.t += dt; if (R.s !== s || R.t > 240 || R.lads.some((q) => talking(q) || q.alive === false)) { end(); return; }
        const [lead, ...rest] = R.lads, la = lead.agent, door = R.doors[R.i];
        if (!door) { end(); return; }
        const dx = door.doorX * T + 8, dy = (door.doorY + 2) * T + 4;
        if (R.phase === 'walk') { const d = step(la, dx, dy, 30, dt); la.forceAnim = 'walk'; rest.forEach((q, i) => { const a = q.agent, tx = la.x - (i + 1) * 11 * Math.sign((la.x - (R.px ?? la.x)) || 1), ty = la.y + (i % 2 ? 4 : -2); step(a, tx, ty, 34, dt); a.forceAnim = 'walk'; }); R.px = la.x;
          if (d < 2 || R.wt > 30) { R.phase = 'knock'; R.k = 0; R.wt = 0; } else R.wt = (R.wt || 0) + dt; }
        if (R.phase === 'knock') { R.k += dt; la.dir = 3; la.forceAnim = R.k < 1.5 ? 'open' : 'idle'; for (const q of rest) q.agent.forceAnim = 'idle';
          if (R.k > 0.3 && !R.cried) { R.cried = true; if (near(la.x, la.y, 320)) O.Speech && O.Speech.say(lead, pick(['A penny for the ploughboys!', 'God speed the plough! A penny, mistress!', 'Remember the ploughboys!']), 2.6); }
          if (R.k > 2.2 && !R.host) { const h = s.people.find((q) => q.home === door.id && q.age >= 18 && able(q)); if (h) { const a = h.agent; a.inside = null; a.hidden = false; a.x = door.doorX * T + 8; a.y = (door.doorY + 1) * T + 6; a.frozen = true; a.path = null; a.dir = 0; h._plough = true; R.host = h; }
            let pays = false; try { const hh = h ? s.household(h) : null; pays = !!(hh && hh.money > 4 && Math.random() < 0.75); if (pays) hh.money -= 1; } catch (e) { /* */ }
            R.pays = pays; R.k = 2.2; R.phase = pays ? 'paid' : 'mean'; R.k2 = 0;
            if (h && near(la.x, la.y, 320)) O.Speech && O.Speech.say(h, pays ? pick(['Here, and God speed it.', 'Go on then, you rogues.', 'A penny, and get that thing off my step.']) : pick(['Not a farthing! Clear off!', 'I\'ve nothing for you. Go on!']), 2.4); if (!h) R.phase = 'next'; } }
        if (R.phase === 'paid') { R.k2 += dt; la.forceAnim = R.k2 < 1.4 ? 'take' : 'bow'; if (R.host) R.host.agent.forceAnim = R.k2 < 1.4 ? 'give' : 'idle'; if (R.k2 > 1 && !R.clink) { R.clink = true; given++; O.sfx && near(la.x, la.y, 300) && O.sfx('coins', 0.25); } if (R.k2 > 3) R.phase = 'next'; }
        if (R.phase === 'mean') { R.k2 += dt; for (const q of rest) { q.agent.forceAnim = 'pitch'; } la.forceAnim = 'point'; if (R.host) R.host.agent.forceAnim = R.k2 < 2 ? 'shake' : 'shocked';
          if (!R.furrow) { R.furrow = { s, day: s.day, x: door.doorX * T + 8, y: (door.doorY + 1) * T + 12, k: 0 }; furrows.push(R.furrow); ploughed++; if (near(la.x, la.y, 320)) setTimeout(() => R && O.Speech && O.Speech.say(rest[0] || lead, pick(['Plough it up, lads!', 'That\'s for your meanness!']), 2), 800); }
          R.furrow.k = Math.min(1, R.k2 / 3); if (R.k2 > 4) R.phase = 'next'; }
        if (R.phase === 'next') { if (R.host) { rel(R.host); R.host = null; } R.i++; R.cried = false; R.clink = false; R.furrow = null; R.phase = 'walk'; R.wt = 0; }
        return; }
      if (!theDay(s) || hr < 10 || hr >= 15) return; if (s._ploughDone === s.day && !forced) return;
      const P = game.player, doors = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 380).sort((a, b) => a.doorX - b.doorX).slice(0, 4); if (doors.length < 2) return;
      const lads = s.people.filter((q) => able(q) && q.sex === 'm' && q.age >= 13 && q.age <= 24 && !q.agent.hidden && q.agent.inside == null && near(q.agent.x, q.agent.y, 700)).slice(0, 3); if (lads.length < 2) return;
      s._ploughDone = s.day; forced = false; for (const q of lads) { q._plough = true; q.agent.frozen = true; q.agent.path = null; q.agent.stuck = 0; }
      const d0 = doors[0], la = lads[0].agent; if (Math.hypot(la.x - d0.doorX * T, la.y - d0.doorY * T) > 360) lads.forEach((q, i) => { q.agent.x = d0.doorX * T - 120 - i * 12; q.agent.y = (d0.doorY + 2) * T + 4; if (game.solidAt(q.agent.x, q.agent.y - 2)) { q.agent.x = d0.doorX * T + 8; } });
      R = { s, lads, doors, i: 0, t: 0, phase: 'walk' };
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; const s = cur(); if (!s) return;
      // the furrow across a mean man's step, for the rest of the day
      for (const f of furrows.slice()) { if (f.s !== s) continue; if (s.day !== f.day) { furrows.splice(furrows.indexOf(f), 1); continue; } const x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y), w = Math.round(28 * f.k); ctx.fillStyle = '#5a4028'; ctx.fillRect(x - 14, y - 1, w, 3); ctx.fillStyle = '#7a5a38'; ctx.fillRect(x - 14, y - 2, w, 1); ctx.fillRect(x - 14, y + 2, w, 1); }
      // the plough, dressed in ribbons, dragged behind the lads in the traces
      if (R && R.s === s && R.lads.length > 1) { const a = R.lads[1].agent, l = R.lads[0].agent, sx = Math.sign(l.x - a.x) || 1, x = Math.round(a.x - cam.x) - sx * 12, y = Math.round(a.y - cam.y); ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + sx * 4, y - 8); ctx.lineTo(x + sx * 10, y - 12); ctx.stroke();
        ctx.fillStyle = '#7a5232'; ctx.fillRect(x - 8, y - 6, 16, 2); ctx.fillRect(x - sx * 8, y - 14, 2, 10); ctx.fillStyle = '#8a8a90'; ctx.fillRect(x + sx * 4, y - 4, 4, 3); const tk = performance.now() / 300; for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#c83030', '#3060c8', '#e0c040', '#40a050'][i]; ctx.fillRect(x - sx * 8 + (i % 2), y - 14 + i * 2 + (Math.floor(tk + i) % 2), 1, 3); } } });
    (O.extraLines = O.extraLines || []).push((s, q) => !R || !q._plough ? '' : R.lads.includes(q) ? 'It is Plough Monday and you are one of the ploughboys dragging the ribboned plough from door to door for pennies.' : 'The ploughboys have come to your door for a penny on Plough Monday.');
    // you can drop a penny in their box when they come by
    let yours = 0;
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, PS = O.PlayerState; if (!R || game.scene || P.locked || R.paidYou) return null; const a = R.lads[0].agent; if (Math.hypot(a.x - P.x, a.y - P.y) > 40) return null;
      return { type: 'custom', d: 40, x: a.x, y: a.y - 26, label: 'Give the ploughboys a penny', act: () => { if (!R) return; if ((PS.money || 0) < 1) return O.UI && O.UI.say && O.UI.say('You have nothing to give them.'); PS.money -= 1; R.paidYou = true; yours++; given++; P.anim = 'give'; setTimeout(() => { P.anim = 'idle'; }, 800); O.sfx && O.sfx('coins', 0.3); O.Speech && O.Speech.say(R.lads[0], pick(['God speed the plough, and you!', 'Thank\'ee kindly! A good year to you!', 'There\'s a generous soul!']), 2.4); } }; });
    O.PloughMonday = { get yours() { return yours; }, get run() { return R; }, get given() { return given; }, get ploughed() { return ploughed; }, furrows, force: () => { forced = true; const s = cur(); if (s) s._ploughDone = -1; } };
  }
  O.PloughMondaySetup = { setup };
})();
