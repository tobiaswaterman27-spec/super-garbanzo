import { start } from './lib.mjs';
const { p, done } = await start();
await p.waitForTimeout(800);
let found = false;
for (let d = 0; d < 8 && !found; d++) { found = await p.evaluate(() => { O.openBoard('tavern'); const btns = [...document.querySelectorAll('[data-take]')]; const i = btns.findIndex(b => /merchant/i.test(b.closest('li,div,tr')?.textContent || '')); if (i >= 0) { btns[i].click(); return true; } O.Panels.close(); O.SimRef.cur.day++; return false; }); }
console.log('accepted escort:', found);
console.log(await p.evaluate(() => { const C = O.PlayerState.contract, s = O.SimRef.cur, q = s.byId.get(C.target); window._m = q; O.game.player.x = q.agent.x + 30; O.game.player.y = q.agent.y; return 'buttons ' + O.npcUI.extraButtons(q).map(x => x[0]).join(','); }));
await p.waitForTimeout(2500);
console.log(await p.evaluate(() => 'hailed ' + !!window._m._hailed + ' talking ' + (O.npcUI.talking() === window._m) + ' | ' + (window._m._conv || []).map(c => c.who + ': ' + c.t).join(' | ')));
await p.evaluate(() => O.AIChat.say(window._m, "Aye, I'm your escort. Let's go.", () => {}));
await p.waitForTimeout(2500);
console.log(await p.evaluate(() => 'started ' + O.PlayerState.contract.started));
await done();
