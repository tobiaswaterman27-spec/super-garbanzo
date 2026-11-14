// Chalk slates by shop doors: real prices, rewritten by the keeper when they move; read them; chalk your own.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.weekday !== 6 && s.minute / 60 >= 10) && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; });
const pick = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const list = [...s.biz.values()].filter((bz) => (bz.def.sells || []).length && bz.b && bz.b.doorX != null && O.PriceChalk.spot(s, bz) && O.PriceChalk.keeperOf(s, bz));
  const bz = list[0]; if (!bz) return 'none of ' + s.biz.size; window._bz = bz; P.x = bz._slate.x + 40; P.y = bz._slate.y + 30; return bz.name + ' ' + list.length; });
console.log('shop:', pick);
await p.waitForTimeout(2500);
console.log('chalked:', await p.evaluate(() => JSON.stringify(window._bz._chalk)));
// the price moves: stock runs out
await p.evaluate(() => { const bz = window._bz; for (const g of bz.def.sells) bz.stock[g] = 0; });
let ok = false; for (let i = 0; i < 45 && !ok; i++) { await p.waitForTimeout(1000); ok = await p.evaluate(() => O.PriceChalk.rubbed > 0); }
console.log('rubbed:', await p.evaluate(() => [O.PriceChalk.rubbed, O.PriceChalk.stale, JSON.stringify(window._bz._chalk), window._bz.def.sells.map((g) => O.SimRef.cur.price(window._bz, g)).join(',')].join(' | ')));
// read it
console.log('read:', await p.evaluate(() => { const P = O.game.player, sp = window._bz._slate; P.x = sp.x; P.y = sp.y + 14; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Read the slate/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; }));
// yours
const mine = await p.evaluate(() => { const bz = window._bz; bz.b.owner = { kind: 'player' }; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Chalk your prices down/.test(x.label)); if (!c) return 'no prompt'; const before = bz.markup || 1; c.act(); return c.label + ' from ' + before; });
console.log('mine:', mine); await p.waitForTimeout(2600);
console.log('after:', await p.evaluate(() => [O.PriceChalk.youChalked, window._bz.markup.toFixed(2), JSON.stringify(window._bz._chalk), O.PriceChalk.read].join(' | ')));
await p.screenshot({ path: (process.env.SD || '.') + '/pricechalk.png' });
await done();
