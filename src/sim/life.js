// The life cycle: birthdays and ageing, courtship and weddings, births, deaths with funerals and
// graves, inheritance, vacancies refilled, and families leaving when life here fails them.
// A year is four seasons of O.SEASON_DAYS days.
'use strict';
(function () {
  const Ch = O.Char, D = O.Data;
  const YEAR = () => O.SEASON_DAYS * 4;

  function install(Sim) {
    const P = Sim.prototype;
    P.lifeInit = function () {
      for (const p of this.people) if (p.birthday == null) p.birthday = this.rng.int(1, YEAR());
      this.graves = [];
    };
    P.refreshLook = function (p) {
      const role = p.job ? D.ROLE_OUTFIT[p.job.role] || 'villager' : p.age < 13 ? 'child' : 'villager';
      const b = this.building(p.home);
      p.app = Ch.makeAppearance(O.hash('person', p.id, p.first), { sex: p.sex, age: p.age, genes: p.genes, role, wealth: b?.wealth ?? 0.4, region: this.world.region });
      p.stage = Ch.ageStage(p.age); p.agent.a = p.app;
    };

    P.lifeDaily = function () {
      const doy = ((this.day - 1) % YEAR()) + 1;
      // birthdays
      for (const p of [...this.people]) {
        if (p.visitor || p.birthday !== doy) continue;
        const before = Ch.ageStage(p.age);
        p.age++;
        const after = Ch.ageStage(p.age);
        if (before !== after) {
          this.refreshLook(p);
          if (after === 'teen') this.remember(p, 'I am old enough to learn a trade now.', 'life', 1);
          if (after === 'youngAdult') this.remember(p, 'Grown at last.', 'life', 1);
          if (after === 'elder' && p.job && !p.job.casual && this.rng.chance(0.5)) this.retire(p);
        }
      }
      // natural death in old age
      for (const p of [...this.people]) {
        if (p.visitor || p.age < 60) continue;
        const risk = (p.age - 58) * 0.00035 * (p.health.illness ? 3 : 1);
        if (this.rng.chance(risk)) this.die(p, 'died peacefully in old age');
      }
      // the small ones: many a cradle is emptied by a fever or the flux before the child is five
      for (const p of [...this.people]) {
        if (p.visitor || p.alive === false || p.age >= 5) continue;
        const hh = this.household(p), poor = hh && hh.money < 15, risk = (p.age < 1 ? 0.0018 : 0.0006) * (poor ? 1.6 : 1) * (this.settlement?.outbreak ? 2 : 1);
        if (this.rng.chance(risk)) this.die(p, p.age < 1 ? this.rng.pick(['died of a fever in the cradle', 'died in the cradle, a few weeks old', 'died of a cough in the cradle']) : this.rng.pick(['died of a fever while still small', 'died of the flux while still small', 'died of the spotted fever as a small child']));
      }
      // the hard winter: the very old and the very young in a cold, poor house
      if (this.season === 'winter') for (const p of [...this.people]) {
        if (p.visitor || p.alive === false || (p.age >= 3 && p.age < 70)) continue;
        const hh = this.household(p); if (!hh || hh.money > 15 || (hh.pantry.firewood || 0) >= 1) continue;
        if (this.rng.chance(0.015)) this.die(p, 'died of the cold, in a house with no fire');
      }
      // courtship and weddings
      if (this.rng.chance(0.25)) this.matchmake();
      // births
      for (const hh of this.households) {
        const ms = hh.members.map((id) => this.byId.get(id)).filter(Boolean);
        const wife = ms.find((p) => p.sex === 'f' && p.spouse && p.age >= 18 && p.age <= 42);
        if (!wife || ms.length >= 7 || hh.money < 15) continue;
        if (wife.pregnant) { if (this.day >= wife.pregnant) this.birth(wife, hh); continue; }
        if (this.rng.chance(0.0095 - (ms.length > 4 ? 0.005 : 0))) { wife.pregnant = this.day + 20; this.remember(wife, 'I am with child.', 'life', 1.5); }
      }
      // fill permanent vacancies
      this.fillVacancies();
      // leaving: households that are destitute for many days seek a living elsewhere
      for (const hh of [...this.households]) {
        if (!hh.members.length) continue;
        hh.poorDays = hh.money < 3 && hh.pantry.bread < 1 ? (hh.poorDays || 0) + 1 : 0;
        if (hh.poorDays >= 8 && this.rng.chance(0.35)) this.emigrate(hh);
      }
    };

    P.retire = function (p) {
      const bz = this.biz.get(p.job.biz);
      if (bz) { bz.workers = bz.workers.filter((id) => id !== p.id); if (bz.owner === p.id) bz.owner = this.heirOf(p, bz) ?? null; }
      this.log(`${p.name} has retired from ${bz ? bz.name : 'work'}.`, 'life');
      p.job = null; this.refreshLook(p);
    };

    P.heirOf = function (p, bz) {
      const kids = (p.children || []).map((id) => this.byId.get(id)).filter((c) => c && c.alive !== false && c.age >= 18).sort((a, b) => b.age - a.age);
      const sp = p.spouse && this.byId.get(p.spouse);
      const heir = kids[0] || (sp && sp.alive !== false ? sp : null);
      if (!heir) return null;
      if (heir.job && heir.job.biz !== bz.id) { const old = this.biz.get(heir.job.biz); if (old) old.workers = old.workers.filter((id) => id !== heir.id); }
      heir.job = { biz: bz.id, role: bz.def.jobs[0][0] }; heir.skills[heir.job.role] = Math.max(heir.skills[heir.job.role] || 0, 0.35);
      if (!bz.workers.includes(heir.id)) bz.workers.push(heir.id);
      this.refreshLook(heir);
      this.log(`${heir.name} has inherited ${bz.name}.`, 'life');
      this.remember(heir, `I have taken over ${bz.name}.`, 'life', 2);
      return heir.id;
    };

    P.fillVacancies = function () {
      for (const bz of this.biz.values()) {
        if (bz.type === 'site') continue;
        for (const [role, n] of bz.def.jobs) {
          const have = bz.workers.filter((id) => { const q = this.byId.get(id); return q && q.job?.role === role && !q.job.casual; }).length;
          if (have >= n) continue;
          if (bz.def.wage[role] === 0 && (bz.owner || bz.ownerPlayer) && !(bz.ownerPlayer && have === 0)) continue; // owner role filled by the owner
          const sexOk = (q) => !O.ROLE_WANTS(role) || O.ROLE_WANTS(role) === q.sex;
          const pool = this.people.filter((q) => sexOk(q) && !q.visitor && (!q.job || q.job.casual) && q.age >= (role === 'apprentice' ? 13 : 16) && q.age < (role === 'apprentice' ? 22 : 62) && !q.health.illness);
          if (!pool.length) continue;
          const pick = pool.sort((a, b) => (b.skills[role] || 0) - (a.skills[role] || 0) || (a.age - b.age))[0];
          if (pick.job?.casual) { const old = this.biz.get(pick.job.biz); if (old) old.workers = old.workers.filter((id) => id !== pick.id); }
          pick.job = { biz: bz.id, role, manager: bz.ownerPlayer && bz.def.wage[role] === 0 ? true : undefined }; pick.skills[role] = pick.skills[role] || (role === 'apprentice' ? 0.15 : 0.3);
          if (bz.def.wage[role] === 0 && !bz.ownerPlayer) bz.owner = pick.id;
          bz.workers.push(pick.id); this.refreshLook(pick);
          this.remember(pick, `Taken on as ${role} at ${bz.name}.`, 'work', 1.5);
          this.log(`${pick.name} was taken on as ${role} at ${bz.name}.`, 'economy');
        }
      }
    };

    P.matchmake = function () {
      const singles = this.people.filter((p) => !p.visitor && !p.spouse && p.age >= 18 && p.age <= 45);
      for (const a of singles) {
        for (const [id, r] of a.rel) {
          const b = this.byId.get(id);
          if (!b || b.spouse || b.sex === a.sex || b.age < 18 || b.age > 48 || b.household === a.household) continue;
          if (r.affinity < 0.25 || (b.rel.get(a.id)?.affinity || 0) < 0.2) continue;
          return this.wed(a, b);
        }
      }
      // otherwise a chance meeting at the tavern or chapel leads to courtship
      if (singles.length > 1 && this.rng.chance(0.35)) {
        const a = this.rng.pick(singles), b = this.rng.pick(singles.filter((x) => x.sex !== a.sex && x.household !== a.household));
        if (b) { this.relate(a, b, 0.15); this.relate(b, a, 0.15); this.remember(a, `I've been walking out with ${b.name}.`, 'social', 1, b.id); }
      }
    };

    P.wed = function (a, b) {
      a.spouse = b.id; b.spouse = a.id;
      // the bride moves to the household with the better house (or the groom's)
      const ha = this.household(a), hb = this.household(b);
      const ba = this.building(a.home), bb = this.building(b.home);
      const [mover, stay] = (ba?.wealth || 0) >= (bb?.wealth || 0) ? [b, a] : [a, b];
      const from = this.household(mover), to = this.household(stay);
      from.members = from.members.filter((id) => id !== mover.id);
      to.members.push(mover.id); mover.household = stay.household; mover.home = stay.home;
      if (mover.sex === 'f') mover.sur = stay.sur, mover.name = `${mover.first} ${mover.sur}`;
      const dowry = Math.min(20, Math.max(0, from.money * 0.3)); from.money -= dowry; to.money += dowry;
      this.events = this.events || []; this.events.push({ kind: 'wedding', day: this.day + 1, a: a.id, b: b.id });
      this.remember(a, `Married ${b.first}.`, 'life', 3, b.id); this.remember(b, `Married ${a.first}.`, 'life', 3, a.id);
      this.log(`${a.first} and ${b.first} were married at the ${this.building(this.chapelId)?.name || 'chapel'}.`, 'life');
      if (!from.members.length) this.vacate(from);
      void ha; void hb;
    };

    P.birth = function (mum, hh) {
      mum.pregnant = null;
      const dad = this.byId.get(mum.spouse);
      const genes = Ch.inheritGenes(this.rng, mum.genes, dad ? dad.genes : Ch.randomGenes(this.rng, this.world.region));
      const sex = this.rng.chance(0.5) ? 'm' : 'f';
      const c = this.newPerson({ sex, age: 0, first: this.rng.pick(D.NAMES[sex]), sur: hh.surname, household: hh.id, home: mum.home, genes, wealth: 0.4 });
      c.name = `${c.first} ${c.sur}`; c.birthday = ((this.day - 1) % YEAR()) + 1; c.parents = [mum.id, dad?.id].filter(Boolean);
      c.app = Ch.makeAppearance(O.hash('person', c.id, c.first), { sex, age: 0, genes, role: 'child', wealth: 0.4 });
      c.agent = { x: mum.agent.x, y: mum.agent.y, dir: 0, anim: 'idle', ft: 0, a: c.app, hidden: true, inside: mum.home, path: null, goal: null, person: c };
      c.activity = { act: 'home', b: mum.home };
      hh.members.push(c.id); (mum.children = mum.children || []).push(c.id); if (dad) (dad.children = dad.children || []).push(c.id);
      this.remember(mum, `Gave birth to ${c.first}.`, 'life', 3, c.id); if (dad) this.remember(dad, `${c.first} was born.`, 'life', 3, c.id);
      this.log(`A ${sex === 'm' ? 'son' : 'daughter'}, ${c.first}, was born to ${mum.first}${dad ? ' and ' + dad.first : ''} ${hh.surname}.`, 'life');
    };

    P.onDeath = function (p, cause) {
      // family and friends grieve, the job falls vacant, property passes on, a grave is dug
      const hh = this.household(p);
      for (const id of [...(hh?.members || []), ...(p.children || [])]) { const q = this.byId.get(id); if (q) { q.mood -= 0.3; this.remember(q, `${p.first} ${cause.replace('died', 'has died')}. We buried ${p.sex === 'f' ? 'her' : 'him'} at the ${this.building(this.chapelId)?.name || 'chapel'}.`, 'grief', 3, p.id); } }
      if (p.spouse) { const sp = this.byId.get(p.spouse); if (sp) { sp.spouse = null; sp.widowed = p.id; } }
      for (const [id, r] of p.rel) { const q = this.byId.get(id); if (q && r.affinity > 0.3) this.remember(q, `My friend ${p.name} has died.`, 'grief', 1.5, p.id); }
      if (p.job?.biz) {
        const bz = this.biz.get(p.job.biz);
        if (bz) { bz.workers = bz.workers.filter((id) => id !== p.id); if (bz.owner === p.id) { bz.owner = this.heirOf(p, bz); if (!bz.owner) this.log(`${bz.name} has no heir and stands without a master.`, 'economy'); } }
      }
      if (hh && hh.shopper === p.id) hh.shopper = hh.members.map((id) => this.byId.get(id)).find((q) => q && q.age >= 10)?.id;
      if (hh && !hh.members.length) { const b = this.building(p.home); this.log(`${b?.type === 'house' ? 'A house' : b?.name || 'A home'} stands empty after ${p.name}'s death; their goods pass to the parish.`, 'life'); this.treasury.cash += Math.max(0, hh.money); hh.money = 0; this.vacate(hh); }
      this.events = this.events || []; this.events.push({ kind: 'funeral', day: this.day + 1, who: p.id, name: p.name });
      this.graves.push({ name: p.name, born: this.day - p.age * YEAR(), died: this.day, age: p.age, cause });
      this.onGrave && this.onGrave(p);
    };

    P.vacate = function (hh) {
      const b = this.building(hh.home);
      if (b) { b.household = null; b.vacant = true; }
      this.households = this.households.map((h) => (h === hh ? Object.assign(h, { members: [], gone: true }) : h));
    };

    P.emigrate = function (hh) {
      const ms = hh.members.map((id) => this.byId.get(id)).filter(Boolean);
      for (const p of ms) {
        if (p.job?.biz) { const bz = this.biz.get(p.job.biz); if (bz) { bz.workers = bz.workers.filter((id) => id !== p.id); if (bz.owner === p.id) bz.owner = null; } }
        p.job = null; p.task = { act: 'leave', outdoor: true, emigrating: true };
        this.remember(p, `There is no living to be had in ${this.world.name}. We are leaving.`, 'life', 3);
      }
      this.log(`Unable to feed themselves, the ${hh.surname} family have packed up and left ${this.world.name}.`, 'migration');
      this.vacate(hh);
    };

    // daily events: weddings and funerals gather people at the chapel
    P.eventPlan = function (p) {
      if (!this.events || p.visitor || p.age < 6) return null;
      const h = this.hour;
      for (const e of this.events) {
        // the wedding feast at the tavern that evening
        if (e.kind === 'wedding' && e.day === this.day && h >= 18 && h < 22 && (p.id === e.a || p.id === e.b || (p.rel.get(e.a)?.familiar || 0) > 0.2 || (p.rel.get(e.b)?.familiar || 0) > 0.2)) return { act: 'feast', b: this.tavernId };
        if (e.day !== this.day || h < 10 || h >= 11.5) continue;
        const close = e.kind === 'funeral' ? (this.household(p)?.members.includes(e.who) || (p.rel.get(e.who)?.affinity || 0) > 0.2 || this.byId.get(e.who)?.household === p.household || (this.dead.find((d) => d.id === e.who)?.household === p.household)) : (p.id === e.a || p.id === e.b || (p.rel.get(e.a)?.familiar || 0) > 0.2 || (p.rel.get(e.b)?.familiar || 0) > 0.2 || this.household(p) === this.household(this.byId.get(e.a) || {}));
        if (close) return { act: e.kind === 'funeral' ? 'mourn' : 'wedding', b: this.chapelId };
      }
      return null;
    };
  }

  O.Life = { install, YEAR };
})();
