// Housework at the door: hens fed, a fowl plucked, butter churned, kindling split, a rug beaten.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(1000);
for (const k of ['hens', 'pluck', 'churn', 'kindling', 'rug', 'rushes']) console.log(k, await p.evaluate((k) => O.Doorstep.start(k), k));
await p.waitForTimeout(20000);
console.log('at work:', await p.evaluate(() => O.Doorstep.jobs.map((j) => j.kind + (j.hens ? ' hens ' + j.hens.length + ' grain ' + j.grain.length : '') + (j.n ? ' n' + j.n : '')).join(' | ')));
if (process.env.SD) for (const k of ['hens', 'rug', 'churn']) { const ok = await p.evaluate((k) => { const j = O.Doorstep.jobs.find((j) => j.kind === k); if (!j) return false; O.game.player.x = j.x + 40; O.game.player.y = j.y + 40; return true; }, k); if (!ok) continue; await p.waitForTimeout(700); await p.screenshot({ path: `${process.env.SD}/door-${k}.png`, clip: { x: 420, y: 230, width: 300, height: 200 } }); }
await p.waitForTimeout(60000);
console.log('later:', await p.evaluate(() => O.Doorstep.jobs.length + ' jobs; stray ' + O.SimRef.cur.people.filter((q) => q.agent && q.agent.frozen && q._door && !O.Doorstep.jobs.some((j) => j.q === q)).length));
await done();
