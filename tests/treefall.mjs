// A felled tree topples and crashes down instead of vanishing.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const P = O.game.player, w = s.world; const tr = w.trees.filter((t) => t.kind !== 'apple').sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0]; P.x = tr.x + 60; P.y = tr.y + 30; globalThis._tr = tr; });
await p.waitForTimeout(1500);
await p.evaluate(() => { const s = O.SimRef.cur, w = s.world, t = globalThis._tr; w.trees = w.trees.filter((x) => x !== t); w.props.push({ kind: 'stump', x: t.x, y: t.y, seed: t.seed, v: 0, solid: false, felled: s.day, treeKind: t.kind }); });
await p.waitForTimeout(2200);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/treefall.png', clip: { x: 420, y: 200, width: 320, height: 220 } });
console.log('falling:', await p.evaluate(() => O.TreeFall.falls.length), '| felled seen:', await p.evaluate(() => O.TreeFall.felled));
await p.waitForTimeout(7000);
console.log('gone after:', await p.evaluate(() => O.TreeFall.falls.length === 0));
await done();
