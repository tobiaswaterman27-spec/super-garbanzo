// Horses leave droppings in the street; flies find them; the sweeper scoops them up.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 9 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(30000);
console.log('dropped naturally:', await p.evaluate(() => O.StreetMuck.heaps.length));
await p.evaluate(() => { const P = O.game.player; for (let i = 0; i < 3; i++) O.StreetMuck.drop(P.x + 30 + i * 20, P.y + 20); });
await p.waitForTimeout(40000);
console.log('scooped:', await p.evaluate(() => O.StreetMuck.scooped), '| left:', await p.evaluate(() => O.StreetMuck.heaps.length), '| sweepers:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.job?.role === 'sweeper').length));
await done();
