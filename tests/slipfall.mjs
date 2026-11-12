// A fall in the street: a neighbour helps them up and home; and you help one up and walk them home.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const setup = () => p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const o = s.people.find((q) => q.age >= 14 && q.agent && q.agent.inside == null && !q.agent.hidden && !q.agent.frozen && !q.errand && q.agent.path && q.agent.path.length > 2 && q.home != null); if (!o) return 'no walker'; O.game.player.x = o.agent.x + 80; O.game.player.y = o.agent.y; O.SlipFall.soon(); return o.first; });
for (let i = 0; i < 30 && !(await p.evaluate(() => !!O.SlipFall.fall)); i++) { await setup(); await p.waitForTimeout(700); }
console.log('fell:', await p.evaluate(() => O.SlipFall.fall && O.SlipFall.fall.q.first + ' ' + O.SlipFall.fall.why));
// step back and let the street deal with it
await p.evaluate(() => { const a = O.SlipFall.fall.q.agent; O.game.player.x = a.x + 200; O.game.player.y = a.y; });
for (let i = 0; i < 120 && (await p.evaluate(() => !!O.SlipFall.fall)); i++) await p.waitForTimeout(1000);
console.log('npc/alone:', await p.evaluate(() => [O.SlipFall.byNpc, O.SlipFall.alone].join('/')));
// you help one up and walk them home
for (let i = 0; i < 30 && !(await p.evaluate(() => !!O.SlipFall.fall)); i++) { await setup(); await p.waitForTimeout(700); }
const r = await p.evaluate(() => { const F = O.SlipFall.fall; if (!F) return 'none'; const P = O.game.player, a = F.q.agent; P.x = a.x + 14; P.y = a.y + 4; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Help .* up$/.test(x.label)); if (!c) return 'no prompt'; c.act(); return 'ok'; });
console.log('you:', r);
for (let i = 0; i < 100 && (await p.evaluate(() => !!O.SlipFall.fall)); i++) { await p.evaluate(() => { const F = O.SlipFall.fall; if (F) { O.game.player.x = F.q.agent.x + 18; O.game.player.y = F.q.agent.y + 6; } }); await p.waitForTimeout(800); }
console.log('byYou/seenHome:', await p.evaluate(() => [O.SlipFall.byYou, O.SlipFall.seenHome].join('/')));
await p.waitForTimeout(3000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._slipped).length));
await done();
