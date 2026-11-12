// The hen's out: the goodwife chases it down the lane; you can grab it for her.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const h = s.world.buildings.find((b) => b.type === 'house' && b.doorX != null); O.game.player.x = h.doorX * 16 + 8; O.game.player.y = (h.doorY + 4) * 16; O.RunawayHen.soon(); });
await p.waitForTimeout(2500);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/hen.png', clip: { x: 360, y: 180, width: 480, height: 300 } });
let got = false; for (let i = 0; i < 12 && !got && (await p.evaluate(() => !!O.RunawayHen.chase && !O.RunawayHen.chase.caughtAt)); i++) { got = await p.evaluate(() => { const H = O.RunawayHen.chase; const P = O.game.player; P.x = H.hen.x + 6; P.y = H.hen.y + 2; P.locked = false; const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && /Grab the hen/.test(x.label)); if (!c) return false; c.act(); return !!O.RunawayHen.chase.caughtAt; }); await p.waitForTimeout(700); }
console.log('chase:', await p.evaluate(() => !!O.RunawayHen.chase), '| you caught it:', got);
await p.waitForTimeout(6000);
console.log('caught:', await p.evaluate(() => O.RunawayHen.caught), '| held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._hen).length));
await done();
