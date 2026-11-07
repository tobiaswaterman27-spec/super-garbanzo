// Protection money, collected where you can see it. On collection day the gang's heavies go shop to
// shop and stand at the door; the shopkeeper comes out wiping their hands. Most count the coins into a
// palm with a sour face. A brave one shakes their head, and is shoved against the doorpost, a basket
// kicked over, a finger in the face. You can step in by speech ("leave them be"), pay it for them, or
// stand there and watch.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, SP = O.Sim.prototype, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const nearP = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const _plan = SP.plan;
    SP.plan = function (p) {
      const r = _plan.apply(this, arguments);
      try { if (r && r.act === 'visit' && r.collecting && r.b != null) { const b = this.building(r.b); if (b && b.doorX != null && !(p._shook && p._shook[r.b] === this.day)) return { act: 'shakedown', b: r.b, gang: r.collecting, outdoor: true, zone: 'shopdoor:' + r.b }; if (p._shook && p._shook[r.b] === this.day) return { act: 'stroll', outdoor: true, zone: 'square' }; } } catch (e) { /* */ }
      return r;
    };
    const _zone = SP.zoneTile;
    SP.zoneTile = function (p, zone) {
      if (typeof zone === 'string' && zone.startsWith('shopdoor:')) { const b = this.building(+zone.slice(9)); if (b && b.doorX != null) return [b.doorX + ((p.id % 2) ? 1 : 0), b.doorY + 1]; return _zone.call(this, p, 'square'); }
      return _zone.apply(this, arguments);
    };
    const scenes = [];
    const coins = [];
    function ownerFor(s, bid) { const bz = [...s.biz.values()].find((z) => (z.b?.id ?? z.id) === bid || z.building === bid); if (!bz) return [null, null]; const ids = [bz.owner, ...(bz.workers || [])].filter((x) => x != null && x !== 'player'); const ppl = ids.map((i) => s.byId.get(i)).filter((q) => q && q.alive !== false && !q._cp && !q._bit && !q.errand && !q._scene && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)); return [bz, ppl.find((q) => q.agent.inside === bid) || ppl.find((q) => q.agent.inside == null && !q.agent.hidden && Math.hypot(q.agent.x - (s.building(bid).doorX * T + 8), q.agent.y - (s.building(bid).doorY * T + 16)) < 80) || null]; }
    function begin(s, heavy, bid) {
      const b = s.building(bid); const [bz, owner] = ownerFor(s, bid); (heavy._shook ||= {})[bid] = s.day;
      if (!owner || !b) { heavy.activity = null; heavy.agent.path = null; return; }
      const doorX = b.doorX * T + 8, doorY = b.doorY * T + 16;
      const wasIn = owner.agent.inside;
      if (wasIn != null) { owner.agent.inside = null; owner.agent.hidden = false; owner.agent.x = doorX; owner.agent.y = doorY + 2; }
      for (const q of [heavy, owner]) { q._shake = true; q.agent.frozen = true; q.agent.path = null; }
      const brave = (owner.traits || []).some((t) => ['brave', 'hostile', 'stubborn'].includes(t)) && Math.random() < 0.55;
      const g = s.gang && s.gang(heavy.gang); const toll = 2 + ((g && g.level) || 1) * 2;
      scenes.push({ s, heavy, owner, bid, bz, g, toll, wasIn, brave, t: 0, step: 0, door: [doorX, doorY] });
      O.gesture && O.gesture(heavy, 'open', 0.6); O.sfx && nearP(doorX, doorY, 300) && O.sfx('door', 0.4);
    }
    function finish(sc) {
      const { heavy, owner } = sc; for (const q of [heavy, owner]) { q._shake = false; q.agent.forceAnim = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; }
      if (sc.wasIn != null && owner.alive !== false && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === owner)) { owner.agent.inside = sc.wasIn; owner.agent.hidden = true; }
      heavy.activity = { act: 'stroll', outdoor: true, zone: 'square' }; heavy.agent.path = null;
      scenes.splice(scenes.indexOf(sc), 1);
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      for (const c of coins.slice()) { c.t += dt; if (c.t >= c.dur) coins.splice(coins.indexOf(c), 1); }
      for (const p of s.people) { const a = p.activity; if (!a || a.act !== 'shakedown' || p._shake || p.agent.path || p.agent.inside != null || p.agent.hidden) continue; if (scenes.some((x) => x.bid === a.b)) continue; begin(s, p, a.b); }
      for (const sc of scenes.slice()) {
        const { heavy: h, owner: o } = sc; sc.t += dt;
        if (sc.s !== s || h.alive === false || o.alive === false || h._fighting || o._fighting) { finish(sc); continue; }
        if (O.npcUI && O.npcUI.talking && (O.npcUI.talking() === h || O.npcUI.talking() === o)) { sc.t -= dt; continue; } // (paused while you talk)
        h.agent.dir = O.dirOf(o.agent.x - h.agent.x, o.agent.y - h.agent.y); o.agent.dir = O.dirOf(h.agent.x - o.agent.x, h.agent.y - o.agent.y);
        const step = (k, fn) => { if (sc.step === k) { sc.step++; fn(); } };
        if (sc.t > 0.6) step(0, () => { h.agent.forceAnim = 'point'; say(h, pick([`Wednesday, ${o.first}. You know what for.`, 'Collection day. Same as always.', `${sc.g ? sc.g.name : 'The lads'} send their regards. And their hand.`])); o.agent.forceAnim = 'wipe'; });
        if (sc.t > 3) step(1, () => { h.agent.forceAnim = 'idle';
          if (sc.saved) { o.agent.forceAnim = 'bow'; say(o, 'You paid it? I... thank you. I won\'t forget it.'); }
          else if (!sc.brave && (sc.bz.cash || 0) >= sc.toll) { o.agent.forceAnim = 'count'; say(o, pick(['Here. Choke on it.', `${sc.toll}. That's all of it.`, 'Every week, more.']), 2); sc.paid = true; }
          else { o.agent.forceAnim = 'shake'; say(o, pick(['Not this week. Nor any week.', 'I\'ve nothing for you. Go and earn a living.', 'Get off my step.']), 2); } });
        if (sc.t > 4.6) step(2, () => { if (sc.paid) { o.agent.forceAnim = 'give'; h.agent.forceAnim = 'take'; sc.bz.cash = Math.max(0, (sc.bz.cash || 0) - sc.toll); if (sc.g) sc.g.purse = (sc.g.purse || 0) + sc.toll; sc.bz._paidGang = s.day; coins.push({ x0: o.agent.x, y0: o.agent.y - 12, x1: h.agent.x, y1: h.agent.y - 12, t: 0, dur: 0.5 }); O.sfx && nearP(o.agent.x, o.agent.y, 260) && O.sfx('kaching', 0.25); s.remember(o, `Paid ${sc.g ? sc.g.name : 'the gang'} their ₳${sc.toll} at my own door, with the street watching.`, 'gang', 1.2); }
          else if (!sc.saved) { h.agent.forceAnim = 'attack'; o.agent.forceAnim = 'hurt'; O.sfx && nearP(o.agent.x, o.agent.y, 300) && O.sfx('smack', 0.6); const ox = o.agent.x - Math.sign(h.agent.x - o.agent.x) * 4; if (!game.solidAt(ox, o.agent.y - 2)) o.agent.x = ox; sc.spill = { x: sc.door[0] + 10, y: sc.door[1] + 4, t: 0 }; sc.bz._refusedGang = s.day; s.remember(o, `${h.first} of ${sc.g ? sc.g.name : 'the gang'} shoved me against my own doorpost for not paying.`, 'grudge', 2.5); s.relate(o, h, -0.4); (sc.g && (sc.g.refused ||= []).push(sc.bz.id)); } });
        if (sc.t > 6) step(3, () => { if (sc.paid || sc.saved) { h.agent.forceAnim = 'nod'; say(h, pick(['Pleasure.', 'Same time next week.', 'See? Easy.']), 1.6); o.agent.forceAnim = 'idle'; } else { h.agent.forceAnim = 'point'; say(h, pick(['You\'ll wish you had. Mind your shutters tonight.', 'Wrong answer.', 'We\'ll be back. After dark.']), 2.2); o.agent.forceAnim = 'shocked'; } });
        if (sc.t > 8.5) finish(sc);
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return;
      for (const c of coins) { const k = c.t / c.dur, x = c.x0 + (c.x1 - c.x0) * k, y = c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 8; ctx.fillStyle = '#e0c050'; ctx.fillRect(Math.round(x - cam.x), Math.round(y - cam.y), 2, 2); ctx.fillRect(Math.round(x - cam.x) + 2, Math.round(y - cam.y) + 1, 2, 2); }
      for (const sc of scenes) if (sc.spill) { const x = Math.round(sc.spill.x - cam.x), y = Math.round(sc.spill.y - cam.y); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 4, y - 3, 7, 4); ctx.fillStyle = '#b8352a'; ctx.fillRect(x + 4, y, 2, 2); ctx.fillStyle = '#7aa04a'; ctx.fillRect(x + 7, y + 1, 2, 2); ctx.fillStyle = '#d8b070'; ctx.fillRect(x + 2, y + 2, 2, 1); }
    });
    // stepping in
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      try { const t = String(text || ''), sc = scenes.find((x) => x.heavy === q || x.owner === q), s = cur();
        if (sc && q === sc.heavy && sc.step < 3) {
          if (/\b(i'?ll pay|i will pay|here'?s (the|your) money|take (mine|it from me)|i'?ll cover)\b/i.test(t)) { if ((PS.money || 0) < sc.toll) return respond(q, t, 'With what? Your purse is lighter than theirs.', render); PS.money -= sc.toll; if (sc.g) sc.g.purse += sc.toll; sc.saved = true; sc.step = Math.max(sc.step, 1); sc.t = 2.9; s.relate(sc.owner, { id: 0 }, 0.4); s.remember(sc.owner, 'The stranger paid the gang\'s money for me at my own door.', 'kindness', 3); O.UI.say(`You count ₳${sc.toll} into ${q.first}'s palm.`, 'note'); return respond(q, t, 'Generous. Doesn\'t matter to me whose coin it is.', render); }
          if (/\b(leave (them|him|her) (be|alone)|back off|clear off|get away from|let (them|him|her) be|go away|leave it)\b/i.test(t)) { const fear = (PS.rep && PS.rep.criminal) || 0, wk = O.Combat && O.Combat.weapon && O.Combat.weapon(), armed = wk && wk.key && wk.key !== 'fists'; if (fear > 0.3 || armed && Math.random() < 0.6) { sc.saved = true; sc.paid = false; sc.step = 4; sc.t = 7.5; s.relate(sc.owner, { id: 0 }, 0.35); s.remember(sc.owner, 'The stranger stood between me and the gang at my own door.', 'kindness', 3); s.relate(q, { id: 0 }, -0.3); if (sc.g && sc.g.rel) sc.g.rel.player = sc.g.rel.player === 'friend' ? 'neutral' : 'wary'; return respond(q, t, pick(['...Have it your way. This time.', 'You\'ve a short life ahead of you, friend.', 'Another day, then.']), render); } return respond(q, t, pick(['Walk on, if you know what\'s good for you.', 'This is none of yours. Keep walking.']), render); }
        }
      } catch (e) { console.error(e); }
      return _say.apply(this, arguments);
    };
    (O.extraLines = O.extraLines || []).push((s, q) => { const sc = scenes.find((x) => x.heavy === q || x.owner === q); if (!sc) return ''; return q === sc.heavy ? `You are at ${sc.owner.first}'s shop door collecting ${sc.g ? sc.g.name + '\'s' : 'the gang\'s'} protection money (₳${sc.toll}). You don't want trouble from a stranger, but you're not easily frightened off.` : `${sc.heavy.first} from ${sc.g ? sc.g.name : 'the gang'} is at your door for protection money, ₳${sc.toll}. You're frightened and angry.`; });
    O.Shakedown = { scenes, start(heavy, bid) { begin(cur(), heavy, bid); return scenes[scenes.length - 1]; } };
  }
  O.ShakedownSetup = { setup };
})();
