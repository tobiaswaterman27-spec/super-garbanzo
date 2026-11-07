import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
for (const k of ['carter', 'pilgrims', 'drover', 'friar', 'pedlar', 'messenger', 'troops']) {
  const r = await p.evaluate((k) => { const pt = O.RoadFolk.spawn(k); if (!pt) return 'NO'; return `${pt.ppl.map((q) => q.name).join(', ')} path ${pt.path.length}`; }, k);
  console.log(k.padEnd(10), r);
}
await p.evaluate(() => { const pt = O.RoadFolk.parties.find((x) => x.kind === 'drover') || O.RoadFolk.parties[0]; O.game.player.x = pt.lead[0] - 30; O.game.player.y = pt.lead[1] + 20; });
await p.waitForTimeout(6000); if (D) await p.screenshot({ path: `${D}/road.png`, clip: { x: 420, y: 260, width: 360, height: 220 } });
for (let i = 0; i < 60 && await p.evaluate(() => O.RoadFolk.parties.length > 0); i++) { await p.waitForTimeout(3000); if (i % 10 === 0) console.log('  ', await p.evaluate(() => O.RoadFolk.parties.map((x) => x.kind + ':' + x.stage + ':' + x.pi + '/' + (x.stage === 'out' ? x.back.length : x.path.length)).join(' '))); }
console.log('left', await p.evaluate(() => O.RoadFolk.parties.length), 'roadfolk in town', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.roadfolk).length), '|', (await p.evaluate(() => _said.filter((x) => /Pins|Ave|Hup|Alms|Make way|cart|butcher|Ribbons|Bread|Come by/.test(x)).slice(0, 5).join(' / '))));
await done();
