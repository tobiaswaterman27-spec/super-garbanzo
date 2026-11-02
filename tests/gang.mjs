import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 22.5 * 60; O.game.clock.minute = 22.5 * 60; });
await p.waitForTimeout(1000);
// case a rich house
console.log(await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const b = s.world.buildings.filter(x => x.doorX != null && ['house', 'mansion', 'townhouse', 'manor'].includes(x.type) && x.household).sort((a, c) => (c.wealth || 0) - (a.wealth || 0))[0]; b.wealth = Math.max(b.wealth || 0, 0.7); P.x = b.doorX * 16 + 8; P.y = (b.doorY + 2) * 16; window._b = b; const c = (O.moreCandidates || []).map(f => f()).find(x => x && /Watch the house/.test(x.label)); if (!c) return 'no casing option'; c.act(); return 'casing ' + (b.name || b.type); }));
await p.waitForTimeout(3000);
console.log(await p.evaluate(async () => { const s = O.SimRef.cur, H = O.PlayerState.heist; if (!H) return 'no heist'; const crook = s.people.find(q => q.gang) || s.people.find(q => q.age > 18); crook.attitude = -0.5; let l = ''; await O.AIChat.say(crook, 'Will you help me with a job tonight?', (x) => { l = x; }); return 'heist on ' + H.name + ' | crew answer: ' + l + ' | crew ' + JSON.stringify(H.roles); }));
// stolen goods recognised
console.log(await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState; PS.add('candlestick'); PS.stolen = { candlestick: 1 }; PS.stolenAt = { candlestick: s.world.placeId }; const seller = s.people.find(q => q.job && q.age > 20); let n = 0; for (let i = 0; i < 20; i++) if (O.stolenRecognised(s, 'candlestick', seller)) n++; return 'recognised ' + n + '/20 in the same town'; }));
// guard bribe, and gang war day
console.log(await p.evaluate(async () => { const s = O.SimRef.cur, PS = O.PlayerState; PS.money = 40; const g = s.people.find(q => /^guard/.test(q.job?.role || '')); g.traits = [...g.traits, 'greedy']; let l = ''; await O.AIChat.say(g, 'Here, a coin for your trouble if you warn me when the watch come.', (x) => { l = x; }); const gs = s.gangs.filter(x => x.id !== 'player'); if (gs.length >= 2) { gs[0].rel[gs[1].id] = 'enemy'; gs[1].rel[gs[0].id] = 'enemy'; } for (let i = 0; i < 4; i++) s.newDay(); const burnt = s.world.props.filter(p => p.kind === 'stall' && p.burnt).length; return 'guard: ' + l + ' | paid ' + JSON.stringify(PS.paidGuard && PS.paidGuard.name) + ' | gangs ' + gs.length + ' burnt stalls ' + burnt + ' tavern held ' + (s.biz.get(s.tavernId)?.gangHeld || '-'); }));
await done();
