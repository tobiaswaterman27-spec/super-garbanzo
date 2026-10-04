// The year's high days, and the Sunday market. Each season has its day:
//   the spring tournament (spring, day 12) in any town with a castle: the knights ride at the lists in the
//     square; you can bet on a joust, or ride in it yourself with a horse of your own and a fee;
//   the harvest fair (autumn, day 10): the square full from the morning, travelling merchants at the
//     stalls, and the archery at the butts with a purse for the best shot;
//   the midwinter feast (winter, day 7): the castle's people and the gentry feast in the great hall, the
//     town drinks at the tavern on the lord's coin; the well-regarded (and the court) may sit at the table.
// Every Sunday morning travelling merchants set up at the market stalls with goods from away.
'use strict';
(function () {
  const T = 16;
  function setup(game, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, G = O.Data.GOODS, D = O.Data, Ch = O.Char, say = (t, k) => O.UI.say(t, k);
    const fest = (s) => { const d = s.weather.dayOfSeason; return s.season === 'autumn' && d === 10 ? 'fair' : s.season === 'winter' && d === 7 ? 'midwinter' : s.season === 'spring' && d === 12 ? 'tournament' : null; };
    const marketOn = (s) => s.weekday === 6 && s.hour >= 7 && s.hour < 14 && !s.quarantine;
    const keepOf = (s) => s.world.buildings.find((b) => b.royal) || s.world.buildings.find((b) => b.type === 'keep' && !b.ruined);
    const esc = (t) => O.escape(String(t));
    O.Festivals = { today: fest, market: marketOn };
    const NAMES = { fair: 'the harvest fair', midwinter: 'the midwinter feast', tournament: 'the spring tournament' };

    // ---------------------------------------------------------------- the town's day
    const SP = O.Sim.prototype, _plan = SP.plan, _route = SP.route;
    SP.plan = function (p) {
      if (p.fairStall) return this.hour < 14 && this.day === p.fairStall.day ? { act: 'stand', outdoor: true, zone: 'stall', tile: p.fairStall.tile } : { act: 'leave', outdoor: true, zone: 'east' };
      const pl = _plan.call(this, p);
      if (!pl || p.task || p.visitor || p.age < 6 || ['sleep', 'sick', 'jailed', 'collapsed', 'court'].includes(pl.act)) return pl;
      const f = fest(this), h = this.hour;
      if (f === 'fair' && h >= 10 && h < 15 && (p.id + Math.floor(h)) % 5 < 2 && pl.act !== 'work') return { act: 'festival', outdoor: true, zone: 'square' };
      if (f === 'tournament' && keepOf(this) && h >= 10 && h < 15 && (pl.act !== 'work' || (p.id % 3 === 0 && !/guard/.test(p.job?.role || '')))) return { act: 'festival', outdoor: true, zone: 'square' };
      if (f === 'midwinter' && h >= 18 && h < 22.5 && p.age >= 12) {
        const k = keepOf(this);
        const high = p.royal || p.gentry || p.title || /steward|chamberlain|lady-in-waiting|captain of the royal guard|master of horse|herald|jester/.test(p.job?.role || '');
        if (k && high && (p.home === k.id || p.gentry || p.job?.biz === k.id)) return { act: 'feast', b: k.id }; // the high table: the royal family, the gentry and the court
        if (this.tavernId != null && pl.act !== 'work' && (p.id % 3) && p.age >= 16) return { act: 'socialise', b: this.tavernId };
      }
      if (marketOn(this) && ['stroll', 'home', 'play'].includes(pl.act) && (p.id + Math.floor(h * 2)) % 4 === 0) return { act: 'stroll', outdoor: true, zone: 'square' };
      return pl;
    };
    // a merchant walks to their stall and stands at it
    SP.route = function (p, act) {
      if (act.act !== 'stand' || !act.tile) return _route.call(this, p, act);
      const a = p.agent, [tx, ty] = act.tile;
      if (a.inside != null) { const b = this.building(a.inside); const [ex, ey] = this.entry(b); [a.x, a.y] = this.tileCenter(ex, ey, p); a.inside = null; a.hidden = false; }
      const sx = Math.floor(a.x / this.T), sy = Math.floor((a.y - 1) / this.T);
      a.goal = [tx, ty]; a.goalB = null; a.offPath = false;
      const path = sx === tx && sy === ty ? [] : this.path.find(sx, sy, tx, ty);
      if (!path) { a.path = [[tx, ty]]; a.offPath = true; } else a.path = path;
      a.pi = 0;
    };
    const _idle = SP.idleAnim;
    SP.idleAnim = function (p) { if (p.fairStall && p.activity?.act === 'stand') { const k = (p.id + Math.floor(this.minute / 3)) % 4; return k === 0 ? 'talk' : k === 1 ? 'count' : 'idle'; } return _idle.call(this, p); };

    // ---------------------------------------------------------------- the travelling merchants
    const WARES = ['spices', 'silk', 'wine', 'dyedcloth', 'glass', 'honey', 'salt', 'brooch', 'ring', 'candles', 'lantern', 'parchment', 'ink', 'cheese', 'rope', 'cake'];
    const FROM = ['of Westhaven', 'from over the sea', 'of Goldmere', 'the Chapman', 'of the Salt Road', 'Packman', 'of Saltmere'];
    function stallsOf(s) {
      const Z = s.Z.square || [0, 0, 0, 0];
      const st = s.world.props.filter((q) => q.kind === 'stall');
      const inSq = st.filter((q) => { const x = q.x / T, y = q.y / T; return x >= Z[0] - 3 && x <= Z[2] + 3 && y >= Z[1] - 3 && y <= Z[3] + 3; });
      return (inSq.length ? inSq : st).slice(0, 3);
    }
    function spawnMerchants(s) {
      s._mktDay = s.day;
      const r = O.RNG(O.hash('mkt', s.world.placeId || 'x', s.day)), stalls = stallsOf(s).slice(0, s.world.hamlet ? 1 : 2);
      const E = s.Z.east || [s.world.W - 2, 30];
      for (const st of stalls) {
        const sex = r.chance(0.7) ? 'm' : 'f';
        const q = s.newPerson({ sex, age: r.int(25, 58), first: r.pick(D.NAMES[sex]), sur: r.pick(FROM), household: 0, home: null, genes: Ch.randomGenes(r, r.pick(['east', 'south', 'west'])), wealth: 0.65, visitor: true });
        q.name = `${q.first} ${q.sur}`; q.job = { biz: null, role: 'travelling merchant' }; q.wake = 0; q.bed = 1440;
        q.app = Ch.makeAppearance(O.hash('merchant', q.id), { sex, age: q.age, genes: q.genes, role: 'merchant', wealth: 0.7 });
        const tile = [Math.floor(st.x / T), Math.floor((st.y - 1) / T) + 1];
        q.fairStall = { day: s.day, tile, stall: st };
        const wares = {}; for (const k of WARES.map((k) => [k, r.next()]).sort((a, b) => a[1] - b[1]).slice(0, 5).map((x) => x[0])) if (G[k]) wares[k] = r.int(2, 6);
        q.wares = wares; q.purse = r.int(40, 120);
        q.agent = { x: E[0] * T, y: E[1] * T, dir: 1, anim: 'walk', ft: 0, a: q.app, hidden: false, inside: null, path: null, goal: null, person: q };
        st.merchant = q.id;
      }
      if (stalls.length) s.log(`Sunday market: ${stalls.length > 1 ? 'travelling merchants have' : 'a travelling merchant has'} set up in the square.`, 'trade');
    }
    // they arrive at dawn on Sunday and are gone by mid-afternoon
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.world) return;
      if (s.weekday === 6 && s.hour >= 6.3 && s.hour < 12 && s._mktDay !== s.day && !s.quarantine) spawnMerchants(s);
      for (const q of s.people) if (q.fairStall && (q.fairStall.day !== s.day || s.hour >= 14)) {
        const E = s.Z.east || [s.world.W - 2, 30];
        if (Math.hypot(q.agent.x / T - E[0], q.agent.y / T - E[1]) < 3 || q.fairStall.day < s.day - 1) { s.people = s.people.filter((z) => z !== q); s.byId.delete(q.id); if (q.fairStall.stall) q.fairStall.stall.merchant = null; }
      }
    });
    const merchantAt = (s, st) => st.merchant != null && s.byId.get(st.merchant);
    const sellPrice = (k) => Math.max(1, Math.round((G[k].base || 2) * 1.2));
    const buyPrice = (k) => Math.max(1, Math.floor((G[k].base || 2) * 0.55));
    function openMerchant(q) {
      const s = cur();
      const draw = () => {
        const rows = Object.entries(q.wares).filter(([, n]) => n > 0).map(([k, n]) => `<tr><td><img src="${O.icon(k)}" alt="" style="width:16px;vertical-align:middle"> ${esc(G[k].name)}</td><td class="n">${n}</td><td class="n">₳${sellPrice(k)}</td><td><button data-buy="${k}">Buy</button></td></tr>`).join('');
        const mine = [...new Set(PS.items)].filter((k) => G[k] && G[k].base > 0 && !G[k].quest && k !== 'key');
        const sells = mine.map((k) => `<tr><td><img src="${O.icon(k)}" alt="" style="width:16px;vertical-align:middle"> ${esc(G[k].name)}</td><td class="n">₳${buyPrice(k)}</td><td><button data-sell="${k}">Sell</button></td></tr>`).join('');
        O.Panels.open(`${q.name}, travelling merchant`, `<p class="speech">“Goods from away, friend, and cheap at the price. I'm gone by two.”</p><table><thead><tr><th>Wares</th><th class="n">Left</th><th class="n">Price</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4">Sold out.</td></tr>'}</tbody></table>${sells ? `<div class="lbl" style="margin-top:10px">${esc(q.first)} will buy (purse ₳${q.purse})</div><table><tbody>${sells}</tbody></table>` : ''}`, (r) => {
          r.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => { const k = b.dataset.buy, pr = sellPrice(k); if (PS.money < pr) return say("You haven't the coin.", 'bad'); if (!PS.add(k)) return say('Your satchel is full.', 'bad'); PS.money -= pr; q.purse += pr; q.wares[k]--; draw(); });
          r.querySelectorAll('[data-sell]').forEach((b) => b.onclick = () => { const k = b.dataset.sell, pr = buyPrice(k); if (q.purse < pr) return say(`${q.first} can't afford it.`, 'bad'); PS.remove(k); PS.money += pr; q.purse -= pr; q.wares[k] = (q.wares[k] || 0) + 1; draw(); });
        });
      };
      draw(); void s;
    }
    // talking to a merchant, and stepping up to their stall
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; if (q.fairStall && q.activity?.act === 'stand') out.push(['wares', 'Show me your wares']); return out; };
    npcUI.onExtra = (q, key, render) => { if (key === 'wares') { npcUI.closeTalk(); return openMerchant(q); } return prevOn && prevOn(q, key, render); };
    // hooked in once everything else is set up (the market stall's own prompt is made later)
    let prevStall = null, hooked = false;
    game.hooks.update.push(() => { if (hooked) return; hooked = true; prevStall = O.stallCandidate; O.stallCandidate = festCandidate; });
    const festCandidate = () => {
      const s = cur(), p = game.player;
      if (!game.scene) {
        for (const st of s.world.props) if (st.kind === 'stall' && st.merchant != null) {
          const q = merchantAt(s, st); if (!q || q.activity?.act !== 'stand') continue;
          const d = Math.hypot(st.x - p.x, st.y - p.y); if (d < 30) return { type: 'custom', label: `Browse ${q.first}'s wares`, act: () => openMerchant(q), d: d - 30, x: st.x, y: st.y - 30 };
        }
        const f = fest(s), h = s.hour, lists = s.world.props.find((x) => x.kind === 'noticeboard') || s.world.props.find((x) => x.kind === 'well');
        if (lists && Math.hypot(lists.x - p.x, lists.y - p.y) < 34) {
          if (f === 'tournament' && keepOf(s) && h >= 10 && h < 15) return { type: 'custom', label: 'The tournament lists: bet, or ride', act: () => tournament(s), d: 2, x: lists.x, y: lists.y - 34 };
          if (f === 'fair' && h >= 10 && h < 18) return { type: 'custom', label: 'The archery at the butts (₳2)', act: () => archery(s), d: 2, x: lists.x, y: lists.y - 34 };
        }
      }
      return prevStall ? prevStall() : null;
    };

    // ---------------------------------------------------------------- the archery at the harvest fair
    function archery(s) {
      if (s._archeryDay === s.day) return say('You have had your three arrows today. Come back next year.');
      if (PS.money < 2) return say('The fee is two aurins.', 'bad');
      PS.money -= 2; s._archeryDay = s.day;
      const skill = (PS.skills && (PS.skills.archery || PS.skills.hunting || 0)) || 0.1;
      const shots = [0, 1, 2].map(() => Math.max(0, Math.min(10, Math.round(3 + skill * 6 + (Math.random() - 0.4) * 6))));
      const total = shots.reduce((a, b) => a + b, 0), best = 14 + Math.floor(Math.random() * 10);
      PS.skills.archery = Math.min(1, skill + 0.05);
      const won = total > best;
      if (won) { PS.money += 25; PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.08); s.log('The stranger won the archery at the harvest fair.', 'event'); }
      O.Panels.open('The archery at the butts', `<p class="speech">Three arrows at the straw butts, sixty paces off.</p><p>Your shots: ${shots.join(', ')}. Total <b>${total}</b>. The best of the others: <b>${best}</b>.</p><p class="speech">${won ? 'The crowd cheers. The reeve presses a purse of ₳25 into your hand.' : 'A good try. The purse goes to a local man, to cheers.'}</p>`);
    }

    // ---------------------------------------------------------------- the spring tournament
    const KNIGHT_SUR = ['of Highmere', 'of Eastmarch', 'of Westcliff', 'of the Ford', 'Blackmantle', 'of Frostmere', 'the Bold', 'of Greenvale', 'Ironside', 'of Goldmere'];
    function knights(s) {
      if (s._tourney && s._tourney.day === s.day) return s._tourney;
      const r = O.RNG(O.hash('tourney', s.world.placeId || 'x', s.day)), out = [];
      for (let i = 0; i < 6; i++) out.push({ name: `Sir ${r.pick(D.NAMES.m)} ${r.pick(KNIGHT_SUR)}`, str: 0.3 + r.next() * 0.55 });
      const bouts = [[out[0], out[1]], [out[2], out[3]], [out[4], out[5]]];
      return (s._tourney = { day: s.day, bouts, done: [], rode: false });
    }
    const odds = (a, b) => Math.max(1.2, Math.round((b.str / a.str) * 1.9 * 10) / 10);
    function joust(a, b, me) {
      // three passes; a broken lance scores, an unhorsing wins outright
      const lines = []; let sa = 0, sb = 0;
      for (let pass = 1; pass <= 3; pass++) {
        const ra = Math.random() * (a.str + 0.2), rb = Math.random() * (b.str + 0.2);
        if (ra > 0.85 && ra > rb * 1.6) { lines.push(`Pass ${pass}: ${me && a === me ? 'your' : a.name + "'s"} lance takes ${b === me ? 'you' : b.name} full on the shield, and ${b === me ? 'you go' : 'he goes'} over the horse's tail!`); return { win: a, lines }; }
        if (rb > 0.85 && rb > ra * 1.6) { lines.push(`Pass ${pass}: ${b === me ? 'your' : b.name + "'s"} lance takes ${a === me ? 'you' : a.name} full on the shield, and ${a === me ? 'you go' : 'he goes'} down in the dust!`); return { win: b, lines }; }
        if (ra > rb) { sa++; lines.push(`Pass ${pass}: ${a === me ? 'you break' : a.name + ' breaks'} a lance on ${b === me ? 'your' : b.name + "'s"} shield.`); } else { sb++; lines.push(`Pass ${pass}: ${b === me ? 'you break' : b.name + ' breaks'} a lance on ${a === me ? 'your' : a.name + "'s"} shield.`); }
      }
      return { win: sa >= sb ? a : b, lines };
    }
    function tournament(s) {
      const tn = knights(s), next = tn.bouts.find((bt) => !tn.done.includes(bt));
      const myHorse = O.Horses && O.Horses.horses.some((h) => h.owner === 'player');
      const armed = PS.items.some((k) => ['sword', 'axe', 'dagger'].includes(k));
      const ride = !tn.rode && myHorse && armed;
      O.Panels.open('The spring tournament', `<p class="speech">The herald calls the bouts. Pennants snap over the lists; the stands are full.</p>${next ? `<p>Next: <b>${esc(next[0].name)}</b> against <b>${esc(next[1].name)}</b>.</p><div class="topics"><button data-bet="0">Bet ₳10 on ${esc(next[0].name.split(' ')[1])} (pays ${odds(next[0], next[1])} to 1)</button><button data-bet="1">Bet ₳10 on ${esc(next[1].name.split(' ')[1])} (pays ${odds(next[1], next[0])} to 1)</button><button data-watch="1">Just watch</button></div>` : '<p>The day\'s bouts are done.</p>'}${ride ? '<div class="topics" style="margin-top:8px"><button data-ride="1">Ride in the lists yourself (₳10 fee, ₳60 purse)</button></div>' : !tn.rode ? '<p class="caption">To ride yourself you need a horse of your own and a weapon.</p>' : ''}`, (r) => {
        const run = (bet) => {
          tn.done.push(next); const res = joust(next[0], next[1], null), w = res.win;
          let tail = '';
          if (bet != null) { const pick = next[bet]; if (w === pick) { const pay = Math.round(10 * odds(pick, next[1 - bet])); PS.money += pay; tail = `Your man wins. The bookmaker counts out ₳${pay}.`; } else tail = 'Your man loses. The bookmaker pockets your ten.'; }
          O.Panels.open('The spring tournament', `<p>${res.lines.join('<br>')}</p><p class="speech"><b>${esc(w.name)}</b> wins the bout. ${tail}</p>`);
        };
        r.querySelectorAll('[data-bet]').forEach((b) => b.onclick = () => { if (PS.money < 10) return say('You need ₳10 to bet.', 'bad'); PS.money -= 10; run(+b.dataset.bet); });
        const wb = r.querySelector('[data-watch]'); if (wb) wb.onclick = () => run(null);
        const rb = r.querySelector('[data-ride]'); if (rb) rb.onclick = () => {
          if (PS.money < 10) return say('The fee is ₳10.', 'bad');
          PS.money -= 10; tn.rode = true;
          const me = { name: 'You', str: 0.25 + Math.min(0.5, (PS.skills.riding || 0) * 0.3 + (PS.items.includes('helm') ? 0.08 : 0) + (PS.items.includes('sword') ? 0.06 : 0)) };
          const foe = tn.bouts[Math.floor(Math.random() * 3)][Math.floor(Math.random() * 2)];
          const res = joust(me, foe, me), won = res.win === me;
          PS.skills.riding = Math.min(1, (PS.skills.riding || 0) + 0.06);
          if (won) { PS.money += 60; PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.15); PS.rep.local = Math.min(1, PS.rep.local + 0.15); s.log(`The stranger unseated ${foe.name} at the spring tournament, to roars from the stands.`, 'event'); }
          else { PS.hp = Math.max(10, PS.hp - 20); }
          O.Panels.open('In the lists', `<p>You ride against <b>${esc(foe.name)}</b>.</p><p>${res.lines.join('<br>')}</p><p class="speech">${won ? 'The stands roar. The herald puts the purse of ₳60 into your hand, and ladies throw ribbons.' : 'You pick yourself out of the dust, bruised. The crowd claps you off, kindly enough.'}</p>`);
        };
      });
    }

    // ---------------------------------------------------------------- the midwinter feast: a seat at the table
    let fedAt = -1;
    game.hooks.update.push(() => {
      const s = cur(), p = game.player; if (fest(s) !== 'midwinter' || s.hour < 18 || s.hour >= 22.5 || !p.sitting) return;
      const it = p.sitting.it; if (!it || !game.scene) return;
      const hall = game.scene.b.royal || game.scene.b.type === 'keep' || game.scene.b.type === 'tavern';
      if (!hall || fedAt === s.day) return;
      fedAt = s.day; PS.hunger = 100; PS.rep.local = Math.min(1, PS.rep.local + 0.05);
      say(game.scene.b.type === 'tavern' ? 'Ale and roast goose, on the lord\'s coin. A merry midwinter.' : 'Boar\'s head, roast swan and spiced wine. You eat like a lord at the midwinter feast.');
    });

    // ---------------------------------------------------------------- the day announced
    let told = '';
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.world) return;
      const f = fest(s), key = s.day + ':' + (f || '') + ':' + (s.weekday === 6);
      if (key === told || s.hour < 7) return; told = key;
      if (f === 'tournament' && keepOf(s)) say(`It's ${NAMES[f]} in ${s.world.name}! Knights ride at the lists in the square from ten. Bet at the lists, or ride if you have a horse.`);
      else if (f === 'fair') say(`It's ${NAMES[f]}! The square is full of stalls and music, and there's archery at the butts with a purse for the best shot.`);
      else if (f === 'midwinter') say(`It's ${NAMES[f]}. Tonight the castle and the gentry feast, and the town drinks at the tavern on the lord's coin.`);
      else if (s.weekday === 6 && !s.quarantine) say('Sunday market: travelling merchants set up in the square until two.');
    });
  }
  O.FestivalsSetup = { setup };
})();
