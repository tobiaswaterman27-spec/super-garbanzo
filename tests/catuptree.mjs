// The cat up the tree: a neighbour fetches a ladder; another time you climb after it.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; });
const go = () => p.evaluate(() => { const s = O.SimRef.cur; const hs = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null); for (let i = 0; i < 20; i++) { const b = hs[Math.floor(Math.random() * hs.length)]; O.game.player.x = b.doorX * 16; O.game.player.y = (b.doorY + 4) * 16; O.CatUpTree.soon(); } return true; });
for (let i = 0; i < 15 && !(await p.evaluate(() => !!O.CatUpTree.cat)); i++) { await go(); await p.waitForTimeout(700); }
console.log('cat 1:', await p.evaluate(() => O.CatUpTree.cat && O.CatUpTree.cat.name + ', child ' + O.CatUpTree.cat.kid.first));
await p.evaluate(() => { const C = O.CatUpTree.cat; if (C) { O.game.player.x = C.tr.x + 140; O.game.player.y = C.tr.y + 40; } });
for (let i = 0; i < 100 && (await p.evaluate(() => !!O.CatUpTree.cat)); i++) await p.waitForTimeout(1000);
console.log('byNpc:', await p.evaluate(() => O.CatUpTree.byNpc));
for (let i = 0; i < 15 && !(await p.evaluate(() => !!O.CatUpTree.cat)); i++) { await go(); await p.waitForTimeout(700); }
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const C = O.CatUpTree.cat; if (!C) return 'none'; const P = O.game.player; P.x = C.tr.x + 4; P.y = C.tr.y + 14; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Climb up after/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', r);
if (process.env.SD) { await p.waitForTimeout(3500); await p.screenshot({ path: process.env.SD + '/cat.png' }); }
await p.waitForTimeout(9000);
console.log('byYou:', await p.evaluate(() => O.CatUpTree.byYou), 'lift:', await p.evaluate(() => O.game.player.lift || 0));
await p.waitForTimeout(8000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._cattree && !q.errand).length));
await done();
