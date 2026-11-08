import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; Object.defineProperty(s, 'season', { value: 'spring', configurable: true }); const ewe = (O.fauna || []).find((f) => f.kind === 'sheep' && f.world === s.world.placeId); if (ewe) { O.game.player.x = ewe.x + 40; O.game.player.y = ewe.y + 30; } });
await p.waitForTimeout(4000);
console.log('lambs:', await p.evaluate(() => O.Lambs.lambs.size));
if (D) await p.screenshot({ path: `${D}/lambs.png`, clip: { x: 480, y: 300, width: 200, height: 120 } });
await done();
