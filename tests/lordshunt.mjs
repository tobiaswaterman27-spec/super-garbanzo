import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 15) s.tick(2); O.game.clock.minute = s.minute; });
const r = await p.evaluate(() => { const h = O.LordsHunt.start(true); if (!h) return 'NO'; O.game.player.x = h.lead[0] + 20; O.game.player.y = h.lead[1] + 40; return `riding home, path ${h.path.length}, lord ${h.lordQ ? h.lordQ.first : 'a gentleman'}`; });
console.log(r);
await p.waitForTimeout(5000); if (D) { await p.evaluate(() => { const h = O.LordsHunt.hunt; if (h) { O.game.player.x = h.lead[0]; O.game.player.y = h.lead[1] + 50; } }); await p.waitForTimeout(500); await p.screenshot({ path: `${D}/hunt.png`, clip: { x: 420, y: 260, width: 360, height: 220 } }); }
for (let i = 0; i < 40 && await p.evaluate(() => !!O.LordsHunt.hunt); i++) await p.waitForTimeout(2000);
console.log('hunt home:', await p.evaluate(() => !O.LordsHunt.hunt));
await done();
