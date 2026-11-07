// The tavern spills outdoors on fine evenings. Benches and a trestle stand by the door; the drinkers
// sit out with their mugs, lift them in a toast with a clunk, laugh, argue, sing a verse; the potboy
// comes out with a jug to fill them. Late on, the tapster puts out a man who's had too much: shoved
// out of the door, he staggers, sits down hard in the road, gets up and weaves off home, singing.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    let yard = null, drunk = null, cool = 5;
    const fine = (s) => { const h = s.minute / 60; return h >= 17.5 && h < 22.5 && !s.raining && !(s.weather && /rain|storm|snow|blizzard/.test(s.weather.kind || '')) && s.season !== 'winter'; };
    function tavern(s) { const b = s.tavernId != null && s.building(s.tavernId); return b && b.doorX != null ? b : null; }
    function seats(b) { const dx = b.doorX * T + 8, dy = (b.doorY + 1) * T + 12, out = []; for (const side of [-1, 1]) { const bx = dx + side * 30; if (game.solidAt(bx - 12, dy - 2) || game.solidAt(bx + 12, dy - 2) || game.solidAt(bx, dy + 14)) continue; out.push({ bench: [bx, dy], table: [bx, dy + 8], spots: [[bx - 7, dy], [bx + 7, dy], [bx - 7, dy + 18], [bx + 7, dy + 18]] }); } return out; }
    function begin(s, b) {
      const S = seats(b); if (!S.length) return false;
      const inn = s.people.filter((q) => q.agent && q.agent.inside === b.id && q.alive !== false && q.age >= 16 && !q.errand && !q._scene && !q._fighting && !q.job?.onShift && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)).slice(0, S.length * 4);
      if (inn.length < 2) return false;
      const sitters = []; let k = 0; for (const st of S) for (const sp of st.spots) { const q = inn[k++]; if (!q) break; q._yard = true; const a = q.agent; a.inside = null; a.hidden = false; a.frozen = true; a.path = null; a.x = sp[0]; a.y = sp[1]; a.dir = sp[1] > st.bench[1] ? 3 : 0; sitters.push({ q, sp, t: Math.random() * 4 }); }
      yard = { s, b, S, sitters, t: 0, toast: 6 + Math.random() * 6, verse: 15 };
      return true;
    }
    function end(back = true) { const y = yard; if (!y) return; for (const st of y.sitters) { const q = st.q; q._yard = false; q.agent.forceAnim = null; q.agent.lift = 0; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) { q.agent.frozen = false; if (back && q.alive !== false) { q.agent.inside = y.b.id; q.agent.hidden = true; } } } yard = null; cool = 30; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world) return;
      if (!yard) { cool -= dt; if (cool > 0 || game.scene) return; cool = 6; if (!fine(s)) return; const b = tavern(s); if (b && near(b.doorX * T, b.doorY * T, 420)) begin(s, b); }
      else { const y = yard; y.t += dt;
        if (y.s !== s || game.scene || !fine(s) || !near(y.b.doorX * T, y.b.doorY * T, 700)) { end(); }
        else {
          for (const st of y.sitters) { const q = st.q; if (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) continue; st.t += dt; if (q.alive === false || q._fighting) continue; const cyc = Math.floor(st.t / 2.5 + q.id) % 6; q.agent.forceAnim = st.toasting > 0 ? 'celebrate' : cyc === 0 ? 'drink' : cyc === 3 ? (Math.random() < 0.5 ? 'laugh' : 'talk') : cyc === 4 ? 'gesture' : 'sit'; q.agent.lift = 0; if (st.toasting > 0) st.toasting -= dt; }
          y.toast -= dt; if (y.toast <= 0) { y.toast = 18 + Math.random() * 20; const lead = pick(y.sitters); if (lead) { say(lead.q, pick(['To the King!', 'To the harvest!', `To ${pick(y.sitters).q.first}, God help them!`, 'Your health!', 'Confusion to the taxman!']), 2); for (const st of y.sitters) st.toasting = 1.4; setTimeout(() => { if (yard === y && near(y.b.doorX * T, y.b.doorY * T, 300)) O.sfx && O.sfx('place', 0.4); }, 600); } }
          y.verse -= dt; if (y.verse <= 0) { y.verse = 25 + Math.random() * 25; const singer = pick(y.sitters); if (singer && O.Speech) { const v = pick(['♪ Oh, the miller\'s daughter... ♪', '♪ Sumer is icumen in, lhude sing cuccu! ♪', '♪ And we\'ll all go a-maying... ♪', '♪ Bring us in good ale! ♪']); say(singer.q, v, 3); for (const st of y.sitters) if (st !== singer && Math.random() < 0.6) setTimeout(() => yard === y && say(st.q, '♪ ...good ale! ♪', 1.6), 1200 + Math.random() * 800); } }
          // out goes a drunk, late on
          if (!drunk && s.minute / 60 > 20.5 && Math.random() < dt * 0.02) { const q = s.people.find((q) => q.agent && q.agent.inside === y.b.id && q.age >= 18 && q.alive !== false && !q._yard && !q.errand && !q._scene && !q.job?.onShift && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)); const tap = s.people.find((x) => x.agent && x.agent.inside === y.b.id && x.job?.onShift && /innkeeper|tapster|server|potboy|landlord/.test(x.job.role || ''));
            if (q) { const a = q.agent; a.inside = null; a.hidden = false; a.frozen = true; a.path = null; a.x = y.b.doorX * T + 8; a.y = (y.b.doorY + 1) * T + 8; q._yard = true; drunk = { q, t: 0, tap, home: s.building(q.home) };
              if (tap) { const ta = tap.agent; tap._yardTap = { inside: ta.inside }; ta.inside = null; ta.hidden = false; ta.frozen = true; ta.x = a.x; ta.y = a.y - 6; ta.forceAnim = 'attack'; say(tap, pick(['OUT! And don\'t come back till you\'re sober!', 'That\'s enough. Out you go.', 'Go home to your wife!']), 2.2); }
              O.sfx && near(a.x, a.y, 300) && O.sfx('door', 0.5); } }
        } }
      if (drunk) { const d = drunk, q = d.q, a = q.agent; d.t += dt;
        if (q.alive === false || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)) { if (q.alive === false || d.t > 40) endDrunk(); return; }
        if (d.t < 1.4) { a.y += 30 * dt; a.forceAnim = 'hurt'; }
        else if (d.t < 4) { a.forceAnim = 'lie'; if (d.tap && d.t > 1.6 && d.tap._yardTap) { const ta = d.tap.agent; ta.forceAnim = null; ta.frozen = false; ta.inside = d.tap._yardTap.inside; ta.hidden = true; d.tap._yardTap = null; } if (d.t > 1.5 && d.t < 1.6 && !d.said) { d.said = 1; say(q, pick(['Ow.', 'I\'m perfectly... perfectly...', 'The ground came up at me.']), 2); } }
        else if (d.t < 5) a.forceAnim = 'sit';
        else { const h = d.home && d.home.doorX != null ? [d.home.doorX * T + 8, (d.home.doorY + 1) * T + 10] : [a.x + 200, a.y]; const dx = h[0] - a.x, dy = h[1] - a.y, dd = Math.hypot(dx, dy); const wob = Math.sin(d.t * 3) * 14; const st = Math.min(dd, 22 * dt), nx = a.x + dx / dd * st + (-dy / dd) * wob * dt, ny = a.y + dy / dd * st + (dx / dd) * wob * dt * 0.6; if (!game.solidAt(nx, ny - 2)) { a.x = nx; a.y = ny; } else if (!game.solidAt(nx, a.y - 2)) a.x = nx; else if (!game.solidAt(a.x, ny - 2)) a.y = ny; a.dir = O.dirOf(dx, dy); a.forceAnim = Math.floor(d.t * 1.5) % 5 === 0 ? 'shake' : 'walk'; if (Math.random() < dt * 0.12) say(q, pick(['♪ Hic... ♪', '♪ Oh the... the something... ♪', 'Lovely night. Lovely.']), 1.8); if (dd < 6 || d.t > 45 || !near(a.x, a.y, 600)) endDrunk(true); } }
    });
    function endDrunk(home) { const d = drunk; if (!d) return; const q = d.q; q._yard = false; q.agent.forceAnim = null; q.agent.frozen = false; if (home && d.home) { q.agent.inside = d.home.id; q.agent.hidden = true; } if (d.tap && d.tap._yardTap) { const ta = d.tap.agent; ta.forceAnim = null; ta.frozen = false; ta.inside = d.tap._yardTap.inside; ta.hidden = true; d.tap._yardTap = null; } drunk = null; }
    game.hooks.drawGround.push((ctx, cam) => { const y = yard; if (!y || game.scene) return; for (const st of y.S) { const [bx, by] = st.bench, x = Math.round(bx - cam.x), yy = Math.round(by - cam.y); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 13, yy - 3, 26, 3); ctx.fillRect(x - 12, yy, 2, 3); ctx.fillRect(x + 10, yy, 2, 3); ctx.fillRect(x - 13, yy + 15, 26, 3); ctx.fillRect(x - 12, yy + 18, 2, 3); ctx.fillRect(x + 10, yy + 18, 2, 3); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 12, yy + 4, 24, 8); ctx.fillStyle = '#7a5232'; ctx.fillRect(x - 12, yy + 11, 24, 2); ctx.fillRect(x - 10, yy + 12, 2, 4); ctx.fillRect(x + 8, yy + 12, 2, 4); } });
    game.hooks.drawWorld.push((ctx, cam) => { const y = yard; if (!y || game.scene) return; for (const st of y.sitters) { const a = st.q.agent, x = Math.round(a.x - cam.x + (a.dir === 3 ? 4 : 4)), yy = Math.round(a.y - cam.y - (a.forceAnim === 'drink' || a.forceAnim === 'celebrate' ? 20 : 12)); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x, yy, 3, 4); ctx.fillStyle = '#efe6c8'; ctx.fillRect(x, yy, 3, 1); } for (const st of y.S) { const [bx, by] = st.bench; ctx.fillStyle = '#5a4030'; ctx.fillRect(Math.round(bx - cam.x) - 2, Math.round(by - cam.y) + 4, 4, 5); ctx.fillStyle = '#efe6c8'; ctx.fillRect(Math.round(bx - cam.x) - 2, Math.round(by - cam.y) + 4, 4, 1); } });
    (O.extraLines = O.extraLines || []).push((s, q) => q._yard ? (drunk && drunk.q === q ? 'You are very drunk; you have just been thrown out of the tavern and are weaving home. Slur a little.' : 'You are sitting out on the bench by the tavern door with a mug of ale, in good company, on a fine evening. You are merry.') : '');
    O.TavernYard = { get yard() { return yard; }, get drunk() { return drunk; }, start: () => { const s = cur(), b = tavern(s); return b && begin(s, b); } };
  }
  O.TavernYardSetup = { setup };
})();
