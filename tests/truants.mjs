// Truants at marbles in lesson time; the schoolmaster comes after them, they scatter and one is caught.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
console.log('school:', await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'summer', configurable: true }); let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; if (s.weather) s.weather.raining = false; return [...s.biz.values()].filter((b) => ['school', 'chapel', 'church'].includes(b.type)).map((b) => b.type + (b.workers || []).length).join(','); }));
let ok = false;
for (let tries = 0; tries < 10 && !ok; tries++) { await p.evaluate(() => { const s = O.SimRef.cur; const k = s.people.filter((q) => q.age >= 8 && q.age <= 12 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand); if (!k.length) return; const q = k[Math.floor(Math.random() * k.length)]; O.game.player.x = q.agent.x; O.game.player.y = q.agent.y + 10; O.Truants.soon(); }); await p.waitForTimeout(1200); ok = await p.evaluate(() => !!O.Truants.run); }
console.log('started:', ok);
const seen = new Set();
for (let i = 0; i < 90; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const R = O.Truants.run; if (!R) return 'done'; O.game.player.x = R.kids[0].agent.x; O.game.player.y = R.kids[0].agent.y + 20; return R.phase; }); if (i % 10 === 0) console.log(i, r, await p.evaluate(() => { const R = O.Truants.run; if (!R) return ''; const m = R.master.agent, k = R.kids[0].agent; return [Math.round(m.x - k.x), Math.round(m.y - k.y), m.frozen, !!R.master.errand, m.inside, m.hidden].join(','); })); seen.add(r); if (r === 'play' && process.env.SD && !seen.has('s1')) { seen.add('s1'); await p.waitForTimeout(800); await p.screenshot({ path: process.env.SD + '/truants.png', clip: { x: 360, y: 200, width: 480, height: 300 } }); } if (r === 'caught' && process.env.SD && !seen.has('s2')) { seen.add('s2'); await p.waitForTimeout(1500); await p.screenshot({ path: process.env.SD + '/truants2.png', clip: { x: 360, y: 200, width: 480, height: 300 } }); } if (r === 'done') break; }
seen.delete('s1'); seen.delete('s2');
console.log('phases:', [...seen].join(' '), '| caught:', await p.evaluate(() => O.Truants.caught));
await p.waitForTimeout(2000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._truant).length));
await done();
