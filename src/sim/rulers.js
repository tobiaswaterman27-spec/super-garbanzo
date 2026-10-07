// Rulers and succession. The crown and every lordship is held by a person who ages, may fall ill
// and die. A death brings mourning bells, then a coronation (and a festival day) for the heir, or,
// if the heir is a child or the claim is weak, a regency, and perhaps a pretender who raises the
// banner of rebellion: a civil war fought with the same armies as any other. Lords of the realm's
// places die and are succeeded by their heirs. In Ashford, when the reeve dies or leaves, the folk
// hold a moot and choose another. Every reign is remembered.
'use strict';
(function () {
  const MN = ['Aldred', 'Edmund', 'Henry', 'Robert', 'William', 'Geoffrey', 'Stephen', 'Hugh', 'Richard', 'Walter', 'Godric', 'Osric'];
  const FN = ['Matilda', 'Eleanor', 'Isabel', 'Margery', 'Edith', 'Joan', 'Alys', 'Cecily', 'Agnes', 'Rohese'];
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const yearDays = () => O.SEASON_DAYS * 4;

  function person(r, minAge, maxAge, sex) { sex = sex || (r.chance(0.6) ? 'm' : 'f'); return { name: r.pick(sex === 'm' ? MN : FN), sex, age: r.int(minAge, maxAge), ailing: false }; }
  const crownTitle = (c) => `${c.sex === 'm' ? 'King' : 'Queen'} ${c.name}${c.regnal ? ' ' + c.regnal : ''}`;
  const pron = (c) => (c.sex === 'm' ? 'his' : 'her');

  function install(Kingdom) {
    const K = Kingdom.prototype, _daily = K.daily;
    K.daily = function () { _daily.call(this); try { this.rulersDaily(); } catch (e) { console.error(e); } };

    K.rulersInit = function () {
      if (this.rulers) return this.rulers;
      const r = this.rng, day = this.sim.day;
      // the reigning king and queen are whoever this realm's history made them
      const crown = Object.assign(person(r, 54, 70, 'm'), { regnal: ROMAN[r.int(1, 5)], since: day - r.int(4, 18) * yearDays() });
      crown.queen = { name: r.pick(FN), sex: 'f', age: crown.age - r.int(1, 8) };
      crown.heir = person(r, 13, 22);
      const R = this.rulers = { crown, pretender: { name: 'Robert', sex: 'm', age: 41, title: 'Duke of Frostmere', seat: 'frostmere', ambition: 0.5 + r.next() * 0.4 }, reigns: [{ who: crownTitle(crown), from: crown.since, to: null, how: 'inherited' }], lords: {}, mourning: null, regent: null };
      // the lords of the realm's places become people too
      const titles = { aurelia: ['the Lord Mayor', 'm'], highmere: ['Lord', 'm'], westhaven: ['the Port-reeve', null], frostmere: ['the Steward', null], ravenscar: ['the Headman', null], sunfield: ['the Reeve', null], elmstead: ['the Woodward', null] };
      for (const p of this.places) {
        if (p.detailed) continue;
        const t = titles[p.id] || [(p.leader || 'the Reeve of x').split(' of ')[0], p.kind === 'castle' ? (p.leader || '').startsWith('Lady') ? 'f' : 'm' : null];
        const L = p.id === 'highmere' ? person(r, 48, 62, 'm') : person(r, 35, 64, t[1]);
        L.heir = person(r, 8, 30); L.title = t[0];
        R.lords[p.id] = L; p.leader = this.lordName(p.id);
      }
      return R;
    };
    K.lordName = function (id) {
      const L = this.rulers.lords[id], p = this.place(id);
      if (p && p.kind === 'capital' && this.rulers.crown) return `${crownTitle(this.rulers.crown)}${L ? `, with ${L.name} as Lord Mayor` : ''}`;
      if (!L) return p.leader;
      return L.title === 'Lord' ? `${L.sex === 'f' ? 'Lady' : 'Lord'} ${L.name} of ${p.name}` : `${L.name}, ${L.title.replace(/^the /, '').replace(/^Headman$/, L.sex === 'f' ? 'Headwoman' : 'Headman').replace(/^Reeve$/, 'Reeve')} of ${p.name}`;
    };
    K.crownTitle = function () { return crownTitle(this.rulersInit().crown); };

    K.rulersDaily = function () {
      const R = this.rulersInit(), r = this.rng, sim = this.sim, day = sim.day;
      // birthdays once a year
      if (day % yearDays() === 0) { for (const c of [R.crown, R.crown.heir, R.pretender, ...Object.values(R.lords), ...Object.values(R.lords).map((l) => l.heir)]) if (c) c.age++; }
      // mourning ends in a coronation, a regency or a rebellion
      if (R.mourning && day >= R.mourning.until) { const m = R.mourning; R.mourning = null; this.succeed(m); }
      // the monarch's health
      const c = R.crown;
      if (!R.mourning && c && !c.player) {
        const risk = c.age < 50 ? 0.0002 : 0.0005 * (c.age - 48);
        if (!c.ailing && r.chance(risk * 2.5)) { c.ailing = true; this.addNews(`${crownTitle(c)} is said to be gravely ill. Prayers are asked for in every church.`, 'rulers'); }
        else if (c.ailing && r.chance(0.07)) this.crownDies(`died after a long illness`);
        else if (c.ailing && r.chance(0.05)) { c.ailing = false; this.addNews(`${crownTitle(c)} has recovered, God be thanked.`, 'rulers'); }
      }
      { const ash = this.places.find((x) => x.detailed), rv = sim.reeveId && sim.byId.get(sim.reeveId); if (ash && sim.reeveId === 'player') ash.leader = `you, as Reeve of ${ash.name}`; else if (ash) ash.leader = rv && rv.alive !== false ? `${rv.name}, Reeve of ${ash.name}` : `the Reeve of ${ash.name}`; }
      // the lords of the realm
      for (const [id, L] of Object.entries(R.lords)) {
        if (r.chance(L.age < 55 ? 0.0002 : 0.0004 * (L.age - 50))) {
          const before = this.lordName(id), h = L.heir && L.heir.age >= 16 ? L.heir : person(r, 25, 45);
          R.lords[id] = Object.assign(h, { title: L.title, heir: person(r, 0, 12) });
          this.place(id).leader = this.lordName(id);
          this.addNews(`${before} has died. ${h === L.heir ? `${pron(L) === 'his' ? 'His' : 'Her'} heir ${h.name} now holds ${this.place(id).name}.` : `The council has named ${h.name} to hold ${this.place(id).name}.`}`, 'rulers', id);
        }
      }
      // an ambitious pretender grows restless under a weak crown
      if (!R.mourning && R.regent && this.war?.phase !== 'war' && r.chance(0.01 * R.pretender.ambition)) this.rebellion();
    };

    K.crownDies = function (how) {
      const R = this.rulers, c = R.crown;
      this.addNews(`The bells toll: ${crownTitle(c)} has ${how}, aged ${c.age}, in the ${Math.max(1, Math.round((this.sim.day - c.since) / yearDays()))}th year of ${pron(c)} reign. The realm mourns.`, 'rulers');
      const reign = R.reigns[R.reigns.length - 1]; if (reign) reign.to = this.sim.day;
      R.mourning = { until: this.sim.day + 3, dead: crownTitle(c) };
      R.crown = null;
      this.sim.onMourning && this.sim.onMourning(R.mourning);
      this.heirStore = c.heir;
    };

    K.succeed = function () {
      const R = this.rulers, r = this.rng, h = this.heirStore || person(r, 20, 40);
      this.heirStore = null;
      const same = R.reigns.filter((x) => x.who.includes(` ${h.name}`)).length;
      R.crown = Object.assign(h, { regnal: same ? ROMAN[same + 1] : '', since: this.sim.day, ailing: false, heir: person(r, 0, 6) });
      if (h.age < 16) {
        R.regent = { name: this.lordName('highmere'), until: this.sim.day + (16 - h.age) * yearDays() };
        R.reigns.push({ who: crownTitle(R.crown), from: this.sim.day, to: null, how: 'inherited as a child' });
        this.addNews(`${crownTitle(R.crown)}, only ${h.age} years old, is proclaimed. ${R.regent.name} will rule as regent until ${pron(h) === 'his' ? 'he' : 'she'} comes of age.`, 'rulers');
        if (r.chance(0.5 * R.pretender.ambition + 0.2)) this.rebellion();
      } else {
        R.regent = null;
        R.reigns.push({ who: crownTitle(R.crown), from: this.sim.day, to: null, how: 'inherited' });
        this.addNews(`Long live ${crownTitle(R.crown)}! ${pron(h) === 'his' ? 'He' : 'She'} was crowned today in the cathedral at Aurelia, and every town keeps a holiday.`, 'rulers');
        this.sim.onCoronation && this.sim.onCoronation(crownTitle(R.crown));
        if (r.chance(0.12 * R.pretender.ambition)) this.rebellion();
      }
    };

    K.rebellion = function () {
      const R = this.rulers, P = R.pretender; if (!P || (this.war && this.war.phase === 'war')) return;
      this.warInit();
      const seat = this.place(P.seat);
      this.addNews(`REBELLION. ${P.name}, ${P.title}, claims the crown and has raised ${pron(P)} banner at ${seat.name}. Lords must choose a side.`, 'rulers', P.seat);
      this.declareWar({ civil: true, enemy: `${P.name} of ${seat.name} and ${pron(P)} rebels`, home: P.seat, men: 200, hostName: `the rebel host of ${P.name}`, crownName: R.crown ? `the host of ${crownTitle(R.crown)}` : "the King's host", announce: `CIVIL WAR. The crown calls every loyal town to arms against ${P.name}, ${P.title}. The King's host musters at Highmere.` });
    };
    K.onCivilEnd = function (winner) {
      const R = this.rulers, P = R.pretender, r = this.rng;
      if (winner === 'enemy') {
        const old = R.crown ? crownTitle(R.crown) : 'the young heir';
        const reign = R.reigns[R.reigns.length - 1]; if (reign && !reign.to) reign.to = this.sim.day;
        R.crown = { name: P.name, sex: P.sex, age: P.age, regnal: '', since: this.sim.day, ailing: false, heir: person(r, 4, 18) };
        R.reigns.push({ who: crownTitle(R.crown), from: this.sim.day, to: null, how: 'took the crown by force' });
        R.regent = null; R.pretender = { name: r.pick(MN), sex: 'm', age: r.int(20, 40), title: 'heir of the old line, in exile', seat: 'westhaven', ambition: 0.6 };
        this.addNews(`The rebels have won. ${P.name} is crowned as ${crownTitle(R.crown)}; ${old} has fled across the sea. Men who fought for the old crown keep their heads down.`, 'rulers');
        this.sim.onCoronation && this.sim.onCoronation(crownTitle(R.crown));
      } else {
        this.addNews(`The rebellion is broken. ${P.name} has been taken and sent into exile beyond the sea; ${pron(P)} lands at ${this.place(P.seat)?.name || 'Frostmere'} go to the crown.`, 'rulers');
        R.pretender = { name: r.pick(MN), sex: 'm', age: r.int(25, 45), title: P.seat === 'frostmere' ? 'the new Duke of Frostmere' : `the new Lord of ${this.place(P.seat)?.name || 'Frostmere'}`, seat: P.seat || 'frostmere', ambition: 0.2 + r.next() * 0.3 };
      }
    };
  }

  // ---------------------------------------------------------------- the village: mourning, holidays, the moot
  function installSim(Sim) {
    const S = Sim.prototype;
    const _fest = S.festival;
    S.festival = function () { return _fest.call(this) || this.festivalDay === this.day; };
    S.onMourning = function (m) { this.mourningUntil = m.until; for (const p of this.people) if (!p.visitor && p.age >= 12 && this.rng.chance(0.6)) this.remember(p, `${m.dead} is dead. The bells rang all morning.`, 'politics', 1.5); };
    S.onCoronation = function (who) { this.festivalDay = this.day + 1; this.festivalWhy = `the crowning of ${who}`; for (const p of this.people) if (!p.visitor && p.age >= 12 && this.rng.chance(0.4)) this.remember(p, `We have a new monarch: ${who}.`, 'politics', 1.2); };
    // the reeve: when the office falls empty, the folk choose at a moot
    // A moot is called when the office falls empty, and every spring as of old, when anyone of
    // standing may stand against the sitting reeve. The folk gather in the square at five o'clock
    // and each one votes for whom they like and trust best.
    S.reeveDaily = function () {
      if (!this.reeveId || this.reeveMoot) return;
      const PS = O.PlayerState;
      const vacant = this.reeveId === 'player' ? !(PS && PS.reeve) : (() => { const rv = this.byId.get(this.reeveId); return !(rv && rv.alive !== false && this.people.includes(rv)); })();
      const spring = this.season === 'spring' && this.weather.dayOfSeason === 1;
      if (vacant || spring) {
        this.reeveMoot = this.day + 2;
        this.log(vacant ? `${this.world.name} has no reeve. A moot is called for ${O.DAYNAMES[(this.weekday + 2) % 7]} at five o'clock to choose one.` : `The spring moot is called for ${O.DAYNAMES[(this.weekday + 2) % 7]}: anyone of standing may stand for reeve.`, 'politics');
      }
    };
    const _mt = S.minuteTick;
    S.minuteTick = function () { _mt.call(this); if (this.reeveMoot === this.day && this._m === 18 * 60) this.holdMoot(); };
    const _plan = S.plan;
    S.plan = function (p) {
      if (this.reeveMoot === this.day && this.hour >= 17 && this.hour < 18 && !p.visitor && p.age >= 16 && !p.task && !p.health.illness && !p.job?.role?.startsWith('guard')) return { act: 'moot', outdoor: true, zone: 'square' };
      return _plan.call(this, p);
    };
    S.holdMoot = function () {
      this.reeveMoot = null;
      const PS = O.PlayerState, sitting = this.reeveId;
      const prestige = (p) => (this.household(p).money > 150 ? 0.15 : 0) + p.age / 300 + (p.id === sitting ? 0.15 : 0) + (p.traits.includes('friendly') ? 0.05 : 0);
      const cands = this.people.filter((p) => !p.visitor && p.age >= 30 && !p.gang && !p.job?.role?.startsWith('guard'))
        .map((p) => ({ p, pre: prestige(p) + this.people.reduce((s, q) => s + Math.max(0, q.rel.get(p.id)?.affinity || 0), 0) / 40 }))
        .sort((a, b) => b.pre - a.pre).slice(0, 2);
      if (PS && PS.standForReeve && PS.wantedLevel() === 0 && !PS.exiled) cands.push({ player: true, pre: PS.rep.local * 0.4 + PS.rep.civilian * 0.2 + (sitting === 'player' ? 0.15 : 0) });
      if (!cands.length) return;
      const tally = cands.map(() => 0);
      for (const q of this.people) {
        if (q.visitor || q.age < 16) continue;
        let best = 0, bs = -9;
        cands.forEach((c, i) => {
          let sc = c.pre + this.rng.next() * 0.3;
          if (c.player) { const r0 = q.rel.get(0); sc += (r0?.affinity || 0) * 1.2 + (r0?.familiar || 0) * 0.2; if (q.memories.some((m) => m.kind === 'crime' && m.about === 0)) sc -= 1; }
          else { sc += (q.rel.get(c.p.id)?.affinity || 0) * 1.2 + (q.household === c.p.household ? 2 : 0); }
          if (sc > bs) { bs = sc; best = i; }
        });
        tally[best]++;
      }
      const order = cands.map((c, i) => ({ c, v: tally[i] })).sort((a, b) => b.v - a.v);
      const w = order[0], name = (c) => (c.player ? 'the newcomer' : c.p.name);
      const old = sitting && sitting !== 'player' ? this.byId.get(sitting) : null;
      if (old && (w.c.player || w.c.p !== old)) old.title = null;
      if (w.c.player) { this.reeveId = 'player'; PS.reeve = true; PS.standForReeve = false; O.Chronicle && O.Chronicle.deed(this, `At the moot, the folk of ${this.world.name} chose the newcomer as reeve, ${w.v} votes to ${order[1]?.v || 0}.`, `You were chosen Reeve of ${this.world.name} at the moot, ${w.v} votes to ${order[1]?.v || 0}.`, 'rulers', 4, true); }
      else {
        if (sitting === 'player' && PS) PS.reeve = false;
        w.c.p.title = `Reeve of ${this.world.name}`; this.reeveId = w.c.p.id;
        if (w.c.p !== old) this.remember(w.c.p, `I was chosen reeve at the moot. God help me.`, 'life', 3);
      }
      if (PS) PS.standForReeve = false;
      this.log(`At the moot, the folk of ${this.world.name} chose ${name(w.c)} as reeve, ${w.v} votes${order.slice(1).map((o) => `; ${name(o.c)} ${o.v}`).join('')}.`, 'politics');
      this.lastMoot = { day: this.day, results: order.map((o) => ({ who: name(o.c), v: o.v })) };
    };
  }

  O.Rulers = { install, installSim, crownTitle };
  install(O.Kingdom);
})();
