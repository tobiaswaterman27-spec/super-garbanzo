// Beating the bounds in Rogation week: the priest leads the parish round its boundary stones.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (!(Math.floor(s.minute / 60) === 9 && s.minute % 60 >= 20) && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; s.weather.forced = 'clear'; s.weather.kind = 'clear'; O.Rogation.force(); });
let line = null; for (let i = 0; i < 10 && !line; i++) { await p.waitForTimeout(2000); line = await p.evaluate(() => { const R = O.Rogation.walk; return R ? R.line.length + ' walking behind ' + R.line[0].first : null; }); }
console.log('procession:', line);
for (let i = 0; i < 40; i++) { await p.waitForTimeout(3000); const R = await p.evaluate(() => { const R = O.Rogation.walk; if (R) { O.game.player.x = R.line[0].agent.x + 30; O.game.player.y = R.line[0].agent.y + 50; } return !!R; }); if (!R) break; }
console.log('stones blessed:', await p.evaluate(() => O.Rogation.stones), '| still walking:', await p.evaluate(() => !!O.Rogation.walk), '| flagged after:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._rog).length));
await done();
