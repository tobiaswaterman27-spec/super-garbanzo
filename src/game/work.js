// Honest work. Ask a master at their workplace for a day's work; work hour-long shifts at the
// trade's workstations (time passes, you tire and hunger, the business really produces, and you're
// paid from its till); learn the trade's skill as you go. A few days' good work and the master may
// take you on as an apprentice: steady work every day, faster learning. Skill earns you better pay
// and a name: labourer, apprentice, journeyman, master.
//
// Reputation counts: masters won't hire a known thief, shopkeepers charge strangers and rogues more
// and favoured customers less, and some won't serve you at all once your name is mud.
'use strict';
(function () {
  const SKILL_OF = { bakery: 'baking', smithy: 'smithing', armourer: 'smithing', tavern: 'serving', farmhouse: 'farming', woodcutter: 'woodcraft', carpenter: 'woodcraft', mill: 'milling', store: 'trading', warehouse: 'hauling', butcher: 'butchery', stable: 'horsemanship', doctor: 'physic', apothecary: 'physic', fishery: 'fishing', mine: 'mining', jeweller: 'goldsmithing', sawmill: 'woodcraft', quarry: 'mining' };
  const SKILL_LABEL = { baking: 'Baking', smithing: 'Smithing', serving: 'Serving', farming: 'Farming', woodcraft: 'Woodcraft', milling: 'Milling', trading: 'Trading', hauling: 'Hauling', butchery: 'Butchery', horsemanship: 'Horsemanship', physic: 'Physic', fishing: 'Fishing', mining: 'Mining', goldsmithing: 'Goldsmithing', stealth: 'Stealth', lockpick: 'Lock-picking' };
  const rank = (v) => (v >= 0.7 ? 'master' : v >= 0.4 ? 'journeyman' : v >= 0.15 ? 'apprentice' : 'novice');

  function setup(game, sim, npcUI) {
    const PS = O.PlayerState, toast = (t, k) => O.Panels.toast(t, k);
    PS.skills = PS.skills || { stealth: 0.1, lockpick: 0.1 };
    const cur = () => O.SimRef.cur, placeId = () => cur().world.placeId || 'ashford';

    // the current job, if still valid today
    function job() {
      const J = PS.job, s = cur();
      if (!J) return null;
      if (J.place !== placeId()) return null;
      if (!s.biz.get(J.biz)) { PS.job = null; return null; }
      if (!J.apprentice && J.day !== s.day) return null;
      return J;
    }
    O.Work = { job, SKILL_OF, SKILL_LABEL, rank };

    // ---------------------------------------------------------------- hiring
    const isMaster = (q, bz) => bz && (bz.owner === q.id || bz.workers[0] === q.id || (q.job?.role && bz.def.jobs[0][0] === q.job.role));
    function heardBadOf(q) { const Ch = O.Chronicle; return (q.heard || []).some((h) => { const f = Ch.byId(h.f); return f && f.byPlayer && !f.secret && f.cat === 'crime'; }); }
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => {
      const out = prevExtra ? prevExtra(q) : [];
      const s = cur(), bz = q.job?.biz ? s.biz.get(q.job.biz) : null;
      if (bz && SKILL_OF[bz.type] && q.agent.inside === bz.id && bz.open && isMaster(q, bz)) {
        const J = job();
        if (J && J.biz === bz.id) out.push(['quit', J.apprentice ? 'Leave your apprenticeship' : 'Finish for today']);
        else out.push(['askwork', 'Ask for work']);
      }
      return out;
    };
    npcUI.onExtra = (q, key, render) => {
      if (key === 'askwork') return render(askWork(q));
      if (key === 'quit') { const J = PS.job; PS.job = null; if (J?.apprentice) { cur().remember(q, 'My apprentice, the stranger, has left me.', 'work', 1.5); cur().relate(q, { id: 0 }, -0.1); return render("Go, then. You'll not find a better master, mark me."); } return render('Good. Same again tomorrow, if you want it.'); }
      return prevOn && prevOn(q, key, render);
    };
    function askWork(q) {
      const s = cur(), bz = s.biz.get(q.job.biz), sk = SKILL_OF[bz.type];
      const r0 = q.rel.get(0) || { affinity: 0, familiar: 0 };
      if (PS.wantedLevel && PS.wantedLevel() >= 1 && (q.memories.some((m) => m.kind === 'crime' && m.about === 0) || heardBadOf(q))) return "Work? For you? I know what you are. Get out before I call the watch.";
      if (PS.rep.local < -0.35 || r0.affinity < -0.3) return "I've no work for the likes of you.";
      if (PS.job && PS.job.apprentice && PS.job.biz !== bz.id) return "You're bound to another master. Finish there first.";
      if (bz.cash < 25) return "I can't pay the hands I've got. Try the farm, or the mill.";
      if (PS.energy < 20) return 'You look dead on your feet. Sleep, and come back.';
      const prev = PS.job && PS.job.biz === bz.id ? PS.job : null;
      const days = (PS.workDays && PS.workDays[bz.id + '@' + placeId()]) || 0;
      PS.job = { biz: bz.id, place: placeId(), placeName: s.world.name, bizName: bz.name, skill: sk, day: s.day, master: q.id, masterName: q.name, apprentice: !!(prev && prev.apprentice), hoursToday: 0 };
      s.relate(q, { id: 0 }, 0.02);
      if (days >= 4 && !PS.job.apprentice && (PS.skills[sk] || 0) >= 0.12 && r0.affinity > 0.05) {
        PS.job.apprentice = true;
        O.Chronicle.deed(s, `A newcomer has been taken on as apprentice at ${bz.name}.`, `${q.name} took you on as apprentice at ${bz.name}.`, 'player', 1, true);
        s.remember(q, 'Took the stranger on as my apprentice. Good hands.', 'work', 2, 0);
        return `You've worked well these ${days} days. Stay on as my apprentice: steady work, every day, and I'll teach you the trade properly.`;
      }
      const wage = hourly(bz, sk);
      return days ? `Back again? Good. Same terms: ${wage < 1 ? 'under an aurin' : '₳' + wage} the hour. Find a bench and set to.` : `I can use a pair of hands today. ${wage < 1 ? 'Under an aurin' : '₳' + wage} the hour, paid as you go. Mind you don't spoil anything.`;
    }
    O.Work.askWork = askWork;
    function hourly(bz, sk) {
      const base = Math.max(...Object.values(bz.def.wage || { x: 6 }), 6);
      return Math.round((base / 5) * (0.7 + (PS.skills[sk] || 0) * 1.3) * (PS.job && PS.job.apprentice ? 0.85 : 1) * 10) / 10;
    }

    // ---------------------------------------------------------------- the shift
    O.workCandidate = (scene, it, d, cx, cy) => {
      const J = job(); if (!J || scene.b.id !== J.biz || scene.floor !== 0) return null;
      if (!(it.work || it.counter || it.kind === 'millstone' || it.kind === 'anvil' || it.kind === 'workbench')) return null;
      return { type: 'work', it, d: d - 14, x: cx, y: cy }; // your own bench comes before chatting to the staff
    };
    O.workLabel = () => { const J = job(); const bz = J && cur().biz.get(J.biz); return bz ? `Work an hour · ₳${hourly(bz, J.skill).toFixed(1)}` : 'Work'; };
    O.workShift = () => {
      const J = job(), s = cur(), bz = J && s.biz.get(J.biz);
      if (!bz) return toast('You have no work here today.', 'bad');
      if (!bz.open) return toast(`${bz.name} is closed. Come back in working hours.`, 'bad');
      if (PS.energy < 12) return toast("You're too tired to work. Sleep first.", 'bad');
      if (PS.hunger < 8) return toast("You're too hungry to work. Eat something.", 'bad');
      const sk = J.skill, before = PS.skills[sk] || 0;
      game.player.anim = 'work';
      for (let i = 0; i < 30; i++) { s.tick(2); PS.tick(2, false); }
      PS.energy = Math.max(0, PS.energy - 4);
      // the work itself: the business's recipes run for an hour at your skill
      const rate = 0.5 + before * 0.75;
      let made = [];
      for (const rc of bz.def.recipes) {
        if (rc.role && rc.role !== bz.def.jobs[0][0]) continue;
        if (Object.entries(rc.inp).some(([g, q]) => (bz.stock[g] || 0) < q * rate)) continue;
        for (const [g, q] of Object.entries(rc.inp)) bz.stock[g] -= q * rate;
        for (const [g, q] of Object.entries(rc.out)) { bz.stock[g] = (bz.stock[g] || 0) + q * rate; made.push(`${(q * rate).toFixed(q * rate < 2 ? 1 : 0)} ${O.Data.GOODS[g].name.toLowerCase()}`); }
      }
      if (!bz.def.recipes.length) bz.salesToday += 2; // hauling, serving and minding the counter bring custom
      // pay from the till
      // pay accrues in fractions of an aurin and is handed over in whole aurins
      const wage = hourly(bz, sk); PS.owed = (PS.owed || 0) + wage;
      const paid = Math.max(0, Math.min(Math.floor(PS.owed), Math.floor(bz.cash))); PS.owed -= paid;
      bz.cash -= paid; PS.money += paid; PS.earned = (PS.earned || 0) + paid;
      // learning: fast at first, slower toward mastery; an apprentice learns twice as fast
      PS.skills[sk] = Math.min(1, before + 0.006 * (1 - before * 0.8) * (J.apprentice ? 2 : 1));
      J.hoursToday = (J.day === s.day ? J.hoursToday || 0 : 0) + 1; J.day = s.day;
      PS.workDays = PS.workDays || {}; const key = J.biz + '@' + J.place;
      if (J.hoursToday === 4) { PS.workDays[key] = (PS.workDays[key] || 0) + 1; PS.rep.local = Math.min(1, PS.rep.local + 0.03); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.01); const m = s.byId.get(J.master); if (m) { s.relate(m, { id: 0 }, 0.05); s.remember(m, 'The stranger did a fair day\'s work for me.', 'work', 1, 0); } }
      const up = rank(PS.skills[sk]) !== rank(before) ? ` You are now a ${rank(PS.skills[sk])} in ${SKILL_LABEL[sk].toLowerCase()}.` : '';
      if (up && rank(PS.skills[sk]) !== 'apprentice') O.Chronicle.deed(s, `The newcomer is now reckoned a ${rank(PS.skills[sk])} ${SKILL_LABEL[sk].toLowerCase()} hand in ${s.world.name}.`, `You became a ${rank(PS.skills[sk])} in ${SKILL_LABEL[sk].toLowerCase()}.`, 'player', 2, true);
      toast(`An hour's work at ${bz.name}${made.length ? ': ' + made.join(', ') : ''}. ${paid ? `Paid ₳${paid}` : 'Your pay is owing'}${PS.owed >= 0.1 ? ` (₳${PS.owed.toFixed(1)} to come)` : ''}${bz.cash < 1 ? '; the till is empty' : ''}.${up}`);
      setTimeout(() => { if (game.player.anim === 'work') game.player.anim = 'idle'; }, 1200);
    };

    // ---------------------------------------------------------------- prices and refusals
    // a shopkeeper's price for you: favour knocks some off, a bad name puts it up
    O.priceFor = (s, bz, g, seller) => {
      const aff = seller ? (seller.rel.get(0)?.affinity || 0) : 0;
      const k = O.clamp(1 - PS.rep.merchant * 0.12 - PS.rep.local * 0.1 - aff * 0.1 + (seller && heardBadOf(seller) ? 0.15 : 0), 0.8, 1.4);
      return Math.max(1, Math.round(s.price(bz, g) * k));
    };
    // a shopkeeper only turns you away if they themselves hold something against you, or if they know
    // who you are and what you've done: your name being mud means nothing to someone who's never seen you
    O.refusesTrade = (seller) => {
      if (!seller) return null;
      const r = seller.rel.get(0) || {}, knowsYou = (r.familiar || 0) >= 0.25;
      const grudge = (r.affinity || 0) < -0.5;
      const knownBad = knowsYou && (PS.rep.local < -0.55 || (PS.wantedLevel && PS.wantedLevel() >= 2));
      return grudge || knownBad ? `${seller.first} folds their arms. “I know you. We don't serve your kind here.”` : null;
    };
  }

  O.WorkSetup = { setup };
})();
