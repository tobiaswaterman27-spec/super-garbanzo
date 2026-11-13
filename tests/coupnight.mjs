// A gang takeover faced out in the street at night: a ring outside the den, words, a fight, a winner; you step up behind one.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 20.6 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const s = O.SimRef.cur; const g = (s.gangs || []).find((g) => g.id !== 'player' && s.building(g.hideout)); if (!g) return 'no gang';
  for (const q of s.people.filter((q) => !q.gang && q.age >= 18 && q.age < 45 && q.agent && !q.visitor).slice(0, Math.max(0, 4 - g.members.length))) { q.gang = g.id; g.members.push({ id: q.id, role: 'member', loyalty: 0.5 }); }
  if (!s.byId.get(g.leader)) { g.leader = g.members[0].id; }
  const boss = s.byId.get(g.leader), pl = g.members.map((m) => s.byId.get(m.id)).find((q) => q && q !== boss); pl.gang = g.id; g.plot = { by: pl.id, day: s.day, backers: [], warned: false };
  O.PlayerState.gangRanks = [{ gid: g.id, place: s.world.placeId, placeName: s.world.name, name: g.name, rank: 1, trust: 0.4 }]; const b = s.building(g.hideout); const P = O.game.player; P.x = b.doorX * 16 + 8; P.y = (b.doorY + 4) * 16; window._g = g.id; return g.name + ': ' + boss.first + ' vs ' + pl.first; });
console.log('plot:', r);
for (let i = 0; i < 10 && !(await p.evaluate(() => !!O.CoupNight.scene)); i++) await p.waitForTimeout(500);
console.log('staged:', await p.evaluate(() => O.CoupNight.scene && O.CoupNight.scene.stage));
for (let i = 0; i < 30; i++) { await p.waitForTimeout(500); const c = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const C = O.CoupNight.scene; if (!C) return 'none'; const P = O.game.player; P.x = C.x; P.y = C.y + 30; const c = O.moreCandidates.map((f) => f()).find((c) => c && /Step up behind/.test(c.label)); if (c) { c.act(); return 'sided'; } return C.stage; }); if (c === 'sided') { console.log('you stepped up'); break; } }
for (let i = 0; i < 60 && (await p.evaluate(() => O.CoupNight.scene && O.CoupNight.scene.stage !== 'fight')); i++) await p.waitForTimeout(300);
await p.waitForTimeout(2000); console.log('pos:', await p.evaluate(() => { const C = O.CoupNight.scene, P = O.game.player; if (!C) return 'none'; return [C.boss, C.plotter, ...C.ring].map((q) => q.first + ' ' + Math.round(q.agent.x - P.x) + ',' + Math.round(q.agent.y - P.y) + (q.agent.hidden ? ' H' : '') + (q.agent.inside != null ? ' in' : '') + (q._at ? ' at' : '')).join(' | ') + ' place ' + O.SimRef.cur.world.placeId; })); if (process.env.SD) await p.screenshot({ path: process.env.SD + '/coup.png' });
for (let i = 0; i < 60 && (await p.evaluate(() => O.CoupNight.scene && O.CoupNight.scene.stage !== 'after')); i++) await p.waitForTimeout(500);

console.log('result:', await p.evaluate(() => { const C = O.CoupNight.scene; const s = O.SimRef.cur, g = s.gang ? s.gang(window._g) : s.gangs.find((x) => x.id === window._g); return (C && C.won ? C.won.first + ' won; ' : '') + 'leader now ' + s.byId.get(g.leader).first + ', plot left ' + !!g.plot + ', sided ' + O.CoupNight.sided; }));
await p.waitForTimeout(7000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._coup).length), 'still on', await p.evaluate(() => !!O.CoupNight.scene));
await done();
