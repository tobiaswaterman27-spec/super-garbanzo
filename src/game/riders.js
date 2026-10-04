// Riders. Merchants with a horse ride their journeys between towns; in town the mounted couriers,
// knights and the gentry go about on horseback. On council day each place's leader rides out of
// town in the morning and back at evening, and in the capital the leaders ride in through the gate
// and up to the great hall.
'use strict';
(function () {
  const COATS = ['bay', 'chestnut', 'black', 'grey', 'dun', 'piebald'];
  function setup(game) {
    const T = 16, cur = () => O.SimRef.cur;
    const horseFor = (key, n) => ({ id: 'r' + key, coat: COATS[Math.abs(n) % COATS.length], saddled: true, anim: 'idle', ft: 0, seed: Math.abs(n) + 3 });
    // who rides in town
    const rides = (q) => q.agent && !q.agent.hidden && q.agent.inside == null && q.age >= 16 && (q.ridingOut || ['mounted courier', 'knight', 'captain of the royal guard', 'master of horse'].includes(q.job?.role) || (q.gentry && q.agent.path && q.agent.path.length - (q.agent.pi || 0) > 12));
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || game.scene) return;
      for (const q of s.people) {
        const a = q.agent; if (!a) continue;
        if (rides(q)) { const h = a.mount || (a.mount = horseFor(q.id + '_' + s.world.placeId, q.id)); h.anim = a.path ? (a.sprint ? 'gallop' : 'walk') : 'idle'; h.ft += dt; }
        else if (a.mount) a.mount = null;
      }
    });
    // merchants on the road with a horse of their own ride it
    game.hooks.update.push((dt) => {
      for (const a of game.actors) {
        if (!a.traveller || !a.journey || !a.journey.horse) continue;
        const h = a.mount || (a.mount = horseFor('j' + a.journey.id + '_' + a.k, (a.journey.id + '').length * 7 + a.k * 3));
        h.anim = 'walk'; h.ft += dt;
      }
    });
    // riders go at a horse's pace
    const SP = O.Sim.prototype, _speed = SP.speedOf;
    SP.speedOf = function (p) { const v = _speed.call(this, p); return p.agent && p.agent.mount ? v * 1.7 : v; };

    // council day: each place's leader rides out to the capital in the morning, and home at evening
    const leaderOf = (s) => {
      if (s._leaderDay === s.day) return s._leader;
      s._leaderDay = s.day; s._leader = null;
      const K = s.kingdom, pl = K && K.place && K.place(s.world.placeId); if (!pl || pl.kind === 'capital' || s.reeveId) return null;
      const L = K.leaders && K.leaders[pl.id];
      let q = L && L.pid != null ? s.byId.get(L.pid) : null;
      if (!q) q = s.people.find((x) => x.office === 'leader' && x.alive !== false) || s.people.find((x) => x.job?.role === 'magistrate' && x.alive !== false) || null;
      return (s._leader = q);
    };
    const _plan = SP.plan;
    SP.plan = function (p) {
      if (this.weekday === 3) {
        const L = leaderOf(this);
        if (L === p && p.alive !== false && !p.health?.illness) { const h = this.hour; if (h >= 8.5 && h < 18) { p.ridingOut = true; return { act: 'council', outdoor: true, zone: 'east' }; } }
      }
      if (p.ridingOut && !(this.weekday === 3 && this.hour >= 8.5 && this.hour < 18)) p.ridingOut = false;
      return _plan.call(this, p);
    };
    // out of sight once they're through the gate; back in view when they come home
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.Z) return; const L = leaderOf(s); if (!L || !L.agent) return;
      const a = L.agent, east = s.Z.east;
      if (L.activity?.act === 'council' && !a.path && east && Math.hypot(a.x - (east[0] * T + 8), a.y - (east[1] * T + 10)) < 40) { if (!a.hidden) { a.hidden = true; s.log(`${L.name} has ridden out for the council of the realm.`, 'politics'); } }
      else if (L.activity?.act !== 'council' && a.hidden && a.inside == null && L.ridingOut === false) { a.hidden = false; }
    });
    O.Riders = { leaderOf, horseFor };
  }
  O.RidersSetup = { setup };
})();
