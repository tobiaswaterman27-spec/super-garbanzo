// Trade on the roads. Hire a cart and its carter by the day (from a carrier, a carter or a stable) and it
// follows you, carrying what your back can't: buy where things are cheap and take them where they're dear.
// Hire guards for the road, too. A loaded cart on the open road draws bandits; guards make a fight of it.
// Haggle over every price in talk: the seller meets you, holds out, or turns you away, and remembers a hard
// bargain. And news goes at the pace of a horse: what happens in one town is only known in the next when
// word arrives, a day or so down the road.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const outOfTown = (w, x, y) => w.ox == null || Math.max(w.ox - x / T, x / T - w.ox - w.townW, w.oy - y / T, y / T - w.oy - w.townH, 0) > 4;

    // ---------------------------------------------------------------- the cart
    const cartOn = () => { const s = cur(); return PS.cart && s && s.day <= PS.cart.until; };
    const cart = { x: 0, y: 0, world: null, dir: 1, ft: 0 };
    const trail = [];
    game.hooks.update.push((dt) => {
      if (!cartOn()) { if (PS.cart && cur() && cur().day > PS.cart.until) { PS.cart = null; say('Your carter takes the cart home: the hire is up.'); } return; }
      const P = game.player; if (game.scene) return;
      if (cart.world !== game.world || Math.hypot(cart.x - P.x, cart.y - P.y) > 400) { cart.world = game.world; cart.x = P.x - 30; cart.y = P.y; trail.length = 0; }
      const last = trail[trail.length - 1]; if (!last || Math.hypot(last[0] - P.x, last[1] - P.y) > 4) trail.push([P.x, P.y]); if (trail.length > 60) trail.shift();
      const tgt = trail.length > 9 ? trail[trail.length - 9] : null; if (!tgt) return;
      const dx = tgt[0] - cart.x, dy = tgt[1] - cart.y, d = Math.hypot(dx, dy);
      if (d > 2) { const sp = Math.min(d, 70 * dt); cart.x += (dx / d) * sp; cart.y += (dy / d) * sp; cart.ft += dt; if (Math.abs(dx) > 1) cart.dir = dx > 0 ? 1 : -1; }
    });
    // a cart and a donkey, drawn by hand
    const mkCart = (flip, f) => { const c = document.createElement('canvas'); c.width = 40; c.height = 24; const x = c.getContext('2d');
      const px = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(flip ? 40 - a - w : a, b, w, h); };
      px(2, 8, 20, 7, '#7a5634'); px(2, 8, 20, 1, '#9a7650'); px(3, 4, 6, 4, '#c8b088'); px(10, 3, 7, 5, '#a89070'); px(12, 2, 4, 1, '#c8b088');
      px(5, 15, 6, 6, '#3a2a1c'); px(6, 16, 4, 4, '#6a4a2c'); px(7, 17, 2, 2, '#3a2a1c'); px(22, 11, 6, 1, '#5a3d24');
      px(27, 8, 9, 6, '#8a7a6a'); px(34, 5, 4, 5, '#8a7a6a'); px(35, 3, 1, 3, '#6a5a4a'); px(37, 3, 1, 3, '#6a5a4a'); px(37, 7, 1, 1, '#1a1410');
      const l = f ? 1 : 0; px(28, 14, 1, 5 - l, '#5a4a3a'); px(30, 14, 1, 4 + l, '#5a4a3a'); px(33, 14, 1, 5 - l, '#5a4a3a'); px(35, 14, 1, 4 + l, '#5a4a3a');
      return c; };
    const CART = [[mkCart(false, 0), mkCart(false, 1)], [mkCart(true, 0), mkCart(true, 1)]];
    game.hooks.drawWorld.push((ctx, cam) => {
      if (!cartOn() || game.scene || cart.world !== game.world) return;
      const im = CART[cart.dir > 0 ? 0 : 1][Math.floor(cart.ft * 6) % 2]; ctx.drawImage(im, Math.round(cart.x - 20 - cam.x), Math.round(cart.y - 22 - cam.y));
    });
    const nearCart = () => { if (!cartOn()) return false; const P = game.player; if (game.scene) { const b = game.scene.b.parent || game.scene.b; return Math.hypot(b.doorX * T - cart.x, (b.doorY + 1) * T - cart.y) < 220; } return Math.hypot(P.x - cart.x, P.y - cart.y) < 140; };
    { const _can = PS.canCarry; PS.canCarry = function (k, n = 1) { if (_can.call(this, k, n)) return true; return nearCart() && this.slotsUsed() + (G[k]?.slots || 1) * n <= (this.SLOTS || 10) + 24; }; }
    const loadValue = () => PS.items.reduce((v, k) => v + (G[k]?.base || 1), 0);

    // ---------------------------------------------------------------- hired guards
    const guards = () => (PS.roadGuards = PS.roadGuards || []);
    let gt = 0;
    game.hooks.update.push((dt) => {
      gt -= dt; if (gt > 0) return; gt = 20; const s = cur(); if (!s) return;
      PS.roadGuards = guards().filter((g) => g.until >= s.day);
      for (const g of guards()) { const q = s.byId.get(g.id); if (q && !(O.NpcActs.following && O.NpcActs.following(q))) O.NpcActs.apply(s, q, { do: 'follow' }, false); }
    });

    // ---------------------------------------------------------------- bandits on the road
    let bt = 0;
    game.hooks.update.push((dt) => {
      bt -= dt; if (bt > 0) return; bt = 30; const s = cur(), w = game.world, P = game.player; if (!s || game.scene || O.panelOpen || !w.ter) return;
      if (!outOfTown(w, P.x, P.y) || (loadValue() < 40 && PS.money < 80)) return;
      const t = w.ter[Math.floor(P.y / T) * w.W + Math.floor(P.x / T)]; if (t !== w.TER.ROAD && t !== w.TER.FOREST) return;
      const night = s.hour < 6 || s.hour > 20, risk = (cartOn() ? 0.06 : 0.02) * (night ? 2 : 1) * (guards().length ? 0.6 : 1);
      if (Math.random() > risk) return; ambush(s);
    });
    function ambush(s) {
      const n = 3 + Math.floor(Math.random() * 3), gs = guards().map((g) => s.byId.get(g.id)).filter(Boolean), toll = Math.round(10 + loadValue() * 0.2);
      O.Panels.open('Bandits!', `<p class="speech">“Stand! That cart's ours now, or a share of it. Choose quick.”</p><p class="caption">${n} men with clubs and a bow come out of the trees across the road.${gs.length ? ` Your ${gs.length > 1 ? 'guards draw' : 'guard draws'} beside you.` : ''}</p>
        <div class="topics"><button data-b="pay">Give them ₳${toll}</button><button data-b="fight">Fight${gs.length ? ' with your guards' : ''}</button><button data-b="flee">Run for it${cartOn() ? ' (the cart can\'t)' : ''}</button></div>`, (r) => {
        const done = (m, bad) => { O.Panels.close(); say(m, bad ? 'bad' : ''); };
        r.querySelector('[data-b=pay]').onclick = () => { const p = Math.min(PS.money, toll); PS.money -= p; if (p < toll) { const k = PS.items.filter((x) => (G[x]?.base || 0) > 3)[0]; if (k) PS.remove(k); } done(`They take ₳${p}${p < toll ? ' and what else they fancy' : ''} and melt back into the trees.`, true); };
        r.querySelector('[data-b=fight]').onclick = () => {
          const armed = O.Combat && O.Combat.armed && O.Combat.armed(), win = Math.random() < 0.25 + gs.length * 0.22 + (armed ? 0.2 : 0);
          game.player.anim = 'attack'; setTimeout(() => { game.player.anim = 'idle'; }, 900); for (const g of gs) O.gesture(g, 'attack', 1.5);
          PS.hp = Math.max(5, PS.hp - (win ? 10 : 30)); for (const g of gs) if (g.health && Math.random() < 0.5) g.health.hp = Math.max(10, g.health.hp - 20);
          if (win) { const loot = 4 + Math.floor(Math.random() * 16); PS.money += loot; PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.03); for (const g of gs) s.relate(g, { id: 0 }, 0.05); done(`You beat them off${gs.length ? ' with your guards' : ''}. They leave ₳${loot} and a broken bow in the road.`); }
          else { const lost = Math.floor(PS.money * 0.5); PS.money -= lost; const take = PS.items.filter((x) => (G[x]?.base || 0) > 2).slice(0, 4); for (const k of take) PS.remove(k); done(`They beat you down and take ₳${lost}${take.length ? ' and ' + take.length + ' things off the cart' : ''}.`, true); }
        };
        r.querySelector('[data-b=flee]').onclick = () => { if (cartOn()) { const take = PS.items.filter((x) => (G[x]?.base || 0) > 1).slice(0, 6); for (const k of take) PS.remove(k); done(`You get away. The cart doesn't: they strip it of ${take.length} loads before your carter whips the donkey on.`, true); } else if (Math.random() < 0.5) done('You run, and they don\'t follow far.'); else { const lost = Math.floor(PS.money * 0.3); PS.money -= lost; done(`They catch you up and take ₳${lost}.`, true); } };
      });
    }

    // ---------------------------------------------------------------- hiring, and haggling, in talk
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a) {
      if (a && a.do === 'hire_cart') {
        if (!/carter|carrier|wagoner|stable|groom|ostler|drover/.test(q.job?.role || '')) return null;
        const days = O.clamp(Math.round(Number(a.days) || 1), 1, 7), pr = O.clamp(Math.round(Number(a.price) || days * 6), 0, 80); if (PS.money < pr) return `A cart for ${days} day${days > 1 ? 's' : ''} is ₳${pr}, and you haven't it.`;
        PS.money -= pr; const bz = s.biz.get(q.job.biz); if (bz) bz.cash = (bz.cash || 0) + pr; PS.cart = { until: s.day + days - 1, carter: q.first }; cart.world = null;
        return `${q.first} brings round a cart and a donkey for ${days} day${days > 1 ? 's' : ''} (₳${pr}). It'll follow you and carry what you can't.`;
      }
      if (a && a.do === 'guard_road') {
        if (q.age < 17 || q.age > 55 || q.sex === 'f' && !/guard|soldier/.test(q.job?.role || '') && Math.random() < 0.5) return null;
        const days = O.clamp(Math.round(Number(a.days) || 1), 1, 5), pr = O.clamp(Math.round(Number(a.price) || days * 5), 0, 60); if (PS.money < pr) return `${q.first} wants ₳${pr} and you haven't it.`;
        PS.money -= pr; const hh = s.household(q); if (hh) hh.money += pr; guards().push({ id: q.id, until: s.day + days - 1 }); O.NpcActs.apply(s, q, { do: 'follow' }, false);
        return `${q.first} takes ₳${pr} and comes along to guard you on the road for ${days} day${days > 1 ? 's' : ''}.`;
      }
      const r = base.apply(this, arguments);
      // a hard bargain is remembered, and so is an easy mark
      if (a && a.do === 'sell' && typeof r === 'string' && /₳/.test(r) && !/haven'?t/.test(r)) {
        const bz = q.job && s.biz.get(q.job.biz), g = O.NpcActs.goodFor ? O.NpcActs.goodFor(a.item) : a.item, list = bz && g && s.price ? s.price(bz, g) : (G[g]?.base || 0), paid = Number(a.price);
        if (list && paid >= 0 && Number.isFinite(paid)) {
          if (paid < list * 0.67) { q.hardBargain = s.day; s.relate(q, { id: 0 }, -0.03); (q.beliefs = q.beliefs || []).unshift({ t: `The stranger beat me down on the ${G[g]?.name?.toLowerCase() || g} to ₳${paid}. A hard bargainer.`, src: 'self', day: s.day }); }
          else if (paid > list * 1.2) (q.beliefs = q.beliefs || []).unshift({ t: `The stranger paid ₳${paid} for the ${G[g]?.name?.toLowerCase() || g} without blinking. Easy money.`, src: 'self', day: s.day });
        }
      }
      return r;
    };
    (O.extraActs = O.extraActs || []).push('hire_cart {"days","price"} (carters, carriers, grooms: hire the player a cart and donkey that follows them, about ₳6 a day)', 'guard_road {"days","price"} (any able adult: guard the player on the road, about ₳5 a day; you follow them)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const bz = q.job && s.biz.get(q.job.biz); if (!bz || !bz.def.sells || !bz.def.sells.length) return '';
      const greedy = (q.traits || []).includes('greedy'), soft = (q.traits || []).includes('generous') || ((q.rel.get(0) || {}).affinity || 0) > 0.4;
      return `Haggling: when the player names a lower price, decide like a real seller: counter, meet them partway, or refuse${greedy ? ' (you are greedy and stubborn over money)' : soft ? ' (you are soft and may give way)' : ''}. Sell only at the price you agree.${q.hardBargain && s.day - q.hardBargain < 20 ? ' Last time they beat you down hard, and you are warier now.' : ''}`;
    });
    (O.extraLines = O.extraLines || []).push((s, q) => /carter|carrier|wagoner|stable|groom|ostler/.test(q.job?.role || '') ? 'You hire out carts and donkeys by the day (hire_cart).' : '');
    (O.extraLines = O.extraLines || []).push((s, q) => guards().some((g) => g.id === q.id) ? 'You are hired to guard the player on the road; you keep your eyes on the trees.' : '');

    // ---------------------------------------------------------------- news at the pace of a horse
    const hops = (K, a, b) => {
      if (!a || !b || a === b || !K.neighbours) return 0; const seen = new Map([[a, 0]]), q = [a];
      while (q.length) { const c = q.shift(); for (const n of K.neighbours(c)) if (!seen.has(n)) { seen.set(n, seen.get(c) + 1); if (n === b) return seen.get(n); q.push(n); } }
      return 3;
    };
    O.newsKnown = (s, n) => { const K = s.kingdom; if (!K || !n.place) return true; const h = hops(K, n.place, s.world.placeId); const delay = n.place === 'capital' || n.kind === 'rulers' ? Math.ceil(h / 2) : h; return s.day >= n.day + delay; };
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments); const K = this.kingdom; if (!K || !K.news) return r;
      for (const n of K.news) {
        if (!n.place || n.place === this.world.placeId || ['migration', 'growth', 'decline'].includes(n.kind) || this.day - n.day > 10) continue;
        const h = hops(K, n.place, this.world.placeId), delay = n.place === 'capital' || n.kind === 'rulers' ? Math.ceil(h / 2) : h;
        if (n.day + delay === this.day) { const from = K.place ? (K.place(n.place) || {}).name : n.place; this.log(`A rider brought word from ${from || 'away'}: ${n.text}`, 'news'); }
      }
      return r;
    };
  }
  O.RoadTradeSetup = { setup };
})();
