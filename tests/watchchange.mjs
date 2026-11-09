// The changing of the watch at six: two lines outside the watch house, the news passed, keys and lantern over.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
console.log('house:', await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 17.75 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const bz = [...s.biz.values()].find((b) => b.type === 'guard'); if (!bz) return null; const b = s.building(bz.b?.id ?? bz.id); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 7) * 16; return (bz.workers || []).map((id) => s.byId.get(id)).map((q) => (q.job?.role || '?') + ':' + (q.shift || 'day')).join(' '); }));
const seen = new Set();
for (let i = 0; i < 120; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const C = O.WatchChange.change; return C ? C.phase + ' ' + C.off.length + '/' + C.on.length : (O.WatchChange.changes ? 'done' : 'wait ' + (O.SimRef.cur.minute / 60).toFixed(2)); }); if (!seen.has(r) && !r.startsWith('wait')) console.log(i, r, await p.evaluate(() => { const C = O.WatchChange.change; return C ? [...C.off, ...C.on].map((q) => Math.round((q.agent.x - C.x) / 16) + ',' + Math.round((q.agent.y - C.y) / 16) + (q.agent.frozen ? 'F' : '')).join(' ') : ''; })); seen.add(r); if (r.startsWith('stand') && process.env.SD && !seen.has('s')) { seen.add('s'); await p.waitForTimeout(6800); await p.screenshot({ path: process.env.SD + '/watch.png', clip: { x: 360, y: 200, width: 480, height: 300 } }); } if (r === 'done') break; }
console.log('changes:', await p.evaluate(() => O.WatchChange.changes));
await p.waitForTimeout(2000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._watch).length));
await done();
