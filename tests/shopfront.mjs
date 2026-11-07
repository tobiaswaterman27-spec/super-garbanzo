import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(500);
const types = await p.evaluate(() => [...new Set([...O.SimRef.cur.biz.values()].map((z) => z.type))].filter((t) => O.ShopFront.WORK[t]));
for (const t of types) {
  const r = await p.evaluate((t) => { for (const f of O.ShopFront.fronts.slice()) f.t = 1e9; const f = O.ShopFront.start(t); if (!f) return 'NO'; O.game.player.x = f.at[0]; O.game.player.y = f.at[1] + 50; return `${f.q.first} out at ${f.bz.name}`; }, t);
  await p.waitForTimeout(3000);
  const st = await p.evaluate((t) => { const f = O.ShopFront.fronts.find((x) => x.bz.type === t); return f ? `anim ${f.q.agent.forceAnim} parts ${O.ShopFront.parts.length}` : 'ended'; }, t);
  if (D) await p.screenshot({ path: `${D}/front-${t}.png`, clip: { x: 500, y: 300, width: 200, height: 140 } });
  console.log(t.padEnd(11), r, '|', st);
}
await p.evaluate(() => { for (const f of O.ShopFront.fronts) f.t = 1e9; });
await p.waitForTimeout(25000);
console.log('natural:', await p.evaluate(() => O.ShopFront.fronts.map((f) => f.bz.type).join(',')), '| workers left out:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._front && !O.ShopFront.fronts.some((f) => f.q === q)).length));
await done();
