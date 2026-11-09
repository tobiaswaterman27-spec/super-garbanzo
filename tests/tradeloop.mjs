// Each trade works its round indoors: forge, anvil, tub; dough table, oven; block, rack...
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
for (const t of ['smithy', 'bakery', 'butcher', 'carpenter']) {
  const ok = await p.evaluate((t) => { const s = O.SimRef.cur; if (O.game.scene) O.game.exitBuilding(); const b = s.world.buildings.find((b) => b.type === t); if (!b) return false; O.game.enterBuilding(b, 0); return true; }, t); if (!ok) { console.log(t, 'none here'); continue; }
  const steps = new Set(); for (let i = 0; i < 10; i++) { await p.waitForTimeout(2500); for (const st of await p.evaluate(() => [...O.game.scene.actors.values()].filter((a) => a._step).map((a) => a._step + ':' + a.anim))) steps.add(st); }
  console.log(t, [...steps].join(' '));
  if (t === 'smithy' && process.env.SD) await p.screenshot({ path: process.env.SD + '/forge.png', clip: { x: 340, y: 120, width: 520, height: 540 } });
}
await done();
