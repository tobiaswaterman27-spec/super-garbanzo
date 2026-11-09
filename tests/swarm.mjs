// A hive swarms into a tree; folk tang pans, the beekeeper takes it into a skep and carries it home.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const ok = await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'summer', configurable: true }); let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; if (s.weather) { s.weather.raining = false; s.weather.kind = 'clear'; }
  const sk = (s.world.props || []).find((p) => p.kind === 'skep' && (s.world.trees || []).some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 220 && Math.hypot(t.x - p.x, t.y - p.y) > 30)); if (!sk) return 'no skep';
  O.game.player.x = sk.x + 20; O.game.player.y = sk.y + 30; O.Swarm.soon(); return true; });
console.log('skep:', ok);
await p.waitForTimeout(2500);
console.log('swarm:', await p.evaluate(() => { const S = O.Swarm.swarm; return S ? S.phase + ' keeper ' + !!S.keeper : 'none'; }));
let seen = new Set();
for (let i = 0; i < 70; i++) { await p.waitForTimeout(1000); const r = await p.evaluate(() => { const S = O.Swarm.swarm; return S ? S.phase + '/' + S.tang.length : 'done'; }); seen.add(r); if (i % 5 === 0) console.log(i, r, await p.evaluate(() => { const S = O.Swarm.swarm; return S && S.keeper ? [S.tt, S.keeper.agent.frozen, S.keeper.errand ? 'err' : '', Math.round(S.keeper.agent.x - S.tx), Math.round(S.keeper.agent.y - S.ty)].join(',') : ''; })); if (i === 14 && process.env.SD) await p.screenshot({ path: process.env.SD + '/swarm.png', clip: { x: 360, y: 200, width: 480, height: 300 } }); if (r === 'done') break; }
console.log('phases:', [...seen].join(' '), '| taken:', await p.evaluate(() => O.Swarm.taken));
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._swarm).length));
await done();
