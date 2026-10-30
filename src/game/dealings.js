// Work given and taken, in your own words. Anyone with something needing doing may offer you an odd
// job (mend the fence, scrub the yard, help with the hay) for a few aurins; you go there and do it, and
// they pay you. You can do the same: ask someone to fetch you something, carry something to someone,
// or come and work at your place, for what you agree, and they do it. You can take people into your
// service (a servant at home, a guard, a porter, a companion) for a daily wage. And the town does all
// this among itself: the well-off take on a servant, households hire a neighbour for the afternoon.
// Age matters to who becomes friends: people of an age take to each other, children to children.
'use strict';
(function () {
  function setup(game) {
    const SP = O.Sim.prototype, PS = O.PlayerState, cur = () => O.SimRef.cur, clamp = O.clamp, G = () => O.Data.GOODS;
    const abs = (s) => s.day * 1440 + s.minute, T = 16;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const nm = (g) => (G()[g]?.name || g).toLowerCase();
    const myAge = () => (O.Forge && O.Forge.spec && O.Forge.spec().age) || 27;
    const nearMe = (s, q, r = 60) => { if (game.scene) return game.scene.actors.has(q.id); return !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < r; };
    // a few words from them, in their own words, over their head
    const remark = (q, situation) => { if (!O.Speech) return; if (O.AIChat && O.AI && O.AI.ready) O.AIChat.line(q, situation).then((t) => t && O.Speech.say(q, t, 4)); };

    // ================================================================ odd jobs they give you
    const jobs = () => (PS.oddJobs = PS.oddJobs || []);
    function offerJob(s, q, a) {
      const what = String(a.what || '').trim().replace(/[.!]+$/, '').slice(0, 60); if (!what || q.age < 16) return null;
      if (jobs().some((j) => j.from === q.id && j.place === s.world.placeId)) return null;
      const pl = a.where ? O.NpcActs.placeFor(s, q, a.where) : null;
      const b = (pl && pl.b != null ? pl.b : null) ?? (q.job && /shop|work|forge|farm|field|stall|yard/i.test(String(a.where || '')) ? q.job.biz : null) ?? q.home; if (b == null) return null;
      const pay = clamp(Math.round(Number(a.pay) || 3), 1, 30);
      const J = { id: (s.day * 1000 + Math.floor(Math.random() * 999)), place: s.world.placeId, from: q.id, fromName: q.first, what, pay, b, need: 3, done: 0, until: s.day + 2 };
      jobs().push(J);
      O.addLead && O.addLead({ place: J.place, b, why: 'oddjob', key: 'odd:' + J.id, label: `${what[0].toUpperCase() + what.slice(1)} for ${q.first} (₳${pay})`, until: abs(s) + 2880 });
      return `Odd job: ${what}, for ${q.first}, ₳${pay}.`;
    }
    const jobHere = (s) => {
      const P = game.player;
      return jobs().find((j) => { if (j.place !== s.world.placeId) return false; if (game.scene) return (game.scene.b.parent || game.scene.b).id === j.b; const b = s.building(j.b); return b && b.doorX != null && Math.hypot(b.doorX * T + 8 - P.x, b.doorY * T + 8 - P.y) < 52; });
    };
    let working = false;
    const doCand = () => { const s = cur(); if (!s || working) return null; const j = jobHere(s); if (!j) return null; return { type: 'custom', d: 2, x: game.player.x, y: game.player.y - 40, label: `${j.what[0].toUpperCase() + j.what.slice(1)} (${j.done}/${j.need})`, act: () => work(s, j) }; };
    (O.moreCandidates = O.moreCandidates || []).push(doCand); (O.sceneMore = O.sceneMore || []).push(doCand);
    function work(s, j) {
      const p = game.player; working = true; p.anim = 'hammer'; p.ft = 0; p.locked = true;
      setTimeout(() => {
        working = false; p.locked = false; if (p.anim === 'hammer') p.anim = 'idle'; PS.energy = Math.max(0, PS.energy - 4);
        j.done++; if (j.done < j.need) return O.UI.say(`You work at it: ${j.what} (${j.done} of ${j.need}).`);
        PS.oddJobs = jobs().filter((x) => x !== j); O.dropLead && O.dropLead((l) => l.key === 'odd:' + j.id);
        const q = s.byId.get(j.from); if (!q) return;
        const bz = s.biz.get(j.b), hh = s.household(q), purse = bz && bz.owner === q.id ? bz : hh;
        const n = Math.max(0, Math.min(j.pay, Math.floor((purse && (purse.cash ?? purse.money)) || 0)));
        if (purse) { if (purse.cash != null && purse === bz) purse.cash -= n; else purse.money -= n; } PS.money += n;
        const r = relOf(q); r.affinity = clamp(r.affinity + 0.15, -1, 1); r.trust = clamp((r.trust || 0) + 0.1, -1, 1);
        s.remember(q, `The stranger did the job I asked (${j.what}), and did it well.`, 'player', 1, 0.4);
        O.UI.say(n >= j.pay ? `${j.fromName} pays you ₳${n} for the work.` : n > 0 ? `${j.fromName} pays you ₳${n}, all they can spare, and owes you the rest.` : `${j.fromName} has nothing to pay you with just now.`);
        if (nearMe(s, q, 200)) remark(q, `The player has just finished the job you gave them (${j.what}). Thank them${n ? ` and hand over the ₳${n}` : ''}, in a few words.`);
      }, 2200);
    }

    // ================================================================ jobs you give them
    const given = () => (PS.givenJobs = PS.givenJobs || []);
    function takeOn(s, q, a) {
      const kind = String(a.kind || '').toLowerCase(), pay = clamp(Math.round(Number(a.pay) || 2), 0, 40);
      if (q.age < 10 || given().some((x) => x.who === q.id)) return null;
      const J = { who: q.id, name: q.first, place: s.world.placeId, kind, pay, from: abs(s), stage: 0 };
      if (kind === 'fetch') {
        const g = O.NpcActs.goodFor(a.item); if (!g || g === 'coin') return null;
        const shop = [...s.biz.values()].filter((z) => z.def.sells && z.def.sells.includes(g) && (z.stock[g] || 0) >= 1 && z.b && z.b.doorX != null).sort((x, y) => s.price(x, g) - s.price(y, g))[0];
        if (!shop) return null; Object.assign(J, { g, shop: shop.id, label: `${q.first} fetching you ${nm(g)}` });
      } else if (kind === 'deliver') {
        const g = O.NpcActs.goodFor(a.item), to = O.NpcActs.personFor(s, a.to); if (!g || !to || to === q || !PS.items.includes(g)) return null;
        PS.remove(g); O.NpcActs.fly && O.NpcActs.fly('player', q, g); Object.assign(J, { g, to: to.id, toName: to.first, label: `${q.first} taking ${nm(g)} to ${to.first}` });
      } else {
        const pl = a.where ? O.NpcActs.placeFor(s, q, a.where) : null, b = pl && pl.b != null ? pl.b : (PS.residence && PS.residence.place === s.world.placeId ? PS.residence.b : null);
        if (b == null) return null; Object.assign(J, { kind: 'work', b, what: String(a.what || 'work').slice(0, 50), hours: clamp(Math.round(Number(a.hours) || 3), 1, 8), label: `${q.first}: ${String(a.what || 'work').slice(0, 40)}` });
      }
      given().push(J); return `${q.first} will do it, for ₳${pay}.`;
    }
    function payFor(s, q, J, extra = 0) {
      const due = J.pay + extra, n = Math.min(due, Math.max(0, Math.floor(PS.money)));
      PS.money -= n; const hh = s.household(q); if (hh) hh.money += n;
      if (n < due) { O.grudge && O.grudge(s, q, `you never paid me the ₳${due - n} you owed for the work`, 0.3); O.UI.say(`You can't pay ${q.first} all you owe (₳${due}).`, 'bad'); }
      else { const r = relOf(q); r.affinity = clamp(r.affinity + 0.08, -1, 1); }
      PS.givenJobs = given().filter((x) => x !== J);
    }
    // the work going on, and done
    let tk = 0;
    game.hooks.update.push((dt) => {
      tk -= dt; if (tk > 0) return; tk = 1;
      const s = cur(); if (!s) return; const t = abs(s);
      for (const J of given().slice()) {
        if (J.place !== s.world.placeId) continue; const q = s.byId.get(J.who); if (!q || q.alive === false) { PS.givenJobs = given().filter((x) => x !== J); continue; }
        if (J.kind === 'fetch') {
          const shop = s.biz.get(J.shop);
          if (J.stage === 0 && (q.agent.inside === J.shop || t - J.from > 150)) { if (shop && (shop.stock[J.g] || 0) >= 1) { const pr = s.price(shop, J.g); shop.stock[J.g] -= 1; shop.cash += pr; J.cost = pr; J.stage = 1; J.back = t; O.NpcActs.apply(s, q, { do: 'follow' }); } else { PS.givenJobs = given().filter((x) => x !== J); O.UI.say(`${q.first} couldn't get the ${nm(J.g)}.`, 'bad'); } }
          else if (J.stage === 1 && nearMe(s, q, 50) && (!O.npcUI || !O.npcUI.talking())) {
            if (PS.canCarry(J.g)) PS.add(J.g); O.NpcActs.fly && O.NpcActs.fly(q, 'player', J.g); payFor(s, q, J, J.cost || 0);
            O.UI.say(`${q.first} brings you the ${nm(J.g)}. You pay ₳${(J.cost || 0) + J.pay}, the ${nm(J.g)} and the errand.`);
            remark(q, `You have just brought the player the ${nm(J.g)} they sent you for. Hand it over with a word.`); O.NpcActs.walkOff(q);
          } else if (J.stage === 1 && t - J.back > 240) { PS.givenJobs = given().filter((x) => x !== J); }
        } else if (J.kind === 'deliver') {
          const to = s.byId.get(J.to);
          if (to && t - J.from > 60 + (J.who % 4) * 20) {
            (to.items = to.items || []).push(J.g); const r = relOf(to); r.affinity = clamp(r.affinity + 0.06, -1, 1);
            s.remember(to, `${q.first} brought me ${nm(J.g)} from the stranger.`, 'player', 0.8, 0.2);
            payFor(s, q, J); O.UI.say(`${q.first} has taken the ${nm(J.g)} to ${J.toName}.`);
          }
        } else if (J.kind === 'work') {
          if (!J.started && q.agent.inside === J.b) J.started = t;
          if (J.started && t - J.started >= J.hours * 60) {
            payFor(s, q, J); O.UI.say(`${q.first} has done the work (${J.what}) and goes home. You pay ₳${J.pay}.`);
            s.remember(q, `Worked for the stranger: ${J.what}.`, 'work', 0.8);
          } else if (!J.started && t - J.from > 600) PS.givenJobs = given().filter((x) => x !== J);
        }
      }
    });
    // plans bend to the work agreed (theirs for you, service, and the town's own hiring)
    const _plan = SP.plan;
    SP.plan = function (p) {
      const h = this.hour, here = this.world.placeId;
      if (this === O.SimRef.cur) for (const J of given()) {
        if (J.who !== p.id || J.place !== here) continue;
        if (J.kind === 'fetch' && J.stage === 0) return { act: 'visit', b: J.shop };
        if (J.kind === 'deliver') { const to = this.byId.get(J.to); if (to && to.home != null) return { act: 'visit', b: to.agent.inside ?? to.home }; }
        if (J.kind === 'work') return { act: 'visit', b: J.b };
      }
      const R = (PS.retainers || []).find((r) => r.id === p.id && r.place === here);
      if (R && R.as === 'servant' && h >= 7 && h < 19) { const b = PS.residence && PS.residence.place === here ? PS.residence.b : null; if (b != null) return { act: 'visit', b }; }
      if (p.servantOf != null && h >= 8 && h < 16 && this.weekday !== 6) { const hh = this.households[p.servantOf - 1]; if (hh && hh.home != null) return { act: 'visit', b: hh.home }; }
      if (p.oddFor && p.oddFor.day === this.day && h >= 13 && h < 16) return { act: 'visit', b: p.oddFor.b };
      return _plan.call(this, p);
    };

    // ================================================================ taking people into your service
    const KINDS = { servant: 'servant', maid: 'servant', cook: 'servant', guard: 'guard', bodyguard: 'guard', porter: 'porter', companion: 'companion', squire: 'companion', page: 'companion' };
    function retain(s, q, a) {
      const as = KINDS[String(a.as || '').toLowerCase()] || 'companion', wage = clamp(Math.round(Number(a.wage) || 3), 1, 20);
      if (q.age < 14 || (PS.retainers || []).some((r) => r.id === q.id)) return null;
      if (q.job) { const old = s.biz.get(q.job.biz); if (old) old.workers = old.workers.filter((id) => id !== q.id); q.job = null; }
      q.servantOf = null;
      (PS.retainers = PS.retainers || []).push({ place: s.world.placeId, id: q.id, name: q.first, as, wage, since: s.day, unpaid: 0 });
      s.remember(q, `Went into the stranger's service as their ${as}, for ₳${wage} a day.`, 'work', 1.2, 0.3);
      return `${q.first} is in your service now, as your ${as} (₳${wage} a day).`;
    }
    function dismiss(s, q) {
      const R = (PS.retainers || []).find((r) => r.id === q.id); if (!R) return null;
      PS.retainers = PS.retainers.filter((r) => r !== R); O.NpcActs.walkOff(q); s.remember(q, 'Left the stranger\'s service.', 'work', 1);
      return `${q.first} leaves your service.`;
    }
    // wages, each morning; and the followers keep at your side by day
    let wday = null, ft = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      if (wday !== s.day) {
        if (wday != null) for (const R of (PS.retainers || []).slice()) {
          if (PS.money >= R.wage) { PS.money -= R.wage; R.unpaid = 0; const z = O.Travel?.visited.get(R.place)?.sim?.byId.get(R.id) || s.byId.get(R.id); const hh = z && (O.Travel?.visited.get(R.place)?.sim || s).household(z); if (hh) hh.money += R.wage; }
          else if (++R.unpaid >= 2) { PS.retainers = PS.retainers.filter((x) => x !== R); O.UI.say(`${R.name} has left your service: two days unpaid.`, 'bad'); const z = s.byId.get(R.id); if (z) O.grudge && O.grudge(s, z, 'you kept me in your service and never paid me', 0.4); }
          else O.UI.say(`You couldn't pay ${R.name} today.`, 'bad');
        }
        wday = s.day;
      }
      ft -= dt; if (ft > 0) return; ft = 3;
      const h = s.hour; if (h < 7 || h >= 21 || game.sleepState) return;
      for (const R of PS.retainers || []) {
        if (R.place !== s.world.placeId || R.as === 'servant') continue;
        const q = s.byId.get(R.id); if (!q || q.alive === false || (O.npcUI && O.npcUI.talking() === q)) continue;
        if (!O.NpcActs.following(q)) O.NpcActs.apply(s, q, { do: 'follow' });
      }
    });
    // a porter carries for you: more room in the satchel while one is at your side
    { const _can = PS.canCarry;
      PS.canCarry = function (k, n = 1) { if (_can.call(this, k, n)) return true; const s = cur(); const porter = s && (PS.retainers || []).some((r) => r.as === 'porter' && r.place === s.world.placeId && O.NpcActs.following(s.byId.get(r.id) || { id: -1 })); return !!porter && this.slotsUsed() + (G()[k]?.slots || 1) * n <= 18; }; }
    // a guard stands with you in a fight
    if (O.Combat && O.Combat.provoke) { const _pv = O.Combat.provoke; O.Combat.provoke = function (q, how) { const r = _pv.apply(this, arguments); try { const s = cur(); if (how === 'fight' && s) for (const R of PS.retainers || []) { if (R.as !== 'guard' || R.place !== s.world.placeId) continue; const z = s.byId.get(R.id); if (z && z !== q && nearMe(s, z, 160) && O.Speech) { O.Speech.say(z, 'Stand back from my master!', 2.5, 'shout'); q.health && (q.health.hp = Math.max(1, q.health.hp - 15)); } } } catch (e) { /* no fight to join */ } return r; }; }

    // ================================================================ the town among itself
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      const idle = this.people.filter((p) => p.alive !== false && !p.job && p.age >= 16 && p.age < 58 && p.servantOf == null && !(PS.retainers || []).some((x) => x.id === p.id) && !p.visitor && (this.household(p)?.money || 0) < 40);
      // yesterday's odd jobs are paid; servants are paid
      for (const p of this.people) {
        if (p.oddFor && p.oddFor.day === this.day - 1) { const hh = this.households[p.oddFor.hh - 1], mine = this.household(p); if (hh && mine && hh.money >= p.oddFor.pay) { hh.money -= p.oddFor.pay; mine.money += p.oddFor.pay; this.remember(p, `Did an afternoon's work for the ${hh.surname} household, for ₳${p.oddFor.pay}.`, 'work', 0.6); const boss = hh.members.map((id) => this.byId.get(id)).find((z) => z && z.age >= 18); if (boss) this.relate(boss, p, 0.05); } p.oddFor = null; }
        if (p.servantOf != null) { const hh = this.households[p.servantOf - 1], mine = this.household(p); if (!hh || hh.money < 3) { p.servantOf = null; this.remember(p, 'Let go from service: they could no longer pay me.', 'work', 1); } else if (mine) { hh.money -= 3; mine.money += 3; } }
      }
      for (const hh of this.households) {
        if (!hh.members.length || hh.home == null) continue;
        // the well-off take on a servant
        if (hh.money > 180 && !this.people.some((p) => p.servantOf === hh.id) && idle.length && this.rng.chance(0.15)) {
          const p = idle.splice(Math.floor(this.rng.next() * idle.length), 1)[0]; p.servantOf = hh.id;
          this.remember(p, `Went into service with the ${hh.surname} household, ₳3 a day.`, 'work', 1.1);
          this.log(`${p.name} has gone into service with the ${hh.surname} household.`, 'economy');
        }
        // a hand for the afternoon
        else if (hh.money > 40 && idle.length && this.rng.chance(0.05)) {
          const p = idle.splice(Math.floor(this.rng.next() * idle.length), 1)[0]; if (p.household === hh.id) continue;
          p.oddFor = { hh: hh.id, b: hh.home, day: this.day, pay: 2 + this.rng.int(0, 4) };
        }
      }
      return r;
    };

    // ================================================================ age, in who takes to whom
    const kinOf = (a, b) => a.spouse === b.id || b.spouse === a.id || (a.parents || []).includes(b.id) || (b.parents || []).includes(a.id) || (a.children || []).includes(b.id) || (a.household != null && a.household === b.household);
    const _rel = SP.relate;
    SP.relate = function (a, b, d) {
      if (d > 0 && a && a.age != null && b) {
        const bAge = b.age != null ? b.age : b.id === 0 ? myAge() : null;
        if (bAge != null && !(b.id !== 0 && kinOf(a, b))) {
          const young = Math.min(a.age, bAge), gap = Math.abs(a.age - bAge);
          d *= (young < 14 && Math.max(a.age, bAge) >= 18) ? 0.3 : gap <= 10 ? 1 : gap <= 20 ? 0.65 : 0.4;
        }
      }
      return _rel.call(this, a, b, d);
    };

    // ================================================================ what they know of it
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [], age = myAge(), gap = Math.abs(q.age - age);
      out.push(`The player is about ${age} years old${gap > 20 ? ', a good deal ' + (age > q.age ? 'older' : 'younger') + ' than you' : ''}. Age matters: close friendship or courting across a wide gap in years is rare, and grown folk treat children as children.`);
      const mine = jobs().filter((j) => j.from === q.id && j.place === s.world.placeId);
      if (mine.length) out.push(`You gave the player an odd job: ${mine.map((j) => `${j.what} for ₳${j.pay} (${j.done} of ${j.need} done)`).join('; ')}.`);
      else if (q.age >= 16 && q.home != null) out.push('If you have a small job wanting doing (fitting your trade, home and purse) and the player wants work, or you want a hand, you may offer them an odd job: odd_job {"what","where","pay"}.');
      const g = given().find((x) => x.who === q.id); if (g) out.push(`You are doing a job for the player: ${g.label}, for ₳${g.pay}.`);
      else if (q.age >= 10) out.push('If the player asks you to do something for them for pay (fetch them something from a shop, take something to someone, or work at their place), and you agree, do_job {"kind":"fetch"|"deliver"|"work","item"?,"to"?,"where"?,"what"?,"hours"?,"pay"}.');
      const R = (PS.retainers || []).find((r) => r.id === q.id);
      if (R) out.push(`You are in the player's service as their ${R.as}, for ₳${R.wage} a day${R.unpaid ? ` (they owe you for ${R.unpaid} day${R.unpaid > 1 ? 's' : ''})` : ''}. If you want to leave it, or they let you go, dismiss.`);
      else if (q.age >= 14 && !(q.job && /lord|lady|king|queen|mayor|reeve|master|captain/.test(q.job.role))) out.push('If the player offers to take you into their service (as servant, guard, porter or companion) for a daily wage you think fair, you may accept: retain {"as","wage"}.');
      if (q.servantOf != null) { const hh = s.households[q.servantOf - 1]; if (hh) out.push(`You are in service with the ${hh.surname} household.`); }
      return out.join(' ');
    });
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'odd_job') return offerJob(s, q, a);
      if (a && a.do === 'do_job') return takeOn(s, q, a);
      if (a && a.do === 'retain') return retain(s, q, a);
      if (a && a.do === 'dismiss') return dismiss(s, q);
      return base.apply(this, arguments);
    };
    O.Dealings = { jobs, given, retain, offerJob, takeOn };
  }
  O.DealingsSetup = { setup };
})();
