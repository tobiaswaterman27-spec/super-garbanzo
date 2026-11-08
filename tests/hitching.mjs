// Horses wait tied at a post while their riders are indoors.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => O.teleport('aurelia')); await p.waitForTimeout(3000);
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
let most = 0, posts = 0;
for (let i = 0; i < 12; i++) { await p.waitForTimeout(5000); const r = await p.evaluate(() => [O.Hitching.tied.size, [...O.Hitching.tied.values()].filter((h) => h.post).length]); most = Math.max(most, r[0]); posts = Math.max(posts, r[1]); }
console.log('horses waiting (most):', most, '| at posts:', posts, '| riders now:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.agent && q.agent.mount).length));
// a rider goes indoors: the horse should be tied at that door
console.log('rider goes in:', await p.evaluate(() => { const s = O.SimRef.cur; const q = s.people.find((x) => x.agent && x.agent.mount && !x.agent.hidden); if (!q) return 'no rider'; const b = s.world.buildings.filter((b) => b.doorX != null).sort((u, v) => Math.hypot(u.doorX * 16 - q.agent.x, u.doorY * 16 - q.agent.y) - Math.hypot(v.doorX * 16 - q.agent.x, v.doorY * 16 - q.agent.y))[0]; q.agent.x = b.doorX * 16 + 8; q.agent.y = (b.doorY + 1) * 16; q.agent.inside = b.id; q.agent.hidden = true; q.agent.path = null; q.agent.mount = null; globalThis._hq = q; return q.first + ' into the ' + b.type; }));
await p.waitForTimeout(1500);
console.log('tied at the door:', await p.evaluate(() => { const h = O.Hitching.tied.get(globalThis._hq); return h ? (h.post ? 'yes, at a post' : 'held, no post') : 'no'; }));
if (process.env.SD) { const ok = await p.evaluate(() => { const h = [...O.Hitching.tied.values()].find((h) => h.post) || [...O.Hitching.tied.values()][0]; if (!h) return false; O.game.player.x = h.x + 30; O.game.player.y = h.y + 40; return true; }); if (ok) { await p.waitForTimeout(700); await p.screenshot({ path: process.env.SD + '/hitch.png', clip: { x: 440, y: 260, width: 300, height: 180 } }); } }
await done();
