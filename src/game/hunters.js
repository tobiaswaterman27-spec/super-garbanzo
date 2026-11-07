// Hunters go out and come back. Early in the morning a man takes his bow and walks out of town to
// the woods; he is gone for hours, and in the afternoon he comes back down the track with what he got:
// a brace of rabbits swinging from a stick, a few wood pigeons, or (with a friend to help) a deer on
// his shoulders. Children run to look. The meat goes into his family's larder.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const out = new Map(); // q -> { back: abs minute, bag }
    const abs = (s) => s.day * 1440 + s.minute;
    function woodEdge(s) { const Z = s.Z && s.Z.wood; if (!Z) return null; const w = s.world; for (let r = 0; r < 6; r++) for (const [x, y] of [[Z[0] + r, Z[3] + 1], [Z[2] - r, Z[3] + 1], [Math.floor((Z[0] + Z[2]) / 2), Z[3] + 1 + r]]) if (!w.solid[y * w.W + x]) return [x, y]; return null; }
    const isHunter = (q) => /hunter|gamekeeper|forester|woodsman|poacher|archer/.test(q.job?.role || '') || (q.sex === 'm' && !q.job && q.age >= 18 && q.age <= 55 && (q.id % 4 === 0) && (q.traits || []).some((t) => /patient|risk|brave/.test(t)));
    let tick = 4;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || !O.Errands) return; const h = s.minute / 60;
      // back from the woods
      for (const [q, o] of out) { if (q.alive === false || o.s !== s) { out.delete(q); continue; } if (abs(s) < o.back || q.errand) continue; const edge = woodEdge(s), home = s.building(q.home); out.delete(q); if (!edge || !home || home.doorX == null) { q.agent.hidden = false; q._hunting = null; continue; }
        q.agent.inside = null; q.agent.hidden = false; q.agent.x = edge[0] * T + 8; q.agent.y = edge[1] * T + 10; q._hunting = o.bag;
        O.Errands.send(s, q, [home.doorX, home.doorY + 1], { anim: 'place', secs: 1.4, face: 0, giveUp: game.t + 200, at: () => { const hh = s.household(q); if (hh && o.bag !== 'nothing') { hh.pantry.meat = (hh.pantry.meat || 0) + (o.bag === 'deer' ? 6 : o.bag === 'rabbits' ? 2 : 1); } q._hunting = null; if (near(q.agent.x, q.agent.y, 250)) say(q, o.bag === 'nothing' ? pick(['Not a thing. Not a whisker.', 'Empty-handed. Don\'t ask.']) : pick(['Supper!', 'Venison tonight!', 'Two fat conies.']), 2); } });
        if (o.bag !== 'nothing') setTimeout(() => { for (const k of s.people) if (k.age >= 5 && k.age < 13 && k.agent && !k.agent.hidden && k.agent.inside == null && !k.agent.frozen && !k.errand && Math.hypot(k.agent.x - q.agent.x, k.agent.y - q.agent.y) < 120) { O.gesture && O.gesture(k, 'point', 2); if (Math.random() < 0.4) say(k, o.bag === 'deer' ? 'A deer! He got a deer!' : 'Let me see!', 1.4); } }, 4000); }
      tick -= dt; if (tick > 0) return; tick = 6;
      if (!(h >= 5.5 && h < 8)) return; const edge = woodEdge(s); if (!edge) return;
      const q = s.people.find((x) => isHunter(x) && x.alive !== false && x.agent && !x.errand && !out.has(x) && !x.job?.onShift && (x._huntDay !== s.day) && !x.visitor && !x.jailUntil); if (!q) return; q._huntDay = s.day;
      if (q.agent.inside != null) { const b = s.building(q.agent.inside); if (b && b.doorX != null) { q.agent.x = b.doorX * T + 8; q.agent.y = (b.doorY + 1) * T + 8; } q.agent.inside = null; q.agent.hidden = false; }
      q._hunting = 'out';
      O.Errands.send(s, q, edge, { anim: 'look', secs: 1.5, face: 0, giveUp: game.t + 200, after: () => { const r = Math.random(), bag = r < 0.15 ? 'deer' : r < 0.55 ? 'rabbits' : r < 0.8 ? 'pigeons' : 'nothing'; q.agent.hidden = true; q._hunting = null; out.set(q, { s, back: abs(s) + (7 + Math.random() * 3) * 60, bag }); } });
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      for (const q of s.people) { if (!q._hunting || !q.agent || q.agent.hidden) continue; const a = q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); if (x < -30 || y < -40 || x > ctx.canvas.width + 30 || y > ctx.canvas.height + 30) continue;
        ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x - 4, y - 16, 9, -1.2, 1.2); ctx.stroke(); ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x - 4 + Math.cos(-1.2) * 9, y - 16 + Math.sin(-1.2) * 9); ctx.lineTo(x - 4 + Math.cos(1.2) * 9, y - 16 + Math.sin(1.2) * 9); ctx.stroke();
        if (q._hunting === 'deer') { ctx.fillStyle = '#8a5a34'; ctx.fillRect(x - 10, y - 30, 20, 6); ctx.fillStyle = '#6a4228'; ctx.fillRect(x + 8, y - 34, 4, 5); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 10, y - 38, 1, 4); ctx.fillRect(x + 12, y - 37, 1, 3); ctx.fillRect(x - 10, y - 25, 1, 5); ctx.fillRect(x - 7, y - 25, 1, 5); }
        else if (q._hunting === 'rabbits' || q._hunting === 'pigeons') { ctx.fillStyle = '#5a3d26'; ctx.fillRect(x + 2, y - 26, 12, 1); ctx.fillStyle = q._hunting === 'rabbits' ? '#9a8070' : '#8a8a96'; ctx.fillRect(x + 5, y - 25, 3, 7); ctx.fillRect(x + 10, y - 25, 3, 6); } }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => q._hunting === 'out' ? 'You are off to the woods with your bow to hunt; you want to be there by first light.' : q._hunting && q._hunting !== 'out' ? `You are coming back from a day's hunting with ${q._hunting === 'deer' ? 'a deer across your shoulders' : q._hunting === 'nothing' ? 'nothing to show for it' : 'a brace of ' + q._hunting}.` : '');
    O.Hunters = { out, woodEdge: () => woodEdge(cur()) };
  }
  O.HuntersSetup = { setup };
})();
