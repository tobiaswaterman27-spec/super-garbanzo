// A hand with the house. When someone is up a ladder at the thatch or limewashing a house front, you can
// lend a hand: foot the ladder (it goes quicker and safer, and they chat down to you), or take up a second
// brush. A neighbour sometimes does the same. And a ladder nobody is footing can skid on the cobbles: a
// shout, a clatter, someone in a heap at the foot of the wall, and the street comes running; help them up
// if you're near.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._ladder && !q.visitor && !talking(q);
    let forceSlip = false, H = null, F = null, helps = 0, npcHelps = 0, falls = 0, pickedUp = 0, lastJob = null;
    const rel_ = (q) => { if (!q || !q._ladder) return; q._ladder = false; if (q.agent) { q.agent.forceAnim = null; q.agent.lift = 0; if (!talking(q)) q.agent.frozen = false; } };
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene || !O.Repairs) return; const j = O.Repairs.job;
      // a fall: the heap at the foot of the wall
      if (F) { F.t += dt; const q = F.q, a = q.agent; if (F.s !== s || F.t > 70 || q.alive === false) { rel_(q); if (F.h) rel_(F.h); F = null; return; }
        if (!F.up) { a.forceAnim = F.t < 1 ? 'hurt' : 'lie'; a.lift = 0;
          if (!F.h && F.t > 6 && Math.random() < dt * 0.3) { const h = s.people.filter((x) => x !== q && free(x) && x.age >= 14 && Math.hypot(x.agent.x - a.x, x.agent.y - a.y) < 240)[0]; if (h) { F.h = h; h._ladder = true; if (near(h.agent.x, h.agent.y, 300)) say(h, pick([`${q.first}! Don't move, don't move!`, 'Is anything broken? Lie still!']), 2); O.Errands.send(s, h, [Math.floor(a.x / T) + 1, Math.floor(a.y / T)], { anim: 'crouch', secs: 2, face: 1, sprint: true, giveUp: game.t + 30, after: (ok) => { if (!F || F.h !== h) return; if (!ok) { rel_(h); F.h = null; return; } h.agent.frozen = true; F.up = 'npc'; F.upAt = F.t; try { s.relate(q, h, 0.12); s.remember(q, `I fell off my ladder and ${h.first} picked me up.`, 'kindness', 0.6, h.id); } catch (e) { /* */ } } }); } }
          if (F.t > 40) { F.up = 'self'; F.upAt = F.t; } }
        else { a.forceAnim = F.t - F.upAt < 1.5 ? 'sit' : 'idle'; if (F.t - F.upAt > 1.5 && !F.said) { F.said = true; if (near(a.x, a.y, 300)) say(q, F.up === 'you' ? pick(['Thank you. Nothing broken, I think. Just my pride.', 'Oof. I\'ll hold the ladder next time and get someone else up it.']) : F.up === 'npc' ? pick(['I\'m all right, I\'m all right.', 'My back! Oh, my back.']) : pick(['Nobody, then. Fine.', 'Up I get. Slowly.']), 2.4); }
          if (F.t - F.upAt > 4) { rel_(q); if (F.h) rel_(F.h); F = null; } }
        return; }
      if (!j || j.s !== s || (H && H.j !== j)) { if (H) { finish(s, H); rel_(H.npc); H = null; } if (!j || j.s !== s) return; }
      if (lastJob !== j) { lastJob = j; H = { j, you: false, npc: null, t: 0, slipRoll: false, chat: 6 };
        // a neighbour comes to foot the ladder, now and then
        if (j.kind === 'roof' && Math.random() < 0.35) setTimeout(() => { if (!H || H.j !== j || H.you || H.npc || O.Repairs.job !== j) return; const n = s.people.filter((x) => x !== j.q && free(x) && x.age >= 14 && Math.hypot(x.agent.x - j.x0, x.agent.y - j.y0) < 260)[0]; if (!n) return; H.npc = n; n._ladder = true; O.Errands.send(s, n, [Math.floor(j.x0 / T) - 1, Math.floor(j.y0 / T)], { anim: 'take', secs: 0.4, face: 0, giveUp: game.t + 25, after: (ok) => { if (!H || H.npc !== n) return; if (!ok) { rel_(n); H.npc = null; return; } n.agent.frozen = true; n.agent.path = null; n.agent.forceAnim = 'take'; npcHelps++; if (near(n.agent.x, n.agent.y, 260)) say(n, pick(['I\'ve got the foot of it.', 'Go on up, I\'ll hold her steady.']), 2); try { s.relate(j.q, n, 0.06); } catch (e) { /* */ } } }); }, 3000 + Math.random() * 5000); }
      H.t += dt; const a = j.q.agent;
      // footing the ladder (you): quicker, and they talk down to you
      if (H.you) { const P = game.player; if (!near(j.x0, j.y0, 34)) { H.you = false; game.player.anim = 'idle'; O.UI && O.UI.say && O.UI.say('You let go of the ladder.', 'info'); }
        else { P.dir = 0; P.anim = j.kind === 'roof' ? 'take' : 'scrub'; j.t += dt * 0.6; H.youT = (H.youT || 0) + dt; H.chat -= dt; if (H.chat <= 0) { H.chat = 7 + Math.random() * 5; say(j.q, j.kind === 'roof' ? pick(['Pass me up the pegs? No, no, just hold it.', 'The wind took half of this in the winter.', 'Steady! Steady...', 'Nearly there.', 'You can see three parishes from up here.']) : pick(['Work it into the grain, like that.', 'Two coats, or the rain has it off by spring.', 'It\'ll look like new.']), 2.4); }
          if (j.kind === 'wash') j.t += dt * 0.4; } }
      if (H.npc && H.npc.agent.frozen) { H.npc.agent.forceAnim = Math.floor(H.t / 4) % 3 === 0 ? 'talk' : 'take'; j.t += dt * 0.3; }
      // the ladder skids, if nobody's footing it
      if (j.kind === 'roof' && !H.slipRoll && j.t > 20 && j.t < 50) { H.slipRoll = true; if (!H.you && !(H.npc && H.npc.agent.frozen) && (forceSlip || Math.random() < 0.12)) { forceSlip = false;
        const q = j.q; H.fell = true; j.t = 70.5; // (ends the mending)
        setTimeout(() => { if (q.alive === false) return; falls++; q._ladder = true; q.agent.frozen = true; q.agent.path = null; q.agent.lift = 0; F = { s, q, t: 0, up: null }; if (near(q.agent.x, q.agent.y, 340)) { say(q, 'Whoa, whoa! AH!', 1.6); O.sfx && O.sfx('smack', 0.4); O.UI && O.UI.say && O.UI.say(`The ladder skids on the cobbles and ${q.first} comes down with it.`, 'warn'); }
          for (const z of s.people) if (z !== q && z.agent && !z.agent.hidden && z.agent.inside == null && Math.hypot(z.agent.x - q.agent.x, z.agent.y - q.agent.y) < 200) { O.gesture && O.gesture(z, 'shocked', 1.2); try { s.remember(z, `Saw ${q.first} fall off a ladder.`, 'social', 0.4, q.id); } catch (e) { /* */ } } }, 50); } }
    });
    function finish(s, H) { const j = H.j, q = j.q; if (H.fell) return;
        if (H.you && (H.youT || 0) > 8) { helps++; const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.1); r.familiar = Math.min(1, (r.familiar || 0) + 0.15); setTimeout(() => say(q, pick(['Done! Many hands. Thank you, friend.', 'Couldn\'t have done it half so quick alone.', 'There. Come by for a cup when you\'re passing.']), 2.4), 600); try { s.remember(q, j.kind === 'roof' ? 'The stranger held my ladder while I mended the thatch.' : 'The stranger took up a brush and helped me limewash the house.', 'kindness', 0.5); } catch (e) { /* */ }
          const hh = s.household(q); if (hh && hh.money > 20 && Math.random() < 0.5) { hh.money -= 1; PS.money = (PS.money || 0) + 1; setTimeout(() => O.UI && O.UI.say && O.UI.say(`${q.first} presses a penny on you for your trouble.`, 'good'), 1500); } }
        if (H.you) { H.you = false; game.player.anim = 'idle'; } }
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (game.scene || P.locked) return null; const s = cur();
      if (F && !F.up) { const a = F.q.agent; if (Math.hypot(a.x - P.x, a.y - P.y) < 40) return { type: 'custom', d: 1, x: a.x, y: a.y - 26, label: `Help ${F.q.first} up`, act: () => { pickedUp++; F.up = 'you'; F.upAt = F.t; P.anim = 'pickup'; setTimeout(() => { P.anim = 'idle'; }, 900); if (F.h) { rel_(F.h); F.h = null; } try { const r = relOf(F.q); r.affinity = Math.min(1, r.affinity + 0.12); s.remember(F.q, 'I fell off my ladder and the stranger picked me up.', 'kindness', 0.7); } catch (e) { /* */ } } }; return null; }
      const j = O.Repairs && O.Repairs.job; if (!j || !H || H.j !== j || H.you || j.t > 56 || j.t < 2.5) return null; if (Math.hypot(j.x0 - P.x, j.y0 - P.y) > 30) return null;
      if (H.npc && H.npc.agent.frozen) return null;
      return { type: 'custom', d: 2, x: j.x0, y: j.y0 - 30, label: j.kind === 'roof' ? `Foot ${j.q.first}'s ladder for them` : `Take up a brush and help ${j.q.first} limewash`, act: () => { H.you = true; H.youT = 0; P.x = j.x0 + (j.kind === 'roof' ? -6 : 14); P.y = j.y0 + 2; say(j.q, j.kind === 'roof' ? pick(['Bless you. She wobbles on these stones.', 'Ah, that\'s better. Hold her steady.']) : pick(['Many hands! There\'s a brush in the bucket.', 'You\'ll get white on you, mind.']), 2.4); } }; });
    (O.extraLines = O.extraLines || []).push((s, q) => F && q === F.q ? 'You have just fallen off a ladder while mending a roof; you are bruised and shaken.' : '');
    O.RepairHelp = { get helps() { return helps; }, get npcHelps() { return npcHelps; }, get falls() { return falls; }, get pickedUp() { return pickedUp; }, get fall() { return F; }, get help() { return H; }, slip: () => { forceSlip = true; } };
  }
  O.RepairHelpSetup = { setup };
})();
