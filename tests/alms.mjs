import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const s = O.SimRef.cur; const q = s.people.find((q) => !q.visitor && q.age >= 18 && q.age < 60 && q.agent && !q.gentry && !q.title && !q.gang && q.household && s.household(q)); if (q.job && q.job.biz != null) { const bz = s.biz.get(q.job.biz); if (bz) bz.workers = bz.workers.filter((i) => i !== q.id); } q.job = null; s.household(q).money = 2; q.needs.hunger = 80; for (let i = 0; i < 20; i++) s.tick(1); const b = s.building(s.chapelId); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 3) * 16; window._b = q; return `${q.first} poor ${O.Alms.poor(q)} act ${q.activity && q.activity.act}`; });
console.log(r);
for (let i = 0; i < 10; i++) await p.waitForTimeout(3000);
console.log('beggars now', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.activity && q.activity.act === 'beg').map((q) => q.first + (q.agent.path ? '(walking)' : '(sitting)') + ' bowl ' + (O.Alms.bowls.get(q) || 0)).join(', ')));
await done();
