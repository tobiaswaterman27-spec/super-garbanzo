import { start } from './lib.mjs';
const { p, done } = await start();
const D = process.env.SHOTS || '';
await p.evaluate(() => { const s = O.SimRef.cur; while (s.minute < 9.65 * 60) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
const f = await p.evaluate(() => { const s = O.SimRef.cur; const hh = s.households.find((h) => h.members.length >= 3 && !h.gone); const who = s.byId.get(hh.members[0]); const e = { kind: 'funeral', day: s.day, who: who.id, name: who.name }; const ok = O.Processions.funeral(e); if (!ok) return 'NO'; const pr = O.Processions.proc; O.game.player.x = pr.lead[0]; O.game.player.y = pr.lead[1] + 40; window._len = pr.path.length; return `funeral of ${who.first}: ${pr.bearers.length} bearers, ${pr.mourners.length} mourners, path ${pr.path.length} tiles`; });
console.log(f);
await p.waitForTimeout(6000); if (D) await p.screenshot({ path: `${D}/funeral.png`, clip: { x: 450, y: 250, width: 300, height: 220 } });
for (let i = 0; i < 50 && await p.evaluate(() => !!O.Processions.proc); i++) { await p.waitForTimeout(2000); await p.evaluate(() => { const pr = O.Processions.proc; if (pr && pr.lead) { O.game.player.x = pr.lead[0]; O.game.player.y = pr.lead[1] + 40; } }); }
console.log('funeral end', await p.evaluate(() => (O.Processions.proc ? 'still ' + O.Processions.proc.pi + '/' + _len : 'arrived') + ' held ' + O.SimRef.cur.people.filter((q) => q._proc).length));
const w = await p.evaluate(() => { const s = O.SimRef.cur; const ad = s.people.filter((q) => q.age >= 18 && q.age < 40 && q.agent && q.alive !== false && !q._proc); const a = ad.find((q) => q.sex === 'm'), b = ad.find((q) => q.sex === 'f'); const ok = O.Processions.wedding({ kind: 'wedding', day: s.day, a: a.id, b: b.id }); if (!ok) return 'NO'; const pr = O.Processions.proc; O.game.player.x = pr.door[0]; O.game.player.y = pr.door[1] + 60; return `wedding ${a.first} & ${b.first}, ${pr.guests.length} guests, fiddler ${pr.fid ? pr.fid.first : '-'}`; });
console.log(w);
await p.waitForTimeout(9000); if (D) await p.screenshot({ path: `${D}/wedding.png`, clip: { x: 450, y: 250, width: 300, height: 220 } });
for (let i = 0; i < 30 && await p.evaluate(() => !!O.Processions.proc); i++) await p.waitForTimeout(2000);
console.log('wedding end; held', await p.evaluate(() => O.SimRef.cur.people.filter((q) => q._proc).length), '|', (await p.evaluate(() => _said.filter((x) => /did it|Wife|Husband|Huzzah|Long life|come/.test(x)).slice(0, 4).join(' / '))));
await done();
