// A fall in the street. On ice, in mud after rain, or just an old foot on a loose stone: someone goes down
// hard, and sits there in the road holding an ankle. Help them up and they'll ask you to see them to their
// door; walk beside them and they'll not forget it. If you don't, a neighbour may: one comes over, hauls
// them up, and the two go off arm in arm. And if nobody comes, they get up by themselves in the end, and
// limp home remembering who walked past.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.4);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const outdoors = (q) => q && q.agent && !q.agent.hidden && q.agent.inside == null && q.alive !== false;
    const free = (q) => outdoors(q) && !q.agent.frozen && !q.errand && !q._slipped && !q._scene && !q._cp && !q._fighting && !q.jailUntil && !talking(q);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    let F = null, cool = 120, force = false, falls = 0, byYou = 0, byNpc = 0, alone = 0, seenHome = 0;
    const why = (s) => { const w = s.weather || {}; return (w.snowCover || 0) > 0.3 || w.kind === 'snow' ? 'ice' : w.raining || w.wet || w.kind === 'rain' || w.kind === 'storm' ? 'mud' : 'stone'; };
    const homeDoor = (s, q) => { const b = q.home != null && s.building(q.home); return b && b.doorX != null ? [b.doorX, b.doorY + 1] : null; };
    function release(q) { if (!q || !q._slipped) return; q._slipped = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } }
    function end() { if (!F) return; release(F.q); release(F.h); F = null; }
    // walk them home (with you or a neighbour beside them)
    function goHome(s, withYou) { const q = F.q, d = homeDoor(s, q); q.agent.forceAnim = null; q.agent.frozen = false;
      if (!d) { setTimeout(end, 1500); return; } F.stage = 'home'; F.walkT = 0; F.withYou = withYou; F.close = 0; F.far = 0;
      O.Errands.send(s, q, d, { anim: 'open', secs: 0.8, face: 0, giveUp: game.t + 90, after: (ok) => { if (!F || F.q !== q) return; arrive(s, ok); } });
      if (F.h) { const h = F.h; h.agent.frozen = false; h.agent.forceAnim = null; O.Errands.send(s, h, [d[0] + 1, d[1]], { anim: 'idle', secs: 1.5, face: 3, giveUp: game.t + 90 }); } }
    function arrive(s, ok) { const q = F.q;
      if (F.withYou) { const stayed = F.close >= F.far; if (stayed && ok) { seenHome++; const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.15); r.familiar = Math.min(1, (r.familiar || 0) + 0.15); if (near(q.agent.x, q.agent.y, 120)) say(q, pick(['Here we are. Thank you, truly. Most would have walked on.', 'My own door. Bless you for your arm.', 'I\'ll be right now. You\'re a kind soul.']), 2.8); try { s.remember(q, 'I fell in the street and the stranger helped me up and saw me home on their arm.', 'kindness', 0.9); O.TownTalk && O.TownTalk.tell(q.agent.x, q.agent.y, `The stranger helped ${q.first} up when they fell in the street, and saw them home.`, `They say the stranger saw ${q.first} home after a fall.`); } catch (e) { /* */ } if (PS.rep) PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.02); }
        else { try { s.remember(q, 'The stranger helped me up when I fell, then left me to hobble home on my own.', 'social', 0.3); } catch (e) { /* */ } } }
      else if (F.h) { const h = F.h; try { s.relate(q, h, 0.15); s.relate(h, q, 0.05); s.remember(q, `I fell in the street and ${h.first} helped me up and saw me home.`, 'kindness', 0.7, h.id); } catch (e) { /* */ } if (near(q.agent.x, q.agent.y, 260)) say(q, pick([`Thank you, ${h.first}. I'll be right now.`, `You're good to me, ${h.first}.`]), 2.4); }
      setTimeout(end, 2200); }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      if (F) { F.t += dt; const q = F.q, a = q.agent; if (F.s !== s || F.t > 150 || q.alive === false) { end(); return; }
        if (F.stage === 'down') { if (!talking(q)) a.forceAnim = F.t < 1.1 ? 'lie' : 'sit';
          if (!F.cried && F.t > 0.4) { F.cried = true; if (near(a.x, a.y, 340)) { say(q, F.why === 'ice' ? pick(['Ah! The ice! My ankle...', 'Down I go. Oh, my hip.']) : F.why === 'mud' ? pick(['Ugh! This mud! Oh, my ankle!', 'Ah! I\'ve gone over on it.']) : pick(['Ah! Oh, my foot. That stone...', 'Oof. Oh, that hurts.']), 2.6); O.sfx && O.sfx('smack', 0.25); } }
          if (near(a.x, a.y, 160)) F.watched += dt;
          // a neighbour comes over
          if (!F.h && F.t > 7 && Math.random() < dt * 0.25) { const h = s.people.filter((x) => x !== q && free(x) && x.age >= 14 && !x.visitor && Math.hypot(x.agent.x - a.x, x.agent.y - a.y) < 220).sort((x, y) => (y.rel?.get?.(q.id)?.affinity || 0) - (x.rel?.get?.(q.id)?.affinity || 0))[0];
            if (h) { F.h = h; h._slipped = true; if (near(h.agent.x, h.agent.y, 340)) say(h, pick([`${q.first}! Stay there, I'm coming.`, 'Whoa, are you hurt? Here.', `Don't try to stand, ${q.first}.`]), 2); O.Errands.send(s, h, [Math.floor(a.x / T) + 1, Math.floor(a.y / T)], { anim: 'crouch', secs: 1.4, face: 1, sprint: true, giveUp: game.t + 30, after: (ok) => { if (!F || F.h !== h || F.stage !== 'down') return; if (!ok) { release(h); F.h = null; return; } byNpc++; F.stage = 'up'; h.agent.frozen = true; h.agent.forceAnim = 'take'; a.forceAnim = 'idle'; if (near(a.x, a.y, 300)) setTimeout(() => say(q, pick(['Thank you. Would you see me to my door?', 'Oh, thank you. I don\'t think I can manage alone.']), 2.4), 500); setTimeout(() => { if (F && F.q === q) goHome(s, false); }, 2600); } }); } }
          if (F.t > 45 && F.stage === 'down') { alone++; F.stage = 'up'; if (near(a.x, a.y, 300)) say(q, pick(['No one, then. Fine.', 'Up you get, old fool. Nobody else will help.']), 2.4); try { s.remember(q, 'I fell in the street and nobody helped me up.', 'loss', 0.5); if (F.watched > 10) { s.remember(q, 'The stranger stood and watched me lie in the road, and never lent a hand.', 'slight', 0.6, 0); const r = relOf(q); r.affinity = Math.max(-1, r.affinity - 0.08); } } catch (e) { /* */ } setTimeout(() => { if (F && F.q === q) goHome(s, false); }, 1500); }
          return; }
        if (F.stage === 'home' && F.withYou) { F.walkT += dt; if (near(a.x, a.y, 90)) F.close += dt; else F.far += dt; }
        return; }
      cool -= dt; if (cool > 0 && !force) return; const w = why(s); cool = (w === 'stone' ? 260 : 130) + Math.random() * 200; const hr = s.minute / 60; if (!force && (hr < 7 || hr > 20)) return; const forced = force; force = false;
      if (!forced && w === 'stone' && Math.random() < 0.5) return;
      const q = s.people.filter((x) => free(x) && x.age >= 14 && !x.visitor && x.agent.path && x.agent.path.length > 1 && near(x.agent.x, x.agent.y, 280) && !near(x.agent.x, x.agent.y, 40) && homeDoor(s, x)).sort((x, y) => (y.age >= 50) - (x.age >= 50))[0]; if (!q) return;
      falls++; q._slipped = true; q.agent.frozen = true; q.agent.path = null; F = { s, q, t: 0, stage: 'down', why: w, watched: 0, h: null }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!F || F.stage !== 'down' || game.scene || P.locked || F.s !== cur()) return null; const a = F.q.agent; if (Math.hypot(a.x - P.x, a.y - P.y) > 34) return null;
      return { type: 'custom', d: 2, x: a.x, y: a.y - 26, label: `Help ${F.q.first} up`, act: () => { const s = cur(); if (!F || F.stage !== 'down') return; byYou++; F.stage = 'up'; const q = F.q; if (F.h) { release(F.h); F.h = null; } P.anim = 'pickup'; setTimeout(() => { P.anim = 'idle'; }, 900); q.agent.forceAnim = 'idle'; q.agent.dir = O.dirOf(P.x - q.agent.x, P.y - q.agent.y);
        const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.08); r.familiar = Math.min(1, (r.familiar || 0) + 0.1); O.UI && O.UI.say && O.UI.say(`You get an arm under ${q.first} and haul them to their feet. They wince on the ankle.`, 'good');
        setTimeout(() => say(q, pick(['Thank you. Would you... see me to my door? It\'s not far.', 'Bless you. Could I lean on you as far as home?']), 2.8), 600);
        setTimeout(() => { if (F && F.q === q) { goHome(s, true); O.UI && O.UI.say && O.UI.say(`Walk beside ${q.first} as far as their door.`, 'info'); } }, 3000); } }; });
    (O.extraLines = O.extraLines || []).push((s, q) => !F ? '' : q === F.q ? (F.stage === 'down' ? `You have just fallen in the street (${F.why === 'ice' ? 'on the ice' : F.why === 'mud' ? 'in the mud' : 'on a loose stone'}) and hurt your ankle; you are sitting in the road in pain and would be grateful for a hand up.` : 'You fell in the street a little while ago and hurt your ankle; you are limping home.') : q === F.h ? `${F.q.first} fell in the street and you are helping them home.` : '');
    O.SlipFall = { get fall() { return F; }, get falls() { return falls; }, get byYou() { return byYou; }, get byNpc() { return byNpc; }, get alone() { return alone; }, get seenHome() { return seenHome; }, soon: () => { cool = 0; force = true; } };
  }
  O.SlipFallSetup = { setup };
})();
