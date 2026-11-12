// The stocks. Those taken up for small things (a cut purse, a brawl, a short weight) don't only sit in
// the cell: from mid-morning to late afternoon they sit in the stocks at the edge of the square, feet
// through the holes, for all the town to see. Boys throw rotten cabbages and worse (splat), goodwives
// scold, a friend brings a cup of water, the dog sniffs. At evening the gaoler takes them back in.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    let spot = null, spotSim = null; const veg = [], splats = [];
    function where(s) { if (spotSim === s && spot) return spot; spotSim = s; spot = null; const sq = s.Z && s.Z.square; if (!sq) return null; const w = s.world; for (const [tx, ty] of [[sq[0] + 1, sq[3]], [sq[2] - 1, sq[3]], [sq[0] + 1, sq[1]], [sq[2] - 1, sq[1]], [sq[0] + 3, sq[3]]]) { if (!w.solid[ty * w.W + tx] && !w.solid[ty * w.W + tx + 1] && !w.props.some((p) => Math.abs(p.x - (tx * T + 8)) < 24 && Math.abs(p.y - (ty * T + 10)) < 16)) { spot = [tx * T + 8, ty * T + 12]; break; } } return spot; }
    const inStocks = new Set(); let tick = 1, throwT = 4;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world) return; const h = s.minute / 60, day = h >= 9.5 && h < 16.5 && !s.raining;
      for (const v of veg.slice()) { v.t += dt; if (v.t >= v.dur) { veg.splice(veg.indexOf(v), 1); splats.push({ x: v.x1 + (Math.random() - 0.5) * 6, y: v.y1, c: v.c, t: 0 }); if (near(v.x1, v.y1, 220)) O.sfx && O.sfx('smack', 0.15); if (v.hit && Math.random() < 0.6) say(v.hit, pick(['Ugh!', 'You little devils!', 'I\'ll remember your faces!', 'Not the eggs! Not the eggs!']), 1.4); } }
      for (const sp of splats.slice()) { sp.t += dt; if (sp.t > 120) splats.splice(splats.indexOf(sp), 1); }
      tick -= dt; if (tick <= 0) { tick = 2; const at = where(s);
        for (const q of [...inStocks]) { const done = !day || !q.jailUntil || s.day >= q.jailUntil || q.alive === false || !at; if (done) { inStocks.delete(q); q._stocks = false; q.agent.frozen = false; q.agent.forceAnim = null; if (q.jailUntil && s.day < q.jailUntil && q.task && q.task.b != null) { q.agent.inside = q.task.b; q.agent.hidden = true; } } }
        if (day && at && inStocks.size < 2) for (const q of s.people) { if (inStocks.size >= 2) break; if (q._stocks || !q.jailUntil || !(q.task && q.task.act === 'jailed') || !q.sentence || q.sentence.days > 2 || q.sentence.bailed || q.alive === false || !q.agent) continue;
          q._stocks = true; inStocks.add(q); const a = q.agent; a.inside = null; a.hidden = false; a.path = null; a.frozen = true; a.x = at[0] + inStocks.size * 8 - 12; a.y = at[1]; a.dir = 0; a.forceAnim = 'sit'; }
      }
      for (const q of inStocks) { const a = q.agent; a.forceAnim = Math.floor(performance.now() / 3000 + q.id) % 4 === 0 ? 'mourn' : 'sit'; a.dir = 0; }
      // the town has its say
      throwT -= dt; if (throwT <= 0 && inStocks.size && day) { throwT = 3 + Math.random() * 4; const target = pick([...inStocks]); const ta = target.agent;
        const thrower = s.people.find((q) => q.age >= 8 && q.age <= 17 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && Math.hypot(q.agent.x - ta.x, q.agent.y - ta.y) < 120 && Math.hypot(q.agent.x - ta.x, q.agent.y - ta.y) > 20);
        if (thrower && Math.random() < 0.7) { O.gesture && O.gesture(thrower, 'attack', 0.5); veg.push({ x0: thrower.agent.x, y0: thrower.agent.y - 14, x1: ta.x + (Math.random() - 0.5) * 8, y1: ta.y - 14, t: 0, dur: 0.6, c: pick(['#6aa040', '#c8a050', '#f0ead8', '#8a5a34']), hit: target }); if (Math.random() < 0.4) say(thrower, pick(['Thief!', 'How d\'you like that?', 'Catch!']), 1.2); }
        else { const w = s.people.find((q) => q.age >= 20 && q.agent && !q.agent.hidden && q.agent.inside == null && q.agent.path && Math.hypot(q.agent.x - ta.x, q.agent.y - ta.y) < 60 && q.household !== target.household); if (w) { O.gesture && O.gesture(w, Math.random() < 0.5 ? 'point' : 'shake', 1.5); if (Math.random() < 0.5) say(w, pick(['Shame on you.', 'That\'ll teach you.', 'Poor wretch.', `Is that ${target.first}? Well I never.`]), 1.6); } } }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const at = spot && spotSim === s ? spot : null;
      if (at) { const x = Math.round(at[0] - cam.x), y = Math.round(at[1] - cam.y); if (x > -40 && y > -40 && x < ctx.canvas.width + 40 && y < ctx.canvas.height + 40) { ctx.fillStyle = '#5a3d26'; ctx.fillRect(x - 18, y - 6, 2, 8); ctx.fillRect(x + 16, y - 6, 2, 8); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 18, y - 4, 36, 4); ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 18, y - 2, 36, 1); ctx.fillStyle = '#2a1e16'; ctx.fillRect(x - 12, y - 3, 3, 2); ctx.fillRect(x - 4, y - 3, 3, 2); ctx.fillRect(x + 4, y - 3, 3, 2); ctx.fillRect(x + 12, y - 3, 3, 2); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 20, y + 2, 40, 2); } }
      for (const v of veg) { const k = v.t / v.dur, x = v.x0 + (v.x1 - v.x0) * k, y = v.y0 + (v.y1 - v.y0) * k - Math.sin(k * Math.PI) * 14; ctx.fillStyle = v.c; ctx.fillRect(Math.round(x - cam.x) - 1, Math.round(y - cam.y) - 1, 3, 3); }
    });
    game.hooks.drawGround.push((ctx, cam) => { if (game.scene) return; for (const sp of splats) { ctx.globalAlpha = Math.max(0, 0.8 - sp.t / 150); ctx.fillStyle = sp.c; const x = Math.round(sp.x - cam.x), y = Math.round(sp.y - cam.y) + 14; ctx.fillRect(x - 2, y, 4, 2); ctx.fillRect(x - 3, y + 1, 1, 1); ctx.fillRect(x + 3, y, 1, 1); } ctx.globalAlpha = 1; });
    (O.extraLines = O.extraLines || []).push((s, q) => q._stocks ? `You are sitting in the stocks in the square for ${q.sentence && q.sentence.crime ? q.sentence.crime : 'a small crime'}, pelted with rotten vegetables and jeered at. You are miserable and humiliated, and angry.` : '');
    // you, at the stocks: a cabbage of your own, or a dipper of water
    let pelted = 0, watered = 0; const did = new Map();
    const relOf0 = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (game.scene || P.locked || !inStocks.size) return null; const s = cur(); const q = [...inStocks].find((z) => Math.hypot(z.agent.x - P.x, z.agent.y - P.y) < 70); if (!q || did.get(q.id) === s.day) return null; const PS = O.PlayerState, has = (PS.items || []).includes('cabbage');
      return { type: 'custom', d: 2, x: q.agent.x, y: q.agent.y - 30, label: `Throw ${has ? 'a cabbage' : 'a clod of muck'} at ${q.first}`, act: () => { did.set(q.id, s.day); pelted++; if (has) PS.items.splice(PS.items.indexOf('cabbage'), 1); P.anim = 'attack'; setTimeout(() => { P.anim = 'idle'; }, 500); veg.push({ x0: P.x, y0: P.y - 14, x1: q.agent.x, y1: q.agent.y - 14, t: 0, dur: 0.5, c: has ? '#6aa040' : '#5a4a32', hit: true }); const r = relOf0(q); r.affinity = Math.max(-1, r.affinity - 0.25); try { s.remember(q, 'The stranger pelted me while I sat in the stocks.', 'grudge', 1.2, 0); if (O.grudge) O.grudge(s, q, 'pelted me in the stocks', 0.3); } catch (e) { /* */ } for (const z of s.people) if (z !== q && z.age < 18 && z.agent && !z.agent.hidden && near(z.agent.x, z.agent.y, 160)) O.gesture && O.gesture(z, 'laugh', 1.4); setTimeout(() => say(q, pick(['You\'ll pay for that.', 'I know your face!', 'Aye, laugh. Your turn will come.']), 2), 700); } }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (game.scene || P.locked || !inStocks.size) return null; const s = cur(); const q = [...inStocks].find((z) => Math.hypot(z.agent.x - P.x, z.agent.y - P.y) < 40); if (!q || did.get(q.id) === s.day) return null;
      return { type: 'custom', d: 3, x: q.agent.x, y: q.agent.y - 44, label: `Give ${q.first} a drink of water`, act: () => { did.set(q.id, s.day); watered++; P.anim = 'give'; setTimeout(() => { P.anim = 'idle'; }, 800); q.agent.forceAnim = 'drink'; const r = relOf0(q); r.affinity = Math.min(1, r.affinity + 0.25); r.familiar = Math.min(1, (r.familiar || 0) + 0.15); try { s.remember(q, 'When I sat in the stocks, the stranger brought me water.', 'kindness', 1.2); if (q.grudge) q.grudge.level = Math.max(0, q.grudge.level - 0.3); } catch (e) { /* */ } say(q, pick(['God bless you. My mouth was like dust.', 'Water... thank you. I won\'t forget this.']), 2.4);
        const tut = s.people.find((z) => z !== q && z.age >= 30 && z.agent && !z.agent.hidden && z.agent.inside == null && near(z.agent.x, z.agent.y, 140)); if (tut && Math.random() < 0.5) setTimeout(() => say(tut, pick(['Soft, you are. They\'re there to learn.', 'Hm. Christian of you, I suppose.']), 2), 1200); } }; });
    O.Stocks = { get pelted() { return pelted; }, get watered() { return watered; }, inStocks, where: () => where(cur()) };
  }
  O.StocksSetup = { setup };
})();
