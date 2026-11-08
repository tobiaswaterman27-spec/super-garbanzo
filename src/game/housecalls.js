// The physician calls. When someone lies sick at home, by day the physician (or the barber-surgeon, or
// the wise woman) walks round with a bag, knocks, and goes in; neighbours bring broth in a covered bowl.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const visits = new Set(); let tick = 6;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || !O.Errands || game.scene) return; tick -= dt; if (tick > 0) return; tick = 10; const h = s.minute / 60; if (h < 8 || h > 18) return;
      const P = game.player;
      const sick = s.people.filter((q) => q.health && q.health.state === 'ill' && q.alive !== false && q.agent && q.agent.inside != null && q.agent.inside === q.home && s.building(q.home) && s.building(q.home).doorX != null && q._visited !== s.day);
      const q = sick.find((x) => { const b = s.building(x.home); return Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 520; }); if (!q) return; q._visited = s.day; const b = s.building(q.home);
      const doc = s.people.find((x) => /physician|doctor|barber|apothecary|wise woman|herbalist|nurse/.test(x.job?.role || '') && x.alive !== false && x.agent && !x.errand && !x.agent.frozen);
      const nb = s.people.find((x) => x.age >= 25 && x.sex === 'f' && x.household !== q.household && x.alive !== false && x.agent && !x.errand && !x.agent.frozen && !x.job?.onShift && x.rel && (x.rel.get(q.id)?.familiar || 0) > 0.1);
      for (const [who, kind] of [[doc, 'doc'], [nb, 'broth']]) { if (!who) continue; if (who.agent.inside != null) { const ob = s.building(who.agent.inside); if (ob && ob.doorX != null) { who.agent.x = ob.doorX * T + 8; who.agent.y = (ob.doorY + 1) * T + 8; } who.agent.inside = null; who.agent.hidden = false; }
        who._call = kind; visits.add(who);
        O.Errands.send(s, who, [b.doorX, b.doorY + 1], { anim: 'open', secs: 1.2, face: 0, giveUp: game.t + 80, at: () => { if (Math.hypot(who.agent.x - P.x, who.agent.y - P.y) < 260) { O.sfx && O.sfx('door', 0.3); if (Math.random() < 0.5) O.Speech && O.Speech.say(who, kind === 'doc' ? pick(['Let\'s see the patient.', 'Where does it hurt?']) : pick(['I\'ve brought you some broth.', 'How is she?']), 1.8); } }, after: () => { who._call = null; visits.delete(who); who.agent.inside = b.id; who.agent.hidden = true; if (kind === 'doc' && q.health) q.health.illness && (q.health.illness.sev = Math.max(0, q.health.illness.sev - 0.15)); if (kind === 'broth') { q.needs.hunger = Math.min(100, (q.needs.hunger || 50) + 30); s.relate(q, who, 0.08); } } }); }
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; for (const q of visits) { const a = q.agent; if (!a || a.hidden || a.inside != null || (O.occluded && O.occluded(a.x, a.y))) continue; const x = Math.round(a.x - cam.x) + (a.dir === 1 ? -7 : 6), y = Math.round(a.y - cam.y) - 10; if (q._call === 'doc') { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 3, y - 2, 6, 5); ctx.fillStyle = '#5a4030'; ctx.fillRect(x - 1, y - 4, 2, 2); } else { ctx.fillStyle = '#a0603a'; ctx.fillRect(x - 3, y - 1, 6, 3); ctx.fillStyle = '#e8e0cc'; ctx.fillRect(x - 3, y - 2, 6, 1); if (Math.floor(performance.now() / 300) % 2) { ctx.fillStyle = 'rgba(235,235,240,0.5)'; ctx.fillRect(x, y - 5, 1, 2); } } } });
    O.HouseCalls = { visits };
  }
  O.HouseCallsSetup = { setup };
})();
