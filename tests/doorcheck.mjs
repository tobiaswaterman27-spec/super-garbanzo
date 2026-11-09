// The night watch try the shop doors.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(Math.floor(s.minute / 60) === 21 && s.minute % 60 >= 30) && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const w = s.people.find((q) => /guard|watch|constable|sergeant/.test(q.job?.role || '') && q.agent && !q.agent.hidden && q.agent.inside == null); if (w) { O.game.player.x = w.agent.x + 30; O.game.player.y = w.agent.y + 30; } });
for (let i = 0; i < 20; i++) { await p.waitForTimeout(4000); await p.evaluate(() => { const s = O.SimRef.cur, w = s.people.find((q) => /guard|watch|constable|sergeant/.test(q.job?.role || '') && q.agent && !q.agent.hidden && q.agent.inside == null); if (w) { O.game.player.x = w.agent.x + 30; O.game.player.y = w.agent.y + 30; } O.DoorCheck.soon(); }); }
console.log('doors tried:', await p.evaluate(() => O.DoorCheck.checks), '| found off the latch:', await p.evaluate(() => O.DoorCheck.open));
await done();
