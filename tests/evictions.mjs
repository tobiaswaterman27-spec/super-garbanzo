// An eviction happens in the street: goods piled by the door, the family on them, the bailiff by.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
const fam = await p.evaluate(() => { const s = O.SimRef.cur; const hh = s.households.find((h) => !h.gone && h.home != null && h.members.length >= 2 && s.building(h.home)?.type === 'house'); const b = s.building(hh.home); O.game.player.x = b.doorX * 16 + 40; O.game.player.y = b.doorY * 16 + 70; hh.debt = 99; s.evict(b, hh); return hh.surname; });
await p.waitForTimeout(3000);
console.log('evicted:', fam, '| piles:', await p.evaluate(() => O.Evictions.piles.length), '| scenes shown:', await p.evaluate(() => O.Evictions.shown), '| on the pile:', await p.evaluate(() => { const P = O.Evictions.piles[0]; return P && P.scene ? P.scene.ppl.map((q) => q.first + ':' + q.agent.forceAnim).join(' ') : '-'; }));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/evict.png', clip: { x: 440, y: 260, width: 320, height: 200 } });
await p.waitForTimeout(80000);
console.log('held after:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._evict).length));
await done();
