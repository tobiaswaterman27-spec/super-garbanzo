// Dough carried to the common oven on a board, the loaves fetched home warm.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.weekday !== 6 && Math.floor(s.minute / 60) === 6 && s.minute % 60 >= 40) && g++ < 4000) s.tick(2); O.game.clock.minute = s.minute; const z = [...s.biz.values()].find((x) => x.type === 'bakery'); const b = s.building(z.b?.id ?? z.id); O.game.player.x = b.doorX * 16 + 40; O.game.player.y = b.doorY * 16 + 80; });
for (let i = 0; i < 24; i++) { await p.waitForTimeout(5000); if (i === 4 && process.env.SD) await p.screenshot({ path: process.env.SD + '/bake.png' }); }
console.log('trips with dough:', await p.evaluate(() => O.Bakehouse.trips), '| loaves carried home:', await p.evaluate(() => O.Bakehouse.home), '| waiting:', await p.evaluate(() => O.Bakehouse.waiting.length));
await done();
