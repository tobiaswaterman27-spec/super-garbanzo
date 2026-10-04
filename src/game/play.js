// Play screen: boots the village and keeps the HUD in step with the simulation.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  // Ashford, set in its stretch of the island: the whole of Eldoria can be walked
  O.Island.init();
  const homeWorld = O.Island.region('ashford');
  const AX = homeWorld.ox, AY = homeWorld.oy; // where Ashford's own map sits in its region
  const game = new O.Game($('game'));
  game.load(homeWorld, O.Forge.player);
  game.player.x = (46 + AX) * 16 + 8; game.player.y = (32 + AY) * 16 + 4;
  O.game = game;
  // a new life draws a new people (the land stays the same; the folk in it don't)
  const LIFE = O.Names ? O.Names.lifeSeed() : 0;
  O.lifeSeed = LIFE;
  const home = new O.Sim(homeWorld, (11 + LIFE) | 0);
  // The game holds several living settlements; modules talk to whichever the player is in through
  // this reference. Ashford (home) keeps running while you're away.
  O.SimRef = { cur: home, home };
  const sim = new Proxy({}, {
    get(t, k) { const s = O.SimRef.cur; const v = s[k]; return typeof v === 'function' ? v.bind(s) : v; },
    set(t, k, v) { O.SimRef.cur[k] = v; return true; },
  });
  O.sim = sim; game.sim = sim;
  let world = homeWorld;
  Object.defineProperty(O, 'world', { get: () => game.world, configurable: true });
  const PS = O.PlayerState;
  // continue a saved life if there is one
  const saved = O.Save.peek();
  let loaded = false;
  if (saved && saved.seed === homeWorld.seed) { try { O.Save.hydrate(game, home, saved); loaded = true; home.seasonChanged = home.season !== 'summer'; } catch (e) { console.warn('Save could not be loaded', e); } }
  game.load(homeWorld);
  // the simulation owns time; the engine reads it
  game.clock = { speed: 1, get minute() { return sim.minute; }, set minute(v) {}, get day() { return sim.day; }, set day(v) {} };
  game.hooks.update.push((dt) => {
    const dtm = dt * game.clock.speed;
    O.SimRef.cur.tick(dtm);
    if (O.SimRef.cur !== home) home.tick(dtm);
    PS.tick(dtm, false);
    world = game.world;
    game.actors = [game.player, ...O.SimRef.cur.people.map((p) => p.agent)];
  });
  O.WeatherFX.setup(game, sim);
  // keep building sprites in step with the simulation (construction stages, storm damage, repairs)
  // and swap foliage, ground and crops when the season turns
  function cropFor(p, season, dos) {
    const wheat = p.field === 'wheat';
    if (season === 'spring') return ['sprout', 1];
    if (season === 'summer') return wheat ? ['wheat', 2] : ['cabbage', 1];
    if (season === 'autumn') return dos < 9 ? (wheat ? ['wheat', 3] : ['cabbage', 1]) : ['soilrow', 0];
    return ['soilrow', 0];
  }
  function applySeason() {
    const season = sim.season, dos = sim.weather.dayOfSeason;
    game.season = season;
    for (const p of game.world.props) if (p.field) { const [k, v] = cropFor(p, season, dos); if (p.kind !== k || p.v !== v) { p.kind = k; p.v = v; p.sprite = O.Env.prop(k, p.seed, v); } }
  }
  for (const p of world.props) if (p.kind === 'wheat' || p.kind === 'cabbage' || p.kind === 'sprout') p.field = p.kind === 'cabbage' ? 'cabbage' : 'wheat';
  applySeason();
  let lastHarvestCheck = -1;
  O.applySeason = applySeason;
  game.hooks.update.push(() => {
    const world = game.world;
    for (const b of world.buildings) if (b.dirty) {
      b.dirty = false;
      if (b.ruined) b.sprite = O.Env.ruin(b.spec);
      else if (b.site) { const si = sim.build.siteInfo(b.id); b.sprite = O.Env.staged(b.spec, si.stage, si.prog); }
      else if (b.type === 'hideout') b.sprite = O.Env.hideout(b.level, b.spec);
      else { b.spec.condition = b.condition; b.sprite = O.Env.building(b.spec); }
    }
    if (world.dirtyStatics) game.rebuildStatics();
    if (sim.seasonChanged) {
      sim.seasonChanged = false; game.season = sim.season;
      if (world.chunked) world._chunks = new Map(); else game.ground = O.Terrain.renderGround(world, sim.season);
      for (const t of world.trees) t.sprite = O.Env.tree(t.seed, t.kind, sim.season);
      applySeason();
      O.Panels.toast(`${sim.season[0].toUpperCase() + sim.season.slice(1)} has come.`);
    }
    if (sim.day !== lastHarvestCheck) { lastHarvestCheck = sim.day; applySeason(); }
  });
  // the dead are buried in the chapel yard; each grave is a real prop you can read
  const graveSpots = []; for (let y = 36; y >= 33; y--) for (let x = 68; x <= 72; x++) graveSpots.push([x + AX, y + AY]);
  home.onGrave = (p) => {
    const world = homeWorld;
    const spot = graveSpots.find(([x, y]) => !world.solid[y * world.W + x] && !world.props.some((q) => q.kind === 'gravestone' && Math.floor(q.x / 16) === x && Math.floor(q.y / 16) === y));
    if (!spot) return;
    const g = home.graves[home.graves.length - 1];
    world.props.push({ kind: 'gravestone', x: spot[0] * 16 + 8, y: spot[1] * 16 + 14, seed: p.id, solid: true, grave: g });
    world.solid[spot[1] * world.W + spot[0]] = 1; world.dirtyStatics = true;
  };
  const npcUI = O.NpcUI.setup(game, sim); game.npcUI = npcUI;
  O.Interact.setup(game, sim, npcUI);
  O.SocialSetup.setup(game, npcUI);
  O.LawUI.setup(game, sim, npcUI);
  O.GangUISetup.setup(game, sim, npcUI);
  O.CombatSetup.setup(game, sim, npcUI);
  O.HorsesSetup.setup(game, sim, npcUI);
  O.InnUI.setup(game, sim, npcUI);
  O.KingdomUI.setup(game, sim, npcUI);
  O.TravelSetup.setup(game, home, npcUI);
  O.Roads.setup(game, home);
  O.Prefetch.setup(game, home);
  O.OpenWorldSetup.setup(game, home);
  O.Wayfarers.setup(game, home);
  O.Crowd.setup(game);
  O.SpeechSetup.setup(game);
  O.ErrandsSetup.setup(game);
  O.Signs.setup(game);
  O.PropertyUI.setup(game, sim);
  O.ChronicleUI.setup(game, home);
  O.WorkSetup.setup(game, sim, npcUI);
  O.EmploymentSetup.setup(game, home, npcUI);
  O.LettersSetup.setup(game, home, npcUI);
  O.FittingSetup.setup(game);
  O.StreetSetup.setup(game, home);
  O.GangLifeSetup.setup(game, npcUI);
  O.TownLifeSetup.setup(game, npcUI);
  O.CouncilUI.setup(game, home);
  O.WarUI.setup(game, home, npcUI);
  O.Craft.setup(game);
  O.FireFX.setup(game, home);
  O.DisasterFX.setup(game, home);
  O.Estate.setup(game, home);
  O.UI.setup(game);
  O.Doors.setup(game);
  O.AftermathFX.setup(game);
  O.Parish.setup(game);
  O.Guide.setup(game);
  O.AudioSetup.setup(game, sim);
  if (loaded) { O.Save.hydrateLate(game, home); setTimeout(() => O.Panels.toast(`Welcome back. It is ${O.DAYNAMES[sim.weekday]}.`), 300); }
  // autosave each dawn and whenever the page is hidden
  let lastAuto = sim.day;
  game.hooks.update.push(() => { if (home.day !== lastAuto && home.hour >= 6 && !game.world.road) { lastAuto = home.day; O.Save.save(game, home, true); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !game.world.road) O.Save.save(game, home, true); });
  function placeName() {
    if (game.scene) return game.scene.b.type === "house" ? `The ${sim.households[game.scene.b.household - 1]?.surname || ""} house` + (game.scene.floor ? ", upstairs" : "") : game.scene.b.name + (game.scene.floor ? ', upstairs' : '');
    const p = game.player, T = 16, tx = p.x / T - AX, ty = p.y / T - AY;
    if (game.world === homeWorld && (tx < 0 || ty < 0 || tx > 96 || ty > 64)) { const g = O.Island.toGlobal(homeWorld, p.x, p.y); return O.Eldoria.regionName(g[0] / T / O.Island.U, g[1] / T / O.Island.U).replace(/^the /, '').replace(/^./, (c) => c.toUpperCase()); }
    if (game.world !== homeWorld) {
      if (game.world.island) { const w = game.world, lx = p.x / T - w.ox, ly = p.y / T - w.oy; if (lx < 0 || ly < 0 || lx > w.townW || ly > w.townH) { const g = O.Island.toGlobal(w, p.x, p.y); return O.Eldoria.regionName(g[0] / T / O.Island.U, g[1] / T / O.Island.U).replace(/^the /, '').replace(/^./, (c) => c.toUpperCase()); } return w.name; } const w = game.world; return Math.abs(ty - w.roadY) < 2 ? `${w.name}, high road` : ty < 10 ? `${w.name} woods` : w.name; }
    if (tx >= 37 && tx <= 56 && ty >= 22 && ty <= 30) return 'Ashford Square';
    if (ty >= 29.5 && ty <= 32.5) return tx > 77 && tx < 86 ? 'Ashford Bridge' : "King's Road";
    if (ty >= 40.5 && ty <= 43) return 'Mill Lane';
    if (ty > 43 && tx < 36) return 'Marsh Farm';
    if (ty < 14) return 'Ashford Wood';
    return 'Ashford';
  }
  O.placeName = placeName;

  // a new life begins with the character maker; after that, straight into the world
  if (!loaded || !O.Forge.created()) {
    PS.money = 0; PS.items = [];
    O.Forge.showCreator((a) => { game.setPlayerAppearance(a); game.start(); setTimeout(() => game.resize(), 0); game.canvas.focus(); setTimeout(() => O.Guide && O.Guide.firstTime(), 400); });
  } else { game.start(); game.canvas.focus(); }
})();
