// The sheepdog works the flock: wide arcs round the sheep, which shy and bunch; commands whistled; home to heel.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; if (s.weather) s.weather.raining = false; });
await p.waitForTimeout(1500);
console.log('flock:', await p.evaluate(() => { const s = O.SimRef.cur, sh = (O.fauna || []).filter((f) => f.world === s.world.placeId && f.kind === 'sheep'); if (!sh.length) return 0; O.game.player.x = sh[0].x; O.game.player.y = sh[0].y + 40; O.Sheepdog.soon(); return sh.length; }));
await p.waitForTimeout(1500);
const spread = () => p.evaluate(() => { const D = O.Sheepdog.run; if (!D) return null; const sh = D.sheep, cx = sh.reduce((a, f) => a + f.x, 0) / sh.length, cy = sh.reduce((a, f) => a + f.y, 0) / sh.length; return Math.round(sh.reduce((a, f) => a + Math.hypot(f.x - cx, f.y - cy), 0) / sh.length); });
const s0 = await spread(); let cmds = new Set(), shot = false;
for (let i = 0; i < 55; i++) { await p.waitForTimeout(1000); const c = await p.evaluate(() => O.Sheepdog.run && O.Sheepdog.run.cmd); if (c) cmds.add(c); if (!shot && (c === 'come' || c === 'away') && process.env.SD) { shot = true; await p.screenshot({ path: process.env.SD + '/sheepdog.png', clip: { x: 300, y: 150, width: 600, height: 380 } }); } if (!c && i > 3) break; }
console.log('dog ran:', !!s0 || s0 === 0, '| commands:', [...cmds].join(' '), '| runs done:', await p.evaluate(() => O.Sheepdog.runs));
await done();
