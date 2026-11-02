import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { O.game.clock.speed = 60; });
await p.waitForTimeout(+(process.argv[2] || 20000));
console.log(await p.evaluate(() => { const s = O.SimRef.cur; return 'day ' + s.day + ' hour ' + s.hour.toFixed(1) + ' people ' + s.people.length; }));
await p.evaluate(() => { const s = O.SimRef.cur; const b = s.world.buildings.find(b => b.id === s.tavernId); O.game.enterBuilding(b, 0); }); await p.waitForTimeout(2500);
await done();
