import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 10 * 60; O.game.clock.minute = 10 * 60; });
await p.waitForTimeout(600);
// every piece in other people's houses is sold somewhere; decor is sold and can be made
console.log(await p.evaluate(() => {
  const D = O.Data, sold = new Set(); for (const d of Object.values(D.BUSINESS)) for (const g of d.sells || []) sold.add(g);
  const miss = Object.keys(D.FURN).filter((k) => !sold.has('fx_' + k));
  const decor = Object.keys(D.GOODS).filter((k) => /^(wl|fl|tn|er|rf|dp|yd)_/.test(k));
  const unsold = decor.filter((k) => !sold.has(k));
  const made = O.Recipes.all().filter((r) => Object.keys(r[2]).some((g) => /^(wl|fl|tn|rf|dp|yd|fx)_/.test(g))).length;
  return 'furniture not on sale: ' + (miss.join(',') || 'none') + ' | decor goods ' + decor.length + ', unsold ' + (unsold.join(',') || 'none') + ' | recipes ' + made;
}));
// own a house and go in
const ok = await p.evaluate(() => {
  const s = O.SimRef.cur, g = O.game, PS = O.PlayerState;
  const b = s.world.buildings.find((x) => x.type === 'house' && x.doorX != null && !x.parent && x.w >= 4);
  if (!b) return 'no house';
  b.owner = { kind: 'player' }; b.household = 0; window._b = b;
  PS.money = 500; PS.items.length = 0; for (const k of ['fx_chair', 'fx_rug', 'wl_tapestry', 'fl_tiles', 'tn_ochre']) PS.add(k);
  g.enterBuilding(b, 0); return 'in ' + b.name + ' ' + b.w + 'x' + b.d;
});
console.log(ok);
await p.waitForTimeout(500);
const k = async (c, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.press(c); await p.waitForTimeout(250); } };
await k('KeyV');
console.log(await p.evaluate(() => 'decorating ' + O.Decorate.on + ' palette ' + O.Decorate.palette().length));
// bring out the chair and set it down in the middle of the room facing down
await p.evaluate(() => { const sc = O.game.scene, pl = O.game.player; pl.x = sc.R.SW + Math.floor(sc.L.w / 2) * 16 + 8; pl.y = sc.R.WH + (sc.L.d - 3) * 16 + 10; pl.dir = 0; });
let msg = '';
for (let i = 0; i < 6; i++) { await k('Tab'); const h = await p.evaluate(() => O.Decorate.state.held && (O.Decorate.state.held.good || O.Decorate.state.held.kind)); if (h === 'fx_chair') break; }
await k('KeyR'); await k('KeyT');
for (const d of [0, 3, 1, 2]) { await p.evaluate((d) => { O.game.player.dir = d; }, d); await k('KeyE'); msg = await p.evaluate(() => (O.Decorate.state.held ? 'still held' : 'placed')); if (msg === 'placed') break; }
console.log(await p.evaluate(() => 'chair: ' + JSON.stringify((_b.extraFurn || []).map((f) => f.kind + '@' + f.tx + ',' + f.ty + ' r' + f.rot + ' v' + f.v)) + ' satchel chair ' + O.PlayerState.items.includes('fx_chair')));
// lift it again and put it away into the store, then out again
await k('KeyE');
console.log(await p.evaluate(() => 'lifted ' + JSON.stringify(O.Decorate.state.held)));
await k('Delete');
console.log(await p.evaluate(() => 'store ' + (_b.store || []).length));
// wall and floor
for (const want of ['wl_tapestry', 'fl_tiles', 'tn_ochre']) {
  for (let i = 0; i < 8; i++) { await k('Tab'); const h = await p.evaluate(() => O.Decorate.state.held && O.Decorate.state.held.good); if (h === want) break; }
  await k('KeyE'); await p.waitForTimeout(1000);
}
console.log(await p.evaluate(() => 'decor ' + JSON.stringify(_b.decor)));
// pick up something that came with the house
console.log(await p.evaluate(() => { const sc = O.game.scene, it = sc.L.items.find((i) => !i.owned && O.Data.FURN[i.kind] && !['stairs', 'roomdoor', 'fireplace'].includes(i.kind) && i.ty + i.fh < sc.L.d - 1); if (!it) return 'nothing came with it'; const pl = O.game.player; pl.x = sc.R.SW + it.tx * 16 + 8; pl.y = sc.R.WH + (it.ty + it.fh) * 16 + 12; pl.dir = 3; window._it = it.kind; return 'going to ' + it.kind; }));
await k('KeyE');
console.log(await p.evaluate(() => 'lifted ' + JSON.stringify(O.Decorate.state.held) + ' removed ' + JSON.stringify(_b.removedFurn)));
await k('KeyV');
// outside: lay out the yard and redo the house
await p.evaluate(() => { const g = O.game, b = _b; g.scene = null; g.player.inside = null; g.player.x = b.doorX * 16 + 8; g.player.y = (b.doorY + 2) * 16 + 10; g.player.dir = 0; O.PlayerState.items.length = 0; for (const k of ['yd_bench', 'yd_flowers', 'rf_slate', 'dp_blue', 'er_plasterOchre']) O.PlayerState.add(k); });
await p.waitForTimeout(300);
await k('KeyV');
console.log(await p.evaluate(() => 'outdoors decorating ' + O.Decorate.on + ' palette ' + O.Decorate.palette().map((e) => e.good).join(',')));
for (const want of ['yd_bench', 'yd_flowers']) {
  for (let i = 0; i < 8; i++) { await k('Tab'); const h = await p.evaluate(() => O.Decorate.state.held && O.Decorate.state.held.good); if (h === want) break; }
  for (const [dx, d] of [[1, 2], [-1, 1], [2, 2], [-2, 1], [0, 3]]) { await p.evaluate(([dx, d]) => { const b = _b, pl = O.game.player; pl.x = (b.doorX + dx * 2) * 16 + 8; pl.y = (b.doorY + 2) * 16 + 10; pl.dir = d; }, [dx, d]); await k('KeyE'); if (await p.evaluate(() => !O.Decorate.state.held)) break; }
}
console.log(await p.evaluate(() => 'yard ' + JSON.stringify(_b.yard) + ' props ' + O.SimRef.cur.world.props.filter((q) => q.yard === _b.id).length));
for (const want of ['rf_slate', 'dp_blue', 'er_plasterOchre']) {
  for (let i = 0; i < 8; i++) { await k('Tab'); const h = await p.evaluate(() => O.Decorate.state.held && O.Decorate.state.held.good); if (h === want) break; }
  await k('KeyE');
}
console.log(await p.evaluate(() => 'house ' + JSON.stringify({ roof: _b.spec.roof, door: _b.spec.doorCol, plaster: _b.spec.plaster, wall: _b.spec.wall })));
await k('KeyV');
await p.screenshot({ path: process.env.SHOT || '/tmp/decor.png' });
await done();
