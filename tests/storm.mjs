import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; window._k = {}; const g = O.gesture; O.gesture = (q, k, ...r) => { _k[k] = (_k[k] || 0) + 1; return g(q, k, ...r); }; });
await p.waitForTimeout(1000);
await p.evaluate(() => O.Sound && O.Sound.play('thunder', 1));
await p.waitForTimeout(1500);
console.log('reactions', await p.evaluate(() => JSON.stringify(_k)), 'kids running', await p.evaluate(() => [...O.Errands.live].filter((q) => q.age < 12).length));
await done();
