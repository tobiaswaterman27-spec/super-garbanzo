// The building site: builders dig, barrow, saw, hod and hammer on the scaffold by stage; stacks of timber and stone.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
console.log(await p.evaluate(() => { const s = O.SimRef.cur; s.treasury.cash += 1000; const free = [0, 1, 2, 3, 4].filter((i) => !s.build.used.has(i) && s.build.plotFree(s.build.plot(i))); if (!free.length) return 'no plot'; s.build.start(free[free.length > 2 ? 2 : 0], 160); const site = s.build.sites[s.build.sites.length - 1]; const bz = s.biz.get(site.id); bz.stock.logs = 12; bz.stock.stone = 10; return 'site with ' + bz.workers.length + ' builders'; }));
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 9 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; const site = s.build.sites[s.build.sites.length - 1]; O.game.player.x = (site.b.x + site.b.w) * 16 + 60; O.game.player.y = (site.b.bottom + 2) * 16; });
for (const st of [1, 4, 7]) {
  await p.evaluate((st) => { const s = O.SimRef.cur, site = s.build.sites[s.build.sites.length - 1]; site.stage = st; site.b.dirty = true; }, st);
  await p.waitForTimeout(5000);
  console.log('stage', st, await p.evaluate(() => [...O.SiteWork.held].map((q) => q.first + ':' + q._siteRole + (q.agent.lift ? '^' + q.agent.lift : '')).join(' ')));
  if (process.env.SD) await p.screenshot({ path: `${process.env.SD}/site-${st}.png` });
}
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 19 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(1500);
console.log('after hours held', await p.evaluate(() => O.SiteWork.held.size + ' lifted ' + O.SimRef.cur.people.filter((q) => q.agent && q.agent.lift).map((q) => q.first + (q._repair ? ' repair' : '') + (q._tree ? ' tree' : '') + (q._siteRole ? ' site' : '')).join(',')));
await done();
