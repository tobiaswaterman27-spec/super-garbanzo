// Take the ferry: pay a penny at the landing, ride across, step off on the far bank.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => O.teleport('aurelia')); await p.waitForTimeout(3000);
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; if (s.weather) s.weather.forced = 'clear'; });
await p.waitForTimeout(1500);
// wait for the boat to be in at a landing, and stand by it
let at = null;
for (let i = 0; i < 200 && !at; i++) { at = await p.evaluate(() => { const F = O.Ferry.F; if (!F || !(F.wait > 1) || (F.k > 0.001 && F.k < 0.999)) return null; const x = F.a[0] + (F.b[0] - F.a[0]) * F.k, y = F.a[1] + (F.b[1] - F.a[1]) * F.k; O.game.player.x = x + 10; O.game.player.y = y + 10; O.PlayerState.money = Math.max(5, O.PlayerState.money || 0); return [Math.round(x), Math.round(y), F.k]; }); if (!at) await p.waitForTimeout(500); }
console.log('boat in at:', at);
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const c = O.moreCandidates.map((f) => f()).find((x) => x && /ferryman|passage/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', r);
const from = await p.evaluate(() => [Math.round(O.game.player.x), Math.round(O.game.player.y)]);
for (let i = 0; i < 90 && (await p.evaluate(() => !!O.FerryRide.ride)); i++) await p.waitForTimeout(1000);
const to = await p.evaluate(() => [Math.round(O.game.player.x), Math.round(O.game.player.y)]);
console.log('rides:', await p.evaluate(() => O.FerryRide.rides), 'crossed px:', Math.round(Math.hypot(to[0] - from[0], to[1] - from[1])), 'locked:', await p.evaluate(() => O.game.player.locked), 'on water:', await p.evaluate(() => { const s = O.SimRef.cur, w = s.world, P = O.game.player; const i = Math.floor(P.y / 16) * w.W + Math.floor(P.x / 16); return w.ter[i] === w.TER.WATER; }));
await done();
