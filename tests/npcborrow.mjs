// Neighbours borrow from each other: a knock next door, a loaf lent (or refused), paid back two days later.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const hh = s.households.find((h) => !h.gone && h.members.length >= 2 && s.building(h.home)?.doorX != null); hh.pantry.bread = 0; for (const x of s.households) if (x !== hh && x.pantry) x.pantry.bread = Math.max(x.pantry.bread || 0, 5); const b = s.building(hh.home); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 3) * 16; window.__hh = hh; O.NpcBorrow.soon(); });
for (let i = 0; i < 60 && !(await p.evaluate(() => O.NpcBorrow.lent + O.NpcBorrow.refused)); i++) { await p.waitForTimeout(1000); await p.evaluate(() => { if (!O.NpcBorrow.ask) { window.__hh.pantry.bread = 0; O.NpcBorrow.soon(); } }); }
console.log('lent:', await p.evaluate(() => O.NpcBorrow.lent), '| refused:', await p.evaluate(() => O.NpcBorrow.refused), '| owed:', await p.evaluate(() => O.NpcBorrow.owed.length));
await p.evaluate(() => { const s = O.SimRef.cur; for (const o of O.NpcBorrow.owed) { o.due = s.day; const a = s.household(o.asker); a.pantry.bread = 3; } });
await p.waitForTimeout(1500);
console.log('repaid:', await p.evaluate(() => O.NpcBorrow.repaid));
await p.waitForTimeout(6000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._nb).length));
await done();
