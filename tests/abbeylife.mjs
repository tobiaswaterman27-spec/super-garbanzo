// The abbey's day: herb beds hoed, skeps tended veiled, a brother reading as he walks, the office chanted at the cross.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => O.teleport('greenvale')); await p.waitForTimeout(3000);
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'summer', configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const [x, y] = O.AbbeyLife.find(); O.game.player.x = x + 60; O.game.player.y = y + 80; });
await p.waitForTimeout(2000);
for (const k of ['hoe', 'bees', 'walk']) console.log(k, await p.evaluate((k) => O.AbbeyLife.start(k), k));
await p.waitForTimeout(20000);
console.log('at work:', await p.evaluate(() => O.AbbeyLife.jobs.map((j) => j.kind + ' ' + j.q.first + ' (' + j.q.job.role + ') ' + j.q.agent.forceAnim).join(' | ')));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/abbey.png' });
await p.waitForTimeout(50000);
console.log('proc', await p.evaluate(() => O.AbbeyLife.start('proc')));
await p.waitForTimeout(25000);
console.log('kneeling:', await p.evaluate(() => O.AbbeyLife.procs.map((P) => P.ppl.map((q) => q.agent.forceAnim).join(',')).join(' | ')));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/abbey-proc.png' });
await p.waitForTimeout(50000);
console.log('after:', await p.evaluate(() => O.AbbeyLife.procs.length + ' procs; held ' + O.SimRef.cur.people.filter((q) => q._abbey).length + ' jobs ' + O.AbbeyLife.jobs.length));
await done();
