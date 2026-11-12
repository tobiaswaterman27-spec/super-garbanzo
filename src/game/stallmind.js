// Minding the stall. On a market or fair day a seller has to step away (nature calls, a child is crying
// somewhere, the carter wants a word) and looks round for someone to watch the trestle. If it's you: stand
// behind it, and folk come up and ask the price, and you sell them what they point at, the coins going in
// the box. A light-fingered lad may try the end of the trestle; catch his wrist or lose a cabbage. And the
// box is right there, and nobody's counting yet. When the seller comes back they count: honest, and they
// press a coin or a bit of their wares on you and tell the square; short, and they know, and so will the
// square. If you don't step up, the next seller along minds it for them, and is minded in turn.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState, G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.4);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const gname = (g) => (G[g] && G[g].name ? G[g].name.toLowerCase() : g);
    const standing = (s, q) => q && q.fairStall && q.fairStall.day === s.day && q.activity?.act === 'stand' && !q.agent.path && !q.errand && !q._mind && !q._deal && !talking(q) && q.alive !== false && q.wares && Object.values(q.wares).some((n) => n > 0);
    let K = null, cool = 90, force = false, minded = 0, byNpc = 0, sold = 0, caught = 0, robbed = 0, skimmed = 0, honest = 0;
    const coins = [];
    function hold(q) { q._mind = true; q.agent.frozen = true; q.agent.path = null; }
    function rel_(q) { if (!q || !q._mind) return; q._mind = false; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; }
    function end() { if (!K) return; if (K.atDoor && K.sl.agent) K.sl.agent.hidden = false; rel_(K.sl); rel_(K.nb); if (K.buyer) rel_(K.buyer); if (K.thief) rel_(K.thief); K = null; }
    const stallXY = () => [K.sl.fairStall.tile[0] * T + 8, K.sl.fairStall.tile[1] * T + 10];
    // the seller steps away, to a door a little way off, and comes back
    function goAway(s) { const sl = K.sl; K.stage = 'away'; K.awayT = 0; K.box = 0; K.boxSeen = 0; K.soldN = 0; K.lost = 0; sl.agent.frozen = false; sl.agent.forceAnim = null;
      const doors = s.world.buildings.filter((b) => b.doorX != null && !b.ruined && Math.hypot(b.doorX - sl.fairStall.tile[0], b.doorY - sl.fairStall.tile[1]) > 6 && Math.hypot(b.doorX - sl.fairStall.tile[0], b.doorY - sl.fairStall.tile[1]) < 20); const d = pick(doors);
      const tgt = d ? [d.doorX, d.doorY + 1] : [sl.fairStall.tile[0] + 8, sl.fairStall.tile[1] + 4]; K.awayFor = 35 + Math.random() * 20;
      O.Errands.send(s, sl, tgt, { anim: 'open', secs: 1, face: 0, giveUp: game.t + 40, after: () => { if (!K || K.sl !== sl) return; sl.agent.frozen = true; sl.agent.path = null; sl.agent.hidden = !!d; K.atDoor = true; } }); }
    function comeBack(s) { const sl = K.sl; K.stage = 'back'; sl.agent.hidden = false; sl.agent.frozen = false; O.Errands.send(s, sl, sl.fairStall.tile, { anim: 'count', secs: 2.2, face: 0, giveUp: game.t + 40, after: () => { if (!K || K.sl !== sl) return; hold(sl); reckon(s); } }); }
    function reckon(s) { const sl = K.sl, here = near(sl.agent.x, sl.agent.y, 340); sl.purse = (sl.purse || 0) + K.box;
      if (K.nb) { const nb = K.nb; try { s.relate(sl, nb, 0.15); s.relate(nb, sl, 0.05); s.remember(sl, `${nb.first} minded my stall while I stepped away.`, 'kindness', 0.5, nb.id); } catch (e) { /* */ } if (here) say(sl, pick([`Thank you, ${nb.first}. I owe you one.`, 'Back. Anything sell?']), 2.2); if (here) setTimeout(() => K && K.nb === nb && say(nb, pick(['Two eggs and a deal of gossip.', 'Quiet as the grave. Off I go.']), 2.2), 1500); setTimeout(end, 3500); return; }
      // you minded it
      const short = K.skim > 0, gone = K.left; const r = relOf(sl);
      if (short) { skimmed++; r.affinity = Math.max(-1, r.affinity - 0.4); if (PS.rep) PS.rep.criminal = Math.min(1, (PS.rep.criminal || 0) + 0.03); sl.agent.forceAnim = 'shocked';
        if (here) say(sl, pick([`I counted my wares before I went. There should be ${K.box + K.skim} in this box, not ${K.box}.`, 'You thieving... I trusted you with my box!', 'Short. Short! I\'ll have the whole square know what you are.']), 3);
        try { s.remember(sl, `I left the stranger minding my stall and they helped themselves from my box. ${K.skim} aurin.`, 'crime', 1.4); O.TownTalk && O.TownTalk.tell(sl.agent.x, sl.agent.y, `The stranger minded ${sl.first}'s stall and helped themselves from the box. Shameful.`, `They say the stranger robbed a market stall they were minding.`); } catch (e) { /* */ } }
      else if (gone) { r.affinity = Math.max(-1, r.affinity - 0.15); if (here) say(sl, pick(['You said you\'d mind it! I come back and nobody\'s here.', 'Left it standing, did you? Anyone could have helped themselves.']), 2.8); try { s.remember(sl, 'I asked the stranger to mind my stall and they wandered off and left it.', 'slight', 0.6); } catch (e) { /* */ } }
      else { honest++; r.affinity = Math.min(1, r.affinity + 0.15); r.familiar = Math.min(1, (r.familiar || 0) + 0.2); const tip = Math.max(1, Math.round(K.box / 4)); sl.purse = Math.max(0, sl.purse - tip); PS.money = (PS.money || 0) + tip; const have = Object.entries(sl.wares).filter(([g, n]) => n > 0 && G[g] && PS.canCarry && PS.canCarry(g)).map(([g]) => g); const extra = K.soldN >= 2 && have.length ? pick(have) : null; if (extra) { sl.wares[extra]--; PS.add(extra); }
        O.UI && O.UI.say && O.UI.say(`${sl.first} counts the box: ${K.box} aurin from ${K.soldN} sale${K.soldN === 1 ? '' : 's'}${K.lost ? `, one ${gname(K.lostG)} short to a thief` : ''}. They give you ${tip}${extra ? ` and some ${gname(extra)}` : ''} for your trouble.`, 'good');
        if (here) say(sl, K.lost ? pick(['A thief? Ah, the little devils. You did what you could.', 'One short, but the box is right. Thank you.']) : pick(['Every penny. You\'re honest, and that\'s rare on a market day.', `${K.box} in the box! You've a gift for it.`, 'Bless you. Here, for your trouble.']), 2.8);
        try { s.remember(sl, `The stranger minded my stall on market day and every coin was in the box.`, 'kindness', 0.9); O.TownTalk && O.TownTalk.tell(sl.agent.x, sl.agent.y, `The stranger minded ${sl.first}'s stall on market day, and every coin was in the box.`, 'They say the stranger is honest; minded a stall and never touched the box.'); } catch (e) { /* */ } }
      setTimeout(end, 3500); }
    // a customer comes up to you
    function customer(s) { const [x, y] = stallXY(); const b = s.people.find((q) => q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._deal && !q._mind && !q._scene && q.age >= 14 && !q.visitor && q.alive !== false && !talking(q) && Math.hypot(q.agent.x - x, q.agent.y - y) < 260);
      const have = Object.entries(K.sl.wares).filter(([g, n]) => n > 0 && G[g]).map(([g]) => g); if (!b || !have.length) return; const g = pick(have); K.buyer = b; b._mind = true; K.want = g; K.price = Math.max(1, Math.round((G[g].base || 2) * 1.1)); K.buyAt = null;
      O.Errands.send(s, b, [Math.floor(x / T), Math.floor(y / T) + 1], { anim: 'point', secs: 0.8, face: 0, giveUp: game.t + 25, after: (ok) => { if (!K || K.buyer !== b) return; if (!ok) { rel_(b); K.buyer = null; return; } hold(b); K.buyAt = K.awayT; if (near(b.agent.x, b.agent.y, 200)) say(b, pick([`How much for the ${gname(g)}?`, `I'll have some ${gname(g)}, if it's fresh.`, `Where's ${K.sl.first}? Well, you'll do. ${gname(g)[0].toUpperCase() + gname(g).slice(1)}, please.`]), 2.4); } }); }
    function thief(s) { const [x, y] = stallXY(); const t = s.people.find((q) => q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._mind && !q._scene && q.age >= 9 && q.age <= 16 && q.alive !== false && !talking(q) && Math.hypot(q.agent.x - x, q.agent.y - y) < 300);
      if (!t) return; K.thief = t; t._mind = true; K.grabAt = null; O.Errands.send(s, t, [Math.floor(x / T) + 2, Math.floor(y / T)], { anim: 'idle', secs: 0.3, face: 2, giveUp: game.t + 25, after: (ok) => { if (!K || K.thief !== t) return; if (!ok) { rel_(t); K.thief = null; return; } hold(t); t.agent.forceAnim = 'take'; K.grabAt = K.awayT; if (near(t.agent.x, t.agent.y, 220)) O.UI && O.UI.say && O.UI.say(`${t.first} is reaching for the end of the trestle...`, 'warn'); } }); }
    function thiefGets(s) { const t = K.thief; const have = Object.entries(K.sl.wares).filter(([g, n]) => n > 0).map(([g]) => g); if (have.length) { const g = pick(have); K.sl.wares[g]--; K.lost++; K.lostG = g; robbed++; } t.agent.forceAnim = null; t.agent.frozen = false; t._mind = false; K.thief = null; const home = t.home != null && s.building(t.home); O.Errands.send(s, t, home && home.doorX != null ? [home.doorX, home.doorY + 1] : [Math.floor(t.agent.x / T) + 12, Math.floor(t.agent.y / T)], { anim: 'laugh', secs: 1, face: 0, sprint: true, giveUp: game.t + 40 }); if (near(t.agent.x, t.agent.y, 260)) say(t, 'Ha!', 1.2); }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      for (const c of coins.slice()) { c.t += dt; if (c.t >= c.dur) coins.splice(coins.indexOf(c), 1); }
      if (K) { K.t += dt; const sl = K.sl; if (K.s !== s || K.t > 200 || sl.alive === false || !sl.fairStall || sl.fairStall.day !== s.day || s.hour >= 14) { if (K.stage === 'away' || K.stage === 'back') { sl.agent.hidden = false; } end(); return; }
        if (K.stage === 'ask') { sl.agent.dir = O.dirOf(game.player.x - sl.agent.x, game.player.y - sl.agent.y);
          if (K.t > 16 && !K.nb) { // no answer: the next seller along
            const nb = s.people.filter((q) => q !== sl && standing(s, q) && Math.hypot(q.agent.x - sl.agent.x, q.agent.y - sl.agent.y) < 220).sort((a, b) => Math.hypot(a.agent.x - sl.agent.x, a.agent.y - sl.agent.y) - Math.hypot(b.agent.x - sl.agent.x, b.agent.y - sl.agent.y))[0];
            if (!nb) { if (near(sl.agent.x, sl.agent.y, 300)) say(sl, 'Nobody? Then I\'ll just have to hold on.', 2); end(); return; }
            K.nb = nb; nb._mind = true; byNpc++; if (near(sl.agent.x, sl.agent.y, 300)) say(sl, `${nb.first}! Mind my trestle a moment, would you?`, 2.2); setTimeout(() => { if (K && K.nb === nb && near(nb.agent.x, nb.agent.y, 300)) say(nb, pick(['Go on, I\'ve got it.', 'Be quick, then.']), 1.8); }, 1500);
            O.Errands.send(s, nb, [sl.fairStall.tile[0] - 1, sl.fairStall.tile[1]], { anim: 'idle', secs: 0.2, face: 1, giveUp: game.t + 20, after: (ok) => { if (!K || K.nb !== nb) return; if (!ok) { end(); return; } hold(nb); goAway(s); } }); }
          return; }
        if (K.stage === 'away') { K.awayT += dt; const [x, y] = stallXY();
          if (K.mine) { const far = !near(x, y, 120); if (far) { K.farT = (K.farT || 0) + dt; if (K.farT > 6 && !K.left) { K.left = true; O.UI && O.UI.say && O.UI.say(`You've left ${sl.first}'s stall standing on its own.`, 'warn'); } } else K.farT = 0;
            if (!K.buyer && !K.thief && K.awayT > 4 && Math.random() < dt * 0.22) customer(s);
            if (!K.thief && !K.thiefTried && K.awayT > 12 && Math.random() < dt * 0.05) { K.thiefTried = true; if (Math.random() < 0.5) thief(s); }
            if (K.buyer && K.buyAt != null && K.awayT - K.buyAt > 12) { const b = K.buyer; if (near(b.agent.x, b.agent.y, 200)) say(b, pick(['Is anyone serving or not?', 'Hmph. I\'ll go elsewhere.']), 2); rel_(b); K.buyer = null; }
            if (K.thief && K.grabAt != null && K.awayT - K.grabAt > 4.5) thiefGets(s);
            if (K.left && K.thief == null && !K.thiefTried) { K.thiefTried = true; thief(s); } }
          if (K.nb) { const nb = K.nb; nb.agent.forceAnim = Math.floor(K.awayT / 3) % 3 === 0 ? 'talk' : 'idle'; }
          if (K.awayT > K.awayFor && K.atDoor) comeBack(s);
          return; }
        return; }
      cool -= dt; if (cool > 0 && !force) return; cool = 160 + Math.random() * 160; if (s.hour < 8 || s.hour >= 13) { force = false; return; } const forced = force; force = false;
      const sl = s.people.filter((q) => standing(s, q) && near(q.agent.x, q.agent.y, forced ? 300 : 200)).sort((a, b) => Math.hypot(a.agent.x - game.player.x, a.agent.y - game.player.y) - Math.hypot(b.agent.x - game.player.x, b.agent.y - game.player.y))[0]; if (!sl) return;
      hold(sl); K = { s, sl, t: 0, stage: 'ask', mine: false, skim: 0 }; sl.agent.forceAnim = 'wave';
      const ask = relOf(sl).affinity > -0.2 && near(sl.agent.x, sl.agent.y, 160);
      if (near(sl.agent.x, sl.agent.y, 320)) say(sl, ask ? pick(['You there! Would you mind my trestle a moment? Nature calls.', 'Could you watch my stall? My little one\'s run off somewhere.', 'Be a friend and mind this a moment? I\'ll not be long.']) : pick(['Oh, I need to step away. Who\'ll mind this?', 'Nature calls, and nobody to mind the stall.']), 2.8);
      if (!ask) K.t = 16; });
    function accept() { const s = cur(); if (!K || K.stage !== 'ask') return; K.mine = true; minded++; const sl = K.sl; say(sl, pick(['Bless you. Prices are on the board; don\'t let them haggle you to nothing.', 'You\'re a good soul. Back in two shakes.']), 2.6); K.stage = 'going'; setTimeout(() => { if (K && K.sl === sl && K.stage === 'going') goAway(s); }, 1500); O.UI && O.UI.say && O.UI.say(`Stand behind ${sl.first}'s trestle. Serve whoever comes; keep an eye on the end of it.`, 'info'); }
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!K || game.scene || P.locked) return null; const s = cur();
      if (K.stage === 'ask' && !K.nb) { const a = K.sl.agent; if (Math.hypot(a.x - P.x, a.y - P.y) > 50) return null; return { type: 'custom', d: 2, x: a.x, y: a.y - 30, label: `Mind ${K.sl.first}'s stall for them`, act: accept }; }
      if (K.stage !== 'away' || !K.mine) return null;
      if (K.thief && K.grabAt != null) { const ta = K.thief.agent; if (Math.hypot(ta.x - P.x, ta.y - P.y) < 50) return { type: 'custom', d: 1, x: ta.x, y: ta.y - 28, label: `Catch ${K.thief.first}'s wrist`, act: () => { const t = K.thief; caught++; P.anim = 'attack'; setTimeout(() => { P.anim = 'idle'; }, 600); t.agent.forceAnim = 'hurt'; O.sfx && O.sfx('smack', 0.3); say(t, pick(['Ow! I wasn\'t doing nothing!', 'Let go! Let go!']), 1.8); try { s.remember(t, 'The stranger caught my wrist at a market stall.', 'grudge', 0.6); } catch (e) { /* */ } setTimeout(() => { if (!K || K.thief !== t) return; t._mind = false; t.agent.frozen = false; t.agent.forceAnim = null; K.thief = null; const h = t.home != null && s.building(t.home); O.Errands.send(s, t, h && h.doorX != null ? [h.doorX, h.doorY + 1] : [Math.floor(t.agent.x / T) - 10, Math.floor(t.agent.y / T)], { anim: 'idle', secs: 1, face: 0, sprint: true, giveUp: game.t + 40 }); }, 900); O.UI && O.UI.say && O.UI.say(`You catch ${t.first} by the wrist with a hand already on the goods. They wriggle free and run, empty-handed.`, 'good'); } }; }
      if (K.buyer && K.buyAt != null) { const ba = K.buyer.agent; if (Math.hypot(ba.x - P.x, ba.y - P.y) < 50) return { type: 'custom', d: 2, x: ba.x, y: ba.y - 28, label: `Sell ${K.buyer.first} the ${gname(K.want)} (₳${K.price})`, act: () => { const b = K.buyer; if (!(K.sl.wares[K.want] > 0)) { say(b, 'All gone? Pity.', 1.6); rel_(b); K.buyer = null; return; } K.sl.wares[K.want]--; K.box += K.price; K.soldN++; sold++; P.anim = 'give'; setTimeout(() => { P.anim = 'idle'; }, 700); b.agent.forceAnim = 'give'; coins.push({ x0: ba.x, y0: ba.y - 12, x1: P.x, y1: P.y - 12, t: 0, dur: 0.45 }); O.sfx && O.sfx('coins', 0.25); try { const h = s.household(b); if (h) h.money = Math.max(0, (h.money || 0) - K.price); } catch (e) { /* */ } setTimeout(() => { if (K && K.buyer === b) { say(b, pick(['Thank you kindly.', 'There. Good day to you.']), 1.6); rel_(b); K.buyer = null; } }, 1200); } }; }
      const [x, y] = stallXY(); if (K.box > 0 && Math.hypot(x - P.x, y - P.y) < 40) return { type: 'custom', d: 12, x, y: y - 34, label: `Slip a coin or two from the box into your own purse`, act: () => { const take = Math.min(K.box, 1 + Math.floor(Math.random() * 3)); K.box -= take; K.skim += take; PS.money = (PS.money || 0) + take; O.UI && O.UI.say && O.UI.say(`${take} aurin from ${K.sl.first}'s box into your purse. Nobody saw. Probably.`, 'info'); const w = s.people.find((q) => q.agent && !q.agent.hidden && q.agent.inside == null && q !== K.sl && q.age >= 8 && near(q.agent.x, q.agent.y, 90)); if (w) { try { s.remember(w, `I saw the stranger take coins from ${K.sl.first}'s box while minding the stall.`, 'crime', 1, 0); } catch (e) { /* */ } } } };
      return null; });
    // or say yes in your own words
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) { try { const t = String(text || ''); if (K && K.stage === 'ask' && !K.nb && q === K.sl && /\b(yes|aye|of course|sure|i'?ll (mind|watch|keep)|go on|happy to|gladly|i will|no trouble)\b/i.test(t) && !/\b(no|not|can't|cannot|won't)\b/i.test(t)) { setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); accept(); }, 1400); return respond(q, t, 'Bless you! Back in two shakes.', render); } } catch (e) { console.error(e); } return _say.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!K) return ''; if (q === K.sl) return K.stage === 'ask' ? 'You need to step away from your market stall for a few minutes and have just asked the player to mind it for you. If they say yes you are grateful and go.' : K.mine ? 'The player is minding your market stall while you are away.' : ''; if (q === K.nb) return `You are minding ${K.sl.first}'s stall while they step away.`; return ''; });
    game.hooks.drawWorld.push((ctx, cam) => { if (!coins.length || game.scene) return; for (const c of coins) { const k = c.t / c.dur, x = c.x0 + (c.x1 - c.x0) * k, y = c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 10; ctx.fillStyle = '#e0c050'; ctx.fillRect(Math.round(x - cam.x) - 1, Math.round(y - cam.y) - 1, 3, 2); } });
    O.StallMind = { get job() { return K; }, get minded() { return minded; }, get byNpc() { return byNpc; }, get sold() { return sold; }, get caught() { return caught; }, get robbed() { return robbed; }, get skimmed() { return skimmed; }, get honest() { return honest; }, soon: () => { cool = 0; force = true; }, accept };
  }
  O.StallMindSetup = { setup };
})();
