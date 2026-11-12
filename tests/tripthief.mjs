// Trip the cutpurse: when a thief runs past you in a chase, put out a foot; the mark gets the purse back.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const out = s.people.filter((q) => q.age >= 16 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand); const thief = out[0], victim = out[1]; victim.agent.x = thief.agent.x + 10; victim.agent.y = thief.agent.y; s.household(victim).money = Math.max(s.household(victim).money, 40); O.game.player.x = thief.agent.x + 80; O.game.player.y = thief.agent.y; O.Cutpurse.start(thief, victim); });
let tr = false; for (let i = 0; i < 30 && !tr; i++) { await p.waitForTimeout(500); const st = await p.evaluate(() => O.Cutpurse.job && O.Cutpurse.job.stage); if (st && st !== 'chase') await p.evaluate(() => O.Cutpurse.cry()); if (st === 'chase') tr = await p.evaluate(() => { const ta = O.Cutpurse.job.thief.agent, P = O.game.player; P.x = ta.x + 8; P.y = ta.y + 4; P.locked = false; const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && /Trip /.test(x.label)); if (!c) return false; c.act(); return c.label; }); }
console.log('tripped:', tr, '| count:', await p.evaluate(() => O.Cutpurse.tripped));
await p.waitForTimeout(3500);
console.log('chase over:', await p.evaluate(() => !O.Cutpurse.job));
await done();
