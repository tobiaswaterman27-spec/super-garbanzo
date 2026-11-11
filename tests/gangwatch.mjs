// The lookout's whistle: the watch comes by the gang's corner; some stroll off, the rest act innocent, then jeer.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 20.2 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; });
let at = null;
for (let i = 0; i < 30 && !at; i++) { await p.waitForTimeout(1000); at = await p.evaluate(() => { const s = O.SimRef.cur; for (const g of s.gangs) { if (g.id === 'player') continue; const out = g.members.map((m) => s.byId.get(m.id)).filter((q) => q && q.agent && !q.agent.hidden && q.agent.inside == null && ((typeof q.activity?.zone === 'string' && q.activity.zone.startsWith('haunt:')) || q.activity?.act === 'gangmeet')); if (out.length >= 1) { const a = out[0].agent; O.game.player.x = a.x + 60; O.game.player.y = a.y + 40; return [g.name, out.length, Math.round(a.x), Math.round(a.y)]; } } return null; }); }
console.log('at the haunt:', at);
await p.waitForTimeout(4000);
await p.evaluate(() => { const s = O.SimRef.cur, g = s.gangs.find((x) => x.id !== 'player' && x.members.some((m) => { const q = s.byId.get(m.id); return q && ((typeof q.activity?.zone === 'string' && q.activity.zone.startsWith('haunt:')) || q.activity?.act === 'gangmeet') && !q.agent.hidden; })); if (!g) return; const q0 = g.members.map((m) => s.byId.get(m.id)).find((q) => q && ((typeof q.activity?.zone === 'string' && q.activity.zone.startsWith('haunt:')) || q.activity?.act === 'gangmeet') && !q.agent.hidden); const gd = s.people.find((q) => /guard/.test(q.job?.role || '') && !q.gang && q.agent); if (gd && q0) { gd.agent.inside = null; gd.agent.hidden = false; gd.agent.x = q0.agent.x + 70; gd.agent.y = q0.agent.y + 10; } });
let seen = 0; for (let i = 0; i < 30; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => O.GangWatch.alerts.length); if (r) seen++; if (seen && !r) break; }
console.log('whistles:', await p.evaluate(() => O.GangWatch.warned), '| alert lasted (s):', seen);
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._gwatch).length));
// you, as one of the crew, whistle first
await p.waitForTimeout(65000);
const yours = await p.evaluate(() => { const s = O.SimRef.cur, g = s.gangs.find((x) => x.id !== 'player' && x.members.length); if (!g) return 'no gang'; O.PlayerState.gangRanks = (O.PlayerState.gangRanks || []); O.PlayerState.gangRanks.push({ place: s.world.placeId, placeName: s.world.name, gid: g.id, name: g.name, rank: 0, done: 0, trust: 0.2, since: s.day, task: null }); const q0 = g.members.map((m) => s.byId.get(m.id)).find((q) => q && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand); if (!q0) return 'nobody out'; const gd = s.people.find((q) => /guard/.test(q.job?.role || '') && !q.gang && q.agent); gd.agent.inside = null; gd.agent.hidden = false; gd.agent.x = q0.agent.x + 200; gd.agent.y = q0.agent.y; O.game.player.x = q0.agent.x + 20; O.game.player.y = q0.agent.y + 10; O.game.player.locked = false; const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && /Whistle a warning/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('your whistle:', yours, '| yours:', await p.evaluate(() => O.GangWatch.yours));
await p.waitForTimeout(25000);
console.log('held after:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._gwatch).length));
await done();
