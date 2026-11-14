// Water. Every house needs it and none has it piped: morning and evening someone from each household (a
// wife, a daughter, a boy sent with the pail) walks to the well, waits their turn with the others and
// gossips while they wait, winds up a bucket and carries it home slopping. A household's water runs down
// with cooking and washing; a big family is at the well more often. On a winter morning the well is iced
// over and the first one there must break it. You fetch your own too: draw a bucket, carry it home, tip it
// into the butt by your door, and that is the water you wash with at your own hearth.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const butts = () => (PS.water = PS.water || {});
    let acc = 0, lastDay = null, trips = 0, gossips = 0, iceBroken = 0, drawn = 0, tipped = 0, washes = 0; const queue = new Map(); // well -> [q]
    const wellsOf = (s) => (s.world.props || []).filter((p) => p.kind === 'well');
    const nearestWell = (s, x, y) => wellsOf(s).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    const iced = (s, w) => (s.season === 'winter' || w._freeze === s.day) && s.minute / 60 < 10 && w._iceDay !== s.day;
    const homeOf = (s, q) => q.home != null ? s.building(q.home) : null;
    const fetcher = (s, hh) => { const m = (hh.members || []).map((id) => s.byId.get(id)).filter((q) => q && q.alive !== false && q.agent && !q.errand && !talking(q) && !q.jailUntil && !q._coup && !q._tolet && q.age >= 8 && q.activity?.act !== 'sleep' && q.activity?.act !== 'work');
      return m.find((q) => q.sex === 'f' && q.age >= 12) || m.find((q) => q.age < 16) || m[0] || null; };
    // a day's use
    game.hooks.update.push(() => { const s = cur(); if (!s || !s.households) return; if (lastDay === s.day) return; const first = lastDay == null; lastDay = s.day; for (const hh of s.households.values ? s.households.values() : s.households) { if (hh.water == null || first) { hh.water = 2 + Math.floor(Math.random() * 3); continue; } hh.water = Math.max(0, hh.water - Math.ceil(((hh.members || []).length || 2) / 2)); } });
    // the trips to the well
    function send(s, q, hh, w) { const L = queue.get(w) || []; queue.set(w, L); L.push(q); q._well = true; trips++; const slot = L.length - 1; const wx = Math.floor(w.x / T), wy = Math.floor(w.y / T);
      const home = homeOf(s, q);
      const draw = () => O.Errands.send(s, q, [wx, wy + 1], { anim: 'take', secs: 3, face: 0, giveUp: game.t + 40, at: () => { if (iced(s, w)) { w._iceDay = s.day; iceBroken++; q.errand.anim = 'hammer'; q.errand.until += 2; if (near(w.x, w.y, 300)) { say(q, pick(['Frozen again! Stand back.', 'Ice like iron this morning.']), 2); O.sfx && O.sfx('smack', 0.4); } } O.sfx && near(w.x, w.y, 200) && O.sfx('pour', 0.3); },
        after: (ok) => { const i = L.indexOf(q); if (i >= 0) L.splice(i, 1); if (!ok || !home) { q._well = false; if (ok) hh.water = Math.min(6, (hh.water || 0) + 2); return; }
          q.agent.forceAnim = 'bucket'; O.Errands.send(s, q, [home.doorX, home.doorY + 1], { anim: 'idle', secs: 0.4, face: 0, giveUp: game.t + 90, after: () => { q.agent.forceAnim = null; q._well = false; hh.water = Math.min(6, (hh.water || 0) + 2); } }); } });
      if (slot === 0) { draw(); return; }
      // wait your turn beside the well, and talk
      O.Errands.send(s, q, [wx + (slot % 2 ? 2 : -2), wy + 1 + Math.floor((slot - 1) / 2)], { anim: 'talk', secs: 3.5 * slot, face: slot % 2 ? 1 : 2, giveUp: game.t + 50, at: () => { const o = L.find((z) => z !== q && z.errand && z.errand.working); if (o && near(w.x, w.y, 260) && Math.random() < 0.7) { gossips++; const about = O.LifeWeight && O.LifeWeight.aboutYou && Math.random() < 0.3 ? O.LifeWeight.aboutYou(s, q) : null; say(q, about || pick([`Did you hear about ${o.first === q.first ? 'the miller' : 'the smith'}'s girl?`, 'Bread\'s gone up again.', 'They say there\'ll be rain by Sunday.', 'Mine\'s been coughing all night.', `Morning, ${o.first}. Your turn's next.`]), 2.6); setTimeout(() => say(o, pick(['Never!', 'Is that so?', 'Hm. I\'d not be surprised.', 'Don\'t I know it.']), 2), 2400); } }, after: () => draw() }); }
    game.hooks.update.push((dt) => { acc += dt; if (acc < 3) return; acc = 0; const s = cur(); if (!s || !s.world || game.scene || !s.households) return; const h = s.minute / 60; if (!((h >= 6 && h < 9.5) || (h >= 16.5 && h < 19))) return;
      for (const hh of s.households.values ? s.households.values() : s.households) { if ((hh.water || 0) >= 2) continue; const mem = (hh.members || []).map((id) => s.byId.get(id)).find((q) => q && q.home != null); if (!mem) continue; const home = homeOf(s, mem); if (!home || home.doorX == null) continue;
        const w = nearestWell(s, home.doorX * T, home.doorY * T); if (!w) continue;
        if (!near(w.x, w.y, 520) && !near(home.doorX * T, home.doorY * T, 520)) { hh.water = Math.min(6, (hh.water || 0) + 2); continue; } // out of sight: the trip happens all the same
        if ((queue.get(w) || []).length >= 4) continue; const q = fetcher(s, hh); if (!q) continue; send(s, q, hh, w); break; } });
    // you: draw, carry, tip into your butt
    const myHouses = (s) => (O.HouseKeys && O.HouseKeys.mineIn ? O.HouseKeys.mineIn(s) : s.world.buildings.filter((b) => b.owner && b.owner.kind === 'player'));
    const buttKey = (s, b) => s.world.placeId + ':' + b.id;
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked || PS.carry) return null; const w = wellsOf(s).find((w) => near(w.x, w.y + 6, 30)); if (!w) return null;
      if (iced(s, w)) return { type: 'custom', d: 3, x: w.x, y: w.y - 58, label: 'Break the ice on the well', act: () => { P.locked = true; P.anim = 'hammer'; O.sfx && O.sfx('smack', 0.5); setTimeout(() => { w._iceDay = s.day; iceBroken++; P.locked = false; P.anim = 'idle'; ui('You crack the ice with the bucket\'s rim and knock the pieces down the shaft. The rope runs free.', 'info'); }, 1800); } };
      return { type: 'custom', d: 4, x: w.x, y: w.y - 58, label: myHouses(s).length ? 'Draw a bucket to carry home' : 'Draw a bucket of water', act: () => { P.locked = true; P.anim = 'take'; P.dir = 0; O.sfx && O.sfx('pour', 0.4); setTimeout(() => { P.locked = false; P.anim = 'idle'; PS.carry = { good: 'water', qty: 1, look: 'bucket', well: true }; drawn++; ui(myHouses(s).length ? 'You wind up a full bucket. Carry it home without slopping it all.' : 'You wind up a full bucket. Somebody will want it: a shop with a low butt will pay a coin.', 'info'); }, 2400); } }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked || !PS.carry || !PS.carry.well) return null; const b = myHouses(s).find((b) => near(b.doorX * T + 8 - 14, (b.doorY + 1) * T + 2, 30)); if (!b) return null;
      return { type: 'custom', d: 1, x: b.doorX * T - 6, y: b.doorY * T - 18, label: 'Tip the water into your butt', act: () => { P.anim = 'take'; O.sfx && O.sfx('pour', 0.6); const k = buttKey(s, b); butts()[k] = Math.min(6, (butts()[k] || 0) + 2); PS.carry = null; tipped++; setTimeout(() => { P.anim = 'idle'; }, 700); ui(`Into the butt it goes. ${butts()[k] >= 6 ? 'Full to the brim.' : butts()[k] >= 4 ? 'Well over half full.' : 'Enough to wash with.'}`, 'info'); } }; });
    // the butt by your door, with its water level
    game.hooks.drawGround.push((ctx, cam) => { const s = cur(); if (!s || !s.world || game.scene) return; for (const b of myHouses(s)) { if (b.doorX == null || !near(b.doorX * T, b.doorY * T, 420)) continue; const lv = butts()[buttKey(s, b)] || 0, x = Math.round(b.doorX * T + 8 - 14 - cam.x), y = Math.round((b.doorY + 1) * T + 2 - cam.y);
      ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 5, y - 11, 11, 12); ctx.fillStyle = '#7a5434'; ctx.fillRect(x - 4, y - 10, 9, 10); ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - 5, y - 8, 11, 1); ctx.fillRect(x - 5, y - 3, 11, 1); ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 4, y - 12, 9, 2);
      if (lv > 0) { ctx.fillStyle = lv >= 4 ? '#5a8ac8' : '#4a6a98'; ctx.fillRect(x - 3, y - 12, 7, 1); if (lv >= 4) { ctx.fillStyle = '#a8c8f0'; ctx.fillRect(x - 2, y - 12, 2, 1); } } } });
    // washing at home takes water from the butt
    O.Water = { butt: (s, b) => butts()[buttKey(s, b)] || 0, use: (s, b) => { const k = buttKey(s, b); if ((butts()[k] || 0) < 1) return false; butts()[k] -= 1; washes++; return true; }, butts, queue, wellsOf, send, fetcher, iced, freeze: (s, w) => { w._freeze = s.day; w._iceDay = null; },
      get trips() { return trips; }, get gossips() { return gossips; }, get iceBroken() { return iceBroken; }, get drawn() { return drawn; }, get tipped() { return tipped; }, get washes() { return washes; } };
    (O.extraLines = O.extraLines || []).push((s, q) => q._well ? 'You are fetching water from the well for your household.' : '');
  }
  O.WaterWellSetup = { setup };
})();
