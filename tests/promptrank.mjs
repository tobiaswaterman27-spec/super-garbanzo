// A passing moment anchored on someone (lend them the loaf) wins over plain "Talk to" when you stand by them;
// prompts that follow you about (wildflowers) still lose to talk.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const r = await p.evaluate(async () => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute;
  const vis = s.people.filter((x) => x.agent && x.agent.inside == null && !x.agent.hidden); const q = vis.find((x) => x.age >= 18 && !vis.some((y) => y !== x && Math.hypot(y.agent.x - x.agent.x, y.agent.y - x.agent.y) < 70)); q.agent.frozen = true; q.agent.path = null; const P = O.game.player; P.x = q.agent.x + 14; P.y = q.agent.y + 2;
  let mode = 'anch'; O.moreCandidates.push(() => mode === 'anch' ? { type: 'custom', d: 40, x: q.agent.x, y: q.agent.y - 28, label: 'TEST anchored', act: () => {} } : mode === 'follow' ? { type: 'custom', d: 22, x: P.x, y: P.y - 40, label: 'TEST follow', act: () => {} } : null);
  const wait = () => new Promise((res) => setTimeout(res, 500)); P.x += 0.1; await wait(); const a = O.interactLabel; mode = 'follow'; P.x += 4; await wait(); const b = O.interactLabel; mode = null; q.agent.frozen = false; return [a, b]; });
console.log('anchored:', r[0]); console.log('follow:', r[1]);
await done();
