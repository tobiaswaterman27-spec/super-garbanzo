// The lives people lead. Everyone has something they're working towards, and they get there or don't:
// a tidy sum saved, a mastery won, a marriage, a move to the capital; then they want something else.
// When someone dies, their family and close friends mourn for a week: they keep in of an evening, are
// seen grieving, and talk of it. And children of twelve or so are put out to a trade by their parents,
// apprenticed to a master in the town.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const GOALS = (O.Data && O.Data.GOALS) || ['save a tidy sum', 'become a master', 'marry', 'open a shop'];

    // ---------------------------------------------------------------- goals reached
    const reached = (s, p) => {
      const hh = s.household(p), g = p.goal || '';
      if (/save a tidy sum|become wealthy/.test(g)) return hh && hh.money > 220;
      if (/become a master/.test(g)) return p.job && (p.skills[p.job.role] || 0) > 0.75;
      if (/marry/.test(g)) return !!p.spouse;
      if (/see the children settled/.test(g)) return (p.children || []).length && (p.children || []).every((id) => { const c = s.byId.get(id); return !c || c.age >= 18 && (c.job || c.spouse); });
      if (/pay off/.test(g)) return hh && hh.money > 60;
      if (/retire in comfort/.test(g)) return p.age >= 60 && hh && hh.money > 150;
      return false;
    };
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      for (const p of this.people) {
        if (p.visitor || p.alive === false || p.age < 16) continue;
        if (!p.goal && this.rng.chance(0.05)) p.goal = pick(GOALS.filter((g) => !(p.spouse && /marry/.test(g))));
        if (p.goal && reached(this, p) && this.rng.chance(0.5)) {
          const was = p.goal; this.remember(p, `I've done it: I meant to ${was}, and I have.`, 'life', 2);
          if (/move to the capital/.test(was)) continue;
          if (this.rng.chance(0.3)) this.log(`${p.name} has done what they set out to do: ${was}.`, 'life');
          p.goal = pick(GOALS.filter((g) => g !== was && !(p.spouse && /marry/.test(g))));
        }
        // a dream of the capital, now and then acted on
        if (/move to the capital/.test(p.goal || '') && this.world.placeId !== 'capital' && this.rng.chance(0.004)) { const hh = this.household(p); if (hh && hh.money > 120 && hh.members[0] === p.id && this.emigrate) { this.log(`The ${hh.surname} family have packed up for the capital, to seek their fortune.`, 'migration'); this.emigrate(hh); } }
        // mourning ends
        if (p.mourning && this.day > p.mourning.until) p.mourning = null;
      }
      // children put out to a trade
      if (this.weekday === 1) for (const c of this.people) {
        if (c.job || c.visitor || c.age < 12 || c.age > 15 || c.alive === false || c.gang || this.rng.chance(0.7)) continue;
        const parent = (c.parents || []).map((id) => this.byId.get(id)).find((q) => q && q.job) || this.byId.get(this.household(c)?.members[0]);
        const pbz = parent && parent.job && this.biz.get(parent.job.biz);
        const choices = [...this.biz.values()].filter((z) => !z.def.public && z.type !== 'site' && !z.closedDown && z.workers.length >= 1 && z.workers.length < 6);
        const bz = pbz && !pbz.def.public && pbz.type !== 'site' ? pbz : choices[Math.floor(this.rng.next() * choices.length)]; if (!bz) continue;
        c.job = { biz: bz.id, role: 'apprentice', wage: 1, since: this.day }; bz.workers.push(c.id); c.skills = c.skills || {}; c.skills.apprentice = 0.05;
        this.remember(c, `I've been apprenticed at ${bz.name}. ${pbz === bz ? 'Same as my father.' : 'A new trade.'}`, 'life', 2);
        if (parent) this.remember(parent, `We've put ${c.first} out to ${bz.name} as an apprentice.`, 'life', 1.2);
        this.log(`${c.name}, aged ${c.age}, has been apprenticed at ${bz.name}.`, 'life');
      }
      return r;
    };

    // ---------------------------------------------------------------- mourning
    const _die = SP.die;
    if (_die) SP.die = function (p, cause) {
      const r = _die.apply(this, arguments);
      try {
        const close = this.people.filter((q) => q !== p && q.alive !== false && (q.household === p.household || q.spouse === p.id || (p.children || []).includes(q.id) || (q.rel && (q.rel.get(p.id) || {}).affinity > 0.45)));
        for (const q of close) { q.mourning = { for: p.first + (p.sur ? ' ' + p.sur : ''), until: this.day + 7, kin: q.household === p.household || q.spouse === p.id }; }
      } catch (e) { console.error(e); }
      return r;
    };
    const _plan = SP.plan;
    SP.plan = function (p) {
      const a = _plan.call(this, p);
      if (p.mourning && p.mourning.kin && a && this.hour >= 18 && ['festival', 'feast', 'socialise', 'stroll', 'maydance', 'bonfire'].includes(a.act) && p.home != null) return { act: 'home', b: p.home };
      return a;
    };
    let mt = 0;
    game.hooks.update.push((dt) => {
      mt -= dt; if (mt > 0) return; mt = 5; const s = cur(); if (!s) return; const P = game.player, now = performance.now();
      const there = game.scene ? [...game.scene.actors.values()].map((a) => a.person).filter(Boolean) : s.people.filter((q) => !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 260);
      const q = there.find((z) => z.mourning && !(z.agent.gest && z.agent.gest.until > now) && Math.random() < 0.25); if (!q) return;
      O.gesture(q, q.mourning.kin ? 'mourn' : 'pray', 2.6); O.Speech && O.Speech.say(q, pick([`(wipes their eyes)`, `God rest ${q.mourning.for.split(' ')[0]}.`, '*sigh*']), 2.4);
    });
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [];
      if (q.mourning) out.push(`You are in mourning for ${q.mourning.for}, who died lately${q.mourning.kin ? ' (your own family)' : ' (a dear friend)'}; grief colours everything you say.`);
      if (q.goal) out.push(`What you want most in life just now: to ${q.goal}.`);
      if (q.job && q.job.role === 'apprentice' && q.age < 16) out.push(`You are a young apprentice, still learning, often scolded, sometimes praised.`);
      return out.join(' ');
    });
  }
  O.NpcLifeSetup = { setup };
})();
