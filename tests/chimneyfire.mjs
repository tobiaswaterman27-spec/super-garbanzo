// A chimney catches fire: sparks and flame from the top, the household out coughing, neighbours with a ladder and water.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'winter', configurable: true }); let g = 0; while (s.minute / 60 < 18 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; });
let ok = false;
for (let i = 0; i < 8 && !ok; i++) { await p.evaluate(() => { const s = O.SimRef.cur; const hs = s.world.buildings.filter((b) => b.type === 'house' && b.sprite && b.sprite.chimney && b.doorX != null); const b = hs[Math.floor(Math.random() * hs.length)]; O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 6) * 16; O.ChimneyFire.soon(); }); await p.waitForTimeout(1200); ok = await p.evaluate(() => !!O.ChimneyFire.fire); }
console.log('fire:', ok);
let shot = false;
for (let i = 0; i < 80; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const C = O.ChimneyFire.fire; return C ? Math.round(C.t) + ' house ' + C.house.length + ' help ' + C.help.filter((q) => q.agent.frozen).length : 'none'; }); if (i % 10 === 0) console.log(i, r); if (!shot && / help [1-9]/.test(r) && process.env.SD) { shot = true; await p.evaluate(() => { const C = O.ChimneyFire.fire; O.game.player.x = C.top[0]; O.game.player.y = C.top[1] + 50; }); await p.waitForTimeout(500); await p.screenshot({ path: process.env.SD + '/chimney.png', clip: { x: 360, y: 150, width: 480, height: 320 } }); } if (r === 'none' && i > 2) break; }
console.log('fires out:', await p.evaluate(() => O.ChimneyFire.fires), '| neighbour bonds:', await p.evaluate(() => O.ChimneyFire.bonds));
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._chim).length));
await done();
