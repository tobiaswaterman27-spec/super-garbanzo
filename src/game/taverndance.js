// Partners for the dance. When the fiddle's going at the tavern (the weekly dance, a name-day, a feast),
// couples get up and go round each other on the boards: a lad bows to a girl, an old pair who've danced
// together forty years, two friends laughing. You can ask someone too, in your own words or with a bow:
// whether they'll stand up with you rests on what they think of you (and whether their husband or wife is
// watching). A dance warms them to you; a refusal is remembered on both sides; and a married one dancing
// too long with somebody else's sweetheart may find a sour look waiting at their table.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const pairs = []; let invite = null, invited = 0, inviteSnubbed = 0, inviteCool = 20; let you = null, cool = 6, npcDances = 0, yourDances = 0, refused = 0, sour = 0, asked = new Map();
    const dancingNow = (s) => { if (!game.scene || !s) return null; const b = game.scene.b; if (!b) return null; const h = s.minute / 60; return (s.npcEvents || []).find((e) => e.day === s.day && h >= e.from && h < e.to && e.b === b.id && (e.kind === 'dance' || e.kind === 'nameday' || e.kind === 'wedding' || e.party)) || null; };
    const actors = () => game.scene ? [...game.scene.actors.values()].filter((a) => a.person && !a.leaving && !a.hidden && !a.inBed && a.x != null) : [];
    const busy = (q) => pairs.some((p) => p.a.person === q || p.b.person === q) || (you && you.a.person === q);
    const fit = (q) => q.age >= 15 && q.age <= 70 && q.alive !== false && !talking(q) && !(q.health && q.health.illness);
    const centreOf = (x1, y1, x2, y2) => [(x1 + x2) / 2, (y1 + y2) / 2];
    // pairs go round each other, facing; anything that keeps them in place yields while they dance
    const _walk = O.Indoor && O.Indoor.prototype.walkActors;
    if (_walk) O.Indoor.prototype.walkActors = function (dt) { _walk.call(this, dt); try { if (this !== game.scene) return;
      for (const p of pairs) step(p, dt, p.a, p.b); if (you) { step(you, dt, you.a, null); } } catch (e) { /* */ } };
    function step(p, dt, A, B) { p.t += dt; p.ang += dt * (1.4 + Math.sin(p.t * 0.7) * 0.3); const r = 9, [cx, cy] = p.c;
      const ax = cx + Math.cos(p.ang) * r, ay = cy + Math.sin(p.ang) * r * 0.55, bx = cx - Math.cos(p.ang) * r, by = cy - Math.sin(p.ang) * r * 0.55;
      A.x = ax; A.y = ay; A.anim = 'dance'; A.dir = O.dirOf(bx - ax, by - ay); A.sortY = null; A.hidden = false; A.inBed = null;
      if (B) { B.x = bx; B.y = by; B.anim = 'dance'; B.dir = O.dirOf(ax - bx, ay - by); B.sortY = null; B.hidden = false; B.inBed = null; }
      else { const P = game.player; P.x = bx; P.y = by; P.anim = 'dance'; P.dir = O.dirOf(ax - bx, ay - by); P.locked = true; } }
    function clearPair(p) { for (const A of [p.a, p.b]) { if (!A) continue; A.anim = A.gAnim || 'idle'; } }
    function startYou(s, A) { const q = A.person, P = game.player; you = { a: A, t: 0, ang: Math.atan2(P.y - A.y, P.x - A.x), c: centreOf(A.x, A.y, P.x, P.y), s, len: 22 + Math.random() * 10 }; yourDances++;
      O.Sound && O.Sound.play && O.Sound.play('pluck', 330, 0.4); }
    function ask(s, A, spoken) { const q = A.person; if (busy(q) || you) return 'busy';
      const r = relOf(q), sp = q.spouse != null ? s.byId.get(q.spouse) : null, watched = sp && game.scene && game.scene.actors.has(sp.id);
      const partnerYou = PS.partner && PS.partner.id === q.id;
      let p = 0.35 + r.affinity * 0.6 + (r.familiar || 0) * 0.2 - (watched && !partnerYou ? 0.35 : 0) - (((PS.rep && PS.rep.criminal) || 0) * 0.3) + (partnerYou ? 0.5 : 0) - ((asked.get(q.id) || 0) * 0.25);
      asked.set(q.id, (asked.get(q.id) || 0) + 1);
      if (q.age > 60) p -= 0.1; if (r.affinity < -0.2) p = 0.02;
      const yes = Math.random() < Math.max(0.05, Math.min(0.95, p));
      if (!yes) { refused++; r.affinity = Math.max(-1, r.affinity - 0.02); try { s.remember(q, 'The stranger asked me to dance at the tavern and I said no.', 'social', 0.3); } catch (e) { /* */ }
        const line = r.affinity < -0.2 ? pick(['With you? I\'d sooner dance with the dog.', 'No. Thank you.']) : watched && !partnerYou ? pick([`My ${sp.sex === 'm' ? 'husband' : 'wife'} is sitting right there.`, 'I\'d better not. People talk.']) : pick(['My feet are worn out, thank you.', 'Not this one. Maybe later.', 'I don\'t dance, I\'m afraid.']); return { yes: false, line }; }
      r.affinity = Math.min(1, r.affinity + 0.1); r.familiar = Math.min(1, (r.familiar || 0) + 0.12);
      try { s.remember(q, partnerYou ? 'I danced with my sweetheart at the tavern.' : 'I danced with the stranger at the tavern.', 'social', partnerYou ? 1.2 : 0.7); if (watched && !partnerYou && Math.random() < 0.5) { sour++; s.relate(sp, q, -0.06); s.remember(sp, `${q.first} danced with the stranger at the tavern, and right in front of me.`, 'slight', 0.6); const rs = relOf(sp); rs.affinity = Math.max(-1, rs.affinity - 0.06); } } catch (e) { /* */ }
      return { yes: true, line: pick(['I\'d like that.', 'Go on, then. Mind my toes.', 'I thought you\'d never ask!', 'Just the one, mind.']) }; }
    game.hooks.update.push((dt) => { const s = cur(); const ev = dancingNow(s);
      if (!ev) { if (pairs.length || you) { for (const p of pairs) clearPair(p); pairs.length = 0; if (you) { game.player.anim = 'idle'; you = null; } } return; }
      for (const p of pairs.slice()) { if (p.t > p.len || !game.scene.actors.has(p.a.person.id) || !game.scene.actors.has(p.b.person.id) || talking(p.a.person) || talking(p.b.person)) { pairs.splice(pairs.indexOf(p), 1); clearPair(p); npcDances++; try { s.relate(p.a.person, p.b.person, 0.05); s.relate(p.b.person, p.a.person, 0.05); } catch (e) { /* */ } if (Math.random() < 0.5) say(p.a.person, pick(['Whew! Again?', 'You\'ve not lost your step.', 'My heart\'s going like a drum!']), 1.8); } }
      if (you) { if (you.t > you.len || !game.scene.actors.has(you.a.person.id)) { const q = you.a.person; you.a.anim = you.a.gAnim || 'idle'; game.player.anim = 'idle'; you = null; say(q, pick(['Thank you! That was lovely.', 'You dance better than you look!', 'Whew! I need a sit down.']), 2.2); O.UI && O.UI.say && O.UI.say(`You hand ${q.first} back to their place.`, 'good'); } }
      // someone asks YOU
      if (invite) { invite.t += dt; const A = invite.A; if (you || !game.scene.actors.has(A.person.id)) invite = null; else if (invite.t > 9) { inviteSnubbed++; const r = relOf(A.person); r.affinity = Math.max(-1, r.affinity - 0.03); say(A.person, pick(['Oh. Never mind, then.', 'Suit yourself.']), 1.8); try { s.remember(A.person, 'I asked the stranger to dance at the tavern and they left me standing.', 'slight', 0.4); } catch (e) { /* */ } invite = null; } }
      else if (!you) { inviteCool -= dt; if (inviteCool <= 0) { inviteCool = 30 + Math.random() * 30; const P = game.player; const A = actors().filter((a) => fit(a.person) && !busy(a.person) && !a.seat && (relOf(a.person).affinity >= 0.35 || (PS.partner && PS.partner.id === a.person.id)) && Math.hypot(a.x - P.x, a.y - P.y) < 140).sort((a, b) => relOf(b.person).affinity - relOf(a.person).affinity)[0];
        if (A) { invite = { A, t: 0 }; invited++; say(A.person, PS.partner && PS.partner.id === A.person.id ? pick(['Come on, love. Dance with me.', 'You\'re not sitting this one out. Come.']) : pick(['Will you stand up with me for this one?', 'Dance with me? Go on, nobody\'s watching.', 'I\'ll not ask twice. Will you dance?']), 2.6); } } }
      cool -= dt; if (cool > 0) return; cool = 6 + Math.random() * 6; if (pairs.length >= 2) return;
      const free = actors().filter((a) => fit(a.person) && !busy(a.person) && !a.person.agent.frozen);
      // a pair gets up
      for (const A of free) { const q = A.person; const B = free.filter((b) => b !== A && b.person.sex !== q.sex && Math.abs(b.person.age - q.age) < 15 && Math.hypot(b.x - A.x, b.y - A.y) < 120).sort((x, y) => ((y.person.id === q.spouse ? 2 : 0) + ((q.rel.get(y.person.id) || {}).affinity || 0)) - ((x.person.id === q.spouse ? 2 : 0) + ((q.rel.get(x.person.id) || {}).affinity || 0)))[0];
        if (!B || Math.random() < 0.4) continue; const [cx, cy] = centreOf(A.x, A.y, B.x, B.y); pairs.push({ a: A, b: B, t: 0, ang: 0, c: [cx, cy], len: 20 + Math.random() * 15 }); if (Math.random() < 0.6) say(q, q.spouse === B.person.id ? pick(['Come on, old love. Like we used to.', 'Our tune!']) : pick([`Will you stand up with me, ${B.person.first}?`, 'Shall we?']), 2); break; } });
    // ask with a bow (or in words)
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, s = cur(); if (!invite || !game.scene || you || !dancingNow(s)) return null; const A = invite.A; if (Math.hypot(A.x - P.x, A.y - P.y) > 140) return null;
      return { type: 'custom', d: 10, prio: -60, x: A.x, y: A.y - 30, label: `Take ${A.person.first}'s hand and dance`, act: () => { const q = A.person; invite = null; const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.1); r.familiar = Math.min(1, (r.familiar || 0) + 0.1); try { s.remember(q, 'I asked the stranger to dance at the tavern, and they did.', 'social', 0.8); } catch (e) { /* */ } say(q, pick(['Ha! Come on, then.', 'I knew you would.']), 1.8); startYou(s, A); } }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, s = cur(); if (!game.scene || you || !dancingNow(s)) return null;
      const A = actors().filter((a) => fit(a.person) && !busy(a.person) && !a.seat && Math.hypot(a.x - P.x, a.y - P.y) < 34).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0]; if (!A) return null;
      return { type: 'custom', d: 20, prio: -40, x: A.x, y: A.y - 30, label: `Bow, and ask ${A.person.first} to dance`, act: () => { const r = ask(s, A, false); if (r === 'busy') return; P.anim = 'bow'; setTimeout(() => { if (!you) P.anim = 'idle'; }, 800); say(A.person, r.line, 2.2); if (r.yes) setTimeout(() => startYou(s, A), 900); } }; });
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) { try { const s = cur(), t = String(text || ''); if (invite && invite.A.person === q && /\b(yes|aye|gladly|of course|i'?d love|why not|go on|with pleasure|let'?s)\b/i.test(t) && !/\b(no|not)\b/i.test(t)) { const A = invite.A; invite = null; const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.1); setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); startYou(s, A); }, 1200); return respond(q, t, 'Come on, then!', render); } if (game.scene && dancingNow(s) && !you && /\bdance\b/i.test(t) && /\b(will you|would you|shall we|care to|with me|let'?s|fancy|come)\b/i.test(t) && !/\b(don'?t|won'?t|not)\b/i.test(t)) { const A = game.scene.actors.get(q.id); if (A && q.age >= 15 && q.age <= 70 && q.alive !== false) { const r = ask(s, A, true); if (r !== 'busy') { if (r.yes) setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); startYou(s, A); }, 1400); return respond(q, t, r.line, render); } } } } catch (e) { console.error(e); } return _say.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => game.scene && dancingNow(s) ? (you && you.a.person === q ? 'You are dancing with the player right now, to the fiddle.' : 'There is dancing here tonight, with a fiddle; if the player asks you to dance you may say yes or no as you feel about them.') : '');
    O.TavernDance = { pairs, get you() { return you; }, get npcDances() { return npcDances; }, get yourDances() { return yourDances; }, get refused() { return refused; }, get sour() { return sour; }, get invited() { return invited; }, get inviteSnubbed() { return inviteSnubbed; }, get invite() { return invite; }, inviteSoon: () => { inviteCool = 0; }, ask: (q) => { const s = cur(); const A = game.scene && game.scene.actors.get(q.id); return A ? ask(s, A, false) : null; } };
  }
  O.TavernDanceSetup = { setup };
})();
