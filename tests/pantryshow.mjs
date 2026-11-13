// A household's real pantry laid out in its cottage: loaves on the table, sacks on the floor, wood by the hearth.
import { start } from './lib.mjs';
const { p, done } = await start();
const r = await p.evaluate(() => { const s = O.SimRef.cur; const q = s.people.find((q) => q.home != null && s.household(q) && s.household(q).pantry && !s.biz.get(q.home)); const hh = s.household(q); hh.pantry = { bread: 3, cabbage: 2, fish: 2, meat: 1, flour: 2, ale: 1, firewood: 6 }; O.game.enterBuilding(s.building(q.home), 0); return q.first; });
await p.waitForTimeout(1500);
console.log('home of', r, 'shown', await p.evaluate(() => O.PantryShow.shown));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/pantry.png' });
const after = await p.evaluate(async () => { const s = O.SimRef.cur, sc = O.game.scene; const q = s.people.find((z) => z.home === sc.b.id); s.household(q).pantry = { bread: 1 }; await new Promise((r) => setTimeout(r, 600)); return O.PantryShow.shown; });
console.log('after eating', after);
await done();
