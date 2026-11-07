import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; const w = s.world, TR = w.TER; let best = null; for (let y = 2; y < w.H - 2; y += 2) for (let x = 2; x < w.W - 2; x += 2) { if (w.ter[y * w.W + x] === TR.WATER && w.ter[y * w.W + x + 2] === TR.WATER && w.ter[(y + 1) * w.W + x] === TR.WATER) { const d = Math.hypot(x * 16 - O.game.player.x, y * 16 - O.game.player.y); if (!best || d < best[2]) best = [x, y, d]; } } O.game.player.x = best[0] * 16 + 40; O.game.player.y = best[1] * 16 - 40; });
await p.waitForTimeout(10000);
console.log('boats', await p.evaluate(() => O.Boats.boats.map((b) => b.kind).join(',')));
if (D) { await p.evaluate(() => { const b = O.Boats.boats[0]; if (b) { O.game.player.x = b.x; O.game.player.y = b.y - 60; } }); await p.waitForTimeout(800); await p.screenshot({ path: `${D}/boats.png`, clip: { x: 450, y: 330, width: 300, height: 200 } }); }
await done();
