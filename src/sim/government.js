// Local government and the crown's purse. The town council lives on what it raises — the market tax
// on every sale, the weekly hearth tax that the tax collector gathers door to door, tolls, fines,
// whatever the sweepers find in the street — and pays for what the town needs: the watch, the
// physician's bearers, the undertakers and the sweepers, relief for the hungry, new houses and
// repairs. A bigger hospital or a bigger watch costs more. The council sets its taxes by the state of
// the town: how many weeks the treasury could pay its wages, how much crime there is, how
// prosperous its people are. Every week a share goes to the king's treasury, and the crown sends
// money back where it is needed: to the capital for its works, and to towns that are struggling.
// The parish clerk keeps the register of empty houses, to let or to sell.
'use strict';
(function () {
  const CROWN_SHARE = 0.15;

  function installSim(Sim) {
    const S = Sim.prototype;
    const T = (s) => { const t = s.treasury; t.hearth = t.hearth ?? 2; t.weeks = t.weeks || []; t._in0 = t._in0 ?? t.income; t._out0 = t._out0 ?? t.spent; return t; };

    // what the council pays out in a week, job by job
    S.publicCosts = function () {
      let wages = 0; const by = {};
      for (const bz of this.biz.values()) {
        if (!bz.def.public) continue; const pays = bz.workers;
        for (const id of pays) { const q = this.byId.get(id); if (!q) continue; const w = (bz.def.wage || {})[q.job.role] || 0; wages += w * 6; by[q.job.role] = (by[q.job.role] || 0) + w * 6; }
      }
      return { wages, by };
    };

    // the council's tax policy, set by the state of the town
    S.taxPolicy = function () {
      const t = T(this), old = t.taxRate, oldH = t.hearth;
      const cost = Math.max(20, this.publicCosts().wages + 25);
      const runway = t.cash / cost; // weeks of wages in the chest
      const crime = (this.crimes || []).filter((c) => this.day - c.day < 14).length;
      const purse = this.households.filter((h) => !h.gone).reduce((a, h) => a + h.money, 0) / Math.max(1, this.households.filter((h) => !h.gone).length);
      if (runway < 2.5) { t.taxRate = Math.min(0.16, t.taxRate + 0.02); if (purse > 60) t.hearth = Math.min(6, t.hearth + 1); }
      else if (runway > 8 && crime < 4) { t.taxRate = Math.max(0.03, t.taxRate - 0.01); t.hearth = Math.max(1, t.hearth - 1); }
      if (purse < 30) t.hearth = Math.max(1, t.hearth - 1); // you can't tax what people haven't got
      if (t.taxRate !== old || t.hearth !== oldH) {
        const what = t.taxRate !== old ? `the market tax to ${Math.round(t.taxRate * 100)} pence in the shilling-score` : `the hearth tax to ${t.hearth}d a household`;
        const up = t.taxRate > old || t.hearth > oldH;
        this.log(`The council ${up ? 'raised' : 'lowered'} ${what}${up ? ` — the chest would pay the town's wages for only ${Math.max(0, runway).toFixed(1)} weeks` : ''}.`, 'politics');
        for (const p of this.people) if (p.age >= 18 && this.rng.chance(0.25)) this.remember(p, `The council ${up ? 'raised' : 'cut'} the taxes.`, 'politics', 0.7);
      }
    };

    // ---- the tax collector's round ----
    S.hasCollector = function () { return this.people.some((q) => q.job?.role === 'tax collector' && q.alive !== false); };
    S.assessHearth = function () {
      const t = T(this);
      for (const hh of this.households) {
        if (hh.gone || !hh.members.length) continue;
        hh.taxDue = (hh.taxDue || 0) + t.hearth + (hh.money > 250 ? Math.floor((hh.money - 250) * 0.05) : 0);
      }
    };
    S.collectFrom = function (hh, collector) {
      const due = hh.taxDue || 0; if (!due) return 0;
      const paid = Math.max(0, Math.min(due, Math.floor(hh.money)));
      hh.money -= paid; hh.taxDue = due - paid;
      this.treasury.cash += paid; this.treasury.income += paid; this.treasury.hearthTaken = (this.treasury.hearthTaken || 0) + paid;
      if (hh.taxDue > 0) { hh.arrears = (hh.arrears || 0) + 1; const head = this.byId.get(hh.members[0]); if (head) this.remember(head, `Couldn't pay the hearth tax in full. ${collector ? collector.first + ' wrote it in his book.' : ''}`, 'hardship', 1.2); }
      else hh.arrears = 0;
      return paid;
    };
    const collectorTick = function () {
      const h = this.hour;
      for (const c of this.people) {
        if (c.job?.role !== 'tax collector' || c.alive === false || c.task) continue;
        if (!(this.weekday <= 2 && h >= 9 && h < 16)) continue;
        // the nearest house still owing
        const owing = this.households.filter((hh) => !hh.gone && (hh.taxDue || 0) > 0 && hh.home != null && this.building(hh.home) && !hh._visited);
        if (!owing.length) continue;
        const pos = [c.agent.x, c.agent.y];
        const hh = owing.sort((a, b) => { const A = this.building(a.home), B = this.building(b.home); return Math.hypot(A.doorX * this.T - pos[0], A.doorY * this.T - pos[1]) - Math.hypot(B.doorX * this.T - pos[0], B.doorY * this.T - pos[1]); })[0];
        c.task = { act: 'collect', b: hh.home };
      }
    };
    const _onEnter = S.onEnter;
    S.onEnter = function (p, bid) {
      if (p.task?.act === 'collect' && bid === p.task.b) {
        let got = 0;
        for (const hh of this.households) if (!hh.gone && hh.home === bid && (hh.taxDue || 0) > 0) { got += this.collectFrom(hh, p); hh._visited = true; for (const id of hh.members) { const q = this.byId.get(id); if (q && q.age >= 16 && this.rng.chance(0.4)) this.remember(q, `${p.first} the tax collector came for the hearth tax.`, 'politics', 0.6, p.id); } }
        p.task = null; p._round = (p._round || 0) + got;
        return;
      }
      return _onEnter.call(this, p, bid);
    };

    // ---- the week's accounts, and the crown's share ----
    S.govWeekly = function () {
      const t = T(this), K = this.kingdom;
      // whatever the collector didn't reach is taken by the bailiff at the end of the week
      for (const hh of this.households) { if (!hh.gone && (hh.taxDue || 0) > 0) this.collectFrom(hh, null); hh._visited = false; }
      const income = t.income - t._in0, spent = t.spent - t._out0;
      let levy = 0;
      if (K && !this.foreign) { levy = Math.max(0, Math.round(income * CROWN_SHARE)); levy = Math.min(levy, Math.floor(Math.max(0, t.cash) * 0.5)); t.cash -= levy; K.treasury += levy; }
      const costs = this.publicCosts();
      t.weeks.push({ day: this.day, income: Math.round(income), spent: Math.round(spent), levy, grant: t._grant || 0, hearth: t.hearthTaken || 0, rate: t.taxRate, hearthRate: t.hearth, wages: costs.wages, cash: Math.round(t.cash) });
      if (t.weeks.length > 8) t.weeks.shift();
      if (levy > 0) this.log(`${levy}d of the week's taxes went to the king's treasury.`, 'politics');
      t._in0 = t.income; t._out0 = t.spent; t._grant = 0; t.hearthTaken = 0;
      this.taxPolicy();
      this.assessHearth();
    };
    S.crownGrant = function (amt, why) {
      const t = T(this); t.cash += amt; t.income += amt; t._grant = (t._grant || 0) + amt; t._in0 += amt; // a grant isn't taxed again
      this.log(`The crown has sent ${amt}d ${why}.`, 'politics');
    };

    const _tick = S.minuteTick;
    S.minuteTick = function () { if (!this._govInit) { this._govInit = true; T(this); } _tick.call(this); if (this._m % 20 === 0) collectorTick.call(this); };
    const _nd = S.newDay;
    S.newDay = function () {
      // the old instant hearth tax is replaced by the collector's round (see sim.js); keep the weekday logic here
      _nd.call(this);
      if (this.weekday === 0) this.govWeekly();
    };
  }

  function installKingdom(Kingdom) {
    const K = Kingdom.prototype, _daily = K.daily;
    K.daily = function () {
      _daily.call(this);
      try { this.crownDaily(); } catch (e) { console.error(e); }
    };
    // the crown pays for the capital's works and helps towns in trouble
    K.crownDaily = function () {
      const sim = this.sim; if (!sim || sim.weekday !== 1) return;
      const t = sim.treasury;
      const struggling = t.cash < 120 || (t.weeks && t.weeks.length && t.weeks[t.weeks.length - 1].cash < 150 && sim.households.some((h) => !h.gone && h.money < 10));
      if (struggling && this.treasury > 600) { const g = Math.min(180, Math.round(this.treasury * 0.08)); this.treasury -= g; sim.crownGrant(g, `to help ${sim.world.name} through hard times`); }
      for (const pl of this.places) {
        if (pl.id === sim.world.placeId) continue;
        if (pl.capital || pl.kind === 'city') { const g = Math.min(120, Math.round(this.treasury * 0.04)); if (g > 20) { this.treasury -= g; pl.wealth = Math.min(0.95, (pl.wealth || 0.5) + 0.004); } }
        else if ((pl.wealth || 0.5) < 0.3 && this.treasury > 500) { this.treasury -= 40; pl.wealth = Math.min(0.95, (pl.wealth || 0.3) + 0.02); this.addNews && this.addNews(`The crown has sent relief to ${pl.name}.`, 'politics'); }
      }
    };
  }

  O.Government = { installSim, installKingdom, CROWN_SHARE };
  installKingdom(O.Kingdom);
})();
