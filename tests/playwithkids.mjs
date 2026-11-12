// Join the children: kick their ball back; take a turn at the skipping rope.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const act = (re) => p.evaluate((src) => { O.game.player.locked = false; const r = new RegExp(src); const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && r.test(x.label)); if (!c) return false; c.act(); return c.label; }, re);
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const k = s.people.find((q) => q.age >= 6 && q.age <= 12 && q.agent && !q.agent.hidden && q.agent.inside == null); O.game.player.x = k.agent.x; O.game.player.y = k.agent.y; });
for (const kind of ['football', 'skipping']) {
  await p.evaluate((k) => { O.KidsPlay.games.length = 0; O.KidsPlay.start(k); }, kind); await p.waitForTimeout(1500);
  let r = false; for (let i = 0; i < 20 && !r; i++) { await p.evaluate(() => { const g = O.KidsPlay.games[0]; if (!g) return; if (g.ball) { O.game.player.x = g.ball.x + 4; O.game.player.y = g.ball.y; g.ball.z = 0; } else { O.game.player.x = g.cx + 10; O.game.player.y = g.cy + 10; } }); r = kind === 'football' ? await p.evaluate(() => { let g = O.KidsPlay.games.find((x) => x.kind === 'football'); if (!g) { const s = O.SimRef.cur, ks = s.people.filter((q) => q.age >= 6 && q.age <= 12 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen); const k = ks[Math.floor(Math.random() * ks.length)]; if (k) { O.game.player.x = k.agent.x; O.game.player.y = k.agent.y; } O.KidsPlay.start('football'); g = O.KidsPlay.games.find((x) => x.kind === 'football'); } if (!g || !g.ball) return false; const P = O.game.player; P.x = g.ball.x + 4; P.y = g.ball.y; g.ball.z = 0; P.locked = false; const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && /Kick the ball/.test(x.label)); if (!c) return false; c.act(); return c.label; }) : await act('skipping rope'); await p.waitForTimeout(400); }
  console.log(kind + ':', r); }
await p.waitForTimeout(2500);
console.log('kicks:', await p.evaluate(() => O.PlayWithKids.kicks), '| joins:', await p.evaluate(() => O.PlayWithKids.joins));
await done();
