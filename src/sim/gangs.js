// Gangs: membership, loyalty, wages, a shared purse, roles, a hideout that grows, night jobs, and
// the risks of all of it. The player can found a gang; the Crows already run one.
'use strict';
(function () {
  const ROLES = ['recruit', 'member', 'lookout', 'burglar', 'pickpocket', 'thug', 'enforcer', 'fence', 'smuggler', 'poacher', 'highwayman', 'builder', 'quartermaster', 'recruiter', 'lieutenant'];
  const GANG_ROLES = { burglary: ['burglar', 'lookout', 'fence'], pickpocketing: ['pickpocket', 'lookout', 'fence'], smuggling: ['smuggler', 'lookout', 'fence'], poaching: ['poacher', 'lookout'], protection: ['thug', 'enforcer', 'lieutenant'] };
  // gang names are the realm's: no two alike
  const NAME_A = ['Crows', 'Rooks', 'Weasels', 'Mire Rats', 'Grey Hoods', 'Night Foxes', 'Red Caps', 'Ash Wolves', 'Black Hands', 'Gallows Crew', 'Hollow Men', 'Jackdaws', 'Ditch Dogs', 'Lantern Cutters', 'Bone Pickers', 'Mud Larks', 'Thorn Boys', 'Cutpurse Guild', 'Bell Thieves', 'Pale Sisters', 'Iron Teeth', 'Low Lanterns', 'Saltmen', 'Stoats', 'Kestrels', 'Hangmen\'s Get', 'Ferrymen', 'Dusk Riders'];
  const usedNames = new Set();
  function gangName(r) { for (let i = 0; i < 60; i++) { const n = 'the ' + r.pick(NAME_A); if (!usedNames.has(n)) { usedNames.add(n); return n; } } const n = 'the ' + r.pick(NAME_A) + ' of ' + r.pick(['the Hill', 'the Ford', 'the Marsh', 'the Wood']); usedNames.add(n); return n; }
  const LEVELS = [
    { name: 'Tent', cost: 0, beds: 1 },
    { name: 'Palisaded camp', cost: 60, beds: 3 },
    { name: 'Hideout', cost: 160, beds: 5 },
    { name: 'Safehouse', cost: 400, beds: 8 },
    { name: 'Fortified hold', cost: 900, beds: 12 },
  ];

  function install(Sim) {
    const S = Sim.prototype;
    S.gangsInit = function () {
      this.gangs = [];
      const r = this.rng;
      // each den in the woods belongs to a gang of its own, with its own name, leader and hands
      const dens = this.world.buildings.filter((b) => b.type === 'hideout' && !b.roadKey && b.gang !== 'player');
      const cands = this.people.filter((p) => !p.visitor && p.age >= 17 && p.age < 55 && !p.job?.role?.startsWith('guard') && !p.gentry && !p.royal).sort((a, b) => a.attitude - b.attitude);
      dens.forEach((den, k) => {
        const id = 'g' + k, name = gangName(r);
        const g = { id, name, leader: null, members: [], purse: r.int(30, 120), hideout: den.id, level: den.level ?? 1, influence: 0.15 + r.next() * 0.1, rel: { player: 'neutral' }, log: [], speciality: r.pick(['burglary', 'pickpocketing', 'smuggling', 'poaching', 'protection']) };
        den.gang = id; den.name = `${name.replace(/^the /, 'The ')}' den`;
        const size = 2 + r.int(0, 2);
        for (const p of cands.splice(0, size)) {
          const role = !g.members.length ? 'leader' : r.pick(GANG_ROLES[g.speciality] || ['member']);
          g.members.push({ id: p.id, role, loyalty: r.float(0.5, 0.9), wage: 3 }); p.gang = id; p.attitude = Math.min(p.attitude, -0.2);
        }
        g.leader = g.members[0]?.id ?? null;
        if (g.leader) this.byId.get(g.leader).traits = [...new Set([...this.byId.get(g.leader).traits, 'risk-taking'])];
        for (const o of this.gangs) { o.rel[id] = 'rival'; g.rel[o.id] = 'rival'; }
        this.gangs.push(g);
      });
    };
    S.npcGangs = function () { return this.gangs.filter((g) => g.id !== 'player'); };
    S.gang = function (id) { return this.gangs.find((g) => g.id === id); };
    S.playerGang = function () { return this.gang('player'); };

    S.foundGang = function (name, b) {
      const g = { id: 'player', name, leader: 'player', members: [], purse: 0, hideout: b.id, level: 0, influence: 0.05, rel: {}, orders: [], log: [] };
      this.gangs.push(g); b.unclaimed = false; b.gang = 'player'; b.name = `${name}${/s$/.test(name) ? "'" : "'s"} camp`;
      for (const o of this.npcGangs()) { o.rel.player = 'rival'; g.rel[o.id] = 'rival'; }
      this.log(`Word in the taverns: a new band calling itself ${name} has made camp outside ${this.world.name}.`, 'gang');
      return g;
    };

    // Would this person throw in their lot with the player's gang?
    S.recruitChance = function (p) {
      const PS = O.PlayerState, hh = this.household(p);
      if (p.age < 16 || p.job?.role?.startsWith('guard') || p.gang) return 0;
      let c = 0.1 + Math.max(0, -p.attitude) * 0.6 + (hh.money < 30 ? 0.2 : 0) + (!p.job ? 0.15 : 0) + (p.traits.includes('risk-taking') ? 0.15 : 0) + (p.traits.includes('greedy') ? 0.1 : 0) - (p.traits.includes('cautious') ? 0.2 : 0) - (p.traits.includes('loyal') && p.job ? 0.1 : 0);
      c += (p.rel.get(0)?.affinity || 0) * 0.4 + PS.rep.criminal * 0.3 - (p.memories.some((m) => m.kind === 'crime' && m.about === 0) ? 0.4 : 0);
      return O.clamp(c, 0, 0.9);
    };
    S.joinGang = function (p, gid, wage) {
      const g = this.gang(gid);
      g.members.push({ id: p.id, role: 'recruit', loyalty: 0.45 + Math.max(0, -p.attitude) * 0.3, wage, joined: this.day });
      p.gang = gid; p.attitude = Math.min(p.attitude, 0);
      this.remember(p, `Threw in my lot with ${g.name}.`, 'gang', 2, 0);
      g.log.push(`Day ${this.day}: ${p.name} joined as a recruit for ₳${wage} a day.`);
    };
    S.leaveGang = function (m, g, why) {
      g.members = g.members.filter((x) => x !== m);
      const p = this.byId.get(m.id); if (p) { p.gang = null; this.remember(p, `Left ${g.name}: ${why}.`, 'gang', 2); }
      g.log.push(`Day ${this.day}: ${p?.name || 'A member'} left, ${why}.`);
      if (g.id === 'player') O.Panels && O.Panels.toast(`${p?.first || 'A member'} has left ${g.name}: ${why}.`, 'bad');
      // a bitter ex-member may go to the watch with a true description of the leader
      if (g.id === 'player' && p && m.loyalty < 0.1 && this.rng.chance(0.5)) this.inform(p, g);
    };
    S.inform = function (p, g) {
      const look = O.Justice.lookOf(O.game.player.a);
      const crime = this.recordCrime({ kind: 'banditry', perp: 'player', placeName: 'Ashford Wood', tile: [9 + (this.world.ox || 0), 10 + (this.world.oy || 0)], seen: [], severity: 2 });
      crime.witnesses.push({ id: p.id, desc: Object.assign({}, look), acc: 1 });
      crime.reported = true; crime.profile = Object.assign({}, look); crime.investigated = true; crime.evidence = 1.6;
      O.PlayerState.crimes.push(crime.id);
      this.log(`${p.name} has turned informer and told the watch everything about ${g.name}'s leader.`, 'crime');
      if (O.Panels) O.Panels.toast(`${p.first} has informed on you to the watch!`, 'bad');
    };

    // Evenings: members gather at the hideout
    S.gangPlan = function (p) {
      if (!p.gang) return null;
      const g = this.gang(p.gang), h = this.hour;
      if (!g || this.weekday === 6) return null;
      if (h >= 19.5 && h < 22.5) {
        const b = this.building(g.hideout);
        if (!b) return null;
        return g.level >= 1 ? { act: 'gangmeet', b: b.id } : { act: 'gangmeet', outdoor: true, zone: 'camp', camp: b.id };
      }
      return null;
    };

    // Daily: wages, loyalty, influence, upkeep; the player gang's ordered jobs happen at 2 am
    S.gangsDaily = function () {
      for (const g of this.gangs) {
        for (const m of [...g.members]) {
          const p = this.byId.get(m.id);
          if (!p || p.alive === false) { g.members = g.members.filter((x) => x !== m); continue; }
          if (m.role === 'leader') continue;
          if (g.purse >= m.wage) { g.purse -= m.wage; this.household(p).money += m.wage; m.loyalty = Math.min(1, m.loyalty + 0.02); }
          else { m.loyalty -= 0.12; this.remember(p, `${g.name} couldn't pay me.`, 'gang', 1); }
          if (p.jailUntil) m.loyalty -= 0.04;
          if (m.loyalty < 0.15 && this.rng.chance(0.5)) this.leaveGang(m, g, m.loyalty < 0.05 ? 'bitter and unpaid' : 'tired of the life');
        }
        g.influence = O.clamp(0.04 + g.members.length * 0.04 + g.level * 0.05 + (g.recentJobs || 0) * 0.02, 0, 1);
        g.recentJobs = Math.max(0, (g.recentJobs || 0) - 0.3);
      }
      // the council answers a crime wave with more watchmen (and it costs them)
      const week = this.crimes.filter((c) => c.day > this.day - 7).length;
      const gh = this.biz.get(this.guardId);
      if (gh && week >= 5 && this.treasury.cash > 150 && gh.def.jobs[1][1] < 6 && !this._guardRaised) {
        gh.def = Object.assign({}, gh.def, { jobs: [gh.def.jobs[0], ['guard', gh.def.jobs[1][1] + 1]] });
        this._guardRaised = this.day + 7;
        this.log(`With ${week} crimes this week, the council has voted to hire another watchman.`, 'politics');
      }
      if (this._guardRaised && this.day > this._guardRaised) this._guardRaised = null;
    };

    S.gangNight = function () {
      // the town's gangs work on their own account, each in its own line
      for (const gg of this.npcGangs()) {
        if (!gg.members.length || !this.rng.chance(0.2)) continue;
        const thief = this.byId.get(this.rng.pick(gg.members).id);
        if (thief && !thief.jailUntil) this.gangJob(gg, thief, null);
      }
      const g = this.playerGang(); if (!g || !g.orders) return;
      for (const o of g.orders.splice(0)) {
        const m = g.members.find((x) => x.id === o.member); const p = m && this.byId.get(m.id);
        if (!p || p.jailUntil) continue;
        this.gangJob(g, p, o.target, m);
      }
    };

    // A night burglary by a gang member: success adds loot to the purse; failure risks the cell
    S.gangJob = function (g, p, targetHouse, m) {
      const homes = this.households.filter((h) => !h.gone && h.id !== p.household);
      const hh = targetHouse ? this.households.find((h) => h.home === targetHouse) : this.rng.pick(homes);
      if (!hh) return;
      const b = this.building(hh.home);
      const lookout = g.members.some((x) => x.role === 'lookout' && x.id !== p.id);
      const skill = (m && m.role === 'burglar' ? 0.2 : 0) + (lookout ? 0.12 : 0) + (p.traits.includes('risk-taking') ? 0.05 : 0);
      const risk = 0.25 + b.wealth * 0.25 + (this.gangs.length ? 0 : 0) - skill + (this.people.filter((q) => q.job?.role?.startsWith('guard') && q.shift === 'night').length * 0.03);
      const coin = Math.floor(Math.max(0, hh.money) * (0.15 + b.wealth * 0.15)); const goods = Math.min(2, Math.floor(hh.pantry.bread || 0));
      if (this.rng.chance(1 - O.clamp(risk, 0.1, 0.8))) {
        hh.money -= coin; hh.pantry.bread -= goods; g.purse += coin + goods * 2; g.recentJobs = (g.recentJobs || 0) + 1;
        if (m) m.loyalty = Math.min(1, m.loyalty + 0.06);
        const crime = this.recordCrime({ kind: 'burglary', perp: p, gang: g.id, placeName: b.type === 'house' ? `the ${hh.surname} house` : b.name, tile: [b.doorX, b.doorY], victim: hh.id, seen: [], severity: 1 });
        const owner = hh.members.map((id) => this.byId.get(id)).find((q) => q && q.age >= 16);
        if (owner) { this.remember(owner, `Thieves broke in during the night and took ₳${coin}.`, 'crime', 1.5); if (!owner.task) owner.task = { act: 'report', b: this.guardId, crime: crime.id }; }
        if (g.id === 'player') g.log.push(`Day ${this.day}: ${p.first} burgled the ${hh.surname} house: ₳${coin} and ${goods} loaves.`);
      } else {
        const crime = this.recordCrime({ kind: 'burglary', perp: p, gang: g.id, placeName: `the ${hh.surname} house`, tile: [b.doorX, b.doorY], victim: hh.id, seen: hh.members.map((id) => this.byId.get(id)).filter((q) => q && q.age >= 12).slice(0, 2), severity: 2 });
        if (this.rng.chance(0.55)) this.arrestNPC(p, crime, false);
        if (m) m.loyalty -= 0.08;
        if (g.id === 'player') { g.log.push(`Day ${this.day}: ${p.first} was disturbed at the ${hh.surname} house${p.jailUntil ? ' and taken by the watch' : ' and fled'}.`); O.Panels && O.Panels.toast(`${p.first}'s job went wrong${p.jailUntil ? ', taken by the watch!' : '.'}`, 'bad'); }
        // a jailed member with little loyalty may talk
        if (g.id === 'player' && p.jailUntil && m && m.loyalty < 0.35 && this.rng.chance(0.5)) this.inform(p, g);
      }
    };

    S.upgradeHideout = function (g) {
      const next = LEVELS[g.level + 1]; if (!next) return false;
      // builders do the work: hired from the yard, or cheaper if the band has builders of its own
      const own = g.members.some((m) => m.role === 'builder' || ['builder', 'labourer', 'master builder', 'carpenter'].includes(this.byId.get(m.id)?.job?.role));
      const cost = Math.round(next.cost * (own ? 0.6 : 1));
      if (g.purse < cost) return false;
      g.purse -= cost; g.level++;
      const yard = [...this.biz.values()].find((x) => x.type === 'builder'); if (yard && !own) yard.cash += Math.round(cost * 0.5);
      const b = this.building(g.hideout); b.level = g.level; b.dirty = true; b.name = `${g.name}${/s$/.test(g.name) ? "'" : "'s"} ${next.name.toLowerCase()}`;
      if (g.level >= 1) { b.floors = g.level >= 3 ? 2 : 1; b.spec.floors = b.floors; }
      O.Interior && O.Interior.invalidate && O.Interior.invalidate(b);
      g.log.push(`Day ${this.day}: the camp became a ${next.name.toLowerCase()}.`);
      this.log(`Smoke rises over a new ${next.name.toLowerCase()} in the woods outside ${this.world.name}.`, 'gang');
      return true;
    };
  }

  O.Gangs = { install, ROLES, LEVELS };
})();
