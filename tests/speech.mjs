import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 11 * 60; O.game.clock.minute = 11 * 60; });
await p.waitForTimeout(1500);
console.log(await p.evaluate(async () => { const s = O.SimRef.cur, out = []; O.PlayerState.money = 50;
  const tests = [['priest', 'Father, I wish to confess.'], ['innkeeper', 'Have you a room for the night?'], ['baker', 'Any work going?'], ['physician', "I'm hurt, can you see to me?"]];
  for (const [role, line] of tests) { const q = s.people.find(z => z.job?.role === role); if (!q) { out.push(role + ': none'); continue; } const before = O.npcUI.extraButtons(q).map(x => x[0]); let reply = ''; await O.AIChat.say(q, line, (l) => { reply = l; }); out.push(role + ' buttons[' + before.join(',') + '] -> ' + (reply || (document.querySelector('.ledger h2') || {}).textContent || '(panel)').slice(0, 80)); O.Panels.close && O.Panels.close(); }
  return out.join('\n'); }));
await done();
