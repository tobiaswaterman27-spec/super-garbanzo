// Bread and salt: a house becomes yours, and a neighbour comes over with the old welcome.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; });
await p.waitForTimeout(2500);
const n0 = await p.evaluate(() => { const s = O.SimRef.cur; const b = s.world.buildings.find((x) => x.type === 'house' && x.doorX != null && !(x.owner && x.owner.kind === 'player') && s.world.buildings.some((y) => y !== x && y.type === 'house' && y.doorX != null && Math.hypot(y.doorX - x.doorX, y.doorY - x.doorY) < 10)); b.owner = { kind: 'player' }; O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 2) * 16; return O.PlayerState.items.length; });
for (let i = 0; i < 45 && !(await p.evaluate(() => O.HouseWarm.welcomed)); i++) await p.waitForTimeout(1000);
console.log('welcomed:', await p.evaluate(() => O.HouseWarm.welcomed), '| bread given:', await p.evaluate((n0) => O.PlayerState.items.length - n0, n0));
await p.waitForTimeout(10000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._warm).length));
await done();
