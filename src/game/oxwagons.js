// Ox-wagons on the road. Now and then a great four-wheeled wagon comes lumbering along the main road
// behind a yoke of oxen, heaped with hay or barrels or sacks under a cloth, the wheels creaking round,
// the carter walking at the oxen's heads with his goad, and folk step to the side to let it by.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let W = null, cool = 25, passed = 0, harvests = 0, forceHome = false;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function roadRow(s) { const w = s.world, P = game.player, ty0 = Math.floor(P.y / T); let best = null; for (let d = 0; d < 10 && !best; d++) for (const ty of [ty0 + d, ty0 - d]) { if (ty < 2 || ty >= w.H - 2) continue; let run = 0, x0 = Math.floor(P.x / T) - 24; for (let tx = x0; tx < x0 + 48; tx++) { const t = w.ter[ty * w.W + tx]; if ((t === w.TER.ROAD || t === w.TER.BRIDGE || t === w.TER.COBBLE) && !w.solid[ty * w.W + tx]) run++; } if (run >= 30) { best = ty; break; } } return best; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return;
      if (W) { W.t += dt; W.x += W.dir * 18 * dt; W.ang += dt * 3; if (W.s !== s || Math.abs(W.x - game.player.x) > 520 && W.t > 5) { W = null; passed++; return; }
        if (Math.random() < dt * 0.6 && near(W.x, W.y, 300)) O.sfx && O.sfx('saw', 0.04);
        if (Math.random() < dt * 0.1 && near(W.x, W.y, 260)) O.animalCall && O.animalCall('cow', 0.2);
        // folk on the road step aside
        for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen) continue; if (Math.abs(a.y - W.y) < 10 && Math.abs(a.x - (W.x + W.dir * 20)) < 26) { a.y += (a.y < W.y ? -1 : 1) * 40 * dt; } }
        if (!W.said && W.t > 3 && near(W.x, W.y, 280)) { W.said = true; O.Speech && O.Speech.say(W.man, W.load === 'harvest' ? pick(['Harvest home! Harvest home!', 'The last load! Mind the children up top!', 'We have ploughed, we have sowed, we have reaped, we have mowed!']) : pick(['Hup! Hup there!', 'Make way! Make way!', 'Steady, Blossom, steady.']), 2.6); }
        if (W.load === 'harvest' && near(W.x, W.y, 300) && Math.random() < dt * 0.25) O.sfx && O.sfx('handbell', 0.04);
        return; }
      cool -= dt; if (cool > 0) return; cool = 60 + Math.random() * 60; const hr = s.minute / 60; if (hr < 7 || hr > 18 || (game.isNight && game.isNight())) return;
      const ty = roadRow(s); if (ty == null) return; const dir = Math.random() < 0.5 ? 1 : -1, P = game.player;
      const man = { app: O.Char.makeAppearance(O.hash('carter', s.day, ty), { sex: 'm', age: 30 + Math.floor(Math.random() * 25), genes: O.Char.randomGenes(O.RNG(O.hash('cg', s.day, ty)), 'north'), role: 'farmhand', wealth: 0.3 }), ft: 0, first: 'the carter' };
      W = { s, forceHome, x: P.x - dir * 420, y: ty * T + 12, dir, t: 0, ang: 0, load: pick(['hay', 'barrels', 'sacks', 'timber']), man, ox: [O.hash('ox', ty, 1) % 1000, O.hash('ox', ty, 2) % 1000] };
      W.man.agent = { x: 0, y: 0 }; // (for speech bubbles)
      // harvest home: in autumn the last load comes in decked with a green bough, children riding up on the
      // sheaves and the reapers walking behind it singing
      if (s.season === 'autumn' && (W.forceHome || Math.random() < 0.45)) { W.load = 'harvest'; const R = O.RNG(O.hash('hh', s.day, ty)); W.kids = [0, 1].map((i) => O.Char.makeAppearance(O.hash('hk', s.day, i), { sex: R.next() < 0.5 ? 'm' : 'f', age: 6 + Math.floor(R.next() * 5), genes: O.Char.randomGenes(R, 'north'), role: 'child', wealth: 0.3 })); W.walkers = [0, 1, 2].map((i) => ({ app: O.Char.makeAppearance(O.hash('hw', s.day, i), { sex: R.next() < 0.5 ? 'm' : 'f', age: 18 + Math.floor(R.next() * 40), genes: O.Char.randomGenes(R, 'north'), role: 'farmhand', wealth: 0.25 }), off: 30 + i * 13, dy: (i % 2) * 7 - 3 })); harvests++; }
    });
    game.hooks.update.push(() => { if (W && W.man) { W.man.agent.x = W.x + W.dir * 34; W.man.agent.y = W.y + 8; W.man.agent.hidden = false; W.man.agent.inside = null; } });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (!W || game.scene || W.s !== cur()) return; const x = Math.round(W.x - cam.x), y = Math.round(W.y - cam.y), d = W.dir, tk = performance.now() / 1000;
      // the oxen, yoked, ahead
      for (let i = 0; i < 2; i++) { try { const HA = O.Animals.HANIMS.walk, fr = O.Animals.animal('cow', W.ox[i], d > 0 ? 2 : 1, true, Math.floor(W.t * HA.fps * 0.7 + i) % HA.frames, 'walk'); ctx.drawImage(fr, Math.round(x + d * 36 - (fr.ox ?? fr.width / 2)), Math.round(y - 3 + i * 6 - (fr.gy ?? fr.height))); } catch (e) { /* */ } }
      ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + d * 14 - (d < 0 ? 12 : 0), y - 10, 12, 2);
      // the wagon bed and wheels
      ctx.fillStyle = '#7a5232'; ctx.fillRect(x - 16, y - 16, 32, 8); ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 16, y - 9, 32, 2);
      for (const wx of [x - 11, x + 11]) { ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(wx, y - 4, 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 2; k++) { const a = W.ang * d + k * Math.PI / 2; ctx.moveTo(wx + Math.cos(a) * 5, y - 4 + Math.sin(a) * 5); ctx.lineTo(wx - Math.cos(a) * 5, y - 4 - Math.sin(a) * 5); } ctx.stroke(); }
      if (W.load === 'hay') { ctx.fillStyle = '#c8b060'; ctx.beginPath(); ctx.moveTo(x - 17, y - 16); ctx.quadraticCurveTo(x, y - 34, x + 17, y - 16); ctx.fill(); ctx.fillStyle = '#b0983a'; ctx.fillRect(x - 12, y - 22, 24, 1); }
      else if (W.load === 'barrels') { for (let i = 0; i < 4; i++) { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 14 + i * 7, y - 24, 6, 8); ctx.fillStyle = '#5a5a60'; ctx.fillRect(x - 14 + i * 7, y - 22, 6, 1); ctx.fillRect(x - 14 + i * 7, y - 18, 6, 1); } }
      else if (W.load === 'sacks') { for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#d8c8a0' : '#c8b890'; ctx.fillRect(x - 15 + (i % 3) * 10, y - 22 - Math.floor(i / 3) * 4, 9, 5); } }
      else if (W.load === 'harvest') { for (let i = 0; i < 9; i++) { const sx = x - 15 + (i % 4) * 8 - (i >= 4 ? -4 : 0), sy = y - 20 - Math.floor(i / 4) * 5; ctx.fillStyle = i % 2 ? '#d8b850' : '#c8a840'; ctx.fillRect(sx, sy, 7, 5); ctx.fillStyle = '#a88830'; ctx.fillRect(sx + 1, sy + 2, 5, 1); }
        // the green bough at the front, a ribbon on it
        const bx = x + d * 15; ctx.fillStyle = '#6a4a2c'; ctx.fillRect(bx, y - 40, 1, 24); ctx.fillStyle = '#4a8a3a'; for (let i = 0; i < 5; i++) ctx.fillRect(bx - 3 + (i % 3) * 2, y - 44 + Math.floor(i / 2) * 3, 3, 3); ctx.fillStyle = Math.floor(tk * 4) % 2 ? '#c83030' : '#e04040'; ctx.fillRect(bx + 1, y - 38, 1, 5);
        // the children riding up on the sheaves
        for (let i = 0; i < 2; i++) { try { const fr = O.Char.frame(W.kids[i], 0, Math.floor(tk * 1.5 + i) % 3 === 0 ? 'wave' : 'sit', Math.floor(tk * 4) % 2); ctx.drawImage(fr, Math.round(x - 12 + i * 12 - 16), Math.round(y - 22 - O.Char.GROUND + 4)); } catch (e) { /* */ } } }
      else { ctx.fillStyle = '#9a7a4a'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 18, y - 18 - i * 2, 38, 2); ctx.fillStyle = '#c8a070'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 19, y - 18 - i * 2, 1, 2); }
      if (W.walkers) for (const m of W.walkers) { try { const A = O.Char.ANIMS.walk, fr = O.Char.frame(m.app, d > 0 ? 2 : 1, 'walk', Math.floor(W.t * A.fps * 0.6 + m.off) % A.frames); ctx.drawImage(fr, Math.round(x - d * m.off - 16), Math.round(y + 8 + m.dy - O.Char.GROUND)); } catch (e) { /* */ } }
      // the carter at the oxen's heads with his goad
      try { const A = O.Char.ANIMS.walk, fr = O.Char.frame(W.man.app, d > 0 ? 2 : 1, 'walk', Math.floor(W.t * A.fps) % A.frames); ctx.drawImage(fr, Math.round(x + d * 34 - 16), Math.round(y + 8 - O.Char.GROUND)); ctx.strokeStyle = '#6a4a2c'; ctx.beginPath(); ctx.moveTo(x + d * 38, y - 6); ctx.lineTo(x + d * 44, y - 24); ctx.stroke(); } catch (e) { /* */ }
    });
    O.OxWagons = { get wagon() { return W; }, get passed() { return passed; }, get harvests() { return harvests; }, soon: (home) => { cool = 0; forceHome = !!home; } };
  }
  O.OxWagonsSetup = { setup };
})();
