// Disasters beyond fire: floods and pestilence.
//
// Flood: days of heavy rain swell the river until it breaks its banks. The water creeps tile by tile
// over the low ground (blocking lanes and paths while it lasts), soaks into houses and shops near
// the river, damaging them, spoiling stored food and stock, drowns the crops in flooded fields,
// and can tear at the bridge. When the rain stops it slowly drains away.
//
// Pestilence: from time to time a plague rises somewhere in the realm and creeps along the roads.
// It reaches Ashford with travellers. The sick infect those they share a roof with; the council
// orders a quarantine (the doors of sick houses are marked, the tavern is shut, gatherings are
// cancelled), the physician is overwhelmed, and the plague burns out or is beaten.
'use strict';
(function () {
  // ---------------------------------------------------------------- the kingdom: plague on the roads
  function installKingdom(Kingdom) {
    const K = Kingdom.prototype, _daily = K.daily;
    K.daily = function () { _daily.call(this); try { this.plagueDaily(); } catch (e) { console.error(e); } };
    K.plagueDaily = function () {
      const r = this.rng, day = this.sim.day;
      const sick = this.places.filter((p) => p.plague);
      if (!sick.length && r.chance(0.0018)) {
        const p = r.pick(this.places.filter((x) => !x.detailed && x.pop > 100));
        p.plague = { since: day }; p.health = Math.max(0.3, p.health - 0.3);
        this.addNews(`Pestilence has broken out at ${p.name}. Travellers from there are turned away at the gates.`, 'health', p.id);
      }
      for (const p of sick) {
        if (p.detailed) continue;
        p.health = Math.max(0.25, p.health - 0.03); p.pop = Math.max(30, p.pop - Math.round(p.pop * 0.004)); p.happiness = Math.max(0.1, p.happiness - 0.02);
        for (const n of this.neighbours(p.id)) { const q = this.place(n); if (!q.plague && !q.detailed && r.chance(0.02)) { q.plague = { since: day }; this.addNews(`The pestilence has spread along the road to ${q.name}.`, 'health', q.id); } }
        if (day - p.plague.since > 14 && r.chance(0.15)) { p.plague = null; p.health = Math.min(1, p.health + 0.1); this.addNews(`The pestilence at ${p.name} has burned itself out.`, 'health', p.id); }
      }
    };
  }

  // ---------------------------------------------------------------- the village
  function installSim(Sim) {
    const S = Sim.prototype;

    // --- plague ---
    S.plagueDaily = function () {
      if (this.opts && this.opts.foreign) return;
      const K = this.kingdom, here = this.world.placeId || 'ashford';
      const near = K.places.filter((p) => p.plague && (K.neighbours(here).includes(p.id) || p.id === here));
      const cases = this.people.filter((p) => p.health.illness?.kind === 'pestilence');
      // travellers bring it in
      if (near.length && !cases.length && this.rng.chance(0.07)) {
        const p = this.rng.pick(this.people.filter((q) => !q.visitor && q.age >= 14 && !q.health.illness));
        if (p) { this.fallIll(p, 'pestilence', 0.3); this.log(`${p.name} has fallen sick with the pestilence after market folk came from ${near[0].name}.`, 'health'); }
      }
      // the council orders a quarantine
      if (cases.length >= 3 && !this.quarantine) {
        this.quarantine = { since: this.day };
        this.log(`The council has ordered a quarantine against the pestilence: the sick keep to their houses, their doors are marked with a cross, the tavern is shut and there will be no gatherings.`, 'politics');
        const doc = this.biz.get(this.docId); if (doc && this.treasury.cash > 60) { doc.cash += 40; doc.stock.herbs = (doc.stock.herbs || 0) + 12; doc.stock.medicine = (doc.stock.medicine || 0) + 6; this.treasury.cash -= 40; }
      }
      if (this.quarantine) {
        // doors of sick households are marked
        const sickHomes = new Set(cases.map((p) => p.home));
        // the parish feeds the shut-in households: bread left on the step
        for (const hh of this.households) if (!hh.gone && sickHomes.has(hh.home) && hh.pantry.bread < hh.members.length) { const n = hh.members.length; hh.pantry.bread += n; this.treasury.cash -= n * 2; this.treasury.spent += n * 2; }
        for (const b of this.world.buildings) { const m = sickHomes.has(b.id); if (!!b.marked !== m) b.marked = m; }
        if (!cases.length) { this.quarantineClear = (this.quarantineClear || 0) + 1; if (this.quarantineClear >= 3) { this.quarantine = null; this.quarantineClear = 0; for (const b of this.world.buildings) b.marked = false; this.log(`The quarantine is lifted. The pestilence has left ${this.world.name}; the bell rings for those it took.`, 'health'); } }
        else this.quarantineClear = 0;
      }
    };
    const _plan = S.plan;
    S.plan = function (p) {
      const pl = _plan.call(this, p);
      if (!this.quarantine || p.visitor) return pl;
      // the marked houses keep to themselves; the tavern is shut; no festival
      if (this.world.buildings.find((b) => b.id === p.home)?.marked && !['to-doctor', 'treated', 'sick', 'help', 'escort'].includes(pl.act) && p.task?.act !== 'firefight') return { act: 'home', b: p.home };
      if (pl.act === 'socialise' || pl.act === 'eat-out' || pl.act === 'festival') return { act: 'home', b: p.home };
      return pl;
    };

    // --- flood ---
    S.floodInit = function () {
      if (this.floodState) return this.floodState;
      const w = this.world; if (!w.river) return null;
      // distance of every land tile from the river, walking over land only
      const W = w.W, H = w.H, dist = new Int16Array(W * H).fill(-1), q = [];
      for (let i = 0; i < W * H; i++) if (w.ter[i] === w.TER.WATER) { dist[i] = 0; q.push(i); }
      for (let k = 0; k < q.length; k++) {
        const i = q[k], x = i % W, y = (i / W) | 0;
        if (dist[i] >= 6) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (dist[j] >= 0) continue; const t = w.ter[j]; if (t === w.TER.BRIDGE) continue; dist[j] = dist[i] + 1; q.push(j); }
      }
      this.floodState = { level: 0, dist, set: [], peak: 0 };
      return this.floodState;
    };
    S.floodHourly = function () {
      const F = this.floodInit(); if (!F) return;
      const W = this.weather, w = this.world;
      const before = Math.floor(F.level);
      if ((W.kind === 'heavy' || W.kind === 'storm') && W.wet > 0.7) F.level = Math.min(5, F.level + (W.kind === 'storm' ? 0.45 : 0.3));
      else if (W.kind === 'rain' && W.wet > 0.9 && F.level > 0.5) F.level = Math.min(5, F.level + 0.05);
      else F.level = Math.max(0, F.level - 0.12);
      F.peak = Math.max(F.peak, F.level);
      const lv = Math.floor(F.level);
      if (lv !== before) {
        // the water creeps up or drains back: flooded land can't be walked
        for (const i of F.set) w.solid[i] = 0;
        F.set = [];
        if (lv >= 1) for (let i = 0; i < w.W * w.H; i++) if (F.dist[i] > 0 && F.dist[i] <= lv && !w.solid[i]) { w.solid[i] = 1; F.set.push(i); }
        F.tiles = lv >= 1 ? new Set([...F.set, ...this.floodedBuildingTiles(lv)]) : null;
        this.path.recost(); this.path.clear(); w.dirtyStatics = true;
        if (lv >= 1 && before < 1) this.log(`The river has burst its banks! Water is spreading over the low ground by the bridge.`, 'disaster');
        if (lv === 0 && before >= 1) { this.log(`The flood waters have drained away, leaving mud and ruin behind.`, 'disaster'); F.peak = 0; }
      }
      if (lv >= 1) this.floodDamage(lv);
    };
    S.floodedBuildingTiles = function (lv) { const out = []; const w = this.world; for (const b of w.buildings) for (let yy = b.y; yy <= b.bottom; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) { const i = yy * w.W + xx; if (this.floodState.dist[i] > 0 && this.floodState.dist[i] <= lv) out.push(i); } return out; };
    S.floodDamage = function (lv) {
      const F = this.floodState, w = this.world, r = this.rng;
      for (const b of w.buildings) {
        if (b.site || b.ruined) continue;
        let wet = false; for (let xx = b.x; xx < b.x + b.w && !wet; xx++) { const i = (b.bottom + 1) * w.W + xx; if (F.dist[i] > 0 && F.dist[i] <= lv) wet = true; const j = b.bottom * w.W + xx; if (F.dist[j] > 0 && F.dist[j] <= lv) wet = true; }
        if (!wet) continue;
        b.condition = Math.max(0.15, b.condition - 0.006); b.needsRepair = true;
        if (!b.floodedDay || b.floodedDay !== this.day) {
          b.floodedDay = this.day; b.dirty = true;
          const hh = b.household && this.households[b.household - 1];
          if (hh) { for (const g of Object.keys(hh.pantry)) hh.pantry[g] = Math.floor(hh.pantry[g] * 0.6); for (const id of hh.members) { const q = this.byId.get(id); if (q && q.age >= 10) this.remember(q, 'The flood came into the house. The flour is ruined and the floor is all mud.', 'hardship', 2); } }
          const bz = this.biz.get(b.id); if (bz) for (const g of ['flour', 'bread', 'wheat', 'cabbage', 'meal', 'cloth', 'herbs']) if (bz.stock[g]) bz.stock[g] = Math.floor(bz.stock[g] * 0.6);
          this.log(`Flood water has got into ${b.type === 'house' ? 'a house by the river' : b.name}.`, 'disaster');
        }
      }
      // drowned fields
      const fz = this.Z.farm, farm = this.supplierOf('farmhouse');
      if (farm) { let n = 0; for (let y = fz[1]; y <= fz[3]; y++) for (let x = fz[0]; x <= fz[2]; x++) { const i = y * w.W + x; if (F.dist[i] > 0 && F.dist[i] <= lv) n++; } if (n) { farm.stock.wheat = Math.max(0, (farm.stock.wheat || 0) * (1 - Math.min(0.05, n / 400))); farm.stock.cabbage = Math.max(0, (farm.stock.cabbage || 0) * (1 - Math.min(0.05, n / 400))); } }
      // the bridge takes a battering
      if (lv >= 3 && this.weather.kind === 'storm' && r.chance(0.08)) { const K = this.kingdom, rd = K.roads.find((x) => x.bridge && (x.a === (w.placeId || 'ashford') || x.b === (w.placeId || 'ashford'))); if (rd && !rd.damaged) { rd.damaged = true; K.addNews(`The flood has torn at the bridge at ${w.name}. Carts are turned back until it is mended.`, 'roads'); } }
    };

    const _mt = S.minuteTick;
    S.minuteTick = function () { _mt.call(this); if (this._m % 60 === 15) this.floodHourly(); if (this._m === 6 * 60 + 5) this.plagueDaily(); if (this.quarantine) { const tv = this.biz.get(this.tavernId); if (tv) tv.open = false; } };
    const _fest = S.festival;
    S.festival = function () { return !this.quarantine && _fest.call(this); };
  }

  O.Disasters = { installKingdom, installSim };
  installKingdom(O.Kingdom);
})();
