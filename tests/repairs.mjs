import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (!(s.weekday !== 6 && Math.floor(s.minute / 60) === 10)) s.tick(3); O.game.clock.minute = s.minute; s.raining = false; });
let j = null; for (let i = 0; i < 30 && !j; i++) { await p.waitForTimeout(2000); j = await p.evaluate(() => O.Repairs.job ? O.Repairs.job.kind + ':' + O.Repairs.job.q.first : null); }
console.log('repair:', j);
if (j && D) { await p.waitForTimeout(4000); await p.evaluate(() => { const r = O.Repairs.job; if (r) { O.game.player.x = r.x0 + 30; O.game.player.y = r.y0 + 40; } }); await p.waitForTimeout(500); await p.screenshot({ path: `${D}/repair.png`, clip: { x: 480, y: 240, width: 200, height: 180 } }); }
await done();
