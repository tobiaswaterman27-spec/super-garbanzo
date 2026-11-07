import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 10) s.tick(2); O.game.clock.minute = s.minute; const [x0, y0, x1, y1] = s.Z.square; O.game.player.x = (x0 + x1) * 8; O.game.player.y = (y0 + y1) * 8 + 50; });
await p.waitForTimeout(1500);
console.log(await p.evaluate(() => { const L = O.TownBirds.life(); return `pigeons ${L.birds.length} cats ${L.cats.length} hens ${L.hens.length}`; }));
// run the player through the pigeons
await p.evaluate(() => { const L = O.TownBirds.life(); const b = L.birds[0]; O.game.player.x = b.x - 60; O.game.player.y = b.y; window._r = 1; });
await p.keyboard.down('Shift'); await p.keyboard.down('ArrowRight'); await p.waitForTimeout(1500); await p.keyboard.up('ArrowRight'); await p.keyboard.up('Shift');
console.log('flying after the run:', await p.evaluate(() => O.TownBirds.life().birds.filter((b) => b.st === 'fly').length));
if (D) await p.screenshot({ path: `${D}/pigeons.png`, clip: { x: 400, y: 250, width: 400, height: 260 } });
await p.waitForTimeout(12000);
console.log('settled again:', await p.evaluate(() => O.TownBirds.life().birds.filter((b) => b.st === 'ground').length));
// the tavern yard of an evening
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 19) s.tick(2); O.game.clock.minute = s.minute; if (s.season === 'winter') s.season = 'summer'; s.raining = false; const b = s.building(s.tavernId); O.game.player.x = b.doorX * 16 + 8; O.game.player.y = (b.doorY + 3) * 16; });
let y = null; for (let i = 0; i < 10 && !y; i++) { await p.waitForTimeout(2000); y = await p.evaluate(() => O.TavernYard.yard ? O.TavernYard.yard.sitters.map((s) => s.q.first + ':' + s.q.agent.forceAnim).join(' ') : null); if (!y) await p.evaluate(() => { const s = O.SimRef.cur, b = s.building(s.tavernId); const ppl = s.people.filter((q) => q.age >= 18 && q.agent && !q.job?.onShift && q.alive !== false).slice(0, 5); for (const q of ppl) { q.agent.inside = b.id; q.agent.hidden = true; q.agent.path = null; } }); }
console.log('yard:', y);
await p.waitForTimeout(8000); if (D) await p.screenshot({ path: `${D}/tavernyard.png`, clip: { x: 450, y: 280, width: 300, height: 200 } });
await done();
