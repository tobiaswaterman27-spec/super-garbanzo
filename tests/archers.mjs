import { start } from './lib.mjs';
const { p, done } = await start();
await p.waitForTimeout(6000);
console.log(await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const a = s.people.find((q) => /^guard|sergeant/.test(q.job?.role || '') && q._archer); if (!a) return 'no archer'; a.agent.hidden = false; a.agent.inside = null; a.agent.x = P.x + 150; a.agent.y = P.y; a.agent.chasing = true; a.agent.frozen = true; window._a = a.id; O.Pursuit.holding = () => true; O.PlayerState.hp = 100; return 'archer ' + a.first + ' bow on back ' + (a.app.outfit.backItem === 'bow'); }));
await p.waitForTimeout(12000);
console.log(await p.evaluate(() => 'hp ' + Math.round(O.PlayerState.hp) + ' wounds ' + (O.PlayerState.wounds || []).filter((w) => /arrow/.test(w.kind)).length + ' stuck in the ground ' + O.Archers.stuck.length));
await done();
