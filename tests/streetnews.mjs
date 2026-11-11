// "Did you hear?": someone who saw the bull today calls out to you about it as you pass.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; O.TownTalk.tell(null, null, 'A bull got loose in the street today and nearly trampled folk before the men roped it.', 'There was a bull loose in the street today, they say.'); window.__s = []; const _say = O.Speech.say; O.Speech.say = function (w, t) { if (/bull/.test(t)) window.__s.push(t); return _say.apply(this, arguments); }; });
for (let i = 0; i < 15 && !(await p.evaluate(() => O.StreetNews.calls)); i++) { await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const q = s.people.find((x) => (x.beliefs || []).some((b) => /bull/.test(b.t)) && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand); if (q) { P.x = q.agent.x + 10; P.y = q.agent.y + 5; } }); await p.waitForTimeout(1300); }
console.log('called out:', await p.evaluate(() => O.StreetNews.calls), '|', await p.evaluate(() => window.__s[0] || ''));
await done();
