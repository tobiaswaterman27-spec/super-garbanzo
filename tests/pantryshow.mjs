// A household's real pantry laid out in its cottage: loaves on the table, sacks on the floor, wood by the hearth.
import { start } from './lib.mjs';
const { p, done } = await start();
const r = await p.evaluate(() => { const s = O.SimRef.cur; const q = s.people.find((q) => q.home != null && s.household(q) && s.household(q).pantry && !s.biz.get(q.home)); const hh = s.household(q); hh.pantry = { bread: 3, cabbage: 2, fish: 2, meat: 1, flour: 2, ale: 1, firewood: 6 }; O.game.enterBuilding(s.building(q.home), 0); return q.first; });
await p.waitForTimeout(1500);
console.log('home of', r, 'shown', await p.evaluate(() => O.PantryShow.shown));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/pantry.png' });
const after = await p.evaluate(async () => { const s = O.SimRef.cur, sc = O.game.scene; const q = s.people.find((z) => z.home === sc.b.id); s.household(q).pantry = { bread: 1 }; await new Promise((r) => setTimeout(r, 600)); return O.PantryShow.shown; });
console.log('after eating', after, 'pot', await p.evaluate(() => O.PantryShow.pot));
const t = await p.evaluate(async () => { O.game.exitBuilding(); const s = O.SimRef.cur; const bz = [...s.biz.values()].find((z) => z.type === 'store' || z.type === 'smithy'); bz.cash = 200; O.game.enterBuilding(s.building(bz.id), 0); await new Promise((r) => setTimeout(r, 600)); return bz.type + ' till ' + O.PantryShow.till; });
console.log(t);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/till.png' });
// your own house: the chest's contents on the shelves; a break-in leaves a mess you can set right
const mine = await p.evaluate(async () => { O.game.exitBuilding(); const s = O.SimRef.cur; const b = s.world.buildings.find((b) => b.doorX != null && !s.biz.get(b.id)); b.owner = { kind: 'player' }; b.household = null; for (const q of s.people) if (q.home === b.id) q.home = null; O.PlayerState.homes = O.PlayerState.homes || {}; O.PlayerState.homes[s.world.placeId + ':' + b.id] = ['bread', 'bread', 'sword', 'ring', 'flour', 'firewood', 'firewood']; b._burgled = s.day; b._tidied = false; O.PlayerState.items.push('key'); O.game.enterBuilding(b, 0); await new Promise((r) => setTimeout(r, 700)); return 'shown ' + O.PantryShow.shown + ' messy ' + O.PantryShow.messy; });
console.log('your house:', mine);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/yourhouse.png' });
const td = await p.evaluate(async () => { const c = O.moreCandidates.map((f) => f()).find((c) => c && /rights/.test(c.label)); if (!c) return 'no prompt'; c.act(); await new Promise((r) => setTimeout(r, 3500)); return 'tidied ' + O.PantryShow.tidied + ' messy ' + O.PantryShow.messy; });
console.log(td);
await done();
