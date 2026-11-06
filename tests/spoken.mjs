import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; s.minute = 11 * 60; O.game.clock.minute = 11 * 60; });
await p.waitForTimeout(800);
const typeSay = async (t) => { await p.evaluate(() => document.querySelector('.dlg-say input')?.focus()); await p.keyboard.type(t, { delay: 5 }); await p.keyboard.press('Enter'); await p.waitForTimeout(1200); };
const dlg = () => p.evaluate(() => (O.UI.dialogOpen() ? (document.querySelector('.dlg-name')?.textContent + ': ' + document.querySelector('.dlg-text')?.textContent).slice(0, 220) : 'no dialog') + (O.panelOpen ? ' [PANEL OPEN]' : ''));
// the stablemaster says what's for sale; you say which
const st = await p.evaluate(async () => { const s = O.SimRef.cur, PS = O.PlayerState; PS.money = 900; const bz = [...s.biz.values()].find((z) => z.type === 'stable'); const q = bz && bz.workers.map((id) => s.byId.get(id))[0]; if (!q) return null; O.npcUI.openTalk(q); await new Promise((r) => setTimeout(r, 400)); await O.AIChat.say(q, 'What horses have you got for sale? I want to buy a horse.', () => {}); return q.first; });
await p.waitForTimeout(1500);
console.log('stable (' + st + '):', await dlg());
const horse = await p.evaluate(() => { const H = O.Horses.horses; const list = typeof H === 'function' ? H() : H; const h = list.find((x) => String(x.owner).startsWith('biz:')); return h && h.name; });
if (horse) { await typeSay(`I'll buy ${horse}.`); console.log('after buying', horse + ':', await p.evaluate((n) => { const H = O.Horses.horses; const list = typeof H === 'function' ? H() : H; const h = list.find((x) => x.name === n); return 'owner ' + h.owner + ' money ' + O.PlayerState.money; }, horse)); }
await p.evaluate(() => { if (O.UI.dialogOpen()) O.UI.dialog.close(); if (O.panelOpen) O.Panels.close(); O.npcUI.closeTalk(); });
// the parish clerk's houses
const cl = await p.evaluate(async () => { const s = O.SimRef.cur; const q = s.people.find((z) => /clerk|reeve|priest/.test(z.job?.role || '')); if (!q) return null; O.npcUI.openTalk(q); await new Promise((r) => setTimeout(r, 300)); if (O.Parish && O.Parish.open) O.Parish.open(s, q); return q.first + ' ' + q.job.role; });
await p.waitForTimeout(800);
console.log('parish (' + cl + '):', await dlg());
if (cl) { await typeSay('I would like to rent the first one.'); console.log('after renting:', await dlg(), await p.evaluate(() => JSON.stringify(O.PlayerState.lease))); }
await p.evaluate(() => { if (O.UI.dialogOpen()) O.UI.dialog.close(); if (O.panelOpen) O.Panels.close(); O.npcUI.closeTalk(); });
// your dog, spoken to
console.log(await p.evaluate(() => { const s = O.SimRef.cur, P = O.game.player; const f = { world: s.world.placeId, kind: 'dog', seed: 5, z: { x0: 0, y0: 0, x1: 1, y1: 1 }, x: P.x + 10, y: P.y, dir: 0, ft: 0, tx: null, wait: 1, speed: 12, owner: 'player', mode: 'stay', petMove: true, bond: 0.5, name: 'Rex', skills: {} }; O.fauna.push(f); window._dog = f; const c = (O.moreCandidates || []).map((fn) => { try { return fn(); } catch (e) { return null; } }).find((x) => x && /Rex/.test(x.label || '')); if (c) c.act(); return 'dog menu via ' + (c ? c.label : 'none'); }));
await p.waitForTimeout(500);
console.log('dog:', await dlg());
await typeSay('Heel, Rex!');
console.log('dog mode now', await p.evaluate(() => _dog.mode));
// bandits on the road can't be walked away from
console.log(await p.evaluate(() => { O.Panels.open('Bandits!', '<p>Four ragged men.</p><div class="topics"><button data-b="pay">Pay ₳10</button><button data-b="fight">Fight</button><button data-b="flee">Run for it</button></div>', (r) => { r.querySelectorAll('[data-b]').forEach((b) => b.onclick = () => { window._band = b.dataset.b; }); }); return 'bandits opened'; }));
await p.waitForTimeout(300); console.log('bandits:', await dlg());
await typeSay('Here, take my purse and let me pass.');
console.log('bandits chose', await p.evaluate(() => window._band));
await done();
