// The goose girl. Now and then a girl comes down the road driving a flock of geese before her with a long
// willow switch: a white jostling crowd of them, necks out, honking and waddling, the switch tapping the
// stragglers back in. Folk give them room, for geese are bad-tempered: get too close and they come at
// you hissing with their wings half up, and the girl laughs.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let G = null, cool = 90, passed = 0, hissed = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function roadRow(s) { const w = s.world, P = game.player, ty0 = Math.floor(P.y / T); for (let d = 0; d < 10; d++) for (const ty of [ty0 + d, ty0 - d]) { if (ty < 2 || ty >= w.H - 2) continue; let run = 0; const x0 = Math.floor(P.x / T) - 20; for (let tx = x0; tx < x0 + 40; tx++) { const i = ty * w.W + tx; const t = w.ter[i]; if ((t === w.TER.ROAD || t === w.TER.COBBLE || t === w.TER.BRIDGE) && !w.solid[i]) run++; } if (run >= 24) return ty; } return null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60, P = game.player;
      if (G) { G.t += dt; if (G.s !== s || (Math.abs(G.x - P.x) > 480 && G.t > 6)) { G = null; passed++; return; } G.x += G.dir * 14 * dt;
        for (const g of G.geese) { g.ph += dt * (3 + g.k); const hx = G.x + G.dir * (18 + g.ox), hy = G.y + g.oy; if (g.chase > 0) { g.chase -= dt; const dx = P.x - g.x, dy = P.y - g.y, d = Math.hypot(dx, dy); if (d > 6) { g.x += dx / d * 40 * dt; g.y += dy / d * 30 * dt; } g.dir = dx > 0 ? 1 : -1; }
          else { g.x += (hx - g.x) * Math.min(1, dt * 2) + Math.sin(g.ph) * 0.2; g.y += (hy - g.y) * Math.min(1, dt * 2); g.dir = G.dir; }
          // too near and they come at you
          if (!g.chase && Math.hypot(P.x - g.x, P.y - g.y) < 26 && Math.random() < dt * 3) { g.chase = 1.6; hissed++; if (near(g.x, g.y, 200)) { O.sfx && O.sfx('hiss', 0.3); if (!G.laughed) { G.laughed = true; O.Speech && O.Speech.say(G.girl, pick(['Ha! Mind them, they bite!', 'Shoo, Gander, leave the poor soul be!', 'They don\'t like strangers!']), 2.2); } } } }
        // the flock honks; passers step out of the way
        if (Math.random() < dt * 0.8 && near(G.x, G.y, 300)) O.sfx && O.sfx('honk', 0.12);
        for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen) continue; if (Math.abs(a.y - G.y) < 12 && Math.abs(a.x - (G.x + G.dir * 22)) < 22) a.y += (a.y < G.y ? -1 : 1) * 36 * dt; }
        if (!G.said && G.t > 3 && near(G.x, G.y, 260)) { G.said = true; O.Speech && O.Speech.say(G.girl, pick(['Hup, hup, geese! On you go!', 'To market, my beauties.', 'Get back in, you! Back in!']), 2.2); }
        return; }
      cool -= dt; if (cool > 0) return; cool = 160 + Math.random() * 160; if (hr < 7 || hr > 17 || (game.isNight && game.isNight())) return;
      const ty = roadRow(s); if (ty == null) return; const dir = Math.random() < 0.5 ? 1 : -1, R = O.RNG(O.hash('goose', s.day, ty));
      const app = O.Char.makeAppearance(O.hash('goosegirl', s.day), { sex: 'f', age: 11 + Math.floor(R.next() * 6), genes: O.Char.randomGenes(R, 'north'), role: 'farmhand', wealth: 0.2 });
      const x = P.x - dir * 400, y = ty * T + 12, geese = []; for (let i = 0; i < 7; i++) geese.push({ ox: (i % 3) * 8 + R.next() * 4, oy: (Math.floor(i / 3) - 1) * 5 + R.next() * 3, x: x + dir * 18, y, ph: R.next() * 6, k: R.next(), dir, chase: 0 });
      G = { s, x, y, dir, t: 0, geese, girl: { app, agent: { x, y, hidden: false, inside: null }, first: 'the goose girl' } };
    });
    game.hooks.update.push(() => { if (G) { G.girl.agent.x = G.x; G.girl.agent.y = G.y; } });
    game.hooks.drawWorld.push((ctx, cam) => { if (!G || game.scene || G.s !== cur()) return; const tk = performance.now() / 1000;
      for (const g of G.geese) { const x = Math.round(g.x - cam.x), y = Math.round(g.y - cam.y), d = g.dir, bob = Math.floor(g.ph) % 2, angry = g.chase > 0;
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 4, y, 9, 2); ctx.fillStyle = '#f0ece2'; ctx.fillRect(x - 4, y - 6 + bob, 9, 5); ctx.fillStyle = '#d8d4c8'; ctx.fillRect(x - 4, y - 3 + bob, 9, 1);
        if (angry) { ctx.fillStyle = '#f0ece2'; ctx.fillRect(x - 5, y - 9, 3, 3); ctx.fillRect(x + 3, y - 9, 3, 3); }
        const nx = x + d * (angry ? 6 : 4); ctx.fillStyle = '#f0ece2'; ctx.fillRect(nx - (d < 0 ? 1 : 0), y - (angry ? 8 : 11) + bob, 2, angry ? 4 : 6); ctx.fillRect(nx - 1 + d, y - (angry ? 9 : 12) + bob, 3, 2); ctx.fillStyle = '#e08a20'; ctx.fillRect(nx + d * 3 - (d < 0 ? 1 : 0), y - (angry ? 8 : 11) + bob, 2, 1); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(nx + d, y - (angry ? 9 : 12) + bob, 1, 1);
        ctx.fillStyle = '#e08a20'; ctx.fillRect(x - 1, y, 1, 1 + bob); ctx.fillRect(x + 2, y, 1, 2 - bob); }
      // the girl behind them with her willow switch
      const x = Math.round(G.x - cam.x), y = Math.round(G.y - cam.y);
      try { const A = O.Char.ANIMS.walk, fr = O.Char.frame(G.girl.app, G.dir > 0 ? 2 : 1, 'walk', Math.floor(G.t * A.fps * 0.8) % A.frames); ctx.drawImage(fr, x - 16, y - O.Char.GROUND); } catch (e) { /* */ }
      const sw = Math.sin(tk * 3) * 4; ctx.strokeStyle = '#8a9a5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + G.dir * 5, y - 14); ctx.lineTo(x + G.dir * 18, y - 6 + sw); ctx.stroke(); });
    O.GooseGirl = { get flock() { return G; }, get passed() { return passed; }, get hissed() { return hissed; }, soon: () => { cool = 0; } };
  }
  O.GooseGirlSetup = { setup };
})();
