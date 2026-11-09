// The parish bread dole handed out at the bakery door to a queue of the poor.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const fed = await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; s.treasury.cash += 500; const hs = s.households.filter((h) => !h.gone && h.members.length).slice(0, 3); for (const h of hs) { h.money = 0; h.pantry.bread = 0; } s.parishRelief(); const bz = s.supplierOf('bakery'), b = s.building(bz.b?.id ?? bz.id); O.game.player.x = b.doorX * 16 + 20; O.game.player.y = b.doorY * 16 + 70; return O.BreadDole.pending.length ? O.BreadDole.pending[0].fed.length : 0; });
console.log('families on the dole:', fed);
let q = 0; for (let i = 0; i < 10 && !q; i++) { await p.waitForTimeout(2000); q = await p.evaluate(() => O.BreadDole.dole ? O.BreadDole.dole.queue.length : 0); }
console.log('queue at the bakery:', q);
if (process.env.SD) { await p.waitForTimeout(6000); await p.screenshot({ path: process.env.SD + '/dole.png', clip: { x: 420, y: 230, width: 340, height: 200 } }); }
await p.waitForTimeout(40000);
console.log('loaves handed out:', await p.evaluate(() => O.BreadDole.doles), '| still queued:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._dole).length));
await done();
