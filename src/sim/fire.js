// Fire. Hearths, ovens and forges can set a building alight — more often in dry heat, in winter
// when every fire is banked high, under thatch, and in buildings in poor repair. A fire grows by
// the minute; rain damps it; neighbours come running with buckets from the well and beat it down,
// each pair of hands counting. A big fire throws sparks onto the roofs next door. A house left to
// burn falls to a blackened shell and its family must find another roof; a shop or public building
// is gutted and closed for repairs. The council rebuilds ruins when the chest allows.
'use strict';
(function () {
  const FLAMMABLE = { thatch: 1.7, shingle: 1.2, tile: 0.8, slate: 0.6 };
  const HOUSES = new Set(['house', 'tenement', 'townhouse', 'barn', 'woodcutter']);

  function installSim(Sim) {
    const S = Sim.prototype;

    S.ignite = function (b, why) {
      if (!b || b.fire || b.ruined || b.site || b.type === 'hideout') return false;
      b.fire = { i: 0.25, t: 0, full: 0, peak: 0.25, fighters: 0 }; // well alight by the time anyone notices
      this.log(`Fire! ${b.type === 'house' ? (b.household ? `The ${this.households[b.household - 1]?.surname || ''} house` : 'An empty house') : b.name} is burning${why ? ` (${why})` : ''}. Bells are ringing the alarm.`, 'disaster');
      // those inside get out
      for (const p of this.people) if (p.agent.inside === b.id) { p.agent.inside = null; p.agent.hidden = false; const [ex, ey] = this.entry(b); [p.agent.x, p.agent.y] = this.tileCenter(ex, ey + 1, p); p.task = null; p.activity = null; }
      this.onFire && this.onFire(b);
      return true;
    };

    S.fireHourly = function () {
      const W = this.weather, r = this.rng;
      const wx = W.raining ? 0.15 : W.kind === 'heat' ? 2.5 : 1, season = this.season === 'winter' ? 1.6 : this.season === 'summer' ? 1.2 : 1;
      for (const b of this.world.buildings) {
        if (b.fire || b.ruined || b.site || !b.spec || (!b.spec.chimney && !['bakery', 'smithy', 'armourer', 'tavern'].includes(b.type))) continue;
        const k = 0.00002 * wx * season * (FLAMMABLE[b.spec.roof] || 1) * (['bakery', 'smithy', 'armourer'].includes(b.type) ? 2 : 1) * (2 - (b.condition ?? 0.8));
        if (r.chance(k)) this.ignite(b, ['a spark from the hearth', 'a fallen candle', 'an untended fire', 'a chimney fire'][r.int(0, 3)]);
      }
    };

    // a tile in front of the burning building for a firefighter to stand on
    S.fireTile = function (b, p) {
      const w = this.world, r = O.RNG(O.hash(p.id, b.id));
      for (let k = 0; k < 20; k++) { const x = r.int(b.x - 1, b.x + b.w), y = b.bottom + r.int(1, 2); if (x >= 0 && y < w.H && !w.solid[y * w.W + x]) return [x, y]; }
      return this.entry(b);
    };
    const _zone = S.zoneTile;
    S.zoneTile = function (p, zone) { if (zone === 'fire' && p.task?.b2) { const b = this.building(p.task.b2); if (b) return this.fireTile(b, p); } return _zone.call(this, p, zone); };

    S.fireMinute = function () {
      const burning = this.world.buildings.filter((b) => b.fire);
      if (!burning.length) return;
      const W = this.weather, r = this.rng;
      for (const b of burning) {
        const f = b.fire; f.t++;
        // the call to arms: able-bodied neighbours within reach come running (sleepers too, once roused)
        if (f.t % 5 === 1) {
          const cx = (b.x + b.w / 2) * this.T, cy = b.bottom * this.T;
          for (const p of this.people) {
            if (p.visitor || p.age < 13 || p.age > 70 || p.health.illness || p.task?.act === 'firefight' || p.task?.act === 'jailed' || p.task?.emigrating) continue;
            const d = Math.hypot(p.agent.x - cx, p.agent.y - cy) / this.T;
            if (d > (f.t < 30 ? 30 : 60)) continue;
            if (p.activity?.act === 'sleep' && !r.chance(0.5)) continue;
            p.task = { act: 'firefight', outdoor: true, zone: 'fire', b2: b.id };
          }
        }
        const fighters = this.people.filter((p) => p.task?.act === 'firefight' && p.task.b2 === b.id && p.agent.goal && !p.agent.path && p.agent.inside == null).length + (b.fire.player || 0);
        f.fighters = fighters; b.fire.player = 0;
        const roof = FLAMMABLE[b.spec.roof] || 1;
        f.i += 0.0045 * roof * (0.6 + W.wind * 0.8) * (W.kind === 'heat' ? 1.4 : 1) - (W.raining ? 0.006 * W.intensity() * 2 : 0) - Math.min(14, fighters) * 0.0007; // one well, one bucket line: only so many hands help
        f.i = Math.min(1, f.i); f.peak = Math.max(f.peak, f.i);
        if (f.i <= 0) { this.fireOut(b); continue; }
        if (f.i >= 1) f.full++;
        // sparks on the roofs next door
        if (f.i > 0.6 && r.chance(0.004 * (0.5 + W.wind))) {
          const near = this.world.buildings.filter((o) => o !== b && !o.fire && !o.ruined && !o.site && Math.abs((o.x + o.w / 2) - (b.x + b.w / 2)) < (o.w + b.w) / 2 + 3 && Math.abs(o.bottom - b.bottom) < 6);
          const o = near.length ? r.pick(near) : null;
          if (o && r.chance(FLAMMABLE[o.spec?.roof] ? FLAMMABLE[o.spec.roof] / 1.7 : 0.5)) this.ignite(o, 'sparks from next door');
        }
        b.condition = Math.max(0.05, b.condition - 0.002 * f.i);
        if (f.full >= 80) this.burnDown(b);
      }
    };

    const thank = (sim, b) => { for (const p of sim.people) if (p.task?.act === 'firefight' && p.task.b2 === b.id) { p.task = null; p.needs.energy = Math.max(0, p.needs.energy - 15); sim.remember(p, `We fought the fire at ${b.type === 'house' ? 'the house on the lane' : b.name} with buckets from the well.`, 'event', 2); } };
    S.fireOut = function (b) {
      const f = b.fire; b.fire = null; thank(this, b);
      b.condition = Math.max(0.1, b.condition - f.peak * 0.4); b.needsRepair = true; b.dirty = true;
      this.log(`The fire at ${b.type === 'house' ? 'the house' : b.name} is out after ${Math.round(f.t / 60 * 10) / 10} hours, thanks to ${f.fighters || 'a few'} pairs of hands. ${f.peak > 0.7 ? 'The damage is heavy.' : 'The damage is slight.'}`, 'disaster');
      this.onFireOut && this.onFireOut(b, f);
    };
    S.burnDown = function (b) {
      const f = b.fire; b.fire = null; thank(this, b);
      if (!HOUSES.has(b.type) || this.biz.get(b.id) && ['tavern', 'chapel', 'doctor', 'guard', 'mill', 'bakery', 'farmhouse', 'store', 'smithy'].includes(b.type)) {
        // a working building is gutted, not lost: it closes for repairs
        b.condition = 0.15; b.needsRepair = true; b.gutted = this.day + 4; b.dirty = true;
        const bz = this.biz.get(b.id); if (bz) for (const g of Object.keys(bz.stock)) bz.stock[g] = Math.floor(bz.stock[g] * 0.4);
        this.log(`${b.name} has been gutted by fire. It will be closed for repairs for some days.`, 'disaster');
        O.Interior && O.Interior.invalidate(b);
        this.onFireOut && this.onFireOut(b, f, true);
        return;
      }
      b.ruined = { day: this.day, was: b.type }; b.condition = 0; b.dirty = true; b.closedShop = null;
      const hh = b.household && this.households[b.household - 1];
      if (hh && !hh.gone) {
        for (const id of hh.members) { const q = this.byId.get(id); if (q) { q.mood -= 0.5; this.remember(q, `Our house burned down. We lost everything.`, 'hardship', 4); } }
        const other = this.world.buildings.find((x) => x.type === 'house' && !x.household && !x.ruined && !x.site && !x.fire && x !== b);
        b.household = null;
        if (other) { other.household = hh.id; other.vacant = false; hh.home = other.id; for (const id of hh.members) { const q = this.byId.get(id); if (q) q.home = other.id; } hh.pantry = { bread: 2, cabbage: 0, firewood: 0 }; this.log(`The ${hh.surname} family's house burned to the ground. The parish has found them an empty house.`, 'disaster'); }
        else { this.log(`The ${hh.surname} family's house burned to the ground. With nowhere to go, they are leaving ${this.world.name}.`, 'disaster'); this.emigrate(hh); }
      } else this.log(`${b.type === 'house' ? 'An empty house' : b.name} burned to the ground.`, 'disaster');
      O.Interior && O.Interior.invalidate(b);
      this.onFireOut && this.onFireOut(b, f, true);
    };

    // the council rebuilds a ruin when the common chest allows
    S.rebuildRuins = function () {
      if (this.opts && this.opts.foreign) return;
      const ruin = this.world.buildings.find((b) => b.ruined && this.day - b.ruined.day >= 3);
      if (!ruin || this.build.sites.some((s) => s.stage < 10) || this.treasury.cash < 220) return;
      const cost = 140, id = ruin.id, r = this.rng;
      ruin.ruined = null; ruin.site = true; ruin.type = 'house'; ruin.name = 'Building site'; ruin.condition = 1; ruin.dirty = true;
      ruin.spec = Object.assign({}, ruin.spec, { condition: 1, roof: ruin.spec.roof === 'thatch' ? 'shingle' : ruin.spec.roof, _fin: undefined });
      const site = { id, b: ruin, stage: 2, prog: 0, work: 0, stalled: null, started: this.day };
      this.build.sites.push(site);
      const def = { label: 'Building site', jobs: [['builder', 3]], hours: [7, 17], recipes: [], sells: [], buys: { logs: 'woodcutter', stone: 'import' }, targets: { logs: 12, stone: 10 }, wage: { builder: 7 }, site: true };
      const bz = { id, b: ruin, type: 'site', def, name: 'the rebuilding', owner: null, workers: [], stock: { logs: 0, stone: 0 }, cash: cost, sold: {}, bought: {}, open: false, orders: [], salesToday: 0, history: [] };
      this.biz.set(id, bz); this.treasury.cash -= cost; this.treasury.spent += cost;
      const idle = this.people.filter((p) => !p.visitor && p.age >= 17 && p.age < 60 && (!p.job || p.job.role === 'porter')).slice(0, 3);
      for (const p of idle) { p.job = { biz: id, role: 'builder' }; p.skills.builder = r.float(0.3, 0.7); bz.workers.push(p.id); }
      this.log(`The council has paid ${cost}d to rebuild the burned house${ruin.spec.roof !== 'thatch' ? ', this time under a roof that won\'t catch' : ''}. ${idle.length} hired as builders.`, 'politics');
    };

    // wire into the clock
    const _mt = S.minuteTick;
    S.minuteTick = function () {
      _mt.call(this);
      this.fireMinute();
      if (this._m % 60 === 30) this.fireHourly();
      if (this._m === 7 * 60) this.rebuildRuins();
      // gutted businesses stay shut until repaired
      for (const b of this.world.buildings) if (b.gutted) { if (this.day >= b.gutted) { b.gutted = null; b.condition = 0.6; b.dirty = true; this.log(`${b.name} has reopened after the fire.`, 'economy'); } else { const bz = this.biz.get(b.id); if (bz) bz.open = false; } }
    };
    const _idle = S.idleAnim;
    S.idleAnim = function (p) { if (p.activity?.act === 'firefight') return (Math.floor(this.minute / 2) + p.id) % 3 ? 'work' : 'carry'; return _idle.call(this, p); };
  }

  O.Fire = { installSim, FLAMMABLE };
})();
