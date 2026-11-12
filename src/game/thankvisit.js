// Thanks, returned. When someone has been done a kindness by a neighbour (a lost child brought home, a load
// carried, a loaf given, a fire put out), a day or so later they go round to that neighbour's door with
// something in a cloth: a few eggs, a cake, a jug. A knock, a few words at the threshold, the gift handed
// over, and the two of them a little closer than before.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let V = null, cool = 80, visits = 0; const done = new Set();
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._thank && !talking(q) && q.age >= 12;
    function end() { if (!V) return; for (const q of [V.q, V.b]) { if (!q) continue; q._thank = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } } V = null; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      if (V) { V.t += dt; if (V.s !== s || V.t > 60 || [V.q, V.b].some((q) => q && talking(q))) { end(); return; } if (!V.at) return; V.k += dt; const qa = V.q.agent;
        if (V.k > 1 && !V.knocked) { V.knocked = true; qa.forceAnim = 'open'; if (near(qa.x, qa.y, 260)) O.sfx && O.sfx('door', 0.3); }
        if (V.k > 2.5 && !V.out) { V.out = true; const ba = V.b.agent; if (!able(V.b) && !(V.b.agent.inside === V.hb.id)) { end(); return; } ba.inside = null; ba.hidden = false; ba.x = V.hb.doorX * T + 8; ba.y = (V.hb.doorY + 1) * T + 6; ba.frozen = true; ba.path = null; ba.dir = 0; V.b._thank = true; qa.dir = 3; }
        if (V.out && V.k > 3) { const ba = V.b.agent; qa.forceAnim = V.k < 6 ? 'talk' : V.k < 7.5 ? 'give' : 'bow'; ba.forceAnim = V.k < 6 ? 'idle' : V.k < 7.5 ? 'take' : 'nod';
          if (!V.s1) { V.s1 = true; if (near(qa.x, qa.y, 280)) O.Speech && O.Speech.say(V.q, pick([`I never thanked you properly, ${V.b.first}. Here.`, `Just a little something, ${V.b.first}, for what you did.`, 'For your kindness. Don\'t say no.']), 3); }
          if (V.k > 7.5 && !V.gave) { V.gave = true; visits++; try { const a = s.household(V.q), b = s.household(V.b); const k = pick(['bread', 'cabbage', 'meat']); if (a && b && a.pantry && b.pantry && (a.pantry[k] || 0) > 0) { a.pantry[k]--; b.pantry[k] = (b.pantry[k] || 0) + 1; } s.relate(V.b, V.q, 0.12); s.relate(V.q, V.b, 0.05); s.remember(V.b, `${V.q.first} came round with a gift to thank me.`, 'social', 0.5, V.q.id); } catch (e) { /* */ } if (near(qa.x, qa.y, 280)) O.Speech && O.Speech.say(V.b, pick(['You shouldn\'t have! Come in a moment.', 'Ah, there was no need. Thank you.']), 2.4); }
          if (V.k > 10) { const q = V.q, hb = s.building(q.home); end(); if (hb && hb.doorX != null) O.Errands.send(s, q, [hb.doorX, hb.doorY + 1], { anim: 'place', secs: 0.5, face: 0, giveUp: game.t + 60 }); } }
        return; }
      cool -= dt; if (cool > 0) return; cool = 120 + Math.random() * 120; const hr = s.minute / 60; if (hr < 9 || hr > 19) return;
      // someone owing thanks to a neighbour whose house is near you
      for (const q of s.people) { if (!able(q) || !q.memories) continue; const m = q.memories.find((x) => x.kind === 'kindness' && x.about != null && x.about !== 0 && s.day - x.day <= 6 && !done.has(q.id + ':' + x.about + ':' + x.day)); if (!m) continue; const b = s.byId.get(m.about); if (!b || b.alive === false || b.home == null || b.home === q.home) continue; const hb = s.building(b.home); if (!hb || hb.doorX == null || !near(hb.doorX * T, hb.doorY * T, 380)) continue;
        done.add(q.id + ':' + m.about + ':' + m.day); const a = q.agent; if (a.inside != null) { const h0 = s.building(a.inside); a.inside = null; a.hidden = false; if (h0 && h0.doorX != null) { a.x = h0.doorX * T + 8; a.y = (h0.doorY + 1) * T + 8; } } q._thank = true; V = { s, q, b, hb, t: 0, k: 0, at: false };
        O.Errands.send(s, q, [hb.doorX, hb.doorY + 1], { anim: 'idle', secs: 0.1, face: 3, giveUp: game.t + 45, carry: { good: 'bread', qty: 1 }, after: (ok) => { if (!V || V.q !== q) return; if (!ok) { end(); return; } a.frozen = true; a.path = null; V.at = true; } }); break; } });
    (O.extraLines = O.extraLines || []).push((s, q) => !V ? '' : q === V.q ? `You are calling at ${V.b.first}'s door with a small gift, to thank them for a kindness.` : q === V.b ? `${V.q.first} has come to your door with a gift, to thank you for a kindness you did them.` : '');
    O.ThankVisit = { get visits() { return visits; }, get visit() { return V; }, soon: () => { cool = 0; } };
  }
  O.ThankVisitSetup = { setup };
})();
