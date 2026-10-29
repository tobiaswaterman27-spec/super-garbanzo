// Work that needs a yes from someone: the tax collector has to get the money out of a household, the
// innkeeper wants another round sold, the priest wants a lapsed soul back at mass. You find the person,
// talk in your own words, and they agree or they don't, as themselves.
'use strict';
(function () {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const adults = (s, f) => s.people.filter((q) => !q.visitor && q.alive !== false && q.age >= 16 && !q.royal && (!f || f(q)));
  const nm = (q) => `${q.first} ${q.sur || ''}`.trim();
  // each role: who to ask, what for, and what follows a yes
  const JOBS = {
    'tax collector': (s, bz) => { const q = pick(adults(s, (p) => (s.household(p)?.money || 0) > 20)); return q && { who: q.id, text: `Get ${nm(q)} to pay the hearth tax`, goal: 'pay the hearth tax your household owes this week', why: 'The council wants its due.', pay: 4 }; },
    bailiff: (s) => { const q = pick(adults(s, (p) => (s.household(p)?.money || 0) > 15)); return q && { who: q.id, text: `Talk ${nm(q)} into settling a fine`, goal: 'pay a fine the court set on your household', why: 'The bailiff has come for it.', pay: 6 }; },
    innkeeper: (s, bz) => { const q = pick(adults(s, (p) => p.traits.includes('social') || p.traits.includes('friendly'))); return q && { who: q.id, text: `Bring ${nm(q)} in for a drink tonight`, goal: `come to ${bz.name} for a drink this evening`, sell: 'ale' }; },
    server: (s, bz) => { const q = pick(adults(s)); return q && { who: q.id, text: `Sell ${nm(q)} a meal at ${bz.name}`, goal: `come and eat at ${bz.name}`, sell: 'meal' }; },
    shopkeeper: (s, bz) => { const q = pick(adults(s)); return q && { who: q.id, text: `Talk ${nm(q)} into a purchase`, goal: `come to ${bz.name} and buy something`, sell: bz.def.sells[0] }; },
    baker: (s, bz) => { const q = pick(adults(s)); return q && { who: q.id, text: `Win ${nm(q)} as a regular for bread`, goal: `buy your bread from ${bz.name} from now on`, sell: 'bread' }; },
    butcher: (s, bz) => { const q = pick(adults(s)); return q && { who: q.id, text: `Sell ${nm(q)} a cut of meat`, goal: `buy meat from ${bz.name}`, sell: 'meat' }; },
    priest: (s) => { const q = pick(adults(s, (p) => p.traits.includes('lazy') || p.traits.includes('hostile') || p.traits.includes('suspicious'))); return q && { who: q.id, text: `Bring ${nm(q)} back to mass`, goal: 'come to mass this Sunday', why: 'The priest has missed you.', soul: true }; },
    physician: (s) => { const q = pick(adults(s, (p) => p.health.illness)) || pick(adults(s, (p) => p.age > 55)); return q && { who: q.id, text: `Persuade ${nm(q)} to take physic`, goal: 'take the physician\'s remedy and rest', heal: true }; },
    nurse: (s) => { const q = pick(adults(s, (p) => p.health.illness)); return q && { who: q.id, text: `Get ${nm(q)} to rest`, goal: 'rest in bed until you are well', heal: true }; },
    midwife: (s) => { const q = pick(adults(s, (p) => p.pregnant)); return q && { who: q.id, text: `Talk ${nm(q)} into lying in when her time comes`, goal: 'send for the midwife when your time comes, and lie in', heal: true }; },
    moneylender: (s) => { const q = pick(adults(s, (p) => (s.household(p)?.money || 0) < 30)); return q && { who: q.id, text: `Talk ${nm(q)} into a loan`, goal: 'borrow money from the moneylender, at interest', pay: 3 }; },
    teacher: (s) => { const q = pick(adults(s, (p) => (p.children || []).some((id) => { const c = s.byId.get(id); return c && c.age >= 6 && c.age < 13; }))); return q && { who: q.id, text: `Get ${nm(q)} to send a child to lessons`, goal: 'send your child to lessons at the chapel' }; },
    'market warden': (s) => { const q = pick(adults(s, (p) => p.job && s.biz.get(p.job.biz)?.def.sells?.length)); return q && { who: q.id, text: `Get ${nm(q)} to take a market stall`, goal: 'take a stall at the market on market day, for a fee', pay: 3 }; },
    'horse trader': (s) => { const q = pick(adults(s, (p) => (s.household(p)?.money || 0) > 120)); return q && { who: q.id, text: `Sell ${nm(q)} a horse`, goal: 'buy a horse', pay: 20 }; },
    'town crier': (s) => { const q = pick(adults(s, (p) => p.traits.includes('social'))); return q && { who: q.id, text: `Get ${nm(q)} to spread the council's notice`, goal: 'tell your neighbours the council\'s notice' }; },
    guard: (s) => { const c = (s.crimes || []).filter((x) => !x.solved && x.witnesses && x.witnesses.length).pop(); const w = c && s.byId.get(c.witnesses[0].id); return w && w.alive !== false && { who: w.id, text: `Get ${nm(w)} to tell what they saw of the ${c.kind}`, goal: `tell the watch exactly what you saw of the ${c.kind}`, why: 'The watch wants a description.' }; },
    sergeant: (s) => JOBS.guard(s),
    'master builder': (s) => { const q = pick(adults(s, (p) => (s.household(p)?.money || 0) > 100)); return q && { who: q.id, text: `Win ${nm(q)} as a customer for the yard`, goal: 'have the builders\' yard do work on your house', pay: 8 }; },
    steward: (s) => { const q = pick(adults(s, (p) => p.job && /farm|baker|butcher|brew/.test(s.biz.get(p.job.biz)?.type || ''))); return q && { who: q.id, text: `Haggle ${nm(q)} down on supplies`, goal: 'sell to the household at a fairer price', pay: 5 }; },
    'house agent': (s) => { const q = pick(adults(s)); return q && { who: q.id, text: `Talk ${nm(q)} into taking a house`, goal: 'rent or buy one of the houses the agent has on the books', pay: 6 }; },
  };
  O.PERSUADE_JOBS = JOBS;
  O.extraTasks = (s, bz, e, out) => {
    if (!O.AI || !O.AI.ready || O.COURT?.has(e.role)) return [];
    const f = JOBS[e.role]; if (!f || Math.random() < 0.35) return [];
    const t = f(s, bz, e); if (!t || t.who == null) return [];
    return [Object.assign({ kind: 'persuade', optional: false }, t)];
  };
  // while such a task is open, the person is asked; a yes finishes it and has its effect
  O.addAsk((q) => {
    const PS = O.PlayerState, e = PS.emp, s = O.SimRef.cur;
    if (!e || !e.onShift || e.place !== s.world.placeId) return null;
    const t = (e.tasks || []).find((x) => x.kind === 'persuade' && x.who === q.id && x.have < x.need); if (!t) return null;
    return { goal: t.goal, why: t.why, onAgree: () => {
      const hh = s.household(q), bz = s.biz.get(e.biz);
      if (t.pay && hh && hh.money >= t.pay) { hh.money -= t.pay; if (bz && bz.def.public) s.treasury.cash += t.pay; else if (bz) bz.cash += t.pay; }
      if (t.sell && bz && (bz.stock[t.sell] || 0) >= 1 && hh && hh.money >= 3) { const pr = s.price(bz, t.sell); if (hh.money >= pr) { hh.money -= pr; bz.stock[t.sell] -= 1; bz.cash += pr; bz.salesToday += pr; } }
      if (t.heal && q.health.illness) q.health.illness.sev = Math.max(0, q.health.illness.sev - 0.2);
      s.remember(q, `Was talked into it: ${t.goal}.`, 'player', 0.7, 0);
      O.jobEvent && O.jobEvent('persuaded', { q });
    } };
  });
  O.Persuade = { JOBS };
})();
