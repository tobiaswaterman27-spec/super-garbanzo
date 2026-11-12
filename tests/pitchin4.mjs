// Joining in: grain thrown over a wedding couple; a bowed head as a coffin passes.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const act = (re) => p.evaluate((src) => { O.game.player.locked = false; const r = new RegExp(src); const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && r.test(x.label)); if (!c) return false; c.act(); return c.label; }, re);
await p.evaluate(() => { const s = O.SimRef.cur; while (s.minute < 9.65 * 60) s.tick(2); O.game.clock.minute = s.minute; });
await p.evaluate(() => { const s = O.SimRef.cur; const hh = s.households.find((h) => h.members.length >= 3 && !h.gone); const who = s.byId.get(hh.members[0]); O.Processions.funeral({ kind: 'funeral', day: s.day, who: who.id, name: who.name }); });
let f = false; for (let i = 0; i < 15 && !f; i++) { await p.waitForTimeout(1000); await p.evaluate(() => { const pr = O.Processions.proc; const c = pr && pr.bearers && pr.bearers[0]; if (c) { O.game.player.x = c.agent.x + 30; O.game.player.y = c.agent.y + 10; } }); f = await act('bow your head'); }
await p.waitForTimeout(8000);
console.log('funeral:', f, '| passers-by bowed:', await p.evaluate(() => O.Processions.npcBowed));
await p.evaluate(() => { const pr = O.Processions.proc; if (pr) { pr.t = 999; } }); await p.waitForTimeout(1500);
const w = await p.evaluate(() => { const s = O.SimRef.cur; const ad = s.people.filter((q) => q.age >= 18 && q.age < 40 && q.agent && q.alive !== false && !q._proc); const a = ad.find((q) => q.sex === 'm'), b = ad.find((q) => q.sex === 'f'); const ok = O.Processions.wedding({ kind: 'wedding', day: s.day, a: a.id, b: b.id }); if (!ok) return 'NO'; const pr = O.Processions.proc; O.game.player.x = pr.door[0]; O.game.player.y = pr.door[1] + 60; return `wedding ${a.first} & ${b.first}, ${pr.guests.length} guests, fiddler ${pr.fid ? pr.fid.first : '-'}`; });
let g = false; for (let i = 0; i < 15 && !g; i++) { await p.waitForTimeout(1000); await p.evaluate(() => { const pr = O.Processions.proc; if (pr && pr.a) { O.game.player.x = pr.a.agent.x + 30; O.game.player.y = pr.a.agent.y + 10; } }); g = await act('grain over the couple'); }
console.log('wedding:', g, '| threw:', await p.evaluate(() => O.Processions.threw), '| bowed:', await p.evaluate(() => O.Processions.bowed));
await done();
