// Saving and loading. The village regenerates deterministically from its seed, so a save stores
// only what has changed: people and their lives, households, businesses, buildings and sites, trees
// and props, the solid grid, weather, crimes, gangs, horses, the kingdom, and the player.
// Appearances are rebuilt from genes and trade on load (palette ids aren't stable between sessions).
'use strict';
(function () {
  const KEY = 'outlaw.save.v1';
  const PS = O.PlayerState;

  function encodeGrid(a) { let s = ''; for (let i = 0; i < a.length; i++) s += a[i] ? '1' : '0'; return s; }
  function decodeGrid(s, a) { for (let i = 0; i < a.length; i++) a[i] = s.charCodeAt(i) === 49 ? 1 : 0; }

  // the walk-through grid without the little signs (they're stood up afresh each time)
  function signless(w) { const g = w.solid.slice(); for (const p of w.props) if (p.kind === 'namesign' || p.kind === 'salesign') g[Math.floor((p.y - 1) / 16) * w.W + Math.floor(p.x / 16)] = 0; return g; }
  function snapshot(game, sim) {
    const w = sim.world;
    // saved while out on the island: the same spot if it lies in Ashford's stretch of land, else Ashford's east way in
    let away = null;
    if (game.world !== sim.world) {
      const Z = sim.world.zones || {}, east = Z.east ? [Z.east[0] * 16 + 8, Z.east[1] * 16 + 10] : [(sim.world.W - 2) * 16, 30 * 16 + 10];
      away = east;
      if (game.world.island && sim.world.island && !game.scene) {
        const [gx, gy] = O.Island.toGlobal(game.world, game.player.x, game.player.y), [lx, ly] = O.Island.toLocal(sim.world, gx, gy), tx = Math.floor(lx / 16), ty = Math.floor(ly / 16);
        if (tx > 1 && ty > 1 && tx < sim.world.W - 2 && ty < sim.world.H - 2 && !sim.world.solid[ty * sim.world.W + tx]) away = [Math.round(lx), Math.round(ly)];
      }
    }
    const strip = (p) => {
      const o = {};
      for (const [k, v] of Object.entries(p)) {
        if (k === 'app' || k === 'agent' || k === 'activity') continue;
        if (k === 'rel') { o.rel = [...v.entries()].map(([id, r]) => [id, +r.affinity.toFixed(3), +r.familiar.toFixed(3)]); continue; }
        if (k === 'task') { if (v && (v.act === 'pickup' || v.act === 'deliver')) continue; o.task = v; continue; }
        o[k] = v;
      }
      const a = p.agent; o.ag = a ? [Math.round(a.x), Math.round(a.y), a.dir, a.inside, a.hidden ? 1 : 0, a.carrying || null] : null;
      return o;
    };
    return {
      v: 1, seed: w.seed, savedAt: Date.now(),
      chronicle: { facts: O.Chronicle.facts, heard: O.Chronicle.heard, nextId: O.Chronicle.nextId },
      sim: {
        day: sim.day, minute: sim.minute, nextId: sim.nextId, treasury: sim.treasury, stats: sim.stats, history: sim.history.slice(-250), crimes: sim.crimes.slice(-150).map((c) => Object.assign({}, c, { seen: undefined, perp: c.perp === 'player' || c.perp == null ? c.perp : { id: c.perp.id } })),
        settlement: sim.settlement, events: sim.events || [], graves: sim.graves, dead: sim.dead.map((d) => ({ id: d.id, name: d.name, first: d.first, sur: d.sur, age: d.age, household: d.household, died: d.died })),
        rng: sim.rng.seed(), wrng: sim.weather.rng.seed(), krng: sim.kingdom.rng.seed(), season: sim._season, reeveId: sim.reeveId, guardRaised: sim._guardRaised || null,
        weather: { kind: sim.weather.kind, level: sim.weather.level, hailCover: sim.weather.hailCover, wet: sim.weather.wet, snowCover: sim.weather.snowCover, lastHour: sim.weather.lastHour },
        people: sim.people.map(strip), traderId: sim.trader ? sim.trader.id : null,
        households: sim.households,
        biz: [...sim.biz.values()].map((b) => ({ id: b.id, type: b.type, stock: b.stock, cash: b.cash, owner: b.owner, workers: b.workers, salesToday: b.salesToday, history: b.history, jobs: b.def.jobs, name: b.name, cost: b.def.site ? true : undefined, ownerPlayer: b.ownerPlayer, badDays: b.badDays, founded: b.founded })),
        lordship: sim.lordship, forest: sim.forest || null, flood: sim.floodState ? { level: sim.floodState.level, set: sim.floodState.set, peak: sim.floodState.peak } : null, quarantine: sim.quarantine || null, memorials: sim.memorials || [], levyDay: sim.levyDay || null, returnDay: sim.returnDay || null, festivalDay: sim.festivalDay || null, festivalWhy: sim.festivalWhy || null, mourningUntil: sim.mourningUntil || null, reeveMoot: sim.reeveMoot || null, lastMoot: sim.lastMoot || null, farmStripsSold: sim.farmStripsSold || 0,
        sites: sim.build.sites.map((s) => ({ id: s.id, stage: s.stage, prog: s.prog, work: s.work, started: s.started, player: s.player || false })), nextCouncil: sim.build.nextCouncil, plotsUsed: [...sim.build.used],
        gangs: sim.gangs,
        kingdom: { places: sim.kingdom.places, roads: sim.kingdom.roads, caravans: sim.kingdom.caravans.map((c) => Object.assign({}, c, { held: false })), news: sim.kingdom.news, war: sim.kingdom.war ? Object.assign({}, sim.kingdom.war, { soldiers: sim.kingdom.war.soldiers.map((x) => Object.assign({}, x, { snap: x.snap && !x.back ? strip(x.snap) : null })) }) : null, rulers: sim.kingdom.rulers, heirStore: sim.kingdom.heirStore || null, treasury: sim.kingdom.treasury, taxRate: sim.kingdom.taxRate, councils: sim.kingdom.councils.slice(-6) },
        horses: (sim.horses || []).map((h) => { const o = Object.assign({}, h); delete o._actor; return o; }),
      },
      world: {
        buildings: w.buildings.map((b) => { const o = {}; for (const [k, v] of Object.entries(b)) if (k !== 'sprite' && k !== 'dirty') o[k] = k === 'spec' ? Object.assign({}, v, { _fin: undefined }) : v; return o; }),
        trees: w.trees.map((t) => [t.kind, t.x, t.y, t.seed]),
        props: w.props.filter((p) => p.kind !== 'namesign' && p.kind !== 'salesign').map((p) => ({ kind: p.kind, x: p.x, y: p.y, seed: p.seed, v: p.v, solid: p.solid, flat: p.flat, field: p.field, grave: p.grave, epitaph: p.epitaph, broadsheet: p.broadsheet, felled: p.felled, planted: p.planted, treeKind: p.treeKind })),
        solid: encodeGrid(signless(w)),
      },
      player: {
        x: away ? away[0] : Math.round(game.scene ? game.scene.b.doorX * 16 + 8 : game.player.x), y: away ? away[1] : Math.round(game.scene ? game.scene.b.doorY * 16 + 10 : game.player.y), dir: game.player.dir,
        mount: game.player.mount ? game.player.mount.id : null,
        region: game.world.island && !game.scene && game.world !== sim.world ? game.world.placeId : null, g: game.world.island && !game.scene ? O.Island.toGlobal(game.world, game.player.x, game.player.y).map(Math.round) : null,
        ps: { money: PS.money, items: PS.items, hp: PS.hp, energy: PS.energy, hunger: PS.hunger, rep: { civilian: PS.rep.civilian, criminal: PS.rep.criminal, guard: PS.rep.guard, merchant: PS.rep.merchant }, localRep: PS.localRep, crimes: PS.crimes, room: PS.room, stash: PS.stash, stolen: PS.stolen, skills: PS.skills, equipped: PS.equipped, bounty: PS.bounty, bountyAmount: PS.bountyAmount, exiled: PS.exiled, lord: PS.lord, homes: PS.homes, rentIncome: PS.rentIncome, bizIncome: PS.bizIncome, job: PS.job || null, workDays: PS.workDays || {}, earned: PS.earned || 0, owed: PS.owed || 0, made: PS.made || 0, plots: PS.plots || [], fields: PS.fields || [], estate: PS.estate || null, landIncome: PS.landIncome || 0, lastHarvest: PS.lastHarvest || null, reeve: PS.reeve || false, standForReeve: PS.standForReeve || false, councilPriority: PS.councilPriority || null, councilDefault: PS.councilDefault || null, warStance: PS.warStance || null, side: PS.side || null, knight: PS.knight || false, lease: PS.lease || null, wounds: PS.wounds || [], emp: PS.emp ? Object.assign({}, PS.emp, { tasks: [], onShift: false, dayInfo: null }) : null, posts: (PS.posts || []).map((x) => Object.assign({}, x, { tasks: [], onShift: false, dayInfo: null, _lm: null, _cur: x === PS.emp })), carry: PS.carry || null, firedSilently: PS.firedSilently || null, residence: PS.residence || null, gaol: PS.gaol || null, gangRanks: PS.gangRanks || [], gangTrials: PS.gangTrials || {}, disguise: PS.disguise || null, loans: PS.loans || [], letters: PS.letters || [] },
      },
    };
  }

  function save(game, sim, quiet) {
    if (window.__noAutosave) return 0;
    try {
      const data = JSON.stringify(snapshot(game, sim));
      localStorage.setItem(KEY, data);
      if (!quiet) O.Panels.toast(`Saved: day ${sim.day}, ${game.timeString()}.`);
      return data.length;
    } catch (e) { if (!quiet) O.Panels.toast('Could not save in this browser (storage is unavailable or full).', 'bad'); return 0; }
  }
  function peek() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  // Rebuild the simulation state from a save, on top of a freshly generated village.
  function hydrate(game, sim, d) {
    const w = sim.world, S = d.sim;
    // world
    const byId = new Map(w.buildings.map((b) => [b.id, b]));
    w.buildings = d.world.buildings.map((sb) => { const b = byId.get(sb.id) || {}; Object.assign(b, sb); b.dirty = true; return b; });
    w.trees = d.world.trees.map(([kind, x, y, seed]) => ({ kind, x, y, seed }));
    w.props = d.world.props;
    decodeGrid(d.world.solid, w.solid);
    w.dirtyStatics = true;
    // core sim
    Object.assign(sim, { day: S.day, minute: S.minute, _lastMin: Math.floor(S.minute), nextId: S.nextId, treasury: S.treasury, stats: S.stats, history: S.history, crimes: S.crimes, settlement: S.settlement, events: S.events, graves: S.graves, _season: S.season, reeveId: S.reeveId, _guardRaised: S.guardRaised });
    if (d.chronicle) Object.assign(O.Chronicle, { facts: d.chronicle.facts || [], heard: d.chronicle.heard || [], nextId: d.chronicle.nextId || 1 });
    sim.memorials = S.memorials || []; sim.forest = S.forest || null; sim.quarantine = S.quarantine || null;
    if (S.flood && sim.floodInit && sim.floodInit()) { Object.assign(sim.floodState, S.flood); const lv = Math.floor(S.flood.level); sim.floodState.tiles = lv >= 1 ? new Set([...S.flood.set, ...sim.floodedBuildingTiles(lv)]) : null; } sim.levyDay = S.levyDay || null; sim.returnDay = S.returnDay || null; Object.assign(sim, { farmStripsSold: S.farmStripsSold || 0, lastMoot: S.lastMoot || null, festivalDay: S.festivalDay || null, festivalWhy: S.festivalWhy || null, mourningUntil: S.mourningUntil || null, reeveMoot: S.reeveMoot || null });
    sim.rng = O.RNG(S.rng); sim.weather.rng = O.RNG(S.wrng); sim.kingdom.rng = O.RNG(S.krng);
    Object.assign(sim.weather, S.weather);
    sim.households = S.households;
    sim.dead = S.dead.map((x) => Object.assign({ alive: false, rel: new Map(), memories: [], traits: [] }, x));
    sim.people = S.people.map((o) => {
      const p = Object.assign({}, o);
      p.rel = new Map((o.rel || []).map(([id, a, f]) => [id, { affinity: a, familiar: f }]));
      delete p.ag;
      return p;
    });
    sim.byId = new Map(); for (const p of [...sim.people, ...sim.dead]) sim.byId.set(p.id, p);
    for (const p of sim.people) {
      const ag = S.people.find((x) => x.id === p.id).ag || [(46 + (sim.world.ox || 0)) * 16, (30 + (sim.world.oy || 0)) * 16, 0, null, 0, null];
      if (p.visitor) p.app = O.Char.makeAppearance(O.hash('trader', p.id), { sex: p.sex, age: p.age, genes: p.genes, role: 'merchant', wealth: 0.65, region: 'east' });
      else { p.agent = { a: null }; sim.refreshLook(p); }
      p.agent = { x: ag[0], y: ag[1], dir: ag[2], anim: 'idle', ft: Math.random() * 3, a: p.app, hidden: !!ag[4], inside: ag[3], path: null, goal: null, person: p, carrying: ag[5] };
      p.activity = null;
    }
    sim.trader = S.traderId ? sim.byId.get(S.traderId) : null;
    for (const c of sim.crimes) if (c.perp && c.perp !== 'player' && c.perp.id != null) c.perp = sim.byId.get(c.perp.id) || null;
    // businesses and sites
    for (const sb of S.biz) {
      let bz = sim.biz.get(sb.id);
      if (!bz && sb.type === 'site') {
        const b = w.buildings.find((x) => x.id === sb.id);
        const def = { label: 'Building site', jobs: sb.jobs, hours: [7, 17], recipes: [], sells: [], buys: { logs: 'woodcutter', stone: 'import' }, targets: { logs: 12, stone: 10 }, wage: { builder: 7 }, site: true };
        bz = { id: sb.id, b, type: 'site', def, name: sb.name, sold: {}, bought: {}, orders: [] }; sim.biz.set(sb.id, bz);
      }
      if (!bz && O.Data.BUSINESS[sb.type]) { const b = w.buildings.find((x) => x.id === sb.id); bz = { id: sb.id, b, type: sb.type, def: O.Data.BUSINESS[sb.type], name: sb.name, sold: {}, bought: {}, orders: [] }; sim.biz.set(sb.id, bz); }
      if (!bz) continue;
      bz.ownerPlayer = sb.ownerPlayer; bz.badDays = sb.badDays; bz.name = sb.name; bz.type = sb.type; if (O.Data.BUSINESS[sb.type] && bz.def !== O.Data.BUSINESS[sb.type] && !bz.def.site) bz.def = O.Data.BUSINESS[sb.type];
      Object.assign(bz, { stock: sb.stock, cash: sb.cash, owner: sb.owner, workers: sb.workers, salesToday: sb.salesToday, history: sb.history, orders: [], open: false, founded: sb.founded });
      bz.def = Object.assign({}, bz.def, { jobs: sb.jobs });
      bz.b = w.buildings.find((x) => x.id === sb.id) || bz.b;
    }
    for (const id of [...sim.biz.keys()]) if (!S.biz.find((b) => b.id === id)) sim.biz.delete(id);
    sim.build.sites = S.sites.map((s) => Object.assign({}, s, { b: w.buildings.find((x) => x.id === s.id) }));
    for (const st of sim.build.sites) if (st.b) { st.skip = sim.build.skipFor(st.b); sim.build.applySolid(st); }
    sim.build.nextCouncil = S.nextCouncil; sim.build.used = new Set(S.plotsUsed);
    sim.gangs = S.gangs;
    if (S.lordship) sim.lordship = S.lordship;
    Object.assign(sim.kingdom, S.kingdom);
    sim.path.recost(); sim.path.clear();
    // player
    const P = d.player; const { rep, ...rest } = P.ps; Object.assign(PS, rest); if (rep) for (const k of ['civilian', 'criminal', 'guard', 'merchant']) PS.rep[k] = rep[k] ?? 0;
    if (PS.posts && PS.posts.length) { PS.emp = PS.posts.find((x) => x._cur) || PS.posts[0]; for (const x of PS.posts) delete x._cur; } else if (!rest.posts) PS.posts = null;
    game.player.x = P.x; game.player.y = P.y; game.player.dir = P.dir; game._savedPlayer = P;
    if (O.Names) for (const q of sim.people) if (q.first && q.sur) O.Names.used.add(q.first + ' ' + q.sur);
    game._pendingMount = P.mount;
    sim.horsesSaved = S.horses;
  }
  // after the UI modules are set up: horses, mount
  function hydrateLate(game, sim) {
    if (sim.horsesSaved && O.Horses) {
      const hs = O.Horses.horses; hs.length = 0; for (const h of sim.horsesSaved) hs.push(h); sim.horses = hs; delete sim.horsesSaved;
      if (game._pendingMount) { const h = hs.find((x) => x.id === game._pendingMount); if (h) { game.player.mount = h; } game._pendingMount = null; }
    }
    const nb = sim.world.props.filter((p) => p.kind === 'noticeboard'); if (nb.length > 1) sim.world.props.splice(sim.world.props.indexOf(nb[1]), 1);
    sim.world.dirtyStatics = true;
    // saved out on the island in another town's land: walk straight back into it
    const P = game._savedPlayer; game._savedPlayer = null;
    if (P && P.region && P.g && O.OpenWorld && O.Island.data().place(P.region)) {
      try { O.OpenWorld.switchTo(P.region); const [lx, ly] = O.Island.toLocal(game.world, P.g[0], P.g[1]); game.player.x = lx; game.player.y = ly; } catch (e) { console.warn('could not return to', P.region, e); }
    }
  }

  O.Save = { save, peek, clear, hydrate, hydrateLate, snapshot, KEY };
})();
