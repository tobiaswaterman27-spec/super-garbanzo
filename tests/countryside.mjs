import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
const r = await p.evaluate(() => { const w = O.game.world, P = O.game.player; for (let y = 2; y < w.H - 2; y += 4) for (let x = 2; x < w.W - 2; x += 4) { if (w.ter[y * w.W + x] === w.TER.FIELD && Math.hypot(x * 16 - P.x, y * 16 - P.y) < 2500) { P.x = x * 16; P.y = y * 16 + 40; const F = O.Countryside.features(); return `scarecrows ${F.scare.length} crows ${F.crows.length} hay ${F.hay.length} crosses ${F.cross.length}`; } } return 'no field'; });
console.log(r);
await p.waitForTimeout(1500); if (D) await p.screenshot({ path: `${D}/country.png` });
await p.keyboard.down('ArrowUp'); await p.waitForTimeout(1500); await p.keyboard.up('ArrowUp');
console.log('crows up:', await p.evaluate(() => O.Countryside.features().crows.filter((c) => c.st === 'fly').length));
await done();
