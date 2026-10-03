// Play screen: boots the village and keeps the HUD in step with the simulation.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const world = O.Village.makeVillage(7);
  const game = new O.Game($('game'));
  game.load(world, O.Forge.player);
  O.game = game;
  const sim = new O.Sim(world, 11);
  O.sim = sim; game.sim = sim;
  const PS = O.PlayerState;
  // the simulation owns time; the engine reads it
  game.clock = { speed: 1, get minute() { return sim.minute; }, set minute(v) {}, get day() { return sim.day; }, set day(v) {} };
  game.hooks.update.push((dt) => {
    sim.tick(dt * game.clock.speed);
    PS.tick(dt * game.clock.speed, false);
    game.actors = [game.player, ...sim.people.map((p) => p.agent)];
  });
  const npcUI = O.NpcUI.setup(game, sim);
  O.Interact.setup(game, sim, npcUI);
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
    const wanted = PS.crimes.length ? (PS.rep.local < -0.3 ? 'SOUGHT' : 'WATCHED') : 'NONE';
    tl.innerHTML = `<div class="place">${where}</div><div class="clock">${DAYS[(game.clock.day - 1) % 7].toUpperCase()} · DAY ${game.clock.day} · ${game.timeString()}</div><div class="lbl">${game.season.toUpperCase()} · CLEAR</div>
      <div class="vitals"><span class="lbl">Health</span>${bar(PS.hp, PS.hp < 30 ? 'warn' : '')}<span class="lbl">Fed</span>${bar(PS.hunger, PS.hunger < 25 ? 'warn' : '')}<span class="lbl">Rested</span>${bar(PS.energy, PS.energy < 25 ? 'warn' : '')}</div>
      <div class="purse-row"><span class="lbl">Purse</span><b>${O.money(PS.money)}</b><span class="lbl">Wanted</span><b class="${wanted !== 'NONE' ? 'warn' : ''}">${wanted}</b></div>`;
  }
  function placeName() {
    if (game.scene) return game.scene.b.type === "house" ? `The ${sim.households[game.scene.b.household - 1]?.surname || ""} house` + (game.scene.floor ? ", upstairs" : "") : game.scene.b.name + (game.scene.floor ? ', upstairs' : '');
    const p = game.player, T = world.T, tx = p.x / T, ty = p.y / T;
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
