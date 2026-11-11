// Error sweep: a few minutes of a day at speed, walking the town, collecting any console errors.
import { start } from './lib.mjs';
const { p, done } = await start();
const errs = new Map(); p.on('console', (m) => { if (m.type() === 'error') { const k = m.text().slice(0, 160); errs.set(k, (errs.get(k) || 0) + 1); } });
const SEASON = process.env.SEASON; if (SEASON) await p.evaluate((se) => { Object.defineProperty(O.SimRef.cur, 'season', { value: se, configurable: true }); }, SEASON);
const spots = await p.evaluate(() => { const s = O.SimRef.cur; return s.world.buildings.filter((b) => b.doorX != null).map((b) => [b.doorX * 16 + 8, (b.doorY + 3) * 16]).filter((_, i) => i % 3 === 0).slice(0, 30); });
for (let h = 0; h < 24; h += (SEASON ? 2 : 1)) { await p.evaluate((h) => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < h && g++ < 4000) s.tick(1); O.game.clock.minute = s.minute; }, h); for (let k = 0; k < 2; k++) { const sp = spots[(h * 2 + k) % spots.length]; await p.evaluate((sp) => { O.game.player.x = sp[0]; O.game.player.y = sp[1]; }, sp); await p.waitForTimeout(3500); } }
console.log('distinct console errors:', errs.size); for (const [k, n] of errs) console.log(n + 'x', k.replace(/file:\/\/[^ ]*html/g, 'H'));
await done();
