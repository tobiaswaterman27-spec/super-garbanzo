// In the rain: heads covered, mud flicking up, idlers sheltering in doorways until it eases.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; s.weather.forced = 'rain'; s.weather.kind = 'rain'; });
let most = 0; for (let i = 0; i < 10; i++) { await p.waitForTimeout(3000); most = Math.max(most, await p.evaluate(() => O.RainFolk.shelters.length)); }
console.log('raining:', await p.evaluate(() => O.SimRef.cur.raining), '| sheltering in doorways (most):', most);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/rain.png' });
await p.evaluate(() => { const W = O.SimRef.cur.weather; W.forced = null; W.kind = 'clear'; });
await p.waitForTimeout(9000);
console.log('after it clears, still sheltering:', await p.evaluate(() => O.RainFolk.shelters.length), '| flagged:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._rain).length));
await done();
