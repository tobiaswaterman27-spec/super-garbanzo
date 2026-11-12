// Rough music for one of their own: neighbours at a disliked man's door; you join, or send them home.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const mk = () => p.evaluate(() => { const s = O.SimRef.cur; const t = s.people.find((q) => q.age >= 20 && q.home != null && s.building(q.home)?.doorX != null && !q._roughDone); t._roughDone = true; const b = s.building(t.home); t.agent.inside = t.home; t.agent.hidden = true; let n = 0; for (const z of s.people) { if (z === t || z.household === t.household || z.age < 14 || !z.agent || z.agent.hidden || z.agent.inside != null || z.agent.frozen || z.errand) continue; z.rel.set(t.id, { affinity: -0.6, familiar: 0.5 }); z.agent.x = b.doorX * 16 + (n % 5) * 20 - 40; z.agent.y = (b.doorY + 5) * 16; z.agent.path = null; if (++n >= 6) break; } O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 4) * 16; return t.first + ' (' + n + ' against)'; });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 19 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; s.raining = false; });
console.log('target:', await mk());
for (let i = 0; i < 10 && !(await p.evaluate(() => !!O.NpcRough.music)); i++) { await p.evaluate(() => O.NpcRough.soon()); await p.waitForTimeout(600); }
console.log('music:', await p.evaluate(() => O.NpcRough.music && O.NpcRough.music.tq.first + ', crowd ' + O.NpcRough.music.crowd.length));
await p.waitForTimeout(8000);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/rough.png' });
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const R = O.NpcRough.music; if (!R) return 'none'; for (const z of R.crowd) z.rel.set(0, { affinity: 0.6, familiar: 0.5 }); const P = O.game.player; P.x = R.x; P.y = R.y - 16; const c = O.moreCandidates.map((f) => f()).find((x) => x && /go home/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', r, 'stopped/failed:', await p.evaluate(() => [O.NpcRough.stopped, O.NpcRough.failedStop].join('/')));
await p.waitForTimeout(4000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._nrough && !q.errand).length), 'still on:', await p.evaluate(() => !!O.NpcRough.music));
await done();
