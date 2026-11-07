import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.minute >= 5.6 * 60 && s.minute < 6 * 60) && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const e = O.Hunters.woodEdge(); if (e) { O.game.player.x = e[0] * 16; O.game.player.y = e[1] * 16 + 60; } });
let went = 0; for (let i = 0; i < 15 && !went; i++) { await p.waitForTimeout(2000); went = await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._hunting === 'out').length + O.Hunters.out.size); }
console.log('wood edge', await p.evaluate(() => JSON.stringify(O.Hunters.woodEdge())), '| hunters out:', went);
for (let i = 0; i < 20 && await p.evaluate(() => O.Hunters.out.size === 0); i++) await p.waitForTimeout(2000);
console.log('in the woods:', await p.evaluate(() => [...O.Hunters.out.values()].map((o) => o.bag).join(',')));
await p.evaluate(() => { const s = O.SimRef.cur; for (const o of O.Hunters.out.values()) o.back = 0; });
await p.waitForTimeout(3000);
console.log('coming home with:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._hunting && q._hunting !== 'out').map((q) => q.first + ':' + q._hunting).join(',')));
await done();
