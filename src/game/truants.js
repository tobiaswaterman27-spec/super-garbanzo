// Truants. In lesson hours there are always a couple who should be at their slates and aren't: crouched
// over marbles behind a woodpile, or dabbling at the water's edge. Then the schoolmaster comes stalking up
// the lane with his rod, one of them sees him and yells, and they scatter; the slow one is caught by the
// ear and marched back to school, protesting all the way.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let R = null, cool = 50, caught = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._truant && !q._bit && !q._office && !talking(q);
    const name = (q) => q.first || (q.name || '').split(' ')[0] || 'boy';
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._truant = false; }
    function end() { if (!R) return; for (const q of [R.master, ...R.kids]) rel(q); R = null; }
    function step(a, tx, ty, v, dt) { const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 2) return d; const st = Math.min(d, v * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; a.stuck = a.stuck || 0;
      if (!game.solidAt(nx, ny - 2) || a.stuck > 2.5) { a.x = nx; a.y = ny; } else if (!game.solidAt(nx, a.y - 2)) a.x = nx; else if (!game.solidAt(a.x, ny - 2)) a.y = ny; else a.stuck += dt; a.dir = O.dirOf(dx, dy); a.forceAnim = v > 50 ? 'run' : 'walk'; return d; }
    function school(s) { for (const kind of ['school', 'chapel', 'church']) for (const [id, bz] of s.biz) if (bz.type === kind && (bz.workers || []).length) { const b = s.building(id); if (b && b.doorX != null) return [b, bz]; } return null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (R) { R.t += dt; if (R.s !== s || R.t > 150 || [R.master, ...R.kids].some((q) => talking(q) || q.alive === false)) { end(); return; }
        if (R.phase === 'play') { R.kids.forEach((q, i) => { const a = q.agent; if (a.frozen) a.forceAnim = Math.floor(R.t * 0.5 + i) % 4 === 3 ? 'laugh' : 'crouch'; });
          const m = R.master.agent, k0 = R.kids[0].agent; if (R.master.agent.frozen && R.master._truant) step(m, k0.x + 40, k0.y + 20, 34, dt); if (Math.hypot(m.x - k0.x, m.y - k0.y) < 90 && !R.seen) { R.seen = true; R.phase = 'scatter'; const look = R.kids[R.kids.length - 1];
            if (near(k0.x, k0.y, 320)) { O.Speech && O.Speech.say(look, pick(['It\'s the master! RUN!', 'Cave! Cave! Old Birch-rod!', 'Leg it!']), 1.8); setTimeout(() => R && near(m.x, m.y, 320) && O.Speech && O.Speech.say(R.master, pick([`${name(R.kids[0])}! I see you!`, 'Stop there, you idle little toads!', 'Truants! I\'ll have the hide off you!']), 2.2), 900); }
            // the quick ones run, the slow one is caught
            for (const q of R.kids.slice(1)) { rel(q); const a = q.agent, tx = Math.floor(a.x / T) + (a.x > m.x ? 14 : -14), ty = Math.floor(a.y / T) + Math.round((Math.random() - 0.5) * 8); O.Errands.send(s, q, [tx, ty], { anim: 'laugh', secs: 1, face: 0, sprint: true, giveUp: game.t + 25 }); }
            R.kids = [R.kids[0]]; k0.forceAnim = 'shocked'; } }
        if (R.phase === 'scatter') { R.st = (R.st || 0) + dt; const m = R.master.agent, k = R.kids[0].agent; const d = step(m, k.x + (m.x < k.x ? -12 : 12), k.y, 70, dt); if (d < 4 || R.st > 12) { m.x = k.x + (m.x < k.x ? -12 : 12); m.y = k.y; m.forceAnim = null; R.phase = 'caught'; R.ct = 0; caught++; } }
        if (R.phase === 'caught') { R.ct += dt; const m = R.master.agent, k = R.kids[0].agent; m.dir = m.x < k.x ? 2 : 1; k.dir = m.x < k.x ? 1 : 2; m.forceAnim = R.ct < 2 ? 'take' : 'shake'; k.forceAnim = R.ct < 2 ? 'hurt' : 'mourn';
          if (!R.said && R.ct > 0.6 && near(k.x, k.y, 320)) { R.said = true; O.Speech && O.Speech.say(R.kids[0], pick(['Ow! Ow! My ear, master!', 'I was coming, master, honest!', 'It was HIM, not me!']), 2.2); setTimeout(() => R && near(k.x, k.y, 320) && O.Speech && O.Speech.say(R.master, pick(['Back to your letters, and you\'ll write it fifty times.', 'Your father will hear of this.', 'The rod for you, my lad.']), 2.6), 2400); }
          if (R.ct > 5) { const b = R.b, kid = R.kids[0], ma = R.master; end(); O.Errands.send(s, ma, [b.doorX, b.doorY + 1], { anim: 'idle', secs: 0.2, face: 3, giveUp: game.t + 60 }); setTimeout(() => O.Errands.send(s, kid, [b.doorX, b.doorY + 1], { anim: 'idle', secs: 0.2, face: 3, giveUp: game.t + 60 }), 250); } }
        return; }
      cool -= dt; if (cool > 0) return; cool = 200 + Math.random() * 200; if (hr < 9 || hr > 12.5 || s.season === 'winter') return; const W = s.weather; if (W && W.raining) return;
      const sc = school(s); if (!sc) return; const [b, bz] = sc;
      const kids = s.people.filter((q) => able(q) && q.age >= 8 && q.age <= 12 && !q.agent.hidden && q.agent.inside == null && near(q.agent.x, q.agent.y, 360)); if (kids.length < 2) return;
      const master = (bz.workers || []).concat(bz.owner != null ? [bz.owner] : []).map((id) => s.byId.get(id)).find((q) => able(q) && q.age >= 18 && !q._office && !q._scene); if (!master) return;
      const two = kids.slice(0, 3), k0 = two[0].agent, tx = Math.floor(k0.x / T), ty = Math.floor(k0.y / T);
      for (const q of two) q._truant = true; R = { s, b, bz, master, kids: two, t: 0, phase: 'gather' };
      two.forEach((q, i) => O.Errands.send(s, q, [tx + (i % 2 ? 1 : -1) * (1 + (i >> 1)), ty + (i >> 1)], { anim: 'idle', secs: 0.1, face: 0, giveUp: game.t + 25, after: (ok) => { if (!R) return; if (!ok) { end(); return; } q.agent.frozen = true; q.agent.path = null; q.agent.dir = i % 2 ? 2 : 1; if (R.kids.every((x) => x.agent.frozen) && R.phase === 'gather') { R.phase = 'play'; R.t = 0;
        // the master comes out of the school and up the lane after them
        const m = R.master.agent; R.master._truant = true; if (m.inside != null) { m.inside = null; m.hidden = false; m.x = b.doorX * T + 8; m.y = (b.doorY + 1) * T + 8; }
        if (R.master.errand) O.Errands.finish(R.master, false); m.path = null; m.frozen = true; m.stuck = 0;
        const k = R.kids[0].agent; if (Math.hypot(m.x - k.x, m.y - k.y) > 420) { const w = s.world; for (let tries = 0; tries < 30; tries++) { const a = Math.random() * Math.PI * 2, x = k.x + Math.cos(a) * 300, y = k.y + Math.sin(a) * 200, i = Math.floor(y / T) * w.W + Math.floor(x / T); if (!w.solid[i] && w.ter[i] !== w.TER.WATER) { m.x = x; m.y = y; break; } } } } } }));
    });
    // the marbles in the dirt while they play; the rod in the master's hand
    game.hooks.drawWorld.push((ctx, cam) => { if (!R || game.scene || R.s !== cur()) return;
      if (R.phase === 'play' || R.phase === 'gather') { const k = R.kids[0].agent, x = Math.round(k.x - cam.x) + (R.kids[0].agent.dir === 2 ? -12 : 10), y = Math.round(k.y - cam.y) + 1; for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#c84030', '#3060c8', '#e0e0d0', '#40a050'][i]; ctx.fillRect(x - 3 + (i * 3) % 7, y - 1 + (i % 2) * 2, 2, 2); } }
      const m = R.master.agent; if (!m.hidden && m.inside == null) { const x = Math.round(m.x - cam.x) + (m.dir === 1 ? -6 : 6), y = Math.round(m.y - cam.y); ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + (m.dir === 1 ? -3 : 3), y - 26); ctx.stroke(); } });
    (O.extraLines = O.extraLines || []).push((s, q) => !R || !q._truant ? '' : q === R.master ? 'You are the schoolmaster and you have come out after truants who should be at their lessons.' : 'You are playing truant from school, and you are in trouble if the master catches you.');
    O.Truants = { get run() { return R; }, get caught() { return caught; }, soon: () => { cool = 0; } };
  }
  O.TruantsSetup = { setup };
})();
