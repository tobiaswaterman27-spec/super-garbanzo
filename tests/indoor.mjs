import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 20) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
await p.waitForTimeout(3000);
await p.evaluate(() => { const s = O.SimRef.cur; O.game.enterBuilding(s.building(s.tavernId), 0); });
await p.waitForTimeout(2500);
console.log(await p.evaluate(() => 'in the tavern: ' + [...O.game.scene.actors.values()].filter((a) => a.person).length + ' people, seated ' + [...O.game.scene.actors.values()].filter((a) => a.seat).length));
for (const n of ['arm', 'toast', 'song', 'drunk', 'spill']) { const r = await p.evaluate((n) => { _said.length = 0; return O.IndoorLife.run('tavern', n); }, n); await p.waitForTimeout(r ? 6500 : 200); console.log(n.padEnd(6), r ? 'ran' : 'NO CAST', '|', (await p.evaluate(() => _said.slice(0, 3).join(' / '))).slice(0, 200)); }
console.log(await p.evaluate(async () => { const a = [...O.game.scene.actors.values()].find((x) => x.person && x.person.age > 18); O.PlayerState.money = 20; let l = ''; await O.AIChat.say(a.person, 'Fancy an arm wrestle? 5 aurins on it.', (x) => { l = x; }); await new Promise((r) => setTimeout(r, 4000)); return 'arm-wrestle you: ' + l + ' money ' + O.PlayerState.money; }));
// a house at supper
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 18.5 * 60; O.game.clock.minute = 18.5 * 60; const b = s.world.buildings.find((x) => x.type === 'house' && x.household && s.households[x.household - 1]?.members.length >= 3); window._hb = b.id; for (const id of s.households[b.household - 1].members) { const q = s.byId.get(id); q.agent.inside = b.id; q.agent.hidden = false; q.activity = { act: 'home', b: b.id }; } O.game.enterBuilding(b, 0); });
await p.waitForTimeout(2500);
for (const n of ['grace', 'squabble', 'mend']) { const r = await p.evaluate((n) => { _said.length = 0; return O.IndoorLife.run('home', n); }, n); await p.waitForTimeout(r ? 4500 : 200); console.log(n.padEnd(8), r ? 'ran' : 'NO CAST', '|', (await p.evaluate(() => _said.slice(0, 3).join(' / '))).slice(0, 200)); }
await done();
