// The woods and the timber trade. Every bundle of logs comes from a real tree: as the woodcutters
// work, trees near the woods fall and leave stumps. The forester plants a staked sapling in each
// stump's place, and over a season and more it grows back into a tree. Cut faster than you plant
// and the woods thin: the woodcutters walk further for less, and the price of timber rises. Logs go
// to the sawmill for planks, planks to the carpenter for furniture, and furniture to the homes of
// families who can afford it — which shows in their houses.
'use strict';
(function () {
  function installSim(Sim) {
    const S = Sim.prototype;

    S.forestInit = function () {
      if (this.forest) return this.forest;
      const Z = this.Z.wood, cx = (Z[0] + Z[2]) / 2, cy = (Z[1] + Z[3]) / 2;
      const near = this.world.trees.filter((t) => Math.hypot(t.x / this.T - cx, t.y / this.T - cy) < 18);
      this.forest = { start: near.length, logs: (this.stats.produced.logs || 0), felled: 0, planted: 0 };
      return this.forest;
    };

    S.forestDaily = function () {
      if (!this.supplierOf('woodcutter')) return;
      const F = this.forestInit(), w = this.world, r = this.rng, T = this.T;
      const Z = this.Z.wood, cx = (Z[0] + Z[2]) / 2, cy = (Z[1] + Z[3]) / 2;
      // every ten bundles of logs is one tree down, taken from the edge of the woods nearest the hut
      const made = (this.stats.produced.logs || 0) - F.logs; F.logs = this.stats.produced.logs || 0;
      let fell = Math.floor((made + (F.carry || 0)) / 10); F.carry = (made + (F.carry || 0)) % 10;
      const nearTrees = () => w.trees.filter((t) => Math.hypot(t.x / T - cx, t.y / T - cy) < 18).sort((a, b) => Math.hypot(a.x / T - cx, a.y / T - cy) - Math.hypot(b.x / T - cx, b.y / T - cy));
      while (fell-- > 0) {
        const cand = nearTrees(); if (cand.length <= 4) break;
        const t = cand[Math.min(cand.length - 1, r.int(0, 5))];
        w.trees = w.trees.filter((x) => x !== t);
        w.props.push({ kind: 'stump', x: t.x, y: t.y, seed: t.seed, v: 0, solid: false, felled: this.day, treeKind: t.kind });
        w.solid[Math.floor(t.y / T) * w.W + Math.floor(t.x / T)] = 0;
        F.felled++; w.dirtyStatics = true;
      }
      // the forester plants saplings in old stumps; saplings grow and become trees
      for (const p of w.props) {
        if (p.kind === 'stump' && p.felled != null && this.day - p.felled >= 2 && r.chance(0.6)) { p.kind = 'sapling'; p.v = 0; p.planted = this.day; F.planted++; w.dirtyStatics = true; }
        else if (p.kind === 'sapling' && p.planted != null) {
          const age = this.day - p.planted;
          const v = age >= 18 ? 2 : age >= 8 ? 1 : 0;
          if (v !== p.v) { p.v = v; w.dirtyStatics = true; }
          if (age >= 28) { p.grown = true; w.trees.push({ kind: p.treeKind || 'oak', x: p.x, y: p.y, seed: p.seed + 1 }); w.solid[Math.floor(p.y / T) * w.W + Math.floor(p.x / T)] = 1; w.dirtyStatics = true; }
        }
      }
      w.props = w.props.filter((p) => !p.grown);
      // a thin wood: woodcutters work harder for less, and timber gets dear
      const left = nearTrees().length, ratio = F.start ? left / F.start : 1;
      const wc = this.supplierOf('woodcutter');
      if (wc) {
        wc.thin = ratio < 0.6;
        if (ratio < 0.6 && !F.warned) { F.warned = true; this.log(`The woods above ${this.world.name} are thinning. The woodcutters must walk further for every load, and timber is getting dear.`, 'economy'); }
        if (ratio > 0.75) F.warned = false;
      }
      // families with money to spare furnish their homes
      const cp = this.supplierOf('carpenter', 'furniture');
      if (cp && this.weekday === 2) for (const hh of this.households) {
        if (hh.gone || hh.money < 220 || !cp.open && this.hour > 17) continue;
        const b = this.building(hh.home); if (!b || (b.wealth ?? 0.5) > 0.92 || (cp.stock.furniture || 0) < 1 || !r.chance(0.3)) continue;
        const pr = this.price(cp, 'furniture');
        hh.money -= pr; cp.stock.furniture -= 1; cp.cash += pr; cp.salesToday += pr; this.stats.sales += pr;
        b.wealth = Math.min(0.95, (b.wealth ?? 0.5) + 0.03); b.spec.wealth = b.wealth; b.dirty = true; O.Interior && O.Interior.invalidate(b);
        for (const id of hh.members) { const q = this.byId.get(id); if (q && q.age >= 16 && r.chance(0.5)) this.remember(q, `We bought a new chair from ${cp.name}. The house looks finer for it.`, 'life', 0.8); }
      }
    };
    // in a thin wood the woodcutters' work yields less
    const _work = S.work;
    S.work = function (p) {
      const bz = this.biz.get(p.job?.biz);
      if (bz && bz.type === 'woodcutter' && bz.thin) { const before = bz.stock.logs || 0; _work.call(this, p); const got = (bz.stock.logs || 0) - before; if (got > 0) bz.stock.logs -= got * 0.4; return; }
      return _work.call(this, p);
    };
  }

  O.Forestry = { installSim };
})();
