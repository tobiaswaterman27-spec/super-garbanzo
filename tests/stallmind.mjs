// Minding a stall on market day: a neighbour seller minds it when you don't; you mind one, serve, and are counted.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; while (!(s.weekday === 6 && s.minute >= 9 * 60)) s.tick(5); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8 + 10; });
await p.waitForTimeout(6000);
console.log('sellers standing:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.countrySeller && q.activity?.act === 'stand').length));
// 1) nobody answers: the next seller minds it
for (let i = 0; i < 20 && !(await p.evaluate(() => !!O.StallMind.job)); i++) { await p.evaluate(() => O.StallMind.soon()); await p.waitForTimeout(600); }
console.log('asked:', await p.evaluate(() => O.StallMind.job && O.StallMind.job.sl.first));
for (let i = 0; i < 120 && (await p.evaluate(() => !!O.StallMind.job)); i++) await p.waitForTimeout(1000);
console.log('minded by a neighbour:', await p.evaluate(() => O.StallMind.byNpc));
// 2) you mind it: accept, serve whoever comes, catch any thief
for (let i = 0; i < 20 && !(await p.evaluate(() => !!O.StallMind.job)); i++) { await p.evaluate(() => { const s = O.SimRef.cur; const q = s.people.find((q) => q.countrySeller && q.activity?.act === 'stand' && !q.agent.path && !q._mind); if (q) { O.game.player.x = q.agent.x + 10; O.game.player.y = q.agent.y + 6; } O.StallMind.soon(); }); await p.waitForTimeout(600); }
const who = await p.evaluate(() => { const K = O.StallMind.job; if (!K) return null; const a = K.sl.agent; O.game.player.x = a.x + 10; O.game.player.y = a.y; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Mind /.test(x.label)); if (!c) return 'no prompt'; c.act(); return K.sl.first; });
console.log('you mind:', who);
const before = await p.evaluate(() => O.PlayerState.money);
for (let i = 0; i < 160 && (await p.evaluate(() => !!O.StallMind.job)); i++) {
  await p.evaluate(() => { const K = O.StallMind.job; if (!K || !K.sl.fairStall) return; const P = O.game.player; const tx = K.sl.fairStall.tile[0] * 16 + 8, ty = K.sl.fairStall.tile[1] * 16 + 10; P.x = tx; P.y = ty; for (const c of O.moreCandidates.map((f) => f()).filter(Boolean)) if (/^Sell |^Catch /.test(c.label)) { const tgt = (K.buyer || K.thief); if (tgt) { P.x = tgt.agent.x + 8; P.y = tgt.agent.y; } const c2 = O.moreCandidates.map((f) => f()).find((x) => x && x.label === c.label); if (c2) c2.act(); P.x = tx; P.y = ty; } });
  await p.waitForTimeout(800); }
console.log('minded/sold/caught/robbed/honest:', await p.evaluate(() => [O.StallMind.minded, O.StallMind.sold, O.StallMind.caught, O.StallMind.robbed, O.StallMind.honest].join('/')), 'money delta', (await p.evaluate(() => O.PlayerState.money)) - before);
await p.waitForTimeout(2000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._mind).length), 'hidden sellers:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.countrySeller && q.agent.hidden).length));
await done();
