// The goose girl drives her flock along the road; folk give room; too close and the geese come at you hissing.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const ok = await p.evaluate(() => { const s = O.SimRef.cur, w = s.world; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute;
  for (let ty = 4; ty < w.H - 4; ty++) { let run = 0; for (let tx = 30; tx < w.W - 30; tx++) { const t = w.ter[ty * w.W + tx]; if ((t === w.TER.ROAD || t === w.TER.COBBLE) && !w.solid[ty * w.W + tx]) { if (++run >= 40) { O.game.player.x = (tx - 20) * 16 + 8; O.game.player.y = ty * 16 + 30; O.GooseGirl.soon(); return true; } } else run = 0; } } return false; });
console.log('road found:', ok);
await p.waitForTimeout(3000);
const w1 = await p.evaluate(() => { const W = O.GooseGirl.flock; return W ? { geese: W.geese.length, dx: Math.round(W.x - O.game.player.x) } : null; });
console.log('flock:', JSON.stringify(w1));
if (process.env.SD) { await p.evaluate(() => { const W = O.GooseGirl.flock; if (W) W.x = O.game.player.x; }); await p.waitForTimeout(400); await p.screenshot({ path: process.env.SD + '/geese.png', clip: { x: 360, y: 200, width: 480, height: 300 } }); }
await p.evaluate(() => { const W = O.GooseGirl.flock; if (W) { W.x = O.game.player.x + W.dir * 600; W.t = 9; } });
await p.waitForTimeout(1500);
console.log('passed:', await p.evaluate(() => O.GooseGirl.passed), '| gone:', await p.evaluate(() => !O.GooseGirl.flock));
// too close and they come at you
await p.evaluate(() => { O.GooseGirl.soon(); }); await p.waitForTimeout(1500);
for (let i = 0; i < 8 && !(await p.evaluate(() => O.GooseGirl.hissed)); i++) { await p.evaluate(() => { const G = O.GooseGirl.flock; if (G) { O.game.player.x = G.geese[0].x + 6; O.game.player.y = G.geese[0].y; } }); await p.waitForTimeout(500); }
console.log('hissed at you:', await p.evaluate(() => O.GooseGirl.hissed) > 0);
await done();
