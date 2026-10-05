// Three things of the town's life that come to you.
// Disguise: the tailor sells a black hood and mask (black clothes and a cloth over the face). In it,
// nobody knows you: witnesses can only say a masked figure of such a height and build, and once it's
// off nobody can tie that to you. The watch, if they take you in it, strip it off and keep it (it's
// sold for the town). Gang members wear the same on their night work.
// The moneylender lends against your name: borrow at a fifth on top, to be paid within the week;
// run late and the debt grows a tenth a day, and after three days someone comes to collect.
// Letters: the people who know you write to you (a master who missed you at work, a landlord owed
// rent, a friend asking you for an ale, the gang's boss wanting a word, the moneylender reminding
// you); a messenger finds you in the street and hands it over, and you can read it again later.
// (The words are written from a few set forms for now; later an AI key will write them.)
'use strict';
(function () {
  function setup(game, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t)), G = O.Data.GOODS, P = O.Pal;

    // ---------------------------------------------------------------- disguises
    function disguised(base, d) {
      const o = Object.assign({}, base.outfit), m = (hex) => (hex ? P.mat(hex, 'cloth') : null);
      if ('hat' in d) o.hat = d.hat; if (d.hatMat) o.hatMat = m(d.hatMat); if ('cloak' in d) o.cloak = m(d.cloak); if (d.over) o.over = m(d.over); if (d.overLen != null) o.overLen = d.overLen; if (d.mask) { o.mask = true; o.trim = null; o.apron = null; o.belt = m('#121016'); }
      return Object.assign({}, base, { outfit: o, cacheVer: 0 });
    }
    O.wearDisguise = (k) => {
      const p = game.player;
      if (PS.disguise === k) { if (p._baseA) p.a = p._baseA; PS.disguise = null; say('You take off the disguise and are yourself again.'); }
      else {
        if (!PS.items.includes(k)) return;
        const base = p._baseA || p.a; p._baseA = base; p.a = disguised(base, G[k].disguise); PS.disguise = k;
        say('You pull on the black hood and tie the cloth over your face. Nobody would know you now.');
      }
      p.anim = 'place'; p.ft = 0; setTimeout(() => { if (p.anim === 'place') p.anim = 'idle'; }, 700);
      const s = cur(); for (let i = 0; i < 3; i++) s.tick(1);
    };
    // the disguise comes off if you no longer have it; it's put back on after a reload
    game.hooks.update.push(() => {
      const p = game.player;
      if (PS.disguise && !PS.items.includes(PS.disguise)) { if (p._baseA) p.a = p._baseA; PS.disguise = null; }
      if (PS.disguise && !p._baseA) { const k = PS.disguise; PS.disguise = null; O.wearDisguise(k); }
    });

    // masked, you're nobody: what you do isn't laid at your door, and people won't talk to a mask
    const SP = O.Sim.prototype, _rel = SP.relate, _rem = SP.remember;
    SP.relate = function (a, b, d) { if (b && b.id === 0 && PS.disguise) return; return _rel.call(this, a, b, d); };
    SP.remember = function (p, text, kind, str, about) { if (about === 0 && PS.disguise) { text = String(text).replace(/the stranger|the newcomer|a stranger/gi, 'a masked figure'); about = null; } return _rem.call(this, p, text, kind, str, about); };
    const _open = npcUI.openTalk;
    npcUI.openTalk = (q) => {
      if (!PS.disguise || (q.gang && q.gang !== 'player')) return _open(q);
      const pos = game.scene ? game.scene.personPos(q) : [q.agent.x, q.agent.y]; if (pos) q.agent.dir = O.dirOf(game.player.x - pos[0], game.player.y - pos[1]);
      q.agent.shockedUntil = (cur().minute || 0) + 1;
      O.UI.dialog.open({ name: q.first, color: '#6a5a4a', text: ['Who are you? Show your face!', "I don't talk to masked folk. Be off.", 'Keep back! I know what a mask means.', 'Take that off, or go away.'][(q.id + cur().day) % 4], options: [] });
    };
    // gang hands go masked and hooded on their night work
    game.hooks.update.push(() => {
      const s = cur(); if (!s || game.scene) return; const night = s.hour >= 21 || s.hour < 5;
      for (const q of s.people) { if (!q.gang || q.gang === 'player' || !q.agent) continue; const want = night && q.agent.inside == null && !q.agent.hidden ? O.Justice.maskedLook(q.app) : q.app; if (q.agent.a !== want) q.agent.a = want; }
    });

    // the royal rooms: the monarch's chamber only for the monarch and consort, the family's for the family
    O.castleMayEnter = (it) => {
      if (!it.locked) return true;
      const roles = (O.Employment ? O.Employment.posts() : []).map((e) => e.role);
      if (it.locked === 'monarch') return roles.includes('monarch') || roles.includes('consort');
      if (it.locked === 'player') return true; // (it's only there while you hold a post here)
      return roles.some((r) => ['monarch', 'consort', 'heir', 'prince', 'princess'].includes(r));
    };

    // ---------------------------------------------------------------- the moneylender
    const loans = () => (PS.loans = PS.loans || []);
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => {
      const out = prevExtra ? prevExtra(q) : [], s = cur();
      if (q.job?.role === 'moneylender' && q.agent.inside === q.job.biz) {
        const l = loans().find((x) => x.place === s.world.placeId && x.biz === q.job.biz);
        out.push(l ? ['repay', `Pay back what I owe (₳${Math.ceil(l.owe)})`] : ['borrow', 'Borrow money']);
      }
      return out;
    };
    npcUI.onExtra = (q, key, render) => {
      if (key !== 'borrow' && key !== 'repay') return prevOn && prevOn(q, key, render);
      const s = cur(), bz = s.biz.get(q.job.biz);
      if (key === 'repay') {
        const l = loans().find((x) => x.place === s.world.placeId && x.biz === bz.id), owe = Math.ceil(l.owe);
        if (PS.money < owe) { const part = PS.money; if (part < 1) return render('Empty pockets pay no debts.'); PS.money = 0; l.owe -= part; bz.cash += part; return render(`₳${part} off the debt. ₳${Math.ceil(l.owe)} still owing. Don't make me send for you.`); }
        PS.money -= owe; bz.cash += owe; PS.loans = loans().filter((x) => x !== l); s.relate(q, { id: 0 }, 0.15); PS.rep.merchant = Math.min(1, PS.rep.merchant + 0.05);
        return render(`₳${owe}. Paid in full. A pleasure to do business with you.`);
      }
      // how much they'll lend: on your name, your property and your work
      const prop = s.world.buildings.filter((b) => b.owner?.kind === 'player').length, worth = 20 + prop * 60 + (PS.emp ? 20 : 0) + Math.max(0, PS.rep.merchant) * 80 - Math.max(0, -PS.rep.local) * 40;
      const max = Math.max(0, Math.min(Math.floor(bz.cash * 0.8), Math.round(worth / 10) * 10));
      if (max < 10) return render("I don't lend to those I don't know, or those who don't pay. Come back with a house to your name, or a good post.");
      npcUI.closeTalk();
      const opts = [10, 20, 50, 100, 200].filter((v) => v <= max);
      O.Panels.open(`${q.name}, moneylender`, `<p class="speech">“I can let you have up to ₳${max}. A fifth on top, paid back within seven days. Late, and it's a tenth more each day, and I send someone to remind you.”</p><div class="topics">${opts.map((v) => `<button data-l="${v}">Borrow ₳${v} (owe ₳${Math.ceil(v * 1.2)})</button>`).join('')}<button data-n="1">Not today</button></div>`, (r) => {
        r.querySelector('[data-n]').onclick = () => O.Panels.close();
        r.querySelectorAll('[data-l]').forEach((b) => b.onclick = () => { const v = +b.dataset.l; bz.cash -= v; PS.money += v; loans().push({ place: s.world.placeId, placeName: s.world.name, biz: bz.id, bizName: bz.name, lender: q.id, lenderName: q.name, amount: v, owe: v * 1.2, due: s.day + 7, late: 0 }); s.remember(q, `Lent the stranger ₳${v}.`, 'work', 1, 0); O.Panels.close(); say(`${q.first} counts ₳${v} into your hand and writes your name in the book. ₳${Math.ceil(v * 1.2)} by ${O.DAYNAMES[(s.weekday + 7) % 7]} next.`); game.player.anim = 'count'; });
      });
      return null;
    };
    // debts grow when late; someone comes for them
    let lastDebtDay = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!loans().length || lastDebtDay === s.day) return; lastDebtDay = s.day;
      for (const l of loans()) if (s.day > l.due) { l.owe *= 1.1; l.late = s.day - l.due; }
    });
    O.Street.on('debt', (s, q, done) => {
      const l = loans().find((x) => x.place === s.world.placeId), owe = l ? Math.ceil(l.owe) : 0;
      O.Panels.open(`${q.name}`, `<p class="speech">“${l.lenderName} sent me. ₳${owe}, and it's late. Pay up, or I make sure you remember.”</p><div class="topics"><button data-a="pay">Pay ₳${owe}</button><button data-a="no">I haven't got it</button></div>`, (r) => {
        r.querySelector('[data-a=pay]').onclick = () => { if (PS.money < owe) return done("You haven't got it.", true); PS.money -= owe; const bz = s.biz.get(l.biz); if (bz) bz.cash += owe; PS.loans = loans().filter((x) => x !== l); done(`You pay ₳${owe}. ${q.first} grunts and goes.`); };
        r.querySelector('[data-a=no]').onclick = () => { q.agent.anim = 'attack'; PS.hp = Math.max(5, PS.hp - 15); l.due = s.day + 2; game.player.anim = 'shocked'; done(`${q.first} hits you hard, once. “Two days. Then it's worse.”`, true); };
      });
    });
    let debtT = 0;
    game.hooks.update.push((dt) => {
      debtT -= dt; if (debtT > 0 || game.scene || O.panelOpen || O.Street.busy()) return; debtT = 5;
      const s = cur(), l = loans().find((x) => x.place === s.world.placeId && x.late >= 3); if (!l || s.hour < 8 || s.hour > 20) return;
      const p = game.player, q = s.people.find((x) => (x.gang && x.gang !== 'player' || x.job?.role === 'bailiff') && !x.agent.hidden && x.alive !== false && Math.hypot(x.agent.x - p.x, x.agent.y - p.y) < 220);
      if (q) O.Street.sendAt(q, 'debt');
    });

    // ---------------------------------------------------------------- letters to you
    const letters = () => (PS.letters = PS.letters || []);
    let pending = null, lastLetterDay = -1, lt = 0;
    function compose(s) {
      const r = s.rng, e = PS.emp, L = PS.lease;
      const boss = e && e.place === s.world.placeId ? s.byId.get(e.master) : null;
      if (boss && e.stats.missed > (e._missedSeen || 0)) { e._missedSeen = e.stats.missed; return { from: boss, text: `To my ${e.role}. You were not at ${e.bizName} yesterday, and sent no word. I keep a place for those who come. See that you do. ${boss.name}.` }; }
      if (L && L.place === s.world.placeId && L.paidUntil != null && s.day >= L.paidUntil - 1) { const b = s.building(L.b), hh = b && b.owner?.kind === 'household' ? s.households[b.owner.id - 1] : null, ll = hh && s.byId.get(hh.members[0]); if (ll && !L._warned) { L._warned = s.day; return { from: ll, text: `The rent on the house, ₳${L.rent}, falls due ${s.day >= L.paidUntil ? 'today' : 'tomorrow'}. I'll be by for it. ${ll.name}.` }; } }
      const loan = (PS.loans || []).find((x) => x.place === s.world.placeId && x.due - s.day === 1 && !x._warned); if (loan) { loan._warned = true; const q = s.byId.get(loan.lender); if (q) return { from: q, text: `A reminder, friend: ₳${Math.ceil(loan.owe)} by tomorrow, at ${loan.bizName}. I'd hate for us to fall out. ${q.name}.` }; }
      const gm = (PS.gangRanks || []).find((m) => m.place === s.world.placeId && (!m.task || m.task.done) && s.day - (m._summoned || -9) > 3); if (gm) { gm._summoned = s.day; const g = s.gang(gm.gid), b = g && s.byId.get(g.leader); if (b) return { from: b, text: `The boss wants a word. You know where. Burn this.` }; }
      const friends = s.people.filter((q) => q.alive !== false && q.age >= 16 && (q.rel.get(0)?.affinity || 0) > 0.4 && !q.visitor);
      if (friends.length && r.chance(0.5)) { const f = r.pick(friends), tav = s.building(s.tavernId); return { from: f, text: r.pick([`Come to ${tav ? tav.name : 'the tavern'} tonight after the bells. I'll stand you an ale. ${f.first}.`, `My thanks for your kindness the other day. If you need anything, you know my door. ${f.name}.`, `Have you heard what they're saying in the market? Come and find me, I'll tell you. ${f.first}.`]) }; }
      return null;
    }
    O.Street.on('letter', (s, q, done) => {
      const L = pending; pending = null; if (!L) return done(null);
      O.Panels.open('A letter', `<p class="caption">${esc(q.name)} hands you a folded letter, sealed with wax${L.from && L.from !== q ? `, from ${esc(L.from.name)}` : ''}.</p><p class="speech">“${esc(L.text)}”</p><div class="topics"><button data-k="1">Keep it</button></div>`, (r) => {
        r.querySelector('[data-k]').onclick = () => { letters().push({ from: L.from ? L.from.name : 'someone', text: L.text, day: s.day, place: s.world.name }); PS.add && PS.add('letter_in'); done('You fold the letter away.'); };
      });
      q.agent.anim = 'place';
    });
    game.hooks.update.push((dt) => {
      lt -= dt; if (lt > 0 || game.scene || O.panelOpen || O.Street.busy()) return; lt = 6;
      const s = cur(); if (s.hour < 8 || s.hour > 19 || lastLetterDay === s.day) return;
      if (!pending) { pending = compose(s); if (!pending) { lastLetterDay = s.day; return; } }
      // a messenger from the post house if there's one about, else anyone sent with it
      pending.tries = (pending.tries || 0) + 1; const R = pending.tries > 3 ? 700 : 240; // nobody close: whoever's nearest is sent running
      const p = game.player, near = (x) => !x.agent.hidden && x.agent.inside == null && x.alive !== false && !x.agent.frozen && !x.errand && Math.hypot(x.agent.x - p.x, x.agent.y - p.y) < R;
      const q = s.people.find((x) => (x.job?.role === 'messenger' || x.job?.role === 'mounted courier') && near(x)) || s.people.find((x) => x.age >= 10 && x.age < 18 && near(x)) || (pending.from && near(pending.from) ? pending.from : null);
      const q2 = q || (pending.tries > 3 ? s.people.filter((x) => near(x) && x.age >= 10).sort((a, b) => Math.hypot(a.agent.x - p.x, a.agent.y - p.y) - Math.hypot(b.agent.x - p.x, b.agent.y - p.y))[0] : null);
      if (q2) { lastLetterDay = s.day; O.Street.sendAt(q2, 'letter'); }
    });
    O.TownLife = { state: () => ({ pending: pending && pending.text, lastLetterDay, lt }) };
    O.readLetters = () => {
      const L = letters().slice().reverse();
      O.Panels.open('Letters', L.length ? L.map((x) => `<div class="lbl">Day ${x.day}, ${esc(x.place)}, from ${esc(x.from)}</div><p class="speech">“${esc(x.text)}”</p>`).join('') : '<p class="caption">No one has written to you yet.</p>');
    };
  }
  O.TownLifeSetup = { setup };
})();
