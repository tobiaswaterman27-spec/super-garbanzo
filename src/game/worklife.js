// Working life. Wages are owed, and when a master can't or won't pay them in full, day after day, the
// hands grumble and then down tools: they stand outside the door shouting their grievance and nothing is
// made until they're paid what's owed, or sacked and replaced. If it's your shop, their spokesman comes
// to you. A hand who has been long at a trade and knows it best is made foreman, with a foreman's pay.
// And at work, the masters chivvy and praise their apprentices, and as the day wears on the hands yawn
// and stretch and count the minutes.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const sp = (q, t, secs = 2.6) => O.Speech && O.Speech.say(q, t, secs);
    const wageOf = (bz, w) => w.job.wage ?? (bz.def.wage && bz.def.wage[w.job.role]) ?? 0;
    const mineBz = (bz) => bz.ownerPlayer || bz.owner === 'player' || (bz.b && bz.b.owner && bz.b.owner.kind === 'player');

    // ---------------------------------------------------------------- what's owed
    const _pay = SP.payWages;
    SP.payWages = function (bz) {
      const before = new Map(); for (const id of bz.workers) { const w = this.byId.get(id); const hh = w && this.household(w); if (hh) before.set(id, hh.money); }
      const r = _pay.apply(this, arguments);
      for (const id of bz.workers) {
        const w = this.byId.get(id), hh = w && this.household(w); if (!w || !w.job || !hh || !before.has(id)) continue; const due = wageOf(bz, w); if (!due) continue;
        const got = hh.money - before.get(id); if (got < due - 0.5) { w.job.short = (w.job.short || 0) + 1; w.job.owed = (w.job.owed || 0) + (due - Math.max(0, got)); } else w.job.short = Math.max(0, (w.job.short || 0) - 1);
      }
      return r;
    };
    // the strike, and its end
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      for (const bz of this.biz.values()) {
        if (bz.def.public || bz.type === 'site') continue;
        const ws = bz.workers.map((id) => this.byId.get(id)).filter((w) => w && w.job && w.id !== bz.owner);
        if (!bz.strike) {
          const angry = ws.filter((w) => (w.job.short || 0) >= 3); if (angry.length >= 2 || (angry.length && ws.length === 1)) { bz.strike = { since: this.day, who: angry.map((w) => w.id) }; this.log(`The hands at ${bz.name} have downed tools: they say they're owed wages, and won't work till they're paid.`, 'economy'); for (const w of angry) this.remember(w, `We've downed tools at ${bz.name} till we're paid.`, 'work', 2); }
          continue;
        }
        const strikers = bz.strike.who.map((id) => this.byId.get(id)).filter((w) => w && w.job && w.job.biz === bz.id), owed = strikers.reduce((v, w) => v + Math.ceil(w.job.owed || 0), 0);
        if (!strikers.length) { bz.strike = null; continue; }
        if (mineBz(bz)) continue; // yours to settle
        if ((bz.cash || 0) >= owed) { bz.cash -= owed; for (const w of strikers) { const hh = this.household(w); if (hh) hh.money += Math.ceil(w.job.owed || 0); w.job.owed = 0; w.job.short = 0; } bz.strike = null; this.log(`The strike at ${bz.name} is over: the hands have been paid what they were owed.`, 'economy'); }
        else if (this.day - bz.strike.since >= 3) { for (const w of strikers) { bz.workers = bz.workers.filter((x) => x !== w.id); this.remember(w, `${bz.name} turned us all off rather than pay what we were owed.`, 'work', 2.5); w.job = null; } bz.strike = null; this.log(`${bz.name} has turned off its striking hands and will take on new ones.`, 'economy'); this.fillVacancies && this.fillVacancies(); }
      }
      // a foreman, from the best and longest-serving hand
      if (this.weekday === 0) for (const bz of this.biz.values()) {
        if (bz.def.public || bz.workers.length < 3 || bz.workers.some((id) => this.byId.get(id)?.job?.foreman)) continue;
        const best = bz.workers.map((id) => this.byId.get(id)).filter((w) => w && w.job && w.id !== bz.owner && (w.skills[w.job.role] || 0) > 0.6).sort((a, b) => (b.skills[b.job.role] || 0) - (a.skills[a.job.role] || 0))[0];
        if (best && this.rng.chance(0.3)) { best.job.foreman = true; best.job.wage = wageOf(bz, best) + 2; this.remember(best, `I've been made foreman at ${bz.name}, with two aurins more a day.`, 'work', 2); this.log(`${best.name} has been made foreman at ${bz.name}.`, 'economy'); }
      }
      return r;
    };
    // the strikers stand at the door; nothing is made
    const _plan = SP.plan;
    SP.plan = function (p) {
      const a = _plan.call(this, p); if (!p.job || !a || a.act !== 'work') return a;
      const bz = this.biz.get(p.job.biz); if (bz && bz.strike && bz.strike.who.includes(p.id)) return { act: 'stroll', outdoor: true, zone: 'strike', strikeAt: bz.id };
      return a;
    };
    const _zone = SP.zoneTile;
    SP.zoneTile = function (p, zone) { if (zone === 'strike' && p.activity?.strikeAt != null) { const b = this.building(p.activity.strikeAt); if (b) return [b.doorX - 1 + (p.id % 3), b.doorY + 2 + (p.id % 2)]; } return _zone.call(this, p, zone); };
    const _work = SP.work;
    SP.work = function (p) { const bz = p.job && this.biz.get(p.job.biz); if (bz && bz.strike) return; return _work.call(this, p); };
    let st = 0;
    game.hooks.update.push((dt) => {
      st -= dt; if (st > 0 || game.scene) return; st = 3; const s = cur(); if (!s) return; const P = game.player;
      for (const q of s.people) {
        if (!q.activity?.strikeAt || q.agent.hidden || Math.hypot(q.agent.x - P.x, q.agent.y - P.y) > 280 || Math.random() > 0.4) continue;
        O.gesture(q, pick(['point', 'shake', 'gesture']), 1.8); sp(q, pick(['Pay us what we\'re owed!', 'No pay, no work!', 'Three days\' wages owing!', 'Shame on this house!']));
      }
      // at your own shop, the spokesman comes to you
      for (const bz of s.biz.values()) {
        if (!bz.strike || !mineBz(bz) || bz.strike.told === s.day) continue; const q = s.byId.get(bz.strike.who[0]);
        if (q && !q.agent.hidden && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 200 && O.npcUI && !O.npcUI.talking()) { bz.strike.told = s.day; O.npcUI.startFrom(q, `We've downed tools at ${bz.name}. We're owed our wages and we'll not lift a hand till they're paid.`); }
      }
    });
    // settling it yourself
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), P = game.player; if (!s || game.scene) return null;
      for (const bz of s.biz.values()) {
        if (!bz.strike || !mineBz(bz)) continue; const q = s.byId.get(bz.strike.who[0]); if (!q || q.agent.hidden || Math.hypot(q.agent.x - P.x, q.agent.y - P.y) > 60) continue;
        const ws = bz.strike.who.map((id) => s.byId.get(id)).filter((w) => w && w.job), owed = ws.reduce((v, w) => v + Math.ceil(w.job.owed || 0), 0);
        return { type: 'custom', d: 6, x: q.agent.x, y: q.agent.y - 48, label: `Pay the strikers what they're owed (₳${owed})`, act: () => {
          if (PS.money < owed) return say(`You haven't ₳${owed}.`, 'bad'); PS.money -= owed; P.anim = 'count'; setTimeout(() => { P.anim = 'idle'; }, 1400);
          for (const w of ws) { const hh = s.household(w); if (hh) hh.money += Math.ceil(w.job.owed || 0); w.job.owed = 0; w.job.short = 0; s.relate(w, { id: 0 }, 0.05); O.gesture(w, 'nod', 1.5); }
          bz.strike = null; say(`You pay out ₳${owed}. The hands go back in to work, muttering, but working.`);
        } };
      }
      return null;
    });
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a) {
      if (a && a.do === 'end_strike') { const bz = q.job && s.biz.get(q.job.biz); if (!bz || !bz.strike || !bz.strike.who.includes(q.id)) return null; bz.strike.who = bz.strike.who.filter((id) => id !== q.id); q.job.short = 0; return `${q.first} gives up the strike and goes back to work.`; }
      return base.apply(this, arguments);
    };
    (O.extraActs = O.extraActs || []).push('end_strike {} (a striker: give up the strike and go back in, if persuaded)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      if (!q.job) return ''; const bz = s.biz.get(q.job.biz); const out = [];
      if (bz && bz.strike && bz.strike.who.includes(q.id)) out.push(`You are on strike outside ${bz.name}: owed about ₳${Math.ceil(q.job.owed || 0)} in wages. You won't work until paid.`);
      else if ((q.job.short || 0) >= 1) out.push(`Your wages at ${bz ? bz.name : 'work'} have been short lately and you're angry about it.`);
      if (q.job.foreman) out.push(`You are foreman at ${bz ? bz.name : 'work'}.`);
      return out.join(' ');
    });

    // ---------------------------------------------------------------- life on the shop floor
    let wt = 0;
    game.hooks.update.push((dt) => {
      wt -= dt; if (wt > 0) return; wt = 7; const s = cur(), sc = game.scene; if (!s || !sc) return;
      const b = sc.b.parent || sc.b, bz = s.biz.get(b.id); if (!bz || bz.def.public || !bz.open) return;
      const here = [...sc.actors.values()].map((a) => a.person).filter((q) => q && q.job && q.job.biz === bz.id && q.activity?.act === 'work'); if (here.length < 2 || Math.random() > 0.5) return;
      const master = here.find((q) => q.id === bz.owner || q.id === bz.workers[0]) || here[0], hand = here.find((q) => q !== master);
      const close = bz.def.hours ? bz.def.hours[1] - s.hour : 9;
      if (close > 0 && close < 1) { O.gesture(hand, pick(['yawn', 'stretch']), 2); sp(hand, pick(['Is it closing yet?', '*yawn*', 'My back...'])); return; }
      if (hand.age < 18 || (hand.skills[hand.job.role] || 0) < 0.3) { O.gesture(master, 'point', 1.6); sp(master, pick(['Not like that! Watch me.', 'Mind the fire, lad.', 'Good. Again, and quicker.', 'Who taught you that? Not me.'])); setTimeout(() => { O.gesture(hand, 'nod', 1.2); sp(hand, pick(['Yes, master.', 'Sorry, master.', 'Like this?'])); }, 2000); }
      else { O.gesture(hand, 'laugh', 1.5); sp(hand, pick(['Did you hear about the miller\'s goat?', 'Busy today.', 'Pass me that, will you?', 'Nearly done with this one.'])); }
    });
  }
  O.WorkLifeSetup = { setup };
})();
