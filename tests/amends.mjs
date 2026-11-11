// Making amends: good turns and alms wear down a bad name.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { O.PlayerState.rep.criminal = 0.5; });
await p.waitForTimeout(1200);
for (let i = 0; i < 6; i++) { await p.evaluate(() => { O.PlayerState.almsToPoor = (O.PlayerState.almsToPoor || 0) + 2; }); await p.waitForTimeout(700); }
console.log('criminal name: 0.5 ->', await p.evaluate(() => O.PlayerState.rep.criminal.toFixed(2)), '| deeds:', await p.evaluate(() => O.Amends.deeds));
await done();
