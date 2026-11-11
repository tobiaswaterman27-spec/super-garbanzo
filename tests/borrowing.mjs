// Neighbours borrow: lend a loaf, and it comes back with something over a day or two later.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const act = (re) => p.evaluate((src) => { O.game.player.locked = false; const r = new RegExp(src); const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && r.test(x.label)); if (!c) return false; c.act(); return c.label; }, re);
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const b = s.world.buildings.find((x) => x.type === 'house' && x.doorX != null && s.world.buildings.some((y) => y !== x && y.type === 'house' && y.doorX != null && Math.hypot(y.doorX - x.doorX, y.doorY - x.doorY) < 10)); b.owner = { kind: 'player' }; window.__b = b; O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 2) * 16; O.PlayerState.items.push('bread', 'firewood'); });
await p.waitForTimeout(3000); await p.evaluate(() => { if (O.HouseWarm) O.HouseWarm.pending.length = 0; O.Borrowing.soon(); });
let l = false; for (let i = 0; i < 40 && !l; i++) { await p.waitForTimeout(1000); await p.evaluate(() => { const A = O.Borrowing.ask; if (A && A.asked) { O.game.player.x = A.q.agent.x + 10; O.game.player.y = A.q.agent.y + 4; } }); l = await act('^Lend '); }
console.log('lent:', l, '| owed:', await p.evaluate(() => O.Borrowing.owed.length));
await p.waitForTimeout(3000);
await p.evaluate(() => { const s = O.SimRef.cur; for (const o of O.Borrowing.owed) o.due = s.day; const b = window.__b; O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 2) * 16; });
for (let i = 0; i < 40 && !(await p.evaluate(() => O.Borrowing.repaid)); i++) await p.waitForTimeout(1000);
console.log('repaid with something over:', await p.evaluate(() => O.Borrowing.repaid));
await p.waitForTimeout(5000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._borrow).length));
await done();
