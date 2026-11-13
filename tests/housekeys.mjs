// Taking a house puts a key in your hand: the clerk walks you to the door, you turn it; lose it and you're locked out.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const b = s.world.buildings.find((b) => b.doorX != null && b.owner?.kind !== 'player' && !s.biz.get(b.id));
  const clerk = s.people.find((q) => q.agent && q.agent.inside == null && !q.agent.hidden && q.age >= 20 && !q.errand); clerk.agent.x = P.x + 20; clerk.agent.y = P.y; window._b = b.id; const k0 = O.PlayerState.items.filter((k) => k === 'key').length;
  b.owner = { kind: 'player' }; return k0 + ' clerk ' + clerk.first; });
console.log('before:', r);
await p.waitForTimeout(2500);
console.log('keys now', await p.evaluate(() => O.PlayerState.items.filter((k) => k === 'key').length), 'handed', await p.evaluate(() => O.HouseKeys.handed), 'walking', await p.evaluate(() => !!O.HouseKeys.hand));
for (let i = 0; i < 40 && !(await p.evaluate(() => O.HouseKeys.hand && O.HouseKeys.hand.at)); i++) await p.waitForTimeout(500);
const u = await p.evaluate(() => { const H = O.HouseKeys.hand; if (!H) return 'no hand'; const b = H.b, P = O.game.player; P.x = b.doorX * 16 + 8; P.y = (b.doorY + 1) * 16 + 4; const c = O.moreCandidates.map((f) => f()).find((c) => c && /new key/.test(c.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('unlock:', u, await p.evaluate(() => O.HouseKeys.unlocked));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/keys.png' });
await p.waitForTimeout(1500);
// lose every key: the door won't open; climb in; then a smith fits a new lock
const lo = await p.evaluate(() => { const PS = O.PlayerState; PS.items = PS.items.filter((k) => k !== 'key'); const s = O.SimRef.cur, b = s.building(window._b); O.game.enterBuilding(b, 0); const inside = !!O.game.scene; const P = O.game.player; P.x = b.doorX * 16 + 30; P.y = (b.doorY + 1) * 16; const c = O.moreCandidates.map((f) => f()).find((c) => c && /window/.test(c.label)); if (c) c.act(); return 'in by door: ' + inside + ', window prompt: ' + !!c; });
console.log(lo); await p.waitForTimeout(3200); console.log('inside after climb:', await p.evaluate(() => !!O.game.scene));
await p.evaluate(() => O.game.exitBuilding && O.game.exitBuilding()); await p.waitForTimeout(800);
const sm = await p.evaluate(async () => { const s = O.SimRef.cur; const q = s.people.find((q) => /smith/.test(q.job?.role || '')); if (!q) return 'no smith'; O.PlayerState.money = 10; let out = ''; await O.AIChat.say(q, 'I lost my key, can you make me a new one?', (l) => { out = l; }); return out + ' | keys ' + O.PlayerState.items.filter((k) => k === 'key').length; });
console.log('smith:', sm);
// selling hands the key back
await p.evaluate(() => { O.SimRef.cur.building(window._b).owner = { kind: 'parish' }; }); await p.waitForTimeout(1200);
console.log('after selling: keys', await p.evaluate(() => O.PlayerState.items.filter((k) => k === 'key').length), 'back', await p.evaluate(() => O.HouseKeys.back));
await done();
