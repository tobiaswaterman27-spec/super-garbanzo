// The dogs come barking after whatever passes: here, the goose girl's flock.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const d = (O.fauna || []).find((f) => f.kind === 'dog' && f.world === s.world.placeId && !f.mine); if (d) { O.game.player.x = d.x; O.game.player.y = d.y + 20; } window.__dog = d; O.GooseGirl.soon(); });
await p.waitForTimeout(2000);
await p.evaluate(() => { const G = O.GooseGirl.flock, d = window.__dog; if (G && d) { G.x = d.x - G.dir * 60; G.y = d.y; for (const g of G.geese) { g.x = G.x; g.y = G.y; } } });
await p.waitForTimeout(6000);
console.log('dogs chasing:', await p.evaluate(() => O.DogsReact.chasing.size), '| barks:', await p.evaluate(() => O.DogsReact.barks));
await done();
