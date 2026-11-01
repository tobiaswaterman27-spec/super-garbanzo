// A house of your own, built your way. Stand on open ground and mark out a plot: a cottage, a house, a
// long house or a house of two storeys. In a town the parish sells you the ground; out on the common waste
// it costs nothing, though the lord's steward will want a ground rent once it stands. Then choose how it's
// built: the builder's yard does it all for one price; or you bring the timber and stone yourself and pay
// builders by the day; or you build it with your own hands. Every stage needs its materials on site, and
// you can see each one go up. When it stands, furnish it room by room with what you buy and set down.
'use strict';
(function () {
  const T = 16;
  const SIZES = [
    { key: 'cottage', label: 'A cottage', w: 4, d: 3, floors: 1, land: 30, all: 140 },
    { key: 'house', label: 'A house', w: 5, d: 4, floors: 1, land: 45, all: 220 },
    { key: 'long', label: 'A long house', w: 7, d: 4, floors: 1, land: 65, all: 300 },
    { key: 'tall', label: 'A house of two storeys', w: 5, d: 4, floors: 2, land: 50, all: 340 },
  ];
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS, esc = (t) => O.escape(String(t));
    const builds = () => (PS.homeBuilds = PS.homeBuilds || []);
    // the plots you mark out: numbered from 2000 so they never clash with the town's own
    const proto = O.Construction && O.Construction.prototype;
    if (proto) { const _plot = proto.plot; proto.plot = function (i) { if (i >= 2000) { const h = builds()[i - 2000]; if (h) return h.plot; } return _plot.call(this, i); }; }
    const inTown = (w, tx, ty) => w.ox != null && tx >= w.ox - 2 && tx < w.ox + w.townW + 2 && ty >= w.oy - 2 && ty < w.oy + w.townH + 2;
    const siteOf = (s, h) => s.build && s.build.sites.find((x) => x.id === h.siteId);
    // can a plot go here: open ground, no building near, no road or water
    function fits(w, x, bottom, bw, bd) {
      for (let yy = bottom - bd - 1; yy <= bottom + 2; yy++) for (let xx = x - 1; xx <= x + bw; xx++) {
        if (xx < 1 || yy < 1 || xx >= w.W - 1 || yy >= w.H - 1) return false; const t = w.ter[yy * w.W + xx];
        if (t === w.TER.WATER || t === w.TER.ROAD || t === w.TER.COBBLE || t === w.TER.BRIDGE) return false;
      }
      for (const b of w.buildings) if (!(x + bw + 1 <= b.x || x - 1 >= b.x + b.w || bottom + 2 <= b.y || bottom - bd - 1 >= b.bottom)) return false;
      return true;
    }

    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), w = game.world, P = game.player; if (!s || game.scene || P.locked || !w.ter || !s.build) return null;
      if (builds().some((h) => h.place === w.placeId && !h.done)) return null;
      const tx = Math.floor(P.x / T), ty = Math.floor(P.y / T); if (!fits(w, tx - 2, ty - 2, 4, 3)) return null;
      return { type: 'custom', d: 30, x: P.x, y: P.y - 44, label: 'Mark out a plot for a house of your own', act: () => planPanel(s, w, tx, ty) };
    });
    function planPanel(s, w, tx, ty) {
      const town = inTown(w, tx, ty);
      const opts = SIZES.map((z, i) => { const x = tx - Math.floor(z.w / 2), bottom = ty - 2; return { z, i, x, bottom, ok: fits(w, x, bottom, z.w, z.d) }; });
      O.Panels.open('A house of your own', `<p>${town ? `This ground is in ${esc(s.world.name)}: the parish will sell it to you.` : 'This is common waste, nobody\'s land. It costs nothing to build here, but the lord\'s steward will want ground rent once a house stands.'}</p>
        <table><tbody>${opts.map((o) => `<tr><td>${o.z.label}<br><small class="lbl">${o.z.w}×${o.z.d} tiles${o.z.floors > 1 ? ', two floors' : ''}</small></td><td>${o.ok ? `<button data-size="${o.i}">${town ? 'Buy the ground · ' + O.money(o.z.land) : 'Mark it out'}</button>` : '<small class="lbl">no room here</small>'}</td></tr>`).join('')}</tbody></table>`, (r) => {
        r.querySelectorAll('[data-size]').forEach((bt) => bt.onclick = () => {
          const o = opts[+bt.dataset.size], land = town ? o.z.land : 0; if (PS.money < land) return O.Panels.toast(`The ground is ${O.money(land)}.`, 'bad');
          PS.money -= land; if (land && s.treasury) { s.treasury.cash += land; s.treasury.income = (s.treasury.income || 0) + land; }
          const h = { place: w.placeId, size: o.z.key, plot: [o.x, o.bottom, o.z.w, o.z.d], floors: o.z.floors, town, siteId: null, done: false, mode: null, day: s.day };
          builds().push(h); O.Panels.close(); howPanel(s, h);
        });
      });
    }
    function howPanel(s, h) {
      const z = SIZES.find((x) => x.key === h.size);
      O.Panels.open('How will it be built?', `<p>Every stage needs its timber and stone on site before work can go on.</p>
        <div class="topics" style="flex-direction:column;align-items:stretch">
          <button data-how="all">The builder's yard does it all · ${O.money(z.all)}</button>
          <button data-how="hire">Your own materials, builders paid by the day · ${O.money(40)} to start</button>
          <button data-how="self">With your own hands, and your own materials · free</button></div>`, (r) => {
        r.querySelectorAll('[data-how]').forEach((bt) => bt.onclick = () => {
          const k = bt.dataset.how, cost = k === 'all' ? z.all : k === 'hire' ? 40 : 0; if (PS.money < cost) return O.Panels.toast(`You need ${O.money(cost)}.`, 'bad');
          PS.money -= cost; O.Panels.close(); begin(s, h, k, cost);
        });
      });
    }
    function begin(s, h, mode, cost) {
      const i = builds().indexOf(h), site = s.build.start(2000 + i, cost, { player: true }); if (!site) return say('The ground can\'t be built on after all.', 'bad');
      h.siteId = site.id; h.mode = mode; const b = site.b, bz = s.biz.get(site.id);
      if (h.floors > 1) { b.floors = 2; b.spec.floors = 2; site.skip = s.build.skipFor(b); b.dirty = true; }
      b.name = 'Your house (building)'; b.owner = { kind: 'player' };
      if (mode !== 'all' && bz) { bz.def = Object.assign({}, bz.def, { buys: {} }); bz.stock.logs = 0; bz.stock.stone = 0; }
      if (mode === 'self' && bz) for (const id of [...bz.workers]) release(s, bz, id);
      O.addLead && O.addLead({ id: 'house' + site.id, place: s.world.placeId, x: (b.x + b.w / 2) * T, y: (b.bottom + 1) * T, label: 'Your house site', why: 'house' });
      say(mode === 'all' ? 'The builder\'s yard sends its men, and the first carts of timber come up the road.' : mode === 'hire' ? 'Builders are hired. Bring timber (logs) and stone to the site for each stage.' : 'The ground is yours to build on. Bring logs and stone, and set to work.');
    }
    // a new house stands empty: only the hearth and the stairs are built in; the rest is yours to bring
    function bare(s, b) { b.bare = true; try { O.Interior.invalidate(b); } catch (e) { console.error(e); } }
    function release(s, bz, id) { const p = s.byId.get(id); bz.workers = bz.workers.filter((x) => x !== id); if (!p) return; const yard = p.job?.yard && s.biz.get(p.job.yard); if (yard) { p.job = { biz: yard.id, role: p.job.yardRole || 'builder' }; yard.workers.push(p.id); } else p.job = null; }

    // at the site: bring materials, pay the builders, or work on it yourself
    O.moreCandidates.push(() => {
      const s = cur(), P = game.player; if (!s || game.scene || P.locked || !s.build) return null;
      for (const h of builds()) {
        if (h.done || h.place !== s.world.placeId) continue; const site = siteOf(s, h); if (!site) continue; const b = site.b, bz = s.biz.get(site.id);
        if (Math.hypot((b.x + b.w / 2) * T - P.x, (b.bottom + 1) * T - P.y) > 70) continue;
        const logs = PS.count ? PS.count('logs') : 0, stone = PS.count ? PS.count('stone') : 0;
        if (bz && (logs || stone) && h.mode !== 'all') return { type: 'custom', d: 6, x: P.x, y: P.y - 46, label: `Unload ${[logs ? logs + ' logs' : '', stone ? stone + ' stone' : ''].filter(Boolean).join(' and ')} at the site`, act: () => { P.anim = 'place'; P.locked = true; setTimeout(() => { P.locked = false; P.anim = 'idle'; PS.remove('logs', logs); PS.remove('stone', stone); bz.stock.logs = (bz.stock.logs || 0) + logs; bz.stock.stone = (bz.stock.stone || 0) + stone; say(`Stacked at the site. It now holds ${bz.stock.logs} logs and ${bz.stock.stone} stone.`); }, 1400); } };
        if (bz && h.mode === 'hire' && bz.cash < 7 * Math.max(1, bz.workers.length)) return { type: 'custom', d: 8, x: P.x, y: P.y - 46, label: `Pay the builders for the days ahead (${O.money(35)})`, act: () => { if (PS.money < 35) return say('You haven\'t the money.', 'bad'); PS.money -= 35; bz.cash += 35; P.anim = 'count'; setTimeout(() => { P.anim = 'idle'; }, 1200); say('The builders are paid ahead. Work goes on.'); } };
        if (bz && site.stage < 10) return { type: 'custom', d: 10, x: P.x, y: P.y - 46, label: `Work on your house (${O.STAGES ? O.STAGES[site.stage].toLowerCase() : 'building'})`, act: () => {
          P.anim = site.stage <= 2 ? 'dig' : site.stage === 8 || site.stage === 9 ? 'scrub' : 'hammer'; P.ft = 0; P.locked = true;
          setTimeout(() => {
            P.locked = false; P.anim = 'idle'; const me = { skills: { builder: Math.max(0.3, PS.skills.building || 0.3) } }, before = site.stage;
            for (let k = 0; k < 40 && site.stage === before; k++) s.build.work(me, bz);
            PS.skills.building = Math.min(1, (PS.skills.building || 0.3) + 0.01); PS.energy = Math.max(0, PS.energy - 6); PS.grime = Math.min(1, (PS.grime || 0) + 0.04);
            if (site.stalled === site.stage && site.prog === 0) say(`Nothing more can be done: this stage wants ${Object.entries(O.constructionNeeds ? O.constructionNeeds(site.stage) : {}).map(([g, q]) => q + ' ' + g).join(' and ') || 'materials'} on site.`, 'bad');
            else say(site.stage > before ? `${O.STAGES[before]} is done. Next: ${O.STAGES[site.stage].toLowerCase()}.` : `A good stint. ${O.STAGES[site.stage]}: ${Math.round(site.prog * 100)}%.`);
          }, 6000);
        } };
      }
      return null;
    });
    // the builders go home unpaid when the money runs out; the house is done; ground rent on the waste
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      for (const h of builds()) {
        if (h.place !== this.world.placeId) continue; const site = siteOf(this, h);
        if (!h.done && (!site || site.stage >= 10)) { const b = this.world.buildings.find((x) => x.id === h.siteId); if (b) { h.done = true; b.name = 'Your house'; b.owner = { kind: 'player' }; bare(this, b); O.dropLead && O.dropLead((l) => l.id === 'house' + h.siteId); if (this === cur()) say('Your house is finished. Furnish it as you like: buy beds, tables and chests, and set them down inside.'); } continue; }
        const bz = site && this.biz.get(site.id);
        if (bz && h.mode === 'hire' && bz.cash < 5 && bz.workers.length) { for (const id of [...bz.workers]) release(this, bz, id); this.log('The builders on the newcomer\'s house have gone home: there is no money to pay them.', 'construction'); if (this === cur()) say('Your builders have gone: there was no money left to pay them. Pay them again at the site to bring them back.', 'bad'); }
        if (bz && h.mode === 'hire' && bz.cash >= 21 && !bz.workers.length) { const idle = this.people.filter((p) => !p.visitor && !p.gentry && p.age >= 17 && p.age < 60 && !p.job).slice(0, 2); for (const p of idle) { p.job = { biz: bz.id, role: 'builder' }; bz.workers.push(p.id); } }
        if (h.done && !h.town && this.weather.dayOfSeason === 1) { const rent = 3; if (PS.money >= rent) { PS.money -= rent; if (this === cur()) say(`The lord's steward comes for the ground rent on your house on the waste: ${O.money(rent)}.`); } }
      }
      return r;
    };
    (O.extraLines = O.extraLines || []).push((s, q) => q.job && s.biz.get(q.job.biz)?.type === 'site' && builds().some((h) => h.siteId === q.job.biz) ? 'You are building the player\'s own house. You know which stage it is at and what it lacks.' : '');
  }
  O.HouseBuildSetup = { setup };
})();
