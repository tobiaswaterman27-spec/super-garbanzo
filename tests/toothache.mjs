// Your bad tooth: the barber pulls it on the stool outside his door, the street watching.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
if (!(await p.evaluate(() => [...O.SimRef.cur.biz.values()].some((z) => z.type === 'barber')))) { await p.evaluate(() => O.teleport('aurelia')); await p.waitForTimeout(3000); }
const r = await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; O.Toothache.give(); O.PlayerState.money = Math.max(10, O.PlayerState.money || 0); const bz = [...s.biz.values()].find((z) => z.type === 'barber'); if (!bz) return 'no barber here'; const b = s.building(bz.b?.id ?? bz.id); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 1) * 16 + 10; return 'at ' + b.name; });
console.log(r);
await p.waitForTimeout(1000);
const a = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const c = O.moreCandidates.map((f) => f()).find((x) => x && /pull your bad tooth/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', a);
for (let i = 0; i < 50 && (await p.evaluate(() => !!O.Toothache.job)); i++) await p.waitForTimeout(1000);
console.log('pulled:', await p.evaluate(() => O.Toothache.pulled), 'tooth now:', await p.evaluate(() => !!O.PlayerState.tooth), 'locked:', await p.evaluate(() => O.game.player.locked), 'held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._ptooth).length));
await done();
