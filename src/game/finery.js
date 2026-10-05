// Jewellery. A gold chain, a brooch, a ring, a circlet: wear them (from your satchel) and they show. The
// well-off buy them at the jeweller's when they have money to spare, and wear them; the gentry and the
// royal family have theirs already.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, Ch = O.Char, cur = () => O.SimRef.cur, G = O.Data.GOODS;
    const same = (a, b) => (a || []).join() === (b || []).join();
    // yours: whatever you wear and still have
    O.wearJewels = () => {
      PS.worn = (PS.worn || []).filter((k) => PS.items.includes(k));
      const a = game.player.a; if (!a) return;
      const want = [...PS.worn, ...(PS.garland != null && PS.garland === cur()?.day ? ['garland'] : [])]; if (!same(a.jewels, want)) { a.jewels = want; Ch.invalidate(a); }
    };
    let tk = 0;
    game.hooks.update.push((dt) => { tk -= dt; if (tk > 0) return; tk = 0.5; O.wearJewels(); });

    // theirs: kept on the person, put back on whenever their look is redrawn
    const SP = O.Sim.prototype, _look = SP.refreshLook;
    SP.refreshLook = function (p) { _look.call(this, p); if (p.jewels && p.jewels.length && p.app) p.app.jewels = p.jewels.slice(); };
    const wear = (s, p, k) => { p.jewels = [...new Set([...(p.jewels || []), k])].slice(-3); if (p.app) { p.app.jewels = p.jewels.slice(); Ch.invalidate(p.app); } };
    const done = new WeakSet();
    let lastDay = new WeakMap();
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.people) return;
      // the gentry and the royal family already have theirs
      if (!done.has(s)) {
        done.add(s);
        for (const p of s.people) {
          if (p.jewels && p.jewels.length && p.app && (p.app.jewels || []).join() !== p.jewels.join()) { p.app.jewels = p.jewels.slice(); Ch.invalidate(p.app); } // (after a reload)
          if (p.alive === false || p.age < 14 || p.jewels) continue;
          if (p.royal && !/^(King|Queen)$/.test(p.title || '')) wear(s, p, 'circlet');
          else if (p.gentry || p.lordOf) wear(s, p, p.sex === 'f' ? 'necklace' : 'brooch');
          else if (s.household(p) && s.household(p).money > 260 && p.age >= 20 && (p.id % 3 === 0)) wear(s, p, p.sex === 'f' ? 'necklace' : 'ring');
        }
      }
      // now and then someone with money to spare buys something at the jeweller's
      if (lastDay.get(s) === s.day || s.hour < 10) return; lastDay.set(s, s.day);
      const shop = [...s.biz.values()].find((z) => z.type === 'jeweller'); if (!shop) return;
      const buyers = s.people.filter((p) => p.alive !== false && p.age >= 18 && !p.visitor && (p.jewels || []).length < 2 && (s.household(p)?.money || 0) > 150);
      for (const p of buyers.slice(0, 40)) {
        if (!s.rng.chance(0.04)) continue;
        const k = ['necklace', 'brooch', 'ring', p.gentry ? 'circlet' : 'ring'].find((x) => (shop.stock[x] || 0) >= 1 && !(p.jewels || []).includes(x)); if (!k) continue;
        const price = Math.round((G[k]?.base || 30) * 1.2), hh = s.household(p); if (hh.money < price + 60) continue;
        hh.money -= price; shop.cash += price; shop.stock[k] -= 1; shop.salesToday = (shop.salesToday || 0) + price;
        wear(s, p, k); s.remember(p, `Bought a ${G[k].name.toLowerCase()} at ${shop.name}.`, 'life', 0.8);
        s.log(`${p.first} ${p.sur || ''} bought a ${G[k].name.toLowerCase()} at ${shop.name}.`.replace('  ', ' '), 'economy');
      }
    });
  }
  O.FinerySetup = { setup };
})();
