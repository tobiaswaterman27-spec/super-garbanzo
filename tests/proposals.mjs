// Asking: a proposal in the street (yes and a wedding, or no); and the matchmaker's nudge in words.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; });
const pair = () => p.evaluate(() => { const s = O.SimRef.cur; const ok = (q) => q.agent && q.agent.inside == null && !q.agent.hidden && !q.agent.frozen && !q.errand && !q.spouse && !q.withPlayer && !q.visitor && q.age >= 18 && q.age <= 48;
  for (const q of s.people) if (q.agent && q.agent.inside != null && !q.spouse && !q.withPlayer && !q.visitor && q.age >= 18 && q.age <= 48 && !q.agent.frozen && !q.errand) { const hb = s.building(q.agent.inside); if (hb && hb.doorX != null) { q.agent.inside = null; q.agent.hidden = false; q.agent.x = hb.doorX * 16 + 8; q.agent.y = (hb.doorY + 1) * 16 + 8; } }
  const ppl = s.people.filter(ok); for (const a of ppl) { const b = ppl.find((x) => x.sex !== a.sex && x.household !== a.household); if (!b) continue; b.agent.x = a.agent.x + 40; b.agent.y = a.agent.y; b.agent.path = null; s.relate(a, b, 0.6); s.relate(b, a, 0.6); O.game.player.x = a.agent.x + 40; O.game.player.y = a.agent.y + 20; return [a.id, b.id, a.first + ' & ' + b.first]; } return null; });
const pr = await pair(); console.log('pair:', pr && pr[2]);
await p.evaluate((pr) => { const s = O.SimRef.cur; O.Proposals.begin(s.byId.get(pr[0]), s.byId.get(pr[1])); }, pr);
for (let i = 0; i < 40 && !(await p.evaluate(() => O.Proposals.scene && O.Proposals.scene.stage === 'done')); i++) await p.waitForTimeout(1000);
console.log('outcome:', await p.evaluate(() => O.Proposals.scene && (O.Proposals.scene.ok ? 'yes' : 'no')), 'crowd:', await p.evaluate(() => O.Proposals.scene && O.Proposals.scene.crowd.length));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/propose.png' });
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const X = O.Proposals.scene; if (!X) return 'none'; const P = O.game.player; P.x = X.a.agent.x + 12; P.y = X.a.agent.y + 4; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Congratulate|shoulder/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', r);
await p.waitForTimeout(6000);
console.log('married:', await p.evaluate((pr) => { const s = O.SimRef.cur; return s.byId.get(pr[0]).spouse === pr[1]; }, pr), 'yes/no:', await p.evaluate(() => [O.Proposals.yes, O.Proposals.no].join('/')));
// the matchmaker
const m = await p.evaluate(async () => { const s = O.SimRef.cur; const q = s.people.find((x) => !x.spouse && !x.withPlayer && !x.visitor && x.age >= 18 && x.age <= 40 && x.agent && !x.agent.hidden); const b = s.people.find((x) => x !== q && x.sex !== q.sex && !x.spouse && !x.withPlayer && !x.visitor && x.age >= 18 && x.age <= 40 && x.household !== q.household); s.relate(q, b, 0.5); O.npcUI.openTalk(q); let heard = ''; await O.AIChat.say(q, `You should ask ${b.first} to marry you.`, (l) => { heard = l; }); return q.first + ' -> ' + b.first + ': ' + heard + ' | nudged ' + O.Proposals.nudges.has(q.id); });
console.log('nudge:', m);
await p.waitForTimeout(12000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._propose && !q.errand).length));
// you ask, on one knee
const ya = await p.evaluate(async () => { const s = O.SimRef.cur; const sp = (O.Forge && O.Forge.spec && O.Forge.spec()) || { sex: 'm' }; const q = s.people.find((x) => x.age >= 18 && x.age <= 40 && x.sex !== sp.sex && !x.spouse && !x.withPlayer && !x.visitor && x.agent && x.agent.inside == null && !x.agent.hidden); q.rel.set(0, { affinity: 0.8, familiar: 0.8 }); q.withPlayer = 'courting'; O.PlayerState.partner = { place: s.world.placeId, id: q.id, name: q.first, full: q.name, stage: 'courting', since: s.day - 3 }; O.game.player.x = q.agent.x + 20; O.game.player.y = q.agent.y; O.npcUI.openTalk(q); let h = ''; await O.AIChat.say(q, 'Will you marry me?', (l) => { h = l; }); return q.first + ': ' + h; });
await p.waitForTimeout(1500);
console.log('you asked:', ya, '| stage:', await p.evaluate(() => O.PlayerState.partner && O.PlayerState.partner.stage), 'yourAsks:', await p.evaluate(() => O.Proposals.yourAsks));
await done();
