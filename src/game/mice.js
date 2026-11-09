// Mice. At dusk and through the night they come out along the foot of the walls, by the bakehouse and the
// granary most of all: a dash, a freeze, a twitch of whiskers, another dash, and gone into a crack. Come
// near and they're off like a shot.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const mice = []; let cool = 2;
    const night = () => game.isNight && game.isNight();
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) { mice.length = 0; return; } const P = game.player;
      for (const m of mice.slice()) { m.t += dt; if (m.st === 'freeze') { if (m.t > m.hold) { m.st = 'run'; m.t = 0; m.go = 0.4 + Math.random() * 0.8; } }
        else { m.x += m.dir * 60 * dt; if (m.t > m.go) { m.st = 'freeze'; m.t = 0; m.hold = 0.4 + Math.random() * 1.5; if (Math.random() < 0.2) m.dir = -m.dir; } }
        if (Math.hypot(P.x - m.x, P.y - m.y) < 40 && !m.flee) { m.flee = true; m.st = 'run'; m.t = 0; m.go = 9; m.dir = m.x > P.x ? 1 : -1; }
        if (Math.abs(m.x - m.x0) > 90 || m.life-- <= 0 || !night()) mice.splice(mice.indexOf(m), 1); }
      cool -= dt; if (cool > 0 || !night() || mice.length >= 5) return; cool = 2 + Math.random() * 4;
      const bs = s.world.buildings.filter((b) => b.doorX != null && !b.site && Math.abs((b.x + b.w / 2) * T - P.x) < 300 && Math.abs(b.bottom * T - P.y) < 220); if (!bs.length) return;
      const pref = bs.filter((b) => /bakery|granary|mill|tavern|inn|store|grocer/.test(b.type)), b = (pref.length && Math.random() < 0.6 ? pref : bs)[Math.floor(Math.random() * (pref.length && Math.random() < 0.6 ? pref.length : bs.length))] || bs[0];
      const x0 = (b.x + Math.random() * b.w) * T, y0 = (b.bottom + 1) * T + 2; mice.push({ x: x0, x0, y: y0, dir: Math.random() < 0.5 ? -1 : 1, st: 'freeze', t: 0, hold: Math.random(), go: 0, life: 900 });
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene || !mice.length) return; const tk = performance.now() / 1000;
      for (const m of mice) { const x = Math.round(m.x - cam.x), y = Math.round(m.y - cam.y); if (O.occluded && O.occluded(m.x, m.y)) continue; ctx.fillStyle = '#5a504a'; ctx.fillRect(x - 2, y - 2, 4, 2); ctx.fillRect(x + (m.dir > 0 ? 2 : -3), y - 2, 1, 1); ctx.fillStyle = '#8a7a74'; ctx.fillRect(x - (m.dir > 0 ? 4 : -2), y - 1, 2, 1); if (m.st === 'freeze' && Math.floor(tk * 8) % 2) { ctx.fillStyle = '#c8b8b0'; ctx.fillRect(x + (m.dir > 0 ? 3 : -4), y - 3, 1, 1); } }
    });
    O.Mice = { mice };
  }
  O.MiceSetup = { setup };
})();
