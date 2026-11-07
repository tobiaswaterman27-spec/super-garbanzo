// The working life, deeper. Good and bad work: every shop and kitchen has a quality, from its people's
// skill, its cleanliness and its care, and what you buy from a dirty or careless one can turn your
// belly (stale meat and old milk will, given time, wherever it came from); customers praise good work
// and complain of bad. Rising: keep at it and your master raises you (a trusted hand, then senior, then
// head of the work), with more pay, the key to the stores and a better coat. Orders: customers want a
// thing made by a day, and they wait for it, and are cross when it's late. Mishaps: a slip at the forge
// or the saw, a strained back, and you're sent home. An apprentice of your own, to teach and to send on
// errands (loyal or light-fingered). And the year's own work: lambing, shearing, salting the pig,
// breaking the ice on the well, and the harvest supper.
'use strict';
(function () {
  const T = 16;
  const PERISH = { milk: 2, meat: 3, fish: 2, pie: 3, sausage: 4, stew: 2, meal: 1, cheese: 7, butter: 5, eggs: 6, venison: 3, boarmeat: 3, cake: 3, bread: 4 };
  const RANKS = [null, 'trusted hand', 'senior', 'head'];
  const RISKY = { hammer: ['a burnt hand', 'a hammer on the thumb'], chop: ['a cut foot', 'a split knuckle'], saw: ['a cut hand'], cleave: ['a cut hand'], pitch: ['a strained back'], carry: ['a strained back', 'a turned ankle'], bucket: ['a strained back'], dig: ['a strained back'], cook: ['a scalded arm'], place: ['a burnt hand'] };
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = () => O.Data.GOODS, SP = O.Sim.prototype;
    const sp = (q, t, secs = 3) => O.Speech && O.Speech.say(q, t, secs);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const nm = (k) => (G()[k]?.name || k).toLowerCase();

    // ---------------------------------------------------------------- quality: good work and bad
    function rateBiz(s, bz) {
      const ws = (bz.workers || []).map((id) => s.byId.get(id)).filter(Boolean);
      const skill = ws.length ? ws.reduce((a, q) => a + (q.traits?.includes('lazy') ? -0.12 : 0) + (q.traits?.includes('patient') ? 0.06 : 0) + Math.min(0.15, (q.age - 16) * 0.006), 0) / ws.length : 0;
      const b = s.building(bz.id), dirt = (b && b.dirt) || 0.1;
      const q = clamp(0.66 + skill + (Math.random() - 0.5) * 0.18 - dirt * 0.38 - (bz.neglect || 0) * 0.05 + (bz.playerBoost || 0), 0.08, 0.98);
      bz.quality = bz.quality == null ? q : bz.quality * 0.6 + q * 0.4; bz.rep = bz.rep == null ? bz.quality : bz.rep * 0.8 + bz.quality * 0.2; bz.playerBoost = (bz.playerBoost || 0) * 0.5;
    }
    const qualityWord = (q) => (q > 0.85 ? 'fine' : q > 0.65 ? 'good' : q > 0.45 ? 'middling' : q > 0.28 ? 'poor' : 'bad');
    // what you bought, and from whom: food remembers where it came from and when
    const _add = PS.add.bind(PS);
    PS.add = function (k, n = 1) {
      const got = _add(k, n);
      if (got && G()[k] && (G()[k].food || G()[k].drink)) { const s = cur(), bz = game.scene && s && s.biz.get(game.scene.b.id); (PS.foodQ = PS.foodQ || {})[k] = { q: bz && bz.quality != null ? bz.quality : 0.82, day: s ? s.day : 0, from: bz ? bz.name : null }; }
      return got;
    };
    // eating it: a good loaf is a pleasure; a bad one, or old meat, can lay you low
    const _consume = O.consume;
    O.consume = (k) => {
      const g = G()[k], s = cur(), rec = (PS.foodQ || {})[k];
      _consume && _consume(k);
      if (!g || !(g.food || g.drink) || !s) return;
      const q = rec ? rec.q : 0.82, age = rec ? s.day - rec.day : 0, keep = PERISH[k];
      const stale = keep && age > keep ? Math.min(0.6, (age - keep) * 0.18) : 0;
      const pSick = clamp((1 - q) * 0.32 + stale - (q > 0.8 ? 0.05 : 0), 0, 0.75);
      setTimeout(() => {
        if (stale > 0.2) say(`The ${nm(k)} has gone off. You eat it anyway.`, 'bad'); else if (q > 0.85) say(pick([`Good ${nm(k)}, well made.`, `That was a fine ${nm(k)}.`])); else if (q < 0.4) say(`The ${nm(k)} tastes wrong${rec && rec.from ? `: ${rec.from} keeps a dirty kitchen` : ''}.`, 'bad');
        if (!PS.ill && Math.random() < pSick) { PS.ill = { kind: 'flux', sev: 0.35 + Math.random() * 0.3, day: s.day }; setTimeout(() => say(`Your belly turns over. That ${nm(k)} was bad: you've a flux coming on. Rest, and something plain.`, 'bad'), 2500 + Math.random() * 4000); if (rec && rec.from) { const bz = [...s.biz.values()].find((b) => b.name === rec.from); if (bz) bz.complaints = (bz.complaints || 0) + 1; } }
      }, 600);
      if (rec && rec.q != null) delete PS.foodQ[k]; // (the next one may come from elsewhere)
    };
    // NPCs fall ill from a bad kitchen too, now and then
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        for (const bz of this.biz.values()) rateBiz(this, bz);
        for (const bz of this.biz.values()) { if (bz.quality == null || bz.quality > 0.35 || !(bz.def.sells || []).some((k) => G()[k]?.food)) continue; const victim = this.people.find((q) => !q.health.illness && q.age > 4 && Math.random() < 0.02); if (victim && this.fallIll) { this.fallIll(victim, 'flux', 0.4); this.remember(victim, `Ate something bad from ${bz.name} and was laid up with a flux.`, 'health', 1.5); } }
        daily(this);
      } catch (e) { console.error(e); }
      return r;
    };
    // customers speak of it: praise for good work, complaints at the counter for bad
    let ct = 0;
    game.hooks.update.push((dt) => {
      ct -= dt; if (ct > 0) return; ct = 9; const s = cur(), sc = game.scene; if (!s || !sc) return; const bz = s.biz.get(sc.b.id); if (!bz || bz.quality == null || !(bz.def.sells || []).length) return;
      const custs = [...sc.actors.values()].map((a) => a.person).filter((q) => q && q.job?.biz !== bz.id && q.age >= 12 && !q.agent.frozen);
      const c = custs[Math.floor(Math.random() * custs.length)]; if (!c || Math.random() > 0.35) return; const g = nm((bz.def.sells || [])[0]);
      if (bz.quality < 0.42 || (bz.complaints || 0) > 0) { sp(c, pick([`This ${g} is stale!`, `Last ${g} I had from here turned my stomach.`, `You call this ${g}? My pig eats better.`, `Clean your counter, for pity's sake.`])); O.gesture && O.gesture(c, 'shake', 1.6); bz.complaints = Math.max(0, (bz.complaints || 0) - 1); }
      else if (bz.quality > 0.82) { sp(c, pick([`Best ${g} in the town, this.`, `I'll have two. My wife swears by yours.`, `Fine work, as ever.`])); O.gesture && O.gesture(c, 'nod', 1.4); }
    });
    // what they know of it
    (O.extraLines = O.extraLines || []).push((s, q) => { const bz = q.job && s.biz.get(q.job.biz); if (!bz || bz.quality == null) return ''; return `The work at ${bz.name} is ${qualityWord(bz.quality)} lately${bz.quality < 0.45 ? '; customers have been complaining' : bz.quality > 0.82 ? '; customers praise it' : ''}.`; });

    // ---------------------------------------------------------------- rising in your work
    const titleOf = (e) => { const r = RANKS[e.level || 0]; const role = O.roleName ? O.roleName(e.role) : e.role; return !r ? role : r === 'trusted hand' ? `trusted ${role}` : `${r} ${role}`; };
    O.jobTitle = titleOf;
    function promote(s, e) {
      const boss = e.master != null ? s.byId.get(e.master) : null; const st = e.stats || {};
      const need = [5, 14, 28][e.level || 0]; if (need == null || (st.shifts || 0) < need) return;
      if ((st.missed || 0) > Math.max(1, (st.shifts || 0) / 6) || (boss && ((boss.rel.get(0) || {}).affinity || 0) < 0)) return;
      e.level = (e.level || 0) + 1; e.wage = Math.round(e.wage * 1.2); e.title = titleOf(e);
      e.promoteNote = { level: e.level, day: s.day };
    }
    function daily(s) {
      for (const e of PS.posts || []) { if (e.place !== s.world.placeId) continue; promote(s, e); const bz = s.biz.get(e.biz); if (bz && e.dayInfo && e.dayInfo.arrived != null) { const sk = (PS.skills && PS.skills[O.tradeOf ? O.tradeOf(e, bz) : 'labour']) || 0.3; bz.playerBoost = (bz.playerBoost || 0) + (sk - 0.45) * 0.12; } }
      ordersDay(s); apprenticeDay(s);
    }
    // the master tells you to your face, the next time you're near
    let pt = 0;
    game.hooks.update.push((dt) => {
      pt -= dt; if (pt > 0) return; pt = 1.2; const s = cur(); if (!s) return;
      for (const e of PS.posts || []) {
        if (!e.promoteNote || e.place !== s.world.placeId) continue; const boss = e.master != null ? s.byId.get(e.master) : null;
        const near = !boss || (game.scene ? game.scene.actors.has(boss.id) : !boss.agent.hidden && Math.hypot(boss.agent.x - game.player.x, boss.agent.y - game.player.y) < 70);
        if (!near || (O.npcUI && O.npcUI.talking())) continue;
        const L = e.promoteNote.level; e.promoteNote = null;
        const gifts = L === 2 ? ['key'] : L === 3 ? ['clothes'] : [];
        for (const g of gifts) PS.add(g);
        const line = L === 1 ? `You've done well. You're a trusted hand here now, and your pay goes up to ₳${e.wage} a day.` : L === 2 ? `I'm making you senior ${O.roleName ? O.roleName(e.role) : e.role}. Here's a key to the stores: take what the work needs. ₳${e.wage} a day, and the lad answers to you.` : `From today you're head of the work. A good coat to go with it, and ₳${e.wage} a day. Don't make me regret it.`;
        if (boss && O.npcUI) O.npcUI.startFrom(boss, line); else say(line);
        O.Panels.toast(`You are now ${titleOf(e)} at ${e.bizName}.`);
        if (boss && O.NpcActs && gifts.length) setTimeout(() => O.NpcActs.fly(boss, 'player', gifts[0]), 1200);
        s.remember && boss && s.remember(boss, `Raised the stranger to ${titleOf(e)}.`, 'work', 1.2, 0.05);
      }
    });
    // the senior may give the lad orders (any junior at the same work, by word)
    const juniorOf = (s, q) => { const e = PS.emp; return e && (e.level || 0) >= 2 && q.job && q.job.biz === e.biz && e.place === s.world.placeId && q.id !== e.master; };

    // ---------------------------------------------------------------- orders, with a day to have them by
    const DAYS = O.DAYNAMES || ['Moonday', 'Tewsday', 'Wodensday', 'Thorsday', 'Freyday', 'Saturnday', 'Sunday'];
    const dayName = (s, d) => (d === s.day + 1 ? 'tomorrow' : DAYS[((d - 1) % 7 + 7) % 7] || `day ${d}`);
    function makesOf(bz) { const out = new Set(); for (const r of bz.def.recipes || []) for (const k of Object.keys(r.out || {})) out.add(k); return [...out].filter((k) => G()[k] && !/^fx_/.test(k)); }
    function ordersDay(s) {
      PS.orders = PS.orders || [];
      for (const o of PS.orders.slice()) { if (o.place !== s.world.placeId || o.done) continue; const q = s.byId.get(o.who); if (!q) { PS.orders.splice(PS.orders.indexOf(o), 1); continue; }
        if (s.day > o.due + 2) { PS.orders.splice(PS.orders.indexOf(o), 1); s.relate && s.relate(q, { id: 0 }, -0.12); s.remember(q, `Ordered ${o.qty} ${nm(o.good)} from the stranger and never got them.`, 'work', 1.3, -0.1); say(`${q.first} has given up on the ${nm(o.good)} you promised. They won't order from you again soon.`, 'bad'); }
        else if (s.day > o.due && !o.chased) { o.chased = true; s.relate && s.relate(q, { id: 0 }, -0.04); } }
      const e = PS.emp; if (!e || e.place !== s.world.placeId) return; const bz = s.biz.get(e.biz); if (!bz) return; const makes = makesOf(bz); if (!makes.length) return;
      if (PS.orders.filter((o) => !o.done && o.place === s.world.placeId).length >= 2 || Math.random() > 0.55) return;
      const q = s.people.filter((z) => z.age >= 18 && z.alive !== false && z.job?.biz !== bz.id && !z.visitor && z.agent && s.household(z) && s.household(z).money > 12)[Math.floor(Math.random() * 40)]; if (!q) return;
      const good = pick(makes), qty = 1 + (Math.random() < 0.4 ? 1 : 0), due = s.day + 2 + Math.floor(Math.random() * 3), pay = Math.max(3, Math.round(s.price(bz, good) * qty * 1.2));
      PS.orders.push({ id: 'ord' + s.day + q.id, who: q.id, name: q.first, good, qty, due, pay, biz: bz.id, place: s.world.placeId, asked: false });
    }
    // they come to you to place it (at work, when they find you); you deliver it by handing it over in talk
    let ot = 0;
    game.hooks.update.push((dt) => {
      ot -= dt; if (ot > 0) return; ot = 2; const s = cur(); if (!s || !PS.orders || (O.npcUI && O.npcUI.talking())) return;
      for (const o of PS.orders) {
        if (o.asked || o.place !== s.world.placeId) continue; const q = s.byId.get(o.who); if (!q || !q.agent) continue;
        const near = game.scene ? game.scene.actors.has(q.id) && game.scene.b.id === o.biz : !q.agent.hidden && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 90;
        if (!near) { if (!o.sent) { o.sent = true; q.task = { act: 'shop', b: o.biz }; } continue; }
        o.asked = true; O.npcUI.startFrom(q, `I'd like ${o.qty > 1 ? o.qty + ' ' : 'a '}${nm(o.good)}${o.qty > 1 ? '' : ''} from you, made by ${dayName(s, o.due)}. ₳${o.pay} on the day I have it.`);
        q.task = null; O.addLead && O.addLead({ place: s.world.placeId, id: q.id, until: (o.due + 3) * 1440, why: 'order', label: `${o.name}'s order: ${o.qty} ${nm(o.good)} by ${dayName(s, o.due)}` });
      }
    });
    // handing it over: talk to them with it in your satchel
    if (O.npcUI) {
      const _open = O.npcUI.openTalk;
      O.npcUI.openTalk = function (q) {
        const r = _open.apply(this, arguments); const s = cur();
        try {
          const o = (PS.orders || []).find((x) => x.who === q.id && !x.done && x.place === s.world.placeId && x.asked);
          if (o && PS.items.filter((k) => k === o.good).length >= o.qty) {
            for (let i = 0; i < o.qty; i++) PS.remove(o.good);
            const late = s.day > o.due, pay = late ? Math.round(o.pay * 0.7) : o.pay, hh = s.household(q), paid = Math.min(pay, Math.floor((hh && hh.money) || pay));
            if (hh) hh.money -= paid; PS.money += paid; o.done = true; PS.orders = PS.orders.filter((x) => x !== o); PS.leads = (PS.leads || []).filter((l) => !(l.why === 'order' && l.id === q.id));
            O.NpcActs && O.NpcActs.fly('player', q, o.good); setTimeout(() => O.NpcActs && O.NpcActs.fly(q, 'player', 'coin'), 1500);
            s.relate && s.relate(q, { id: 0 }, late ? -0.02 : 0.08); s.remember(q, late ? `Got the ${nm(o.good)} from the stranger, late.` : `Got the ${nm(o.good)} from the stranger, as promised.`, 'work', 1, late ? 0 : 0.1);
            const bz = s.biz.get(o.biz); if (bz) bz.rep = Math.min(1, (bz.rep || 0.6) + (late ? -0.02 : 0.03));
            setTimeout(() => O.npcUI.speak(q, late ? `Late, but here at last. ₳${paid}, less a little for the waiting.` : `Just as promised. ₳${paid}, and thank you.`), 400);
          }
        } catch (e) { console.error(e); }
        return r;
      };
    }
    // the work's own stock may go toward an order you've taken
    const _may = O.workerMay;
    if (_may) O.workerMay = (bz, g) => _may(bz, g) || (PS.orders || []).some((o) => !o.done && o.biz === (bz && bz.id) && o.good === g);

    // ---------------------------------------------------------------- mishaps at work
    const _act = O.jobAct;
    O.jobAct = (c) => {
      const r = _act(c), s = cur(), e = PS.emp, anim = c && c.t && (c.t.anim || ({ make: 'hammer', chop: 'chop', field: 'dig' }[c.t.kind]));
      try {
        const kinds = RISKY[anim]; if (!kinds || !s || !e || PS.injury) return r;
        const tired = (PS.energy ?? 100) < 25, drunk = (PS.drunk || 0) > 0.3, skill = (PS.skills && PS.skills[O.tradeOf ? O.tradeOf(e, s.biz.get(e.biz)) : 'labour']) || 0.3;
        const p = 0.012 + (tired ? 0.03 : 0) + (drunk ? 0.05 : 0) + Math.max(0, 0.3 - skill) * 0.04;
        if (Math.random() < p) setTimeout(() => hurt(s, e, pick(kinds)), 1800);
      } catch (err) { console.error(err); }
      return r;
    };
    function hurt(s, e, what) {
      PS.injury = { what, until: s.day + (/back|ankle/.test(what) ? 2 : 1) }; PS.hp = Math.max(15, (PS.hp ?? 100) - 12);
      const P = game.player; P.anim = 'hurt'; P.ft = 0; setTimeout(() => { if (P.anim === 'hurt') P.anim = 'idle'; }, 900);
      O.sfx && O.sfx('smack', 0.8, !!game.scene);
      e.excuseDay = s.day + 1; if (e.dayInfo) e.dayInfo.excused = true;
      const boss = e.master != null ? s.byId.get(e.master) : null;
      say(`Ah! ${what[0].toUpperCase() + what.slice(1)}. ${boss ? `${boss.first} sends you home: no more work for you today, and rest tomorrow.` : 'You will have to rest it.'}`, 'bad');
      if (boss) { boss.agent && O.Speech && O.Speech.say(boss, 'Go home and see to that. Come back when it\'s mended.', 3); s.remember(boss, `The stranger hurt themselves at work: ${what}.`, 'work', 1); }
      e.onShift = false; if (e.dayInfo) e.dayInfo.dayDone = true;
    }
    game.hooks.update.push(() => { const s = cur(); if (PS.injury && s && s.day > PS.injury.until) { PS.injury = null; say('Your hurt has mended.'); } });
    // and the town's workers have their mishaps too
    const _work = SP.work;
    if (_work) SP.work = function (p) { const r = _work.apply(this, arguments); if (p.job && Math.random() < 0.00004 && !p.health.illness && p.agent && !p.agent.hidden) { const w = pick(['a burnt hand', 'a cut thumb', 'a strained back']); this.remember(p, `Hurt myself at work: ${w}.`, 'health', 1.2); p._hurtUntil = this.day + 1; if (O.Speech && Math.hypot((p.agent.x || 0) - game.player.x, (p.agent.y || 0) - game.player.y) < 200) O.Speech.say(p, 'Argh! My hand!', 2.5); } return r; };

    // ---------------------------------------------------------------- an apprentice of your own
    // a youth with no work will come to you, if you have a trade (your own shop, or senior at your work)
    const canTeach = () => (PS.posts || []).some((e) => (e.level || 0) >= 2) || [...(cur()?.biz.values() || [])].some((b) => b.ownerPlayer || b.owner === 'player' || b.playerOwned);
    const APP_ASK = /\b(be my apprentice|(take you|you) on as (my )?apprentice|apprentice (to|with) me|learn (the|a) trade (from|with) me|i'?ll teach you)\b/i;
    const ORDER = [['water', /\b(fetch|bring|get) (some |me )?water\b/i], ['wood', /\b(fetch|bring|get) (some |me )?(fire)?wood\b/i], ['sweep', /\bsweep\b|\btidy\b/i], ['teach', /\b(watch (me|how)|let me show you|i'?ll show you|learn this|teach you)\b/i]];
    const _say = O.AIChat.say;
    O.AIChat.say = function (q, text, render, opt) {
      const s = cur();
      if (q && typeof text === 'string' && s) {
        const ap = PS.apprentice && PS.apprentice.id === q.id && PS.apprentice.place === s.world.placeId;
        if (!ap && APP_ASK.test(text) && q.age >= 11 && q.age <= 18 && !q.job && canTeach()) {
          (q._conv = q._conv || []).push({ who: 'p', t: text });
          const r0 = (q.rel.get(0) || {}).affinity || 0, yes = r0 > -0.2 && Math.random() < 0.75 + r0 * 0.3;
          if (yes) { PS.apprentice = { id: q.id, name: q.first, place: s.world.placeId, since: s.day, skill: 0.08, loyalty: 0.5 + r0 * 0.3 }; q.job = { biz: null, role: 'apprentice', master: 0 }; s.remember(q, 'Bound apprentice to the stranger, to learn a trade.', 'work', 2, 0.2); }
          const l = yes ? pick(['Truly? I\'ll work hard, I swear it. When do I start?', 'Aye! My mother will be glad of it.']) : pick(['My father wants me on the farm.', 'I\'m not sure about you.']); q._conv.push({ who: 'q', t: l }); render(l, false); return Promise.resolve();
        }
        const hit = (ap || juniorOf(s, q)) && ORDER.find(([, re]) => re.test(text));
        if (hit) { (q._conv = q._conv || []).push({ who: 'p', t: text }); const l = orderDo(s, q, hit[0], ap); q._conv.push({ who: 'q', t: l }); render(l, false); return Promise.resolve(); }
      }
      return _say.apply(this, arguments);
    };
    function orderDo(s, q, what, isAp) {
      const A = PS.apprentice;
      if (what === 'teach') { if (A && isAp) { A.skill = Math.min(1, A.skill + 0.04); A.loyalty = Math.min(1, A.loyalty + 0.03); O.gesture && O.gesture(q, 'nod', 1.6); } return pick(['I see. Like that?', 'Show me again, slower.', 'I think I have it.']); }
      const w = game.world;
      if (what === 'sweep') { if (O.Errands && !game.scene) { const t = [Math.floor(q.agent.x / T), Math.floor(q.agent.y / T)]; O.Errands.send(s, q, t, { anim: 'sweep', secs: 8, face: 3 }); } else O.gesture && O.gesture(q, 'sweep', 8); if (game.scene) game.scene.b.dirt = Math.max(0, (game.scene.b.dirt || 0) - 0.2); return pick(['Yes, master.', 'Right away.']); }
      const src = w && w.props.filter((p) => (what === 'water' ? p.kind === 'well' : /woodpile|logpile/.test(p.kind))).sort((a, b) => Math.hypot(a.x - q.agent.x, a.y - q.agent.y) - Math.hypot(b.x - q.agent.x, b.y - q.agent.y))[0];
      if (!src || !O.Errands) return 'There\'s none to be had near here.';
      const at = [Math.floor(src.x / T), Math.floor(src.y / T) + 1], back = [Math.floor(game.player.x / T), Math.floor(game.player.y / T) + 1];
      O.Errands.send(s, q, at, { anim: what === 'water' ? 'crouch' : 'pickup', secs: 2.5, face: 0, after: (ok) => { if (ok) O.Errands.send(s, q, back, { anim: 'place', secs: 1.2, carry: { good: what === 'water' ? 'water' : 'firewood', qty: 1 }, after: () => { if (isAp && A) A.loyalty = Math.min(1, A.loyalty + 0.01); } }); } });
      return pick(['Yes, master.', 'I\'ll go now.', 'Back in a trice.']);
    }
    function apprenticeDay(s) {
      const A = PS.apprentice; if (!A || A.place !== s.world.placeId) return; const q = s.byId.get(A.id); if (!q || q.alive === false) { PS.apprentice = null; return; }
      A.skill = Math.min(1, A.skill + 0.01); if (PS.money >= 1) { PS.money -= 1; } else A.loyalty -= 0.06; // (bed and board, a coin a day)
      if (A.loyalty < 0.3 && q.traits?.includes('greedy') && Math.random() < 0.25 && PS.money > 4) { const n = Math.min(PS.money - 1, 2 + Math.floor(Math.random() * 5)); PS.money -= n; const hh = s.household(q); if (hh) hh.money += n; A.stole = (A.stole || 0) + n; setTimeout(() => say(`Your purse is ₳${n} lighter than it should be. ${A.name} won't meet your eye.`, 'bad'), 3000); }
      else if (A.loyalty > 0.7 && Math.random() < 0.08) setTimeout(() => say(`${A.name} tells you someone was trying your door last night, and they shouted them off. A good lad.`), 3000);
      if (A.skill >= 0.6 && !A.told) { A.told = true; say(`${A.name} has learned the trade well: they could stand on their own now.`); }
    }
    (O.extraLines = O.extraLines || []).push((s, q) => { const A = PS.apprentice; if (A && A.id === q.id) return `You are the player's apprentice since day ${A.since}; you are ${A.loyalty > 0.65 ? 'devoted to them' : A.loyalty < 0.35 ? 'resentful of them' : 'getting on with them'}. When they give you an order, you do it.`; if (juniorOf(s, q)) return 'The player is senior at your work and may give you orders; you do as they say.'; return ''; });

    // ---------------------------------------------------------------- the year's own work
    const _chores = O.choreTasks;
    O.choreTasks = (s, bz, e) => {
      const out = _chores ? _chores(s, bz, e) : []; const se = s.season, role = e.role;
      const add = (text, at, anim, mins, done) => out.push({ kind: 'chore', at, text, label: text, anim, mins, doneMsg: done, gain: null, need: 1 });
      if (se === 'spring' && /shepherd|farmhand|farmer/.test(role)) add('Help a ewe with her lambing', 'out', 'crouch', 25, 'Twin lambs, both breathing.');
      if (se === 'summer' && /shepherd|farmhand|farmer/.test(role) && s.day % 5 < 2) add('Shear a sheep', 'out', 'shear', 20, 'A whole fleece, in one piece.');
      if (se === 'autumn' && /butcher|cook|scullion|farmhand|maid/.test(role)) add('Salt the pork for the winter', 'table|butcherblock|barrel|out', 'mix', 25, 'Packed in salt, to last till spring.');
      if (se === 'autumn' && /farmhand|farmer|labourer/.test(role)) add('Stack the sheaves in the barn', 'out', 'pitch', 20, 'Safe from the rain.');
      if (se === 'winter') add('Break the ice on the well', 'out', 'chop', 10, 'Water again, cold as charity.');
      return out;
    };
    // a hard winter freezes the well: the first to come in the morning must break the ice
    game.hooks.update.push(() => {
      const s = cur(), w = game.world; if (!s || !w || s.season !== 'winter') return;
      const cold = s.weather && (s.weather.kind === 'snow' || s.weather.temp < 0 || s.hour < 9);
      for (const pr of w.props) if (pr.kind === 'well') { if (cold && pr._iceDay !== s.day) { pr._iceDay = s.day; pr.iced = true; } }
    });
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const w = game.world, P = game.player; if (!w || game.scene) return null; const pr = w.props.find((p) => p.kind === 'well' && p.iced && Math.hypot(p.x - P.x, p.y - P.y) < 26); if (!pr) return null;
      return { type: 'custom', d: -5, x: pr.x, y: pr.y - 30, label: 'Break the ice on the well', act: () => { P.locked = true; P.anim = 'chop'; P.ft = 0; O.sfx && O.sfx('chop', 0.8); setTimeout(() => { O.sfx && O.sfx('chop', 0.8); }, 600); setTimeout(() => { P.locked = false; P.anim = 'idle'; pr.iced = false; say('The ice cracks and gives. Black water underneath.'); }, 1400); } };
    });
    // the harvest supper: when the last of the harvest is in, the farm sits down to eat and drink together
    const _nd2 = SP.newDay;
    SP.newDay = function () { const r = _nd2.apply(this, arguments); try { const dos = ((this.day - 1) % 14) + 1; if (this.season === 'autumn' && dos === 11) { this.npcEvents = this.npcEvents || []; this.npcEvents.push({ day: this.day, from: 18, to: 23, kind: 'feast', b: this.tavernId, title: 'The harvest supper', party: true }); this.log('The harvest is in. Tonight the whole parish sits down to the harvest supper at the tavern.', 'day'); } } catch (e) { /* */ } return r; };
    O.CraftLife = { rateBiz, titleOf, orders: () => PS.orders || [] };
  }
  O.CraftLifeSetup = { setup };
})();
