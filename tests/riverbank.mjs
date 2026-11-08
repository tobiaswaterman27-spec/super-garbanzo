// The riverbank: anglers with float and line, washerwomen beating linen, children skimming stones.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => O.teleport('aurelia')); await p.waitForTimeout(3000);
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'summer', configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(1000);
// stand by the water near the middle of the town
const n = await p.evaluate(() => { const s = O.SimRef.cur, w = s.world, P = O.game.player; let best = null, bd = 1e9; for (let y = 2; y < w.H - 2; y += 2) for (let x = 2; x < w.W - 2; x += 2) { if (w.ter[y * w.W + x] !== w.TER.WATER) continue; const d = Math.hypot(x * 16 - P.x, y * 16 - P.y); if (d < bd) { bd = d; best = [x, y]; } } if (best) { P.x = best[0] * 16 + 8; P.y = best[1] * 16 + 40; } return O.Riverbank.banks().length; });
console.log('bank spots', n);
for (const k of ['angle', 'wash', 'skim', 'angle']) console.log(k, await p.evaluate((k) => O.Riverbank.start(k), k));
await p.waitForTimeout(25000);
const st = await p.evaluate(() => O.Riverbank.jobs.map((j) => j.kind + (j.kind === 'angle' ? ':' + j.caught : j.kind === 'wash' ? ':' + j.cloth.length : ':' + (j.best || 0))).join(' '));
console.log('at the water:', st);
if (process.env.SHOT) { await p.evaluate(() => { const j = O.Riverbank.jobs.find((j) => j.kind === 'wash') || O.Riverbank.jobs[0]; if (j) { O.game.player.x = j.x + 30; O.game.player.y = j.y + 30; } }); await p.waitForTimeout(500); await p.screenshot({ path: process.env.SHOT, clip: { x: 400, y: 220, width: 400, height: 260 } }); }
await p.waitForTimeout(80000);
console.log('later:', await p.evaluate(() => O.Riverbank.jobs.length + ' jobs; held ' + O.SimRef.cur.people.filter((q) => q._bank).length + '; frozen stray ' + O.SimRef.cur.people.filter((q) => q.agent && q.agent.frozen && q._bank && !O.Riverbank.jobs.some((j) => j.q === q)).length));
await done();
