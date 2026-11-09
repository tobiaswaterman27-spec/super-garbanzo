// The bull is out: it trots the lanes, folk scatter, the men run it down, rope it and lead it home.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; O.LooseBull.soon(); });
const seen = new Set(); let shot = false, scattered = 0;
for (let i = 0; i < 120; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const B = O.LooseBull.bull; if (!B) return ['none', 0]; return [B.phase, O.SimRef.cur.people.filter((q) => q._bullScared && O.game.t - q._bullScared < 3).length]; }); scattered = Math.max(scattered, r[1]); if (!seen.has(r[0])) console.log(i, r[0]); seen.add(r[0]); if (!shot && r[0] === 'loose' && i > 6 && process.env.SD) { shot = true; await p.evaluate(() => { const b = O.LooseBull.bull.bull; O.game.player.x = b.x; O.game.player.y = b.y + 70; }); await p.waitForTimeout(300); await p.screenshot({ path: process.env.SD + '/bull.png', clip: { x: 360, y: 180, width: 480, height: 300 } }); } if (r[0] === 'none' && i > 2) break; }
console.log('caught:', await p.evaluate(() => O.LooseBull.caught), '| folk scattered at once (max):', scattered);
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._bull).length));
await done();
