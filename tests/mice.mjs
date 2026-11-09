// Mice along the walls at night; gone by day.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 22 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; });
let most = 0; for (let i = 0; i < 6; i++) { await p.waitForTimeout(2500); most = Math.max(most, await p.evaluate(() => O.Mice.mice.length)); }
console.log('mice at night (most):', most);
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(2000);
console.log('mice by day:', await p.evaluate(() => O.Mice.mice.length));
await done();
