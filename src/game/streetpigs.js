// Pigs in the street. Town pigs root loose along the lanes, snuffling in the gutters and the midden heaps,
// and they get into everything; when one noses up to somebody's doorstep the goodwife comes out with her
// broom and lays about it ("Get out of it! Go on, shoo!") and it trots off squealing, to start again two
// doors down.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let pigs = null, shoos = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    function herd(s) { if (pigs && pigs.s === s) return pigs; const P = game.player, r = O.RNG(O.hash('streetpig', s.world.placeId || 'x')); const n = 1 + r.int(0, 1); const L = []; for (let i = 0; i < n; i++) L.push({ x: P.x + r.int(-200, 200), y: P.y + r.int(-120, 120), seed: r.int(1, 999), dir: 1, ft: 0, st: 'root', t: 0, tx: null, ty: null }); return (pigs = { s, L }); }
    const okAt = (s, x, y) => { const w = s.world, tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 1 || ty < 1 || tx >= w.W - 1 || ty >= w.H - 1) return false; const i = ty * w.W + tx; return !w.solid[i] && w.ter[i] !== w.TER.WATER; };
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const H = herd(s), P = game.player, night = game.isNight && game.isNight();
      for (const g of H.L) { g.ft += dt; g.t += dt;
        if (Math.hypot(g.x - P.x, g.y - P.y) > 520) { g.x = P.x + (Math.random() - 0.5) * 600; g.y = P.y + (Math.random() - 0.5) * 360; if (!okAt(s, g.x, g.y)) { g.x = P.x - 200; g.y = P.y; } g.tx = null; }
        if (g.tx != null) { const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy), v = g.st === 'flee' ? 55 : 14; if (d < 2) { g.tx = null; if (g.st === 'flee') g.st = 'root'; } else { const nx = g.x + dx / d * v * dt, ny = g.y + dy / d * v * dt; if (okAt(s, nx, ny)) { g.x = nx; g.y = ny; } else g.tx = null; g.dir = dx > 0 ? 2 : 1; } }
        else if (g.t > 3 + Math.random() * 4) { g.t = 0; const a = Math.random() * 6.28; g.tx = g.x + Math.cos(a) * 40; g.ty = g.y + Math.sin(a) * 24; if (Math.random() < 0.08 && near(g.x, g.y, 220)) O.animalCall && O.animalCall('pig', 0.25); }
        if (night || g.st === 'flee' || g.shoo) continue;
        // at someone's door: out comes the broom
        const b = s.world.buildings.find((b) => b.type === 'house' && b.doorX != null && Math.abs(b.doorX * T + 8 - g.x) < 18 && Math.abs((b.doorY + 1) * T - g.y) < 16); if (!b) continue;
        const wife = s.people.find((x) => x.home === b.id && x.age >= 16 && x.agent && !x.agent.frozen && !x.errand && !x._bit && !x._scene && !talking(x) && (x.agent.inside === b.id || (!x.agent.hidden && Math.hypot(x.agent.x - g.x, x.agent.y - g.y) < 120))); if (!wife) continue;
        g.shoo = true; shoos++;
        O.Errands.send(s, wife, [b.doorX, b.doorY + 1], { anim: 'sweep', secs: 1.8, face: g.x > b.doorX * T + 8 ? 2 : 1, giveUp: game.t + 20, at: () => { O.Speech && near(g.x, g.y, 280) && O.Speech.say(wife, pick(['Get out of it! Shoo!', 'Out of my cabbages, you brute!', 'Whose pig is this?!']), 2.2); g.st = 'flee'; const aw = g.x > wife.agent.x ? 1 : -1; g.tx = g.x + aw * 90; g.ty = g.y + (Math.random() - 0.5) * 40; if (near(g.x, g.y, 260)) O.animalCall && O.animalCall('pig', 0.45); }, after: () => { setTimeout(() => { g.shoo = false; }, 8000); } });
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene || !pigs || pigs.s !== s) return;
      for (const g of pigs.L) { if (O.occluded && O.occluded(g.x, g.y)) continue; try { const moving = g.tx != null, an = moving ? (g.st === 'flee' ? 'gallop' : 'walk') : 'graze', HA = O.Animals.HANIMS[an] || O.Animals.HANIMS.idle, fr = O.Animals.animal('pig', g.seed, g.dir, moving, Math.floor(g.ft * HA.fps) % HA.frames, an); ctx.drawImage(fr, Math.round(g.x - (fr.ox ?? fr.width / 2) - cam.x), Math.round(g.y - (fr.gy ?? fr.height) - cam.y)); } catch (e) { /* */ } }
    });
    O.StreetPigs = { get pigs() { return pigs; }, get shoos() { return shoos; } };
  }
  O.StreetPigsSetup = { setup };
})();
