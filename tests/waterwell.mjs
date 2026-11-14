// Water: households queue at the well, gossip, carry pails home; winter ice; you draw, carry, tip into your butt, wash.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 6.5 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; });
const w = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const w = O.Water.wellsOf(s)[0]; P.x = w.x + 40; P.y = w.y + 40; for (const hh of s.households) hh.water = 0; O.Water.freeze(s, w); return Math.round(w.x) + ',' + Math.round(w.y) + ' iced:' + O.Water.iced(s, w); });
console.log('well:', w);
for (let i = 0; i < 40 && (await p.evaluate(() => O.Water.trips < 3 || O.Water.iceBroken < 1)); i++) await p.waitForTimeout(1000);
console.log('trips/ice:', await p.evaluate(() => [O.Water.trips, O.Water.iceBroken].join('/')));
await p.waitForTimeout(12000);
await p.screenshot({ path: (process.env.SD || '.') + '/waterwell.png' });
console.log('queue/gossips:', await p.evaluate(() => [[...O.Water.queue.values()].map((L) => L.length).join(','), O.Water.gossips, O.SimRef.cur.people.filter((q) => q.agent && q.agent.forceAnim === 'bucket').length].join(' | ')));
for (let i = 0; i < 40 && (await p.evaluate(() => !O.SimRef.cur.households.some((hh) => hh.water >= 2))); i++) await p.waitForTimeout(1000);
console.log('refilled:', await p.evaluate(() => O.SimRef.cur.households.filter((hh) => hh.water >= 2).length));
// you
const me = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); if (O.npcUI.talking()) O.npcUI.closeTalk(); P.locked = false; O.PlayerState.carry = null; const b = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null)[2]; b.owner = { kind: 'player' }; window._b = b; const w = O.Water.wellsOf(s)[0]; w._iceDay = s.day; P.x = w.x; P.y = w.y + 14; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Draw a bucket/.test(x.label)); if (!c) return 'no draw prompt ' + JSON.stringify({ l: P.locked, sc: !!O.game.scene, c: O.PlayerState.carry, labels: O.moreCandidates.map((f) => f()).filter(Boolean).map((x) => x.label) }); c.act(); return c.label; });
console.log('draw:', me); await p.waitForTimeout(3000);
console.log('carry:', await p.evaluate(() => JSON.stringify(O.PlayerState.carry)));
console.log('tip:', await p.evaluate(() => { const b = window._b, P = O.game.player; P.x = b.doorX * 16 - 6; P.y = (b.doorY + 1) * 16 + 4; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Tip the water/.test(x.label)); if (!c) return 'no tip prompt'; c.act(); return c.label + ' butt ' + O.Water.butt(O.SimRef.cur, b); }));
await p.waitForTimeout(1000);
console.log('wash:', await p.evaluate(() => { const b = window._b; O.PlayerState.grime = 0.5; O.game.enterBuilding(b, 0); return !!O.game.scene; }));
await p.waitForTimeout(1500);
console.log('wash2:', await p.evaluate(() => { const c = (O.sceneMore || []).map((f) => f()).find((x) => x && /Wash with warm|butt is dry/.test(x.label)); if (!c) return 'no wash'; c.act(); return c.label + ' butt ' + O.Water.butt(O.SimRef.cur, window._b); }));
await p.waitForTimeout(3500);
console.log('grime:', await p.evaluate(() => O.PlayerState.grime.toFixed(2) + ' washes ' + O.Water.washes));
await done();
