import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { O.game.clock.speed = 120; });
for (let k = 0; k < 6; k++) {
  await p.waitForTimeout(8000);
  console.log(await p.evaluate((k) => { const s = O.SimRef.cur; const bs = s.world.buildings.filter(b => b.doorX != null && !b.site); const b = bs[(k * 7) % bs.length]; try { O.game.enterBuilding(b, 0); } catch (e) { return 'enter fail ' + e.message; } return 'day ' + s.day + ' h ' + s.hour.toFixed(1) + ' in ' + b.type + ' pop ' + s.people.length + ' biz ' + s.biz.size; }, k));
  await p.waitForTimeout(2500);
  await p.evaluate(() => { if (O.game.scene && O.game.exitScene) O.game.exitScene(); else if (O.game.scene) O.game.scene = null; });
}
await p.evaluate(() => { const s = O.SimRef.cur, K = O.SimRef.home.kingdom; const pl = K.places.find(x => x.kind === 'capital'); O.teleport(pl.id); });
await p.waitForTimeout(6000);
console.log(await p.evaluate(() => 'capital ok, people ' + O.SimRef.cur.people.length));
await done();
