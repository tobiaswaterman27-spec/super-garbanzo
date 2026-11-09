// Each post's marked places turn up something of their own: a find, a tip, a scratch, a word from someone by.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 9 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const s = O.SimRef.cur, bz = [...s.biz.values()].find((z) => z.type === 'bakery'); const b = s.building(bz.b?.id ?? bz.id); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 2) * 16; O.Employment.hire(s, bz, s.byId.get(bz.workers[0]), 'baker', 6); const e = O.Employment.here(); e.onShift = true; return O.tradeOf(e, bz); });
console.log('trade:', r);
const out = await p.evaluate(() => { const e = O.Employment.here(); const res = {}; for (const role of ['baker', 'shepherd', 'messenger', 'gravedigger', 'chimney sweep']) { e.role = role; const m0 = O.PlayerState.money, n0 = O.PlayerState.items.length; for (let i = 0; i < 12; i++) O.JobIncidents.fire(); res[role] = (O.PlayerState.money - m0) + ' coin, ' + (O.PlayerState.items.length - n0) + ' items'; } return res; });
console.log(JSON.stringify(out));
console.log('log:', JSON.stringify(await p.evaluate(() => O.JobIncidents.log)), '| roles covered:', await p.evaluate(() => Object.keys(O.JobIncidents.INC).length));
await p.waitForTimeout(1500);
await done();
