// Baking day at the common oven. Few houses have an oven fit for bread, so of a morning the women (and the
// odd man) carry their risen dough on a board to the bakery, hand it in at the door with a word, and come
// back in a while to fetch the loaves, carrying them home warm against the chest. The baker charges a
// loaf in twenty for the oven.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const waiting = []; let cool = 5, trips = 0, home = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const say = (q, t) => q.agent && near(q.agent.x, q.agent.y, 260) && O.Speech && O.Speech.say(q, t, 2.2);
    function bakery(s) { const z = [...s.biz.values()].find((x) => x.type === 'bakery'); const b = z && s.building(z.b?.id ?? z.id); return b && b.doorX != null ? [z, b] : null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      // collecting
      for (const W of waiting.slice()) { if (W.s !== s || W.q.alive === false) { waiting.splice(waiting.indexOf(W), 1); W.q._bake = false; continue; } W.t += dt; const q = W.q;
        if (W.t > W.wait + 120) { waiting.splice(waiting.indexOf(W), 1); continue; }
        if (W.t > W.wait && !q.errand && !q.agent.frozen && !talking(q)) { waiting.splice(waiting.indexOf(W), 1); const [, b] = W.bk; q._bake = true;
          O.Errands.send(s, q, [b.doorX, b.doorY + 1], { anim: 'take', secs: 1.2, face: 3, giveUp: game.t + 60, after: (ok) => { if (!ok) { q._bake = false; return; } say(q, pick(['Smell that!', 'Lovely and brown. Thank you.', 'Burnt the bottoms again, have you?'])); const hb = s.building(q.home); if (!hb || hb.doorX == null) { q._bake = false; return; } O.Errands.send(s, q, [hb.doorX, hb.doorY + 1], { anim: 'place', secs: 1, face: 0, giveUp: game.t + 90, carry: { good: 'bread', qty: 2 }, after: () => { q._bake = false; home++; } }); try { q.agent.carrying = { good: 'bread', qty: 2 }; } catch (e) { /* */ } } }); } }
      cool -= dt; if (cool > 0) return; cool = 10 + Math.random() * 10;
      if (hr < 6.5 || hr > 9.5 || s.weekday === 6) return; const bk = bakery(s); if (!bk) return; const [z, b] = bk;
      const P = game.player, q = s.people.find((x) => x.home && x.age >= 16 && x.age < 70 && x.agent && !x.agent.frozen && !x.errand && !x._bake && !x._bit && !x._scene && !x._door && !talking(x) && ((!x.agent.hidden && x.agent.inside == null) || x.agent.inside === x.home) && x.activity?.act === 'home' && x._baked !== s.day && !waiting.some((w) => w.q === x) && (x.sex === 'f' || Math.random() < 0.15) && (z.workers || []).indexOf(x.id) < 0 && Math.hypot(x.agent.x - P.x, x.agent.y - P.y) < 600);
      if (!q) return; q._bake = true; q._baked = s.day; trips++;
      try { q.agent.carrying = { good: 'dough', qty: 1, board: true }; } catch (e) { /* */ }
      O.Errands.send(s, q, [b.doorX, b.doorY + 1], { anim: 'give', secs: 1.4, face: 3, giveUp: game.t + 80, carry: { good: 'dough', qty: 1, board: true }, after: (ok) => { if (q.agent && q.agent.carrying && q.agent.carrying.board) q.agent.carrying = null; if (!ok) { q._bake = false; return; } say(q, pick(['Two loaves this morning, if you please.', 'Here\'s mine. Don\'t let it catch.', 'Mind it\'s my board you give me back.'])); try { const hh = s.household(q); if (hh && hh.money >= 1) { hh.money -= 1; z.cash = (z.cash || 0) + 1; } } catch (e) { /* */ } q._bake = false; waiting.push({ s, q, bk, t: 0, wait: 40 + Math.random() * 30 }); } });
    });
    // the dough on its board, carried on the shoulder
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || !q._bake || !a.carrying || !a.carrying.board) continue; if (O.occluded && O.occluded(a.x, a.y)) continue; const x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y) - (a.lift || 0) - 34; ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 8, y + 3, 16, 2); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 6, y, 5, 3); ctx.fillRect(x + 1, y, 5, 3); ctx.fillStyle = '#d0c4a4'; ctx.fillRect(x - 6, y + 2, 5, 1); ctx.fillRect(x + 1, y + 2, 5, 1); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => waiting.some((w) => w.q === q) ? 'Your bread is in the baker\'s oven; you will fetch it soon.' : q._bake ? (q.agent && q.agent.carrying && q.agent.carrying.board ? 'You are carrying your dough on a board to the bakery to be baked in the common oven.' : waiting.some((w) => w.q === q) ? 'Your bread is in the baker\'s oven; you will fetch it soon.' : 'You are carrying your fresh-baked loaves home from the bakery.') : '');
    O.Bakehouse = { get trips() { return trips; }, get home() { return home; }, waiting };
  }
  O.BakehouseSetup = { setup };
})();
