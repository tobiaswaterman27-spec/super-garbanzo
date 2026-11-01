// No coin, no sale. Nobody hands over goods or does a service for someone who can't pay: they say so,
// and remember it (the next time you come in, they'll want to see your coin first). But a friend in
// earshot, or a soft heart with money to spare, may step up and pay for you, sometimes as a gift and
// sometimes as a loan they'll want back.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const posOf = (q) => (game.scene ? game.scene.personPos(q) : q.agent && [q.agent.x, q.agent.y]);
    // who's near enough to hear
    function hearers(s, seller) {
      const P = game.player, out = [];
      if (game.scene) { for (const a of game.scene.actors.values()) { const q = a.person; if (q && q !== seller && Math.hypot(a.x - P.x, a.y - P.y) < 110) out.push(q); } }
      else for (const q of s.people) { if (q === seller || !q.agent || q.agent.hidden || q.agent.inside != null) continue; if (Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 90) out.push(q); }
      return out.filter((q) => q.alive !== false && q.age >= 14 && !q.agent.frozen);
    }
    O.noCoin = (seller, price, what, onPaid) => {
      const s = cur(); if (!s) return;
      if (seller) { s.remember(seller, `The player wanted ${what} and could not pay the ₳${price}.`, 'player', 0.5, -0.03); seller._shortAt = s.day; }
      O.Panels.toast(`You haven't the ₳${price} for ${what}.`, 'bad');
      // a kind word from somebody who heard
      const cands = hearers(s, seller).map((q) => { const r = q.rel.get(0) || { affinity: 0 }, hh = s.household(q); const kind = q.traits.includes('generous') || q.traits.includes('friendly'); const w = (r.affinity || 0) + (kind ? 0.35 : 0) - (q.traits.includes('greedy') ? 0.5 : 0); return { q, w, hh }; })
        .filter((c) => c.hh && c.hh.money >= price + 8 && c.w > 0.3 && price <= 30 + c.w * 40).sort((a, b) => b.w - a.w);
      const c = cands[0]; if (!c || Math.random() > Math.min(0.85, 0.3 + c.w * 0.5)) return;
      const loan = c.w < 0.6 || price > 15;
      setTimeout(() => {
        if (c.hh.money < price) return; c.hh.money -= price; PS.money += price;
        const line = loan ? [`I'll lend you the ${price}. Pay me back when you can.`, `Here, ${price} aurins. I'll want it back, mind.`][Math.floor(Math.random() * 2)] : [`Put it away. I'll pay for that.`, `Here, I'll stand you that.`, `Let me. You'd do the same.`][Math.floor(Math.random() * 3)];
        O.Speech && O.Speech.say(c.q, line, 4); O.NpcActs && O.NpcActs.fly ? O.NpcActs.fly(c.q, 'player', 'coin') : O.sfx && O.sfx('coins', 0.7, !!game.scene);
        O.Panels.toast(`${c.q.first} gives you ₳${price}${loan ? ', as a loan' : ''}.`);
        if (loan) (PS.debts = PS.debts || []).push({ who: c.q.id, n: price, day: s.day, why: what });
        s.remember(c.q, loan ? `Lent the player ₳${price} when they were short.` : `Paid ₳${price} for the player when they were short.`, 'player', 0.6, 0.04);
        s.relate && s.relate(c.q, { id: 0 }, 0.04);
        onPaid && setTimeout(onPaid, 600);
      }, 1400);
    };
    // they remember a purse that came up empty
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const selling = q.activity?.act === 'work' && q.job && s.biz.get(q.job.biz); if (!selling) return null;
      let t = `The player has ₳${Math.floor(PS.money)} on them. Never hand over goods, food, drink, a room or a service they can't pay for: if they ask for more than they have, refuse plainly.`;
      if (q._shortAt != null && s.day - q._shortAt < 30) t += ' They came in once before wanting what they could not pay for: you want to see their coin first.';
      return t;
    });
  }
  O.MoneySetup = { setup };
})();
