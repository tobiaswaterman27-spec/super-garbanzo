// Coming out from a christening: the family at the chapel door, the priest's blessing, pennies flung for the children.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
console.log('event:', await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 12.3 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const mum = s.people.find((q) => q.sex === 'f' && q.age >= 20 && q.age < 40 && s.household(q) && s.household(q).members.length >= 3 && q.agent && !q.agent.frozen && !q.errand); if (!mum || !s.chapelId) return null; s.household(mum).money = Math.max(s.household(mum).money, 50);
  s.npcEvents = s.npcEvents || []; s.npcEvents.push({ kind: 'christening', title: 'test', b: s.chapelId, day: s.day, from: 11, to: s.minute / 60 + 0.02, host: mum.id, open: false });
  const b = s.building(s.chapelId); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 7) * 16; return mum.first; }));
let shot = false;
for (let i = 0; i < 40; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const X = O.Christening.scene; return X ? Math.round(X.t) + ' fam ' + X.fam.length + ' coins ' + O.Christening.coins.length : (O.Christening.held ? 'done' : 'wait'); }); if (i % 4 === 0 || r === 'done') console.log(i, r); if (!shot && /^(6|7) /.test(r) && process.env.SD) { shot = true; await p.screenshot({ path: process.env.SD + '/christening.png', clip: { x: 360, y: 150, width: 480, height: 300 } }); } if (r === 'done') break; }
console.log('pennies thrown:', await p.evaluate(() => O.Christening.held));
await p.waitForTimeout(8000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._christ).length));
await done();
