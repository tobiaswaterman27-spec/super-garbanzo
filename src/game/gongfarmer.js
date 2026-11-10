// The gong farmers. In the dead of night, when decent folk are abed, the men who empty the town's privies
// come by with their cart and their buckets and a lantern, a boy going ahead with the light; the stink goes
// before them like a herald, so that anyone still out (the watch, a drunk, you) holds his nose and crosses
// over, and the gong men laugh, for they've long since stopped smelling it.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let G = null, cool = 60, passed = 0, warned = 0; const flies = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function roadRow(s) { const w = s.world, P = game.player, ty0 = Math.floor(P.y / T); for (let d = 0; d < 10; d++) for (const ty of [ty0 + d, ty0 - d]) { if (ty < 2 || ty >= w.H - 2) continue; let run = 0; const x0 = Math.floor(P.x / T) - 20; for (let tx = x0; tx < x0 + 40; tx++) { const i = ty * w.W + tx, t = w.ter[i]; if ((t === w.TER.ROAD || t === w.TER.COBBLE) && !w.solid[i]) run++; } if (run >= 24) return ty; } return null; }
    const mk = (s, i, age) => { const R = O.RNG(O.hash('gong', s.day, i)); return O.Char.makeAppearance(O.hash('gongapp', s.day, i), { sex: 'm', age, genes: O.Char.randomGenes(R, 'north'), role: 'sweeper', wealth: 0.1 }); };
    game.hooks.update.push((dt) => {
      for (const f of flies.slice()) { f.t += dt; if (f.t > 1.5) flies.splice(flies.indexOf(f), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60, P = game.player;
      if (G) { G.t += dt; if (G.s !== s || (Math.abs(G.x - P.x) > 480 && G.t > 6)) { G = null; passed++; return; } G.x += G.dir * 16 * dt; G.ang += dt * 2.4;
        if (Math.random() < dt * 6) flies.push({ s, x: G.x + (Math.random() - 0.5) * 20, y: G.y - 14 + (Math.random() - 0.5) * 10, t: 0, ph: Math.random() * 6 });
        if (near(G.x, G.y, 90) && game.t - warned > 25) { warned = game.t; O.UI && O.UI.say && O.UI.say(pick(['The stink of the gong cart hits you like a fist.', 'You clap a hand over your nose. The gong men are passing.', 'Your eyes water. Somebody\'s privy, going by on a cart.'])); if (!G.said) { G.said = true; O.Speech && O.Speech.say(G.men[0], pick(['Evening! Lovely night for it!', 'Mind your nose, friend!', 'Don\'t breathe too deep, now!']), 2.2); } }
        // anyone still out holds their nose and crosses over
        for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || q._bit) continue; const d = Math.hypot(a.x - G.x, a.y - G.y); if (d < 60 && !q._gongNose) { q._gongNose = game.t; O.gesture && O.gesture(q, 'wipe', 2); if (Math.random() < 0.3 && near(a.x, a.y, 260)) O.Speech && O.Speech.say(q, pick(['Phaw! God\'s teeth!', 'Ugh. The gong men.', 'Hold your breath!']), 1.8); } if (q._gongNose && game.t - q._gongNose > 30) q._gongNose = 0; if (d < 40 && d > 0.1) a.y += (a.y < G.y ? -1 : 1) * 30 * dt; }
        return; }
      cool -= dt; if (cool > 0) return; cool = 300 + Math.random() * 300; if (!(hr >= 23 || hr < 3.5)) return;
      const ty = roadRow(s); if (ty == null) return; const dir = Math.random() < 0.5 ? 1 : -1;
      G = { s, x: P.x - dir * 420, y: ty * T + 12, dir, t: 0, ang: 0, men: [0, 1, 2].map((i) => ({ app: mk(s, i, i === 2 ? 12 : 30 + i * 9), agent: { x: 0, y: 0, hidden: false, inside: null }, first: 'the gong farmer' })) };
    });
    game.hooks.update.push(() => { if (G) G.men.forEach((m, i) => { m.agent.x = G.x + G.dir * [22, -24, 48][i]; m.agent.y = G.y + [0, 4, 0][i]; }); });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; const s = cur(); if (!G || G.s !== s) return; const x = Math.round(G.x - cam.x), y = Math.round(G.y - cam.y), d = G.dir;
      // the cart with its tub and the buckets hung on the side
      ctx.fillStyle = '#4a3a28'; ctx.fillRect(x - 12, y - 12, 24, 6); ctx.fillStyle = '#3a2c1c'; ctx.fillRect(x - 9, y - 22, 18, 10); ctx.fillStyle = '#2a2018'; ctx.fillRect(x - 9, y - 22, 18, 2); ctx.fillStyle = '#5a5048'; ctx.fillRect(x - 8, y - 18, 16, 1); ctx.fillRect(x - 8, y - 14, 16, 1);
      for (const bx of [x - 14, x + 12]) { ctx.fillStyle = '#6a5a40'; ctx.fillRect(bx, y - 10, 3, 4); }
      ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.arc(x, y - 4, 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#6a5040'; ctx.lineWidth = 1; ctx.beginPath(); const a = G.ang * d; ctx.moveTo(x + Math.cos(a) * 5, y - 4 + Math.sin(a) * 5); ctx.lineTo(x - Math.cos(a) * 5, y - 4 - Math.sin(a) * 5); ctx.stroke(); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + d * 12 - (d < 0 ? 10 : 0), y - 10, 10, 2);
      // the men: one in the shafts, one shoving behind, the boy ahead with the lantern
      G.men.forEach((m, i) => { try { const A = O.Char.ANIMS.walk, fr = O.Char.frame(m.app, d > 0 ? 2 : 1, i === 1 ? 'carry' : 'walk', Math.floor(G.t * A.fps * 0.7 + i) % A.frames); ctx.drawImage(fr, Math.round(m.agent.x - 16 - cam.x), Math.round(m.agent.y - O.Char.GROUND - cam.y)); } catch (e) { /* */ } });
      const bx = Math.round(G.men[2].agent.x - cam.x) + d * 5, by = Math.round(G.men[2].agent.y - cam.y) - 14, fl = Math.floor(performance.now() / 140) % 2; ctx.fillStyle = '#3a3a3a'; ctx.fillRect(bx - 2, by - 4, 5, 6); ctx.fillStyle = fl ? '#ffd060' : '#f0a030'; ctx.fillRect(bx - 1, by - 3, 3, 4);
      for (const f of flies) { if (f.s !== s) continue; ctx.fillStyle = '#1a1a1a'; ctx.fillRect(Math.round(f.x + Math.sin(f.t * 9 + f.ph) * 4 - cam.x), Math.round(f.y + Math.cos(f.t * 7 + f.ph) * 3 - cam.y), 1, 1); } });
    (O.extraLights = O.extraLights || []).push((pools, cam) => { if (G && G.s === cur()) pools.push([G.men[2].agent.x - cam.x, G.men[2].agent.y - 14 - cam.y, 40]); });
    (O.extraLines = O.extraLines || []).push((s, q) => q._gongNose && game.t - q._gongNose < 60 ? 'The gong farmers just went by with their cart full of privy muck and the stink is still in your nose.' : '');
    O.GongFarmer = { get cart() { return G; }, get passed() { return passed; }, soon: () => { cool = 0; } };
  }
  O.GongFarmerSetup = { setup };
})();
