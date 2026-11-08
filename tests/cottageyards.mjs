// Cottage yards: woodpiles, water butts, kitchen gardens in wattle, benches; the household hoes and waters.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'summer', configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 17 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
console.log('yards:', await p.evaluate(() => { const hs = O.SimRef.cur.world.buildings.filter((b) => b.type === 'house'); const Y = hs.map((b) => O.CottageYards.yardOf(b)); return hs.length + ' houses: ' + Y.filter((y) => y.wood).length + ' woodpiles, ' + Y.filter((y) => y.butt).length + ' butts, ' + Y.filter((y) => y.garden).length + ' gardens, ' + Y.filter((y) => y.bench).length + ' benches'; }));
await p.evaluate(() => { const b = O.SimRef.cur.world.buildings.filter((b) => b.type === 'house' && O.CottageYards.yardOf(b).garden)[3]; O.game.player.x = b.doorX * 16 + 40; O.game.player.y = b.doorY * 16 + 60; });
let most = 0; for (let i = 0; i < 10; i++) { await p.waitForTimeout(5000); most = Math.max(most, await p.evaluate(() => O.CottageYards.jobs.length)); }
console.log('gardeners at once (most):', most);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/yards.png' });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 19 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const b = s.world.buildings.filter((b) => b.type === 'house' && O.CottageYards.yardOf(b).bench)[0]; if (b) { O.game.player.x = b.doorX * 16 + 30; O.game.player.y = b.doorY * 16 + 60; } });
let sitters = 0; for (let i = 0; i < 10; i++) { await p.waitForTimeout(4000); sitters = Math.max(sitters, await p.evaluate(() => O.CottageYards.jobs.filter((j) => j.kind === 'bench').length)); }
console.log('sitting out on benches (most):', sitters);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/bench.png' });
const save = await p.evaluate(() => JSON.stringify(O.SimRef.cur.world.buildings.slice(0, 50)).includes('yard'));
console.log('yard data leaks into building records:', save);
await done();
