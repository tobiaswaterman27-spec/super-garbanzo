// The leper at the town's end. Outside most towns, where the road comes in, a figure sits in a grey hooded
// cloak by day with a wooden clapper and a bowl on the end of a long pole, so that nobody need come near.
// He clacks the clapper when folk pass and cries for alms; they swing wide around him on the road, and
// now and then one stops at a pole's length and drops a coin in the bowl. You can give too.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const seat = new WeakMap(), coins = []; let gifts = 0, acc = 0, warned = 0, lastSaid = -99;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function spot(s) { if (seat.has(s)) return seat.get(s); const w = s.world; let best = null;
      if (w.ox != null) { const R = (t) => t === w.TER.ROAD || t === w.TER.COBBLE; outer: for (let d = 2; d < 7; d++) for (let tx = w.ox - d; tx <= w.ox + w.townW + d; tx++) for (const ty of [w.oy - d, w.oy + w.townH + d]) { if (tx < 2 || ty < 2 || tx >= w.W - 2 || ty >= w.H - 2) continue; const i = ty * w.W + tx; if (!R(w.ter[i]) || w.solid[i]) continue; for (const dx of [2, -2, 3, -3]) { const j = ty * w.W + tx + dx; if (!w.solid[j] && w.ter[j] !== w.TER.WATER && !R(w.ter[j])) { best = { x: (tx + dx) * T + 8, y: ty * T + 12, rx: tx * T + 8 }; break outer; } } }
        if (!best) outer2: for (let d = 2; d < 7; d++) for (let ty = w.oy - d; ty <= w.oy + w.townH + d; ty++) for (const tx of [w.ox - d, w.ox + w.townW + d]) { if (tx < 2 || ty < 2 || tx >= w.W - 2 || ty >= w.H - 2) continue; const i = ty * w.W + tx; if (!R(w.ter[i]) || w.solid[i]) continue; for (const dy of [2, -2]) { const j = (ty + dy) * w.W + tx; if (!w.solid[j] && w.ter[j] !== w.TER.WATER && !R(w.ter[j])) { best = { x: tx * T + 8, y: (ty + dy) * T + 12, rx: tx * T + 8 }; break outer2; } } } }
      if (best) { const R2 = O.RNG(O.hash('leper', s.world.placeId || 1)); best.app = O.Char.makeAppearance(O.hash('leper', s.world.placeId || 1), { sex: 'm', age: 35 + Math.floor(R2.next() * 25), genes: O.Char.randomGenes(R2, 'north'), role: 'beggar', wealth: 0 }); best.agent = { x: best.x, y: best.y, hidden: false, inside: null }; best.first = 'the leper'; }
      seat.set(s, best); return best; }
    const here = (s) => { const hr = s.minute / 60; return hr >= 8 && hr < 18 && !(game.isNight && game.isNight()); };
    game.hooks.update.push((dt) => {
      for (const c of coins.slice()) { c.t += dt; if (c.t > 0.8) coins.splice(coins.indexOf(c), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const L = spot(s); if (!L || !here(s)) return; if (!near(L.x, L.y, 500)) return;
      // folk on the road swing wide of him
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen) continue; const d = Math.hypot(a.x - L.x, a.y - L.y); if (d < 34 && d > 0.1) { a.x += (a.x - L.x) / d * 30 * dt; a.y += (a.y - L.y) / d * 30 * dt; } }
      acc += dt; if (acc < 1) return; acc = 0;
      const passing = s.people.find((q) => q.agent && !q.agent.hidden && q.agent.inside == null && q.age >= 14 && Math.hypot(q.agent.x - L.x, q.agent.y - L.y) < 70);
      if (passing && Math.random() < 0.25 && near(L.x, L.y, 300)) O.sfx && O.sfx('chop', 0.12);
      if (passing && game.t - lastSaid > 14 && near(L.x, L.y, 300) && Math.random() < 0.3) { lastSaid = game.t; O.Speech && O.Speech.say(L, pick(['Alms! Alms, for the love of God!', 'Pity a poor leper, good folk.', 'A penny for the lazar, and God will remember it.']), 2.6); }
      // someone stops at a pole's length and gives
      if (passing && !passing.agent.frozen && Math.random() < 0.08) { try { if ((s.household(passing)?.money || 0) > 8) { s.household(passing).money -= 1; gifts++; O.gesture && O.gesture(passing, 'give', 1.2); coins.push({ x0: passing.agent.x, y0: passing.agent.y - 18, x1: L.x + 18, y1: L.y - 14, t: 0 }); if (near(L.x, L.y, 300)) setTimeout(() => O.Speech && O.Speech.say(L, 'God reward you, friend.', 2), 600); } } catch (e) { /* */ } }
      // the player close by
      if (near(L.x, L.y, 26) && game.t - warned > 30) { warned = game.t; O.Speech && O.Speech.say(L, pick(['Unclean! Keep back, friend. Put it in the bowl.', 'Not so close, for your own sake!']), 2.6); O.sfx && O.sfx('chop', 0.2); }
    });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked) return null; const L = spot(s); if (!L || !here(s) || !near(L.x, L.y, 48)) return null;
      return { type: 'custom', d: 48, x: L.x, y: L.y - 30, label: 'Put a coin in the leper\'s bowl', act: () => { if ((PS.money || 0) < 1) return O.UI.say('You have nothing to give.'); PS.money -= 1; PS.almsToPoor = (PS.almsToPoor || 0) + 1; gifts++; P.anim = 'give'; P.locked = true; coins.push({ x0: P.x, y0: P.y - 18, x1: L.x + 18, y1: L.y - 14, t: 0 }); setTimeout(() => { P.locked = false; P.anim = 'idle'; O.Speech && O.Speech.say(L, pick(['God bless you. Not many stop.', 'Christ keep you, and keep you clean.', 'Bless you. I\'ll eat tonight.']), 2.8); }, 900); } }; });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const L = spot(s); if (!L || !here(s)) return; const x = Math.round(L.x - cam.x), y = Math.round(L.y - cam.y); if (x < -40 || y < -60 || x > ctx.canvas.width + 40 || y > ctx.canvas.height + 40) return; const tk = performance.now() / 1000;
      try { const fr = O.Char.frame(L.app, 0, 'sit', 0); ctx.drawImage(fr, x - 16, y + 6 - O.Char.GROUND); } catch (e) { /* */ }
      // the grey hooded cloak over all
      const hy = y - 27 + (L.hoodY || 0); ctx.fillStyle = '#7a7a72'; ctx.fillRect(x - 5, hy - 1, 10, 4); ctx.fillRect(x - 6, hy + 2, 3, 9); ctx.fillRect(x + 3, hy + 2, 3, 9); ctx.fillRect(x - 7, hy + 10, 14, 11); ctx.fillStyle = '#8a8a82'; ctx.fillRect(x - 4, hy - 1, 8, 1); ctx.fillStyle = '#6a6a62'; ctx.fillRect(x - 7, hy + 18, 14, 2); ctx.fillRect(x - 1, hy + 10, 1, 8);
      // the clapper, clacking
      const cl = Math.floor(tk * 3) % 4 === 0; ctx.fillStyle = '#8a6a44'; ctx.fillRect(x + (L.x > L.rx ? -9 : 6), y - 14 - (cl ? 1 : 0), 3, 5); ctx.fillRect(x + (L.x > L.rx ? -9 : 6) + (cl ? 1 : 0), y - 15, 1, 1);
      // the bowl on a long pole held out toward the road
      const sx = L.rx > L.x ? 1 : -1; ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + sx * 4, y - 10); ctx.lineTo(x + sx * 20, y - 14); ctx.stroke(); ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x + sx * 20 - 3, y - 16, 6, 2); ctx.fillRect(x + sx * 20 - 2, y - 14, 4, 1);
      for (const c of coins) { const k = c.t / 0.8, cx = c.x0 + (c.x1 - c.x0) * k, cy = c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 14; ctx.fillStyle = '#e8c860'; ctx.fillRect(Math.round(cx - cam.x), Math.round(cy - cam.y), 2, 2); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const L = spot(s); return L && here(s) && q.agent && Math.hypot(q.agent.x - L.x, q.agent.y - L.y) < 300 ? 'A leper sits by the road at the end of town with a clapper and a bowl on a pole. You pity him and keep well clear, and give a coin when you can.' : ''; });
    O.Leper = { seat: () => spot(cur()), get gifts() { return gifts; } };
  }
  O.LeperSetup = { setup };
})();
