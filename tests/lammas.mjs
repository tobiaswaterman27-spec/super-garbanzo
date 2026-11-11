// Lammas: loaves of the first wheat carried up to be blessed; you can hold yours up too.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 9.1 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const b = s.building(s.chapelId); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 8) * 16; O.Candlemas.force('loaf'); O.PlayerState.items.push('bread'); });
let mine = false, shot = false;
for (let i = 0; i < 120; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const C = O.Candlemas.feast; return C ? C.kind + ' ' + C.file.map((f) => f.state[0]).join('') : 'none'; });
  if (!mine && r !== 'none') mine = await p.evaluate(() => { const C = O.Candlemas.feast; if (!C || !C.priest) return false; const P = O.game.player, keep = [P.x, P.y]; P.x = C.priest.agent.x + 10; P.y = C.priest.agent.y + 10; P.locked = false; const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && /loaf to be blessed/.test(x.label)); P.x = keep[0]; P.y = keep[1]; if (!c) return false; c.act(); return c.label; });
  if (!shot && /w/.test(r) && i > 5 && process.env.SD) { shot = true; await p.screenshot({ path: process.env.SD + '/lammas.png', clip: { x: 360, y: 120, width: 480, height: 320 } }); }
  if (r === 'none' && i > 2) break; }
console.log('yours:', mine, '| blessed:', await p.evaluate(() => O.Candlemas.blessed));
await p.evaluate(() => O.Candlemas.unforce()); await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._candle).length));
await done();
