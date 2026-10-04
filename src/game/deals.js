// Standing deals and moving house. A business can strike a standing deal with a supplier: "every Sunday
// bring me ten sacks of flour at three aurins each" (any day of the week, or every day). The supplier's master weighs the price against
// what the goods are worth and how they feel about you; once agreed, on that morning a hand from
// the supplier carries the load over (you can watch them do it) and the money changes hands. Masters
// in town strike deals of their own when they keep running short. An owner can also move a business
// to other premises they own or rent: its stock, purse, hands and deals go with it, and the old place
// stands empty. (Equipment stays behind: the new place must be fitted out before the work can go on.)
'use strict';
(function () {
  function setup(game) {
    const T = 16, G = () => O.Data.GOODS;
    const sellersOf = (s, g, not) => [...s.biz.values()].filter((z) => z !== not && !z.def.public && z.type !== 'site' && ((z.def.sells || []).includes(g) || (z.def.recipes || []).some((rc) => rc.out && rc.out[g])));
    function offer(s, bz, g, qty, price, when) {
      const base = G()[g]?.base || 2; price = price || Math.max(1, Math.round(base));
      const sup = sellersOf(s, g, bz).sort((a, c) => (c.stock[g] || 0) - (a.stock[g] || 0))[0];
      if (!sup) return { ok: false, msg: `Nobody in ${s.world.name} makes or sells ${G()[g]?.name.toLowerCase() || g}.` };
      const boss = s.bossOf ? s.bossOf(sup) : null, like = boss ? ((boss.rel.get(bz.ownerPlayer ? 0 : bz.owner) || {}).affinity || 0) : 0;
      if (price < base * (0.95 - like * 0.2)) return { ok: false, msg: `${boss ? boss.first : sup.name} won't do it at that price.` };
      bz.deals = bz.deals || [];
      if (bz.deals.some((d) => d.good === g)) return { ok: false, msg: 'You already have a deal for that.' };
      when = when == null ? s.rng.int(0, 6) : when; // a day of the week, or 'daily'
      bz.deals.push({ good: g, qty, price, from: sup.id, fromName: sup.name, since: s.day, when });
      const wd = when === 'daily' ? 'every day' : `every ${O.DAYNAMES[when]}`;
      if (boss) s.remember(boss, `Agreed to send ${qty} ${G()[g]?.name.toLowerCase()} to ${bz.name} ${wd}.`, 'work', 1);
      return { ok: true, msg: `${boss ? boss.first + ' of ' : ''}${sup.name} agrees: ${qty} ${G()[g]?.name.toLowerCase()} ${wd} at ₳${price} each.` };
    }
    // Sunday morning: the loads go over
    function deliver(s, bz, d, live) {
      const sup = s.biz.get(d.from); if (!sup) { bz.deals = bz.deals.filter((x) => x !== d); return; }
      const have = Math.floor(sup.stock[d.good] || 0), n = Math.min(d.qty, have), cost = n * d.price;
      if (n < 1 || bz.cash < cost) { d.missed = (d.missed || 0) + 1; s.log(`${sup.name} could not make its Sunday delivery to ${bz.name}${bz.cash < cost ? ' (the purse was short)' : ''}.`, 'trade'); if (d.missed >= 3) bz.deals = bz.deals.filter((x) => x !== d); return; }
      const settle = () => { sup.stock[d.good] -= n; bz.stock[d.good] = (bz.stock[d.good] || 0) + n; bz.cash -= cost; sup.cash += cost; s.log(`${sup.name} delivered ${n} ${G()[d.good]?.name.toLowerCase()} to ${bz.name} as agreed (₳${cost}).`, 'trade'); };
      // in sight, a hand carries it over
      const hand = live && sup.workers.map((id) => s.byId.get(id)).find((q) => q && q.alive !== false && q.agent && !q.errand && q.age >= 14);
      if (hand && O.Errands) {
        if (hand.agent.inside != null) { const sb = s.building(hand.agent.inside); if (sb && sb.doorX != null) { hand.agent.x = sb.doorX * T + 8; hand.agent.y = (sb.doorY) * T + 10; hand.agent.inside = null; hand.agent.hidden = false; } }
        if (O.Errands.send(s, hand, [bz.b.doorX, bz.b.doorY], { anim: 'place', secs: 1.5, face: 3, carry: { good: d.good, qty: n }, after: (ok) => { settle(); void ok; } })) return;
      }
      settle();
    }
    let lastDay = new Map();
    game.hooks.update.push(() => {
      const sims = [O.SimRef.home, ...[...(O.Travel?.visited.values() || [])].map((v) => v.sim)].filter(Boolean);
      for (const s of new Set(sims)) {
        if (s.hour < 9 || lastDay.get(s) === s.day) continue;
        lastDay.set(s, s.day);
        const live = s === O.SimRef.cur && !game.scene;
        for (const bz of s.biz.values()) for (const d of (bz.deals || []).slice()) {
          if (!(d.when === 'daily' || (d.when ?? 6) === s.weekday)) continue;
          const near = live && Math.hypot(bz.b.doorX * T - game.player.x, bz.b.doorY * T - game.player.y) < 500;
          deliver(s, bz, d, near);
        }
        // masters who keep running short strike deals of their own (looked at on Sundays)
        if (s.weekday === 6) for (const bz of s.biz.values()) {
          if (bz.ownerPlayer || bz.def.public || bz.type === 'site' || (bz.deals || []).length >= 2 || !s.rng.chance(0.25)) continue;
          const short = Object.entries(bz.def.targets || {}).find(([g, t]) => bz.def.buys?.[g] && (bz.stock[g] || 0) < t * 0.25 && !(bz.deals || []).some((x) => x.good === g));
          if (short) { const r = offer(s, bz, short[0], Math.max(3, Math.round(short[1] * 0.5))); if (r.ok) s.log(`${bz.name} has a new standing order: ${r.msg}`, 'trade'); }
        }
      }
    });
    // moving a business to other premises
    function relocate(s, bz, nb) {
      if (!nb) return 'Nowhere to move to.';
      const old = bz.b, nz = s.startBusiness(nb, bz.type, 'player');
      Object.assign(nz, { stock: bz.stock, cash: bz.cash, deals: bz.deals || null, name: bz.name, ownerPlayer: true, salesToday: 0, history: bz.history || [] });
      for (const id of bz.workers) { const q = s.byId.get(id); if (q && q.job) q.job.biz = nb.id; }
      nz.workers = bz.workers.slice();
      s.biz.delete(old.id); old.closedShop = { name: bz.name, day: s.day, type: bz.type };
      for (const x of s.biz.values()) for (const d of x.deals || []) if (d.from === old.id) d.from = nb.id;
      const P = O.PlayerState; for (const e of P.posts || []) if (e.biz === old.id && e.place === s.world.placeId) e.biz = nb.id;
      s.log(`${bz.name} has moved to new premises.`, 'economy');
      const miss = O.missingFor ? O.missingFor(nb, bz.type) : [];
      return `${bz.name} moves, stock, purse and hands with it.${miss && miss.length ? ` Fit out the new place (${miss.join(', ')}) before the work can go on.` : ''}`;
    }
    O.Deals = { offer, relocate, deliver };
  }
  O.DealsSetup = { setup };
})();
