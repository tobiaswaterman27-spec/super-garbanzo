// Partners for the dance: couples go round at the tavern dance; you ask someone (with a bow, or in words).
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 20 && g++ < 9000) s.tick(1); O.game.clock.minute = s.minute; (s.npcEvents = s.npcEvents || []).push({ id: 99999, kind: 'dance', title: 'Dancing at the tavern', b: s.tavernId, day: s.day, from: 0, to: 23.9, open: true, party: true, small: true }); O.game.enterBuilding(s.building(s.tavernId), 0); });
await p.waitForTimeout(25000);
console.log('in scene:', await p.evaluate(() => !!O.game.scene && O.game.scene.actors.size), 'pairs now:', await p.evaluate(() => O.TavernDance.pairs.length), 'dances done:', await p.evaluate(() => O.TavernDance.npcDances));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/dance.png' });
// ask by speech
const sp = await p.evaluate(async () => { const acts = [...O.game.scene.actors.values()].filter((a) => a.person && a.person.age >= 16 && a.person.age < 60 && !a.person.spouse && !a.hidden && !O.TavernDance.pairs.some((x) => x.a === a || x.b === a)); const a = acts[0]; if (!a) return 'nobody'; const q = a.person; const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; r.affinity = 0.9; r.familiar = 0.5; q.rel.set(0, r); const P = O.game.player; P.x = a.x + 14; P.y = a.y; O.npcUI.openTalk(q); let heard = ''; await O.AIChat.say(q, 'Will you dance with me?', (l) => { heard = l; }); return q.first + ': ' + heard; });
console.log('asked:', sp);
await p.waitForTimeout(3000);
console.log('dancing with you:', await p.evaluate(() => !!O.TavernDance.you), 'player anim:', await p.evaluate(() => O.game.player.anim));
await p.waitForTimeout(34000);
console.log('your dances:', await p.evaluate(() => O.TavernDance.yourDances), 'you now:', await p.evaluate(() => !!O.TavernDance.you), 'npc dances:', await p.evaluate(() => O.TavernDance.npcDances));
// someone asks you
await p.evaluate(() => { const acts = [...O.game.scene.actors.values()].filter((a) => a.person && a.person.age >= 16 && a.person.age < 60 && !a.hidden && !a.seat); const P = O.game.player; for (const a of acts) { a.person.rel.set(0, { affinity: 0.8, familiar: 0.6 }); } if (acts[0]) { P.x = acts[0].x + 30; P.y = acts[0].y; } O.TavernDance.inviteSoon(); });
for (let i = 0; i < 20 && !(await p.evaluate(() => !!O.TavernDance.invite)); i++) { await p.evaluate(() => O.TavernDance.inviteSoon()); await p.waitForTimeout(700); }
const inv = await p.evaluate(() => { const I = O.TavernDance.invite; if (!I) return 'no invite'; const c = O.moreCandidates.map((f) => f()).find((x) => x && /hand and dance/.test(x.label)); if (!c) return 'no prompt'; c.act(); return c.label; });
console.log('invited:', inv, 'dancing:', await p.evaluate(() => !!O.TavernDance.you));
await done();
