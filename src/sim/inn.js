// The inn. The innkeeper stands at the counter; beds are hired from them there and nowhere else. A
// jobless husband or wife keeps the inn too, the two of them taking it in turns at the counter while the
// other is out or resting, and children old enough help in the evenings for a penny or two. Every so
// often whoever is on goes upstairs to look over the rooms. A poor innkeeping family lives upstairs.
// The inn holds only so many: when the benches are full, a newcomer goes up to the counter, is told
// there's no room, and goes home again.
'use strict';
(function () {
  function capacity(sim, b) {
    if (b._cap) return b._cap;
    let seats = 0, beds = 0;
    try {
      const L0 = O.Interior.interior(b, 0, sim); seats = L0.items.filter((i) => i.seat && i.kind !== 'throne').length;
      if (b.floors >= 2) { const L1 = O.Interior.interior(b, 1, sim); beds = L1.items.filter((i) => i.rent).length; }
    } catch (e) { seats = 12; beds = 4; }
    b._cap = { seats: Math.max(6, seats), beds: b.floors >= 2 ? Math.max(1, beds) : 0 };
    return b._cap;
  }
  const isInn = (b) => b && b.type === 'tavern';

  function installSim(Sim) {
    const S = Sim.prototype, _plan = S.plan, _onEnter = S.onEnter, _personMinute = S.personMinute;
    S.innCapacity = function (bid) { const b = this.building(bid); return b ? capacity(this, b) : { seats: 0, beds: 0 }; };
    S.innGuests = function (bid) { return this.people.filter((q) => q.agent.inside === bid && ['socialise', 'eat-out', 'rest', 'feast'].includes(q.activity?.act)).length; };
    S.innBedsTaken = function (bid) { return this.people.filter((q) => q.lodging && q.lodging.b === bid && q.lodging.until >= this.day).length + (O.PlayerState && O.PlayerState.room && O.PlayerState.room.b === bid && O.PlayerState.room.until >= this.day ? 1 : 0); };

    // set the inn's people up once: the spouse joins, the children help, a poor family moves in upstairs
    S.innInit = function () {
      if (this._innDone) return; this._innDone = true;
      for (const bz of this.biz.values()) {
        if (bz.type !== 'tavern') continue;
        const keeper = bz.workers.map((id) => this.byId.get(id)).find((q) => q && q.job?.role === 'innkeeper'); if (!keeper) continue;
        const sp = keeper.spouse && this.byId.get(keeper.spouse);
        if (sp && !sp.job && sp.age >= 18 && sp.alive !== false) { sp.job = { biz: bz.id, role: 'innkeeper', wage: 0, family: true }; bz.workers.push(sp.id); }
        const hh = this.household(keeper);
        for (const id of hh.members || []) { const c = this.byId.get(id); if (c && !c.job && c.age >= 11 && c.age < 18) { c.job = { biz: bz.id, role: 'potboy', wage: this.rng.chance(0.6) ? 1 : 0, family: true }; bz.workers.push(c.id); } }
        // a family that can't afford a house of its own lives over the inn
        const b = this.building(bz.id), home = this.building(keeper.home);
        if (b && b.floors >= 2 && home && home.id !== b.id && hh.money < 80 && home.type === 'house') {
          hh.home = b.id; for (const id of hh.members) { const q = this.byId.get(id); if (q) q.home = b.id; }
          b.households = [...new Set([...(b.households || []), hh.id])]; home.household = null; home.vacant = true;
        }
      }
    };

    S.plan = function (p) {
      if (!this._innDone && this.biz && this.biz.size) this.innInit();
      if (p.task && p.task.act === 'turned-away') return this.minute < p.task.until ? p.task : (p.task = null, { act: 'home', b: p.home });
      const pl = _plan.call(this, p);
      // turned away from a full inn this evening: home instead
      if (pl && (pl.act === 'socialise' || pl.act === 'eat-out') && p._innFull === this.day) return { act: 'home', b: p.home };
      // the innkeepers take it in turns: one has the day, the other the evening (and the off one is out or resting)
      const j = p.job;
      if (j && j.role === 'innkeeper' && pl && pl.act === 'work') {
        const bz = this.biz.get(j.biz), team = bz ? bz.workers.map((id) => this.byId.get(id)).filter((q) => q && q.job?.role === 'innkeeper') : [];
        if (team.length >= 2) {
          const first = team.indexOf(p) === (this.day % 2), h = this.hour, evening = h >= 17.5;
          if (first === evening) return h >= 13 && h < 16 && this.household(p).shopper === p.id ? pl : { act: 'home', b: p.home };
        }
        // a look over the rooms upstairs now and then
        if (this.building(j.biz)?.floors >= 2 && (Math.floor(this.minute / 5) + p.id) % 18 === 0) return Object.assign({}, pl, { upstairs: true });
      }
      if (j && j.role === 'potboy') { const h = this.hour; return h >= 17 && h < 21 ? { act: 'work', b: j.biz } : pl; }
      return pl;
    };

    S.onEnter = function (p, bid) {
      const act = p.activity;
      if (act && (act.act === 'socialise' || act.act === 'eat-out') && isInn(this.building(bid))) {
        const cap = this.innCapacity(bid).seats;
        if (this.innGuests(bid) > cap) {
          p._innFull = this.day; p.task = { act: 'turned-away', b: bid, until: this.minute + 3 };
          this.remember(p, `${this.building(bid).name} was full; I went home.`, 'social', 0.4);
          return;
        }
      }
      return _onEnter.call(this, p, bid);
    };
    S.personMinute = function (p) {
      _personMinute.call(this, p);
      if (p.job && p.job.role === 'potboy' && p.job.wage && this.hour === 21 && this._m % 60 === 0) { const bz = this.biz.get(p.job.biz); if (bz && bz.cash >= p.job.wage) { bz.cash -= p.job.wage; p.money = (p.money || 0) + p.job.wage; } }
    };
  }

  O.Inn = { installSim, capacity };
})();
