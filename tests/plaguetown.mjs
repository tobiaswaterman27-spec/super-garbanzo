// A town under quarantine: cloths to the face, herb fires smouldering, bread on the marked steps.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const v = s.people.filter((q) => q.age > 20).slice(0, 4); for (const q of v) s.fallIll(q, 'pestilence', 0.3); s.quarantine = { since: s.day }; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = x0 * 16 + 40; O.game.player.y = y0 * 16 + 40; });
await p.waitForTimeout(4000);
console.log('herb fires:', await p.evaluate(() => O.PlagueTown.fires().length));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/plague.png', clip: { x: 360, y: 200, width: 480, height: 300 } });
await done();
