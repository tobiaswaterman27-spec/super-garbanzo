// Buying and selling, and the people behind the counter. Every shop sets its own prices: dear, fair or
// cheap (yours you set yourself, in the Business tab or by telling your staff). Households keep to the
// shop they know, but not at any price: if a rival is much cheaper they go there instead, and say so.
// A shopkeeper losing custom to a rival undercuts them; if that rival is you, they bear you a grudge.
// And the year matters: when the harvest fails there is dearth, bread dear for weeks, the poor going
// hungry and some of them stealing; when it comes in well there is plenty, and bread is cheap.
'use strict';
(function () {
  const FOOD = new Set(['bread', 'flour', 'wheat', 'cabbage', 'eggs', 'cheese', 'meat', 'fish', 'ale']);
  const LEVELS = { cheap: 0.8, fair: 1, dear: 1.25 };
  const levelOf = (m) => (m <= 0.88 ? 'cheap' : m >= 1.15 ? 'dear' : 'fair');
  const mine = (bz) => !!(bz && (bz.ownerPlayer || (bz.b && bz.b.owner && bz.b.owner.kind === 'player')));
  O.Market = { mine, LEVELS, levelOf };
  function setup(game) {
    const SP = O.Sim.prototype, PS = O.PlayerState, cur = () => O.SimRef.cur, G = () => O.Data.GOODS;
    const nm = (g) => (G()[g]?.name || g).toLowerCase();
    const times = (s) => (s.dearth && s.day <= s.dearth.until ? 'dearth' : s.plenty && s.day <= s.plenty.until ? 'plenty' : null);

    // the shop's own prices, and the year's
    const _price = SP.price;
    SP.price = function (bz, good) {
      let p = _price.call(this, bz, good) * (bz.markup || 1);
      const t = FOOD.has(good) ? times(this) : null; if (t === 'dearth') p *= ['bread', 'flour', 'wheat'].includes(good) ? 1.8 : 1.3; else if (t === 'plenty') p *= 0.8;
      return Math.max(1, Math.round(p));
    };

    // where a household goes for something: the shop they know, unless another is much cheaper
    const _need = SP.shoppingNeed;
    SP.shoppingNeed = function (hh) {
      const need = _need.call(this, hh); if (!need) return need;
      const bz0 = this.biz.get(need.biz); if (!bz0) return need;
      const alts = [...this.biz.values()].filter((z) => z.type === bz0.type && z.open && (z.stock[need.good] || 0) >= 1 && z.b && z.b.doorX != null);
      if (alts.length < 2) return need;
      hh.fav = hh.fav || {}; const fav = hh.fav[bz0.type];
      const score = (z) => this.price(z, need.good) * (z.id === fav ? 0.8 : 1) * (z.owner != null && hh.members.includes(z.owner) ? 0.5 : 1);
      const best = alts.sort((a, b) => score(a) - score(b))[0];
      if (fav != null && best.id !== fav) {
        const old = this.biz.get(fav), who = hh.members.map((id) => this.byId.get(id)).find((p) => p && p.age >= 16);
        if (old && who) this.remember(who, `Went to ${best.name} for ${nm(need.good)} instead of ${old.name}: ₳${this.price(best, need.good)} against ₳${this.price(old, need.good)}.`, 'economy', 0.7);
      }
      hh.fav[bz0.type] = best.id;
      return Object.assign({}, need, { biz: best.id });
    };

    // each morning a shopkeeper looks at the takings beside the rival's, and moves their prices
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      const byType = new Map();
      for (const bz of this.biz.values()) { if (bz.def.public || !bz.def.sells || !bz.def.sells.length) continue; (byType.get(bz.type) || byType.set(bz.type, []).get(bz.type)).push(bz); }
      for (const list of byType.values()) {
        for (const bz of list) {
          if (mine(bz)) continue; const owner = this.byId.get(bz.owner); if (!owner) continue;
          const rival = list.filter((z) => z !== bz).sort((a, b) => (b.salesYesterday || 0) - (a.salesYesterday || 0))[0];
          const m = bz.markup || 1;
          if (rival && (rival.salesYesterday || 0) > (bz.salesYesterday || 0) * 1.4 + 4 && (rival.markup || 1) <= m) {
            bz.markup = Math.max(0.72, m - 0.07);
            this.remember(owner, `${rival.name} is taking my custom. I've brought my prices down to match.`, 'economy', 1);
            if (mine(rival)) { O.grudge && O.grudge(this, owner, `your shop, ${rival.name}, undercuts mine and steals my custom`, 0.2); }
            else { const ro = this.byId.get(rival.owner); if (ro) this.relate(owner, ro, -0.08); }
          } else if (!rival || (bz.salesYesterday || 0) >= (rival.salesYesterday || 0)) {
            const greedy = this.has(owner, 'greedy'); bz.markup = Math.min(greedy || !rival ? 1.2 : 1.05, m + 0.03);
          }
        }
      }
      // the year: dearth and plenty run their course, and hard times bring hunger and theft
      if (this.harvestFailed != null && this.day - this.harvestFailed <= 1 && !(this.dearth && this.dearth.since === this.harvestFailed)) this.dearth = { since: this.harvestFailed, until: this.harvestFailed + 21 };
      if (times(this) === 'dearth') {
        const bake = this.supplierOf('bakery', 'bread'), price = bake ? this.price(bake, 'bread') : 0;
        for (const hh of this.households || []) {
          if (hh.money > 25) continue; const who = hh.members.map((id) => this.byId.get(id)).filter((p) => p && p.alive !== false);
          for (const p of who) { p.needs && (p.needs.hunger = Math.max(0, (p.needs.hunger ?? 60) - 15)); if (p.age >= 6 && this.rng.chance(0.4)) this.remember(p, `We go hungry. Bread is ₳${price} a loaf since the harvest failed.`, 'hardship', 0.8); }
          const thief = who.find((p) => p.age >= 16 && p.age < 60 && !this.has(p, 'honest') && !p.job);
          if (thief && bake && (bake.stock.bread || 0) >= 3 && this.rng.chance(0.08)) {
            bake.stock.bread -= 2; hh.pantry.bread = (hh.pantry.bread || 0) + 2;
            this.recordCrime && this.recordCrime({ kind: 'theft', perp: thief, placeName: bake.name, tile: [bake.b.doorX, bake.b.doorY], seen: [], severity: 1 });
            this.remember(thief, `Took two loaves from ${bake.name}. The children had to eat.`, 'crime', 1.2);
            this.log(`Bread was taken from ${bake.name} in the night. Hard times make thieves.`, 'crime');
          }
        }
        if (this.day === this.dearth.until) this.log('The worst of the dearth is past. Bread is coming down in price.', 'economy');
      }
      return r;
    };
    // a shop with nothing to sell and nothing sold, day after day, or whose work goes undone, fails
    const _bd = SP.businessDaily;
    if (_bd) SP.businessDaily = function () {
      for (const bz of [...this.biz.values()]) {
        if (bz.def.public || bz.type === 'site' || !bz.def.sells || !bz.def.sells.length || bz.closedDown) continue;
        const empty = bz.def.sells.every((g) => (bz.stock[g] || 0) < 1), idle = (bz.salesYesterday || 0) <= 0;
        bz.neglect = Math.max(0, (bz.neglect || 0) + (empty && idle ? 1 : -1));
        if (bz.neglect === 3 && mine(bz) && this === O.SimRef.cur) O.UI.say(`${bz.name} is failing: nothing to sell and nothing sold for three days.`, 'bad');
        if (bz.neglect >= 6) { this.log(`${bz.name} has failed: its shelves stood empty and its work undone.`, 'economy'); this.closeDown(bz); if (mine(bz)) O.UI.say(`${bz.name} has failed and closed.`, 'bad'); }
      }
      return _bd.apply(this, arguments);
    };
    // a good year: the barns full and bread cheap
    let rolled = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.weather || s.season !== 'autumn' || s.weather.dayOfSeason !== 9 || s.hour < 9 || rolled === s.day) return; rolled = s.day;
      if (s.harvestFailed === s.day) return;
      if (O.RNG(O.hash('plenty', s.world.placeId || 'x', s.day)).chance(0.3)) { s.plenty = { since: s.day, until: s.day + 14 }; s.log('A fine harvest: the barns are full and bread is cheap this autumn.', 'economy'); }
    });

    // what they know of it, for their card
    O.marketLine = (s, q) => {
      const out = [], t = times(s), bake = s.supplierOf('bakery', 'bread');
      if (t === 'dearth') out.push(`Hard times: the harvest failed ${(n => n < 2 ? 'just now' : n + ' days ago')(s.day - s.dearth.since)} and bread is dear${bake ? ` (₳${s.price(bake, 'bread')} a loaf)` : ''}; the poor go hungry.`);
      if (t === 'plenty') out.push(`A good harvest this year: food is plentiful and cheap${bake ? ` (bread ₳${s.price(bake, 'bread')})` : ''}.`);
      const bz = q.job && s.biz.get(q.job.biz);
      if (bz && bz.def.sells && bz.def.sells.length && !bz.def.public) {
        const rivals = [...s.biz.values()].filter((z) => z !== bz && z.type === bz.type);
        out.push(`${bz.name}'s prices are ${levelOf(bz.markup || 1)}${rivals.length ? `; its rival${rivals.length > 1 ? 's' : ''} in town: ${rivals.map((z) => `${z.name} (${levelOf(z.markup || 1)}, ${z.owner === 0 || mine(z) ? "the player's shop" : 'owned by ' + (s.byId.get(z.owner)?.first || 'someone')})`).join(', ')}` : ''}.`);
        if (mine(bz)) out.push(`You work for the player, who owns ${bz.name}. If they tell you to make the prices cheaper, fairer or dearer, do it (set_prices {"level":"cheap"|"fair"|"dear"}).`);
      }
      const hh = s.household(q); if (hh && hh.fav && q.age >= 14) { const f = Object.values(hh.fav).map((id) => s.biz.get(id)).filter(Boolean).map((z) => z.name); if (f.length) out.push(`Your household buys from: ${f.join(', ')}.`); }
      return out.join(' ');
    };
    // telling your staff to change the prices
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'set_prices') { const bz = q.job && s.biz.get(q.job.biz), m = LEVELS[String(a.level || '').toLowerCase()]; if (!bz || !mine(bz) || !m) return null; bz.markup = m; return `${bz.name}'s prices are now ${levelOf(m)}.`; }
      return base.apply(this, arguments);
    };
  }
  O.MarketSetup = { setup };
})();
