// Rough music for one of their own. When the town has turned against somebody (a cheat, a bully, a thief
// who got off, someone half the lane won't speak to), of an evening a knot of neighbours gathers at their
// door with pots and ladles and a tin tray, beating and jeering and hooting their name, until the door opens
// on a white face, or the noise wears out. You can pick up a pan and join them; or stand in front of the door
// and tell them to go home, which works if they think enough of you, and if they don't, they'll remember
// whose side you took.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._nrough && !q.visitor && !talking(q);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const dislike = (a, b) => ((a.rel.get(b.id) || {}).affinity || 0) < -0.3;
    let R = null, cool = 200, force = false, held = 0, joined = 0, stopped = 0, failedStop = 0; const lastFor = new Map();
    const rel_ = (q) => { if (!q || !q._nrough) return; q._nrough = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } };
    function end() { if (!R) return; for (const q of R.crowd) rel_(q); if (R.you) game.player.anim = 'idle'; R = null; }
    function begin(s) { const P = game.player;
      // somebody the lane has turned on, at home, near you
      const cands = s.people.filter((q) => q.alive !== false && q.age >= 18 && q.home != null && q.agent && q.agent.inside === q.home && (lastFor.get(q.id) || -9) < s.day - 6).map((q) => [q, s.people.filter((z) => z !== q && z.household !== q.household && z.age >= 12 && dislike(z, q))]).filter(([q, h]) => h.length >= 4 && (() => { const b = s.building(q.home); return b && b.doorX != null && near(b.doorX * T, b.doorY * T, 420); })());
      const c = pick(cands); if (!c) return false; const [tq, haters] = c; const b = s.building(tq.home);
      const crowd = haters.filter((z) => free(z) && Math.hypot(z.agent.x - b.doorX * T, z.agent.y - b.doorY * T) < 500).slice(0, 5); if (crowd.length < 3) return false;
      held++; lastFor.set(tq.id, s.day); R = { s, tq, b, crowd, t: 0, beat: 1, jeer: 3, x: b.doorX * T + 8, y: (b.doorY + 2) * T };
      crowd.forEach((z, i) => { z._nrough = true; O.Errands.send(s, z, [b.doorX - 2 + i, b.doorY + 2 + (i % 2)], { anim: 'hammer', secs: 0.2, face: 3, giveUp: game.t + 40, after: (ok) => { if (!R || !R.crowd.includes(z)) return; if (!ok) { rel_(z); return; } z.agent.frozen = true; z.agent.path = null; z.agent.dir = 3; z._at = true; } }); });
      if (near(R.x, R.y, 420)) ui(`A clatter of pans from ${tq.first}'s door: the neighbours are out with rough music.`, 'info'); return true; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      if (R) { R.t += dt; const { tq, crowd } = R; if (R.s !== s || R.t > 70 || tq.alive === false) { end(); return; }
        for (const z of crowd) if (z._at && z.agent.frozen) { z.agent.forceAnim = Math.floor(R.t * 3 + z.id) % 2 ? 'hammer' : 'attack'; z.agent.dir = 3; }
        R.beat -= dt; if (R.beat <= 0) { R.beat = 0.35 + Math.random() * 0.3; if (near(R.x, R.y, 380)) O.sfx && O.sfx(Math.random() < 0.5 ? 'smack' : 'place', 0.12); }
        R.jeer -= dt; if (R.jeer <= 0) { R.jeer = 3 + Math.random() * 3; const z = pick(crowd.filter((c) => c._at)); if (z && near(z.agent.x, z.agent.y, 340)) say(z, pick([`Come out, ${tq.first}!`, `Shame on you, ${tq.first}!`, `We know what you are, ${tq.first}!`, `Show your face!`]), 1.8); }
        if (R.you) { const P = game.player; if (!near(R.x, R.y, 80)) { R.you = false; P.anim = 'idle'; } else { P.anim = Math.floor(R.t * 3) % 2 ? 'hammer' : 'attack'; P.dir = 3; } }
        if (R.t > 45 && !R.out) { R.out = true; const a = tq.agent; const b = R.b; a.inside = null; a.hidden = false; a.x = b.doorX * T + 8; a.y = (b.doorY + 1) * T + 6; a.frozen = true; tq._nrough = true; crowd.push(tq); a.forceAnim = 'shake'; if (near(a.x, a.y, 340)) say(tq, pick(['Go home! All of you! Go home!', 'I\'ve done nothing you haven\'t!', '...Leave me be. Please.']), 2.6); try { s.remember(tq, 'The neighbours came to my door with rough music, banging pans and calling me names.', 'loss', 1.6); for (const z of crowd) if (z !== tq) s.relate(tq, z, -0.1); } catch (e) { /* */ } }
        if (R.t > 55) end();
        return; }
      cool -= dt; if (cool > 0 && !force) return; cool = 240 + Math.random() * 240; const hr = s.minute / 60; if (!force && (hr < 18 || hr > 21.5 || s.raining)) return; force = false; begin(s); });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!R || R.you || R.decided || game.scene || P.locked) return null; if (!near(R.x, R.y, 60)) return null;
      return { type: 'custom', d: 2, x: R.x - 20, y: R.y - 34, label: 'Pick up a pan and join the rough music', act: () => { R.you = true; R.decided = true; joined++; const s = cur(), tq = R.tq; for (const z of R.crowd) { if (z === tq) continue; const r = relOf(z); r.affinity = Math.min(1, r.affinity + 0.05); } const r = relOf(tq); r.affinity = Math.max(-1, r.affinity - 0.3); try { s.remember(tq, 'The stranger came banging a pan at my door with the rest of them.', 'grudge', 1.2, 0); if (O.grudge) O.grudge(s, tq, 'joined the rough music at my door', 0.3); } catch (e) { /* */ } ui(`You bang a pan with the rest of them. ${tq.first}'s door stays shut.`, 'info'); } }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!R || R.decided || game.scene || P.locked) return null; if (!near(R.x, R.y - 16, 40)) return null;
      return { type: 'custom', d: 3, x: R.x + 20, y: R.y - 48, label: 'Stand at the door and tell them to go home', act: () => stand(cur()) }; });
    function stand(s) { if (!R) return; R.decided = true; const tq = R.tq, crowd = R.crowd.filter((z) => z !== tq); const P = game.player; P.anim = 'point'; setTimeout(() => { P.anim = 'idle'; }, 1200);
      const regard = crowd.reduce((a, z) => a + relOf(z).affinity, 0) / Math.max(1, crowd.length) + ((PS.rep && PS.rep.civilian) || 0) * 0.5;
      if (regard > 0.15 || Math.random() < 0.15) { stopped++; ui('"Enough. Go home, the lot of you." They look at each other, and one by one they lower their pans.', 'good'); const z0 = crowd[0]; if (z0) say(z0, pick(['Hm. If you say so.', 'Well. For your sake, then.', 'You\'re too soft. But all right.']), 2.2); const r = relOf(tq); r.affinity = Math.min(1, r.affinity + 0.35); try { s.remember(tq, 'When the neighbours came with rough music, the stranger stood at my door and sent them home.', 'kindness', 1.6); if (tq.grudge) tq.grudge = null; } catch (e) { /* */ } setTimeout(end, 2500); }
      else { failedStop++; for (const z of crowd) { const r = relOf(z); r.affinity = Math.max(-1, r.affinity - 0.08); try { s.remember(z, `The stranger took ${tq.first}'s side when we went with rough music.`, 'social', 0.6, 0); } catch (e) { /* */ } } const z0 = crowd[0]; if (z0) say(z0, pick([`Stand aside! This is no business of yours.`, `Taking ${tq.first}'s side, are you? We'll remember.`]), 2.4); ui('They push past you and bang the louder. But behind the door, someone heard.', 'warn'); const r = relOf(tq); r.affinity = Math.min(1, r.affinity + 0.2); } }
    { const _s = O.AIChat && O.AIChat.say; if (_s) O.AIChat.say = function (q, text, render) { try { if (R && !R.decided && R.crowd.includes(q) && q !== R.tq && /\b(go home|leave (them|him|her) be|enough|stop (this|it)|shame on you)\b/i.test(String(text || ''))) { (q._conv ||= []).push({ who: 'p', t: String(text) }); setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); stand(cur()); }, 800); render('...'); return Promise.resolve(); } } catch (e) { console.error(e); } return _s.apply(this, arguments); }; }
    (O.extraLines = O.extraLines || []).push((s, q) => R && R.crowd.includes(q) ? (q === R.tq ? 'The neighbours are outside your door with rough music, banging pans and jeering at you. You are frightened and angry.' : `You are out with the neighbours giving ${R.tq.first} rough music at their door, for what they are.`) : '');
    O.NpcRough = { get music() { return R; }, get held() { return held; }, get joined() { return joined; }, get stopped() { return stopped; }, get failedStop() { return failedStop; }, soon: () => { cool = 0; force = true; } };
  }
  O.NpcRoughSetup = { setup };
})();
