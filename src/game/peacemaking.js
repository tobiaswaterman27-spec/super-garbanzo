// Making it up. Two neighbours at odds (a fight in the street, a slight, a debt) can go on cutting each
// other for months, or someone can bring them together: the priest, an old head everyone listens to, a
// friend of both. You see it in the street: the peacemaker fetches one of them by the elbow, walks them over
// to the other, and stands between them while they say their piece. Sometimes it ends with hands clasped,
// sometimes with one of them turning on their heel. And you can be the one to do it: stand by one of the
// two and offer to bring them together; how it goes depends on how much they each think of you.
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
    const free = (q) => outdoors(q) && !q.agent.frozen && !q.errand && !q._peace && !q._scene && !q._cp && !q._fighting && !q.jailUntil && !q.visitor && !talking(q);
    const aff = (a, b) => (a.rel.get(b.id) || { affinity: 0 }).affinity;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const dist = (a, b) => Math.hypot(a.agent.x - b.agent.x, a.agent.y - b.agent.y);
    let M = null, cool = 150, force = false, made = 0, failed = 0, byYou = 0, byYouFailed = 0;
    const hold = (q) => { q._peace = true; q.agent.frozen = true; q.agent.path = null; };
    const rel_ = (q) => { if (!q || !q._peace) return; q._peace = false; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; };
    function end() { if (!M) return; for (const q of [M.a, M.b, M.m]) rel_(q); M = null; }
    // who is at odds with whom, near you
    function pairs(s, r) { const out = []; const ppl = s.people.filter((q) => free(q) && q.age >= 14 && near(q.agent.x, q.agent.y, r));
      for (const a of ppl) for (const b of ppl) if (a.id < b.id && Math.min(aff(a, b), aff(b, a)) < -0.25 && a.household !== b.household && dist(a, b) < 420) out.push([a, b, -Math.min(aff(a, b), aff(b, a))]); return out; }
    const wise = (q) => /priest|chaplain|friar|monk|nun|abbot|reeve|bailiff/.test(q.job?.role || '') || q.age >= 55;
    function begin(s, a, b, sev, m) { const meet = [Math.floor(b.agent.x / T), Math.floor(b.agent.y / T)];
      M = { s, a, b, m, sev, t: 0, k: 0, stage: 'gather', meet, ready: 0 }; hold(b); b.agent.forceAnim = 'idle';
      if (m) { m._peace = true; if (near(m.agent.x, m.agent.y, 320)) say(m, pick([`${a.first}. Come with me a moment.`, `Walk with me, ${a.first}. It's time.`, `Enough of this, ${a.first}. Come.`]), 2.2);
        O.Errands.send(s, m, [Math.floor(a.agent.x / T) + 1, Math.floor(a.agent.y / T)], { anim: 'point', secs: 1, face: 1, giveUp: game.t + 30, after: (ok) => { if (!M || M.m !== m) return; if (!ok) { end(); return; } walkTogether(s); } }); hold(a); a.agent.forceAnim = 'idle'; }
      else { a._peace = true; if (near(a.agent.x, a.agent.y, 200)) O.UI && O.UI.say && O.UI.say(`${a.first} hangs back, then comes with you towards ${b.first}.`, 'info'); walkTogether(s); } }
    function walkTogether(s) { const { a, b, m } = M; M.stage = 'walk'; const bt = M.meet; a.agent.frozen = false; a.agent.forceAnim = null;
      const arrived = () => { M.ready++; }; O.Errands.send(s, a, [bt[0] - 2, bt[1]], { anim: 'idle', secs: 0.2, face: 1, giveUp: game.t + 40, after: (ok) => { if (!M || M.a !== a) return; if (!ok) { end(); return; } a.agent.frozen = true; a.agent.path = null; arrived(); } });
      if (m) { m.agent.frozen = false; m.agent.forceAnim = null; O.Errands.send(s, m, [bt[0] - 1, bt[1] + 1], { anim: 'idle', secs: 0.2, face: 3, giveUp: game.t + 40, after: (ok) => { if (!M || M.m !== m) return; if (!ok) { end(); return; } m.agent.frozen = true; m.agent.path = null; arrived(); } }); }
      else arrived();
      if (near(b.agent.x, b.agent.y, 320)) setTimeout(() => { if (M && M.b === b) say(b, pick(['What\'s this, then?', `Oh. ${a.first}.`, 'I\'ve nothing to say to them.']), 2); }, 2500); }
    function outcome() { const { a, b, m, sev } = M; let p = 0.55 - sev * 0.35;
      if (m) { p += wise(m) ? 0.15 : 0; p += Math.min(aff(a, m), aff(b, m)) * 0.3; }
      else { p += (relOf(a).affinity + relOf(b).affinity) * 0.18 + ((PS.rep && PS.rep.civilian) || 0) * 0.15 - ((PS.rep && PS.rep.criminal) || 0) * 0.15; }
      return Math.random() < Math.max(0.1, Math.min(0.9, p)); }
    function settle(s) { const { a, b, m } = M; const ok = outcome(); M.ok = ok; const here = near(b.agent.x, b.agent.y, 340);
      if (ok) { made++; if (!m) byYou++; s.relate(a, b, 0.25 + M.sev * 0.5); s.relate(b, a, 0.25 + M.sev * 0.5);
        try { s.remember(a, `I made it up with ${b.first}${m ? `; ${m.first} brought us together` : '; the stranger brought us together'}.`, 'social', 1, b.id); s.remember(b, `${a.first} and I shook hands and put it behind us.`, 'social', 1, a.id);
          if (m) { s.relate(a, m, 0.08); s.relate(b, m, 0.08); s.remember(m, `I brought ${a.first} and ${b.first} together and they made it up.`, 'social', 0.6); }
          else { for (const q of [a, b]) { const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.12); r.familiar = Math.min(1, (r.familiar || 0) + 0.12); } if (PS.rep) PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.03); s.remember(a, `The stranger brought ${b.first} and me together, and we made it up.`, 'kindness', 0.8); }
          O.TownTalk && O.TownTalk.tell(b.agent.x, b.agent.y, `${a.first} and ${b.first} made it up in the street${m ? `, with ${m.first} between them` : ', the stranger between them'}.`, `They say ${a.first} and ${b.first} have made it up at last.`); } catch (e) { /* */ }
        a.agent.forceAnim = 'give'; b.agent.forceAnim = 'take'; if (m) m.agent.forceAnim = 'nod';
        if (here) { say(a, pick([`I was wrong, ${b.first}. There. I've said it.`, 'Let\'s be done with it. Hand on it.', 'I\'m sorry for my part.']), 2.6); setTimeout(() => { if (M && M.b === b) { say(b, pick(['And I for mine. Hand on it.', 'Aye. Done with. Come for a drink sometime.', 'Well. Well, all right.']), 2.6); b.agent.forceAnim = 'nod'; a.agent.forceAnim = 'nod'; } }, 2400); }
        if (!m) O.UI && O.UI.say && O.UI.say(`${a.first} and ${b.first} clasp hands. It's done, and they both know whose doing it was.`, 'good'); }
      else { failed++; if (!m) byYouFailed++; s.relate(a, b, -0.05); s.relate(b, a, -0.05); try { s.remember(b, `${a.first} was brought to make it up with me, and I wouldn't have it.`, 'grudge', 0.5, a.id); } catch (e) { /* */ }
        if (!m) { for (const q of [a, b]) { const r = relOf(q); r.affinity = Math.max(-1, r.affinity - 0.03); } }
        b.agent.forceAnim = 'shake'; a.agent.forceAnim = 'shrug';
        if (here) { say(b, pick(['No. Not after what you did.', 'You can save your breath. Both of you.', 'I\'ll not shake that hand.']), 2.6); setTimeout(() => { if (M && M.a === a) say(a, pick(['Suit yourself, then.', 'I tried. Everyone saw I tried.', 'Fine. Be like that.']), 2.2); }, 2400); }
        if (!m) O.UI && O.UI.say && O.UI.say(`${b.first} won't have it. ${a.first} shrugs. Some things take longer.`, 'info'); }
      M.stage = 'done'; M.k = 0; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      if (M) { M.t += dt; if (M.s !== s || M.t > 90 || [M.a, M.b, M.m].some((q) => q && (q.alive === false || talking(q)))) { end(); return; }
        if (M.stage === 'walk' && M.ready >= 1 + (M.m ? 1 : 0)) { M.stage = 'talk'; M.k = 0; }
        if (M.stage === 'walk' && !M.m) { M.b.agent.dir = O.dirOf(M.a.agent.x - M.b.agent.x, M.a.agent.y - M.b.agent.y); }
        if (M.stage === 'talk') { M.k += dt; const { a, b, m } = M; a.agent.dir = O.dirOf(b.agent.x - a.agent.x, b.agent.y - a.agent.y); b.agent.dir = O.dirOf(a.agent.x - b.agent.x, a.agent.y - b.agent.y);
          const who = Math.floor(M.k / 1.8) % 3; a.agent.forceAnim = who === 1 ? 'talk' : 'idle'; b.agent.forceAnim = who === 2 ? 'talk' : 'idle'; if (m) m.agent.forceAnim = who === 0 ? 'talk' : 'idle';
          if (!M.s1 && m) { M.s1 = true; if (near(m.agent.x, m.agent.y, 320)) say(m, pick(['Now. You two have been at each other long enough.', 'You\'re neighbours. Say what you have to say and be done.', 'In God\'s name, the pair of you, enough.']), 2.8); }
          if (M.k > 7) settle(s); return; }
        if (M.stage === 'done') { M.k += dt; if (M.k > 5) end(); }
        return; }
      cool -= dt; if (cool > 0 && !force) return; cool = 200 + Math.random() * 200; const hr = s.minute / 60; if (!force && (hr < 9 || hr > 19 || (['storm','heavy','hail','snow'].includes((s.weather && s.weather.kind) || '') || s.raining))) return; const forced = force; force = false;
      const ps = pairs(s, 360); if (!ps.length) return; const [a, b, sev] = pick(ps);
      const m = s.people.filter((q) => q !== a && q !== b && free(q) && q.age >= 25 && dist(q, a) < 360 && (wise(q) || (aff(q, a) > 0.15 && aff(q, b) > 0.15))).sort((x, y) => dist(x, a) - dist(y, a))[0];
      if (!m) return; if (!forced && Math.random() < 0.4) return; begin(s, a, b, sev, m); });
    // you urge them to make it up, in your own words
    const foeNear = (s, a, name) => s.people.filter((q) => q !== a && free(q) && q.age >= 14 && q.household !== a.household && Math.min(aff(a, q), aff(q, a)) < -0.25 && dist(a, q) < 400 && (!name || name.includes(q.first.toLowerCase()))).sort((x, y) => aff(a, x) - aff(a, y))[0];
    const MAKEUP = /\b(make (it )?up|make peace|reconcil\w*|forgive|bury the hatchet|shake hands?|patch (it|things) up|put it behind|be friends|end (this|the) quarrel|let it go|say sorry|apologi[sz]e)\b/i;
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) {
      try { const s = cur(), t = String(text || ''); if (!M && s && q && MAKEUP.test(t) && q.age >= 14) { const b = foeNear(s, q, t.toLowerCase()) || foeNear(s, q, null);
        if (b) { const will = relOf(q).affinity + ((PS.rep && PS.rep.civilian) || 0) * 0.3 - ((PS.rep && PS.rep.criminal) || 0) * 0.3;
          if (will < -0.15) { relOf(q).affinity -= 0.02; return respond(q, t, pick([`And what's ${b.first} to you? Mind your own business.`, 'You don\'t know what they did. Leave it.']), render); }
          setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); setTimeout(() => { const s2 = cur(); if (M || !outdoors(q) || q.errand || q._peace || q._scene || q._cp || q._fighting || talking(q)) return; q.agent.frozen = false; const b2 = free(b) ? b : foeNear(s2, q, null); if (!b2) { O.Speech && O.Speech.say(q, 'Well, they\'re not about now. Another time.', 2.2); return; } begin(s2, q, b2, -Math.min(aff(q, b2), aff(b2, q)), null); }, 400); }, 1800);
          return respond(q, t, pick([`With ${b.first}? ...Very well. For you. Walk me over before I think better of it.`, `You don't know what ${b.first} did. ...Oh, all right. Come on, then.`]), render); } } } catch (e) { console.error(e); }
      return _say.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!M) { const b = s.people && q.age >= 14 && q.agent && !q.agent.hidden ? foeNear(s, q, null) : null; return b ? `You are at odds with ${b.first}, who is not far off. If the player urges you to make it up with them, you might let them bring the two of you together.` : ''; } const other = q === M.a ? M.b : q === M.b ? M.a : null; if (!other) return q === M.m ? `You are bringing ${M.a.first} and ${M.b.first} together to make up their quarrel.` : '';
      return M.stage === 'done' ? (M.ok ? `You have just made it up with ${other.first}, in the street, and feel lighter for it.` : `You were just brought to make it up with ${other.first} and it came to nothing.`) : `You are at odds with ${other.first}, and ${M.m ? M.m.first : 'the player'} is bringing the two of you together to make it up. You are wary but willing to hear it.`; });
    // ---------------------------------------------------------------- and between you and someone who bears you a grudge
    let Y = null, ycool = 200, yMade = 0, yFailed = 0;
    const yEnd = () => { if (!Y) return; rel_(Y.g); rel_(Y.m); Y = null; };
    function ySettle(s, how) { const { g, m } = Y; const r = relOf(g), lvl = (g.grudge && g.grudge.level) || Math.max(0, -r.affinity); let p = 0.45 + relOf(m).affinity * 0.3 + ((PS.rep && PS.rep.civilian) || 0) * 0.2 - lvl * 0.4 + (how === 'words' ? 0.1 : 0);
      const ok = Math.random() < Math.max(0.1, Math.min(0.9, p)); Y.stage = 'done'; Y.k = 0;
      if (ok) { yMade++; g.grudge = null; r.affinity = Math.max(r.affinity, 0) + 0.08; r.familiar = Math.min(1, (r.familiar || 0) + 0.1); const rm = relOf(m); rm.affinity = Math.min(1, rm.affinity + 0.05); g.agent.forceAnim = 'give'; say(g, pick(['...All right. Hand on it. But don\'t make me sorry.', 'Well. It\'s done, then. We\'ll say no more.', 'For ' + m.first + '\'s sake. And yours, maybe.']), 2.8); try { s.remember(g, `${m.first} brought me to make it up with the stranger, and we did.`, 'social', 1, 0); O.TownTalk && O.TownTalk.tell(g.agent.x, g.agent.y, `${g.first} and the stranger made it up in the street, ${m.first} between them.`, `They say ${g.first} has made it up with the stranger.`); } catch (e) { /* */ } O.UI && O.UI.say && O.UI.say(`${g.first} takes your hand. Whatever it was, it's behind you now.`, 'good'); }
      else { yFailed++; r.affinity = Math.max(-1, r.affinity - 0.03); g.agent.forceAnim = 'shake'; say(g, pick(['No. Words are cheap.', 'You can keep your hand.', 'Not today. Maybe not ever.']), 2.6); setTimeout(() => Y && Y.m && say(Y.m, 'Well. I tried.', 1.8), 2200); } }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return; const P = game.player;
      if (Y) { Y.t += dt; const { g, m } = Y; if (Y.s !== s || Y.t > 120 || g.alive === false || m.alive === false) { yEnd(); return; }
        if (Y.stage === 'face') { Y.k += dt; g.agent.dir = O.dirOf(P.x - g.agent.x, P.y - g.agent.y); m.agent.dir = O.dirOf(P.x - m.agent.x, P.y - m.agent.y); g.agent.forceAnim = 'idle'; m.agent.forceAnim = Y.k < 3 ? 'talk' : 'idle'; if (!Y.s1) { Y.s1 = true; say(m, pick([`Now. ${g.first} has something against you, and I'll not have it. Say your piece, the pair of you.`, `I've brought ${g.first}. You two are going to talk.`]), 3); }
          if (Y.k > 16) { say(g, 'See? Won\'t even look at me.', 2); relOf(g).affinity = Math.max(-1, relOf(g).affinity - 0.05); Y.stage = 'done'; Y.k = 0; } return; }
        if (Y.stage === 'done') { Y.k += dt; if (Y.k > 4) yEnd(); }
        return; }
      ycool -= dt; if (ycool > 0) return; ycool = 300 + Math.random() * 300; const hr = s.minute / 60; if (hr < 9 || hr > 19 || Math.random() < 0.5) return;
      let g = null, m = null; for (const c of s.people.filter((q) => free(q) && q.age >= 14 && (relOf(q).affinity < -0.3 || (q.grudge && q.grudge.level > 0.2)) && near(q.agent.x, q.agent.y, 360))) { const mm = s.people.find((q) => q !== c && free(q) && q.age >= 18 && relOf(q).affinity > 0.25 && aff(q, c) > 0.15 && dist(q, c) < 360); if (mm) { g = c; m = mm; break; } } if (!g) return;
      Y = { s, g, m, t: 0, stage: 'walk' }; g._peace = true; m._peace = true; hold(g);
      if (near(m.agent.x, m.agent.y, 340)) say(m, pick([`${g.first}. Come with me. No, come on.`, `Walk with me, ${g.first}. There's someone you need to talk to.`]), 2.4); g.agent.frozen = false;
      const tx = Math.floor(P.x / T), ty = Math.floor(P.y / T); let n = 0; const arrive = () => { if (++n < 2 || !Y) return; Y.stage = 'face'; Y.k = 0; };
      const go = (q, dx, dy) => O.Errands.send(s, q, [tx + dx, ty + dy], { anim: 'idle', secs: 0.2, face: 2, giveUp: game.t + 40, after: () => { if (!Y) return; if (Math.hypot(q.agent.x - P.x, q.agent.y - P.y) > 90) { yEnd(); return; } q.agent.frozen = true; q.agent.path = null; arrive(); } });
      go(g, -1, 0); go(m, -1, 1); });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!Y || Y.stage !== 'face' || game.scene || P.locked) return null; const a = Y.g.agent; if (Math.hypot(a.x - P.x, a.y - P.y) > 60) return null;
      return { type: 'custom', d: 1, x: a.x, y: a.y - 30, label: `Offer ${Y.g.first} your hand`, act: () => { P.anim = 'give'; setTimeout(() => { P.anim = 'idle'; }, 800); ySettle(cur(), 'hand'); } }; });
    { const _s2 = O.AIChat && O.AIChat.say; if (_s2) O.AIChat.say = function (q, text, render) { try { if (Y && Y.stage === 'face' && q === Y.g && /\b(sorry|apolog\w*|forgive|my fault|i was wrong|make (it )?up|make peace|shake|let'?s be friends|bury the hatchet)\b/i.test(String(text || ''))) { const t = String(text); (q._conv ||= []).push({ who: 'p', t }); setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); ySettle(cur(), 'words'); }, 900); render('...'); return Promise.resolve(); } } catch (e) { console.error(e); } return _s2.apply(this, arguments); }; }
    O.Peacemaking = { get scene() { return M; }, get made() { return made; }, get failed() { return failed; }, get byYou() { return byYou; }, get byYouFailed() { return byYouFailed; }, get you() { return Y; }, get yMade() { return yMade; }, get yFailed() { return yFailed; }, youSoon: () => { ycool = 0; }, soon: () => { cool = 0; force = true; }, pairs: (r) => pairs(cur(), r || 360) };
  }
  O.PeacemakingSetup = { setup };
})();
