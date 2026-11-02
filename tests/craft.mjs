import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 9 * 60; O.game.clock.minute = 9 * 60; });
await p.waitForTimeout(800);
// quality and bad food
console.log(await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState; for (const bz of s.biz.values()) O.CraftLife.rateBiz(s, bz); const qs = [...s.biz.values()].map(b => b.quality).filter(x => x != null); let sick = 0;
  for (let i = 0; i < 40; i++) { PS.ill = null; PS.add('meat'); PS.foodQ.meat = { q: 0.2, day: s.day - 6, from: 'Test Kitchen' }; O.consume('meat'); }
  return 'quality range ' + Math.min(...qs).toFixed(2) + '..' + Math.max(...qs).toFixed(2); }));
await p.waitForTimeout(8000);
console.log(await p.evaluate(() => 'after bad stale meat: ill ' + JSON.stringify(O.PlayerState.ill)));
// promotion
console.log(await p.evaluate(() => { const s = O.SimRef.cur; const bz = [...s.biz.values()].find(z => (z.def.jobs || []).some(([r]) => r === 'labourer')); const boss = s.bossOf(bz); const d0 = s.hireDecision; s.hireDecision = () => ({ yes: true, role: 'labourer', wage: 6 }); O.Employment.hireByTalk(s, boss); s.hireDecision = d0; const e = O.PlayerState.emp; e.stats.shifts = 6; s.newDay(); return 'level ' + e.level + ' title ' + e.title + ' wage ' + e.wage + ' note ' + JSON.stringify(e.promoteNote) + ' orders ' + (O.PlayerState.orders || []).length; }));
// accident on risky work
console.log(await p.evaluate(() => { const PS = O.PlayerState, e = PS.emp; const r0 = Math.random; Math.random = () => 0.001; try { O.jobAct({ t: { kind: 'chore', anim: 'hammer', id: 'x', text: 'x', mins: 1, need: 1, have: 0 } }); } catch (err) {} Math.random = r0; return 'risky act done'; }));
await p.waitForTimeout(2500);
console.log(await p.evaluate(() => 'injury ' + JSON.stringify(O.PlayerState.injury)));
// apprentice
console.log(await p.evaluate(async () => { const s = O.SimRef.cur, PS = O.PlayerState; PS.emp.level = 2; const y = s.people.find(q => q.age >= 12 && q.age <= 17 && !q.job); if (!y) return 'no youth'; let line = ''; await O.AIChat.say(y, 'Will you be my apprentice?', (l) => { line = l; }); return 'youth ' + y.first + ': ' + line + ' | apprentice ' + JSON.stringify(PS.apprentice && PS.apprentice.name); }));
// seasonal chores
console.log(await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'winter', configurable: true }); const e = O.PlayerState.emp, bz = s.biz.get(e.biz); return O.choreTasks(s, bz, e).map(t => t.text).filter(t => /ice|salt|lamb|shear/i.test(t)).join(', '); }));
console.log(await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState; PS.orders = []; const r0 = Math.random; Math.random = () => 0.1; s.newDay(); Math.random = r0; const o = PS.orders[0]; return 'order: ' + (o ? o.name + ' wants ' + o.qty + ' ' + o.good + ' by day ' + o.due + ' for ₳' + o.pay : 'none (this workplace makes nothing)'); }));
await done();
