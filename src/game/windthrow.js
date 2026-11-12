// Blown down. A storm takes a tree near the houses: a crack like a shot, a long tearing groan and it comes
// down across the ground with its roots in the air. The next while, the neighbours come out with axes and
// a saw and set about it, children climbing on the trunk, folk stopping to look and say they always knew
// that one would go. Take an axe to it with them and you go home with an armful of firewood and their
// thanks; when it's all cut, the logs are carried off and only the stump and the sawdust are left.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState, G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._blown && !q.visitor && !talking(q);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    let W = null, lastStorm = -9, stormSeen = false, cool = 30, force = false, downs = 0, yourWood = 0, cleared = 0;
    const bits = [];
    const rel_ = (q) => { if (!q || !q._blown) return; q._blown = false; q._cutting = false; if (q.agent) { q.agent.forceAnim = null; q.agent.lift = 0; if (!talking(q)) q.agent.frozen = false; } };
    function end() { if (!W) return; for (const q of W.crew) rel_(q); for (const q of W.gawk) rel_(q); W = null; }
    function blow(s) { const w = s.world, P = game.player;
      const cand = (w.trees || []).filter((t) => Math.hypot(t.x - P.x, t.y - P.y) < 380 && Math.hypot(t.x - P.x, t.y - P.y) > 60 && (s.world.buildings || []).some((b) => b.doorX != null && Math.hypot(b.doorX * T - t.x, b.doorY * T - t.y) < 220));
      const tr = pick(cand); if (!tr) return false; const dir = Math.random() < 0.5 ? 1 : -1;
      w.trees = w.trees.filter((x) => x !== tr); const tx = Math.floor(tr.x / T), ty = Math.floor((tr.y - 1) / T); if (w.solid) w.solid[ty * w.W + tx] = 0;
      w.props.push({ kind: 'stump', x: tr.x, y: tr.y - 1, seed: tr.seed || 1, v: 0, solid: false, felled: s.day, treeKind: tr.kind }); w.dirtyStatics = true;
      downs++; W = { s, x: tr.x, y: tr.y, kind: tr.kind, dir, ang: 0, t: 0, cut: 0, crew: [], gawk: [], you: false, youT: 0, given: 0, leaf: tr.kind === 'pine' ? '#2a5a3a' : tr.kind === 'birch' ? '#8ab05a' : s.season === 'autumn' ? '#c8781a' : s.season === 'winter' ? '#5a4a3a' : '#4a8a3a', chips: [] };
      if (near(tr.x, tr.y, 500)) { O.sfx && O.sfx('smack', 0.7); setTimeout(() => O.sfx && O.sfx('chop', 0.9), 400); O.UI && O.UI.say && O.UI.say('A crack like a shot, and a long tearing groan: a tree is coming down in the wind!', 'warn'); }
      return true; }
    // the neighbours come out to it
    function muster(s) { const n = W.crew.length; if (n >= 3) return; const q = s.people.filter((x) => free(x) && x.age >= 16 && x.age <= 62 && Math.hypot(x.agent.x - W.x, x.agent.y - W.y) < 420).sort((a, b) => (/wood|forest|carpenter|labourer|farmer/.test(b.job?.role || '') ? 1 : 0) - (/wood|forest|carpenter|labourer|farmer/.test(a.job?.role || '') ? 1 : 0))[0]; if (!q) return;
      q._blown = true; W.crew.push(q); const along = (n === 0 ? 1.2 : n === 1 ? 2.6 : 0.4) * W.dir; const tx = Math.floor((W.x + along * 16 + (n === 2 ? -12 * W.dir : 0)) / T), ty = Math.floor(W.y / T) + 1;
      if (near(q.agent.x, q.agent.y, 340)) say(q, pick(['I\'ll get my axe.', 'Well, that\'s firewood for the winter.', 'The old thing finally went.', 'Mind, mind! Let me look at it.']), 2);
      O.Errands.send(s, q, [tx, ty], { anim: 'chop', secs: 0.4, face: 0, giveUp: game.t + 40, after: (ok) => { if (!W || !W.crew.includes(q)) return; if (!ok) { rel_(q); W.crew.splice(W.crew.indexOf(q), 1); return; } q.agent.frozen = true; q.agent.path = null; q._cutting = true; } }); }
    function gawker(s) { if (W.gawk.length >= 2) return; const q = s.people.filter((x) => free(x) && Math.hypot(x.agent.x - W.x, x.agent.y - W.y) < 300)[0]; if (!q) return; q._blown = true; W.gawk.push(q); const kid = q.age < 13;
      O.Errands.send(s, q, [Math.floor((W.x + (kid ? 2 : 3.5) * 16 * W.dir) / T), Math.floor(W.y / T) + (kid ? 0 : 2)], { anim: kid ? 'celebrate' : 'look', secs: 0.4, face: 0, giveUp: game.t + 30, after: (ok) => { if (!W || !W.gawk.includes(q)) return; if (!ok) { rel_(q); return; } q.agent.frozen = true; q.agent.path = null; if (kid) q.agent.lift = 6; if (near(q.agent.x, q.agent.y, 300)) say(q, kid ? pick(['I\'m the king of the castle!', 'Look at me! Look how high!']) : pick(['I always said that one would go.', 'Roots and all! Look at that.', 'Lucky it missed the house.', 'A mercy nobody was under it.']), 2.2);
        setTimeout(() => { if (W && W.gawk.includes(q)) { q.agent.lift = 0; rel_(q); W.gawk.splice(W.gawk.indexOf(q), 1); } }, 12000 + Math.random() * 8000); } }); }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return;
      for (const b of bits.slice()) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 140 * dt; if (b.t > 1.2) bits.splice(bits.indexOf(b), 1); }
      const wk = (s.weather && s.weather.kind) || ''; if (wk === 'storm') { if (!stormSeen) { stormSeen = true; } lastStorm = s.day; } else stormSeen = false;
      if (W) { W.t += dt; if (W.s !== s || W.t > 900) { end(); return; } if (game.scene) return;
        if (W.ang < 1.5) { W.ang = Math.min(1.5, W.ang + (0.3 + W.ang * 2.4) * dt); if (W.ang >= 1.5 && !W.crashed) { W.crashed = true; if (near(W.x, W.y, 500)) O.sfx && O.sfx('smack', 0.8); for (let i = 0; i < 30; i++) bits.push({ x: W.x + W.dir * (14 + Math.random() * 30), y: W.y - Math.random() * 8, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 60, t: 0, c: Math.random() < 0.7 ? W.leaf : '#6a4a2c' }); for (const z of s.people) if (z.agent && !z.agent.hidden && z.agent.inside == null && Math.hypot(z.agent.x - W.x, z.agent.y - W.y) < 240) O.gesture && O.gesture(z, 'shocked', 1.4); } return; }
        const raining = wk === 'storm'; if (!raining && !W.cleared) { W.mt = (W.mt || 0) - dt; if (W.mt <= 0) { W.mt = 6; muster(s); if (Math.random() < 0.5) gawker(s); } }
        let rate = 0; for (const q of W.crew) if (q._cutting && q.agent.frozen) { rate += 1; q.agent.forceAnim = (Math.floor(W.t * 0.7 + q.id) % 5 === 0) ? 'wipe' : 'chop'; q.agent.dir = O.dirOf(W.x + W.dir * 20 - q.agent.x, W.y - q.agent.y); if (Math.random() < dt * 1.2 && near(q.agent.x, q.agent.y, 300)) { O.sfx && O.sfx('chop', 0.15); W.chips.push({ x: q.agent.x + (Math.random() - 0.5) * 16, y: q.agent.y + 2 }); } }
        if (W.you) { if (!near(W.x + W.dir * 24, W.y, 50)) { W.you = false; game.player.anim = 'idle'; } else { const P = game.player; P.anim = 'chop'; P.dir = O.dirOf(W.x + W.dir * 24 - P.x, W.y - P.y); rate += 1.4; W.youT += dt; if (Math.random() < dt * 1.5) O.sfx && O.sfx('chop', 0.25);
          if (W.youT > 10 && W.given < 3) { W.youT = 0; W.given++; yourWood++; if (G.firewood && PS.canCarry && PS.canCarry('firewood')) PS.add('firewood'); O.UI && O.UI.say && O.UI.say(W.given === 1 ? 'You split off a good armful of firewood. "Take it," they say, "you\'ve earned it."' : 'Another armful of firewood for you.', 'good'); } } }
        W.cut += rate * dt * 1.1;
        if (W.cut >= 100 && !W.cleared) { W.cleared = true; cleared++; const helped = W.given > 0;
          for (const q of W.crew) { try { for (const o of W.crew) if (o !== q) s.relate(q, o, 0.05); s.remember(q, helped ? 'We cut up the tree that came down in the storm; the stranger took an axe to it with us.' : 'We cut up the tree that came down in the storm.', 'social', 0.6); if (helped) { const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.08); r.familiar = Math.min(1, (r.familiar || 0) + 0.1); } } catch (e) { /* */ } }
          const sp = W.crew[0]; if (sp && near(sp.agent.x, sp.agent.y, 340)) say(sp, helped ? pick(['That\'s the last of it. Thank you, friend, we\'d have been at it till dark.', 'Done! Many hands.']) : pick(['That\'s the last of it.', 'Done. My arms!']), 2.4);
          if (helped) { try { O.TownTalk && O.TownTalk.tell(W.x, W.y, 'The stranger took an axe to the tree that came down in the storm, with the neighbours.', 'They say the stranger helped cut up the storm-fallen tree.'); } catch (e) { /* */ } if (PS.rep) PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.015); }
          W.you = false; game.player.anim = 'idle';
          // the logs carried off
          for (const q of W.crew.slice()) { q._cutting = false; q.agent.frozen = false; const h = q.home != null && s.building(q.home); O.Errands.send(s, q, h && h.doorX != null ? [h.doorX, h.doorY + 1] : [Math.floor(q.agent.x / T) + 6, Math.floor(q.agent.y / T)], { anim: 'place', secs: 0.8, face: 0, carry: { good: 'firewood', qty: 2 }, giveUp: game.t + 60, after: () => rel_(q) }); }
          W.crew = []; setTimeout(() => { if (W && W.cleared) { const left = W.chips; W.gone = true; for (const q of W.gawk) rel_(q); W.gawk = []; W.sawdust = left; } }, 1500); }
        if (W.gone && W.t > 900) end();
        return; }
      cool -= dt; if (cool > 0 && !force) return; cool = 40; if (game.scene) return; const hr = s.minute / 60;
      const go = force || (wk === 'storm' && Math.random() < 0.15) || (lastStorm === s.day - 1 && hr >= 7 && hr < 11 && !s._windthrown && Math.random() < 0.35); force = false;
      if (go && blow(s)) s._windthrown = s.day; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!W || W.gone || W.cleared || W.you || W.ang < 1.5 || game.scene || P.locked) return null; const x = W.x + W.dir * 24; if (Math.hypot(x - P.x, W.y - P.y) > 44) return null;
      return { type: 'custom', d: 2, x, y: W.y - 26, label: 'Take an axe to the fallen tree', act: () => { W.you = true; W.youT = 0; const q = W.crew.find((c) => c._cutting); if (q) say(q, pick(['Here, there\'s a spare axe. Mind your shins.', 'Good! Work from that end.']), 2.2); } }; });
    (O.extraLines = O.extraLines || []).push((s, q) => W && W.crew.includes(q) ? 'A tree came down in the storm near the houses and you are cutting it up with the neighbours.' : '');
    game.hooks.drawWorld.push((ctx, cam) => { if (!W || game.scene || W.s !== cur()) return; const x = Math.round(W.x - cam.x), y = Math.round(W.y - cam.y);
      // sawdust and chips
      ctx.fillStyle = '#d8c090'; for (const c of W.chips) ctx.fillRect(Math.round(c.x - cam.x), Math.round(c.y - cam.y), 2, 1);
      if (W.gone) return;
      const left = Math.max(0, 1 - W.cut / 100);
      const shade = (c, k) => { const n = parseInt(c.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const f2 = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f2(r)},${f2(g)},${f2(b)})`; };
      const crown = (cx, cy, sc) => { const R = O.RNG(O.hash('crown', Math.round(W.x), Math.round(W.y))); const cols = [shade(W.leaf, 0.7), W.leaf, shade(W.leaf, 1.25)];
        if (W.kind === 'pine') { for (let i = 0; i < 5; i++) { ctx.fillStyle = cols[i % 2]; ctx.fillRect(cx - 9 * sc + i * 2, cy - 4 - i * 3, Math.max(2, (18 - i * 3) * sc), 4); } return; }
        for (let i = 0; i < 16; i++) { const k = i < 6 ? 0 : i < 12 ? 1 : 2; const dx = Math.round((R.next() - 0.5) * 24 * sc), dy = Math.round((R.next() - 0.5) * 16 - (k === 2 ? 3 : 0)), w = 4 + Math.floor(R.next() * 5), h = 3 + Math.floor(R.next() * 3); ctx.fillStyle = cols[k]; ctx.fillRect(cx + dx - (w >> 1), cy + dy - (h >> 1), w, h); } };
      if (W.ang < 1.5) { // still coming down
        ctx.save(); ctx.translate(x, y - 3); ctx.rotate(W.ang * W.dir); ctx.fillStyle = W.kind === 'birch' ? '#e8e4dc' : '#6a4a2c'; ctx.fillRect(-3, -36, 6, 36); crown(0, -44, 1); ctx.restore(); }
      else { // lying along the ground, roots in the air
        const d = W.dir, len = Math.round(36 * (0.35 + 0.65 * left)), ty = y - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(Math.min(x, x + d * (len + 14)), y - 1, len + 16, 3);
        ctx.fillStyle = '#5a3e26'; ctx.fillRect(x - 3, ty - 9, 6, 15); ctx.fillStyle = '#6e5034'; ctx.fillRect(x - 2, ty - 7, 4, 11); ctx.fillStyle = '#3e2a18'; ctx.fillRect(x - 4, ty - 6, 1, 3); ctx.fillRect(x + 3, ty + 1, 1, 3); ctx.fillRect(x - 1, ty - 10, 1, 2); ctx.fillStyle = '#7a8a6a'; ctx.fillRect(x - 1, ty - 4, 2, 1);
        const bark = W.kind === 'birch' ? '#e8e4dc' : '#6a4a2c', dark = W.kind === 'birch' ? '#3a3a3a' : '#4a3018', lite = W.kind === 'birch' ? '#f6f4ee' : '#86603c';
        const x0 = d > 0 ? x + 3 : x - 3 - len; ctx.fillStyle = bark; ctx.fillRect(x0, ty - 2, len, 5); ctx.fillStyle = lite; ctx.fillRect(x0, ty - 2, len, 1); ctx.fillStyle = dark; ctx.fillRect(x0, ty + 2, len, 1); for (let i = 4; i < len - 2; i += 7) ctx.fillRect(x0 + i, ty, W.kind === 'birch' ? 2 : 1, 1);
        if (left < 1) { ctx.fillStyle = '#e0c690'; ctx.fillRect(d > 0 ? x0 + len - 1 : x0, ty - 2, 1, 5); }
        if (left > 0.45) { const ex = x + d * (len + 6); ctx.fillStyle = bark; ctx.fillRect(Math.min(ex, ex - d * 6), ty - 5, 6, 1); ctx.fillRect(Math.min(ex, ex - d * 4), ty + 3, 4, 1); crown(ex + d * 8, ty - 3, left); } }
      // cut logs stacked beside it
      const logs = Math.floor(W.cut / 20); for (let i = 0; i < logs; i++) { const lx = x + W.dir * 8 - 10 + (i % 3) * 7, ly = y + 10 - Math.floor(i / 3) * 4; ctx.fillStyle = '#6a4a2c'; ctx.fillRect(lx, ly, 6, 4); ctx.fillStyle = '#d8b880'; ctx.fillRect(lx + (W.dir > 0 ? 5 : 0), ly, 1, 4); }
      for (const b of bits) { ctx.globalAlpha = Math.max(0, 1 - b.t / 1.2); ctx.fillStyle = b.c; ctx.fillRect(Math.round(b.x - cam.x), Math.round(b.y - cam.y), 2, 1); } ctx.globalAlpha = 1; });
    O.Windthrow = { get tree() { return W; }, get downs() { return downs; }, get yourWood() { return yourWood; }, get cleared() { return cleared; }, soon: () => { cool = 0; force = true; } };
  }
  O.WindthrowSetup = { setup };
})();
