// The barn owl hunts the mice at night: glide in, hover, drop; up with the mouse or empty.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 23 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; });
for (let i = 0; i < 60 && (await p.evaluate(() => O.OwlHunt.caught + O.OwlHunt.missed)) < 3; i++) { await p.evaluate(() => { const P = O.game.player; if (!O.OwlHunt.owl) { O.Mice.mice.push({ x: P.x + 80, x0: P.x + 80, y: P.y + 30, dir: 1, st: 'freeze', t: 0, hold: 5, go: 0, life: 900 }); O.OwlHunt.soon(); } }); await p.waitForTimeout(1000); }
console.log('owl caught:', await p.evaluate(() => O.OwlHunt.caught), '| missed:', await p.evaluate(() => O.OwlHunt.missed));
await done();
