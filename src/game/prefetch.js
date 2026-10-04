// Loading ahead. While you walk about, the places at the ends of the roads you could take are built
// in the background a little at a time, between frames: the settlement's map and its people, the road
// itself, the ground, and every building, tree and prop drawn and ready. A town you've already left
// keeps living in the background too, so when you walk back in it is simply there, already going about
// its day, with no pause.
'use strict';
(function () {
  const jobs = [];
  let busy = false;

  // the sprites of a world, one at a time
  function* paint(world, season) {
    if (!world._ground || world._groundSeason !== season) { world._ground = O.Terrain.renderGround(world, season); world._groundSeason = season; yield; }
    for (const b of world.buildings) { if (!b.sprite) { b.sprite = b.ruined ? O.Env.ruin(b.spec) : b.type === 'hideout' ? O.Env.hideout(b.level, b.spec) : O.Env.building(b.spec); yield; } }
    for (const t of world.trees) { if (!t.sprite || t.sprite.season !== season) { t.sprite = O.Env.tree(t.seed, t.kind, season); t.sprite.season = season; yield; } }
    for (const p of world.props) { if (!p.sprite) { p.sprite = O.Env.prop(p.kind, p.seed, p.v); } }
    yield;
  }

  function add(key, gen) { if (jobs.some((j) => j.key === key)) return; jobs.push({ key, it: gen }); kick(); }
  function kick() {
    if (busy) return; busy = true;
    const run = () => {
      const t0 = performance.now();
      while (jobs.length && performance.now() - t0 < 7) {
        const j = jobs[0];
        try { const r = j.it.next(); if (r.done) jobs.shift(); } catch (e) { console.warn('prefetch', j.key, e); jobs.shift(); }
      }
      if (jobs.length) setTimeout(run, 4); else busy = false;
    };
    setTimeout(run, 30);
  }

  function setup(game, home) {
    const K = home.kingdom;
    const now = () => home.day * 1440 + home.minute;
    let last = null, t = 0;
    game.hooks.update.push((dt) => {
      t -= dt; if (t > 0) return; t = 2;
      const w = game.world; if (!w || !K) return;
      const season = game.season;
      // the places the roads from here lead to
      const targets = [];
      if (w.road) targets.push(w.road.a, w.road.b);
      else for (const id of Object.keys(w.exits || {})) if (K.place(id)) targets.push(id);
      const here = w.road ? null : w.placeId;
      if (last !== (w.road ? w.road.a + '|' + w.road.b : here)) {
        last = w.road ? w.road.a + '|' + w.road.b : here;
        for (const id of targets) {
          if (id === 'ashford' || id === here) continue;
          add('town:' + id, (function* () {
            const v = O.Travel.ensure(id); yield;
            yield* paint(v.world, season);
          })());
          if (here) add('road:' + [here, id].sort().join('|'), (function* () { const rw = O.Roads.roadFor(here, id); yield; yield* paint(rw, season); })());
        }
      }
      // keep the places you've been to (and the ones made ready) living, a slice at a time
      for (const [id, v] of O.Travel.visited) {
        if (!v.sim || v.sim === O.SimRef.cur || v.sim === home || v.leftAt == null) continue;
        if (now() - v.leftAt < 20) continue;
        add('live:' + id, (function* () { let n = 0; while (now() - v.leftAt >= 2 && n++ < 60 && v.sim !== O.SimRef.cur) { v.sim.tick(2); v.leftAt += 2; yield; } })());
      }
    });
  }
  O.Prefetch = { setup, paint, add };
})();
