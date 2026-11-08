import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; });
let kinds = new Set();
for (const [dx, dy] of [[1400, 200], [-1500, 400], [600, -900]]) { await p.evaluate(({ dx, dy }) => { O.game.player.x += dx; O.game.player.y += dy; }, { dx, dy }); await p.waitForTimeout(3000); for (const k of await p.evaluate(() => O.WildFolk.scenes().map((x) => x.kind))) kinds.add(k); }
console.log('wild scenes seen:', [...kinds].join(','));
await done();
