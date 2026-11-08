// The ferry: in a place with a ferry trade, the flat boat crosses and recrosses with its ferryman.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => O.teleport('aurelia')); await p.waitForTimeout(3000);
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => { const F = O.Ferry.F; if (!F) return null; O.game.player.x = (F.a[0] + F.b[0]) / 2; O.game.player.y = (F.a[1] + F.b[1]) / 2 + 40; F.wait = 0; return Math.round(Math.hypot(F.b[0] - F.a[0], F.b[1] - F.a[1])); });
console.log('ferry across', r, 'px');
const k0 = await p.evaluate(() => O.Ferry.F && O.Ferry.F.k);
await p.waitForTimeout(5000);
if (process.env.SHOT) { await p.evaluate(() => { const F = O.Ferry.F; O.game.player.x = F.a[0] + (F.b[0] - F.a[0]) * F.k + 40; O.game.player.y = F.a[1] + (F.b[1] - F.a[1]) * F.k + 30; }); await p.waitForTimeout(400); } if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, clip: { x: 440, y: 260, width: 320, height: 200 } });
const k1 = await p.evaluate(() => O.Ferry.F && O.Ferry.F.k);
console.log('moved', k0 != null && k1 != null && Math.abs(k1 - k0) > 0.01 ? 'yes' : 'no', (k0 ?? 0).toFixed(2), (k1 ?? 0).toFixed(2));
await done();
