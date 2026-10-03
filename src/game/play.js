// Play screen: boots the village and keeps the HUD in step with the simulation.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const homeWorld = O.Village.makeVillage(7);
  const game = new O.Game($('game'));
  game.load(homeWorld, O.Forge.player);
  O.game = game;
  const home = new O.Sim(homeWorld, 11);
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
      game.ground = O.Terrain.renderGround(world, sim.season);
      for (const t of world.trees) t.sprite = O.Env.tree(t.seed, t.kind, sim.season);
      applySeason();
      O.Panels.toast(`${sim.season[0].toUpperCase() + sim.season.slice(1)} has come.`);
    }
    if (sim.day !== lastHarvestCheck) { lastHarvestCheck = sim.day; applySeason(); }
  });
  // the dead are buried in the chapel yard; each grave is a real prop you can read
  const graveSpots = []; for (let y = 36; y >= 33; y--) for (let x = 68; x <= 72; x++) graveSpots.push([x, y]);
  home.onGrave = (p) => {
    const world = homeWorld;
    const spot = graveSpots.find(([x, y]) => !world.solid[y * world.W + x] && !world.props.some((q) => q.kind === 'gravestone' && Math.floor(q.x / 16) === x && Math.floor(q.y / 16) === y));
    if (!spot) return;
    const g = home.graves[home.graves.length - 1];
    world.props.push({ kind: 'gravestone', x: spot[0] * 16 + 8, y: spot[1] * 16 + 14, seed: p.id, solid: true, grave: g });
    world.solid[spot[1] * world.W + spot[0]] = 1; world.dirtyStatics = true;
  };
  const npcUI = O.NpcUI.setup(game, sim);
  O.Interact.setup(game, sim, npcUI);
  O.LawUI.setup(game, sim, npcUI);
  O.GangUISetup.setup(game, sim, npcUI);
  O.CombatSetup.setup(game, sim, npcUI);
  O.HorsesSetup.setup(game, sim, npcUI);
  O.KingdomUI.setup(game, sim, npcUI);
  O.TravelSetup.setup(game, home, npcUI);
  O.PropertyUI.setup(game, sim);
  O.ChronicleUI.setup(game, home);
  O.WorkSetup.setup(game, sim, npcUI);
  O.WarUI.setup(game, home, npcUI);
  O.Craft.setup(game);
  O.FireFX.setup(game, home);
  O.DisasterFX.setup(game, home);
  O.Estate.setup(game, home);
  O.Guide.setup(game);
  O.AudioSetup.setup(game, sim);
  if (loaded) { O.Save.hydrateLate(game, home); setTimeout(() => O.Panels.toast(`Welcome back. It is ${O.DAYNAMES[sim.weekday]}, day ${sim.day}, in Ashford.`), 300); }
  // autosave each dawn and whenever the page is hidden
  let lastAuto = sim.day;
  game.hooks.update.push(() => { if (home.day !== lastAuto && home.hour >= 6) { lastAuto = home.day; O.Save.save(game, home, true); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) O.Save.save(game, home, true); });
  const tr = $('hudTR');
  const sv = document.createElement('div'); sv.className = 'savebar';
  const sb = document.createElement('button'); sb.textContent = 'Save'; sb.onclick = () => { O.Save.save(game, home); game.canvas.focus(); };
  const nb = document.createElement('button'); nb.textContent = 'New life';
  nb.onclick = () => {
    O.Panels.open('Begin a new life?', '<p class="caption">This forgets Ashford as you left it: every person, every crime, your band and your purse. The village will begin again on day 1.</p><div class="topics"><button data-yes="1">Yes, start over</button><button data-no="1">Keep playing</button></div>', (r) => {
      r.querySelector('[data-no]').onclick = () => O.Panels.close();
      r.querySelector('[data-yes]').onclick = () => { O.Save.clear(); window.__noAutosave = true; location.reload(); };
    });
  };
  sv.append(sb, nb); tr.appendChild(sv);
  const mbtn = document.createElement('button'); mbtn.className = 'btn ghost map-btn'; mbtn.textContent = 'Map (M)';
  mbtn.onclick = () => (O.panelOpen ? O.Panels.close() : O.openMap()); $('tab-play').appendChild(mbtn);
  const gbtn = document.createElement('button'); gbtn.className = 'btn ghost gang-btn'; gbtn.textContent = 'Gang (G)';
  gbtn.onclick = () => (O.panelOpen ? O.Panels.close() : O.GangUI.ledger()); $('tab-play').appendChild(gbtn);
  const sbtn = document.createElement('button'); sbtn.className = 'btn ghost satchel-btn'; sbtn.textContent = 'Satchel (I)';
  sbtn.onclick = () => (O.panelOpen ? O.Panels.close() : O.Panels.inventory()); $('tab-play').appendChild(sbtn);

  const speeds = [[1, '1×'], [10, '10×'], [60, '60×'], [240, '240×']];
  const seg = $('speedSeg');
  for (const [v, lab] of speeds) {
    const b = document.createElement('button'); b.textContent = lab; b.setAttribute('aria-pressed', v === game.clock.speed);
    b.onclick = () => { game.clock.speed = v; [...seg.children].forEach((x) => x.setAttribute('aria-pressed', x === b)); game.canvas.focus(); };
    seg.appendChild(b);
  }
  const DAYS = O.DAYNAMES;
  function hud() {
    const tl = $('hudTL');
    const where = placeName();
    const bar = (v, c) => `<span class="bar ${c}"><i style="width:${Math.round(v)}%"></i></span>`;
    const wanted = PS.wantedText ? PS.wantedText() : 'NONE';
    const sought = PS.soughtFor ? PS.soughtFor() : '';
    tl.innerHTML = `<div class="place">${where}</div><div class="clock">${DAYS[(game.clock.day - 1) % 7].toUpperCase()} · DAY ${game.clock.day} · ${game.timeString()}</div><div class="lbl">${sim.season.toUpperCase()} · DAY ${sim.weather.dayOfSeason} OF ${O.SEASON_DAYS} · ${sim.weather.label.toUpperCase()}</div>
      <div class="vitals"><span class="lbl">Health</span>${bar(PS.hp, PS.hp < 30 ? 'warn' : '')}<span class="lbl">Fed</span>${bar(PS.hunger, PS.hunger < 25 ? 'warn' : '')}<span class="lbl">Rested</span>${bar(PS.energy, PS.energy < 25 ? 'warn' : '')}</div>
      <div class="purse-row"><span class="lbl">Purse</span><b>${O.money(PS.money)}</b><span class="lbl">Wanted</span><b class="${wanted !== 'NONE' ? 'warn' : ''}">${wanted}</b></div>${wanted !== 'NONE' && sought ? `<div class="sought">The watch seeks ${O.escape(sought)}</div>` : ''}`;
  }
  function placeName() {
    if (game.scene) return game.scene.b.type === "house" ? `The ${sim.households[game.scene.b.household - 1]?.surname || ""} house` + (game.scene.floor ? ", upstairs" : "") : game.scene.b.name + (game.scene.floor ? ', upstairs' : '');
    const p = game.player, T = 16, tx = p.x / T, ty = p.y / T;
    if (game.world !== homeWorld) { const w = game.world; return Math.abs(ty - w.roadY) < 2 ? `${w.name}, high road` : ty < 10 ? `${w.name} woods` : w.name; }
    if (tx >= 37 && tx <= 56 && ty >= 22 && ty <= 30) return 'Ashford Square';
    if (ty >= 29.5 && ty <= 32.5) return tx > 77 && tx < 86 ? 'Ashford Bridge' : "King's Road";
    if (ty >= 40.5 && ty <= 43) return 'Mill Lane';
    if (ty > 43 && tx < 36) return 'Marsh Farm';
    if (ty < 14) return 'Ashford Wood';
    return 'Ashford';
  }
  let acc = 0;
  game.hooks.update.push((dt) => { acc += dt; if (acc > 0.25) { acc = 0; hud(); } });
  hud();

  O.onTab = (tab) => {
    if (tab === 'play') { game.setPlayerAppearance(O.Forge.player); game.start(); setTimeout(() => game.resize(), 0); game.canvas.focus(); }
    else game.stop();
  };
  game.start();
  game.canvas.focus();
})();
