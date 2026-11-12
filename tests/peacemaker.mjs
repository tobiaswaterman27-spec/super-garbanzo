// Make peace: step between two brawlers in the street; they stop (or you catch a fist), and it's remembered.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const act = (re) => p.evaluate((src) => { O.game.player.locked = false; const r = new RegExp(src); const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && r.test(x.label)); if (!c) return false; c.act(); return c.label; }, re);
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; O.PlayerState.rep.civilian = 0.6; });
let tries = 0, made = 0;
for (let k = 0; k < 4; k++) { await p.evaluate(() => { const s = O.SimRef.cur; const out = s.people.filter((q) => q.age >= 18 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._fighting); const a = out[0], b = out[1]; b.agent.x = a.agent.x + 14; b.agent.y = a.agent.y; O.StreetFight.start(s, a, b, { why: 'a test' }); O.game.player.x = a.agent.x + 7; O.game.player.y = a.agent.y + 10; }); await p.waitForTimeout(600); if (await act('make peace')) tries++; await p.waitForTimeout(800); }
console.log('tried:', tries, '| peace made:', await p.evaluate(() => O.StreetFight.peace), '| punched:', await p.evaluate(() => O.StreetFight.punched), '| fights still going:', await p.evaluate(() => O.StreetFight.fights.length));
await done();
