import { start } from './lib.mjs';
const { p, done } = await start(); p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 18) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
const r = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const well = s.world.props.find((x) => x.kind === 'well' || x.kind === 'bench'); const ad = s.people.filter((q) => q.age >= 18 && q.age < 35 && q.agent && q.alive !== false && !q.visitor); const a = ad.find((q) => q.sex === 'm'), b = ad.find((q) => q.sex === 'f');
  for (const q of [a, b]) { const x = q.agent; x.hidden = false; x.inside = null; x.frozen = false; x.path = null; x.x = well.x + 100; x.y = well.y + 40; q.errand = null; q._bit = null; } P.x = well.x + 60; P.y = well.y + 60; const w = O.Courting2.start(a, b); return w ? `${a.first} & ${b.first}, path ${w.path.length}` : 'NO'; });
console.log(r);
for (let i = 0; i < 30 && await p.evaluate(() => !!O.Courting2.walk); i++) { await p.waitForTimeout(2000); if (i % 5 === 0) console.log('  ', await p.evaluate(() => O.Courting2.walk ? O.Courting2.walk.stage + ' ' + O.Courting2.walk.pi : 'done')); }
console.log('done; held', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._walkout).length), '|', (await p.evaluate(() => _said.filter((x) => /Walk with|evening|For you|picked|sweet|fool|Thank|Ewww|tree/.test(x)).join(' / '))).slice(0, 300));
await done();
