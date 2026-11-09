// The cat hunts the mice at night: stalk, freeze, wiggle, pounce; a catch carried to a doorstep, or a miss.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
console.log('cat:', await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 22.5 && g++ < 8000) s.tick(1); O.game.clock.minute = s.minute; const c = (O.fauna || []).find((f) => f.kind === 'cat' && f.world === s.world.placeId); if (!c) return null; O.game.player.x = c.x + 120; O.game.player.y = c.y + 60; return true; }));
let tries = 0;
for (let i = 0; i < 60 && (await p.evaluate(() => O.CatHunt.caught + O.CatHunt.missed)) < 5; i++) { await p.evaluate(() => { const s = O.SimRef.cur, c = (O.fauna || []).find((f) => f.kind === 'cat' && f.world === s.world.placeId); if (!O.CatHunt.hunt && c) { O.Mice.mice.push({ x: c.x + 50, x0: c.x + 50, y: c.y + 2, dir: 1, st: 'freeze', t: 0, hold: 3, go: 0, life: 900 }); } }); tries++; await p.waitForTimeout(1000); }
console.log('caught:', await p.evaluate(() => O.CatHunt.caught), '| missed:', await p.evaluate(() => O.CatHunt.missed), '| gifts on doorsteps:', await p.evaluate(() => O.CatHunt.gifts.length));
await done();
