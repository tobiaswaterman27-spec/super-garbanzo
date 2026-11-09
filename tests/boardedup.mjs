// A shop that closes down is boarded up.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const name = await p.evaluate(() => { const s = O.SimRef.cur; const bz = [...s.biz.values()].find((z) => !z.def.public && z.type !== 'site' && z.def.sells && z.def.sells.length && z.type !== 'farmhouse'); const b = s.building(bz.id); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = b.doorY * 16 + 50; s.closeDown(bz); return bz.name; });
await p.waitForTimeout(1500);
console.log('closed:', name, '| boarded up here:', await p.evaluate(() => O.BoardedUp.count()));
if (process.env.SD) await p.screenshot({ path: process.env.SD + '/boarded.png', clip: { x: 460, y: 220, width: 280, height: 200 } });
await done();
