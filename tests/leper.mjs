// The leper at the town's end with his clapper and bowl on a pole; folk swing wide; the player can give.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const seat = await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const L = O.Leper.seat(); if (!L) return null; O.game.player.x = L.x + (L.rx - L.x) + 4; O.game.player.y = L.y + 8; return [Math.round(L.x), Math.round(L.y)]; });
console.log('seat:', seat);
await p.waitForTimeout(2500);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/leper.png', clip: { x: 360, y: 200, width: 480, height: 300 } });
const r = await p.evaluate(() => { const PS = O.PlayerState; PS.money = Math.max(PS.money || 0, 10); const m0 = PS.money; const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && /leper/.test(x.label)); if (!c) return 'no prompt'; c.act(); return m0 - PS.money; });
console.log('gave:', r);
await p.waitForTimeout(1500);
console.log('gifts:', await p.evaluate(() => O.Leper.gifts), '| unlocked:', await p.evaluate(() => !O.game.player.locked));
await done();
