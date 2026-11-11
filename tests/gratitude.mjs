// Remembered kindness: someone you helped greets you in the street (once a day); a witness nods.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (s.minute / 60 < 11 && g++ < 5000) s.tick(1); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const s = O.SimRef.cur; const out = s.people.filter((q) => q.age >= 18 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand); const a = out[0], b = out[1]; s.remember(a, 'A stranger found my little one when they were lost, and brought them home to me.', 'kindness', 0.8); b.beliefs = b.beliefs || []; b.beliefs.unshift({ t: 'The stranger grabbed the loose bull by its nose-ring rope today, bold as you like.', src: 'seen', day: s.day }); window.__ab = [a, b]; return [a.first, b.first]; });
for (const i of [0, 1, 0]) { await p.evaluate((i) => { const q = window.__ab[i]; q.agent.frozen = false; O.game.player.x = q.agent.x + 10; O.game.player.y = q.agent.y + 6; }, i); await p.waitForTimeout(1600); }
// gifts: several helped folk greeted in turn; some press a gift on you
const gifts = await p.evaluate(async () => { const s = O.SimRef.cur; const out = s.people.filter((q) => q.age >= 18 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !window.__ab.includes(q)).slice(0, 10); for (const q of out) s.remember(q, 'When my chimney caught fire, a stranger ran up with a bucket and helped put it out.', 'kindness', 0.7); window.__many = out; return out.length; });
for (let i = 0; i < 10; i++) { await p.evaluate((i) => { const q = window.__many[i]; if (!q) return; q.agent.frozen = false; O.game.player.x = q.agent.x + 10; O.game.player.y = q.agent.y + 6; }, i); await p.waitForTimeout(900); }
console.log('gifts pressed on you:', await p.evaluate(() => O.Gratitude.gifts));
console.log('people:', r, '| thanks:', await p.evaluate(() => O.Gratitude.thanks), '| nods:', await p.evaluate(() => O.Gratitude.nods));
await done();
