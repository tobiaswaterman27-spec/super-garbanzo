import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
// water: bring the kids of the town near you of a morning
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 7) s.tick(2); O.game.clock.minute = s.minute; const P = O.game.player; for (const q of s.people.filter((q) => q.age >= 8 && q.age <= 13 && q.agent).slice(0, 6)) { const a = q.agent; a.hidden = false; a.inside = null; a.frozen = false; a.path = null; a.x = P.x + (Math.random() - 0.5) * 100; a.y = P.y + 30; q.errand = null; } });
let seen = 0; for (let i = 0; i < 15; i++) { await p.waitForTimeout(2000); seen = Math.max(seen, await p.evaluate(() => [...O.Errands.live].filter((q) => q.errand && q.errand.kidfetch).length)); }
console.log('kids on water runs (max at once):', seen, '| fetched today:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._water != null).length));
// supper
await p.evaluate(() => { const s = O.SimRef.cur; while (s.minute < 17.7 * 60) s.tick(2); O.game.clock.minute = s.minute; const P = O.game.player; for (const q of s.people.filter((q) => q.age >= 5 && q.age <= 12 && q.agent && q.home != null).slice(0, 8)) { const a = q.agent; a.hidden = false; a.inside = null; a.frozen = false; a.path = null; a.x = P.x + (Math.random() - 0.5) * 120; a.y = P.y + 40; q.errand = null; } _said.length = 0; });
for (let i = 0; i < 15; i++) await p.waitForTimeout(2000);
console.log('called home:', await p.evaluate(() => O.KidsChores.called.size), '|', (await p.evaluate(() => _said.filter((x) => /SUPPER|Coming|In!|supper|say it again|one more/.test(x)).slice(0, 6).join(' / '))).slice(0, 300));
await done();
