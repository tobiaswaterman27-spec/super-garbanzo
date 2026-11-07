// Children have their jobs too, and their mothers. Of a morning and late afternoon the bigger ones are
// sent to the well with the bucket and come back with it slopping; and at supper time a mother or
// father comes to the door and bawls a child's name down the street, and the child leaves off
// whatever game it was and runs home (sometimes with a "Coming!", sometimes only when called twice).
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2);
    const near = (q, r) => Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < r;
    const nearProp = (w, kinds, x, y) => { let best = null, bd = 1e9; for (const pr of w.props) if (kinds.includes(pr.kind)) { const d = Math.hypot(pr.x - x, pr.y - y); if (d < bd) { bd = d; best = pr; } } return bd < 900 ? best : null; };
    const besides = (w, pr) => { const tx = Math.floor(pr.x / T), ty = Math.floor((pr.y - 1) / T); for (const [dx, dy] of [[0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0], [0, 2]]) { const X = tx + dx, Y = ty + dy; if (!w.solid[Y * w.W + X]) return [X, Y]; } return null; };
    const freeKid = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._scene && !q._playing && !q._bit && !q._pass && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    let wt = 6, st = 5; const called = new Map();
    game.hooks.update.push((dt) => {
      const s = cur(), w = game.world; if (!s || !w || s.world !== w || !O.Errands) return; const h = s.minute / 60;
      // water
      wt -= dt; if (wt <= 0) { wt = 5;
        if (((h >= 7 && h < 9.5) || (h >= 16 && h < 17.5)) && [...O.Errands.live].filter((q) => q.errand && q.errand.kidfetch).length < 2) {
          const kids = s.people.filter((q) => q.age >= 8 && q.age <= 13 && freeKid(q) && near(q, 450) && (q._water || -1) !== s.day * 2 + (h > 12 ? 1 : 0) && q.home != null);
          const q = pick(kids); if (q && Math.random() < 0.6) { const b = s.building(q.home); const src = b && b.doorX != null && nearProp(w, ['well'], b.doorX * T, b.doorY * T); const at = src && besides(w, src);
            if (at) { q._water = s.day * 2 + (h > 12 ? 1 : 0); const home = [b.doorX, b.doorY + 1];
              O.Errands.send(s, q, at, { kidfetch: true, anim: 'crouch', secs: 2.6, face: 0, giveUp: game.t + 80, at: () => { if (near(q, 200)) O.sfx && O.sfx('splash', 0.4, false); },
                after: (ok) => { if (!ok) return; if (Math.random() < 0.3) say(q, pick(['It\'s heavy!', 'Slopping it everywhere...', 'Mam said to the top.'])); O.Errands.send(s, q, home, { kidfetch: true, anim: 'place', secs: 1.2, face: 0, giveUp: game.t + 90, carry: { good: 'water', qty: 1 }, after: (ok2) => { if (ok2) { const hh = s.household(q); if (hh) hh._water = s.day; } } }); } }); } } } }
      // supper
      st -= dt; if (st > 0) return; st = 3;
      if (h < 17.6 || h > 18.6) return;
      for (const q of s.people) {
        if (q.age < 4 || q.age > 12 || q.alive === false || !q.agent || q.agent.hidden || q.agent.inside != null || q.home == null || !near(q, 380)) continue;
        if (called.get(q.id) === s.day) continue; const hh = s.household(q); if (!hh) continue;
        const b = s.building(q.home); if (!b || b.doorX == null || Math.hypot(b.doorX * T - q.agent.x, b.doorY * T - q.agent.y) < 40) continue;
        const par = (hh.members || []).map((id) => s.byId.get(id)).find((m) => m && m.age >= 18 && m.alive !== false && m.agent && (m.agent.inside === q.home || (m.agent.inside == null && !m.agent.hidden && Math.hypot(m.agent.x - b.doorX * T, m.agent.y - b.doorY * T) < 60)) && !m.errand && !m.agent.frozen && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === m));
        if (!par || Math.random() < 0.5) continue; called.set(q.id, s.day);
        O.Errands.send(s, par, [b.doorX, b.doorY + 1], { anim: 'point', secs: 3.2, face: 0, giveUp: game.t + 30, at: () => { const loud = q.first.toUpperCase(); say(par, pick([`${loud}! SUPPER!`, `${q.first}! In! Now!`, `${loud}! Your supper's on the table!`, `${q.first}! Don't make me come and get you!`]), 2.6);
          const twice = Math.random() < 0.3;
          setTimeout(() => { if (!q.agent || q.agent.hidden || q.alive === false) return; if (twice) { say(q, pick(['Just one more go!', 'Aww...']), 1.6); setTimeout(() => { say(par, `${q.first}! I won't say it again!`, 2); setTimeout(() => goHome(s, q, b), 1200); }, 2600); } else { say(q, pick(['Coming!', 'Coming, Mam!', 'All right!']), 1.4); goHome(s, q, b); } }, 1200); } });
        break;
      }
    });
    function goHome(s, q, b) { if (q._playing && O.KidsPlay) { const g = O.KidsPlay.games.find((g) => (g.kids || []).includes(q)); if (g) g.over = true; } if (q._bit) q._bit.t = 1e9; setTimeout(() => { if (q.errand || q.alive === false) return; q._playing = false; q.agent.frozen = false; q.agent.lift = 0; O.Errands.send(s, q, [b.doorX, b.doorY + 1], { anim: 'idle', secs: 0.3, face: 0, giveUp: game.t + 60, sprint: true, after: () => { if (q.agent && b) { q.agent.inside = b.id; q.agent.hidden = true; } } }); }, 120); }
    O.KidsChores = { called };
  }
  O.KidsChoresSetup = { setup };
})();
