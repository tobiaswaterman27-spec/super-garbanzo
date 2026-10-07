// War with the Sea-Lords of Varn, across the northern strait.
//
// Peace can sour into border raids; raids into war, if the castle council votes for it. In war the
// crown musters an army at Highmere and levies men from every place (in Ashford you can watch the
// recruiting sergeant take them, and see the column march down the King's Road); war taxes rise;
// grain is requisitioned; the smiths get crown orders; armies march by road, meet in battle (fought
// in the abstract, reported without gore), besiege, burn and damage roads; refugees flee south. A
// war ends in a treaty that remembers who had the better of it. Ashford's own soldiers come home -
// or don't, and their families are told.
'use strict';
(function () {
  const ENEMY = 'the Sea-Lords of Varn';

  function install(Kingdom) {
    const K = Kingdom.prototype, _daily = K.daily;
    K.daily = function () {
      _daily.call(this);
      try { this.warDaily(); } catch (e) { console.error(e); }
    };

    K.warInit = function () {
      if (!this.war) this.war = { phase: 'peace', since: this.sim.day, enemy: ENEMY, armies: [], battles: [], score: 0, wars: 0, soldiers: [], requisitioned: 0 };
      return this.war;
    };

    K.warDaily = function () {
      const W = this.warInit(), r = this.rng, sim = this.sim, day = sim.day;
      const front = ['ravenscar', 'frostmere'];
      if (W.phase === 'peace') {
        // raids grow likelier the longer the peace and the weaker the north
        const north = this.place('ravenscar');
        if (day - W.since > 12 && r.chance(0.012 + (north.security < 0.5 ? 0.01 : 0))) {
          W.phase = 'tension'; W.since = day;
          north.food = Math.max(0.4, north.food - 0.2); north.happiness = Math.max(0.1, north.happiness - 0.15); north.pop = Math.max(40, north.pop - 6);
          this.addNews(`Riders from ${ENEMY} burned farms near Ravenscar. The north asks the crown for protection.`, 'war', 'ravenscar');
        }
      } else if (W.phase === 'tension') {
        if (r.chance(0.3)) this.addNews(`More raiders were seen in the passes above Ravenscar.`, 'war', 'ravenscar');
        if (day - W.since >= 4) {
          // an emergency council: war or a bought peace
          const PSx = O.PlayerState, mine = PSx && (PSx.reeve || PSx.lord) && PSx.warStance; const hawks = this.places.filter((p) => p.leader && (p.detailed && mine ? PSx.warStance === 'hawk' : (p.priority === 'security' || p.region === 'north' || r.chance(0.4)))).length;
          const leaders = this.places.filter((p) => p.leader).length;
          if (hawks > leaders / 2 && this.treasury > 300) this.declareWar();
          else { W.phase = 'peace'; W.since = day; this.treasury -= Math.min(this.treasury, 200); this.addNews(`The council at Highmere Castle paid ${ENEMY} ₳200 to keep to their side of the mountains.`, 'politics'); }
        }
      } else if (W.phase === 'war') {
        this.warCampaign();
      } else if (W.phase === 'truce' && day - W.since > 20) { W.phase = 'peace'; W.since = day; }
    };

    K.declareWar = function (opts = {}) {
      const W = this.war, sim = this.sim;
      W.enemy = opts.enemy || ENEMY; W.foeHome = opts.home || 'ravenscar'; W.civil = !!opts.civil;
      const FOE = W.enemy, fh = W.foeHome;
      W.phase = 'war'; W.since = sim.day; W.wars++; W.score = 0; W.battles = []; W.taxBefore = this.taxRate;
      this.taxRate = Math.min(0.2, this.taxRate + 0.04);
      W.levyFrom = {}; const levy = this.places.filter((p) => !p.detailed).reduce((s, p) => { const n = Math.round(p.pop * 0.02); p.pop -= n; W.levyFrom[p.id] = n; return s + n; }, 0); W.raised = 310 + levy;
      W.armies = [
        { id: 1, side: 'crown', name: opts.crownName || "the King's host", men: 220 + levy, at: 'highmere', path: ['highmere', 'frostmere', fh], morale: 0.7 },
        { id: 2, side: 'enemy', name: opts.hostName || `the host of ${FOE}`, men: (opts.men || 290) + this.rng.int(0, 180), at: fh, path: [fh, 'frostmere', 'highmere'], morale: 0.7, wait: 2 },
        { id: 3, side: 'crown', name: 'the Aurelia levy', men: 90, at: 'aurelia', path: ['aurelia', 'ashford', 'frostmere'], morale: 0.6 },
      ];
      this.addNews(opts.announce || `WAR. The castle council has declared war on ${FOE}. The King's host musters at Highmere and every town must send men.`, 'war');
      this.addNews(`The crown tax is raised to ${Math.round(this.taxRate * 100)}% to pay for the war.`, 'politics');
      sim.onWar && sim.onWar('declared');
    };

    K.warCampaign = function () {
      const W = this.war, r = this.rng, sim = this.sim;
      // requisitions every third day: the army eats
      if ((sim.day - W.since) % 3 === 1) {
        for (const p of this.places) if (!p.detailed) { const take = Math.round(p.stock.grain * 0.12); p.stock.grain -= take; W.requisitioned += take; }
        const farm = sim.supplierOf && sim.supplierOf('farmhouse'); if (farm) { const t = Math.round((farm.stock.wheat || 0) * 0.15); farm.stock.wheat -= t; farm.cash += Math.round(t * 1.2); }
        this.addNews(`The crown's purveyors took grain from every barn for the army, paying in promises.`, 'war');
      }
      // fresh men: the Marchers bring more over the passes, the crown levies again
      if ((sim.day - W.since) % 6 === 5) {
        const foe = W.armies.find((a) => a.side === 'enemy'), host = W.armies.find((a) => a.side === 'crown');
        if (foe && W.score > -3) { foe.men += 50 + r.int(0, 60); foe.morale = Math.min(1, foe.morale + 0.05); }
        if (host) { W.levyFrom = W.levyFrom || {}; const add = this.places.filter((p) => !p.detailed).reduce((s, p) => { const n = Math.round(p.pop * 0.008); p.pop -= n; W.levyFrom[p.id] = (W.levyFrom[p.id] || 0) + n; return s + n; }, 0); host.men += add; W.raised = (W.raised || 310) + add; this.addNews(`A second levy of ${add} men has gone north to join the King's host.`, 'war'); }
      }
      // armies march toward each other by road; a host never marches away from a foe in its own camp
      const alive = () => W.armies.filter((x) => x.men > 0);
      const path = (from, to) => { if (from === to) return [from]; const prev = { [from]: null }, q = [from]; while (q.length) { const c = q.shift(); if (c === to) break; for (const n of this.neighbours(c)) if (!(n in prev)) { prev[n] = c; q.push(n); } } if (!(to in prev)) return null; const out = []; for (let c = to; c; c = prev[c]) out.unshift(c); return out; };
      const near = (a, side) => alive().filter((x) => x.side === side).map((x) => ({ x, d: (path(a.at, x.at) || []).length })).sort((p1, p2) => p1.d - p2.d)[0]?.x;
      for (const a of alive()) {
        if (a.wait) { a.wait--; continue; }
        if (alive().some((x) => x.side !== a.side && x.at === a.at)) continue;
        let target;
        if (a.side === 'crown') target = a.id === 3 && a.at !== 'frostmere' && !a.joined ? 'frostmere' : near(a, 'enemy')?.at || W.foeHome || 'ravenscar';
        else target = (near(a, 'crown') && W.score >= 0) ? near(a, 'crown').at : 'highmere';
        const rt = path(a.at, target); if (!rt || rt.length < 2 || !r.chance(0.6)) continue;
        const from = a.at, next = rt[1];
        if (next === 'ashford' || from === 'ashford') sim.onArmyPasses && sim.onArmyPasses(a);
        a.at = next;
        if (a.side === 'enemy' && !alive().some((x) => x.side === 'crown' && x.at === next)) {
          const pl = this.place(next); pl.happiness = Math.max(0.05, pl.happiness - 0.2); pl.food = Math.max(0.3, pl.food - 0.3); const lost = Math.round(pl.pop * 0.05); pl.pop -= lost;
          const rd = this.road(from, next); if (rd && r.chance(0.5)) rd.damaged = true;
          this.addNews(`${cap(a.name)} has fallen on ${pl.name}. Barns burn; ${lost} families have fled south.${rd && rd.damaged ? ` The road from ${this.place(from).name} is cut.` : ''}`, 'war', next);
          if (sim.refugees) sim.refugees(Math.max(1, Math.round(lost / 12)), pl.name);
        }
      }
      // crown hosts that meet join together
      for (const a of alive().filter((x) => x.side === 'crown')) for (const b of alive().filter((x) => x.side === 'crown' && x !== a && x.at === a.at)) { if (a.men >= b.men) { a.men += b.men; b.men = 0; b.joined = true; this.addNews(`${cap(b.name)} has joined ${a.name} at ${this.place(a.at).name}.`, 'war'); } }
      // battles where the hosts meet
      const places = new Set(W.armies.filter((a) => a.men > 0).map((a) => a.at));
      for (const at of places) {
        const crown = W.armies.filter((a) => a.at === at && a.side === 'crown' && a.men > 0), foe = W.armies.filter((a) => a.at === at && a.side === 'enemy' && a.men > 0);
        if (!crown.length || !foe.length) continue;
        const cs = crown.reduce((s, a) => s + a.men * a.morale, 0) * r.float(0.75, 1.25), fs = foe.reduce((s, a) => s + a.men * a.morale, 0) * r.float(0.75, 1.25);
        const crownWins = cs >= fs, pl = this.place(at);
        const lossC = Math.round(crown.reduce((s, a) => s + a.men, 0) * (crownWins ? 0.08 : 0.2)), lossF = Math.round(foe.reduce((s, a) => s + a.men, 0) * (crownWins ? 0.22 : 0.07));
        for (const a of crown) { a.men = Math.max(0, a.men - Math.round(lossC * (a.men / crown.reduce((s, b) => s + b.men, 1)))); a.morale = O.clamp(a.morale + (crownWins ? 0.1 : -0.15), 0.2, 1); }
        for (const a of foe) { a.men = Math.max(0, a.men - Math.round(lossF * (a.men / foe.reduce((s, b) => s + b.men, 1)))); a.morale = O.clamp(a.morale + (crownWins ? -0.15 : 0.1), 0.2, 1); }
        W.score += crownWins ? 1 : -1;
        const b = { day: sim.day, at, crownWins, lossC, lossF }; W.battles.push(b);
        // the loser falls back along its road
        for (const a of crownWins ? foe : crown) { const home = a.side === 'crown' ? 'highmere' : W.foeHome || 'ravenscar'; const rt = (() => { const prev = { [a.at]: null }, q = [a.at]; while (q.length) { const c = q.shift(); if (c === home) break; for (const n of this.neighbours(c)) if (!(n in prev)) { prev[n] = c; q.push(n); } } const out = []; for (let c = home; c && c in prev; c = prev[c]) out.unshift(c); return out; })(); if (rt.length > 1) a.at = rt[1]; a.wait = 2; }
        for (const a of crownWins ? crown : foe) a.wait = 1;
        if (!crownWins && at !== (W.foeHome || 'ravenscar')) { const pl = this.place(at); pl.happiness = Math.max(0.05, pl.happiness - 0.15); }
        this.addNews(crownWins ? `Victory at ${pl.name}! ${cap(crown[0].name)} drove off ${foe[0].name}. ${lossC} of the King's men will not come home.` : `Defeat at ${pl.name}. ${cap(crown[0].name)} gave way before ${foe[0].name}; ${lossC} of the King's men fell.`, 'war', at);
        sim.onBattle && sim.onBattle(b);
      }
      // the end: a decisive edge, exhaustion, or a long stalemate
      const crownMen = W.armies.filter((a) => a.side === 'crown').reduce((s, a) => s + a.men, 0), foeMen = W.armies.filter((a) => a.side === 'enemy').reduce((s, a) => s + a.men, 0);
      const long = sim.day - W.since > 32;
      if (W.score >= 4 || foeMen < 60 || W.score <= -4 || crownMen < 60 || long) this.makePeace(W.score > 0 || foeMen < 80 ? 'crown' : W.score < 0 || crownMen < 80 ? 'enemy' : 'none');
    };

    K.makePeace = function (winner) {
      const W = this.war, sim = this.sim;
      // the men who lived through it walk home to the towns that sent them
      { const alive = W.armies.filter((a) => a.side === 'crown').reduce((t, a) => t + a.men, 0), frac = O.clamp(alive / Math.max(1, W.raised || 1), 0, 1);
        let home = 0; for (const [id, n] of Object.entries(W.levyFrom || {})) { const pl = this.place(id), k = Math.round(n * frac); if (pl && !pl.detailed && k) { pl.pop += k; home += k; } } W.levyFrom = {}; W.raised = 0;
        if (home > 20) this.addNews(`${home} levied men are walking home from the war to their own towns and villages.`, 'war'); }
      W.phase = 'truce'; W.since = sim.day; W.winner = winner; W.armies = [];
      this.taxRate = winner === 'enemy' ? Math.min(0.2, (W.taxBefore || 0.08) + 0.03) : (W.taxBefore || 0.08);
      if (W.civil) { W.enemy = ENEMY; W.foeHome = 'ravenscar'; W.civil = false; this.taxRate = W.taxBefore || 0.08; this.onCivilEnd && this.onCivilEnd(winner); sim.onWar && sim.onWar('peace', winner); return; }
      if (winner === 'crown') { this.treasury += 300; this.addNews(`PEACE. ${cap(W.enemy)} have sued for peace and paid tribute. The Treaty of Highmere is sealed; bells ring in every town.`, 'war'); }
      else if (winner === 'enemy') { this.treasury = Math.max(0, this.treasury - 400); const g = this.place('ravenscar'); g.wealth = Math.max(0.05, g.wealth - 0.15); this.addNews(`PEACE, of a kind. The crown has bought an end to the war with gold and the northern pastures. The war tax stays.`, 'war'); }
      else this.addNews(`Both hosts are spent. A truce is agreed at Frostmere and the men are sent home.`, 'war');
      sim.onWar && sim.onWar('peace', winner);
    };
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------------------------------------------------------------- the detailed village at war
  function installSim(Sim) {
    const S = Sim.prototype;
    // Ashford's men: the sergeant takes the jobless and the young first; volunteers for the pay
    S.levyMen = function (n) {
      const cands = this.people.filter((p) => !p.visitor && p.sex === 'm' && p.age >= 17 && p.age <= 40 && !p.job?.role?.startsWith('guard') && !(this.biz.get(p.job?.biz)?.owner === p.id) && !p.title && p.health.state !== 'ill')
        .sort((a, b) => (a.job ? 1 : 0) - (b.job ? 1 : 0) || (a.spouse ? 1 : 0) - (b.spouse ? 1 : 0) || a.age - b.age);
      const taken = cands.slice(0, n), K = this.kingdom; const W = K.warInit();
      for (const p of taken) {
        if (p.job?.biz) { const bz = this.biz.get(p.job.biz); if (bz) bz.workers = bz.workers.filter((id) => id !== p.id); }
        p.job = null; p.task = { act: 'leave', outdoor: true, emigrating: true, toWar: true };
        this.remember(p, `I've taken the King's coin. We march north.`, 'life', 3);
        for (const id of this.household(p).members) { const q = this.byId.get(id); if (q && q !== p) this.remember(q, `${p.first} has gone to the war.`, 'grief', 2.5, p.id); }
        W.soldiers.push({ id: p.id, name: p.name, household: p.household, home: p.home, left: this.day, snap: p }); // kept aside, not forgotten
        this.household(p).money += 12; // the coin goes to the family
      }
      if (taken.length) this.log(`The recruiting sergeant took ${taken.length} of ${this.world.name}'s men for the King's host: ${taken.map((p) => p.first).join(', ')}.`, 'war');
      return taken;
    };
    S.onBattle = function (b) {
      const W = this.kingdom.war;
      for (const s of W.soldiers) {
        if (s.dead || s.back || !s.snap) continue;
        if (this.rng.chance(b.crownWins ? 0.06 : 0.16)) {
          s.dead = { day: this.day, at: this.kingdom.place(b.at).name };
          for (const id of (this.households[s.household - 1]?.members || [])) { const q = this.byId.get(id); if (q) { q.mood -= 0.4; this.remember(q, `A letter came: ${s.name} fell at ${s.dead.at}.`, 'grief', 3.5); } }
          this.log(`Word came to ${this.world.name} that ${s.name} fell in the fighting at ${s.dead.at}.`, 'war');
          (this.graves = this.graves || []).push({ name: s.name, born: this.day - (s.snap.age || 25) * 56, died: this.day, age: s.snap.age || 25, cause: `fell at ${s.dead.at}, far from home` });
          this.onGrave && this.onGrave(s.snap);
        } else if (this.rng.chance(0.08)) s.wounded = true;
      }
    };
    // soldiers come home after the peace
    S.soldiersReturn = function () {
      const W = this.kingdom.war; if (!W) return;
      for (const s of W.soldiers) {
        if (s.dead || s.back || !s.snap) continue;
        const hh = this.households[s.household - 1]; if (!hh || hh.gone) { s.back = 'no home'; continue; }
        const p = s.snap; s.back = this.day;
        p.task = null; p.alive = true; p.home = hh.home; p.household = hh.id;
        if (!(p.rel instanceof Map)) p.rel = new Map((p.rel || []).map(([id, a, f]) => [id, { affinity: a, familiar: f }]));
        if (!p.app) { p.agent = { a: null }; this.refreshLook(p); }
        p.agent = { x: this.Z.east[0] * this.T, y: this.Z.east[1] * this.T, dir: 1, anim: 'walk', ft: 0, a: p.app, hidden: false, inside: null, path: null, goal: null, person: p };
        if (!hh.members.includes(p.id)) hh.members.push(p.id);
        this.people.push(p); this.byId.set(p.id, p);
        if (s.wounded) { p.health.illness = { kind: 'injury', sev: 0.5, days: 0 }; p.health.state = 'ill'; }
        this.remember(p, `Home from the war${s.wounded ? ', with a wound that aches when it rains' : ''}. I'll not speak of what I saw.`, 'life', 3);
        for (const id of hh.members) { const q = this.byId.get(id); if (q && q !== p) { q.mood += 0.3; this.remember(q, `${p.first} came home from the war!`, 'life', 3, p.id); } }
      }
      const back = W.soldiers.filter((s) => s.back === this.day).length;
      if (back) this.log(`${back} of ${this.world.name}'s soldiers came home from the war.`, 'war');
    };
    // the levy: a recruiting sergeant spends a day in the square, then marches off with the men
    S.onWar = function (what) { if (what === 'declared') this.levyDay = this.day + 1; else this.returnDay = this.day + 2; };
    const _mt = S.minuteTick;
    S.minuteTick = function () {
      _mt.call(this);
      const mm = this._m;
      if (this.levyDay === this.day && mm === 8 * 60) this.sergeantArrives();
      if (this.levyDay === this.day && mm === 16 * 60) {
        this.levyMen(this.rng.int(2, 4));
        if (this.sergeant) { this.sergeant.task = { act: 'leave', outdoor: true, emigrating: true }; this.sergeant = null; }
        this.levyDay = null;
      }
      if (this.returnDay === this.day && mm === 11 * 60) { this.soldiersReturn(); this.returnDay = null; }
      const W = this.kingdom && this.kingdom.war;
      if (W && W.phase === 'war' && W.civil && mm === 19 * 60 && !this.rebelAgent && this.tavernId && this.rng.chance(0.5)) {
        const r = this.rng, D = O.Data, Ch = O.Char;
        const p = this.newPerson({ sex: 'm', age: r.int(24, 45), first: r.pick(D.NAMES.m), sur: r.pick(D.NAMES.sur), household: 0, home: null, genes: Ch.randomGenes(r, 'north'), wealth: 0.5, visitor: true });
        p.name = `${p.first} ${p.sur}`; p.job = { biz: null, role: 'rebel agent' }; p.wake = 0; p.bed = 1440;
        p.app = Ch.makeAppearance(O.hash('rebel', p.id), { sex: 'm', age: p.age, genes: p.genes, role: 'outlaw', wealth: 0.4 });
        const E = this.Z.east; p.agent = { x: E[0] * this.T, y: E[1] * this.T, dir: 1, anim: 'walk', ft: 0, a: p.app, hidden: false, inside: null, path: null, goal: null, person: p };
        p.task = { act: 'socialise', b: this.tavernId }; this.rebelAgent = p;
      }
      if (this.rebelAgent && (mm === 23 * 60 || !(W && W.phase === 'war' && W.civil))) { this.rebelAgent.task = { act: 'leave', outdoor: true, emigrating: true }; this.rebelAgent = null; }
    };
    S.sergeantArrives = function () {
      const r = this.rng, D = O.Data, Ch = O.Char;
      const p = this.newPerson({ sex: 'm', age: r.int(30, 48), first: r.pick(D.NAMES.m), sur: r.pick(D.NAMES.sur), household: 0, home: null, genes: Ch.randomGenes(r, 'east'), wealth: 0.5, visitor: true });
      p.name = `Sergeant ${p.first} ${p.sur}`; p.title = "recruiting sergeant of the King's host"; p.job = { biz: null, role: 'recruiting sergeant' }; p.wake = 0; p.bed = 1440;
      p.app = Ch.makeAppearance(O.hash('sergeant', p.id), { sex: 'm', age: p.age, genes: p.genes, role: 'guard', wealth: 0.6 });
      const E = this.Z.east;
      p.agent = { x: E[0] * this.T, y: E[1] * this.T, dir: 1, anim: 'walk', ft: 0, a: p.app, hidden: false, inside: null, path: null, goal: null, person: p };
      p.task = { act: 'recruit', outdoor: true, zone: 'square' };
      this.sergeant = p;
      this.log(`A recruiting sergeant of the King's host has come to ${this.world.name}, calling for men.`, 'war');
    };
    // the crown's war levy on the parish chest, weekly
    S.warLevy = function () {
      const W = this.kingdom.war; if (!W || W.phase !== 'war' || this.weekday !== 0) return;
      const take = Math.min(40, Math.floor(this.treasury.cash * 0.25)); if (take <= 0) return;
      this.treasury.cash -= take; this.kingdom.treasury += take;
      this.log(`The crown's war levy took ₳${take} from ${this.world.name}'s common chest.`, 'politics');
    };
    // refugees from the north
    S.refugees = function (n, from) {
      let came = 0;
      for (let i = 0; i < n; i++) {
        const b = this.world.buildings.find((x) => x.type === 'house' && !x.household && !x.site); if (!b) break;
        const before = this.households.length; this.immigrate(b); const hh = this.households[before]; if (!hh) continue;
        hh.money = this.rng.int(4, 25); hh.refugees = from; came++;
        for (const id of hh.members) { const q = this.byId.get(id); if (q && q.age >= 8) this.remember(q, `We fled ${from} when the raiders came. We have nothing left.`, 'hardship', 3); }
      }
      this.log(came ? `Refugees from ${from} have reached ${this.world.name}: ${came} famil${came === 1 ? 'y' : 'ies'} with what they could carry.` : `Refugees from ${from} passed through ${this.world.name}, finding no empty house.`, 'war');
    };
    // crown orders keep the smiths busy
    S.warOrders = function () {
      const W = this.kingdom.war; if (!W || W.phase !== 'war') return;
      this.warLevy();
      for (const bz of this.biz.values()) {
        if (!['smithy', 'armourer'].includes(bz.type)) continue;
        let paid = 0;
        for (const g of ['dagger', 'axe', 'sword', 'helm', 'tools']) { const n = Math.floor((bz.stock[g] || 0) * 0.6); if (n < 1) continue; const pr = Math.round(O.Data.GOODS[g].base * 1.5) * n; bz.stock[g] -= n; bz.cash += pr; paid += pr; }
        if (paid && this.rng.chance(0.4)) this.log(`The crown's quartermaster bought arms from ${bz.name} for ₳${paid}.`, 'war');
      }
    };
  }

  O.War = { install, installSim, ENEMY };
  install(O.Kingdom);
})();
