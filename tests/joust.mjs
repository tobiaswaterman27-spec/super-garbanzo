// The tournament ride run on the real lists: you in the saddle, a charge for each pass, the crack, the fall.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const id = await p.evaluate(() => { const K = O.SimRef.home.kingdom; const pl = K.places.find((x) => x.kind === 'capital') || K.places.find((x) => x.kind === 'castle'); O.teleport(pl.id); return pl.id; });
await p.waitForTimeout(6000);
const r = await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; s.hosted = { day: s.day, kind: 'tournament' }; return s.world.name + ' keep ' + !!s.world.buildings.find((b) => b.royal || b.type === 'keep') + ' lists ' + JSON.stringify(O.listsCentre(s)); });
console.log(id, r);
await p.waitForTimeout(1500);
const go = await p.evaluate(() => { const s = O.SimRef.cur, [cx, cy] = O.listsCentre(s), P = O.game.player; P.x = cx; P.y = cy + 40; O.PlayerState.money = 50; if (!O.PlayerState.items.includes('sword')) O.PlayerState.items.push('sword'); const H = O.Horses && O.Horses.horses; if (H && H.length && !H.some((h) => h.owner === 'player')) H[0].owner = 'player';
  const c = O.moreCandidates ? null : null; const st = O.stallCandidate && O.stallCandidate(); if (!st || !/tournament/.test(st.label)) return 'no prompt: ' + (st && st.label); st.act(); const b = document.querySelector('[data-ride]'); if (!b) return 'no ride button'; b.click(); return 'riding'; });
console.log('go:', go);
await p.waitForTimeout(9000);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/joust.png' });
console.log('bout:', await p.evaluate(() => { const B = O.Festivals.bout; return B ? 'passes ' + B.res.lines.length + ' mine ' + B.mine + ' player hidden ' + O.game.player.hidden : 'none'; }));
for (let i = 0; i < 60 && (await p.evaluate(() => !!O.Festivals.bout)); i++) await p.waitForTimeout(500);
console.log('after: hidden', await p.evaluate(() => !!O.game.player.hidden), 'locked', await p.evaluate(() => O.game.player.locked));
await done();
