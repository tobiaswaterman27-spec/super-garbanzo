// Chalk on the walls. By night the gangs' young ones chalk their gang's sign on house fronts and shop
// walls in their colour (a hand, an eye, a crown, a key, a crow's foot, a wheel); a rival gang scrawls
// an X across it, or its own sign beside; by day the watch scrub them off with a bucket and brush, and
// sometimes a householder does it themselves, muttering. You can see it all happen, and the marks
// tell you whose streets these are. Ask anyone about a mark.
'use strict';
(function () {
  const T = 16;
  const COL = { crimson: '#c03030', woad: '#3a5ab0', forest: '#3a8a3a', black: '#2a2a2a', mustard: '#d0a020', plum: '#8a3a8a' };
  const GLYPHS = [ // 5x5
    ['.#.#.', '.#.#.', '#####', '#####', '.###.'], // hand
    ['.###.', '#...#', '#.#.#', '#...#', '.###.'], // eye
    ['#.#.#', '#####', '#####', '.....', '#####'], // crown
    ['.##..', '#..#.', '.##..', '..#..', '..##.'], // key
    ['#.#.#', '.###.', '..#..', '..#..', '..#..'], // crow's foot
    ['.###.', '#.#.#', '#####', '#.#.#', '.###.'], // wheel
  ];
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t) => O.Speech && O.Speech.say(q, t, 1.8);
    const nearP = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const isWatch = (q) => /guard|sergeant|watch|captain|constable/.test(q.job?.role || '');
    const glyphOf = (gid) => { let h = 0; for (const c of String(gid)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % GLYPHS.length; };
    const marksOf = (s) => (s._marks ||= []);
    const acting = [];
    // a spot on a building's front, beside the door, at chest height
    function wallSpot(s, b) { if (!b || b.doorX == null || b.w < 3) return null; const xs = []; for (let x = b.x; x < b.x + b.w; x++) if (Math.abs(x - b.doorX) >= 1) xs.push(x); if (!xs.length) return null; const tx = pick(xs); return { x: tx * T + 3 + Math.floor(Math.random() * 6), y: (b.bottom + 1) * T - 14, b: b.id, foot: [tx * T + 8, (b.bottom + 1) * T + 10] }; }
    function chalk(s, q, gid, at, visible) {
      const L = marksOf(s), here = L.find((m) => m.b === at.b && Math.abs(m.x - at.x) < 10);
      const done = () => { if (here && here.gid !== gid) { if (Math.random() < 0.6) here.x_by = gid; else L.push({ x: at.x + 9, y: at.y, b: at.b, gid, day: s.day }); } else if (!here) L.push({ x: at.x, y: at.y, b: at.b, gid, day: s.day }); if (L.length > 40) L.shift(); };
      if (!visible) { done(); return; }
      q._mark = true; q.agent.frozen = true; q.agent.path = null; acting.push({ q, at, t: 0, kind: 'chalk', done, gid });
    }
    function scrub(s, q, m, visible) { const L = marksOf(s); if (!visible) { L.splice(L.indexOf(m), 1); return; } q._mark = true; q.agent.frozen = true; q.agent.path = null; acting.push({ q, at: { x: m.x, y: m.y, foot: [m.x + 2, m.y + 24] }, t: 0, kind: 'scrub', m }); }
    const release = (a) => { const q = a.q; q._mark = false; q.agent.forceAnim = null; q.agent.carrying = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; acting.splice(acting.indexOf(a), 1); };
    const free = (q) => q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._scene && !q._playing && !q._fighting && !q._bit && !q._cp && !q._war && !q._mark && !q._front && q.alive !== false && !q.jailUntil && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    let tick = 5;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.npcGangs) return;
      for (const a of acting.slice()) { const q = a.q, ag = q.agent; a.t += dt;
        if (q.alive === false || game.scene || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)) { if (a.kind === 'chalk' && a.t > 1) a.done(); release(a); continue; }
        if (!a.there) { const [fx, fy] = a.at.foot, dx = fx - ag.x, dy = fy - ag.y, d = Math.hypot(dx, dy); if (d < 2 || a.t > 14) { a.there = true; a.t = 0; ag.dir = 0; } else { const st = Math.min(d, (a.kind === 'chalk' ? 44 : 38) * dt), nx = ag.x + dx / d * st, ny = ag.y + dy / d * st; if (!game.solidAt(nx, ny - 2)) { ag.x = nx; ag.y = ny; } else { ag.x = fx; ag.y = fy; } ag.dir = O.dirOf(dx, dy); ag.forceAnim = a.kind === 'scrub' ? 'carry' : 'walk'; if (a.kind === 'scrub') ag.carrying = 'bucket'; } continue; }
        ag.dir = 0;
        if (a.kind === 'chalk') { ag.forceAnim = Math.floor(a.t * 3) % 4 === 3 ? 'look' : 'place'; a.prog = Math.min(1, a.t / 4); if (a.t > 4.2) { a.done(); if (Math.random() < 0.3) say(q, pick(['There. Now they\'ll know.', 'Ours, this.', 'Heh.'])); release(a); } }
        else { ag.forceAnim = 'scrub'; ag.carrying = null; a.m.fade = Math.min(1, a.t / 5); if (Math.random() < dt * 4 && nearP(ag.x, ag.y, 200)) O.sfx && O.sfx('scrub', 0.12); if (a.t > 5.2) { const L = marksOf(s); const i = L.indexOf(a.m); if (i >= 0) L.splice(i, 1); if (Math.random() < 0.4) say(q, pick(isWatch(q) ? ['Little vermin.', 'Every week. Every blessed week.', 'If I catch who did this...'] : ['On my own wall!', 'Not on my house, you don\'t.'])); release(a); } }
      }
      tick -= dt; if (tick > 0 || game.scene) return; tick = 6;
      const h = s.minute / 60, night = h >= 21 || h < 2, day = h >= 8 && h < 18, L = marksOf(s);
      const gangs = s.npcGangs().filter((g) => g.members && g.members.length);
      if (night && gangs.length && Math.random() < 0.45) {
        const g = pick(gangs); const ms = g.members.map((m) => s.byId.get(m.id)).filter((q) => q && free(q) && q.age >= 12 && q.age <= 30);
        const q = ms.find((q) => nearP(q.agent.x, q.agent.y, 400)) || ms[0]; if (q) { const bs = s.world.buildings.filter((b) => b.doorX != null && Math.hypot(b.doorX * T - q.agent.x, b.doorY * T - q.agent.y) < 260); const b = pick(bs.length ? bs : s.world.buildings); const at = wallSpot(s, b); if (at) chalk(s, q, g.id, at, nearP(q.agent.x, q.agent.y, 420) && nearP(at.x, at.y, 420)); }
      }
      if (day && L.length && Math.random() < 0.35) {
        const m = L.find((m) => !m.fade && s.day - m.day >= 1 && !acting.some((a) => a.m === m)); if (m) { const watch = s.people.find((q) => isWatch(q) && free(q) && Math.hypot(q.agent.x - m.x, q.agent.y - m.y) < 220); const b = s.building(m.b); const owner = !watch && b && s.people.find((q) => q.home === m.b && q.age >= 16 && free(q) && Math.hypot(q.agent.x - m.x, q.agent.y - m.y) < 160);
          const who = watch || owner; if (who) scrub(s, who, m, nearP(m.x, m.y, 420)); else if (s.day - m.day > 5) L.splice(L.indexOf(m), 1); }
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene || !s._marks) return;
      const live = acting.filter((a) => a.kind === 'chalk' && a.there);
      const draw = (m, prog) => { const g = s.gang && s.gang(m.gid); const c = COL[g && g.colour] || '#e8e0cc', G = GLYPHS[glyphOf(m.gid)]; const x = Math.round(m.x - cam.x), y = Math.round(m.y - cam.y); if (x < -10 || y < -10 || x > ctx.canvas.width + 10 || y > ctx.canvas.height + 10) return; ctx.globalAlpha = 0.85 * (1 - (m.fade || 0)); ctx.fillStyle = c; let n = 0; const lim = Math.floor(25 * (prog ?? 1)); for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) { if (G[r][k] === '#') { if (n++ >= lim) continue; ctx.fillRect(x + k, y + r, 1, 1); } } if (m.x_by) { const g2 = s.gang && s.gang(m.x_by); ctx.fillStyle = COL[g2 && g2.colour] || '#e8e0cc'; for (let i = 0; i < 7; i++) { ctx.fillRect(x - 1 + i, y - 1 + i, 1, 1); ctx.fillRect(x + 5 - i, y - 1 + i, 1, 1); } } ctx.globalAlpha = 1; };
      for (const m of s._marks) draw(m);
      for (const a of live) draw({ x: a.at.x, y: a.at.y, gid: a.gid }, a.prog || 0);
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!s._marks || !s._marks.length) return ''; const near = s._marks.filter((m) => Math.hypot(m.x - q.agent.x, m.y - q.agent.y) < 200); if (!near.length) return ''; const names = [...new Set(near.map((m) => s.gang && s.gang(m.gid)?.name).filter(Boolean))]; if (!names.length) return ''; const mine = q.gang && near.some((m) => m.gid === q.gang); return `There ${near.length > 1 ? 'are gang signs' : 'is a gang sign'} chalked on the walls near here: ${names.join(' and ')}${near.some((m) => m.x_by) ? ', one crossed out by a rival' : ''}.${mine ? ' Your own lot chalked one of them.' : isWatch(q) ? ' You scrub them off when you can; it makes you angry.' : ' You know what they mean and keep your head down.'}`; });
    O.GangMarks = { acting, marks: () => marksOf(cur()), chalk: (q, b) => { const s = cur(); const at = wallSpot(s, s.building(b)); if (at) chalk(s, q, q.gang, at, true); return at; }, scrub: (q, m) => scrub(cur(), q, m, true) };
  }
  O.GangMarksSetup = { setup };
})();
