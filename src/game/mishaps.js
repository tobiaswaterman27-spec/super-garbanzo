// Small mishaps in the street, and kindness. Someone carrying a basket trips, and apples and turnips go
// rolling; they get down to gather them, and a passer-by stops to help (and is thanked). Someone slips
// on the wet and sits down hard, and the street laughs. A coin drops from a purse and lies glinting in
// the dust until a sharp-eyed child, or you, finds it. And when it rains, folk caught out duck under
// the eaves by the nearest door and wait it out, looking at the sky.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.6);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._scene && !q._playing && !q._fighting && !q._bit && !q._cp && !q._pass && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    const ok = (x, y) => !game.solidAt(x, y - 1);
    const spills = [], coins = [], slips = [];
    function hold(q, k) { q._mish = k; q.agent.frozen = true; }
    function letGo(q) { if (!q) return; q._mish = null; q.agent.forceAnim = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; }
    function spill(s, q) {
      const a = q.agent; hold(q, 'spill'); a.forceAnim = 'hurt'; const kind = pick(['apples', 'turnips', 'eggs', 'onions']);
      const items = Array.from({ length: 7 }, () => { const ang = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 40; return { x: a.x + 4, y: a.y - 4, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.6, got: false }; });
      const sp = { s, q, items, kind, t: 0, helper: null }; spills.push(sp);
      say(q, pick(['Oh, no, no, no!', 'Curse it!', 'My apples!', 'Oh, my eggs...']), 1.6); O.sfx && near(a.x, a.y, 250) && O.sfx('place', 0.3);
      const h = s.people.find((o) => o !== q && free(o) && o.age >= 10 && Math.hypot(o.agent.x - a.x, o.agent.y - a.y) < 90 && Math.random() < 0.8); if (h) { sp.helper = h; hold(h, 'help'); }
    }
    let tick = 6, rt = 3;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return;
      for (const sp of spills.slice()) { sp.t += dt; const q = sp.q, a = q.agent;
        for (const it of sp.items) if (!it.got) { it.x += it.vx * dt; it.y += it.vy * dt; it.vx *= 1 - dt * 3; it.vy *= 1 - dt * 3; if (!ok(it.x, it.y)) { it.vx = -it.vx; it.vy = -it.vy; it.x += it.vx * dt * 2; it.y += it.vy * dt * 2; } }
        if (sp.t > 1) { const gather = (g, sp2) => { const it = sp.items.find((i) => !i.got && !i.by); if (!it) { g.agent.forceAnim = 'idle'; return true; } it.by = g; const ga = g.agent, dx = it.x - ga.x, dy = it.y - ga.y, d = Math.hypot(dx, dy); if (d > 4) { const st = Math.min(d, sp2 * dt); const nx = ga.x + dx / d * st, ny = ga.y + dy / d * st; if (ok(nx, ny)) { ga.x = nx; ga.y = ny; } else { ga.x = it.x; ga.y = it.y; } ga.dir = O.dirOf(dx, dy); ga.forceAnim = 'walk'; it.by = null; } else { ga.forceAnim = 'pickup'; it.k = (it.k || 0) + dt; if (it.k > 0.7) it.got = true; else it.by = null; } return false; };
          const d1 = gather(q, 30); const d2 = sp.helper ? gather(sp.helper, 34) : true;
          if (d1 && d2 && !sp.done) { sp.done = true; sp.end = sp.t + 2; if (sp.helper) { sp.helper.agent.dir = O.dirOf(a.x - sp.helper.agent.x, a.y - sp.helper.agent.y); a.dir = O.dirOf(sp.helper.agent.x - a.x, sp.helper.agent.y - a.y); a.forceAnim = 'bow'; sp.helper.agent.forceAnim = 'nod'; say(q, pick([`Bless you, ${sp.helper.first}.`, 'Thank you kindly.', 'You\'re a good soul.']), 1.8); s.relate(q, sp.helper, 0.08); s.relate(sp.helper, q, 0.04); } else a.forceAnim = 'wipe'; } }
        if ((sp.end && sp.t > sp.end) || sp.t > 30 || q.alive === false) { letGo(q); letGo(sp.helper); spills.splice(spills.indexOf(sp), 1); } }
      for (const sl of slips.slice()) { sl.t += dt; const a = sl.q.agent; a.forceAnim = sl.t < 0.5 ? 'hurt' : sl.t < 2.2 ? 'lie' : sl.t < 3 ? 'sit' : 'wipe'; if (sl.t > 3.8) { letGo(sl.q); slips.splice(slips.indexOf(sl), 1); } }
      for (const c of coins.slice()) { c.t += dt; if (near(c.x, c.y, 9)) { PS.money = (PS.money || 0) + c.v; O.UI.say(`You find ${c.v === 1 ? 'an aurin' : '₳' + c.v} in the dust.`, 'good'); O.sfx && O.sfx('kaching', 0.3); coins.splice(coins.indexOf(c), 1); continue; }
        if (c.t > 6 && Math.random() < dt * 0.2) { const kid = s.people.find((q) => q.age >= 5 && q.age < 14 && free(q) && Math.hypot(q.agent.x - c.x, q.agent.y - c.y) < 80); if (kid && O.Errands) { coins.splice(coins.indexOf(c), 1); O.Errands.send(s, kid, [Math.floor(c.x / T), Math.floor(c.y / T)], { anim: 'pickup', secs: 1, face: 0, giveUp: game.t + 30, sprint: true, at: () => { say(kid, pick(['A penny! Finders keepers!', 'Look what I found!', 'Mine!']), 1.6); const hh = s.household(kid); if (hh) hh.money += c.v; } }); continue; } }
        if (c.t > 300) coins.splice(coins.indexOf(c), 1); }
      // rain: under the eaves
      rt -= dt; if (rt <= 0) { rt = 2; const raining = !!s.raining || (s.weather && /rain|storm/.test(s.weather.kind || ''));
        if (raining && O.Errands) { let n = 0; for (const q of s.people) { if (n >= 3) break; if (!free(q) || q.age < 8 || q.visitor || !near(q.agent.x, q.agent.y, 420) || (q._shelterDay === s.day * 100 + Math.floor(s.minute / 30))) continue; const act = q.activity && q.activity.act; if (!['stroll', 'socialise', 'idle', 'play', 'wait-work', 'shop'].includes(act)) continue;
            let best = null, bd = 1e9; for (const b of s.world.buildings) { if (b.doorX == null) continue; for (const dx of [-1, 1]) { const tx = b.doorX + dx, ty = b.doorY + 1, d = Math.hypot(tx * T - q.agent.x, ty * T - q.agent.y); if (d < bd && !s.world.solid[ty * s.world.W + tx]) { bd = d; best = [tx, ty]; } } } if (!best || bd > 260) continue;
            q._shelterDay = s.day * 100 + Math.floor(s.minute / 30); n++; O.Errands.send(s, q, best, { sprint: true, anim: 'look', secs: 20 + Math.random() * 20, face: 0, giveUp: game.t + 40, at: () => { if (Math.random() < 0.3) say(q, pick(['It\'ll pass.', 'Coming down in sheets.', 'I\'m soaked through.']), 1.6); } }); } } }
      // now and then, a mishap near you
      tick -= dt; if (tick > 0) return; tick = 8 + Math.random() * 10;
      const ws = s.people.filter((q) => free(q) && q.age >= 10 && q.agent.path && near(q.agent.x, q.agent.y, 300));
      const r = Math.random(), q = pick(ws); if (!q) return;
      if (r < 0.25 && (q.agent.carrying || q.agent.anim === 'carry' || q.age >= 14) && spills.length < 1) spill(s, q);
      else if (r < 0.45) { const wet = !!s.raining || (s.world._critters && s.world._critters.puddles.length) || s.weather && /rain|snow|storm/.test(s.weather.kind || ''); if (wet && slips.length < 1) { hold(q, 'slip'); slips.push({ q, t: 0 }); O.sfx && O.sfx('smack', 0.2); setTimeout(() => { for (const o of s.people) if (o !== q && o.agent && !o.agent.hidden && o.agent.inside == null && Math.hypot(o.agent.x - q.agent.x, o.agent.y - q.agent.y) < 80 && Math.random() < 0.5) { O.gesture && O.gesture(o, o.age < 13 ? 'point' : 'laugh', 1.5); } say(q, pick(['Ow! My backside!', 'Who put that there?!', 'Don\'t laugh!']), 1.6); }, 600); } }
      else if (r < 0.6 && coins.length < 3) { coins.push({ x: q.agent.x + (Math.random() - 0.5) * 6, y: q.agent.y + 2, v: Math.random() < 0.8 ? 1 : 2, t: 0 }); }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return;
      const col = { apples: '#c03a2a', turnips: '#e0d8e8', eggs: '#f0ead8', onions: '#c8a060' };
      for (const sp of spills) { ctx.fillStyle = col[sp.kind]; for (const it of sp.items) if (!it.got) ctx.fillRect(Math.round(it.x - cam.x), Math.round(it.y - cam.y) - 2, 2, 2); }
      const tk = Math.floor(performance.now() / 300) % 4; for (const c of coins) { const x = Math.round(c.x - cam.x), y = Math.round(c.y - cam.y); ctx.fillStyle = '#c8a030'; ctx.fillRect(x, y - 1, 2, 1); if (tk === 0) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(x + 1, y - 2, 1, 1); } }
    });
    O.Mishaps = { spills, coins, slips, spill: (q) => spill(cur(), q) };
  }
  O.MishapsSetup = { setup };
})();
