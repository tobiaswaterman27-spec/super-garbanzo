// More trades and the goods they make. The builder's yard keeps the town's building stock — seasoned
// timber, dressed stone, planks — and its builders go out to every building site the council or a
// citizen pays for. Weavers turn wool into cloth, tailors cloth into clothes, cobblers leather into
// shoes, chandlers the butcher's tallow into candles, coopers planks into casks. Households buy
// candles through the dark months and new clothes and shoes as the old ones wear out.
'use strict';
(function () {
  const D = O.Data;
  Object.assign(D.GOODS, {
    wool: { name: 'Fleece', base: 3, unit: 'fleece', slots: 1 },
    clothes: { name: 'Wool tunic', base: 22, unit: 'garment', slots: 2 },
    shoes: { name: 'Pair of shoes', base: 12, unit: 'pair', slots: 1 },
    candles: { name: 'Tallow candles', base: 1, unit: 'candle', slots: 1 },
    tallow: { name: 'Tallow', base: 2, unit: 'pound', slots: 1 },
    leather: { name: 'Tanned leather', base: 7, unit: 'hide', slots: 1 },
    cask: { name: 'Oak cask', base: 11, unit: 'cask', slots: 3 },
  });
  Object.assign(D.BUSINESS, {
    builder: { label: "Builder's Yard", jobs: [['master builder', 1], ['builder', 2], ['labourer', 1]], hours: [7, 17], recipes: [{ out: { planks: 0.3 }, inp: { logs: 0.25 }, role: 'labourer' }], sells: ['logs', 'stone', 'planks'], buys: { logs: 'woodcutter|import', stone: 'quarry|mine|import', planks: 'sawmill|import' }, targets: { logs: 30, stone: 30, planks: 16 }, wage: { 'master builder': 0, builder: 7, labourer: 6 } },
    weaver: { label: 'Weaver', jobs: [['weaver', 1], ['spinner', 1]], hours: [7, 18], recipes: [{ out: { cloth: 0.3 }, inp: { wool: 0.5 } }], sells: ['cloth'], buys: { wool: 'import' }, targets: { wool: 16, cloth: 12 }, wage: { weaver: 0, spinner: 5 } },
    tailor: { label: 'Tailor', jobs: [['tailor', 1], ['apprentice', 1]], hours: [8, 18], recipes: [{ out: { clothes: 0.14 }, inp: { cloth: 0.25 } }], sells: ['clothes', 'cloth'], buys: { cloth: 'weaver|warehouse|import' }, targets: { cloth: 8, clothes: 8 }, wage: { tailor: 0, apprentice: 4 } },
    cobbler: { label: 'Cobbler', jobs: [['cobbler', 1]], hours: [8, 18], recipes: [{ out: { shoes: 0.25 }, inp: { leather: 0.3 } }], sells: ['shoes'], buys: { leather: 'import' }, targets: { leather: 8, shoes: 8 }, wage: { cobbler: 0 } },
    chandler: { label: 'Chandler', jobs: [['chandler', 1]], hours: [8, 18], recipes: [{ out: { candles: 3 }, inp: { tallow: 0.5 } }], sells: ['candles'], buys: { tallow: 'butcher|import' }, targets: { tallow: 10, candles: 60 }, wage: { chandler: 0 } },
    cooper: { label: 'Cooper', jobs: [['cooper', 1], ['apprentice', 1]], hours: [7, 17], recipes: [{ out: { cask: 0.15 }, inp: { planks: 0.4 } }], sells: ['cask'], buys: { planks: 'sawmill|builder|import' }, targets: { planks: 8, cask: 6 }, wage: { cooper: 0, apprentice: 4 } },
  });
  // the butcher renders tallow from the fat as well
  const bu = D.BUSINESS.butcher; if (bu && !bu.recipes.some((r) => r.out.tallow)) { bu.recipes.push({ out: { tallow: 0.4 }, inp: {} }); bu.targets.tallow = 10; bu.sells = [...bu.sells, 'tallow']; }
  Object.assign(D.ROLE_OUTFIT, { 'master builder': 'builder', builder: 'builder', weaver: 'villager', spinner: 'villager', tailor: 'merchant', cobbler: 'villager', chandler: 'villager', cooper: 'woodcutter' });

  function installSim(Sim) {
    const S = Sim.prototype, _need = S.shoppingNeed;
    S.shoppingNeed = function (hh) {
      const base = _need.call(this, hh);
      // food comes first, unless the larder already holds a day's bread
      if (base && (hh.pantry.bread || 0) < hh.members.length * 0.8) return base;
      const ok = (g) => !(hh.failed && hh.failed[g] > this.day * 1440 + this.minute);
      const open = (t, g, min = 0) => { const bz = this.supplierOf ? this.supplierOf(t, g, true) : null; return bz && bz.open && (bz.stock[g] || 0) > min ? bz : null; };
      const dark = this.season === 'winter' || this.season === 'autumn';
      // candles for the long evenings
      if (dark && (hh.pantry.candles || 0) < 2 && hh.money > 12 && ok('candles')) { const bz = open('chandler', 'candles', 2); if (bz) return { biz: bz.id, good: 'candles', qty: 6 }; }
      void base;
      // clothes and shoes wear out: a new garment for someone every couple of months, if the purse allows
      hh.wearDay = hh.wearDay ?? this.day + (hh.id * 3) % 18;
      if (this.day >= hh.wearDay && hh.money > 45) {
        const want = (hh.id + this.day) % 2 ? 'clothes' : 'shoes';
        const bz = open(want === 'clothes' ? 'tailor' : 'cobbler', want);
        if (bz && ok(want)) return { biz: bz.id, good: want, qty: 1 };
      }
      return base;
    };
    // the next garment is due a while after one is actually bought
    const _buy = S.buy;
    S.buy = function (p, act) {
      _buy.call(this, p, act);
      if ((act.good === 'clothes' || act.good === 'shoes') && p.task?.act === 'carry-home') { const hh = this.household(p); hh.wearDay = this.day + Math.max(12, 60 - hh.members.length * 6); }
    };
    // candles burn down through the dark evenings
    const _nd = S.newDay;
    S.newDay = function () { _nd.call(this); if (this.season === 'winter' || this.season === 'autumn') for (const hh of this.households) if (hh.pantry.candles) hh.pantry.candles = Math.max(0, hh.pantry.candles - 1); };
  }
  O.Trades = { installSim };
})();
