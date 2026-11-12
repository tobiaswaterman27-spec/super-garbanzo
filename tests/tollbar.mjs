// The toll bar: a pole across the road by the toll house, raised for those who pay.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
let bars = await p.evaluate(() => O.TollBar.bars().length);
if (!bars) { await p.evaluate(() => O.teleport('aurelia')); await p.waitForTimeout(3000); bars = await p.evaluate(() => O.TollBar.bars().length); }
console.log('toll bars here:', bars);
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const B = O.TollBar.bars()[0]; if (B) { O.game.player.x = B.x + 60; O.game.player.y = B.y + 40; } });
let up = 0; for (let i = 0; i < 20; i++) { await p.waitForTimeout(2000); up = Math.max(up, await p.evaluate(() => Math.max(0, ...O.TollBar.bars().map((b) => b.up)))); }
console.log('bar raised (max 0..1):', up.toFixed(2), '| tolls taken', await p.evaluate(() => O.TollBar.taken));
const m0 = await p.evaluate(() => { O.PlayerState.money = Math.max(5, O.PlayerState.money); const B = O.TollBar.bars()[0]; O.game.player.x = B.x; O.game.player.y = B.y; return O.TollBar.taken; });
await p.waitForTimeout(1500);
console.log('you paid the toll:', (await p.evaluate(() => O.TollBar.taken)) > m0, '| bar up for you:', (await p.evaluate(() => O.TollBar.bars()[0].up)).toFixed(2));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/toll.png', clip: { x: 440, y: 260, width: 320, height: 200 } });
await p.evaluate(() => { window._ui = []; const o = O.UI.say; O.UI.say = (t, k) => { window._ui.push(t); return o(t, k); }; });
// next day, no penny and a keeper who doesn't like you: the bar stays down; duck past and you're shouted after
await p.evaluate(() => { const s = O.SimRef.cur; const d = s.day; let g = 0; while (!(s.day > d && s.minute / 60 >= 10) && g++ < 9000) s.tick(2); O.game.clock.minute = s.minute; O.PlayerState.money = 0; if (O.PlayerState.rep) O.PlayerState.rep.civilian = 0; for (const z of s.biz.values()) if (z.type === 'tollhouse') for (const id of z.workers || []) { const k = s.byId.get(id); if (k) k.rel.set(0, { affinity: -0.4, familiar: 0.3 }); } const B = O.TollBar.bars()[0]; const P = O.game.player; P.x = B.horiz ? B.x - 24 : B.x; P.y = B.horiz ? B.y : B.y - 24; });
await p.waitForTimeout(6500);
await p.evaluate(() => { const B = O.TollBar.bars()[0], P = O.game.player; P.x = B.horiz ? B.x - 6 : B.x; P.y = B.horiz ? B.y : B.y - 6; });
await p.waitForTimeout(1200);
console.log('broke, turned back: trusted', await p.evaluate(() => O.TollBar.trusted), (await p.evaluate(() => { const B = O.TollBar.bars()[0]; return JSON.stringify({ horiz: B.horiz, bx: B.x, by: B.y, px: O.game.player.x, py: O.game.player.y, msgs: (window._ui || []).slice(-3) }); })));
await p.evaluate(() => { const B = O.TollBar.bars()[0], P = O.game.player; P.x = B.horiz ? B.x + 24 : B.x; P.y = B.horiz ? B.y : B.y + 24; });
await p.waitForTimeout(1200);
console.log('ducked past: dodged', await p.evaluate(() => O.TollBar.dodged), 'owed', await p.evaluate(() => [...O.TollBar.owed.values()].join(',')));
await done();
