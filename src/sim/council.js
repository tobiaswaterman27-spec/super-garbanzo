// The council of the realm, and elections.
// Every week, on Thursday at two, the leader of every place in the realm rides to the royal castle and
// sits at the long table in the great hall with the monarch, the guards keeping the doors. They speak
// for their places: crime, the watch, houses, money, the roads, shortages, war. The monarch grants or
// refuses, raises or cuts their allowance, and likes some more than others (a hard or unjust monarch
// may favour flatterers and punish honest bad news). A leader the monarch has turned against is
// sacked, and the next day that place holds an election in its hall: citizens (whoever lives there)
// put a vote in the box for one of the candidates, each with a short record of what they've done.
// Friends vote for friends, the rest for whoever's record they like. Leaders may also resign. While
// there's no leader the place runs on as it was and wages are paid.
// The rich and noble marry among themselves, and parents often make the match.
'use strict';
(function () {
  const TOPICS = [
    ['crime', 'more watchmen against the thieving', 'guards'], ['houses', 'new houses for the families coming in', 'build'], ['roads', 'the roads mended', 'roads'],
    ['shortage', 'grain sent against a shortage', 'relief'], ['tax', 'the crown tax lowered', 'tax'], ['market', 'a bigger market', 'build'], ['wall', 'walls and a gatehouse', 'build'],
    ['bridge', 'a new bridge', 'build'], ['war', 'men and money for the war', 'war'], ['poor', 'relief for the poor', 'relief'], ['school', 'a school for the children', 'build'],
  ];
  function installKingdom(Kingdom) {
    const K = Kingdom.prototype, _daily = K.daily;
    K.daily = function () { _daily.call(this); try { this.councilDaily(); } catch (e) { console.error(e); } };
    // every place's leader as a person the crown knows
    K.leadersInit = function () {
      if (this.leaders) return this.leaders;
      const r = this.rng, L = this.leaders = {};
      for (const p of this.places) {
        if (p.kind === 'capital') continue;
        const sex = r.chance(0.8) ? 'm' : 'f', first = r.pick(sex === 'm' ? O.Names.M : O.Names.F), sur = O.Names.surname(r);
        O.Names.used.add(first + ' ' + sur);
        L[p.id] = { name: `${first} ${sur}`, first, sex, title: (p.leader || 'Reeve').split(' of ')[0], favour: r.float(-0.2, 0.5), allowance: p.kind === 'city' ? 40 : p.kind === 'town' || p.kind === 'port' ? 20 : p.kind === 'castle' ? 30 : 8, since: this.sim.day - r.int(10, 400), deeds: [], honest: r.next(), flatterer: r.next() };
      }
      const cr = this.rulers && this.rulers.crown; if (cr && !cr.temper) cr.temper = r.pick(['just', 'just', 'stern', 'unjust']);
      this.councilLog = []; this.elections = [];
      return L;
    };
    K.councilDaily = function () {
      const s = this.sim; if (!s) return;
      this.leadersInit();
      // held elections: the result is read the day after
      for (const e of (this.elections || []).filter((x) => !x.done && s.day >= x.day + 1)) this.countVotes(e);
      if (s.weekday === 3) this.holdCouncil();
    };
    K.holdCouncil = function () {
      const r = this.rng, cr = this.rulers && this.rulers.crown, temper = (cr && cr.temper) || 'just', s = this.sim;
      const minutes = { day: s.day, items: [] };
      const ids = Object.keys(this.leaders).filter(() => r.chance(0.35)).slice(0, 8);
      for (const id of ids) {
        const L = this.leaders[id], pl = this.place(id); if (!L || !pl) continue;
        const t = r.pick(TOPICS), ask = t[1];
        // whether the monarch likes the idea, and the one who brings it
        let liking = (pl.happiness || 0.5) - 0.4 + L.favour * 0.5 + (temper === 'unjust' ? (L.flatterer - 0.5) * 0.8 : (L.honest - 0.5) * 0.4) + (r.next() - 0.5) * 0.4;
        if (temper === 'stern') liking -= 0.1;
        const granted = liking > 0.05 && this.treasury > 200;
        if (granted) {
          const cost = t[2] === 'build' ? 120 : t[2] === 'guards' ? 60 : 40;
          this.treasury -= Math.min(this.treasury, cost);
          if (t[2] === 'guards') pl.gov = Object.assign({}, pl.gov, { guards: (pl.gov?.guards || 1) + 1 });
          if (t[2] === 'tax') this.taxRate = Math.max(0.04, this.taxRate - 0.005);
          if (t[2] === 'relief' || t[2] === 'build') pl.wealth = Math.min(0.95, (pl.wealth || 0.5) + 0.02);
          if (t[2] === 'build') (pl.works = pl.works || []).push({ what: t[0], day: s.day });
          L.favour = Math.min(1, L.favour + 0.05); L.deeds.push(`won ${ask} for ${pl.name}`);
          if (r.chance(0.3)) { L.allowance += 2; }
        } else {
          L.favour = Math.max(-1, L.favour - (temper === 'unjust' ? 0.2 : 0.08)); if (r.chance(0.3)) L.allowance = Math.max(2, L.allowance - 2);
        }
        minutes.items.push({ id, who: L.name, title: L.title, place: pl.name, ask, granted });
        // sacked
        if (L.favour < -0.6 && r.chance(temper === 'unjust' ? 0.7 : 0.4)) { minutes.items.push({ id, who: L.name, place: pl.name, sacked: true }); this.callElection(id, 'sacked by the crown'); }
      }
      // now and then a leader resigns
      if (r.chance(0.08)) { const id = r.pick(Object.keys(this.leaders)); if (!this.elections.some((e) => e.place === id && !e.done)) { minutes.items.push({ id, who: this.leaders[id].name, place: this.place(id)?.name, resigned: true }); this.callElection(id, 'resigned'); } }
      this.councilLog.push(minutes); if (this.councilLog.length > 12) this.councilLog.shift();
      const g = minutes.items.filter((x) => x.granted).length;
      this.addNews(`The council of the realm sat in the great hall: ${minutes.items.length} matters heard, ${g} granted.`, 'politics');
      for (const it of minutes.items) if (it.sacked) this.addNews(`${it.who} of ${it.place} has lost the crown's favour and been put out of office. ${it.place} votes tomorrow.`, 'politics', it.id);
    };
    K.callElection = function (id, why) {
      const r = this.rng, pl = this.place(id), old = this.leaders[id];
      const cands = [0, 1, 2].map(() => { const sex = r.chance(0.7) ? 'm' : 'f', first = r.pick(sex === 'm' ? O.Names.M : O.Names.F), sur = O.Names.surname(r); O.Names.used.add(first + ' ' + sur); return { name: `${first} ${sur}`, first, sex, record: r.pick(['kept the parish books ten years', 'built the new bridge', 'fed the poor through the hard winter', 'is the richest merchant in town', 'led the watch against the thieves', 'stood up to the old leader', 'is the priest\'s brother', 'promises lower taxes', 'promises more watchmen', 'promises new houses']), votes: 0, appeal: r.next() }; });
      // in a town you've walked in, real people stand: the ambitious and well liked
      const v = O.Travel && O.Travel.visited.get(id);
      if (v && v.sim) { const s = v.sim; const real = s.people.filter((q) => !q.visitor && q.age >= 25 && q.alive !== false && (q.traits.includes('ambitious') || s.household(q).money > 120)).sort((a, b) => s.household(b).money - s.household(a).money).slice(0, 2); real.forEach((q, i) => { cands[i] = { name: q.name, first: q.first, sex: q.sex, pid: q.id, record: q.job ? `the ${q.job.role} at ${s.biz.get(q.job.biz)?.name || 'work'}` : 'a householder of long standing', votes: 0, appeal: 0.5 }; }); }
      this.elections.push({ place: id, day: this.sim.day, why, cands, oldName: old?.name, votes: {}, done: false });
      if (old) old.out = true;
    };
    K.countVotes = function (e) {
      const r = this.rng, pl = this.place(e.place);
      // the people's votes: by liking and record, friends for friends
      const v = O.Travel && O.Travel.visited.get(e.place);
      const voters = v && v.sim ? v.sim.people.filter((q) => q.age >= 18 && !q.visitor && q.alive !== false) : Array.from({ length: Math.max(10, Math.round((pl.pop || 60) / 3)) }, () => null);
      for (const q of voters) {
        let best = 0, bv = -9;
        e.cands.forEach((c, i) => { const friend = q && c.pid != null ? (q.rel.get(c.pid)?.affinity || 0) * 2 : 0; const val = c.appeal + friend + (r.next() - 0.5) * 0.8; if (val > bv) { bv = val; best = i; } });
        e.cands[best].votes++;
      }
      for (const [i, n] of Object.entries(e.votes || {})) e.cands[+i].votes += n; // the player's vote
      const win = e.cands.slice().sort((a, b) => b.votes - a.votes)[0];
      this.leaders[e.place] = { name: win.name, first: win.first, sex: win.sex, title: this.leaders[e.place]?.title || 'Reeve', favour: 0.2, allowance: this.leaders[e.place]?.allowance || 10, since: this.sim.day, deeds: [`elected over ${e.cands.length - 1} others`], honest: r.next(), flatterer: r.next(), player: win.player };
      e.done = true; e.winner = win.name;
      this.addNews(`${pl.name} has chosen ${win.name} as its ${this.leaders[e.place].title.toLowerCase()} (${win.votes} votes).`, 'politics', e.place);
      if (win.player) { O.PlayerState.office = { place: e.place, title: this.leaders[e.place].title }; O.UI && O.UI.say(`You've been elected ${this.leaders[e.place].title.toLowerCase()} of ${pl.name}!`); }
      // a real winner takes up the office in their own town
      if (v && v.sim && win.pid != null) { const q = v.sim.byId.get(win.pid); if (q) { q.office = 'leader'; q.title = this.leaders[e.place].title; v.sim.remember(q, `Elected ${q.title.toLowerCase()} of ${pl.name}.`, 'life', 3); } }
    };
  }
  O.Council = { installKingdom };
  installKingdom(O.Kingdom);

  // the rich marry the rich, and parents often arrange it
  function installSim(Sim) {
    const S = Sim.prototype, _mm = S.matchmake;
    S.matchmake = function () {
      const rich = (p) => p.gentry || p.royal || this.household(p).money > 300;
      const singles = this.people.filter((p) => !p.visitor && !p.spouse && p.age >= 18 && p.age <= 40 && rich(p));
      for (const a of singles) {
        if (!this.rng.chance(0.1)) continue;
        const b = singles.find((x) => x !== a && x.sex !== a.sex && x.household !== a.household && !x.spouse);
        if (!b) continue;
        const parents = this.household(a).members.map((id) => this.byId.get(id)).filter((q) => q && q.age > a.age + 15);
        if (parents.length) this.remember(a, `My parents have arranged for me to marry ${b.name}.`, 'life', 2, b.id);
        this.relate(a, b, 0.3); this.relate(b, a, 0.3);
        return this.wed(a, b);
      }
      // the rest marry as they always did, but a rich family won't let a child wed far beneath them
      const _rel = this.relate; void _rel;
      return _mm.call(this);
    };
  }
  O.Council.installSim = installSim;
})();
