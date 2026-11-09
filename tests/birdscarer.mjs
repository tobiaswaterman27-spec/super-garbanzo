// A child set to scare the crows off the sown field.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'spring', configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 10 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
// stand by a field with a scarecrow
const ok = await p.evaluate(() => { const P = O.game.player, h = [P.x, P.y]; for (let i = 0; i < 49; i++) { P.x = h[0] + ((i % 7) - 3) * 420; P.y = h[1] + (Math.floor(i / 7) - 3) * 300; const F = O.Countryside.features(); if (F && F.scare.length) { P.x = F.scare[0].x + 60; P.y = F.scare[0].y + 60; return true; } } return false; });
console.log('field found:', ok);
await p.evaluate(() => O.BirdScarer.soon());
let who = null; for (let i = 0; i < 20 && !who; i++) { await p.waitForTimeout(3000); who = await p.evaluate(() => O.BirdScarer.job ? O.BirdScarer.job.q.first : null); if (!who) await p.evaluate(() => O.BirdScarer.soon()); }
console.log('bird-scarer:', who);
await p.waitForTimeout(20000);
console.log('crows scared up:', await p.evaluate(() => O.BirdScarer.scares));
await done();
