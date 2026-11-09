// Buying at the trestle: a passer-by handles the wares, haggles with the keeper, pays and carries it home.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 900)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; });
await p.waitForTimeout(1500);
const before = await p.evaluate(() => { const s = O.SimRef.cur; return [...s.biz.values()].reduce((a, b) => a + (b.cash || 0), 0); });
let shot = false, seen = 0;
for (let i = 0; i < 100; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const T = O.TrestleTrade; if (!T.jobs.length) T.soon(); const j = T.jobs.find((x) => x.phase === 'at'); if (j) { O.game.player.x = j.q.agent.x; O.game.player.y = j.q.agent.y + 60; } return { at: !!j, keeper: !!(j && j.k), sold: T.sold, walked: T.walked, live: T.jobs.length }; }); if (r.at) seen++; if (!shot && r.at && r.keeper && process.env.SD) { shot = true; await p.waitForTimeout(4500); await p.screenshot({ path: process.env.SD + '/trestle.png', clip: { x: 360, y: 180, width: 480, height: 300 } }); } if (r.sold + r.walked >= 3) break; }
const after = await p.evaluate(() => { const s = O.SimRef.cur; return [...s.biz.values()].reduce((a, b) => a + (b.cash || 0), 0); });
console.log('sold:', await p.evaluate(() => O.TrestleTrade.sold), '| walked off:', await p.evaluate(() => O.TrestleTrade.walked), '| till moved:', after !== before, '| keeper came out:', shot);
await p.waitForTimeout(2000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._trestle && !O.TrestleTrade.jobs.some((j) => j.q === q || j.k === q)).length));
await done();
