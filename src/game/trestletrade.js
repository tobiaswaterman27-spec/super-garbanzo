// Buying at the trestle. While a shop is open with its wares laid out by the door, folk passing stop at
// it: they pick things up and turn them over, sniff the loaf, hold the cloth to the light; the keeper comes
// out to stand behind the board; there's a bit of haggling ("Two for that? It's yesterday's!"), the coin
// changes hands, and off they go home with it under the arm. The shop's stock and till, and the buyer's
// purse and pantry, are the real ones.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const jobs = []; let cool = 12, sold = 0, walked = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._trestle && !q._bit && !q._scene && !q._office && !talking(q);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._trestle = false; }
    function drop(j) { rel(j.q); if (j.k) rel(j.k); jobs.splice(jobs.indexOf(j), 1); }
    const LINES = { ask: ['How much for this?', 'Is it fresh?', 'What\'s your best price?', 'I\'ll take one, if the price is right.'], dear: ['That? You\'re having a laugh.', 'It was half that last week!', 'For that I could buy the cow.'], keep: ['Best in the town, that.', 'I can do you a penny off. No more.', 'Take it or leave it, friend.', 'For you, a fair price.'], buy: ['Go on, then.', 'Done.', 'Wrap it, then.'], walk: ['I\'ll think on it.', 'Too dear. Good day.', 'Not today.'] };
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      for (const j of jobs.slice()) { j.t += dt; if (j.s !== s || j.t > 90 || talking(j.q) || (j.k && talking(j.k)) || !j.bz.open) { drop(j); continue; } if (j.phase !== 'at') continue;
        j.u += dt; const qa = j.q.agent, ka = j.k ? j.k.agent : null; qa.dir = 3; if (ka) ka.dir = 0;
        qa.forceAnim = j.u < 2.5 ? 'pickup' : j.u < 4 ? 'look' : j.u < 7 ? 'talk' : j.buys && j.u < 8.5 ? 'give' : j.buys ? 'take' : 'shake';
        if (ka) ka.forceAnim = j.u < 4 ? 'idle' : j.u < 7 ? 'talk' : j.buys && j.u < 8.5 ? 'take' : j.buys ? 'give' : 'shrug';
        const loud = near(qa.x, qa.y, 280);
        if (j.u > 3 && !j.s1) { j.s1 = true; if (loud) O.Speech && O.Speech.say(j.q, pick(LINES.ask), 2); }
        if (j.u > 4.6 && !j.s2) { j.s2 = true; if (loud && j.k) O.Speech && O.Speech.say(j.k, `${j.price} for the ${String(G[j.good]?.name || j.good).toLowerCase()}. ` + pick(LINES.keep), 2.4); }
        if (j.u > 6.4 && !j.s3) { j.s3 = true; if (loud) O.Speech && O.Speech.say(j.q, j.buys ? (Math.random() < 0.4 ? pick(LINES.dear) + ' ... ' : '') + pick(LINES.buy) : pick(LINES.walk), 2.2); }
        if (j.buys && j.u > 8 && !j.paid) { j.paid = true; try { const hh = s.household(j.q); if (hh && hh.money >= j.price && (j.bz.stock[j.good] || 0) > 0) { hh.money -= j.price; j.bz.cash = (j.bz.cash || 0) + j.price; j.bz.stock[j.good]--; if (hh.pantry && ['bread', 'cabbage', 'fish', 'meat', 'flour', 'meal', 'ale', 'firewood', 'wheat'].includes(j.good)) hh.pantry[j.good] = (hh.pantry[j.good] || 0) + 1; sold++; if (loud) O.sfx && O.sfx('coins', 0.25); } else j.buys = false; } catch (e) { j.buys = false; } }
        if (j.u > 10) { const q = j.q, got = j.buys && j.paid, good = j.good; if (!got) walked++; jobs.splice(jobs.indexOf(j), 1); rel(q); if (j.k) rel(j.k);
          if (got) { const hb = s.building(q.home); if (hb && hb.doorX != null) O.Errands.send(s, q, [hb.doorX, hb.doorY + 1], { anim: 'place', secs: 0.8, face: 0, giveUp: game.t + 90, carry: { good, qty: 1 } }); } } }
      cool -= dt; if (cool > 0) return; cool = 35 + Math.random() * 45; if (hr < 8 || hr > 18 || jobs.length >= 3 || !O.ShopDisplay) return;
      const shops = [...s.biz.values()].filter((bz) => bz.open && !bz.def.public && bz.def.sells && bz.def.sells.length && !bz.closedDown && bz.type !== 'tavern' && bz.type !== 'farmhouse' && O.ShopDisplay.spots.get(bz.b?.id ?? bz.id) && !jobs.some((j) => j.bz === bz)).filter((bz) => { const at = O.ShopDisplay.spots.get(bz.b?.id ?? bz.id); return near(at[0], at[1], 420); });
      if (!shops.length) return; const bz = pick(shops), at = O.ShopDisplay.spots.get(bz.b?.id ?? bz.id), b = s.building(bz.b?.id ?? bz.id); const goods = bz.def.sells.filter((k) => (bz.stock?.[k] || 0) > 0 && G[k]); if (!goods.length) return; const good = pick(goods);
      const q = s.people.filter((x) => able(x) && x.age >= 14 && !x.agent.hidden && x.agent.inside == null && !(bz.workers || []).includes(x.id) && x.id !== bz.owner && Math.hypot(x.agent.x - at[0], x.agent.y - at[1]) < 380 && ['stroll', 'idle', 'shop', 'socialise', 'errand'].includes(x.activity?.act || 'idle')).sort(() => Math.random() - 0.5)[0]; if (!q) return;
      let price = 2; try { price = Math.max(1, Math.round(s.price ? s.price(bz, good) : G[good].base)); } catch (e) { /* */ } let buys = false; try { const hh = s.household(q); buys = !!(hh && hh.money >= price + 3 && Math.random() < 0.7); } catch (e) { /* */ }
      q._trestle = true; const j = { s, bz, b, q, k: null, good, price, buys, t: 0, u: 0, phase: 'walk' }; jobs.push(j);
      O.Errands.send(s, q, [Math.floor(at[0] / T), Math.floor(at[1] / T) + 1], { anim: 'idle', secs: 0.1, face: 3, giveUp: game.t + 40, after: (ok) => { if (!jobs.includes(j)) { q._trestle = false; return; } if (!ok) { drop(j); return; } q.agent.frozen = true; q.agent.path = null; q.agent.x = at[0] + (Math.random() - 0.5) * 8; j.phase = 'at'; j.u = 0;
        // the keeper comes out behind the board
        const k = (bz.workers || []).concat(bz.owner != null && bz.owner !== 'player' ? [bz.owner] : []).map((id) => s.byId.get(id)).find((x) => able(x) && (x.agent.inside === b.id || (!x.agent.hidden && x.agent.inside == null && Math.hypot(x.agent.x - at[0], x.agent.y - at[1]) < 200)));
        if (k) { const ka = k.agent; ka.inside = null; ka.hidden = false; ka.x = at[0] + 2; ka.y = at[1] - 14; if (game.solidAt(ka.x, ka.y - 2)) ka.y = at[1] - 8; ka.frozen = true; ka.path = null; k._trestle = true; j.k = k; } } });
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const j = jobs.find((x) => x.q === q || x.k === q); return !j ? '' : j.q === q ? `You have stopped at the trestle outside ${j.bz.name} to look at the ${String(G[j.good]?.name || j.good).toLowerCase()}, and you are haggling over the price.` : `A customer is at your trestle looking at the ${String(G[j.good]?.name || j.good).toLowerCase()}, and you are selling to them.`; });
    O.TrestleTrade = { jobs, get sold() { return sold; }, get walked() { return walked; }, soon: () => { cool = 0; } };
  }
  O.TrestleTradeSetup = { setup };
})();
