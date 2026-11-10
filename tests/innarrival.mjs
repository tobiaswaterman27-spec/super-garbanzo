// A guest at the inn: a traveller leads a horse to the door; the host greets with a cup, bags carried in, horse led round.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
console.log('inn:', await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 14 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const bz = [...s.biz.values()].find((z) => z.type === 'tavern' || z.type === 'inn'); if (!bz) return null; const b = s.building(bz.b?.id ?? bz.id); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 7) * 16; O.InnArrival.soon(); return bz.name; }));
const seen = new Set(); let shot = false;
for (let i = 0; i < 60; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const A = O.InnArrival.arrival; return A ? A.phase + ' staff ' + A.staff.length : 'none'; }); if (!seen.has(r)) console.log(i, r); seen.add(r); if (!shot && /greet/.test(r) && process.env.SD) { shot = true; await p.waitForTimeout(1500); await p.screenshot({ path: process.env.SD + '/inn.png', clip: { x: 360, y: 150, width: 480, height: 320 } }); } if (r === 'none' && i > 2) break; }
console.log('guests:', await p.evaluate(() => O.InnArrival.guests));
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._inn).length));
await done();
