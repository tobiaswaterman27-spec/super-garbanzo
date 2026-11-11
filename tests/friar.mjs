// A friar preaches at the cross: a crowd listens, prays, weeps, heckles; then the bowl goes round (and you can give).
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; if (s.weather) s.weather.raining = false; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8 + 8; O.game.player.y = (y0 + y1) * 8 + 60; O.PlayerState.money = Math.max(O.PlayerState.money || 0, 10); O.Friar.soon(); const q = s.people[3]; q.beliefs = q.beliefs || []; q.beliefs.unshift({ t: 'A bull got loose in the street today and nearly trampled folk before the men roped it.', src: 'seen', day: s.day }); window.__said = []; const _say = O.Speech.say; O.Speech.say = function (who, t) { if (who && who.first === 'the friar') window.__said.push(t); return _say.apply(this, arguments); }; });
let shot = false, gave = false;
for (let i = 0; i < 90; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const F = O.Friar.sermon; return F ? F.phase + ' ' + F.crowd.filter((c) => c.q._friar && c.q.agent.frozen).length : 'none'; }); if (i % 10 === 0) console.log(i, r); if (!shot && /preach [3-9]/.test(r) && process.env.SD) { shot = true; await p.screenshot({ path: process.env.SD + '/friar.png', clip: { x: 360, y: 160, width: 480, height: 300 } }); }
  if (!gave && /bowl/.test(r)) { gave = await p.evaluate(() => { const F = O.Friar.sermon; O.game.player.x = F.x + 10; O.game.player.y = F.y + 20; O.game.player.locked = false; const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && /friar/.test(x.label)); if (!c) return false; c.act(); return true; }); }
  if (r === 'none' && i > 3) break; }
console.log('preached on the bull:', await p.evaluate(() => window.__said.some((t) => /bull/.test(t))));
console.log('sermons:', await p.evaluate(() => O.Friar.sermons), '| alms:', await p.evaluate(() => O.Friar.alms), '| you gave:', gave);
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._friar).length));
await done();
