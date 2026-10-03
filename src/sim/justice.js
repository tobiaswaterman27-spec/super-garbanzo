// Justice: crime -> witnesses -> reports -> investigation -> suspect profile -> recognition ->
// pursuit -> arrest -> trial -> outcome. Information is imperfect throughout: witnesses describe
// what they think they saw, the watch builds a profile by majority, and a change of hood or cloak
// can make the description stop fitting you. Villagers commit crimes too, and the watch can arrest
// the wrong person.
'use strict';
(function () {
  const P = O.Pal;
  const COLOR_NAMES = Object.keys(P.cloth);
  const colorOf = (m) => { if (m == null) return null; const hex = P.mats[m]?.hex; return COLOR_NAMES.find((k) => P.cloth[k] === hex) || 'dark'; };
  const hairOf = (m) => { const hex = P.mats[m]?.hex; return Object.keys(P.hair).find((k) => P.hair[k] === hex) || 'dark'; };
  const PLAIN = { forest: 'green', sage: 'grey-green', olive: 'olive', woad: 'blue', navy: 'dark blue', sky: 'pale blue', teal: 'teal', madder: 'red', crimson: 'crimson', russet: 'russet', ochre: 'yellow-brown', mustard: 'yellow', brown: 'brown', darkBrown: 'dark brown', black: 'black', purple: 'purple', plum: 'plum', white: 'white', linen: 'off-white', undyed: 'undyed', wool: 'grey', greyWool: 'grey', rose: 'pink', leather: 'leather', darkLeather: 'dark leather', tan: 'tan', lightBlonde: 'fair', ashBrown: 'ash-brown', darkBrown2: 'dark brown' };
  const pretty = (s) => PLAIN[s] || s.replace(/([A-Z])/g, ' $1').toLowerCase();
  const SIMILAR = { forest: ['olive', 'sage', 'teal'], darkBrown: ['brown', 'black', 'leather'], black: ['darkBrown', 'navy', 'greyWool'], russet: ['madder', 'brown', 'ochre'], woad: ['navy', 'sky', 'teal'], crimson: ['madder', 'plum'] };

  // What can be seen of someone right now.
  function lookOf(a) {
    const o = a.outfit;
    return { hood: o.hat === 'hood' ? colorOf(o.hatMat) : null, hat: o.hat && o.hat !== 'hood' ? o.hat : null, cloak: o.cloak ? colorOf(o.cloak) : null, tunic: colorOf(o.over), hair: o.hat === 'hood' ? null : hairOf(a.hair), height: a.height > 0.4 ? 'tall' : a.height < -0.4 ? 'short' : 'middling' };
  }
  // A witness's memory of that look, degraded by accuracy.
  function remembered(look, acc, rng) {
    const d = {};
    const blur = (c) => (rng.chance(acc) ? c : rng.pick(SIMILAR[c] || COLOR_NAMES));
    if (look.hood) d.hood = blur(look.hood);
    if (look.cloak && rng.chance(0.4 + acc * 0.5)) d.cloak = blur(look.cloak);
    if (look.tunic && rng.chance(acc * 0.7)) d.tunic = blur(look.tunic);
    if (look.hair && rng.chance(0.5 + acc * 0.4)) d.hair = rng.chance(acc) ? look.hair : rng.pick(Object.keys(P.hair));
    if (look.hat) d.hat = look.hat;
    if (rng.chance(acc * 0.8)) d.height = rng.chance(acc + 0.1) ? look.height : rng.pick(['tall', 'short', 'middling']);
    return d;
  }
  function describe(d) {
    const bits = [];
    if (d.hood) bits.push(`a ${pretty(d.hood)} hood`);
    if (d.hat) bits.push(`a ${d.hat === 'feather' ? 'feathered cap' : d.hat}`);
    if (d.cloak) bits.push(`a ${pretty(d.cloak)} cloak`);
    if (d.tunic) bits.push(`a ${pretty(d.tunic)} tunic`);
    if (d.hair) bits.push(`${pretty(d.hair)} hair`);
    if (d.height) bits.push(d.height === 'middling' ? 'middling height' : d.height);
    return bits.join(', ') || 'nobody could say much';
  }
  function matchScore(profile, look) {
    let n = 0, hit = 0;
    for (const k of ['hood', 'cloak', 'tunic', 'hair', 'hat', 'height']) {
      if (profile[k] == null) continue; n += k === 'height' ? 0.5 : 1;
      if (profile[k] === look[k]) hit += k === 'height' ? 0.5 : 1;
    }
    return n ? hit / n : 0;
  }
  function vote(descs) {
    const prof = {};
    for (const k of ['hood', 'cloak', 'tunic', 'hair', 'hat', 'height']) {
      const c = {}; for (const d of descs) if (d[k]) c[d[k]] = (c[d[k]] || 0) + 1;
      const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; if (best) prof[k] = best[0];
    }
    return prof;
  }

  function install(Sim) {
    const S = Sim.prototype;
    S.justiceInit = function () { this.crimes = this.crimes || []; this.guardId = this.world.buildings.find((b) => b.type === 'guard').id; this.jail = []; };

    // Who can see a point outdoors right now?
    S.seers = function (x, y, exclude) {
      const night = this.hour < 6 || this.hour > 20.5, w = this.weather;
      let range = 95 * (night ? 0.45 : 1) * (w.kind === 'fog' ? 0.45 : w.kind === 'heavy' || w.kind === 'storm' ? 0.65 : w.kind === 'rain' ? 0.85 : 1);
      return this.people.filter((q) => q !== exclude && !q.agent.hidden && q.age >= 6 && q.activity?.act !== 'collapsed' && Math.hypot(q.agent.x - x, q.agent.y - y) < range * (q.traits.includes('curious') || q.traits.includes('suspicious') ? 1.2 : 1));
    };

    // Record a crime with its witnesses. perp: 'player' or a Person.
    S.recordCrime = function (o) {
      const crime = Object.assign({ id: this.crimes.length + 1, day: this.day, minute: Math.floor(this.minute), witnesses: [], reported: false, investigated: false, profile: null, solved: false, severity: 1 }, o);
      const look = o.perp === 'player' ? lookOf(O.game.player.a) : o.perp ? lookOf(o.perp.app) : null;
      for (const w of o.seen || []) {
        const acc = O.clamp(0.45 + (w.traits.includes('curious') ? 0.2 : 0) + (w.traits.includes('suspicious') ? 0.15 : 0) - (w.age > 70 ? 0.2 : 0) - (w.age < 12 ? 0.15 : 0) + this.rng.float(-0.2, 0.2) - (this.hour < 6 || this.hour > 20.5 ? 0.2 : 0), 0.1, 1);
        const desc = look ? remembered(look, acc, this.rng) : {};
        crime.witnesses.push({ id: w.id, desc, acc });
        this.remember(w, `Saw ${crime.kind === 'pickpocket' ? 'a cutpurse at work' : crime.kind === 'burglary' ? 'someone break into a house' : 'a thief'} ${crime.placeName ? 'at ' + crime.placeName : ''}: ${describe(desc)}.`, 'crime', 1.6, o.perp === 'player' ? 0 : o.perp?.id);
        if (o.perp === 'player') this.relate(w, { id: 0 }, -0.4);
        // most honest folk go to the watch; the timid, the hostile and the player's friends may not
        const friend = (w.rel.get(0)?.affinity || 0) > 0.4 && o.perp === 'player';
        if (!w.traits.includes('cowardly') && !friend && w.age >= 12 && (w.attitude > -0.2 || this.rng.chance(0.3)) && !w.task) w.task = { act: 'report', b: this.guardId, crime: crime.id };
      }
      this.crimes.push(crime);
      return crime;
    };

    S.reported = function (p) {
      const crime = this.crimes.find((c) => c.id === p.task.crime);
      p.task = null;
      if (!crime || crime.reported) return;
      crime.reported = true;
      this.log(`${p.name} reported ${crime.kind === 'pickpocket' ? 'a cutpurse' : crime.kind} ${crime.placeName ? 'at ' + crime.placeName : ''} to the watch.`, 'crime');
      const guards = this.people.filter((q) => q.job?.role?.startsWith('guard') && !q.task && q.activity?.act !== 'sleep');
      const g = guards.find((q) => q.job.role === 'guard captain') || guards[0];
      if (g) g.task = { act: 'investigate', outdoor: true, crime: crime.id, tile: crime.tile };
      else crime.pendingInvestigation = true;
    };

    // Guard arrives at the scene: questions witnesses, settles on a profile.
    S.investigate = function (g) {
      const crime = this.crimes.find((c) => c.id === g.task.crime); g.task = null;
      if (!crime) return;
      const descs = crime.witnesses.map((w) => w.desc).filter((d) => Object.keys(d).length);
      crime.profile = vote(descs); crime.investigated = true;
      const skill = g.skills[g.job.role] || 0.5;
      crime.evidence = Math.min(3, crime.witnesses.reduce((s, w) => s + w.acc, 0) * (0.6 + skill * 0.6));
      const desc = describe(crime.profile);
      this.log(Object.keys(crime.profile).length ? `The watch is looking for ${desc} over the ${crime.kind} at ${crime.placeName || 'Ashford'}.` : `The watch has no description to go on over the ${crime.kind} at ${crime.placeName || 'Ashford'}.`, 'crime');
      this.remember(g, `Investigating a ${crime.kind}: we want ${describe(crime.profile)}.`, 'work', 1.5);
      // an NPC culprit can be found by matching the description against the village
      if (crime.perp !== 'player') this.searchSuspects(crime, g);
      else {
        // a villager who happens to fit the description may be wrongly accused
        const look = lookOf(O.game.player.a);
        const innocents = this.people.filter((q) => !q.visitor && q.age >= 15 && matchScore(crime.profile, lookOf(q.app)) > matchScore(crime.profile, look) + 0.15);
        if (innocents.length && Object.keys(crime.profile).filter((k) => k !== 'height').length >= 2 && crime.evidence < 1.6 && this.rng.chance(0.35)) this.arrestNPC(this.rng.pick(innocents), crime, true);
      }
    };

    S.searchSuspects = function (crime, g) {
      const scored = this.people.filter((q) => !q.visitor && q.age >= 13).map((q) => [q, matchScore(crime.profile, lookOf(q.app))]).sort((a, b) => b[1] - a[1]);
      if (!scored.length) return;
      const [best, sc] = scored[0];
      if (Object.keys(crime.profile).filter((k) => k !== 'height').length < 2) return; // too vague to arrest anyone
      if (sc > 0.5 && this.rng.chance(0.4 + crime.evidence * 0.2)) this.arrestNPC(best, crime, best !== crime.perp);
    };

    S.arrestNPC = function (q, crime, wrong) {
      crime.solved = !wrong; crime.accused = q.id;
      const days = 1 + (crime.severity > 1 ? 1 : 0);
      q.jailUntil = this.day + days; q.task = { act: 'jailed', b: this.guardId };
      const hh = this.household(q); const fine = Math.min(hh.money, 6 * crime.severity); hh.money -= fine; this.treasury.cash += fine; this.treasury.income += fine;
      this.remember(q, wrong ? `Arrested for a ${crime.kind} I never did. Fined ${fine}d and locked up.` : `Caught for the ${crime.kind}. Fined ${fine}d and locked up.`, 'crime', 3);
      for (const id of hh.members) { const m = this.byId.get(id); if (m && m !== q) this.remember(m, `${q.first} was taken by the watch${wrong ? ', for something they swear they never did' : ''}.`, 'crime', 1.5, q.id); }
      this.log(`The watch arrested ${q.name} for the ${crime.kind}${wrong ? ' — though some say the wrong one was taken' : ''}.`, 'crime');
      if (wrong && crime.perp === 'player') { this.log('Somewhere, the real thief walks free.', 'crime'); }
    };

    // Villagers who are poor, reckless and none too honest sometimes steal at night.
    S.npcCrimeNightly = function () {
      const cands = this.people.filter((p) => !p.visitor && p.age >= 15 && p.attitude < -0.1 && this.household(p).money < 40 && (p.traits.includes('risk-taking') || p.traits.includes('greedy') || this.household(p).pantry.bread < 1) && !p.jailUntil);
      for (const p of cands) {
        if (!this.rng.chance(0.06)) continue;
        const victims = this.households.filter((h) => !h.gone && h.id !== p.household && h.pantry.bread >= 2);
        if (!victims.length) continue;
        const v = this.rng.pick(victims), took = Math.min(3, Math.floor(v.pantry.bread)), coin = Math.min(Math.floor(v.money * 0.15), 15);
        v.pantry.bread -= took; v.money -= coin; this.household(p).pantry.bread += took; this.household(p).money += coin;
        const b = this.building(v.home);
        const seen = this.rng.chance(0.3) ? v.members.map((id) => this.byId.get(id)).filter((m) => m && m.age >= 10).slice(0, 1) : [];
        const crime = this.recordCrime({ kind: 'burglary', perp: p, placeName: `the ${v.surname} house`, tile: [b.doorX, b.doorY], victim: v.id, seen, severity: 1 });
        for (const id of v.members) { const m = this.byId.get(id); if (m && m.age >= 12) { this.remember(m, `Someone broke in at night and took ${took} loaves${coin ? ' and ' + coin + 'd' : ''}.`, 'crime', 1.5); if (!seen.length && !m.task && m.age >= 16 && this.rng.chance(0.6)) { m.task = { act: 'report', b: this.guardId, crime: crime.id }; break; } } }
        this.remember(p, 'Did something I am not proud of last night.', 'crime', 1);
      }
    };

    S.justiceDaily = function () {
      for (const p of this.people) if (p.jailUntil && this.day >= p.jailUntil) { p.jailUntil = null; if (p.task?.act === 'jailed') p.task = null; this.remember(p, 'Released from the cell.', 'crime', 1); }
      for (const c of this.crimes) if (c.pendingInvestigation && !c.investigated) { const g = this.people.find((q) => q.job?.role?.startsWith('guard') && !q.task); if (g) { g.task = { act: 'investigate', outdoor: true, crime: c.id, tile: c.tile }; c.pendingInvestigation = false; } }
    };

    // Gossip at the tavern: crime stories spread, losing detail with each telling.
    S.gossip = function (a, b) {
      const m = a.memories.find((x) => x.kind === 'crime' && x.strength > 0.5);
      if (!m || b.memories.some((x) => x.text.includes(m.text.slice(0, 30)))) return;
      const text = m.text.replace(/^Saw /, `${a.first} says they saw `).replace(/^Someone /, `${a.first} says someone `);
      this.remember(b, text, 'rumour', m.strength * 0.6);
    };
  }

  O.Justice = { install, lookOf, describe, matchScore, remembered, vote };
})();
