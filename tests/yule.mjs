// Yuletide: holly over the doors; the Yule log hauled on ropes to the tavern, children astride, cheered in.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
console.log('tavern:', await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 14 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const tav = [...s.biz.values()].find((z) => z.type === 'tavern'); if (!tav) return null; const b = s.building(tav.b?.id ?? tav.id); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 6) * 16; O.Yule.force(); return tav.name; }));
let shot = false;
for (let i = 0; i < 100; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const Y = O.Yule.haul; return Y ? Y.phase + ' ' + Y.men.length : 'none'; }); if (i % 8 === 0) console.log(i, r); if (!shot && /haul/.test(r) && i > 5 && process.env.SD) { shot = true; await p.evaluate(() => { const Y = O.Yule.haul; O.game.player.x = Y.log.x; O.game.player.y = Y.log.y + 60; }); await p.waitForTimeout(400); await p.screenshot({ path: process.env.SD + '/yule.png', clip: { x: 360, y: 180, width: 480, height: 300 } }); } if (r === 'none' && i > 2) break; }
console.log('hauled:', await p.evaluate(() => O.Yule.hauled));
await p.evaluate(() => O.Yule.unforce());
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._yule).length));
await done();
