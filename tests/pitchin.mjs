// You can pitch in: bring a lost child home yourself; grab a loose bull's rope.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
const act = (re) => p.evaluate((src) => { const r = new RegExp(src); const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && r.test(x.label)); if (!c) return false; c.act(); return c.label; }, re);
// a lost child
for (let tries = 0; tries < 8 && !(await p.evaluate(() => O.LostChild.lost)); tries++) { await p.evaluate(() => { const s = O.SimRef.cur; const k = s.people.filter((q) => q.age >= 3 && q.age <= 7 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand); if (!k.length) return; const q = k[Math.floor(Math.random() * k.length)]; O.game.player.x = q.agent.x + 10; O.game.player.y = q.agent.y + 10; O.LostChild.soon(); }); await p.waitForTimeout(1500); }
for (let i = 0; i < 40 && (await p.evaluate(() => O.LostChild.lost && O.LostChild.lost.phase)) !== 'lost'; i++) await p.waitForTimeout(500);
await p.evaluate(() => { const L = O.LostChild.lost; if (L) { O.game.player.x = L.kid.agent.x + 8; O.game.player.y = L.kid.agent.y + 4; O.game.player.locked = false; } });
await p.waitForTimeout(300);
console.log('child prompt:', await act('back to their mother'), '| rescued:', await p.evaluate(() => O.LostChild.rescued));
// a loose bull
await p.evaluate(() => { O.LooseBull.soon(); }); await p.waitForTimeout(1500);
let grabbed = 0; for (let i = 0; i < 12 && !grabbed; i++) { await p.evaluate(() => { const B = O.LooseBull.bull; if (B && B.phase === 'loose') { O.game.player.x = B.bull.x + 6; O.game.player.y = B.bull.y + 3; O.game.player.locked = false; } }); await p.waitForTimeout(150); await act('nose-ring'); await p.waitForTimeout(1400); grabbed = await p.evaluate(() => O.LooseBull.grabbed); }
console.log('bull grabbed:', grabbed > 0, '| phase now:', await p.evaluate(() => O.LooseBull.bull && O.LooseBull.bull.phase));
await done();
