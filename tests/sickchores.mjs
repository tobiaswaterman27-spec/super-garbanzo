// When the house is sick: a neighbour does the chores; and you do another's.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const sicken = (skip) => p.evaluate((skip) => { const s = O.SimRef.cur; for (const h of s.households) { if (!h || h.gone || !h.members || h.members.length > 2 || skip.includes(h.id) || O.SickChores.done.get(h.id) === s.day) continue; const ms = h.members.map((id) => s.byId.get(id)).filter((q) => q && q.alive !== false); const q = ms.find((x) => x.age >= 16 && x.home != null && s.building(x.home)?.doorX != null); if (!q) continue; for (const m of ms) m.health.illness = { kind: 'fever', sev: 0.6, since: s.day, treated: false }; const b = s.building(q.home); O.game.player.x = b.doorX * 16 + 60; O.game.player.y = (b.doorY + 3) * 16; return h.id; } return null; }, skip);
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; });
const h1 = await sicken([]); console.log('sick house 1:', h1, 'needy:', await p.evaluate(() => O.SickChores.needy().length));
for (let i = 0; i < 120 && !(await p.evaluate(() => O.SickChores.byNpc)); i++) await p.waitForTimeout(1000);
console.log('done by a neighbour:', await p.evaluate(() => O.SickChores.byNpc));
const h2 = await sicken([h1]); console.log('sick house 2:', h2);
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const n = O.SickChores.needy().find((x) => !O.SickChores.job || O.SickChores.job.n.h !== x.h); if (!n) return 'none'; const P = O.game.player; P.x = n.b.doorX * 16 + 8 + 22 + 4; P.y = (n.b.doorY + 1) * 16 + 10; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Chop wood and fetch water/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', r);
await p.waitForTimeout(13000);
console.log('byYou:', await p.evaluate(() => O.SickChores.byYou), 'held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._sickhelp && !q.errand).length));
await done();
