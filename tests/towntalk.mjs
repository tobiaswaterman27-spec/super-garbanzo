// Talk of the town: those who saw a loose bull (or your rescue of a lost child) remember it and tell their households.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; O.LooseBull.soon(); });
for (let i = 0; i < 120 && !(await p.evaluate(() => O.LooseBull.caught)); i++) { await p.waitForTimeout(1000); await p.evaluate(() => { if (!O.LooseBull.bull) O.LooseBull.soon(); }); }
await p.waitForTimeout(1500);
const r = await p.evaluate(() => { const s = O.SimRef.cur; const seen = s.people.filter((q) => (q.beliefs || []).some((b) => /bull got loose/.test(b.t))).length, heard = s.people.filter((q) => (q.beliefs || []).some((b) => /bull loose/.test(b.t) && b.src === 'rumour')).length; return { seen, heard, told: O.TownTalk.told }; });
console.log('bull caught:', await p.evaluate(() => O.LooseBull.caught), '| saw it:', r.seen, '| heard at home:', r.heard, '| tales:', r.told);
await done();
