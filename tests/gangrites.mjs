import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 20) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
for (const kind of ['jump', 'pay']) {
  const r = await p.evaluate((kind) => { const s = O.SimRef.cur, P = O.game.player; const g = s.npcGangs().find((g) => g.members.length >= 3); if (!g) return 'no gang'; const ms = g.members.map((m) => s.byId.get(m.id)).filter((q) => q && q.agent && q.alive !== false).slice(0, 5);
    ms.forEach((q, i) => { const a = q.agent; a.hidden = false; a.inside = null; a.frozen = false; a.path = null; a.x = P.x + 30 + (i % 3) * 12; a.y = P.y + 20 + Math.floor(i / 3) * 10; q.errand = null; q.jailUntil = 0; q._bit = null; });
    if (kind === 'jump') { const m = g.members.find((x) => x.id === ms[1].id); m.joined = s.day; m.jumped = false; } else { g.purse = 200; g.recentJobs = 1; for (const m of g.members) m.jumped = true; }
    const rt = O.GangRites.start(kind === 'pay' ? 'pay' : undefined); return rt ? rt.kind + ' ' + g.name : 'NO'; }, kind);
  console.log(kind, '->', r);
  for (let i = 0; i < 12 && await p.evaluate(() => !!O.GangRites.rite); i++) await p.waitForTimeout(2000);
  console.log('  ended', await p.evaluate(() => !O.GangRites.rite), '| held', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._rite).length), '|', (await p.evaluate(() => _said.slice(-4).join(' / '))).slice(0, 200));
}
await done();
