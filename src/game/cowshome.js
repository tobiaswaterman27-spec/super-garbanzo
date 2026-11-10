// The cows come home. Toward evening the herd-boy brings the cows in off the common for milking: a slow
// brown procession down the road, udders swinging, the bell on the lead cow clanking, one stopping to
// crop the verge till a switch on the rump moves her on, and folk standing aside at the house-ends to
// let them by.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let H = null, cool = 40, passed = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function roadRow(s) { const w = s.world, P = game.player, ty0 = Math.floor(P.y / T); for (let d = 0; d < 10; d++) for (const ty of [ty0 + d, ty0 - d]) { if (ty < 2 || ty >= w.H - 2) continue; let run = 0; const x0 = Math.floor(P.x / T) - 20; for (let tx = x0; tx < x0 + 40; tx++) { const i = ty * w.W + tx, t = w.ter[i]; if ((t === w.TER.ROAD || t === w.TER.COBBLE || t === w.TER.BRIDGE) && !w.solid[i]) run++; } if (run >= 24) return ty; } return null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60, P = game.player;
      if (H) { H.t += dt; if (H.s !== s || (Math.abs(H.x - P.x) > 500 && H.t > 6)) { H = null; passed++; return; } H.x += H.dir * 12 * dt;
        for (const c of H.cows) { c.ft += dt; if (c.graze > 0) { c.graze -= dt; if (c.graze <= 0 && near(c.x, c.y, 260)) { O.Speech && O.Speech.say(H.boy, pick(['Get on, Daisy! On!', 'Hup, you lazy old thing!', 'Leave the verge be!']), 1.8); O.sfx && O.sfx('smack', 0.06); } } else { const tx = H.x + H.dir * c.ox, ty = H.y + c.oy; c.x += (tx - c.x) * Math.min(1, dt * 1.5); c.y += (ty - c.y) * Math.min(1, dt * 1.5); if (Math.random() < dt * 0.04) c.graze = 2 + Math.random() * 2; } }
        if (Math.random() < dt * 0.25 && near(H.x, H.y, 280)) O.animalCall && O.animalCall('cow', 0.25);
        if (Math.random() < dt * 1.2 && near(H.x, H.y, 260)) O.sfx && O.sfx('handbell', 0.025);
        for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen) continue; if (Math.abs(a.y - H.y) < 14 && Math.abs(a.x - (H.x + H.dir * 40)) < 50) a.y += (a.y < H.y ? -1 : 1) * 30 * dt; }
        return; }
      cool -= dt; if (cool > 0) return; cool = 200 + Math.random() * 150; if (hr < 16.5 || hr > 19.5 || s.season === 'winter') return;
      const ty = roadRow(s); if (ty == null) return; const dir = Math.random() < 0.5 ? 1 : -1, R = O.RNG(O.hash('cowhome', s.day, ty)); const x = P.x - dir * 420, y = ty * T + 12;
      const cows = []; for (let i = 0; i < 4 + Math.floor(R.next() * 3); i++) cows.push({ seed: O.hash('cowh', i, s.day % 7) % 9999, ox: 28 + i * 18 + R.next() * 6, oy: (i % 2 ? 4 : -3), x: x + dir * (28 + i * 18), y, ft: R.next() * 3, graze: 0 });
      H = { s, x, y, dir, t: 0, cows, boy: { app: O.Char.makeAppearance(O.hash('herdboy', s.day), { sex: 'm', age: 10 + Math.floor(R.next() * 4), genes: O.Char.randomGenes(R, 'north'), role: 'farmhand', wealth: 0.2 }), agent: { x, y, hidden: false, inside: null }, first: 'the herd-boy' } };
    });
    game.hooks.update.push(() => { if (H) { H.boy.agent.x = H.x; H.boy.agent.y = H.y; } });
    game.hooks.drawWorld.push((ctx, cam) => { if (!H || game.scene || H.s !== cur()) return;
      for (const c of [...H.cows].sort((a, b) => a.y - b.y)) { try { const an = c.graze > 0 ? 'graze' : 'walk', HA = O.Animals.HANIMS[an], fr = O.Animals.animal('cow', c.seed, H.dir > 0 ? 2 : 1, c.graze <= 0, Math.floor(c.ft * HA.fps * 0.6) % HA.frames, an); ctx.drawImage(fr, Math.round(c.x - cam.x - (fr.ox ?? fr.width / 2)), Math.round(c.y - cam.y - (fr.gy ?? fr.height))); } catch (e) { /* */ } }
      const lead = H.cows[H.cows.length - 1]; if (lead) { ctx.fillStyle = '#b89a40'; ctx.fillRect(Math.round(lead.x - cam.x) + H.dir * 9, Math.round(lead.y - cam.y) - 8, 2, 3); }
      const x = Math.round(H.x - cam.x), y = Math.round(H.y - cam.y); try { const A = O.Char.ANIMS.walk, fr = O.Char.frame(H.boy.app, H.dir > 0 ? 2 : 1, 'walk', Math.floor(H.t * A.fps * 0.7) % A.frames); ctx.drawImage(fr, x - 16, y - O.Char.GROUND); } catch (e) { /* */ }
      ctx.strokeStyle = '#8a9a5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + H.dir * 5, y - 14); ctx.lineTo(x + H.dir * 15, y - 6 + Math.sin(H.t * 3) * 3); ctx.stroke(); });
    O.CowsHome = { get herd() { return H; }, get passed() { return passed; }, soon: () => { cool = 0; } };
  }
  O.CowsHomeSetup = { setup };
})();
