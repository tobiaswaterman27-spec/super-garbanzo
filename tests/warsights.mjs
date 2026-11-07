import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
const r = await p.evaluate(() => { const s = O.SimRef.cur, K = s.kingdom; K.warInit(); s.sergeantArrives(); const sg = s.sergeant; const [x0, y0, x1, y1] = s.Z.square; sg.agent.x = (x0 + x1) / 2 * 16; sg.agent.y = (y0 + y1) / 2 * 16; O.game.player.x = sg.agent.x; O.game.player.y = sg.agent.y + 60; return sg.name; });
await p.waitForTimeout(4000);
console.log('sergeant', r, 'on box', await p.evaluate(() => !!O.SimRef.cur.sergeant._box), 'act', await p.evaluate(() => O.SimRef.cur.sergeant.activity?.act + '/' + O.SimRef.cur.sergeant.task?.act));
const lv = await p.evaluate(() => { const t = O.SimRef.cur.levyMen(3); return t.map((q) => q.first).join(',') + ' | kin ' + (O.WarSights.farewell ? O.WarSights.farewell.kin.length : 'none'); });
console.log('levy', lv);
await p.waitForTimeout(8000); if (D) await p.screenshot({ path: `${D}/war-goodbye.png` });
console.log('stage', await p.evaluate(() => O.WarSights.farewell?.stage), (await p.evaluate(() => _said.slice(-4).join(' / '))).slice(0, 200));
await p.waitForTimeout(12000); if (D) await p.screenshot({ path: `${D}/war-march.png` });
console.log('stage', await p.evaluate(() => O.WarSights.farewell?.stage + ' t=' + O.WarSights.farewell?.t));
for (let i = 0; i < 60 && await p.evaluate(() => !!O.WarSights.farewell); i++) { await p.waitForTimeout(2000); if (i % 5 === 0) console.log('  ', await p.evaluate(() => { const f = O.WarSights.farewell; return f ? f.stage + ' t=' + f.t.toFixed(1) + ' ' + f.men.map((q) => q.first).join(',') + ' hour ' + (O.SimRef.cur.minute / 60).toFixed(1) : 'none'; })); }
console.log('after', await p.evaluate(() => (O.WarSights.farewell?.stage || 'done') + ' | war-held ' + O.SimRef.cur.people.filter((q) => q._war).length + ' | levied still in town ' + O.SimRef.cur.people.filter((q) => q.task?.toWar).length));
// a death and a homecoming
const hc = await p.evaluate(() => { const s = O.SimRef.cur; for (const q of s.people.filter((q) => q.task?.toWar)) { const i = s.people.indexOf(q); s.people.splice(i, 1); s.byId.delete(q.id); q.alive = false; } /* (as if they'd gone) */ s.onBattle({ crownWins: false, at: 'frostmere' }); const sd = s.kingdom.war.soldiers.find((x) => !x.dead); const mourn = s.households.filter((h) => h._mourn != null).length; s.soldiersReturn(); return `mourning ${mourn}, homecomings ${O.WarSights.homecomings.length}`; });
console.log(hc);
await done();
