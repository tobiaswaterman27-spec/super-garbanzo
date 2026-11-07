// Shops with people in them. Through the working day, those with time and a coin or two go into a shop to
// look and buy something small (a candle, a loaf, a ribbon, a nail or two), so the counters see custom
// beyond the weekly marketing. When you're standing in a shop, a few more of them come in.
'use strict';
(function () {
  const SHOPS = new Set(['store', 'chandler', 'tailor', 'smithy', 'carpenter', 'potter', 'cooper', 'weaver', 'cobbler', 'brewery', 'tavern', 'apothecary', 'doctor', 'barber', 'jeweller', 'dyer', 'glazier', 'saddler', 'fletcher']);
  function setup(game) {
    const SP = O.Sim.prototype, _plan = SP.plan, G = O.Data.GOODS;
    // when the bakery's shelves are bare, a house bakes its own at the hearth: a little flour from the
    // mill (or their own oats), and bread by evening
    const _ndB = SP.newDay;
    SP.newDay = function () {
      const r = _ndB.apply(this, arguments);
      try {
        const bakeries = [...this.biz.values()].filter((z) => z.type === 'bakery'), shelf = bakeries.reduce((a, z) => a + (z.stock.bread || 0), 0);
        const mill = [...this.biz.values()].find((z) => z.type === 'mill' && (z.stock.flour || 0) >= 1) || [...this.biz.values()].find((z) => (z.stock.flour || 0) >= 1 && z.type !== 'bakery');
        let baked = 0;
        for (const hh of this.households) {
          if (hh.gone || !hh.members.length || (hh.pantry.bread || 0) >= 2) continue;
          if (shelf > hh.members.length * 2 && hh.money > 8) continue; // (the baker has it; they'll buy)
          if ((hh.pantry.oats || 0) >= 1) { hh.pantry.oats -= 1; hh.pantry.bread = (hh.pantry.bread || 0) + 2; baked++; continue; }
          if (mill && hh.money >= 2 && (mill.stock.flour || 0) >= 1) { const pr = Math.max(1, Math.round((this.price ? this.price(mill, 'flour') : 2) * 0.8)); if (hh.money < pr) continue; hh.money -= pr; mill.cash = (mill.cash || 0) + pr; mill.stock.flour -= 1; hh.pantry.bread = (hh.pantry.bread || 0) + 3; baked++; }
        }
        if (baked >= 5) this.log(`With the bakers' shelves bare, ${baked} households baked their own bread at the hearth.`, 'economy');
      } catch (e) { console.error(e); }
      return r;
    };
    // having bought, they linger a few minutes: look at the goods, pass the time of day with the shopkeeper
    const _buy = SP.buy;
    SP.buy = function (p, act) { const r = _buy.apply(this, arguments); try { if (act && act.browse) p._browse = { b: act.b, until: this.day * 1440 + this.minute + 6 + ((p.id * 7) % 9) }; } catch (e) { /* */ } return r; };
    SP.plan = function (p) {
      const B = p._browse; if (B && p.agent && p.agent.inside === B.b && this.day * 1440 + this.minute < B.until) return { act: 'shop', b: B.b, good: null, qty: 0, browse: true, linger: true };
      if (B) p._browse = null;
      const r = _plan.apply(this, arguments);
      try {
        if (!r || p.visitor || p.age < 14 || p.job?.onShift || p.homefront || p.gang && p.activity?.zone?.startsWith?.('haunt')) return r;
        if (!['stroll', 'socialise', 'idle', 'home', 'rest'].includes(r.act)) return r;
        const h = this.minute / 60; if (h < 9 || h > 17.5) return r;
        const hh = this.household(p); if (!hh || hh.money < 4) return r;
        const hourKey = Math.floor(this.minute / 45);
        const here = game.scene && this === O.SimRef.cur ? this.biz.get(game.scene.b.id) : null;
        const pull = here && SHOPS.has(here.type) && here.def.hours && h >= here.def.hours[0] && h < here.def.hours[1];
        const roll = (p.id * 13 + this.day * 7 + hourKey * 3) % 8;
        if (!(roll === 0 || (pull && roll < 2))) return r;
        const open = [...this.biz.values()].filter((z) => SHOPS.has(z.type) && z.def.hours && h >= z.def.hours[0] && h < z.def.hours[1] - 0.5 && (z.def.sells || []).some((g) => (z.stock[g] || 0) >= 2 && G[g] && !G[g].food && !G[g].drink && (G[g].base || 0) <= hh.money / 3));
        const bz = pull && open.includes(here) ? here : open[(p.id + hourKey) % Math.max(1, open.length)];
        if (!bz) return r;
        const goods = bz.def.sells.filter((g) => (bz.stock[g] || 0) >= 2 && G[g] && !G[g].food && !G[g].drink && (G[g].base || 0) <= hh.money / 3 && !/^(fx|wl|fl|er|rf|yd)_/.test(g)); // (never the bread off the shelf: that's for those who need it)
        if (!goods.length) return r;
        return { act: 'shop', b: bz.id, good: goods[(p.id + this.day) % goods.length], qty: 1, browse: true };
      } catch (e) { return r; }
    };
  }
  O.LivelinessSetup = { setup };
})();
