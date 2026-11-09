// A lost child. Now and then a little one wanders off while nobody is looking and ends up sitting somewhere
// strange, crying. Soon the mother (or father) is out of the door calling the child's name up and down the
// lane, asking neighbours, looking behind carts and down by the water; when she finds the child she runs to
// them, sweeps them up and scolds and hugs in the same breath, and leads them home by the hand.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let L = null, cool = 60, found = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._lost && !q._bit && !q._scene && !talking(q);
    const name = (q) => q.first || (q.name || '').split(' ')[0] || 'child';
    function release(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._lost = false; }
    function end() { if (!L) return; release(L.kid); release(L.ma); L = null; }
    function spotNear(s, tx, ty, r0, r1) { const w = s.world; for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, r = r0 + Math.random() * (r1 - r0), x = Math.round(tx + Math.cos(a) * r), y = Math.round(ty + Math.sin(a) * r); if (x < 2 || y < 2 || x >= w.W - 2 || y >= w.H - 2) continue; const i = y * w.W + x; if (w.solid[i] || w.ter[i] === w.TER.WATER) continue; return [x, y]; } return null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (L) { L.t += dt; if (L.s !== s || L.t > 200 || talking(L.kid) || talking(L.ma) || L.kid.alive === false || L.ma.alive === false) { end(); return; }
        const k = L.kid.agent, m = L.ma.agent;
        if (L.phase === 'lost') { k.forceAnim = Math.floor(L.t * 0.7) % 3 ? 'mourn' : 'look'; if (!L.cried && near(k.x, k.y, 260)) { L.cried = true; O.Speech && O.Speech.say(L.kid, pick(['Mama? MAMA?', 'I want to go home...', 'Where is everybody?']), 2.4); }
          if (!L.searching && L.t > 6) { L.searching = true; L.hops = 0; hop(); } }
        if (L.phase === 'found') { L.ft += dt; m.forceAnim = L.ft < 2.5 ? 'take' : L.ft < 5 ? 'shake' : 'idle'; k.forceAnim = L.ft < 2.5 ? 'idle' : L.ft < 5 ? 'mourn' : 'nod'; m.dir = m.x < k.x ? 2 : 1; k.dir = m.x < k.x ? 1 : 2;
          if (L.ft > 6.5) { const h = L.home; const kid = L.kid, ma = L.ma; found++; end(); if (h && h.doorX != null) { O.Errands.send(s, ma, [h.doorX, h.doorY + 1], { anim: 'idle', secs: 0.3, face: 0, giveUp: game.t + 80 }); setTimeout(() => O.Errands.send(s, kid, [h.doorX, h.doorY + 1], { anim: 'idle', secs: 0.3, face: 0, giveUp: game.t + 80 }), 300); } } }
        return;
        function hop() { // the mother looks here and there, closer each time, calling out
          if (!L) return; const kt = [Math.floor(k.x / T), Math.floor(k.y / T)]; L.hops++;
          const tgt = L.hops >= 3 ? [kt[0] + (Math.random() < 0.5 ? -1 : 1), kt[1]] : spotNear(s, kt[0], kt[1], 9 - L.hops * 3, 13 - L.hops * 3) || kt;
          O.Errands.send(s, L.ma, tgt, { anim: L.hops >= 3 ? 'idle' : 'look', secs: L.hops >= 3 ? 0.1 : 2.2, face: 0, sprint: L.hops >= 3, giveUp: game.t + 60, after: (ok) => { if (!L) return; if (L.hops >= 3) { if (!ok && Math.hypot(m.x - k.x, m.y - k.y) > 40) { end(); return; } m.frozen = true; m.path = null; L.phase = 'found'; L.ft = 0; if (near(m.x, m.y, 300)) { O.Speech && O.Speech.say(L.ma, pick([`${name(L.kid)}! Oh, ${name(L.kid)}, thank God!`, `There you are! You frightened the life out of me!`, `What did I tell you about wandering off?`]), 3); setTimeout(() => L && near(m.x, m.y, 300) && O.Speech && O.Speech.say(L.ma, pick(['Never, ever do that again. Come here.', 'Home. Now. And no supper for a bad child... oh, come here.', 'You\'ll be the death of me.']), 2.6), 3000); } return; }
            if (near(m.x, m.y, 320)) O.Speech && O.Speech.say(L.ma, pick([`${name(L.kid)}! ${name(L.kid).toUpperCase()}!`, `Has anyone seen my ${L.kid.sex === 'f' ? 'girl' : 'boy'}?`, `${name(L.kid)}, where are you? Answer me!`, `Have you seen a little ${L.kid.sex === 'f' ? 'girl' : 'lad'}, this high?`]), 2.6);
            const by = s.people.find((q) => q !== L.ma && q !== L.kid && q.agent && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - m.x, q.agent.y - m.y) < 60); if (by && Math.random() < 0.6) setTimeout(() => L && near(m.x, m.y, 320) && O.Speech && O.Speech.say(by, pick(['Not I. Try down by the water.', 'I saw a little one go that way.', 'Lord, no. I\'ll keep an eye out.']), 2.4), 1600);
            setTimeout(hop, 600); } }); }
      }
      cool -= dt; if (cool > 0) return; cool = 240 + Math.random() * 240; if (hr < 9 || hr > 17) return;
      const P = game.player, kids = s.people.filter((q) => able(q) && q.age >= 3 && q.age <= 7 && !q.agent.hidden && q.agent.inside == null && near(q.agent.x, q.agent.y, 380) && !(q.agent.carrying === 'babe'));
      for (const kid of kids) { const hh = s.household(kid); if (!hh) continue; const ma = hh.members.map((id) => s.byId.get(id)).filter((q) => q && q !== kid && q.age >= 18 && able(q)).sort((a, b) => (a.sex === 'f' ? 0 : 1) - (b.sex === 'f' ? 0 : 1))[0]; if (!ma) continue; const home = s.building(hh.home ?? kid.home); if (!home || home.doorX == null) continue;
        const sp = spotNear(s, Math.floor(kid.agent.x / T), Math.floor(kid.agent.y / T), 10, 15); if (!sp) continue;
        kid._lost = true; ma._lost = true; L = { s, kid, ma, home, t: 0, phase: 'wander' };
        O.Errands.send(s, kid, sp, { anim: 'idle', secs: 0.1, face: 0, giveUp: game.t + 50, after: (ok) => { if (!L || L.kid !== kid) return; if (!ok) { end(); return; } kid.agent.frozen = true; kid.agent.path = null; L.phase = 'lost'; L.t = 0;
          // the mother comes out of doors
          const a = ma.agent; if (a.inside != null) { a.inside = null; a.hidden = false; a.x = home.doorX * T + 8; a.y = (home.doorY + 1) * T + 8; } } });
        break; }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => !L || !q._lost ? '' : q === L.kid ? 'You are small and you wandered off and now you are lost and frightened, and you want your mother.' : `Your little ${L.kid.sex === 'f' ? 'girl' : 'boy'} ${name(L.kid)} has wandered off and you are frantic, searching the lanes and calling for ${L.kid.sex === 'f' ? 'her' : 'him'}.`);
    O.LostChild = { get lost() { return L; }, get found() { return found; }, soon: () => { cool = 0; } };
  }
  O.LostChildSetup = { setup };
})();
