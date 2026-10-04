// The living settlement simulation.
//
// Every resident is a Person with a family, a home, maybe a job, a purse shared with their household,
// needs, personality, skills, memories and relationships. Each game minute a person decides what they
// should be doing (schedule by age, job, personality, day of week, need) and physically walks there
// on the tile grid — nobody teleports. Businesses hold real stock, produce goods from inputs while
// staffed, sell at supply-and-demand prices, pay wages, and order supplies that a worker carries
// across the village by hand.
'use strict';
(function () {
  const D = O.Data, G = D.GOODS, Ch = O.Char;
  const WALK = { adult: 38, child: 44, elder: 27 };
  const DAYNAMES = ['Moonday', 'Tewsday', 'Wodensday', 'Thorsday', 'Freyday', 'Saturnday', 'Sunday'];

  class Sim {
    constructor(world, seed = 11, opts = {}) {
      this.world = world; this.T = world.T; this.opts = opts;
      // per-world zones (Ashford's are set in village.js; generated places carry their own)
      this.Z = Object.assign({ square: [38, 23, 54, 29], bench: [37, 23], farm: [7, 56, 33, 61], wood: [34, 4, 44, 12], east: [95, 31], patrol: [[46, 30], [30, 31], [12, 30], [12, 41], [30, 42], [46, 41], [62, 42], [76, 30], [62, 30], [46, 24]] }, world.zones || {});
      this.rng = O.RNG(seed);
      this.path = O.Path.makePathfinder(world);
      this.people = []; this.byId = new Map();
      this.households = []; this.biz = new Map();
      this.treasury = { cash: 400, taxRate: 0.05, income: 0, spent: 0 };
      this.history = [];
      this.day = 1; this.minute = 8 * 60 + 30; this._lastMin = -1;
      this.stats = { sales: 0, wages: 0, produced: {} };
      this.nextId = 1;
      this.weather = new O.Weather(this);
      this.build = new O.Construction(this);
      this.populate();
      this.healthInit(); this.lifeInit();
      this.placeAll();
      this.treasury.cash = Math.round(400 * Math.max(1, this.people.length / 80));
      if (this.world.buildings.some((b) => b.type === 'warehouse')) this.barges = [];
      this.demandScale();
      this.justiceInit();
      this.propertyInit();
      if (opts.foreign) { this.gangs = []; this.kingdom = opts.kingdom; } else { this.gangsInit(); this.kingdom = new O.Kingdom(this); this.kingdom.rulersInit && this.kingdom.rulersInit(); }
      if (opts.day) { this.day = opts.day; this.minute = opts.minute; this._lastMin = -1; this._season = this.season; for (const p of this.people) p.birthday = p.birthday || this.rng.int(1, 56); }
      this._season = this.season;
    }

    // ------------------------------------------------------------------ population
    newPerson(o) {
      const p = Object.assign({
        id: this.nextId++, money: 0, job: null, traits: [], memories: [], rel: new Map(),
        needs: { hunger: 70 + this.rng.int(0, 25), energy: 80, social: 60 }, health: { hp: 100, state: 'healthy', illness: null },
        skills: {}, mood: 0.6, attitude: this.rng.float(-0.4, 0.8), alive: true,
      }, o);
      p.stage = Ch.ageStage(p.age);
      // personality: one trait from up to three opposed pairs
      const pairs = this.rng.pick([[0, 4, 2], [1, 5, 7], [3, 6, 8], [2, 4, 7], [0, 1, 5]]);
      p.traits = pairs.map((k) => this.rng.pick(D.TRAITS[k]));
      p.goal = p.age >= 16 ? this.rng.pick(D.GOALS) : null;
      p.wake = 6 * 60 + this.rng.int(-40, 40) + (p.traits.includes('lazy') ? 40 : 0);
      p.bed = 22 * 60 + this.rng.int(-60, 50) + (p.stage === 'child' ? -90 : 0);
      this.people.push(p); this.byId.set(p.id, p);
      return p;
    }
    has(p, t) { return p.traits.includes(t); }

    populate() {
      const r = this.rng, w = this.world;
      const homeTypes = ['house', 'farmhouse', 'tavern', 'bakery', 'smithy', 'doctor', 'woodcutter', 'mill', 'store', 'sawmill', 'butcher', 'jeweller', 'apothecary', 'carpenter', 'armourer', 'tenement', 'mansion', 'townhouse', 'keep', 'builder', 'weaver', 'tailor', 'cobbler', 'chandler', 'cooper'];
      for (const b of w.buildings) {
        if (D.BUSINESS[b.biz || b.type]) {
          const def = b.jobs ? Object.assign({}, D.BUSINESS[b.biz || b.type], { jobs: b.jobs }) : D.BUSINESS[b.biz || b.type];
          const stock = {}; for (const [g, t] of Object.entries(def.targets)) stock[g] = Math.round(t * r.float(0.5, 0.9));
          this.biz.set(b.id, { id: b.id, b, type: b.type, def, name: b.name, owner: null, workers: [], stock, cash: def.public ? 0 : r.int(80, 160), sold: {}, bought: {}, open: false, orders: [], salesToday: 0, history: [] });
        }
        if (!homeTypes.includes(b.type)) continue;
        // one small cottage stands empty, on the parish register to let
        if (b.type === 'house' && !this._leftEmpty && b.w * b.d <= 9 && (b.floors || 1) === 1) { this._leftEmpty = true; b.vacant = true; b.parishLet = true; continue; }
        // household size from floor area and wealth
        const area = b.w * b.d * b.floors;
        const flats = b.type === 'tenement' ? Math.max(2, Math.floor(area / 15)) : 1;
        const big = !!w.city; // cities: smaller households so the streets stay walkable
        for (let flat = 0; flat < flats; flat++) {
        const size = b.type === 'house' || b.type === 'tenement' ? O.clamp(Math.round((b.type === 'tenement' ? 3 : area / (big ? 8 : 5)) + r.int(-1, 1)), 1, 7) : b.type === 'mansion' || b.type === 'keep' ? r.int(3, 5) : r.int(2, 4);
        const hh = { id: this.households.length + 1, home: b.id, members: [], pantry: { bread: r.int(2, 6), cabbage: r.int(1, 4), firewood: r.int(2, 5) }, money: Math.round((b.type === 'keep' ? 2500 : b.type === 'mansion' ? 400 : b.type === 'tenement' ? 10 : 20) + b.wealth * 120 * r.float(0.6, 1.4)), surname: r.pick(D.NAMES.sur) };
        if (b.lordly && this.lordFamily) { this.lordFamily(b, hh, r); continue; }
        if (b.type === 'bakery') hh.surname = 'Hobb'; if (b.type === 'farmhouse') hh.surname = 'Marsh';
        this.households.push(hh); b.household = b.household || hh.id; (b.households = b.households || []).push(hh.id);
        // build a family: a couple or a single adult, children, sometimes an elder
        const headAge = r.int(24, 58);
        const region = w.region;
        const single = size === 1 || r.chance(0.15);
        const mk = (sex, age, genes) => this.newPerson({ sex, age, first: r.pick(D.NAMES[sex]), sur: hh.surname, household: hh.id, home: b.id, genes: genes || Ch.randomGenes(r, region), wealth: b.wealth });
        const a1 = mk(r.chance(0.5) ? 'm' : 'f', headAge);
        hh.members.push(a1.id);
        let a2 = null;
        if (!single) { a2 = mk(a1.sex === 'm' ? 'f' : 'm', O.clamp(headAge + r.int(-5, 5), 18, 80)); hh.members.push(a2.id); a1.spouse = a2.id; a2.spouse = a1.id; }
        let left = size - hh.members.length;
        if (left > 0 && headAge > 40 && r.chance(0.3)) { const e = mk(r.chance(0.5) ? 'm' : 'f', headAge + r.int(22, 30)); e.sur = hh.surname; hh.members.push(e.id); left--; e.elderOf = a1.id; }
        const mum = a1.sex === 'f' ? a1 : a2, dad = a1.sex === 'm' ? a1 : a2;
        const kids = [];
        for (let k = 0; k < left; k++) {
          const maxAge = Math.max(0, headAge - 18);
          const age = Math.max(0, Math.min(maxAge, r.int(0, 19)));
          const genes = mum && dad ? Ch.inheritGenes(r, mum.genes, dad.genes) : Ch.inheritGenes(r, a1.genes, Ch.randomGenes(r, region));
          const c = mk(r.chance(0.5) ? 'm' : 'f', age, genes);
          hh.members.push(c.id); kids.push(c.id);
          c.parents = [a1.id, a2?.id].filter(Boolean);
        }
        a1.children = kids; if (a2) a2.children = kids;
        }
      }
      // jobs: business owners come from the household living there; others hired from the village
      const adults = () => this.people.filter((p) => !p.job && !p.gentry && p.age >= 16 && p.age < 66);
      for (const bz of this.biz.values()) {
        const hh = this.households.find((h) => h.home === bz.id);
        for (const [role, n] of bz.def.jobs) {
          for (let i = 0; i < n; i++) {
            let cand = null;
            const isOwnerRole = bz.def.wage[role] === 0;
            if (hh && isOwnerRole) cand = hh.members.map((id) => this.byId.get(id)).find((p) => !p.job && p.age >= 20 && p.age < 66);
            if (!cand) {
              const pool = adults().filter((p) => (role === 'apprentice' ? p.age < 22 : role.startsWith('guard') ? p.age < 50 : true));
              cand = pool.length ? r.pick(pool) : null;
            }
            if (!cand) continue;
            cand.job = { biz: bz.id, role };
            cand.skills[role] = role === 'apprentice' ? r.float(0.1, 0.3) : r.float(0.35, 0.95);
            cand.shift = role.startsWith('guard') ? (bz.workers.length % 2 ? 'night' : 'day') : 'day';
            if (isOwnerRole) bz.owner = cand.id;
            bz.workers.push(cand.id);
          }
        }
      }
      // a couple of carters/porters who carry deliveries for the village
      for (let i = 0; i < 2; i++) { const pool = adults(); if (pool.length) { const c = r.pick(pool); c.job = { biz: null, role: 'porter' }; c.skills.porter = 0.5; } }
      for (const p of this.people) {
        const role = p.job ? D.ROLE_OUTFIT[p.job.role] || 'villager' : p.age < 13 ? 'child' : 'villager';
        p.app = Ch.makeAppearance(O.hash('person', p.id, p.first), { sex: p.sex, age: p.age, genes: p.genes, role, wealth: this.world.buildings.find((b) => b.id === p.home)?.wealth ?? 0.4, region: this.world.region });
        p.name = `${p.first} ${p.sur}`;
      }
      this.log(`${this.world.name} counts ${this.people.length} souls in ${this.households.length} households.`);
    }

    // ------------------------------------------------------------------ helpers
    building(id) { return this.world.buildings.find((b) => b.id === id); }
    entry(b) { return [b.doorX, b.doorY]; }
    tileCenter(tx, ty, p) { const j = p ? ((p.id * 7) % 5) - 2 : 0; return [tx * this.T + 8 + j * 2, ty * this.T + 10 + ((p?.id || 0) % 3)]; }
    get hour() { return this.minute / 60; }
    festival() { return this.season === 'autumn' && this.weather && this.weather.dayOfSeason === 10; }
    get raining() { return this.weather ? this.weather.raining : false; }
    get season() { return this.weather ? this.weather.season : 'summer'; }
    get weekday() { return (this.day - 1) % 7; }
    log(text, kind = 'event') { this.history.push({ day: this.day, minute: Math.floor(this.minute), text, kind }); if (this.history.length > 400) this.history.shift(); }
    remember(p, text, kind = 'event', strength = 1, about = null) {
      p.memories.unshift({ day: this.day, text, kind, strength, about });
      if (p.memories.length > 30) p.memories.pop();
    }
    relate(a, b, d) { const r = a.rel.get(b.id) || { affinity: 0, familiar: 0 }; r.affinity = O.clamp(r.affinity + d, -1, 1); r.familiar = Math.min(1, r.familiar + 0.05); a.rel.set(b.id, r); }

    // Stock targets: the farm and mill build a reserve through autumn to last the winter.
    // Big places need bigger stocks: food trades scale their targets to the people they serve.
    demandScale() {
      this._demand = {}; const pop = this.people.length;
      for (const type of ['bakery', 'store', 'mill', 'farmhouse', 'woodcutter', 'butcher', 'tavern']) {
        const n = [...this.biz.values()].filter((bz) => bz.type === type).length; if (n) this._demand[type] = O.clamp(pop / (90 * n), 1, 4);
      }
    }
    target(bz, good) {
      const t = (bz.def.targets[good] || 10) * ((this._demand && this._demand[bz.type]) || 1);
      if ((bz.type === 'farmhouse' && (good === 'wheat' || good === 'cabbage')) || (bz.type === 'mill' && good === 'wheat')) {
        const m = { spring: 2, summer: 1.5, autumn: 6, winter: 5 }[this.season]; return t * m;
      }
      return t;
    }
    price(bz, good) {
      const target = this.target(bz, good), stock = bz.stock[good] || 0;
      const owner = this.byId.get(bz.owner);
      let m = O.clamp(Math.sqrt(target / (stock + 1)), 0.6, 2.5);
      if (owner && this.has(owner, 'greedy')) m *= 1.15; if (owner && this.has(owner, 'generous')) m *= 0.9;
      return Math.max(1, Math.round(G[good].base * m));
    }
    // The (first) business of a type; with a good, the one holding most of it — towns with several
    // bakeries spread their custom; with openOnly, only those trading right now.
    supplierOf(type, good, openOnly) {
      let best = null;
      for (const bz of this.biz.values()) { if (bz.type !== type || (openOnly && !bz.open)) continue; if (!good) return bz; if (!best || (bz.stock[good] || 0) > (best.stock[good] || 0)) best = bz; }
      return best;
    }

    // ------------------------------------------------------------------ schedule
    // Decide what a person should be doing right now. Returns { act, b?, tile?, outdoor? }.
    plan(p) {
      const h = this.hour, m = this.minute, wd = this.weekday;
      const home = p.home;
      if (p.health.illness && p.task?.act !== 'help' && p.task?.act !== 'escort') { const hpl = this.healthMinute(p); if (hpl) return hpl; }
      if (p.task) return p.task;
      // night watchmen guard valuable premises through the dark hours and sleep by day
      if (p.job?.role === 'night watchman' && this.biz.get(p.job.biz)) { if (h >= 20 || h < 6) return { act: 'work', b: p.job.biz }; if (h >= 8 && h < 15.5) return { act: 'sleep', b: home }; }
      const asleep = m < p.wake || m >= p.bed;
      if (asleep) return { act: 'sleep', b: home };
      const ev = this.eventPlan(p); if (ev) return ev;
      // the harvest festival: the square fills from mid-afternoon
      if (this.festival() && h >= 15 && h < 21.5 && p.age >= 3 && !(p.job?.role?.startsWith('guard') && (p.id % 2))) return { act: 'festival', outdoor: true, zone: 'square' };
      // children's lessons at the chapel on weekday mornings; the priest teaches letters
      if (wd !== 6 && h >= 9 && h < 12 && p.age >= 6 && p.age <= 12 && (p.id + this.day) % 5 !== 0) return { act: 'lessons', b: this.schoolId || this.chapelId };
      const gp = this.gangPlan(p); if (gp) return gp;
      const sunday = wd === 6;
      if (sunday && h >= 9 && h < 10.5 && p.age >= 6) return { act: 'worship', b: this.chapelId };
      if (sunday && h >= 6.5 && h < 8.8 && this.household(p).shopper === p.id) { const need = this.shoppingNeed(this.household(p)); if (need) return { act: 'shop', b: need.biz, good: need.good, qty: need.qty }; }
      if (sunday && p.job?.role === 'baker' && h >= 5.5 && h < 9) return { act: 'work', b: p.job.biz };
      const job = p.job;
      // the household shopper slips out on the lunch break if the pantry is low
      if (h >= 12 && h < 12.75 && !sunday && this.household(p).shopper === p.id) {
        const need = this.shoppingNeed(this.household(p));
        if (need) return { act: 'shop', b: need.biz, good: need.good, qty: need.qty };
      }
      if (job && job.biz) {
        const bz = this.biz.get(job.biz);
        let [o, c] = bz ? bz.def.hours : [0, 0];
        if (bz && bz.type === 'site') {
          if (h >= o && h < c && !sunday && !(h >= 12 && h < 12.75)) return this.weather.severe ? { act: 'home', b: home } : { act: 'build', outdoor: true, zone: 'site', site: bz.id };
        } else if (!bz) { /* job vanished */ }
        else
        if (job.role.startsWith('guard')) { const day = p.shift === 'day'; const on = day ? h >= 6 && h < 18 : h >= 18 || h < 6; if (on) return job.role === 'guard' && (Math.floor(m / 90) + p.id) % 2 === 0 ? { act: 'patrol', outdoor: true } : { act: 'work', b: bz.id }; }
        else if (!(sunday && bz.type !== 'tavern' && bz.type !== 'chapel')) {
          if (bz.type === 'bakery' && job.role === 'baker') o = 4.5;
          if (this.has(p, 'lazy')) o += 0.5;
          if (h >= o && h < c && !(h >= 12 && h < 12.75 && bz.type !== 'tavern')) {
            // farm and woodcutting happen outside in the fields / woods
            const harsh = this.weather.severe || (this.weather.kind === 'heat' && h >= 12 && h < 15) || this.season === 'winter';
            if (!harsh && (bz.type === 'farmhouse' && job.role !== 'farmer' || bz.type === 'farmhouse' && h > 7 && h < 11)) return { act: 'fieldwork', outdoor: true, zone: 'farm' };
            if (harsh && bz.type === 'farmhouse' && job.role !== 'farmer') return { act: 'home', b: home };
            if (bz.type === 'woodcutter' && h > 8 && h < 16 && !this.weather.severe) return { act: 'chop', outdoor: true, zone: 'wood' };
            if (job.role === 'herbalist' && h > 9 && h < 15 && !this.raining) return { act: 'forage', outdoor: true, zone: 'wood' };
            return { act: 'work', b: bz.id };
          }
        }
      }
      if (job && job.role === 'porter' && h >= 7 && h < 18 && !sunday) return { act: 'wait-work', outdoor: true, zone: 'square' };
      if (job && job.role === 'servant' && h >= 8 && h < 17 && !(h >= 12 && h < 12.75)) return { act: 'service', b: job.house };
      // meals
      if (this.raining && (this.has(p, 'cautious') || this.weather.severe) && !(job && job.biz)) return { act: 'home', b: home };
      if (h >= 12 && h < 12.75 && p.needs.hunger < 75) return this.has(p, 'social') && this.household(p).money > 30 ? { act: 'eat-out', b: this.tavernId } : { act: 'eat', b: home };
      // children
      if ((p.stage === 'child' || p.stage === 'olderChild') && !(this.household(p).shopper === p.id && h >= 9 && h < 16 && this.shoppingNeed(this.household(p)))) {
        if (h >= 8.5 && h < 17.5 && !this.raining) return { act: 'play', outdoor: true, zone: p.id % 3 ? 'square' : 'home' };
        return { act: 'home', b: home };
      }
      if (p.stage === 'baby') return { act: 'home', b: home };
      // shopping for the household when the pantry is running low
      const hh = this.household(p);
      if (h >= 9 && h < 17.5 && p.age >= 10 && hh.shopper === p.id) {
        const need = this.shoppingNeed(hh);
        if (need) return { act: 'shop', b: need.biz, good: need.good, qty: need.qty };
      }
      // evenings: the sociable go to the tavern
      if (h >= 18.5 && h < 22 && p.age >= 18 && (this.has(p, 'social') || p.needs.social < 35) && hh.money > 10 && !this.raining) return { act: 'socialise', b: this.tavernId };
      if (h >= 17.5 && h < 19 && p.needs.hunger < 70) return { act: 'eat', b: home };
      // elders like the square bench on fine mornings
      if (p.stage === 'elder' && h >= 9.5 && h < 11.5 && !this.raining) return { act: 'sit', outdoor: true, zone: 'bench' };
      if (!job && p.age >= 16 && h >= 9 && h < 16 && !this.raining && (p.id + this.day) % 3 === 0) return { act: 'stroll', outdoor: true, zone: 'square' };
      return { act: 'home', b: home };
    }

    household(p) { return this.households[p.household - 1] || (p._purse = p._purse || { money: 200, pantry: {}, members: [p.id] }); }
    shoppingNeed(hh) {
      const n = hh.members.length;
      const ok = (g) => !(hh.failed && hh.failed[g] > this.day * 1440 + this.minute);
      const openNow = (bz) => bz && bz.open;
      if (hh.pantry.bread < n * (this.weekday === 5 ? 2.5 : 1.2) && ok('bread')) { const bz = this.supplierOf('bakery', 'bread', true); if (openNow(bz) && (bz.stock.bread || 0) > 0) return { biz: bz.id, good: 'bread', qty: n * (this.weekday === 5 ? 3 : 2) }; }
      if (hh.pantry.cabbage < Math.ceil(n / 2) && ok('cabbage')) { const bz = this.supplierOf('store', 'cabbage', true); if (openNow(bz) && (bz.stock.cabbage || 0) > 0) return { biz: bz.id, good: 'cabbage', qty: n }; }
      if ((hh.pantry.meat || 0) < 1 && hh.money > 50 && ok('meat')) { const bz = this.supplierOf('butcher', 'meat', true); if (openNow(bz) && (bz.stock.meat || 0) > 2) return { biz: bz.id, good: 'meat', qty: Math.ceil(n / 2) }; }
      if ((hh.pantry.fish || 0) < 1 && ok('fish')) { const bz = this.supplierOf('store', 'fish', true); if (openNow(bz) && (bz.stock.fish || 0) > 2) return { biz: bz.id, good: 'fish', qty: n }; }
      if (hh.pantry.firewood < 2 && ok('firewood')) { const bz = this.supplierOf('store', 'firewood', true); if (openNow(bz) && (bz.stock.firewood || 0) > 0) return { biz: bz.id, good: 'firewood', qty: 4 }; }
      return null;
    }

    zoneTile(p, zone) {
      const r = O.RNG(O.hash(p.id, this.day, Math.floor(this.minute / 25)));
      const w = this.world;
      const free = (x, y) => !w.solid[y * w.W + x];
      const pick = (x0, y0, x1, y1) => { for (let k = 0; k < 20; k++) { const x = r.int(x0, x1), y = r.int(y0, y1); if (free(x, y)) return [x, y]; } return [46, 29]; };
      switch (zone) {
        case 'square': {
          // in a big place most people loaf near their own street rather than all in one market
          if (this.people.length > 220 && p.home && (p.id * 7 + this.day) % 5 < 3) { const b = this.building(p.home); if (b) return pick(b.x - 2, b.bottom + 1, b.x + b.w + 1, b.bottom + 3); }
          return pick(...this.Z.square);
        }
        case 'home': { const b = this.building(p.home); return pick(b.x - 1, b.bottom + 1, b.x + b.w, b.bottom + 2); }
        case 'bench': return this.Z.bench;
        case 'farm': return pick(...this.Z.farm);
        case 'wood': return pick(...this.Z.wood);
        case 'site': { const b = this.building(p.activity?.site ?? p.job?.biz); if (!b) return [46, 29]; return pick(b.x - 1, b.bottom + 1, b.x + b.w, b.bottom + 2); }
        default: return pick(...this.Z.square);
      }
    }
    patrolTile(p) {
      const route = this.Z.patrol;
      const k = (Math.floor(this.minute / 12) + p.id) % route.length;
      return route[k];
    }

    // ------------------------------------------------------------------ placement & movement
    placeAll() {
      this.tavernId = this.world.buildings.find((b) => b.type === 'tavern').id;
      this.docId = this.world.buildings.find((b) => b.type === 'doctor').id;
      this.chapelId = this.world.buildings.find((b) => b.type === 'chapel').id;
      this.schoolId = this.world.buildings.find((b) => b.type === 'school')?.id || null;
      for (const hh of this.households) { const adults = hh.members.map((id) => this.byId.get(id)).filter((p) => p.age >= 16); hh.shopper = (adults.find((p) => !p.job) || adults[adults.length - 1] || {}).id; }
      for (const p of this.people) {
        p.agent = { x: 0, y: 0, dir: 0, anim: 'idle', ft: Math.random() * 3, a: p.app, hidden: true, inside: p.home, path: null, goal: null, person: p };
        const pl = this.plan(p);
        if (pl.b) { p.agent.inside = pl.b; p.agent.hidden = true; const [ex, ey] = this.entry(this.building(pl.b)); [p.agent.x, p.agent.y] = this.tileCenter(ex, ey, p); }
        else { const t = pl.act === 'patrol' ? this.patrolTile(p) : this.zoneTile(p, pl.zone); p.agent.inside = null; p.agent.hidden = false; [p.agent.x, p.agent.y] = this.tileCenter(t[0], t[1], p); }
        p.activity = pl;
      }
    }

    speedOf(p) { if (p.task?.act === 'to-doctor' || p.task?.act === 'escort') return 18; const base = p.stage === 'elder' ? WALK.elder : p.age < 13 ? WALK.child : WALK.adult; const w = this.weather; return base * (w && w.snowCover > 0.4 ? 0.78 : w && w.wet > 0.6 ? 0.9 : 1); }

    // dtm: elapsed game minutes this frame
    tick(dtm) {
      if (dtm <= 0) return;
      this.minute += dtm;
      this.weather.tick(dtm);
      while (this.minute >= 1440) { this.minute -= 1440; this.day++; this.newDay(); }
      const curMin = Math.floor(this.minute);
      // per-minute logic (catch up when fast-forwarding, capped)
      let steps = (curMin - this._lastMin + 1440) % 1440;
      if (this._lastMin < 0) steps = 1;
      steps = Math.min(steps, 30);
      for (let s = 0; s < steps; s++) { this._m = (this._lastMin < 0 ? curMin : (this._lastMin + 1 + s) % 1440); this.minuteTick(); }
      this._lastMin = curMin;
      for (const p of this.people) this.move(p, dtm);
    }

    minuteTick() {
      const h = this.hour;
      for (const bz of this.biz.values()) {
        const [o, c] = bz.def.hours; const wasOpen = bz.open;
        bz.open = this.weekday === 6 && bz.type !== 'tavern' && !bz.def.public ? (bz.type === 'bakery' && h >= 6 && h < 9) : h >= o && h < c;
        if (bz.open && !wasOpen) this.openBusiness(bz);
        if (!bz.open && wasOpen) this.closeBusiness(bz);
        if (bz.open && this._m % 90 === 0) this.openBusiness(bz);
        if (bz.def.public && this._m === 18 * 60) this.payWages(bz);
        for (const o of bz.orders) if (o.waiting && this._m % 20 === 0) { o.waiting = false; this.assignDelivery(o); }
        // an errand whose carrier was called away (a fire, a fight, a move) goes back on the list
        if (this._m % 60 === 30 && bz.orders.length) for (const o of bz.orders) if (!o.waiting && !this.people.some((q) => q.task?.order === o)) o.waiting = true;
      }
      for (const p of this.people) this.personMinute(p);
      this.build.tickMinute();
      const mm = this._m;
      if (mm % 60 === 0) this.healthHourly();
      if (this.barges && mm % 10 === 0) this.bargesLand();
      if (this.barges && mm === 17 * 60 && this.weekday !== 6) this.quayExport();
      for (const p of this.people) if (p.task?.emigrating && !p.agent.path && p.agent.x > (this.Z.east[0] - 2) * this.T) { this.people = this.people.filter((q) => q !== p); (this.departed = this.departed || []).push(p); }
      if (mm === 2 * 60) this.npcCrimeNightly();
      if (mm === 2 * 60 + 30) this.gangNight();
      if (mm === 6 * 60 + 30) this.labourMarket();
      if (mm === 7 * 60 && !this.opts.foreign) this.marketDay();
      if (mm === 18 * 60 + 5) this.endCasualDay();
      if (mm === 18 * 60 + 30) this.parishRelief();
    }

    // Each morning people without work look for a day's labour where an employer can pay for it.
    labourMarket() {
      if (this.weekday === 6) return;
      const seekers = this.people.filter((p) => !p.visitor && !p.job && p.age >= 14 && p.age < 63 && this.household(p).money < 80 && !p.arriving);
      const employers = [...this.biz.values()].filter((bz) => !bz.def.public && bz.type !== 'tavern' && (bz.type !== 'farmhouse' || this.season !== 'winter'));
      let hired = 0;
      for (const p of seekers) {
        const bz = employers.filter((b) => b.cash > 45 + b.workers.length * 6 && b.workers.filter((id) => this.byId.get(id)?.job?.casual).length < (b.type === 'site' ? 3 : Math.min(4, 1 + Math.floor(b.cash / 90)))).sort((a, c) => c.cash - a.cash)[0];
        if (!bz) break;
        p.job = { biz: bz.id, role: bz.type === 'site' ? 'builder' : 'labourer', casual: true };
        p.skills[p.job.role] = p.skills[p.job.role] || 0.3;
        bz.workers.push(p.id); hired++;
      }
      // the city quays: the warehouse takes on dockers to unload the barges, as many as it can pay
      const wh = this.barges && this.supplierOf('warehouse');
      if (wh) {
        const free = this.people.filter((p) => !p.visitor && !p.job && p.age >= 15 && p.age < 58 && this.household(p).money < 60 && !p.arriving && p.stage !== 'elder');
        const n = Math.min(free.length, 60, Math.floor((wh.cash - 40) / 8));
        for (let i = 0; i < n; i++) { const p = free[i]; p.job = { biz: wh.id, role: 'docker', casual: true }; wh.workers.push(p.id); hired++; }
      }
      // well-off households take on servants for the day: one for every 200d they hold, up to four
      for (const hh of this.households) {
        if (hh.gone || hh.money < 180) continue;
        const b = this.building(hh.home); if (!b) continue;
        const want = Math.min(4, Math.floor(hh.money / 200));
        for (let k = 0; k < want; k++) {
          const p = this.people.find((q) => !q.visitor && !q.job && q.age >= 14 && q.age < 60 && q.household !== hh.id && this.household(q).money < 60);
          if (!p) break;
          p.job = { biz: null, role: 'servant', house: b.id, payer: hh.id, casual: true, wage: hh.money > 600 ? 6 : 4 }; hired++;
          if (!p._servedNoted) { p._servedNoted = true; this.remember(p, `Found work in service with the ${hh.surname} household.`, 'work', 1); }
        }
      }
      if (hired) this.log(`${hired} ${this.people.length > 220 ? 'townsfolk' : 'villagers'} found a day's labour.`, 'economy');
    }
    endCasualDay() {
      for (const p of this.people) if (p.job?.role === 'servant') { const payer = this.households[p.job.payer - 1]; const w = Math.min(p.job.wage, Math.max(0, Math.floor(payer.money))); payer.money -= w; this.household(p).money += w; this.stats.wages += w; p.job = null; }
      for (const p of this.people) if (p.job?.casual) { const bz = this.biz.get(p.job.biz); if (bz) bz.workers = bz.workers.filter((id) => id !== p.id); p.job = null; }
    }
    // The council adjusts the sales tax to keep the treasury solvent; it's unpopular either way.
    taxPolicy() {
      const t = this.treasury, old = t.taxRate;
      if (t.cash < 120 && t.taxRate < 0.15) t.taxRate = Math.min(0.15, t.taxRate + 0.02);
      else if (t.cash > 500 && t.taxRate > 0.04) t.taxRate = Math.max(0.04, t.taxRate - 0.01);
      if (t.taxRate !== old) {
        this.log(`The council ${t.taxRate > old ? 'raised' : 'lowered'} the market tax to ${Math.round(t.taxRate * 100)} pence in the shilling-score.`, 'politics');
        for (const p of this.people) if (p.age >= 18 && this.rng.chance(0.25)) this.remember(p, `The council ${t.taxRate > old ? 'raised' : 'cut'} the market tax.`, 'politics', 0.7);
      }
    }
    // A family arrives when there are empty houses and work to be had.
    immigrateMaybe() {
      const empty = this.world.buildings.filter((b) => b.type === 'house' && !b.site && !b.household && !b.leasedToPlayer && !b.parishLet && b.owner?.kind !== 'player');
      if (!empty.length) return;
      const openJobs = [...this.biz.values()].reduce((n, bz) => n + bz.def.jobs.reduce((m, [role, k]) => m + Math.max(0, k - bz.workers.filter((id) => this.byId.get(id)?.job?.role === role).length), 0), 0);
      const prosperity = this.households.filter((h) => !h.gone).reduce((s, h) => s + h.money, 0) / Math.max(1, this.households.filter((h) => !h.gone).length);
      if (openJobs < 1 && prosperity < 60) return;
      if (!this.rng.chance(0.5)) return;
      this.immigrate(this.rng.pick(empty));
    }
    immigrate(b) {
      const r = this.rng, region = r.pick(['east', 'north', 'west', 'south']);
      const hh = { id: this.households.length + 1, home: b.id, members: [], pantry: { bread: 4, cabbage: 2, firewood: 4 }, money: r.int(50, 130), surname: r.pick(D.NAMES.sur) };
      this.households.push(hh); b.household = hh.id; b.vacant = false;
      const mk = (sex, age, genes) => { const p = this.newPerson({ sex, age, first: r.pick(D.NAMES[sex]), sur: hh.surname, household: hh.id, home: b.id, genes: genes || Ch.randomGenes(r, region), wealth: 0.5 }); p.name = `${p.first} ${p.sur}`; p.birthday = r.int(1, O.Life.YEAR()); hh.members.push(p.id); return p; };
      const a = mk('m', r.int(22, 44)), c = r.chance(0.8) ? mk('f', r.int(20, 40)) : null;
      if (c) { a.spouse = c.id; c.spouse = a.id; }
      const kids = c ? Array.from({ length: r.int(0, 3) }, () => mk(r.chance(0.5) ? 'm' : 'f', r.int(0, 12), Ch.inheritGenes(r, c.genes, a.genes))) : [];
      a.children = kids.map((k) => k.id); if (c) c.children = a.children;
      hh.shopper = (c || a).id;
      for (const p of [a, c, ...kids].filter(Boolean)) {
        p.app = Ch.makeAppearance(O.hash('person', p.id, p.first), { sex: p.sex, age: p.age, genes: p.genes, role: p.age < 13 ? 'child' : 'villager', wealth: 0.5, region });
        p.agent = { x: (95 - (p.id % 3)) * this.T, y: 31 * this.T - (p.id % 2) * 6, dir: 1, anim: 'walk', ft: 0, a: p.app, hidden: false, inside: null, path: null, goal: null, person: p, carrying: p === a ? { good: 'logs', qty: 1 } : null };
        p.task = { act: 'move-in', b: b.id };
        this.remember(p, `We came from the ${region} to make a new life in ${this.world.name}.`, 'life', 2);
      }
      this.log(`The ${hh.surname} family have come from the ${region} to settle in an empty house in ${this.world.name}.`, 'migration');
      return hh;
    }

    // The parish feeds households that have neither food nor money, paid from the treasury.
    parishRelief() {
      if (!this.supplierOf('bakery')) return;
      let fed = 0;
      for (const hh of this.households) {
        if (hh.gone || hh.money >= 12 || hh.pantry.bread >= 1) continue;
        const bk = this.supplierOf('bakery', 'bread');
        const loaves = Math.min(hh.members.length * 2, Math.floor(bk.stock.bread || 0)); // a day's bread: two loaves a head
        const cost = loaves * this.price(bk, 'bread');
        if (!loaves || this.treasury.cash < cost) continue;
        bk.stock.bread -= loaves; bk.cash += cost; this.treasury.cash -= cost; this.treasury.spent += cost;
        hh.pantry.bread += loaves; fed++;
        for (const id of hh.members) { const q = this.byId.get(id); if (q && q.age >= 13) this.remember(q, 'The parish gave us bread when we had nothing.', 'hardship', 1); }
      }
      if (fed) this.log(`Parish relief bought bread for ${fed} destitute ${fed === 1 ? 'family' : 'families'}.`, 'politics');
    }

    personMinute(p) {
      const a = p.agent;
      // needs drift
      p.needs.hunger = Math.max(0, p.needs.hunger - 0.055);
      // a packed lunch: anyone out of the house at midday eats bread they took from home that morning
      if (!p.visitor && p._lunch !== this.day && this._m >= 12 * 60 && this._m < 13 * 60 && a.inside !== p.home && p.needs.hunger < 55 && p.age >= 5) {
        const hh = this.household(p); if (hh && this.eatAtHome(p, hh, 55)) p._lunch = this.day;
      }
      p.needs.social = Math.max(0, p.needs.social - 0.02);
      const pl = this.plan(p);
      const changed = !p.activity || pl.act !== p.activity.act || pl.b !== p.activity.b || pl.zone !== p.activity.zone;
      if (changed) { p.activity = pl; a.goal = null; a.path = null; a.wait = 0; if (pl.b && a.inside === pl.b) this.onEnter(p, pl.b); }
      const act = p.activity;
      if (act.act === 'collapsed') { a.path = null; a.goal = null; a.anim = 'lie'; return; }
      if (act.act === 'help' && a.goal && !a.path && a.inside == null) { this.helpArrive(p); return; }
      if (act.act === 'investigate' && a.goal && !a.path && a.inside == null) { this.investigate(p); return; }
      // indoor activity in progress
      if (act.b && a.inside === act.b) {
        this.doIndoor(p, act);
        return;
      }
      // outdoor activity at destination
      if (act.outdoor && !a.path && a.goal && a.inside == null) {
        a.wait = (a.wait || 0) + 1;
        this.doOutdoor(p, act);
        if (a.wait > (act.act === 'sit' ? 90 : act.act === 'patrol' ? 2 : act.act === 'chop' || act.act === 'fieldwork' || act.act === 'forage' || act.act === 'build' || act.act === 'gangmeet' ? 40 : act.act === 'festival' ? 25 : 18)) { a.goal = null; a.wait = 0; }
        return;
      }
      if (!a.path && !a.goal) this.route(p, act);
    }

    route(p, act) {
      const a = p.agent;
      let target;
      if (act.b) { const b = this.building(act.b); target = this.entry(b); a.goalB = act.b; }
      else { target = act.act === 'patrol' ? this.patrolTile(p) : this.zoneTile(p, act.zone); a.goalB = null; }
      // leave the building we're in
      if (a.inside != null) {
        const b = this.building(a.inside); const [ex, ey] = this.entry(b);
        [a.x, a.y] = this.tileCenter(ex, ey, p); a.inside = null; a.hidden = false;
      }
      const sx = Math.floor(a.x / this.T), sy = Math.floor((a.y - 1) / this.T);
      a.goal = target;
      if (sx === target[0] && sy === target[1]) { a.path = []; a.pi = 0; return; }
      const path = this.path.find(sx, sy, target[0], target[1]);
      if (!path) { a.path = null; a.goal = null; if (act.b) { a.inside = act.b; a.hidden = true; this.onEnter(p, act.b); } return; }
      a.path = path; a.pi = 0;
    }

    move(p, dtm) {
      const a = p.agent;
      if (a.hidden) return;
      if (a.frozen) { a.anim = a.talking ? 'talk' : 'idle'; return; }
      if (a.chasing) return;
      if (!a.path) { a.anim = this.idleAnim(p); return; }
      let budget = this.speedOf(p) * dtm;
      while (budget > 0 && a.path) {
        if (a.pi >= a.path.length) { this.arrive(p); break; }
        const [tx, ty] = a.path[a.pi];
        const [gx, gy] = this.tileCenter(tx, ty, a.pi === a.path.length - 1 ? p : null);
        const dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy);
        if (d <= budget) { a.x = gx; a.y = gy; budget -= d; a.pi++; }
        else { a.x += (dx / d) * budget; a.y += (dy / d) * budget; budget = 0; }
        if (d > 0.01) a.dir = O.dirOf(dx, dy);
      }
      if (a.path) a.anim = a.carrying ? 'carry' : p.activity?.act === 'play' && p.id % 2 ? 'run' : 'walk';
    }

    idleAnim(p) {
      const act = p.activity?.act;
      if (act === 'sit') return 'sit';
      if (act === 'collapsed') return 'lie';
      if (act === 'fieldwork') return this.season === 'spring' ? 'dig' : 'work';
      if (act === 'chop' || act === 'build') return 'work';
      if (act === 'festival') { const k = (p.id + Math.floor(this.minute / 7)) % 5; return p.age < 13 ? (k % 2 ? 'run' : 'celebrate') : k === 0 ? 'celebrate' : k === 1 ? 'drink' : k === 2 ? 'talk' : 'idle'; }
      if (act === 'cry') return 'point';
      if (act === 'forage') return 'crouch';
      if (act === 'gangmeet') return p.agent.talking ? 'talk' : 'idle';
      if (act === 'wait-work' || act === 'stroll') return p.agent.talking ? 'talk' : 'idle';
      if (p.agent.talking) return 'talk';
      return 'idle';
    }

    arrive(p) {
      const a = p.agent; a.path = null;
      if (a.goalB != null) { a.inside = a.goalB; a.hidden = true; a.enteredAt = this.minute; this.onEnter(p, a.goalB); }
      else { a.wait = 0; if (p.activity?.act === 'sit') a.dir = 0; }
    }

    onEnter(p, bid) {
      const act = p.activity; const t = p.task;
      if (t && t.act === 'pickup' && bid === t.b) this.pickup(p);
      else if (t && t.act === 'deliver' && bid === t.b) this.deliver(p);
      else if (act.act === 'shop') this.buy(p, act);
    }

    // eat from the household pantry if hungry enough; returns whether anything was eaten
    eatAtHome(p, hh, below) {
      if (p.needs.hunger >= below || !(hh.pantry.bread > 0 || hh.pantry.cabbage > 0 || hh.pantry.fish > 0 || hh.pantry.meat > 0)) return false;
      if (hh.pantry.meat > 0 && p.needs.hunger < 40) hh.pantry.meat -= 1; else if (hh.pantry.bread > 0) hh.pantry.bread -= p.age < 13 ? 0.5 : 1; else if (hh.pantry.fish > 0) hh.pantry.fish -= 1; else if (hh.pantry.cabbage > 0) hh.pantry.cabbage -= 1; else hh.pantry.meat -= 1;
      hh.pantry.bread = Math.max(0, hh.pantry.bread); p.needs.hunger = Math.min(100, p.needs.hunger + 45);
      return true;
    }
    doIndoor(p, act) {
      const hh = this.household(p);
      // anyone at home — sick in bed, moving in, resting — is fed from the pantry when hungry
      if (p.agent.inside === p.home && act.act !== 'eat' && act.act !== 'home') this.eatAtHome(p, hh, 30);
      if (p.task?.act === 'move-in' && p.agent.inside === p.task.b) { p.task = null; p.arriving = false; p.agent.carrying = null; }
      switch (act.act) {
        case 'sleep': p.needs.energy = Math.min(100, p.needs.energy + 0.2); break;
        case 'eat': case 'home':
          if (!this.eatAtHome(p, hh, 55) && p.needs.hunger < 15 && !p._hungryNoted) { p._hungryNoted = true; this.remember(p, 'There was nothing to eat at home.', 'hardship', 1); }
          if (p.spouse && this.byId.get(p.spouse)?.agent.inside === p.home) p.needs.social = Math.min(100, p.needs.social + 0.15);
          break;
        case 'eat-out': {
          const bz = this.biz.get(act.b);
          if (!p._ateOut && bz && bz.stock.meal >= 1) { const pr = this.price(bz, 'meal'); if (hh.money >= pr) { this.sale(bz, 'meal', 1, pr, hh); p.needs.hunger = Math.min(100, p.needs.hunger + 60); p._ateOut = true; } }
          break;
        }
        case 'socialise': {
          const bz = this.biz.get(act.b);
          p.needs.social = Math.min(100, p.needs.social + 0.25);
          if (bz && this._m % 45 === 0 && (bz.stock.ale || 0) >= 1) { const pr = this.price(bz, 'ale'); if (hh.money >= pr) this.sale(bz, 'ale', 1, pr, hh); }
          if (bz && p.needs.hunger < 50 && (bz.stock.meal || 0) >= 1) { const pr = this.price(bz, 'meal'); if (hh.money >= pr) { this.sale(bz, 'meal', 1, pr, hh); p.needs.hunger = Math.min(100, p.needs.hunger + 60); } }
          // meet others in the tavern
          if (this.rng.chance(0.03)) {
            const others = this.people.filter((q) => q !== p && q.agent.inside === act.b && q.activity?.act === 'socialise');
            if (others.length) { const q = this.rng.pick(others); this.relate(p, q, 0.04); this.relate(q, p, 0.04); this.gossip(p, q); if (!p.rel.get(q.id) || p.rel.get(q.id).familiar < 0.1) this.remember(p, `Shared a jug with ${q.name} at ${this.building(this.tavernId)?.name || 'the tavern'}.`, 'social', 0.6, q.id); }
          }
          break;
        }
        case 'work': this.work(p); break;
        case 'worship': p.needs.social = Math.min(100, p.needs.social + 0.1); break;
        case 'lessons': p.literacy = Math.min(1, (p.literacy || 0) + 0.0004); p.needs.social = Math.min(100, p.needs.social + 0.05); break;
        case 'feast': p.needs.social = Math.min(100, p.needs.social + 0.3); if (p.needs.hunger < 70) p.needs.hunger = Math.min(100, p.needs.hunger + 0.5); break;
        case 'shop': break;
        default: break;
      }
    }

    doOutdoor(p, act) {
      if (act.act === 'fieldwork' || act.act === 'chop' || act.act === 'forage' || act.act === 'build') this.work(p);
      if ((act.act === 'stroll' || act.act === 'wait-work' || act.act === 'gangmeet') && this.rng.chance(0.01)) {
        const near = this.people.find((q) => q !== p && !q.agent.hidden && Math.hypot(q.agent.x - p.agent.x, q.agent.y - p.agent.y) < 30);
        if (near) { this.relate(p, near, 0.02); p.agent.talking = 20; }
      }
      if (p.agent.talking) p.agent.talking--;
    }

    // ------------------------------------------------------------------ economy
    work(p) {
      const bz = this.biz.get(p.job.biz); if (!bz) return;
      if (bz.type === 'site') return this.build.work(p, bz);
      const role = p.job.role; const sk = p.skills[role] || 0.3;
      const seasonal = bz.type === 'farmhouse' ? { spring: 0.55, summer: 1, autumn: 1.5, winter: 0.15 }[this.season] * (this.weather.kind === 'heat' ? 0.8 : 1) : 1;
      p.skills[role] = Math.min(1, sk + 0.00004 * (this.has(p, 'ambitious') ? 1.6 : 1));
      p.needs.energy = Math.max(0, p.needs.energy - 0.04);
      for (const rc of bz.def.recipes) {
        if (rc.role && rc.role !== role) continue;
        // output scaled by skill: beginners work at half the pace of masters
        // (in a city a trade's premises hold more ovens and hands than we simulate one by one)
        const rate = ((0.5 + sk * 0.75) / 60) * seasonal * ((this._demand && this._demand[bz.type]) || 1);
        const room = Object.keys(rc.out).filter((g) => (bz.stock[g] || 0) < (bz.def.targets[g] ? this.target(bz, g) : 99) * 1.4);
        if (!room.length) continue;
        let ok = true; for (const [g, q] of Object.entries(rc.inp)) if ((bz.stock[g] || 0) < q * rate) ok = false;
        if (!ok) { if (!bz._shortNoted) { bz._shortNoted = true; this.log(`${bz.name} ran short of ${Object.keys(rc.inp).map((g) => G[g].name.toLowerCase()).join(' and ')}.`, 'economy'); } continue; }
        for (const [g, q] of Object.entries(rc.inp)) bz.stock[g] -= q * rate;
        for (const [g, q] of Object.entries(rc.out)) { if (!room.includes(g)) continue; bz.stock[g] = (bz.stock[g] || 0) + q * rate; this.stats.produced[g] = (this.stats.produced[g] || 0) + q * rate; }
      }
    }

    sale(bz, good, qty, unitPrice, hh) {
      const total = unitPrice * qty;
      bz.stock[good] -= qty; hh.money -= total;
      const tax = total * this.treasury.taxRate; this.treasury.cash += tax; this.treasury.income += tax;
      bz.cash += total - tax; bz.salesToday += total; bz.sold[good] = (bz.sold[good] || 0) + qty;
      this.stats.sales += total;
    }

    buy(p, act) {
      const bz = this.biz.get(act.b), hh = this.household(p);
      if (!bz || !bz.open) { hh.failed = hh.failed || {}; hh.failed[act.good] = this.day * 1440 + this.minute + 60; this.remember(p, `${bz?.name || 'The shop'} was shut when I went for ${G[act.good].name.toLowerCase()}.`, 'hardship', 0.5); return; }
      const pr = this.price(bz, act.good);
      const affordable = Math.floor(hh.money / pr);
      const qty = Math.min(act.qty, Math.floor(bz.stock[act.good] || 0), affordable);
      if (qty <= 0) { hh.failed = hh.failed || {}; hh.failed[act.good] = this.day * 1440 + this.minute + (affordable <= 0 ? 600 : 120); this.remember(p, affordable <= 0 ? `Couldn't afford ${G[act.good].name.toLowerCase()} at ${pr}d.` : `${bz.name} had no ${G[act.good].name.toLowerCase()} left.`, 'hardship', 1); p.task = null; return; }
      this.sale(bz, act.good, qty, pr, hh);
      if (pr > G[act.good].base * 1.6) this.remember(p, `${G[act.good].name} has gone up to ${pr}d at ${bz.name}.`, 'economy', 0.8);
      // carry the goods home in person
      p.task = { act: 'carry-home', b: p.home, good: act.good, qty };
      p.agent.carrying = { good: act.good, qty };
    }

    openBusiness(bz) {
      // reorder inputs that are running low: the supplier sends a worker or porter with the goods
      for (const [good, srcType] of Object.entries(bz.def.buys || {})) {
        const target = this.target(bz, good);
        if ((bz.stock[good] || 0) > target * 0.45) continue;
        if (bz.orders.some((o) => o.good === good)) continue;
        const types = srcType.split('|');
        // try each local supplier in turn: if the first has nothing to spare, the next may
        const locals = types.filter((t) => t !== 'import' && t !== 'none' && this.supplierOf(t));
        if (!locals.length) { if (types.includes('import')) this.queueImport(bz, good, target - (bz.stock[good] || 0)); continue; }
        const src = locals.map((t) => this.supplierOf(t, good)).filter((x) => x && x !== bz).sort((a, b) => (b.stock[good] || 0) - (a.stock[good] || 0))[0]; if (!src) continue;
        const qty = Math.min(Math.round(target - (bz.stock[good] || 0)), Math.floor((src.stock[good] || 0) * 0.7));
        // nothing to spare locally: a town on the river or the high road buys it in instead
        if (types.includes('import') && this.barges) {
          const want = target - (bz.stock[good] || 0);
          if (qty < want * 0.6) this.queueImport(bz, good, want - Math.max(0, qty));
          if (qty < 2) continue;
        }
        if (qty < 1 && good === 'tools' && (src.stock[good] || 0) >= 1) { /* single tool orders are fine */ }
        else if (qty < 2 && good !== 'tools') { if (bz._wantNoted !== this.day + good) { bz._wantNoted = this.day + good; this.log(`${bz.name} wanted ${G[good].name.toLowerCase()} but ${src.name} had none to spare.`, 'economy'); } continue; }
        const order = { good, qty, from: src.id, to: bz.id, price: this.price(src, good), id: Math.random() };
        bz.orders.push(order);
        this.assignDelivery(order);
      }
    }
    closeBusiness(bz) { if (!bz.def.public) this.payWages(bz); }
    payWages(bz) {
      // pay wages at closing
      for (const wid of bz.workers) {
        const w = this.byId.get(wid); if (!w) continue;
        const wage = bz.def.wage[w.job.role] || (w.job.manager ? 8 : w.job.casual ? 5 : 0); if (!wage) continue;
        const hh = this.household(w);
        if (bz.def.public) {
          const pay = Math.max(0, Math.min(wage, Math.floor(this.treasury.cash)));
          this.treasury.cash -= pay; this.treasury.spent += pay; hh.money += pay; this.stats.wages += pay;
          if (pay < wage) { this.remember(w, `The council couldn't pay my wages in full (${pay}d of ${wage}d).`, 'hardship', 1); w.mood -= 0.1; }
          continue;
        }
        const paid = Math.max(0, Math.min(wage, Math.floor(bz.cash)));
        bz.cash -= paid; hh.money += paid; this.stats.wages += paid;
        if (paid < wage) { this.remember(w, `${bz.name} could only pay ${paid}d of my ${wage}d.`, 'hardship', 1); w.mood -= 0.1; }
      }
      // owners take a share of profit
      const owner = this.byId.get(bz.owner);
      if (owner && bz.cash > 120) { const take = Math.floor((bz.cash - 120) * 0.5); bz.cash -= take; this.household(owner).money += take; }
      else if (!owner && !bz.def.public && bz.cash > 150) {
        // no master: the workers share what's left over after a reserve
        const ws = bz.workers.map((id) => this.byId.get(id)).filter((w) => w && !w.job?.casual);
        if (ws.length) { const pot = Math.floor((bz.cash - 150) * 0.5), each = Math.floor(pot / ws.length); if (each > 0) { for (const w of ws) this.household(w).money += each; bz.cash -= each * ws.length; } }
      }
      bz.history.push({ day: this.day, sales: bz.salesToday }); if (bz.history.length > 14) bz.history.shift();
      bz.salesToday = 0; bz._shortNoted = false;
    }

    assignDelivery(order) {
      const src = this.biz.get(order.from);
      // prefer an idle porter, then a non-owner worker of the supplier
      const porters = this.people.filter((p) => p.job?.role === 'porter' && !p.task && p.activity?.act === 'wait-work');
      const workers = src.workers.map((id) => this.byId.get(id)).filter((p) => p && p.id !== src.owner && !p.task);
      const who = porters[0] || workers[0] || this.byId.get(src.owner);
      if (!who || who.task) { order.waiting = true; return; }
      who.task = { act: 'pickup', b: src.id, order };
      this.remember(who, `Sent to fetch ${order.qty} ${G[order.good].unit}s of ${G[order.good].name.toLowerCase()} for ${this.biz.get(order.to).name}.`, 'work', 0.4);
    }
    pickup(p) {
      const o = p.task.order, src = this.biz.get(o.from), dst = this.biz.get(o.to);
      const qty = src && dst ? Math.min(o.qty, Math.floor(src.stock[o.good] || 0)) : 0;
      if (qty <= 0) { p.task = null; if (dst) dst.orders = dst.orders.filter((x) => x !== o); return; }
      src.stock[o.good] -= qty; o.qty = qty;
      p.task = { act: 'deliver', b: o.to, order: o };
      p.agent.carrying = { good: o.good, qty };
    }
    deliver(p) {
      const o = p.task.order, dst = this.biz.get(o.to), src = this.biz.get(o.from);
      // the shop closed (or the supplier did) while the goods were on the road
      if (!dst || !src) { if (src) src.stock[o.good] = (src.stock[o.good] || 0) + o.qty; p.task = null; p.agent.carrying = null; return; }
      dst.stock[o.good] = (dst.stock[o.good] || 0) + o.qty;
      const cost = Math.round(o.qty * o.price);
      const pay = Math.min(cost, Math.max(0, Math.floor(dst.cash)));
      dst.cash -= pay; src.cash += pay; src.salesToday += pay;
      if (p.job?.role === 'porter') { const fee = 2; dst.cash -= fee; this.household(p).money += fee; }
      if (pay < cost) this.log(`${dst.name} could not pay ${src.name} in full for ${G[o.good].name.toLowerCase()} (${pay}d of ${cost}d).`, 'economy');
      dst.orders = dst.orders.filter((x) => x !== o);
      p.task = null; p.agent.carrying = null;
      this.log(`${p.name} delivered ${o.qty} ${G[o.good].name.toLowerCase()} from ${src.name} to ${dst.name}.`, 'trade');
    }

    // Surplus is sold to the travelling trader and leaves for other towns; money comes into Ashford.
    exports(tr) {
      const deals = [];
      for (const bz of this.biz.values()) {
        if (bz.def.public || bz.type === 'site') continue;
        for (const g of ['wheat', 'cabbage', 'logs', 'firewood', 'tools', 'flour']) {
          const tgt = bz.def.targets[g] && this.target(bz, g); if (!tgt || !bz.def.sells.includes(g)) continue;
          const surplus = Math.floor((bz.stock[g] || 0) - tgt * 0.9);
          if (surplus < 3) continue;
          const pr = Math.max(1, Math.round(G[g].base * 0.85)), pay = surplus * pr;
          bz.stock[g] -= surplus; bz.cash += pay; bz.salesToday += pay; this.stats.exports = (this.stats.exports || 0) + pay;
          deals.push(`${surplus} ${G[g].name.toLowerCase()} from ${bz.name}`);
        }
      }
      const toll = Math.round(deals.length * 4 + (this.stats.exportsToday = 0));
      if (deals.length) { this.treasury.cash += toll; this.treasury.income += toll; }
      if (deals.length) this.log(`${tr.name} paid ${toll}d in bridge tolls and bought ${deals.join(', ')} to sell in other towns.`, 'trade');
    }
    marketDay() {
      if (this.trader || this.weekday !== 4) return;
      this.queueImport(null, null, 0);
    }

    // Each evening the city's surplus goes down to the quay: the warehouse merchants buy what the
    // workshops made beyond their needs and ship it downriver, paying dockers from their margin.
    quayExport() {
      const wh = this.supplierOf('warehouse'); if (!wh) return;
      let value = 0, lots = 0;
      for (const bz of this.biz.values()) {
        if (bz.def.public || bz.type === 'site' || bz === wh) continue;
        for (const g of bz.def.sells) {
          if (g === 'meal' || !bz.def.targets[g]) continue;
          const surplus = Math.floor((bz.stock[g] || 0) - this.target(bz, g) * 0.9); if (surplus < 2) continue;
          const pay = surplus * Math.max(1, Math.round(G[g].base * 0.85));
          bz.stock[g] -= surplus; bz.cash += pay; bz.salesToday += pay; value += pay; lots++;
        }
      }
      if (!value) return;
      const margin = Math.round(value * 0.4), toll = Math.round(value * 0.05);
      wh.cash += margin; this.treasury.cash += toll; this.treasury.income += toll; this.stats.exports = (this.stats.exports || 0) + value;
      if (this.rng.chance(0.3)) this.log(`${lots} lots of the city's wares went downriver from the quay, worth ${value}d.`, 'trade');
    }
    bargesLand() {
      const now = this.day * 1440 + this.minute, wh = this.supplierOf('warehouse');
      for (const o of this.barges.filter((x) => x.at <= now)) {
        this.barges = this.barges.filter((x) => x !== o);
        const bz = this.biz.get(o.b); if (!bz) continue;
        const unit = Math.ceil(G[o.good].base * 1.3), pay = Math.min(o.qty, Math.max(0, Math.floor(bz.cash / unit)));
        if (pay <= 0) { if (bz.def.public) { bz.stock[o.good] = (bz.stock[o.good] || 0) + o.qty; } continue; }
        bz.stock[o.good] = (bz.stock[o.good] || 0) + pay; bz.cash -= pay * unit; bz.bought[o.good] = (bz.bought[o.good] || 0) + pay;
        if (wh && wh !== bz) wh.cash += Math.round(pay * unit * 0.4); // the warehouse merchants take their cut
        this.imported = (this.imported || 0) + pay;
        if (this.rng.chance(0.15)) this.log(`A barge unloaded ${pay} ${G[o.good].name.toLowerCase()} for ${bz.name}.`, 'economy');
      }
    }
    queueImport(bz, good, qty) {
      // cities with a river warehouse have barges and carters arriving all day: imports land after a
      // few hours, paid for at a markup, instead of waiting for the one travelling trader
      if (this.barges && bz) {
        if (this.barges.some((o) => o.b === bz.id && o.good === good)) return;
        this.barges.push({ b: bz.id, good, qty: Math.max(2, Math.round(qty)), at: this.day * 1440 + this.minute + 180 + this.rng.int(0, 240) });
        return;
      }
      if (this.trader) { if (bz && !this.trader.extra) this.trader.extra = { b: bz.id, good, qty: Math.round(qty) }; return; }
      // a travelling trader comes up the King's Road from the east with a laden cart
      const r = this.rng;
      const tr = this.newPerson({ sex: 'm', age: r.int(28, 55), first: r.pick(D.NAMES.m), sur: r.pick(['of Eastmarch', 'Chapman', 'Packer']), household: 0, home: null, genes: Ch.randomGenes(r, 'east'), wealth: 0.6, visitor: true });
      tr.name = `${tr.first} ${tr.sur}`; tr.job = { biz: null, role: 'trader' };
      tr.app = Ch.makeAppearance(O.hash('trader', tr.id), { sex: 'm', age: tr.age, genes: tr.genes, role: 'merchant', wealth: 0.65, region: 'east' });
      tr.agent = { x: this.Z.east[0] * this.T, y: this.Z.east[1] * this.T, dir: 1, anim: 'walk', ft: 0, a: tr.app, hidden: false, inside: null, path: null, goal: null, person: tr, carrying: { good: good || 'iron', qty: qty || 1 } };
      tr.task = bz ? { act: 'import', b: bz.id, good, qty: Math.round(qty) } : { act: 'market', b: this.tavernId };
      tr.wake = 0; tr.bed = 1440;
      this.trader = tr;
      this.log(bz ? `A trader, ${tr.name}, is on the road with ${Math.round(qty)} ${G[good].name.toLowerCase()}s for ${bz.name}.` : `It is market day: ${tr.name} the trader is coming up the King's Road.`, 'trade');
    }

    newDay() {
      this.demandScale();
      // the Sunday tithe: households of means give a share of what they hold above a modest sum to the parish
      if (this.weekday === 0) {
        let tithe = 0;
        for (const hh of this.households) { if (hh.gone || hh.money <= 100) continue; const t = Math.floor((hh.money - 100) * 0.06); hh.money -= t; tithe += t; }
        if (tithe) { this.treasury.cash += tithe; this.treasury.income += tithe; if (tithe > 40) this.log(`The tithe brought ${tithe}d into the parish chest.`, 'politics'); }
      }
      this.newsDaily && this.newsDaily();
      this.warOrders && this.warOrders();
      this.reeveDaily && this.reeveDaily();
      this.forestDaily && this.forestDaily();
      // a city's guilds, wharf fees and market rents fill the common chest beyond what the sales tax brings
      if (this.people.length > 220) { const dues = Math.round(this.people.length * 0.3); this.treasury.cash += dues; this.treasury.income += dues; }
      for (const p of this.people) {
        p._ateOut = false; p._hungryNoted = false;
        for (const m of p.memories) m.strength *= 0.88;
        p.memories = p.memories.filter((m) => m.strength > 0.12);
        if (p.needs.hunger < 20) { p.health.hp = Math.max(30, p.health.hp - 5); p.mood -= 0.05; }
      }
      // tools wear out with use and must be replaced from the smithy
      for (const bz of this.biz.values()) if (bz.def.targets.tools && bz.type !== 'smithy') bz.stock.tools = Math.max(0, (bz.stock.tools || 0) - 0.12 * bz.workers.length);
      // weekly hearth tax on Moonday
      // the weekly hearth tax and the council's tax policy: see government.js (the collector's round)
      // households pick a shopper who is free in the day
      for (const hh of this.households) {
        const adults = hh.members.map((id) => this.byId.get(id)).filter((p) => p && p.age >= 16);
        const errand = hh.members.map((id) => this.byId.get(id)).find((p) => p && p.age >= 10 && p.age < 16);
        hh.shopper = (adults.find((p) => !p.job || p.shift === 'night') || errand || adults[this.day % Math.max(1, adults.length)] || {}).id;
      }
      this.build.daily();
      this.healthDaily(); this.lifeDaily(); this.justiceDaily(); this.gangsDaily(); this.businessDaily(); this.playerProfits(); if (this.weekday === 0) this.propertyWeekly(); if (!this.opts.foreign) this.kingdom.daily();
      if (this.weekday === 3) this.immigrateMaybe();
      if (this.events) this.events = this.events.filter((e) => e.day >= this.day);
      const season = this.season;
      if (season !== this._season) { if (this._season) this.log(`${season[0].toUpperCase() + season.slice(1)} comes to ${this.world.name}.`, 'season'); this._season = season; this.seasonChanged = true; }
      this.log(`${DAYNAMES[this.weekday]} dawns over ${this.world.name}.`, 'day');
      if (this.festival()) this.log(this.festivalDay === this.day ? `${this.world.name} keeps a holiday for ${this.festivalWhy || 'the new monarch'}: music and dancing in the square from mid-afternoon.` : `It is the harvest festival in ${this.world.name}: music in the square from mid-afternoon.`, 'festival');
    }

    // trader tasks plug into plan() via p.task; handle arrival here
    handleTrader() {
      const tr = this.trader; if (!tr) return;
      const a = tr.agent;
      // a fire or a fight can pull a trader off his errand: he takes a room and goes on his way tomorrow
      if (!tr.task) { tr.task = { act: 'rest', b: this.tavernId }; a.carrying = null; tr.leaveAt = tr.leaveAt || this.day + 1; }
      if (tr.task.act === 'import' && a.inside === tr.task.b) {
        const bz = this.biz.get(tr.task.b), qty = tr.task.qty, pr = G[tr.task.good].base;
        bz.stock[tr.task.good] = (bz.stock[tr.task.good] || 0) + qty;
        const pay = Math.min(bz.cash, qty * pr); bz.cash -= pay;
        this.log(`${tr.name} sold ${qty} ${G[tr.task.good].name.toLowerCase()}s to ${bz.name} for ${Math.round(pay)}d.`, 'trade');
        this.exports(tr);
        if (tr.extra) { tr.task = { act: 'import', ...tr.extra }; tr.extra = null; }
        else { tr.task = { act: 'rest', b: this.tavernId }; a.carrying = null; tr.leaveAt = this.day + 1; }
      }
      if (tr.task.act === 'market' && a.inside === tr.task.b) {
        this.exports(tr);
        tr.task = tr.extra ? { act: 'import', ...tr.extra } : { act: 'rest', b: this.tavernId }; tr.extra = null; a.carrying = null; tr.leaveAt = this.day + 1;
      }
      if (tr.task.act === 'rest' && this.day >= tr.leaveAt && this.hour > 8) tr.task = { act: 'leave', outdoor: true };
      if (tr.task.act === 'leave') {
        if (!a.path && a.inside == null && a.x > (this.Z.east[0] - 2) * this.T) { this.people = this.people.filter((p) => p !== tr); this.byId.delete(tr.id); this.trader = null; this.log(`${tr.name} rode on east.`, 'trade'); }
      }
    }
  }

  // leave: walk to the east edge
  const _zone = Sim.prototype.zoneTile;
  Sim.prototype.zoneTile = function (p, zone) {
    if (p.task?.act === 'leave') return this.Z.east;
    if (p.task?.act === 'investigate' && p.task.tile) return p.task.tile;
    if (zone === 'camp' && p.activity?.camp) { const b = this.building(p.activity.camp); if (b) return [b.x + ((p.id % 3)), b.bottom + 1 + (p.id % 2)]; }
    if (p.task?.act === 'help') { const t = this.byId.get(p.task.target); if (t) return [Math.floor(t.agent.x / this.T), Math.floor((t.agent.y - 1) / this.T)]; }
    return _zone.call(this, p, zone);
  };
  O.Health.install(Sim); O.Life.install(Sim); O.Homes.installSim(Sim); O.Justice.install(Sim); O.Gangs.install(Sim); O.Property.install(Sim); O.Chronicle.install(Sim); O.War.installSim(Sim); O.Rulers.installSim(Sim); O.Fire.installSim(Sim); O.Forestry.installSim(Sim); O.Disasters.installSim(Sim); O.Aftermath.installSim(Sim); O.Government.installSim(Sim); O.Nobility.installSim(Sim); O.Trades.installSim(Sim);
  const _tick = Sim.prototype.minuteTick;
  Sim.prototype.minuteTick = function () { _tick.call(this); this.handleTrader(); };
  // carry-home and delivery tasks finish on entering the destination
  const _onEnter = Sim.prototype.onEnter;
  Sim.prototype.onEnter = function (p, bid) {
    if (p.task?.act === 'to-doctor' && bid === p.task.b) { this.admit(p); return; }
    if (p.task?.act === 'report' && bid === p.task.b) { this.reported(p); return; }
    if (p.task?.act === 'escort' && bid === p.task.b) { p.task = null; return; }
    if (p.task?.act === 'move-in' && bid === p.task.b) { p.task = null; p.arriving = false; p.agent.carrying = null; return; }
    if (p.task?.act === 'carry-home' && bid === p.task.b) {
      const hh = this.household(p); hh.pantry[p.task.good] = (hh.pantry[p.task.good] || 0) + p.task.qty;
      p.task = null; p.agent.carrying = null; return;
    }
    _onEnter.call(this, p, bid);
  };

  O.Sim = Sim; O.DAYNAMES = DAYNAMES;
})();
