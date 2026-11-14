// Water for the trades: butts by the door run down, the apprentice or water carrier fetches; you carry a bucket for a coin.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.weekday !== 6 && s.minute / 60 >= 10) && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; });
const t = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const L = O.TradeWater.thirsty(s).filter((bz) => bz.open && O.TradeWater.spot(s, bz)); if (!L.length) return 'none'; const bz = L[0]; window._bz = bz; bz.water = 1; P.x = bz._butt.x + 50; P.y = bz._butt.y + 40; return L.map((z) => z.type).join(',') + ' -> ' + bz.name; });
console.log('thirsty:', t);
for (let i = 0; i < 70 && (await p.evaluate(() => O.TradeWater.fetched < 1)); i++) await p.waitForTimeout(1000);
console.log('fetched:', await p.evaluate(() => O.TradeWater.fetched + ' water ' + window._bz.water.toFixed(1) + ' carrier ' + O.TradeWater.carrier));
await p.screenshot({ path: (process.env.SD || '.') + '/tradewater.png' });
// you, with a bucket from the well
const me = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; if (O.npcUI.talking()) O.npcUI.closeTalk(); P.locked = false; O.PlayerState.carry = null; const w = O.Water.wellsOf(s)[0]; w._iceDay = s.day; P.x = w.x; P.y = w.y + 14; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Draw a bucket/.test(x.label)); if (!c) return 'no draw'; c.act(); return c.label; });
console.log('draw:', me); await p.waitForTimeout(3000);
console.log('tip:', await p.evaluate(() => { const bz = window._bz, P = O.game.player; bz.water = 1; bz.cash = Math.max(bz.cash || 0, 10); const m0 = O.PlayerState.money; P.x = bz._butt.x; P.y = bz._butt.y + 12; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Tip your water into/.test(x.label)); if (!c) return 'no tip prompt ' + JSON.stringify(O.PlayerState.carry); c.act(); return c.label + ' | +' + (O.PlayerState.money - m0) + ' water ' + bz.water; }));
await done();
