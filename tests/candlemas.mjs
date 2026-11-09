// Candlemas: a file of folk walks up to the chapel with lit candles; the priest blesses them on the step; in they go.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 9.1 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const b = s.building(s.chapelId); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 8) * 16; O.Candlemas.force(); });
let shot = false;
for (let i = 0; i < 120; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const C = O.Candlemas.feast; return C ? C.file.map((f) => f.state[0]).join('') + (C.priest ? ' P' : '') : 'none'; }); if (i % 6 === 0) console.log(i, r); if (!shot && /w/.test(r) && i > 4 && process.env.SD) { shot = true; await p.screenshot({ path: process.env.SD + '/candlemas.png', clip: { x: 360, y: 120, width: 480, height: 320 } }); } if (r === 'none' && i > 2) break; }
console.log('blessed:', await p.evaluate(() => O.Candlemas.blessed));
await p.evaluate(() => O.Candlemas.unforce());
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._candle).length));
await done();
