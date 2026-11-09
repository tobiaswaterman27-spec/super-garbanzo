// Hawking in the open country: the hawk off the fist, circling, stooping, coming back.
import { start } from './lib.mjs';
const { p, done } = await start();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.evaluate(() => { const s = O.SimRef.cur; Object.defineProperty(s, 'season', { value: 'summer', configurable: true }); s.raining = false; let g = 0; while (Math.floor(s.minute / 60) !== 11 && g++ < 3000) s.tick(2); O.game.clock.minute = s.minute; });
const home = await p.evaluate(() => [O.game.player.x, O.game.player.y]);
let found = null;
for (let i = 0; i < 49 && !found; i++) { found = await p.evaluate(([i, hx, hy]) => { const P = O.game.player; P.x = hx + ((i % 7) - 3) * 420; P.y = hy + (Math.floor(i / 7) - 3) * 300; const sc = O.WildFolk.scenes().find((x) => x.kind === 'hawk'); if (sc) return true; return null; }, [i, home[0], home[1]]); }
console.log('falconer found:', !!found);
if (found) { const st = new Set(); for (let i = 0; i < 30; i++) { await p.waitForTimeout(1500); st.add(await p.evaluate(() => { const L = O.WildFolk.scenes(); const sc = L.find((x) => x.kind === 'hawk'); return sc ? sc.hawk.st : '-' + L.map((x) => x.kind).join('/'); })); } console.log('hawk did:', [...st].join(' ')); if (process.env.SD) await p.screenshot({ path: process.env.SD + '/hawk.png', clip: { x: 360, y: 180, width: 480, height: 300 } }); }
await done();
