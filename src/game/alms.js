// The poor at the chapel door. Those with no work and an empty purse sit by the chapel door through
// the day with a bowl, and hold it up to whoever passes. The kind and the pious stop and drop a coin in
// (you see it go, and hear the chink, and the beggar's blessing); most walk past looking elsewhere.
// Coming out of mass of a Sunday, more give. At dusk the beggar takes what's in the bowl home for
// bread. Give yourself by talking to them.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, SP = O.Sim.prototype, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const poor = (s, q) => !q.visitor && !q.job && q.age >= 16 && q.age <= 80 && !q.gentry && !q.title && !q.gang && (s.household(q)?.money ?? 99) < 10 && !q.homefront;
    let wrapped = false;
    const wrap = () => { if (wrapped) return; wrapped = true; const _plan = SP.plan;
      SP.plan = function (p) { const r = _plan.apply(this, arguments); try { const h = this.minute / 60; if (r && ['stroll', 'idle', 'home', 'rest', 'socialise'].includes(r.act) && h >= 8.5 && h < 18 && !this.raining && poor(this, p) && this.chapelId != null && (p.needs?.hunger ?? 100) > 20) { const beggars = this.people.filter((x) => x.activity && x.activity.act === 'beg' && x !== p).length; if (beggars < 2 || p.activity?.act === 'beg') return { act: 'beg', outdoor: true, zone: 'chapeldoor' }; } } catch (e) { /* */ } return r; }; };
    setTimeout(wrap, 0); game.hooks.update.unshift(wrap);
    const _zone = SP.zoneTile; SP.zoneTile = function (p, zone) { if (zone === 'chapeldoor') { const b = this.building(this.chapelId); if (b && b.doorX != null) { const k = this.people.filter((x) => x.activity && x.activity.act === 'beg').indexOf(p); return [b.doorX + (k % 2 ? 2 : -2), b.doorY + 1]; } return _zone.call(this, p, 'square'); } return _zone.apply(this, arguments); };
    const _idle = SP.idleAnim; SP.idleAnim = function (p) { if (p.activity?.act === 'beg') return p.agent.talking ? 'talk' : (Math.floor(this.minute / 2) + p.id) % 4 === 0 ? 'look' : 'beg'; return _idle.apply(this, arguments); };
    const coins = [], bowls = new Map(); let tick = 2;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || game.scene) return;
      for (const c of coins.slice()) { c.t += dt; if (c.t >= 0.5) { coins.splice(coins.indexOf(c), 1); bowls.set(c.q, (bowls.get(c.q) || 0) + 1); if (near(c.x1, c.y1, 200)) O.sfx && O.sfx('kaching', 0.08); } }
      tick -= dt; if (tick > 0) return; tick = 1.5;
      const bs = s.people.filter((q) => q.activity && q.activity.act === 'beg' && q.agent && !q.agent.path && !q.agent.hidden && near(q.agent.x, q.agent.y, 450));
      for (const b of bs) { const ba = b.agent;
        for (const q of s.people) { if (q === b || !q.agent || q.agent.hidden || q.agent.inside != null || !q.agent.path || q.age < 12 || q._gaveTo === b.id + ':' + s.day) continue; const d = Math.hypot(q.agent.x - ba.x, q.agent.y - ba.y); if (d > 28) continue; q._gaveTo = b.id + ':' + s.day;
          const kind = (q.traits || []).some((t) => /pious|kind|generous|gentle|honest/.test(t)) || q.gentry || /priest|nun|monk|friar/.test(q.job?.role || ''); const sunday = s.weekday === 6 && s.minute / 60 >= 11 && s.minute / 60 < 13;
          if (Math.random() < (kind ? 0.6 : 0.12) + (sunday ? 0.25 : 0) && (s.household(q)?.money || 0) > 5) { O.gesture && O.gesture(q, 'give', 1); O.gesture && O.gesture(b, 'bow', 1.4); coins.push({ q: b, x0: q.agent.x, y0: q.agent.y - 12, x1: ba.x + 5, y1: ba.y - 2, t: 0 }); const hh = s.household(q); if (hh) hh.money -= 1; const bh = s.household(b); if (bh) bh.money += 1; s.relate(b, q, 0.05); if (Math.random() < 0.5) say(b, pick(['God bless you.', 'Bless you, master.', 'Christ keep you, mistress.', 'Thank you, thank you.']), 1.6); }
          else if (Math.random() < 0.3) { O.gesture && O.gesture(b, 'beg', 1.5); if (Math.random() < 0.3) say(b, pick(['Spare a penny?', 'Alms, for the love of God.', 'A crust, good people?']), 1.6); } }
        if (s.minute / 60 > 17.7 && bowls.get(b)) bowls.delete(b); }
    });
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (!s || game.scene) return;
      for (const q of s.people) { if (!q.activity || q.activity.act !== 'beg' || !q.agent || q.agent.hidden || q.agent.path) continue; const a = q.agent, x = Math.round(a.x - cam.x) + 5, y = Math.round(a.y - cam.y) - 1; ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 3, y - 2, 7, 2); ctx.fillRect(x - 2, y, 5, 1); const n = Math.min(6, bowls.get(q) || 0); ctx.fillStyle = '#c8a030'; for (let i = 0; i < n; i++) ctx.fillRect(x - 2 + (i % 3) * 2, y - 3, 1, 1); }
      for (const c of coins) { const k = c.t / 0.5; ctx.fillStyle = '#e0c050'; ctx.fillRect(Math.round(c.x0 + (c.x1 - c.x0) * k - cam.x), Math.round(c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 8 - cam.y), 2, 2); } });
    (O.extraLines = O.extraLines || []).push((s, q) => q.activity && q.activity.act === 'beg' ? `You are sitting by the chapel door with a bowl, begging; you have no work and nothing in the house. You are ashamed, and grateful for any coin${bowls.get(q) ? ` (${bowls.get(q)} in the bowl so far today)` : ''}.` : '');
    O.Alms = { bowls, poor: (q) => poor(cur(), q) };
  }
  O.AlmsSetup = { setup };
})();
