// A little one wanders off and sits crying; the mother comes out calling and searching, finds them, scolds and hugs.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
let started = null;
for (let tries = 0; tries < 8 && !started; tries++) {
  started = await p.evaluate(() => { const s = O.SimRef.cur; const k = s.people.filter((q) => q.age >= 3 && q.age <= 7 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand); if (!k.length) return null; const q = k[Math.floor(Math.random() * k.length)]; O.game.player.x = q.agent.x + 10; O.game.player.y = q.agent.y + 10; O.LostChild.soon(); return q.first || q.id; });
  await p.waitForTimeout(1500); if (started && !(await p.evaluate(() => !!O.LostChild.lost))) started = null; }
console.log('lost:', started);
const seen = new Set();
for (let i = 0; i < 120; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const L = O.LostChild.lost; if (!L) return 'done'; O.game.player.x = L.ma.agent.x + 20; O.game.player.y = L.ma.agent.y + 20; globalThis.__lc = [L.kid.id, L.ma.id, L.kid.age, L.ma.age]; return L.phase + (L.hops ? L.hops : ''); }); seen.add(r); if (r === 'found' && process.env.SD && !seen.has('shot')) { seen.add('shot'); await p.waitForTimeout(1200); await p.screenshot({ path: process.env.SD + '/lostchild.png', clip: { x: 360, y: 200, width: 480, height: 300 } }); } if (r === 'done') break; }
seen.delete('shot');
console.log('phases:', [...seen].join(' '), '| found:', await p.evaluate(() => O.LostChild.found));
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._lost).map((q) => q.id + ':' + q.age + (q.agent.frozen ? 'F' : '') + (q.errand ? 'E' : '') + (O.LostChild.lost ? 'L' : '')).join(',') || 0));
console.log('L was', await p.evaluate(() => globalThis.__lc));
await done();
