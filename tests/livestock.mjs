// The beast market: pens of sheep and pigs, the drover crying, buyers haggling and leading a beast home.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; let g = 0; while (!(s.weekday === 6 && s.minute >= 7 * 60 + 10) && g++ < 8000) s.tick(2); O.game.clock.minute = s.minute; s.raining = false; });
await p.waitForTimeout(1500);
console.log('pens:', await p.evaluate(() => { const M = O.Livestock.M; if (!M) return 'none'; O.game.player.x = M.at.tx * 16 + 60; O.game.player.y = M.at.ty * 16 + 90; return M.pens.map((p) => p.beasts.length + ' ' + p.kind).join(', '); }));
let saw = new Set();
for (let i = 0; i < 26; i++) { await p.waitForTimeout(5000); const r = await p.evaluate(() => { const M = O.Livestock.M; return M ? { dr: M.drover && M.droverIn, deal: M.deal ? (M.deal.at ? 'haggle' : 'coming') : null, deals: M.deals, led: O.Livestock.led.length } : null; }); if (r) { if (r.dr) saw.add('drover'); if (r.deal) saw.add(r.deal); if (r.led) saw.add('led'); saw.add('deals' + r.deals); } if (i === 7 && process.env.SD) await p.screenshot({ path: process.env.SD + '/beasts.png', clip: { x: 360, y: 200, width: 440, height: 260 } }); }
console.log('seen:', [...saw].join(' '));
await done();
