import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
await p.waitForTimeout(600);
for (const kind of Object.keys(await p.evaluate(() => Object.fromEntries(Object.keys(O.IdleLife.BITS).map((k) => [k, 1]))))) {
  const r = await p.evaluate((kind) => { const s = O.SimRef.cur, P = O.game.player; for (const b of O.IdleLife.bits) b.t = 1e8; const K = O.IdleLife.BITS[kind];
    const want = kind === 'doze' ? (q) => q.age >= 62 : ['pebble', 'stick', 'marbles', 'spin', 'hop', 'scrawl', 'piggy', 'clap'].includes(kind) ? (q) => q.age >= 5 && q.age < 13 : (q) => q.age >= 16 && q.age < 60;
    const ppl = s.people.filter((q) => want(q) && q.agent && q.alive !== false && !q._bit && !q._playing && !q.visitor).slice(0, 4); if (!ppl.length) return 'nobody';
    const act = { act: kind === 'dance' ? 'festival' : kind === 'pebble' || kind === 'stick' ? 'play' : 'stroll' };
    ppl.forEach((q, i) => { const a = q.agent; a.hidden = false; a.inside = null; a.path = null; a.frozen = false; a.x = P.x + 40 + i * 9; a.y = P.y + 20; q.activity = act; q.errand = null; q._scene = false; q.job && (q.job.onShift = false); });
    _said.length = 0; return O.IdleLife.start(kind, ppl[0]) ? 'started' : 'NO'; }, kind);
  await p.waitForTimeout(3500);
  const st = await p.evaluate((kind) => { const b = O.IdleLife.bits.find((x) => x.kind === kind); if (!b) return 'ended'; return `${b.ppl.length} [${b.ppl.map((q) => `${q.agent.forceAnim || q.agent.anim}${q.agent.lift > 0.5 ? '^' : ''}`).join(' ')}]`; }, kind);
  if (D) await p.screenshot({ path: `${D}/idle-${kind}.png`, clip: { x: 520, y: 330, width: 220, height: 140 } });
  console.log(kind.padEnd(8), r, '|', st, '|', (await p.evaluate(() => _said.slice(0, 2).join(' / '))).slice(0, 100));
}
// natural: let the town run and count how many get up to something on their own
await p.evaluate(() => { for (const b of O.IdleLife.bits) b.t = 1e8; });
await p.waitForTimeout(15000);
console.log('leak detail:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.agent && q.agent.frozen && !['_bit', '_playing', '_scene', '_fighting', '_cp', '_war', '_mark', '_front', '_shake', '_pass', '_spar', '_repair', '_bank', '_tree', '_door', '_stable', '_abbey', '_winter', '_call', '_chore', '_beast', '_proc', '_deal', '_lamp', '_mish', '_smug', '_rite', '_walkout', '_yard', '_escort', '_hunting', '_social'].some((f) => q[f]) && !q.roadfolk && !q.fairStall && !q.errand && !(O.npcUI.talking() === q)).map((q) => q.first + ':' + (q.activity && q.activity.act) + ':' + Object.keys(q).filter((k) => k.startsWith('_') && q[k]).join('/')).join(' | ')));
console.log('natural:', await p.evaluate(() => O.IdleLife.bits.map((b) => b.kind).join(',')), '| frozen leftovers:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q.agent && q.agent.frozen && !['_bit', '_playing', '_scene', '_fighting', '_cp', '_war', '_mark', '_front', '_shake', '_pass', '_spar', '_repair', '_bank', '_tree', '_door', '_stable', '_abbey', '_winter', '_call', '_chore', '_beast', '_proc', '_deal', '_lamp', '_mish', '_smug', '_rite', '_walkout', '_yard', '_escort', '_lamp', '_spar', '_repair', '_bank', '_tree', '_door', '_stable', '_abbey', '_winter', '_call', '_chore', '_beast', '_hunting', '_social'].some((f) => q[f]) && !q.roadfolk && !q.fairStall && !(q.errand) && !(O.npcUI.talking() === q)).length));
await done();
