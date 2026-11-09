// After dark, folk going about carry lanterns and torches with their own light.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(Math.floor(s.minute / 60) === 21 && s.minute % 60 >= 10) && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; });
let most = 0; for (let i = 0; i < 8; i++) { await p.waitForTimeout(2500); most = Math.max(most, await p.evaluate(() => O.NightWalkers.lit)); }
console.log('lights carried (most at once):', most);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/nightlights.png' });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; s.weather.forced = 'fog'; s.weather.kind = 'fog'; });
let fogLit = 0; for (let i = 0; i < 6; i++) { await p.waitForTimeout(2500); fogLit = Math.max(fogLit, await p.evaluate(() => O.NightWalkers.lit)); }
console.log('lanterns carried in the fog by day:', fogLit);
await done();
