// Sixty days of the town at full pace: how long each day takes to simulate, what goes wrong along the
// way (console errors from the catch blocks too), then a save, a reload, and a check it came back.
import { start } from './lib.mjs';
const { p, done } = await start();
const cerr = []; p.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text().slice(0, 200)); });
const DAYS = +(process.env.DAYS || 60);
const t0 = Date.now();
for (let d = 0; d < DAYS; d += 5) {
  const r = await p.evaluate((n) => { const s = O.SimRef.cur, PS = O.PlayerState, out = []; for (let k = 0; k < n; k++) { const day0 = s.day, a = performance.now(); let g = 0; while (s.day === day0 && g++ < 2000) { s.tick(2); PS.tick(2, false); } out.push(Math.round(performance.now() - a)); } const alive = s.people.filter((q) => q.alive !== false).length; return { day: s.day, ms: out, alive, biz: s.biz.size, hh: s.households.filter((h) => !h.gone).length, money: Math.round(s.households.reduce((a, h) => a + Math.max(0, h.money), 0)), shopcash: Math.round([...s.biz.values()].reduce((a, z) => a + Math.max(0, z.cash || 0), 0)), treas: Math.round(s.treasury.cash), bread: s.price && s.supplierOf && s.supplierOf('bakery') ? s.price(s.supplierOf('bakery'), 'bread') : 0, hungry: s.people.filter((q) => q.needs && q.needs.hunger < 25).length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0 }; }, 5);
  console.log(`day ${r.day}: ${r.ms.join('/')} ms per day, people ${r.alive}, households ${r.hh}, shops ${r.biz}, purses ₳${r.money}, shops ₳${r.shopcash}, treasury ₳${r.treas}, bread ₳${r.bread}, hungry ${r.hungry}, heap ${r.heap}MB`);
}
console.log(`sim total ${Math.round((Date.now() - t0) / 1000)} s for ${DAYS} days`);
// frame cost now, with the town as it has become
console.log(await p.evaluate(async () => { const g = O.game, n = 120, a = performance.now(); for (let i = 0; i < n; i++) { g.update(1 / 60); g.draw && g.draw(); } return 'frame ' + ((performance.now() - a) / n).toFixed(2) + ' ms (update+draw)'; }));
// save, reload, compare
const before = await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState; PS.money = 321; const b = s.world.buildings.find((x) => x.type === 'house' && x.doorX != null); b.owner = { kind: 'player' }; b.decor = { wall: 'tapestry' }; b.yard = [{ kind: 'bench', tx: b.doorX + 2, ty: b.doorY + 1, v: 0, seed: 3 }]; PS.life = Object.assign({}, PS.life, { alias: 'Wat' }); O.Save.save(O.game, O.SimRef.home, true); return { day: s.day, people: s.people.length, money: PS.money, b: b.id }; });
await p.reload(); await p.waitForTimeout(2500);
const btn = await p.$('#beginLife'); if (btn && await btn.isVisible()) { await btn.click(); await p.waitForTimeout(1200); }
await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
await p.waitForTimeout(2000);
console.log(await p.evaluate((B) => { const s = O.SimRef.cur, PS = O.PlayerState, b = s.building(B.b); const yardProps = s.world.props.filter((x) => x.yard === B.b).length; return `reloaded: day ${s.day} (was ${B.day}), people ${s.people.length} (was ${B.people}), money ${PS.money} (was ${B.money}), decor ${JSON.stringify(b && b.decor)}, yard props ${yardProps}, alias ${PS.life && PS.life.alias}`; }, before));
console.log('console errors: ' + (cerr.length ? cerr.length + ' e.g. ' + [...new Set(cerr)].slice(0, 4).join(' || ') : 'none'));
await done();
