// A hand with the house: foot the ladder (or take up a brush); and a ladder nobody holds can skid.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.weekday !== 6 && s.minute / 60 >= 10) && g++ < 8000) s.tick(2); O.game.clock.minute = s.minute; s.raining = false; if (s.weather) { s.weather.kind = 'clear'; s.weather.forced = 'clear'; } const b = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null)[5]; O.game.player.x = b.doorX * 16; O.game.player.y = (b.doorY + 4) * 16; });
const waitJob = async () => { for (let i = 0; i < 120 && !(await p.evaluate(() => !!(O.Repairs.job && O.Repairs.job.t > 3 && O.Repairs.job.t < 15))); i++) await p.waitForTimeout(1000); return p.evaluate(() => O.Repairs.job && O.Repairs.job.kind + ' by ' + O.Repairs.job.q.first); };
console.log('job 1:', await waitJob());
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const j = O.Repairs.job; if (!j) return 'none'; const P = O.game.player; P.x = j.x0 - 6; P.y = j.y0 + 2; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Foot |^Take up a brush/.test(x.label)); if (!c) return 'no prompt (npc helper ' + !!(O.RepairHelp.help && O.RepairHelp.help.npc) + ')'; c.act(); return c.label; });
console.log('you:', r);
await p.waitForTimeout(11000); await p.evaluate(() => { const j = O.Repairs.job; if (j) j.t = Math.max(j.t, j.kind === 'roof' ? 56 : 40); });
for (let i = 0; i < 40 && (await p.evaluate(() => !!O.Repairs.job)); i++) await p.waitForTimeout(1000);

console.log('helps/npcHelps:', await p.evaluate(() => [O.RepairHelp.helps, O.RepairHelp.npcHelps].join('/')));
// the slip
let fell = false;
for (let k = 0; k < 4 && !fell; k++) { await p.evaluate(() => O.RepairHelp.slip()); await waitJob(); for (let i = 0; i < 60 && !(await p.evaluate(() => !!O.RepairHelp.fall)) && (await p.evaluate(() => !!O.Repairs.job)); i++) await p.waitForTimeout(1000); fell = await p.evaluate(() => !!O.RepairHelp.fall); }
console.log('fell:', fell);
const h = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); if (O.npcUI.talking()) O.npcUI.closeTalk(); const F = O.RepairHelp.fall; if (!F) return 'none'; if (F.up) return 'already up: ' + F.up; const P = O.game.player; P.x = F.q.agent.x + 10; P.y = F.q.agent.y + 2; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Help .* up$/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('help up:', h);
await p.waitForTimeout(7000);
console.log('falls/pickedUp:', await p.evaluate(() => [O.RepairHelp.falls, O.RepairHelp.pickedUp].join('/')), 'held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._ladder).length));
await done();
