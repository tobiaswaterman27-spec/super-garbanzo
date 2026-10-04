// Construction and the town council's building decisions.
//
// The council funds a project from the treasury. A building site appears on a free plot, hires
// builders from people without work, and orders logs from the woodcutters and stone from travelling
// traders. Each of the eleven stages needs worker-hours and materials; rain slows work, storms stop
// it. When finished, scaffolding comes down, and a family arrives up the King's Road to move in.
'use strict';
(function () {
  const STAGES = ['Planned', 'Site preparation', 'Foundation', 'Timber frame', 'Walls', 'Floors', 'Roof frame', 'Roof', 'Exterior', 'Interior', 'Finished'];
  // worker-minutes for each stage, and the materials it consumes
  const WORK = [60, 120, 260, 300, 420, 300, 240, 320, 240, 240];
  const MATS = [{}, {}, { stone: 6 }, { logs: 6 }, { logs: 3, stone: 3 }, { logs: 3 }, { logs: 4 }, { logs: 2, stone: 2 }, { logs: 2 }, {}];
  const PLOTS = [[48, 16, 4, 3], [40, 16, 4, 3], [36, 50, 4, 3], [41, 50, 4, 3], [48, 11, 3, 3]];

  class Construction {
    constructor(sim) { this.sim = sim; this.sites = []; this.nextCouncil = { day: 1, minute: 10 * 60 }; this.used = new Set(); }

    // the building plots, where they fall in the world (Ashford's map may sit inside a larger region)
    plot(i) { const w = this.sim.world, [x, b, bw, bd] = PLOTS[i]; return [x + (w.ox || 0), b + (w.oy || 0), bw, bd]; }
    plotFree(pl) {
      const w = this.sim.world; const [x, bottom, bw, bd] = pl;
      for (const b of w.buildings) if (!(x + bw + 1 <= b.x || x - 1 >= b.x + b.w || bottom + 2 <= b.y || bottom - bd - 1 >= b.bottom)) return false;
      return true;
    }

    council() {
      const sim = this.sim;
      if (sim.opts && sim.opts.foreign) return; // other towns' councils are simulated in the abstract
      const free = PLOTS.map((p, i) => this.plot(i)).filter((p, i) => !this.used.has(i) && this.plotFree(p));
      const active = this.sites.filter((s) => s.stage < 10).length;
      if (!free.length || active >= 1) return;
      const cost = 160;
      if (sim.treasury.cash < cost + 150) { sim.log(`The council wanted to build, but the treasury holds only ${Math.round(sim.treasury.cash)}d.`, 'politics'); return; }
      this.start(PLOTS.findIndex((p, i) => this.plot(i)[0] === free[0][0] && this.plot(i)[1] === free[0][1]), cost);
    }

    start(pi, cost, opts = {}) {
      const sim = this.sim, w = sim.world, r = sim.rng;
      const [x, bottom, bw, bd] = this.plot(pi); this.used.add(pi);
      // clear trees and scatter from the plot
      const inPlot = (px, py) => px >= (x - 1) * 16 && px < (x + bw + 1) * 16 && py >= (bottom - bd) * 16 && py < (bottom + 2) * 16;
      w.trees = w.trees.filter((t) => { if (inPlot(t.x, t.y)) { w.solid[Math.floor(t.y / 16) * w.W + Math.floor(t.x / 16)] = 0; return false; } return true; });
      w.props = w.props.filter((p) => !inPlot(p.x, p.y));
      const id = Math.max(...w.buildings.map((b) => b.id)) + 1;
      const b = { id, type: 'house', name: 'Building site', x, bottom, w: bw, d: bd, y: bottom - bd + 1, floors: 1, wealth: 0.5, condition: 1, site: true };
      b.spec = { seed: O.hash('site', id), w: bw, d: bd, floors: 1, wealth: 0.5, condition: 1, wall: r.pick(['timber', 'timber', 'stone']), roof: r.pick(['shingle', 'thatch', 'tile']), roofType: r.chance(0.5) ? 'gable' : 'side', chimney: true, doorTile: Math.floor(bw / 2), plaster: r.pick(['plaster', 'plasterOchre', 'plasterWhite']) };
      b.doorX = x + b.spec.doorTile; b.doorY = bottom + 1;
      for (let yy = b.y; yy <= bottom; yy++) for (let xx = x; xx < x + bw; xx++) w.solid[yy * w.W + xx] = 1;
      w.buildings.push(b);
      const site = { id, b, stage: 0, prog: 0, work: 0, stalled: null, started: sim.day, player: !!opts.player };
      this.sites.push(site);
      // the site is run like a small business: builders, wages, material orders
      const def = { label: 'Building site', jobs: [['builder', 3]], hours: [7, 17], recipes: [], sells: [], buys: { logs: 'builder|woodcutter|import', stone: 'builder|quarry|import' }, targets: { logs: 12, stone: 10 }, wage: { builder: 7 }, site: true };
      const bz = { id, b, type: 'site', def, name: 'the new house site', owner: null, workers: [], stock: { logs: 0, stone: 0 }, cash: cost, sold: {}, bought: {}, open: false, orders: [], salesToday: 0, history: [] };
      sim.biz.set(id, bz);
      if (!opts.player) { sim.treasury.cash -= cost; sim.treasury.spent += cost; }
      // the builder's yard sends its own builders first; the rest are hired from those without work
      const yard = [...sim.biz.values()].find((x) => x.type === 'builder');
      const crew = yard ? yard.workers.map((wid) => sim.byId.get(wid)).filter((p) => p && p.alive !== false && ['builder', 'labourer'].includes(p.job?.role)).filter((p) => !p.job.yard) : [];
      for (const p of crew) { p.job = { biz: id, role: 'builder', yard: yard.id, yardRole: p.job.role }; p.skills.builder = Math.max(p.skills.builder || 0, 0.6); yard.workers = yard.workers.filter((x) => x !== p.id); bz.workers.push(p.id); sim.remember(p, `The yard sent me to build the new house.`, 'work', 0.8); }
      // a yard with stock sends the first loads straight to the site
      if (yard) for (const g of ['logs', 'stone']) { const q = Math.min(Math.floor((yard.stock[g] || 0) * 0.6), def.targets[g]); if (q > 0) { yard.stock[g] -= q; bz.stock[g] = (bz.stock[g] || 0) + q; const pay = Math.round(q * O.Data.GOODS[g].base); yard.cash += pay; bz.cash -= pay; } }
      const idle = sim.people.filter((p) => !p.visitor && !p.gentry && p.age >= 17 && p.age < 60 && (!p.job || p.job.role === 'porter')).slice(0, Math.max(0, 3 - crew.length));
      for (const p of idle) { p.job = { biz: id, role: 'builder' }; p.skills.builder = r.float(0.3, 0.7); bz.workers.push(p.id); sim.remember(p, 'Took work as a builder on the new house.', 'work', 1); }
      sim.log(opts.player ? `Builders have started on the newcomer's own house ${bottom < 30 ? 'beside the north track' : 'south of Mill Lane'}. ${idle.length} villagers hired, paid from the newcomer's purse.` : `The council has paid ${cost}d to build a new house ${bottom < 30 ? 'beside the north track' : 'south of Mill Lane'}. ${idle.length} villagers hired as builders.`, opts.player ? 'economy' : 'politics');
      b.dirty = true; w.dirtyStatics = true; sim.path.recost(); sim.path.clear();
      return site;
    }

    // called from Sim.work() when a builder is at the site
    work(p, bz) {
      const site = this.sites.find((s) => s.id === bz.id); if (!site || site.stage >= 10) return;
      const wx = this.sim.weather;
      const factor = wx ? (wx.kind === 'rain' ? 0.5 : wx.kind === 'snow' ? 0.3 : wx.kind === 'heavy' || wx.kind === 'storm' ? 0 : wx.kind === 'heat' ? 0.8 : 1) : 1;
      const need = MATS[site.stage];
      if (site.prog === 0) {
        for (const [g, q] of Object.entries(need)) if ((bz.stock[g] || 0) < q) { if (site.stalled !== site.stage) { site.stalled = site.stage; this.sim.log(`Work on the new house waits for ${q} ${O.Data.GOODS[g].name.toLowerCase()}.`, 'construction'); } return; }
        for (const [g, q] of Object.entries(need)) bz.stock[g] -= q;
        site.stalled = null;
      }
      const sk = p.skills.builder || 0.4;
      site.work += factor * (0.6 + sk * 0.6);
      const req = WORK[site.stage] * ((site.b.w * site.b.d) / 12);
      site.prog = Math.min(1, site.work / req);
      const bucket = Math.floor(site.prog * 8);
      if (bucket !== site.bucket) { site.bucket = bucket; site.b.dirty = true; }
      if (site.prog >= 1) {
        site.stage++; site.prog = 0; site.work = 0; site.b.dirty = true;
        if (site.stage >= 4 && site.stage < 10) this.sim.log(`The new house: ${STAGES[site.stage - 1].toLowerCase()} done, ${STAGES[site.stage].toLowerCase()} begun.`, 'construction');
        if (site.stage >= 10) this.finish(site);
      }
    }

    finish(site) {
      const sim = this.sim, b = site.b, r = sim.rng;
      b.site = false; b.name = 'House'; b.dirty = true;
      const bz = sim.biz.get(site.id);
      for (const id of bz.workers) {
        const p = sim.byId.get(id); if (!p) continue;
        const yard = p.job?.yard && sim.biz.get(p.job.yard);
        if (yard) { p.job = { biz: yard.id, role: p.job.yardRole || 'builder' }; yard.workers.push(p.id); sim.remember(p, 'We finished the new house. Back to the yard.', 'work', 1); }
        else { p.job = null; sim.remember(p, 'We finished the new house. Back to looking for work.', 'work', 1); }
      }
      sim.biz.delete(site.id);
      if (site.player) { b.owner = { kind: 'player' }; b.vacant = true; sim.log(`The newcomer's house is finished. Fresh timber and new thatch: the newcomer has a home of their own in ${sim.world.name}.`, 'economy'); O.Chronicle && O.Chronicle.deed(sim, `A newcomer built a house of their own in ${sim.world.name}.`, `Your own house in ${sim.world.name} is finished.`, 'player', 3, true); sim.world.dirtyStatics = true; return; }
      // a family arrives from elsewhere to take the house (migration)
      const region = r.pick(['east', 'north', 'west', 'south']);
      const hh = { id: sim.households.length + 1, home: b.id, members: [], pantry: { bread: 4, cabbage: 2, firewood: 4 }, money: r.int(60, 140), surname: r.pick(O.Data.NAMES.sur) };
      sim.households.push(hh); b.household = hh.id;
      const mk = (sex, age, genes) => { const p = sim.newPerson({ sex, age, first: r.pick(O.Data.NAMES[sex]), sur: hh.surname, household: hh.id, home: b.id, genes: genes || O.Char.randomGenes(r, region), wealth: 0.5 }); p.name = `${p.first} ${p.sur}`; hh.members.push(p.id); return p; };
      const a = mk('m', r.int(24, 40)), c = mk('f', r.int(22, 38)); a.spouse = c.id; c.spouse = a.id;
      const kids = []; for (let i = 0; i < r.int(0, 3); i++) kids.push(mk(r.chance(0.5) ? 'm' : 'f', r.int(0, 12), O.Char.inheritGenes(r, c.genes, a.genes)));
      a.children = c.children = kids.map((k) => k.id);
      hh.shopper = c.id;
      for (const p of [a, c, ...kids]) {
        p.app = O.Char.makeAppearance(O.hash('person', p.id, p.first), { sex: p.sex, age: p.age, genes: p.genes, role: p.age < 13 ? 'child' : 'villager', wealth: 0.5, region });
        p.agent = { x: (sim.Z.east[0] - (p.id % 3)) * 16, y: sim.Z.east[1] * 16 - (p.id % 2) * 6, dir: 1, anim: 'walk', ft: 0, a: p.app, hidden: false, inside: null, path: null, goal: null, person: p, carrying: p === a ? { good: 'logs', qty: 1 } : null };
        p.arriving = true; p.task = { act: 'move-in', b: b.id };
        sim.remember(p, `We came from the ${region} to a new house in Ashford.`, 'life', 2);
      }
      sim.log(`The new house is finished. The ${hh.surname} family is coming up the King's Road from the ${region} to live in it.`, 'migration');
      sim.world.dirtyStatics = true;
    }

    daily() {
      const sim = this.sim;
      // ageing buildings: slow deterioration; owners who can afford it repair
      for (const b of sim.world.buildings) {
        if (b.site) continue;
        b.condition = Math.max(0.1, b.condition - 0.002);
        const hh = b.household && sim.households[b.household - 1];
        const purse = hh ? hh : sim.biz.get(b.id);
        const money = hh ? hh.money : purse?.cash ?? 0;
        if ((b.needsRepair || b.condition < 0.5) && money > 40) {
          if (hh) hh.money -= 20; else purse.cash -= 20;
          b.condition = Math.min(1, b.condition + 0.25); b.needsRepair = false; b.dirty = true;
          // the builder's yard does the work, from its own stock
          const yard = [...sim.biz.values()].find((x) => x.type === 'builder' && x.id !== b.id);
          if (yard) { yard.cash += 20; yard.stock.logs = Math.max(0, (yard.stock.logs || 0) - 1); yard.stock.planks = Math.max(0, (yard.stock.planks || 0) - 1); }
          sim.log(`${b.type === 'house' ? `The ${hh?.surname || ''} family` : b.name} paid 20d to ${yard ? yard.name : 'a carpenter'} to repair their roof.`, 'construction');
        }
      }
    }

    tickMinute() {
      const sim = this.sim;
      if (sim.day > this.nextCouncil.day || (sim.day === this.nextCouncil.day && sim.minute >= this.nextCouncil.minute)) {
        this.nextCouncil = { day: sim.day + 7, minute: 10 * 60 };
        this.council();
      }
    }
    siteInfo(id) { const s = this.sites.find((x) => x.id === id); return s ? { stage: s.stage, name: STAGES[s.stage], prog: s.prog } : null; }
  }

  O.Construction = Construction; O.STAGES = STAGES; O.PLOTS = PLOTS;
})();
