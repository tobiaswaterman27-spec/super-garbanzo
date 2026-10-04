// The kingdom: settlements simulated in the abstract (distance level 3), linked by roads, trading by
// caravan, governed from Highmere Castle. Ashford is the one settlement simulated in full; its
// figures come from the detailed simulation.
'use strict';
(function () {
  const GOODS = ['grain', 'iron', 'fish', 'wool', 'timber', 'cloth', 'wine', 'salt'];
  const BASE = { grain: 2, iron: 8, fish: 3, wool: 4, timber: 3, cloth: 10, wine: 8, salt: 5 };

  class Kingdom {
    constructor(sim) {
      this.sim = sim; this.rng = O.RNG((777 + (O.Names ? O.Names.lifeSeed() : 0)) | 0); // each life its own crown and history
      this.treasury = 2400; this.taxRate = 0.08; this.news = []; this.caravans = []; this.councils = [];
      const S = (o) => Object.assign({ wealth: 0.5, food: 1, security: 0.6, happiness: 0.6, crime: 0.2, health: 0.8, dev: 1, guards: 4, prices: {}, stock: {}, gang: 0.05, events: [] }, o);
      // the island of Eldoria: see eldoria.js
      this.places = O.Eldoria.places(S);
      for (const p of this.places) for (const g of GOODS) { p.stock[g] = (p.produces[g] || 0) * 3 + 20; p.prices[g] = BASE[g]; }
      this.roads = O.Eldoria.roads();
    }
    place(id) { return this.places.find((p) => p.id === id); }
    road(a, b) { return this.roads.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)); }
    neighbours(id) { return this.roads.filter((r) => r.a === id || r.b === id).map((r) => (r.a === id ? r.b : r.a)); }
    dist(a, b) { const A = this.place(a), B = this.place(b); return Math.hypot(A.x - B.x, A.y - B.y) * 0.25; } // map units are a quarter-league
    route(a, b) { // BFS by road (few nodes)
      const prev = { [a]: null }, q = [a];
      while (q.length) { const c = q.shift(); if (c === b) break; for (const n of this.neighbours(c)) if (!(n in prev) && !this.road(c, n).damaged) { prev[n] = c; q.push(n); } }
      if (!(b in prev)) return null; const path = []; for (let c = b; c; c = prev[c]) path.unshift(c); return path;
    }
    addNews(text, kind = 'kingdom', place = null) {
      this._last = this._last || {}; const key = kind + ':' + place;
      if (place && ['migration', 'growth', 'decline'].includes(kind) && this._last[key] > this.sim.day - 6) return;
      this._last[key] = this.sim.day;
      this.news.push({ day: this.sim.day, text, kind, place }); if (this.news.length > 60) this.news.shift(); this.sim.log(text, kind === 'rulers' || kind === 'war' ? 'kingdom-' + kind : 'kingdom'); }

    daily() {
      const sim = this.sim, r = this.rng, season = sim.season;
      const ash = this.place('ashford');
      // Ashford's figures come from the detailed simulation
      const pop = sim.people.filter((p) => !p.visitor);
      ash.pop = pop.length; ash.wealth = O.clamp(sim.households.filter((h) => !h.gone).reduce((s, h) => s + h.money, 0) / Math.max(1, sim.households.filter((h) => !h.gone).length) / 200, 0, 1);
      ash.food = O.clamp(1 - pop.filter((p) => p.needs.hunger < 25).length / Math.max(1, pop.length) * 3, 0, 1.5);
      ash.crime = O.clamp(sim.crimes.filter((c) => c.day > sim.day - 7).length / 8, 0, 1);
      ash.health = 1 - pop.filter((p) => p.health.illness).length / Math.max(1, pop.length);
      ash.guards = sim.people.filter((p) => p.job?.role?.startsWith('guard')).length;
      ash.gang = Math.max(...sim.gangs.map((g) => g.influence), 0);
      const seasonal = { spring: 0.6, summer: 1, autumn: 1.5, winter: 0.2 }[season];
      for (const s of this.places) {
        if (!s.detailed) {
          // production and consumption
          for (const [g, q] of Object.entries(s.produces)) s.stock[g] += q * (g === 'grain' || g === 'wine' ? seasonal : 1) * r.float(0.8, 1.2) * (s.happiness > 0.4 ? 1 : 0.7) * (s.events.includes('harvest failed') && g === 'grain' ? 0.3 : 1);
          const need = s.pop / 25;
          const eat = Math.min(need, s.stock.grain); s.stock.grain -= eat; const fish = Math.min(need - eat, s.stock.fish); s.stock.fish -= fish;
          s.food = O.clamp((eat + fish) / need, 0, 1.5);
          s.stock.timber = Math.max(0, s.stock.timber - s.pop / 400); s.stock.cloth = Math.max(0, s.stock.cloth - s.pop / 600);
          // well-being
          s.crime = O.clamp(s.crime + (s.food < 0.8 ? 0.02 : -0.01) + (s.gang - 0.1) * 0.02 - (s.guards / Math.max(1, s.pop / 60) - 1) * 0.01, 0.02, 0.9);
          s.health = O.clamp(s.health + (s.food < 0.7 ? -0.02 : 0.01) + (r.chance(0.01) ? -0.25 : 0), 0.3, 1);
          s.happiness = O.clamp(0.25 + s.food * 0.3 + s.wealth * 0.2 + s.health * 0.2 - s.crime * 0.3 - this.taxRate, 0, 1);
          // migration and growth
          if (s.happiness < 0.38 && s.pop > 40) { const n = Math.ceil(s.pop * 0.01); s.pop -= n; const to = this.place(this.neighbours(s.id).sort((a, b) => this.place(b).happiness - this.place(a).happiness)[0]); if (to && !to.detailed) to.pop += n; if (to && to.detailed && this.sim.immigrateMaybe) this.sim.immigrateMaybe(); this.addNews(`Families are leaving ${s.name}; ${n} more took the road this week to ${to?.name || 'elsewhere'}.`, 'migration', s.id); }
          else if (s.happiness > 0.62 && s.food > 1) s.pop += Math.ceil(s.pop * 0.004);
          s.wealth = O.clamp(s.wealth + (s.happiness - 0.5) * 0.004 + (s.tradeToday || 0) / 5000, 0.05, 1);
          const devT = Math.floor(s.wealth * 4 + s.pop / 1500);
          if (devT > s.dev && r.chance(0.2)) { s.dev++; this.addNews(`${s.name} is growing: a new market hall and houses are going up.`, 'growth', s.id); }
          if (devT < s.dev - 1 && r.chance(0.2)) { s.dev--; this.addNews(`${s.name} is in decline; shops stand empty in the high street.`, 'decline', s.id); }
          s.tradeToday = 0;
          // occasional events
          if (season === 'autumn' && s.produces.grain && r.chance(0.04) && !s.events.includes('harvest failed')) { s.events.push('harvest failed'); this.addNews(`The harvest has failed at ${s.name}. Grain will be dear this winter.`, 'harvest', s.id); }
          if (season !== 'autumn') s.events = s.events.filter((e) => e !== 'harvest failed');
        }
        // prices: base x supply x demand x region
        for (const g of GOODS) {
          const need = g === 'grain' ? s.pop / 25 * 6 : s.pop / 80 + 10;
          const supply = O.clamp(Math.sqrt(need / (s.stock[g] + 1)), 0.5, 3);
          const region = { east: 1.15, west: 1, north: 0.95, south: 0.95 }[s.region];
          s.prices[g] = +(BASE[g] * supply * region).toFixed(1);
        }
      }
      // caravans: surplus goods go where they fetch the best price
      if (r.chance(0.9)) this.spawnCaravan();
      for (const c of this.caravans) this.advanceCaravan(c);
      this.caravans = this.caravans.filter((c) => !c.done);
      // the crown collects taxes
      for (const s of this.places) if (!s.detailed) { const t = s.pop * s.wealth * this.taxRate * 0.05; this.treasury += t; }
      // storms may damage roads/bridges (repair needs a council decision)
      if (sim.weather.kind === 'storm' && r.chance(0.3)) { const rd = r.pick(this.roads.filter((x) => !x.damaged)); if (rd) { rd.damaged = true; this.addNews(`Storm damage has closed the road between ${this.place(rd.a).name} and ${this.place(rd.b).name}.`, 'roads'); } }
      // council each season
      if (sim.weather.dayOfSeason === 3) this.council();
    }

    spawnCaravan() {
      const r = this.rng; const g = r.pick(GOODS);
      const from = this.places.filter((p) => (p.produces[g] || 0) > 0 && p.stock[g] > 40).sort((a, b) => b.stock[g] - a.stock[g])[0];
      if (!from) return;
      const to = this.places.filter((p) => p !== from && p.prices[g] > from.prices[g] * 1.25).sort((a, b) => b.prices[g] - a.prices[g])[0];
      if (!to) return;
      const path = this.route(from.id, to.id); if (!path) return;
      const qty = Math.min(Math.floor(from.stock[g] * 0.5), 80); from.stock[g] -= qty;
      const danger = Math.max(...path.slice(1).map((n, i) => this.road(path[i], n).danger));
      const merchant = r.pick(['Hugh Chapman', 'Alis Mercer', 'Robert Packer', 'Gilbert of Westhaven', 'Joan Draper', 'Walter Vintner', 'Simon Ironside']);
      const c = { id: Math.random().toString(36).slice(2, 7), good: g, qty, from: from.id, to: to.id, path, leg: 0, prog: 0, value: Math.round(qty * from.prices[g]), merchant, guards: danger > 0.25 ? 3 : danger > 0.15 ? 2 : 1, done: false };
      this.caravans.push(c);
    }
    advanceCaravan(c) {
      if (c.held) return;
      const r = this.rng;
      const a = c.path[c.leg], b = c.path[c.leg + 1];
      if (!b) { this.arrive(c); return; }
      const road = this.road(a, b);
      if (road.damaged) { c.path = this.route(a, c.to) || c.path; if (this.road(a, c.path[1] || a)?.damaged) return; }
      c.prog += (0.6 + road.quality * 0.6) / Math.max(1, this.dist(a, b) / 10);
      // bandits on the road (influence of gangs raises the risk)
      const gang = Math.max(...this.sim.gangs.map((g) => g.influence), 0);
      if (r.chance(road.danger * 0.08 + gang * 0.04) && c.guards < 3) { c.done = true; this.robbed(c, 'bandits on the road between ' + this.place(a).name + ' and ' + this.place(b).name); return; }
      // passing through Ashford: the caravan becomes visible on the King's Road
      if (b === 'ashford' && c.prog >= 1 && !c.shown) { c.shown = true; c.held = true; this.sim.caravanArrives && this.sim.caravanArrives(c); return; }
      if (c.prog >= 1) { c.prog = 0; c.leg++; }
    }
    arrive(c) {
      const to = this.place(c.to); to.stock[c.good] += c.qty; to.tradeToday = (to.tradeToday || 0) + c.value;
      const from = this.place(c.from); from.wealth = O.clamp(from.wealth + c.value / 20000, 0, 1);
      c.done = true;
    }
    robbed(c, where) {
      const to = this.place(c.to);
      // merchants grow wary: the roads they use get more dangerous in their eyes, and prices rise
      for (let i = 0; i < c.path.length - 1; i++) { const rd = this.road(c.path[i], c.path[i + 1]); rd.danger = Math.min(0.9, rd.danger + 0.05); }
      to.prices[c.good] = +(to.prices[c.good] * 1.15).toFixed(1);
      this.addNews(`A caravan of ${c.good} bound for ${to.name} was robbed by ${where}. Merchants are hiring more guards.`, 'crime', c.to);
    }

    // The castle council: leaders weigh the kingdom's troubles and vote.
    council() {
      const r = this.rng, sim = this.sim;
      const issues = [];
      for (const s of this.places) {
        if (s.crime > 0.35 || (s.detailed && s.gang > 0.25)) issues.push({ kind: 'security', s, cost: 120, text: `send more men-at-arms to ${s.name}` });
        if (s.food < 0.85) issues.push({ kind: 'food', s, cost: 150, text: `send grain to hungry ${s.name}` });
        if (s.health < 0.6) issues.push({ kind: 'health', s, cost: 100, text: `pay physicians to go to ${s.name}` });
      }
      for (const rd of this.roads) if (rd.damaged || rd.quality < 0.45) issues.push({ kind: 'roads', rd, cost: 200, text: `${rd.damaged ? 'repair' : 'improve'} the road from ${this.place(rd.a).name} to ${this.place(rd.b).name}` });
      const outlaw = O.PlayerState && (O.PlayerState.bounty || (sim.playerGang && sim.playerGang() && sim.playerGang().influence > 0.2));
      if (outlaw) issues.push({ kind: 'bounty', cost: 60, text: 'post a bounty on the outlaws troubling Ashford' });
      if (this.treasury < 600) issues.push({ kind: 'tax', cost: 0, text: 'raise the crown tax' });
      if (!issues.length) { this.addNews('The council met at Highmere Castle and found little to trouble it.', 'politics'); return; }
      const agenda = issues.sort(() => r.next() - 0.5).slice(0, 3);
      const leaders = this.places.filter((p) => p.leader);
      const record = { day: sim.day, items: [] };
      for (const it of agenda) {
        let yes = 0;
        const votes = leaders.map((l) => {
          const PSx = O.PlayerState; if (l.detailed && PSx && (PSx.reeve || PSx.lord)) { const aye = it.kind === (PSx.councilPriority || 'security') || it.s === l || (it.kind !== 'tax' && PSx.councilDefault === 'aye'); if (aye) yes++; return { who: 'you, for Ashford', aye }; }
          let v = 0.45 + (l.priority === it.kind ? 0.35 : 0) + (it.s === l ? 0.3 : 0) - (it.cost > 150 ? 0.1 : 0) - (it.kind === 'tax' ? (l.id === 'highmere' ? -0.4 : 0.25) : 0) + r.float(-0.2, 0.2);
          const aye = v > 0.5; if (aye) yes++; return { who: l.leader, aye };
        });
        const pass = yes > leaders.length / 2 && this.treasury >= it.cost;
        record.items.push({ text: it.text, pass, yes, of: leaders.length, votes });
        if (!pass) continue;
        this.treasury -= it.cost;
        if (it.kind === 'security') { it.s.guards += 2; it.s.crime = Math.max(0.05, it.s.crime - 0.1); if (it.s.detailed) { sim.treasury.cash += 80; const gh = sim.biz.get(sim.guardId); if (gh) gh.def = Object.assign({}, gh.def, { jobs: [gh.def.jobs[0], ['guard', gh.def.jobs[1][1] + 1]] }); } }
        if (it.kind === 'food') { it.s.stock.grain += 200; if (it.s.detailed) { const bk = sim.supplierOf('mill'); if (bk) bk.stock.wheat += 60; } }
        if (it.kind === 'health') { it.s.health = Math.min(1, it.s.health + 0.2); if (it.s.detailed) { const d = sim.biz.get(sim.docId); if (d) { d.stock.medicine += 10; d.cash += 30; } } }
        if (it.kind === 'roads') { it.rd.damaged = false; it.rd.quality = Math.min(1, it.rd.quality + 0.25); }
        if (it.kind === 'bounty') { O.PlayerState.bountyAmount = (O.PlayerState.bountyAmount || 0) + 40; }
        if (it.kind === 'tax') this.taxRate = Math.min(0.15, this.taxRate + 0.02);
      }
      this.councils.push(record);
      const passed = record.items.filter((x) => x.pass).map((x) => x.text);
      this.addNews(passed.length ? `The council at Highmere Castle voted to ${passed.join('; and to ')}.` : `The council at Highmere Castle argued long and agreed nothing.`, 'politics');
      for (const x of record.items.filter((i) => !i.pass)) this.addNews(`The motion to ${x.text} was defeated, ${x.yes} votes to ${x.of - x.yes}.`, 'politics');
    }
  }

  O.Kingdom = Kingdom; O.KGOODS = GOODS;
})();
