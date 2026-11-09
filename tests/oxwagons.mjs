// An ox-wagon lumbers along the road, the carter at the oxen's heads; it comes and goes.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const ok = await p.evaluate(() => { const s = O.SimRef.cur, w = s.world; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute;
  for (let ty = 4; ty < w.H - 4; ty++) { let run = 0; for (let tx = 30; tx < w.W - 30; tx++) { const t = w.ter[ty * w.W + tx]; if ((t === w.TER.ROAD || t === w.TER.COBBLE) && !w.solid[ty * w.W + tx]) { if (++run >= 40) { O.game.player.x = (tx - 20) * 16 + 8; O.game.player.y = ty * 16 + 30; O.OxWagons.soon(); return true; } } else run = 0; } } return false; });
console.log('road found:', ok);
await p.waitForTimeout(3000);
const w1 = await p.evaluate(() => { const W = O.OxWagons.wagon; return W ? { load: W.load, x: Math.round(W.x), dx: Math.round(W.x - O.game.player.x) } : null; });
console.log('wagon:', JSON.stringify(w1));
if (process.env.SD) { await p.evaluate(() => { const W = O.OxWagons.wagon; if (W) W.x = O.game.player.x; }); await p.waitForTimeout(400); await p.screenshot({ path: process.env.SD + '/oxwagon.png', clip: { x: 360, y: 200, width: 480, height: 300 } }); }
await p.evaluate(() => { const W = O.OxWagons.wagon; if (W) { W.x = O.game.player.x + W.dir * 600; W.t = 9; } });
await p.waitForTimeout(1500);
console.log('passed:', await p.evaluate(() => O.OxWagons.passed), '| gone:', await p.evaluate(() => !O.OxWagons.wagon));
// harvest home in autumn
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'autumn', configurable: true }); O.game.player.x -= 0; O.OxWagons.soon(true); });
await p.waitForTimeout(2500);
console.log('harvest wagon:', await p.evaluate(() => { const W = O.OxWagons.wagon; return W ? W.load + ' kids ' + (W.kids || []).length + ' walkers ' + (W.walkers || []).length : 'none'; }));
if (process.env.SD) { await p.evaluate(() => { const W = O.OxWagons.wagon; if (W) W.x = O.game.player.x - W.dir * 20; }); await p.waitForTimeout(400); await p.screenshot({ path: process.env.SD + '/harvesthome.png', clip: { x: 360, y: 180, width: 480, height: 300 } }); }
await done();
