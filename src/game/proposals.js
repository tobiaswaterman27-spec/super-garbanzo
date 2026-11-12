// Asking. Two who've been walking out a while: one day, in the lane or on the green, one of them stops
// the other, goes down on one knee in the dust, and holds out a ribbon or a ring of plaited straw. People
// stop and look. Yes, and the street cheers and the banns are as good as read; no, and there's a long walk
// home. Congratulate the happy pair, or comfort the one left standing. And you can be the matchmaker: tell
// someone, in your own words, that they ought to ask their sweetheart, and see if they find the nerve.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.4);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._propose && !q.visitor && !q.jailUntil && !talking(q);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const aff = (a, b) => (a.rel.get(b.id) || { affinity: 0 }).affinity;
    const single = (q) => !q.spouse && !q.withPlayer && !q.visitor && q.age >= 18 && q.age <= 48 && q.alive !== false;
    const fits = (a, b) => single(a) && single(b) && a.sex !== b.sex && a.household !== b.household;
    let X = null, cool = 160, force = false, asked = 0, yes = 0, no = 0, nudged = 0, congrats = 0, comforted = 0; const nudges = new Map(); // id -> { other, until }
    const rel_ = (q) => { if (!q || !q._propose) return; q._propose = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } };
    function end() { if (!X) return; for (const q of [X.a, X.b, ...X.crowd]) rel_(q); X = null; }
    function begin(s, a, b) { asked++; X = { s, a, b, t: 0, stage: 'walk', crowd: [] }; a._propose = true; b._propose = true; b.agent.frozen = true; b.agent.path = null;
      O.Errands.send(s, a, [Math.floor(b.agent.x / T) + 1, Math.floor(b.agent.y / T)], { anim: 'idle', secs: 0.3, face: 1, giveUp: game.t + 30, after: (ok) => { if (!X || X.a !== a) return; if (!ok) { end(); return; } a.agent.frozen = true; a.agent.path = null; X.stage = 'ask'; X.k = 0; } }); }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      for (const [id, n] of nudges) if (s.day > n.until) nudges.delete(id);
      if (X) { X.t += dt; const { a, b } = X; if (X.s !== s || X.t > 120 || a.alive === false || b.alive === false || talking(a) || talking(b)) { end(); return; }
        if (X.stage !== 'ask' && X.stage !== 'done') return; X.k += dt; const aa = a.agent, ba = b.agent, here = near(aa.x, aa.y, 340);
        aa.dir = O.dirOf(ba.x - aa.x, ba.y - aa.y); ba.dir = O.dirOf(aa.x - ba.x, aa.y - ba.y);
        if (X.stage === 'ask') {
          if (X.k < 2) { aa.forceAnim = 'talk'; ba.forceAnim = 'idle'; if (!X.s0) { X.s0 = true; if (here) say(a, pick([`${b.first}. Wait. There's something I've been meaning to say.`, `${b.first}, stand there a moment. Please.`]), 2.4); } }
          else if (X.k < 7) { aa.forceAnim = X.k < 4.5 ? 'crouch' : 'give'; ba.forceAnim = 'shocked';
            if (!X.s1) { X.s1 = true; if (here) say(a, pick([`Will you have me, ${b.first}? I've not much, but it's yours.`, `Marry me, ${b.first}. I mean it.`, 'Will you be my wife? I made this for you.'].map((t) => b.sex === 'm' ? t.replace('my wife', 'my husband') : t)), 3);
              // the street stops to look
              const cs = s.people.filter((z) => free(z) && z !== a && z !== b && Math.hypot(z.agent.x - aa.x, z.agent.y - aa.y) < 200).slice(0, 4); for (const z of cs) { z._propose = true; z.agent.frozen = true; z.agent.path = null; z.agent.forceAnim = 'look'; z.agent.dir = O.dirOf(aa.x - z.agent.x, aa.y - z.agent.y); X.crowd.push(z); } if (cs[0] && here) setTimeout(() => X && say(cs[0], pick(['Ooh! Look, look!', 'He\'s asking her! Hush!', 'About time, too.']), 1.8), 900); } }
          else { const p = aff(b, a) >= 0.25 ? 0.82 : aff(b, a) >= 0.1 ? 0.45 : 0.15; X.ok = Math.random() < p; X.stage = 'done'; X.k = 0;
            if (X.ok) { yes++; ba.forceAnim = 'celebrate'; aa.forceAnim = 'celebrate'; if (here) say(b, pick(['Yes! Oh, yes!', 'I thought you\'d never ask! Yes!', 'Get up, you fool. Yes, of course yes.']), 2.6); for (const z of X.crowd) z.agent.forceAnim = 'celebrate'; if (X.crowd[0] && here) setTimeout(() => X && say(X.crowd[0], pick(['Hooray!', 'God bless you both!', 'A wedding!']), 1.8), 700);
              try { s.relate(a, b, 0.2); s.relate(b, a, 0.2); s.remember(a, `${b.first} said yes when I asked them to marry me.`, 'life', 2.5, b.id); s.remember(b, `${a.first} went down on one knee in the street and asked me to marry them. I said yes.`, 'life', 2.5, a.id); for (const z of X.crowd) s.remember(z, `Saw ${a.first} ask ${b.first} to marry them in the street. She said yes.`.replace('She', b.sex === 'f' ? 'She' : 'He'), 'social', 0.6); O.TownTalk && O.TownTalk.tell(aa.x, aa.y, `${a.first} asked ${b.first} to marry them in the street, on one knee, and ${b.first} said yes.`, `They say ${a.first} and ${b.first} are to be wed.`); } catch (e) { /* */ } }
            else { no++; ba.forceAnim = 'shake'; aa.forceAnim = 'hurt'; if (here) say(b, pick([`Oh, ${a.first}. I'm sorry. I can't.`, 'No. Get up, people are looking.', 'I like you well enough, but no.']), 2.6); for (const z of X.crowd) z.agent.forceAnim = 'shocked';
              try { s.relate(a, b, -0.15); s.remember(a, `I asked ${b.first} to marry me in the street and they said no.`, 'loss', 2, b.id); s.remember(b, `${a.first} asked me to marry them in the street, in front of everyone. I said no.`, 'social', 1.2, a.id); O.TownTalk && O.TownTalk.tell(aa.x, aa.y, `${a.first} went down on one knee to ${b.first} in the street, and was refused.`, `They say ${b.first} turned ${a.first} down flat.`); } catch (e) { /* */ } } }
          return; }
        if (X.stage === 'done') { if (X.ok) { aa.forceAnim = X.k < 3 ? 'celebrate' : 'idle'; ba.forceAnim = X.k < 3 ? 'celebrate' : 'idle'; if (X.k > 3 && !X.wed) { X.wed = true; try { if (fits(a, b) && s.wed) s.wed(a, b); } catch (e) { console.error(e); } } }
          else { if (X.k > 2.5 && !X.walked) { X.walked = true; const ag = a.agent; rel_(a); const h = a.home != null && s.building(a.home); if (h && h.doorX != null) O.Errands.send(s, a, [h.doorX, h.doorY + 1], { anim: 'open', secs: 0.5, face: 0, giveUp: game.t + 60 }); void ag; } }
          if (X.k > 3.5) for (const z of X.crowd.splice(0)) rel_(z);
          if (X.k > 14) end(); }
        return; }
      cool -= dt; if (cool > 0 && !force) return; cool = 240 + Math.random() * 240; const hr = s.minute / 60; if (!force && (hr < 9 || hr > 19)) return; const forced = force; force = false;
      // a pair near you who've been walking out (or someone you've nudged)
      let pair = null;
      for (const [id, n] of nudges) { const a = s.byId.get(id), b = s.byId.get(n.other); if (a && b && free(a) && free(b) && fits(a, b) && near(a.agent.x, a.agent.y, 420) && Math.hypot(a.agent.x - b.agent.x, a.agent.y - b.agent.y) < 400) { pair = [a, b]; nudges.delete(id); break; } }
      if (!pair) { const ppl = s.people.filter((q) => free(q) && single(q) && near(q.agent.x, q.agent.y, 360)); for (const a of ppl) { const b = ppl.find((x) => x !== a && fits(a, x) && aff(a, x) >= 0.25 && aff(x, a) >= 0.15 && Math.hypot(a.agent.x - x.agent.x, a.agent.y - x.agent.y) < 300); if (b) { pair = Math.random() < 0.7 && a.sex === 'f' ? [b, a] : [a, b]; break; } } }
      if (!pair || (!forced && Math.random() < 0.4)) return; begin(s, pair[0], pair[1]); });
    // congratulate, or comfort
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!X || X.stage !== 'done' || game.scene || P.locked) return null; const s = cur();
      if (X.ok && !X.cg) { const a = X.a.agent; if (Math.hypot(a.x - P.x, a.y - P.y) > 50) return null; return { type: 'custom', d: 2, x: a.x, y: a.y - 30, label: `Congratulate ${X.a.first} and ${X.b.first}`, act: () => { X.cg = true; congrats++; P.anim = 'bow'; setTimeout(() => { P.anim = 'idle'; }, 800); for (const q of [X.a, X.b]) { const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.08); r.familiar = Math.min(1, (r.familiar || 0) + 0.1); } say(X.b, pick(['Thank you! You\'ll come to the wedding?', 'Oh, thank you! I\'m all of a tremble.']), 2.4); } }; }
      if (!X.ok && !X.cf) { const a = X.a.agent; if (Math.hypot(a.x - P.x, a.y - P.y) > 50) return null; return { type: 'custom', d: 2, x: a.x, y: a.y - 30, label: `Put a hand on ${X.a.first}'s shoulder`, act: () => { X.cf = true; comforted++; P.anim = 'give'; setTimeout(() => { P.anim = 'idle'; }, 800); const r = relOf(X.a); r.affinity = Math.min(1, r.affinity + 0.14); r.familiar = Math.min(1, (r.familiar || 0) + 0.12); try { s.remember(X.a, 'When I was turned down in the street, the stranger put a hand on my shoulder.', 'kindness', 0.8); } catch (e) { /* */ } say(X.a, pick(['Thank you. I\'ll be all right. In a year or two.', 'Everyone saw. Everyone.', 'I thought she... Never mind. Thank you.']), 2.6); } }; }
      return null; });
    // the matchmaker: "you should ask her"
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) { try { const s = cur(), t = String(text || ''); if (s && q && single(q) && /\b(marry|propose|wed|ask (her|him) (out|to)|ask for (her|his) hand|go down on one knee|pop the question)\b/i.test(t) && /\b(you should|you ought|why don'?t you|go on|ask)\b/i.test(t)) {
        const low = t.toLowerCase(); const b = s.people.find((x) => x !== q && fits(q, x) && low.includes(x.first.toLowerCase())) || [...q.rel.entries()].map(([id, r]) => [s.byId.get(id), r]).filter(([x, r]) => x && fits(q, x) && r.affinity > 0.2).sort((m, n) => n[1].affinity - m[1].affinity).map(([x]) => x)[0];
        if (b) { nudged++; const r = q.rel.get(b.id) || { affinity: 0, familiar: 0 }; const fond = r.affinity > 0.15; if (fond) { r.affinity = Math.min(1, r.affinity + 0.08); q.rel.set(b.id, r); nudges.set(q.id, { other: b.id, until: s.day + 2 }); cool = Math.min(cool, 40); }
          return respond(q, t, fond ? pick([`${b.first}? You think... You think she'd have me?`.replace('she', b.sex === 'f' ? 'she' : 'he'), `Maybe I will. Maybe today. Don't tell a soul.`, `My heart's in my mouth just thinking of it. But you're right.`]) : pick([`${b.first}? Me? We barely speak.`, 'Marry? Not likely. Not them.']), render); } } } catch (e) { console.error(e); } return _say.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => { const n = nudges.get(q.id); if (n) { const b = s.byId.get(n.other); return b ? `You are working up the nerve to ask ${b.first} to marry you, soon, perhaps today.` : ''; } return X && (q === X.a || q === X.b) ? (X.stage === 'done' ? (X.ok ? `You have just become betrothed to ${q === X.a ? X.b.first : X.a.first}, in the street, and are giddy with it.` : q === X.a ? `You have just been refused by ${X.b.first} in front of the street; you are crushed.` : `You have just refused ${X.a.first}'s proposal in the street.`) : '') : ''; });
    O.Proposals = { get scene() { return X; }, get asked() { return asked; }, get yes() { return yes; }, get no() { return no; }, get nudged() { return nudged; }, get congrats() { return congrats; }, get comforted() { return comforted; }, nudges, soon: () => { cool = 0; force = true; }, begin: (a, b) => begin(cur(), a, b) };
  }
  O.ProposalsSetup = { setup };
})();
