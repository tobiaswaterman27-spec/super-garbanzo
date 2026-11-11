// Rough music: when notorious, neighbours gather at your door of an evening banging pans; muck on the door after.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 19.5 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; const b = s.world.buildings.find((x) => x.type === 'house' && x.doorX != null && x.sprite); b.owner = { kind: 'player' }; O.PlayerState.rep.criminal = 0.8; O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 6) * 16; });
let on = false; for (let i = 0; i < 8 && !on; i++) { await p.waitForTimeout(1000); on = await p.evaluate(() => !!O.RoughMusic.on); }
console.log('rough music:', on);
await p.waitForTimeout(15000);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/roughmusic.png', clip: { x: 360, y: 150, width: 480, height: 320 } });
console.log('crowd at the door:', await p.evaluate(() => O.RoughMusic.on ? O.RoughMusic.on.crowd.filter((q) => q.agent.frozen).length : 0));
await p.evaluate(() => { const R = O.RoughMusic.on; if (R) { O.game.player.x = R.b.doorX * 16 + 8; O.game.player.y = (R.b.doorY + 1) * 16 + 8; } });
await p.waitForTimeout(9000);
console.log('ended:', await p.evaluate(() => !O.RoughMusic.on), '| muck on the door:', await p.evaluate(() => O.RoughMusic.marks.length), '| held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._rough).length));
await done();
