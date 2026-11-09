// Your work, felt: the trade's stuff flies, fellows talk, green hands slip, sure hands catch the master's eye.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 9 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const s = O.SimRef.cur, bz = [...s.biz.values()].find((z) => z.type === 'bakery'); const b = s.building(bz.b?.id ?? bz.id); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 2) * 16; O.Employment.hire(s, bz, s.byId.get(bz.workers[0]), 'baker', 6); const e = O.Employment.here(); e.onShift = true; return O.tradeOf(e, bz); });
console.log('trade:', r);
// a green hand
await p.evaluate(() => { O.PlayerState.skills.baking = 0; for (let i = 0; i < 30; i++) O.WorkMoments.finish(); });
const green = await p.evaluate(() => ({ ...O.WorkMoments.log }));
// a master hand
await p.evaluate(() => { O.PlayerState.skills.baking = 1; for (let i = 0; i < 30; i++) O.WorkMoments.finish(); });
await p.waitForTimeout(4000);
const sure = await p.evaluate(() => ({ ...O.WorkMoments.log }));
console.log('green 30 tasks:', JSON.stringify(green), '| then skilled 30 more:', JSON.stringify(sure));
// working for real throws the trade's dust from your hands
await p.evaluate(() => { O.game.player.locked = true; }); await p.waitForTimeout(1200); const n = await p.evaluate(() => O.game.player.locked = false); await p.waitForTimeout(200);
console.log('tasks counted after a real spell of work:', await p.evaluate(() => O.WorkMoments.tasks));
await done();
