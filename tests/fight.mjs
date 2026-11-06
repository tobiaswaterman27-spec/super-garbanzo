import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 11 * 60; O.game.clock.minute = 11 * 60; });
await p.waitForTimeout(800);
// a tough opponent, armour, guard up
console.log(await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState, P = O.game.player; PS.hp = 100; PS.items.length = 0; PS.add('gambeson'); PS.add('sword'); PS.equipped = 'sword'; const q = s.people.find((z) => z.age > 20 && z.age < 50 && z.agent && !z.agent.hidden && !/guard/.test(z.job?.role || '')); q.traits = [...q.traits.filter((t) => t !== 'cowardly'), 'brave', 'hostile']; q.agent.x = P.x + 12; q.agent.y = P.y; window._foe = q.id; O.Combat.provoke(q, 'fight'); return 'foe ' + q.first + ' armour ' + O.CombatDeep.armour().toFixed(2); }));
await p.keyboard.down('KeyZ'); await p.waitForTimeout(4000);
console.log(await p.evaluate(() => 'guard up 4s: hp ' + Math.round(O.PlayerState.hp) + ' stamina ' + Math.round(O.CombatDeep.stamina()) + ' anim ' + O.game.player.anim));
await p.screenshot({ path: '/tmp/claude-0/-home-user-super-garbanzo/514b99f1-f63a-5873-859b-4b3c2f5723f7/scratchpad/block.png' });
await p.keyboard.up('KeyZ');
// strike back a few times
for (let i = 0; i < 6; i++) { await p.evaluate(() => { const s = O.SimRef.cur, q = s.byId.get(_foe), P = O.game.player; P.dir = O.dirOf(q.agent.x - P.x, q.agent.y - P.y); }); await p.keyboard.press('Space'); await p.waitForTimeout(500); }
console.log(await p.evaluate(() => { const s = O.SimRef.cur, q = s.byId.get(_foe); return 'after 6 swings: foe hp ' + Math.round(q.health.hp) + ' my hp ' + Math.round(O.PlayerState.hp) + ' skill ' + (O.PlayerState.skills.fighting || 0).toFixed(3) + ' stamina ' + Math.round(O.CombatDeep.stamina()) + ' crowd ' + O.CombatDeep.crowd().length; }));
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => 'crowd now ' + O.CombatDeep.crowd().length));
await done();
