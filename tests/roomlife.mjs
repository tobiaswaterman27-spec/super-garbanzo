// Rooms: mass (kneel, sermon, elevation, censer), meals at table, sleepers' Zs, prisoners in the cells.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.weekday === 6 && s.minute >= 9 * 60 + 20) && g++ < 8000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(1500);
await p.evaluate(() => { const s = O.SimRef.cur; O.game.enterBuilding(s.building(s.chapelId), 0); });
await p.waitForTimeout(3000);
const seen = new Set(); let anims = {};
for (let i = 0; i < 14; i++) { await p.waitForTimeout(5000); const r = await p.evaluate(() => { const sc = O.game.scene; const c = {}; for (const a of sc.actors.values()) if (a.person.activity?.act === 'worship') c[a.anim] = (c[a.anim] || 0) + 1; return { ph: sc._mass, priest: sc._priest ? sc._priest.anim : null, c }; }); seen.add(r.ph + '/' + r.priest); for (const k in r.c) anims[k] = (anims[k] || 0) + r.c[k]; if (i === 4 && process.env.SD) await p.screenshot({ path: process.env.SD + '/mass.png' }); }
console.log('mass phases:', [...seen].join(' '), '| pew anims', JSON.stringify(anims));
// supper at home
await p.evaluate(() => { const s = O.SimRef.cur; O.game.exitBuilding ? O.game.exitBuilding() : (O.game.scene = null); let g = 0; while (Math.floor(s.minute / 60) !== 18 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
const homes = await p.evaluate(() => { const s = O.SimRef.cur; return s.world.buildings.filter((b) => b.type === 'house' && s.people.filter((q) => q.agent && q.agent.inside === b.id && ['eat', 'home'].includes(q.activity?.act)).length >= 2).map((b) => b.id).slice(0, 8); });
let table = '';
for (const id of homes) { await p.evaluate((id) => { const s = O.SimRef.cur; if (O.game.scene) O.game.exitBuilding(); O.game.enterBuilding(s.building(id), 0); }, id); await p.waitForTimeout(2500); table = await p.evaluate(() => (O.game.scene._eaters || []).map((a) => a.anim).join(',')); if (table) break; }
console.log('supper table:', table || 'nobody seated in ' + homes.length + ' houses');
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/supper.png' });
await done();
