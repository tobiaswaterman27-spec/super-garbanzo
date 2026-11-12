// Lessons on the doorstep: an elder teaches the children; you sit in and learn a little.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 10 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; });
let ok = null;
for (let i = 0; i < 12 && !ok; i++) { ok = await p.evaluate(() => { const s = O.SimRef.cur; const hs = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null); const b = hs[Math.floor(Math.random() * hs.length)]; O.game.player.x = b.doorX * 16; O.game.player.y = (b.doorY + 5) * 16; return O.Lessons.begin() ? O.Lessons.lesson.kn + ' by ' + O.Lessons.lesson.t.first + ' for ' + O.Lessons.lesson.kids.map((k) => k.first).join(', ') : null; }); if (!ok) await p.waitForTimeout(300); }
console.log('lesson:', ok);
for (let i = 0; i < 40 && !(await p.evaluate(() => O.Lessons.lesson && O.Lessons.lesson.started)); i++) await p.waitForTimeout(1000);
console.log('started:', await p.evaluate(() => !!(O.Lessons.lesson && O.Lessons.lesson.started)));
const r = await p.evaluate(() => { if (O.UI.dialogOpen && O.UI.dialogOpen()) O.UI.dialog.close(); const L = O.Lessons.lesson; if (!L) return 'none'; const P = O.game.player; P.x = L.x + 20; P.y = L.y + 18; const c = O.moreCandidates.map((f) => f()).find((x) => x && /^Sit in on/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('you:', r);
if (process.env.SD) { await p.waitForTimeout(4000); await p.screenshot({ path: process.env.SD + '/lesson.png' }); }
await p.waitForTimeout(16000);
console.log('sat:', await p.evaluate(() => O.Lessons.sat), 'skills:', await p.evaluate(() => JSON.stringify(O.PlayerState.skills && Object.fromEntries(Object.entries(O.PlayerState.skills).filter(([k]) => /fighting|letters|stealth|crafting/.test(k)).map(([k, v]) => [k, +(+v).toFixed(2)])))));
for (let i = 0; i < 70 && (await p.evaluate(() => !!O.Lessons.lesson)); i++) await p.waitForTimeout(1000);
console.log('held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._lesson && !q.errand).length));
// you teach a lad stick-fighting, in words
const t = await p.evaluate(async () => { const s = O.SimRef.cur; O.PlayerState.skills = O.PlayerState.skills || {}; O.PlayerState.skills.fighting = 0.5; const k = s.people.find((q) => q.sex === 'm' && q.age >= 8 && q.age <= 14 && q.agent && q.agent.inside == null && !q.agent.hidden && !q.agent.frozen && !q.errand && !q._lesson); if (!k) return 'no lad'; O.game.player.x = k.agent.x + 20; O.game.player.y = k.agent.y; O.npcUI.openTalk(k); let heard = ''; await O.AIChat.say(k, 'I will teach you to fight with a stick.', (l) => { heard = l; }); return k.first + ': ' + heard; });
console.log('teach:', t);
await p.waitForTimeout(3000); console.log('lesson on:', await p.evaluate(() => !!O.Lessons.yourLesson && O.Lessons.yourLesson.kn));
await p.waitForTimeout(26000);
console.log('taught:', await p.evaluate(() => O.Lessons.taught), 'held:', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._lesson && !q.errand && !(O.Lessons.lesson)).length));
await done();
