import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
const setup = () => p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const ad = s.people.filter((q) => q.age >= 18 && q.age < 45 && q.agent && q.alive !== false && !q.visitor && !q._cp && !q.jailUntil && !/guard|watch|sergeant/.test(q.job?.role || ''));
  const [th, v, w] = ad; [th, v, w].forEach((q, i) => { const a = q.agent; a.hidden = false; a.inside = null; a.path = null; a.frozen = false; a.x = P.x + 40 + i * 14; a.y = P.y + 20; a.dir = 2; q.activity = { act: 'stroll' }; q.errand = null; q._bit && (q._bit.t = 1e9); q.job && (q.job.onShift = false); });
  s.household(v).money = Math.max(60, s.household(v).money); window._v = v; window._th = th; window._vm = s.household(v).money; window._tm = s.household(th).money; return O.Cutpurse.start(th, v) + ' ' + th.first + '->' + v.first; });
console.log('start', await setup());
await p.waitForTimeout(6000);
console.log('after dip: victim lost', await p.evaluate(() => _vm - O.SimRef.cur.household(_v).money), 'thief stage', await p.evaluate(() => O.Cutpurse.job ? O.Cutpurse.job.stage : 'none'), 'recent', await p.evaluate(() => O.Cutpurse.recent.length));
// tell the victim by speech
const line = await p.evaluate(() => new Promise((res) => { O.AIChat.say(_v, "that man just cut your purse", (l) => res(l)); }));
console.log('told victim:', line);
await p.waitForTimeout(500);
// a chase: start a fresh one and cry at once
await p.waitForTimeout(3000);
console.log('start2', await setup());
await p.waitForTimeout(4500);
await p.evaluate(() => O.Cutpurse.cry());
let st = ''; for (let i = 0; i < 16; i++) { await p.waitForTimeout(1000); st = await p.evaluate(() => O.Cutpurse.job ? O.Cutpurse.job.stage + ' chasers ' + O.Cutpurse.job.chasers.length + ' gap ' + Math.round(Math.hypot(O.Cutpurse.job.thief.agent.x - O.Cutpurse.job.victim.agent.x, O.Cutpurse.job.thief.agent.y - O.Cutpurse.job.victim.agent.y)) : 'done'); if (st === 'done') break; }
console.log('chase end:', st, '| said:', (await p.evaluate(() => _said.slice(-5).join(' / '))).slice(0, 300));
console.log('stuck frozen:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.agent && q.agent.frozen && !q._bit && !q._playing && !q._scene && !q._fighting && !q._cp && O.npcUI.talking() !== q).length), 'cp left', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._cp).length));
await done();
