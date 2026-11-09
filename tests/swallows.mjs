// Swallows dart low on spring and summer evenings, and are gone by dark.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'summer', configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 18 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(2000);
console.log('swallows at 6pm:', await p.evaluate(() => O.Swallows.birds.length));
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 22 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(8000);
console.log('swallows at 10pm:', await p.evaluate(() => O.Swallows.birds.length));
await done();
