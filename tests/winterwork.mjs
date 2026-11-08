// Winter chores: icicles and drips, snow shovelled from doors, ice broken on the well, firewood carried home.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'winter', configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 9 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; s.weather.snowCover = 0.9; });
await p.waitForTimeout(1000);
console.log('ice', await p.evaluate(() => O.WinterWork.start('ice')));
for (let i = 0; i < 3; i++) console.log('shovel', await p.evaluate(() => O.WinterWork.start('shovel')));
await p.waitForTimeout(15000);
console.log('at it:', await p.evaluate(() => O.WinterWork.jobs.map((j) => j.kind + ' ' + j.q.first + ' ' + j.q.agent.forceAnim).join(' | ')));
if (process.env.SD) { await p.evaluate(() => { const j = O.WinterWork.jobs.find((j) => j.kind === 'shovel'); if (j) { O.game.player.x = j.x0 + 40; O.game.player.y = j.y0 + 30; } }); await p.waitForTimeout(700); await p.screenshot({ path: process.env.SD + '/winter.png', clip: { x: 300, y: 150, width: 560, height: 360 } }); }
await p.waitForTimeout(40000);
await p.evaluate(() => { const s = O.SimRef.cur; s.weather.snowCover = 0.9; let g = 0; while (Math.floor(s.minute / 60) !== 13 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; s.weather.snowCover = 0.9; });
await p.waitForTimeout(4000);
console.log('cleared paths', await p.evaluate(() => O.WinterWork.cleared.size), '| drips', await p.evaluate(() => O.WinterWork.drips.length), '| held', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._winter).length));
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 16 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(8000);
console.log('firewood carried', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.agent && q.agent.carrying && q.agent.carrying.firewood).length));
await done();
