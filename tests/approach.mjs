import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 11 * 60; O.game.clock.minute = 11 * 60; });
await p.waitForTimeout(1500);
const prep = (k) => p.evaluate((k) => { const s = O.SimRef.cur, P = O.game.player, PS = O.PlayerState; if (O.npcUI.talking()) O.npcUI.closeTalk(); if (O.UI.dialogOpen()) O.UI.dialog.close();
  const pool = s.people.filter((q) => q.agent && !q.agent.hidden && q.agent.inside == null && !q.visitor && q.age >= 16 && !q.job?.onShift).slice(0, 12); pool.forEach((q, i) => { q.agent.x = P.x + 30 + i * 6; q.agent.y = P.y; q.errand = null; q._scene = false; q.agent.frozen = false; q.activity = { act: 'stroll' }; });
  const q = pool[0];
  if (k === 'borrow') { q.rel.set(0, { affinity: 0.4, familiar: 0.5 }); s.household(q).money = 2; }
  if (k === 'fetch') { q.age = Math.max(q.age, 35); s.household(q).money = 60; PS.fetchFor = null; }
  if (k === 'warn') { q.rel.set(0, { affinity: 0.6, familiar: 0.5 }); PS.crimes.push(0); PS.wantedLevel = () => 1; }
  if (k === 'supper') { q.rel.set(0, { affinity: 0.6, familiar: 0.6 }); }
  if (k === 'reckoning') { q.rel.set(0, { affinity: -0.6, familiar: 0.5 }); (q.memories = q.memories || []).push({ text: 'The stranger punched me.', day: s.day }); }
  if (k === 'race') { q.age = 17; q.traits.push('brave'); }
  return O.Approaches.force(k); }, k);
for (const k of ['borrow', 'fetch', 'warn', 'supper', 'reckoning', 'race']) console.log(k.padEnd(10), (await prep(k)) || 'nobody fitting');
console.log(await p.evaluate(() => 'fetch pending: ' + JSON.stringify(O.PlayerState.fetchFor)));
console.log(await p.evaluate(() => { const s = O.SimRef.cur, F = O.PlayerState.fetchFor; if (!F) return 'no fetch'; const q = s.byId.get(F.q); O.PlayerState.add(F.g); const m0 = O.PlayerState.money; O.NpcActs.apply(s, q, { do: 'give', item: F.g, gift: true }, q); for (const f of O.onGift || []) f(s, q, { g: F.g }); return 'handed over: fetch now ' + JSON.stringify(O.PlayerState.fetchFor) + ' tip ' + (O.PlayerState.money - m0); }));
await done();
