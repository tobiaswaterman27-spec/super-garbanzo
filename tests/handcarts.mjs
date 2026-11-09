// Heavy loads go through the streets on handcarts.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 9 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
let most = 0, goods = new Set();
for (let i = 0; i < 20; i++) { await p.waitForTimeout(3000); const r = await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const c = s.people.find((q) => q.agent && !q.agent.hidden && q.agent.inside == null && q.agent.carrying && typeof q.agent.carrying === 'object' && (q.agent.carrying.qty || 1) >= 2); if (c && Math.hypot(c.agent.x - P.x, c.agent.y - P.y) > 300) { P.x = c.agent.x + 30; P.y = c.agent.y + 30; } return [O.Handcarts.carts, c ? c.agent.carrying.good + ':' + c.agent.carrying.qty : null]; }); most = Math.max(most, r[0]); if (r[1]) goods.add(r[1]); if (r[0] && process.env.SD && !globalThis.shot) { globalThis.shot = 1; await p.screenshot({ path: process.env.SD + '/cart.png' }); } }
console.log('handcarts in view (most):', most, '| loads seen:', [...goods].slice(0, 8).join(' '));
await done();
