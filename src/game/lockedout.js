// Locked out. It isn't only you who loses a key. Now and then a townsman comes home, pats every pocket at
// his own door and finds nothing: he rattles the latch, swears, sits down on the step. The key is lying
// somewhere along the way he came, glinting in the dirt; find it and hand it back, or climb in at his back
// window and unbar the door for him (the neighbours may shout before they see who it is), or he waits
// until a neighbour fetches the smith to lift the lock. Whichever, the town remembers who helped.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    let L = null, acc = 60, n = 0, found = 0, climbed = 0, smith = 0;
    const rel_ = (q) => { if (!q) return; q._locked = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } };
    function relOf(q) { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; }
    function begin(s, q) { const b = s.building(q.home); if (!b || b.doorX == null) return false; const W = s.world;
      // the key: dropped somewhere on the street within a short walk, on open ground
      let k = null; for (let i = 0; i < 30 && !k; i++) { const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 90, x = b.doorX * T + 8 + Math.cos(a) * r, y = (b.doorY + 1) * T + Math.abs(Math.sin(a)) * r; if (!game.solidAt(x, y) && !W.solid[Math.floor(y / T) * W.W + Math.floor(x / T)]) k = { x, y }; }
      if (!k) return false; n++; L = { s, q, b, key: k, t: 0, stage: 'walk' }; q._locked = true;
      O.Errands.send(s, q, [b.doorX, b.doorY + 1], { anim: 'shake', secs: 1.5, face: 0, giveUp: game.t + 40, after: (ok) => { if (!L || L.q !== q) return; if (!ok) { end(); return; } L.stage = 'step'; L.t = 0; q.agent.frozen = true; q.agent.path = null; q.agent.forceAnim = 'sit';
        if (near(q.agent.x, q.agent.y, 340)) { say(q, pick(['My key! Where\'s my blessed key?', 'Locked out of my own house. Again.', 'I had it this morning, I swear I had it.']), 2.6); ui(`${q.first} is patting every pocket at their own door. Locked out.`, 'info'); } } });
      return true; }
    function end() { if (!L) return; rel_(L.q); L = null; }
    function letIn(how) { if (!L) return; const { s, q, b } = L; const r = relOf(q); if (how !== 'smith') { r.affinity = Math.min(1, r.affinity + 0.15); r.familiar = Math.min(1, (r.familiar || 0) + 0.15); try { s.remember(q, how === 'key' ? 'The stranger found my lost key in the street and brought it back.' : 'Locked out, and the stranger climbed in at my window and let me in.', 'social', 0.7, 0); } catch (e) { /* */ } if (PS.deeds) PS.deeds.push({ t: `${PS.name || 'The stranger'} helped ${q.first} back into their house`, day: s.day, place: s.world.placeId }); }
      q.agent.forceAnim = null; say(q, how === 'key' ? pick(['My key! Bless you. Where was it?', 'You found it! I\'d have been on this step all night.']) : how === 'smith' ? 'At last. Thank you, master smith.' : pick(['You\'re a marvel. Come in, have a cup.', 'Ha! Thank you. Mind the pots.']), 2.4); O.gesture && O.gesture(q, how === 'smith' ? 'nod' : 'celebrate', 1.2); O.sfx && O.sfx('door', 0.4);
      setTimeout(() => { if (!L || L.q !== q) return; const qq = q; end(); try { qq.agent.x = b.doorX * T + 8; qq.agent.y = (b.doorY + 1) * T; } catch (e) { /* */ } }, 2400); }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      if (L) { L.t += dt; if (L.s !== s || L.q.alive === false) { end(); return; }
        // a neighbour sends for the smith in the end
        if (L.stage === 'step' && L.t > 75 && !L.smith) { L.smith = true; const sm = s.people.find((q) => /smith/.test(q.job?.role || '') && q.agent && !q.errand && !talking(q) && q.alive !== false); if (!sm) { L.t = 0; L.smith = false; return; } smith++;
          if (!near(sm.agent.x, sm.agent.y, 700)) { sm.agent.inside = null; sm.agent.hidden = false; sm.agent.x = L.b.doorX * T + 300; sm.agent.y = (L.b.doorY + 2) * T; sm.agent.path = null; }
          O.Errands.send(s, sm, [L.b.doorX + 1, L.b.doorY + 1], { anim: 'hammer', secs: 3, face: 2, giveUp: game.t + 60, after: (ok) => { if (L && L.q && ok) letIn('smith'); else end(); } }); }
        if (L && L.t > 200) end(); return; }
      acc -= dt; if (acc > 0) return; acc = 150 + Math.random() * 150; const h = s.minute / 60; if (h < 8 || h > 20) return;
      const q = s.people.find((q) => q.age >= 18 && q.home != null && q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand && !q.gang && !talking(q) && !q._coup && !q._well && !q._tolet && near(q.agent.x, q.agent.y, 260) && !near(q.agent.x, q.agent.y, 60)); if (q) begin(s, q); });
    // the key in the dirt
    game.hooks.drawGround.push((ctx, cam) => { if (!L || L.stage === 'walk' && L.t < 2 || game.scene || L.s !== cur()) return; const k = L.key, x = Math.round(k.x - cam.x), y = Math.round(k.y - cam.y), gl = Math.sin(performance.now() / 300) > 0.6;
      ctx.fillStyle = '#7a6a3a'; ctx.fillRect(x - 3, y - 1, 3, 3); ctx.fillRect(x, y, 5, 1); ctx.fillRect(x + 3, y + 1, 1, 1); ctx.fillStyle = '#c8b060'; ctx.fillRect(x - 2, y, 1, 1); if (gl) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(x + 1, y - 2, 1, 1); } });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!L || L.found || game.scene || P.locked || L.s !== cur()) return null; if (!near(L.key.x, L.key.y, 20)) return null;
      return { type: 'custom', d: 1, x: L.key.x, y: L.key.y - 24, label: `Pick up the key glinting in the dirt`, act: () => { P.anim = 'take'; setTimeout(() => { P.anim = 'idle'; }, 700); L.found = true; found++; ui(`An iron door key, muddy. ${L.stage === 'step' ? `${L.q.first} is sitting on their step, locked out.` : 'Somebody will be missing this.'}`, 'info'); } }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!L || !L.found || L.stage !== 'step' || game.scene || P.locked) return null; const a = L.q.agent; if (!near(a.x, a.y, 40)) return null;
      return { type: 'custom', d: 1, x: a.x, y: a.y - 30, label: `Give ${L.q.first} their key`, act: () => { O.NpcActs && O.NpcActs.fly && O.NpcActs.fly('player', L.q, 'key'); P.anim = 'give'; setTimeout(() => { P.anim = 'idle'; }, 800); letIn('key'); } }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!L || L.found || L.stage !== 'step' || game.scene || P.locked || L.smith) return null; const b = L.b; if (!near(b.doorX * T + 30, (b.doorY + 1) * T, 30)) return null;
      return { type: 'custom', d: 2, x: b.doorX * T + 30, y: b.doorY * T - 16, label: `Climb in at the back for ${L.q.first}`, act: () => { P.locked = true; P.anim = 'hammer'; P.lift = 10; climbed++; const s = cur(); const w = s.people.find((z) => z !== L.q && z.age >= 12 && z.agent && !z.agent.hidden && z.agent.inside == null && !talking(z) && near(z.agent.x, z.agent.y, 200)); if (w) { O.gesture && O.gesture(w, 'shocked', 1.4); say(w, pick(['Oi! Thief! ...Oh, it\'s for them. Go on, then.', 'What are you... ah. Locked out, is it?']), 2.4); }
        setTimeout(() => { P.lift = 0; P.locked = false; P.anim = 'idle'; ui('You wriggle through the shutter, drop onto a stranger\'s floor, and unbar the door from inside.', 'info'); letIn('climb'); }, 2600); } }; });
    // in your own words
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) { try { const t = String(text || ''); if (L && L.q === q && L.stage === 'step') { if (L.found && /\b(key|here|found|yours)\b/i.test(t)) { O.NpcActs && O.NpcActs.fly && O.NpcActs.fly('player', q, 'key'); const r = respond(q, t, 'My key! Where on earth was it?', render); setTimeout(() => letIn('key'), 600); return r; }
        if (/\b(climb|window|let you in|help)\b/i.test(t) && !L.found) return respond(q, t, 'Would you? The back shutter doesn\'t latch properly. Round the side, there.', render); } } catch (e) { console.error(e); } return _say.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => L && q === L.q ? 'You have lost your house key and are locked out, sitting on your own doorstep. You came along the street from the market; it must have dropped out somewhere.' : '');
    O.LockedOut = { begin, get case() { return L; }, get n() { return n; }, get found() { return found; }, get climbed() { return climbed; }, get smith() { return smith; }, soon: () => { acc = 0; } };
  }
  O.LockedOutSetup = { setup };
})();
