import { start } from './lib.mjs';
const { p, done } = await start();
const setup = () => p.evaluate(() => { const s = O.SimRef.cur, g = s.gangs.find((x) => x.id !== 'player'); while (g.members.length < 4) { const q = s.people.find((z) => !z.gang && z.age > 18 && z.age < 40 && !z.visitor); q.gang = g.id; g.members.push({ id: q.id, role: 'member', loyalty: 0.6, wage: 2 }); } const pl = s.byId.get(g.members.find((m) => m.id !== g.leader).id); g.members.find((m) => m.id === pl.id).loyalty = 0.2; pl.traits.push('ambitious'); g.plot = null; O.PlayerState.gangRanks = [{ gid: g.id, place: s.world.placeId, rank: 2, trust: 0.4 }]; g.plot = { by: pl.id, day: s.day + 3, backers: [], warned: false, asked: true }; return { g: g.id, pl: pl.id, boss: g.leader }; });
// back the plotter
let ids = await setup();
console.log(await p.evaluate(async (ids) => { const s = O.SimRef.cur, q = s.byId.get(ids.pl); let l = ''; await O.AIChat.say(q, "I'm with you. I'll back you.", (x) => { l = x; }); const g = s.gang(ids.g); const r0 = Math.random; Math.random = () => 0.2; try { g.plot.day = s.day; O.GangPolitics.resolve(s, g); } finally { Math.random = r0; } return 'backed: ' + l + ' | new boss ' + s.byId.get(g.leader).first + ' (plotter ' + q.first + ') | rank ' + JSON.stringify(O.PlayerState.gangRanks); }, ids));
// warn the boss
ids = await setup();
console.log(await p.evaluate(async (ids) => { const s = O.SimRef.cur, g = s.gang(ids.g), boss = s.byId.get(g.leader), pl = s.byId.get(ids.pl); let l = ''; await O.AIChat.say(boss, `${pl.first} is plotting against you. He wants your place.`, (x) => { l = x; }); g.plot.day = s.day; O.GangPolitics.resolve(s, g); return 'warned: ' + l + ' | plotter still in gang ' + (pl.gang === g.id); }, ids));
await done();
