// Plough Monday: the ribboned plough dragged door to door; pennies given, or a mean man's step ploughed.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const h = s.world.buildings.find((b) => b.type === 'house' && b.doorX != null); O.game.player.x = h.doorX * 16 + 8; O.game.player.y = (h.doorY + 5) * 16; O.PloughMonday.force(); });
const seen = new Set(); let shot = false;
for (let i = 0; i < 120; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const R = O.PloughMonday.run; if (!R) return 'none'; O.game.player.x = R.lads[0].agent.x; O.game.player.y = R.lads[0].agent.y + 50; return R.i + ':' + R.phase; }); if (!seen.has(r)) console.log(i, r); seen.add(r); if (!shot && /mean/.test(r) && process.env.SD) { shot = true; await p.screenshot({ path: process.env.SD + '/plough.png', clip: { x: 360, y: 200, width: 480, height: 300 } }); } if (r === 'none' && i > 3) break; }
console.log('given:', await p.evaluate(() => O.PloughMonday.given), '| ploughed:', await p.evaluate(() => O.PloughMonday.ploughed));
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._plough).length));
await done();
