import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 19) s.tick(2); O.game.clock.minute = s.minute; const K = O.SimRef.home.kingdom; K.warInit(); K.declareWar({}); K.war.phase = 'war'; });
console.log(await p.evaluate(() => { const r = O.Raid.begin(); const P = O.game.player, b = r.band[0]; P.x = b.agent.x + 300; P.y = b.agent.y; return 'raid of ' + r.band.length + ' with ' + r.band.map((q) => q.app.outfit.item).join(','); }));
// you fight one: no crime
console.log(await p.evaluate(() => { const r = O.Raid.now(), q = r.band[0], P = O.game.player, n0 = O.PlayerState.crimes.length; P.x = q.agent.x - 12; P.y = q.agent.y; O.PlayerState.items.push('sword'); O.PlayerState.equipped = 'sword'; return 'crimes before ' + n0; }));
for (let i = 0; i < 10; i++) { await p.evaluate(() => { const q = O.Raid.now()?.band[0]; if (!q) return; const P = O.game.player; P.x = q.agent.x - 12; P.y = q.agent.y; P.dir = 2; }); await p.keyboard.press('Space'); await p.waitForTimeout(450); }
await p.waitForTimeout(60000);
console.log(await p.evaluate(() => { const r = O.Raid.now(); return (r ? `raid on: downed ${r.downed}, by you ${r.byYou}, looted ${r.looted}` : 'raid over') + ' | crimes ' + O.PlayerState.crimes.length + ' money ' + O.PlayerState.money + ' | fights ' + O.StreetFight.fights.length; }));
await done();
