// Street callers door to door: knife-grinder, ratcatcher with terrier, tinker, pie-woman; householders come out.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
await p.waitForTimeout(1000);
for (const k of ['water', 'faggots', 'grinder', 'rats']) console.log(k, await p.evaluate((k) => O.StreetCallers.start(k), k));
const phases = new Set(); let clients = 0;
for (let i = 0; i < 12; i++) { await p.waitForTimeout(6000); const r = await p.evaluate(() => O.StreetCallers.callers.map((c) => c.kind + ':' + c.phase + (c.client ? '+client' : ''))); r.forEach((x) => { phases.add(x.replace('+client', '')); if (x.includes('+client')) clients++; }); if (i === 5 && process.env.SD) { await p.evaluate(() => { const c = O.StreetCallers.callers.find((c) => c.phase === 'work') || O.StreetCallers.callers[0]; if (c) { O.game.player.x = c.q.agent.x + 40; O.game.player.y = c.q.agent.y + 30; } }); await p.waitForTimeout(700); await p.screenshot({ path: process.env.SD + '/callers.png', clip: { x: 380, y: 220, width: 380, height: 220 } }); } }
console.log('seen:', [...phases].sort().join(' '), '| client visits', clients);
console.log('earned:', await p.evaluate(() => O.StreetCallers.callers.map((c) => c.kind + ' ' + c.earned).join(', ')), '| stray clients', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._call === 'client' && q.agent.frozen && !O.StreetCallers.callers.some((c) => c.client === q)).length));
// you call the grinder over for your sword
const g = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); O.StreetCallers.start('grinder'); return true; });
await p.waitForTimeout(2500);
const gr = await p.evaluate(() => { const PS = O.PlayerState; PS.items = PS.items || []; if (!PS.items.includes('sword')) PS.items.push('sword'); PS.equipped = 'sword'; PS.money = Math.max(5, PS.money || 0); const C = O.StreetCallers.callers.find((c) => c.kind === 'grinder'); if (!C) return 'no grinder'; const P = O.game.player; P.x = C.q.agent.x + 14; P.y = C.q.agent.y; const c = O.moreCandidates.map((f) => f()).find((x) => x && /ground on the wheel/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label + ' -> keen ' + JSON.stringify(PS.keen); });
console.log('you:', gr);
await done();
