// People going from place to place. A merchant buys up what a town has too much of and walks it to the
// next town where it's dear, and offers it at the counters there (the shop may say no); a visitor goes
// to see family for a day; a struggling family packs up and moves away for good. They walk out of
// town, along the real roads (you meet them, you can talk to them), and into the next town, and the
// merchants and visitors come home again. A merchant with a horse rides, and some travel together.
'use strict';
(function () {
  const WALK = 1.6, RIDE = 4.5; // road tiles per game minute

  function installSim(Sim) {
    const S = Sim.prototype, _pm = S.personMinute, _plan = S.plan, _nd = S.newDay;
    // whoever is away isn't here at all
    S.personMinute = function (p) {
      if (p.away) return;
      if (p.task && p.task.act === 'depart' && p.agent && !p.agent.path && p.agent.goal && p.agent.inside == null) {
        if (p.activity?.act === 'depart' && !String(p.task.journey).startsWith('home:')) { this.setOff(p); return; } // reached the edge of town
      }
      return _pm.call(this, p);
    };
    S.plan = function (p) { if (p.task && p.task.act === 'depart') return { act: 'depart', outdoor: true, zone: 'east' }; return _plan.call(this, p); };
    S.newDay = function () { _nd.call(this); try { this.planJourneys(); } catch (e) { console.warn('journeys', e); } };

    // who goes where today
    S.planJourneys = function () {
      const K = this.kingdom, here = this.world.placeId; if (!K || !here || !K.place(here)) return;
      const r = this.rng, nb = K.neighbours(here); if (!nb.length) return;
      // a merchant with a surplus to sell
      let surplus = null;
      for (const bz of this.biz.values()) { if (bz.def.public) continue; for (const g of bz.def.sells || []) { if (g.startsWith('fx_') || ['meal', 'stew', 'pie', 'milk'].includes(g)) continue; const t = bz.def.targets[g] || 0; if (t && (bz.stock[g] || 0) > t * 1.3) { surplus = { bz, g }; break; } } if (surplus) break; }
      if (surplus && r.chance(0.6)) {
        const dest = nb.slice().sort((a, b) => (K.place(b).prices?.[surplus.g] || 0) - (K.place(a).prices?.[surplus.g] || 0))[0];
        const who = this.people.find((q) => !q.visitor && !q.away && q.age >= 20 && q.age < 60 && !q.task && (!q.job || q.job.role === 'labourer' || q.job.role === 'carter' || q.job.biz === surplus.bz.id) && this.household(q).money > 20);
        if (who && dest) {
          const qty = Math.min(8, Math.floor((surplus.bz.stock[surplus.g] || 0) - (surplus.bz.def.targets[surplus.g] || 0)));
          const cost = Math.round(this.price(surplus.bz, surplus.g) * 0.8 * qty);
          if (qty >= 2 && this.household(who).money >= cost) {
            surplus.bz.stock[surplus.g] -= qty; surplus.bz.cash += cost; this.household(who).money -= cost;
            const mate = r.chance(0.3) ? this.people.find((q) => q !== who && !q.visitor && !q.away && !q.job && q.age >= 18 && q.age < 55 && !q.task) : null;
            this.depart([who, mate].filter(Boolean), dest, 'trade', { [surplus.g]: qty });
          }
        }
      }
      // a visit to family or friends in the next town
      if (r.chance(0.35)) { const q = this.people.find((x) => !x.visitor && !x.away && x.age >= 18 && !x.task && !(x.job && x.job.biz && this.biz.get(x.job.biz)?.def.hours) && r.chance(0.1)); if (q) this.depart([q], r.pick(nb), 'visit', null); }
      // a family that can't make ends meet leaves for good
      if (r.chance(0.05)) { const hh = this.households.find((h) => !h.gone && h.members.length && h.money < 5 && !h.members.some((id) => this.byId.get(id)?.job)); if (hh) this.depart(hh.members.map((id) => this.byId.get(id)).filter(Boolean), r.pick(nb), 'move', null, hh); }
    };
    // set off: walk to the edge of town first
    S.depart = function (ppl, to, purpose, goods, hh) {
      const K = this.kingdom, path = K.route(this.world.placeId, to); if (!path || path.length < 2) return;
      const id = Math.random().toString(36).slice(2, 9);
      const j = { id, from: this.world.placeId, to, path, purpose, goods, people: [], started: null, back: purpose !== 'move', horse: purpose === 'trade' && ppl[0] && this.household(ppl[0]).money > 120 && this.rng.chance(0.6), hh: hh ? hh.id : null }; // a merchant doing well rides
      const Z = this.Z || this.world.zones || {}, east = Z.east || [this.world.W - 2, 30];
      for (const p of ppl) {
        j.people.push(p.id);
        p.task = { act: 'depart', journey: id, at: [east[0] * this.T + 8, east[1] * this.T + 10] }; p.agent.goal = null; p.agent.path = null;
        if (O.Horses && O.Horses.horses && O.Horses.horses.some((h) => h.owner === 'npc:' + p.id)) j.horse = true;
      }
      (K.journeys = K.journeys || []).push(j);
      const lead = ppl[0]; this.log(`${lead.name}${ppl.length > 1 ? ` and ${ppl.length - 1} other${ppl.length > 2 ? 's' : ''}` : ''} set off for ${K.place(to).name}${purpose === 'trade' ? ` with ${Object.entries(goods).map(([g, n]) => `${n} ${O.Data.GOODS[g]?.name.toLowerCase()}`).join(', ')}` : purpose === 'move' ? ', moving away for good' : ' to visit'}.`, 'trade');
    };
    // gone from the town: on the road now
    S.setOff = function (p) {
      const K = this.kingdom, j = (K.journeys || []).find((x) => x.id === p.task?.journey); p.task = null;
      if (!j) return;
      p.away = { journey: j.id }; p.agent.hidden = true; p.agent.path = null; p.agent.goal = null;
      if (j.started == null) {
        j.started = this.day * 1440 + this.minute;
        j.travellers = j.people.map((id) => this.byId.get(id)).filter(Boolean).map((q) => ({ name: q.name, first: q.first, sex: q.sex, age: q.age, role: q.job?.role || (j.purpose === 'trade' ? 'merchant' : 'villager'), seed: q.app?.seed || q.id, genes: q.genes, pid: q.id }));
      }
      if (j.purpose === 'move' && j.hh) { const hh = this.households[j.hh - 1]; if (hh && hh.members.every((id) => this.byId.get(id)?.away)) { hh.gone = true; const b = this.building(hh.home); if (b) { b.household = null; b.vacant = true; } } }
    };
    // coming home again
    S.comeHome = function (j) {
      const Z = this.Z || this.world.zones || {}, east = Z.east || [this.world.W - 2, 30];
      for (const id of j.people) { const p = this.byId.get(id); if (!p) continue; p.away = null; p.agent.hidden = false; p.agent.inside = null; p.agent.x = east[0] * this.T + 8; p.agent.y = east[1] * this.T + 10; p.agent.path = null; p.agent.goal = null; p.activity = null; }
      if (j.earned) { const p = this.byId.get(j.people[0]); if (p) { this.household(p).money += j.earned; this.remember(p, `Came home from ${this.kingdom.place(j.to).name} with ₳${j.earned}.`, 'trade', 1); } }
    };
    // a stranger arriving from the road: they come in, do what they came for, and go
    S.welcome = function (j) {
      const r = this.rng, Z = this.Z || this.world.zones || {}, east = Z.east || [this.world.W - 2, 30], made = [];
      for (const t of j.travellers || []) {
        const q = this.newPerson({ sex: t.sex, age: t.age, first: t.first, sur: t.name.split(' ').slice(1).join(' ') || 'Traveller', household: 0, home: null, genes: t.genes || O.Char.randomGenes(r, 'south'), wealth: 0.55, visitor: true });
        q.name = t.name; q.app = O.Char.makeAppearance(t.seed, { sex: t.sex, age: t.age, genes: q.genes, role: t.role === 'merchant' ? 'merchant' : t.role === 'minstrel' ? 'bard' : 'villager', wealth: 0.55 });
        q.agent = { x: east[0] * this.T + 8, y: east[1] * this.T + 10, dir: 1, anim: 'walk', ft: 0, a: q.app, hidden: false, inside: null, path: null, goal: null, person: q };
        q.journey = j.id; q.leaveAt = this.day * 1440 + this.minute + (j.purpose === 'visit' ? r.int(240, 600) : r.int(120, 300));
        if (j.purpose === 'trade' && j.goods) { const g = Object.keys(j.goods)[0]; const buyer = [...this.biz.values()].filter((bz) => !bz.def.public && (bz.def.buys?.[g] || bz.def.targets?.[g] != null)).sort((a, b) => (a.stock[g] || 0) - (b.stock[g] || 0))[0]; q.task = buyer ? { act: 'sell-in', b: buyer.id, good: g, qty: j.goods[g] } : null; }
        if (j.purpose === 'perform' && this.tavernId != null) { q.task = { act: 'perform', b: this.tavernId }; q.leaveAt = this.day * 1440 + this.minute + r.int(360, 600); }
        if (!q.task) q.task = { act: 'rest', b: this.tavernId };
        this.people.push(q); this.byId.set(q.id, q); made.push(q);
      }
      if (j.purpose === 'move') { const b = this.world.buildings.find((x) => x.type === 'house' && x.vacant && !x.household); if (b && this.immigrate) { this.immigrate(b); this.log(`A family has come from ${this.kingdom.place(j.from).name} to settle here.`, 'migration'); } for (const q of made) q.leaveAt = this.day * 1440 + this.minute + 30; }
      return made;
    };
    // selling at the counter: the shop takes it if it wants it and can pay
    const _onEnter = S.onEnter;
    S.onEnter = function (p, bid) {
      if (p.task && p.task.act === 'sell-in' && p.task.b === bid) {
        const bz = this.biz.get(bid), g = p.task.good, qty = p.task.qty, boss = this.bossOf ? this.bossOf(bz) : null;
        const want = (bz.def.targets[g] || 0) - (bz.stock[g] || 0), price = Math.max(1, Math.round((O.Data.GOODS[g]?.base || 2) * 1.1));
        const j = (this.kingdom.journeys || []).find((x) => x.id === p.journey);
        if (want >= 1 && bz.cash >= price * Math.min(qty, want) && !(boss && (boss.rel.get(p.id)?.affinity || 0) < -0.3)) {
          const n = Math.min(qty, Math.ceil(want)); bz.stock[g] = (bz.stock[g] || 0) + n; bz.cash -= price * n; if (j) j.earned = (j.earned || 0) + price * n;
          this.log(`${p.name}, a merchant from ${this.kingdom.place(j?.from)?.name || 'away'}, sold ${n} ${O.Data.GOODS[g]?.name.toLowerCase()} to ${bz.name}.`, 'trade');
        } else this.log(`${bz.name} turned away ${p.name}'s ${O.Data.GOODS[g]?.name.toLowerCase()}.`, 'trade');
        p.task = { act: 'rest', b: this.tavernId };
        return;
      }
      return _onEnter.call(this, p, bid);
    };
    const _pm2 = S.personMinute;
    S.personMinute = function (p) {
      if (p.journey && p.leaveAt && this.day * 1440 + this.minute >= p.leaveAt && !p.task?.act?.startsWith('depart')) { const Z = this.Z || this.world.zones || {}, east = Z.east || [this.world.W - 2, 30]; p.task = { act: 'depart', journey: 'home:' + p.journey, at: [east[0] * this.T + 8, east[1] * this.T + 10] }; p.agent.goal = null; p.agent.path = null; }
      if (p.task && p.task.act === 'depart' && String(p.task.journey).startsWith('home:') && p.agent && !p.agent.path && p.agent.goal && p.agent.inside == null && p.activity?.act === 'depart') {
        // the visitor leaves for home
        this.people = this.people.filter((x) => x !== p); this.byId.delete(p.id);
        const j = (this.kingdom.journeys || []).find((x) => 'home:' + x.id === p.task.journey); if (j && !j.homeward && j.back) { j.homeward = true; j.started = this.day * 1440 + this.minute; j.path = j.path.slice().reverse(); }
        return;
      }
      return _pm2.call(this, p);
    };
    S.plan = (function (prev) { return function (p) { if (p.task && (p.task.act === 'sell-in' || p.task.act === 'rest')) return { act: p.task.act === 'rest' ? 'rest' : 'shop', b: p.task.b }; if (p.task && p.task.act === 'perform') { const h = this.hour; return h >= 11 && h < 23 ? { act: 'perform', b: p.task.b } : { act: 'rest', b: p.task.b }; } return prev.call(this, p); }; })(S.plan);
  }

  // the realm moves them along the roads; when they reach the end, the town takes them in (or home)
  function tickJourneys(K, nowMin) {
    for (const j of K.journeys || []) {
      if (j.started == null || j.done) continue;
      const len = legsLength(K, j), speed = j.horse ? RIDE : WALK, d = (nowMin - j.started) * speed;
      j.dist = d; j.len = len;
      if (d < len) continue;
      const dest = j.homeward ? j.from : j.to, v = O.Travel && O.Travel.visited.get(dest);
      if (j.homeward) { if (v && v.sim) v.sim.comeHome(j); else { const pl = K.place(dest); if (pl) pl.wealth = Math.min(0.95, (pl.wealth || 0.5) + 0.002); } j.done = true; continue; }
      if (j.arrived) continue; j.arrived = true;
      if (v && v.sim) v.sim.welcome(j);
      else {
        // a place nobody's walking in: the goods go into its stock, and they turn for home after a while
        const pl = K.place(dest); if (pl && j.goods) for (const [g, n] of Object.entries(j.goods)) { pl.stock = pl.stock || {}; pl.stock[g] = (pl.stock[g] || 0) + n; j.earned = Math.round(n * (pl.prices?.[g] || 3)); }
        if (j.back) { j.homeward = true; j.started = nowMin + 240; j.path = j.path.slice().reverse(); } else j.done = true;
      }
    }
    if (K.journeys && K.journeys.length > 60) K.journeys = K.journeys.filter((j) => !j.done);
  }
  function legsLength(K, j) {
    if (j._len) return j._len; let n = 0;
    for (let i = 0; i < j.path.length - 1; i++) { const rd = K.road(j.path[i], j.path[i + 1]); if (!rd) continue; const r = O.Island.roadTiles(O.Island.data().road(j.path[i], j.path[i + 1]) || rd); n += r.total || 200; }
    return (j._len = Math.max(50, n));
  }
  // where along its way a journey is: [road tiles result, distance along it, travelling a->b?]
  function whereOn(K, j) {
    let d = j.dist || 0;
    for (let i = 0; i < j.path.length - 1; i++) {
      const a = j.path[i], b = j.path[i + 1], rd = O.Island.data().road(a, b); if (!rd) continue;
      const r = O.Island.roadTiles(rd), len = r.total || 200;
      if (d <= len) { const fwd = rd.a === a; return { r, s: fwd ? d : len - d, dir: fwd ? 1 : -1 }; }
      d -= len;
    }
    return null;
  }
  O.Journeys = { installSim, tickJourneys, whereOn };
})();
