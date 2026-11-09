// The public buildings' doorsteps: infirmary, school, post house, moneylender, scriptorium, gaol, chapel, town hall.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const kinds = new Set();
for (const [place, hr] of [[null, 8], [null, 11], ['aurelia', 10], ['aurelia', 14]]) {
  if (place) { await p.evaluate((pl) => O.teleport(pl), place); await p.waitForTimeout(3000); }
  await p.evaluate((hr) => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== hr && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; s.weather.forced = 'clear'; s.weather.kind = 'clear'; }, hr);
  const types = await p.evaluate(() => { const s = O.SimRef.cur; return [...s.biz.values()].filter((z) => O.OfficeFronts.kinds.includes(z.type)).map((z) => z.type); });
  for (const t of [...new Set(types)]) { await p.evaluate((t) => { const s = O.SimRef.cur, z = [...s.biz.values()].find((z) => z.type === t), b = s.building(z.b?.id ?? z.id); O.game.player.x = b.doorX * 16 + 30; O.game.player.y = b.doorY * 16 + 60; }, t); await p.waitForTimeout(9000); for (const k of await p.evaluate(() => O.OfficeFronts.live.map((l) => l.kind))) kinds.add(k); }
}
console.log('doorstep scenes seen:', [...kinds].join(' '), '| total begun:', await p.evaluate(() => O.OfficeFronts.count));
await done();
