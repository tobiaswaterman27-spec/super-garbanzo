// Sheep-washing in the river before the shearing.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => O.teleport('aurelia')); await p.waitForTimeout(3000);
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'spring', configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; s.weather.forced = 'clear'; s.weather.kind = 'clear'; const w = s.world, P = O.game.player; let best = null, bd = 1e9; for (let y = 2; y < w.H - 2; y += 2) for (let x = 2; x < w.W - 2; x += 2) { if (w.ter[y * w.W + x] !== w.TER.WATER) continue; const d = Math.hypot(x * 16 - P.x, y * 16 - P.y); if (d < bd) { bd = d; best = [x, y]; } } P.x = best[0] * 16 + 8; P.y = best[1] * 16 + 60; O.SheepWash.soon(); });
let ok = null; for (let i = 0; i < 25 && !ok; i++) { await p.waitForTimeout(3000); ok = await p.evaluate(() => { const J = O.SheepWash.job; if (!J) { O.SheepWash.soon(); return null; } return J.men.length >= 2 ? 'washing' : null; }); }
console.log('sheep-washing:', ok);
if (ok && process.env.SD) { await p.evaluate(() => { const J = O.SheepWash.job; O.game.player.x = J.x + 40; O.game.player.y = J.y + 50; }); await p.waitForTimeout(4000); await p.screenshot({ path: process.env.SD + '/sheepwash.png', clip: { x: 420, y: 230, width: 340, height: 220 } }); }
await p.waitForTimeout(25000);
console.log('sheep washed:', await p.evaluate(() => O.SheepWash.washed));
await done();
