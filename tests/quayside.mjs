// The fishers' landing: nets drying, a net mended, the catch gutted with gulls swooping for scraps.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
let at = await p.evaluate(() => O.Quayside.where());
if (!at) { await p.evaluate(() => O.teleport('aurelia')); await p.waitForTimeout(3000); at = await p.evaluate(() => O.Quayside.where()); }
console.log('fishery at', at);
await p.evaluate(([x, y]) => { O.game.player.x = x + 40; O.game.player.y = y + 70; }, at);
await p.waitForTimeout(1000);
for (const k of ['gut', 'mend']) console.log(k, await p.evaluate((k) => O.Quayside.start(k), k));
await p.waitForTimeout(25000);
console.log('at it:', await p.evaluate(() => O.Quayside.jobs.map((j) => j.kind + ' ' + j.q.agent.forceAnim + (j.gutted ? ' gutted ' + j.gutted : '')).join(' | ')), '| gulls', await p.evaluate(() => O.Quayside.gulls.length + ' (' + O.Quayside.gulls.filter((g) => g.st === 'dive').length + ' diving)'));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/quay.png', clip: { x: 380, y: 200, width: 400, height: 260 } });
await done();
