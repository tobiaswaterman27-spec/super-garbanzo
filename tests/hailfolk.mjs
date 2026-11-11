// Hail: folk cover their heads and run for doors; after, children gather the hailstones.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; s.weather.forced = 'hail'; s.weather.kind = 'hail'; });
await p.waitForTimeout(5000);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/hail.png', clip: { x: 360, y: 200, width: 480, height: 300 } });
await p.evaluate(() => { const s = O.SimRef.cur; s.weather.forced = null; s.weather.kind = 'clear'; });
await p.waitForTimeout(6000);
console.log('ran for cover:', await p.evaluate(() => O.HailFolk.ran), '| children after the hailstones:', await p.evaluate(() => O.HailFolk.gathered));
await done();
