// Neighbours borrow. Now and then, when you're by your own house, a neighbour comes over a little shamefaced:
// could you spare a loaf till market day, or a bundle of firewood, the children are cold. Lend it, and a day
// or two later they're back with it and something over (an egg, a coin, a bit of cheese) because that's how
// neighbours are; turn them away and they remember that too.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState, G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let A = null, acc = 0, last = -99, force = false, lent = 0, refused = 0, repaid = 0; const owed = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const myHouse = (s) => s.world.buildings.find((b) => b.owner && b.owner.kind === 'player' && b.doorX != null && near(b.doorX * T, b.doorY * T, 160));
    function release() { if (!A) return; const q = A.q; q._borrow = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } A = null; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return; acc += dt;
      if (A) { A.t += dt; if (A.s !== s || A.t > 45 || !near(A.q.agent.x, A.q.agent.y, 120)) { if (A.asked && !A.answered) { refused++; relOf(A.q).affinity -= 0.03; } release(); return; } if (A.q.agent.frozen) { A.q.agent.dir = O.dirOf(game.player.x - A.q.agent.x, game.player.y - A.q.agent.y); A.q.agent.forceAnim = A.answered ? 'nod' : 'talk'; }
        if (A.q.agent.frozen && !A.asked) { A.asked = true; O.Speech && O.Speech.say(A.q, A.repay ? pick([`Here's your ${A.good} back, and a little something for your trouble.`, `I said I'd bring it back. And this, for being a good neighbour.`]) : pick(A.good === 'bread' ? ['I hate to ask... could you spare a loaf till market day? The children...', 'Could you lend us a loaf? I\'ll pay it back, honest.'] : ['Could you spare a bundle of firewood? Ours is wet through and the little one\'s cold.', 'Have you a bit of firewood you could lend? I\'ll bring it back.']), 4);
          if (A.repay) { A.answered = true; repaid++; if (G[A.good] && PS.canCarry(A.good)) PS.add(A.good); const extra = pick(['coin', 'bread', 'cabbage']); if (extra === 'coin') PS.money = (PS.money || 0) + 2; else if (G[extra] && PS.canCarry(extra)) PS.add(extra); O.UI && O.UI.say && O.UI.say(`${A.q.first} gives you back the ${A.good}${extra === 'coin' ? ', and presses two pennies on you' : `, and a ${extra} besides`}.`, 'good'); relOf(A.q).affinity = Math.min(1, relOf(A.q).affinity + 0.1); setTimeout(release, 4000); } }
        return; }
      if (acc < 2) return; acc = 0; const hr = s.minute / 60; if (hr < 8 || hr > 19) return;
      const b = myHouse(s); if (!b) return;
      // someone come to pay back what they borrowed?
      const due = owed.find((o) => o.s === s && s.day >= o.due && o.q.alive !== false && o.q.agent && !o.q.agent.frozen && !o.q.errand && !talking(o.q));
      let q = due ? due.q : null, good = due ? due.good : null;
      if (!q) { if (!force && (s.day - last < 2 || Math.random() > 0.15)) return; force = false; q = s.people.filter((x) => x.alive !== false && x.age >= 18 && x.agent && !x.agent.frozen && !x.errand && !talking(x) && x.home != null && x.home !== b.id && !owed.some((o) => o.q === x)).map((x) => { const hb = s.building(x.home); return [x, hb && hb.doorX != null ? Math.hypot(hb.doorX - b.doorX, hb.doorY - b.doorY) : 999]; }).filter(([, d]) => d < 16).sort((a, c) => a[1] - c[1])[0]?.[0]; if (!q) return; good = Math.random() < 0.5 ? 'bread' : 'firewood'; last = s.day; }
      else owed.splice(owed.indexOf(due), 1);
      const a = q.agent; if (a.inside != null) { const hb = s.building(a.inside); if (hb && hb.doorX != null) { a.x = hb.doorX * T + 8; a.y = (hb.doorY + 1) * T + 8; } a.inside = null; a.hidden = false; } q._borrow = true; A = { s, q, good, t: 0, repay: !!due };
      O.Errands.send(s, q, [Math.floor(game.player.x / T) + 1, Math.floor(game.player.y / T)], { anim: 'idle', secs: 0.1, face: 0, giveUp: game.t + 40, carry: due ? { good, qty: 1 } : null, after: (ok) => { if (!A || A.q !== q) return; if (!ok) { release(); return; } a.frozen = true; a.path = null; } }); });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!A || !A.asked || A.answered || A.repay || game.scene || P.locked || !near(A.q.agent.x, A.q.agent.y, 40)) return null; const has = (PS.items || []).includes(A.good);
      return { type: 'custom', d: 40, x: A.q.agent.x, y: A.q.agent.y - 28, label: has ? `Lend ${A.q.first} the ${A.good}` : `Tell ${A.q.first} you've none to spare`, act: () => { const s = cur(); A.answered = true;
        if (has) { PS.items.splice(PS.items.indexOf(A.good), 1); lent++; owed.push({ s, q: A.q, good: A.good, due: s.day + 1 + Math.floor(Math.random() * 2) }); relOf(A.q).affinity = Math.min(1, relOf(A.q).affinity + 0.1); try { s.remember(A.q, `The stranger next door lent me ${A.good === 'bread' ? 'a loaf' : 'firewood'} when we had none.`, 'kindness', 0.6); } catch (e) { /* */ } O.Speech && O.Speech.say(A.q, 'Bless you. I\'ll bring it back, I promise.', 2.6); }
        else { O.Speech && O.Speech.say(A.q, 'No? Well. I\'ll try elsewhere.', 2.2); } setTimeout(release, 2500); } }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!A || !A.asked || A.answered || A.repay || game.scene || P.locked || !near(A.q.agent.x, A.q.agent.y, 40) || !(PS.items || []).includes(A.good)) return null;
      return { type: 'custom', d: 41, x: A.q.agent.x, y: A.q.agent.y - 40, label: `Turn ${A.q.first} away`, act: () => { const s = cur(); A.answered = true; refused++; relOf(A.q).affinity = Math.max(-1, relOf(A.q).affinity - 0.15); try { s.remember(A.q, `The stranger next door turned me away when I needed ${A.good === 'bread' ? 'bread' : 'firewood'}, and they had plenty.`, 'slight', 0.6); } catch (e) { /* */ } O.Speech && O.Speech.say(A.q, pick(['I see. I won\'t trouble you again.', 'Hm. I\'ll remember that.']), 2.4); setTimeout(release, 2500); } }; });
    O.Borrowing = { get lent() { return lent; }, get refused() { return refused; }, get repaid() { return repaid; }, owed, get ask() { return A; }, soon: () => { last = -99; acc = 2; force = true; } };
  }
  O.BorrowingSetup = { setup };
})();
