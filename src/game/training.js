// Animals that learn. A dog of your own can be taught, a lesson a day, to hunt (it runs down a rabbit
// or a hare when you're out in the country), to guard (it goes for whoever goes for you), or to fetch
// (it brings you what's lying on the ground). A cat learns to come when called. Your horse gets faster
// and steadier the more you ride it. And a hawk, bought from a falconer and named by you, can be flown
// over the open fields and comes back with a rabbit or a bird, better each time.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS;
    G.hawk = G.hawk || { name: 'Goshawk', base: 60, unit: 'hawk', slots: 1 };
    const LESSONS = { dog: [['hunt', 'to hunt'], ['guard', 'to guard you'], ['fetch', 'to fetch']], cat: [['come', 'to come when called']] };
    const NEED = 5;
    O.petExtra = (f) => (LESSONS[f.kind] || []).map(([k, l]) => { const v = (f.skills || {})[k] || 0; return v >= NEED ? null : [`teach:${k}`, `Teach ${l} (${v}/${NEED})`]; }).filter(Boolean);
    O.petDo = (f, m) => {
      if (!m.startsWith('teach:')) return; const k = m.slice(6), s = cur();
      if (f.taught === s.day) return say(`${f.name || 'Your ' + f.kind} has had a lesson today. Tomorrow.`);
      f.taught = s.day; f.skills = f.skills || {}; const ok = Math.random() < 0.5 + (f.bond || 0) * 0.5;
      if (ok) f.skills[k] = (f.skills[k] || 0) + 1; f.bond = Math.min(1, (f.bond || 0) + 0.02);
      game.player.anim = 'crouch'; setTimeout(() => { if (game.player.anim === 'crouch') game.player.anim = 'idle'; }, 1200);
      O.Speech && O.Speech.say(f, ok ? (f.kind === 'dog' ? 'Woof!' : 'Mrrp.') : '(looks away)', 1.6);
      say(ok ? (f.skills[k] >= NEED ? `${f.name || 'Your ' + f.kind} has learned ${LESSONS[f.kind].find((x) => x[0] === k)[1]}.` : `A good lesson. (${f.skills[k]}/${NEED})`) : 'Not today. It has other ideas.');
    };
    const mine = (kind, skill) => (O.fauna || []).filter((f) => f.owner === 'player' && f.kind === kind && f.mode === 'heel' && f.world === game.world?.placeId && ((f.skills || {})[skill] || 0) >= NEED);
    // the hunting dog and the fetching dog, out of doors
    let ht = 0;
    game.hooks.update.push((dt) => {
      ht -= dt; if (ht > 0 || game.scene) return; ht = 6; const s = cur(), P = game.player; if (!s) return;
      for (const d of mine('dog', 'hunt')) {
        const prey = (O.fauna || []).find((f) => f.wild && !f.fierce && !f.dead && f.world === d.world && (f.kind === 'rabbit' || (f.kind === 'deer' && Math.random() < 0.2)) && Math.hypot(f.x - P.x, f.y - P.y) < 160);
        if (!prey || Math.random() > 0.45) continue;
        if (d.chase) continue; d.chase = { prey, t: 0 }; O.Speech && O.Speech.say(d, 'Woof! Woof!', 1.6); continue;
      }
    });
    // the chase itself: the dog after it flat out, the prey jinking away, until it's caught or lost
    game.hooks.update.push((dt) => {
      const s = cur(), P = game.player; if (!s || game.scene) return;
      for (const d of (O.fauna || [])) { const c = d.chase; if (!c) continue; const prey = c.prey; c.t += dt;
        if (prey.dead || c.t > 7) { d.chase = null; if (!prey.dead) say(`${d.name || 'Your dog'} loses the ${prey.kind} in the long grass and comes back panting.`); continue; }
        const px = prey.x - d.x, py = prey.y - d.y, dd = Math.hypot(px, py) || 1;
        const pa = Math.atan2(prey.y - d.y, prey.x - d.x) + Math.sin(c.t * 5) * 0.8; prey.x += Math.cos(pa) * 70 * dt; prey.y += Math.sin(pa) * 50 * dt; prey.moving = true; prey.dir = Math.cos(pa) > 0 ? 2 : 1; prey.tx = null;
        d.x += px / dd * 95 * dt; d.y += py / dd * 95 * dt; d.moving = true; d.dir = px > 0 ? 2 : 1; d.tx = null;
        if (dd < 8) { prey.dead = true; O.fauna.splice(O.fauna.indexOf(prey), 1); d.chase = null; s.drop(prey.kind === 'deer' ? 'venison' : 'meat', 1, prey.x, prey.y);
          say(`${d.name || 'Your dog'} runs down a ${prey.kind} and stands over it, tail going.`);
        if (prey.kind === 'deer') { const keeper = s.people.find((q) => ['gamekeeper', 'forester'].includes(q.job?.role) && !q.agent.hidden && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 260); if (keeper) { const c = s.recordCrime({ kind: 'poaching', perp: 'player', placeName: 'the woods', tile: [Math.floor(P.x / T), Math.floor(P.y / T)], seen: [keeper], severity: 2 }); if (c) PS.crimes.push(c.id); } }
      } }
    });
    let ft2 = 0;
    game.hooks.update.push((dt) => {
      ft2 -= dt; if (ft2 > 0 || game.scene) return; ft2 = 6; const s = cur(), P = game.player; if (!s) return;
      for (const d of mine('dog', 'fetch')) {
        const it = (s.dropped || []).find((x) => !x.placed && Math.hypot(x.x - P.x, x.y - P.y) < 140 && Math.hypot(x.x - P.x, x.y - P.y) > 20);
        if (!it || !PS.canCarry(it.good)) continue;
        s.dropped.splice(s.dropped.indexOf(it), 1); PS.add(it.good, it.qty || 1); O.Speech && O.Speech.say(d, '(drops it at your feet)', 1.6); say(`${d.name || 'Your dog'} fetches the ${(G[it.good]?.name || it.good).toLowerCase()}.`);
      }
    });
    // the guard dog goes for whoever goes for you
    if (O.Combat && O.Combat.provoke) { const _pv = O.Combat.provoke; O.Combat.provoke = function (q, how) { const r = _pv.apply(this, arguments); if (how === 'fight' && q && q.health) for (const d of mine('dog', 'guard')) { if (Math.hypot(d.x - q.agent.x, d.y - q.agent.y) > 200) continue; q.health.hp = Math.max(1, q.health.hp - 12); O.Speech && O.Speech.say(d, 'GRRR! WOOF!', 1.8); O.Speech && O.Speech.say(q, 'Call it off! Call it off!', 2, 'shout'); _pv.call(this, q, 'flee'); } return r; }; }

    // the horse that's ridden grows faster and steadier
    let rt = 0;
    game.hooks.update.push((dt) => {
      const h = game.player.mount; if (!h || h.owner !== 'player') return; rt += dt; if (rt < 20) return; rt = 0;
      h.ridden = (h.ridden || 0) + 1; if (h.ridden % 15 === 0 && (h.trainedBonus || 0) < 0.15) { h.trainedBonus = (h.trainedBonus || 0) + 0.03; h.speed = (h.speed || 1) * 1.03; say(`${h.name} is going better: quicker off the mark and steadier under you.`); }
    });

    // hawks: flown over open ground
    const hawks = () => (PS.hawks = PS.hawks || []);
    game.hooks.update.push(() => {
      if (!PS.items.includes('hawk')) return; PS.items.splice(PS.items.indexOf('hawk'), 1);
      const hk = { name: null, skill: 0.2, flights: 0 }; hawks().push(hk);
      O.Panels.open('A hawk of your own', `<p>She sits hooded on your fist. What will you call her?</p><input type="text" data-n maxlength="14" placeholder="${['Swift', 'Gilda', 'Tempest', 'Ash', 'Bryony'][hawks().length % 5]}" style="width:100%"><div class="topics" style="margin-top:8px"><button data-ok>Name her</button></div>`, (r) => {
        const i = r.querySelector('[data-n]'); i.focus(); const ok = () => { const v = (i.value || i.placeholder).trim().replace(/[^A-Za-z' -]/g, '').slice(0, 14); hk.name = v || i.placeholder; O.Panels.close(); say(`${hk.name} is yours. Fly her over open fields.`); };
        r.querySelector('[data-ok]').onclick = ok; i.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
      });
    });
    let flown = 0, hawkFly = null;
    // the flight itself: off the fist, up in rings, a stoop on the quarry, and back to the glove
    game.hooks.update.push((dt) => { if (hawkFly) { hawkFly.t += dt; if (hawkFly.t > 6.4) hawkFly = null; } });
    game.hooks.drawWorld.push((ctx, cam) => {
      const f = hawkFly; if (!f || game.scene) return; const P = game.player, hx = P.x + (P.dir === 1 ? -6 : 6), hy = P.y - 18, t = f.t; let x, y, flap = true, prey = false;
      if (t < 1.4) { const k = t / 1.4; x = hx + Math.sin(k * 6) * 30 * k; y = hy - k * 70; }
      else if (t < 3.2) { const a = (t - 1.4) * 2.6; x = hx + Math.cos(a) * 46; y = hy - 70 + Math.sin(a) * 16; flap = Math.floor(t * 4) % 3 !== 0; }
      else if (t < 3.8) { const k = (t - 3.2) / 0.6; x = hx + Math.cos(4.7) * 46 + (f.dx - Math.cos(4.7) * 46) * k; y = hy - 70 + (f.dy + 18 + 70) * k * k; flap = false; }
      else if (t < 4.6) { x = hx + f.dx; y = hy + f.dy + 18; flap = Math.floor(t * 10) % 2 === 0; if (f.ok) { prey = true; } }
      else { const k = Math.min(1, (t - 4.6) / 1.4); x = hx + f.dx * (1 - k); y = hy + (f.dy + 18) * (1 - k) - Math.sin(k * Math.PI) * 30; prey = f.ok; }
      const sx = Math.round(x - cam.x), sy = Math.round(y - cam.y), w = flap && Math.floor(t * 12) % 2 ? 2 : 0;
      ctx.fillStyle = '#5a4030'; ctx.fillRect(sx - 2, sy - 1, 5, 3); ctx.fillRect(sx - 6, sy - 1 - w, 4, 2); ctx.fillRect(sx + 3, sy - 1 - w, 4, 2); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(sx, sy, 2, 1); ctx.fillStyle = '#c8a040'; ctx.fillRect(sx + 2, sy - 2, 1, 1);
      if (prey) { ctx.fillStyle = '#9a8070'; ctx.fillRect(sx - 2, sy + 2, 5, 3); }
      if (t > 3.8 && t < 4.6) { ctx.fillStyle = 'rgba(200,190,160,0.6)'; for (let i = 0; i < 4; i++) ctx.fillRect(sx - 6 + i * 4, sy + 6 + (i % 2), 1, 1); }
      if (t < 6.2 && (t < 0.3 || t > 5.8)) { P.anim = 'point'; }
    });
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), w = game.world, P = game.player; if (!s || game.scene || !hawks().length || !w.ter) return null;
      const t = w.ter[Math.floor(P.y / T) * w.W + Math.floor(P.x / T)]; if (t === w.TER.FOREST || t === w.TER.WATER || t === w.TER.COBBLE) return null;
      if (w.ox != null && Math.max(w.ox - P.x / T, P.x / T - w.ox - w.townW, w.oy - P.y / T, P.y / T - w.oy - w.townH, 0) < 4) return null;
      const hk = hawks()[0];
      return { type: 'custom', d: 6, x: P.x, y: P.y - 50, label: `Fly ${hk.name || 'your hawk'}`, act: () => {
        if (performance.now() - flown < 40000) return say(`${hk.name || 'Your hawk'} needs to rest a while.`); flown = performance.now();
        P.anim = 'point'; setTimeout(() => { P.anim = 'idle'; }, 1500); hk.flights++;
        const ok0 = Math.random() < 0.3 + hk.skill * 0.6; hawkFly = { t: 0, dx: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 50), dy: -10 + Math.random() * 50, ok: ok0 };
        setTimeout(() => { const ok = ok0; hk.skill = Math.min(1, hk.skill + 0.03); if (ok) { const g = Math.random() < 0.6 ? 'meat' : 'feathers'; if (PS.canCarry(g)) PS.add(g); say(`${hk.name || 'Your hawk'} stoops on something in the grass and comes back to the glove with ${g === 'meat' ? 'a rabbit' : 'a partridge'}.`); } else say(`${hk.name || 'Your hawk'} circles high, misses, and comes back to the lure.`); }, 6200);
      } };
    });
    // a falconer can sell you a hawk; someone with a pup or kitten can give you one (pets.js)
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'sell' && O.NpcActs.goodFor(a.item) === 'hawk') { if (!/falconer|gamekeeper/.test(q.job?.role || '')) return null; const pr = O.clamp(Math.round(Number(a.price) || 60), 0, 300); if (PS.money < pr) return `You haven't ₳${pr}.`; PS.money -= pr; const hh = s.household(q); if (hh) hh.money += pr; PS.add('hawk'); return `${q.first} sets a hooded goshawk on your fist (₳${pr}).`; }
      return base.apply(this, arguments);
    };
    (O.extraLines = O.extraLines || []).push((s, q) => /falconer/.test(q.job?.role || '') ? 'You train hawks; you can sell the player a goshawk (sell {"item":"hawk","price"}), about ₳60, and tell them how to fly her.' : '');
  }
  O.TrainingSetup = { setup };
})();
