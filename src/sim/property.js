// Property: ownership, value, rent, debt and eviction; businesses closing, standing empty and being
// reopened (sometimes as a different trade); families' fortunes showing in their houses and clothes;
// and the lordship of Ashford, which the crown will sell to someone rich and respectable enough.
'use strict';
(function () {
  function install(Sim) {
    const S = Sim.prototype;

    S.propertyInit = function () {
      const r = this.rng;
      const houses = this.world.buildings.filter((b) => b.type === 'house' && b.household);
      // the richest two households are landlords: they own a share of the village's houses
      const rich = this.households.filter((h) => !h.gone).sort((a, b) => b.money - a.money).slice(0, 2);
      for (const b of this.world.buildings) { b.owner = b.household ? { kind: 'household', id: b.household } : { kind: 'parish' }; }
      for (const b of houses) {
        if (rich.some((h) => h.id === b.household)) continue;
        if (r.chance(0.35) && rich.length) { const L = r.pick(rich); b.owner = { kind: 'household', id: L.id }; b.rent = Math.max(2, Math.round(this.value(b) / 140)); }
      }
      for (const b of this.world.buildings) if (this.biz.get(b.id)) { const bz = this.biz.get(b.id); b.owner = bz.def.public ? { kind: 'parish' } : { kind: 'household', id: this.households.find((h) => h.home === b.id)?.id || null }; }
      this.lordship = { holder: 'crown', price: 1500 };
    };

    // Value: size, condition, local wealth, location near the square, demand (vacancies)
    S.value = function (b) {
      const size = b.w * b.d * (b.floors || 1);
      const sq = this.Z.square; const cx = (sq[0] + sq[2]) / 2, cy = (sq[1] + sq[3]) / 2;
      const dist = Math.hypot(b.x + b.w / 2 - cx, b.bottom - cy);
      const vacancy = this.world.buildings.filter((x) => x.type === 'house' && !x.household).length;
      const demand = O.clamp(1.2 - vacancy * 0.06, 0.6, 1.3);
      const loc = O.clamp(1.25 - dist / 60, 0.7, 1.25);
      const avgPurse = this.households.filter((h) => !h.gone).reduce((s, h) => s + h.money, 0) / Math.max(1, this.households.filter((h) => !h.gone).length);
      const local = O.clamp(0.7 + avgPurse / 300, 0.7, 1.4);
      return Math.round(size * 14 * (0.5 + (b.condition ?? 0.8) * 0.6) * (0.7 + (b.wealth ?? 0.5) * 0.6) * loc * demand * local);
    };
    S.ownerName = function (o) {
      if (!o || o.kind === 'parish') return 'the parish';
      if (o.kind === 'player') return 'you';
      if (o.kind === 'crown') return 'the crown';
      const hh = this.households[o.id - 1]; return hh ? `the ${hh.surname} family` : 'no one';
    };

    // Weekly: rent is paid (or not), debts grow, evictions happen; houses and clothes follow fortunes
    S.propertyWeekly = function () {
      for (const b of this.world.buildings) {
        if (b.type !== 'house' || !b.household || !b.owner || b.owner.kind === 'parish') continue;
        if (b.owner.kind === 'household' && b.owner.id === b.household) continue;
        const hh = this.households[b.household - 1]; if (!hh || hh.gone) continue;
        const rent = b.rent || 3;
        if (hh.money >= rent) {
          hh.money -= rent; hh.debt = Math.max(0, (hh.debt || 0) - 1);
          if (b.owner.kind === 'player') { O.PlayerState.money += rent; O.PlayerState.rentIncome = (O.PlayerState.rentIncome || 0) + rent; }
          else { const L = this.households[b.owner.id - 1]; if (L) L.money += rent; }
        } else {
          hh.debt = (hh.debt || 0) + rent - Math.max(0, hh.money); hh.money = Math.max(0, hh.money) - Math.max(0, hh.money);
          for (const id of hh.members) { const p = this.byId.get(id); if (p && p.age >= 16) this.remember(p, `We couldn't pay the rent this week. We owe ${hh.debt}d.`, 'hardship', 1.2); }
          if (hh.debt > rent * 4) this.evict(b, hh);
        }
      }
      // visible fortunes: a family's purse slowly shows in its house
      for (const hh of this.households) {
        if (hh.gone) continue; const b = this.building(hh.home); if (!b || b.type !== 'house') continue;
        const target = O.clamp(hh.money / 260, 0.1, 0.95), old = b.wealth;
        b.wealth = +(b.wealth + (target - b.wealth) * 0.2).toFixed(3);
        if (hh.money > 120 && b.condition < 0.95) b.condition = Math.min(1, b.condition + 0.05);
        if (Math.abs(b.wealth - (b._drawnWealth ?? old)) > 0.08) { b.spec.wealth = b.wealth; b._drawnWealth = b.wealth; b.dirty = true; O.Interior && O.Interior.invalidate(b); }
        if (this.weekday === 0 && this.day % 14 === 1) for (const id of hh.members) { const p = this.byId.get(id); if (p && p.agent) this.refreshLook(p); }
      }
    };

    S.evict = function (b, hh) {
      this.log(`The ${hh.surname} family were evicted from their house for ${hh.debt}d of unpaid rent.`, 'economy');
      for (const id of hh.members) { const p = this.byId.get(id); if (p) this.remember(p, `We were thrown out of our house over the rent.`, 'hardship', 3); }
      // they look for another empty house, or leave
      const other = this.world.buildings.find((x) => x.type === 'house' && !x.household && x !== b && (!x.owner || x.owner.kind === 'parish'));
      b.household = null; b.vacant = true;
      if (other && hh.money >= 0) { other.household = hh.id; other.vacant = false; hh.home = other.id; for (const id of hh.members) { const p = this.byId.get(id); if (p) p.home = other.id; } hh.debt = 0; }
      else this.emigrate(hh);
    };

    // Businesses close when they can't pay their way; empty shops can be reopened by the ambitious
    S.businessDaily = function () {
      for (const bz of [...this.biz.values()]) {
        if (bz.def.public || bz.type === 'site') continue;
        bz.badDays = bz.cash < 0 ? (bz.badDays || 0) + 1 : 0;
        if (bz.badDays >= 6 && !bz.closedDown) this.closeDown(bz);
      }
      if (this.rng.chance(0.25)) this.openNewBusiness();
    };
    S.closeDown = function (bz) {
      bz.closedDown = true;
      for (const id of bz.workers) { const p = this.byId.get(id); if (p) { this.remember(p, `${bz.name} has closed. I've lost my place.`, 'hardship', 2); p.job = null; } }
      bz.workers = []; bz.owner = null;
      this.biz.delete(bz.id);
      const b = this.building(bz.id); b.closedShop = { type: bz.type, name: bz.name, day: this.day }; b.owner = { kind: 'parish' };
      this.log(`${bz.name} has closed its doors for good.`, 'economy');
    };
    S.openNewBusiness = function () {
      const empty = this.world.buildings.filter((b) => b.closedShop && !this.biz.get(b.id));
      if (!empty.length) return;
      const founder = this.people.filter((p) => !p.visitor && p.age >= 22 && p.age < 60 && (p.goal === 'open a shop' || p.traits.includes('ambitious')) && this.household(p).money > 80).sort((a, b) => this.household(b).money - this.household(a).money)[0];
      if (!founder) return;
      const b = empty[0];
      // pick the trade the place needs most: what sells dearest, else what it was
      const breadPrice = this.supplierOf('bakery') ? this.price(this.supplierOf('bakery'), 'bread') : 9;
      const type = !this.supplierOf('bakery') || breadPrice >= 4 ? 'bakery' : !this.supplierOf('tavern') ? 'tavern' : b.closedShop.type;
      this.startBusiness(b, type, founder);
    };
    S.startBusiness = function (b, type, owner) {
      const def = O.Data.BUSINESS[type];
      const stock = {}; for (const [g, t] of Object.entries(def.targets)) stock[g] = Math.round(t * 0.3);
      const name = owner && owner !== 'player' ? `${owner.sur}'s ${def.label}` : def.label;
      const bz = { id: b.id, b, type, def, name, owner: null, workers: [], stock, cash: 60, sold: {}, bought: {}, open: false, orders: [], salesToday: 0, history: [] };
      this.biz.set(b.id, bz);
      const repurposed = b.closedShop && b.closedShop.type !== type;
      b.type = type; b.name = name; b.spec.sign = { bakery: 'bread', tavern: 'mug', smithy: 'anvil', store: 'scales', doctor: 'herb' }[type] || b.spec.sign; b.dirty = true; b.closedShop = null;
      O.Interior && O.Interior.invalidate(b);
      if (owner === 'player') { bz.ownerPlayer = true; b.owner = { kind: 'player' }; }
      else if (owner) {
        const hh = this.household(owner); hh.money -= 60;
        if (owner.job) { const old = this.biz.get(owner.job.biz); if (old) old.workers = old.workers.filter((id) => id !== owner.id); }
        owner.job = { biz: b.id, role: def.jobs[0][0] }; owner.skills[owner.job.role] = Math.max(owner.skills[owner.job.role] || 0, 0.35);
        bz.owner = owner.id; bz.workers.push(owner.id); this.refreshLook(owner);
        b.owner = { kind: 'household', id: owner.household };
        this.remember(owner, `I've opened ${name}. God send customers.`, 'life', 3);
        if (owner.goal === 'open a shop') owner.goal = 'become wealthy';
      }
      this.log(repurposed ? `The old ${O.Data.BUSINESS[b.closedShop?.type || type]?.label?.toLowerCase() || 'shop'} has reopened as ${name}.` : `${name} has opened.`, 'economy');
      return bz;
    };
    // player-owned businesses: the master's share of profits goes to the player
    S.playerProfits = function () {
      for (const bz of this.biz.values()) {
        if (!bz.ownerPlayer || bz.cash <= 120) continue;
        const take = Math.floor((bz.cash - 120) * 0.5); bz.cash -= take; O.PlayerState.money += take; O.PlayerState.bizIncome = (O.PlayerState.bizIncome || 0) + take;
      }
    };
  }
  O.Property = { install };
})();
