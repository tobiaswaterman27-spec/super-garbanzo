// A windy day: leaves and straw blowing, shutters banging, a cap blown off and chased.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'autumn', configurable: true }); let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; });
const blow = () => p.evaluate(() => { const W = O.SimRef.cur.weather; W.wind = 0.95; });
await blow(); await p.waitForTimeout(3000); await blow();
console.log('blown bits:', await p.evaluate(() => O.Windy.bits.length));
await p.evaluate(() => O.Windy.gust()); await p.waitForTimeout(600);
console.log('cap off:', await p.evaluate(() => O.Windy.hats.map((h) => h.q.first).join(',')));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/wind.png', clip: { x: 360, y: 220, width: 480, height: 280 } });
for (let i = 0; i < 6; i++) { await blow(); await p.waitForTimeout(3000); }
console.log('chased and caught:', await p.evaluate(() => O.Windy.chases + ' chases, ' + O.Windy.hats.length + ' still loose, flagged ' + O.SimRef.cur.people.filter((q) => q._hat).length));
await done();
