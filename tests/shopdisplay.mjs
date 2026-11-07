import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; const z = [...s.biz.values()].find((z) => z.type === 'bakery'); const b = s.building(z.b?.id ?? z.id); O.game.player.x = b.doorX * 16; O.game.player.y = (b.doorY + 4) * 16; });
await p.waitForTimeout(1500); if (D) await p.screenshot({ path: `${D}/display-open.png`, clip: { x: 420, y: 230, width: 360, height: 200 } });
console.log('displays placed', await p.evaluate(() => [...O.ShopDisplay.spots.values()].filter(Boolean).length));
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 20) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(1500); if (D) await p.screenshot({ path: `${D}/display-shut.png`, clip: { x: 420, y: 230, width: 360, height: 200 } });
await done();
