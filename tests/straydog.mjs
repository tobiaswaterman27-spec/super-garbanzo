// The town's stray dog: begs at the butcher's, snatches from trestles, the shopkeeper chases it.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 9 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; });
const st = new Set();
for (let i = 0; i < 30; i++) { await p.waitForTimeout(4000); const r = await p.evaluate(() => O.StrayDog.dog && O.StrayDog.dog.st); st.add(r); if (r === 'flee' && process.env.SD && !globalThis.shot) { globalThis.shot = 1; await p.screenshot({ path: process.env.SD + '/stray.png' }); } }
console.log('dog states:', [...st].join(' '), '| fed', await p.evaluate(() => O.StrayDog.fed), '| thefts', await p.evaluate(() => O.StrayDog.thefts));
await done();
