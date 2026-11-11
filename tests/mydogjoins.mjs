// Your own dog joins in: sent to turn a loose bull (a herding dog), or set on the goose girl's geese.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const act = (re) => p.evaluate((src) => { O.game.player.locked = false; const r = new RegExp(src); const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && r.test(x.label)); if (!c) return false; c.act(); return c.label; }, re);
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8; O.PlayerState.dog = { seed: 77, name: 'Brock' }; });
await p.waitForTimeout(1500);
console.log('own dog:', await p.evaluate(() => { const d = (O.fauna || []).find((f) => f.mine && f.kind === 'dog'); if (!d) return null; d.mode = 'heel'; d.skills = Object.assign({}, d.skills, { herd: 3 }); return d.name; }));
await p.evaluate(() => O.LooseBull.soon());
let b = false; for (let i = 0; i < 30 && !b; i++) { await p.waitForTimeout(800); await p.evaluate(() => { const B = O.LooseBull.bull; if (!B) { O.LooseBull.soon(); return; } O.game.player.x = B.bull.x + 60; O.game.player.y = B.bull.y + 20; }); b = await act('turn the bull'); }
console.log('dog sent at the bull:', b);
for (let i = 0; i < 20 && (await p.evaluate(() => O.LooseBull.bull && O.LooseBull.bull.phase === 'loose')); i++) await p.waitForTimeout(1000);
console.log('bull roped after the dog turned it:', await p.evaluate(() => O.LooseBull.bull ? O.LooseBull.bull.phase : 'done'));
await done();
