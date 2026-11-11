// A bad name, felt: when notorious, folk step away and mutter; nobody shuns an honest stranger.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; });
const walk = async () => { for (let i = 0; i < 12; i++) { await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const q = s.people.find((x) => x.age >= 14 && !x.gang && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && Math.hypot(x.agent.x - P.x, x.agent.y - P.y) < 400 && !/guard|watch/.test(x.job?.role || '')); if (q) { P.x = q.agent.x + 10; P.y = q.agent.y + 5; } }); await p.waitForTimeout(800); } };
await walk(); const honest = await p.evaluate(() => O.Shunning.shunned);
await p.evaluate(() => { O.PlayerState.rep.criminal = 0.8; }); await walk();
console.log('shunned when honest:', honest, '| when notorious:', await p.evaluate(() => O.Shunning.shunned), '| children pulled away:', await p.evaluate(() => O.Shunning.pulled));
await done();
