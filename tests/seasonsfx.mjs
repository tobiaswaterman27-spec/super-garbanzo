import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; });
for (const season of ['winter', 'autumn', 'spring', 'summer']) {
  await p.evaluate((season) => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: season, configurable: true, writable: true }); s.raining = false; }, season);
  await p.waitForTimeout(6000);
  console.log(season.padEnd(7), await p.evaluate(() => { const F = O.SeasonsFx; return `breath ${F.puffs.length} drift ${F.drift.length} heaps ${F.heaps.length} butterflies ${F.flies.length}`; }));
  if (D) await p.screenshot({ path: `${D}/season-${season}.png`, clip: { x: 350, y: 200, width: 500, height: 320 } });
}
await done();
