import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (!(s.weekday === 6 && s.minute >= 9 * 60)) s.tick(5); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8 + 10; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
await p.waitForTimeout(1500);
console.log('sellers', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.countrySeller).map((q) => q.job.role + '@' + (q.activity?.act || '?')).join(', ')));
await p.waitForTimeout(25000);
if (D) await p.screenshot({ path: `${D}/market.png` });
console.log('standing', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.countrySeller && q.activity?.act === 'stand').length), 'deals now', await p.evaluate(() => O.MarketDay.deals.length));
await p.waitForTimeout(20000);
console.log('sold', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.countrySeller).reduce((a, q) => a + (q.purse || 0), 0)), '|', (await p.evaluate(() => _said.slice(-8).join(' / '))).slice(0, 400));
// buying by speech from a seller (the wares panel turns into talk)
const t = await p.evaluate(() => { const q = O.SimRef.cur.people.find((q) => q.countrySeller && q.activity?.act === 'stand'); if (!q) return 'none'; O.npcUI.startFrom ? O.npcUI.startFrom(q, 'Morning') : 0; return q.first; });
console.log('talking to', t);
await p.evaluate(() => { const s = O.SimRef.cur; while (s.minute < 15 * 60) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(3000);
console.log('after noon: country stalls', await p.evaluate(() => O.SimRef.cur.world.props.filter((x) => x.country != null).length), 'sellers left', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.countrySeller).length), 'deal-frozen', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._deal).length));
await done();
