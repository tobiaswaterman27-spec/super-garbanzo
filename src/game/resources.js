// What the land gives, and how much of it is left. Each town has its own riches: good soil or poor,
// a river thick with fish or thin, a deep seam of ore or a shallow one. What the farms, fisheries,
// mines, quarries and pits take out comes from those, and they recover at their own pace (fish and
// herbs quickly, soil with a winter's rest, stone slowly, ore hardly at all). Work a place too hard
// and the yield falls, the goods grow scarce and dear, and people notice; leave it be and it comes back.
'use strict';
(function () {
  // which trade draws on which of the land's riches, how fast it recovers each day, and its name in talk
  const SRC = { farmhouse: 'soil', fishery: 'fish', mine: 'ore', quarry: 'stone', butcher: 'livestock', claypit: 'clay', peatcut: 'peat', apothecary: 'herbs', lodge: 'game', doctor: 'herbs' };
  const REGEN = { soil: 0.06, fish: 0.1, ore: 0.008, stone: 0.02, livestock: 0.08, clay: 0.03, peat: 0.02, herbs: 0.12, game: 0.08 };
  const SAY = { soil: ['the soil is tired', 'the soil is good'], fish: ['the waters are fished out', 'the fishing is good'], ore: ['the seams are running thin', 'the ore is rich'], stone: ['the good stone is getting hard to reach', 'the stone is plentiful'], livestock: ['beasts for the butcher are few', 'there are beasts enough'], clay: ['the clay beds are worked out', 'the clay is good'], peat: ['the peat is cut back', 'the peat is deep'], herbs: ['the herbs are picked over', 'herbs grow thick'], game: ['the game is hunted out', 'the woods are full of game'] };
  function setup(game) {
    const SP = O.Sim.prototype, cur = () => O.SimRef.cur;
    const resOf = (s) => {
      if (s.res) return s.res; s.res = {};
      const id = s.world.placeId || s.world.name || 'x', C = O.climateOf && O.climateOf(s.world.placeId);
      for (const k of Object.keys(REGEN)) { let v = 0.55 + (O.hash('riches', id, k) % 45) / 100; if (k === 'soil' && C && C.cold) v -= 0.15; if (k === 'soil' && C && C.warm) v += 0.08; s.res[k] = O.clamp(v, 0.3, 1); }
      return s.res;
    };
    const key = (bz) => (bz.type === 'doctor' ? null : SRC[bz.type]);
    // the yield: whatever the trade made from nothing is scaled by what's left, and draws it down
    // every post does something for the place, even where it makes nothing to sell: the watch keeps the
    // peace, the jester and the minstrel cheer, the teacher teaches, healers heal, the clerks bring in
    // the fees, keepers keep the game, grooms feed the horses, servants keep the house in repair
    const PURPOSE = [
      [/guard|watch|sergeant|constable|sheriff|turnkey|gaoler|night watchman/, (s, P) => { if (P) P.security = Math.min(1, (P.security ?? 0.5) + 0.00004); }],
      [/jester|minstrel|fiddler|herald|crier|bell-ringer|pilgrim guide/, (s, P) => { if (P) P.happiness = Math.min(1, (P.happiness ?? 0.5) + 0.00003); }],
      [/priest|monk|nun|chaplain|bishop|abbot|abbess|prioress|parish clerk/, (s, P) => { if (P) P.happiness = Math.min(1, (P.happiness ?? 0.5) + 0.00002); }],
      [/teacher/, (s) => { const k = s.people.find((q) => q.age >= 6 && q.age < 14 && Math.random() < 0.02); if (k) k.skills.letters = Math.min(1, (k.skills.letters || 0) + 0.001); }],
      [/physician|nurse|midwife|herbalist|barber|apothecary|monk|nun/, (s) => { const q = s.people.find((z) => z.health && z.health.illness && Math.random() < 0.05); if (q) q.health.illness.sev = Math.max(0, q.health.illness.sev - 0.002); }],
      [/sweeper|chimney sweep|rat-catcher|lamplighter|water carrier|gravedigger/, (s, P) => { if (P) P.happiness = Math.min(1, (P.happiness ?? 0.5) + 0.00002); }],
      [/clerk|scribe|magistrate|tax collector|bailiff|ballot clerk|toll keeper|postmaster|harbour master/, (s) => { if (s.treasury) { s.treasury.cash += 0.01; s.treasury.income = (s.treasury.income || 0) + 0.01; } }],
      [/gamekeeper|forester|falconer/, (s) => { const R = resOf(s); R.game = Math.min(1, R.game + 0.00005); }],
      [/groom|stablehand|master of horse/, () => { for (const h of (O.horsesAll ? O.horsesAll() : [])) if ((h.fed ?? 100) < 100 && Math.random() < 0.01) h.fed = 100; }],
      [/maid|chambermaid|butler|steward|chamberlain|page|lady-in-waiting|servant|gardener/, (s, P, p) => { const b = p.job && s.building(p.job.biz); if (b) b.condition = Math.min(1, (b.condition ?? 0.8) + 0.00003); }],
      [/spy|squire|knight|royal guard|captain/, (s, P) => { if (P) P.security = Math.min(1, (P.security ?? 0.5) + 0.00002); }],
    ];
    const _work = SP.work;
    SP.work = function (p) {
      { const role = p.job && p.job.role; if (role) { const P = this.kingdom && this.kingdom.place ? this.kingdom.place(this.world.placeId) : null; for (const [re, f] of PURPOSE) if (re.test(role)) f(this, P, p); } }
      const bz = p.job && this.biz.get(p.job.biz), k = bz && key(bz);
      if (!k) return _work.call(this, p);
      const outs = []; for (const rc of bz.def.recipes) if (!Object.keys(rc.inp).length) outs.push(...Object.keys(rc.out));
      if (!outs.length) return _work.call(this, p);
      const before = outs.map((g) => bz.stock[g] || 0);
      _work.call(this, p);
      const R = resOf(this), lvl = R[k], mult = 0.3 + 0.7 * lvl;
      let made = 0, target = 0;
      outs.forEach((g, i) => { const d = (bz.stock[g] || 0) - before[i]; if (d <= 0) return; bz.stock[g] = before[i] + d * mult; made += d * mult; target += (bz.def.targets && bz.def.targets[g]) || 30; });
      if (made > 0) R[k] = Math.max(0.05, lvl - made / (Math.max(20, target) * 60));
    };
    // each day the land recovers, and people say so when it runs low
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      const R = resOf(this), winter = this.season === 'winter';
      for (const k of Object.keys(R)) {
        const was = R[k]; let g = REGEN[k] * (1 - was);
        if (k === 'soil' && winter) g += 0.04; if (k === 'herbs' && winter) g = 0; if (k === 'fish' && winter) g *= 0.5;
        R[k] = Math.min(1, was + g);
        const has = [...this.biz.values()].some((z) => key(z) === k);
        if (has && was >= 0.35 && R[k] < 0.35) this.log(`In ${this.world.name} ${SAY[k][0]}: less comes in, and it costs more.`, 'economy');
        if (has && was < 0.6 && R[k] >= 0.6 && (this._resLow || {})[k]) { this.log(`In ${this.world.name} ${SAY[k][1]} again.`, 'economy'); this._resLow[k] = false; }
        if (R[k] < 0.35) (this._resLow = this._resLow || {})[k] = true;
      }
      return r;
    };
    // what a worker of the land knows of it
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const bz = q.job && s.biz.get(q.job.biz), k = bz && key(bz); if (!k) return '';
      const v = resOf(s)[k];
      return v < 0.35 ? `At your work, ${SAY[k][0]}: the yield is poor and you worry about it.` : v > 0.75 ? `At your work, ${SAY[k][1]}.` : '';
    });
    O.Resources = { of: resOf };
  }
  O.ResourcesSetup = { setup };
})();
