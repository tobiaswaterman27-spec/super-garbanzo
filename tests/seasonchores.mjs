// Bedding aired from the windows, the cider press in autumn, a serenade under a window on a summer night.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const season = (se, hr) => p.evaluate(([se, hr]) => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: se, configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== hr && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; }, [se, hr]);
await season('summer', 10); await p.waitForTimeout(800);
console.log('houses airing bedding today:', await p.evaluate(() => O.SimRef.cur.world.buildings.filter((b) => b.type === 'house' && O.SeasonChores.airing(b)).length));
if (process.env.SD) { await p.evaluate(() => { const b = O.SimRef.cur.world.buildings.find((b) => b.type === 'house' && O.SeasonChores.airing(b) && (b.floors || 1) > 1) || O.SimRef.cur.world.buildings.find((b) => b.type === 'house' && O.SeasonChores.airing(b)); if (b) { O.game.player.x = b.doorX * 16 + 30; O.game.player.y = b.doorY * 16 + 50; } }); await p.waitForTimeout(800); await p.screenshot({ path: process.env.SD + '/airing.png', clip: { x: 380, y: 160, width: 400, height: 260 } }); }
await season('autumn', 11); await p.waitForTimeout(800);
console.log('press', await p.evaluate(() => O.SeasonChores.press()));
await p.waitForTimeout(25000);
console.log('pressing:', await p.evaluate(() => O.SeasonChores.presses.map((P) => P.ppl.length + ' at the bar, juice ' + P.juice.toFixed(2) + ', apples ' + P.apples).join(' | ')));
if (process.env.SD) { await p.evaluate(() => { const P = O.SeasonChores.presses[0]; if (P) { O.game.player.x = P.x + 30; O.game.player.y = P.y + 40; } }); await p.waitForTimeout(800); await p.screenshot({ path: process.env.SD + '/press.png', clip: { x: 420, y: 230, width: 320, height: 200 } }); }
await season('summer', 20); await p.evaluate(() => { const s = O.SimRef.cur; while (s.minute < 21 * 60) s.tick(2); O.game.clock.minute = s.minute; });
await p.evaluate(() => { const c = O.SeasonChores.candidates()[0]; if (c) { const b = O.SimRef.cur.building(c[2]); O.game.player.x = b.doorX * 16 + 40; O.game.player.y = b.doorY * 16 + 60; } });
await p.evaluate(() => O.SeasonChores.soon());
let ser = null; for (let i = 0; i < 16 && !ser; i++) { await p.waitForTimeout(5000); ser = await p.evaluate(() => { const S = O.SeasonChores.serenades.find((x) => x.on); return S ? S.q.first + ' under ' + S.her.first + "'s window" : null; }); }
console.log('serenade:', ser || 'none tonight', await p.evaluate(() => 'started ' + O.SeasonChores.started + ' raining ' + O.SimRef.cur.raining + ' h ' + (O.SimRef.cur.minute / 60).toFixed(1)));
await p.waitForTimeout(30000);
console.log('ended:', await p.evaluate(() => O.SeasonChores.serenades.map((S) => S.who || '-').join(',')), 'held', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._chore).length));
await done();
