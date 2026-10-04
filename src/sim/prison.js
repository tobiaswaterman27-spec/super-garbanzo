// The gaol. Towns and cities keep a gaol, with a gaoler and turnkeys who hold the keys, bring the
// prisoners their bread morning, noon and evening, and walk the row of cells; villages and hamlets
// lock people in the cell at the watch house. A sentence is set by how bad the crime was: a night for
// a scuffle, days for burglary, a week or more for blood. Short sentences can be bought off with bail
// (a family with the coin pays it and has them home in the morning); long ones are served.
'use strict';
(function () {
  const sentenceFor = (sev) => (sev <= 1 ? 1 : sev === 2 ? 3 : 3 + sev * 2);
  const bailFor = (days, sev) => (days <= 3 ? 8 * days * Math.max(1, sev) : null);
  function installSim(Sim) {
    const S = Sim.prototype, _arrest = S.arrestNPC, _pm = S.personMinute, _daily = S.justiceDaily;
    // where prisoners are held here: the gaol if the place has one, else the watch house cell
    S.prisonId = function () { const g = this.world.buildings.find((b) => b.type === 'gaol' && this.biz.get(b.id)); return g ? g.id : this.guardId; };
    S.arrestNPC = function (q, crime, wrong) {
      _arrest.call(this, q, crime, wrong);
      const sev = crime.severity || 1, days = sentenceFor(sev), bail = bailFor(days, sev);
      q.jailUntil = this.day + days; q.task = { act: 'jailed', b: this.prisonId() };
      q.sentence = { days, bail, from: this.day, crime: crime.kind };
      const where = this.building(this.prisonId());
      this.remember(q, `Sentenced to ${days} day${days > 1 ? 's' : ''} in ${where && where.type === 'gaol' ? 'the gaol' : 'the cell'}${bail ? `, or ₳${bail} bail` : ''}.`, 'crime', 2);
      // a family with the money pays the bail, and they're home after a night inside
      const hh = this.household(q);
      if (bail && hh && hh.money >= bail + 10 && this.rng.chance(0.8)) {
        hh.money -= bail; this.treasury.cash += bail; this.treasury.income += bail;
        q.jailUntil = this.day + 1; q.sentence.bailed = true;
        this.log(`The ${hh.surname} family paid ₳${bail} bail for ${q.first}.`, 'crime');
      }
    };
    // prisoners are fed from the gaol's own bread; nobody walks out of a cell
    S.personMinute = function (p) {
      _pm.call(this, p);
      if (p.task?.act !== 'jailed') return;
      const m = this._m % 1440;
      if (m === 8 * 60 || m === 12 * 60 + 30 || m === 18 * 60) {
        const bz = this.biz.get(p.task.b); const have = bz && (bz.stock.bread || 0) >= 0.5;
        if (have) bz.stock.bread -= 0.5;
        p.needs.hunger = Math.min(100, p.needs.hunger + (have ? 40 : 20)); // water and a crust even when the sack is empty
      }
    };
    S.justiceDaily = function () {
      const was = new Set(this.people.filter((p) => p.jailUntil).map((p) => p.id));
      _daily.call(this);
      for (const p of this.people) if (was.has(p.id) && !p.jailUntil && p.sentence) { this.log(`${p.name} has been let out of ${this.building(this.prisonId())?.type === 'gaol' ? 'the gaol' : 'the cell'}${p.sentence.bailed ? ' on bail' : ', the sentence served'}.`, 'crime'); p.sentence = null; }
    };
  }
  O.Prison = { installSim, sentenceFor, bailFor };
})();
