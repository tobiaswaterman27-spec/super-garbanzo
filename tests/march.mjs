import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { O.PlayerState.money = 20; window._done = false; O.marchEvents('crown', () => { window._done = true; }); });
await p.waitForTimeout(500);
for (const ans of ['Aye, deal me in.', "No, I won't take a poor family's pig.", "I'll carry you, lean on me.", 'I stay awake and walk the lines.', 'No, I stay with the host.']) {
  console.log('Q:', (await p.evaluate(() => document.querySelector('.dlg-text')?.textContent || '')).slice(0, 110));
  await p.evaluate(() => document.querySelector('.dlg-say input')?.focus()); await p.keyboard.type(ans, { delay: 3 }); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  console.log('A:', (await p.evaluate(() => document.querySelector('.dlg-text')?.textContent || '')).slice(0, 110));
  await p.evaluate(() => O.UI.dialog.close()); await p.waitForTimeout(500);
}
console.log(await p.evaluate(() => 'march done ' + _done + ' money ' + O.PlayerState.money + ' deserter ' + !!O.PlayerState.deserter));
await done();
