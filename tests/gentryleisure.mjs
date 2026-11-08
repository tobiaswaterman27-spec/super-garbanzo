// The quality at ease: lapdogs at ladies' heels, pairs on garden benches talking or at chess.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => O.teleport('aurelia')); await p.waitForTimeout(3000);
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'summer', configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 15 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const benches = (s.world.props || []).filter((p) => p.kind === 'bench'); const gg = s.people.filter((q) => q.gentry && q.agent && !q.agent.hidden && q.agent.inside == null); let best = benches[0], bn = -1; for (const b of benches) { const n = gg.filter((q) => Math.hypot(q.agent.x - b.x, q.agent.y - b.y) < 700).length; if (n > bn) { bn = n; best = b; } } if (best) { O.game.player.x = best.x + 40; O.game.player.y = best.y + 60; } });
let dogs = 0, sits = 0;
for (let i = 0; i < 16; i++) { await p.waitForTimeout(4000); dogs = Math.max(dogs, await p.evaluate(() => O.GentryLeisure.dogs.size)); sits = Math.max(sits, await p.evaluate(() => O.GentryLeisure.sits.filter((x) => x.ppl.length === 2).length)); if (sits && process.env.SD && !globalThis.shot) { globalThis.shot = 1; await p.evaluate(() => { const S = O.GentryLeisure.sits.find((x) => x.ppl.length === 2); O.game.player.x = S.x + 30; O.game.player.y = S.y + 40; }); await p.waitForTimeout(600); await p.screenshot({ path: process.env.SD + '/leisure.png', clip: { x: 440, y: 260, width: 300, height: 180 } }); } }
console.log('lapdogs seen:', dogs, '| pairs on benches:', sits, '| chess games begun:', await p.evaluate(() => O.GentryLeisure.games));
await done();
