// A hand for the old. Now and then an old body is out with more than they can carry (a bucket of water, a
// bundle of sticks, a sack of meal), going a few steps and setting it down, a hand in the small of the back.
// You can take it from them and carry it home: they walk ahead of you slowly, talking all the way, and at
// their door they bless you, and remember.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let L = null, cool = 120, helped = 0, npcHelped = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    function end() { if (!L) return; const q = L.q; q._oldload = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; if (q.agent.carrying && q.agent.carrying.good === L.good) q.agent.carrying = null; } if (L.yours && PS.carry && PS.carry.oldload) PS.carry = null; L = null; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (L) { L.t += dt; const q = L.q, a = q.agent; if (L.s !== s || L.t > 120 || talking(q) || q.alive === false) { end(); return; }
        if (!L.yours) { // struggling: a few steps, then set it down and rest
          L.k -= dt; if (L.k <= 0) { L.k = L.rest ? 3 + Math.random() * 2 : 4 + Math.random() * 3; L.rest = !L.rest; a.frozen = L.rest; a.forceAnim = L.rest ? (Math.random() < 0.5 ? 'stretch' : 'cough') : null; if (L.rest && near(a.x, a.y, 220) && Math.random() < 0.5) O.Speech && O.Speech.say(q, pick(['Oof. My poor back.', 'Not as young as I was...', 'Just a moment, just a moment.']), 2); }
          // if you don't, someone else may: a passer-by takes it from them and carries it home
          if (!L.helper && L.t > 15 && Math.random() < dt * 0.3) { const hq = s.people.find((x) => x !== q && x.alive !== false && x.age >= 14 && x.age < 50 && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && !talking(x) && Math.hypot(x.agent.x - a.x, x.agent.y - a.y) < 260);
            if (hq) { L.helper = hq; hq._oldload = true; a.frozen = false; a.forceAnim = null; a.carrying = null; O.Speech && O.Speech.say(hq, pick(['Here, mother, give that to me.', 'Let me take that for you.', 'You\'ll do your back in. Give it here.']), 2.4); O.Errands.send(s, hq, [L.hb.doorX + 1, L.hb.doorY + 1], { anim: 'place', secs: 1, face: 3, giveUp: game.t + 90, carry: { good: L.good, qty: 3 }, after: (ok) => { hq._oldload = false; if (!ok || !L) return; npcHelped++; try { s.relate(q, hq, 0.2); s.remember(q, `${hq.first} carried my load home for me, God bless them.`, 'kindness', 0.6, hq.id); } catch (e) { /* */ } O.Speech && O.Speech.say(q, `Bless you, ${hq.first}. You're a good one.`, 2.4); setTimeout(end, 2500); } }); } }
          if ((L.t > 60 && !L.helper) || L.t > 110) end(); return; }
        // you carry it; they lead you home (and if they've stopped short, they set off again)
        if (!L.done && !q.errand && !a.frozen && Math.hypot(a.x - L.door[0], a.y - L.door[1]) >= 18 && (L.resent = (L.resent || 0) + dt) > 2) { L.resent = 0; O.Errands.send(s, q, [L.hb.doorX, L.hb.doorY + 1], { anim: 'idle', secs: 0.4, face: 3, giveUp: game.t + 90 }); }
        if (Math.hypot(a.x - L.door[0], a.y - L.door[1]) < 18 && near(L.door[0], L.door[1], 40) && !L.done) { L.done = true; helped++; a.frozen = true; a.forceAnim = 'bow'; a.dir = O.dirOf(game.player.x - a.x, game.player.y - a.y);
          O.Speech && O.Speech.say(q, pick(['Bless you, child. There\'s not many would.', 'There. God reward you for an old woman\'s back.', 'Bless your strong arms. Come in for a sup some time.']), 3); const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; r.affinity = Math.min(1, r.affinity + 0.2); r.familiar = Math.min(1, (r.familiar || 0) + 0.15); q.rel.set(0, r);
          try { s.remember(q, 'A stranger carried my load home for me when my back gave out.', 'kindness', 0.7); } catch (e) { /* */ } if (PS.rep) PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.01); setTimeout(end, 3500); }
        if (!L.chat && L.t > 4) { L.chat = true; O.Speech && O.Speech.say(q, pick(['My husband used to do this, God rest him.', 'You\'re not from here, are you? I can always tell.', 'Mind the step there, it\'s loose.']), 3); }
        return; }
      cool -= dt; if (cool > 0) return; cool = 240 + Math.random() * 240; if (hr < 8 || hr > 18) return;
      const q = s.people.find((x) => x.alive !== false && x.age >= 62 && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && !talking(x) && x.home != null && near(x.agent.x, x.agent.y, 260)); if (!q) return; const hb = s.building(q.home); if (!hb || hb.doorX == null) return;
      const good = pick(['firewood', 'bread', 'cabbage']); q._oldload = true; q.agent.carrying = { good, qty: 3 }; L = { s, q, good, t: 0, k: 1, rest: false, door: [hb.doorX * T + 8, (hb.doorY + 1) * T + 10], hb };
      O.Errands.send(s, q, [hb.doorX, hb.doorY + 1], { anim: 'idle', secs: 0.4, face: 3, giveUp: game.t + 120, carry: { good, qty: 3 } }); });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!L || L.yours || L.helper || game.scene || P.locked) return null; const a = L.q.agent; if (Math.hypot(a.x - P.x, a.y - P.y) > 32) return null;
      return { type: 'custom', d: 32, x: a.x, y: a.y - 28, label: `Carry ${L.q.first}'s load home for them`, act: () => { L.yours = true; L.t = 0; const a2 = L.q.agent; a2.frozen = false; a2.forceAnim = null; a2.carrying = null; if (!PS.carry) PS.carry = { good: L.good, qty: 3, oldload: true }; O.Speech && O.Speech.say(L.q, pick(['Oh! Would you? Bless you. It\'s just along here.', 'You\'re very kind. This way, this way.']), 2.6); } }; });
    (O.extraLines = O.extraLines || []).push((s, q) => L && L.q === q ? (L.yours ? 'The stranger is carrying your load home for you, and you are leading the way, chattering.' : 'You are old and carrying more than you should, and your back aches.') : '');
    O.OldLoad = { get npcHelped() { return npcHelped; }, get load() { return L; }, get helped() { return helped; }, soon: () => { cool = 0; } };
  }
  O.OldLoadSetup = { setup };
})();
