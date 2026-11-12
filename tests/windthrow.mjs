// Blown down: a tree comes down near the houses; neighbours cut it up, and you take an axe to it for firewood.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 9 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const b = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null)[3]; O.game.player.x = b.doorX * 16; O.game.player.y = (b.doorY + 3) * 16; if (s.weather) s.weather.forced = 'clear'; });
for (let i = 0; i < 10 && !(await p.evaluate(() => !!O.Windthrow.tree)); i++) { await p.evaluate(() => O.Windthrow.soon()); await p.waitForTimeout(500); }
console.log('down:', await p.evaluate(() => O.Windthrow.tree && O.Windthrow.tree.kind + (O.Windthrow.tree.hit ? ' ON ' + (O.Windthrow.tree.hit.name || 'a house') + ' cond ' + O.Windthrow.tree.hit.condition.toFixed(2) : ' (clear of houses)')), 'stump:', await p.evaluate(() => { const W = O.Windthrow.tree; return !!W && O.SimRef.cur.world.props.some((q) => q.kind === 'stump' && q.x === W.x); }));
await p.waitForTimeout(12000);
console.log('crew:', await p.evaluate(() => O.Windthrow.tree.crew.map((q) => q.first).join(', ')), 'gawk:', await p.evaluate(() => O.Windthrow.tree.gawk.length));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/windthrow.png' });
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const W = O.Windthrow.tree; const P = O.game.player; P.x = W.x + W.dir * 24 + 6; P.y = W.y + 4; const c = O.moreCandidates.map((f) => f()).find((x) => x && /axe to the fallen/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', r);
for (let i = 0; i < 150 && !(await p.evaluate(() => O.Windthrow.cleared)); i++) { await p.evaluate(() => { const W = O.Windthrow.tree; if (W && !W.you && !W.cleared) { const P = O.game.player; P.x = W.x + W.dir * 24 + 6; P.y = W.y + 4; W.you = true; } }); await p.waitForTimeout(1000); }
console.log('cleared/yourWood:', await p.evaluate(() => [O.Windthrow.cleared, O.Windthrow.yourWood].join('/')));
await p.waitForTimeout(20000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._blown && !q.errand).length));
await done();
