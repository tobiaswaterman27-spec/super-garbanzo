// A dropped purse: picked up by a passer-by and returned or kept, or picked up and handed back by you.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const setup = () => p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const o = s.people.find((q) => q.age >= 18 && q.agent && q.agent.inside == null && !q.agent.hidden && !q.agent.frozen && !q.errand && q.agent.path && q.agent.path.length > 2 && (s.household(q)?.money || 0) >= 6); if (!o) return 'no walker'; O.game.player.x = o.agent.x + 80; O.game.player.y = o.agent.y; O.DroppedPurse.soon(); return o.first; });
let who = null; for (let i = 0; i < 30 && !(await p.evaluate(() => !!O.DroppedPurse.drop)); i++) { who = await setup(); await p.waitForTimeout(700); }
console.log('owner:', who, 'drop:', await p.evaluate(() => !!O.DroppedPurse.drop));
// leave it: watch the town deal with it
for (let i = 0; i < 70 && (await p.evaluate(() => !!O.DroppedPurse.drop)); i++) await p.waitForTimeout(1000);
console.log('npc returned/kept/selfFound:', await p.evaluate(() => [O.DroppedPurse.npcReturned, O.DroppedPurse.npcKept, O.DroppedPurse.selfFound].join('/')));
// now you pick one up and hand it back
for (let i = 0; i < 30 && !(await p.evaluate(() => !!O.DroppedPurse.drop)); i++) { await setup(); await p.waitForTimeout(700); }
const before = await p.evaluate(() => O.PlayerState.money);
const r = await p.evaluate(() => { const D = O.DroppedPurse.drop; if (!D) return 'none'; const P = O.game.player; P.x = D.x; P.y = D.y + 4; const c = O.moreCandidates.map((f) => f()).find((x) => x && x.label === 'Pick up the purse'); if (!c) return 'no pickup'; c.act(); P.x = D.owner.agent.x + 20; P.y = D.owner.agent.y; const g = O.moreCandidates.map((f) => f()).find((x) => x && /back their purse/.test(x.label)); if (!g) return 'no give'; g.act(); return 'ok ' + D.stage; });
console.log('you:', r, 'returned', await p.evaluate(() => O.DroppedPurse.returned), 'money delta', (await p.evaluate(() => O.PlayerState.money)) - before);
await p.waitForTimeout(4500);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._dpurse).length));
// keep one, with somebody watching: on the record, and they go to the watch
await p.waitForTimeout(4000);
for (let i = 0; i < 30 && !(await p.evaluate(() => !!O.DroppedPurse.drop)); i++) { await setup(); await p.waitForTimeout(700); }
const k = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const s = O.SimRef.cur, D = O.DroppedPurse.drop; if (!D) return 'none'; const P = O.game.player; P.x = D.x; P.y = D.y + 4; const c = O.moreCandidates.map((f) => f()).find((x) => x && x.label === 'Pick up the purse'); if (!c) return 'no pickup'; c.act(); const w = s.people.find((q) => q !== D.owner && q.age >= 16 && q.agent && q.agent.inside == null && !q.agent.hidden && !q.task); if (w) { w.agent.x = P.x + 30; w.agent.y = P.y; } window._w = w; return 'picked'; });
await p.waitForTimeout(1500);
const k2 = await p.evaluate(() => { const w = window._w; const before = (O.PlayerState.crimes || []).length; const c2 = O.moreCandidates.map((f) => f()).find((x) => x && x.label === 'Keep the purse'); if (!c2) return 'no keep'; c2.act(); return 'crimes +' + ((O.PlayerState.crimes || []).length - before) + ' (town record ' + (O.SimRef.cur.crimes || []).length + ')' + ', witness ' + (w ? w.first + ' task ' + (w.task && w.task.act) : 'none'); });
console.log('kept:', k, k2);
await done();
