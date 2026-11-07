// Taken in. Whoever the watch arrest doesn't stroll to the gaol on their own: a guard walks at their
// shoulder with a hand on the rope that ties their wrists, all the way to the gaol door. People stop to
// look, shake their heads, point; children follow a little way; the prisoner's family come to the door.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const isWatch = (q) => /guard|sergeant|watch|captain|constable|gaoler/.test(q.job?.role || '');
    const near = (q, r) => Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < r;
    const pairs = new Map(); let scan = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || game.scene) return;
      for (const [q, g] of pairs) { const a = q.agent, ga = g.agent;
        const done = q.alive === false || a.hidden || a.inside != null || !(q.task && q.task.act === 'jailed') || g.alive === false || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === g);
        if (done) { g._escort = null; ga.frozen = false; ga.forceAnim = null; pairs.delete(q); continue; }
        const dir = O.Char.DIRV ? (O.Char.DIRV[a.dir] || [0, 1]) : [0, 1]; const tx = a.x - dir[0] * 10 + 4, ty = a.y - dir[1] * 6 + 1;
        const dx = tx - ga.x, dy = ty - ga.y, d = Math.hypot(dx, dy); if (d > 1) { const st = Math.min(d, (d > 30 ? 120 : 60) * dt); ga.x += dx / d * st; ga.y += dy / d * st; } ga.dir = a.dir; ga.forceAnim = a.path ? 'walk' : 'idle';
        if (Math.random() < dt * 0.6) for (const o of s.people) { if (o === q || o === g || !o.agent || o.agent.hidden || o.agent.inside != null || o.agent.frozen || o._sawTaken === q || Math.hypot(o.agent.x - a.x, o.agent.y - a.y) > 70) continue; o._sawTaken = q; const fam = o.household === q.household; O.gesture && O.gesture(o, fam ? 'mourn' : o.age < 12 ? 'point' : pick(['shake', 'look', 'point']), 2); if (fam && Math.random() < 0.6) O.Speech && O.Speech.say(o, pick([`${q.first}! What have you done?`, 'No! Not my boy!', 'I told you this would happen.']), 2); else if (Math.random() < 0.12) O.Speech && O.Speech.say(o, pick(['Serves them right.', 'Poor soul.', 'Who\'s that they\'ve got?']), 1.6); } }
      scan -= dt; if (scan > 0) return; scan = 0.6;
      for (const q of s.people) { if (pairs.has(q) || !(q.task && q.task.act === 'jailed') || !q.agent || q.agent.hidden || q.agent.inside != null || !near(q, 450)) continue;
        const g = s.people.filter((x) => isWatch(x) && x.alive !== false && x.agent && !x.agent.hidden && x.agent.inside == null && !x._escort && !x._fighting && !x.errand && !x.agent.frozen).sort((a, b) => Math.hypot(a.agent.x - q.agent.x, a.agent.y - q.agent.y) - Math.hypot(b.agent.x - q.agent.x, b.agent.y - q.agent.y))[0];
        if (!g || Math.hypot(g.agent.x - q.agent.x, g.agent.y - q.agent.y) > 300) continue; g._escort = q; g.agent.frozen = true; g.agent.path = null; pairs.set(q, g);
        if (Math.random() < 0.6) O.Speech && O.Speech.say(g, pick(['Come along. No trouble now.', 'Walk on. The gaoler\'s waiting.', 'Keep moving.']), 1.8); }
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; for (const [q, g] of pairs) { const a = q.agent, ga = g.agent; if (a.hidden) continue; const x1 = Math.round(a.x - cam.x), y1 = Math.round(a.y - cam.y) - 12, x2 = Math.round(ga.x - cam.x) + (ga.dir === 1 ? -5 : 5), y2 = Math.round(ga.y - cam.y) - 12; ctx.strokeStyle = '#a89060'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + 5, x2, y2); ctx.stroke(); ctx.fillStyle = '#a89060'; ctx.fillRect(x1 - 2, y1 - 1, 4, 2); } });
    O.Escort = { pairs };
  }
  O.EscortSetup = { setup };
})();
