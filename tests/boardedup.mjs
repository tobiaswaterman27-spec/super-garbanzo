// A shop that closes down is boarded up.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const name = await p.evaluate(() => { const s = O.SimRef.cur; const bz = [...s.biz.values()].find((z) => !z.def.public && z.type !== 'site' && z.def.sells && z.def.sells.length && z.type !== 'farmhouse'); const b = s.building(bz.id); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = b.doorY * 16 + 50; s.closeDown(bz); return bz.name; });
await p.waitForTimeout(1500);
console.log('closed:', name, '| boarded up here:', await p.evaluate(() => O.BoardedUp.count()));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/boarded.png', clip: { x: 460, y: 220, width: 280, height: 200 } });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const b = s.world.buildings.find((x) => x.closedShop && !s.biz.get(x.id)); const f = s.people.find((q) => q.age >= 25 && q.age < 55 && q.agent && !q.agent.frozen && q.home); s.startBusiness(b, 'bakery', f); O.game.player.x = b.doorX * 16 + 30; O.game.player.y = b.doorY * 16 + 50; });
const ph = new Set(); for (let i = 0; i < 14; i++) { await p.waitForTimeout(2000); ph.add(await p.evaluate(() => O.BoardedUp.opens[0] ? O.BoardedUp.opens[0].phase : 'done')); }
console.log('reopening:', [...ph].join(' '), '| still boarded:', await p.evaluate(() => O.BoardedUp.count()));
await done();
