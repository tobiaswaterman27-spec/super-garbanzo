// Babes in arms: a mother out with nobody at home to mind the baby carries it.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
console.log('babies:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.stage === 'baby').length));
let most = 0;
for (const h of [8, 10, 12, 15, 17]) { await p.evaluate((h) => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== h && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; }, h); await p.waitForTimeout(3000); const n = await p.evaluate(() => O.Babes.carrying.size); most = Math.max(most, n); if (n && process.env.SD && !globalThis.shot) { globalThis.shot = 1; await p.evaluate(() => { const q = [...O.Babes.carrying][0]; O.game.player.x = q.agent.x + 30; O.game.player.y = q.agent.y + 20; }); await p.waitForTimeout(500); await p.screenshot({ path: process.env.SD + '/babe.png', clip: { x: 460, y: 280, width: 240, height: 160 } }); } console.log('hour', h, 'carrying', n, await p.evaluate(() => [...O.Babes.carrying].map((q) => q.first + ' ' + q.activity?.act).join(', '))); }
if (process.env.SD) { const ok = await p.evaluate(() => { const q = [...O.Babes.carrying][0]; if (!q) return false; O.game.player.x = q.agent.x + 30; O.game.player.y = q.agent.y + 20; return true; }); if (ok) { await p.waitForTimeout(500); await p.screenshot({ path: process.env.SD + '/babe.png', clip: { x: 460, y: 280, width: 240, height: 160 } }); } }
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 22 && g++ < 3000) s.tick(2); });
await p.waitForTimeout(2500);
console.log('at night still carrying outdoors:', await p.evaluate(() => [...O.Babes.carrying].filter((q) => q.agent.inside != null).length), '| babe flag stuck indoors:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.app && q.app.babe && q.agent.inside != null && q.task?.babe == null).length));
await done();
