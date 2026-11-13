// Money changes hands, in hands. Whenever your purse goes up or down while you're dealing with someone
// (wages counted out of the till, rent into the landlord's palm, the price of a loaf over the counter, a
// coin to a beggar), the coins pass between you: one holds them out, the other takes them, and they chink.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    let last = null, passes = 0;
    function party(s) { const P = game.player; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq && tq.alive !== false) return tq;
      const sc = game.scene; let best = null, bd = 56;
      for (const q of s.people) { if (q.alive === false || !q.agent) continue; let pos; if (sc) { if (q.agent.inside !== sc.b.id) continue; pos = sc.personPos && sc.personPos(q); } else { if (q.agent.hidden || q.agent.inside != null) continue; pos = [q.agent.x, q.agent.y]; } if (!pos) continue; const d = Math.hypot(pos[0] - P.x, pos[1] - P.y); if (d < bd) { bd = d; best = q; } }
      return best; }
    let lastItems = null, goods = 0;
    game.hooks.update.unshift(() => { const m = PS.money || 0, its = (PS.items || []).slice(); if (last == null) { last = m; lastItems = its; return; }
      const gained = its.length > lastItems.length ? (() => { const c = {}; for (const k of lastItems) c[k] = (c[k] || 0) + 1; return its.filter((k) => { if (c[k]) { c[k]--; return false; } return true; }); })() : []; lastItems = its;
      if (m === last) return; const d = m - last; last = m; if (Math.abs(d) < 1 || O._handingUntil > performance.now()) return;
      const s = cur(); if (!s || !O.NpcActs || !O.NpcActs.fly) return; const q = party(s); if (!q) return; passes++;
      try { if (d < 0) { O.NpcActs.fly('player', q, 'coin'); if (gained.length) { goods++; const g = gained[0]; setTimeout(() => { try { O.NpcActs.fly(q, 'player', g); } catch (e) { /* */ } }, 1500); } } else O.NpcActs.fly(q, 'player', 'coin'); } catch (e) { /* */ } });
    O.CoinFlow = { get passes() { return passes; }, get goods() { return goods; } };
  }
  O.CoinFlowSetup = { setup };
})();
