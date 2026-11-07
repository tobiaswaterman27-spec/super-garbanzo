// Market day, filled. Besides the travelling merchants, the country people come in at dawn on
// Saturnday with their own produce and set up trestles round the square: an egg-wife with her baskets,
// a cheese-woman, a man with a cartload of cabbages, a potter, a weaver with cloth, a honey-man. They
// call their wares, and townsfolk go from stall to stall, point, ask the price, shake their heads,
// haggle, and pay (you see the coins go over and the goods come back), and go off with a full basket.
// Talk to any seller to buy, the same as with the merchants. They pack up and go home after noon.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, G = O.Data.GOODS, D = O.Data, Ch = O.Char;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const SELLERS = [
      { who: 'egg-wife', sex: 'f', wares: ['eggs', 'butter', 'milk'], cry: ['Eggs! New-laid eggs!', 'Butter, sweet butter!'] },
      { who: 'cheese-woman', sex: 'f', wares: ['cheese', 'butter', 'milk'], cry: ['Cheese! Good hard cheese!', 'Taste before you buy!'] },
      { who: 'cabbage-man', sex: 'm', wares: ['cabbage', 'apples', 'herbs'], cry: ['Cabbages! Fresh pulled this morning!', 'Apples, sweet apples!'] },
      { who: 'potter', sex: 'm', wares: ['pot', 'cup', 'jug'], cry: ['Pots! Never cracked, never leaking!', 'A jug for your ale, mistress?'] },
      { who: 'weaver', sex: 'f', wares: ['cloth', 'wool', 'ribbon'], cry: ['Good cloth, close-woven!', 'Wool, carded and clean!'] },
      { who: 'honey-man', sex: 'm', wares: ['honey', 'candles', 'herbs'], cry: ['Honey! Honey from the heath!', 'Wax candles, burn all night!'] },
      { who: 'fish-wife', sex: 'f', wares: ['fish', 'salt'], cry: ['Fresh fish! Caught at dawn!', 'Fish! Who\'ll buy my fish?'] },
      { who: 'pie-man', sex: 'm', wares: ['pie', 'bread'], cry: ['Hot pies! Hot pies!', 'Pies! A penny a pie!'] },
    ];
    const isMarket = (s) => s && s.weekday === 6 && s.minute >= 6.5 * 60 && s.minute < 13.5 * 60;
    function spots(s) { const [x0, y0, x1, y1] = s.Z.square, out = [], w = s.world; for (const y of [y0 + 1, y1 - 1]) for (let x = x0 + 1; x <= x1 - 1; x += 3) { const i = y * w.W + x; if (w.solid[i] || w.solid[i + w.W] || w.solid[i - w.W]) continue; const px = x * T + 8, py = y * T + 14; if (w.props.some((p) => Math.hypot(p.x - px, p.y - py) < 30)) continue; out.push([x, y]); } return out; }
    function setUp(s) {
      s._countryMkt = s.day; const r = O.RNG(O.hash('cmkt', s.world.placeId || 'x', s.day)); const sp = spots(s).sort(() => r.next() - 0.5).slice(0, s.world.hamlet ? 2 : 5);
      const kinds = SELLERS.slice().sort(() => r.next() - 0.5); const E = s.Z.east || [s.world.W - 2, 30];
      sp.forEach(([x, y], i) => { const k = kinds[i % kinds.length]; const st = { kind: 'stall', x: x * T + 8, y: y * T + 14, seed: 50 + i, v: i % 4, solid: false, country: s.day }; s.world.props.push(st);
        const q = s.newPerson({ sex: k.sex, age: r.int(22, 62), first: r.pick(D.NAMES[k.sex]), sur: r.pick(D.NAMES.sur), household: 0, home: null, genes: Ch.randomGenes(r, s.world.region), wealth: 0.35, visitor: true });
        q.name = `${q.first} ${q.sur}`; q.job = { biz: null, role: k.who }; q.wake = 0; q.bed = 1440; q.app = Ch.makeAppearance(O.hash('country', q.id), { sex: k.sex, age: q.age, genes: q.genes, role: 'farmer', wealth: 0.35 });
        const wares = {}; for (const g of k.wares) if (G[g]) wares[g] = r.int(3, 8); q.wares = wares; q.purse = r.int(5, 25); q.cry = k.cry; q.countrySeller = true;
        q.fairStall = { day: s.day, tile: [x, y + 1], stall: st }; st.merchant = q.id;
        const early = s.minute < 6.9 * 60 && Math.hypot(E[0] * T - game.player.x, E[1] * T - game.player.y) < 600; /* (seen arriving only if you're there at dawn) */ q.agent = { x: early ? E[0] * T : x * T + 8, y: early ? E[1] * T : (y + 1) * T + 10, dir: 0, anim: 'walk', ft: 0, a: q.app, hidden: false, inside: null, path: null, goal: null, person: q }; });
      s.world.dirtyStatics = true;
      if (sp.length) s.log(`Market day: country folk have set up ${sp.length} stalls round the square.`, 'trade');
    }
    function packUp(s) { const before = s.world.props.length; s.world.props = s.world.props.filter((p) => !(p.country != null && (p.country !== s.day || s.minute >= 14.5 * 60))); if (s.world.props.length !== before) s.world.dirtyStatics = true; }
    // the buying, seen
    const deals = [], coins = [];
    let tick = 3, cryT = 4;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world) return;
      if (isMarket(s) && s._countryMkt !== s.day && !s.quarantine) setUp(s);
      if (Math.random() < dt) packUp(s);
      for (const c of coins.slice()) { c.t += dt; if (c.t >= c.dur) coins.splice(coins.indexOf(c), 1); }
      // sellers cry their wares
      cryT -= dt; if (cryT <= 0) { cryT = 3 + Math.random() * 4; const sl = s.people.filter((q) => q.countrySeller && q.activity?.act === 'stand' && !q.agent.path && near(q.agent.x, q.agent.y, 300)); const q = pick(sl); if (q) { say(q, pick(q.cry), 2.2); O.gesture && O.gesture(q, 'wave', 1.2); } }
      for (const d of deals.slice()) { d.t += dt; const b = d.buyer, sl = d.seller; const fail = b.alive === false || game.scene || (O.npcUI && O.npcUI.talking && (O.npcUI.talking() === b || O.npcUI.talking() === sl)) || d.t > 25 || sl.activity?.act !== 'stand';
        if (fail) { endDeal(d); continue; }
        const ba = b.agent; if (!d.there) { const [tx, ty] = d.at, dx = tx - ba.x, dy = ty - ba.y, dd = Math.hypot(dx, dy); if (dd < 2 || d.t > 10) { d.there = true; d.k = 0; } else { const st = Math.min(dd, 34 * dt); const nx = ba.x + dx / dd * st, ny = ba.y + dy / dd * st; if (!game.solidAt(nx, ny - 2)) { ba.x = nx; ba.y = ny; } else { ba.x = tx; ba.y = ty; } ba.dir = O.dirOf(dx, dy); ba.forceAnim = 'walk'; } continue; }
        d.k += dt; ba.dir = O.dirOf(sl.agent.x - ba.x, sl.agent.y - ba.y); const step = (n, fn) => { if (d.s === n) { d.s++; fn(); } };
        if (d.k > 0.2) step(0, () => { ba.forceAnim = 'point'; if (Math.random() < 0.5) say(b, pick([`How much for the ${G[d.g].name.toLowerCase()}?`, 'What are you asking?', 'Is that fresh?'])); });
        if (d.k > 1.8) step(1, () => { ba.forceAnim = 'talk'; O.gesture && O.gesture(sl, 'count', 1.2); if (Math.random() < 0.5) say(sl, `${d.price} to you.`); });
        if (d.k > 3.4) step(2, () => { if (d.haggle) { ba.forceAnim = 'shake'; if (Math.random() < 0.6) say(b, pick(['Robbery!', `${Math.max(1, d.price - 1)}, and not a penny more.`, 'I can get it cheaper over there.'])); } else ba.forceAnim = 'nod'; });
        if (d.k > 5) step(3, () => { if (d.haggle) { O.gesture && O.gesture(sl, Math.random() < 0.6 ? 'shrug' : 'shake', 1.2); if (Math.random() < 0.6) { d.price = Math.max(1, d.price - 1); say(sl, pick(['Oh, go on then.', 'You\'ll ruin me.', 'For you.'])); } else { d.walk = true; say(sl, pick(['Then buy it over there.', 'Not a penny less.'])); } } });
        if (d.k > 6.4) step(4, () => { if (d.walk) { ba.forceAnim = 'shrug'; return; } ba.forceAnim = 'give'; O.gesture && O.gesture(sl, 'take', 0.8); coins.push({ x0: ba.x, y0: ba.y - 12, x1: sl.agent.x, y1: sl.agent.y - 12, t: 0, dur: 0.45, c: '#e0c050' }); const hh = d.s0.household(b); if (hh && hh.money >= d.price) { hh.money -= d.price; sl.purse = (sl.purse || 0) + d.price; if (sl.wares[d.g] > 0) sl.wares[d.g]--; hh.pantry[d.g] = (hh.pantry[d.g] || 0) + 1; } O.sfx && near(ba.x, ba.y, 220) && O.sfx('kaching', 0.15); });
        if (d.k > 7.4) step(5, () => { if (d.walk) return; O.gesture && O.gesture(sl, 'give', 0.8); ba.forceAnim = 'take'; coins.push({ x0: sl.agent.x, y0: sl.agent.y - 12, x1: ba.x, y1: ba.y - 12, t: 0, dur: 0.5, c: '#d8b070', big: true }); });
        if (d.k > 8.6) endDeal(d);
      }
      tick -= dt; if (tick > 0 || !isMarket(s) || game.scene) return; tick = 2.5;
      if (deals.length >= 3) return;
      const sellers = s.people.filter((q) => q.fairStall && q.fairStall.day === s.day && q.activity?.act === 'stand' && !q.agent.path && q.wares && Object.values(q.wares).some((n) => n > 0) && near(q.agent.x, q.agent.y, 400) && !deals.some((d) => d.seller === q));
      const sl = pick(sellers); if (!sl) return;
      const b = s.people.find((q) => q.agent && !q.agent.hidden && q.agent.inside == null && (!q.agent.frozen || q._bit) && !q.agent.path && !q.errand && !q._scene && !q._playing && q.alive !== false && q.age >= 14 && !q.visitor && (q.activity?.market || q.activity?.act === 'stroll') && Math.hypot(q.agent.x - sl.agent.x, q.agent.y - sl.agent.y) < 200 && (s.household(q)?.money || 0) > 4 && !deals.some((d) => d.buyer === q));
      if (!b) return; if (b._bit) { b._bit.t = 1e9; tick = 0.3; return; } // (leaves off what they were doing first)
      const have = Object.entries(sl.wares).filter(([, n]) => n > 0).map(([k]) => k); const g = pick(have);
      b._deal = true; b.agent.frozen = true; b.agent.path = null;
      deals.push({ s0: s, buyer: b, seller: sl, g, price: Math.max(1, Math.round((G[g].base || 2) * 1.1)), haggle: Math.random() < 0.55, at: [sl.agent.x + (Math.random() < 0.5 ? -6 : 6), sl.agent.y + 22], t: 0, s: 0 });
    });
    function endDeal(d) { const b = d.buyer; b._deal = false; b.agent.forceAnim = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== b) b.agent.frozen = false; if (!d.walk && d.s >= 5) O.gesture && O.gesture(b, 'carry', 2); deals.splice(deals.indexOf(d), 1); }
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return;
      for (const c of coins) { const k = c.t / c.dur, x = c.x0 + (c.x1 - c.x0) * k, y = c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 7; ctx.fillStyle = c.c; ctx.fillRect(Math.round(x - cam.x), Math.round(y - cam.y), c.big ? 4 : 2, c.big ? 3 : 2); }
      // the country stalls' goods on the board
      const s = cur(); if (!s || !isMarket(s)) return;
      for (const st of s.world.props) { if (st.country !== s.day) continue; const q = st.merchant != null && s.byId.get(st.merchant); if (!q || !q.wares) continue; const x = Math.round(st.x - cam.x), y = Math.round(st.y - cam.y); if (x < -30 || y < -40 || x > ctx.canvas.width + 30 || y > ctx.canvas.height + 30) continue; let i = 0; for (const [g, n] of Object.entries(q.wares)) { for (let j = 0; j < Math.min(3, n); j++, i++) { const gx = x - 10 + (i % 6) * 4, gy = y - 14 - Math.floor(i / 6) * 3; ctx.fillStyle = { eggs: '#f0ead8', butter: '#f0d870', milk: '#e8e8f0', cheese: '#e8c050', cabbage: '#6aa040', apples: '#c03a2a', herbs: '#4a8a3a', pot: '#a0603a', cup: '#a0603a', jug: '#8a5232', cloth: '#5a6a9a', wool: '#e8e0d0', ribbon: '#c04060', honey: '#d8a020', candles: '#f0e8c8', fish: '#9aa8b8', salt: '#f0f0f0', pie: '#c8902a', bread: '#c08a40' }[g] || '#aaa'; ctx.fillRect(gx, gy, 3, 2); } } }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => q.countrySeller ? `You are a ${q.job.role} from the country, selling at the market in the square: ${Object.entries(q.wares || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${G[k] ? G[k].name.toLowerCase() : k}`).join(', ') || 'sold out'}. You want to sell and go home by noon. You haggle, but not much.` : '');
    O.MarketDay = { setUp: () => setUp(cur()), deals, isMarket };
  }
  O.MarketDaySetup = { setup };
})();
