// Play screen: boots the village and keeps the HUD in step with the simulation.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const world = O.Village.makeVillage(7);
  const game = new O.Game($('game'));
  game.load(world, O.Forge.player);
  O.game = game;

  const speeds = [[1, '1×'], [10, '10×'], [60, '60×']];
  const seg = $('speedSeg');
  for (const [v, lab] of speeds) {
    const b = document.createElement('button'); b.textContent = lab; b.setAttribute('aria-pressed', v === game.clock.speed);
    b.onclick = () => { game.clock.speed = v; [...seg.children].forEach((x) => x.setAttribute('aria-pressed', x === b)); game.canvas.focus(); };
    seg.appendChild(b);
  }
  const DAYS = ['Moonday', 'Tewsday', 'Wodensday', 'Thorsday', 'Freyday', 'Saturnday', 'Sunday'];
  function hud() {
    const tl = $('hudTL');
    const where = placeName();
    tl.innerHTML = `<div class="place">${where}</div><div class="clock">${DAYS[(game.clock.day - 1) % 7].toUpperCase()} · DAY ${game.clock.day} · ${game.timeString()}</div><div class="lbl">${game.season.toUpperCase()} · CLEAR</div>`;
  }
  function placeName() {
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
