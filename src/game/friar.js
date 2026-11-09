// A friar preaches at the cross. Now and then a barefoot grey friar comes into the square, climbs the steps
// of the market cross and begins to preach: of hell and the worm, of the rich man and Lazarus, of the
// lilies of the field. Folk drift over to listen: some cross themselves, a woman weeps, an old man nods
// along, a lad heckles from the back and is hushed; and at the end he goes round with his bowl.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let F = null, cool = 240, sermons = 0, alms = 0; const coins = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._friar && !q._bit && !q._scene && !q._office && !talking(q);
    const SERMON = ['Repent! For the worm that dieth not is waiting for the proud!', 'Consider the lilies of the field: they toil not, neither do they spin.', 'The rich man feasted, and Lazarus lay at his gate. And where is the rich man now?', 'You count your pennies; does God count your prayers?', 'Your fine cloth will rot, friends, and so will you. Give while you may!', 'Blessed are the poor, for theirs is the kingdom of heaven.'];
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._friar = false; }
    function end() { if (!F) return; for (const c of F.crowd) rel(c.q); F = null; }
    game.hooks.update.push((dt) => {
      for (const c of coins.slice()) { c.t += dt; if (c.t > 0.7) coins.splice(coins.indexOf(c), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (F) { F.t += dt; if (F.s !== s || F.t > 120 || hr > 17.5) { end(); return; }
        F.crowd.forEach((c, i) => { const a = c.q.agent; if (!c.q._friar || !a.frozen) return; if (talking(c.q)) { rel(c.q); return; } a.dir = O.dirOf(F.x - a.x, F.y - a.y);
          a.forceAnim = F.phase === 'bowl' ? (c.gave ? 'nod' : 'idle') : c.kind === 'weep' ? (Math.floor(F.t / 3 + i) % 2 ? 'mourn' : 'pray') : c.kind === 'heckle' ? (Math.floor(F.t / 2 + i) % 3 === 0 ? 'laugh' : 'shake') : c.kind === 'pious' ? (Math.floor(F.t / 4 + i) % 2 ? 'pray' : 'nod') : ['look', 'idle', 'nod', 'look'][(Math.floor(F.t / 3) + i) % 4]; });
        if (F.phase === 'preach') { F.next -= dt; if (F.next <= 0) { F.next = 6; if (near(F.x, F.y, 420)) { O.Speech && O.Speech.say(F.man, pick(SERMON), 4.5); O.sfx && Math.random() < 0.3 && O.sfx('handbell', 0.1); const h = F.crowd.find((c) => c.kind === 'heckle' && c.q._friar); if (h && Math.random() < 0.45) setTimeout(() => { if (!F) return; O.Speech && O.Speech.say(h.q, pick(['And where are YOUR shoes, father?', 'Says the man with his hand out!', 'Preach it to the bishop!']), 2.2); const p2 = F.crowd.find((c) => c.kind === 'pious' && c.q._friar); if (p2) setTimeout(() => O.Speech && O.Speech.say(p2.q, pick(['Hush, you heathen!', 'Shame on you, boy.']), 1.8), 1600); }, 2600); } }
          if (F.t > 50) { F.phase = 'bowl'; F.k = 0; F.bi = 0; if (near(F.x, F.y, 420)) O.Speech && O.Speech.say(F.man, 'For the poor of Christ, friends. Whatever you can spare.', 3); } }
        if (F.phase === 'bowl') { F.k += dt; const c = F.crowd[F.bi]; if (c && F.k > 1.6) { F.k = 0; F.bi++; if (c.q._friar && c.kind !== 'heckle') { let ok = false; try { const hh = s.household(c.q); if (hh && hh.money > 4 && Math.random() < 0.7) { hh.money -= 1; ok = true; } } catch (e) { /* */ } if (ok) { c.gave = true; alms++; O.gesture && O.gesture(c.q, 'give', 1); coins.push({ s, x0: c.q.agent.x, y0: c.q.agent.y - 16, x1: F.x + 6, y1: F.y - 18, t: 0 }); } } }
          if (F.bi >= F.crowd.length && F.k > 2) { sermons++; if (near(F.x, F.y, 420)) O.Speech && O.Speech.say(F.man, 'God reward you all. Pax vobiscum.', 2.6); end(); } }
        return; }
      cool -= dt; if (cool > 0) return; cool = 500 + Math.random() * 500; if (hr < 10 || hr > 16 || !s.Z || !s.Z.square || (s.weather && s.weather.raining)) return;
      const [x0, y0, x1, y1] = s.Z.square, cx = (x0 + x1) * 8 + 8, cy = (y0 + y1) * 8 + 4; if (!near(cx, cy, 520)) return;
      const folk = s.people.filter((q) => able(q) && q.age >= 12 && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - cx, q.agent.y - cy) < 520).slice(0, 8); if (folk.length < 3) return;
      const R = O.RNG(O.hash('friar', s.day)); const app = O.Char.makeAppearance(O.hash('friarapp', s.day), { sex: 'm', age: 35 + Math.floor(R.next() * 30), genes: O.Char.randomGenes(R, 'north'), role: 'friar', wealth: 0 });
      const man = { app, agent: { x: cx, y: cy, hidden: false, inside: null }, first: 'the friar' };
      const kinds = ['pious', 'listen', 'weep', 'heckle', 'listen', 'pious', 'listen', 'listen'];
      F = { s, x: cx, y: cy, man, t: 0, next: 2, phase: 'preach', crowd: [] };
      folk.forEach((q, i) => { const ang = Math.PI * 0.15 + (i / folk.length) * Math.PI * 0.7, tx = Math.round((cx + Math.cos(ang) * 44) / T), ty = Math.round((cy + Math.sin(ang) * 32) / T); const c = { q, kind: kinds[i % kinds.length], gave: false }; F.crowd.push(c); q._friar = true;
        O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.1, face: 3, giveUp: game.t + 40, after: (ok) => { if (!F || !q._friar) return; if (!ok) { rel(q); return; } q.agent.frozen = true; q.agent.path = null; } }); });
    });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!F || F.phase !== 'bowl' || F.youGave || game.scene || P.locked || !near(F.x, F.y, 48)) return null;
      return { type: 'custom', d: 48, x: F.x, y: F.y - 36, label: 'Put a coin in the friar\'s bowl', act: () => { if ((PS.money || 0) < 1) return O.UI && O.UI.say && O.UI.say('You have nothing to give.'); PS.money -= 1; PS.almsToPoor = (PS.almsToPoor || 0) + 1; F.youGave = true; alms++; coins.push({ s: cur(), x0: P.x, y0: P.y - 18, x1: F.x + 6, y1: F.y - 18, t: 0 }); O.Speech && O.Speech.say(F.man, 'Bless you, child. Pray for me, a sinner.', 2.6); } }; });
    game.hooks.drawWorld.push((ctx, cam) => { if (game.scene) return; const s = cur();
      if (F && F.s === s) { const x = Math.round(F.x - cam.x), y = Math.round(F.y - cam.y); F.man.agent.x = F.x; F.man.agent.y = F.y - 6;
        ctx.fillStyle = '#8a8478'; ctx.fillRect(x - 10, y - 4, 20, 5); ctx.fillStyle = '#9a9488'; ctx.fillRect(x - 10, y - 4, 20, 1); ctx.fillRect(x - 7, y - 8, 14, 4);
        const anim = F.phase === 'bowl' ? 'give' : Math.floor(F.t / 2.5) % 3 === 0 ? 'point' : Math.floor(F.t / 2.5) % 3 === 1 ? 'gesture' : 'pray';
        try { const fr = O.Char.frame(F.man.app, 0, anim, Math.floor(F.t * 3) % 2); ctx.drawImage(fr, x - 16, y - 8 - O.Char.GROUND); } catch (e) { /* */ }
        if (F.phase === 'bowl') { ctx.fillStyle = '#6a5a48'; ctx.fillRect(x + 4, y - 22, 6, 2); ctx.fillRect(x + 5, y - 20, 4, 1); } }
      for (const c of coins) { if (c.s !== s) continue; const k = c.t / 0.7, x = Math.round(c.x0 + (c.x1 - c.x0) * k - cam.x), y = Math.round(c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 10 - cam.y); ctx.fillStyle = '#e8c860'; ctx.fillRect(x, y, 2, 2); } });
    (O.extraLines = O.extraLines || []).push((s, q) => { const c = F && F.crowd.find((x) => x.q === q); return !c ? '' : { pious: 'A friar is preaching at the cross and you are listening devoutly.', weep: 'A friar is preaching at the cross about your sins and it has moved you to tears.', heckle: 'A friar is preaching at the cross and you think he is a hypocrite, and you have been heckling him.', listen: 'A friar is preaching at the cross and you have stopped to listen.' }[c.kind]; });
    O.Friar = { get sermon() { return F; }, get sermons() { return sermons; }, get alms() { return alms; }, soon: () => { cool = 0; } };
  }
  O.FriarSetup = { setup };
})();
