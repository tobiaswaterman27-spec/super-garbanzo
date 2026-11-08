// Morning rounds. Early, the baker's boy goes from door to door with a board of loaves on his head,
// knocking, handing one in, the board lighter at each house; the milkmaid comes in from the farm with a
// yoke on her shoulders and a pail swinging at each end, ladling milk into the jugs held out at doors.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t) => O.Speech && O.Speech.say(q, t, 1.6);
    const runs = []; let tick = 5;
    function round(s, q, kind) {
      const houses = s.world.buildings.filter((b) => b.type === 'house' && b.household && b.doorX != null).sort((a, b) => Math.hypot(a.doorX * T - q.agent.x, a.doorY * T - q.agent.y) - Math.hypot(b.doorX * T - q.agent.x, b.doorY * T - q.agent.y)).slice(0, 4);
      if (houses.length < 2) return; const r = { q, kind, left: houses.length, s }; runs.push(r); q._round = r;
      if (q.agent.inside != null) { const b = s.building(q.agent.inside); if (b && b.doorX != null) { q.agent.x = b.doorX * T + 8; q.agent.y = (b.doorY + 1) * T + 8; } q.agent.inside = null; q.agent.hidden = false; }
      const next = (i) => { if (i >= houses.length || q.alive === false) { r.left = 0; q._round = null; runs.splice(runs.indexOf(r), 1); return; } const b = houses[i];
        O.Errands.send(s, q, [b.doorX, b.doorY + 1], { anim: kind === 'milk' ? 'pour' : 'give', secs: 2, face: 0, giveUp: game.t + 60, at: () => { r.left--; if (Math.random() < 0.35) say(q, kind === 'milk' ? pick(['Milk! Fresh milk!', 'Morning! Your jug, mistress?']) : pick(['Bread! Hot bread!', 'Your loaf, mistress.', 'Baker\'s here!'])); const hh = s.households.find((h) => h.home === b.id); if (hh && kind === 'bread') hh.pantry.bread = (hh.pantry.bread || 0) + 1; if (Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 220) O.sfx && O.sfx('door', 0.2); }, after: () => next(i + 1) }); };
      next(0);
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || !O.Errands || game.scene) return; tick -= dt; if (tick > 0) return; tick = 8; const h = s.minute / 60;
      if (h < 6.5 || h > 8.5 || runs.length >= 2) return; const P = game.player;
      if (!runs.some((r) => r.kind === 'bread') && (s._breadRound !== s.day)) { const bk = [...s.biz.values()].find((z) => z.type === 'bakery'); const q = bk && (bk.workers || []).map((i) => s.byId.get(i)).filter((q) => q && q.alive !== false && q.agent && !q.errand).sort((a, b) => a.age - b.age)[0]; if (q && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 700) { s._breadRound = s.day; round(s, q, 'bread'); } }
      if (!runs.some((r) => r.kind === 'milk') && (s._milkRound !== s.day)) { const q = s.people.find((x) => x.sex === 'f' && x.age >= 14 && x.age <= 40 && x.alive !== false && x.agent && !x.errand && /dairy|farm|milk/.test(x.job?.role || '')) || s.people.find((x) => x.sex === 'f' && x.age >= 14 && x.age <= 30 && !x.job && !x.visitor && x.alive !== false && x.agent && !x.errand); if (q && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 900) { s._milkRound = s.day; round(s, q, 'milk'); } }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return;
      for (const r of runs) { const a = r.q.agent; if (!a || a.hidden || a.inside != null || (O.occluded && O.occluded(a.x, a.y))) continue; const x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y), head = r.q.age < 16 ? 24 : 29;
        if (r.kind === 'bread') { ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 8, y - head - 2, 16, 2); for (let i = 0; i < Math.max(1, r.left * 2); i++) { ctx.fillStyle = '#c08a40'; ctx.fillRect(x - 7 + (i % 4) * 4, y - head - 5 - Math.floor(i / 4) * 2, 3, 3); ctx.fillStyle = '#e0b060'; ctx.fillRect(x - 6 + (i % 4) * 4, y - head - 5, 1, 1); } }
        else { const sw = Math.round(Math.sin(performance.now() / 180) * 1); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 11, y - 22, 22, 2); ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x - 10, y - 21); ctx.lineTo(x - 10 + sw, y - 12); ctx.moveTo(x + 10, y - 21); ctx.lineTo(x + 10 + sw, y - 12); ctx.stroke(); for (const sx of [-10, 10]) { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x + sx + sw - 3, y - 12, 6, 6); ctx.fillStyle = '#f0f0f4'; ctx.fillRect(x + sx + sw - 2, y - 12, 4, 1); } } }
    });
    O.Rounds = { runs, start: (kind) => { const s = cur(); if (kind === 'bread') { const bk = [...s.biz.values()].find((z) => z.type === 'bakery'); const q = bk && (bk.workers || []).map((i) => s.byId.get(i)).find((q) => q && q.agent && !q.errand); if (q) round(s, q, 'bread'); return q ? q.first : null; } const q = s.people.find((x) => x.sex === 'f' && x.age >= 14 && x.age <= 30 && x.agent && !x.errand && !x.visitor); if (q) round(s, q, 'milk'); return q ? q.first : null; } };
  }
  O.RoundsSetup = { setup };
})();
