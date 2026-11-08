import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; s.weather.snowCover = 0.8; Object.defineProperty(s, 'season', { value: 'winter', configurable: true }); const P = O.game.player; for (const q of s.people.filter((q) => q.age >= 6 && q.age <= 12 && q.agent).slice(0, 3)) { const a = q.agent; a.hidden = false; a.inside = null; a.frozen = false; a.path = null; a.x = P.x + 30 + Math.random() * 30; a.y = P.y + 20; q.errand = null; q._bit = null; q._playing = false; } });
let made = 0; for (let i = 0; i < 25 && !made; i++) { await p.waitForTimeout(2000); made = await p.evaluate(() => O.WinterPlay.men.length); }
console.log('snowmen made:', made, '| building now:', await p.evaluate(() => O.WinterPlay.build ? O.WinterPlay.build.stage : '-'));
await p.waitForTimeout(3000); if (D) { await p.evaluate(() => { const m = O.WinterPlay.men[0]; if (m) { O.game.player.x = m.x + 30; O.game.player.y = m.y + 30; } }); await p.waitForTimeout(600); await p.screenshot({ path: `${D}/snowman.png`, clip: { x: 470, y: 300, width: 200, height: 120 } }); }
await p.evaluate(() => { O.SimRef.cur.weather.snowCover = 0; });
await done();
