// First thing and last: folk stretch and yawn and fling out the wash-water as they step out; cats yowl on the roofs at night.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 5 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(40000);
console.log('morning stretches seen near you:', await p.evaluate(() => O.DawnDusk.mornings), '| cock crowing on a woodpile:', await p.evaluate(() => !!(O.DawnDusk.cock && !O.DawnDusk.cock.none)));
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 23 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; O.DawnDusk.catfight(); });
await p.waitForTimeout(3000);
const f = await p.evaluate(() => { const F = O.DawnDusk.fight; if (!F) return null; O.game.player.x = F.mx; O.game.player.y = F.y + 70; return 'cats on ' + F.b.type + ' roof'; });
console.log('cat fight:', f);
await p.waitForTimeout(3000);
if (process.env.SD && f) await p.screenshot({ path: process.env.SD + '/cats.png', clip: { x: 460, y: 180, width: 280, height: 200 } });
await p.waitForTimeout(16000);
console.log('one bolted:', await p.evaluate(() => { const F = O.DawnDusk.fight; return F ? F.gone : 'over'; }));
await done();
