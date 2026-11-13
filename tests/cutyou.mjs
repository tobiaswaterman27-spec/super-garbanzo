// Your own satchel dipped in a crowd: you feel the tug, shout "Thief!", run him down and have it back; or tell the watch.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; });
const setup = () => p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player, PS = O.PlayerState; if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); O.npcUI.closeTalk && O.npcUI.closeTalk();
  PS.money = 30; PS.items.push('bread', 'cabbage', 'herbs', 'cloth', 'candlestick', 'fish', 'ale');
  const ppl = s.people.filter((q) => q.agent && q.agent.inside == null && !q.agent.hidden && q.age >= 16 && q.age <= 38 && !q.visitor && !/guard|watch/.test(q.job?.role || '')).slice(0, 5);
  ppl.forEach((q, i) => { q.agent.x = P.x + (i - 2) * 20; q.agent.y = P.y + 30 + (i % 2) * 10; q.agent.path = null; });
  const th = ppl[0]; th.traits = ['dishonest']; th.gang = null; th.rel.set(0, { affinity: 0, familiar: 0 }); th.agent.x = P.x + 60; th.agent.y = P.y; window._th = th.id; return th.first + ' pack=' + P.a.outfit.pack; });
console.log('setup:', await setup());
await p.evaluate(() => O.CutYou.soon('feel'));
let st = ''; for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); st = await p.evaluate(() => O.CutYou.job ? O.CutYou.job.stage + ':' + O.CutYou.job.thief.first : 'none'); if (st.startsWith('off')) break; }
console.log('stage:', st, 'felt', await p.evaluate(() => O.CutYou.felt), 'took', await p.evaluate(() => O.CutYou.job && O.CutYou.job.took && O.CutYou.job.took.what));
const before = await p.evaluate(() => O.PlayerState.money + '/' + O.PlayerState.items.length);
const cry = await p.evaluate(() => { const c = O.moreCandidates.map((f) => f()).find((c) => c && /Thief/.test(c.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('prompt:', cry, 'stage', await p.evaluate(() => O.CutYou.job && O.CutYou.job.stage));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/cutyou.png' });
for (let i = 0; i < 30; i++) { const r = await p.evaluate(() => { const J = O.CutYou.job; if (!J || J.stage !== 'chase') return 'x'; const a = J.thief.agent, P = O.game.player; P.x += (a.x - P.x) * 0.5; P.y += (a.y - P.y) * 0.5; return 'c'; }); if (r === 'x') break; await p.waitForTimeout(300); }
console.log('before', before, 'after', await p.evaluate(() => O.PlayerState.money + '/' + O.PlayerState.items.length), 'caught', await p.evaluate(() => O.CutYou.caught));
await p.waitForTimeout(3500);
// the satchel shows on the body
console.log('pack:', await p.evaluate(() => O.game.player.a.outfit.pack));
// tell the watch about one that got away
const told = await p.evaluate(async () => { const s = O.SimRef.cur; const th = s.byId.get(window._th); const w = s.people.find((q) => /guard|watch|sergeant/.test(q.job?.role || '')); if (!w) return 'no watch'; const J = O.CutYou; // fake a past dip
  O.PlayerState.money -= 4; let out = ''; const pr = O.CutYou; return new Promise((res) => { O.AIChat.say(w, `${th.first} stole four aurin out of my bag`, (l) => { out = l; }); setTimeout(() => res(out + ' | told ' + pr.told), 2500); }); });
console.log('watch:', told);
await done();
