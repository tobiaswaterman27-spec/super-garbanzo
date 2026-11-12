// Your own trestle on market day: set up, cry your wares, take an offer, haggle in words.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; while (!(s.weekday === 6 && s.minute >= 9 * 60)) s.tick(5); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8 + 4; O.game.player.y = (y0 + y1) * 8 + 4; const PS = O.PlayerState; PS.items = PS.items || []; for (const k of ['cabbage', 'cabbage', 'bread', 'candles', 'cloth']) if (O.Data.GOODS[k]) PS.items.push(k); });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const c = O.moreCandidates.map((f) => f()).find((x) => x && /Set up a trestle/.test(x.label)); if (!c) return 'no prompt'; c.act(); const c2 = O.moreCandidates.map((f) => f()).find((x) => x && /Cry your wares/.test(x.label)); if (c2) c2.act(); return c.label + (c2 ? ' + cried' : ''); });
console.log('you:', r);
let took = 0, haggled = '';
for (let i = 0; i < 90 && (await p.evaluate(() => O.YourStall.sold)) < 3; i++) {
  const st = await p.evaluate(() => { const Y = O.YourStall.stall; if (!Y) return 'gone'; const P = O.game.player; P.x = Y.x; P.y = Y.y + 16; const B = Y.buyer; if (!B || !B.asked) return 'wait'; return 'offer'; });
  if (st === 'gone') break;
  if (st === 'offer') { if (!haggled) { haggled = await p.evaluate(async () => { const B = O.YourStall.stall.buyer; O.npcUI.openTalk(B.q); let h = ''; await O.AIChat.say(B.q, String(B.fair), (l) => { h = l; }); return B.q.first + ' offered ' + B.offer + ', you asked ' + B.fair + ': ' + h; }); } else { took += await p.evaluate(() => { const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Take /.test(x.label)); if (c) { c.act(); return 1; } return 0; }); } }
  await p.waitForTimeout(1000); }
console.log('haggle:', haggled);
console.log('sold/takings/walked:', await p.evaluate(() => [O.YourStall.sold, O.YourStall.takings, O.YourStall.walked].join('/')));
await p.evaluate(() => { const Y = O.YourStall.stall; if (Y) { const c = O.moreCandidates.map((f) => f()).find((x) => x && /Fold up/.test(x.label)); if (c) c.act(); } });
await p.waitForTimeout(3000);
console.log('stall gone:', await p.evaluate(() => !O.YourStall.stall), 'held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._ystall && !q.errand).length));
await done();
