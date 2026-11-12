// Take the ferry. When the boat is in at the landing on your side, pay the ferryman his penny and step
// aboard: he leans on the pole, the water slides by, the far bank comes up, the boat bumps the landing
// and you step off on the other side. He won't cross in a storm; and if you've not a penny, you can take
// the second pole and work your passage.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    let R = null, rides = 0, worked = 0;
    const F = () => O.Ferry && O.Ferry.F;
    const boatAt = (f) => [f.a[0] + (f.b[0] - f.a[0]) * f.k, f.a[1] + (f.b[1] - f.a[1]) * f.k];
    const landBeyond = (s, f, end) => { const w = s.world, from = end === 'a' ? f.b : f.a, to = end === 'a' ? f.a : f.b; const sx = Math.sign(to[0] - from[0]), sy = Math.sign(to[1] - from[1]); for (let n = 1; n < 5; n++) { const tx = Math.floor(to[0] / T) + sx * n, ty = Math.floor(to[1] / T) + sy * n; if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H) break; const i = ty * w.W + tx; if (!w.solid[i] && !(w.TER && w.ter[i] === w.TER.WATER)) return [tx * T + 8, ty * T + 10]; } return null; };
    const storm = (s) => { const k = (s.weather && s.weather.kind) || ''; return k === 'storm' || k === 'hail'; };
    const night = () => game.isNight && game.isNight();
    function board(s, f, work) { const end = f.k < 0.5 ? 'a' : 'b'; R = { s, f, from: end, to: end === 'a' ? 'b' : 'a', t: 0, work, said: 0 }; rides++; if (work) worked++; f.wait = Math.min(f.wait, 1.2); f.dir = end === 'a' ? 1 : -1; O.sfx && O.sfx('splash', 0.2);
      ui(work ? 'The ferryman hands you the second pole. "Push when I push."' : pick(['You drop a penny in the ferryman\'s hand and step down onto the boards.', 'A penny, and you\'re aboard. The boat dips under you.']), 'good'); }
    game.hooks.update.push((dt) => { const s = cur(), f = F(); if (!R) return; const P = game.player;
      if (!s || !f || R.s !== s || game.scene) { R = null; return; }
      R.t += dt; const [x, y] = boatAt(f); P.x = x + 6; P.y = y + 1; P.locked = true; P.anim = R.work && f.wait <= 0 ? 'pitch' : 'idle'; P.dir = 0;
      if (f.wait <= 0 && R.t > 4 && R.said < 1) { R.said = 1; ui(pick(['The water slides by, brown and quick. The ferryman hums.', '"Low today," says the ferryman. "Had a pike this long off the landing Tuesday."', 'A heron lifts off the far bank as you come over.']), 'info'); }
      if (R.t > 2 && f.wait > 0 && ((R.to === 'b' && f.k >= 0.999) || (R.to === 'a' && f.k <= 0.001))) { const land = landBeyond(s, f, R.to); if (land) { P.x = land[0]; P.y = land[1]; } P.locked = false; P.anim = 'idle'; R = null; O.sfx && O.sfx('place', 0.2); ui('The boat bumps the landing and you step off onto the far bank.', 'good'); if (O.Ferry) { /* */ } } });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), f = F(), P = game.player; if (R || !s || !f || f.s !== s || game.scene || P.locked) return null; if (!(f.wait > 0) || (f.k > 0.001 && f.k < 0.999)) return null; const [x, y] = boatAt(f); if (Math.hypot(x - P.x, y - P.y) > 44) return null;
      if (night()) return { type: 'custom', d: 3, x, y: y - 30, label: 'The ferry is tied up for the night', act: () => ui('The ferryman is gone home. The boat knocks against the landing, tied up till morning.', 'info') };
      if (storm(s)) return { type: 'custom', d: 3, x, y: y - 30, label: 'Ask the ferryman to take you across', act: () => ui('"Not in this," says the ferryman, not even looking up. "Not for a king\'s ransom."', 'info') };
      if ((PS.money || 0) >= 1) return { type: 'custom', d: 2, x, y: y - 30, label: 'Pay the ferryman ₳1 and step aboard', act: () => { PS.money -= 1; board(s, f, false); } };
      return { type: 'custom', d: 2, x, y: y - 30, label: 'Offer to work your passage on the second pole', act: () => board(s, f, true) }; });
    // townsfolk ride too: a passenger or two from the landing, a penny to the ferryman, off on the far side
    const riders = []; let npcRides = 0, rcool = 4;
    game.hooks.update.push((dt) => { const s = cur(), f = F(); if (!s || !f || f.s !== s || game.scene) { for (const r of riders.splice(0)) { r.q._ferry = false; r.q.agent.frozen = false; } return; }
      const [bx, by] = boatAt(f);
      for (const r of riders.slice()) { const q = r.q, a = q.agent; if (q.alive === false) { riders.splice(riders.indexOf(r), 1); continue; } a.x = bx - 8 + r.i * 7; a.y = by + 1; a.frozen = true; a.path = null; a.forceAnim = 'idle'; a.dir = 0; r.t += dt;
        if (r.t > 2 && f.wait > 0 && ((r.to === 'b' && f.k >= 0.999) || (r.to === 'a' && f.k <= 0.001))) { riders.splice(riders.indexOf(r), 1); const land = landBeyond(s, f, r.to); if (land) { a.x = land[0] + (r.i ? 8 : -8); a.y = land[1]; } a.frozen = false; a.forceAnim = null; q._ferry = false; npcRides++;
          const doors = s.world.buildings.filter((b) => b.doorX != null && !b.ruined && Math.hypot(b.doorX * T - a.x, b.doorY * T - a.y) < 400); const d = pick(doors); if (d && O.Errands) O.Errands.send(s, q, [d.doorX, d.doorY + 1], { anim: 'open', secs: 0.5, face: 0, giveUp: game.t + 60 }); } }
      if (riders.length) f.n = 0;
      rcool -= dt; if (rcool > 0 || night() || storm(s) || !(f.wait > 1.2) || (f.k > 0.001 && f.k < 0.999) || riders.length >= 2) return; rcool = 3;
      const end = f.k < 0.5 ? 'a' : 'b';
      const q = s.people.find((x) => x.alive !== false && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && !x._ferry && !x._scene && x.age >= 10 && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === x) && Math.hypot(x.agent.x - bx, x.agent.y - by) < 140 && Math.hypot(x.agent.x - bx, x.agent.y - by) > 10);
      if (!q || Math.random() < 0.5) return; q._ferry = true; riders.push({ q, to: end === 'a' ? 'b' : 'a', i: riders.length, t: 0 }); try { const hh = s.household(q); if (hh && hh.money >= 1) hh.money -= 1; } catch (e) { /* */ } if (Math.hypot(bx - game.player.x, by - game.player.y) < 300) O.sfx && O.sfx('splash', 0.12); });
    O.FerryRide = { get ride() { return R; }, get rides() { return rides; }, get worked() { return worked; }, get npcRides() { return npcRides; }, riders };
  }
  O.FerryRideSetup = { setup };
})();
