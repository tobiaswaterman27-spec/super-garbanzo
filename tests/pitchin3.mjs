// Still more ways to pitch in: a loaf for someone in the bread queue; pennies at a christening; water on a chimney fire.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const act = (re) => p.evaluate((src) => { O.game.player.locked = false; const r = new RegExp(src); const c = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && r.test(x.label)); if (!c) return false; c.act(); return c.label; }, re);
// the bread queue
const fed = await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; s.treasury.cash += 500; const hs = s.households.filter((h) => !h.gone && h.members.length).slice(0, 3); for (const h of hs) { h.money = 0; h.pantry.bread = 0; } s.parishRelief(); const bz = s.supplierOf('bakery'), b = s.building(bz.b?.id ?? bz.id); O.game.player.x = b.doorX * 16 + 20; O.game.player.y = b.doorY * 16 + 70; return O.BreadDole.pending.length ? O.BreadDole.pending[0].fed.length : 0; });
await p.evaluate(() => { O.PlayerState.items.push('bread'); O.PlayerState.money = Math.max(O.PlayerState.money || 0, 20); });
let lf = false; for (let i = 0; i < 30 && !lf; i++) { await p.waitForTimeout(1000); await p.evaluate(() => { const D = O.BreadDole.dole; const q = D && D.queue.find((x) => x.agent.frozen); if (q) { O.game.player.x = q.agent.x + 8; O.game.player.y = q.agent.y + 4; } }); await p.waitForTimeout(100); lf = await act('loaf of your own'); }
console.log('loaf:', lf, '| given:', await p.evaluate(() => O.BreadDole.given));
// a christening
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 12.3 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const mum = s.people.find((q) => q.sex === 'f' && q.age >= 20 && q.age < 40 && s.household(q) && s.household(q).members.length >= 3 && q.agent && !q.agent.frozen && !q.errand); s.npcEvents = s.npcEvents || []; s.npcEvents.push({ kind: 'christening', title: 'test', b: s.chapelId, day: s.day, from: 11, to: s.minute / 60 + 0.02, host: mum.id, open: false }); const b = s.building(s.chapelId); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 4) * 16; });
let ch = false; for (let i = 0; i < 20 && !ch; i++) { await p.waitForTimeout(1000); await p.evaluate(() => { const X = O.Christening.scene; if (X) { O.game.player.x = X.x + 10; O.game.player.y = X.y + 20; } }); await p.waitForTimeout(100); ch = await act('pennies for the children'); }
console.log('pennies:', ch);
// a chimney fire
let cf = false; for (let i = 0; i < 8 && !(await p.evaluate(() => O.ChimneyFire.fire)); i++) { await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'winter', configurable: true }); let g = 0; while (s.minute / 60 < 18 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; const hs = s.world.buildings.filter((b) => b.type === 'house' && b.sprite && b.sprite.chimney && b.doorX != null); const b = hs[Math.floor(Math.random() * hs.length)]; O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 6) * 16; O.ChimneyFire.soon(); }); await p.waitForTimeout(1200); }
await p.evaluate(() => { const C = O.ChimneyFire.fire; if (C) { O.game.player.x = C.b.doorX * 16 + 8; O.game.player.y = (C.b.doorY + 2) * 16 + 6; } }); await p.waitForTimeout(100);
cf = await act('bucket and throw water');
console.log('bucket:', cf);
await done();
