// After rain, children jump in the puddles, splashing, till a mother shouts.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'spring', configurable: true }); let g = 0; while (Math.floor(s.minute / 60) !== 15 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; s.raining = false; s.weather.wet = 0.6; });
let most = 0;
for (let i = 0; i < 12; i++) { await p.waitForTimeout(5000); await p.evaluate(() => { O.SimRef.cur.weather.wet = 0.6; }); const n = await p.evaluate(() => O.Puddles.jumps.length); most = Math.max(most, n); if (n && process.env.SD && !globalThis.shot) { globalThis.shot = 1; await p.evaluate(() => { const J = O.Puddles.jumps[0]; O.game.player.x = J.q.agent.x + 30; O.game.player.y = J.q.agent.y + 20; }); await p.waitForTimeout(400); await p.screenshot({ path: process.env.SD + '/puddle.png', clip: { x: 460, y: 290, width: 240, height: 150 } }); } }
console.log('jumping at once (most):', most, '| total', await p.evaluate(() => O.Puddles.total), '| lifted after', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.agent && q.agent.lift && !q._puddle && !q._repair && !q._tree && !q._siteRole && !q._bit && !q._playing).map((q) => q.first + ':' + q.age + ':' + q.agent.lift + ':' + q.activity?.act + ':' + Object.keys(q).filter((k) => k[0] === '_' && q[k]).join('/')).join(' ')));
await done();
