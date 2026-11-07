import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
const ids = await p.evaluate(() => { const K = O.SimRef.home.kingdom; return ['village', 'town', 'hamlet', 'castle'].map((k) => K.places.find((x) => x.kind === k && !x.detailed)).filter(Boolean).map((x) => [x.kind, x.id]); });
for (const [k, id] of ids) {
  await p.evaluate((id) => O.teleport(id), id); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => { const id = O.SimRef.cur.world.placeId; const f = O.fauna.filter((x) => x.world === id); const c = {}; for (const x of f) c[x.kind] = (c[x.kind] || 0) + 1; const near = f.find((x) => x.kind === 'sheep' || x.kind === 'cow' || x.kind === 'chicken'); if (near) { O.game.player.x = near.x + 20; O.game.player.y = near.y + 20; } return JSON.stringify(c); });
  await p.waitForTimeout(1500);
  if (D) await p.screenshot({ path: `${D}/pasture-${k}.png`, clip: { x: 400, y: 250, width: 400, height: 260 } });
  console.log(k.padEnd(8), r);
}
await done();
