// A knock at your own door: someone you once helped calls with a small gift while you're at home.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const r = await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const b = s.world.buildings.find((x) => x.type === 'house' && x.doorX != null && !s.people.some((q) => q.home === x.id)) || s.world.buildings.find((x) => x.type === 'house' && x.doorX != null); b.owner = { kind: 'player' }; const q = s.people.find((x) => x.age >= 18 && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand); s.remember(q, 'A stranger found my little one when they were lost, and brought them home to me.', 'kindness', 0.8); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 1) * 16 + 8; O.game.enterBuilding(b); O.HomeVisit.soon(); window.__n0 = O.PlayerState.items.length; return [b.id, q.first]; });
await p.waitForTimeout(9000);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/homevisit.png' });
await p.waitForTimeout(14000);
console.log('home', r[0], '| visitor', r[1], '| visits:', await p.evaluate(() => O.HomeVisit.visits), '| gift added:', await p.evaluate(() => O.PlayerState.items.length - window.__n0), '| still held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._visit).length));
await done();
