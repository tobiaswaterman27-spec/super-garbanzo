// The dogs have opinions. Whatever comes through the town (a loose bull, the goose girl's geese, an ox-wagon,
// the gong cart at night, the cows coming home, the ploughboys with their plough), the dogs of the place
// notice: they come barking, run alongside at a safe distance with their hackles up, and only give up and
// trot home when it has passed. The geese hiss back. The bull ignores them.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const chasing = new Map(); let acc = 0, barks = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    // what's passing, and where
    const things = () => { const out = []; const add = (o, x, y, k) => { if (o && x != null) out.push({ o, x, y, k }); };
      try { const B = O.LooseBull && O.LooseBull.bull; if (B && B.phase === 'loose') add(B, B.bull.x, B.bull.y, 'bull'); } catch (e) { /* */ }
      try { const G = O.GooseGirl && O.GooseGirl.flock; if (G) add(G, G.x + G.dir * 20, G.y, 'geese'); } catch (e) { /* */ }
      try { const W = O.OxWagons && O.OxWagons.wagon; if (W) add(W, W.x, W.y, 'wagon'); } catch (e) { /* */ }
      try { const C = O.GongFarmer && O.GongFarmer.cart; if (C) add(C, C.x, C.y, 'gong'); } catch (e) { /* */ }
      try { const H = O.CowsHome && O.CowsHome.herd; if (H) add(H, H.x + H.dir * 40, H.y, 'cows'); } catch (e) { /* */ }
      try { const R = O.PloughMonday && O.PloughMonday.run; if (R && R.lads[0]) add(R, R.lads[0].agent.x, R.lads[0].agent.y, 'plough'); } catch (e) { /* */ }
      return out; };
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene || !O.fauna) return; const id = s.world.placeId;
      // dogs already running alongside keep at it, barking, till the thing has gone by
      for (const [f, c] of chasing) { const T = things().find((t) => t.o === c.o); c.t += dt; if (!T || c.t > 20 || f.dead) { chasing.delete(f); f.tx = null; continue; } const side = f.x < T.x ? -1 : 1, tx = T.x + side * 26, ty = T.y + (c.off || 0); const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy); if (d > 2) { const v = Math.min(d, 70 * dt); f.x += dx / d * v; f.y += dy / d * v; f.moving = true; f.dir = dx > 0 ? 2 : 1; } f.tx = null; f._held = game.t + 0.5;
        c.bark -= dt; if (c.bark <= 0) { c.bark = 0.6 + Math.random() * 1.2; barks++; if (near(f.x, f.y, 280)) O.animalCall && O.animalCall('dog', 0.35); if (Math.random() < 0.3) O.Speech && O.Speech.say(f, Math.random() < 0.5 ? 'Woof! Woof!' : 'Grrr... WOOF!', 1); } }
      acc += dt; if (acc < 1) return; acc = 0;
      for (const T of things()) { if (!near(T.x, T.y, 500)) continue; for (const f of O.fauna) { if (f.kind !== 'dog' || f.world !== id || f.dead || f.mine || f.mode === 'heel' || chasing.has(f)) continue; if (Math.hypot(f.x - T.x, f.y - T.y) > 180) continue; if ([...chasing.values()].filter((c) => c.o === T.o).length >= 2) break; chasing.set(f, { o: T.o, t: 0, bark: 0, off: (Math.random() - 0.5) * 16 });
        if (T.k === 'geese' && T.o.girl && near(T.x, T.y, 280) && Math.random() < 0.5) O.Speech && O.Speech.say(T.o.girl, 'Get off, you cur! Leave my geese be!', 2); } } });
    O.DogsReact = { chasing, get barks() { return barks; } };
  }
  O.DogsReactSetup = { setup };
})();
