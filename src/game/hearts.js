// Hearts, hounds and the river. Townsfolk court in plain sight: a courting couple meet of an evening and
// walk out together, laughing, a posy passing between them. When two want the same one, they become
// rivals, glare and quarrel and may come to blows; when the choice is made, the loser is heartbroken a
// while and doesn't forgive the winner. A pair whose families are at odds may run off together by night
// and come back married. The gentry ride out hunting with hounds and beaters; you can beat for a few
// coins, or ride as a guest if you have a title. And on hot days the young swim in the river, and so can
// you: wade in off the bank and swim.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const sp = (q, t, secs = 2.4) => O.Speech && O.Speech.say(q, t, secs);
    const aff = (a, b) => (a.rel && a.rel.get(b.id) || {}).affinity || 0;
    const single = (p) => p && !p.spouse && !p.visitor && !p.withPlayer && p.age >= 17 && p.age <= 45 && p.alive !== false;

    // ---------------------------------------------------------------- courting and rivalry
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      this.romances = (this.romances || []).filter((m) => { const a = this.byId.get(m.a), b = this.byId.get(m.b); return single(a) && single(b); });
      this.rivals = (this.rivals || []).filter((m) => this.day - m.day < 30 && single(this.byId.get(m.x)));
      const sing = this.people.filter(single);
      // new courtships: two who like each other well
      if (this.romances.length < 4) for (const a of sing) {
        if (this.romances.some((m) => m.a === a.id || m.b === a.id)) continue;
        const b = sing.find((z) => z.sex !== a.sex && z.household !== a.household && aff(a, z) > 0.2 && aff(z, a) > 0.15 && !this.romances.some((m) => m.a === z.id || m.b === z.id));
        if (b && this.rng.chance(0.3)) { this.romances.push({ a: a.id, b: b.id, day: this.day }); this.remember(a, `I've been walking out with ${b.name}.`, 'social', 1.2, b.id); this.remember(b, `${a.name} has been courting me.`, 'social', 1.2, a.id); break; }
      }
      // a rival: someone else sweet on one of a courting pair
      for (const m of this.romances) {
        if (this.rivals.some((v) => v.x === m.a || v.x === m.b)) continue;
        for (const [x, w] of [[m.a, m.b], [m.b, m.a]]) {
          const X = this.byId.get(x), W = this.byId.get(w); if (!X || !W) continue;
          const y = sing.find((z) => z.id !== w && z.sex === W.sex && aff(z, X) > 0.25);
          if (y && this.rng.chance(0.25)) { this.rivals.push({ x, winner: w, loser: y.id, day: this.day }); this.relate(y, W, -0.3); this.relate(W, y, -0.3); this.remember(y, `${W.name} is after ${X.first}, and so am I.`, 'social', 1.5, W.id); this.remember(W, `${y.name} has eyes for ${X.first}. We'll see about that.`, 'social', 1.5, y.id); break; }
        }
      }
      // running off together, when the families are at odds
      for (const m of [...this.romances]) {
        const a = this.byId.get(m.a), b = this.byId.get(m.b); if (!a || !b || this.day - m.day < 4) continue;
        const ha = this.household(a), hb = this.household(b), headA = ha && this.byId.get(ha.members[0]), headB = hb && this.byId.get(hb.members[0]);
        if (headA && headB && headA !== a && headB !== b && (aff(headA, headB) < -0.15 || aff(headA, b) < -0.2) && this.rng.chance(0.2)) {
          this.romances = this.romances.filter((z) => z !== m); this.wed(a, b);
          this.log(`${a.first} and ${b.first} ran off together in the night and were married at the priory without their families' blessing.`, 'social');
          for (const h of [headA, headB]) this.remember(h, `${a.first} and ${b.first} eloped. A disgrace.`, 'social', 2);
        }
      }
      return r;
    };
    // the jilted
    const _wed = SP.wed;
    SP.wed = function (a, b) {
      const r = _wed.apply(this, arguments);
      for (const v of this.rivals || []) {
        if (v.x !== a.id && v.x !== b.id) continue; const other = v.x === a.id ? b : a, loser = [this.byId.get(v.loser), this.byId.get(v.winner)].find((z) => z && z !== other && z.id !== v.x);
        if (!loser) continue; loser.jilted = { day: this.day, by: v.x }; this.relate(loser, other, -0.25);
        this.remember(loser, `${(this.byId.get(v.x) || {}).first || 'They'} chose ${other.first} over me. My heart is broken.`, 'social', 2.5, other.id);
        this.log(`${loser.first} is heartbroken: ${(this.byId.get(v.x) || {}).first} has married ${other.first}.`, 'social');
      }
      this.romances = (this.romances || []).filter((m) => m.a !== a.id && m.b !== a.id && m.a !== b.id && m.b !== b.id);
      return r;
    };
    // they meet of an evening
    const _plan = SP.plan;
    SP.plan = function (p) {
      const a = _plan.call(this, p); const h = this.hour;
      if (a && h >= 18 && h < 20.5 && !this.raining && ['home', 'stroll', 'idle', 'socialise'].includes(a.act) && (this.romances || []).some((m) => (m.a === p.id || m.b === p.id) && (this.day + m.a) % 2 === 0)) return { act: 'stroll', outdoor: true, zone: 'square', courting: true };
      return a;
    };
    let ht = 0;
    game.hooks.update.push((dt) => {
      ht -= dt; if (ht > 0 || game.scene) return; ht = 2.5; const s = cur(); if (!s) return; const P = game.player, now = performance.now();
      const near = (q, r = 320) => q && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < r;
      for (const m of s.romances || []) {
        const a = s.byId.get(m.a), b = s.byId.get(m.b); if (!near(a) || !near(b) || Math.hypot(a.agent.x - b.agent.x, a.agent.y - b.agent.y) > 40 || (a.agent.gest && a.agent.gest.until > now)) continue;
        if (Math.random() < 0.5) { const [x, y] = Math.random() < 0.5 ? [a, b] : [b, a]; O.gesture(x, pick(['laugh', 'talk', 'place', 'bow']), 2); O.gesture(y, pick(['laugh', 'nod', 'curtsy']), 2); sp(x, pick(['You look well tonight.', 'I picked these for you.', 'Walk with me a while?', 'My mother asks after you.', 'Ha! You never did!'])); }
      }
      for (const v of s.rivals || []) {
        const w = s.byId.get(v.winner), l = s.byId.get(v.loser); if (!near(w) || !near(l) || Math.hypot(w.agent.x - l.agent.x, w.agent.y - l.agent.y) > 60 || Math.random() > 0.3) continue;
        O.gesture(l, 'point', 1.6); sp(l, pick([`Keep away from ${(s.byId.get(v.x) || {}).first}.`, 'You think you\'re good enough?', 'Watch yourself.'])); O.gesture(w, 'shrug', 1.6);
      }
      for (const q of s.people) if (q.jilted && s.day - q.jilted.day < 6 && near(q, 260) && Math.random() < 0.08 && !(q.agent.gest && q.agent.gest.until > now)) { O.gesture(q, 'mourn', 2.5); sp(q, pick(['*sigh*', 'What did I do wrong...', '(stares at nothing)'])); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = []; const m = (s.romances || []).find((z) => z.a === q.id || z.b === q.id); if (m) { const o = s.byId.get(m.a === q.id ? m.b : m.a); if (o) out.push(`You are courting ${o.name}, and it is the talk of the town.`); }
      const v = (s.rivals || []).find((z) => z.loser === q.id || z.winner === q.id); if (v) { const o = s.byId.get(v.loser === q.id ? v.winner : v.loser), x = s.byId.get(v.x); if (o && x) out.push(`You and ${o.name} are rivals for ${x.first}'s heart.`); }
      if (q.jilted && s.day - q.jilted.day < 20) out.push(`You were jilted lately and are heartbroken.`);
      return out.join(' ');
    });

    // ---------------------------------------------------------------- the hunt
    const huntDay = (s) => (s.season === 'autumn' || s.season === 'winter') && s.weekday === 4 && s.hour >= 8 && s.hour < 12 && !s.raining;
    const _plan2 = SP.plan;
    SP.plan = function (p) {
      const a = _plan2.call(this, p);
      if (huntDay(this) && a && !a.b?.toString().startsWith('x') && ((p.gentry && p.age >= 16 && p.age < 60) || ['gamekeeper', 'forester', 'falconer', 'groom', 'kennelman', 'huntsman'].includes(p.job?.role))) return { act: 'stroll', outdoor: true, zone: 'wood', hunt: true };
      return a;
    };
    let hu = 0, joined = null;
    game.hooks.update.push((dt) => {
      hu -= dt; if (hu > 0 || game.scene) return; hu = 3; const s = cur(); if (!s || !huntDay(s)) { joined = null; return; }
      const P = game.player, party = s.people.filter((q) => q.activity?.hunt && !q.agent.hidden && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 300);
      for (const q of party) if (Math.random() < 0.3) { O.gesture(q, q.gentry ? 'point' : 'sweep', 1.8); sp(q, q.gentry ? pick(['Tantivy! Tantivy!', 'Hallo! There he goes!', 'Loose the hounds!']) : pick(['Hey-up! Hey-up!', 'Hoo! Hoo!', '(beats the bracken)'])); }
      if (joined && s.day === joined.day && performance.now() - joined.at > 60000) {
        const got = Math.random() < 0.55; joined = { day: s.day, at: Infinity };
        if (got) { s.drop('venison', 1, P.x + 10, P.y); PS.money += joined.pay || 0; for (const q of party) if (q.gentry) s.relate(q, { id: 0 }, 0.04); say(`The hart is brought down. ${PS.title ? 'You are given a share of the venison.' : 'You get your beater\'s pay and a haunch for your trouble.'}`); if (!PS.title) PS.money += 3; }
        else { if (!PS.title) PS.money += 3; say('The hounds lose the scent at the river. The hunt goes home empty-handed.'); }
      }
    });
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), P = game.player; if (!s || game.scene || !huntDay(s) || (joined && joined.day === s.day)) return null;
      const q = s.people.find((z) => z.activity?.hunt && (z.gentry || /gamekeeper|forester|huntsman/.test(z.job?.role || '')) && !z.agent.hidden && Math.hypot(z.agent.x - P.x, z.agent.y - P.y) < 60); if (!q) return null;
      return { type: 'custom', d: 12, x: q.agent.x, y: q.agent.y - 50, label: PS.title || (O.crowned && O.crowned()) ? 'Ride with the hunt' : 'Beat for the hunt (₳3)', act: () => {
        joined = { day: s.day, at: performance.now() }; O.gesture(q, 'wave', 1.5); sp(q, PS.title ? 'Well met! Ride with us.' : 'Get in with the beaters, then. Drive them towards us.');
        game.player.anim = PS.title ? 'point' : 'sweep'; setTimeout(() => { game.player.anim = 'idle'; }, 2000);
        say(PS.title ? 'You fall in with the gentry. Keep near: the hounds have a scent.' : 'You take a stick and go in among the beaters, driving the deer out of the covert. Keep near the hunt.');
      } };
    });
    (O.extraLines = O.extraLines || []).push((s, q) => q.activity?.hunt ? (q.gentry ? 'You are out hunting the hart with hounds today, in high spirits.' : 'You are beating for the gentry\'s hunt today.') : '');

    // ---------------------------------------------------------------- swimming
    let swimming = false, wet = false;
    const isWater = (w, x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return w.ter[ty * w.W + tx] === w.TER.WATER; };
    const warm = (s) => s.season === 'summer' || (s.season === 'spring' && s.weather.kind === 'heat') || s.weather.kind === 'heat';
    const _blocked = game.blocked.bind(game);
    game.blocked = (x, y) => { if (!swimming || game.scene) return _blocked(x, y); const w = game.world, hard = (px, py) => game.solidAt(px, py) && !isWater(w, px, py); return hard(x - 4, y - 3) || hard(x + 3, y - 3) || hard(x - 4, y) || hard(x + 3, y); };
    O.moreCandidates.push(() => {
      const s = cur(), w = game.world, P = game.player; if (!s || game.scene || !w.ter || swimming || P.mount || (O.rowing && O.rowing())) return null;
      if (!warm(s) || s.hour < 8 || s.hour > 20) return null;
      const tx = Math.floor(P.x / T), ty = Math.floor(P.y / T); if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.ter[(ty + dy) * w.W + tx + dx] === w.TER.WATER)) return null;
      return { type: 'custom', d: 24, x: P.x, y: P.y - 44, label: 'Go for a swim', act: () => { swimming = true; wet = false; say('You strip to your shirt and wade in. It takes your breath, then it\'s glorious.'); } };
    });
    game.hooks.update.push(() => {
      if (!swimming) return; const w = game.world, P = game.player; if (game.scene) { swimming = false; return; }
      if (isWater(w, P.x, P.y - 2)) wet = true;
      if (!isWater(w, P.x, P.y - 2)) { if (wet && !isWater(w, P.x, P.y + 6)) { wet = false; swimming = false; PS.grime = Math.min(PS.grime || 0, 0.05); PS.mood = Math.min(100, (PS.mood || 50) + 4); say('You climb out on the bank, dripping and clean.'); } return; }
      P.speedMul = 0.6; PS.energy = Math.max(0, PS.energy - 0.003);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; const w = game.world, t = performance.now() / 1000;
      if (swimming && isWater(w, game.player.x, game.player.y - 2)) { const P = game.player, x = Math.round(P.x - cam.x), y = Math.round(P.y - cam.y); ctx.fillStyle = 'rgba(46,92,140,0.92)'; ctx.fillRect(x - 9, y - 15, 18, 17); ctx.fillStyle = 'rgba(200,225,245,0.8)'; const k = Math.floor(t * 4) % 2; ctx.fillRect(x - 8 + k, y - 16, 6, 1); ctx.fillRect(x + 2 - k, y - 16, 6, 1); }
      // the young in the water on a hot day
      const s = cur(); if (!s || !warm(s) || s.hour < 11 || s.hour > 18 || s.raining) return;
      if (!swimmers.length || swimmers.world !== w) placeSwimmers(s, w);
      for (const z of swimmers) { const bob = Math.sin(t * 3 + z.p) * 1.5, x = Math.round(z.x + Math.sin(t * 0.5 + z.p) * 10 - cam.x), y = Math.round(z.y + bob - cam.y); if (x < -10 || y < -10 || x > game.vw + 10 || y > game.vh + 10) continue; ctx.fillStyle = 'rgba(200,225,245,0.7)'; ctx.fillRect(x - 5, y + 3, 10, 1); ctx.fillStyle = z.skin; ctx.fillRect(x - 2, y - 3, 5, 5); ctx.fillStyle = z.hair; ctx.fillRect(x - 2, y - 4, 5, 2); ctx.fillStyle = '#1a1410'; ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); }
    });
    let swimmers = [];
    function placeSwimmers(s, w) {
      swimmers = []; swimmers.world = w; const kids = s.people.filter((q) => q.age >= 8 && q.age < 20 && q.app).slice(0, 12); if (!w.ter) return;
      const ox = w.ox || 0, oy = w.oy || 0; let n = 0;
      for (let k = 0; k < 400 && n < 3; k++) { const tx = ox - 10 + Math.floor(Math.random() * ((w.townW || 60) + 20)), ty = oy - 10 + Math.floor(Math.random() * ((w.townH || 40) + 20)); if (tx < 1 || ty < 1 || tx >= w.W - 1 || ty >= w.H - 1 || w.ter[ty * w.W + tx] !== w.TER.WATER || w.ter[ty * w.W + tx + 1] !== w.TER.WATER) continue; const q = kids[n % Math.max(1, kids.length)]; swimmers.push({ x: tx * T + 8, y: ty * T + 8, p: Math.random() * 6, skin: ['#e8c0a0', '#d8a880', '#b07850', '#7a4a2c'][n % 4], hair: ['#5a3a20', '#2a1c14', '#c89048', '#8a3a20'][(n + (q ? q.id : 0)) % 4], name: q && q.first }); n++; }
    }
    let sw = 0;
    game.hooks.update.push((dt) => { sw -= dt; if (sw > 0) return; sw = 15; const P = game.player; const z = swimmers.find((q) => Math.hypot(q.x - P.x, q.y - P.y) < 200); if (z && Math.random() < 0.5) O.Speech && O.Speech.say({ x: z.x, y: z.y - 10 }, pick(['Come on in!', 'It\'s not even cold!', 'Bet you can\'t swim across!', '*splash*']), 2.4); });
  }
  O.HeartsSetup = { setup };
})();
