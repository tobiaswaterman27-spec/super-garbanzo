// First thing and last thing. When folk step out of their doors in the morning they stretch, yawn, scratch,
// look up at the sky to see what it'll do, and now and then somebody flings the night's wash-water out of
// a basin into the street in a silver arc. And at night the cats come out along the eaves: two of them
// meet on a roof edge, arch up, and yowl at each other fit to wake the dead, until one bolts.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const prevIn = new Map(), drops = []; let fight = null, fCool = 20, t = 0; let mornings = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    game.hooks.update.push((dt) => {
      for (const d of drops.slice()) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 200 * dt; if (d.t > d.land) { d.vx = 0; d.vy = 0; } if (d.t > 2) drops.splice(drops.indexOf(d), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      // mornings: stepping out of the house for the first time today
      t += dt; if (t > 0.5) { t = 0;
        for (const q of s.people) { const a = q.agent; if (!a) continue; const was = prevIn.get(q); prevIn.set(q, a.inside);
          if (was == null || was !== q.home || a.inside != null || a.hidden || hr < 4.5 || hr > 9.5 || q._morn === s.day || a.frozen || q.age < 4) continue;
          q._morn = s.day; if (!near(a.x, a.y, 420)) continue; mornings++;
          const r = Math.random(), what = r < 0.35 ? 'stretch' : r < 0.55 ? 'yawn' : r < 0.7 ? 'look' : r < 0.8 ? 'scratch' : 'basin';
          if (what === 'basin' && q.age >= 12) { O.gesture && O.gesture(q, 'pour', 1.2); const dv = Math.random() < 0.5 ? -1 : 1; for (let i = 0; i < 14; i++) drops.push({ x: a.x + dv * 6, y: a.y - 14, vx: dv * (30 + Math.random() * 50), vy: -40 - Math.random() * 40, t: 0, land: 0.45 + Math.random() * 0.2 }); setTimeout(() => near(a.x, a.y, 240) && O.sfx && O.sfx('splash', 0.25), 400); }
          else { O.gesture && O.gesture(q, what === 'basin' ? 'stretch' : what, what === 'look' ? 2.5 : 2); if (what === 'look' && Math.random() < 0.6) setTimeout(() => O.Speech && O.Speech.say(q, s.raining ? 'Rain again. Lord help us.' : s.season === 'winter' ? 'Cold enough to freeze your breath.' : pick(['Fine day for it.', 'Looks like rain later.', 'Another day, another penny.']), 2.4), 1200); if (what === 'yawn' && Math.random() < 0.3) setTimeout(() => O.Speech && O.Speech.say(q, pick(['Too early.', 'That cockerel...', 'Bed was warm.']), 2), 1500); }
        }
      }
      // the cats on the roofs at night
      if (fight) { fight.t += dt; const F = fight; for (const c of F.cats) c.ft += dt;
        if (F.s !== s || F.t > 22) fight = null;
        else if (F.t > F.bolt && !F.gone) { F.gone = true; const loser = F.cats[Math.floor(Math.random() * 2)]; loser.run = loser.x < F.mx ? -1 : 1; if (near(F.mx, F.y, 300)) O.animalCall && O.animalCall('cat', 0.4); }
        else if (!F.gone && Math.random() < dt * 0.9 && near(F.mx, F.y, 350)) { O.animalCall && O.animalCall('cat', 0.3 + Math.random() * 0.2); F.yowl = 0.6; }
        if (F.yowl > 0) F.yowl -= dt; for (const c of F.cats) if (c.run) c.x += c.run * 90 * dt;
      }
      fCool -= dt; if (fCool > 0 || fight || !(game.isNight && game.isNight()) || s.raining) return; fCool = 40 + Math.random() * 50;
      const P = game.player, bs = s.world.buildings.filter((b) => b.sprite && b.sprite.wallTop != null && !b.site && !b.ruined && b.w >= 4 && Math.abs((b.x + b.w / 2) * T - P.x) < 260 && Math.abs(b.bottom * T - P.y) < 200); if (!bs.length) return;
      const b = pick(bs), sp = b.sprite, ey = (b.bottom + 1) * T - sp.H + sp.wallTop - 2, x0 = b.x * T + 8, x1 = (b.x + b.w) * T - 8, mx = (x0 + x1) / 2;
      fight = { s, b, y: ey, mx, t: 0, bolt: 10 + Math.random() * 6, gone: false, yowl: 0, cats: [{ x: mx - 9, dir: 2, seed: O.hash('ncat', b.id, 1) % 1000, ft: 0, run: 0 }, { x: mx + 9, dir: 1, seed: O.hash('ncat', b.id, 2) % 1000, ft: 0, run: 0 }] };
      if (near(mx, ey, 300)) O.animalCall && O.animalCall('cat', 0.35);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      ctx.fillStyle = 'rgba(210,228,245,0.85)'; for (const d of drops) ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y), d.t > d.land ? 2 : 1, 1);
      const F = fight; if (!F || F.s !== s) return;
      for (const c of F.cats) { const x = c.x, y = F.y; if (c.run && Math.abs(x - F.mx) > 70) continue; try { const an = c.run ? 'walk' : 'idle', HA = O.Animals.HANIMS[an], fr = O.Animals.animal('cat', c.seed, c.run ? (c.run > 0 ? 2 : 1) : c.dir, !!c.run, Math.floor(c.ft * HA.fps * (c.run ? 2 : 1)) % HA.frames, an); const dx = Math.round(x - (fr.ox ?? fr.width / 2) - cam.x), dy = Math.round(y - (fr.gy ?? fr.height) - cam.y) - (c.run ? 0 : (F.yowl > 0 ? 2 : 1)); ctx.drawImage(fr, dx, dy); } catch (e) { /* */ }
        if (!c.run && F.yowl > 0) { ctx.fillStyle = 'rgba(240,240,230,0.8)'; const tx = Math.round(x - cam.x) + (c.dir === 2 ? 4 : -8), ty = Math.round(y - cam.y) - 16; ctx.fillRect(tx, ty, 4, 1); ctx.fillRect(tx + 1, ty - 2, 1, 1); ctx.fillRect(tx + 3, ty - 2, 1, 1); } }
    });
    O.DawnDusk = { get fight() { return fight; }, get mornings() { return mornings; }, catfight: () => { fCool = 0; fight = null; } };
  }
  O.DawnDuskSetup = { setup };
})();
