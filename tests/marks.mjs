import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 22) s.tick(2); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const q = s.people.find((q) => q.gang && q.gang !== 'player' && q.alive !== false && !q.jailUntil && q.agent && q.age >= 12); if (!q) return 'no gang member';
  const b = s.world.buildings.find((b) => b.doorX != null && b.w >= 4 && Math.hypot(b.doorX * 16 - P.x, b.doorY * 16 - P.y) < 300) || s.world.buildings.find((b) => b.doorX != null && b.w >= 4);
  const a = q.agent; a.hidden = false; a.inside = null; a.frozen = false; a.path = null; a.x = b.doorX * 16 + 40; a.y = (b.bottom + 1) * 16 + 12; q.errand = null; q._bit = null; P.x = a.x; P.y = a.y + 40; const at = O.GangMarks.chalk(q, b.id); return `${q.first} of ${q.gang} chalking at bld ${b.id}: ${!!at}`; });
console.log(r);
await p.waitForTimeout(9000); if (D) await p.screenshot({ path: `${D}/mark.png`, clip: { x: 450, y: 250, width: 300, height: 200 } });
console.log('marks', await p.evaluate(() => O.GangMarks.marks().length), 'acting', await p.evaluate(() => O.GangMarks.acting.length));
const s2 = await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; s.day += 0; const m = O.GangMarks.marks()[0]; if (!m) return 'none'; m.day = s.day - 2; const w = s.people.find((q) => /guard|watch|sergeant/.test(q.job?.role || '') && q.alive !== false && q.agent); if (!w) return 'no watch'; const a = w.agent; a.hidden = false; a.inside = null; a.frozen = false; a.x = m.x + 30; a.y = m.y + 30; w.errand = null; O.GangMarks.scrub(w, m); return w.first + ' scrubbing'; });
console.log(s2);
await p.waitForTimeout(12000);
console.log('marks after scrub', await p.evaluate(() => O.GangMarks.marks().length), 'acting', await p.evaluate(() => O.GangMarks.acting.length), 'held', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._mark).length));
// let a night run on its own
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 22) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(25000);
console.log('natural night marks', await p.evaluate(() => O.GangMarks.marks().length + ' acting ' + O.GangMarks.acting.length));
await done();
