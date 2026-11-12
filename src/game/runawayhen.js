// The hen's out! A hen gets through a gap in the wattle and goes off down the lane at a run, and the
// goodwife comes after it with her apron flapping, crying "Chook chook chook!", and every time she stoops
// the hen jinks away, wings out, squawking; children join in and make it worse. Get your hands on it, and
// she'll thank you, and the whole lane laughs.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let H = null, cool = 200, caught = 0, byYou = 0, byKid = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    function end() { if (!H) return; const q = H.wife; q._hen = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } H = null; }
    function step(a, tx, ty, v, dt) { const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1) return d; const st = Math.min(d, v * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; if (!game.solidAt(nx, ny - 2)) { a.x = nx; a.y = ny; } else if (!game.solidAt(nx, a.y - 2)) a.x = nx; else if (!game.solidAt(a.x, ny - 2)) a.y = ny; a.dir = O.dirOf(dx, dy); return d; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      if (H) { H.t += dt; const h = H.hen, w = H.wife, wa = w.agent; if (H.s !== s || H.t > 60 || talking(w)) { end(); return; } h.ft += dt;
        if (H.caughtAt) { if (H.t - H.caughtAt > 4) { caught++; end(); } return; }
        // the hen runs from whoever's nearest, jinking
        const P = game.player, chasers = [[wa.x, wa.y], [P.x, P.y]]; let fx = 0, fy = 0; for (const [cx, cy] of chasers) { const d = Math.hypot(h.x - cx, h.y - cy); if (d < 70) { fx += (h.x - cx) / (d || 1) * (70 - d); fy += (h.y - cy) / (d || 1) * (70 - d); } }
        h.jink -= dt; if (h.jink <= 0) { h.jink = 0.4 + Math.random() * 0.7; h.ang = Math.atan2(fy || (Math.random() - 0.5), fx || (Math.random() - 0.5)) + (Math.random() - 0.5) * 1.6; if (Math.random() < 0.3 && near(h.x, h.y, 260)) O.animalCall && O.animalCall('hen', 0.3); }
        const sp = (fx || fy) ? 70 : 20, nx = h.x + Math.cos(h.ang) * sp * dt, ny = h.y + Math.sin(h.ang) * sp * dt; if (!game.solidAt(nx, ny - 2) && Math.hypot(nx - H.x0, ny - H.y0) < 180) { h.x = nx; h.y = ny; } else h.ang += Math.PI * 0.7; h.dir = Math.cos(h.ang) > 0 ? 2 : 1; h.flap = sp > 30;
        // the goodwife after it, stooping and missing
        const d = step(wa, h.x, h.y, 50, dt); wa.forceAnim = d < 14 ? 'pickup' : 'run'; if (d < 10 && Math.random() < dt * 0.6) { H.caughtAt = H.t; wa.forceAnim = 'celebrate'; O.Speech && O.Speech.say(w, 'Got you, you little wretch!', 2); }
        // or a quick child from the lane dives on it
        if (!H.kid && H.t > 8 && Math.random() < dt * 0.15) { const k = s.people.find((x) => x.age >= 6 && x.age <= 12 && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && !talking(x) && Math.hypot(x.agent.x - h.x, x.agent.y - h.y) < 200); if (k) { H.kid = k; O.Errands.send(s, k, [Math.floor(h.x / 16), Math.floor(h.y / 16)], { anim: 'pickup', secs: 0.6, face: 0, sprint: true, giveUp: game.t + 12, after: (ok) => { if (!H || H.caughtAt) return; if (ok && Math.random() < 0.6) { H.caughtAt = H.t; byKid++; O.Speech && O.Speech.say(k, 'Got her! Got her!', 1.6); O.gesture && O.gesture(k, 'celebrate', 1.5); try { s.relate(w, k, 0.1); } catch (e) { /* */ } setTimeout(() => O.Speech && O.Speech.say(w, `Oh, good lad, ${k.first}! There's a honey cake for you.`, 2.4), 900); } else O.Speech && O.Speech.say(k, 'Missed!', 1.2); } }); } }
        H.cry -= dt; if (H.cry <= 0) { H.cry = 3 + Math.random() * 2; if (near(wa.x, wa.y, 280)) O.Speech && O.Speech.say(w, pick(['Chook chook chook! Come here!', 'Somebody catch her! My best layer!', 'Oh, you stupid bird!']), 1.8); }
        return; }
      cool -= dt; if (cool > 0) return; cool = 300 + Math.random() * 300; const hr = s.minute / 60; if (hr < 8 || hr > 18) return;
      const w = s.people.find((q) => q.sex === 'f' && q.age >= 18 && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !talking(q) && q.home != null && (() => { const b = s.building(q.home); return b && b.doorX != null && near(b.doorX * 16, b.doorY * 16, 260); })()); if (!w) return;
      const b = s.building(w.home), a = w.agent; if (a.inside != null) { a.inside = null; a.hidden = false; } a.x = b.doorX * 16 + 8; a.y = (b.doorY + 1) * 16 + 8; a.frozen = true; a.path = null; w._hen = true;
      H = { s, wife: w, hen: { x: a.x + 30, y: a.y + 10, ft: 0, ang: 0, jink: 0, dir: 2, seed: O.hash('hen', w.id) % 9999, flap: true }, x0: a.x, y0: a.y, t: 0, cry: 0.5 };
      O.Speech && O.Speech.say(w, 'My hen! She\'s out! Stop her!', 2); });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!H || H.caughtAt || game.scene || P.locked) return null; const h = H.hen; if (Math.hypot(h.x - P.x, h.y - P.y) > 22) return null;
      return { type: 'custom', d: 22, x: h.x, y: h.y - 20, label: 'Grab the hen', act: () => { if (Math.random() < 0.7) { H.caughtAt = H.t; byYou++; P.anim = 'pickup'; setTimeout(() => { P.anim = 'idle'; }, 900); O.UI && O.UI.say && O.UI.say('You pounce, and come up with an armful of indignant hen.', 'good'); const w = H.wife, r = w.rel.get(0) || { affinity: 0, familiar: 0 }; r.affinity = Math.min(1, r.affinity + 0.12); r.familiar = Math.min(1, (r.familiar || 0) + 0.15); w.rel.set(0, r); setTimeout(() => O.Speech && O.Speech.say(w, pick(['Oh, bless you! Give her here, the wretch.', 'Thank you! She\'d have been in the pot of whoever caught her next.']), 2.6), 700); try { const s = cur(); s.remember(w, 'The stranger caught my runaway hen for me.', 'kindness', 0.4); } catch (e) { /* */ } }
        else { O.UI && O.UI.say && O.UI.say('You dive. The hen is not there. You are in the dirt, and the lane is laughing.', 'bad'); P.anim = 'hurt'; setTimeout(() => { P.anim = 'idle'; }, 900); H.hen.jink = 0; } } }; });
    game.hooks.drawWorld.push((ctx, cam) => { if (!H || game.scene || H.s !== cur() || H.caughtAt) return; const h = H.hen; try { const an = h.flap ? 'walk' : 'idle', HA = O.Animals.HANIMS[an], fr = O.Animals.animal('chicken', h.seed, h.dir, h.flap, Math.floor(h.ft * HA.fps * 1.5) % HA.frames, an); ctx.drawImage(fr, Math.round(h.x - cam.x - (fr.ox ?? fr.width / 2)), Math.round(h.y - cam.y - (fr.gy ?? fr.height))); } catch (e) { /* */ }
      if (h.flap && Math.floor(performance.now() / 120) % 2) { ctx.fillStyle = '#e8e2d4'; ctx.fillRect(Math.round(h.x - cam.x) - 6, Math.round(h.y - cam.y) - 9, 3, 2); ctx.fillRect(Math.round(h.x - cam.x) + 4, Math.round(h.y - cam.y) - 9, 3, 2); } });
    O.RunawayHen = { get byKid() { return byKid; }, get chase() { return H; }, get caught() { return caught; }, get byYou() { return byYou; }, soon: () => { cool = 0; } };
  }
  O.RunawayHenSetup = { setup };
})();
