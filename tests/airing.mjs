// Airing the bedding: quilts over the windowsills on fine mornings, a beating now and then in a puff of dust.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'spring', configurable: true }); let g = 0; while (s.minute / 60 < 9.5 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; if (s.weather) { s.weather.raining = false; s.weather.kind = 'clear'; } const b = s.world.buildings.find((x) => x.type === 'house' && x.sprite && (x.sprite.windows || []).length && ((x.id * 7 + s.day * 3) % 10) < 3); if (b) { O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 4) * 16; } });
await p.waitForTimeout(6000);
console.log('airing out:', await p.evaluate(() => O.Airing.out()), '| houses hung:', await p.evaluate(() => O.Airing.count()));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/airing.png', clip: { x: 300, y: 120, width: 600, height: 380 } });
await done();
