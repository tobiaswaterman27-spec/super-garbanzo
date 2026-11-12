// The bell on the door: walk into an open shop with nobody in, and a worker comes hurrying in to serve you.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.weekday !== 6 && s.minute / 60 >= 11)) { s.tick(1); if (g++ > 9000) break; } O.game.clock.minute = s.minute; });
const r = await p.evaluate(async () => { const s = O.SimRef.cur; const out = [];
  for (const bz of s.biz.values()) { const b = s.building(bz.b?.id ?? bz.id); if (!b || b.doorX == null || !bz.open || /house|barn|chapel|guard|farmhouse/.test(b.type)) continue; const ws = bz.workers.map((id) => s.byId.get(id)).filter(Boolean); if (!ws.length) continue;
    for (const q of ws) if (q.agent.inside === b.id) { q.agent.inside = null; q.agent.hidden = false; q.agent.x = b.doorX * 16 + 40; q.agent.y = (b.doorY + 3) * 16; }
    O.game.enterBuilding(b, 0); await new Promise((res) => setTimeout(res, 3500)); const sc = O.game.scene; const inside = sc ? [...sc.actors.values()].filter((a) => a.person && bz.workers.includes(a.person.id)).length : -1; out.push(`${b.type}: ${inside} worker(s) in`); O.game.exitBuilding(); await new Promise((res) => setTimeout(res, 600)); if (out.length >= 3) break; }
  return out.join(' | '); });
console.log(r);
console.log('rung/came:', await p.evaluate(() => [O.ShopBell.rung, O.ShopBell.came].join('/')), 'held after leaving:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._shopbell).length));
await done();
