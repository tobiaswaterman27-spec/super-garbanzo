// Bread and salt. When a house becomes yours, the neighbours notice: the next time you're by it, the goodwife
// from next door comes over with a loaf and a twist of salt (bread so you never go hungry, salt so your life
// has savour), wishes you luck of the place, looks you up and down, and tells you who's who on the street.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const known = new Map(); let H = null, welcomed = 0, acc = 0; const pending = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    function end() { if (!H) return; const q = H.q; q._warm = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } H = null; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return; acc += dt;
      if (H) { H.t += dt; const a = H.q.agent; if (H.s !== s || H.t > 40 || talking(H.q)) { end(); return; } if (!a.frozen) return; a.dir = O.dirOf(game.player.x - a.x, game.player.y - a.y);
        a.forceAnim = H.t < 2 ? 'wave' : H.t < 5 ? 'give' : 'talk';
        if (!H.s1) { H.s1 = true; O.Speech && O.Speech.say(H.q, pick(['Welcome, neighbour! Bread, so you never go hungry, and salt, so life has savour.', 'So you\'re the new one! Here: bread and salt, for luck in the house.']), 4); }
        if (H.t > 4 && !H.gave) { H.gave = true; if (O.Data.GOODS.bread && PS.canCarry('bread')) PS.add('bread'); O.UI && O.UI.say && O.UI.say(`${H.q.first} presses a loaf and a twist of salt into your hands: the old welcome.`, 'good'); const r = H.q.rel.get(0) || { affinity: 0, familiar: 0 }; r.affinity = Math.min(1, r.affinity + 0.1); r.familiar = Math.min(1, (r.familiar || 0) + 0.2); H.q.rel.set(0, r); welcomed++; }
        if (H.t > 7 && !H.s2) { H.s2 = true; const others = s.people.filter((x) => x !== H.q && x.home != null && x.age >= 18 && (() => { const b = s.building(x.home); return b && b.doorX != null && Math.hypot(b.doorX - H.b.doorX, b.doorY - H.b.doorY) < 12; })()); const o = others[0];
          O.Speech && O.Speech.say(H.q, o ? pick([`That's ${o.first}'s place along there. ${o.traits && o.traits.includes('greedy') ? 'Mind your purse with that one.' : 'Good sort, mostly.'}`, `You'll meet ${o.first} soon enough. Keeps to themselves.`]) : 'It\'s a quiet street. You\'ll like it.', 3.6); }
        if (H.t > 12) end(); return; }
      if (acc < 1) return; acc = 0; const id = s.world.placeId;
      // notice houses newly yours
      const mine = s.world.buildings.filter((b) => b.owner && b.owner.kind === 'player' && b.doorX != null); if (!known.has(id)) { known.set(id, new Set(mine.map((b) => b.id))); return; } const k = known.get(id);
      for (const b of mine) if (!k.has(b.id)) { k.add(b.id); pending.push({ s, b, day: s.day }); }
      const P0 = pending.find((p) => p.s === s && near(p.b.doorX * T, p.b.doorY * T, 200)); if (!P0) return; const hr = s.minute / 60; if (hr < 8 || hr > 20 || game.scene) return;
      // the nearest neighbour's household comes over
      const nb = s.people.filter((q) => q.alive !== false && q.age >= 18 && q.agent && !q.agent.frozen && !q.errand && !talking(q) && q.home != null && q.home !== P0.b.id).map((q) => { const hb = s.building(q.home); return [q, hb && hb.doorX != null ? Math.hypot(hb.doorX - P0.b.doorX, hb.doorY - P0.b.doorY) : 999]; }).filter(([, d]) => d < 20).sort((a, b) => a[1] - b[1] || (a[0].sex === 'f' ? -1 : 1))[0]; if (!nb) return;
      pending.splice(pending.indexOf(P0), 1); const q = nb[0], a = q.agent; q._warm = true; if (a.inside != null) { const hb = s.building(a.inside); if (hb && hb.doorX != null) { a.x = hb.doorX * T + 8; a.y = (hb.doorY + 1) * T + 8; } a.inside = null; a.hidden = false; }
      H = { s, b: P0.b, q, t: -99 }; O.Errands.send(s, q, [Math.floor(game.player.x / T) + 1, Math.floor(game.player.y / T)], { anim: 'idle', secs: 0.1, face: 0, giveUp: game.t + 40, carry: { good: 'bread', qty: 1 }, after: (ok) => { if (!H || H.q !== q) return; if (!ok) { end(); return; } a.frozen = true; a.path = null; H.t = 0; } }); });
    (O.extraLines = O.extraLines || []).push((s, q) => H && H.q === q ? 'The stranger has just taken the house near yours, and you have come round with bread and salt to welcome them, and to get a look at them.' : '');
    O.HouseWarm = { get welcomed() { return welcomed; }, pending };
  }
  O.HouseWarmSetup = { setup };
})();
