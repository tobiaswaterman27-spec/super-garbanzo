import { start } from './lib.mjs';
const { p, done } = await start();
await p.evaluate(() => { const s = O.SimRef.cur; while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; window._said = []; const o = O.Speech.say; O.Speech.say = (w, t, ...a) => { _said.push((w.first || '?') + ': ' + t); return o(w, t, ...a); }; });
for (const mode of ['natural', 'pay', 'leave']) {
  const r = await p.evaluate((mode) => { const s = O.SimRef.cur, P = O.game.player; const shops = [...s.biz.values()].filter((z) => z.def.sells && z.def.sells.length && z.owner !== 'player' && (z.workers || []).length);
    const bz = shops[{ natural: 0, pay: 1, leave: 2 }[mode] % shops.length]; const bid = bz.b?.id ?? bz.id; const b = s.building(bid);
    const heavy = s.people.find((q) => q.gang && q.gang !== 'player' && q.alive !== false && !q.jailUntil && !q._shake && q.age >= 16); if (!heavy) return 'no gang';
    const w = s.byId.get(bz.workers[0]); w.agent.inside = bid; w.agent.hidden = true; w.errand = null; w._bit = null; w.agent.frozen = false; bz.cash = Math.max(bz.cash || 0, 30); if (mode === 'natural') w.traits = (w.traits || []).filter((t) => !/brave|hostile|stubborn/.test(t));
    heavy.agent.inside = null; heavy.agent.hidden = false; heavy.agent.x = b.doorX * 16 + 8; heavy.agent.y = b.doorY * 16 + 30; P.x = heavy.agent.x + 30; P.y = heavy.agent.y + 10; window._sc = O.Shakedown.start(heavy, bid); window._cash = bz.cash; window._pm = O.PlayerState.money; _said.length = 0; return _sc ? `${heavy.first} at ${bz.name}, owner ${_sc.owner.first} out: ${!_sc.owner.agent.hidden}` : 'no scene'; }, mode);
  console.log(mode, r);
  if (mode !== 'natural') { await p.waitForTimeout(1500); const line = await p.evaluate((mode) => new Promise((res) => { O.PlayerState.money = Math.max(O.PlayerState.money, 20); O.PlayerState.equipped = 'sword'; O.AIChat.say(_sc.heavy, mode === 'pay' ? "I'll pay it for them" : 'leave them be', (l) => res(l)); }), mode); console.log('  you said ->', line); }
  await p.waitForTimeout(9500);
  console.log('  ', await p.evaluate(() => `scenes left ${O.Shakedown.scenes.length}, shop cash change ${_sc.bz.cash - _cash}, your money change ${O.PlayerState.money - _pm}, owner back inside ${_sc.owner.agent.hidden}, frozen ${_sc.owner.agent.frozen || _sc.heavy.agent.frozen} | ` + _said.join(' / ').slice(0, 260)));
}
// natural flow: does plan send heavies to doors on collection day?
const n = await p.evaluate(() => { const s = O.SimRef.cur; while (s.weekday !== 2) s.tick(30); while (Math.floor(s.minute / 60) !== 11) s.tick(2); O.game.clock.minute = s.minute; return s.people.filter((q) => q.activity && q.activity.act === 'shakedown').length; });
console.log('collection day heavies on rounds:', n);
await done();
