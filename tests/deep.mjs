import { start } from './lib.mjs';
const { p, done } = await start();
const night = () => p.evaluate(() => { const s = O.SimRef.cur; s.minute = 23 * 60; O.game.clock.minute = 23 * 60; });
await night(); await p.waitForTimeout(800);
const talk = (who, text) => p.evaluate(async ([who, text]) => { const s = O.SimRef.cur, q = s.byId.get(who); let line = ''; await O.AIChat.say(q, text, (l) => { line = l; }); return line; }, [who, text]);
// ---- a feud comes to blows
await p.evaluate(() => { const s = O.SimRef.cur, g = O.game; s.minute = 12 * 60; g.clock.minute = 12 * 60; g.scene = null; g.player.inside = null; const sq = s.world.zones.square; g.player.x = (sq[0] + sq[2]) / 2 * 16; g.player.y = (sq[1] + sq[3]) / 2 * 16; });
await p.waitForTimeout(600);
console.log(await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const two = s.people.filter((q) => q.age > 20 && q.agent && !q.agent.hidden && !q.gang).slice(0, 2); const [a, b] = two; s.feuds = [{ a: a.id, b: b.id, day: s.day, stage: 2 }]; for (const [i, q] of two.entries()) { q.agent.x = P.x + 30 + i * 30; q.agent.y = P.y; q.agent.frozen = true; q.agent.path = null; } window._fd = two.map((q) => q.id); window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...x) => { _said.push(w.first + ': ' + t); return o(w, t, ...x); }; return 'feud ' + a.first + ' vs ' + b.first; }));
await p.waitForTimeout(9500);
console.log(await p.evaluate(() => { const s = O.SimRef.cur, [a, b] = _fd.map((id) => s.byId.get(id)); return 'feud ' + JSON.stringify(s.feuds) + ' d ' + [a, b].map((q) => Math.round(Math.hypot(q.agent.x - O.game.player.x, q.agent.y - O.game.player.y)) + (q.agent.hidden ? 'H' : '') + (q.agent.inside != null ? 'I' : '')).join(',') + ' paused ' + O.paused() + ' panel ' + O.panelOpen + ' dlg ' + O.UI.dialogOpen() + ' locked ' + O.game.player.locked + ' min ' + Math.round(s.minute) + ' scene ' + !!O.game.scene + ' cur ' + (O.SimRef.cur === s) + ' | ' + (a.memories || []).filter((m) => /blows/.test(m.text || m.t || '')).map((m) => m.text || m.t).join('') + ' | said ' + _said.slice(0, 3).join(' / '); }));
await night(); await p.waitForTimeout(800);
// ---- a whole heist: case, crew, go in, come out, split
const H = await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState, P = O.game.player; const b = s.world.buildings.filter((x) => x.doorX != null && ['house', 'townhouse', 'mansion'].includes(x.type) && x.household).sort((a, c) => c.wealth - a.wealth)[0]; PS.heist = { target: b.id, place: s.world.placeId, cased: true, crew: [], start: null, day: s.day, name: 'the rich house' }; const crew = s.people.filter((q) => q.age > 18 && q.age < 50 && q.home !== b.id && !q.job?.onShift).slice(0, 2); for (const q of crew) { q.rel.set(0, { affinity: 0.9, familiar: 0.9 }); q.traits = [...q.traits, 'risk-taking']; } window._hb = b.id; return { crew: crew.map((q) => q.id) }; });
for (const id of H.crew) console.log('crew:', await talk(id, 'I need you for a job tonight, a house. Will you keep watch for me?'));
console.log(await p.evaluate(() => 'crew ' + JSON.stringify(O.PlayerState.heist.roles)));
await p.evaluate(() => { const s = O.SimRef.cur, b = s.building(_hb), P = O.game.player; P.x = b.doorX * 16 + 8; P.y = (b.doorY + 1) * 16 + 6; });
await p.waitForTimeout(2000);
console.log(await p.evaluate(() => 'started ' + !!O.PlayerState.heist?.start));
await p.evaluate(() => { const s = O.SimRef.cur; O.game.enterBuilding(s.building(_hb), 0); });
await p.waitForTimeout(1500);
await p.evaluate(() => { O.PlayerState.money += 25; O.PlayerState.stolen = Object.assign({}, O.PlayerState.stolen, { candlestick: 1 }); const g = O.game; g.scene = null; g.player.inside = null; const b = O.SimRef.cur.building(_hb); g.player.x = b.doorX * 16 + 8 + 340; g.player.y = (b.doorY + 1) * 16 + 6; });
await p.waitForTimeout(2000);
console.log(await p.evaluate(() => 'heist after: ' + (O.PlayerState.heist ? 'still open' : 'done') + ' money ' + O.PlayerState.money));
// ---- a smuggling run: take the load, carry it after dark, get paid
const sm = await p.evaluate(() => { const s = O.SimRef.cur; const q = s.people.find((z) => z.age > 20 && z.agent && !z.agent.hidden); q.job = Object.assign({}, q.job || {}, { role: 'smuggler' }); O.PlayerState.items.length = 0; return q.id; });
console.log('run:', await talk(sm, "I'll do a run for you, carry the goods at night."));
console.log(await p.evaluate(async () => { const R = O.PlayerState.run; if (!R) return 'no run'; const s = O.SimRef.cur, b = s.building(R.to), P = O.game.player; const m0 = O.PlayerState.money; P.x = b.doorX * 16 + 8; P.y = (b.doorY + 1) * 16 - 2; await new Promise((r) => setTimeout(r, 2500)); return 'delivered ' + !O.PlayerState.run + ' paid ' + (O.PlayerState.money - m0); }));
// ---- the rat: accuse an informer in your gang
console.log(await p.evaluate(async () => { const s = O.SimRef.cur, g = s.gangs.find((x) => x.id !== 'player' && x.members.length); if (!g) return 'no gang'; const q = s.byId.get(g.members.find((m) => m.id !== g.leader).id); q._rat = true; (O.PlayerState.gangRanks = O.PlayerState.gangRanks || []).push({ gid: g.id, place: s.world.placeId, rank: 2, trust: 0.5 }); let line = ''; await O.AIChat.say(q, "I know it was you who went to the watch. You're the rat.", (l) => { line = l; }); return 'rat: ' + line + ' | still in gang ' + (q.gang === g.id); }));
// ---- two gangs at war
console.log(await p.evaluate(async () => { const s = O.SimRef.cur, g1 = s.gangs.find((x) => x.id !== 'player' && x.members.length); const pool = s.people.filter((q) => !q.gang && q.age >= 18 && q.age < 45 && !q.visitor).slice(0, 4); const g2 = Object.assign({}, g1, { id: 'redhand', name: 'the Red Hand', members: pool.map((q) => ({ id: q.id, role: 'thief', loyalty: 0.6, wage: 3 })), leader: pool[0].id, purse: 20, log: [], rel: {} }); for (const q of pool) q.gang = 'redhand'; s.gangs.push(g2); g1.rel = g1.rel || {}; g1.rel.redhand = 'rival'; g2.rel[g1.id] = 'rival'; const boss = s.byId.get(g1.leader); let line = ''; await O.AIChat.say(boss, "They insulted you. Strike first, start the war.", (l) => { line = l; }); const r0 = Math.random; Math.random = () => 0.1; try { for (let i = 0; i < 3; i++) s.newDay(); } finally { Math.random = r0; } const tv = s.biz.get(s.tavernId); const burnt = s.world.props.filter((x) => x.burnt).length; return 'war: ' + line + ' | rel ' + g1.rel.redhand + ' | tavern held by ' + (tv && tv.gangHeld) + ' burnt stalls ' + burnt; }));
await done();
