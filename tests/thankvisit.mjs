// Thanks, returned: someone done a kindness by a neighbour calls at their door with a gift.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const ad = s.people.filter((q) => q.age >= 18 && q.home != null && q.agent && !q.agent.frozen && !q.errand && s.building(q.home)?.doorX != null); const b = ad[0], q = ad.find((x) => x.home !== b.home); s.remember(q, `${b.first} carried my load home for me, God bless them.`, 'kindness', 0.6, b.id); const hb = s.building(b.home); O.game.player.x = hb.doorX * 16 + 8; O.game.player.y = (hb.doorY + 4) * 16; O.ThankVisit.soon(); });
for (let i = 0; i < 70 && !(await p.evaluate(() => O.ThankVisit.visits)); i++) await p.waitForTimeout(1000);
console.log('thanks visits:', await p.evaluate(() => O.ThankVisit.visits));
await p.waitForTimeout(4000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._thank).length));
await done();
