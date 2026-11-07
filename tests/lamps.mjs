import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 19) s.tick(2); O.game.clock.minute = s.minute; const L = O.Lamps.list(); const l = L[0]; O.game.player.x = l.x; O.game.player.y = l.y + 40; });
console.log('lamps', await p.evaluate(() => O.Lamps.list().length));
await p.evaluate(() => { const s = O.SimRef.cur; while (s.minute < 19.6 * 60) s.tick(1); O.game.clock.minute = s.minute; });
for (let i = 0; i < 6; i++) { await p.waitForTimeout(4000); console.log(await p.evaluate(() => `lit ${O.Lamps.list().filter((l) => l.lit).length}/${O.Lamps.list().length} job ${O.Lamps.job ? O.Lamps.job.q.first + ' ' + O.Lamps.job.stage + ' left ' + O.Lamps.job.list.length : '-'}`)); }
if (D) await p.screenshot({ path: `${D}/lamps.png` });
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 7) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(20000);
console.log('morning', await p.evaluate(() => `lit ${O.Lamps.list().filter((l) => l.lit).length} job ${O.Lamps.job ? O.Lamps.job.stage : '-'} held ${O.SimRef.cur.people.filter((q) => q._lamp).length}`));
await done();
