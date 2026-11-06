import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 23) s.tick(2); O.game.clock.minute = s.minute; const b = s.world.buildings.find((x) => x.type === 'house' && x.household && x.doorX != null); O.game.player.x = b.doorX * 16 + 8 + 150; O.game.player.y = (b.doorY + 2) * 16; O.NightWork.force(); });
let seen = '';
for (let i = 0; i < 10; i++) { await p.waitForTimeout(3000); seen = await p.evaluate(() => { const j = O.NightWork.job(); return j ? j.thief.first + ' ' + j.stage + ' at the ' + j.hh.surname + ' house' : ''; }); if (seen) { console.log('night:', seen); break; } await p.evaluate(() => O.NightWork.force()); }
await p.waitForTimeout(30000);
console.log(await p.evaluate(() => 'after: job ' + (O.NightWork.job() ? O.NightWork.job().stage : 'done') + ' | saw ' + JSON.stringify(O.PlayerState.sawBurglar && { name: O.PlayerState.sawBurglar.name, crime: O.PlayerState.sawBurglar.crime != null })));
console.log(await p.evaluate(async () => { const s = O.SimRef.cur, S = O.PlayerState.sawBurglar; if (!S) return 'nothing seen'; const g = s.people.find((q) => /guard|sergeant/.test(q.job?.role || '')); const th = s.byId.get(S.id); let l = ''; await O.AIChat.say(g, `I saw ${th.first} break into a house last night.`, (x) => { l = x; }); return 'told the watch: ' + l + ' | jailed ' + !!th.jailUntil; }));
await done();
