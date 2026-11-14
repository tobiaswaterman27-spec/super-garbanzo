// Wanted bills: the watch nail up your likeness; townsfolk read, recognise you and run for the watch; tear one down.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 9 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; O.PlayerState.bounty = true; const P = O.game.player; const sp = O.WantedBills.spots(s)[0]; P.x = sp.x + 120; P.y = sp.gy + 40; });
console.log('level:', await p.evaluate(() => O.PlayerState.wantedLevel()), 'spots:', await p.evaluate(() => O.WantedBills.spots(O.SimRef.cur).length));
for (let i = 0; i < 60 && (await p.evaluate(() => O.WantedBills.nailed < O.WantedBills.spots(O.SimRef.cur).length)); i++) await p.waitForTimeout(1000);
console.log('nailed:', await p.evaluate(() => O.WantedBills.nailed + ' likeness ' + !!O.WantedBills.likeness));
// readers: put people near a bill, player close by, no chase yet
await p.evaluate(() => { const s = O.SimRef.cur, b = O.WantedBills.bills(s)[0], P = O.game.player; if (O.Law.chasing()) O.Law.endChase(true); for (const g of s.people) if (/guard/.test(g.job?.role || '') && g.agent) { g.agent.x = b.x + 900; g.agent.path = null; } P.x = b.x + 50; P.y = b.gy + 24; let k = 0; for (const q of s.people) if (q.age >= 14 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand && !/guard/.test(q.job?.role || '') && k < 4) { q.agent.x = b.x - 20 + k * 12; q.agent.y = b.gy + 20; q.agent.path = null; k++; } });
for (let i = 0; i < 40 && (await p.evaluate(() => O.WantedBills.spotted < 1)); i++) { await p.waitForTimeout(1000); await p.evaluate(() => { const s = O.SimRef.cur, b = O.WantedBills.bills(s)[0], P = O.game.player; if (O.WantedBills.read > 0) { const q = s.people.find((q) => q._bill === s.day && q.agent && !q.errand); if (q) { P.x = q.agent.x + 30; P.y = q.agent.y; } } }); }
console.log('read/spotted:', await p.evaluate(() => [O.WantedBills.read, O.WantedBills.spotted].join('/')));
await p.screenshot({ path: (process.env.SD || '.') + '/wantedbills.png' });
await p.waitForTimeout(8000);
console.log('chase:', await p.evaluate(() => O.Law.chasing()));
await p.evaluate(() => { if (O.Law.chasing()) O.Law.endChase(true); });
// tear one down, with nobody about
console.log('tear:', await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const L = O.WantedBills.bills(s); const b = L[L.length - 1]; for (const q of s.people) if (q.agent && Math.hypot(q.agent.x - b.x, q.agent.y - b.gy) < 140) { q.agent.x += 400; q.agent.path = null; } P.locked = false; P.x = b.x; P.y = b.gy + 6; if (O.npcUI.talking()) O.npcUI.closeTalk(); const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Tear down/.test(x.label)); if (!c) return 'no prompt'; const n = L.length; c.act(); return c.label + ' ' + n + '->' + O.WantedBills.bills(s).length; }));
// cleared: bills come down
console.log('cleared:', await p.evaluate(() => { O.PlayerState.bounty = false; return O.PlayerState.wantedLevel(); }));
await p.waitForTimeout(3000);
console.log('after:', await p.evaluate(() => O.WantedBills.bills(O.SimRef.cur).length));
console.log('rogue bills:', await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const L = O.WantedBills.rogues(s); if (!L.length) return 'none (' + O.Bounties.offers(s, 'watch').map((o) => o.kind).join(',') + ')'; const b = L[0]; P.locked = false; P.x = b.x; P.y = b.gy + 4; const c = O.moreCandidates.map((f) => f()).find((x) => x && /claim the bounty/.test(x.label)); if (!c) return L.length + ' no prompt'; O.PlayerState.contract = null; c.act(); return L.length + ' | ' + c.label + ' | contract ' + (O.PlayerState.contract && O.PlayerState.contract.kind) + ' face ' + !!b.face; }));
await p.screenshot({ path: (process.env.SD || '.') + '/roguebills.png' });
await done();
