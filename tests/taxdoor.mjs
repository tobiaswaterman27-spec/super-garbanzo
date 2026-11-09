// The tax collector at the door: the householder comes out and pays, pleads or argues.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.weekday === 0 && Math.floor(s.minute / 60) === 10) && g++ < 8000) s.tick(2); O.game.clock.minute = s.minute; });
const who = await p.evaluate(() => { const s = O.SimRef.cur; const c = s.people.find((q) => q.job?.role === 'tax collector' || (s.world.hamlet && q.job?.role === 'guard captain')); if (!c) return null; const hh = s.households.filter((h) => !h.gone && h.home != null && h.members.some((id) => { const q = s.byId.get(id); return q && q.agent && q.agent.inside === h.home && q.age >= 16; })).sort((a, b) => { const A = s.building(a.home), B = s.building(b.home); return Math.hypot(A.doorX * 16 - c.agent.x, A.doorY * 16 - c.agent.y) - Math.hypot(B.doorX * 16 - c.agent.x, B.doorY * 16 - c.agent.y); })[0]; if (!hh) return 'no house'; hh.taxDue = 3; hh._visited = false; c.task = { act: 'collect', b: hh.home }; const b = s.building(hh.home); O.game.player.x = b.doorX * 16 + 30; O.game.player.y = b.doorY * 16 + 60; return c.first; });
console.log('collector:', who);
let n = 0; for (let i = 0; i < 30 && !n; i++) { await p.waitForTimeout(2000); n = await p.evaluate(() => O.TaxDoor.seen); }
console.log('doorstep scenes:', n);
await p.waitForTimeout(18000);
console.log('left held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._taxdoor).length), await p.evaluate(() => O.TaxDoor.scenes.map((S) => S.t.toFixed(1) + ' ' + (S.s === O.SimRef.cur)).join(',')));
await done();
