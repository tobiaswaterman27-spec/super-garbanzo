// Grist to the mill: a sack of corn carried to the door, the miller's toll, the flour carried home.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
console.log('mill:', await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const bz = [...s.biz.values()].find((z) => z.type === 'mill'); if (!bz) return null; const b = s.building(bz.b?.id ?? bz.id); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 6) * 16; O.MillGrist.soon(); return bz.name + ' workers ' + (bz.workers || []).length; }));
const seen = new Set(); let shot = false;
for (let i = 0; i < 90; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const j = O.MillGrist.jobs[0]; return j ? j.phase + (j.phase === 'door' ? Math.floor(j.k / 3) : '') : (O.MillGrist.ground ? 'done' : 'none'); }); if (!seen.has(r)) console.log(i, r); seen.add(r); if (!shot && r === 'door0' && process.env.SD) { shot = true; await p.waitForTimeout(1800); await p.screenshot({ path: process.env.SD + '/mill.png', clip: { x: 360, y: 150, width: 480, height: 300 } }); } if (r === 'done') break; if (r === 'none' && i > 3) await p.evaluate(() => O.MillGrist.soon()); }
console.log('ground:', await p.evaluate(() => O.MillGrist.ground));
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._grist).length));
await done();
