// More children's games: knights with a hobby horse, tug of war, blind man's buff, whip and top.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 16 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; });
await p.waitForTimeout(1000);
for (const k of ['knights', 'tug']) { console.log(k, await p.evaluate((k) => O.KidsPlay2.start(k), k)); }
const seen = new Set();
for (let i = 0; i < 10; i++) { await p.waitForTimeout(4000); const r = await p.evaluate(() => O.KidsPlay2.games.filter((g) => g.t >= 0).map((g) => g.kind + ':' + g.kids.length + ':' + g.kids.map((q) => q.agent.forceAnim).join('/'))); r.forEach((x) => seen.add(x.split(':')[0])); if (i === 3) console.log('playing:', r.join(' | ')); if (i === 3 && process.env.SD) { await p.evaluate(() => { const g = O.KidsPlay2.games.find((g) => g.t >= 0); if (g) { O.game.player.x = g.cx + 30; O.game.player.y = g.cy + 50; } }); await p.waitForTimeout(500); await p.screenshot({ path: process.env.SD + '/kids2.png', clip: { x: 420, y: 220, width: 320, height: 200 } }); } }
console.log('games seen:', [...seen].join(' '), '| played', await p.evaluate(() => O.KidsPlay2.played));
await p.waitForTimeout(40000);
console.log('after: games', await p.evaluate(() => O.KidsPlay2.games.length), 'frozen kids left', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._kid2 && q.agent.frozen && !O.KidsPlay2.games.some((g) => g.kids.includes(q))).length));
await done();
