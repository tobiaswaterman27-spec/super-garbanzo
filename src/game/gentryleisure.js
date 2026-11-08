// The quality at their ease. A lady of a great house doesn't walk out alone: a little lapdog trots at her
// heels, stopping to sniff and then scampering to catch up. And in the castle garden or a manor's grounds,
// where there are benches among the flowers, the gentry sit out in pairs, talking low, or bent over a
// chessboard on a stool between them, one reaching out to move a piece while the other strokes his beard.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const dogs = new Map(), sits = []; let cool = 8, games = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const quality = (q) => q.gentry || q.royal || /lord|lady|knight|king|queen|prince|princess|duke|duchess|baron|countess|earl|consort|heir/.test(q.job?.role || '') || (q.title && q.title.length);
    const LEISURE = ['stroll', 'socialise', 'idle', 'rest', 'home', 'pastime-none', 'pastime'];
    function release(S) { for (const q of S.ppl) { const a = q.agent; if (!a) continue; a.forceAnim = null; if (!talking(q)) a.frozen = false; q._leisure = false; } sits.splice(sits.indexOf(S), 1); }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const P = game.player;
      // lapdogs follow their ladies
      for (const q of s.people) { const a = q.agent; if (!a || q.sex !== 'f' || q.age < 16 || !quality(q)) continue; if (a.hidden || a.inside != null || Math.abs(a.x - P.x) > 500 || Math.abs(a.y - P.y) > 360) { dogs.delete(q); continue; }
        let d = dogs.get(q); if (!d) { d = { x: a.x - 14, y: a.y + 2, seed: O.hash('lapdog', q.id) % 1000, ft: 0, dir: 2, mv: false, sniff: 0, trail: [] }; dogs.set(q, d); }
        d.ft += dt; d.trail.push([a.x, a.y + 3]); if (d.trail.length > 14) d.trail.shift(); if (d.sniff > 0) { d.sniff -= dt; d.mv = false; continue; }
        const [tx, ty] = d.trail[0]; const dx = tx - d.x, dy = ty - d.y, dd = Math.hypot(dx, dy); if (dd > 2) { const v = dd > 30 ? 70 : 34; d.x += dx / dd * Math.min(dd, v * dt); d.y += dy / dd * Math.min(dd, v * dt); d.dir = dx > 0 ? 2 : 1; d.mv = true; } else { d.mv = false; if (Math.random() < dt * 0.15) d.sniff = 1 + Math.random() * 2; } }
      // sitting out in the garden
      for (const S of sits.slice()) { S.t += dt; if (S.s !== s || S.t > S.len || s.raining || S.ppl.some((q) => q.alive === false || talking(q))) { release(S); continue; } if (S.ppl.length < 2) continue;
        S.ppl.forEach((q, i) => { const a = q.agent; a.x = S.x + (i ? 10 : -10); a.y = S.y; a.dir = 0; a.forceAnim = S.chess ? (Math.floor(S.t / 4 + i * 2) % 4 === 0 ? 'point' : Math.floor(S.t / 4 + i * 2) % 4 === 2 ? 'scratch' : 'sit') : (Math.floor(S.t / 3 + i) % 3 === 0 ? 'talk' : 'sit'); });
        if (S.chess && S.t > S.len - 4 && !S.mate) { S.mate = true; const w = pick(S.ppl); near(S.x, S.y, 300) && O.Speech && O.Speech.say(w, pick(['Check, and mate.', 'Your king is taken, my lord.', 'Again, tomorrow.']), 2.6); }
        else if (!S.said && S.t > 8) { S.said = true; near(S.x, S.y, 300) && O.Speech && O.Speech.say(S.ppl[0], S.chess ? pick(['Your move.', 'Hmm. Bishop to... no.', 'You play like a Frostmere man.']) : pick(['They say the king will hunt on Freyday.', 'Did you see what she wore at mass?', 'The roses are fine this year.']), 2.6); } }
      cool -= dt; if (cool > 0) return; cool = 12 + Math.random() * 10;
      const hr = s.minute / 60; if (hr < 9 || hr > 19 || s.raining || s.season === 'winter' || sits.filter((x) => x.s === s).length >= 2) return;
      const benches = (s.world.props || []).filter((p) => p.kind === 'bench' && Math.abs(p.x - P.x) < 520 && Math.abs(p.y - P.y) < 380 && !sits.some((x) => x.bench === p)); if (!benches.length) return;
      const bench = pick(benches), ppl = s.people.filter((q) => quality(q) && q.age >= 14 && q.agent && !q.agent.frozen && !q.errand && !q._leisure && !q._bit && !q._scene && !talking(q) && ((!q.agent.hidden && q.agent.inside == null) || q.agent.inside === q.home) && LEISURE.includes(q.activity?.act) && Math.hypot(q.agent.x - bench.x, q.agent.y - bench.y) < 700).slice(0, 2); if (ppl.length < 2) return;
      const S = { s, bench, x: bench.x, y: bench.y + 2, ppl: [], t: 0, len: 60 + Math.random() * 60, chess: Math.random() < 0.5 }; if (S.chess) games++; sits.push(S);
      ppl.forEach((q, i) => { q._leisure = true; O.Errands.send(s, q, [Math.floor((bench.x + (i ? 12 : -12)) / T), Math.floor((bench.y + 6) / T)], { anim: 'idle', secs: 0.2, face: 0, giveUp: game.t + 50, after: (ok) => { if (!ok || !q.agent || !sits.includes(S)) { q._leisure = false; return; } q.agent.frozen = true; q.agent.path = null; S.ppl.push(q); } }); });
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      for (const [q, d] of dogs) { if (O.occluded && O.occluded(d.x, d.y)) continue; try { const an = d.mv ? 'walk' : d.sniff > 0 ? 'graze' : 'idle', HA = O.Animals.HANIMS[an], fr = O.Animals.animal('dog', d.seed, d.dir, d.mv, Math.floor(d.ft * HA.fps * 1.4) % HA.frames, an); const w = Math.round(fr.width * 0.6), h = Math.round(fr.height * 0.6); ctx.drawImage(fr, Math.round(d.x - (fr.ox ?? fr.width / 2) * 0.6 - cam.x), Math.round(d.y - (fr.gy ?? fr.height) * 0.6 - cam.y), w, h); } catch (e) { /* */ } }
      for (const S of sits) { if (S.s !== s || !S.chess || S.ppl.length < 2) continue; const x = Math.round(S.x - cam.x), y = Math.round(S.y + 4 - cam.y); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 4, y - 2, 8, 4); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x - 3, y - 6, 6, 4); ctx.fillStyle = '#3a2a1a'; for (let i = 0; i < 6; i += 2) for (let j = 0; j < 4; j += 2) ctx.fillRect(x - 3 + i + (j % 4 ? 1 : 0), y - 6 + j, 1, 1); ctx.fillStyle = '#c83a3a'; ctx.fillRect(x - 2, y - 8, 1, 2); ctx.fillStyle = '#2a2a3a'; ctx.fillRect(x + 1, y - 8, 1, 2); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const S = sits.find((x) => x.ppl.includes(q)); if (S) return S.chess ? 'You are sitting in the garden playing chess.' : 'You are sitting out in the garden in good company, talking.'; if (dogs.has(q)) return 'Your little lapdog trots at your heels wherever you go.'; return ''; });
    O.GentryLeisure = { dogs, sits, get games() { return games; } };
  }
  O.GentryLeisureSetup = { setup };
})();
