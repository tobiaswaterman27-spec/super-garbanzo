import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
await p.waitForTimeout(800);
for (const kind of ['football', 'skipping', 'hopscotch', 'hoop', 'tag', 'leapfrog', 'hideseek']) {
  const r = await p.evaluate((kind) => { const s = O.SimRef.cur, P = O.game.player; for (const g of O.KidsPlay.games.slice()) { g.over = true; } // bring some children over
    const kids = s.people.filter((q) => q.age >= 5 && q.age <= 12 && q.agent && q.alive !== false).slice(0, 6); kids.forEach((q, i) => { q.agent.hidden = false; q.agent.inside = null; q.agent.x = P.x + 30 + i * 8; q.agent.y = P.y + 10; q.activity = { act: 'play' }; q.errand = null; q._scene = false; q._playing = false; q.agent.frozen = false; });
    _said.length = 0; return O.KidsPlay.start(kind) ? 'started' : 'NO'; }, kind);
  await p.waitForTimeout(r === 'started' ? 600 : 100);
  await p.waitForTimeout(kind === 'hideseek' ? 12000 : 4000);
  const st = await p.evaluate(() => { const g = O.KidsPlay.games[O.KidsPlay.games.length - 1]; if (!g) return 'ended'; const moved = g.kids.map((q) => `${Math.round(q.agent.x - g.cx)},${Math.round(q.agent.y - g.cy)}${q.agent.lift > 0.5 ? '^' : ''}${q.agent.hidden ? 'H' : ''}`).join(' '); return `${g.kids.length} kids [${moved}]${g.ball ? ' ball ' + Math.round(g.ball.x - g.cx) + ',' + Math.round(g.ball.y - g.cy) : ''}`; });
  if (D) { await p.evaluate(() => { const g = O.KidsPlay.games[O.KidsPlay.games.length - 1]; if (g) { O.game.player.x = g.cx; O.game.player.y = g.cy + 70; } }); await p.waitForTimeout(400); await p.screenshot({ path: `${D}/kids-${kind}.png`, clip: { x: 400, y: 220, width: 400, height: 260 } }); }
  console.log(kind.padEnd(10), r, '|', st, '|', (await p.evaluate(() => _said.slice(0, 3).join(' / '))).slice(0, 120));
}
await done();
