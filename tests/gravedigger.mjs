import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 13) s.tick(2); O.game.clock.minute = s.minute; s.events = s.events || []; s.events.push({ kind: 'funeral', day: s.day + 1, who: 1, name: 'Old Tom' }); const at = O.GraveDigger.spotFor(); if (at) { O.game.player.x = at[0] * 16; O.game.player.y = at[1] * 16 + 50; } });
let g = 0; for (let i = 0; i < 20 && !g; i++) { await p.waitForTimeout(2000); g = await p.evaluate(() => O.GraveDigger.graves.length); }
console.log('grave being dug:', g, 'digger', await p.evaluate(() => O.GraveDigger.graves[0] && O.GraveDigger.graves[0].digger ? O.GraveDigger.graves[0].digger.first : '-'));
await p.waitForTimeout(8000); if (D) await p.screenshot({ path: `${D}/grave.png`, clip: { x: 500, y: 300, width: 200, height: 140 } });
console.log('depth', await p.evaluate(() => O.GraveDigger.graves[0] ? O.GraveDigger.graves[0].depth.toFixed(2) : '-'));
await done();
