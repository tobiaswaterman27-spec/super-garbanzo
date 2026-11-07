// Smugglers by night. After midnight, where the town comes down to the water, a little boat noses in
// without a light, and a gang's men carry the casks up from it on their shoulders, two and three
// trips, to their den or the tavern's back door, while one of them keeps watch at the corner. If the
// watch come near, the lookout whistles and they drop everything and run; the casks lie in the road
// for the watch to find. You can watch from the dark, lend a shoulder (ask them), or tell the watch.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.6);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const isWatch = (q) => /guard|sergeant|watch|captain|constable/.test(q.job?.role || '');
    let run = null, cool = 30; const dropped = [];
    function landing(s) { const w = s.world, TR = w.TER; if (!TR || !w.ter) return null; const P = game.player, px = Math.floor(P.x / T), py = Math.floor(P.y / T); let best = null, bd = 1e9;
      for (let y = py - 22; y < py + 22; y++) for (let x = px - 30; x < px + 30; x++) { if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1) continue; const i = y * w.W + x; if (w.ter[i] === TR.WATER || w.solid[i]) continue; const wd = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => w.ter[(y + dy) * w.W + x + dx] === TR.WATER); if (!wd) continue; const d = Math.hypot(x - px, y - py); if (d > 8 && d < bd) { bd = d; best = { x, y, wd }; } }
      return best; }
    function begin(s, force) {
      const gangs = (s.npcGangs ? s.npcGangs() : []).filter((g) => g.members && g.members.length >= 3); const g = force?.g || pick(gangs); if (!g) return null;
      const L = landing(s); if (!L) return null;
      const cands = [s.building(g.hideout), s.building(s.tavernId), ...s.world.buildings.slice().sort((a, b) => Math.hypot(a.doorX - L.x, a.doorY - L.y) - Math.hypot(b.doorX - L.x, b.doorY - L.y)).slice(0, 6)].filter((b) => b && b.doorX != null);
      let den = null, path = null; for (const b of cands) { const pth = s.path.find(L.x, L.y, b.doorX, b.doorY + 1); if (pth && pth.length <= 40) { den = b; path = pth; break; } } if (!den) return null;
      const ppl = g.members.map((m) => s.byId.get(m.id)).filter((q) => q && q.alive !== false && q.agent && !q.jailUntil && !q.errand && !q._scene && !q._fighting && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)).slice(0, 4); if (ppl.length < 3) return null;
      const bx = L.x * T + 8 + L.wd[0] * 14, by = L.y * T + 10 + L.wd[1] * 10; const land = [L.x * T + 8, L.y * T + 10]; const door = [den.doorX * T + 8, (den.doorY + 1) * T + 10];
      const way = path.map(([x, y]) => [x * T + 8, y * T + 10]);
      const look = ppl[ppl.length - 1], carriers = ppl.slice(0, -1); const lk = way[Math.floor(way.length / 2)];
      for (const q of ppl) { q._smug = true; const a = q.agent; a.inside = null; a.hidden = false; a.frozen = true; a.path = null; a.x = land[0] + (Math.random() - 0.5) * 10; a.y = land[1] + (Math.random() - 0.5) * 6; }
      look.agent.x = lk[0]; look.agent.y = lk[1];
      run = { s, g, boat: [bx, by], land, door, way, carriers: carriers.map((q, i) => ({ q, leg: 'load', i: 0, t: -i * 1.5, cask: false, trips: 0 })), look, casks: 6, t: 0, den };
      return run;
    }
    function end(scatter) { const r = run; if (!r) return; for (const q of [...r.carriers.map((c) => c.q), r.look]) { q._smug = false; q.agent.forceAnim = null; q.agent.carrying = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; if (!scatter && q.alive !== false) { q.agent.inside = r.den.id; q.agent.hidden = true; } } run = null; cool = 200 + Math.random() * 200; }
    function bust(by) { const r = run; if (!r || r.bust) return; r.bust = 1; say(r.look, pick(['Psst! The WATCH!', '*whistles* Scatter!', 'Run!']), 1.6); O.sfx && near(r.look.agent.x, r.look.agent.y, 400) && O.sfx('whoosh', 0.3);
      for (const c of r.carriers) if (c.cask) dropped.push({ x: c.q.agent.x + 6, y: c.q.agent.y, t: 0, s: r.s }); r.flee = [...r.carriers.map((c) => c.q), r.look].map((q) => ({ q, to: [q.agent.x + (Math.random() - 0.5) * 400, q.agent.y + (Math.random() - 0.5) * 300] }));
      if (by && Math.random() < 0.5) { const q = pick(r.carriers).q; const cr = r.s.recordCrime({ kind: 'smuggling', perp: q, gang: r.g.id, placeName: 'the waterside', tile: [Math.floor(q.agent.x / T), Math.floor(q.agent.y / T)], seen: [by], severity: 2 }); setTimeout(() => r.s.arrestNPC && r.s.arrestNPC(q, cr, false), 2500); say(by, `Stop! You, ${q.first}! In the King's name!`, 2); } }
    function step(q, tx, ty, dt, sp, an) { const a = q.agent, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 2) return true; const st = Math.min(d, sp * dt); a.x += dx / d * st; a.y += dy / d * st; a.dir = O.dirOf(dx, dy); a.forceAnim = an; return false; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world) return; for (const d of dropped.slice()) { d.t += dt; if (d.t > 600 || d.s !== s) dropped.splice(dropped.indexOf(d), 1); }
      if (!run) { cool -= dt; if (cool > 0 || game.scene) return; cool = 20; const h = s.minute / 60; if (!(h >= 0.5 && h < 3.5)) return; if (Math.random() < 0.4) begin(s); return; }
      const r = run; r.t += dt; if (r.s !== s || game.scene || r.t > 240) { end(true); return; }
      if (r.flee) { let all = true; for (const f of r.flee) if (!step(f.q, f.to[0], f.to[1], dt, 70, 'run') && r.t < 400) all = false; r.fleeT = (r.fleeT || 0) + dt; if (all || r.fleeT > 8) end(true); return; }
      // the lookout
      const la = r.look.agent; la.forceAnim = Math.floor(r.t / 2) % 3 ? 'look' : 'idle'; la.dir = Math.floor(r.t / 3) % 4;
      const w = s.people.find((q) => isWatch(q) && q.agent && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - la.x, q.agent.y - la.y) < 140); if (w) { bust(Math.random() < 0.6 ? w : null); return; }
      // the carriers: down to the boat, up with a cask, along the way to the door, and back
      for (const c of r.carriers) { const q = c.q; if (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) continue; c.t += dt; if (c.t < 0) continue;
        if (c.leg === 'load') { if (step(q, r.land[0], r.land[1], dt, 40, 'walk')) { q.agent.forceAnim = 'pickup'; q.agent.dir = O.dirOf(r.boat[0] - q.agent.x, r.boat[1] - q.agent.y); if (c.t > 1.5) { if (r.casks <= 0) { c.leg = 'done'; continue; } r.casks--; c.cask = true; c.leg = 'up'; c.i = 0; O.sfx && near(q.agent.x, q.agent.y, 200) && O.sfx('place', 0.2); } } else c.t = 0; }
        else if (c.leg === 'up') { const tgt = r.way[c.i]; if (!tgt) { c.leg = 'drop'; c.t = 0; continue; } if (step(q, tgt[0], tgt[1], dt, 30, 'carry')) c.i++; }
        else if (c.leg === 'drop') { q.agent.forceAnim = 'place'; if (c.t > 1.2) { c.cask = false; c.trips++; c.leg = 'down'; c.i = r.way.length - 1; O.sfx && near(q.agent.x, q.agent.y, 200) && O.sfx('door', 0.15); if (r.g) r.g.purse = (r.g.purse || 0) + 3; } }
        else if (c.leg === 'down') { const tgt = r.way[c.i]; if (!tgt) { c.leg = 'load'; c.t = 0; continue; } if (step(q, tgt[0], tgt[1], dt, 42, 'walk')) c.i--; }
        else if (c.leg === 'done') { step(q, r.door[0], r.door[1], dt, 40, 'walk'); } }
      if (r.carriers.every((c) => c.leg === 'done' && Math.hypot(c.q.agent.x - r.door[0], c.q.agent.y - r.door[1]) < 4)) end(false);
      if (Math.random() < dt * 0.05 && near(la.x, la.y, 250)) say(r.look, pick(['Quiet, you lot.', 'Hurry it up.', 'Mind the steps, that\'s the good stuff.']), 1.6);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; const r = run;
      const cask = (x, y) => { ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 3, y - 4, 7, 6); ctx.fillStyle = '#3a3a42'; ctx.fillRect(x - 3, y - 3, 7, 1); ctx.fillRect(x - 3, y, 7, 1); };
      if (r) { const [bx, by] = r.boat, x = Math.round(bx - cam.x), y = Math.round(by - cam.y); ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.moveTo(x - 14, y - 3); ctx.lineTo(x + 14, y - 3); ctx.lineTo(x + 10, y + 3); ctx.lineTo(x - 10, y + 3); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 12, y - 4, 24, 1); for (let i = 0; i < Math.min(r.casks, 6); i++) cask(x - 8 + (i % 3) * 7, y - 1 - Math.floor(i / 3) * 4);
        for (const c of r.carriers) if (c.cask) { const a = c.q.agent; cask(Math.round(a.x - cam.x), Math.round(a.y - cam.y) - 22); } }
      for (const d of dropped) cask(Math.round(d.x - cam.x), Math.round(d.y - cam.y));
    });
    // speech: help them, or tell the watch
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) {
      try { const r = run, t = String(text || ''), s = cur();
        if (r && !r.bust && (r.carriers.some((c) => c.q === q) || q === r.look) && /\b(help|hand|carry|shoulder|lift)\b/i.test(t)) { PS.money += 3; s.relate(q, { id: 0 }, 0.2); if (r.g && r.g.rel && r.g.rel.player !== 'enemy') r.g.rel.player = 'friend'; r.casks = Math.max(0, r.casks - 2); s.remember(q, 'The stranger put a shoulder to our casks by the water one night. One of us, near enough.', 'crime', 2); return respond(q, t, 'Quick then, and quiet. Two up to the door. Here, three for your trouble, and you never saw a boat.', render); }
        if (r && !r.bust && isWatch(q) && /\b(smuggl|boat|casks?|barrels?|contraband)\b/i.test(t)) { const w = q; setTimeout(() => { if (run !== r) return; O.npcUI && O.npcUI.talking && O.npcUI.talking() === w && O.npcUI.closeTalk(); const la = r.look.agent; O.Errands && O.Errands.send(s, w, [Math.floor(la.x / T), Math.floor(la.y / T)], { sprint: true, anim: 'point', secs: 1.5, face: 0, giveUp: game.t + 60, at: () => { if (run === r) bust(w); } }); }, 1500); PS.rep.guard = Math.min(1, (PS.rep.guard || 0) + 0.05); if (r.g && r.g.rel) r.g.rel.player = 'enemy'; return respond(q, t, 'Smugglers? At this hour? Right. Stay here.', render); }
        if (dropped.length && isWatch(q) && /\b(casks?|barrels?)\b/i.test(t)) { const n = dropped.length; dropped.length = 0; s.treasury && (s.treasury.cash += n * 4); return respond(q, t, `${n} casks in the road? Contraband, and the town's now. Good eye.`, render); }
      } catch (e) { console.error(e); }
      return _say.apply(this, arguments);
    };
    (O.extraLines = O.extraLines || []).push((s, q) => q._smug ? 'It is the dead of night and you are running smuggled casks up from a boat for your gang. Whisper; you want no witnesses. If the player asks to help, you might let them for a few coins.' : '');
    O.Smuggle = { start: () => begin(cur(), true), get run() { return run; }, dropped, bust };
  }
  O.SmuggleSetup = { setup };
})();
