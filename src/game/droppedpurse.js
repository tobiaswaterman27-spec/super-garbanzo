// A dropped purse. Someone walking through the street lets their purse slip from their belt and walks on
// without noticing. It lies there in the dust, catching the light. Pick it up and you can run after them
// with it, or slip it into your own coat (and hope nobody saw). If you leave it, a passer-by may find it:
// an honest one calls out and runs it back, a needy or greedy one pockets it and walks on. A little later
// the owner pats their belt, goes white, and comes back along the way they came, looking.
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
    const free = (q) => outdoors(q) && !q.agent.frozen && !q.errand && !q._dpurse && !q._scene && !q._cp && !q._fighting && !q.jailUntil && !talking(q);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    let P = null, cool = 90, force = false, returned = 0, kept = 0, npcReturned = 0, npcKept = 0, selfFound = 0, byYou = 0;
    const hold = (q) => { q._dpurse = true; q.agent.frozen = true; q.agent.path = null; };
    const free_ = (q) => { if (!q || !q._dpurse) return; q._dpurse = false; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; };
    function end() { if (!P) return; free_(P.owner); free_(P.finder); P = null; }
    const giveBack = (s, to) => { try { const h = s.household(P.owner); if (h) h.money = (h.money || 0) + P.amt; } catch (e) { /* */ } if (to) { /* thanked */ } };
    // the owner realises
    function realise(s) { const o = P.owner; if (!outdoors(o) || o.errand || talking(o) || o.agent.frozen) { P.realiseAt += 3; return; }
      P.stage = P.stage === 'lying' ? 'lying' : P.stage; P.realised = true; hold(o); o.agent.forceAnim = 'shocked'; if (near(o.agent.x, o.agent.y, 320)) say(o, pick(['My purse! Where\'s my purse?', 'No. No, no. My purse is gone!', 'It was on my belt. It was right here!']), 2.4);
      setTimeout(() => { if (!P || P.owner !== o) return; o.agent.forceAnim = null; o.agent.frozen = false; o._dpurse = true;
        O.Errands.send(s, o, [Math.floor(P.x / T), Math.floor(P.y / T)], { anim: 'crouch', secs: 1.6, face: 2, giveUp: game.t + 40, after: (ok) => { if (!P || P.owner !== o) return;
          if (P.stage === 'lying') { selfFound++; giveBack(s); if (near(P.x, P.y, 300)) say(o, pick(['Oh, thank God. Thank God.', 'There you are, you little wretch of a thing.']), 2.4); try { s.remember(o, 'I dropped my purse in the street and found it again, by God\'s grace.', 'luck', 0.4); } catch (e) { /* */ } P.stage = 'gone'; setTimeout(end, 2500); }
          else if (P.stage === 'gone') { o.agent.frozen = true; o.agent.forceAnim = 'shake'; if (near(o.agent.x, o.agent.y, 300)) say(o, pick(['Gone. Someone\'s had it.', `${P.amt} aurin. That was the week's money.`, 'Who picks up a purse and keeps it? Who does that?']), 2.6); try { s.remember(o, `I lost my purse in the street, ${P.amt} aurin, and somebody kept it.`, 'loss', 0.8); } catch (e) { /* */ } P.mourned = true; setTimeout(() => { if (P && P.owner === o && !P.player) end(); else free_(o); }, 3500); }
          else free_(o); } }); }, 1600); }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      if (P) { P.t += dt; if (P.s !== s || P.t > 240) { if (P.player && P.stage === 'held') pocket(true); end(); return; }
        if (!P.realised && P.t > P.realiseAt) realise(s);
        // you walked off with it
        if (P.player && P.stage === 'held' && !near(P.owner.agent.x, P.owner.agent.y, 700) && P.t > 20) { pocket(true); return; }
        // a passer-by spots it
        if (P.stage === 'lying' && !P.finder && P.t > 9 && !P.realised) { const f = s.people.find((q) => q !== P.owner && free(q) && q.age >= 12 && !q.visitor && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 150);
          if (f && Math.random() < dt * 0.6) { P.finder = f; f._dpurse = true; O.Errands.send(s, f, [Math.floor(P.x / T), Math.floor(P.y / T)], { anim: 'pickup', secs: 0.9, face: 2, giveUp: game.t + 30, after: (ok) => { if (!P || P.finder !== f) return; if (!ok || P.stage !== 'lying') { free_(f); P.finder = null; return; } found(s, f); } }); } }
        return; }
      cool -= dt; if (cool > 0 && !force) return; cool = 160 + Math.random() * 200; const hr = s.minute / 60; if (!force && (hr < 8 || hr > 19)) return; force = false;
      const o = s.people.find((q) => free(q) && q.age >= 18 && !q.visitor && q.agent.path && q.agent.path.length > 2 && near(q.agent.x, q.agent.y, 260) && !near(q.agent.x, q.agent.y, 40) && (s.household(q)?.money || 0) >= 6); if (!o) return;
      const h = s.household(o), amt = Math.max(2, Math.min(h.money, 3 + Math.floor(Math.random() * 9))); h.money -= amt;
      const x = o.agent.x + (Math.random() - 0.5) * 6, y = o.agent.y + 2; if (game.solidAt(x, y)) { h.money += amt; return; }
      P = { s, owner: o, x, y, amt, t: 0, stage: 'lying', realiseAt: 22 + Math.random() * 14, seen: [] };
      if (near(x, y, 200)) O.sfx && O.sfx('coins', 0.15); });
    function found(s, f) { P.stage = 'npc'; const honest = !(f.traits || []).some((t) => /greedy|dishonest|hostile/.test(t)) && !((s.household(f)?.money || 0) < 4 && Math.random() < 0.5); const keep = honest ? Math.random() < 0.12 : Math.random() < 0.65;
      f.agent.forceAnim = 'look'; const o = P.owner;
      if (!keep) { if (near(f.agent.x, f.agent.y, 300)) say(f, pick([`Hoy! ${o.first}! You've dropped your purse!`, 'Somebody\'s purse! Whose is this?', `Wait! ${o.first}, wait!`]), 2.2);
        let tries = 0; const chase = () => { if (!P || P.finder !== f) return; tries++; O.Errands.send(s, f, [Math.floor(o.agent.x / T), Math.floor(o.agent.y / T) + 1], { anim: 'give', secs: 1.2, face: 0, sprint: true, giveUp: game.t + 25, after: (ok) => { if (!P || P.finder !== f) return; if (Math.hypot(f.agent.x - o.agent.x, f.agent.y - o.agent.y) > 40 && tries < 4) { chase(); return; }
          npcReturned++; giveBack(s); P.stage = 'back'; o.agent.forceAnim = 'take'; if (near(o.agent.x, o.agent.y, 300)) setTimeout(() => say(o, pick([`${f.first}! Bless you, I never even felt it go.`, 'My purse! Oh, you good soul.', 'I\'d have been ruined. Thank you, thank you.']), 2.6), 600);
          try { s.relate(o, f, 0.2); s.relate(f, o, 0.05); s.remember(o, `${f.first} found my purse in the street and ran after me with it.`, 'kindness', 0.8, f.id); s.remember(f, `I found ${o.first}'s purse in the street and gave it back.`, 'social', 0.4, o.id); O.TownTalk && O.TownTalk.tell(f.agent.x, f.agent.y, `${f.first} found ${o.first}'s purse in the street and ran after them with it.`, `They say ${f.first} gave back a purse with ${P.amt} aurin in it.`); } catch (e) { /* */ }
          setTimeout(end, 2600); } }); }; o.agent.frozen = true; o.agent.path = null; o._dpurse = true; o.agent.dir = O.dirOf(f.agent.x - o.agent.x, f.agent.y - o.agent.y); chase(); }
      else { npcKept++; P.stage = 'gone'; P.keeper = f; try { const h = s.household(f); if (h) h.money = (h.money || 0) + P.amt; s.remember(f, `I found ${o.first}'s purse in the street and kept it. ${P.amt} aurin. Nobody saw.`, 'secret', 0.8, o.id); } catch (e) { /* */ }
        if (near(f.agent.x, f.agent.y, 200)) O.UI && O.UI.say && O.UI.say(`You see ${f.first} stoop, glance about, and tuck something into their coat.`, 'info'); setTimeout(() => free_(f), 1400); } }
    function pocket(walked) { const s = cur(); if (!P || P.stage !== 'held') return; kept++; P.stage = 'gone'; PS.money = (PS.money || 0) + P.amt; const o = P.owner;
      O.UI && O.UI.say && O.UI.say(walked ? `You walk on with ${o.first}'s purse. ${P.amt} aurin, yours now.` : `You tip ${P.amt} aurin into your own purse and drop the empty one in the gutter.`, 'info');
      const seen = s ? s.people.filter((q) => q !== o && outdoors(q) && q.age >= 8 && near(q.agent.x, q.agent.y, 140)) : []; P.seen = seen;
      if (seen.length && s) { if (PS.rep) PS.rep.criminal = Math.min(1, (PS.rep.criminal || 0) + 0.03); for (const q of seen.slice(0, 4)) { try { s.remember(q, `I saw the stranger pick up ${o.first}'s purse and keep it. Shameful.`, 'crime', 0.9, 0); const r = relOf(q); r.affinity = Math.max(-1, r.affinity - 0.08); } catch (e) { /* */ } }
        try { O.TownTalk && O.TownTalk.tell(game.player.x, game.player.y, `The stranger picked up ${o.first}'s purse in the street and kept it. Shameful.`, `They say the stranger kept a purse ${o.first} dropped.`); } catch (e) { /* */ }
        const w = seen[0]; if (w && near(w.agent.x, w.agent.y, 200)) say(w, pick(['I saw that.', 'That isn\'t yours.', `That's ${o.first}'s purse!`]), 2); } }
    // pick it up
    (O.moreCandidates = O.moreCandidates || []).push(() => { const Pl = game.player; if (!P || P.stage !== 'lying' || game.scene || Pl.locked || P.s !== cur() || Math.hypot(P.x - Pl.x, P.y - Pl.y) > 22) return null;
      return { type: 'custom', d: 22, x: P.x, y: P.y - 16, label: 'Pick up the purse', act: () => { if (!P || P.stage !== 'lying') return; P.stage = 'held'; P.player = true; P.heldAt = P.t; Pl.anim = 'pickup'; setTimeout(() => { Pl.anim = 'idle'; }, 800); O.sfx && O.sfx('coins', 0.3);
        if (P.finder) { free_(P.finder); P.finder = null; }
        O.UI && O.UI.say && O.UI.say(`A leather purse, heavy with coin: ${P.amt} aurin. ${P.realised ? `${P.owner.first} is looking for it.` : `You saw ${P.owner.first} drop it.`}`, 'info'); } }; });
    // hand it back, or keep it
    (O.moreCandidates = O.moreCandidates || []).push(() => { const Pl = game.player; if (!P || P.stage !== 'held' || game.scene || Pl.locked) return null; const o = P.owner; if (!outdoors(o) || Math.hypot(o.agent.x - Pl.x, o.agent.y - Pl.y) > 44) return null;
      return { type: 'custom', d: 44, x: o.agent.x, y: o.agent.y - 30, label: `Give ${o.first} back their purse`, act: () => { const s = cur(); if (!P || P.stage !== 'held') return; returned++; byYou++; giveBack(s); P.stage = 'back'; Pl.anim = 'give'; setTimeout(() => { Pl.anim = 'idle'; }, 900); hold(o); o.agent.forceAnim = 'take'; o.agent.dir = O.dirOf(Pl.x - o.agent.x, Pl.y - o.agent.y);
        const r = relOf(o); r.affinity = Math.min(1, r.affinity + 0.25); r.familiar = Math.min(1, (r.familiar || 0) + 0.2); if (PS.rep) PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.03);
        const reward = Math.random() < 0.6 ? Math.max(1, Math.round(P.amt / 5)) : 0; if (reward) { try { const h = s.household(o); if (h && h.money >= reward) { h.money -= reward; PS.money = (PS.money || 0) + reward; } } catch (e) { /* */ } }
        setTimeout(() => say(o, reward ? pick(['My purse! Here, take something for your honesty. No, I insist.', 'You could have kept it. Here, have a coin for your trouble.']) : pick(['My purse! I never felt it go. God bless you.', 'Honest folk still, in this town. Thank you.']), 2.8), 500);
        O.UI && O.UI.say && O.UI.say(`You hand ${o.first} back the purse${reward ? `, and they press ${reward} aurin on you` : ''}.`, 'good');
        try { s.remember(o, `The stranger found my purse in the street and gave it back, every coin.`, 'kindness', 1.0); O.TownTalk && O.TownTalk.tell(o.agent.x, o.agent.y, `The stranger found ${o.first}'s purse in the street and gave it back, every coin.`, 'They say the stranger gave back a purse they found, every coin.'); } catch (e) { /* */ }
        setTimeout(end, 3200); } }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const Pl = game.player; if (!P || P.stage !== 'held' || game.scene || Pl.locked || P.t - P.heldAt < 1) return null;
      return { type: 'custom', d: 60, x: Pl.x, y: Pl.y - 34, label: 'Keep the purse', act: () => { pocket(false); setTimeout(end, 500); } }; });
    // what people know
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!P) return ''; if (q === P.owner) return P.stage === 'held' ? `You have lost your purse with ${P.amt} aurin in it, and the stranger is holding it. If they give it back you are overjoyed and grateful; if they keep it you are furious.` : P.stage === 'gone' && P.mourned ? `You have lost your purse with ${P.amt} aurin in it and someone has kept it. You are distraught.` : P.realised && P.stage === 'lying' ? 'You have dropped your purse somewhere along the street and are searching for it, frantic.' : '';
      if (q === P.keeper) return `You found ${P.owner.first}'s purse in the street a moment ago and kept it. If asked, you deny it, unless pressed hard.`;
      if (P.seen && P.seen.includes(q)) return `You saw the stranger pick up ${P.owner.first}'s purse and keep it. You think it shameful.`; return ''; });
    // the purse lying in the dust, glinting
    game.hooks.drawWorld.push((ctx, cam) => { if (!P || P.stage !== 'lying' || game.scene || P.s !== cur()) return; const x = Math.round(P.x - cam.x), y = Math.round(P.y - cam.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 4, y, 9, 2); ctx.fillStyle = '#6b4423'; ctx.fillRect(x - 3, y - 4, 7, 4); ctx.fillRect(x - 2, y - 5, 5, 1); ctx.fillStyle = '#4a2e17'; ctx.fillRect(x - 1, y - 6, 3, 1); ctx.fillStyle = '#8a5a2e'; ctx.fillRect(x - 2, y - 3, 2, 1); ctx.fillStyle = '#c9a24a'; ctx.fillRect(x + 2, y - 1, 2, 1);
      if (Math.floor(performance.now() / 260) % 5 === 0) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(x + 3, y - 2, 1, 1); ctx.fillRect(x + 2, y - 3, 1, 1); ctx.fillRect(x + 4, y - 3, 1, 1); ctx.fillRect(x + 3, y - 4, 1, 1); } });
    O.DroppedPurse = { get drop() { return P; }, get returned() { return returned; }, get kept() { return kept; }, get npcReturned() { return npcReturned; }, get npcKept() { return npcKept; }, get selfFound() { return selfFound; }, get byYou() { return byYou; }, soon: () => { cool = 0; force = true; } };
  }
  O.DroppedPurseSetup = { setup };
})();
