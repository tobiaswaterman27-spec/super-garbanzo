// A good name: nods, blessings, children at your side, a gift pressed on you; and a townsman out of gaol shunned.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; const PS = O.PlayerState; PS.rep.civilian = 0.6; PS.almsToPoor = 20; });
console.log('why:', await p.evaluate(() => JSON.stringify(O.GoodName.why())));
// walk past folk
for (let k = 0; k < 14; k++) { await p.evaluate((k) => { const s = O.SimRef.cur, P = O.game.player; const out = s.people.filter((q) => q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand && q.age >= 5); const q = out[(k * 7) % out.length]; if (q) { P.x = q.agent.x + 20; P.y = q.agent.y + 6; } }, k); await p.waitForTimeout(1200); }
console.log('nodded/walked/gifts:', await p.evaluate(() => [O.GoodName.nodded, O.GoodName.walked, O.GoodName.gifts].join('/')));
// gift forced
const gift = await p.evaluate(() => { const s = O.SimRef.cur; for (const q of s.people) { const hh = s.household(q); if (hh) hh.money = Math.max(hh.money || 0, 60); } const r = Math.random; Math.random = () => 0.01; setTimeout(() => { Math.random = r; }, 2500); return 'forced'; });
for (let k = 0; k < 6; k++) { await p.evaluate((k) => { const s = O.SimRef.cur, P = O.game.player; const out = s.people.filter((q) => q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand && q.age >= 18); const q = out[(k * 5 + 3) % out.length]; if (q) { P.x = q.agent.x + 20; P.y = q.agent.y + 6; } }, k); await p.waitForTimeout(800); }
await p.waitForTimeout(2000);
console.log('gifts:', await p.evaluate(() => O.GoodName.gifts));
// the gaolbird
const gb = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const z = s.people.find((q) => q.age >= 20 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand); z._gaolbird = s.day; const y = s.people.find((q) => q !== z && q.age >= 14 && q.home !== z.home && q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand); y.agent.x = z.agent.x + 18; y.agent.y = z.agent.y; P.x = z.agent.x; P.y = z.agent.y + 80; return z.first + ' by ' + y.first; });
console.log('gaolbird:', gb); for (let i = 0; i < 8; i++) { await p.evaluate(() => { const s = O.SimRef.cur; const z = s.people.find((q) => q._gaolbird === s.day && !q.jailUntil); const y = s.people.find((q) => q !== z && q.age >= 14 && q.home !== z.home && q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand && !q.agent.frozen); if (y && O.GoodName.npcShun === 0) { y.agent.x = z.agent.x + 18; y.agent.y = z.agent.y; y.agent.path = null; } }); await p.waitForTimeout(600); }
console.log('npcShun:', await p.evaluate(() => O.GoodName.npcShun));
await done();
