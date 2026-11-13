// Coins pass hand to hand whenever your purse changes while you're dealing with someone.
import { start } from './lib.mjs';
const { p, done } = await start();
await p.waitForTimeout(1200);
await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const q = s.people.find((q) => q.agent && q.agent.inside == null && !q.agent.hidden && q.age >= 16); q.agent.x = P.x + 20; q.agent.y = P.y; q.agent.path = null; q.agent.frozen = true; window._q = q.id; });
await p.waitForTimeout(300);
await p.evaluate(() => { O.PlayerState.money -= 5; }); await p.waitForTimeout(400);
const a = await p.evaluate(() => O.CoinFlow.passes);
await p.waitForTimeout(2000);
await p.evaluate(() => { O.PlayerState.money += 3; }); await p.waitForTimeout(400);
await p.waitForTimeout(2000); await p.evaluate(() => { O.PlayerState.money -= 2; O.PlayerState.items.push('bread'); }); await p.waitForTimeout(2200);
console.log('goods', await p.evaluate(() => O.CoinFlow.goods));
console.log('passes', a, await p.evaluate(() => O.CoinFlow.passes));
// nobody near: nothing flies
await p.evaluate(() => { const s = O.SimRef.cur; s.byId.get(window._q).agent.x += 400; }); await p.waitForTimeout(2000);
await p.evaluate(() => { O.PlayerState.money -= 2; }); await p.waitForTimeout(400);
console.log('alone', await p.evaluate(() => O.CoinFlow.passes));
await p.evaluate(() => { O.SimRef.cur.byId.get(window._q).agent.frozen = false; });
await done();
