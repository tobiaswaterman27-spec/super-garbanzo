// Running into people: they stagger and shout, sometimes spill what they carry.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
const who = await p.evaluate(() => { const s = O.SimRef.cur, q = s.people.find((x) => x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && x.age >= 16); if (!q) return null; const P = O.game.player; q.agent.frozen = true; P.x = q.agent.x - 30; P.y = q.agent.y; globalThis._jq = q; return q.first; });
await p.evaluate(() => { globalThis._jq.agent.frozen = false; });
await p.keyboard.down('ShiftLeft'); await p.keyboard.down('ArrowRight'); let md = 1e9; for (let i = 0; i < 9; i++) { await p.waitForTimeout(50); md = Math.min(md, await p.evaluate(() => Math.hypot(O.game.player.x - globalThis._jq.agent.x, O.game.player.y - globalThis._jq.agent.y))); } console.log('closest', md.toFixed(1), await p.evaluate(() => [O.game.player.moving, O.game.keys.has('run')].join())); await p.keyboard.up('ArrowRight'); await p.keyboard.up('ShiftLeft'); await p.waitForTimeout(300);
console.log('ran into', who, '| bumps:', await p.evaluate(() => O.Jostle.bumps), '| remembered:', await p.evaluate(() => (globalThis._jq.memories || []).some((m) => /barged/.test(m.text || m))));
await done();
