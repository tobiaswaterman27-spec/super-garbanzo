// Coming out from the christening. When the little one has been carried to the font and named, the family
// comes out of the chapel door into the light: the mother with the baby in its christening shawl, the
// godparents, the brothers and sisters in their clean clothes, the priest on the step blessing them; and
// the father, if he can spare it, flings a handful of pennies into the lane, and every child in earshot
// comes running and scrambling in the dirt for them.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let X = null, held = 0; const coins = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._christ && !q._bit && !q._scene && !talking(q);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._christ = false; }
    function end() { if (!X) return; const x = X; X = null; for (const q of x.fam) rel(q); if (x.priest) rel(x.priest);
      const hb = x.s.building(x.mum.home); if (hb && hb.doorX != null) x.fam.forEach((q, i) => setTimeout(() => O.Errands.send(x.s, q, [hb.doorX, hb.doorY + 1], { anim: 'idle', secs: 0.3, face: 0, giveUp: game.t + 90 }), i * 300)); }
    function out(s, q, b, dx, dy) { const a = q.agent; a.inside = null; a.hidden = false; a.path = null; a.x = (b.doorX + dx) * T + 8; a.y = (b.doorY + 1 + dy) * T + 8; a.frozen = true; q._christ = true; }
    game.hooks.update.push((dt) => {
      for (const c of coins.slice()) { c.t += dt; if (c.t < 0.7) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 260 * dt; } else if (!c.landed) { c.landed = true; c.y = c.gy; } if (c.t > 14 || c.got) coins.splice(coins.indexOf(c), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (X) { X.t += dt; if (X.s !== s || X.t > 40 || X.fam.some((q) => talking(q))) { end(); return; }
        X.fam.forEach((q, i) => { const a = q.agent; if (!a.frozen) return; a.dir = 0; a.forceAnim = q === X.dad ? (X.t > 4 && X.t < 6 ? 'pitch' : X.t > 6 ? 'laugh' : 'idle') : q === X.mum ? (Math.floor(X.t * 0.6) % 3 === 0 ? 'nod' : 'idle') : q === X.dad ? (X.t > 4 && X.t < 6 ? 'pitch' : X.t > 6 ? 'laugh' : 'idle') : (Math.floor(X.t / 3 + i) % 3 === 0 ? 'wave' : 'idle'); });
        if (X.priest) { X.priest.agent.dir = 0; X.priest.agent.forceAnim = X.t < 3.5 ? 'pray' : 'idle'; }
        if (!X.blessed && X.t > 0.8) { X.blessed = true; if (near(X.x, X.y, 320) && X.priest) O.Speech && O.Speech.say(X.priest, `God keep the child ${X.babe.first || ''}, and all of you.`.replace('  ', ' '), 2.6); }
        if (!X.thrown && X.t > 4.4) { X.thrown = true;
          if (X.dad) { let ok = true; try { const hh = s.household(X.mum); if (hh && hh.money > 6) hh.money -= 2; else ok = false; } catch (e) { /* */ } if (ok) {
            if (near(X.x, X.y, 320)) O.Speech && O.Speech.say(X.dad, pick(['Pennies for the bairns! For the baby\'s luck!', 'Here, you rascals! Drink the child\'s health!', 'Scramble for it!']), 2.4); O.sfx && near(X.x, X.y, 320) && O.sfx('coins', 0.3);
            const da = X.dad.agent; for (let i = 0; i < 9; i++) coins.push({ s, x: da.x, y: da.y - 18, vx: (Math.random() - 0.5) * 140, vy: -70 - Math.random() * 50, gy: da.y + 10 + Math.random() * 40, t: 0 });
            // every child in earshot comes running
            const kids = s.people.filter((q) => able(q) && q.age >= 4 && q.age <= 13 && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - X.x, q.agent.y - X.y) < 380).slice(0, 5);
            kids.forEach((q, i) => { q._christ = true; const c = coins[coins.length - 1 - i] || coins[0]; const tx = Math.floor((c.x + c.vx * 0.7) / T), ty = Math.floor(c.gy / T); O.Errands.send(s, q, [tx, ty], { anim: 'pickup', secs: 1.2, face: 0, sprint: true, giveUp: game.t + 20, after: (ok) => { q._christ = false; if (ok) { const cc = coins.find((o) => o.landed && !o.got && Math.hypot(o.x - q.agent.x, o.y - q.agent.y) < 40); if (cc) cc.got = true; O.gesture && O.gesture(q, 'celebrate', 1.4); if (i === 0 && near(q.agent.x, q.agent.y, 300)) O.Speech && O.Speech.say(q, pick(['I got one! I got one!', 'That\'s MINE!', 'A whole penny!']), 1.8); } } }); });
            held++; } } }
        if (X.t > 16) end();
        return; }
      const e = (s.npcEvents || []).find((v) => v.kind === 'christening' && v.day === s.day && !v._out && hr >= v.to - 0.08 && hr < v.to + 0.5); if (!e) return; const b = s.building(e.b); if (!b || b.doorX == null || !near(b.doorX * T, b.doorY * T, 480)) return; e._out = true;
      const mum = s.byId.get(e.host); if (!mum || !able(mum)) return; const hh = s.household(mum);
      const babe = (hh ? hh.members : []).map((id) => s.byId.get(id)).find((q) => q && q.age === 0) || { first: '' };
      const fam = [mum, ...(hh ? hh.members : []).map((id) => s.byId.get(id)).filter((q) => q && q !== mum && q.age >= 3 && able(q))].slice(0, 5);
      const dad = fam.find((q) => q !== mum && q.sex === 'm' && q.age >= 18) || fam.find((q) => q !== mum && q.age >= 16) || mum;
      const bz = s.biz.get(e.b), priest = ((bz && bz.workers) || []).map((id) => s.byId.get(id)).find(able) || null;
      const spots = [[0, 1], [-1, 1], [1, 1], [-1, 2], [1, 2]]; fam.forEach((q, i) => out(s, q, b, spots[i][0], spots[i][1]));
      mum.agent.carrying = 'babe'; if (priest) out(s, priest, b, 0, 0);
      X = { s, e, b, mum, dad, fam, priest, babe, t: 0, x: b.doorX * T + 8, y: (b.doorY + 2) * T };
    });
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (!s || game.scene) return; for (const c of coins) { if (c.s !== s) continue; const x = Math.round(c.x - cam.x), y = Math.round(c.y - cam.y); ctx.fillStyle = c.landed && Math.floor(performance.now() / 300 + c.gy) % 5 === 0 ? '#fff0b0' : '#d8b040'; ctx.fillRect(x, y, 2, c.landed ? 1 : 2); }
      // the christening shawl, white with a lace edge, on the mother's shoulder
      if (X && X.s === s && X.mum.agent) { const a = X.mum.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y) - 20; ctx.fillStyle = '#f4f0e8'; ctx.fillRect(x - 1, y, 6, 4); ctx.fillStyle = '#d8d0c0'; ctx.fillRect(x - 1, y + 3, 6, 1); } });
    (O.extraLines = O.extraLines || []).push((s, q) => !X || !X.fam.includes(q) ? '' : q === X.mum ? `Your baby ${X.babe.first || ''} has just been christened and you are coming out of the chapel with the family, proud and happy.` : q === X.dad ? 'Your child has just been christened, and you have thrown pennies for the children for luck.' : 'You have just come out of a christening in the family, in your best clothes.');
    O.Christening = { get scene() { return X; }, get held() { return held; }, coins };
  }
  O.ChristeningSetup = { setup };
})();
