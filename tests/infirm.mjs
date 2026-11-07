import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const old = s.people.filter((q) => q.age >= 68 && q.agent).length; const q = s.people.find((q) => q.age >= 20 && q.age < 40 && q.agent && q.alive !== false); q.health.illness = { kind: 'injury', sev: 0.5, days: 0 }; const a = q.agent; a.hidden = false; a.inside = null; a.x = P.x + 30; a.y = P.y; const o = s.people.find((q) => q.age >= 68 && q.agent); if (o) { o.agent.hidden = false; o.agent.inside = null; o.agent.x = P.x + 60; o.agent.y = P.y; } return `elders ${old}; hurt ${O.Infirm.hurt(q)}`; });
console.log(r);
await p.waitForTimeout(1500); if (D) await p.screenshot({ path: `${D}/infirm.png`, clip: { x: 560, y: 340, width: 140, height: 80 } });
await done();
