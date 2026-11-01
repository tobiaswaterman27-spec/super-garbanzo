// The farming year. The land has its work for every part of the year, and the farm hands are out at it:
// ploughing and sowing and harrowing in spring, weeding and haymaking in summer, reaping and stooking
// and threshing in autumn, and in winter the pig-killing and then hedging and ditching till the thaw.
// Haycocks stand in the meadows at haymaking and stooks of sheaves in the fields at harvest. You can
// lend a hand for a day's pay. How well the year's work is done tells in the harvest: fields left half
// tended fail more often. When the harvest does fail, whoever governs the town opens the granary to the
// poor or sells the grain dear, and if that's you, you choose. In good years there are more weddings and
// the council builds.
'use strict';
(function () {
  const T = 16;
  const CAL = {
    spring: [[5, 'ploughing', 'hoe'], [10, 'sowing', 'place'], [14, 'harrowing', 'hoe']],
    summer: [[6, 'weeding', 'hoe'], [12, 'haymaking', 'pitch'], [14, 'weeding', 'hoe']],
    autumn: [[8, 'reaping', 'chop'], [9, 'carting the sheaves', 'carry'], [12, 'threshing', 'hammer'], [14, 'ploughing for the winter wheat', 'hoe']],
    winter: [[4, 'the pig-killing', 'cleave'], [14, 'hedging and ditching', 'dig']],
  };
  O.farmTask = (s) => { const d = (s.weather && s.weather.dayOfSeason) || 1; const row = (CAL[s.season] || CAL.summer).find((r) => d <= r[0]); return row ? { name: row[1], anim: row[2] } : null; };
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), SP = O.Sim.prototype;
    const isFarm = (s, p) => { const bz = p.job && s.biz && s.biz.get(p.job.biz); return bz && bz.type === 'farmhouse'; };

    // the right work for the time of year, in the hands
    const _idle = SP.idleAnim;
    SP.idleAnim = function (p) {
      if (p.activity?.act === 'fieldwork') { const t = O.farmTask(this); if (t) return this.season === 'winter' && t.anim === 'dig' && p.id % 2 ? 'chop' : t.anim; }
      return _idle.apply(this, arguments);
    };
    // winter is not idle: the hands go out hedging and ditching unless the weather is foul
    const _plan = SP.plan;
    SP.plan = function (p) {
      const a = _plan.call(this, p);
      if (a && a.act === 'home' && this.season === 'winter' && isFarm(this, p) && p.job.role !== 'farmer' && !this.weather.severe && this.weather.kind !== 'snow') {
        const bz = this.biz.get(p.job.biz), h = this.hour; if (bz.def.hours && h >= bz.def.hours[0] && h < bz.def.hours[1] - 1) return { act: 'fieldwork', outdoor: true, zone: 'farm' };
      }
      return a;
    };
    // the year's work, counted
    const _out = SP.doOutdoor;
    SP.doOutdoor = function (p, act) { if (act && act.act === 'fieldwork' && this.season !== 'winter') this.fieldWork = (this.fieldWork || 0) + 1; return _out.apply(this, arguments); };
    const hands = (s) => s.people.filter((p) => isFarm(s, p) && p.job.role !== 'farmer' && p.alive !== false).length;

    // the harvest: how it goes depends on how the fields were kept
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.weather) return;
      if (s.season === 'autumn' && s.weather.dayOfSeason === 9 && s.hour >= 7.5 && s._harvestRoll !== s.day) {
        s._harvestRoll = s.day; // (the old roll stands aside for this one)
        const need = Math.max(1, hands(s) * 200 * Math.max(1, s.fieldDays || 1)), ratio = s.fieldDays ? O.clamp((s.fieldWork || 0) / need, 0, 2) : 1;
        const p = 0.22 * (ratio < 0.4 ? 2.2 : ratio < 0.75 ? 1.4 : ratio > 1.1 ? 0.6 : 1);
        if (O.RNG(O.hash('harvest', s.world.placeId || 'x', s.day)).chance(p)) {
          s.harvestFailed = s.day; for (const bz of s.biz.values()) for (const g0 of ['wheat', 'flour', 'bread']) if (bz.stock[g0]) bz.stock[g0] = Math.floor(bz.stock[g0] / 3);
          s.log(ratio < 0.75 ? 'The harvest has failed. The fields were not kept as they should have been, and blight and weeds took what the rain left.' : 'The harvest has failed: blight in the wheat and rain at the reaping. Bread is scarce and dear.', 'disaster');
        }
        s.lastHarvestWork = ratio;
      }
    });
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      if (this.season === 'winter' && this.weather.dayOfSeason === 1) { this.fieldWork = 0; this.fieldDays = 0; }
      else if (this.season !== 'winter') this.fieldDays = (this.fieldDays || 0) + 1;
      // the pig-killing: meat salted down for winter
      if (this.season === 'winter' && this.weather.dayOfSeason === 2) { for (const bz of this.biz.values()) if (bz.type === 'farmhouse' || bz.type === 'butcher') bz.stock.meat = (bz.stock.meat || 0) + 6; this.log('It is the pig-killing: the beasts that can\'t be fed through the winter are slaughtered, and the meat salted down.', 'economy'); }
      // a good year: weddings, and the council builds
      if (this.plenty && this.day <= this.plenty.until) { if (this.rng.chance(0.25) && this.matchmake) this.matchmake(); if (this.day === this.plenty.since + 2 && this.build && this.build.council) this.build.council(); }
      return r;
    };

    // the granary in a dearth: opened to the poor, or the grain sold dear
    const granary = (s, open) => {
      const poor = s.households.filter((h) => !h.gone && h.money < 25);
      if (open) { for (const h of poor) { h.pantry.bread = (h.pantry.bread || 0) + 6; } if (s.treasury) s.treasury.cash -= 30; s.dearthEased = true; for (const p of s.people) if (Math.random() < 0.3) s.remember(p, 'The granary was opened to the poor in the dearth. We will not forget it.', 'politics', 1); }
      else { if (s.treasury) s.treasury.cash += 40; for (const p of s.people) if (s.households.includes(s.household(p)) && poor.includes(s.household(p)) && Math.random() < 0.5) s.remember(p, 'The town\'s grain was sold dear while we went hungry.', 'politics', 1.4); }
      const P = s.kingdom && s.kingdom.place ? s.kingdom.place(s.world.placeId) : null; if (P) P.happiness = O.clamp((P.happiness ?? 0.5) + (open ? 0.08 : -0.12), 0, 1);
    };
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.dearth || s.dearth.granary || s.day > s.dearth.since + 2 || game.scene || O.panelOpen || (O.UI.dialogOpen && O.UI.dialogOpen())) return;
      const mine = s.reeveId === 'player' || (O.crowned && O.crowned() && s.world.placeId === 'capital') || (PS.village && PS.village.place === s.world.placeId);
      if (mine) {
        s.dearth.granary = 'asked';
        O.UI.dialog.open({ name: 'The town\'s grain', color: '#7a5a2a', text: 'The harvest has failed and the poor are already going without. The town granary holds what was put by in better years. What will you do with it?', options: [{ key: 'open', label: 'Open the granary to the poor' }, { key: 'sell', label: 'Sell the grain at the dear price' }, { key: 'keep', label: 'Keep it locked against worse to come' }], onPick: (k) => {
          O.UI.dialog.close(); s.dearth.granary = k;
          if (k === 'open') { granary(s, true); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.08); s.log('The granary was opened, and bread given out to the poor.', 'politics'); say('Bread goes out to the poor. They\'ll remember who gave it.'); }
          else if (k === 'sell') { granary(s, false); PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.1); s.log('The town\'s grain was sold at the dear price.', 'politics'); say('The treasury fills. The hungry watch it go.'); }
          else say('The granary stays locked. If it gets worse, there will be something to give.');
        } });
        return;
      }
      const ld = s.byId.get(s.reeveId); if (!ld) { s.dearth.granary = 'none'; return; }
      const open = s.has ? s.has(ld, 'generous') || (!s.has(ld, 'greedy') && Math.random() < 0.5) : Math.random() < 0.5;
      s.dearth.granary = open ? 'open' : 'sell'; granary(s, open);
      s.log(open ? `${ld.name} has opened the granary to the poor.` : `${ld.name} is selling the town's grain at the dear price.`, 'politics');
      s.remember(ld, open ? 'I opened the granary in the dearth.' : 'I sold the grain dear in the dearth. The treasury needed it.', 'politics', 1.2);
    });

    // haycocks and stooks in season
    const mk = (draw, W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d')); return { canvas: c, W, H, ox: W >> 1, oy: H - 1 }; };
    const HAY = mk((x) => { x.fillStyle = '#7a6a30'; x.fillRect(2, 13, 12, 3); for (let y = 0; y < 13; y++) { const w = Math.round(2 + (y / 13) * 5); x.fillStyle = y % 3 ? '#c8b050' : '#a89038'; x.fillRect(8 - w, y + 2, w * 2, 1); } x.fillStyle = '#e0cc70'; x.fillRect(6, 4, 2, 5); }, 16, 16);
    const STOOK = mk((x) => { for (const [dx, lean] of [[3, 1], [7, 0], [11, -1]]) { x.fillStyle = '#b89838'; for (let y = 0; y < 12; y++) x.fillRect(dx + Math.round(lean * (y / 12) * 2), y + 3, 3, 1); x.fillStyle = '#e0c860'; x.fillRect(dx, 2, 3, 3); x.fillStyle = '#8a7028'; x.fillRect(dx, 9, 3, 1); } }, 16, 16);
    let laidDay = -1, laidWorld = null;
    game.hooks.update.push(() => {
      const s = cur(), w = game.world; if (!s || !w || !w.props || game.scene) return; if (laidDay === s.day && laidWorld === w) return; laidDay = s.day; laidWorld = w;
      w.props = w.props.filter((p) => !p.seasonal); const d = s.weather.dayOfSeason;
      const hay = s.season === 'summer' && d >= 8, stooks = s.season === 'autumn' && d >= 2 && d <= 11;
      if (hay) {
        const farms = w.buildings.filter((b) => b.type === 'farmhouse' || b.type === 'barn');
        for (const b of farms) for (let k = 0; k < 6; k++) { const x = b.x - 6 + ((O.hash('hay', b.id, k) >>> 0) % (b.w + 12)), y = b.bottom + 3 + ((O.hash('hay2', b.id, k) >>> 0) % 7); const i = y * w.W + x; if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1 || w.solid[i] || w.ter[i] !== w.TER.GRASS) continue; w.props.push({ kind: 'haycock', x: x * T + 8, y: y * T + 14, seed: 1, v: 0, solid: false, seasonal: true, sprite: HAY }); }
      }
      if (stooks) for (const p of w.props.filter((q) => q.field === 'wheat')) if (((O.hash('stook', Math.round(p.x), Math.round(p.y)) >>> 0) % 9) === 0) w.props.push({ kind: 'stook', x: p.x, y: p.y + 1, seed: 1, v: 0, solid: false, seasonal: true, sprite: STOOK });
      w.dirtyStatics = true;
    });

    // a day's labour on the land
    let stints = { day: -1, n: 0 };
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), P = game.player; if (!s || game.scene || P.locked) return null; const t = O.farmTask(s); if (!t) return null;
      const q = s.people.find((z) => z.activity?.act === 'fieldwork' && !z.agent.hidden && Math.hypot(z.agent.x - P.x, z.agent.y - P.y) < 45); if (!q) return null;
      if (stints.day === s.day && stints.n >= 4) return null; const pay = t.name === 'reaping' || t.name === 'haymaking' ? 4 : 3;
      return { type: 'custom', d: 14, x: q.agent.x, y: q.agent.y - 46, label: `Lend a hand with the ${t.name} (₳${pay})`, act: () => {
        if (stints.day !== s.day) stints = { day: s.day, n: 0 }; stints.n++;
        P.anim = t.anim; P.ft = 0; P.locked = true; O.gesture(q, 'nod', 1.2);
        setTimeout(() => {
          P.locked = false; P.anim = 'idle'; const bz = s.biz.get(q.job.biz); if (bz && bz.cash >= pay) bz.cash -= pay; PS.money += pay;
          PS.energy = Math.max(0, PS.energy - 7); PS.skills.farming = Math.min(1, (PS.skills.farming || 0) + 0.015); s.fieldWork = (s.fieldWork || 0) + 60; s.relate(q, { id: 0 }, 0.03);
          if (O.Hygiene || PS.grime != null) PS.grime = Math.min(1, (PS.grime || 0) + 0.06);
          say(`A stint at the ${t.name} alongside ${q.first}. Your back knows it. (₳${pay})`);
        }, 6500);
      } };
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!isFarm(s, q)) return ''; const t = O.farmTask(s); return t ? `On the land it is the time of ${t.name}, and that is your work these days.${s.lastHarvestWork != null && s.lastHarvestWork < 0.75 ? ' The fields were short of hands this year and it showed in the harvest.' : ''}` : ''; });
  }
  O.FarmYearSetup = { setup };
})();
