// Beating the bounds. On a morning in Rogation week, late in spring, the priest walks the parish boundary
// with a cross held up before him and the folk behind in a long line, the boys carrying willow wands. At
// each boundary stone they stop, the priest blesses it and prays for the crops, and the boys beat the
// stone with their wands; and one boy is bumped on it, swung up by the arms and legs and set down hard,
// so that he'll remember all his life where the bound runs.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let R = null, done = -1, stones = 0, forced = false;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._rog && !talking(q);
    const rogationDay = (s) => forced || (s.season === 'spring' && ((s.weather && s.weather.dayOfSeason) || 0) === 11);
    function end() { if (!R) return; for (const q of R.line) { const a = q.agent; if (!a) continue; a.forceAnim = null; a.lift = 0; if (!talking(q)) a.frozen = false; q._rog = false; } R = null; }
    function next() { const s = R.s, p = R.line[0]; if (!R.stops.length) { near(p.agent.x, p.agent.y, 300) && O.Speech && O.Speech.say(p, 'The bounds are walked. God bless the fields, and all of you.', 3); end(); return; } const st = R.stops.shift(); R.at = st; R.phase = 'walk'; p.agent.frozen = false;
      O.Errands.send(s, p, [Math.floor(st[0] / T), Math.floor(st[1] / T) - 1], { anim: 'idle', secs: 0.1, face: 0, giveUp: game.t + 70, after: (ok) => { if (!R) return; if (!ok) { next(); return; } p.agent.frozen = true; p.agent.path = null; R.phase = 'stone'; R.t = 0; R.bumped = false; } }); }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (R) { R.t += dt; R.all += dt; const p = R.line[0]; if (R.s !== s || !p.agent || R.all > 360 || s.raining || R.line.some(talking)) { end(); return; }
        R.trail.push([p.agent.x, p.agent.y]); if (R.trail.length > 160) R.trail.shift();
        R.line.slice(1).forEach((q, i) => { const a = q.agent; a.frozen = true; a.path = null; if (R.phase === 'stone' && q === R.boy && R.t > 5 && R.t < 9) return; const k = Math.max(0, R.trail.length - 1 - (i + 1) * 7), [tx, ty] = R.trail[k]; const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d > 1) { a.x += dx * Math.min(1, dt * 4); a.y += dy * Math.min(1, dt * 4); a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : dy > 0 ? 0 : 3; a.forceAnim = 'walk'; } else a.forceAnim = R.phase === 'stone' ? (q.age < 15 && R.t > 2 && R.t < 5 ? 'attack' : 'pray') : 'idle'; });
        if (R.phase === 'stone') { p.agent.forceAnim = R.t < 4 ? 'pray' : 'point'; p.agent.dir = 0;
          if (!R.said && R.t > 0.5) { R.said = true; stones++; near(p.agent.x, p.agent.y, 320) && O.Speech && O.Speech.say(p, pick(['Cursed is he that removeth his neighbour\'s mark.', 'Bless this bound, and the corn within it.', 'Here runs our parish. Mark it well.']), 3.5); }
          if (R.t > 2 && R.t < 5 && Math.random() < dt * 4 && near(p.agent.x, p.agent.y, 260)) O.sfx && O.sfx('smack', 0.08);
          if (R.t > 5 && !R.bumped) { R.bumped = true; R.boy = R.line.find((q) => q.age >= 7 && q.age < 14) || null; if (R.boy) { const a = R.boy.agent; a.x = R.at[0]; a.y = R.at[1] + 2; near(a.x, a.y, 300) && O.Speech && O.Speech.say(R.boy, pick(['Ow! I\'ll remember!', 'Not me again!', 'Owww!']), 2); } }
          if (R.boy && R.t > 5 && R.t < 9) { const a = R.boy.agent, k = (R.t - 5) % 1.3; a.lift = Math.round(Math.sin((k / 1.3) * Math.PI) * 14); a.forceAnim = 'shocked'; if (k < 0.05 && near(a.x, a.y, 260)) O.sfx && O.sfx('place', 0.3); } else if (R.boy) R.boy.agent.lift = 0;
          if (R.t > 10) { R.said = false; next(); } }
        return; }
      if (!rogationDay(s) || hr < 9 || hr > 12 || done === s.day || s.raining) return;
      const P = game.player, priest = s.people.find((q) => free(q) && /priest|friar|chaplain/.test(q.job?.role || '')); if (!priest) return;
      // the bound stones: the wayside crosses and milestones out along the roads, else points round the edge of town
      const F = O.Countryside && O.Countryside.features(); let pts = F ? F.cross.map((c) => [c.x, c.y]) : []; const w = s.world;
      if (pts.length < 3 && w.ox != null) { const x0 = w.ox * T - 40, y0 = w.oy * T - 40, x1 = (w.ox + w.townW) * T + 40, y1 = (w.oy + w.townH) * T + 40; pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].filter(([x, y]) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx > 1 && ty > 1 && tx < w.W - 1 && ty < w.H - 1 && !w.solid[ty * w.W + tx]; }); }
      pts = pts.sort((a, b) => Math.hypot(a[0] - P.x, a[1] - P.y) - Math.hypot(b[0] - P.x, b[1] - P.y)).slice(0, 3); if (!pts.length) return;
      const folk = s.people.filter((q) => free(q) && q !== priest && ((!q.agent.hidden && q.agent.inside == null) || q.agent.inside === q.home) && ['home', 'idle', 'stroll', 'play', 'socialise', 'worship', 'pastime-none'].includes(q.activity?.act)).sort((a, b) => (a.age < 14 ? 0 : 1) - (b.age < 14 ? 0 : 1)).slice(0, 7);
      if (folk.length < 3) return; done = s.day; forced = false; const line = [priest, ...folk];
      for (const q of line) { q._rog = true; if (q.agent.inside != null) { const hb = s.building(q.agent.inside); if (hb && hb.doorX != null) { q.agent.x = hb.doorX * T + 8; q.agent.y = (hb.doorY + 1) * T + 8; } q.agent.inside = null; q.agent.hidden = false; } }
      R = { s, line, stops: pts, t: 0, all: 0, trail: [[priest.agent.x, priest.agent.y]], phase: 'walk' }; near(priest.agent.x, priest.agent.y, 400) && O.Speech && O.Speech.say(priest, 'Come, all of you. We walk the bounds today.', 3); next();
    });
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (!R || game.scene || R.s !== s) return;
      const a = R.line[0].agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 6, y - 40, 1, 30); ctx.fillStyle = '#d8b040'; ctx.fillRect(x + 4, y - 44, 5, 1); ctx.fillRect(x + 6, y - 46, 1, 6);
      for (const q of R.line.slice(1)) { if (q.age >= 14) continue; const b = q.agent, bx = Math.round(b.x - cam.x), by = Math.round(b.y - cam.y) - (b.lift || 0); ctx.strokeStyle = '#8aaa5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + 4, by - 14); ctx.lineTo(bx + 9, by - 28); ctx.stroke(); }
      if (R.at && R.phase === 'stone') { const sx = Math.round(R.at[0] - cam.x), sy = Math.round(R.at[1] - cam.y); ctx.fillStyle = '#9a968e'; ctx.fillRect(sx - 3, sy - 7, 6, 7); ctx.fillStyle = '#b8b4ac'; ctx.fillRect(sx - 3, sy - 7, 6, 1); } });
    (O.extraLines = O.extraLines || []).push((s, q) => R && R.line.includes(q) ? (q === R.line[0] ? 'It is Rogation: you are leading the parish round its bounds with the cross, blessing each boundary stone.' : 'It is Rogation: you are walking the parish bounds behind the priest, stopping at each boundary stone.') : '');
    O.Rogation = { get walk() { return R; }, get stones() { return stones; }, force: () => { done = -1; forced = true; } };
  }
  O.RogationSetup = { setup };
})();
