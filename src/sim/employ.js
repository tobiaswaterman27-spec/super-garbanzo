// Hiring. Whoever runs a place decides who works there, and they decide the same way for everyone,
// you included: do they need anyone (an empty place, or so much trade they'd take on another pair of
// hands), how desperate are they (a place empty for days, the till full, the shelves bare), do they
// like you, and what is said of you. They can be asked any time, at work or not.
'use strict';
(function () {
  const D = () => O.Data;
  function installSim(Sim) {
    const S = Sim.prototype;

    // who hires for a business: its owner, else whoever holds its first (master's) post
    S.bossOf = function (bz) {
      if (!bz) return null;
      if (bz.owner != null) { const o = this.byId.get(bz.owner); if (o && o.alive !== false) return o; }
      const first = bz.def.jobs[0][0];
      return bz.workers.map((id) => this.byId.get(id)).find((q) => q && q.alive !== false && q.job?.role === first) || null;
    };
    // the places and roles still to fill
    S.vacancies = function (bz) {
      const out = [];
      for (const [role, n] of bz.def.jobs) {
        let have = bz.workers.filter((id) => { const q = this.byId.get(id); return q && q.alive !== false && q.job?.role === role; }).length;
        if (bz.playerRole === role) have++;
        if (have < n && !(bz.def.wage[role] === 0 && (bz.owner != null || bz.ownerPlayer))) out.push(role);
      }
      return out;
    };
    // how badly the place needs hands, 0..1
    S.desperation = function (bz) {
      const vac = this.vacancies(bz).length, open = bz.vacantSince != null ? this.day - bz.vacantSince : 0;
      const bare = Object.entries(bz.def.targets || {}).filter(([g, t]) => (bz.stock[g] || 0) < t * 0.2).length / Math.max(1, Object.keys(bz.def.targets || {}).length);
      return O.clamp(vac * 0.15 + open * 0.08 + bare * 0.4 + (bz.cash > 200 ? 0.15 : 0), 0, 1);
    };
    // would the boss take this person on? returns { yes, role, wage, why }
    S.hireDecision = function (bz, boss, who) {
      const isPlayer = who === 'player', des = this.desperation(bz), vac = this.vacancies(bz);
      // a busy place with a full till will make room for one more pair of hands
      const extra = !vac.length && des > 0.35 && bz.cash > 120 ? (bz.def.jobs.find(([r]) => ['labourer', 'apprentice', 'server', 'farmhand', 'scullion', 'maid', 'potboy'].includes(r)) || bz.def.jobs[bz.def.jobs.length - 1])[0] : null;
      // somebody has to collect the pots: at an inn the player can always be the potboy (or potgirl)
      if (!vac.length && !extra) return { yes: false, why: 'none' };
      const role = vac.length ? vac[vac.length - 1] : extra;
      if (bz.def.wage[role] === 0 && !bz.ownerPlayer) return { yes: false, why: 'none' };
      let like = 0, bad = 0;
      if (isPlayer) {
        const PS = O.PlayerState, r = boss ? boss.rel.get(0) || {} : {};
        like = r.affinity || 0;
        bad = Math.max(0, -PS.rep.local) * 1.2 + (PS.wantedLevel && PS.wantedLevel() >= 1 && boss && boss.memories.some((m) => m.kind === 'crime' && m.about === 0) ? 1 : 0) + (bz.firedPlayer ? 0.6 : 0);
      } else {
        const r = boss ? boss.rel.get(who.id) || {} : {};
        like = (r.affinity || 0) * 1.4; // friends are kept on, and enemies are let go first
        bad = (who.jailUntil ? 1 : 0) + (who.gang ? 0.3 : 0) + (who.memories.some((m) => m.kind === 'crime') ? 0.2 : 0) + Math.max(0, -who.attitude) * 0.3;
      }
      const score = 0.45 + like * 0.6 + des * 0.6 - bad;
      if (score < 0.25) return { yes: false, why: bad > 0.5 ? 'bad' : 'dislike', role };
      const wage = role === 'potboy' && !bz.def.wage.potboy ? 3 : Math.max(2, bz.def.wage[role] || 5);
      return { yes: true, role, wage };
    };

    // NPC employers choose among the jobless the same way, not just the first in the queue
    const _fill = S.fillVacancies;
    S.fillVacancies = function () {
      for (const bz of this.biz.values()) {
        if (bz.type === 'site') continue;
        const vac = this.vacancies(bz);
        if (vac.length && bz.vacantSince == null) bz.vacantSince = this.day;
        if (!vac.length) bz.vacantSince = null;
      }
      // a master with a place to fill asks a friend first, or a friend's grown child
      for (const bz of this.biz.values()) {
        if (bz.type === 'site' || bz.def.public) continue;
        const vac = this.vacancies(bz); if (!vac.length) continue;
        const boss = this.bossOf(bz); if (!boss) continue;
        const friend = this.people.filter((q) => !q.job && !q.visitor && q.alive !== false && q.age >= 16 && q.age < 60 && !q.jailUntil && !q.gentry && q.household !== boss.household)
          .map((q) => [q, (boss.rel.get(q.id) || {}).affinity || 0]).filter(([, f]) => f > 0.35).sort((x, y) => y[1] - x[1])[0];
        if (!friend) continue;
        const q = friend[0], role = vac[vac.length - 1];
        q.job = { biz: bz.id, role, hiredBy: boss.id }; bz.workers.push(q.id); this.refreshLook && this.refreshLook(q);
        this.remember(q, `${boss.first} gave me work at ${bz.name}. It pays to have friends.`, 'work', 1.5, boss.id);
      }
      // the old filler places people; then each boss may send away one they'd never have chosen
      _fill.call(this);
      for (const bz of this.biz.values()) {
        if (bz.type === 'site' || bz.def.public) continue;
        const boss = this.bossOf(bz); if (!boss) continue;
        for (const id of bz.workers.slice()) {
          const q = this.byId.get(id); if (!q || q === boss || q.job?.family || !q.job || q.job.hiredBy === boss.id) continue;
          q.job.hiredBy = boss.id;
          const d = this.hireDecision(Object.assign({}, bz, { workers: bz.workers.filter((x) => x !== id) }), boss, q);
          if (!d.yes && this.rng.chance(0.5)) {
            bz.workers = bz.workers.filter((x) => x !== id); q.job = null;
            this.remember(q, `${boss.name} wouldn't have me at ${bz.name}.`, 'work', 1.2, boss.id);
          }
        }
      }
    };
  }
  O.Employ = { installSim };
})();
