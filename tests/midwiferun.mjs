// Run for the midwife: a labour begins at home; the father runs if you don't; you run another time and the baby may be named for you.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const labour = () => p.evaluate(() => { const s = O.SimRef.cur; s.docId = null; const used = (O.MidwifeRun.watch || []).map((w) => w.mum.id);
  const mum = s.people.find((q) => q.sex === 'f' && q.age >= 18 && q.age <= 40 && q.spouse && s.byId.get(q.spouse)?.alive !== false && q.home != null && s.building(q.home)?.doorX != null && !q.labour && !used.includes(q.id) && s.people.some((m) => ['midwife', 'nurse', 'physician'].includes(m.job?.role) && m.alive !== false && m.household !== q.household));
  if (!mum) return 'no mum'; const h = s.building(mum.home); O.game.player.x = h.doorX * 16 + 40; O.game.player.y = (h.doorY + 3) * 16; mum.pregnant = s.day; s.birth(mum, s.household(mum)); const E = O.MidwifeRun.run; return E ? `${mum.first}, dad ${E.dad.first}, midwife ${E.mw.first}` : 'no run (labour ' + !!mum.labour + ', mw ' + mum.midwife + ')'; });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; });
console.log('labour 1:', await labour());
for (let i = 0; i < 90 && (await p.evaluate(() => !!O.MidwifeRun.run)); i++) await p.waitForTimeout(1000);
console.log('byDad:', await p.evaluate(() => O.MidwifeRun.byDad));
console.log('labour 2:', await labour());
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); if (O.npcUI.talking()) O.npcUI.closeTalk(); const E = O.MidwifeRun.run; if (!E) return 'none'; const P = O.game.player; P.x = E.dad.agent.x + 10; P.y = E.dad.agent.y + 4; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Run for /.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', r);
await p.waitForTimeout(2500);
const r2 = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); if (O.npcUI.talking()) O.npcUI.closeTalk(); const E = O.MidwifeRun.run; if (!E) return 'none'; const s = O.SimRef.cur, a = E.mw.agent; let x = a.x, y = a.y; if (a.inside != null) { const h = s.building(a.inside); x = h.doorX * 16 + 8; y = (h.doorY + 1) * 16 + 6; } const P = O.game.player; P.x = x + 6; P.y = y + 4; const c = O.moreCandidates.map((f) => f()).find((x) => x && /baby's coming/.test(x.label)); if (!c) return 'no tell prompt'; c.act(); return c.label; });
console.log('tell:', r2);
for (let i = 0; i < 70 && (await p.evaluate(() => !!O.MidwifeRun.run)); i++) await p.waitForTimeout(1000);
console.log('byYou:', await p.evaluate(() => O.MidwifeRun.byYou));
// the birth, a day on
await p.evaluate(() => { const s = O.SimRef.cur; for (const w of O.MidwifeRun.watch) { if (w.by !== 'you') continue; w.mum.labour.since -= 2000; s.birth(w.mum, s.household(w.mum)); } });
await p.waitForTimeout(1500);
console.log('born/named:', await p.evaluate(() => [O.MidwifeRun.born, O.MidwifeRun.named].join('/')));
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._mwrun).length));
await done();
