// To let. An empty house in the parish's keeping has a board on a post by its door: a key painted on it
// and the weekly rent chalked underneath. Read it as you pass. Send for the parish clerk and they come out
// with the keys, unlock the door and show you round; tell them there and then, in your own words or by the
// door, that you'll take it on a lease or buy it outright, and the board comes down. Townsfolk look at
// houses too: now and then the clerk walks a young couple round one of the empty ones while you watch.
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
    let V = null, NV = null, boards = 0, fetched = 0, shown = 0, taken = 0, npcViews = 0, nvAcc = 40;
    const clerkOf = (s) => s.people.find((q) => q.job?.role === 'parish clerk' && q.alive !== false && q.agent && !q.jailUntil) || null;
    const place = (s, b) => { if (b._board !== undefined) return b._board; const W = s.world; b._board = null; for (const dx of [-1, 1, -2, 2]) { const tx = b.doorX + dx, ty = b.doorY + 1; if (W.solid[ty * W.W + tx]) continue; b._board = { x: tx * T + 8, y: ty * T + 12 }; break; } return b._board; };
    const vis = (s) => (O.Parish ? O.Parish.houses(s) : []).filter((b) => near(b.doorX * T, b.doorY * T, 420) && place(s, b));
    const rent = (s, b) => O.Parish.rentOf(b, s), price = (s, b) => Math.round(s.value(b));
    const free = (q) => q && q.agent && !q.errand && !talking(q) && !q._coup && q.alive !== false;
    // the boards
    function digits(ctx, x, y, n) { const D = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111']; const s = String(n); ctx.fillStyle = '#f2ead8'; for (let k = 0; k < s.length; k++) { const d = D[+s[k]]; for (let i = 0; i < 15; i++) if (d[i] === '1') ctx.fillRect(x + k * 4 + (i % 3), y + Math.floor(i / 3), 1, 1); } }
    game.hooks.drawGround.push((ctx, cam) => { const s = cur(); if (!s || !s.world || game.scene || !O.Parish) return; const L = vis(s); boards = L.length;
      for (const b of L) { const B = b._board, x = Math.round(B.x - cam.x), y = Math.round(B.y - cam.y); ctx.fillStyle = '#4a3220'; ctx.fillRect(x, y - 24, 2, 24); ctx.fillRect(x - 8, y - 24, 12, 2);
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 7, y - 22, 1, 2); ctx.fillRect(x + 2, y - 22, 1, 2); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 10, y - 20, 16, 13); ctx.fillStyle = '#6a8a4a'; ctx.fillRect(x - 9, y - 19, 14, 11);
        ctx.fillStyle = '#e8c860'; ctx.fillRect(x - 7, y - 17, 3, 3); ctx.fillRect(x - 4, y - 16, 6, 1); ctx.fillRect(x, y - 16, 1, 2); ctx.fillRect(x + 2, y - 16, 1, 2); ctx.fillStyle = '#6a8a4a'; ctx.fillRect(x - 6, y - 16, 1, 1);
        digits(ctx, x - 7, y - 13 + 1, Math.min(99, rent(s, b))); } });
    const atBoard = (s) => vis(s).find((b) => near(b._board.x, b._board.y + 4, 26));
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked || !O.Parish) return null; const b = atBoard(s); if (!b) return null;
      return { type: 'custom', d: 1, x: b._board.x, y: b._board.y - 40, label: `Read the board: to let, ₳${rent(s, b)} a week, or ₳${price(s, b)} to buy`, act: () => { ui(`To let, by the parish: ${b.name && b.name !== 'House' ? b.name + ', ' : ''}${b.w}×${b.d}${(b.floors || 1) > 1 ? ', two floors' : ''}. ₳${rent(s, b)} a week, or ₳${price(s, b)} to buy. The parish clerk has the key.`, 'info'); } }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked || V || !O.Parish) return null; const b = atBoard(s); if (!b) return null; const c = clerkOf(s); if (!c) return null;
      return { type: 'custom', d: 2, x: b._board.x, y: b._board.y - 54, label: `Send for the parish clerk to show you round`, act: () => fetch(s, b, c) }; });
    function fetch(s, b, c) { if (NV && NV.c === c) endNpc(); if (!free(c)) { ui(`${c.first} the clerk is busy. Try again in a while.`, 'info'); return; } fetched++; V = { s, b, c, t: 0, stage: 'coming' }; c._tolet = true;
      const runner = s.people.find((k) => k.age >= 8 && k.age < 14 && free(k) && k.agent.inside == null && near(k.agent.x, k.agent.y, 160)); if (runner) { say(runner, pick(['I\'ll fetch him! A penny?', 'I know where the clerk is!']), 1.8); O.Errands.send(s, runner, [Math.floor(c.agent.x / T), Math.floor(c.agent.y / T)], { anim: 'point', secs: 1, sprint: true, giveUp: game.t + 30 }); }
      ui(`${runner ? runner.first + ' runs' : 'Word goes'} to fetch ${c.first}, the parish clerk.`, 'info');
      if (!near(c.agent.x, c.agent.y, 900) || c.agent.hidden && c.agent.inside == null) { c.agent.inside = null; c.agent.hidden = false; const P = game.player; c.agent.x = P.x + (P.x > b.doorX * T ? 260 : -260); c.agent.y = (b.doorY + 2) * T; c.agent.path = null; }
      O.Errands.send(s, c, [b.doorX, b.doorY + 1], { anim: 'idle', secs: 0.3, face: 0, giveUp: game.t + 120, after: (ok) => { if (!V || V.c !== c) return; if (!ok) { ui(`${c.first} never came.`, 'warn'); rel(); return; } c.agent.frozen = true; c.agent.path = null; V.stage = 'open'; V.t = 0; b._open = true; O.sfx && O.sfx('door', 0.4); O.gesture && O.gesture(c, 'give', 1);
        say(c, pick(['This one? Good, solid walls. Come in, look round.', 'Here, I\'ll unlock it. Mind the step.', 'Nobody\'s lived here a while. Have a look.']), 2.6); } }); }
    function rel() { if (V && V.c) { V.c._tolet = false; if (V.c.agent) { V.c.agent.frozen = false; V.c.agent.forceAnim = null; } } V = null; }
    // look round, then lease or buy
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!V || V.stage !== 'open' || game.scene || P.locked) return null; const b = V.b; if (!near(b.doorX * T + 8, (b.doorY + 1) * T, 34)) return null;
      return { type: 'custom', d: 1, x: b.doorX * T + 8, y: b.doorY * T - 18, label: `Look round the house with ${V.c.first}`, act: () => { shown++; V.looked = true; say(V.c, pick(['Hearth draws well. Roof\'s sound, mostly.', 'Plenty of room. Well? What do you say?']), 2.4); game.enterBuilding(b, 0); } }; });
    function decide(how) { if (!V) return 'no'; const s = V.s, b = V.b, c = V.c; const m = how === 'buy' ? O.Parish.buy(s, c, b) : O.Parish.lease(s, c, b); if (m) { say(c, m.replace(/You haven't/, 'You haven\'t').replace(/^It's/, 'It\'s'), 2.4); return m; }
      taken++; b._board = undefined; O.gesture && O.gesture(c, 'nod', 1); say(c, how === 'buy' ? 'Sold. I\'ll have the deed drawn and sealed.' : 'Done. Rent\'s due on the same day each week, mind.', 2.4); const c0 = c; setTimeout(() => { if (c0._tolet) { c0._tolet = false; c0.agent.frozen = false; } }, 6000); V = null; return null; }
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!V || V.stage !== 'open' || P.locked) return null; const b = V.b; const by = game.scene ? game.scene.b === b : near(b.doorX * T + 8, (b.doorY + 1) * T, 50); if (!by) return null;
      return { type: 'custom', d: 2, x: game.scene ? P.x : b.doorX * T - 10, y: game.scene ? P.y - 40 : b.doorY * T - 32, label: `Take it on a lease (₳${rent(s, b)} a week)`, act: () => decide('lease') }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!V || V.stage !== 'open' || P.locked) return null; const b = V.b; const by = game.scene ? game.scene.b === b : near(b.doorX * T + 8, (b.doorY + 1) * T, 50); if (!by) return null;
      return { type: 'custom', d: 3, x: game.scene ? P.x : b.doorX * T + 26, y: game.scene ? P.y - 54 : b.doorY * T - 32, label: `Buy it outright (₳${price(s, b)})`, act: () => decide('buy') }; });
    // in your own words, to the clerk
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) { try { const t = String(text || ''); if (V && V.c === q && V.stage === 'open') { const s = V.s, b = V.b;
        if (/\b(buy|purchase|own it)\b/i.test(t)) { const m = decide('buy'); return respond(q, t, m ? m : 'Sold, then. I\'ll draw up the deed.', render); }
        if (/\b(take it|lease|rent it|i'?ll have it|yes)\b/i.test(t)) { const m = decide('lease'); return respond(q, t, m ? m : 'Done. It\'s yours to live in, rent on the same day each week.', render); }
        if (/\b(how much|price|cost|rent)\b/i.test(t)) return respond(q, t, `₳${rent(s, b)} a week to rent it, or ₳${price(s, b)} to buy it outright.`, render);
        if (/\b(no|not for me|leave it|another)\b/i.test(t)) { const r = respond(q, t, 'As you like. I\'ll lock up.', render); b._open = false; rel(); return r; } } } catch (e) { console.error(e); } return _say.apply(this, arguments); };
    game.hooks.update.push((dt) => { if (V) { V.t += dt; const s = cur(); if (V.s !== s || V.c.alive === false || (V.stage === 'open' && V.t > 180 && !game.scene) || (V.stage === 'coming' && V.t > 150)) { if (V.stage === 'open' && near(V.c.agent.x, V.c.agent.y, 300)) say(V.c, 'I can\'t wait all day. I\'ll lock up.', 2); V.b._open = false; rel(); } } });
    // townsfolk viewing a house
    function endNpc() { if (!NV) return; for (const q of [NV.c, NV.a, NV.b2]) if (q) { q._tolet = false; if (q.agent) q.agent.frozen = false; } NV = null; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene || !O.Parish) return; if (NV) { NV.t += dt; if (NV.s !== s || NV.t > 70) endNpc(); return; } nvAcc -= dt; if (nvAcc > 0 || V) return; nvAcc = 80 + Math.random() * 80;
      const L = vis(s), c = clerkOf(s); if (!L.length || !free(c) || c.activity?.act !== 'work') return; const b = L[0];
      const a = s.people.find((q) => q.age >= 18 && q.age <= 35 && free(q) && q.agent.inside == null && !q.agent.hidden && q.job?.role !== 'parish clerk' && near(q.agent.x, q.agent.y, 500)); if (!a) return; const sp = a.partner != null ? s.byId.get(a.partner) : null; const b2 = sp && free(sp) && sp.agent.inside == null && !sp.agent.hidden ? sp : null;
      NV = { s, b, c, a, b2, t: 0, n: 0 }; npcViews++; for (const q of [c, a, b2]) if (q) q._tolet = true;
      const meet = (q, dx, face, last) => O.Errands.send(s, q, [b.doorX + dx, b.doorY + 1], { anim: 'idle', secs: 6, face, giveUp: game.t + 50, after: (ok) => { if (!NV) return; NV.n++; if (NV.n === 1 + (b2 ? 2 : 1)) { const v = NV; say(v.c, pick(['Sound roof, dry floor.', 'Two rooms and a hearth. A fair price.']), 2.4); setTimeout(() => { if (NV === v) { say(v.a, pick(['We\'ll think on it.', 'Too dear for us, I\'m afraid.', 'It\'s a start. We\'ll talk it over.']), 2.4); O.gesture && O.gesture(v.a, 'shake', 1); } }, 2600); setTimeout(() => { if (NV === v) endNpc(); }, 6000); } } });
      meet(c, 0, 0); meet(a, 1, 1); if (b2) meet(b2, 2, 1); if (near(b.doorX * T, b.doorY * T, 360)) ui(`${c.first} the parish clerk is showing ${a.first}${b2 ? ' and ' + b2.first : ''} round the empty house.`, 'info'); });
    (O.extraLines = O.extraLines || []).push((s, q) => V && q === V.c ? `You are the parish clerk, showing the player round an empty house to let (₳${rent(V.s, V.b)} a week) or to buy (₳${price(V.s, V.b)}). They can say they will take it or buy it.` : NV && (q === NV.a || q === NV.b2) ? 'You have been looking round an empty house with the parish clerk, thinking of taking it.' : '');
    O.ToLet = { vis, place, fetch, decide, get view() { return V; }, get npcView() { return NV; }, get boards() { return boards; }, get fetched() { return fetched; }, get shown() { return shown; }, get taken() { return taken; }, get npcViews() { return npcViews; }, soon: () => { nvAcc = 0; } };
  }
  O.ToLetSetup = { setup };
})();
