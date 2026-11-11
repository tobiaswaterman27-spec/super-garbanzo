// After a bull got loose, the children play at bulls in the lane: charge, scatter, and the roping.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 13 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; O.KidsBull.start(); });
let ok = false; for (let i = 0; i < 10 && !ok; i++) { await p.evaluate(() => { const s = O.SimRef.cur; const k = s.people.filter((q) => q.age >= 5 && q.age <= 11 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand); const q = k[Math.floor(Math.random() * k.length)]; if (q) { O.game.player.x = q.agent.x; O.game.player.y = q.agent.y + 20; } }); await p.waitForTimeout(1200); ok = await p.evaluate(() => !!O.KidsBull.game); }
console.log('playing:', ok);
for (let i = 0; i < 50 && (await p.evaluate(() => !!O.KidsBull.game)); i++) { await p.evaluate(() => { const G = O.KidsBull.game; if (G) { O.game.player.x = G.kids[0].agent.x; O.game.player.y = G.kids[0].agent.y + 30; } }); await p.waitForTimeout(1000); }
console.log('games played:', await p.evaluate(() => O.KidsBull.played));
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._kidbull).length));
await done();
