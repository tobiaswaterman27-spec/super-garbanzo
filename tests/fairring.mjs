// The fair games out on the green: townsfolk wrestle in a roped ring and shoot at the butts; you call someone out and shoot.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; s.hosted = { day: s.day, kind: 'fair' }; });
const g = await p.evaluate(() => { const s = O.SimRef.cur; O.FairRing.soon(); const lists = s.world.props.find((x) => x.kind === 'noticeboard') || s.world.props.find((x) => x.kind === 'well'); const P = O.game.player; P.x = lists.x; P.y = lists.y + 30; return 'fair ' + O.Festivals.today(s); });
console.log(g);
for (let i = 0; i < 30 && !(await p.evaluate(() => O.FairRing.bout && O.FairRing.bout.stage === 'grip')); i++) await p.waitForTimeout(500);
console.log('ground:', await p.evaluate(() => { const G = O.FairRing.ground; return G ? 'ring ' + !!G.ring + ' butts ' + !!G.butt : 'none'; }), 'bout:', await p.evaluate(() => { const B = O.FairRing.bout; return B ? B.a.first + ' v ' + B.b.first + ' ' + B.stage + ' crowd ' + B.crowd.length : 'none'; }));
await p.evaluate(() => { const G = O.FairRing.ground, P = O.game.player; P.x = G.ring[0] + 30; P.y = G.ring[1] + 50; });
await p.waitForTimeout(2500);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/fairring.png' });
for (let i = 0; i < 60 && (await p.evaluate(() => !!O.FairRing.bout)); i++) await p.waitForTimeout(500);
console.log('npc bouts', await p.evaluate(() => O.FairRing.bouts), 'npc shots', await p.evaluate(() => O.FairRing.npcShots));
// call a neighbour out, in words
const foe = await p.evaluate(async () => { const s = O.SimRef.cur, G = O.FairRing.ground, P = O.game.player; P.x = G.ring[0]; P.y = G.ring[1] + 30; O.PlayerState.money = 20; O.PlayerState.hp = 90; const q = s.people.find((q) => q.age >= 20 && q.age <= 40 && q.agent && q.agent.inside == null && !q.agent.hidden && !q._fair && !q.errand); q.agent.x = P.x + 20; q.agent.y = P.y; let out = ''; await O.AIChat.say(q, 'Fancy a wrestle? I will throw you', (l) => { out = l; }); return q.first + ': ' + out; });
console.log('challenge', foe);
for (let i = 0; i < 80 && (await p.evaluate(() => O.FairRing.youWrestled === 0)); i++) await p.waitForTimeout(500);
console.log('you wrestled', await p.evaluate(() => O.FairRing.youWrestled + ' won ' + O.FairRing.youWon + ' money ' + O.PlayerState.money));
await p.waitForTimeout(2500);
// the butts
for (let i = 0; i < 40 && (await p.evaluate(() => !!O.FairRing.archer)); i++) await p.waitForTimeout(500);
await p.evaluate(() => { const G = O.FairRing.ground, P = O.game.player; P.x = G.line[0]; P.y = G.line[1]; P.locked = false; });
console.log('state:', await p.evaluate(() => { const s = O.SimRef.cur; return 'A ' + !!O.FairRing.archer + ' B ' + !!O.FairRing.bout + ' locked ' + O.game.player.locked + ' talk ' + !!(O.npcUI.talking && O.npcUI.talking()) + ' hour ' + s.hour + ' scene ' + !!O.game.scene + ' dialog ' + !!(O.UI.dialogOpen && O.UI.dialogOpen()); }));
let sh = 'no prompt'; for (let i = 0; i < 20 && sh === 'no prompt'; i++) { sh = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); O.npcUI.closeTalk && O.npcUI.closeTalk(); const G = O.FairRing.ground, P = O.game.player; P.x = G.line[0]; P.y = G.line[1]; P.locked = false; const c = O.moreCandidates.map((f) => f()).find((c) => c && /butts/.test(c.label)); if (!c) return 'no prompt'; c.act(); return c.label; }); if (sh === 'no prompt') await p.waitForTimeout(1000); }
console.log('shoot:', sh);
for (let i = 0; i < 30 && (await p.evaluate(() => O.FairRing.youShot === 0)); i++) await p.waitForTimeout(500);
console.log('you shot', await p.evaluate(() => O.FairRing.youShot), 'arrows in straw', await p.evaluate(() => O.FairRing.stuck));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/fairbutts.png' });
await p.waitForTimeout(1500);
// the judging: your bread on the table among the neighbours' entries; the judges go round
const jt = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); O.npcUI.closeTalk && O.npcUI.closeTalk(); const s = O.SimRef.cur, G = O.FairRing.ground, P = O.game.player; P.locked = false; O.PlayerState.items.push('bread'); const tb = G.table || (O.moreCandidates.map((f) => f()), O.FairRing.ground.table); if (!tb) return 'no table'; P.x = tb[0]; P.y = tb[1] + 10; const c = O.moreCandidates.map((f) => f()).find((c) => c && /judges' table/.test(c.label)); if (!c) return 'no prompt, entries ' + (O.FairRing.judging && O.FairRing.judging.ents.length); c.act(); O.FairRing.judgeNow(s); return 'entries ' + O.FairRing.judging.ents.length + ' stage ' + O.FairRing.judging.stage; });
console.log('judging:', jt);
for (let i = 0; i < 60 && (await p.evaluate(() => O.FairRing.judged === 0)); i++) await p.waitForTimeout(500);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/fairjudge.png' });
console.log('judged', await p.evaluate(() => O.FairRing.judged + ' you placed ' + O.FairRing.youPlaced + ' bread back ' + O.PlayerState.items.includes('bread')));
await p.waitForTimeout(5000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._fair).length), 'locked', await p.evaluate(() => O.game.player.locked));
await done();
