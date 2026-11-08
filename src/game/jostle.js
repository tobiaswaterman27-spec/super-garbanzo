// Bumping into people. Run full tilt through a crowd and you'll clip somebody: they stagger, turn and shout
// after you, and now and then what they were carrying goes flying and they have to pick it up, giving you
// a black look. It's remembered, a little. Walk and nobody minds.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const last = new WeakMap(), spill = []; let bumps = 0;
    game.hooks.update.push((dt) => {
      for (const sp of spill.slice()) { sp.t += dt; if (sp.t < 0.4) { sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 200 * dt; } if (sp.t > 3) spill.splice(spill.indexOf(sp), 1); }
      const s = cur(); if (!s || game.scene) return; const P = game.player; if (!P || P.hidden || P.mount) return;
      const running = P.moving && game.keys && game.keys.has && game.keys.has('run'); if (!running) return;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || q.age < 4) continue; if (Math.abs(a.x - P.x) > 11 || Math.abs(a.y - P.y) > 8) continue; const l = last.get(q) || -99; if (game.t - l < 6) continue; last.set(q, game.t); bumps++;
        O.gesture && O.gesture(q, 'hurt', 0.8); setTimeout(() => O.gesture && O.gesture(q, q.age < 12 ? 'shocked' : 'shake', 1.4), 800);
        O.Speech && O.Speech.say(q, q.age < 12 ? pick(['Ow!', 'Hey!']) : pick(['Watch where you\'re going!', 'Oi! Mind yourself!', 'Clumsy oaf!', 'What\'s the hurry?']), 2);
        O.sfx && O.sfx('place', 0.4);
        if ((a.carrying || Math.random() < 0.25) && Math.random() < 0.5) { const c = ['#c83a2a', '#c89a5a', '#6a9a44', '#e8e0c8']; for (let i = 0; i < 4; i++) spill.push({ x: a.x, y: a.y - 12, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 30, t: 0, c: pick(c) }); setTimeout(() => O.gesture && O.gesture(q, 'pickup', 2), 1200); }
        try { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); r.affinity = Math.max(-1, (r.affinity || 0) - 0.02); s.remember(q, 'The stranger came running and barged into me in the street.', 'player', 0.6, -0.05); } catch (e) { /* */ }
        break; }
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; for (const sp of spill) { ctx.fillStyle = sp.c; ctx.fillRect(Math.round(sp.x - cam.x), Math.round(sp.y - cam.y), 2, 2); } });
    O.Jostle = { get bumps() { return bumps; } };
  }
  O.JostleSetup = { setup };
})();
