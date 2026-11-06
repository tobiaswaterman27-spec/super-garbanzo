import { start } from './lib.mjs';
const { p, done } = await start();
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState; for (let d = 0; d < 6; d++) { const d0 = s.day; let g = 0; while (s.day === d0 && g++ < 2000) { s.tick(2); PS.tick(2, false); } } });
await cdp.send('Profiler.start');
await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState; for (let d = 0; d < 3; d++) { const d0 = s.day; let g = 0; while (s.day === d0 && g++ < 2000) { s.tick(2); PS.tick(2, false); } } });
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(), byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; const cnt = new Map(); profile.samples.forEach((id, i) => cnt.set(id, (cnt.get(id) || 0) + (dt[i] || 0)));
for (const [id, t] of cnt) { const n = byId.get(id), f = n.callFrame, k = `${f.functionName || '(anon)'} @${f.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + t); }
const tot = [...self.values()].reduce((a, b) => a + b, 0);
console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, t]) => `${(t / tot * 100).toFixed(1)}% ${k}`).join('\n'));
await done();
