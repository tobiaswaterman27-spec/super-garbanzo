// Ducks (and ducklings in spring), swans, and a heron on the water.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'spring', configurable: true }); let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const w = s.world, P = O.game.player; let best = null, bd = 1e9; for (let y = 2; y < w.H - 2; y += 2) for (let x = 2; x < w.W - 2; x += 2) { if (w.ter[y * w.W + x] !== w.TER.WATER) continue; const d = Math.hypot(x * 16 - P.x, y * 16 - P.y); if (d < bd) { bd = d; best = [x, y]; } } P.x = best[0] * 16 + 30; P.y = best[1] * 16 + 90; });
await p.waitForTimeout(3000);
console.log('on the water:', await p.evaluate(() => { const F = O.Waterfowl.flock; return F ? F.ducks.filter((d) => !d.young).length + ' ducks, ' + F.ducks.filter((d) => d.young).length + ' ducklings, ' + F.swans.length + ' swans, ' + F.herons.length + ' heron' : 'none'; }));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/fowl.png' });
const before = await p.evaluate(() => { const d = O.Waterfowl.flock.ducks.find((d) => !d.young); if (!d) return null; const x = d.x; O.game.player.x = d.x + 20; O.game.player.y = d.y + 20; return x; });
await p.waitForTimeout(2500);
console.log('ducks paddle away when you come close:', before != null ? await p.evaluate((x) => Math.abs(O.Waterfowl.flock.ducks.find((d) => !d.young).x - x) > 5, before) : 'n/a');
await done();
