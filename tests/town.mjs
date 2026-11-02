import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { O.game.clock.speed = 60; });
await p.waitForTimeout(12000);
console.log(await p.evaluate(() => { const s = O.SimRef.cur; const habits = s.people.filter(q => q.activity?.zone === 'habit').length; const hob = s.people.filter(q => q.activity?.hobby).map(q => q.activity.hobby); return 'h ' + s.hour.toFixed(1) + ' at habits ' + habits + ' hobbies ' + JSON.stringify(hob.reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {})) + ' feuds ' + (s.feuds || []).length + ' project ' + (s.project ? s.project.name : '-'); }));
// rumour started by the player spreads
console.log(await p.evaluate(async () => { const s = O.SimRef.cur; const q = s.people.find(z => z.age > 20 && z.rel && [...z.rel].some(([id, r]) => id && r.affinity > 0.2)); const about = s.people.find(z => z.age > 20 && z !== q); let l = ''; await O.AIChat.say(q, 'Did you hear that ' + about.first + ' stole from the church box?', (x) => { l = x; }); for (let i = 0; i < 4; i++) s.newDay(); const r = (s.rumours || []).find(x => x.about === about.id); return 'rumour heard by ' + (r ? r.heard.size : 0) + ' | grown: ' + (r ? r.gen : '-'); }));
// works: force one and work on it
console.log(await p.evaluate(() => { const s = O.SimRef.cur; s.treasury.cash = 500; s.project = null; s.lastWorks = -99; let k = 0; while (!s.project && k++ < 12) s.newDay(); const P0 = s.project; if (!P0) return 'no works started'; const P = O.game.player; P.x = P0.tx * 16 + 8; P.y = (P0.ty + 1) * 16; const s0 = s; s0.minute = 10 * 60; O.game.clock.minute = 10 * 60; const c = (O.moreCandidates || []).map(f => f()).find(x => x && /^Work on/.test(x.label)); return 'works: ' + P0.name + ' | option: ' + (c ? c.label : 'none'); }));
// sneak toggle & curfew question
await p.keyboard.press('KeyX'); await p.waitForTimeout(300);
console.log(await p.evaluate(() => 'sneaking ' + !!O.game.player.sneak + ' speed ' + Math.round(O.game.speedFor(false))));
await done();
