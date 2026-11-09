// Wassailing on winter evenings: a band with a lantern sings at doors and is given cake or pennies.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'winter', configurable: true }); s.raining = false; let g = 0; while (!(Math.floor(s.minute / 60) === 17 && s.minute % 60 >= 20) && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; s.weather.forced = 'clear'; s.weather.kind = 'clear'; O.Wassail.soon(); });
let band = null; for (let i = 0; i < 10 && !band; i++) { await p.waitForTimeout(3000); band = await p.evaluate(() => { const W = O.Wassail.band; if (!W) { O.Wassail.soon(); return null; } O.game.player.x = W.band[0].agent.x + 30; O.game.player.y = W.band[0].agent.y + 40; return W.band.map((q) => q.first).join(', '); }); }
console.log('wassailers:', band);
const phases = new Set(); for (let i = 0; i < 20; i++) { await p.waitForTimeout(3000); const r = await p.evaluate(() => { const W = O.Wassail.band; if (W) { O.game.player.x = W.band[0].agent.x + 30; O.game.player.y = W.band[0].agent.y + 50; } return W ? W.phase : 'done'; }); phases.add(r); if (r === 'sing' && process.env.SD && !globalThis.shot) { globalThis.shot = 1; await p.waitForTimeout(1500); await p.screenshot({ path: process.env.SD + '/wassail.png', clip: { x: 420, y: 240, width: 340, height: 220 } }); } }
console.log('phases:', [...phases].join(' '), '| doors that gave:', await p.evaluate(() => O.Wassail.doors));
await done();
