import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
const r = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const ad = s.people.filter((q) => q.age >= 18 && q.agent && q.alive !== false && !q.agent.frozen).slice(0, 2); ad.forEach((q, i) => { const a = q.agent; a.hidden = false; a.inside = null; a.path = null; a.x = P.x + 30 + i * 20; a.y = P.y + 20; q.errand = null; }); O.Mishaps.spill(ad[0]); const sp = O.Mishaps.spills[0]; return `${ad[0].first} spilt ${sp.kind}, helper ${sp.helper ? sp.helper.first : '-'}`; });
console.log(r);
for (let i = 0; i < 12 && await p.evaluate(() => O.Mishaps.spills.length > 0); i++) await p.waitForTimeout(1500);
console.log('spill done', await p.evaluate(() => O.Mishaps.spills.length === 0), '|', (await p.evaluate(() => _said.filter((x) => /Bless|Thank|good soul|apples|eggs|no!|Curse/.test(x)).join(' / '))));
// a coin: walk over it
const m0 = await p.evaluate(() => { const P = O.game.player; O.Mishaps.coins.push({ x: P.x + 20, y: P.y, v: 1, t: 0 }); return O.PlayerState.money; });
await p.keyboard.down('ArrowRight'); await p.waitForTimeout(600); await p.keyboard.up('ArrowRight');
console.log('coin found:', await p.evaluate((m0) => O.PlayerState.money - m0, m0));
// rain: folk shelter
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = true; if (s.weather) s.weather.kind = 'rain'; });
await p.waitForTimeout(10000);
console.log('sheltering:', await p.evaluate(() => [...O.Errands.live].filter((q) => q.errand && q.errand.anim === 'look').length), 'held', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._mish).length));
await done();
