// People get together. Ordinary folk give suppers, keep their name-days with a feast, and on a
// Saturday night there's dancing at the tavern; whoever is fond of you is likely to ask you along. Tell
// someone you're lonely and need friends, and they may write round to theirs and get them to come and
// meet you somewhere; or throw a gathering of their own. At a gathering the guests dance, laugh and
// drink, a fiddle plays, and they say things to each other in their own words.
// And a good deal more that people can do when you talk to them: heal you, bless you, put in a word for
// you, swear friendship, wrestle or race you, tell you a secret, spread word about someone, borrow from
// you. Your master hears your notice, your plea for a raise or a day off from your own mouth (or by
// letter), and answers it.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const SP = O.Sim.prototype, PS = O.PlayerState, cur = () => O.SimRef.cur, clamp = O.clamp, say = (t, k) => O.UI.say(t, k);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const myAge = () => (O.Forge && O.Forge.spec && O.Forge.spec().age) || 27;
    const abs = (s) => s.day * 1440 + s.minute;
    const hstr = (h) => (O.hourStr ? O.hourStr(h) : Math.floor(h) + ':00');
    const friendsOf = (s, q, n = 5, byAge = null) => [...q.rel.entries()].filter(([id, r]) => id !== 0 && r.affinity > 0.15).map(([id]) => s.byId.get(id)).filter((z) => z && z.alive !== false && z.age >= 14 && !z.visitor && z.home != null).sort((a, b) => byAge == null ? 0 : Math.abs(a.age - byAge) - Math.abs(b.age - byAge)).slice(0, n);
    const invite = (s, e) => { O.addLead && O.addLead({ place: s.world.placeId, b: e.b ?? undefined, tile: e.tile || undefined, why: 'event', key: 'ev:' + e.id, label: `${e.title}, ${O.dateOf ? O.dateOf(e.day) : 'day ' + e.day} ${hstr(e.from)}`, from: e.day * 1440 + e.from * 60, until: e.day * 1440 + e.to * 60 }); };
    const lc = (t) => (/^(Supper|A |Dancing)/.test(t) ? t[0].toLowerCase() + t.slice(1) : t); // (names keep their capitals)
    const nid = () => Date.now().toString(36) + Math.floor(Math.random() * 999);

    // ---------------------------------------------------------------- what townsfolk throw for themselves
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      const evs = (this.npcEvents = this.npcEvents || []), day = this.day + 1 + (this.rng.chance(0.5) ? 1 : 0);
      const clash = (d, f, t) => O.eventClash && O.eventClash(this, d, f, t);
      for (const p of this.people) {
        if (p.alive === false || p.visitor || p.age < 18 || p.home == null) continue;
        const hh = this.household(p); if (!hh || hh.members[0] !== p.id) continue; // one host per house
        const yearDay = ((this.day) % 56) + 1;
        let kind = null;
        if (p.birthday === yearDay && hh.money > 15) kind = 'nameday';
        else if (hh.money > 30 && this.rng.chance(this.has(p, 'social') ? 0.05 : 0.015)) kind = 'supper';
        if (!kind || evs.some((x) => x.host === p.id && x.day >= this.day)) continue;
        const guests = friendsOf(this, p, kind === 'nameday' ? 7 : 4, p.age).map((z) => z.id); if (guests.length < 2) continue;
        const d = kind === 'nameday' ? this.day + 1 : day, from = kind === 'nameday' ? 18 : 18.5, to = kind === 'nameday' ? 22 : 21.5;
        const e = { id: nid(), kind, title: kind === 'nameday' ? `${p.first}'s name-day feast` : `Supper at the ${p.sur || p.first} house`, b: p.home, day: d, from, to, host: p.id, guests, small: true, party: true };
        evs.push(e); hh.money -= kind === 'nameday' ? 8 : 4;
        for (const id of guests) { const z = this.byId.get(id); if (z) this.remember(z, `${p.first} has asked me to ${lc(e.title)}.`, 'social', 0.6); }
        if (this === O.SimRef.cur && relOf(p).affinity > 0.3) { e.guests.push(0); invite(this, e); say(`Word comes from ${p.first}: you're bidden to ${lc(e.title)}, ${O.dateOf ? O.dateOf(d) : ''} at ${hstr(from)}.`); }
      }
      // Saturday night at the tavern: a fiddler, and dancing
      if (this.tavernId != null && (this.weekday + 1) % 7 === 5 && !evs.some((e) => e.kind === 'dance' && e.day === this.day + 1) && !clash(this.day + 1, 19, 23)) {
        const tav = this.building(this.tavernId); evs.push({ id: nid(), kind: 'dance', title: `Dancing at ${tav ? tav.name : 'the tavern'}`, b: this.tavernId, day: this.day + 1, from: 19, to: 23, open: true, party: true, small: true });
      }
      return r;
    };
    // the bidden go (ahead of the town's own gatherings)
    const _plan = SP.plan;
    SP.plan = function (p) {
      const evs = this.npcEvents;
      if (evs && evs.length && !p.task && p.age >= 4 && !p.health?.illness && p.alive !== false) {
        const h = this.hour;
        for (const e of evs) {
          if (!e.guests || e.day !== this.day || h < e.from || h >= e.to) continue;
          if (e.host === p.id || e.guests.includes(p.id)) return e.b != null ? { act: 'socialise', b: e.b } : { act: 'festival', outdoor: true, zone: 'square' };
        }
      }
      return _plan.call(this, p);
    };
    // ---------------------------------------------------------------- the life of a gathering, when you're there
    const hereNow = (s) => (s.npcEvents || []).find((e) => e.party && e.day === s.day && s.hour >= e.from && s.hour < e.to && ((e.b != null && game.scene && (game.scene.b.parent || game.scene.b).id === e.b) || (e.tile && !game.scene && Math.hypot(game.player.x - e.tile[0] * T, game.player.y - e.tile[1] * T) < 180)));
    let at = 0, talkAt = 0;
    game.hooks.update.push((dt) => {
      at -= dt; talkAt -= dt; if (at > 0) return; at = 2.2;
      const s = cur(); if (!s || O.panelOpen) return; const e = hereNow(s); if (!e) return;
      const there = game.scene ? [...game.scene.actors.values()].map((a) => a.person).filter((z) => z && z.age >= 3 && !(O.npcUI && O.npcUI.talking() === z)) : [];
      if (!there.length) return;
      // first time in: the guests are introduced
      if (!e.met) { e.met = true; const host = s.byId.get(e.host); for (const z of there) { const r = relOf(z); r.familiar = Math.max(r.familiar || 0, 0.18); r.affinity = clamp(r.affinity + (e.forYou ? 0.1 : 0.04), -1, 1); if (host && relOf(host).name && !r.name) r.name = relOf(host).name; } if (e.forYou && host) say(`${host.first} brings their friends over to meet you.`); }
      const z = there[Math.floor(Math.random() * there.length)];
      const moves = e.kind === 'dance' ? ['dance', 'dance', 'dance', 'laugh', 'celebrate'] : ['laugh', 'nod', 'celebrate', 'dance', 'gesture'];
      O.gesture && O.gesture(z, moves[Math.floor(Math.random() * moves.length)], 2 + Math.random() * 2);
      if (e.kind === 'dance' || e.kind === 'nameday') { const f = [262, 294, 330, 349, 392, 440][Math.floor(Math.random() * 6)]; O.Sound && O.Sound.play('pluck', f, 0.5); setTimeout(() => O.Sound && O.Sound.play('pluck', f * 1.25, 0.4), 220); }
      if (talkAt <= 0 && O.AI && O.AI.ready && O.AIChat && z.age >= 6) {
        talkAt = 14;
        O.AIChat.line(z, `You are at ${lc(e.title)} among friends and neighbours, ${e.kind === 'dance' ? 'with a fiddle playing and people dancing' : 'eating and drinking'}. Say something to those around you, as you would at such a time (not to the player unless they are your friend).`).then((t) => t && O.Speech && O.Speech.say(z, t, 4));
      }
    });

    // ---------------------------------------------------------------- the acts
    const placeEv = (s, q, a, kind, guests, title) => {
      const before = (PS.meets || []).length; const note = O.NpcActs.meet(s, q, { place: a.place || (kind === 'gathering' ? 'the tavern' : 'my home'), hour: a.hour ?? (kind === 'gathering' ? 18 : 19), day: a.day || 'tomorrow', why: a.why || title });
      const m = (PS.meets || [])[before] || (PS.meets || []).filter((x) => x.who === q.id).pop(); if (!note || !m) return null;
      const day = Math.floor(m.at / 1440), from = (m.at % 1440) / 60;
      const e = { id: nid(), kind, title, b: m.b, tile: m.b == null ? m.tile : null, day, from, to: Math.min(23.9, from + 3), host: q.id, guests, small: true, party: true, forYou: kind === 'gathering' };
      (s.npcEvents = s.npcEvents || []).push(e); invite(s, e);
      return { e, m };
    };
    function gather(s, q, a) {
      const guests = friendsOf(s, q, 5, myAge()); if (!guests.length) return null;
      const r = placeEv(s, q, a, 'gathering', guests.map((z) => z.id), `${q.first}'s friends, come to meet you`); if (!r) return null;
      for (const z of guests) { s.remember(z, `${q.first} wrote asking me to come to ${r.m.label} to meet a newcomer who wants friends.`, 'social', 0.8); (z.beliefs = z.beliefs || []).unshift({ t: `${q.first} wants me to meet the newcomer at ${r.m.label}.`, src: 'friend', from: q.first, day: s.day }); }
      return `${q.first} will write to ${guests.length} friends of theirs to come and meet you: ${r.m.label}.`;
    }
    function host(s, q, a) {
      const k = String(a.kind || 'supper').toLowerCase(), guests = friendsOf(s, q, 6, q.age).map((z) => z.id);
      const title = /dance/.test(k) ? `A dance at ${q.first}'s` : /feast|name/.test(k) ? `${q.first}'s feast` : `Supper at ${q.first}'s`;
      const r = placeEv(s, q, a, /dance/.test(k) ? 'dance' : /feast|name/.test(k) ? 'nameday' : 'supper', guests, title); if (!r) return null;
      return `You're bidden to ${lc(title)}: ${r.m.label}.`;
    }
    const roleIs = (q, re) => re.test(q.job?.role || '');
    const posts = () => (O.Employment && O.Employment.posts ? O.Employment.posts() : []);
    const myPost = (s, q) => posts().find((e) => e.master === q.id && e.place === s.world.placeId);
    const A = {
      gather, host,
      heal(s, q, a) {
        if (!roleIs(q, /physician|herbalist|nurse|apothecary|barber|midwife|monk|nun|healer|leech/)) return null;
        const pr = clamp(Math.round(Number(a.price ?? 4) || 0), 0, 30); if (PS.money < pr) return `You haven't the ₳${pr}.`;
        PS.money -= pr; const hh = s.household(q); if (hh) hh.money += pr;
        PS.hp = Math.min(100, (PS.hp || 0) + 35); if (PS.wounds && PS.wounds.length) PS.wounds = PS.wounds.slice(1); if (PS.ill) PS.ill = null;
        O.gesture && O.gesture(q, 'crouch', 2);
        return `${q.first} sees to you${pr ? ` (₳${pr})` : ''}. You feel better.`;
      },
      bless(s, q) { if (!roleIs(q, /priest|bishop|chaplain|monk|nun|abbot|abbess|friar|hermit/)) return null; O.gesture && O.gesture(q, 'pray', 2.5); PS.blessed = s.day; PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.01); return `${q.first} blesses you.`; },
      recommend(s, q, a) { const z = O.NpcActs.personFor(s, a.to); if (!z || z === q) return null; const rz = relOf(z), rq = relOf(q); rz.familiar = Math.max(rz.familiar || 0, 0.25); rz.affinity = clamp(rz.affinity + Math.max(0.05, (rq.affinity || 0) * 0.3), -1, 1); s.remember(z, `${q.first} put in a good word for the stranger.`, 'player', 0.8, 0.2); return `${q.first} will put in a word for you with ${z.first}.`; },
      swear_friendship(s, q) { const r = relOf(q); if (r.affinity < 0.5) return null; q.sworn = true; r.affinity = clamp(r.affinity + 0.15, -1, 1); r.trust = clamp((r.trust || 0) + 0.2, -1, 1); s.remember(q, 'Swore friendship with the stranger.', 'player', 1.5, 0.6); O.gesture && O.gesture(q, 'celebrate', 2); return `You and ${q.first} are sworn friends.`; },
      contest(s, q, a) {
        const k = String(a.kind || 'wrestle').toLowerCase(), P = game.player;
        const mine = (k.includes('drink') ? 0.5 : (PS.hp || 60) / 100) + (PS.skills && PS.skills.combat || 0) * 0.5 + Math.random();
        const theirs = (q.age < 50 && q.age > 16 ? 0.7 : 0.4) + (s.has(q, 'strong') ? 0.3 : 0) + Math.random();
        const anim = k.includes('drink') ? 'drink' : k.includes('race') ? 'celebrate' : 'attack';
        O.gesture && O.gesture(q, anim, 2.5); P.anim = anim; P.ft = 0; setTimeout(() => { if (P.anim === anim) P.anim = 'idle'; }, 2000);
        const won = mine > theirs, r = relOf(q); r.affinity = clamp(r.affinity + 0.05, -1, 1); r.familiar = Math.min(1, (r.familiar || 0) + 0.1);
        if (won) PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.01);
        s.remember(q, `${won ? 'Lost' : 'Beat the stranger'} at ${k}.`, 'social', 0.7);
        return won ? `You beat ${q.first} at ${k}.` : `${q.first} beats you at ${k}.`;
      },
      confide(s, q, a) { const t = String(a.secret || '').slice(0, 140); if (!t || relOf(q).trust < 0.2) return null; (PS.confided = PS.confided || []).push({ who: q.id, name: q.first, place: s.world.placeId, t, day: s.day }); return null; },
      spread(s, q, a) {
        const z = O.NpcActs.personFor(s, a.about), t = String(a.rumour || a.news || '').slice(0, 140); if (!t) return null;
        const good = a.good === true || a.good === 'true';
        for (const f of friendsOf(s, q, 6)) { (f.beliefs = f.beliefs || []).unshift({ t, src: 'friend', from: q.first, day: s.day }); if (z && f !== z) s.relate(f, z, good ? 0.05 : -0.06); }
        return `${q.first} will pass that round.`;
      },
      borrow(s, q, a) { const n = clamp(Math.round(Number(a.amount) || 0), 1, 50); if (PS.money < n) return `You haven't ₳${n} to lend.`; PS.money -= n; const hh = s.household(q); if (hh) hh.money += n; (PS.lent = PS.lent || []).push({ who: q.id, name: q.first, place: s.world.placeId, n, due: s.day + 7 }); O.NpcActs.fly && O.NpcActs.fly('player', q, 'coin'); return `You lend ${q.first} ₳${n}, to be paid back within the week.`; },
      repay(s, q) { const L = (PS.lent || []).find((x) => x.who === q.id); const hh = s.household(q); if (!L || !hh || hh.money < L.n) return null; hh.money -= L.n; PS.money += L.n; PS.lent = PS.lent.filter((x) => x !== L); O.NpcActs.fly && O.NpcActs.fly(q, 'player', 'coin'); return `${q.first} pays you back ₳${L.n}.`; },
      // your master answers you
      day_off(s, q) { const e = myPost(s, q); if (!e) return null; e.dayOff = s.day + 1; e.offAsked = s.day; return `${q.first} gives you tomorrow off.`; },
      raise(s, q, a) { const e = myPost(s, q); if (!e) return null; const n = clamp(Math.round(Number(a.amount) || 1), 1, 5); e.wage += n; return `${q.first} raises your pay to ₳${e.wage} a day.`; },
      release(s, q) { const e = myPost(s, q); if (!e || !O.Employment || !O.Employment.quit) return null; O.Employment.quit(`You leave your place as ${e.role} at ${e.bizName}.`, e); return 'Your service there is over.'; },
    };
    O.extraActs = O.extraActs || [];
    O.extraActs.push(
      'gather {"place","hour","day","why"} (when the player is lonely or wants to meet people and you are willing: you write to your friends and get them to come and meet the player there)',
      'host {"kind":"supper"|"feast"|"dance","place"?,"hour","day"} (you invite the player to a gathering of your own, with your friends)',
      'heal {"price"} (a healer tending the player\'s hurts)', 'bless (a priest or holy person blessing the player)',
      'recommend {"to"} (you put in a good word for the player with someone)', 'swear_friendship (only a dear friend: you swear lasting friendship)',
      'contest {"kind":"wrestle"|"race"|"arm-wrestle"|"drinking"} (a friendly match, if you accept a challenge or make one)',
      'confide {"secret"} (you tell the player a secret of yours, if you trust them)', 'spread {"about","rumour","good":true|false} (you agree to pass word round about someone)',
      'borrow {"amount"} (you borrow money from the player, if they agree)', 'repay (you pay back what you owe the player)',
      'day_off | raise {"amount"} | release (only the player\'s own master: grant a day off, raise their pay, or accept their notice and let them go)');
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) { if (a && A[a.do]) return A[a.do](s, q, a); return base.apply(this, arguments); };
    // what they know, for their card
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [];
      const e = myPost(s, q);
      if (e) { const st = e.stats || {}; out.push(`The player works for you as ${e.role} at ${e.bizName} for ₳${e.wage} a day (${st.shifts || 0} shifts worked, ${st.missed || 0} missed${e.dayOff === s.day + 1 ? '; you gave them tomorrow off' : ''}). If they ask, in their own words or by letter, for a day off, a raise or to leave your service, you decide as you would: day_off, raise {"amount"}, release.`); }
      const L = (PS.lent || []).find((x) => x.who === q.id); if (L) out.push(`You owe the player ₳${L.n}, borrowed to be paid back ${L.due <= s.day ? 'by now' : 'by day ' + L.due}. If you can, repay.`);
      if (q.sworn) out.push('You and the player are sworn friends: you would stand by them in anything.');
      const ev = (s.npcEvents || []).filter((x) => x.party && x.day >= s.day && (x.host === q.id || (x.guests || []).includes(q.id))).map((x) => `${x.title} (${O.dateOf ? O.dateOf(x.day) : 'day ' + x.day}, ${hstr(x.from)})${x.host === q.id ? ', which you are giving' : ''}`);
      if (ev.length) out.push(`Coming up: ${ev.join('; ')}.`);
      return out.join(' ');
    });
    // what you're owed shows in the To do list's kin: a borrower who can pay, does, in time
    let rd = -1;
    game.hooks.update.push(() => { const s = cur(); if (!s || rd === s.day) return; rd = s.day; for (const L of (PS.lent || []).slice()) { if (L.place !== s.world.placeId || s.day < L.due) continue; const q = s.byId.get(L.who), hh = q && s.household(q); if (hh && hh.money >= L.n + 5 && Math.random() < 0.6) { hh.money -= L.n; PS.money += L.n; PS.lent = PS.lent.filter((x) => x !== L); say(`${L.name} pays back the ₳${L.n} you lent.`); } else if (q && s.day > L.due + 3 && !L.sour) { L.sour = true; s.remember(q, 'I still owe the stranger money and cannot pay.', 'player', 0.8, -0.1); } } });
    O.Gatherings = { gather, host, hereNow };
  }
  O.GatheringsSetup = { setup };
})();
