// More ways to pitch in: send truants back to lessons; a penny for the ploughboys; a bucket for a flooded house.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const act = (re) => p.evaluate((src) => { O.game.player.locked = false; const r = new RegExp(src); const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && r.test(x.label)); if (!c) return false; c.act(); return c.label; }, re);
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'summer', configurable: true }); let g = 0; while (s.minute / 60 < 10.2 && g++ < 3000) s.tick(1); O.game.clock.minute = s.minute; if (s.weather) s.weather.raining = false; O.PlayerState.money = Math.max(O.PlayerState.money || 0, 10); });
// ploughboys
await p.evaluate(() => { const h = O.SimRef.cur.world.buildings.find((b) => b.type === 'house' && b.doorX != null); O.game.player.x = h.doorX * 16 + 8; O.game.player.y = (h.doorY + 5) * 16; O.PloughMonday.force(); });
const m0 = await p.evaluate(() => O.PlayerState.money); let pb = false;
for (let i = 0; i < 20 && !pb; i++) { await p.waitForTimeout(600); await p.evaluate(() => { const R = O.PloughMonday.run; if (R) { O.game.player.x = R.lads[0].agent.x + 10; O.game.player.y = R.lads[0].agent.y + 6; } else O.PloughMonday.force(); }); await p.waitForTimeout(150); pb = await act('ploughboys a penny'); }
console.log('ploughboys:', pb, '| paid:', m0 - await p.evaluate(() => O.PlayerState.money));
// truants
for (let tries = 0; tries < 10 && !(await p.evaluate(() => O.Truants.run)); tries++) { await p.evaluate(() => { const s = O.SimRef.cur; const k = s.people.filter((q) => q.age >= 8 && q.age <= 12 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand); if (!k.length) return; const q = k[Math.floor(Math.random() * k.length)]; O.game.player.x = q.agent.x; O.game.player.y = q.agent.y + 10; O.Truants.soon(); }); await p.waitForTimeout(1200); }
for (let i = 0; i < 40 && (await p.evaluate(() => O.Truants.run && O.Truants.run.phase)) !== 'play'; i++) await p.waitForTimeout(500);
await p.evaluate(() => { const R = O.Truants.run; if (R) { R.master.agent.x += 0; O.game.player.x = R.kids[0].agent.x + 10; O.game.player.y = R.kids[0].agent.y + 6; O.game.player.locked = false; } });
let tr = false; for (let i = 0; i < 20 && !tr; i++) { await p.evaluate(() => { const R = O.Truants.run; if (R && R.phase === 'play') { O.game.player.x = R.kids[0].agent.x + 10; O.game.player.y = R.kids[0].agent.y + 6; } }); await p.waitForTimeout(150); tr = await act('truants back'); if (!tr) await p.waitForTimeout(600); }
console.log('truants:', tr, '| sent:', await p.evaluate(() => O.Truants.sent));
// a flooded house
const r = await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const F = s.floodInit(); if (!F) return 'no river'; const W = s.weather; W.forced = 'heavy'; W.kind = 'heavy'; W.wet = 0.95; F.level = 2.95; s.floodHourly(); const w = s.world; const ts = [...F.tiles].filter((i) => [1, -1, w.W, -w.W].some((d) => !F.tiles.has(i + d) && !w.solid[i + d])); const hs = w.buildings.filter((b) => b.type === 'house').map((b) => b.bottom * w.W + b.doorX); const i = ts.sort((a, b) => Math.min(...hs.map((h) => Math.abs(h % w.W - a % w.W) + Math.abs(Math.floor(h / w.W) - Math.floor(a / w.W)))) - Math.min(...hs.map((h) => Math.abs(h % w.W - b % w.W) + Math.abs(Math.floor(h / w.W) - Math.floor(b / w.W)))))[0]; O.game.player.x = (i % s.world.W) * 16 + 8; O.game.player.y = Math.floor(i / s.world.W) * 16 + 60; return 'flooded tiles ' + F.tiles.size; });
for (let i = 0; i < 40 && !(await p.evaluate(() => O.FloodFolk.jobs.length)); i++) await p.waitForTimeout(1000);
const at = await p.evaluate(() => { const j = O.FloodFolk.jobs[0]; if (!j) return false; O.game.player.x = j.q.agent.x + 10; O.game.player.y = j.q.agent.y + 4; O.game.player.locked = false; return j.kind; });
await p.waitForTimeout(200);
console.log('flood job:', at, '| helped:', await act('bucket|sacks'));
await p.waitForTimeout(3500);
console.log('helped count:', await p.evaluate(() => O.FloodFolk.helped));
await done();
