import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 10 * 60; O.game.clock.minute = 10 * 60; });
await p.waitForTimeout(600);
// sides of you, and the panel
console.log(await p.evaluate(() => { const PS = O.PlayerState; PS.almsToPoor = 20; PS.skills.woodcraft = 0.3; return 'standing: ' + O.standingWords().join(', '); }));
await p.keyboard.press('KeyK'); await p.waitForTimeout(300);
console.log(await p.evaluate(() => 'panel: ' + (document.querySelector('.panel, #panel, [class*=panel]')?.innerText || '').replace(/\s+/g, ' ').slice(0, 160)));
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
// a rank reached is told
await p.evaluate(() => { O.PlayerState.skills.woodcraft = 0.52; });
await p.waitForTimeout(3500);
console.log(await p.evaluate(() => 'ranks ' + JSON.stringify(O.PlayerState.life.ranks)));
// false name
console.log(await p.evaluate(async () => { const s = O.SimRef.cur, q = s.people.find((x) => x.age > 20 && x.agent && !x.agent.hidden); let line = ''; await O.AIChat.say(q, 'Good day. My name is Wat Tyler.', (l) => { line = l; }); const ex = O.extraLines.map((f) => { try { return f(s, q); } catch (e) { return 'ERR ' + e.message; } }).filter((x) => /name is|What folk say|old and remember|Family stories/.test(x || '')); return 'names ' + JSON.stringify(O.PlayerState.life.names) + ' alias ' + O.PlayerState.life.alias + ' | lines: ' + ex.map((x) => x.slice(0, 90)).join(' / '); }));
// gossip overheard: put two people near the player and force a deed
console.log(await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState, pl = O.game.player; PS.deeds = [{ t: 'The stranger pulled a child out of the mill-race.', day: s.day, place: s.world.placeId }]; const two = s.people.filter((q) => q.age > 16 && q.agent && !q.agent.hidden && q.activity?.act !== 'sleep').slice(0, 2); two.forEach((q, i) => { q.agent.x = pl.x + 60 + i * 20; q.agent.y = pl.y; q.agent.frozen = false; }); window._two = two.map((q) => q.id); window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '') + ': ' + t); return o(w, t, ...a); }; return 'set ' + two.map((q) => q.first).join(' & '); }));
let heard = '';
for (let i = 0; i < 12 && !heard; i++) { await p.waitForTimeout(5000); heard = await p.evaluate(() => { const s = O.SimRef.cur; if (_said.length) return _said.join(' | '); const pl = O.game.player; for (const id of _two) { const q = s.byId.get(id); q.agent.x = pl.x + 60; q.agent.y = pl.y + (id % 2) * 20; } return ''; }); }
console.log('overheard: ' + (heard || 'nothing'));
// a friend comes with food when you're ill
console.log(await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState, q = s.people.find((x) => x.age > 20 && x.agent && !x.agent.hidden && !x.job); if (!q) return 'no friend'; q.rel.set(0, Object.assign(q.rel.get(0) || {}, { affinity: 0.8, familiar: 0.8 })); PS.ill = { kind: 'flux', sev: 0.5, day: s.day }; PS.life.friendHelped = null; window._f = q.id; return 'friend ' + q.first; }));
await p.waitForTimeout(48000);
console.log(await p.evaluate(() => 'friend helped day ' + O.PlayerState.life.friendHelped + ' satchel ' + O.PlayerState.items.filter((k) => k === 'stew' || k === 'bread').join(',')));
// routine and burglary
console.log(await p.evaluate(() => { const s = O.SimRef.cur, PS = O.PlayerState, L = PS.life; const b = s.world.buildings.find((x) => x.type === 'house' && x.doorX != null && !x.parent); b.owner = { kind: 'player' }; (PS.homes = PS.homes || {})[s.world.placeId + ':' + b.id] = ['ring', 'bread']; L.routine = { key: 'x', name: 'the Bell', days: 4, place: s.world.placeId }; L.evenings = { x: { days: 4, last: s.day, name: 'the Bell' } }; const r0 = Math.random; Math.random = () => 0.01; try { s.newDay(); } finally { Math.random = r0; } return 'burgled ' + JSON.stringify(L.burgledNote) + ' stash ' + JSON.stringify(PS.homes[s.world.placeId + ':' + b.id]); }));
// house remarks
console.log(await p.evaluate(() => { const s = O.SimRef.cur, b = s.world.buildings.find((x) => x.owner && x.owner.kind === 'player'); b.decor = { wall: 'tapestry' }; O.Interior.invalidate(b); O.game.enterBuilding(b, 0); return 'in house'; }));
await p.waitForTimeout(800);
console.log(await p.evaluate(() => { const s = O.SimRef.cur, sc = O.game.scene; const q = s.people.find((x) => x.age > 20 && x.agent && x.activity?.act !== 'sleep'); return 'house line: ' + (O.extraLines.map((f) => { try { return f(s, q); } catch (e) { return 'ERR ' + e.message; } }).find((x) => /own house/.test(x || '')) || 'none'); }));
await done();
