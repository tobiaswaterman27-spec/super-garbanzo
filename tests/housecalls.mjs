import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; const q = s.people.find((q) => q.age >= 20 && q.home != null && s.building(q.home) && s.building(q.home).doorX != null && q.agent); q.health.state = 'ill'; q.health.illness = { kind: 'fever', sev: 0.5, days: 0 }; q.agent.inside = q.home; q.agent.hidden = true; q.task = null; const b = s.building(q.home); O.game.player.x = b.doorX * 16; O.game.player.y = (b.doorY + 4) * 16; window._q = q; });
let v = 0; for (let i = 0; i < 12 && !v; i++) { await p.waitForTimeout(2000); v = await p.evaluate(() => O.HouseCalls.visits.size); }
console.log('callers on their way:', v, await p.evaluate(() => [...O.HouseCalls.visits].map((q) => q.first + ':' + q._call).join(',')));
await done();
