// Homes and sleep. Everyone goes to bed at an hour that suits their age and their trade — babies at
// dusk, children soon after, the old early to bed and early up, the baker long before dawn — and
// sleeps in a bed of their own (or one they share with their husband or wife, or a little brother).
// Each family keeps its own house: newlyweds set up home in an empty house when there is one; a
// family that grows buys another bed from the carpenter, and if there is no room left for it they
// move to a bigger house standing empty.
'use strict';
(function () {
  function sleepTimes(p, rng) {
    const j = ((p.id * 37) % 41) - 20; // a little difference between people, the same every night
    const lazy = p.traits?.includes('lazy') ? 35 : 0, role = p.job?.role;
    let bed, wake;
    if (p.age < 3) { bed = 19 * 60; wake = 7 * 60; }
    else if (p.age < 8) { bed = 19 * 60 + 30; wake = 7 * 60; }
    else if (p.age < 13) { bed = 20 * 60 + 15; wake = 6 * 60 + 45; }
    else if (p.age < 18) { bed = 22 * 60; wake = 7 * 60 + 10 + lazy; }
    else if (p.age >= 65) { bed = 20 * 60 + 45; wake = 5 * 60 + 30; }
    else { bed = 22 * 60; wake = 6 * 60 + lazy; }
    if (role === 'baker') { bed = 20 * 60 + 30; wake = 3 * 60 + 30; }
    if (['farmer', 'farmhand', 'miller'].includes(role)) { wake = Math.min(wake, 5 * 60); bed = Math.min(bed, 21 * 60 + 30); }
    if (role === 'innkeeper' || role === 'server') { bed = 23 * 60 + 30; wake = 7 * 60; }
    void rng;
    return { bed: bed + (p.age >= 13 ? j : Math.round(j / 3)), wake: wake + (p.age >= 13 ? j : 0) };
  }

  function installSim(Sim) {
    const S = Sim.prototype;

    S.setSleepTimes = function (p) {
      if (p.wake === 0 && p.bed === 1440) return; // travellers and soldiers keep their own hours
      const t = sleepTimes(p, this.rng); p.wake = t.wake; p.bed = t.bed;
    };

    const houseLike = (b) => b && ['house', 'farmhouse', 'woodcutter', 'mansion', 'townhouse'].includes(b.type) && !b.ruined && !b.site && !b.fire;
    S.emptyHouses = function () { return this.world.buildings.filter((b) => houseLike(b) && !b.household && !b.leasedToPlayer && !b.parishLet && (b.vacant || !(b.households || []).some((id) => { const h = this.households[id - 1]; return h && !h.gone && h.home === b.id; })) && b.owner?.kind !== 'player'); };

    // how many sleepers a house's bedrooms can take, from the furniture that fits in it
    S.bedRoom = function (b) {
      if (!O.Interior || !O.Furn) return 99;
      const f = (b.floors || 1) - 1;
      try { const L = O.Interior.layoutFor(b, f, this); return L.items.filter((i) => i.bed).reduce((a, i) => a + (i.cradle ? 1 : (i.slots || 1) + (i.slots === 1 ? 0.5 : 0)), 0); } catch (e) { return 99; }
    };

    S.newHousehold = function (members, b, money) {
      const old = this.household(members[0]);
      const hh = { id: this.households.length + 1, home: b.id, members: members.map((p) => p.id), pantry: { bread: 2, cabbage: 1, firewood: 2 }, money: Math.max(0, Math.round(money)), surname: members[0].sur };
      this.households.push(hh);
      for (const p of members) { if (old) old.members = old.members.filter((id) => id !== p.id); p.household = hh.id; p.home = b.id; if (!p.task) p.task = { act: 'move-in', b: b.id }; }
      b.household = hh.id; b.households = [hh.id]; b.vacant = false;
      O.Interior && O.Interior.invalidate(b); if (old) { const ob = this.building(old.home); if (ob) O.Interior && O.Interior.invalidate(ob); }
      return hh;
    };

    S.moveHousehold = function (hh, b) {
      const from = this.building(hh.home);
      if (from) { from.household = null; from.households = (from.households || []).filter((id) => id !== hh.id); from.vacant = true; O.Interior && O.Interior.invalidate(from); }
      hh.home = b.id; b.household = hh.id; b.households = [hh.id]; b.vacant = false;
      for (const id of hh.members) { const p = this.byId.get(id); if (p) { p.home = b.id; if (!p.task) p.task = { act: 'move-in', b: b.id }; } }
      O.Interior && O.Interior.invalidate(b);
    };

    // newlyweds who would otherwise live with their parents take an empty house of their own
    const _wed = S.wed;
    if (_wed) S.wed = function (a, b) {
      _wed.call(this, a, b);
      const hh = this.household(a); if (!hh) return;
      const others = hh.members.filter((id) => id !== a.id && id !== b.id);
      if (!others.length) return;
      const free = this.emptyHouses().sort((x, y) => (x.w * x.d * (x.floors || 1)) - (y.w * y.d * (y.floors || 1)))[0];
      if (!free) return;
      const purse = Math.min(hh.money * 0.25, 40);
      hh.money -= purse;
      const nh = this.newHousehold([a, b], free, purse + 10);
      this.log(`${a.first} and ${b.first} have set up home together in an empty house${free.name && free.name !== 'House' ? ' — ' + free.name : ''}.`, 'life');
      this.remember(a, 'We have a house of our own now.', 'life', 2, b.id); this.remember(b, 'We have a house of our own now.', 'life', 2, a.id);
      void nh;
    };

    // daily: bedtimes follow birthdays; growing families buy beds or move somewhere bigger
    S.homesDaily = function () {
      for (const p of this.people) if (p.alive !== false) this.setSleepTimes(p);
      if (this.day % 2) return;
      const cp = this.supplierOf ? this.supplierOf('carpenter') : null;
      for (const hh of this.households) {
        if (hh.gone || !hh.members.length) continue;
        const b = this.building(hh.home); if (!houseLike(b)) continue;
        const n = hh.members.length;
        hh.beds = hh.beds ?? n;
        if (n > hh.beds) {
          // a new bed (or a cradle) from the carpenter
          const price = cp ? Math.round(this.price(cp, 'furniture') * 0.8) : 18;
          if (hh.money >= price) {
            hh.money -= price; if (cp) { cp.cash += price; cp.salesToday += price; if ((cp.stock.furniture || 0) > 0) cp.stock.furniture -= 1; }
            hh.beds = n; O.Interior && O.Interior.invalidate(b);
            const head = this.byId.get(hh.members[0]); if (head) this.remember(head, `We bought another bed${cp ? ' from ' + cp.name : ''}. The house is fuller than it was.`, 'life', 0.8);
          }
        } else hh.beds = Math.max(n, Math.min(hh.beds, n + 1));
        // no room for the beds a family needs: look for a bigger house standing empty
        if (n >= 4 && this.rng.chance(0.5)) {
          const room = this.bedRoom(b);
          if (room + 0.01 < n) {
            const area = (x) => x.w * x.d * (x.floors || 1);
            const better = this.emptyHouses().filter((x) => area(x) > area(b) && this.bedRoom(x) >= n).sort((x, y) => area(x) - area(y))[0];
            if (better && hh.money >= 15) {
              hh.money -= 15;
              this.moveHousehold(hh, better);
              this.log(`The ${hh.surname} family have outgrown their house and moved to a bigger one standing empty.`, 'life');
            } else {
              // grown sons and daughters with spouses leave to make room
              const couple = hh.members.map((id) => this.byId.get(id)).find((p) => p && p.spouse && p.age >= 18 && hh.members.includes(p.spouse) && p.id !== hh.members[0] && p.spouse !== hh.members[0]);
              const free = this.emptyHouses()[0];
              if (couple && free) { const sp = this.byId.get(couple.spouse); this.newHousehold([couple, sp], free, 15); this.log(`${couple.first} and ${sp.first} have moved out of a crowded house into one of their own.`, 'life'); }
            }
          }
        }
      }
    };
    const _plan = S.plan;
    S.plan = function (p) { if (!p._sleepSet) { p._sleepSet = true; this.setSleepTimes(p); } return _plan.call(this, p); };
    const _nd = S.newDay;
    S.newDay = function () { _nd.call(this); this.homesDaily(); };
  }

  O.Homes = { installSim, sleepTimes };
})();
