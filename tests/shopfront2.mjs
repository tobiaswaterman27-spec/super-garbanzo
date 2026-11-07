import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
const ids = await p.evaluate(() => { const K = O.SimRef.home.kingdom; return ['city', 'mine', 'port'].map((k) => K.places.find((x) => x.kind === k && !x.detailed)).filter(Boolean).map((x) => x.id); });
const done2 = new Set();
for (const id of ids) {
  await p.evaluate((id) => O.teleport(id), id); await p.waitForTimeout(3000);
  await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
  const types = await p.evaluate(() => [...new Set([...O.SimRef.cur.biz.values()].map((z) => z.type))].filter((t) => O.ShopFront.WORK[t]));
  for (const t of types) { if (done2.has(t) || ['tavern', 'bakery', 'smithy', 'doctor', 'store', 'mill', 'woodcutter', 'stable', 'builder', 'tailor', 'chandler', 'butcher', 'carpenter', 'posthouse', 'brewery', 'carrier', 'apiary', 'charcoal', 'boatyard', 'fishery'].includes(t)) continue; done2.add(t);
    const r = await p.evaluate((t) => { for (const f of O.ShopFront.fronts.slice()) f.t = 1e9; const f = O.ShopFront.start(t); if (!f) return 'NO'; O.game.player.x = f.at[0]; O.game.player.y = f.at[1] + 40; return f.q.first; }, t);
    await p.waitForTimeout(2500);
    const st = await p.evaluate((t) => { const f = O.ShopFront.fronts.find((x) => x.bz.type === t); return f ? `${f.q.agent.forceAnim}` : 'ended'; }, t);
    if (D && r !== 'NO') await p.screenshot({ path: `${D}/f2-${t}.png`, clip: { x: 520, y: 300, width: 160, height: 110 } });
    console.log(t.padEnd(11), r, '|', st);
  }
}
await done();
