import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 14) s.tick(2); O.game.clock.minute = s.minute; Object.defineProperty(s, 'season', { value: 'summer', configurable: true }); s.raining = false; if (s.weather) s.weather.kind = 'clear'; const w = s.world, P = O.game.player; let best = null; for (let y = 2; y < w.H - 2; y += 2) for (let x = 2; x < w.W - 2; x += 2) if (w.ter[y * w.W + x] === w.TER.WATER) { const d = Math.hypot(x * 16 - P.x, y * 16 - P.y); if (!best || d < best[2]) best = [x, y, d]; } P.x = best[0] * 16 + 30; P.y = best[1] * 16 - 30; for (const q of s.people.filter((q) => q.age >= 8 && q.age <= 14 && q.agent).slice(0, 3)) { const a = q.agent; a.hidden = false; a.inside = null; a.frozen = false; a.path = null; a.x = P.x + Math.random() * 40; a.y = P.y + 20; q.errand = null; q._bit = null; q._playing = false; } });
let sw = null; for (let i = 0; i < 15 && !sw; i++) { await p.waitForTimeout(2000); sw = await p.evaluate(() => O.SummerPlay.swim ? O.SummerPlay.swim.ppl.map((q) => q.first).join(',') : null); }
console.log('swimming:', sw);
if (D && sw) { await p.evaluate(() => { const c = O.SummerPlay.swim.c; O.game.player.x = c[0] + 30; O.game.player.y = c[1] + 40; }); await p.waitForTimeout(1500); await p.screenshot({ path: `${D}/swim.png`, clip: { x: 450, y: 280, width: 260, height: 160 } }); }
const mill = await p.evaluate(() => { const s = O.SimRef.cur; const z = [...s.biz.values()].find((z) => z.type === 'mill'); if (!z) return 'no mill'; const b = s.building(z.b?.id ?? z.id); O.game.player.x = (b.x + b.w / 2) * 16; O.game.player.y = (b.bottom + 3) * 16; return 'mill at ' + b.x + ',' + b.bottom; });
console.log(mill); await p.waitForTimeout(1500); if (D) await p.screenshot({ path: `${D}/mill.png`, clip: { x: 400, y: 200, width: 400, height: 260 } });
await done();
