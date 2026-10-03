// Health, illness, injury and healthcare.
//
// States: healthy -> hurt -> seriously ill/injured -> incapacitated -> dead. Illness starts from age,
// hunger, season and sanitation, spreads between people who share a building, and is worsened by
// overwork. The seriously ill rest in bed; anyone who collapses in the street is noticed by a
// passer-by who helps them to the physician, where treatment (and remedies, if in stock) speeds
// recovery. Outbreaks hit the workforce and the council responds.
'use strict';
(function () {
  const DISEASES = {
    cold: { name: 'a chill', contagion: 0.02, grow: 0.04, heal: 0.16, max: 0.55 },
    flux: { name: 'the flux', contagion: 0.03, grow: 0.09, heal: 0.11, max: 1.1, water: true },
    fever: { name: 'a fever', contagion: 0.045, grow: 0.12, heal: 0.09, max: 1.3 },
    injury: { name: 'an injury', contagion: 0, grow: 0, heal: 0.12, max: 1 },
  };

  function install(Sim) {
    const P = Sim.prototype;
    P.healthInit = function () { this.settlement = { sanitation: 0.55, outbreak: false }; this.dead = []; };

    P.sick = function (p) { return p.health.illness && p.health.illness.sev > 0; };
    P.fallIll = function (p, kind, sev) {
      if (p.health.illness || p.visitor) return;
      p.health.illness = { kind, sev, since: this.day, treated: false };
      p.health.state = sev > 0.6 ? 'seriously ill' : 'hurt';
      this.remember(p, kind === 'injury' ? 'Hurt myself at work.' : `Came down with ${DISEASES[kind].name}.`, 'health', 1);
    };

    // hourly: contagion within buildings, work accidents
    P.healthHourly = function () {
      const byB = new Map();
      for (const p of this.people) { const b = p.agent.inside; if (b == null) continue; if (!byB.has(b)) byB.set(b, []); byB.get(b).push(p); }
      for (const group of byB.values()) {
        const ill = group.filter((p) => p.health.illness && DISEASES[p.health.illness.kind].contagion > 0);
        if (!ill.length) continue;
        for (const q of group) {
          if (q.health.illness || q.health.immune > this.day) continue;
          for (const s of ill) if (this.rng.chance(DISEASES[s.health.illness.kind].contagion * s.health.illness.sev * (q.needs.hunger < 30 ? 1.6 : 1))) { this.fallIll(q, s.health.illness.kind, 0.15); break; }
        }
      }
      for (const p of this.people) {
        if (p.activity?.act !== 'work' && p.activity?.act !== 'chop' && p.activity?.act !== 'build') continue;
        const risky = ['blacksmith', 'woodcutter', 'builder', 'miller'].includes(p.job?.role) ? 0.004 : 0.0008;
        if (this.rng.chance(risky * (p.needs.energy < 25 ? 2 : 1))) { this.fallIll(p, 'injury', this.rng.float(0.25, 0.9)); this.log(`${p.name} was hurt at work.`, 'health'); }
      }
    };

    // daily: new illness, progression, recovery, death from illness, outbreaks and the council response
    P.healthDaily = function () {
      const season = this.season, san = this.settlement.sanitation;
      const doc = [...this.biz.values()].find((b) => b.type === 'doctor');
      for (const p of [...this.people]) {
        if (p.visitor || !p.alive) continue;
        const h = p.health;
        if (!h.illness) {
          let risk = 0.003 + (p.age < 5 || p.age > 62 ? 0.004 : 0) + (p.needs.hunger < 30 ? 0.01 : 0) + (season === 'winter' ? 0.006 : season === 'autumn' ? 0.002 : 0);
          if (this.rng.chance(risk)) this.fallIll(p, this.rng.weighted([['cold', 5], ['flux', 2 * (1.4 - san)], ['fever', 1]]), 0.12);
          if (h.hp < 100) h.hp = Math.min(100, h.hp + 4);
          continue;
        }
        const ill = h.illness, D = DISEASES[ill.kind];
        const atDoctor = p.agent.inside === doc?.id && p.activity?.act === 'treated';
        let heal = D.heal * (p.needs.hunger > 40 ? 1 : 0.5) * (p.age > 65 ? 0.7 : 1);
        if (atDoctor) { heal *= 2.2; if (doc.stock.medicine >= 1) { doc.stock.medicine -= 1; heal *= 1.3; } }
        else if (p.activity?.act === 'sick') heal *= 1.2;
        // untreated illnesses grow for the first days
        const days = this.day - ill.since;
        if (days < 3) ill.sev += D.grow * (1 - (atDoctor ? 0.6 : 0)) * this.rng.float(0.4, 1.4);
        ill.sev -= heal * this.rng.float(0.6, 1.3);
        h.hp = Math.max(0, 100 - ill.sev * 90);
        if (ill.sev > Math.min(D.max, 1) * (p.age > 70 || p.age < 3 ? 0.85 : 1) && ill.sev >= 1) { this.die(p, `died of ${D.name}`); continue; }
        if (ill.sev <= 0) { p.health.illness = null; h.state = 'healthy'; h.immune = this.day + 20; h.hp = 85; this.remember(p, 'Back on my feet again.', 'health', 0.6); if (p.activity?.act === 'treated') p.task = null; continue; }
        h.state = ill.sev > 0.85 ? 'incapacitated' : ill.sev > 0.5 ? 'seriously ill' : 'hurt';
      }
      const ill = this.people.filter((p) => p.health.illness && p.health.illness.kind !== 'injury').length;
      const frac = ill / Math.max(1, this.people.length);
      if (frac > 0.12 && !this.settlement.outbreak) {
        this.settlement.outbreak = true;
        this.log(`Sickness is spreading through Ashford: ${ill} people are ill.`, 'health');
        // council response: pay for remedies and clean the well
        if (doc && this.treasury.cash > 90) { doc.cash += 30; doc.stock.herbs = (doc.stock.herbs || 0) + 10; this.treasury.cash -= 30; this.treasury.spent += 30; this.log('The council paid the physician 30d for herbs and remedies.', 'politics'); }
        if (this.treasury.cash > 140) { this.treasury.cash -= 40; this.treasury.spent += 40; this.settlement.sanitation = Math.min(0.95, this.settlement.sanitation + 0.12); this.log('The council paid men to clean the well and dig a new drain.', 'politics'); }
      } else if (frac < 0.05 && this.settlement.outbreak) { this.settlement.outbreak = false; this.log('The sickness has passed.', 'health'); }
      // doctor shortage pressure
      const waiting = this.people.filter((p) => p.task?.act === 'to-doctor' || p.activity?.act === 'treated').length;
      if (waiting > 4) this.log(`The physician is overwhelmed: ${waiting} patients and too few beds.`, 'health');
    };

    // per minute: behaviour of sick people, collapses, passers-by helping
    P.healthMinute = function (p) {
      const h = p.health, ill = h.illness;
      if (!ill || p.visitor) return null;
      const a = p.agent;
      if (h.state === 'incapacitated') {
        if (a.inside == null && !p.task) {
          if (!p.collapsedAt) { p.collapsedAt = this.day * 1440 + this.minute; a.path = null; a.goal = null; this.log(`${p.name} collapsed ${this.where(a)}.`, 'health'); }
          // someone nearby notices and helps
          if (!p.helper) {
            const helper = this.people.find((q) => q !== p && !q.agent.hidden && !q.task && q.age >= 16 && !q.health.illness && q.activity?.act !== 'sleep' && Math.hypot(q.agent.x - a.x, q.agent.y - a.y) < 110);
            if (helper) {
              p.helper = helper.id;
              helper.task = { act: 'help', target: p.id, outdoor: true };
              this.remember(helper, `Found ${p.name} collapsed and helped them to the physician.`, 'health', 1.2, p.id);
              this.relate(p, helper, 0.3);
            }
          }
          return { act: 'collapsed', outdoor: true };
        }
        if (a.inside != null && !p.task) return { act: 'sick', b: a.inside === this.docId ? this.docId : p.home };
      }
      if (p.task?.act === 'to-doctor' || p.task?.act === 'treated') return null;
      if (ill.sev > 0.5 && a.inside === p.home && this.docId && ill.sev > 0.65 && !p.housecall) {
        // a relative fetches the physician; the patient is taken there when able
        p.task = { act: 'to-doctor', b: this.docId }; return null;
      }
      if (ill.sev > 0.35) return { act: 'sick', b: p.home };
      return null;
    };

    P.where = function (a) { const tx = a.x / this.T, ty = a.y / this.T; return tx > 36 && tx < 56 && ty > 21 && ty < 30 ? 'in the square' : ty > 29 && ty < 32.5 ? "on the King's Road" : ty > 40 && ty < 43 ? 'on Mill Lane' : 'out in the village'; };

    // helper reaches the patient, then both walk to the physician
    P.helpArrive = function (helper) {
      const p = this.byId.get(helper.task.target);
      if (!p || !p.alive) { helper.task = null; return; }
      p.health.state = 'seriously ill'; p.collapsedAt = null;
      p.task = { act: 'to-doctor', b: this.docId };
      helper.task = { act: 'escort', b: this.docId, target: p.id };
    };

    P.admit = function (p) {
      const doc = this.biz.get(this.docId);
      const hh = this.household(p);
      const fee = 6;
      if (hh.money >= fee) { hh.money -= fee; doc.cash += fee; }
      else if (this.treasury.cash >= fee) { this.treasury.cash -= fee; this.treasury.spent += fee; doc.cash += fee; }
      else this.remember(this.byId.get(doc.owner) || p, `Treated ${p.name} for nothing; they had no coin.`, 'work', 0.6);
      p.task = { act: 'treated', b: this.docId };
      if (p.health.illness) p.health.illness.treated = true;
      this.log(`${p.name} is being treated by the physician.`, 'health');
    };

    P.die = function (p, cause) {
      p.alive = false; p.health.state = 'dead'; p.died = { day: this.day, cause };
      this.people = this.people.filter((q) => q !== p);
      this.dead.push(p);
      const hh = this.household(p);
      if (hh && hh.members) hh.members = hh.members.filter((id) => id !== p.id);
      this.log(`${p.name}, aged ${p.age}, ${cause}.`, 'death');
      this.onDeath && this.onDeath(p, cause);
    };
  }

  O.Health = { install, DISEASES };
})();
