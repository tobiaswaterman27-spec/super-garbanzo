// Your own trestle on market day. The country folk aren't the only ones who can sell: on a market day,
// set up a trestle in the square and lay out what's in your satchel. Cry your wares and folk drift over;
// they pick things up, ask the price, make you an offer; take it, or hold out for more and see whether they
// pay or walk. The coins are real, and so is the name you make: fair dealing brings them back, sharp
// dealing gets talked about. Pack up when you like, or when the market's over.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState, G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._deal && !q._ystall && !q.visitor && !talking(q) && q.age >= 14;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const isMarket = (s) => O.MarketDay && O.MarketDay.isMarket && O.MarketDay.isMarket(s);
    const inSquare = (s, x, y) => { const sq = s.Z && s.Z.square; if (!sq) return false; const tx = x / T, ty = y / T; return tx >= sq[0] && tx <= sq[2] + 1 && ty >= sq[1] && ty <= sq[3] + 1; };
    const sellable = () => (PS.items || []).filter((k) => G[k] && G[k].base > 0 && !['key'].includes(k));
    let Y = null, sold = 0, takings = 0, walked = 0, cries = 0;
    const rel_ = (q) => { if (!q || !q._ystall) return; q._ystall = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } };
    function packUp(why) { if (!Y) return; const s = Y.s; s.world.props = s.world.props.filter((p) => p !== Y.prop); s.world.dirtyStatics = true; if (Y.buyer) rel_(Y.buyer.q); ui(why || `You fold up your trestle. ${Y.sold} sold, ₳${Y.take} taken.`, 'good'); Y = null; }
    game.hooks.update.push((dt) => { const s = cur(); if (!Y || !s) return; const P = game.player;
      if (Y.s !== s || game.scene || !isMarket(s)) { packUp(isMarket(s) ? null : `The market's over. You pack up: ${Y.sold} sold, ₳${Y.take} taken.`); return; }
      if (!near(Y.x, Y.y + 16, 90)) { packUp(`You leave your trestle, and fold it up: ${Y.sold} sold, ₳${Y.take} taken.`); return; }
      Y.t += dt; Y.pull = Math.max(0, (Y.pull || 0) - dt * 0.02);
      const B = Y.buyer;
      if (B) { B.t += dt; const q = B.q, a = q.agent; if (q.alive === false || B.t > 30) { rel_(q); Y.buyer = null; return; }
        if (B.at) { a.dir = O.dirOf(Y.x - a.x, Y.y - a.y); a.forceAnim = B.t - B.atT < 1.5 ? 'point' : 'idle'; if (!B.asked && B.t - B.atT > 1) { B.asked = true; say(q, pick([`How much for the ${G[B.g].name.toLowerCase()}?`, `Is that ${G[B.g].name.toLowerCase()} good? I'll give you ${B.offer}.`, `${B.offer} for the ${G[B.g].name.toLowerCase()}, and not a penny more.`]), 2.6); }
          if (B.asked && B.t - B.atT > 16) { say(q, 'Hm. I\'ll leave it.', 1.6); walked++; rel_(q); Y.buyer = null; } }
        return; }
      // folk drift over, more often when you've been crying your wares
      Y.next -= dt * (1 + (Y.pull || 0) * 3); if (Y.next > 0) return; Y.next = 6 + Math.random() * 8;
      const goods = sellable(); if (!goods.length) { if (!Y.empty) { Y.empty = true; ui('Your trestle is bare: nothing left to sell.', 'info'); } return; }
      const q = s.people.filter((z) => free(z) && Math.hypot(z.agent.x - Y.x, z.agent.y - Y.y) < 260 && relOf(z).affinity > -0.4)[0]; if (!q) return;
      const g = pick(goods), fair = Math.max(1, Math.round(G[g].base * (O.Market && O.Market.price ? 1 : 1))), offer = Math.max(1, Math.round(fair * (0.7 + Math.random() * 0.25)));
      Y.buyer = { q, g, fair, offer, t: 0, at: false }; q._ystall = true;
      O.Errands.send(s, q, [Math.floor(Y.x / T) + (Math.random() < 0.5 ? -1 : 1), Math.floor(Y.y / T) + 2], { anim: 'idle', secs: 0.2, face: 3, giveUp: game.t + 25, after: (ok) => { if (!Y || !Y.buyer || Y.buyer.q !== q) return; if (!ok) { rel_(q); Y.buyer = null; return; } q.agent.frozen = true; q.agent.path = null; Y.buyer.at = true; Y.buyer.atT = Y.buyer.t; } }); });
    function sell(s, B, price) { const q = B.q; const i = PS.items.indexOf(B.g); if (i < 0) { say(q, 'Sold already? Ah well.', 1.6); rel_(q); Y.buyer = null; return; } PS.items.splice(i, 1); PS.money = (PS.money || 0) + price; Y.sold++; Y.take += price; sold++; takings += price;
      try { const hh = s.household(q); if (hh) { hh.money = Math.max(0, (hh.money || 0) - price); if (hh.pantry && G[B.g].food) hh.pantry[B.g] = (hh.pantry[B.g] || 0) + 1; } } catch (e) { /* */ }
      q.agent.forceAnim = 'give'; setTimeout(() => { if (q.agent) q.agent.forceAnim = 'take'; }, 600); O.sfx && O.sfx('coins', 0.25);
      const r = relOf(q); r.familiar = Math.min(1, (r.familiar || 0) + 0.1); if (price <= B.fair) r.affinity = Math.min(1, r.affinity + 0.04); else if (price > B.fair * 1.3) { r.affinity = Math.max(-1, r.affinity - 0.05); try { s.remember(q, `The stranger sold me ${G[B.g].name.toLowerCase()} at the market, dear.`, 'social', 0.4); } catch (e) { /* */ } }
      if (PS.rep) PS.rep.merchant = Math.max(-1, Math.min(1, (PS.rep.merchant || 0) + (price <= B.fair ? 0.01 : -0.01)));
      setTimeout(() => { rel_(q); if (Y && Y.buyer && Y.buyer.q === q) Y.buyer = null; }, 1600); }
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, s = cur(); if (game.scene || P.locked || !s || !s.world) return null;
      if (!Y) { if (!isMarket(s) || !inSquare(s, P.x, P.y) || !sellable().length) return null; const busy = s.world.props.some((p) => p.kind === 'stall' && Math.hypot(p.x - P.x, p.y - P.y) < 30); if (busy) return null;
        return { type: 'custom', d: 30, prio: 6, x: P.x, y: P.y - 44, label: 'Set up a trestle and sell what you carry', act: () => { const st = { kind: 'stall', x: P.x, y: P.y - 16, seed: 77, v: 2, solid: false, country: s.day, yours: true }; s.world.props.push(st); s.world.dirtyStatics = true; Y = { s, prop: st, x: st.x, y: st.y, t: 0, next: 3, sold: 0, take: 0, buyer: null }; ui('You set up your trestle and lay out your goods. Cry your wares and folk will come.', 'good'); } }; }
      const B = Y.buyer;
      if (B && B.asked) { const a = B.q.agent; if (Math.hypot(a.x - P.x, a.y - P.y) > 70) return null; return { type: 'custom', d: 1, x: a.x, y: a.y - 30, label: `Take ${B.q.first}'s ${B.offer} for the ${G[B.g].name.toLowerCase()}`, act: () => { say(B.q, 'Done.', 1.2); sell(s, B, B.offer); } }; }
      if (!near(Y.x, Y.y + 16, 40)) return null;
      return { type: 'custom', d: 2, x: Y.x, y: Y.y - 30, label: (Y.pull || 0) < 0.3 ? 'Cry your wares' : 'Fold up your trestle', act: () => { if ((Y.pull || 0) < 0.3) { Y.pull = 1; cries++; P.anim = 'talk'; setTimeout(() => { P.anim = 'idle'; }, 1500); const g = sellable()[0]; ui(`"${g ? G[g].name : 'Goods'}! Good ${g ? G[g].name.toLowerCase() : 'goods'}, cheap as you like!"`, 'info'); } else packUp(); } }; });
    // hold out, or name your price, in your own words to the buyer
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) { try { const s = cur(), t = String(text || ''); const B = Y && Y.buyer; if (B && B.q === q && B.asked) { (q._conv ||= []).push({ who: 'p', t }); const say2 = (line) => { q._conv.push({ who: 'q', t: line }); render(line); return Promise.resolve(); };
        const m = t.match(/(\d+)/); const ask = m ? +m[1] : /\b(yes|deal|done|take it|agreed)\b/i.test(t) ? B.offer : null;
        if (ask == null) return say2('Well? Do we have a bargain?');
        if (ask <= B.offer) { setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); sell(s, B, ask); }, 600); return say2('Done, then.'); }
        const p = ask <= B.fair ? 0.85 : ask <= B.fair * 1.3 ? 0.45 : 0.1; if (Math.random() < p) { setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); sell(s, B, ask); }, 600); return say2(ask > B.fair ? 'Robbery! ...Oh, go on.' : `${ask}, then. Fair enough.`); }
        walked++; setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); rel_(q); if (Y && Y.buyer === B) Y.buyer = null; }, 900); return say2(pick(['For that? I can do better over there.', 'You must think I was born yesterday.'])); } } catch (e) { console.error(e); } return _say.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => Y && Y.buyer && Y.buyer.q === q ? `You are at the player's market trestle wanting to buy ${G[Y.buyer.g].name.toLowerCase()}; you offered ${Y.buyer.offer}. It's worth about ${Y.buyer.fair}. If they ask much more, you may walk.` : '');
    O.YourStall = { get stall() { return Y; }, get sold() { return sold; }, get takings() { return takings; }, get walked() { return walked; }, get cries() { return cries; } };
  }
  O.YourStallSetup = { setup };
})();
