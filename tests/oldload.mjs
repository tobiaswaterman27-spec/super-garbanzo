// A hand for the old: an old body struggling with a load; carry it home for them, and be blessed.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; });
let ok = false; for (let i = 0; i < 10 && !ok; i++) { await p.evaluate(() => { const s = O.SimRef.cur; const o = s.people.filter((q) => q.age >= 62 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && q.home != null); const q = o[Math.floor(Math.random() * o.length)]; if (q) { O.game.player.x = q.agent.x + 20; O.game.player.y = q.agent.y + 10; } O.OldLoad.soon(); }); await p.waitForTimeout(1500); ok = await p.evaluate(() => !!O.OldLoad.load); }
console.log('struggling:', ok);
const took = await p.evaluate(() => { const L = O.OldLoad.load; if (!L) return false; const P = O.game.player; P.x = L.q.agent.x + 8; P.y = L.q.agent.y + 4; P.locked = false; const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && /load home/.test(x.label)); if (!c) return false; c.act(); return c.label; });
console.log('took it:', took, '| you carry:', await p.evaluate(() => O.PlayerState.carry && O.PlayerState.carry.good));
for (let i = 0; i < 60 && !(await p.evaluate(() => O.OldLoad.helped)); i++) { await p.evaluate(() => { const L = O.OldLoad.load; if (L) { O.game.player.x = L.q.agent.x + 10; O.game.player.y = L.q.agent.y + 6; } }); await p.waitForTimeout(1000); }
console.log('carried home:', await p.evaluate(() => O.OldLoad.helped));
await p.waitForTimeout(4500);
console.log('load put down:', await p.evaluate(() => !O.PlayerState.carry), '| held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._oldload).length));
await done();
