// Work leaves traces in the air: sparks in the smithy, sawdust, flour, dust, suds.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
for (const t of ['smithy', 'carpenter', 'bakery']) { await p.evaluate((t) => { const s = O.SimRef.cur; if (O.game.scene) O.game.exitBuilding(); const b = s.world.buildings.find((b) => b.type === t); if (b) O.game.enterBuilding(b, 0); }, t); await p.waitForTimeout(5000); console.log(t, 'particles', await p.evaluate(() => O.WorkFx.parts.length), await p.evaluate(() => [...O.game.scene.actors.values()].map((a) => a.anim).join(','))); if (t === 'smithy' && process.env.SD) await p.screenshot({ path: process.env.SD + '/workfx.png', clip: { x: 340, y: 120, width: 520, height: 540 } }); }
await p.evaluate(() => O.game.exitBuilding()); await p.waitForTimeout(4000);
console.log('outdoors particles', await p.evaluate(() => O.WorkFx.parts.length));
await done();
