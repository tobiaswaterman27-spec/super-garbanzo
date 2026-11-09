// Fighting the flood: bailing at the doors, sacks heaped along the edge.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const r = await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const F = s.floodInit(); if (!F) return 'no river'; const W = s.weather; W.forced = 'heavy'; W.kind = 'heavy'; W.wet = 0.95; F.level = 2.95; s.floodHourly(); const w = s.world; const ts = [...F.tiles].filter((i) => [1, -1, w.W, -w.W].some((d) => !F.tiles.has(i + d) && !w.solid[i + d])); const hs = w.buildings.filter((b) => b.type === 'house').map((b) => b.bottom * w.W + b.doorX); const i = ts.sort((a, b) => Math.min(...hs.map((h) => Math.abs(h % w.W - a % w.W) + Math.abs(Math.floor(h / w.W) - Math.floor(a / w.W)))) - Math.min(...hs.map((h) => Math.abs(h % w.W - b % w.W) + Math.abs(Math.floor(h / w.W) - Math.floor(b / w.W)))))[0]; O.game.player.x = (i % s.world.W) * 16 + 8; O.game.player.y = Math.floor(i / s.world.W) * 16 + 60; return 'flooded tiles ' + F.tiles.size; });
console.log(r);
await p.waitForTimeout(20000);
console.log('fighting the water:', await p.evaluate(() => O.FloodFolk.jobs.map((j) => j.kind).join(',')), '| buckets thrown:', await p.evaluate(() => O.FloodFolk.bailed), '| sack piles:', await p.evaluate(() => O.FloodFolk.sacks.length));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/flood.png' });
await done();
