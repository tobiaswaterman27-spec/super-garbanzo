import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const q = s.people.find((q) => q.age >= 20 && q.agent && q.alive !== false && !/guard|watch/.test(q.job?.role || '')); const a = q.agent; a.hidden = false; a.inside = null; a.frozen = false; a.x = P.x + 40; a.y = P.y + 10; q.errand = null; const w = s.people.find((x) => /guard|watch|sergeant/.test(x.job?.role || '') && x.agent); if (w) { w.agent.hidden = false; w.agent.inside = null; w.agent.frozen = false; w.agent.x = P.x + 90; w.agent.y = P.y; w.errand = null; }
  const cr = s.recordCrime({ kind: 'theft', perp: q, placeName: 'the square', tile: [Math.floor(a.x / 16), Math.floor(a.y / 16)], seen: [], severity: 1 }); s.arrestNPC(q, cr, false); window._q = q; return q.first + ' arrested; task ' + (q.task && q.task.act); });
console.log(r);
await p.waitForTimeout(4000); if (D) await p.screenshot({ path: `${D}/escort.png`, clip: { x: 450, y: 300, width: 300, height: 180 } });
console.log('escorted:', await p.evaluate(() => O.Escort.pairs.has(_q) ? O.Escort.pairs.get(_q).first : 'no'), 'walking:', await p.evaluate(() => !!_q.agent.path));
for (let i = 0; i < 30 && await p.evaluate(() => O.Escort.pairs.size > 0); i++) await p.waitForTimeout(2000);
console.log('arrived/cleared:', await p.evaluate(() => O.Escort.pairs.size === 0), 'inside', await p.evaluate(() => _q.agent.inside != null || _q.agent.hidden), 'frozen guards', await p.evaluate(() => O.SimRef.cur.people.filter((x) => x._escort).length));
await done();
