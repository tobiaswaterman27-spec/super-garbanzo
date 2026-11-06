import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 12 * 60; O.game.clock.minute = 12 * 60; });
await p.waitForTimeout(1500);
console.log(await p.evaluate(() => {
  const s = O.SimRef.cur, D = O.Data, G = D.GOODS, out = [];
  // interiors with little in them
  const thin = []; const types = new Map();
  for (const b of s.world.buildings) { if (b.doorX == null || types.has(b.type)) continue; try { const L = O.Interior.interior(b, 0, s); const furn = L.items.filter((i) => !['stairs', 'roomdoor', 'partH', 'partV', 'portrait'].includes(i.kind)).length; types.set(b.type, furn); } catch (e) { types.set(b.type, 'ERR'); } }
  out.push('INTERIOR PIECES: ' + [...types].sort((a, b) => a[1] - b[1]).map(([t, n]) => t + ' ' + n).join(', '));
  // goods nobody makes or sells
  const made = new Set(), sold = new Set();
  for (const d of Object.values(D.BUSINESS)) { for (const rc of d.recipes || []) for (const g of Object.keys(rc.out)) made.add(g); for (const g of d.sells || []) sold.add(g); }
  for (const r of O.Recipes.all()) for (const g of Object.keys(r[2])) made.add(g);
  const orphan = Object.keys(G).filter((k) => !made.has(k) && !sold.has(k) && !G[k].quest);
  out.push('GOODS NO ONE MAKES OR SELLS (' + orphan.length + '): ' + orphan.slice(0, 60).join(', '));
  // businesses here: who works, what they do
  const biz = [...s.biz.values()].filter((z) => !z.def.public).map((z) => `${z.type}:${z.workers.length}w/${(z.def.recipes || []).length}r`);
  out.push('SHOPS (workers/recipes): ' + biz.join(', '));
  // chores per role (the physical tasks a post gives)
  if (O.choreTasks) { const roles = new Map(); for (const z of s.biz.values()) for (const [r] of z.def.jobs || []) { if (roles.has(r)) continue; try { const n = O.choreTasks(s, z, { role: r, biz: z.id, place: s.world.placeId, level: 1 }).length; roles.set(r, n); } catch (e) { roles.set(r, 'ERR'); } } out.push('TASKS PER ROLE (fewest first): ' + [...roles].sort((a, b) => a[1] - b[1]).slice(0, 30).map(([r, n]) => r + ' ' + n).join(', ')); }
  // what people are doing at noon
  const acts = {}; for (const q of s.people) { const a = q.activity?.act || 'none'; acts[a] = (acts[a] || 0) + 1; } out.push('NOON ACTIVITIES: ' + Object.entries(acts).sort((a, b) => b[1] - a[1]).map(([a, n]) => a + ' ' + n).join(', '));
  // workers 'at work' but not in their workplace
  const away = s.people.filter((q) => q.activity?.act === 'work' && q.job && q.agent.inside !== q.job.biz && !q.agent.hidden).length;
  out.push('AT WORK BUT OUTSIDE THEIR WORKPLACE: ' + away);
  // houses with nobody living there; places you can't enter
  out.push('EMPTY HOUSES: ' + s.world.buildings.filter((b) => b.type === 'house' && !b.household && !(b.households || []).length).length + ' of ' + s.world.buildings.filter((b) => b.type === 'house').length);
  // talk acts the AI may use vs handled
  return out.join('\n\n');
}));
await done();
