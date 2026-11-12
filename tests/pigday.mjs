// Pig-killing day: the tub steams, neighbours scrape, children kick the bladder; you lend a hand and get a share; plates go round.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 9 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const b = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null)[4]; O.game.player.x = b.doorX * 16; O.game.player.y = (b.doorY + 4) * 16; });
for (let i = 0; i < 10 && !(await p.evaluate(() => !!O.PigDay.day)); i++) { await p.evaluate(() => O.PigDay.soon()); await p.waitForTimeout(600); }
console.log('pig day at:', await p.evaluate(() => O.PigDay.day && O.PigDay.day.hh.surname));
await p.waitForTimeout(15000);
console.log('crew:', await p.evaluate(() => O.PigDay.day.crew.length), 'kids:', await p.evaluate(() => O.PigDay.day.kids.length));
if (process.env.SD) { await p.evaluate(() => { const D = O.PigDay.day; O.game.player.x = D.x + 30; O.game.player.y = D.y + 30; }); await p.waitForTimeout(800); await p.screenshot({ path: process.env.SD + '/pigday.png' }); }
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const D = O.PigDay.day; const P = O.game.player; P.x = D.x + 8; P.y = D.y + 14; const c = O.moreCandidates.map((f) => f()).find((x) => x && /scalding tub/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', r);
for (let i = 0; i < 120 && (await p.evaluate(() => !!O.PigDay.day && !O.PigDay.day.done)); i++) { await p.evaluate(() => { const D = O.PigDay.day; if (D && !D.done && D.scraped < 100) { const P = O.game.player; P.x = D.x + 8; P.y = D.y + 14; } }); await p.waitForTimeout(1000); }
console.log('helped/plates:', await p.evaluate(() => [O.PigDay.helped, O.PigDay.plates].join('/')));
await p.waitForTimeout(65000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._pigday && !q.errand).length), 'still on:', await p.evaluate(() => !!O.PigDay.day));
await done();
