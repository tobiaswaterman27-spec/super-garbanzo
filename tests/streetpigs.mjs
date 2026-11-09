// Pigs loose in the street, shooed off doorsteps with a broom.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 17 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(1500);
console.log('pigs in the street:', await p.evaluate(() => O.StreetPigs.pigs ? O.StreetPigs.pigs.L.length : 0));
for (let i = 0; i < 6; i++) { await p.evaluate(() => { const s = O.SimRef.cur; const hs = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && s.people.some((x) => x.home === b.id && x.age >= 16 && x.agent && x.agent.inside === b.id)); const b = hs[Math.floor(Math.random() * hs.length)]; const g = O.StreetPigs.pigs.L[0]; if (b && !g.shoo) { g.x = b.doorX * 16 + 8; g.y = (b.doorY + 1) * 16; g.tx = null; g.st = 'root'; O.game.player.x = g.x + 40; O.game.player.y = g.y + 40; } }); await p.waitForTimeout(6000); if (await p.evaluate(() => O.StreetPigs.shoos)) break; }
console.log('shooed off doorsteps:', await p.evaluate(() => O.StreetPigs.shoos));
await done();
