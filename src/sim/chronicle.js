// History, news and belief.
//
// The Chronicle keeps the world's facts: what actually happened, where and when, how much it
// mattered, and whether the player had a hand in it. Facts come from everything the simulations log
// (classified into rulers, politics, roads, markets, harvests, disasters, businesses, gangs, crimes,
// deaths and people) plus explicit records for the player's deeds and notable deaths.
//
// What people *believe* is stored separately. Each NPC keeps a short list of things they have heard
// (p.heard), each with the version they were told and where it came from. Every source tells a story
// its own way: the crier gives the council's line, the watch writes terse reports, bards inflate
// numbers and make legends, the city broadsheet shouts, travelling merchants muddle places, and
// rumour passed over a jug swaps names and loses detail. The player collects versions too.
'use strict';
(function () {
  const YEAR_DAYS = () => O.SEASON_DAYS * 4;
  const CATS = {
    rulers: 'Rulers', politics: 'Politics', roads: 'Roads & bridges', markets: 'Markets', harvest: 'Harvests', disaster: 'Disasters',
    war: 'Wars', business: 'Trades', gang: 'Gangs', crime: 'Crimes', death: 'Deaths', people: 'People', player: 'Your deeds',
  };
  // order matters: the first match wins
  const RULES = [
    [/\bwar\b|the king's host|battle|victory at|defeat at|treaty|truce|raiders|marcher lords|recruiting sergeant|fell in the fighting|soldiers came home|refugees/i, 'war', 3],
    [/caravan.*(robbed|attacked|plunder)|bandit|highway/i, 'crime', 3],
    [/harvest (has )?failed|famine|starv/i, 'harvest', 4],
    [/harvest festival|harvest is in|bumper|reaped/i, 'harvest', 2],
    [/road.*(wash|damag|impassable|repair|mend)|bridge (is|was|has)/i, 'roads', 2],
    [/made lord|new lord|lordship|leader of|elected|reeve of/i, 'rulers', 4],
    [/council|tax|pardon|watchm|men-at-arms|bounty|banished|levy/i, 'politics', 2],
    [/storm|flood|fire broke|first snow|blizzard|plague|outbreak|epidemic|fever is spreading|sickness/i, 'disaster', 2],
    [/has opened|has closed its doors|reopened|no heir|without a master/i, 'business', 2],
    [/is growing|in decline|market hall|shops stand empty/i, 'markets', 2],
    [/\bgang\b|crows|hideout|safehouse|new band|informer/i, 'gang', 2],
    [/arrest|hanged|sentenced|tried at|trial|convict|in irons|escaped|burglar|robbed|robbery|murder|cutpurse|thief|stolen|smuggl/i, 'crime', 2],
    [/was buried|has died|died |death of/i, 'death', 1],
    [/married|wedding/i, 'people', 1],
    [/families are leaving|packed up and left|evicted|settled in|have arrived/i, 'people', 1],
  ];
  const ROUTINE = /quartermaster bought|purveyors took|more raiders were seen|delivered|found a day's labour|ran short|wanted .* but|could not pay|could only pay|dawns over|paid \d+d in bridge|rode on|is coming along|barge unloaded|went downriver|parish relief|repair their roof|reported .* to the watch|has come\.?$/i;

  const C = {
    facts: [], heard: [], nextId: 1, CATS,
    yearOf(day) { return Math.floor((day - 1) / YEAR_DAYS()) + 1; },
    dateLabel(day) {
      const s = O.SEASONS[Math.floor((day - 1) / O.SEASON_DAYS + 1) % 4];
      return `Year ${C.yearOf(day)}, ${s[0].toUpperCase() + s.slice(1)} ${((day - 1) % O.SEASON_DAYS) + 1}`;
    },
    classify(text, kind) {
      if (kind === 'day' || kind === 'season' || kind === 'death' || ROUTINE.test(text)) return null;
      if (kind === 'kingdom-rulers') return { cat: 'rulers', imp: /dead|died|crowned|rebellion|proclaimed|won|broken/i.test(text) ? 5 : 3 };
      if (kind === 'kingdom-war') return { cat: 'war', imp: /WAR|PEACE|Victory|Defeat|fallen on/.test(text) ? 4 : 2 };
      for (const [re, cat, imp] of RULES) if (re.test(text)) return { cat, imp };
      if (kind === 'kingdom') return { cat: 'markets', imp: 1 };
      return null;
    },
    add(f) {
      // the same story told twice the same day is one fact
      const dup = C.facts.find((x) => x.day === f.day && x.text === f.text && x.place === f.place);
      if (dup) return dup;
      f.id = C.nextId++; C.facts.push(f);
      if (C.facts.length > 900) { const i = C.facts.findIndex((x) => x.imp < 2 && !x.byPlayer); C.facts.splice(i >= 0 ? i : 0, 1); }
      return f;
    },
    fromLog(sim, text, kind) {
      const c = C.classify(text, kind); if (!c) return null;
      const byPlayer = /\bthe (stranger|newcomer)\b|wanted stranger|the lord (raised|lowered|drew|has pardoned)/i.test(text) && (!/the lord/i.test(text) || !!(O.PlayerState && O.PlayerState.lord));
      let place = sim.world.placeId || 'ashford', placeName = sim.world.name;
      if (String(kind).startsWith('kingdom') && sim.kingdom) { const kp = sim.kingdom.places.find((q) => text.includes(q.name)); if (kp) { place = kp.id; placeName = kp.name; } }
      return C.add({ day: sim.day, minute: Math.floor(sim.minute), place, placeName, cat: byPlayer && c.cat === 'politics' ? 'rulers' : c.cat, imp: c.imp + (byPlayer ? 1 : 0), text, byPlayer });
    },
    // a deed of the player's that only they may know the truth of
    deed(sim, publicText, mineText, cat, imp, known) {
      return C.add({ day: sim.day, minute: Math.floor(sim.minute), place: sim.world.placeId || 'ashford', placeName: sim.world.name, cat, imp, text: publicText, mine: mineText, byPlayer: true, secret: !known });
    },
    playerHears(f, version, src, from) {
      if (!f) return;
      if (C.heard.some((h) => h.f === f.id && h.src === src)) return;
      C.heard.push({ f: f.id, text: version, src, from: from || null, day: O.SimRef ? O.SimRef.cur.day : f.day });
      if (C.heard.length > 120) C.heard.shift();
    },
    byId(id) { return C.facts.find((f) => f.id === id); },
  };

  // ---------------------------------------------------------------- telling a story
  const exaggerate = (text, rng, k) => text.replace(/\b(\d+)\b/g, (m, n) => { const v = +n; if (v < 2 || v > 2000) return m; return String(Math.round(v * (k[0] + rng.next() * (k[1] - k[0])))); });
  function swapName(text, sim, rng) {
    const names = sim.people.filter((p) => !p.visitor && p.age >= 16).map((p) => p.name);
    for (const n of names) if (text.includes(n)) { const other = rng.pick(names); if (other !== n) return text.split(n).join(other); }
    return text;
  }
  function swapPlace(text, rng) {
    const K = O.SimRef ? O.SimRef.home.kingdom : null; if (!K) return text;
    const names = K.places.map((p) => p.name);
    for (const n of names) if (text.includes(n)) return text.split(n).join(rng.pick(names));
    return text;
  }
  // lower-case the first word only when it's a common word, never a name
  const lower = (s) => (/^(The|A|An|With|By|Unable|Somewhere|Word|Families|Storm|Smoke|Parish|Report)\b/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  C.lower = lower;
  const strip = (s) => s.replace(/\.$/, '');
  const BARD_OPEN = ['Come gather and hear how', 'Sing ho for the day when', 'Oh, the fiddlers still tell how', 'Hark to the tale of how'];
  const BARD_CLOSE = ['and the ale ran like water!', 'and the moon hid its face.', 'and none shall forget it.', 'and the crows sang of it after.'];
  const SHEET = ['SHOCKING NEWS!', 'TERRIBLE TIDINGS!', 'ALL THE TALK OF THE TOWN!', 'MOST REMARKABLE!'];
  // how a given source would tell this fact
  function tell(f, src, sim, rng) {
    let t = f.text;
    if (f.byPlayer && f.secret) t = t.replace(/\byou\b/gi, 'a stranger');
    switch (src) {
      case 'saw': return t;
      case 'crier': return f.cat === 'crime' ? `${strip(t)}. The watch is vigilant and order is kept.` : f.cat === 'politics' || f.cat === 'rulers' ? `By order of the council: ${lower(t)}` : t;
      case 'watch': return `Report, ${C.dateLabel(f.day)}: ${lower(t)}`;
      case 'bard': return `♪ ${rng.pick(BARD_OPEN)} ${lower(strip(exaggerate(t, rng, [1.6, 3])))}, ${rng.pick(BARD_CLOSE)} ♪`;
      case 'broadsheet': return `${rng.pick(SHEET)} ${strip(exaggerate(t, rng, [1.3, 2]))}, or so it is reliably said!`;
      case 'merchant': return `Down the road they say ${lower(strip(rng.chance(0.4) ? swapPlace(t, rng) : t))}.`;
      case 'rumour': default: {
        let v = rng.chance(0.3) ? swapName(t, sim, rng) : t;
        v = exaggerate(v, rng, [0.7, 1.6]);
        return v;
      }
    }
  }
  C.tell = tell;
  C.SOURCES = { saw: 'saw it', crier: 'the crier', watch: 'a watch report', bard: 'a bard', broadsheet: 'the broadsheet', merchant: 'a merchant', rumour: 'rumour', record: 'the parish record' };

  // ---------------------------------------------------------------- simulation hooks
  function install(Sim) {
    const S = Sim.prototype;
    const _log = S.log;
    S.log = function (text, kind) {
      _log.call(this, text, kind);
      if (this._quietChronicle) return;
      const f = C.fromLog(this, text, kind);
      if (f) this.seedNews(f);
    };
    // a handful of people learn of a fact first-hand; it spreads from them
    S.seedNews = function (f, n = 3) {
      if (!this.people || !this.people.length) return;
      const cand = this.people.filter((p) => !p.visitor && p.age >= 12);
      for (let i = 0; i < n && cand.length; i++) this.hear(this.rng.pick(cand), f, 'saw');
      // anyone named in it knows it
      for (const p of cand) if (f.text.includes(p.name)) this.hear(p, f, 'saw');
    };
    S.hear = function (p, f, src, version) {
      p.heard = p.heard || [];
      if (p.heard.some((h) => h.f === f.id)) return false;
      p.heard.unshift({ f: f.id, v: version || tell(f, src, this, this.rng), src, d: this.day });
      if (p.heard.length > 8) p.heard.length = 8;
      return true;
    };
    // over a jug, people pass on what they've heard, a little changed
    const _gossip = S.gossip;
    S.gossip = function (a, b) {
      if (_gossip) _gossip.call(this, a, b);
      const h = (a.heard || []).find((x) => { const f = C.byId(x.f); return f && f.imp >= 1 && !(b.heard || []).some((y) => y.f === x.f); });
      if (!h) return;
      const f = C.byId(h.f);
      this.hear(b, f, 'rumour', this.rng.chance(0.5) ? h.v : tell(Object.assign({}, f, { text: h.v }), 'rumour', this, this.rng));
    };
    // business founders are remembered by name
    const _start = S.startBusiness;
    S.startBusiness = function (b, type, owner) {
      const bz = _start.call(this, b, type, owner);
      bz.founded = { day: this.day, by: owner === 'player' ? 'you' : owner ? owner.name : 'the parish' };
      if (owner === 'player') C.deed(this, `${bz.name} opened its doors under a new master.`, `You opened ${bz.name}.`, 'player', 2, true);
      return bz;
    };
    // the player's crimes: the record says what is known, the player knows the rest
    const _rec = S.recordCrime;
    S.recordCrime = function (o) {
      const cr = _rec.call(this, o);
      if (o.perp === 'player') {
        const what = { pickpocket: 'A purse was cut', burglary: 'A burglary', robbery: 'A robbery', assault: 'An assault', 'horse theft': 'A horse was stolen', murder: 'A killing' }[o.kind] || `A ${o.kind}`;
        const where = o.placeName ? ` at ${o.placeName}` : ` in ${this.world.name}`;
        const f = C.deed(this, `${what}${where}${o.seen && o.seen.length ? ', and it was seen' : ''}.`, `You committed ${o.kind}${where}${o.seen && o.seen.length ? ` — ${o.seen.length} saw you` : ' — unseen'}.`, 'crime', o.kind === 'pickpocket' ? 1 : (o.severity || 1) + 1, false);
        f.crimeId = cr && cr.id;
        if (o.seen) for (const w of o.seen) if (w && w.id != null && !w.visitor) this.hear(w, f, 'saw');
      }
      return cr;
    };
    // notable deaths become history; memorials and portraits keep them in mind
    const _onDeath = S.onDeath;
    S.onDeath = function (p, cause) {
      _onDeath.call(this, p, cause);
      const hh = this.households[p.household - 1];
      const owned = [...this.biz.values()].find((bz) => bz.owner === p.id);
      const notable = !!(p.title || (hh && hh.money > 300) || owned || p.age >= 80 || p.job?.role === 'guard captain' || p.job?.role === 'priest' || (p.gang && (this.gangs || []).some((g) => g.leader === p.id)));
      const deeds = C.facts.filter((f) => f.imp >= 2 && f.text.includes(p.name)).slice(-3).map((f) => f.text);
      const f = C.add({ day: this.day, minute: Math.floor(this.minute), place: this.world.placeId || 'ashford', placeName: this.world.name, cat: 'death', imp: notable ? 3 : 1, text: `${p.name}${p.title ? ', ' + p.title + ',' : ''} ${cause} at ${p.age}.`, who: p.name, notable });
      this.seedNews(f, notable ? 6 : 2);
      if (!notable) return;
      const epitaph = { name: p.name, title: p.title || (owned ? `master of ${owned.name}` : p.job?.role ? `${p.job.role} of ${this.world.name}` : null), age: p.age, died: this.day, deeds };
      (this.memorials = this.memorials || []).push(epitaph);
      // the family hangs a portrait
      const home = this.building(p.home);
      if (home && hh && !hh.gone) { (home.portraits = home.portraits || []).push({ name: p.name, died: this.day, seed: p.id }); O.Interior && O.Interior.invalidate(home); }
      this.onMemorial && this.onMemorial(epitaph);
    };

    // the crier, merchants and bards spread news each day
    S.newsDaily = function () {
      const recent = C.facts.filter((f) => f.day >= this.day - 4 && f.imp >= 2 && (f.place === (this.world.placeId || 'ashford') || f.imp >= 3));
      if (!recent.length) return;
      // the crier's version reaches about a third of the town
      const top = recent.slice().sort((a, b) => b.imp - a.imp || b.day - a.day)[0];
      for (const p of this.people) if (!p.visitor && p.age >= 10 && this.rng.chance(0.33)) this.hear(p, top, 'crier');
      // merchants bring word of other places to the tavern crowd
      const away = C.facts.filter((f) => f.day >= this.day - 8 && f.imp >= 2 && f.place !== (this.world.placeId || 'ashford'));
      if (away.length) { const f = this.rng.pick(away); for (const p of this.people) if (p.activity?.act === 'socialise' || this.rng.chance(0.08)) this.hear(p, f, 'merchant'); }
    };
  }

  // Bards: on Freyday and Saturnday evenings a minstrel walks in, plays the tavern and moves on.
  function installBards(Sim) {
    const S = Sim.prototype, _mt = S.minuteTick;
    S.minuteTick = function () {
      _mt.call(this);
      const mm = this._m, wd = this.weekday;
      if ((wd === 4 || wd === 5) && mm === 17 * 60 + 30 && !this.bard && this.tavernId) this.bardArrives();
      if (!this.bard && mm % 60 === 0) this.bard = this.people.find((p) => p.job?.role === 'bard') || null;
      const bd = this.bard;
      if (!bd) return;
      if (mm === 23 * 60 + 15) { bd.task = { act: 'leave', outdoor: true, emigrating: true }; bd.agent.carrying = null; }
      if (bd.task?.act === 'perform' && bd.agent.inside === this.tavernId && mm % 30 === 0) {
        // bards sing of deeds, deaths, disasters and rogues, not of the watch's paperwork
        const songs = C.facts.filter((x) => x.imp >= 2 && x.day >= this.day - 28 && !/no description|looking for|report|tax|motion/i.test(x.text)).sort((a, b) => (b.imp + (b.byPlayer ? 1 : 0)) - (a.imp + (a.byPlayer ? 1 : 0)) || b.day - a.day);
        const f = songs.length ? songs[(mm / 30) % Math.min(4, songs.length)] : null;
        if (f) { bd.song = { f: f.id, text: tell(f, 'bard', this, this.rng), m: mm }; for (const p of this.people) if (p !== bd && p.agent.inside === this.tavernId) this.hear(p, f, 'bard', bd.song.text); }
      }
      if (!this.people.includes(bd)) this.bard = null;
    };
    S.bardArrives = function () {
      const r = this.rng, sex = r.chance(0.7) ? 'm' : 'f';
      const D = O.Data, Ch = O.Char;
      const p = this.newPerson({ sex, age: r.int(20, 50), first: r.pick(D.NAMES[sex]), sur: r.pick(['the Singer', 'Harper', 'of the Roads', 'Lightfoot', 'Rhymer']), household: 0, home: null, genes: Ch.randomGenes(r, r.pick(['north', 'east', 'west', 'south'])), wealth: 0.5, visitor: true });
      p.name = `${p.first} ${p.sur}`; p.job = { biz: null, role: 'bard' }; p.wake = 0; p.bed = 1440;
      p.app = Ch.makeAppearance(O.hash('bard', p.id), { sex, age: p.age, genes: p.genes, role: 'bard', wealth: 0.5 });
      const E = this.Z.east || [this.world.W - 2, this.world.roadY || 30];
      p.agent = { x: E[0] * this.T, y: E[1] * this.T, dir: 1, anim: 'walk', ft: 0, a: p.app, hidden: false, inside: null, path: null, goal: null, person: p };
      p.task = { act: 'perform', b: this.tavernId };
      this.bard = p;
      this.log(`${p.name}, a wandering bard, has come to play at ${this.building(this.tavernId)?.name || 'the tavern'}.`, 'event');
    };
  }
  C.installBards = installBards;
  C.install = (Sim) => { install(Sim); installBards(Sim); };
  O.Chronicle = C;
})();
