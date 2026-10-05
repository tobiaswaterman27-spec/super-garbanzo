// More kinds of war, and battles you can see.
//   Foreign wars come from different foes: the Sea-Lords of Varn over the northern strait, the Marcher clans
//   out of the mountains, or the fleet of Aldmark landing in the west.
//   Civil wars are raised by whoever has a claim or a grievance: Robert, Duke of Frostmere (the old king's
//   cousin, who has always said his claim was the better one), or one of the great lords of the castles.
//   Smaller wars go on all the time: lords feud over land and tolls, sea raiders and bandits fall on towns,
//   and hungry commons rise against their lord.
//   Battles are fought where you can see them: two lines on the road at the edge of town, banners up, the
//   lines close and fight (strike with E), men fall, and one side breaks and runs.
//   Leaders of places (a reeve, a lord, the monarch) have a War tab in Business: send men to the King's host,
//   build a palisade, drill the levy, demand tribute of a neighbour, raise a feud or make peace, and answer
//   raids on their town.
'use strict';
(function () {
  const T = 16;
  function setup(game, npcUI) {
    const PS = O.PlayerState, Ch = O.Char, cur = () => O.SimRef.cur, home = O.SimRef.home, K = home.kingdom, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    const R = () => K.rulersInit ? K.rulersInit() : K.rulers;
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const MAJOR = new Set(['castle', 'city', 'port', 'town', 'capital']);
    const fightSkill = () => O.clamp(0.3 + (PS.skills.fighting || PS.skills.combat || 0) * 0.5 + (PS.items.includes('sword') ? 0.15 : PS.items.includes('axe') || PS.items.includes('spear') ? 0.08 : 0) + (PS.knight ? 0.1 : 0), 0.2, 0.9);

    // ================================================================ foreign foes
    const FOES = [
      { name: 'the Sea-Lords of Varn', home: 'ravenscar', host: 'the war-host of Varn', look: 'outlaw', announce: (f) => `WAR. The castle council has declared war on ${f}. Their longships raid the north; the King's host musters at Highmere and every town must send men.` },
      { name: 'the Marcher clans', home: 'wolfden', host: 'the clans of the Marches', look: 'outlaw', announce: (f) => `WAR. ${cap(f)} have come down out of the mountains in force. The King's host musters at Highmere and every town must send men.` },
      { name: 'the Kingdom of Aldmark', home: 'westhaven', host: 'the host of Aldmark', look: 'guard', announce: (f) => `WAR. The fleet of ${f.replace('the Kingdom of ', '')} has landed at Westhaven. The King's host musters at Highmere and every town must send men.` },
    ];
    const _declare = K.declareWar.bind(K);
    K.declareWar = function (opts = {}) {
      if (!opts.civil && !opts.enemy) { const f = FOES[this.rng.int(0, FOES.length - 1)]; if (this.place(f.home)) opts = Object.assign({}, opts, { enemy: f.name, home: f.home, hostName: f.host, announce: f.announce(f.name) }); }
      return _declare(opts);
    };
    // the monarch's choice of enemy: a foreign foe, or a great lord who has defied the crown
    O.warFoes = () => {
      const out = FOES.filter((f) => K.place(f.home)).map((f) => ({ key: 'foe:' + f.name, name: f.name }));
      for (const [id, L] of Object.entries(R()?.lords || {})) if (K.place(id)?.kind === 'castle' && id !== 'highmere') out.push({ key: 'lord:' + id, name: `${L.name}, ${L.sex === 'f' ? 'Lady' : 'Lord'} of ${K.place(id).name}` });
      return out;
    };
    O.declareOn = (key) => {
      if (!key || key.startsWith('foe:')) { const f = FOES.find((x) => 'foe:' + x.name === key) || FOES[0]; return K.declareWar({ enemy: f.name, home: f.home, hostName: f.host, announce: `WAR. By the crown's command the realm makes war on ${f.name}. The host musters at Highmere and every town must send men.` }); }
      const id = key.slice(5), L = R().lords[id], pl = K.place(id);
      return K.declareWar({ enemy: `${L.name} of ${pl.name}`, home: id, men: 140, hostName: `the host of ${L.name}`, announce: `WAR. The crown has declared ${L.name} of ${pl.name} a traitor and sends the host against ${L.sex === 'f' ? 'her' : 'him'}.` });
    };
    const foeLook = () => { const W = K.war; if (!W) return 'outlaw'; if (W.civil) return 'guard'; return (FOES.find((f) => f.name === W.enemy) || {}).look || 'outlaw'; };

    // ================================================================ rebels: the Duke, or a great lord
    K.rebellion = function () {
      const Rr = this.rulers; let P = Rr.pretender; if (!P || (this.war && this.war.phase === 'war')) return;
      this.warInit();
      // sometimes it's not the Duke at all but a great lord with a grievance
      if (this.rng.chance(0.45)) {
        const lords = Object.entries(Rr.lords || {}).filter(([id]) => this.place(id)?.kind === 'castle' && id !== 'highmere');
        if (lords.length) { const [id, L] = lords[this.rng.int(0, lords.length - 1)]; P = Rr.pretender = { name: L.name, sex: L.sex || 'm', age: L.age || 45, title: `${L.sex === 'f' ? 'Lady' : 'Lord'} of ${this.place(id).name}`, seat: id, ambition: 0.6, lord: true }; }
      }
      const seat = this.place(P.seat), his = P.sex === 'f' ? 'her' : 'his';
      this.addNews(`REBELLION. ${P.name}, ${P.title}, ${P.lord ? 'has thrown off the crown and' : 'claims the crown and'} has raised ${his} banner at ${seat.name}. Lords must choose a side.`, 'rulers', P.seat);
      this.declareWar({ civil: true, enemy: `${P.name} of ${seat.name} and ${his} rebels`, home: P.seat, men: P.lord ? 160 : 200, hostName: `the rebel host of ${P.name}`, crownName: Rr.crown ? `the host of ${this.crownTitle()}` : "the King's host", announce: `CIVIL WAR. The crown calls every loyal town to arms against ${P.name}, ${P.title}. The King's host musters at Highmere.` });
    };
    // the old news assumed every rebel was the Duke of Frostmere
    const _news = K.addNews.bind(K);
    K.addNews = function (text, kind, place) {
      const P = this.rulers?.pretender;
      if (P && P.seat && P.seat !== 'frostmere' && /his lands at Frostmere/.test(text)) text = text.replace('his lands at Frostmere', `${P.sex === 'f' ? 'her' : 'his'} lands at ${this.place(P.seat)?.name || 'home'}`);
      return _news(text, kind, place);
    };
    // who the Duke is, for anyone who asks
    O.whoIsDuke = () => { const P = R()?.pretender; if (!P) return ''; return P.lord ? `${P.name}, ${P.title}: a great lord who has quarrelled with the crown.` : /Duke of Frostmere/.test(P.title) ? `${P.name}, ${P.title}: the old king's cousin. He holds the north from Frostmere and has always said his claim to the crown was the better one.` : `${P.name}, ${P.title}: a claimant to the crown.`; };

    // ================================================================ feuds, raids and risings
    // K.conflicts: { id, kind: 'feud'|'raid'|'revolt', a, b (place ids), foe (name), aMen, bMen, days, since, done, visible }
    K.conflicts = K.conflicts || [];
    const placeName = (id) => K.place(id)?.name || id;
    const lordOf = (id) => K.lordName ? K.lordName(id) : placeName(id);
    const majors = () => K.places.filter((p) => MAJOR.has(p.kind) && p.kind !== 'capital');
    const near2 = (id) => { const out = new Set(); for (const n of K.neighbours(id)) { out.add(n); for (const m of K.neighbours(n)) out.add(m); } out.delete(id); return [...out].filter((x) => MAJOR.has(K.place(x)?.kind)); };
    const men = (id) => { const p = K.place(id); return Math.max(6, Math.round((p?.pop || 60) * 0.06 * (0.6 + (p?.security || 0.5)))); };
    const busy = (id) => K.conflicts.some((c) => !c.done && (c.a === id || c.b === id));
    let cid = K.conflicts.reduce((m, c) => Math.max(m, c.id), 0);
    function startConflict(c) {
      c.id = ++cid; c.since = K.sim.day; c.done = false; K.conflicts.push(c);
      if (c.kind === 'feud') K.addNews(`FEUD. ${lordOf(c.a)} and ${lordOf(c.b)} have fallen out over ${['tolls on the bridge', 'a strip of good pasture', 'a broken marriage contract', 'a stolen herd', 'the right to a mill'][c.id % 5]}. Their men are out on the roads.`, 'war', c.a);
      if (c.kind === 'raid') K.addNews(`RAIDERS. ${cap(c.foe)} ${c.sea ? 'have beached their boats near' : 'are on the roads around'} ${placeName(c.b)}.`, 'war', c.b);
      if (c.kind === 'revolt') K.addNews(`RISING. The commons of ${placeName(c.b)}, hungry and angry, have risen against ${lordOf(c.b)}. They follow ${c.leader}.`, 'war', c.b);
      return c;
    }
    O.startConflict = startConflict;
    function endConflict(c, aWins, how) {
      c.done = true; c.winner = aWins ? c.a : c.b;
      const A = K.place(c.a), B = K.place(c.b);
      if (c.kind === 'feud') { if (A && B) { const w = aWins ? A : B, l = aWins ? B : A; w.wealth = Math.min(1, (w.wealth || 0.5) + 0.04); l.wealth = Math.max(0.05, (l.wealth || 0.5) - 0.05); l.happiness = Math.max(0.05, (l.happiness || 0.5) - 0.06); } K.addNews(how || `The feud is over: ${lordOf(aWins ? c.a : c.b)} has the better of it and takes ${['the tolls', 'the pasture', 'compensation in silver', 'the herd back and more', 'the mill'][c.id % 5]}.`, 'war', c.a); }
      if (c.kind === 'raid') { if (B) { if (aWins) { B.food = Math.max(0.2, (B.food || 0.6) - 0.15); B.wealth = Math.max(0.05, (B.wealth || 0.5) - 0.05); B.happiness = Math.max(0.05, (B.happiness || 0.5) - 0.08); } } K.addNews(how || (aWins ? `${cap(c.foe)} plundered ${placeName(c.b)} and got away with grain and silver.` : `${cap(c.foe)} were driven off from ${placeName(c.b)}.`), 'war', c.b); }
      if (c.kind === 'revolt') { if (B) { if (aWins) { B.happiness = Math.min(1, (B.happiness || 0.3) + 0.15); } else { B.happiness = Math.max(0.05, (B.happiness || 0.3) - 0.1); B.pop = Math.max(20, (B.pop || 60) - 4); } } K.addNews(how || (aWins ? `The commons of ${placeName(c.b)} have won: the lord has cut the rents and the dues.` : `The rising at ${placeName(c.b)} is crushed. Its leaders hang at the crossroads.`), 'war', c.b); }
    }
    O.endConflict = endConflict;
    const FOE_RAIDERS = ['sea raiders from Varn', 'a band of outlaws', 'Marcher reivers', 'deserters turned brigands'];
    const LEADERS = ['a hedge-priest called John', 'a ploughman called Wat', 'a widow called Joan', 'a smith called Tom'];
    const playerPlace = () => cur().world.placeId;
    const _daily = K.daily.bind(K);
    K.daily = function () {
      _daily();
      try {
        const r = this.rng, day = this.sim.day;
        // feuds between lords
        if (this.conflicts.filter((c) => !c.done && c.kind === 'feud').length < 2 && r.chance(0.05)) {
          const free = majors().filter((p) => !busy(p.id)), a = free[r.int(0, free.length - 1)];
          const bs = a ? near2(a.id).filter((x) => !busy(x) && K.place(x).kind !== 'capital') : [];
          if (a && bs.length) startConflict({ kind: 'feud', a: a.id, b: bs[r.int(0, bs.length - 1)], days: r.int(6, 12), aMen: men(a.id), bMen: 0 });
        }
        // raiders
        if (r.chance(0.025)) {
          const cand = K.places.filter((p) => !busy(p.id) && p.kind !== 'capital' && p.kind !== 'castle'), b = cand[r.int(0, cand.length - 1)];
          if (b) { const foe = FOE_RAIDERS[r.int(0, FOE_RAIDERS.length - 1)]; startConflict({ kind: 'raid', a: 'raiders', b: b.id, foe, sea: /sea/.test(foe), days: r.int(1, 3) }); }
        }
        // the commons rise where they're hungry and wretched
        if (this.conflicts.filter((c) => !c.done && c.kind === 'revolt').length < 1) for (const p of K.places) if (!busy(p.id) && p.kind !== 'capital' && (p.happiness ?? 0.5) < 0.2 && (p.food ?? 0.6) < 0.4 && r.chance(0.01)) startConflict({ kind: 'revolt', a: 'commons', b: p.id, leader: LEADERS[r.int(0, LEADERS.length - 1)], days: r.int(3, 7) });
        // the course of each: skirmishes every few days, then an end
        for (const c of this.conflicts) {
          if (c.done) continue;
          if (c.visibleDay === day) continue; // (being fought in front of you)
          const age = day - c.since;
          if (c.kind === 'feud' && age > 0 && age % 2 === 0 && age < c.days) this.addNews(`${['A skirmish at a ford', 'Barns burned in the night', 'A cattle raid', 'An ambush on the road'][(c.id + age) % 4]}: ${lordOf(r.chance(0.5) ? c.a : c.b)}'s men had the better of it.`, 'war', c.a);
          if (age >= c.days) { const aS = (c.aMen || men(c.a)) * r.float(0.7, 1.3), bS = (c.kind === 'feud' ? men(c.b) : c.kind === 'raid' ? men(c.b) * 0.8 : men(c.b) * 1.1) * r.float(0.7, 1.3); endConflict(c, aS > bS); }
        }
        this.conflicts = this.conflicts.filter((c) => !c.done || day - c.since < 30);
        K.conflicts = this.conflicts;
      } catch (e) { console.error(e); }
    };

    // ================================================================ battles you can see
    // Two lines at the edge of town. Each man advances on the nearest foe, trades blows, and falls when hurt
    // enough; when a side has lost most of its men it breaks and runs.
    let B = null; // the battle on now
    function look(side, i, kind) {
      const role = kind === 'outlaw' ? (i % 4 === 0 ? 'woodcutter' : 'outlaw') : kind === 'commons' ? ['farmhand', 'villager', 'labourer'][i % 3] : 'guard';
      return Ch.makeAppearance(O.hash('battle', side, i, kind, B ? B.seed : 0), { role, sex: 'm', age: 20 + (i * 7) % 24, wealth: kind === 'guard' ? 0.5 : 0.25 });
    }
    O.Battle = {
      // opts: { ours, theirs, ourLook, theirLook, title, ourBanner, theirBanner, onEnd(won, info) }
      start(opts) {
        if (B || game.scene) return false;
        const s = cur(), ey = game.player.y, fx = game.player.x; // the fight comes to where you stand
        const clear = (x, y) => { for (let k = 0; k < 9; k++) { const yy = y + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10; if (!game.solidAt(x, yy) && !game.solidAt(x, yy - 6)) return yy; } return y; };
        B = { opts, t: 0, seed: Math.random() * 1e6 | 0, men: [], over: false, kills: 0, s };
        const line = (side, n, kind, x0, dir) => { for (let i = 0; i < n; i++) { const row = i % 2, col = Math.floor(i / 2); const mx = x0 + (dir > 0 ? -1 : 1) * (col * 14 + row * 7); B.men.push({ battle: true, side, a: look(side, i, kind), x: mx, y: clear(mx, ey - 50 + ((i * 37) % 100)), dir: dir > 0 ? 2 : 1, anim: 'walk', ft: i * 0.13, hp: kind === 'commons' ? 2 : 3, cd: Math.random(), banner: i === 0 }); } };
        line(0, Math.min(18, opts.ours), opts.ourLook || 'guard', fx - 150, 1);
        line(1, Math.min(18, opts.theirs), opts.theirLook || 'outlaw', fx + 150, -1);
        B.n0 = [B.men.filter((m) => m.side === 0).length, B.men.filter((m) => m.side === 1).length];
        // man to man down the line: pair them off by where they stand
        const L0 = B.men.filter((m) => m.side === 0).sort((a, b) => a.y - b.y), L1 = B.men.filter((m) => m.side === 1).sort((a, b) => a.y - b.y);
        L0.forEach((m, i) => { m.tgt = L1[Math.floor(i * L1.length / L0.length)]; }); L1.forEach((m, i) => { m.tgt = L0[Math.floor(i * L0.length / L1.length)]; });
        B.str = [opts.ourStr || 1, opts.theirStr || 1];
        say(opts.title || 'Battle!');
        return true;
      },
      on: () => !!B,
    };
    const alive = (side) => B.men.filter((m) => m.side === side && m.hp > 0 && !m.fled);
    game.hooks.update.push((dt) => {
      if (!B) return;
      if (game.scene) { finishBattle(alive(0).length >= alive(1).length); return; }
      B.t += dt;
      const P = game.player;
      for (const m of B.men) {
        m.ft += dt;
        if (m.hp <= 0) { m.anim = 'lie'; continue; }
        if (m.fled) { m.x += (m.side === 0 ? -1 : 1) * 70 * dt; m.anim = 'run'; m.dir = m.side === 0 ? 1 : 2; continue; }
        const foes = B.men.filter((o) => o.side !== m.side && o.hp > 0 && !o.fled);
        // you're in our line: their men come for you too
        // each man picks his own opponent (the least-pressed one near him), so the lines meet man to man
        if (!m.tgt || m.tgt.hp <= 0 || m.tgt.fled) {
          let best = null, bs = 1e9;
          for (const o of foes) { const load = B.men.filter((z) => z.tgt === o && z.hp > 0).length, sc = Math.hypot(o.x - m.x, (o.y - m.y) * 2) + load * 120; if (sc < bs) { bs = sc; best = o; } }
          m.tgt = best;
        }
        let tgt = m.tgt, td = tgt ? Math.hypot(tgt.x - m.x, tgt.y - m.y) : 1e9;
        const pd = Math.hypot(P.x - m.x, P.y - m.y);
        if (m.side === 1 && !B.youFled && pd < 28 && pd < td) { tgt = { x: P.x, y: P.y, player: true }; td = pd; }
        if (!tgt) { m.anim = 'celebrate'; continue; }
        m.dir = O.dirOf(tgt.x - m.x, tgt.y - m.y);
        if (td > 13) { const sp = (B.t < 1.5 ? 18 : 36) * dt, ky = td > 40 ? 0.3 : 1, nx = m.x + (tgt.x - m.x) / td * sp, ny = m.y + (tgt.y - m.y) / td * sp * ky; /* (each keeps to his own row until close) */ if (!game.solidAt(nx, ny)) { m.x = nx; m.y = ny; } else if (!game.solidAt(nx, m.y)) m.x = nx; else if (!game.solidAt(m.x, ny)) m.y = ny; else m.y += (m.side ? 1 : -1) * sp; m.anim = B.t < 1.5 ? 'walk' : 'run'; continue; }
        m.anim = 'attack'; m.cd -= dt;
        if (m.cd <= 0) {
          m.cd = 0.8 + Math.random() * 0.6;
          if (tgt.player) { if (Math.random() < 0.35 * (1 - fightSkill() * 0.5)) { PS.hp = Math.max(5, PS.hp - 4); P.anim = 'hurt'; if (PS.hp <= 12 && !B.youFled) { B.youFled = true; say('You are badly hurt and stagger out of the fight.', 'bad'); } } continue; }
          const hit = 0.42 * B.str[m.side] / ((B.str[0] + B.str[1]) / 2);
          if (Math.random() < hit) { tgt.hp--; tgt.hurtT = 0.3; if (tgt.hp <= 0) tgt.ft = 0; }
        }
      }
      for (const m of B.men) if (m.hurtT > 0) { m.hurtT -= dt; if (m.hp > 0) m.anim = 'hurt'; }
      // a side breaks when it has lost two in three (or fewer than three are left against many)
      for (const side of [0, 1]) { const a = alive(side).length, o = alive(1 - side).length; if (!B.over && (a <= B.n0[side] / 3 || (a < 3 && o > a * 2))) { B.over = true; B.won = side === 1; B.endT = B.t; for (const m of alive(side)) m.fled = true; say(B.won ? 'They break and run!' : 'Our line breaks. Run!', B.won ? '' : 'bad'); } }
      if (B.over && B.t - B.endT > 3.5) finishBattle(B.won);
      if (B && B.t > 90) finishBattle(alive(0).length >= alive(1).length);
      if (B) game.actors = [...game.actors.filter((x) => !x.battle), ...B.men.filter((m) => !m.fled || Math.abs(m.x - P.x) < 500)];
    });
    function finishBattle(won) {
      const b = B; B = null; game.actors = game.actors.filter((x) => !x.battle);
      const info = { ourLost: b.men.filter((m) => m.side === 0 && m.hp <= 0).length, theirLost: b.men.filter((m) => m.side === 1 && m.hp <= 0).length, kills: b.kills };
      if (b.kills) { PS.skills.fighting = Math.min(1, (PS.skills.fighting || 0) + 0.02 * b.kills); }
      b.opts.onEnd && b.opts.onEnd(won, info);
    }
    // striking in the fight: E near one of theirs
    const hook = () => {
      const prev = O.stallCandidate;
      O.stallCandidate = () => {
        if (B && !game.scene && !B.youFled) {
          const P = game.player; let best = null, bd = 30;
          for (const m of B.men) if (m.side === 1 && m.hp > 0 && !m.fled) { const d = Math.hypot(m.x - P.x, m.y - P.y); if (d < bd) { bd = d; best = m; } }
          if (best) return { type: 'custom', d: bd - 20, label: 'Strike', act: () => { P.anim = 'attack'; P.ft = 0; P.dir = O.dirOf(best.x - P.x, best.y - P.y); if (Math.random() < 0.45 + fightSkill() * 0.5) { best.hp -= 2; best.hurtT = 0.3; if (best.hp <= 0) { B.kills++; best.ft = 0; } } } };
        }
        return prev ? prev() : null;
      };
    };
    let hooked = false; game.hooks.update.push(() => { if (!hooked) { hooked = true; hook(); } });
    // banners over each line
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      if (!B || indoor) return;
      for (const m of B.men) if (m.banner && m.hp > 0) {
        const x = Math.round(m.x - cam.x), y = Math.round(m.y - cam.y) - 46;
        ctx.fillStyle = '#3a2618'; ctx.fillRect(x, y, 1, 22);
        ctx.fillStyle = m.side === 0 ? (B.opts.ourBanner || '#b8352a') : (B.opts.theirBanner || '#2a2a2a'); ctx.fillRect(x + 1, y, 10, 7);
        ctx.fillStyle = m.side === 0 ? '#e0c040' : '#c8c8c8'; ctx.fillRect(x + 4, y + 2, 3, 3);
      }
    });

    // ================================================================ trouble at your door
    // a raid, feud or rising against the place you're in (when it's daytime and you're outdoors) is fought in front of you
    let checkT = 0;
    game.hooks.update.push((dt) => {
      checkT -= dt; if (checkT > 0 || B || game.scene || O.UI.dialogOpen()) return; checkT = 2;
      const s = cur(), here = s.world.placeId;
      if (s.hour < 8 || s.hour > 18) return;
      const c = K.conflicts.find((x) => !x.done && x.b === here && x.visibleDay !== s.day && x.seenDay !== s.day && (x.kind !== 'feud' || K.sim.day - x.since >= 1));
      if (!c) return;
      c.seenDay = s.day;
      if (Math.random() > (leads(s) ? 0.9 : 0.5)) return;
      const mine = leads(s);
      const ourN = Math.min(18, Math.round(men(here) * (drillOf(s) ? 1.25 : 1) * (palisadeOf(s) ? 1.2 : 1))), theirN = Math.min(18, c.kind === 'feud' ? men(c.a) : c.kind === 'raid' ? 9 + (c.id % 6) : 12);
      const who = c.kind === 'feud' ? `${lordOf(c.a)}'s men` : c.kind === 'raid' ? cap(c.foe) : `The commons, led by ${c.leader},`;
      const text = c.kind === 'revolt' ? `${who} are coming up the road with scythes and cudgels, shouting for ${lordOf(here)}.` : `${who} ${c.kind === 'raid' && c.sea ? 'have come up from the boats' : 'are coming up the road'}. The watch is turning out${mine ? ', and looks to you' : ''}.`;
      const opts = [{ key: 'fight', label: mine ? 'Lead the levy out against them' : 'Stand with the watch' }, { key: 'hide', label: mine ? 'Leave it to the watch' : 'Keep out of it' }];
      if (mine && c.kind !== 'revolt') opts.splice(1, 0, { key: 'pay', label: `Pay them to go (₳${c.kind === 'raid' ? 40 : 80})` });
      if (mine && c.kind === 'revolt') opts.splice(1, 0, { key: 'grant', label: 'Hear them: cut the dues' });
      O.UI.dialog.open({ name: c.kind === 'feud' ? 'A feud comes to town' : c.kind === 'raid' ? 'Raiders!' : 'The commons rise', color: '#7a1a1a', text, options: opts, onPick: (k) => {
        O.UI.dialog.close();
        if (k === 'pay') { const n = c.kind === 'raid' ? 40 : 80; if (PS.money < n) return say(`You haven't ₳${n}.`, 'bad'); PS.money -= n; endConflict(c, false, `${lordOf(here)} paid ${c.kind === 'raid' ? c.foe : lordOf(c.a) + "'s men"} to go away.`); return say('Silver changes hands. They go.'); }
        if (k === 'grant') { endConflict(c, true, `${lordOf(here)} met the commons at the cross and cut the dues. They went home.`); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.1); return say('You meet them at the cross and promise lower dues. They cheer you, and go home.'); }
        if (k === 'hide') { c.visibleDay = s.day; const ok = Math.random() < 0.55 + (palisadeOf(s) ? 0.15 : 0); endConflict(c, c.kind === 'feud' ? !ok : !ok); return say(ok ? 'From behind shutters you hear the fight. The watch drives them off.' : 'From behind shutters you hear the fight go badly. They take what they came for.', ok ? '' : 'bad'); }
        c.visibleDay = s.day;
        O.Battle.start({ ours: ourN, theirs: theirN, ourLook: 'guard', theirLook: c.kind === 'revolt' ? 'commons' : c.kind === 'feud' ? 'guard' : 'outlaw', theirBanner: c.kind === 'feud' ? '#2a4a8a' : '#2a2a2a', ourStr: (drillOf(s) ? 1.2 : 1) * (palisadeOf(s) ? 1.15 : 1), title: `${c.kind === 'raid' ? 'Raiders' : c.kind === 'feud' ? 'The feud' : 'The rising'} at ${s.world.name}: walk up to them and press E to strike.`, onEnd: (won, info) => {
          endConflict(c, c.kind === 'feud' ? !won : !won);
          if (won) { PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.08 + info.kills * 0.02); PS.rep.guard = Math.min(1, PS.rep.guard + 0.05); if (mine) PS.money += c.kind === 'raid' ? 15 : 0; }
          O.UI.dialog.open({ name: won ? 'Victory' : 'Defeat', color: won ? '#2a5a2a' : '#5a1a1a', text: won ? `They're beaten. ${info.theirLost} of theirs lie on the road; ${info.ourLost} of ours are hurt or worse.${info.kills ? ` You struck down ${info.kills} yourself.` : ''}` : `It goes badly. ${info.ourLost} of ours are down, and ${c.kind === 'raid' ? 'the raiders loot the edge of town before they go' : 'they have their way'}.`, options: [{ key: 'ok', label: 'Go on' }], onPick: () => O.UI.dialog.close() });
        } });
      } });
    });

    // ================================================================ the leaders' War tab
    // defences take time: a palisade is three days' work; drilling the levy counts from the day after
    const absNow = () => K.sim.day * 1440 + K.sim.minute;
    const palisadeOf = (s) => !!s.palisade || (s.palisadeAt != null && absNow() >= s.palisadeAt);
    const drillOf = (s) => (s.drillQ || []).filter((d) => d <= absNow()).length;
    const leads = (s) => s.lordship?.holder === 'player' || !!(PS.reeveOf || {})[s.world.placeId] || (s === home && PS.reeve) || (O.crowned && O.crowned() && s.world.buildings.some((b) => b.royal));
    O.leadsPlace = leads;
    O.mailHandlers = O.mailHandlers || {};
    O.mailHandlers.tribute = ({ id, here }) => {
      const v = O.Travel?.visited.get(here)?.sim || cur(), ours = men(here) * (drillOf(v) ? 1.25 : 1), theirs = men(id);
      if (Math.random() < ours / (ours + theirs * 1.6)) { const n = 20 + Math.round(Math.random() * 30); PS.money += n; O.UI.dialog.open({ name: 'Your messenger is back', color: '#4a3a2a', text: `${lordOf(id)} sends ₳${n} back with him rather than quarrel.`, options: [{ key: 'ok', label: 'Good' }], onPick: () => O.UI.dialog.close() }); }
      else { const feud = Math.random() < 0.5 && !busy(id); if (feud) startConflict({ kind: 'feud', a: id, b: here, days: 6, aMen: theirs }); O.UI.dialog.open({ name: 'Your messenger is back', color: '#5a2a1a', text: `${lordOf(id)} sent your messenger back with his ears boxed. They'll not pay.${feud ? ' Worse: their men are out on the roads toward you.' : ''}`, options: [{ key: 'ok', label: 'Go on' }], onPick: () => O.UI.dialog.close() }); }
    };
    O.warTabHTML = () => {
      const s = cur(); if (!leads(s)) return '';
      const here = s.world.placeId, W = K.war, levy = s.people.filter((q) => q.sex === 'm' && q.age >= 16 && q.age < 50 && !q.visitor).length;
      let h = `<h3>War: ${esc(s.world.name)}</h3><table class="ledger">`;
      const pal = palisadeOf(s) ? 'a palisade' : s.palisadeAt ? `a palisade going up (done ${O.dateOf ? O.dateOf(Math.floor(s.palisadeAt / 1440)) : 'soon'})` : 'none', dr = drillOf(s), drp = (s.drillQ || []).length - dr;
      h += `<tr><td>Men who could bear arms</td><td>${levy}</td></tr><tr><td>Defences</td><td>${pal}${dr ? `, the levy drilled ${dr} time${dr > 1 ? 's' : ''}` : ''}${drp ? ` (drilling now: ready tomorrow)` : ''}</td></tr></table>`;
      h += `<div class="topics">${palisadeOf(s) || s.palisadeAt ? '' : '<button data-w="palisade">Raise a palisade (₳120, three days)</button>'}<button data-w="drill" ${drp ? 'disabled' : ''}>Arm and drill the levy (₳40)</button></div>`;
      // the realm's war
      if (W && W.phase === 'war') h += `<h4>The realm at war with ${esc(W.enemy)}</h4><p class="caption">The crown wants men. Each you send strengthens the King's host, and the crown remembers who answered.</p><div class="topics"><button data-w="send">Send 6 men to the King's host</button></div>`;
      else h += `<p class="caption">The realm is at ${W && W.phase === 'tension' ? 'the edge of war' : 'peace'}.</p>`;
      // trouble here
      const mineC = K.conflicts.filter((c) => !c.done && (c.a === here || c.b === here));
      if (mineC.length) h += `<h4>Your quarrels</h4><ul>${mineC.map((c) => `<li>${c.kind === 'feud' ? `A feud with ${esc(lordOf(c.a === here ? c.b : c.a))}` : c.kind === 'raid' ? `${esc(cap(c.foe))} on your roads` : `The commons have risen, led by ${esc(c.leader)}`} <button data-peace="${c.id}">${c.kind === 'revolt' ? 'Cut the dues' : 'Make peace (₳60)'}</button></li>`).join('')}</ul>`;
      // neighbours
      const nb = near2(here).filter((x) => K.place(x)?.kind !== 'capital').slice(0, 8);
      if (nb.length) h += `<h4>Your neighbours</h4><table class="ledger">${nb.map((id) => `<tr><td><b>${esc(lordOf(id))}</b><br><small class="lbl">${men(id)} men</small></td><td><div class="topics" style="margin:0"><button data-trib="${id}">Demand tribute</button><button data-feud="${id}" ${busy(id) ? 'disabled' : ''}>Raise a feud</button></div></td></tr>`).join('')}</table>`;
      // who's who
      const Rr = R(); if (Rr) h += `<h4>Who's who</h4><p class="caption">${Rr.crown ? `The crown: ${esc(K.crownTitle())}. ` : ''}${esc(O.whoIsDuke())}</p>`;
      const news = K.conflicts.filter((c) => !c.done).slice(-5);
      if (news.length) h += `<h4>Trouble in the realm</h4><ul>${news.map((c) => `<li>${c.kind === 'feud' ? `${esc(lordOf(c.a))} against ${esc(lordOf(c.b))}` : c.kind === 'raid' ? `${esc(cap(c.foe))} near ${esc(placeName(c.b))}` : `The commons risen at ${esc(placeName(c.b))}`}</li>`).join('')}</ul>`;
      return h;
    };
    O.bindWarTab = (r, reopen) => {
      const s = cur(), here = s.world.placeId, purse = () => (s.lordship?.holder === 'player' || O.crowned?.()) ? PS : PS; // (paid from your own purse)
      r.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => {
        const k = b.dataset.w;
        if (k === 'palisade') { if (purse().money < 120) return say('A palisade costs ₳120.', 'bad'); purse().money -= 120; s.palisadeAt = absNow() + 3 * 1440; s.log('Carpenters have begun a palisade of sharpened stakes around the town.', 'politics'); say('Carpenters and labourers set to work on a palisade of sharpened stakes. It will take three days.'); }
        if (k === 'drill') { if (purse().money < 40) return say('Arms and drilling cost ₳40.', 'bad'); purse().money -= 40; (s.drillQ = s.drillQ || []).push(absNow() + 20 * 60); s.log('The men of the town are drilling with spear and bill on the green.', 'politics'); say('Spears and bills are bought, and the men drill on the green this evening. They will be the better for it by tomorrow.'); }
        if (k === 'send') { const host = K.war.armies.find((a) => a.side === 'crown' && a.men > 0); if (host) host.men += 6; PS.rep.guard = Math.min(1, PS.rep.guard + 0.06); PS.warSent = (PS.warSent || 0) + 6; s.log(`Six men of ${s.world.name} marched off to join the King's host.`, 'war'); say('Six men take up their spears and march off to join the King\'s host. Their families watch them go.'); }
        reopen();
      });
      r.querySelectorAll('[data-trib]').forEach((b) => b.onclick = () => {
        const id = b.dataset.trib;
        if ((PS.mail || []).some((m) => m.kind === 'tribute' && m.data.id === id)) return say(`Your messenger is still on the road to ${lordOf(id)}.`, 'bad');
        O.sendMail('tribute', { id, here }, 6 + Math.random() * 18, `${lordOf(id)}'s answer to your demand for tribute`);
        say(`A messenger rides off to ${lordOf(id)} with your demand. The answer will come back with him.`); reopen();
      });
      r.querySelectorAll('[data-feud]').forEach((b) => b.onclick = () => {
        const id = b.dataset.feud; O.Panels.close();
        const c = startConflict({ kind: 'feud', a: here, b: id, days: 8, aMen: men(here) });
        O.UI.dialog.open({ name: 'A feud', color: '#5a2a1a', text: `You send ${lordOf(id)} your defiance. Will you lead your men out to meet theirs on the road, or let the feud take its course?`, options: [{ key: 'lead', label: 'Lead them out now' }, { key: 'wait', label: 'Let it take its course' }], onPick: (k) => {
          O.UI.dialog.close(); if (k !== 'lead') return;
          c.visibleDay = s.day;
          O.Battle.start({ ours: Math.min(18, men(here)), theirs: Math.min(18, men(id)), ourLook: 'guard', theirLook: 'guard', theirBanner: '#2a4a8a', ourStr: drillOf(s) ? 1.2 : 1, title: `Your men against ${lordOf(id)}'s: press E near one of theirs to strike.`, onEnd: (won) => { endConflict(c, won); say(won ? `${lordOf(id)}'s men are beaten. The feud is yours.` : `You are beaten off. ${lordOf(id)} has the better of the feud.`, won ? '' : 'bad'); if (won) PS.money += 30; } });
        } });
      });
      r.querySelectorAll('[data-peace]').forEach((b) => b.onclick = () => {
        const c = K.conflicts.find((x) => x.id === +b.dataset.peace); if (!c) return;
        if (c.kind === 'revolt') { endConflict(c, true, `${lordOf(here)} cut the dues, and the commons went home.`); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.08); }
        else { if (PS.money < 60) return say('That takes ₳60.', 'bad'); PS.money -= 60; c.done = true; K.addNews(`${lordOf(here)} paid for peace, and the ${c.kind === 'raid' ? 'raiders went away' : 'feud is over'}.`, 'war', here); }
        reopen();
      });
    };
  }
  O.WarfareSetup = { setup };
})();
