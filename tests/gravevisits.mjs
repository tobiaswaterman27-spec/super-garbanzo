// The dead are visited: kin kneel at the grave and leave a posy.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.weekday === 6 && s.minute >= 13 * 60 + 30) && g++ < 8000) s.tick(2); O.game.clock.minute = s.minute; s.raining = false;
  // a widow: someone married, whose spouse "lies" in the chapel yard
  const w = s.people.find((q) => q.spouse && q.age > 30 && q.agent && q.activity?.act !== 'work'); const dead = s.byId.get(w.spouse); const ch = s.building(s.chapelId);
  s.world.props.push({ kind: 'gravestone', x: (ch.doorX + 4) * 16 + 8, y: (ch.doorY + 3) * 16 + 14, seed: dead.id, solid: true, grave: { name: dead.name, age: dead.age, cause: 'died of a fever' } });
  globalThis._widow = w; O.game.player.x = (ch.doorX + 4) * 16 + 30; O.game.player.y = (ch.doorY + 5) * 16; O.GraveVisits.soon(); });
let seen = null; for (let i = 0; i < 20 && !seen; i++) { await p.waitForTimeout(4000); seen = await p.evaluate(() => { const V = O.GraveVisits.visits[0]; if (!V) return null; return V.kind + ' by ' + V.q.first + ' (' + (V.q === globalThis._widow ? 'the widow' : 'other') + ')'; }); if (!seen) await p.evaluate(() => O.GraveVisits.soon()); }
console.log('grave visit:', seen);
await p.waitForTimeout(8000);
console.log('posies laid:', await p.evaluate(() => O.GraveVisits.laid));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/grave.png', clip: { x: 440, y: 280, width: 300, height: 180 } });
await done();
