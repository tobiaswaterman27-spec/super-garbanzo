// The dead are visited. On a Sunday afternoon (and now and then of an evening) a widow, a son or a mother
// goes out to the chapel yard to the grave of their own, kneels there a while with bowed head, and leaves
// a posy of flowers on it that lies there some days, wilting; and someone old and pious pulls the weeds
// from the graves that nobody comes to any more.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const mem = new WeakMap(), M = (o) => { let m = mem.get(o); if (!m) mem.set(o, (m = {})); return m; };
    const visits = []; let cool = 10, laid = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._grave && !talking(q) && ((!q.agent.hidden && q.agent.inside == null) || q.agent.inside === q.home) && ['home', 'stroll', 'idle', 'rest', 'socialise', 'pastime-none', 'pastime', 'mourn'].includes(q.activity?.act);
    const kinOf = (s, id) => s.people.filter((q) => q.alive !== false && (q.spouse === id || (q.children || []).includes(id) || q.mother === id || q.father === id || (q.parents || []).includes(id) || (q.widowOf === id)));
    function release(V) { const a = V.q.agent; if (a) { a.forceAnim = null; if (!talking(V.q)) a.frozen = false; } V.q._grave = false; visits.splice(visits.indexOf(V), 1); }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return;
      for (const V of visits.slice()) { V.t += dt; const a = V.q.agent; if (V.s !== s || !a || V.t > V.len || talking(V.q) || V.q.alive === false) { release(V); continue; }
        if (V.kind === 'kin') { a.forceAnim = V.t < 3 ? 'place' : V.t > V.len - 3 ? 'idle' : (Math.floor(V.t / 8) % 3 === 2 ? 'mourn' : 'pray'); if (V.t > 2.5 && !V.posy) { V.posy = true; M(V.g).posy = s.day; laid++; } if (!V.said && V.t > 10 && near(a.x, a.y, 200)) { V.said = true; O.Speech && O.Speech.say(V.q, pick(['I brought you primroses.', 'The children are well. They miss you.', 'Rest easy.', 'Not a day goes by...']), 3); } }
        else { a.forceAnim = Math.floor(V.t / 3) % 2 ? 'crouch' : 'pickup'; } }
      cool -= dt; if (cool > 0) return; cool = 15 + Math.random() * 15;
      const hr = s.minute / 60, sunday = s.weekday === 6; if (s.raining || hr < 9 || hr > 19 || (!sunday && Math.random() < 0.7) || (sunday && hr < 12.5) || visits.filter((v) => v.s === s).length >= 3) return;
      const graves = (s.world.props || []).filter((p) => p.kind === 'gravestone' && !visits.some((v) => v.g === p)); if (!graves.length) return;
      const g = pick(graves), id = g.seed, kin = typeof id === 'number' ? kinOf(s, id).filter(free) : [];
      let q = kin.length ? pick(kin) : null, kind = 'kin';
      if (!q) { kind = 'tend'; q = s.people.find((x) => free(x) && x.age >= 55 && (x.traits || []).some((t) => /pious|kind|gentle/.test(t))); if (!q || Math.random() < 0.5) return; }
      q._grave = true; const tx = Math.floor(g.x / 16), ty = Math.floor(g.y / 16) + 1;
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.2, face: 3, giveUp: game.t + 80, after: (ok) => { if (!ok || !q.agent) { q._grave = false; return; } q.agent.frozen = true; q.agent.path = null; q.agent.dir = 3; visits.push({ s, q, g, kind, t: 0, len: kind === 'kin' ? 35 + Math.random() * 25 : 30 }); } });
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      for (const g of s.world.props || []) { if (g.kind !== 'gravestone') continue; const m = mem.get(g); if (!m || m.posy == null) continue; const age = s.day - m.posy; if (age > 5) continue; const x = Math.round(g.x - cam.x), y = Math.round(g.y + 2 - cam.y); if (x < -20 || y < -20 || x > ctx.canvas.width + 20 || y > ctx.canvas.height + 20) continue; const wilt = age >= 3;
        ctx.fillStyle = wilt ? '#6a7a3a' : '#4a8a3a'; ctx.fillRect(x - 2, y - 1, 5, 1); ctx.fillStyle = wilt ? '#a89070' : '#e8d040'; ctx.fillRect(x - 3, y - 3, 2, 2); ctx.fillStyle = wilt ? '#9a7a6a' : '#e86a8a'; ctx.fillRect(x, y - 3, 2, 2); ctx.fillStyle = wilt ? '#a89878' : '#f4f0e8'; ctx.fillRect(x + 2, y - 2, 2, 2); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const V = visits.find((v) => v.q === q); if (!V) return ''; return V.kind === 'kin' ? `You are kneeling at the grave of ${V.g.grave && V.g.grave.name ? V.g.grave.name : 'one of your own'} in the chapel yard, and have laid flowers on it.` : 'You are pulling the weeds from the old graves nobody visits any more.'; });
    O.GraveVisits = { visits, get laid() { return laid; }, soon: () => { cool = 0; } };
  }
  O.GraveVisitsSetup = { setup };
})();
