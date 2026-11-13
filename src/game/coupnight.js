// The night it comes to a head. When a hard member means to take the gang, it isn't settled in the dark of a
// ledger: on the night, the gang gather outside their den in a ring, the boss and the one who'd replace him
// face each other in the middle, words get louder, and then it's fists and boots until one of them is on the
// ground. The winner stands over him; the loser picks himself up and walks off into the dark, out of the gang
// or out of the boss's chair. If you run with them you're in that ring: step up behind the one you're backing,
// and everyone sees whose side you were on.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const mine = (s, gid) => (PS.gangRanks || []).some((m) => m.gid === gid && m.place === s.world.placeId);
    let C = null, held = 0, sided = 0; const staged = new Set();
    const rel_ = (q) => { if (!q || !q._coup) return; q._coup = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } };
    const pin = (q, x, y, dir) => { if (!near(q.agent.x, q.agent.y, 360) && !near(x, y, 360) || Math.hypot(q.agent.x - x, q.agent.y - y) > 700) { if (!near(q.agent.x, q.agent.y, 300)) { q.agent.x = x; q.agent.y = y; q.agent.path = null; q.agent.frozen = true; q.agent.dir = dir; q._at = true; return; } } O.Errands.send(C.s, q, [Math.floor(x / T), Math.floor(y / T)], { anim: 'idle', secs: 0.2, face: dir, giveUp: game.t + 40, after: (ok) => { if (!C || !C.ring.includes(q) && q !== C.boss && q !== C.plotter) return; if (!ok) { q.agent.x = x; q.agent.y = y; } q.agent.frozen = true; q.agent.path = null; q.agent.dir = dir; q._at = true; } }); };
    function begin(s, g) { const b = s.building(g.hideout); if (!b || b.doorX == null) return false; const boss = s.byId.get(g.leader), plotter = s.byId.get(g.plot.by); if (!boss || !plotter || boss.alive === false || plotter.alive === false) return false;
      staged.add(g.id + ':' + s.day); held++; let cx = b.doorX * T + 8, cy = (b.doorY + 3) * T;
      // the nearest open ground by the den: no tree crowns over the ring
      { const trees = s.world.trees || []; let best = null; for (let r = 0; r <= 160 && !best; r += 16) for (let k = 0; k < 12 && !best; k++) { const x = cx + Math.cos(k / 12 * Math.PI * 2) * r, y = cy + Math.sin(k / 12 * Math.PI * 2) * r; if (game.solidAt(x, y)) continue; if (trees.some((t) => Math.abs(t.x - x) < 56 && t.y > y - 30 && t.y < y + 70)) continue; best = [x, y]; } if (best) [cx, cy] = best; }
      const others = g.members.map((m) => s.byId.get(m.id)).filter((q) => q && q !== boss && q !== plotter && q.alive !== false && q.agent && !q.jailUntil && !q.errand && !q._scene && !talking(q)).slice(0, 6);
      C = { s, g, b, boss, plotter, ring: others, t: 0, x: cx, y: cy, stage: 'gather', side: null };
      for (const q of [boss, plotter, ...others]) { q._coup = true; if (q.agent.inside != null) { q.agent.inside = null; q.agent.hidden = false; q.agent.x = cx; q.agent.y = cy - 10; } }
      pin(boss, cx - 14, cy, 2); pin(plotter, cx + 14, cy, 1);
      others.forEach((q, i) => { const a = (i / Math.max(1, others.length)) * Math.PI * 2 + 0.4; pin(q, cx + Math.cos(a) * 44, cy + Math.sin(a) * 30, O.dirOf(-Math.cos(a), -Math.sin(a))); });
      if (near(cx, cy, 500)) ui(`Outside ${g.name}'s den the gang are gathering in a ring. ${plotter.first} has called ${boss.first} out.`, 'warn'); return true; }
    function end() { if (!C) return; for (const q of [C.boss, C.plotter, ...C.ring]) rel_(q); C = null; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return;
      if (!C) { const h = s.minute / 60; if (h < 20.5 || h > 23.5 || game.scene) return; for (const g of s.gangs || []) if (g.plot && s.day >= g.plot.day && !staged.has(g.id + ':' + s.day) && g.id !== 'player') { if (!begin(s, g)) { staged.add(g.id + ':' + s.day); O.GangPolitics && O.GangPolitics.resolve(s, g); } break; } return; }
      C.t += dt; const { boss, plotter, ring } = C; if (C.s !== s || C.t > 120) { if (C.g.plot) O.GangPolitics && O.GangPolitics.resolve(C.s, C.g); end(); return; }
      for (const q of ring) if (q._at) { q.agent.dir = O.dirOf(C.x - q.agent.x, C.y - q.agent.y); if (C.stage === 'fight' && Math.random() < dt * 0.8) O.gesture && O.gesture(q, pick(['celebrate', 'point', 'shocked']), 0.8); }
      if (C.stage === 'gather') { if (C.t > 22 || (boss._at && plotter._at && C.t > 6)) { C.stage = 'words'; C.t = 0; boss.agent.forceAnim = 'point'; plotter.agent.forceAnim = 'point'; } return; }
      boss.agent.dir = O.dirOf(plotter.agent.x - boss.agent.x, plotter.agent.y - boss.agent.y); plotter.agent.dir = O.dirOf(boss.agent.x - plotter.agent.x, boss.agent.y - plotter.agent.y);
      if (C.stage === 'words') { const lines = [[plotter, `You're finished, ${boss.first}. You've gone soft and fat on our takings.`], [boss, `Say that again, ${plotter.first}. To my face.`], [plotter, 'I\'ll say it with my fists.']]; const k = Math.floor(C.t / 3); if (k < lines.length && !C['w' + k]) { C['w' + k] = true; if (near(C.x, C.y, 420)) say(lines[k][0], lines[k][1], 2.6); }
        if (C.t > 10) { C.stage = 'fight'; C.t = 0; C.side = C.side || 'none'; } return; }
      if (C.stage === 'fight') { const f = Math.floor(C.t * 3) % 4; boss.agent.forceAnim = f < 2 ? 'attack' : 'hurt'; plotter.agent.forceAnim = f < 2 ? 'hurt' : 'attack'; boss.agent.x += Math.sin(C.t * 5) * 0.2; if (Math.random() < dt * 2.4 && near(C.x, C.y, 380)) O.sfx && O.sfx('smack', 0.35);
        if (C.t > 7) { const g = C.g, before = g.leader; if (g.plot) O.GangPolitics && O.GangPolitics.resolve(C.s, g); const won = g.leader === plotter.id ? plotter : boss, lost = won === boss ? plotter : boss; C.won = won; C.lost = lost; C.stage = 'after'; C.t = 0; won.agent.forceAnim = 'celebrate'; lost.agent.forceAnim = 'lie' in (O.Char.ANIMS || {}) ? 'lie' : 'hurt';
          if (near(C.x, C.y, 420)) { say(won, won === plotter ? `${g.name} are mine now. Anyone else?` : `Anyone else want my chair? No? Get him out of my sight.`, 2.8); ui(won === plotter ? `${boss.first} is on the ground. ${plotter.first} is boss of ${g.name} now.` : `${plotter.first} is on the ground. ${boss.first} keeps ${g.name}, and ${plotter.first} is out.`, 'warn'); } }
        return; }
      if (C.stage === 'after') { if (C.t > 3 && !C.left) { C.left = true; const lost = C.lost; lost.agent.forceAnim = null; lost._coup = false; lost.agent.frozen = false; const d = C.b; O.Errands.send(C.s, lost, [d.doorX + (Math.random() < 0.5 ? -12 : 12), d.doorY + 6], { anim: 'idle', secs: 0.5, giveUp: game.t + 40 }); } if (C.t > 6) end(); } });
    // step up behind the one you back
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!C || C.side || game.scene || P.locked || !mine(C.s, C.g.id) || (C.stage !== 'gather' && C.stage !== 'words')) return null; if (!near(C.x, C.y, 80)) return null;
      return { type: 'custom', d: 1, x: C.plotter.agent.x, y: C.plotter.agent.y - 34, label: `Step up behind ${C.plotter.first}`, act: () => side('plotter') }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!C || C.side || game.scene || P.locked || !mine(C.s, C.g.id) || (C.stage !== 'gather' && C.stage !== 'words')) return null; if (!near(C.x, C.y, 80)) return null;
      return { type: 'custom', d: 2, x: C.boss.agent.x, y: C.boss.agent.y - 34, label: `Stand by ${C.boss.first}, your boss`, act: () => side('boss') }; });
    function side(w) { if (!C || C.side) return; const P = game.player, g = C.g, pl = g.plot; C.side = w; sided++; const q = w === 'plotter' ? C.plotter : C.boss; P.x = q.agent.x + (w === 'plotter' ? 14 : -14); P.y = q.agent.y + 4; P.dir = w === 'plotter' ? 1 : 2; P.anim = 'idle';
      if (pl) { if (w === 'plotter') { if (!pl.backers.includes(0)) pl.backers.push(0); pl.against = false; } else { pl.backers = pl.backers.filter((x) => x !== 0); pl.against = true; } }
      say(q, w === 'plotter' ? 'Good. Now we\'ll see.' : 'I knew I could count on you.', 1.8); for (const z of C.ring) O.gesture && O.gesture(z, 'look', 1); ui(`You step up behind ${q.first}. Everyone in the ring sees it.`, 'info'); }
    (O.extraLines = O.extraLines || []).push((s, q) => C && (q === C.boss || q === C.plotter || C.ring.includes(q)) ? `Tonight ${C.plotter.first} has called out ${C.boss.first} for leadership of ${C.g.name}, outside the den, in front of the whole gang.` : '');
    O.CoupNight = { get scene() { return C; }, get held() { return held; }, get sided() { return sided; }, begin };
  }
  O.CoupNightSetup = { setup };
})();
