// The boss walks with company. When a gang's boss goes about the streets, two of the gang's heaviest
// fall in a pace behind him, one at each shoulder, looking about; people step out of their way.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const escorts = new Map(); let scan = 0;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._fighting && !q.jailUntil && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || game.scene) return; const P = game.player;
      for (const [boss, E] of escorts) { const a = boss.agent; E.idle = a.path ? 0 : (E.idle || 0) + dt; const end = boss.alive === false || a.hidden || a.inside != null || E.idle > 4 || E.men.some((m) => m.alive === false || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === m)) || Math.hypot(a.x - P.x, a.y - P.y) > 600;
        if (end) { for (const m of E.men) { m._guard = null; m.agent.frozen = false; m.agent.forceAnim = null; } escorts.delete(boss); continue; }
        const dv = O.Char.DIRV ? (O.Char.DIRV[a.dir] || [0, 1]) : [0, 1]; E.men.forEach((m, i) => { const side = i ? 1 : -1, tx = a.x - dv[0] * 14 + (-dv[1]) * side * 9, ty = a.y - dv[1] * 9 + dv[0] * side * 6, ma = m.agent, dx = tx - ma.x, dy = ty - ma.y, d = Math.hypot(dx, dy); if (d > 1) { const st = Math.min(d, (d > 30 ? 90 : 46) * dt); ma.x += dx / d * st; ma.y += dy / d * st; ma.dir = O.dirOf(dx, dy); ma.forceAnim = 'walk'; } else { ma.dir = a.dir; ma.forceAnim = Math.floor(performance.now() / 2000 + i) % 3 === 0 ? 'look' : 'idle'; } });
        if (Math.random() < dt * 1.5) for (const o of s.people) { if (o === boss || E.men.includes(o) || !o.agent || o.agent.hidden || o.agent.inside != null || o.agent.frozen || o._sawBoss === boss || Math.hypot(o.agent.x - a.x, o.agent.y - a.y) > 50) continue; o._sawBoss = boss; O.gesture && O.gesture(o, o.gang === boss.gang ? 'nod' : 'look', 1.4); } }
      scan -= dt; if (scan > 0) return; scan = 2;
      for (const g of (s.npcGangs ? s.npcGangs() : [])) { const boss = s.byId.get(g.leader) || s.byId.get((g.members.find((m) => m.role === 'lieutenant' || m.role === 'enforcer') || g.members[0] || {}).id); if (!boss || escorts.has(boss) || !free(boss) || !boss.agent.path || Math.hypot(boss.agent.x - P.x, boss.agent.y - P.y) > 420) continue;
        const men = g.members.map((m) => s.byId.get(m.id)).filter((q) => q !== boss && free(q) && Math.hypot(q.agent.x - boss.agent.x, q.agent.y - boss.agent.y) < 260).sort((a, b) => (b.age > 20 ? 1 : 0) - (a.age > 20 ? 1 : 0)).slice(0, 2);
        if (men.length < 2) continue; for (const m of men) { m._guard = boss; m.agent.frozen = true; m.agent.path = null; } escorts.set(boss, { men }); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => q._guard ? `You are walking at ${q._guard.first}'s shoulder as their muscle; you say little and watch everyone.` : '');
    O.GangBoss = { escorts };
  }
  O.GangBossSetup = { setup };
})();
