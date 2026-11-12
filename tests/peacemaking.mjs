// Making it up: a peacemaker brings two at odds together; and you do it yourself.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
console.log('natural pairs at odds in town:', await p.evaluate(() => { const s = O.SimRef.cur; let n = 0; for (const a of s.people) for (const [id, r] of a.rel) if (id > a.id && r.affinity < -0.25) n++; return n; }));
// make two neighbours fall out, with a priestly old head near, by you
const mk = () => p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute;
  const vis = s.people.filter((q) => q.age >= 18 && q.agent && q.agent.inside == null && !q.agent.hidden && !q.agent.frozen && !q.errand && !q._peace);
  for (const a of vis) { const b = vis.find((x) => x !== a && x.household !== a.household && Math.hypot(x.agent.x - a.agent.x, x.agent.y - a.agent.y) < 200 && Math.hypot(x.agent.x - a.agent.x, x.agent.y - a.agent.y) > 40); if (!b) continue;
    const m = vis.find((x) => x !== a && x !== b && Math.hypot(x.agent.x - a.agent.x, x.agent.y - a.agent.y) < 300); if (!m) continue;
    s.relate(a, b, -1); s.relate(b, a, -1); s.relate(a, b, 0.5); s.relate(b, a, 0.5); s.relate(m, a, 0.5); s.relate(m, b, 0.5); O.game.player.x = a.agent.x + 30; O.game.player.y = a.agent.y; return [a.id, b.id, m.id]; } return null; });
let ids = await mk(); console.log('pair:', !!ids);
await p.evaluate(() => O.Peacemaking.soon());
for (let i = 0; i < 20 && !(await p.evaluate(() => !!O.Peacemaking.scene)); i++) { await p.waitForTimeout(500); await p.evaluate(() => O.Peacemaking.soon()); }
console.log('npc scene:', await p.evaluate(() => { const M = O.Peacemaking.scene; return M ? `${M.a.first} & ${M.b.first} by ${M.m && M.m.first}` : 'none'; }));
for (let i = 0; i < 90 && (await p.evaluate(() => !!O.Peacemaking.scene)); i++) await p.waitForTimeout(1000);
console.log('made/failed:', await p.evaluate(() => [O.Peacemaking.made, O.Peacemaking.failed].join('/')));
// you bring a pair together
ids = await mk();
const r = await p.evaluate(async (ids) => { const s = O.SimRef.cur, a = s.byId.get(ids[0]), b = s.byId.get(ids[1]); const P = O.game.player; P.x = a.agent.x + 12; P.y = a.agent.y + 2; const r0 = a.rel.get(0) || { affinity: 0, familiar: 0 }; r0.affinity = 0.3; a.rel.set(0, r0); O.npcUI.openTalk(a); let heard = ''; await O.AIChat.say(a, `Come now, make it up with ${b.first}. Life is short.`, (l) => { heard = typeof l === 'string' ? l : JSON.stringify(l); }); return heard; }, ids);
console.log('you:', r); 
for (let i = 0; i < 90 && (await p.evaluate(() => !!O.Peacemaking.scene)); i++) await p.waitForTimeout(1000);
console.log('byYou/failed:', await p.evaluate(() => [O.Peacemaking.byYou, O.Peacemaking.byYouFailed].join('/')));
await p.waitForTimeout(2000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._peace).length));
// someone bears YOU a grudge; a friend of you both brings them to you
const y = await p.evaluate(() => { const s = O.SimRef.cur; const vis = s.people.filter((q) => q.age >= 18 && q.agent && q.agent.inside == null && !q.agent.hidden && !q.agent.frozen && !q.errand && !q._peace && !q.visitor);
  for (const g of vis) { const m = vis.find((x) => x !== g && Math.hypot(x.agent.x - g.agent.x, x.agent.y - g.agent.y) < 200 && Math.hypot(x.agent.x - g.agent.x, x.agent.y - g.agent.y) > 30); if (!m) continue; g.rel.set(0, { affinity: -0.32, familiar: 0.5 }); g.grudge = { why: 'you cheated me at dice', day: s.day, level: 0.25 }; m.rel.set(0, { affinity: 0.7, familiar: 0.6 }); s.relate(m, g, 0.5); for (const o of vis) if (o !== g && o !== m && (o.rel.get(0) || {}).affinity < -0.3) o.rel.set(0, { affinity: 0, familiar: 0.1 }); O.game.player.x = g.agent.x + 60; O.game.player.y = g.agent.y + 20; return g.first + ' (go-between ' + m.first + ')'; } return null; });
console.log('grudge:', y, await p.evaluate(() => { const s = O.SimRef.cur; return 'hr ' + (s.minute / 60).toFixed(1) + ' scene ' + !!O.game.scene + ' talking ' + !!(O.npcUI.talking()) + ' dialog ' + (O.UI.dialogOpen && O.UI.dialogOpen()); }));
for (let i = 0; i < 8 && !(await p.evaluate(() => !!O.Peacemaking.you)); i++) { await p.evaluate(() => O.Peacemaking.youSoon()); await p.waitForTimeout(600); }
for (let i = 0; i < 50 && !(await p.evaluate(() => O.Peacemaking.you && O.Peacemaking.you.stage === 'face')); i++) await p.waitForTimeout(1000);
const h = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); if (O.npcUI.talking()) O.npcUI.closeTalk(); O.game.player.locked = false; const Y = O.Peacemaking.you; if (!Y) return 'none'; const c = O.moreCandidates.map((f) => f()).find((x) => x && /your hand/.test(x.label)); if (!c) return 'no prompt (' + Y.stage + ' d=' + Math.round(Math.hypot(Y.g.agent.x - O.game.player.x, Y.g.agent.y - O.game.player.y)) + ' locked=' + O.game.player.locked + ' talk=' + !!O.npcUI.talking() + ')'; c.act(); return c.label; });
console.log('why:', await p.evaluate(() => O.Peacemaking.yWhy)); console.log('you:', h, 'made/failed with you:', await p.evaluate(() => [O.Peacemaking.yMade, O.Peacemaking.yFailed].join('/')));
await p.waitForTimeout(6000);
console.log('held after:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._peace && !q.errand).length));
await done();
