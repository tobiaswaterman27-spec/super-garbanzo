// Water for the trades. The baker's dough, the smith's quenching tub, the tavern's pots and the stable's
// horses all drink from a butt by the door, and you can see how full it is. It runs down through the
// working day; when it's low the apprentice is sent to the well with a pail (or the town's water carrier
// comes round with two on a yoke) and tips it in. You can carry water for them too: bring a bucket from the
// well to a low butt and the keeper will give you a coin for it.
'use strict';
(function () {
  const T = 16, THIRSTY = { bakery: 1, tavern: 1.5, smithy: 1, butcher: 1, stable: 1.5, hospital: 1, kitchen: 1.5, apothecary: 0.5, palace: 1, keep: 1, manor: 1 };
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    let lastMin = null, acc = 0, fetched = 0, carrier = 0, yours = 0; const going = new Set();
    const thirsty = (s) => [...(s.biz || new Map()).values()].filter((bz) => THIRSTY[bz.type] && bz.b && bz.b.doorX != null && !(bz.b.owner && bz.b.owner.kind === 'player'));
    function spot(s, bz) { if (bz._butt !== undefined) return bz._butt; const b = bz.b, W = s.world; bz._butt = null; if (O.PriceChalk && (bz.def.sells || []).length) O.PriceChalk.spot(s, bz); const taken = bz._slate ? bz._slate.tx : null;
      for (const dx of [-1, 1, -2, 2]) { const tx = b.doorX + dx, ty = b.doorY + 1; if (tx === taken || W.solid[ty * W.W + tx]) continue; bz._butt = { tx, ty, x: tx * T + 8, y: ty * T + 2 }; break; } return bz._butt; }
    // the day's use
    game.hooks.update.push(() => { const s = cur(); if (!s || !s.biz) return; const abs = s.day * 1440 + s.minute; if (lastMin == null) { lastMin = abs; for (const bz of thirsty(s)) bz.water = bz.water ?? 4 + Math.floor(Math.random() * 4); return; } const dm = abs - lastMin; if (dm < 30) return; lastMin = abs; if (dm > 600) return;
      for (const bz of thirsty(s)) { if (bz.water == null) bz.water = 5; if (bz.open) bz.water = Math.max(0, bz.water - THIRSTY[bz.type] * dm / 60); } });
    // sending for water
    const wellNear = (s, x, y) => (s.world.props || []).filter((p) => p.kind === 'well').sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    game.hooks.update.push((dt) => { acc += dt; if (acc < 3) return; acc = 0; const s = cur(); if (!s || !s.biz || game.scene) return;
      for (const bz of thirsty(s)) { if ((bz.water ?? 5) > 2 || going.has(bz.id) || !bz.open) continue; const sp = spot(s, bz); if (!sp) continue;
        if (!near(sp.x, sp.y, 520)) { bz.water = 6; continue; } // out of sight, it's done all the same
        const w = wellNear(s, sp.x, sp.y); if (!w) continue;
        const ids = (bz.workers || []).concat(bz.owner != null ? [bz.owner] : []); const staff = ids.map((id) => s.byId.get(id)).filter((q) => q && q.alive !== false && q.agent && !q.errand && !talking(q) && !q._coup && q.activity?.act === 'work');
        const wc = s.people.find((q) => q.job?.role === 'water carrier' && q.agent && !q.errand && !talking(q) && q.activity?.act === 'work'); const q = wc || staff.find((z) => /apprentice|hand|boy|girl|scullion|stable/.test(z.job?.role || '')) || staff[staff.length - 1]; if (!q) continue;
        going.add(bz.id); q._well = true; const yoke = !!wc;
        O.Errands.send(s, q, [Math.floor(w.x / T), Math.floor(w.y / T) + 1], { anim: 'take', secs: yoke ? 4 : 3, face: 6, giveUp: game.t + 50, after: (ok) => { if (!ok) { going.delete(bz.id); q._well = false; return; } q.agent.forceAnim = 'bucket';
          O.Errands.send(s, q, [sp.tx, sp.ty + 1], { anim: 'take', secs: 1.2, face: 6, giveUp: game.t + 60, after: (ok2) => { q.agent.forceAnim = null; q._well = false; going.delete(bz.id); if (!ok2) return; bz.water = Math.min(8, (bz.water || 0) + (yoke ? 6 : 3)); fetched++; if (yoke) carrier++; O.sfx && near(sp.x, sp.y, 240) && O.sfx('pour', 0.4);
            if (yoke && near(sp.x, sp.y, 260)) { const k = s.byId.get(bz.owner); if (k && k.agent && !k.agent.hidden) { O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(k, q, 'coin'); } say(q, pick(['Two pails, full to the brim.', 'Water! Fresh from the well.']), 2); } } }); } }); break; } });
    // the butts
    game.hooks.drawGround.push((ctx, cam) => { const s = cur(); if (!s || !s.biz || game.scene) return; for (const bz of thirsty(s)) { const sp = spot(s, bz); if (!sp || !near(sp.x, sp.y, 440)) continue; const lv = bz.water ?? 5, x = Math.round(sp.x - cam.x), y = Math.round(sp.y + 10 - cam.y);
      ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 6, y - 13, 13, 14); ctx.fillStyle = '#7a5434'; ctx.fillRect(x - 5, y - 12, 11, 12); ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - 6, y - 10, 13, 1); ctx.fillRect(x - 6, y - 4, 13, 1); ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 5, y - 14, 11, 2);
      if (lv >= 1) { ctx.fillStyle = lv >= 5 ? '#5a8ac8' : '#3a5a80'; ctx.fillRect(x - 4, y - 14, 9, 1); if (lv >= 5) { ctx.fillStyle = '#a8c8f0'; ctx.fillRect(x - 3, y - 14, 2, 1); } } } });
    // your bucket into their butt, for a coin
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || !s.biz || game.scene || P.locked || !PS.carry || !PS.carry.well) return null; const bz = thirsty(s).find((bz) => { const sp = spot(s, bz); return sp && near(sp.x, sp.y + 8, 26); }); if (!bz || (bz.water ?? 5) >= 7) return null; const sp = bz._butt;
      return { type: 'custom', d: 1, x: sp.x, y: sp.y - 20, label: `Tip your water into ${bz.name}'s butt${(bz.water ?? 5) <= 3 ? ' (they\'ll pay)' : ''}`, act: () => { P.anim = 'take'; O.sfx && O.sfx('pour', 0.6); setTimeout(() => { P.anim = 'idle'; }, 700); const low = (bz.water ?? 5) <= 3; bz.water = Math.min(8, (bz.water || 0) + 2); PS.carry = null; yours++;
        const k = [bz.owner, ...(bz.workers || [])].map((id) => s.byId.get(id)).find((q) => q && q.agent && !q.agent.hidden && near(q.agent.x, q.agent.y, 200));
        if (low && (bz.cash || 0) >= 1) { bz.cash -= 1; PS.money = (PS.money || 0) + 1; if (k) { say(k, pick(['Bless you, we were near dry. Here.', 'Saved me a trip. A coin for your trouble.']), 2.2); O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(k, 'player', 'coin'); } ui(`You tip your bucket into ${bz.name}'s butt. ₳1 for it.`, 'good'); }
        else { if (k) say(k, 'Kind of you. We\'re not short, mind.', 2); ui(`You tip your bucket into ${bz.name}'s butt.`, 'info'); } } }; });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!s || !s.biz || !q.job || q.job.biz == null) return ''; const bz = s.biz.get(q.job.biz); if (!bz || !THIRSTY[bz.type] || bz.water == null) return ''; return bz.water <= 2 ? 'The water butt at work is nearly dry; someone needs to go to the well.' : ''; });
    O.TradeWater = { thirsty, spot, going, get fetched() { return fetched; }, get carrier() { return carrier; }, get yours() { return yours; } };
  }
  O.TradeWaterSetup = { setup };
})();
