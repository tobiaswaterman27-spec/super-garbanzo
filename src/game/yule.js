// Yuletide. As the year turns, holly and ivy go up over every door, red berries and dark leaves against
// the wood, and stay till Twelfth Night. On the day the Yule log is brought in, the men put ropes on a
// great trunk from the wood and haul it through the town to the tavern hearth, heaving and singing, with
// the children riding astride it shrieking; at the door the tapster cheers it in, and it will burn all
// the twelve days.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let Y = null, forced = false, hauled = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._yule && !q._bit && !q._scene && !talking(q);
    const dos = (s) => (s.weather && s.weather.dayOfSeason) || 0;
    const greenery = (s) => forced || (s.season === 'winter' && dos(s) >= 10);
    const logDay = (s) => forced || (s.season === 'winter' && dos(s) === 12);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._yule = false; }
    function end() { if (!Y) return; for (const q of Y.men) rel(q); Y = null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (Y) { Y.t += dt; if (Y.s !== s || Y.t > 160 || Y.men.some((q) => talking(q))) { end(); return; }
        const lead = Y.men[0].agent; Y.trail.push([lead.x, lead.y]); if (Y.trail.length > 70) Y.trail.shift(); const back = Y.trail[Math.max(0, Y.trail.length - 45)]; Y.log.x += (back[0] - Y.log.x) * Math.min(1, dt * 3); Y.log.y += (back[1] + 6 - Y.log.y) * Math.min(1, dt * 3);
        if (Y.phase === 'haul') { if (!Y.sang && Y.t > 3 && near(lead.x, lead.y, 340)) { Y.sang = true; O.Speech && O.Speech.say(Y.men[0], pick(['Heave! Heave! Bring in the Yule log!', 'All together now, lads! HEAVE!', 'Hold on tight up there, you little devils!']), 2.6); }
          if (Y.men.every((q) => !q.errand) && Y.t > 4) { Y.phase = 'in'; Y.k = 0; for (const q of Y.men) { q.agent.frozen = true; q.agent.path = null; } } }
        if (Y.phase === 'in') { Y.k += dt; for (const q of Y.men) q.agent.forceAnim = Y.k < 3 ? 'celebrate' : 'idle';
          if (!Y.cheer) { Y.cheer = true; if (near(lead.x, lead.y, 340)) { const tap = Y.tap; if (tap) O.Speech && O.Speech.say(tap, pick(['In with it! The fire\'s waiting!', 'A fine log! Drinks on the house for the haulers!', 'That\'ll burn till Twelfth Night!']), 2.6); O.sfx && O.sfx('handbell', 0.3); } }
          if (Y.k > 4) { hauled++; Y.log.gone = true; end(); } }
        return; }
      if (!logDay(s) || hr < 13.5 || hr >= 16) return; if (s._yuleDone === s.day) return;
      const tav = [...s.biz.values()].find((z) => z.type === 'tavern'); if (!tav) return; const b = s.building(tav.b?.id ?? tav.id); if (!b || b.doorX == null || !near(b.doorX * T, b.doorY * T, 600)) return;
      const men = s.people.filter((q) => able(q) && q.sex === 'm' && q.age >= 16 && q.age <= 55 && !q.agent.hidden && q.agent.inside == null && near(q.agent.x, q.agent.y, 700)).slice(0, 4); if (men.length < 2) return;
      s._yuleDone = s.day;
      // they come up the lane from a little way off, hauling
      const w = s.world, P = game.player; let sx = b.doorX * T + 8 - 200, sy = (b.doorY + 2) * T + 8; for (const dx of [-14, 14, -10, 10, -6, 6]) { const tx = b.doorX + dx, ty = b.doorY + 2; if (tx > 1 && tx < w.W - 1 && !w.solid[ty * w.W + tx]) { sx = tx * T + 8; sy = ty * T + 8; break; } }
      men.forEach((q, i) => { const a = q.agent; q._yule = true; if (Math.hypot(a.x - sx, a.y - sy) > 300) { a.x = sx + (i % 2 ? 8 : -8) * (sx < b.doorX * T ? -1 : 1) - (sx < b.doorX * T ? 1 : -1) * i * 6; a.y = sy + (i % 2 ? 5 : -3); } O.Errands.send(s, q, [b.doorX + (i % 2 ? 1 : -1) * (1 + (i >> 1)), b.doorY + 2], { anim: 'celebrate', secs: 0.5, face: 3, giveUp: game.t + 90, after: () => { if (Y && q._yule) { q.agent.frozen = true; q.agent.path = null; } } }); });
      const R = O.RNG(O.hash('yule', s.day)); const kids = [0, 1].map((i) => O.Char.makeAppearance(O.hash('yk', s.day, i), { sex: R.next() < 0.5 ? 'm' : 'f', age: 6 + Math.floor(R.next() * 5), genes: O.Char.randomGenes(R, 'north'), role: 'child', wealth: 0.3 }));
      const tap = (tav.workers || []).map((id) => s.byId.get(id)).find((q) => q && q.agent) || null;
      Y = { s, b, men, t: 0, phase: 'haul', log: { x: sx - 30, y: sy + 6 }, trail: [[sx, sy]], kids, tap }; void P;
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; const s = cur(); if (!s) return; const W = ctx.canvas.width, H = ctx.canvas.height, tk = performance.now() / 1000;
      // holly and ivy over the doors
      if (greenery(s)) for (const b of s.world.buildings) { if (!b.sprite || !b.sprite.door || b.ruined) continue; const sp = b.sprite, bx = b.x * T - sp.OV - cam.x, by = (b.bottom + 1) * T - sp.H - cam.y; if (bx > W + 10 || by > H + 10 || bx + sp.W < -10 || by + sp.H < -10) continue; const d = sp.door, x = Math.round(bx + d.x), y = Math.round(by + d.y) - 3, w = d.w;
        ctx.fillStyle = '#2a5a2a'; for (let i = 0; i < w; i += 3) ctx.fillRect(x + i, y + (i % 6 ? 0 : 1), 3, 3); ctx.fillStyle = '#3a7a3a'; for (let i = 1; i < w; i += 4) ctx.fillRect(x + i, y + 1, 2, 1); ctx.fillStyle = '#d02828'; for (let i = 2; i < w; i += 5) ctx.fillRect(x + i, y + 2, 1, 1); ctx.fillStyle = '#4a7a3a'; ctx.fillRect(x - 1, y + 2, 1, 5); ctx.fillRect(x + w, y + 2, 1, 5); }
      if (!Y || Y.s !== s || Y.log.gone) return; const L = Y.log, x = Math.round(L.x - cam.x), y = Math.round(L.y - cam.y);
      // the ropes to the haulers
      ctx.strokeStyle = '#a8946a'; ctx.lineWidth = 1; for (const q of Y.men.slice(0, 2)) { const a = q.agent; ctx.beginPath(); ctx.moveTo(x + 10, y - 6); ctx.lineTo(Math.round(a.x - cam.x), Math.round(a.y - cam.y) - 10); ctx.stroke(); }
      // the log, with a sprig of holly, and the children astride
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 18, y - 1, 36, 3); ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 18, y - 9, 36, 8); ctx.fillStyle = '#6e4a2a'; ctx.fillRect(x - 18, y - 9, 36, 2); ctx.fillStyle = '#c8a070'; ctx.fillRect(x + 16, y - 9, 3, 8); ctx.fillStyle = '#a07a50'; ctx.fillRect(x + 17, y - 6, 1, 2); ctx.fillStyle = '#4a2e18'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 14 + i * 8, y - 6 + (i % 2), 3, 1);
      ctx.fillStyle = '#2a5a2a'; ctx.fillRect(x - 6, y - 12, 5, 3); ctx.fillStyle = '#d02828'; ctx.fillRect(x - 4, y - 11, 1, 1);
      for (let i = 0; i < 2; i++) { try { const fr = O.Char.frame(Y.kids[i], 0, Math.floor(tk * 2 + i) % 3 === 0 ? 'celebrate' : 'sit', Math.floor(tk * 4) % 2); ctx.drawImage(fr, x - 10 + i * 14 - 16, y - 8 - O.Char.GROUND + 4); } catch (e) { /* */ } } });
    (O.extraLines = O.extraLines || []).push((s, q) => !greenery(s) ? '' : q._yule ? 'It is Yuletide and you are hauling the Yule log on a rope to the tavern hearth with the other men.' : 'It is Yuletide: holly and ivy over the doors, and the Yule log burning at the tavern.');
    O.Yule = { get haul() { return Y; }, get hauled() { return hauled; }, force: () => { forced = true; const s = cur(); if (s) s._yuleDone = -1; }, unforce: () => { forced = false; } };
  }
  O.YuleSetup = { setup };
})();
