// People who know you ask things of you, and offer things. A neighbour presses a loaf into your hands
// for their mother across town (and a coin for the walk); a friend asks you to supper and you eat at
// their table; a beggar holds out a hand; and if you're married, your husband or wife is glad to see
// you come home, and feeds you if you look hungry.
'use strict';
(function () {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, clamp = O.clamp, G = () => O.Data.GOODS;
    const abs = (s) => s.day * 1440 + s.minute;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const fav = () => (PS.favours = PS.favours || []);
    const friends = (q) => [...(q.rel || new Map()).entries()].filter(([id, r]) => id !== 0 && r.affinity > 0.3).map(([id]) => id);
    const kin = (s, q) => [...new Set([...(q.parents || []), ...(q.children || []), ...friends(q)])].map((id) => s.byId.get(id)).filter((z) => z && z.alive !== false && z.home != null && z.home !== q.home && !z.visitor);
    const KIN = (q, z) => ((q.parents || []).includes(z.id) ? (z.sex === 'f' ? 'mother' : 'father') : (q.children || []).includes(z.id) ? (z.sex === 'f' ? 'daughter' : 'son') : 'friend');

    function askFavour(s, q) {
      const to = pick(kin(s, q)); if (!to) return false;
      const hh = s.household(q), g = ['bread', 'eggs', 'cabbage', 'cheese', 'candles', 'herbs'].find((x) => G()[x] && ((hh && hh.pantry && hh.pantry[x] >= 1) || x === 'bread'));
      if (!g || !PS.canCarry(g)) return false;
      if (hh && hh.pantry && hh.pantry[g] >= 1) hh.pantry[g] -= 1;
      PS.add(g); const tip = hh && hh.money > 10 ? 2 : 0; if (tip) { hh.money -= tip; PS.money += tip; }
      O.NpcActs.fly && O.NpcActs.fly(q, 'player', g);
      const home = s.building(to.home), nm = (G()[g]?.name || g).toLowerCase();
      fav().push({ place: s.world.placeId, from: q.id, fromName: q.first, to: to.id, toName: to.first, g, until: s.day + 2 });
      O.addLead && O.addLead({ place: s.world.placeId, id: to.id, until: abs(s) + 2880, why: 'favour', label: `Take the ${nm} to ${to.first}` });
      O.npcUI.startFrom(q, `Would you take this ${nm} to my ${KIN(q, to)} ${to.first}${home ? ', ' + (home.name && home.name !== 'House' ? 'at ' + home.name : 'at home') : ''}? ${tip ? "Here's a little for your trouble." : "I'd be grateful."}`);
      return true;
    }
    // the favour done: the one it was for has it
    (O.onGift = O.onGift || []).push((s, q, o) => {
      const f = fav().find((x) => x.place === s.world.placeId && x.to === q.id && x.g === o.g); if (!f) return;
      PS.favours = fav().filter((x) => x !== f);
      O.dropLead && O.dropLead((l) => l.why === 'favour' && l.id === q.id);
      const from = s.byId.get(f.from); if (from && f.reward) { const hf = s.household(from); const n = Math.min(f.reward, hf ? Math.floor(hf.money) : 0); if (n > 0) { hf.money -= n; PS.money += n; O.UI.say(`${f.fromName} pays you ₳${n} for the errand.`); } }
      if (from) { const r = relOf(from); r.affinity = clamp(r.affinity + 0.2, -1, 1); r.trust = clamp((r.trust || 0) + 0.15, -1, 1); s.remember(from, `${r.name || 'The stranger'} took the ${o.label || o.g} to my ${KIN(from, q)} as I asked.`, 'player', 1, 0.4); }
      const rq = relOf(q); rq.affinity = clamp(rq.affinity + 0.08, -1, 1); rq.familiar = Math.min(1, (rq.familiar || 0) + 0.1);
      s.remember(q, `${f.fromName} sent me ${o.label || o.g} by the stranger's hand.`, 'player', 0.8, 0.2);
    });
    // a beggar given a coin, or anyone given alms
    (O.onGift = O.onGift || []).push((s, q, o) => { if (o.g === 'coin' && q._begging) { q._begging = false; if (PS.rep) PS.rep.civilian = (PS.rep.civilian || 0) + 0.02; relOf(q).affinity = clamp(relOf(q).affinity + 0.25, -1, 1); } });
    // supper at a friend's: a full belly and a warmer friendship
    (O.onMeetDone = O.onMeetDone || []).push((s, q, m, met) => {
      if (!met || !/supper|dinner|eat/i.test(m.why)) return;
      PS.hunger = Math.min(100, (PS.hunger || 0) + 60); const r = relOf(q); r.affinity = clamp(r.affinity + 0.1, -1, 1);
      setTimeout(() => O.npcUI.startFrom(q, pick(['Sit, sit. There is pottage and bread, and plenty of it.', "Eat up, there's more in the pot.", "You're welcome at our table any night."])), 600);
    });

    O.Favours = { ask: askFavour };
    // an errand given in talk: their own thing, to someone they name, for what they offer
    function errand(s, q, a) {
      const to = O.NpcActs.personFor(s, a.to); if (!to || to === q || to.alive === false) return null;
      const g = O.NpcActs.goodFor(a.item); if (!g || g === 'coin' || !PS.canCarry(g)) return null;
      const hh = s.household(q); if (hh && hh.pantry && hh.pantry[g] >= 1) hh.pantry[g] -= 1; else if ((q.items || []).includes(g)) q.items.splice(q.items.indexOf(g), 1);
      PS.add(g); O.NpcActs.fly && O.NpcActs.fly(q, 'player', g);
      const reward = Math.max(0, Math.min(20, Math.round(Number(a.reward) || 0)));
      fav().push({ place: s.world.placeId, from: q.id, fromName: q.first, to: to.id, toName: to.first, g, until: s.day + 2, reward });
      O.addLead && O.addLead({ place: s.world.placeId, id: to.id, until: abs(s) + 2880, why: 'favour', label: `Take the ${(G()[g]?.name || g).toLowerCase()} to ${to.first}` });
      return null;
    }
    (O.onGift = O.onGift || []).push(() => {}); // (paid below, when it's handed over)
    const _base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'errand') return errand(s, q, a);
      if (a && a.do === 'hire_player') return O.Employment && O.Employment.hireByTalk ? O.Employment.hireByTalk(s, q) : null;
      if (a && a.do === 'want' && Number(a.reward) > 0) { const r0 = _base.apply(this, arguments); if (q.wants) q.wants.reward = Math.min(30, Math.round(Number(a.reward))); return r0; }
      return _base.apply(this, arguments);
    };
    // ---------------------------------------------------------------- who comes up to you
    let at = 0; const done = new Map();
    game.hooks.update.push((dt) => {
      at -= dt; if (at > 0) return; at = 3;
      const s = cur(); if (!s || !O.npcUI || O.npcUI.talking() || O.panelOpen || O.UI.dialogOpen() || game.sleepState) return;
      // expired favours: they hear the loaf never came
      for (const f of fav().slice()) if (f.place === s.world.placeId && s.day > f.until) { PS.favours = fav().filter((x) => x !== f); const from = s.byId.get(f.from); if (from) { relOf(from).affinity = clamp(relOf(from).affinity - 0.12, -1, 1); s.remember(from, `Gave the stranger something to take to my ${KIN(from, s.byId.get(f.to) || from)}, and it never came.`, 'player', 1, -0.3); } }
      const p = game.player, near = [];
      if (game.scene) { for (const a of game.scene.actors.values()) if (a.person && !a.hidden && !a.leaving && Math.hypot(a.x - p.x, a.y - p.y) < 90) near.push(a.person); }
      else for (const q of s.people) if (!q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - p.x, q.agent.y - p.y) < 80) near.push(q);
      for (const q of near.sort(() => Math.random() - 0.5)) {
        if (q.agent.frozen || q.activity?.act === 'sleep' || q.age < 12 || q.alive === false) continue;
        const r = relOf(q), k = q.id + ':' + s.day, d = done.get(k) || 0;
        // your husband or wife, at home
        const P = PS.partner;
        if (P && P.stage === 'married' && P.place === s.world.placeId && P.id === q.id && game.scene && game.scene.b.id === q.home && !(d & 1)) {
          done.set(k, d | 1);
          const hungry = (PS.hunger || 100) < 45; if (hungry) PS.hunger = Math.min(100, PS.hunger + 45);
          O.npcUI.startFrom(q, hungry ? pick(['There you are! You look half starved. Sit, I kept you a bowl.', "You're home. Eat something, you look done in."]) : pick(['There you are! I wondered where you had got to.', "You're home. Good.", 'Ah, there you are. How was the day?']));
          return;
        }
        // a friend asks you to supper
        if (r.affinity > 0.5 && r.familiar > 0.3 && q.home != null && s.hour >= 11 && s.hour < 17 && !(d & 2) && Math.random() < 0.05 && !(PS.meets || []).some((m) => m.who === q.id && m.state === 'set')) {
          done.set(k, d | 2);
          O.NpcActs.meet(s, q, { place: 'my home', hour: 19, day: 'today', why: 'supper' });
          O.npcUI.startFrom(q, pick(['Come and eat with us tonight, at seven. Nothing grand, mind.', "We've a pot on tonight. Come at seven and eat with us.", "You'll come to supper tonight? Seven o'clock, at ours."]));
          return;
        }
        // a favour asked of someone they trust a little
        if (r.affinity > 0.2 && r.familiar > 0.15 && q.age >= 18 && !(d & 4) && fav().length < 2 && Math.random() < 0.04) { done.set(k, d | 4); if (askFavour(s, q)) return; }
        // a beggar's hand out
        const hh = s.household(q);
        if (!q.job && q.age >= 16 && hh && hh.money < 4 && !game.scene && !(d & 8) && Math.random() < 0.25) {
          done.set(k, d | 8); q._begging = true;
          O.gesture && O.gesture(q, 'gesture', 2); O.Speech && O.Speech.say(q, pick(['Spare a coin, for pity?', 'A coin for bread, kind soul?', "Alms, for the love of God. I've not eaten today."]), 3.5);
          return;
        }
      }
    });
  }
  O.FavoursSetup = { setup };
})();
