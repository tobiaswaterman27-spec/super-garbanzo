// Archers of the watch. One in three of the watch carries a bow on their back. When you're on the run
// and an archer has you at range, they stop, draw and loose: you see the arrow fly. Running makes you
// harder to hit; a hit is a wound that slows you. Missed arrows stick in the ground a while.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const arrows = [], stuck = [];
    const isWatch = (q) => /^guard|sergeant|captain/.test(q.job?.role || '');
    const archer = (q) => !!q._archer;
    let gt = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      // bows on archers' backs
      gt -= dt; if (gt <= 0) { gt = 5; s.people.filter(isWatch).forEach((q, i) => { if (q._archer == null) q._archer = i % 3 === 1; }); for (const q of s.people) if (isWatch(q) && archer(q) && q.app && q.app.outfit && q.app.outfit.backItem !== 'bow') { q.app.outfit.backItem = 'bow'; O.Char.invalidate(q.app); } }
      const P = game.player;
      if (!game.scene && O.Pursuit && O.Pursuit.holding && O.Pursuit.holding()) {
        for (const q of s.people) {
          if (!isWatch(q) || !archer(q) || !q.agent || q.agent.hidden || !q.agent.chasing) continue;
          const d = Math.hypot(P.x - q.agent.x, P.y - q.agent.y); if (d < 70 || d > 240) continue;
          q._bowCd = (q._bowCd || 0) - dt; if (q._bowCd > 0) continue; q._bowCd = 2.6 + Math.random();
          q.agent.dir = O.dirOf(P.x - q.agent.x, P.y - q.agent.y); O.gesture && O.gesture(q, 'point', 0.8); O.sfx && O.sfx('whoosh', 0.5);
          const running = game.keys && game.keys.has('run') && P.moving !== false, hit = Math.random() < (running ? 0.25 : 0.5) * (1 - d / 400) + 0.1;
          const tx = P.x + (hit ? 0 : (Math.random() - 0.5) * 50), ty = P.y - 10 + (hit ? 0 : (Math.random() - 0.5) * 30);
          arrows.push({ x: q.agent.x, y: q.agent.y - 18, tx, ty, t: 0, dur: d / 260, hit });
        }
      }
      for (const a of arrows.slice()) {
        a.t += dt; if (a.t < a.dur) continue; arrows.splice(arrows.indexOf(a), 1);
        if (a.hit && Math.hypot(P.x - a.tx, P.y - 10 - a.ty) < 26) { const dmg = 8 + Math.random() * 7; PS.hp = Math.max(1, PS.hp - dmg * (1 - (O.CombatDeep ? O.CombatDeep.armour() : 0))); (PS.wounds = PS.wounds || []).push({ kind: 'arrow wound', sev: 0.5, day: s.day, part: Math.random() < 0.5 ? 'shoulder' : 'leg' }); O.sfx && O.sfx('smack', 0.7); O.UI.say('An arrow takes you in the ' + PS.wounds[PS.wounds.length - 1].part + '!', 'bad'); P.anim = 'hurt'; P.ft = 0; }
        else stuck.push({ x: a.tx, y: a.ty + 10, t: 0 });
      }
      for (const st of stuck.slice()) { st.t += dt; if (st.t > 40) stuck.splice(stuck.indexOf(st), 1); }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return;
      ctx.save();
      for (const a of arrows) { const k = Math.min(1, a.t / a.dur), x = a.x + (a.tx - a.x) * k, y = a.y + (a.ty - a.y) * k - Math.sin(k * Math.PI) * 14, ang = Math.atan2(a.ty - a.y - Math.cos(k * Math.PI) * 14, a.tx - a.x);
        ctx.translate(Math.round(x - cam.x), Math.round(y - cam.y)); ctx.rotate(ang); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(-6, 0, 10, 1); ctx.fillStyle = '#d8d0c0'; ctx.fillRect(-7, -1, 2, 3); ctx.fillStyle = '#8a8a90'; ctx.fillRect(4, 0, 2, 1); ctx.setTransform(1, 0, 0, 1, 0, 0); }
      for (const st of stuck) { const x = Math.round(st.x - cam.x), y = Math.round(st.y - cam.y); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x, y - 6, 1, 6); ctx.fillStyle = '#d8d0c0'; ctx.fillRect(x - 1, y - 8, 3, 2); }
      ctx.restore();
    });
    O.Archers = { arrows, stuck };
  }
  O.ArchersSetup = { setup };
})();
