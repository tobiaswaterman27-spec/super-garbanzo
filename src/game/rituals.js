// The shape of a day, and the sky over each town. The chapel bell rings at six, noon and six, and at
// the noon Angelus the devout stop in the street and bow their heads; at nine the curfew bell tells the
// town to cover its fires and go in, and the watch calls it. In the morning someone from each house
// fetches water from the well. People mind the weather without fuss: a fine evening brings them out to
// sit at their doors, a hot noon sends them into the shade, cold and wet keep them in. And every town
// has its own sky: the north is colder and snowier, the south warmer, each with its own weather.
'use strict';
(function () {
  // the land's lie: how far north or south a place is, from 0 (north) to 1 (south)
  O.climateOf = (placeId) => {
    try { const p = O.Island.data().place(placeId); const H = (O.Eldoria && O.Eldoria.H) || 100; if (!p) return null; const y = O.clamp(p.y / H, 0, 1); return { south: y, cold: y < 0.33, warm: y > 0.66 }; } catch (e) { return null; }
  };
  // each town its own weather, from its own seed, leaning with its climate
  { const W = O.Weather.prototype, _hourly = W.hourly;
    W.hourly = function () {
      if (!this._own && this.sim && this.sim.world) { this._own = true; this.rng = O.RNG(O.hash('sky', this.sim.world.placeId || this.sim.world.name || 'x')); this.climate = O.climateOf(this.sim.world.placeId); }
      const was = this.kind; _hourly.call(this);
      const C = this.climate; if (!C || this.forced || this.kind === was) return;
      if (C.cold && this.kind === 'heat') this.kind = 'clear';
      else if (C.cold && this.kind === 'rain' && (this.season === 'winter' || this.season === 'autumn') && this.rng.chance(0.4)) this.kind = 'snow';
      else if (C.warm && this.kind === 'snow' && this.rng.chance(0.7)) this.kind = 'rain';
      else if (C.warm && this.kind === 'clear' && this.season === 'summer' && this.rng.chance(0.3)) this.kind = 'heat';
    }; }

  function setup(game) {
    const SP = O.Sim.prototype, cur = () => O.SimRef.cur;
    // what people do with the weather and the hour (only nudges: work, worship and duty come first)
    const _plan = SP.plan;
    SP.plan = function (p) {
      const a = _plan.call(this, p); if (!a || p.age < 14 || !this.weather) return a;
      const h = this.hour, W = this.weather, free = ['home', 'stroll', 'sit', 'idle', 'socialise'].includes(a.act), hh = this.household(p);
      // fetching water: one from each house, first thing
      if (a.act === 'home' && h >= 6.2 && h < 6.9 && hh && hh.members.find((id) => { const z = this.byId.get(id); return z && z.age >= 12 && z.age < 60; }) === p.id && !this.raining) return { act: 'stroll', outdoor: true, zone: 'square', water: true };
      // after curfew, the street empties
      if (h >= 21 && a.outdoor && free && !p.gang) return { act: 'home', b: p.home };
      if (!free) return a;
      // a fine evening: out on the doorstep
      if (a.act === 'home' && h >= 17.5 && h < 20.5 && (W.kind === 'clear' || W.kind === 'heat') && this.season !== 'winter' && (p.id + this.day) % 3 === 0) return { act: 'stroll', outdoor: true, zone: 'home' };
      // the heat of noon: into the shade (indoors, or the benches under the trees)
      if (a.outdoor && W.kind === 'heat' && h >= 12 && h < 15) return p.stage === 'elder' ? { act: 'sit', outdoor: true, zone: 'bench' } : { act: 'home', b: p.home };
      // bitter cold: no loitering
      if (a.outdoor && (W.kind === 'snow' || (this.season === 'winter' && W.kind !== 'clear')) && (p.id + this.day) % 2 === 0) return { act: 'home', b: p.home };
      // a soft drizzle doesn't keep everyone in
      return a;
    };

    // the bells
    let lastH = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.world) return;
      const h = Math.floor(s.minute / 60); if (h === lastH) return; const was = lastH; lastH = h; if (was < 0) return;
      const church = [...s.biz.values()].some((z) => z.type === 'chapel' || z.type === 'church');
      const inside = !!game.scene, vol = inside ? 0.35 : 0.8;
      if (church && (h === 6 || h === 12 || h === 18)) {
        O.Sound && O.Sound.play('bell', h === 12 ? 3 : 2, vol);
        if (h === 12) angelus(s);
      }
      if (h === 21) {
        if (church) O.Sound && O.Sound.play('bell', 4, vol * 0.8);
        const P = game.player, w = s.people.filter((q) => /guard|watch|constable/.test(q.job?.role || '') && !q.agent.hidden && q.agent.inside == null).sort((a, b) => Math.hypot(a.agent.x - P.x, a.agent.y - P.y) - Math.hypot(b.agent.x - P.x, b.agent.y - P.y))[0];
        if (w && O.Speech && !inside) O.Speech.say(w, 'Curfew! Cover your fires and get you home!', 4, 'shout');
      }
    });
    // the Angelus: the devout stop where they are and bow their heads
    function angelus(s) {
      const P = game.player, near = game.scene ? [...game.scene.actors.values()].map((a) => a.person).filter(Boolean) : s.people.filter((q) => !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 260);
      for (const q of near) {
        if (q.age < 7 || q.alive === false || q.agent.frozen || q.activity?.act === 'sleep') continue;
        const devout = s.has(q, 'pious') || q.stage === 'elder' || /priest|nun|monk|friar|clerk/.test(q.job?.role || '');
        if (Math.random() < (devout ? 0.85 : 0.35)) O.gesture && O.gesture(q, 'pray', 2.6 + Math.random());
      }
    }
    // what they make of the day and the sky, for their card
    O.dayLine = (s, q) => {
      const W = s.weather; if (!W) return '';
      const C = O.climateOf(s.world.placeId), out = [];
      if (C) out.push(C.cold ? 'You live in the cold north: hard winters, snow is common.' : C.warm ? 'You live in the mild south: warm summers, snow is rare.' : '');
      const h = s.hour; if (h >= 21 || h < 5) out.push('It is after curfew: decent folk are indoors, fires covered.');
      return out.filter(Boolean).join(' ');
    };
  }
  O.RitualsSetup = { setup };
})();
