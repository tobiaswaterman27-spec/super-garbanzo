import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const g = s.npcGangs().find((g) => g.members.length >= 3); if (!g) return 'no gang'; const boss = s.byId.get(g.leader) || s.byId.get((g.members.find((m) => m.role === 'lieutenant' || m.role === 'enforcer') || g.members[0]).id); const ms = g.members.map((m) => s.byId.get(m.id)).filter(Boolean); ms.forEach((q, i) => { const a = q.agent; a.hidden = false; a.inside = null; a.frozen = false; a.path = null; a.x = P.x + 20 + i * 12; a.y = P.y + 20; q.errand = null; q._bit = null; q.jailUntil = 0; }); s.route(boss, { act: 'stroll', outdoor: true, zone: 'east' }); window._boss = boss; return boss.first + ' of ' + g.name + ' walking, path ' + (boss.agent.path ? boss.agent.path.length : 0); });
console.log(r);
await p.waitForTimeout(5000);
console.log('escort:', await p.evaluate(() => { const E = O.GangBoss.escorts.get(window._boss); return E ? E.men.map((m) => m.first + ' d' + Math.round(Math.hypot(m.agent.x - _boss.agent.x, m.agent.y - _boss.agent.y))).join(', ') : 'none'; }));
await done();
