// Your turn: you go down on the ice and are helped up; a friend visits when you're ill; your sweetheart proposes; your wife's time comes and you run for the midwife.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; });
const nearSomeone = () => p.evaluate(() => { const s = O.SimRef.cur; const q = s.people.find((x) => x.age >= 16 && x.agent && x.agent.inside == null && !x.agent.hidden && !x.agent.frozen && !x.errand && !x.visitor); O.game.player.x = q.agent.x + 40; O.game.player.y = q.agent.y; return q.id; });
// 1) a fall
await nearSomeone(); await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); O.PlayerState.money = 20; O.YourTurn.trip('ice', true); });
await p.waitForTimeout(8000);
console.log('falls/upBy:', await p.evaluate(() => [O.YourTurn.falls, O.YourTurn.upBy].join('/')), 'money after spill:', await p.evaluate(() => O.PlayerState.money), 'locked:', await p.evaluate(() => O.game.player.locked));
// 2) ill, a friend visits
const fid = await nearSomeone(); await p.evaluate((fid) => { const s = O.SimRef.cur; const q = s.byId.get(fid); q.rel.set(0, { affinity: 0.7, familiar: 0.6 }); O.PlayerState.ill = { kind: 'cold', sev: 0.3, day: s.day }; O.YourTurn.visitSoon(); }, fid);
for (let i = 0; i < 35 && !(await p.evaluate(() => O.YourTurn.visits)); i++) await p.waitForTimeout(1000);
console.log('visits:', await p.evaluate(() => O.YourTurn.visits)); await p.evaluate(() => { O.PlayerState.ill = null; });
// 3) your sweetheart proposes
const sid = await p.evaluate(() => { const s = O.SimRef.cur; const sp = (O.Forge && O.Forge.spec && O.Forge.spec()) || { sex: 'm' }; const q = s.people.find((x) => x.age >= 18 && x.age <= 40 && x.sex !== sp.sex && !x.spouse && !x.visitor && x.agent && x.agent.inside == null && !x.agent.hidden && !x.agent.frozen && !x.errand) || s.people.find((x) => x.age >= 18 && x.age <= 50 && x.sex !== sp.sex && !x.spouse && !x.visitor && x.agent); if (q.errand && O.Errands.cancel) O.Errands.cancel(q); q.agent.inside = null; q.agent.hidden = false; q.rel.set(0, { affinity: 0.8, familiar: 0.8 }); q.withPlayer = 'courting'; O.PlayerState.partner = { place: s.world.placeId, id: q.id, name: q.first, full: q.name, stage: 'courting', since: s.day - 6 }; O.game.player.x = q.agent.x + 50; O.game.player.y = q.agent.y; return q.id; });
for (let i = 0; i < 6 && !(await p.evaluate(() => !!O.YourTurn.proposal)); i++) { await p.evaluate(() => O.YourTurn.askSoon()); await p.waitForTimeout(500); }
for (let i = 0; i < 30 && !(await p.evaluate(() => O.YourTurn.proposal && O.YourTurn.proposal.at)); i++) await p.waitForTimeout(1000);
const yes = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const X = O.YourTurn.proposal; if (!X) return 'no proposal'; const P = O.game.player; P.x = X.q.agent.x + 14; P.y = X.q.agent.y; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Say yes/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label + ' -> ' + (O.PlayerState.partner && O.PlayerState.partner.stage); });
console.log('proposal:', yes);
// 4) married, and your wife's time comes
const lab = await p.evaluate((sid) => { const s = O.SimRef.cur; const q = s.byId.get(sid); if (O.YourTurn.proposal) { } O.PlayerState.partner = { place: s.world.placeId, id: q.id, name: q.first, full: q.name, stage: 'married', since: s.day - 30, wed: s.day - 20 }; q.withPlayer = 'married'; O.PlayerState.expecting = { place: s.world.placeId, due: s.day + 1, since: s.day - 19 }; return !!q.home; }, sid);
for (let i = 0; i < 40 && !(await p.evaluate(() => O.YourTurn.labour && O.YourTurn.labour.at < 1e9)); i++) { await nearSomeone(); await p.waitForTimeout(1000); }
console.log('labour herald:', await p.evaluate(() => O.YourTurn.labour && O.YourTurn.labour.h.first + ' for midwife ' + O.YourTurn.labour.mw.first));
const run = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const L = O.YourTurn.labour; if (!L) return 'none'; const P = O.game.player; P.x = L.h.agent.x + 12; P.y = L.h.agent.y; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Run for/.test(x.label)); if (!c) return 'no run prompt'; c.act(); const s = O.SimRef.cur, a = L.mw.agent, at = a.inside != null && s.building(a.inside); P.x = at ? at.doorX * 16 + 12 : a.x + 10; P.y = at ? (at.doorY + 1) * 16 + 8 : a.y; const c2 = O.moreCandidates.map((f) => f()).find((x) => x && /time/.test(x.label)); if (!c2) return 'no tell prompt'; c2.act(); return c2.label; });
console.log('you ran:', run, 'yourFetch:', await p.evaluate(() => O.YourTurn.yourFetch));
await p.waitForTimeout(6000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._yours && !q.errand).length));
await done();
