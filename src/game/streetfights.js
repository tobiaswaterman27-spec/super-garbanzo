// Fights between other people, blow by blow. Two square up; each in turn swings, and the other blocks,
// sidesteps or takes it, staggering; their friends may pile in; a ring gathers; it ends when one has had
// enough and gives way (or goes down), or the watch arrive and pull them apart. It's remembered by both,
// and by everyone who saw it. Feuds that come to blows, gangs at war meeting in the street, and a
// soldier's quarrel all end up here.
// Also, in your own fights:
// - say "I yield" (or "enough", "mercy", "peace") to whoever you're fighting and most will let it go;
// - a parried blow may knock the weapon out of their hand, to lie in the road for anyone to take.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const sp = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    const gest = (q, a, secs) => O.gesture && O.gesture(q, a, secs || 0.9);
    const fights = [];
    const tough = (q) => { const r = q.job?.role || ''; return 0.3 + (/guard|sergeant|soldier|smith|butcher|woodcutter|quarry|miner/.test(r) ? 0.25 : 0) + (q.gang ? 0.15 : 0) + (q.sex === 'm' ? 0.1 : 0) + (q.traits.includes('brave') ? 0.1 : 0) - (q.age > 55 ? 0.2 : 0) + (q.homefront === 'soldier' ? 0.25 : 0); };
    function start(s, a, b, o = {}) {
      if (!a || !b || a === b || fights.some((f) => f.sides.flat().some((q) => q === a || q === b))) return null;
      const sideA = [a, ...(o.withA || [])].filter(Boolean), sideB = [b, ...(o.withB || [])].filter(Boolean);
      for (const q of [...sideA, ...sideB]) { q.agent.frozen = true; q.agent.path = null; q._fighting = true; q.errand = null; }
      const f = { s, sides: [sideA, sideB], t: 0, next: 0.6, turn: 0, why: o.why || 'a quarrel', hp: new Map([...sideA, ...sideB].map((q) => [q.id, 30 + tough(q) * 40])) };
      fights.push(f); sp(a, pick(['Come on, then!', 'You asked for it!', 'Put your fists up!']), 1.6);
      s.log(`A fight in the street: ${a.name} and ${b.name}, over ${f.why}.`, 'social');
      return f;
    }
    function end(f, loser, how) {
      const s = f.s; fights.splice(fights.indexOf(f), 1);
      const all = f.sides.flat();
      for (const q of all) { q.agent.frozen = false; q._fighting = false; q.agent.anim = 'idle'; }
      const winners = f.sides.find((sd) => !sd.includes(loser)) || [];
      const losers = f.sides.find((sd) => sd.includes(loser)) || []; for (const q of losers) if (q.raider && how !== 'watch') q._lostFight = true;
      if (how !== 'watch' && loser && loser.health && !loser.health.illness && Math.random() < 0.7) { loser.health.illness = { kind: 'injury', sev: 0.12, days: 0 }; loser._bruiseDay = s.day; } // (a black eye and a sore head, for a day or two)
      if (how === 'watch') { for (const q of all) s.remember(q, 'The watch broke up my fight in the street.', 'social', 1); }
      else { gest(loser, 'hurt', 2); sp(loser, pick(['Enough! Enough.', 'All right, you win.', 'I\'m done. I\'m done.']), 2); if (winners[0]) { gest(winners[0], 'celebrate', 2); sp(winners[0], pick(['And stay down.', 'Next time mind your tongue.', 'Anyone else?']), 2); }
        for (const w of winners) { s.relate(loser, w, -0.25); s.remember(loser, `${w.name} beat me in a fight in the street.`, 'grudge', 2, w.id); s.remember(w, `Beat ${loser.name} in a fight in the street.`, 'social', 1.5, loser.id); } }
      // those who saw it
      for (const z of s.people) { if (all.includes(z) || !z.agent || z.agent.hidden || z.agent.inside != null) continue; const fx = f.sides[0][0].agent; if (Math.hypot(z.agent.x - fx.x, z.agent.y - fx.y) < 180) s.remember(z, `Saw ${f.sides[0][0].first} and ${f.sides[1][0].first} fight in the street.`, 'social', 0.6); }
    }
    let ring = 1;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      for (const f of fights.slice()) {
        if (f.s !== s) { end(f, f.sides[1][0], 'apart'); continue; }
        f.t += dt; f.next -= dt;
        // the two sides face each other, close in
        const [A, B] = f.sides; const ca = A[0].agent, cb = B[0].agent; const mx = (ca.x + cb.x) / 2, my = (ca.y + cb.y) / 2;
        A.forEach((q, i) => { const tx = mx - 11 - i * 4, ty = my + (i ? (i % 2 ? 8 : -8) : 0); q.agent.x += (tx - q.agent.x) * Math.min(1, dt * 4); q.agent.y += (ty - q.agent.y) * Math.min(1, dt * 4); q.agent.dir = 2; });
        B.forEach((q, i) => { const tx = mx + 11 + i * 4, ty = my + (i ? (i % 2 ? 8 : -8) : 0); q.agent.x += (tx - q.agent.x) * Math.min(1, dt * 4); q.agent.y += (ty - q.agent.y) * Math.min(1, dt * 4); q.agent.dir = 1; });
        if (f.next > 0) continue; f.next = 0.75 + Math.random() * 0.4; f.turn = 1 - f.turn;
        const atk = pick(f.sides[f.turn].filter((q) => f.hp.get(q.id) > 0)), defs = f.sides[1 - f.turn].filter((q) => f.hp.get(q.id) > 0), def = pick(defs);
        if (!atk || !def) { end(f, defs.length ? atk : def || f.sides[1 - f.turn][0], 'down'); continue; }
        gest(atk, 'attack', 0.4);
        const r = Math.random(), skill = tough(def) - tough(atk) * 0.5;
        setTimeout(() => {
          if (!fights.includes(f)) return;
          if (r < 0.2 + skill * 0.3) { gest(def, 'block', 0.6); O.sfx && O.sfx('smack', 0.35); }
          else if (r < 0.35 + skill * 0.4) { gest(def, 'dodge', 0.6); }
          else { const dmg = 6 + Math.random() * 8 * (0.6 + tough(atk)); f.hp.set(def.id, f.hp.get(def.id) - dmg); gest(def, 'hurt', 0.6); O.sfx && O.sfx('smack', 0.5); if (O.Combat && O.Combat.hurt) try { O.Combat.hurt(def, dmg * 0.5, false, 'fists'); } catch (e) { /* */ } if (Math.random() < 0.3) sp(def, pick(['Ugh!', 'Agh!', 'Oof!']), 0.9); }
          const out = f.hp.get(def.id) <= 0; if (out) { def.agent.anim = 'hurt'; }
          if (f.sides[1 - f.turn].every((q) => f.hp.get(q.id) <= 0)) end(f, f.sides[1 - f.turn][0], 'down');
        }, 250);
        // the watch, if any are near
        if (f.t > 6 && !f.watched) { const g = s.people.find((q) => /^guard|sergeant/.test(q.job?.role || '') && q.agent && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - mx, q.agent.y - my) < 260); if (g) { f.watched = true; sp(g, 'Break it up! Now!', 2.5); O.Errands && O.Errands.send(s, g, [Math.floor(mx / T), Math.floor(my / T) + 1], { anim: 'point', secs: 2, giveUp: 25, after: () => { if (fights.includes(f)) end(f, f.sides[1][0], 'watch'); } }); } }
        if (f.t > 40) end(f, f.hp.get(A[0].id) < f.hp.get(B[0].id) ? A[0] : B[0], 'down');
      }
      // onlookers gather and shout
      ring -= dt; if (ring > 0 || !fights.length) return; ring = 1.5;
      for (const f of fights) { const c = f.sides[0][0].agent; const watchers = s.people.filter((z) => !z._fighting && z.agent && !z.agent.hidden && z.agent.inside == null && !z.errand && z.age >= 8 && Math.hypot(z.agent.x - c.x, z.agent.y - c.y) < 160).slice(0, 6); watchers.forEach((z, i) => { z.agent.dir = O.dirOf(c.x - z.agent.x, c.y - z.agent.y); if (Math.random() < 0.25) { gest(z, 'celebrate', 1.2); if (Math.random() < 0.4) sp(z, pick(['Fight! Fight!', `Go on, ${f.sides[i % 2][0].first}!`, 'Somebody fetch the watch!', 'Hit him!']), 1.4); } }); }
    });
    O.StreetFight = { start, fights };

    // feuds, gangs at war, and soldiers' trouble come to blows here instead
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () { const r = _nd.apply(this, arguments); try { this._gangClash = 0; } catch (e) { /* */ } return r; };
    let gc = 20;
    game.hooks.update.push((dt) => {
      gc -= dt; if (gc > 0) return; gc = 25;
      const s = cur(); if (!s || game.scene || (s._gangClash || 0) >= 1) return; const h = s.minute / 60; if (h < 19 && h > 2) return;
      const gs = (s.gangs || []).filter((g) => g.id !== 'player'); const P = game.player;
      for (const a of gs) for (const b of gs) { if (a === b || (a.rel || {})[b.id] !== 'enemy') continue;
        const ma = a.members.map((m) => s.byId.get(m.id)).filter((q) => q && q.agent && !q.agent.hidden && q.agent.inside == null && !q._fighting && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 320);
        const mb = b.members.map((m) => s.byId.get(m.id)).filter((q) => q && q.agent && !q.agent.hidden && q.agent.inside == null && !q._fighting);
        if (ma.length && mb.length) { const x = mb[0]; x.agent.x = ma[0].agent.x + 40; x.agent.y = ma[0].agent.y; sp(ma[0], `${b.name.replace(/^the /i, 'The ')} in our streets? Not tonight.`, 2.5); start(s, ma[0], x, { withA: ma.slice(1, 2), withB: mb.slice(1, 2), why: `the war between ${a.name} and ${b.name}` }); s._gangClash = 1; return; } }
    });

    // ---------------------------------------------------------------- your own fights: yielding, and disarming
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      const F = O.Combat && O.Combat.fights;
      if (q && F && F.has(q.id) && typeof text === 'string' && /\b(i yield|i give up|enough|mercy|peace|stop|i surrender|you win|truce)\b/i.test(text)) {
        const f = F.get(q.id), s = cur(), guard = /guard|sergeant|captain/.test(q.job?.role || ''), hard = q.traits.includes('hostile') && (q._punched || 0) > 3;
        let line;
        if (guard) { line = 'Then come quietly.'; F.delete(q.id); q.agent.chasing = false; setTimeout(() => O.lawJail && O.lawJail(q), 1200); }
        else if (hard && Math.random() < 0.5) { line = "Yield? After what you did? No."; }
        else { F.delete(q.id); q.agent.chasing = false; q.agent.anim = 'idle'; s.relate(q, { id: 0 }, 0.05); line = pick(['Then get out of my sight.', 'Fine. But I won\'t forget it.', 'Good. Now leave it.']); }
        void f; (q._conv = q._conv || []).push({ who: 'p', t: text }, { who: 'q', t: line }); render(line); return Promise.resolve();
      }
      return _say.apply(this, arguments);
    };
    // a parry can knock the weapon from their hand
    const CD = O.CombatDeep; if (CD && CD.incoming) { const _in = CD.incoming; CD.incoming = function (q, dmg, f) { const r = _in.apply(this, arguments); if (r === 0 && q.app && q.app.outfit && q.app.outfit.item && ['sword', 'axe', 'dagger', 'spear', 'hammer', 'staff'].includes(q.app.outfit.item) && Math.random() < 0.35) { const s = cur(), it = q.app.outfit.item; q.app.outfit.item = null; O.Char.invalidate(q.app); s.drop && s.drop(it, 1, q.agent.x + 10, q.agent.y + 4); O.UI.say(`You knock the ${O.Data.GOODS[it]?.name.toLowerCase() || it} from ${q.first}'s hand!`, 'good'); sp(q, 'My blade!', 1.4); } return r; }; }
  }
  O.StreetFightSetup = { setup };
})();
