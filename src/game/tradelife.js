// Running things, said in your own words.
// - Your own shop: take people on ("come and work for me"), turn them off ("you're sacked"), set the
//   hours ("open at six, shut at eight"), a price ("sell the bread at 3"), and whether you give credit
//   ("put it on the slate" / "cash only"). Credit brings more custom and some bad debts. Staff may skim
//   the till: the takings come up short, and you can ask them straight out.
// - Market day, every Saturnday morning: the square fills, and you can take a stall (E at a stall,
//   ₳2). Buyers come and ask the price of what you carry; you name it, they haggle, you meet them or
//   not. Your haggling gets better with practice.
// - Rival workshops: a trade that does well draws a rival. An ambitious hand sets up on their own in an
//   empty shop, undercuts and poaches.
// - Strikes you start or break: tell your fellow hands "we should down tools" and, if enough agree, the
//   shop stops until the master gives a raise or turns you all off. Keep working through someone
//   else's strike and they won't forget it. As a master, give the raise or sack them all.
// - Your own gang, day to day: tell a member what to do tonight ("do the Miller house", "lift purses",
//   "lie low"), hand them their cut, and hear in the morning how it went.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k || 'note'), G = O.Data.GOODS;
    const mine = (bz) => (O.Market && O.Market.mine ? O.Market.mine(bz) : !!(bz && bz.ownerPlayer));
    const myBiz = (s) => [...s.biz.values()].filter((z) => mine(z) && !z.def.public);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const num = (t) => { const m = String(t).match(/(\d+(?:\.\d+)?)/); if (m) return +m[1]; const W = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 }; const w = String(t).toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)\b/); return w ? W[w[1]] : null; };
    const hourOf = (t) => { const m = String(t).toLowerCase().match(/(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|noon|midday|midnight)\s*(am|pm|in the morning|in the evening|at night|of the clock|o'?clock)?/); if (!m) return null; if (m[1] === 'noon' || m[1] === 'midday') return 12; if (m[1] === 'midnight') return 0; let h = num(m[1]); if (h == null) return null; const suf = m[2] || ''; if (/pm|evening|night/.test(suf) && h < 12) h += 12; return h % 24; };
    const fmt = (h) => (h % 12 || 12) + (h < 12 ? 'am' : 'pm');

    // ======================================================================== your own shop
    // hours you set stay set, saved on the business
    function applyHours(bz) { if (bz.hoursSet) bz.def = Object.assign({}, O.Data.BUSINESS[bz.type] || bz.def, { hours: bz.hoursSet }); }
    let hoursT = 0;
    game.hooks.update.push((dt) => { hoursT -= dt; if (hoursT > 0) return; hoursT = 5; const s = cur(); if (!s) return; for (const bz of s.biz.values()) if (bz.hoursSet && bz.def.hours !== bz.hoursSet) applyHours(bz); });
    // a price you name for a good holds
    const SP = O.Sim.prototype, _price = SP.price;
    SP.price = function (bz, good) { if (bz && bz.priceSet && bz.priceSet[good] != null) return bz.priceSet[good]; return _price.call(this, bz, good); };

    function staffLine(s, q) {
      const bz = q.job && s.biz.get(q.job.biz); if (!bz || !mine(bz)) return '';
      const out = [`You work for the player at ${bz.name}; they are your master.`];
      if (bz.hoursSet) out.push(`The player has set the hours at ${fmt(bz.hoursSet[0])} to ${fmt(bz.hoursSet[1])}.`);
      if (bz.credit) out.push('The player lets customers buy on credit.');
      if (q._skimmed > 0) out.push(`You have been quietly taking from the till: about ₳${Math.round(q._skimmed)} so far. If asked straight out, you ${q.traits.includes('honest') ? 'own up' : q.traits.includes('hostile') || q.traits.includes('greedy') ? 'deny it to the last' : 'stammer, then likely own up'}.`);
      return out.join(' ');
    }
    (O.extraLines = O.extraLines || []).push(staffLine);

    const RX = {
      fire: /\b(you'?re (fired|sacked|dismissed|turned off)|i('?m| am) (letting you go|turning you off|sacking you)|(clear|get) out,? and don'?t come back|you'?re all (sacked|fired|turned off)|pack your things)\b/i,
      hire: /\b(come (and )?work for me|work for me|i('?ll| will) take you on|i('?ll| will) hire you|want a (job|place) (at|in) my|i need (a|another) (hand|worker|server|baker|labourer))\b/i,
      hours: /\b(open|opening|shut|close|closing)\b.*\b(\d{1,2}|six|seven|eight|nine|ten|eleven|twelve|five|four|noon|midnight)\b/i,
      price: /\b(sell|charge|price)\b.*\b(at|for)\b\s*₳?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty)/i,
      creditOn: /\b(give|allow|let (them|folk|people) (buy|have))\b.*\bcredit\b|\bon (the )?(slate|tick|tab)\b|\bput it on (the )?(slate|tab|tick)\b/i,
      creditOff: /\b(no (more )?credit|cash only|ready money only|no slate)\b/i,
      skim: /\b(takings|till|purse|money)\b.*\b(short|missing|light|gone)\b|\b(have you been|are you) (stealing|taking|helping yourself|skimming)\b|\bwhere'?s the (money|rest of the takings)\b/i,
      strikeStart: /\b(down tools|go on strike|we should strike|let'?s strike|stand together|walk out|refuse to work)\b/i,
      raise: /\b(you'?ll have (your|the) raise|i'?ll (pay|give) (you )?more|fine,? (more|a raise)|you'?ve won|i give in)\b/i,
      gangJob: /\b(tonight|this night)\b.*\b(do|rob|burgle|break into|hit|lift|cut purses|pick pockets)\b|\b(do|rob|burgle|break into|hit) the (\w+) (house|place)\b|\blift (some )?purses\b/i,
      lieLow: /\b(lie low|keep your head down|stay in tonight|no work tonight)\b/i,
      cut: /\b(here'?s|take|have) (your )?(cut|share|wage)\b|\bhere,? (take|have) ₳?\s*\d+/i,
    };
    function respond(q, text, render, line) { (q._conv = q._conv || []).push({ who: 'p', t: text }); q._conv.push({ who: 'q', t: line }); render(line); return Promise.resolve(); }

    function tryShop(s, q, text, render) {
      const bzOf = q.job && s.biz.get(q.job.biz), staff = bzOf && mine(bzOf) && q.job.role !== 'owner';
      const mineL = myBiz(s);
      if (staff && RX.fire.test(text)) {
        bzOf.workers = bzOf.workers.filter((x) => x !== q.id); q.job = null; q._skimmed = 0;
        s.relate(q, { id: 0 }, -0.35); s.remember(q, `Turned off from ${bzOf.name} by the player.`, 'work', 2);
        if (bzOf.strike) bzOf.strike.who = bzOf.strike.who.filter((id) => id !== q.id);
        setTimeout(() => O.NpcActs && O.NpcActs.walkOff && O.NpcActs.walkOff(q), 2500);
        return respond(q, text, render, q.traits.includes('hostile') ? "Then rot, you and your shop. I'll not be back." : pick(['So that is how it is. Very well.', "I'll get my things, then.", 'You will be sorry you did this.']));
      }
      if (mineL.length && RX.hire.test(text) && !staff) {
        if (q.age < 14 || q.age > 65) return respond(q, text, render, q.age < 14 ? "My mam would not let me, sir." : 'I am too old for new work.');
        if (q.job && !RX.hire.test(text)) return null;
        const bz = mineL.find((z) => s.vacancies && s.vacancies(z).length) || mineL[0], vac = (s.vacancies && s.vacancies(bz)) || [], role = vac[vac.length - 1] || bz.def.jobs[bz.def.jobs.length - 1][0];
        const aff = (q.rel.get(0) || {}).affinity || 0, keen = !q.job ? 0.6 : 0.2;
        if (aff < -0.25 || Math.random() > keen + aff) return respond(q, text, render, q.job ? `I have a place at ${s.biz.get(q.job.biz)?.name || 'mine'}, and I'll keep it.` : 'I would rather not, thank you.');
        if (q.job) { const old = s.biz.get(q.job.biz); if (old) { old.workers = old.workers.filter((x) => x !== q.id); s.remember(q, `Left ${old.name} to work for the player.`, 'work', 1.5); const ob = s.bossOf && s.bossOf(old); if (ob && ob !== q && old.workers.length) { s.relate(ob, { id: 0 }, -0.15); s.remember(ob, `The player poached ${q.first} from me.`, 'grudge', 2); } } }
        q.job = { biz: bz.id, role, hiredBy: 'player', wage: (bz.def.wage && bz.def.wage[role]) || 5 }; bz.workers.push(q.id); s.refreshLook && s.refreshLook(q);
        s.remember(q, `Took work at ${bz.name}, the player's place.`, 'work', 2);
        return respond(q, text, render, `Aye, I'll come. ${role[0].toUpperCase() + role.slice(1)} at ${bz.name}, ₳${q.job.wage} a day. I'll start in the morning.`);
      }
      if (staff && RX.hours.test(text)) {
        const parts = text.toLowerCase(), o = parts.match(/open\w*\s+(?:at|from)?\s*([^,.;]+)/), c = parts.match(/(?:shut|close)\w*\s+(?:at|by)?\s*([^,.;]+)/);
        const h0 = o ? hourOf(o[1]) : bzOf.def.hours[0], h1 = c ? hourOf(c[1]) : bzOf.def.hours[1];
        if (h0 == null || h1 == null) return null;
        const a = h0 < 4 ? h0 + 12 : h0, b = h1 <= a ? (h1 < 12 ? h1 + 12 : h1) : h1;
        bzOf.hoursSet = [a, Math.min(24, b)]; applyHours(bzOf);
        return respond(q, text, render, `Open at ${fmt(a)} and shut at ${fmt(b % 24)}. I'll see it done.`);
      }
      if (staff && RX.price.test(text)) {
        const g = O.NpcActs && O.NpcActs.goodFor ? O.NpcActs.goodFor(text) : (bzOf.def.sells || []).find((k) => text.toLowerCase().includes((G[k]?.name || k).toLowerCase().split(' ')[0]));
        const n = num(text.split(/\b(at|for)\b/i).slice(-1)[0]);
        if (!g || !(bzOf.def.sells || []).includes(g) || !n) return null;
        (bzOf.priceSet = bzOf.priceSet || {})[g] = Math.max(1, Math.round(n));
        const base = G[g].base || 1;
        return respond(q, text, render, n > base * 1.6 ? `₳${n} for ${G[g].name.toLowerCase()}? Folk will go elsewhere. But as you say.` : n < base * 0.7 ? `₳${n}? We'll sell out by noon and make nothing. As you say, though.` : `₳${n} for the ${G[g].name.toLowerCase()}. Right you are.`);
      }
      if (staff && RX.creditOn.test(text)) { bzOf.credit = true; return respond(q, text, render, "Credit it is. I'll keep the slate, and pray they pay."); }
      if (staff && RX.creditOff.test(text)) { bzOf.credit = false; return respond(q, text, render, 'Ready money only. Some will grumble.'); }
      if (staff && RX.skim.test(text)) {
        const sk = q._skimmed || 0;
        if (sk <= 0) { s.relate(q, { id: 0 }, -0.12); return respond(q, text, render, "I've not touched a penny. Count it yourself if you doubt me."); }
        const owns = q.traits.includes('honest') || (!q.traits.includes('greedy') && !q.traits.includes('hostile') && Math.random() < 0.6);
        if (owns) { const back = Math.min(Math.round(sk), Math.floor(s.household(q)?.money || 0)); if (back > 0) { s.household(q).money -= back; bzOf.cash += back; } q._skimmed = 0; q._caught = s.day; return respond(q, text, render, `I... yes. ₳${back} of it I can give back now. It won't happen again, I swear it.`); }
        q._caught = s.day; return respond(q, text, render, 'Short? Then someone else has light fingers. Not me.');
      }
      return null;
    }

    // credit, debts and skimming, each day
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        for (const bz of myBiz(this)) {
          const sales = bz.salesToday || bz._lastSales || 0;
          if (bz.credit) {
            const extra = Math.round(sales * 0.12); bz.debts = bz.debts || [];
            const hh = pick(this.households.filter((h) => !h.gone && h.money < 40)); if (hh && extra > 0) bz.debts.push({ hh: hh.id, amt: extra, day: this.day });
            for (const d of bz.debts.slice()) { const h = this.households.find((x) => x.id === d.hh); if (!h) continue; if (h.money > d.amt * 2 && Math.random() < 0.35) { h.money -= d.amt; bz.cash += d.amt; bz.debts = bz.debts.filter((x) => x !== d); } else if (this.day - d.day > 10) { bz.debts = bz.debts.filter((x) => x !== d); bz.badDebt = (bz.badDebt || 0) + d.amt; } }
          }
          let short = 0;
          for (const id of bz.workers) { const q = this.byId.get(id); if (!q || q.job?.family) continue; const crooked = q.traits.includes('greedy') || q.traits.includes('dishonest') || ((q.rel.get(0) || {}).affinity || 0) < -0.2; if (!crooked || q._caught === this.day - 1 || Math.random() > 0.25) continue; const t = Math.max(1, Math.round(sales * (0.05 + Math.random() * 0.07))); if (bz.cash > t) { bz.cash -= t; q._skimmed = (q._skimmed || 0) + t; const hh = this.household(q); if (hh) hh.money += t; short += t; } }
          bz.shortBy = short;
          if (short > 0 || bz.badDebt) bz._note = { day: this.day, short, bad: bz.badDebt || 0 };
          bz.badDebt = 0;
        }
      } catch (e) { console.error(e); }
      return r;
    };
    game.hooks.update.push(() => {
      const s = cur(); if (!s || game.clock.minute < 7 * 60) return;
      for (const bz of myBiz(s)) { const n = bz._note; if (!n || n.told) continue; n.told = true; say(`${bz.name}'s books: ${n.short ? `the till came up about ₳${n.short} short yesterday` : ''}${n.short && n.bad ? ', and ' : ''}${n.bad ? `₳${n.bad} owed on the slate won't be paid` : ''}.`, 'bad'); }
    });

    // ======================================================================== money stays steady
    // a full purse doesn't sit still: the well-off buy cloth and wine from the travelling merchants, go on
    // pilgrimage, dower a daughter, rebuild; a shop with a full strongbox buys in from outside. A little of
    // whatever is above a comfortable sum leaves the town each day, so purses don't grow without end.
    const _ndM = SP.newDay;
    SP.newDay = function () {
      const r = _ndM.apply(this, arguments);
      try {
        let gone = 0;
        for (const hh of this.households) { if (hh.gone) continue; const ease = 120 + 40 * (hh.members || []).length; if (hh.money > ease) { const t = (hh.money - ease) * 0.03; hh.money -= t; gone += t; } }
        for (const bz of this.biz.values()) { if (bz.def.public || mine(bz)) continue; const ease = 300; if ((bz.cash || 0) > ease) { const t = (bz.cash - ease) * 0.03; bz.cash -= t; gone += t; } }
        if (this.treasury && this.treasury.cash > 1000) { const t = (this.treasury.cash - 1000) * 0.07; this.treasury.cash -= t; gone += t; }
        this._moneyOut = Math.round(gone);
      } catch (e) { console.error(e); }
      return r;
    };

    // ======================================================================== market day
    const isMarket = (s) => s && s.weekday === 6 && s.minute >= 7 * 60 && s.minute < 14 * 60;
    O.marketDay = isMarket;
    // townsfolk come to the square to buy and look
    const _plan = SP.plan;
    SP.plan = function (p) {
      const r = _plan.apply(this, arguments);
      try {
        if (isMarket(this) && r && !p.job?.onShift && p.age >= 12 && !p.visitor && ['stroll', 'socialise', 'idle', 'home', 'play'].includes(r.act) && ((p.id * 7 + this.day) % 10) < 4) return { act: 'stroll', outdoor: true, zone: 'square', market: true };
      } catch (e) { /* */ }
      return r;
    };
    (O.extraLines = O.extraLines || []).push((s) => (isMarket(s) ? 'It is market day: the square is full of stalls and country folk selling eggs, cheese, cloth and pots.' : ''));
    let stall = null; // { at:[x,y], until, sold }
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(); if (!s || game.scene || !isMarket(s) || stall) return null;
      const P = game.player, st = s.world.props.find((p) => p.kind === 'stall' && Math.hypot(p.x - P.x, p.y - P.y) < 40);
      if (!st) return null;
      return { type: 'custom', d: 10, x: st.x, y: st.y - 40, label: 'Take this stall for the morning (₳2)', act: () => {
        if (PS.money < 2) return say("The stall costs ₳2, and you haven't it.", 'bad');
        PS.money -= 2; s.treasury.cash += 2; stall = { at: [st.x, st.y + 14], since: s.day, sold: 0 }; game.player.x = st.x; game.player.y = st.y + 16; game.player.dir = 0;
        say('You set out your things on the stall. Buyers will come and ask; name your price when they do.', 'good');
      } };
    });
    function sellables() { const seen = new Set(); return PS.items.filter((k) => { const g = G[k]; if (!g || g.quest || seen.has(k) || k === 'letter' || k === 'secret') return false; seen.add(k); return (g.base || 0) > 0; }); }
    let bt = 8, buyer = null;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!stall) return;
      const P = game.player;
      if (!isMarket(s) || game.scene || Math.hypot(P.x - stall.at[0], P.y - stall.at[1]) > 60) { say(stall.sold ? `You pack up the stall. You sold ${stall.sold} thing${stall.sold > 1 ? 's' : ''}.` : 'You pack up the stall.'); stall = null; buyer = null; return; }
      if (buyer || O.UI.dialogOpen() || (O.npcUI && O.npcUI.talking())) return;
      bt -= dt; if (bt > 0) return; bt = 12 + Math.random() * 14;
      const goods = sellables(); if (!goods.length) return say('You have nothing left to sell.');
      const q = s.people.filter((z) => z.age >= 14 && z.agent && !z.agent.hidden && z.agent.inside == null && !z.job?.onShift && !z.agent.frozen && (s.household(z)?.money || 0) > 6 && Math.hypot(z.agent.x - P.x, z.agent.y - P.y) < 420 && Math.hypot(z.agent.x - P.x, z.agent.y - P.y) > 30).sort(() => Math.random() - 0.5)[0];
      if (!q) return;
      const g = pick(goods); buyer = { q, g };
      const go = () => haggle(s, q, g);
      if (O.Errands && O.Errands.send) O.Errands.send(s, q, [Math.floor(stall.at[0] / T), Math.floor(stall.at[1] / T) + 1], { anim: 'idle', secs: 0.5, after: go, giveUp: 40 }); else go();
      setTimeout(() => { if (buyer && buyer.q === q && !buyer.talking) buyer = null; }, 45000);
    });
    function haggle(s, q, g) {
      if (!stall || !PS.items.includes(g)) { buyer = null; return; }
      buyer = buyer || { q, g }; buyer.talking = true; q.agent.frozen = true;
      const base = s.price && s.supplierOf ? (() => { const sup = [...s.biz.values()].find((z) => (z.def.sells || []).includes(g)); return sup ? s.price(sup, g) : (G[g].base || 2); })() : (G[g].base || 2);
      const tight = q.traits.includes('greedy') || (s.household(q)?.money || 0) < 20, sk = PS.skills.haggling || 0;
      const most = Math.max(1, Math.round(base * (tight ? 1.05 : 1.3) * (1 + sk * 0.3))), opening = Math.max(1, Math.round(base * (tight ? 0.6 : 0.8)));
      let rounds = 0, offer = opening;
      const nm = G[g].name.toLowerCase(), col = '#8a6239';
      const end = (line, sold, price) => {
        O.UI.dialog.open({ name: q.first, color: col, text: line, options: [] });
        q.agent.frozen = false; buyer = null;
        if (sold) { PS.remove(g); PS.money += price; const hh = s.household(q); if (hh) { hh.money -= price; if (G[g].food) hh.pantry[g] = (hh.pantry[g] || 0) + 1; } stall.sold++; O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(q, 'player', 'coin'); O.sfx && O.sfx('kaching', 0.6); PS.skills.haggling = Math.min(1, sk + 0.02 + (price > base ? 0.02 : 0)); s.remember(q, `Bought ${nm} off the stranger's stall for ₳${price}.`, 'life', 0.4); }
        setTimeout(() => { if (O.UI.dialogOpen()) O.UI.dialog.close(); }, 2600);
      };
      const ask = (text) => O.UI.dialog.open({ name: q.first, color: col, text, options: [], chat: (t) => {
        if (/\b(no|not for sale|keep it|go away|not selling)\b/i.test(t) && num(t) == null) return end('Suit yourself.', false);
        const n = num(t); if (n == null) return ask(`How much, then? A number, if you please. I'd give ₳${offer}.`);
        rounds++;
        if (n <= offer) return end(n < offer ? `₳${n}? Done, and gladly.` : `₳${n} it is.`, true, n);
        if (n <= most && (Math.random() < 0.55 || rounds >= 2)) return end(`₳${n}... you drive a hard bargain. Very well.`, true, n);
        if (n > most * 1.5 || rounds >= 3) return end(pick([`₳${n}? I'll find it cheaper down the row.`, 'Robbery. Good day to you.', 'For that I could buy two at the shop.']), false);
        offer = Math.min(most, Math.round((offer + n) / 2)); return ask(`₳${n}? No. I'll go to ₳${offer}, and that's my last word.`);
      }, onClose: () => { q.agent.frozen = false; buyer = null; } });
      ask(`${pick(['Good morrow.', 'Now then.', 'Let me see.'])} How much for the ${nm}? I'll give you ₳${offer}.`);
    }

    // ======================================================================== rivals
    const _nd2 = SP.newDay;
    SP.newDay = function () {
      const r = _nd2.apply(this, arguments);
      try {
        if (this.day % 4 === 0 && this.startBusiness && Math.random() < 0.5) {
          // a trade with only one shop, doing well (yours most of all), draws a rival
          const byType = {}; for (const bz of this.biz.values()) if (!bz.def.public && bz.type !== 'site') (byType[bz.type] = byType[bz.type] || []).push(bz);
          const ripe = Object.entries(byType).filter(([t, l]) => l.length === 1 && (l[0]._lastSales || l[0].salesToday || 0) > 25 && ['bakery', 'tavern', 'smithy', 'butcher', 'carpenter', 'tailor', 'cobbler', 'chandler', 'potter', 'weaver', 'cooper', 'brewery'].includes(t)).sort((a, b) => (mine(b[1][0]) ? 1 : 0) - (mine(a[1][0]) ? 1 : 0));
          const [type, [incumbent]] = ripe[0] || [null, [null]];
          const b = type && this.world.buildings.find((x) => (x.closedShop || (x.type === 'house' && !x.household && !(x.households || []).length && !x.owner)) && !x.ruined && !x.parent && !this.biz.get(x.id) && x.doorX != null);
          const role = type && O.Data.BUSINESS[type].jobs[0][0];
          const founder = incumbent && this.people.find((p) => p.job && p.job.biz === incumbent.id && p.id !== incumbent.owner && !p.job.family && p.age >= 17 && (p.traits.includes('ambitious') || (p.skills[role] || 0) > 0.5) && p.job.hiredBy !== 'player' || (p.job && p.job.biz === incumbent.id && mine(incumbent) && p.traits.includes('ambitious')));
          // no empty shop: they open in the front room of their own house
          const home = founder && (b || (() => { const h = this.building(founder.home); return h && h.type === 'house' && !this.biz.get(h.id) && !(h.owner && h.owner.kind === 'player') ? h : null; })());
          if (founder && home) {
            const hh = this.household(founder); if (hh && hh.money < 60) hh.money = 60;
            this.startBusiness(home, type, founder); if (!b) { home.household = founder.household; }
            const nb = this.biz.get(home.id); if (nb) { nb.markup = 0.85; nb.rivalOf = incumbent.id; }
            this.log(`${founder.name} has left ${incumbent.name} and opened ${nb ? nb.name : 'a rival shop'}, selling cheaper.`, 'economy');
            if (mine(incumbent)) { this.relate(founder, { id: 0 }, -0.1); PS.rivalNote = { day: this.day, who: founder.name, name: nb ? nb.name : 'a rival shop' }; }
          }
        }
        // a rival tries to lure hands away
        for (const nb of this.biz.values()) { if (nb.rivalOf == null || Math.random() > 0.15) continue; const inc = this.biz.get(nb.rivalOf); if (!inc) continue; const h = inc.workers.map((id) => this.byId.get(id)).find((q) => q && !q.job?.family && q.id !== inc.owner && ((q.job.owed || 0) > 0 || q.traits.includes('ambitious'))); if (!h) continue; inc.workers = inc.workers.filter((x) => x !== h.id); h.job = { biz: nb.id, role: nb.def.jobs[nb.def.jobs.length - 1][0] }; nb.workers.push(h.id); this.log(`${nb.name} has lured ${h.first} away from ${inc.name}.`, 'economy'); }
        for (const bz of this.biz.values()) bz._lastSales = bz.salesToday;
      } catch (e) { console.error(e); }
      return r;
    };
    game.hooks.update.push(() => { const n = PS.rivalNote; if (!n || n.told) return; n.told = true; say(`${n.who} has left you and opened ${n.name}, a rival to your shop, selling cheaper.`, 'bad'); });

    // ======================================================================== strikes, started and broken
    function tryStrike(s, q, text, render) {
      const e = PS.emp, bz = e && s.biz.get(e.biz);
      // a hand at the same place as you
      if (bz && q.job && q.job.biz === bz.id && RX.strikeStart.test(text) && !bz.strike) {
        const mates = bz.workers.map((id) => s.byId.get(id)).filter((w) => w && w.job && !w.job.family && w.id !== bz.owner && s.bossOf(bz) !== w);
        const grievance = (w) => ((w.job.owed || 0) > 0 ? 0.4 : 0) + ((w.job.wage || 5) < 6 ? 0.15 : 0) + (((w.rel.get(0) || {}).affinity || 0) * 0.4) + (w.traits.includes('hostile') ? 0.1 : 0) - (w.traits.includes('cautious') ? 0.15 : 0);
        q._strikeYes = grievance(q) + Math.random() * 0.3 > 0.35;
        bz._strikeVotes = bz._strikeVotes || {}; bz._strikeVotes[q.id] = q._strikeYes;
        const yes = Object.values(bz._strikeVotes).filter(Boolean).length;
        if (yes + 1 > mates.length / 2) {
          bz.strike = { since: s.day, who: [...Object.entries(bz._strikeVotes).filter(([, v]) => v).map(([id]) => +id)], raise: 1, byPlayer: true }; bz._strikeVotes = null; e.striking = true;
          s.log(`The hands at ${bz.name} have downed tools for better pay. ${O.Forge?.player?.name || 'The stranger'} put them up to it.`, 'economy');
          const boss = s.bossOf(bz); if (boss) { s.relate(boss, { id: 0 }, -0.4); s.remember(boss, `${O.Forge?.player?.name || 'The new hand'} stirred my workers to strike.`, 'grudge', 3); }
          return respond(q, text, render, "Then it's done. We down tools until the master pays us better. Stand with us at the door.");
        }
        return respond(q, text, render, q._strikeYes ? `I'm with you. But we need more of us: ${mates.length - yes - 1 > 0 ? `${Math.ceil(mates.length / 2) - yes} more at least` : 'nearly there'}.` : pick(["Strike? And lose my place? Not I.", 'I have mouths to feed. Leave me out of it.', "Hush, the master will hear you."]));
      }
      // the master, facing your strike
      if (bz && bz.strike && bz.strike.byPlayer && q === s.bossOf(bz) && /\b(raise|more pay|better pay|pay us)\b/i.test(text)) {
        const give = (bz.cash || 0) > 40 && !q.traits.includes('greedy') && Math.random() < 0.5 + (s.day - bz.strike.since) * 0.15;
        if (give) { for (const id of bz.strike.who) { const w = s.byId.get(id); if (w && w.job) w.job.wage = (w.job.wage || 5) + 1; } if (e) e.wage = (e.wage || 5) + 1; bz.strike = null; e.striking = false; s.log(`The strike at ${bz.name} is over: the hands get another aurin a day.`, 'economy'); return respond(q, text, render, 'Enough. One aurin more a day, each of you. Now get back to work.'); }
        return respond(q, text, render, pick(["Not a penny more. Stand out there till you starve.", "Back to work by morning, or you're all turned off."]));
      }
      // the owner (you), facing strikers
      if (bz == null || !mine(bz)) {
        const sb = q.job && s.biz.get(q.job.biz);
        if (sb && mine(sb) && sb.strike && RX.raise.test(text)) { for (const id of sb.strike.who) { const w = s.byId.get(id); if (w && w.job) { w.job.wage = (w.job.wage || 5) + 1; s.relate(w, { id: 0 }, 0.15); } } sb.strike = null; return respond(q, text, render, "That's fair dealing. We'll go back in."); }
      }
      return null;
    }
    // a raise strike isn't settled by paying arrears: the master decides, and after four days turns them off
    const _ndS = SP.newDay;
    SP.newDay = function () {
      const r = _ndS.apply(this, arguments);
      try {
        for (const bz of this.biz.values()) {
          const st = bz.strike; if (!st || !st.raise || mine(bz)) continue;
          const boss = this.bossOf(bz), days = this.day - st.since;
          if (boss && (bz.cash || 0) > 60 && !boss.traits.includes('greedy') && Math.random() < 0.2 + days * 0.15) { for (const id of st.who) { const w = this.byId.get(id); if (w && w.job) w.job.wage = (w.job.wage || 5) + 1; } if (PS.emp && PS.emp.biz === bz.id) { PS.emp.wage = (PS.emp.wage || 5) + 1; PS.emp.striking = false; } bz.strike = null; this.log(`${bz.name} gives way: another aurin a day for the hands.`, 'economy'); if (PS.emp && PS.emp.biz === bz.id) PS.strikeNote = 'won'; }
          else if (days >= 4) { for (const id of st.who) { const w = this.byId.get(id); if (w && w.job && w.job.biz === bz.id) { bz.workers = bz.workers.filter((x) => x !== w.id); w.job = null; this.remember(w, `${bz.name} turned us all off for striking.`, 'work', 2.5); } } if (PS.emp && PS.emp.biz === bz.id && PS.emp.striking) { PS.strikeNote = 'lost'; } bz.strike = null; this.log(`${bz.name} has turned off its striking hands and taken on new ones.`, 'economy'); }
        }
        // crossing someone else's picket line is remembered
        const e = PS.emp, bz = e && this.biz.get(e.biz);
        if (bz && bz.strike && !e.striking && e.stats && e.stats.shifts > (e._lastShifts || 0)) { for (const id of bz.strike.who) { const w = this.byId.get(id); if (w) { this.relate(w, { id: 0 }, -0.25); this.remember(w, `${O.Forge?.player?.name || 'The new hand'} crossed our line and worked through the strike.`, 'grudge', 2.5); } } PS.scab = (PS.scab || 0) + 1; }
        if (e) e._lastShifts = e.stats ? e.stats.shifts : 0;
      } catch (e2) { console.error(e2); }
      return r;
    };
    game.hooks.update.push(() => { const n = PS.strikeNote; if (!n) return; PS.strikeNote = null; say(n === 'won' ? 'The strike is won: another aurin a day for every hand, you included.' : 'The master has turned off every striker, you among them.', n === 'won' ? 'good' : 'bad'); if (n === 'lost' && PS.emp) { const e0 = PS.emp; PS.posts = (PS.posts || []).filter((x) => x !== e0); PS.emp = PS.posts[0] || null; } });
    (O.extraLines = O.extraLines || []).push((s, q) => { const bz = q.job && s.biz.get(q.job.biz); if (!bz || !bz.strike) return PS.scab && q.job ? '' : ''; return bz.strike.who.includes(q.id) ? `You are on strike at ${bz.name}${bz.strike.raise ? ' for better pay' : ' for wages owed'}; you stand at the door and will not work.` : ''; });

    // ======================================================================== your gang, day to day
    function tryGang(s, q, text, render) {
      if (q.gang !== 'player') return null;
      const g = s.playerGang && s.playerGang(); if (!g) return null;
      const m = g.members.find((x) => x.id === q.id); if (!m) return null;
      if (RX.lieLow.test(text)) { q._lieLow = s.day + 2; g.orders = (g.orders || []).filter((o) => o.member !== q.id); return respond(q, text, render, 'Head down, then. Two nights.'); }
      if (RX.cut.test(text)) {
        const n = num(text) || 3; if (PS.money < n) return respond(q, text, render, "You haven't got it, boss. Don't make promises.");
        PS.money -= n; const hh = s.household(q); if (hh) hh.money += n; m.loyalty = Math.min(1, m.loyalty + n / 40); O.NpcActs && O.NpcActs.fly && O.NpcActs.fly('player', q, 'coin');
        return respond(q, text, render, n >= 8 ? "That's handsome, boss. I'll not forget it." : 'My thanks.');
      }
      if (RX.gangJob.test(text)) {
        if (q._lieLow && s.day < q._lieLow) q._lieLow = 0;
        const sur = (text.match(/\bthe (\w+) (house|place)\b/i) || [])[1];
        const hh = sur && s.households.find((h) => h.surname && h.surname.toLowerCase() === sur.toLowerCase());
        (g.orders = g.orders || []).push({ member: q.id, target: hh ? hh.home : null, by: 'talk' });
        m.lastOrder = s.day;
        return respond(q, text, render, hh ? `The ${hh.surname} place, tonight. Consider it done.` : /purse|pocket/i.test(text) ? "I'll work the crowd at dusk and bring you what I lift." : "Tonight, then. I'll pick a likely house.");
      }
      return null;
    }
    (O.extraLines = O.extraLines || []).push((s, q) => { if (q.gang !== 'player') return ''; const g = s.playerGang && s.playerGang(), m = g && g.members.find((x) => x.id === q.id); if (!m) return ''; return `You are in the player's own gang, and the player is your boss. Your loyalty is ${m.loyalty > 0.7 ? 'strong' : m.loyalty > 0.4 ? 'fair' : 'wavering'}.${q._lieLow && s.day < q._lieLow ? ' You are lying low on the boss\'s word.' : ''}`; });
    // in the morning one of them comes to tell you how the night went; in the evening the idle ask for work
    let gtk = 6;
    game.hooks.update.push((dt) => {
      gtk -= dt; if (gtk > 0) return; gtk = 6;
      const s = cur(); if (!s || game.scene || !s.playerGang) return; const g = s.playerGang(); if (!g || !g.members.length) return;
      const P = game.player, h = s.minute / 60, talking = O.npcUI && O.npcUI.talking();
      const near = g.members.map((m) => s.byId.get(m.id)).filter((q) => q && q.agent && !q.agent.hidden && !q.jailUntil && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 260);
      if (talking || !near.length) return;
      const news = (g.log || []).filter((l) => new RegExp('^Day ' + (s.day - 1) + ':|^Day ' + s.day + ':').test(l));
      if (h >= 7 && h < 11 && news.length && g._told !== s.day) { g._told = s.day; const q = near[0]; O.npcUI.startFrom(q, `Boss. Last night: ${news.map((l) => l.replace(/^Day \d+: /, '')).join(' ')} The purse holds ₳${Math.round(g.purse || 0)}.`); return; }
      if (h >= 18 && h < 21 && g._asked !== s.day) { const q = near.find((z) => !(g.orders || []).some((o) => o.member === z.id) && !(z._lieLow && s.day < z._lieLow)); if (q) { g._asked = s.day; O.npcUI.startFrom(q, pick(['Any work tonight, boss?', "Boss. What's the job tonight?", "We're itching. Who do we do tonight?"])); } }
    });

    // ======================================================================== the words go to whichever of these fits
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      if (q && typeof text === 'string' && !(opt && opt.gift) && O.AI && O.AI.ready) {
        const s = cur();
        try { const r = tryGang(s, q, text, render) || tryStrike(s, q, text, render) || tryShop(s, q, text, render); if (r) return r; } catch (e) { console.error(e); }
      }
      return _say.apply(this, arguments);
    };
    O.TradeLife = { RX, haggle: (q, g) => haggle(cur(), q, g), stall: () => stall, setStall: (v) => { stall = v; }, isMarket };
  }
  O.TradeLifeSetup = { setup };
})();
