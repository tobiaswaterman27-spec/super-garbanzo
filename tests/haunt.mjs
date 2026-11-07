import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (!(s.day % 2 === 0 && s.minute >= 20.3 * 60)) s.tick(3); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const s = O.SimRef.cur; const there = s.people.filter((q) => q.activity && typeof q.activity.zone === 'string' && q.activity.zone.startsWith('haunt:')); if (!there.length) return 'nobody at a haunt'; const q = there[0]; O.game.player.x = q.agent.x + 30; O.game.player.y = q.agent.y + 30; return there.length + ' at haunts'; });
console.log(r);
let best = 0; for (let i = 0; i < 10; i++) { await p.waitForTimeout(2000); best = Math.max(best, await p.evaluate(() => [...O.Haunt.rings.values()].reduce((a, r) => a + r.ppl.length, 0))); }
console.log('in dice rings (max):', best, '| pots', await p.evaluate(() => [...O.Haunt.rings.values()].map((r) => r.pot).join(',')));
await done();
