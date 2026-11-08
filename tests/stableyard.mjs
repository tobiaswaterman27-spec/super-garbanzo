// The stable yard: grooming, a bucket to drink from, a hoof picked out, mucking out onto the heap.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const b = s.world.buildings.find((x) => x.type === 'stable'); O.game.player.x = (b.doorX + 3) * 16; O.game.player.y = (b.doorY + 4) * 16; });
await p.waitForTimeout(1500);
for (const k of ['groom', 'muck', 'water']) { console.log(k, await p.evaluate((k) => O.StableYard.start(k), k)); await p.waitForTimeout(300); }
await p.waitForTimeout(15000);
console.log('at it:', await p.evaluate(() => O.StableYard.jobs.map((j) => j.kind + ' ' + j.q.first + ' ' + j.q.agent.forceAnim + (j.h ? ' horse tied ' + j.h.tied + ' ' + j.h.anim : '')).join(' | ')));
if (process.env.SD) { await p.evaluate(() => { const j = O.StableYard.jobs[0]; if (j) { O.game.player.x = j.q.agent.x + 30; O.game.player.y = j.q.agent.y + 30; } }); await p.waitForTimeout(600); await p.screenshot({ path: process.env.SD + '/stable.png', clip: { x: 400, y: 220, width: 360, height: 220 } }); }
await p.waitForTimeout(45000);
console.log('later:', await p.evaluate(() => O.StableYard.jobs.length + ' jobs; tied ' + O.horsesAll().filter((h) => h.tied).length + '; stray ' + O.SimRef.cur.people.filter((q) => q._stable && !O.StableYard.jobs.some((j) => j.q === q)).length));
await done();
