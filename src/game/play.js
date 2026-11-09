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
  if (saved && saved.seed === homeWorld.seed) { try { O.Save.hydrate(game, home, saved); loaded = true; home.seasonChanged = home.season !== 'summer'; } catch (e) { console.warn('Save could not be loaded', e); O.showCrash && setTimeout(() => O.showCrash('The saved life could not be loaded: ' + (e && e.message)), 0); } }
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
  O.RidersSetup.setup(game);
  O.Signs.setup(game);
  O.PropertyUI.setup(game, sim);
  O.ChronicleUI.setup(game, home);
  O.WorkSetup.setup(game, sim, npcUI);
  O.EmploymentSetup.setup(game, home, npcUI);
  O.LettersSetup.setup(game, home, npcUI);
  O.FittingSetup.setup(game); O.DecorateSetup.setup(game); O.LifeWeightSetup.setup(game); O.TradeLifeSetup.setup(game); O.RiverWildSetup.setup(game); O.SpokenSetup.setup(game); O.CombatDeepSetup.setup(game); O.GangStreetSetup.setup(game); O.HomeFrontSetup.setup(game); O.ScenesSetup.setup(game); O.IndoorLifeSetup.setup(game); O.ApproachesSetup.setup(game); O.LivelinessSetup.setup(game); O.StreetFightSetup.setup(game); O.Pastimes2Setup.setup(game); O.AnimalCareSetup.setup(game); O.MarchSetup.setup(game); O.LooksSetup.setup(game); O.GangPoliticsSetup.setup(game); O.NightWorkSetup.setup(game); O.ArchersSetup.setup(game); O.RaidSetup.setup(game); O.KidsPlaySetup.setup(game); O.AdultPlaySetup.setup(game); O.IdleLifeSetup.setup(game); O.CutpurseSetup.setup(game); O.ShakedownSetup.setup(game); O.ShopFrontSetup.setup(game); O.WarSightsSetup.setup(game); O.GangMarksSetup.setup(game); O.PassingsSetup.setup(game); O.LamplighterSetup.setup(game); O.SparringSetup.setup(game); O.KidsChoresSetup.setup(game); O.ProcessionsSetup.setup(game); O.MarketDaySetup.setup(game); O.RoadFolkSetup.setup(game); O.TownBirdsSetup.setup(game); O.TavernYardSetup.setup(game); O.SmuggleSetup.setup(game); O.MishapsSetup.setup(game); O.ShopFront2Setup.setup(game); O.NightLifeSetup.setup(game); O.SeasonsFxSetup.setup(game); O.GentryRideSetup.setup(game); O.GangRitesSetup.setup(game); O.HuntersSetup.setup(game); O.Courting2Setup.setup(game); O.InfirmSetup.setup(game); O.PasturesSetup.setup(game); O.AlmsSetup.setup(game); O.BellsSetup.setup(game); O.BoatsSetup.setup(game); O.StormReactSetup.setup(game); O.EscortSetup.setup(game); O.TracksSetup.setup(game); O.ShopDisplaySetup.setup(game); O.NoticeBoardSetup.setup(game); O.GraveDiggerSetup.setup(game); O.DayLabourSetup.setup(game); O.BaileySetup.setup(game); O.HarbourSetup.setup(game); O.HauntSetup.setup(game); O.CountrysideSetup.setup(game); O.WellWorkSetup.setup(game); O.StocksSetup.setup(game); O.WinterPlaySetup.setup(game); O.MillsSetup.setup(game); O.SummerPlaySetup.setup(game); O.LambsSetup.setup(game); O.LordsHuntSetup.setup(game); O.OccludeSetup.setup(game); O.IndoorFxSetup.setup(game); O.RoundsSetup.setup(game); O.HouseCallsSetup.setup(game); O.BrazierSetup.setup(game); O.GangBossSetup.setup(game); O.SlashSetup.setup(game); O.RepairsSetup.setup(game); O.WildFolkSetup.setup(game); O.FerrySetup.setup(game); O.RiverbankSetup.setup(game); O.TreeWorkSetup.setup(game); O.SiteWorkSetup.setup(game); O.DoorstepSetup.setup(game); O.RoomLifeSetup.setup(game); O.StableYardSetup.setup(game); O.AbbeyLifeSetup.setup(game); O.WinterWorkSetup.setup(game); O.StreetCallersSetup.setup(game); O.SeasonChoresSetup.setup(game); O.LivestockSetup.setup(game); O.BabesSetup.setup(game); O.FlagWatchSetup.setup(game); O.DawnDuskSetup.setup(game); O.PuddlesSetup.setup(game); O.QuaysideSetup.setup(game); O.CottageYardsSetup.setup(game); O.WindySetup.setup(game); O.StreetMuckSetup.setup(game); O.HitchingSetup.setup(game); O.KidsPlay2Setup.setup(game); O.StrayDogSetup.setup(game); O.TollBarSetup.setup(game); O.NightWalkersSetup.setup(game); O.BakehouseSetup.setup(game); O.WorkFxSetup.setup(game); O.ToothPullSetup.setup(game); O.GentryLeisureSetup.setup(game); O.WaterfowlSetup.setup(game); O.RainFolkSetup.setup(game); O.JostleSetup.setup(game); O.GraveVisitsSetup.setup(game); O.HandcartsSetup.setup(game); O.DoorCheckSetup.setup(game); O.SwallowsSetup.setup(game); O.MiceSetup.setup(game); O.StreetPigsSetup.setup(game); O.BirdScarerSetup.setup(game); O.WassailSetup.setup(game); O.RogationSetup.setup(game); O.SheepWashSetup.setup(game); O.WorkMomentsSetup.setup(game); O.TaxDoorSetup.setup(game); O.OfficeFrontsSetup.setup(game); O.TradeLoopSetup.setup(game); O.TreeFallSetup.setup(game); O.EvictionsSetup.setup(game); O.BoardedUpSetup.setup(game); O.MootSceneSetup.setup(game); O.BreadDoleSetup.setup(game); O.FloodFolkSetup.setup(game); O.PlagueTownSetup.setup(game); O.OxWagonsSetup.setup(game); O.SwarmSetup.setup(game); O.LostChildSetup.setup(game); O.TruantsSetup.setup(game); O.LeperSetup.setup(game); O.WatchChangeSetup.setup(game); O.ChristeningSetup.setup(game); O.JobIncidentsSetup.setup(game); O.ShrovetideSetup.setup(game);
  O.StreetSetup.setup(game, home);
  O.GangLifeSetup.setup(game, npcUI);
  O.TownLifeSetup.setup(game, npcUI);
  O.DealsSetup.setup(game);
  O.WakeSetup.setup(game);
  O.FestivalsSetup.setup(game, npcUI);
  O.CrownSetup.setup(game, npcUI);
  O.RenownSetup.setup(game);
  O.BountiesSetup.setup(game, npcUI);
  O.TasksSetup.setup(game);
  O.WaypointsSetup.setup(game);
  O.BusinessSetup.setup(game, npcUI);
  O.HardTimesSetup.setup(game);
  O.CareersSetup.setup(game, npcUI);
  O.RisingSetup.setup(game, npcUI);
  O.RitesSetup.setup(game);
  O.WarfareSetup.setup(game, npcUI);
  O.CalendarSetup.setup(game); O.RevelsSetup.setup(game); O.BasicsSetup.setup(game, npcUI); O.NpcActsSetup.setup(game); O.InitiateSetup.setup(game); O.UnderworldSetup.setup(game); O.CourtshipSetup.setup(game); O.FencesSetup.setup(game); O.FamilySetup.setup(game); O.PetsSetup.setup(game); O.FavoursSetup.setup(game); O.MarketSetup.setup(game); O.GrudgesSetup.setup(game); O.RitualsSetup.setup(game); O.TodoSetup.setup(game); O.DealingsSetup.setup(game); O.CounterSetup.setup(game); O.ResourcesSetup.setup(game); O.GangBasesSetup.setup(game); O.GatheringsSetup.setup(game); O.WildSetup.setup(game); O.SongsSetup.setup(game); O.PoliticsSetup.setup(game); O.ChurchSetup.setup(game); O.SeaSetup.setup(game); O.LegacySetup.setup(game); O.WorldLifeSetup.setup(game); O.TrainingSetup.setup(game); O.ExtrasSetup.setup(game); O.GatheringSetup.setup(game); O.StreetLifeSetup.setup(game); O.OutdoorsSetup.setup(game); O.SkyFxSetup.setup(game); O.CrittersSetup.setup(game); O.HygieneSetup.setup(game); O.HearthLifeSetup.setup(game); O.FarmYearSetup.setup(game); O.HouseBuildSetup.setup(game); O.RoadTradeSetup.setup(game); O.SicknessSetup.setup(game); O.HeartsSetup.setup(game); O.GuildsSetup.setup(game); O.GangWorkSetup.setup(game); O.WorkLifeSetup.setup(game); O.CastleGroundsSetup.setup(game); O.MoneySetup.setup(game); O.BarberSetup.setup(game); O.RoadSenseSetup.setup(game); O.HandworkSetup.setup(game); O.PursuitSetup.setup(game); O.CraftLifeSetup.setup(game); O.GangDeepSetup.setup(game); O.TownDaysSetup.setup(game); O.NpcLifeSetup.setup(game); O.SpeechActsSetup.setup(game); O.PolishSetup.setup(game);
  O.FinerySetup.setup(game);
  O.PastimesSetup.setup(game);
  O.FishingSetup.setup(game);
  O.TextsSetup.setup(game);
  O.WanderersSetup.setup(game, home);
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
  O.AudioSetup.setup(game, sim); O.MusicSetup.setup(game); O.SfxSetup.setup(game); O.AnimalSfxSetup.setup(game);
  if (loaded) { O.Save.hydrateLate(game, home); setTimeout(() => O.Panels.toast(`Welcome back. It is ${O.DAYNAMES[sim.weekday]}.`), 300); }
  // autosave each dawn and whenever the page is hidden
  let lastAuto = sim.day;
  game.hooks.update.push(() => { if (home.day !== lastAuto && home.hour >= 6 && !game.world.road) { lastAuto = home.day; O.Save.save(game, home, true); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !game.world.road) O.Save.save(game, home, true); });
  // the name of where you stand changes only from tile to tile: remember it rather than sample the land each frame
  let pnKey = null, pnVal = null;
  function placeName() {
    const k = game.scene ? null : `${game.world && game.world.placeId}:${Math.floor(game.player.x / 32)}:${Math.floor(game.player.y / 32)}`;
    if (k && k === pnKey) return pnVal;
    const v = placeName0(); pnKey = k; pnVal = v; return v;
  }
  function placeName0() {
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
  // nobody here speaks without a voice to speak with: the game waits for Claude or a key
  O.AI.gate().then(() => {
  if (!loaded || !O.Forge.created()) {
    PS.money = 0; PS.items = [];
    O.Forge.showCreator((a) => { game.setPlayerAppearance(a); game.start(); setTimeout(() => game.resize(), 0); game.canvas.focus(); });
  } else { game.start(); game.canvas.focus(); }
  });
})();
