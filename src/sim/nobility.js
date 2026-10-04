// The nobility in their seats. A castle's keep is home to its lord or lady and their family — the
// same people the kingdom's rulers list names — with a steward, cooks, maids and a groom in their
// service. In Aurelia the royal castle houses the king, the queen and the royal children,
// served by a chamberlain, ladies-in-waiting, maids, pages and grooms, fed from the Royal Kitchens.
// The great houses of the capital belong to knights and their ladies. The gentry don't take work in
// the town; their estates pay the wages of their servants every week.
'use strict';
(function () {
  const D = O.Data, Ch = O.Char;

  function installSim(Sim) {
    const S = Sim.prototype;

    S.lordFamily = function (b, hh, r) {
      const K = this.opts.kingdom || this.kingdom, R = K && K.rulers, place = this.world.placeId;
      const royal = !!b.royal, src = royal ? R && R.crown : R && R.lords && R.lords[place];
      const short = (this.world.name || '').replace(/ Castle$/, '');
      hh.surname = royal ? 'Aurel' : `of ${short}`;
      hh.money = royal ? 20000 : 3000;
      this.households.push(hh); b.household = hh.id; (b.households = b.households || []).push(hh.id);
      const mk = (sex, age, first, extra) => {
        const p = this.newPerson({ sex, age: O.clamp(Math.round(age), 0, 90), first, sur: hh.surname, household: hh.id, home: b.id, genes: Ch.randomGenes(r, this.world.region), wealth: 0.97 });
        p.gentry = true; Object.assign(p, extra || {}); hh.members.push(p.id); return p;
      };
      const headSex = (src && src.sex) || (royal ? 'm' : 'm');
      const head = mk(headSex, src ? src.age : r.int(40, 60), src ? src.name : r.pick(D.NAMES[headSex]),
        royal ? { title: headSex === 'm' ? 'King' : 'Queen', regnal: src && src.regnal, royal: true } : { title: headSex === 'f' ? 'Lady' : 'Lord', lordOf: place });
      const spouseSex = headSex === 'm' ? 'f' : 'm';
      const q = royal && src && src.queen ? src.queen : null;
      const spouse = mk(spouseSex, q ? q.age : head.age + r.int(-6, 4), q ? q.name : r.pick(D.NAMES[spouseSex]),
        royal ? { title: spouseSex === 'f' ? 'Queen' : 'Prince', royal: true } : { title: spouseSex === 'f' ? 'Lady' : 'Lord' });
      head.spouse = spouse.id; spouse.spouse = head.id;
      const kids = [];
      const heir = src && src.heir;
      const kid = (sex, age, first) => { const c = mk(sex, Math.min(age, Math.max(0, Math.min(head.age, spouse.age) - 18)), first, royal ? { title: sex === 'm' ? 'Prince' : 'Princess', royal: true } : {}); c.parents = [head.id, spouse.id]; kids.push(c.id); return c; };
      if (heir) kid(heir.sex, heir.age, heir.name); else kid(r.chance(0.5) ? 'm' : 'f', r.int(4, 20), null);
      if (r.chance(0.7)) { const sx = r.chance(0.5) ? 'm' : 'f'; kid(sx, r.int(2, 16), r.pick(D.NAMES[sx])); }
      for (const id of kids) { const c = this.byId.get(id); if (!c.first) c.first = r.pick(D.NAMES[c.sex]); }
      head.children = kids; spouse.children = kids;
      // a dowager or old uncle lives with the family sometimes
      if (!royal && r.chance(0.35)) { const sx = r.chance(0.6) ? 'f' : 'm'; const e = mk(sx, head.age + r.int(20, 28), r.pick(D.NAMES[sx])); e.elderOf = head.id; }
    };

    const _pop = S.populate;
    S.populate = function () {
      _pop.call(this);
      const r = this.rng, city = this.world.city;
      for (const p of this.people) {
        if (!p.gentry) continue;
        if (p.title) p.name = `${p.title} ${p.first}${p.regnal ? ' ' + p.regnal : ''}`;
        const role = p.royal && (p.title === 'King' || p.title === 'Queen') ? 'royal' : p.age < 13 ? 'child' : 'noble';
        p.app = Ch.makeAppearance(O.hash('person', p.id, p.first), { sex: p.sex, age: p.age, genes: p.genes, role, wealth: 0.97, region: this.world.region });
        p.attitude = Math.max(p.attitude, 0.3);
      }
      // the great houses of the capital belong to knights and their ladies
      if (city) for (const b of this.world.buildings) {
        if (b.type !== 'mansion' || !b.household) continue;
        const hh = this.households.find((h) => h.id === b.household); if (!hh) continue;
        b.name = `${hh.surname} House`;
        for (const id of hh.members) { const p = this.byId.get(id); if (!p || p.age < 18 || (id !== hh.members[0] && p.spouse !== hh.members[0])) continue; if (p.job) continue; p.title = p.sex === 'm' ? 'Sir' : 'Dame'; p.name = `${p.title} ${p.first} ${p.sur}`; { p.gentry = true; p.app = Ch.makeAppearance(O.hash('person', p.id, p.first), { sex: p.sex, age: p.age, genes: p.genes, role: 'noble', wealth: 0.9, region: this.world.region }); } }
      }
      // the castle's servants live in it: the unmarried in rooms of their own on the servants' floor,
      // some of the married with their families in a family room; the rest keep their own houses
      for (const bz of this.biz.values()) {
        if (!bz.b.royal && !bz.b.livesIn) continue;
        const castle = bz.b;
        for (const id of bz.workers.slice()) {
          const p = this.byId.get(id); if (!p || p.gentry) continue;
          const old = this.households.find((h) => h.id === p.household); if (!old || old.home === castle.id) continue;
          const family = old.members.length > 1 && (p.spouse || (p.children || []).length);
          if (!family) {
            old.members = old.members.filter((m) => m !== p.id); if (old.shopper === p.id) old.shopper = old.members.find((m) => (this.byId.get(m)?.age || 0) >= 16) || old.members[0];
            if (!old.members.length) { old.gone = true; const ob = this.building(old.home); if (ob) { ob.households = (ob.households || []).filter((x) => x !== old.id); if (!ob.households.length) ob.vacant = true; } }
            const hh = { id: this.households.length + 1, home: castle.id, members: [p.id], pantry: { bread: 2 }, money: r.int(5, 30), surname: p.sur, servants: true, shopper: p.id };
            this.households.push(hh); (castle.households = castle.households || []).push(hh.id); p.household = hh.id; p.home = castle.id;
          } else if (old.members.length <= 5 && r.chance(0.5)) {
            const ob = this.building(old.home); if (ob) { ob.households = (ob.households || []).filter((x) => x !== old.id); if (!ob.households.length) { ob.vacant = true; if (ob.household === old.id) ob.household = null; } }
            old.home = castle.id; old.servants = true; (castle.households = castle.households || []).push(old.id);
            for (const m of old.members) { const q = this.byId.get(m); if (q) q.home = castle.id; }
          }
        }
      }
      // the estates fund their households
      for (const bz of this.biz.values()) { const k = bz.b.biz || bz.type; if (k === 'palace') bz.cash = 6000; else if (k === 'kitchen') bz.cash = 2000; else if (k === 'keep') bz.cash = 2500; }
      void r;
    };

    const _nd = S.newDay;
    S.newDay = function () {
      _nd.call(this);
      if (this.weekday !== 0) return;
      for (const bz of this.biz.values()) {
        const k = bz.b.biz || bz.type, rent = k === 'palace' ? 450 : k === 'kitchen' ? 220 : k === 'keep' ? 220 : 0;
        if (!rent) continue;
        bz.cash += rent;
        if (k === 'palace') { const K = this.kingdom; if (K && K.treasury > rent) K.treasury -= rent; }
      }
    };
  }

  O.Nobility = { installSim };
})();
