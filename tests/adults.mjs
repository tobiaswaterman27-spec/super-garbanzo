import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 14) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
for (const kind of ['quoits', 'butts', 'bowls', 'wrestling', 'morris', 'skittles']) {
  const r = await p.evaluate((kind) => { const s = O.SimRef.cur, P = O.game.player; for (const g of O.AdultPlay.games) g.over = true;
    const ppl = s.people.filter((q) => q.age >= 18 && q.agent && q.alive !== false && !q.visitor).sort((a, b) => (kind === 'morris' ? b.age - a.age : 0)).slice(0, 10); ppl.forEach((q, i) => { q.agent.hidden = false; q.agent.inside = null; q.agent.x = P.x + 20 + (i % 5) * 10; q.agent.y = P.y + 10 + Math.floor(i / 5) * 10; q.activity = { act: 'stroll' }; q.errand = null; q._scene = false; q._playing = false; q.agent.frozen = false; q.job = q.job && Object.assign({}, q.job, { onShift: false }); });
    _said.length = 0; return O.AdultPlay.start(kind) ? 'started' : 'NO'; }, kind);
  await p.waitForTimeout(r === 'started' ? 9000 : 200);
  if (D && r === 'started') { await p.evaluate(() => { const g = O.AdultPlay.games[O.AdultPlay.games.length - 1]; if (g) { O.game.player.x = g.cx; O.game.player.y = g.cy + 60; } }); await p.waitForTimeout(500); await p.screenshot({ path: `${D}/adult-${kind}.png`, clip: { x: 420, y: 230, width: 360, height: 220 } }); }
  const st = await p.evaluate(() => { const g = O.AdultPlay.games[O.AdultPlay.games.length - 1]; return g ? `${g.ppl.length} playing, ${g.fly.length} in flight, ${(g.stuck || []).length} arrows, ${(g.down || []).length} rings, ${(g.balls || []).length} balls, ${(g.pieces || []).length} pieces` : 'ended'; });
  console.log(kind.padEnd(10), r, '|', st, '|', (await p.evaluate(() => _said.slice(0, 3).join(' / '))).slice(0, 120));
}
console.log(await p.evaluate(async () => { const g = O.AdultPlay.start('quoits') || O.AdultPlay.games[0]; if (!g) return 'no game to join'; let l = ''; await O.AIChat.say(g.ppl[0], 'Can I have a go?', (x) => { l = x; }); await new Promise((r) => setTimeout(r, 2000)); return 'join: ' + l; }));
await done();
