// Shrove Tuesday: the camp-ball mob through the streets, goals at the two ends, pancakes at the doors.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 13.5 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; if (s.weather) s.weather.raining = false; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8 + 8; O.game.player.y = (y0 + y1) * 8 + 60; O.Shrovetide.force(); });
await p.waitForTimeout(2000);
console.log('game:', await p.evaluate(() => { const G = O.Shrovetide.game; return G ? G.men.length + ' men, ' + G.cooks.length + ' cooks, goals ' + G.goals.map(Math.round).join('/') : 'none'; }));
let moved = 0, last = null;
for (let i = 0; i < 40; i++) { await p.waitForTimeout(1000); const b = await p.evaluate(() => { const G = O.Shrovetide.game; if (!G) return null; O.game.player.x = G.ball.x; O.game.player.y = G.ball.y + 70; return [Math.round(G.ball.x), Math.round(G.ball.y)]; }); if (b && last) moved += Math.hypot(b[0] - last[0], b[1] - last[1]); last = b; if (i === 12 && process.env.SD) await p.screenshot({ path: process.env.SD + '/shrove.png', clip: { x: 300, y: 150, width: 600, height: 380 } }); }
console.log('ball travelled:', Math.round(moved), '| score:', await p.evaluate(() => O.Shrovetide.game && O.Shrovetide.game.score.join('-')));
const kick = await p.evaluate(() => { const G = O.Shrovetide.game; if (!G) return null; G.pc = 0; G.ball.vx = G.ball.vy = 0; for (const m of G.men) m.cool = 5; const P = O.game.player; P.locked = false; P.x = G.ball.x - 4; P.y = G.ball.y; P.dir = 1; return G.kicks || 0; });
await p.waitForTimeout(300);
console.log('dbg', await p.evaluate(() => { const G = O.Shrovetide.game, P = O.game.player; return G ? [Math.round(P.x - G.ball.x), Math.round(P.y - G.ball.y), P.locked, G.pc, O.game.scene ? 'scene' : ''] : 'nogame'; }));
console.log('player kicked:', await p.evaluate(() => (O.Shrovetide.game && O.Shrovetide.game.kicks) || 0) > (kick || 0));
await p.evaluate(() => O.Shrovetide.stop());
await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._shrove).length));
await done();
