// The bull is out! Now and then a farm bull breaks its tether and comes trotting up the lane, head down,
// snorting; people scream and scatter into doorways and behind carts, a child is snatched up out of its
// way, the dogs go mad. Then the farm men come running with sticks and a rope, head it off, get the rope
// on its ring at last and lead it home, blowing, while everyone comes out again talking about it.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let B = null, cool = 300, caught = 0, hero = null;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._bull && !q._bit && !q._scene && !talking(q);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._bull = false; }
    function end() { if (!B) return; for (const q of B.men) rel(q); B = null; }
    function step(a, tx, ty, v, dt) { const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1.5) return d; const st = Math.min(d, v * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; a.stuck = a.stuck || 0;
      if (!game.solidAt(nx, ny - 2) || a.stuck > 1) { a.x = nx; a.y = ny; if (a.stuck > 1) a.stuck = 0; } else if (!game.solidAt(nx, a.y - 2)) a.x = nx; else if (!game.solidAt(a.x, ny - 2)) a.y = ny; else a.stuck += dt; a.dir = O.dirOf(dx, dy); return d; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (B) { B.t += dt; if (B.s !== s || B.t > 120) { end(); return; } const b = B.bull; b.ft += dt;
        if (B.phase === 'loose') { // trot about the lanes, turning when it meets a wall, now and then pawing
          b.turn -= dt; if (b.turn <= 0) { b.turn = 2 + Math.random() * 3; b.ang = Math.random() * Math.PI * 2; b.paw = Math.random() < 0.3 ? 1.5 : 0; if (near(b.x, b.y, 300)) O.animalCall && O.animalCall('cow', 0.5); }
          if (b.paw > 0) { b.paw -= dt; b.moving = false; } else { const nx = b.x + Math.cos(b.ang) * 46 * dt, ny = b.y + Math.sin(b.ang) * 32 * dt; if (game.solidAt(nx, ny - 2) || Math.hypot(nx - B.x0, ny - B.y0) > 260) { b.ang += Math.PI * (0.6 + Math.random() * 0.8); } else { b.x = nx; b.y = ny; } b.moving = true; b.dir = Math.cos(b.ang) > 0 ? 2 : 1; }
          // everyone near scatters
          for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || q._bull || q.errand || talking(q)) continue; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 70 && !a.frozen) { const tx = Math.floor((a.x + (a.x - b.x) / (d || 1) * 90) / T), ty = Math.floor((a.y + (a.y - b.y) / (d || 1) * 60) / T); q._bullScared = game.t; O.Errands.send(s, q, [tx, ty], { anim: 'shocked', secs: 2, face: 0, sprint: true, giveUp: game.t + 12 }); if (Math.random() < 0.3 && near(a.x, a.y, 300)) O.Speech && O.Speech.say(q, pick(['The bull! The BULL!', 'Run! Get inside!', 'Mother of God!', 'Get the children in!']), 1.6); } }
          // the men catch up with it
          if (B.t > 12 && B.men.length) { let close = 0; for (const [i, q] of B.men.entries()) { const a = q.agent, ang = B.t * 0.8 + i * Math.PI; const d = step(a, b.x + Math.cos(ang) * 24, b.y + Math.sin(ang) * 16, 62, dt); a.forceAnim = 'run'; if (d < 30) close++; } if (close === B.men.length && B.t > 22) { B.phase = 'rope'; B.k = 0; if (near(b.x, b.y, 300)) O.Speech && O.Speech.say(B.men[0], pick(['Now! Get the rope on him!', 'Easy, boy, easy... GOT him!', 'Hold his head! Hold it!']), 2.4); } }
          else for (const q of B.men) { step(q.agent, b.x, b.y, 58, dt); q.agent.forceAnim = 'run'; } }
        if (B.phase === 'rope') { B.k += dt; b.moving = false; for (const q of B.men) { q.agent.forceAnim = B.k < 3 ? 'pitch' : 'idle'; q.agent.dir = q.agent.x < b.x ? 2 : 1; } if (B.k > 4) { B.phase = 'home'; hero = B.men[0] || null; caught++; if (near(b.x, b.y, 340)) setTimeout(() => B && O.Speech && O.Speech.say(B.men[1] || B.men[0], pick(['Who left the gate open? I\'ll have his hide.', 'He\'ll be in the stew pot, that one.', 'That\'s enough excitement for one day.']), 2.6), 1500); } }
        if (B.phase === 'home') { const lead = B.men[0].agent; const d = step(lead, B.home[0], B.home[1], 26, dt); lead.forceAnim = 'walk'; const bx = lead.x + (lead.x > b.x ? -18 : 18), by = lead.y; b.x += (bx - b.x) * Math.min(1, dt * 2); b.y += (by - b.y) * Math.min(1, dt * 2); b.moving = true; b.dir = lead.x > b.x ? 2 : 1; for (const q of B.men.slice(1)) { step(q.agent, b.x - 16, b.y + 8, 30, dt); q.agent.forceAnim = 'walk'; } if (d < 4 || B.t > 110) { end(); return; } }
        return; }
      cool -= dt; if (cool > 0) return; cool = 500 + Math.random() * 600; if (hr < 9 || hr > 17) return;
      const farm = s.world.buildings.find((x) => (x.type === 'farmhouse' || x.type === 'barn') && x.doorX != null && Math.hypot(x.doorX * T - game.player.x, x.doorY * T - game.player.y) < 900) || null;
      const P = game.player; let bx = P.x + 160, by = P.y; for (const [ox, oy] of [[160, 0], [-160, 0], [0, 120], [0, -120], [100, 80]]) if (!game.solidAt(P.x + ox, P.y + oy - 2)) { bx = P.x + ox; by = P.y + oy; break; }
      const men = s.people.filter((q) => able(q) && q.sex === 'm' && q.age >= 16 && q.age <= 55 && !q.agent.hidden && q.agent.inside == null && near(q.agent.x, q.agent.y, 600)).slice(0, 2); if (men.length < 1) { cool = 30; return; }
      for (const q of men) { q._bull = true; q.agent.frozen = true; q.agent.path = null; q.agent.stuck = 0; }
      B = { s, bull: { x: bx, y: by, dir: 1, ft: 0, moving: true, ang: Math.random() * 6, turn: 0, paw: 0, seed: 777 }, x0: bx, y0: by, men, t: 0, phase: 'loose', home: farm ? [farm.doorX * T + 8, (farm.doorY + 2) * T] : [bx + 300, by] };
      if (near(bx, by, 400)) O.animalCall && O.animalCall('cow', 0.8);
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (!B || game.scene || B.s !== cur()) return; const b = B.bull;
      try { const HA = O.Animals.HANIMS[b.moving ? (B.phase === 'loose' ? 'gallop' : 'walk') : 'idle']; const fr = O.Animals.animal('cow', b.seed, b.dir, b.moving, Math.floor(b.ft * HA.fps) % HA.frames, b.moving ? (B.phase === 'loose' ? 'gallop' : 'walk') : 'idle'); ctx.drawImage(fr, Math.round(b.x - cam.x - (fr.ox ?? fr.width / 2)), Math.round(b.y - cam.y - (fr.gy ?? fr.height))); } catch (e) { /* */ }
      // the nose-ring, the snort, and the rope when he's caught
      const hx = Math.round(b.x - cam.x) + (b.dir === 2 ? 13 : -14), hy = Math.round(b.y - cam.y) - 9; ctx.fillStyle = '#c8c8c0'; ctx.fillRect(hx, hy, 2, 2);
      if (B.phase === 'loose' && Math.floor(performance.now() / 400) % 3 === 0) { ctx.fillStyle = 'rgba(230,230,230,0.6)'; ctx.fillRect(hx + (b.dir === 2 ? 3 : -4), hy - 1, 2, 1); ctx.fillRect(hx + (b.dir === 2 ? 5 : -6), hy - 2, 1, 1); }
      if (B.phase !== 'loose' && B.men[0]) { const a = B.men[0].agent; ctx.strokeStyle = '#a8946a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + 1, hy + 1); ctx.lineTo(Math.round(a.x - cam.x), Math.round(a.y - cam.y) - 12); ctx.stroke(); } });
    (O.extraLines = O.extraLines || []).push((s, q) => !B ? '' : q._bull ? 'A bull has got loose in the town and you are one of the men trying to catch it with a rope.' : q._bullScared && game.t - q._bullScared < 120 ? 'A bull got loose in the street just now and nearly had you! You are still shaking.' : '');
    // you can grab his rope yourself, if you dare
    let grabbed = 0;
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!B || B.phase !== 'loose' || game.scene || P.locked) return null; const b = B.bull; if (Math.hypot(b.x - P.x, b.y - P.y) > 30) return null;
      return { type: 'custom', d: 30, x: b.x, y: b.y - 26, label: 'Grab the bull by the nose-ring rope', act: () => { if (!B) return; const P = game.player; P.anim = 'pitch'; P.locked = true; setTimeout(() => { P.locked = false; P.anim = 'idle'; }, 1200);
        const sk = (O.PlayerState && O.PlayerState.skills && (O.PlayerState.skills.fighting || O.PlayerState.skills.farming)) || 0;
        if (Math.random() < 0.55 + sk * 0.4) { grabbed++; B.phase = 'rope'; B.k = 0; O.UI && O.UI.say && O.UI.say('You get a hand on the rope and hang on. He tosses his head, and then he stands, blowing.', 'good'); if (B.men[0]) O.Speech && O.Speech.say(B.men[0], pick(['Well held! Well held!', 'God\'s teeth, you\'ve a grip on you!', 'Hold him there, I\'m coming!']), 2.4); if (O.PlayerState && O.PlayerState.rep) O.PlayerState.rep.civilian = (O.PlayerState.rep.civilian || 0) + 0.03; }
        else { O.UI && O.UI.say && O.UI.say('He swings his head and throws you off into the dirt.', 'bad'); setTimeout(() => { P.anim = 'hurt'; }, 200); if (O.PlayerState) O.PlayerState.hp = Math.max(5, (O.PlayerState.hp || 50) - 6); } } }; });
    O.LooseBull = { get hero() { return hero; }, get grabbed() { return grabbed; }, get bull() { return B; }, get caught() { return caught; }, soon: () => { cool = 0; } };
  }
  O.LooseBullSetup = { setup };
})();
