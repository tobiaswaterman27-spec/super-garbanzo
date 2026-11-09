// A swarm of bees. On a warm day in spring or summer a hive near you swarms: a great humming cloud pours out
// of the skep and drifts to a tree, where it hangs from a bough in a dark clump. The neighbours come out
// beating on pans to make it settle (tanging, as their grandmothers did), and the beekeeper comes with an
// empty skep, holds it under the clump and gives the bough a knock, and the bees go in and are carried home.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let S = null, cool = 40, taken = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.agent.hidden && q.agent.inside == null && !q.errand && !q._swarm && !q._bit && !talking(q) && q.age >= 10;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._swarm && !q._bit && !talking(q) && q.age >= 10;
    const where = (s, q) => { const a = q.agent; if (a.inside == null) return [a.x, a.y]; const b = s.building(a.inside); return b && b.doorX != null ? [b.doorX * 16 + 8, (b.doorY + 1) * 16 + 8] : null; };
    const bringOut = (s, q) => { const a = q.agent; if (a.inside == null) return; const w = where(s, q); a.inside = null; a.hidden = false; if (w) { a.x = w[0]; a.y = w[1]; } };
    function end() { if (!S) return; for (const q of [S.keeper, ...S.tang].filter(Boolean)) { const a = q.agent; if (a) { a.forceAnim = null; if (!talking(q)) a.frozen = false; } q._swarm = false; } S = null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60, P = game.player;
      if (S) { S.t += dt; if (S.s !== s || S.t > 150 || [S.keeper, ...S.tang].some((q) => q && talking(q))) { end(); return; }
        if (S.phase === 'out') { S.k = Math.min(1, S.t / 7); if (S.k >= 1) { S.phase = 'hang'; S.t = 0; if (near(S.tx, S.ty, 360)) O.sfx && O.sfx('handbell', 0.05); } }
        // folk come out tanging
        if (S.phase === 'hang' || S.phase === 'take') for (const q of S.tang) { const a = q.agent; if (!a.frozen) continue; a.forceAnim = 'hammer'; if (Math.random() < dt * 2 && near(a.x, a.y, 300)) O.sfx && O.sfx('smack', 0.08); }
        if (S.phase === 'hang' && !S.called) { S.called = true;
          const folk = s.people.filter((q) => q !== S.keeper && able(q) && (q.agent.inside == null ? !q.agent.hidden : s.building(q.agent.inside)?.type === 'house') && (() => { const w = where(s, q); return w && Math.hypot(w[0] - S.tx, w[1] - S.ty) < 360; })()).slice(0, 2);
          folk.forEach((q, i) => { q._swarm = true; bringOut(s, q); S.tang.push(q); const sp = [Math.floor(S.tx / 16) + (i ? 3 : -3), Math.floor(S.ty / 16) + 1]; O.Errands.send(s, q, sp, { anim: 'idle', secs: 0.1, face: 0, giveUp: game.t + 40, after: (ok) => { if (!ok || !S) { q._swarm = false; return; } q.agent.frozen = true; q.agent.path = null; q.agent.dir = i ? 2 : 1; if (near(q.agent.x, q.agent.y, 300) && i === 0) O.Speech && O.Speech.say(q, pick(['Bees! Bees out! Fetch a pan!', 'They\'re swarming! Tang them down!', 'Bang, bang, settle, my beauties!']), 2.4); } }); });
          const k = S.keeper; if (k) { k._swarm = true; bringOut(s, k); O.Errands.send(s, k, [Math.floor(S.tx / 16), Math.floor(S.ty / 16) + 2], { anim: 'idle', secs: 0.1, face: 0, giveUp: game.t + 60, after: (ok) => { if (!ok || !S) { k._swarm = false; if (S) S.keeper = null; return; } k.agent.frozen = true; k.agent.path = null; k.agent.dir = 0; S.phase = 'take'; S.tt = 0; if (near(k.agent.x, k.agent.y, 300)) O.Speech && O.Speech.say(k, pick(['Easy now. Into the skep with you.', 'A swarm in May is worth a load of hay!', 'Gently. Gently.']), 2.6); } }); }
        }
        if (S.phase === 'hang' && S.t > 60) { end(); return; } // nobody came: they fly off
        if (S.phase === 'take') { S.tt += dt; const a = S.keeper.agent; a.forceAnim = S.tt < 3 ? 'give' : S.tt < 4 ? 'hammer' : 'idle'; if (S.tt >= 3 && !S.knocked) { S.knocked = true; if (near(a.x, a.y, 300)) O.sfx && O.sfx('smack', 0.15); }
          if (S.tt > 3) S.left = Math.max(0, 1 - (S.tt - 3) / 3); if (S.tt > 7) { taken++; const k = S.keeper; const ka = k.agent; ka.forceAnim = null; ka.frozen = false; k._swarm = false; S.keeper = null; ka.carrying = { good: 'honey', qty: 1 }; const h = S.home; if (h && h.doorX != null) O.Errands.send(s, k, [h.doorX, h.doorY + 1], { anim: 'place', secs: 1, face: 0, giveUp: game.t + 60, carry: { good: 'honey', qty: 1 } }); end(); } }
        return; }
      cool -= dt; if (cool > 0) return; cool = 90 + Math.random() * 90;
      if (!(s.season === 'spring' || s.season === 'summer') || hr < 10 || hr > 16) return; const W = s.weather; if (W && (W.raining || W.kind === 'snow' || W.kind === 'fog')) return;
      const w = s.world, skeps = (w.props || []).filter((p) => p.kind === 'skep' && near(p.x, p.y, 450)); if (!skeps.length) return; const sk = pick(skeps);
      const trees = (w.trees || []).filter((t) => Math.hypot(t.x - sk.x, t.y - sk.y) < 220 && Math.hypot(t.x - sk.x, t.y - sk.y) > 30); if (!trees.length) return; const tr = pick(trees);
      const home = s.building(sk.hive), bz = s.biz.get(sk.hive);
      const keeper = ((bz && bz.workers) || []).concat(bz && bz.owner != null ? [bz.owner] : []).map((id) => s.byId.get(id)).find((q) => { if (!able(q)) return false; const w = where(s, q); return w && Math.hypot(w[0] - tr.x, w[1] - tr.y) < 500; }) || s.people.find((q) => free(q) && q.age >= 18 && Math.hypot(q.agent.x - tr.x, q.agent.y - tr.y) < 600);
      S = { s, sx: sk.x, sy: sk.y - 10, tx: tr.x + 6, ty: tr.y - 30, t: 0, k: 0, phase: 'out', tang: [], keeper: keeper || null, home, left: 1 }; if (keeper) keeper._swarm = true;
      if (near(sk.x, sk.y, 360)) { const by = s.people.find((q) => q.agent && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - sk.x, q.agent.y - sk.y) < 200); if (by) { O.Speech && O.Speech.say(by, 'The bees are swarming!', 2); O.gesture && O.gesture(by, 'point', 1.5); } }
    });
    game.hooks.drawTop.push((ctx, cam, inScene) => {
      if (!S || inScene || game.scene || S.s !== cur()) return; const t = game.t;
      // the cloud: on its way out, a drifting ball; hanging, a clump on the bough with a haze about it
      const cx = S.sx + (S.tx - S.sx) * (S.k || 0), cy = S.sy + (S.ty - S.sy) * (S.k || 0) - Math.sin((S.k || 0) * Math.PI) * 20;
      const hanging = S.phase !== 'out', n = Math.round((hanging ? 22 : 40) * S.left), R = hanging ? 9 : 18;
      if (hanging && S.left > 0.05) { ctx.fillStyle = '#4a3a1a'; const x = Math.round(S.tx - cam.x), y = Math.round(S.ty - cam.y); const h = Math.round(10 * S.left); ctx.fillRect(x - 3, y, 7, h); ctx.fillRect(x - 2, y + h, 5, 2); ctx.fillStyle = '#7a6020'; ctx.fillRect(x - 2, y + 2, 1, 1); ctx.fillRect(x + 2, y + 5, 1, 1); }
      for (let i = 0; i < n; i++) { const a = t * (2 + (i % 5) * 0.4) + i * 2.1, r = (i * 7 % R) + Math.sin(t * 3 + i) * 2; const x = Math.round((hanging ? S.tx : cx) + Math.cos(a) * r - cam.x), y = Math.round((hanging ? S.ty + 5 : cy) + Math.sin(a * 1.2) * r * 0.7 - cam.y); ctx.fillStyle = i % 3 ? '#2a2018' : '#e0b030'; ctx.fillRect(x, y, 1, 1); }
      if (S.phase === 'take' && S.keeper && S.keeper.agent) { const a = S.keeper.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y) - 30; ctx.fillStyle = '#c8a050'; ctx.fillRect(x - 4, y - 5, 8, 6); ctx.fillStyle = '#a88030'; ctx.fillRect(x - 4, y - 3, 8, 1); ctx.fillRect(x - 3, y - 6, 6, 1); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => !S || !q._swarm ? '' : q === S.keeper ? 'The bees have swarmed into a tree and you are taking the swarm into an empty skep.' : 'The bees are swarming and you are out beating a pan to make them settle, as folk always have.');
    O.Swarm = { get swarm() { return S; }, get taken() { return taken; }, soon: () => { cool = 0; } };
  }
  O.SwarmSetup = { setup };
})();
