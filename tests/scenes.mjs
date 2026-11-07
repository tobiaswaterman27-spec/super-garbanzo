import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 11 * 60; O.game.clock.minute = 11 * 60; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
await p.waitForTimeout(1500);
for (const name of ['well', 'dice', 'tag', 'quarrel', 'help', 'courting', 'lost', 'bless', 'pedlar', 'story', 'pig', 'cart', 'makeup', 'gift', 'visit']) {
  const r = await p.evaluate((n) => { const s = O.SimRef.cur, P = O.game.player; // gather a few free people close by so each scene can find its cast
    const pool = s.people.filter((q) => q.agent && !q.agent.hidden && q.agent.inside == null && !q.visitor).slice(0, 40); pool.forEach((q, i) => { q.agent.x = P.x + ((i % 8) - 4) * 18; q.agent.y = P.y + (Math.floor(i / 8) - 2) * 18; q.activity = { act: 'stroll' }; q._scene = false; q.errand = null; });
    if (n === 'quarrel') { const [a, b] = pool.filter((q) => q.age >= 18); a.rel.set(b.id, { affinity: -0.5, familiar: 0.5 }); }
    if (n === 'courting') { const a = pool.find((q) => q.age >= 16 && q.age <= 35 && !q.spouse), b = pool.find((q) => q !== a && q.sex !== a?.sex && !q.spouse && Math.abs(q.age - (a?.age || 0)) < 8); if (a && b) a.rel.set(b.id, { affinity: 0.6, familiar: 0.6 }); }
    if (n === 'makeup') { const [a, b] = pool.filter((q) => q.age >= 18); (a.memories = a.memories || []).push({ text: `${b.name} beat me in a fight in the street.`, about: b.id, day: s.day }); a.rel.set(b.id, { affinity: -0.3, familiar: 0.5 }); }
    if (n === 'gift') { const [a, b] = pool.filter((q) => q.age >= 12); a.rel.set(b.id, { affinity: 0.6, familiar: 0.6 }); const hh = s.household(a); if (hh) hh.pantry.cheese = 2; }
    if (n === 'visit') { const sick = s.people.find((q) => q.home != null && q.age > 30 && !pool.includes(q)); sick.health.illness = { kind: 'fever', sev: 0.4, since: s.day }; pool.forEach((q) => q.rel.set(sick.id, { affinity: 0.3, familiar: 0.5 })); }
    if (n === 'well') { const w = s.world.props.find((x) => x.kind === 'well'); if (w) { P.x = w.x; P.y = w.y + 30; } }
    _said.length = 0; return O.Scenes.run(n); }, name);
  await p.waitForTimeout(r ? 9000 : 300);
  console.log(name.padEnd(9), r ? 'ran' : 'NO CAST', '|', (await p.evaluate(() => _said.slice(0, 3).join(' / '))).slice(0, 220));
}
await done();
