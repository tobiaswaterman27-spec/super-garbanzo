// Mourning worn: kin in black (veil or armband), neighbours comfort them, and you can offer condolences.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; const out = s.people.filter((q) => q.age >= 16 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand).slice(0, 6); for (const q of out) q.mourning = { for: 'old Wulfric', until: s.day + 7, kin: true }; window.__m = out; O.game.player.x = out[0].agent.x + 20; O.game.player.y = out[0].agent.y + 10; });
await p.waitForTimeout(8000);
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/mourning.png', clip: { x: 360, y: 200, width: 480, height: 300 } });
let c = false; for (let i = 0; i < 6 && !c; i++) { c = await p.evaluate((i) => { const q = window.__m[i]; if (!q || q.agent.inside != null || q.agent.hidden) return false; O.game.player.x = q.agent.x + 8; O.game.player.y = q.agent.y + 4; O.game.player.locked = false; const k = O.moreCandidates.map((f) => { try { return f(); } catch (e) { return null; } }).find((x) => x && /condolences/.test(x.label)); if (!k) return false; k.act(); return k.label; }, i); }
console.log('neighbours comforting:', await p.evaluate(() => O.MourningDress.comforts), '| your condolences:', c);
await done();
