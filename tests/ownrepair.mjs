// Mending your own house: up the ladder yourself (a neighbour may foot it); or hire a builder in words.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const bid = await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const b = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null)[6]; b.owner = { kind: 'player' }; b.condition = 0.35; b.needsRepair = true; O.game.player.x = b.doorX * 16 + 8 + 18; O.game.player.y = (b.doorY + 1) * 16 + 6; O.PlayerState.items = O.PlayerState.items || []; O.PlayerState.items.push('planks'); return b.id; });
await p.waitForTimeout(800);
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const c = O.moreCandidates.map((f) => f()).find((x) => x && /roof/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', r);
for (let i = 0; i < 40 && (await p.evaluate(() => !!O.OwnRepair.job)); i++) await p.waitForTimeout(1000);
console.log('selfJobs:', await p.evaluate(() => O.OwnRepair.selfJobs), 'footed:', await p.evaluate(() => O.OwnRepair.footed), 'cond:', await p.evaluate((bid) => O.SimRef.cur.building(bid).condition.toFixed(2), bid));
// hire a builder for the rest
const h = await p.evaluate(async (bid) => { const s = O.SimRef.cur; s.building(bid).condition = 0.4; O.PlayerState.money = 50; const q = s.people.find((x) => /builder|carpenter|thatcher|labourer|mason/.test(x.job?.role || '') && x.agent && x.alive !== false && !x.agent.frozen); if (!q) return 'no builder'; if (q.agent.inside != null) { const b0 = s.building(q.agent.inside); q.agent.inside = null; q.agent.hidden = false; if (b0) { q.agent.x = b0.doorX * 16 + 8; q.agent.y = (b0.doorY + 1) * 16 + 8; } } O.game.player.x = q.agent.x + 20; O.game.player.y = q.agent.y; O.npcUI.openTalk(q); let a = '', b = ''; await O.AIChat.say(q, 'Could you mend my roof?', (l) => { a = l; }); await O.AIChat.say(q, 'Yes, do it.', (l) => { b = l; }); return q.first + ': ' + a + ' / ' + b; }, bid);
console.log('hire:', h);
for (let i = 0; i < 120 && (await p.evaluate(() => !!O.OwnRepair.hire)); i++) await p.waitForTimeout(1000);
console.log('hired:', await p.evaluate(() => O.OwnRepair.hired), 'cond:', await p.evaluate((bid) => O.SimRef.cur.building(bid).condition.toFixed(2), bid), 'held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._ownrep && !q.errand).length));
// and with nobody footing the ladder, it can skid
const fl = await p.evaluate((bid) => { const s = O.SimRef.cur, b = s.building(bid); b.condition = 0.4; O.PlayerState.items.push('planks'); const P = O.game.player; P.x = b.doorX * 16 + 8 + 18; P.y = (b.doorY + 1) * 16 + 6; for (const q of s.people) if (q.agent && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 300 && !q.agent.hidden) { q.agent.x += 600; } const c = O.moreCandidates.map((f) => f()).find((x) => x && /roof/.test(x.label)); if (!c) return 'no prompt'; c.act(); O.OwnRepair.slipNext(); return 'up'; }, bid);
for (let i = 0; i < 20 && (await p.evaluate(() => !!O.OwnRepair.job)); i++) await p.waitForTimeout(1000);
console.log('ladder:', fl, 'falls:', await p.evaluate(() => O.YourTurn.falls));
await p.waitForTimeout(7000);
console.log('locked after:', await p.evaluate(() => O.game.player.locked));
await done();
