// The moot: candidates speak from boxes, the crowd heckles, a show of hands, the winner cheered.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 16 && g++ < 3000) s.tick(2); s.reeveMoot = s.day; while (s.minute < 17 * 60 + 15) s.tick(2); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8 + 8; O.game.player.y = (y0 + y1) * 8 + 60; });
await p.waitForTimeout(4000);
console.log('standing:', await p.evaluate(() => O.MootScene.moot ? O.MootScene.moot.cands.map((q) => q.first).join(' vs ') : null), '| crowd:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.activity?.act === 'moot').length));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/moot.png' });
await p.evaluate(() => { const s = O.SimRef.cur; while (s.minute < 18 * 60 + 2) s.tick(1); O.game.clock.minute = s.minute; });
await p.waitForTimeout(2500);
console.log('result:', await p.evaluate(() => { const M = O.MootScene.moot; return M ? (M.result === 'you' ? 'you' : M.result ? M.result.first : 'none') + ' cheer ' + (M.cheer > 0) : 'over'; }), '| reeve now:', await p.evaluate(() => { const s = O.SimRef.cur; const r = s.byId.get(s.reeveId); return r ? r.first : s.reeveId; }), '| moots held:', await p.evaluate(() => O.MootScene.held));
await p.waitForTimeout(16000);
console.log('released:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._moot).length === 0));
await done();
