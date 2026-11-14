// To-let boards by empty houses; fetch the clerk, look round, take it; townsfolk viewings.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.weekday !== 6 && s.minute / 60 >= 10) && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; O.PlayerState.money = 2000; });
const b = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const L = O.Parish.houses(s).filter((b) => O.ToLet.place(s, b)); if (!L.length) { const h = s.world.buildings.find((b) => b.type === 'house' && b.doorX != null && !b.household && O.ToLet.place(s, b)) || s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && O.ToLet.place(s, b))[3]; h.parishLet = true; h.household = null; L.push(h); } const h = L[0]; window._h = h; P.x = h._board.x; P.y = h._board.y + 14; return L.length + ' houses; clerk ' + (s.people.find((q) => q.job?.role === 'parish clerk') || {}).first; });
console.log('houses:', b); await p.waitForTimeout(800);
console.log('board:', await p.evaluate(() => { const c = O.moreCandidates.map((f) => f()).filter((x) => x && /board|parish clerk/.test(x.label)); return O.ToLet.boards + ' | ' + c.map((x) => x.label).join(' / '); }));
console.log('fetch:', await p.evaluate(() => { const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Send for the parish clerk/.test(x.label)); if (!c) return 'no prompt'; c.act(); return O.ToLet.view ? O.ToLet.view.stage : 'no view'; }));
for (let i = 0; i < 120 && !(await p.evaluate(() => O.ToLet.view && O.ToLet.view.stage === 'open')); i++) await p.waitForTimeout(1000);
console.log('clerk at door:', await p.evaluate(() => O.ToLet.view && O.ToLet.view.stage));
await p.screenshot({ path: (process.env.SD || '.') + '/tolet.png' });
console.log('look:', await p.evaluate(() => { const h = window._h, P = O.game.player; P.x = h.doorX * 16 + 8; P.y = (h.doorY + 1) * 16 + 6; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Look round/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label + ' inside:' + !!O.game.scene; }));
await p.waitForTimeout(1500);
console.log('take:', await p.evaluate(() => { const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Take it on a lease/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label + ' lease:' + JSON.stringify(O.PlayerState.lease); }));
await p.waitForTimeout(3000);
console.log('taken/keys:', await p.evaluate(() => [O.ToLet.taken, O.PlayerState.items.filter((k) => k === 'key').length, O.HouseKeys.handed].join('/')));
// townsfolk viewing
await p.evaluate(() => { if (O.game.scene) O.game.exitBuilding ? O.game.exitBuilding() : null; });
await p.waitForTimeout(1000);
const nv = await p.evaluate(() => { const s = O.SimRef.cur; const h = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && b !== window._h && O.ToLet.place(s, b))[6]; h.parishLet = true; h.household = null; const P = O.game.player; if (O.game.scene) return 'still inside'; P.x = h.doorX * 16 + 60; P.y = (h.doorY + 3) * 16; O.ToLet.soon(); return h.id; });
console.log('npc house:', nv);
for (let i = 0; i < 30 && !(await p.evaluate(() => O.ToLet.npcViews > 0)); i++) await p.waitForTimeout(1000);
console.log('npcViews:', await p.evaluate(() => O.ToLet.npcViews + ' ' + (O.ToLet.npcView ? O.ToLet.npcView.a.first : '')));
await done();
