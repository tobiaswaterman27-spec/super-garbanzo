// Error sweep abroad: teleport to one place of each kind (capital, city, port, town, castle, mine, village,
// hamlet) and walk it through a few hours, collecting any console errors.
import { start } from './lib.mjs';
const { p, done } = await start();
const errs = new Map(); p.on('console', (m) => { if (m.type() === 'error') { const k = m.text().slice(0, 160); errs.set(k, (errs.get(k) || 0) + 1); } });
const places = await p.evaluate(() => { const K = O.SimRef.home.kingdom, seen = new Set(), out = []; for (const pl of K.places) { if (seen.has(pl.kind)) continue; seen.add(pl.kind); out.push([pl.id, pl.kind, pl.name]); } return out; });
const visited = [];
for (const [id, kind, name] of places) {
  await p.evaluate((id) => O.teleport(id), id); await p.waitForTimeout(2500);
  const ok = await p.evaluate(() => { const s = O.SimRef.cur; return s && s.world ? s.world.name : null; }); visited.push(kind + ':' + ok);
  for (const h of [9, 13, 18, 22]) { await p.evaluate((h) => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 !== h && Math.floor(s.minute / 60) !== h && g++ < 3000) s.tick(1); O.game.clock.minute = s.minute; const bs = s.world.buildings.filter((b) => b.doorX != null); const b = bs[Math.floor(Math.random() * bs.length)]; if (b) { O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 3) * 16; } }, h); await p.waitForTimeout(2500); }
}
console.log('visited:', visited.join(', '));
console.log('distinct console errors:', errs.size); for (const [k, n] of errs) console.log(n + 'x', k.replace(/file:\/\/[^ ]*html/g, 'H'));
await done();
