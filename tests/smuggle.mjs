import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 1) s.tick(2); O.game.clock.minute = s.minute; });
// find a spot near water: the riverbank tiles of the home town
const r = await p.evaluate(() => { const s = O.SimRef.cur, w = s.world, TR = w.TER; for (let y = 1; y < w.H - 1; y += 3) for (let x = 1; x < w.W - 1; x += 3) { const i = y * w.W + x; if (w.ter[i] === TR.WATER && Math.hypot(x * 16 - O.game.player.x, y * 16 - O.game.player.y) < 900) { O.game.player.x = x * 16 + 120; O.game.player.y = y * 16; const g = s.npcGangs().find((g) => g.members.length >= 3); if (g) for (const m of g.members) { const q = s.byId.get(m.id); if (q) { q.jailUntil = 0; q.errand = null; } } const run = O.Smuggle.start(); if (!run) continue; return `run by ${run.g.name}: ${run.carriers.length} carriers, way ${run.way.length}`; } } return 'NO'; });
console.log(r);
// keep the watch away
await p.evaluate(() => { for (const q of O.SimRef.cur.people) if (/guard|watch|sergeant/.test(q.job?.role || '') && q.agent) { q.agent.inside = O.SimRef.cur.building([...O.SimRef.cur.biz.values()].find((z) => z.type === 'guard')?.b?.id)?.id ?? q.agent.inside; q.agent.hidden = true; } });
await p.waitForTimeout(10000); if (D) await p.screenshot({ path: `${D}/smuggle.png`, clip: { x: 400, y: 250, width: 400, height: 260 } });
console.log(await p.evaluate(() => { const r = O.Smuggle.run; return r ? `casks left ${r.casks} legs ${r.carriers.map((c) => c.leg + c.trips).join(',')}` : 'ended'; }));
const h = await p.evaluate(() => new Promise((res) => { const r = O.Smuggle.run; if (!r) return res('none'); O.AIChat.say(r.look, 'can I help carry?', (l) => res(l)); }));
console.log('help ->', h);
await p.evaluate(() => O.npcUI.closeTalk && O.npcUI.closeTalk());
await p.evaluate(() => { const r = O.Smuggle.run; if (r) O.Smuggle.bust(null); });
await p.waitForTimeout(9000);
console.log('after bust', await p.evaluate(() => (O.Smuggle.run ? 'still' : 'over') + ' dropped ' + O.Smuggle.dropped.length + ' held ' + O.SimRef.cur.people.filter((q) => q._smug).length));
await done();
