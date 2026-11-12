// Neighbours borrow from each other too. A household that's run out of bread sends someone next door with a
// cloth over their arm: a knock, a word at the threshold, and the neighbour comes out with a loaf (if
// they're on good terms) or a shake of the head (if not). Lent bread is paid back a couple of days later,
// and both sides remember: the street's own web of small debts and kindnesses.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let B = null, cool = 90, lent = 0, refused = 0, repaid = 0; const owed = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._nb && !talking(q) && q.age >= 12;
    function end() { if (!B) return; for (const q of [B.asker, B.lender]) { if (!q) continue; q._nb = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } } B = null; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      // repayments fall due
      for (const o of owed.slice()) { if (o.s !== s || s.day < o.due) continue; owed.splice(owed.indexOf(o), 1); try { const a = s.household(o.asker), l = s.household(o.lender); if (a && l && a.pantry && l.pantry && (a.pantry.bread || 0) >= 1) { a.pantry.bread -= 1; l.pantry.bread = (l.pantry.bread || 0) + 1; repaid++; s.relate(o.lender, o.asker, 0.08); s.remember(o.lender, `${o.asker.first} paid back the loaf they borrowed, as they said they would.`, 'social', 0.4, o.asker.id); } else { s.relate(o.lender, o.asker, -0.1); s.remember(o.lender, `${o.asker.first} never paid back that loaf.`, 'grudge', 0.6, o.asker.id); } } catch (e) { /* */ } }
      if (B) { B.t += dt; if (B.s !== s || B.t > 60 || [B.asker, B.lender].some((q) => q && talking(q))) { end(); return; } if (!B.at) return; B.k += dt; const A = B.asker.agent;
        if (B.k > 1 && !B.knocked) { B.knocked = true; A.forceAnim = 'open'; if (near(A.x, A.y, 260)) O.sfx && O.sfx('door', 0.3); }
        if (B.k > 2.5 && !B.lender) { const lb = B.lb; const L = s.people.find((q) => q.home === lb.id && q.age >= 16 && able(q)); if (!L) { end(); return; } const la = L.agent; la.inside = null; la.hidden = false; la.x = lb.doorX * T + 8; la.y = (lb.doorY + 1) * T + 6; la.frozen = true; la.path = null; L._nb = true; B.lender = L; la.dir = 0; A.dir = 3; A.forceAnim = 'talk';
          if (near(A.x, A.y, 280)) O.Speech && O.Speech.say(B.asker, pick(['Could you spare a loaf till market day? We\'re clean out.', 'I hate to ask... a loaf? The little ones are hungry.']), 3); }
        if (B.lender && B.k > 5.5 && !B.answered) { B.answered = true; const L = B.lender, aff = L.rel.get(B.asker.id)?.affinity || 0; let yes = false; try { const lp = s.household(L)?.pantry, ap = s.household(B.asker)?.pantry; yes = !!(lp && ap && (lp.bread || 0) > 2 && aff > -0.2 && Math.random() < 0.7 + aff); if (yes) { lp.bread -= 1; ap.bread = (ap.bread || 0) + 1; } } catch (e) { /* */ }
          L.agent.forceAnim = yes ? 'give' : 'shake'; A.forceAnim = yes ? 'take' : 'idle';
          if (yes) { lent++; owed.push({ s, asker: B.asker, lender: L, due: s.day + 2 }); try { s.relate(B.asker, L, 0.12); s.remember(B.asker, `${L.first} next door lent us a loaf when we had none.`, 'kindness', 0.5, L.id); } catch (e) { /* */ } if (near(A.x, A.y, 280)) O.Speech && O.Speech.say(L, pick(['Here. Bring it back when you can.', 'Of course. Take two... no, one. Here.']), 2.4); B.asker.agent.carrying = { good: 'bread', qty: 1 }; }
          else { refused++; try { s.relate(B.asker, L, -0.08); s.remember(B.asker, `${L.first} wouldn't lend us so much as a crust.`, 'slight', 0.5, L.id); } catch (e) { /* */ } if (near(A.x, A.y, 280)) O.Speech && O.Speech.say(L, pick(['We\'ve barely enough ourselves.', 'Not again. Try someone else.']), 2.4); } }
        if (B.k > 9) { const q = B.asker, hb = s.building(q.home); end(); if (hb && hb.doorX != null) O.Errands.send(s, q, [hb.doorX, hb.doorY + 1], { anim: 'place', secs: 0.6, face: 0, giveUp: game.t + 60 }); }
        return; }
      cool -= dt; if (cool > 0) return; cool = 120 + Math.random() * 120; const hr = s.minute / 60; if (hr < 8 || hr > 19) return;
      // a hungry household near you, and a neighbour with bread in
      for (const hh of s.households) { if (hh.gone || !hh.pantry || (hh.pantry.bread || 0) >= 1 || !hh.members.length) continue; const hb = s.building(hh.home); if (!hb || hb.doorX == null || !near(hb.doorX * T, hb.doorY * T, 380)) continue;
        const asker = hh.members.map((id) => s.byId.get(id)).find((q) => able(q) && q.age >= 12); if (!asker) continue;
        const lhh = s.households.filter((x) => x !== hh && !x.gone && x.pantry && (x.pantry.bread || 0) > 2).map((x) => [x, s.building(x.home)]).filter(([, b]) => b && b.doorX != null).sort((a, b) => Math.hypot(a[1].doorX - hb.doorX, a[1].doorY - hb.doorY) - Math.hypot(b[1].doorX - hb.doorX, b[1].doorY - hb.doorY))[0]; if (!lhh || Math.hypot(lhh[1].doorX - hb.doorX, lhh[1].doorY - hb.doorY) > 18) continue;
        const lb = lhh[1], a = asker.agent; if (a.inside != null) { a.inside = null; a.hidden = false; a.x = hb.doorX * T + 8; a.y = (hb.doorY + 1) * T + 8; } asker._nb = true; B = { s, asker, lender: null, lb, t: 0, k: 0, at: false };
        O.Errands.send(s, asker, [lb.doorX, lb.doorY + 1], { anim: 'idle', secs: 0.1, face: 3, giveUp: game.t + 40, after: (ok) => { if (!B || B.asker !== asker) return; if (!ok) { end(); return; } a.frozen = true; a.path = null; B.at = true; } }); break; } });
    (O.extraLines = O.extraLines || []).push((s, q) => !B ? '' : q === B.asker ? 'Your household is out of bread and you have come to the neighbour\'s door to ask to borrow a loaf.' : q === B.lender ? `Your neighbour ${B.asker.first} has come to borrow bread.` : '');
    O.NpcBorrow = { get lent() { return lent; }, get refused() { return refused; }, get repaid() { return repaid; }, owed, get ask() { return B; }, soon: () => { cool = 0; } };
  }
  O.NpcBorrowSetup = { setup };
})();
