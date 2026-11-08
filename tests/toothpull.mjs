// The barber draws a tooth in the street while idlers watch.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
let has = await p.evaluate(() => [...O.SimRef.cur.biz.values()].some((z) => z.type === 'barber' && (z.workers || []).length));
if (!has) { await p.evaluate(() => O.teleport('aurelia')); await p.waitForTimeout(3000); }
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const z = [...s.biz.values()].find((z) => z.type === 'barber'); const b = s.building(z.b?.id ?? z.id); O.game.player.x = b.doorX * 16 + 40; O.game.player.y = b.doorY * 16 + 90; O.ToothPull.soon(); });
let seen = '';
for (let i = 0; i < 20; i++) { await p.waitForTimeout(3000); const r = await p.evaluate(() => { const J = O.ToothPull.job; return J ? (J.go ? 'pulling' : 'gathering') + ' watchers ' + J.watch.length : 'none'; }); if (r.startsWith('pulling') && process.env.SD && !globalThis.shot) { globalThis.shot = 1; await p.waitForTimeout(6000); await p.screenshot({ path: process.env.SD + '/tooth.png', clip: { x: 420, y: 230, width: 340, height: 220 } }); } if (r !== 'none') seen = r; if (await p.evaluate(() => O.ToothPull.pulled)) break; }
console.log('why:', await p.evaluate(() => O.ToothPull.why), 'seen:', seen, '| teeth pulled:', await p.evaluate(() => O.ToothPull.pulled));
await p.waitForTimeout(8000);
console.log('held after:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._tooth && q.agent.frozen).length));
await done();
