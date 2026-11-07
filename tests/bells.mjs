import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { window._k = {}; const g = O.gesture; O.gesture = (q, k, ...r) => { _k[k] = (_k[k] || 0) + 1; return g(q, k, ...r); }; window._snd = 0; const o = O.sfx; O.sfx = (k, ...r) => { if (k === 'churchbell') _snd++; return o(k, ...r); }; });
await p.evaluate(() => { const s = O.SimRef.cur; while (s.minute < 11.95 * 60) s.tick(1); O.game.clock.minute = s.minute; });
await p.waitForTimeout(500);
await p.evaluate(() => { const s = O.SimRef.cur; while (s.minute < 12 * 60 + 1) s.tick(0.5); O.game.clock.minute = s.minute; });
console.log('queue after noon', await p.evaluate(() => O.Bells.queue.length)); await p.waitForTimeout(8000);
console.log('bell strokes', await p.evaluate(() => _snd), 'queued', await p.evaluate(() => O.Bells.queue.length), 'prayers', await p.evaluate(() => _k.pray || 0));
await done();
