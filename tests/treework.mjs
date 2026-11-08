// Tree work by season: apple picking, acorns for the pigs, lopping, and the midday rest in the shade.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const setSeason = (se, hr) => p.evaluate(([se, hr]) => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: se, configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== hr && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; }, [se, hr]);
await setSeason('autumn', 10); await p.waitForTimeout(800);
// stand among trees outside the town
await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const tr = s.world.trees.filter((t) => t.kind === 'oak').sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0]; if (tr) { P.x = tr.x + 30; P.y = tr.y + 40; } });
await p.waitForTimeout(800);
for (const k of ['beat', 'lop', 'noon']) console.log(k, await p.evaluate((k) => O.TreeWork.start(k), k));
await p.waitForTimeout(35000);
console.log('jobs:', await p.evaluate(() => O.TreeWork.jobs.map((j) => j.kind + ':' + j.ppl.length + (j.kind === 'beat' ? ' pigs ' + j.pigs.length : '')).join(' ')), '| bits', await p.evaluate(() => O.TreeWork.bits.length));
if (process.env.SD) for (const k of ['beat', 'lop', 'noon']) { const ok = await p.evaluate((k) => { const j = O.TreeWork.jobs.find((j) => j.kind === k); if (!j) return false; O.game.player.x = j.tr.x + 50; O.game.player.y = j.tr.y + 40; return true; }, k); if (!ok) continue; await p.waitForTimeout(600); await p.screenshot({ path: `${process.env.SD}/tree-${k}.png`, clip: { x: 420, y: 200, width: 300, height: 220 } }); }
await p.waitForTimeout(70000);
console.log('later:', await p.evaluate(() => O.TreeWork.jobs.length + ' jobs; held ' + O.SimRef.cur.people.filter((q) => q._tree).length + '; stray ' + O.SimRef.cur.people.filter((q) => q.agent && q.agent.frozen && q._tree && !O.TreeWork.jobs.some((j) => j.ppl.includes(q))).length));
await done();
