// Crime in the street, as it happens around you. A cutpurse works the crowd: a brush past someone, a
// purse gone, a shout, and the thief away at a run. Catch them and the purse goes back to its owner,
// who won't forget it; let them go and they get away with it.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, T = 16, say = (t, k) => O.UI.say(t, k);
    const talk = (q, t, secs = 3, k = '') => O.Speech && O.Speech.say(q, t, secs, k);
    let ev = null, next = 0;
    const absMin = (s) => s.day * 1440 + s.minute;
    const outdoors = (q) => q.agent && q.agent.inside == null && !q.agent.hidden && q.alive !== false && !q.agent.frozen && !q.agent.chasing && !q.agent.talking;
    // walk (or run) a person along the streets toward a point
    function steer(e, q, tx, ty, speed, dt) {
      const s = cur(), a = q.agent;
      e.rp = (e.rp || 0) - dt;
      if (e.rp <= 0 || !e.path) { e.rp = 0.7; e.path = s.path.find(Math.floor(a.x / T), Math.floor((a.y - 1) / T), Math.floor(tx / T), Math.floor((ty - 1) / T)) || []; e.pi = 0; }
      let budget = speed * dt;
      while (budget > 0) {
        let gx, gy; if (e.pi < e.path.length) { const [px, py] = e.path[e.pi]; gx = px * T + 8; gy = py * T + 10; } else { gx = tx; gy = ty; }
        const ex = gx - a.x, ey = gy - a.y, ed = Math.hypot(ex, ey);
        if (ed > 0.01) a.dir = O.dirOf(ex, ey);
        if (ed <= budget) { a.x = gx; a.y = gy; budget -= ed; if (e.pi < e.path.length) e.pi++; else return true; } else { a.x += ex / ed * budget; a.y += ey / ed * budget; budget = 0; }
      }
      return false;
    }
    function release(q) { if (!q) return; const a = q.agent; a.chasing = false; a.sprint = false; a.frozen = false; a.path = null; a.goal = null; }
    function end() { if (!ev) return; release(ev.thief); if (ev.victim) release(ev.victim); ev = null; next = absMin(cur()) + 90 + Math.floor(Math.random() * 120); }

    function begin(s) {
      const p = game.player;
      const crowd = s.people.filter((q) => outdoors(q) && q.age >= 16 && !q.royal && Math.hypot(q.agent.x - p.x, q.agent.y - p.y) < 260);
      const victim = crowd.filter((q) => Math.hypot(q.agent.x - p.x, q.agent.y - p.y) > 70 && (s.household(q)?.money || 0) > 8 && !/guard|watch/.test(q.job?.role || ''))[0];
      if (!victim) return;
      const near = (q) => Math.hypot(q.agent.x - victim.agent.x, q.agent.y - victim.agent.y);
      const thief = s.people.filter((q) => outdoors(q) && q !== victim && q.age >= 13 && q.age < 50 && !q.royal && !q.gentry && !O.upright(s, q) && near(q) < 300 && near(q) > 40 && (q.gang || (s.household(q)?.money || 0) < 15 || q.traits.includes('greedy')))
        .sort((a, b) => (b.gang ? 1 : 0) - (a.gang ? 1 : 0))[0];
      if (!thief) return;
      thief.agent.chasing = true; thief.agent.path = null;
      ev = { kind: 'cutpurse', thief, victim, phase: 'stalk', t: 0 };
    }

    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.people) return;
      if (!ev) {
        if (game.scene || O.panelOpen || s.world !== game.world || absMin(s) < next || s.hour < 9 || s.hour > 18) return;
        if (Math.random() < dt / 40) begin(s); else return;
        if (!ev) { next = absMin(s) + 20; return; }
      }
      const { thief: q, victim: v } = ev, a = q.agent; ev.t += dt;
      if (s.world !== game.world || q.alive === false || a.hidden || ev.t > 60) return end();
      if (ev.phase === 'stalk') {
        if (!outdoors(v) && !v.agent.frozen) return end();
        a.anim = 'walk';
        if (steer(ev, q, v.agent.x, v.agent.y + 2, 55, dt) || Math.hypot(a.x - v.agent.x, a.y - v.agent.y) < 10) {
          const hh = s.household(v), took = Math.min(hh ? hh.money : 0, 4 + Math.floor(Math.random() * 12));
          if (hh) hh.money -= took; const th = s.household(q); if (th) th.money += took; ev.took = took;
          ev.phase = 'flee'; ev.t = 0; ev.path = null; a.sprint = true;
          // away from you, out of the crowd
          const p = game.player, dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy) || 1;
          ev.to = [a.x + (dx / d) * 420, a.y + (dy / d) * 420];
          setTimeout(() => { if (ev && ev.victim === v) { v.agent.shockedUntil = s.minute + 2; talk(v, ['My purse! Thief!', 'Stop, thief!', 'He took my purse!', 'Thief! Somebody stop them!'][q.id % 4].replace('He', q.sex === 'f' ? 'She' : 'He'), 3, 'angry'); } }, 500);
          s.remember(v, 'My purse was cut in the street.', 'crime', 0.8, -0.2);
        }
        return;
      }
      if (ev.phase === 'flee') {
        a.anim = 'run';
        if (steer(ev, q, ev.to[0], ev.to[1], 112, dt) || ev.t > 14) { s.log(`A cutpurse took ${v.first}'s purse in the street and got clean away.`, 'crime'); return end(); }
      }
    });
    // catching them: close enough to lay a hand on them
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      if (!ev || ev.phase !== 'flee' || game.scene) return null;
      const a = ev.thief.agent, p = game.player;
      if (Math.hypot(a.x - p.x, a.y - p.y) > 26) return null;
      return { type: 'custom', d: -5, x: a.x, y: a.y - 40, label: 'Grab the cutpurse', act: () => catchThief() };
    });
    function catchThief() {
      const s = cur(), { thief: q, victim: v, took } = ev, a = q.agent;
      a.sprint = false; a.anim = 'hurt'; a.frozen = true; game.player.anim = 'attack'; setTimeout(() => { if (game.player.anim === 'attack') game.player.anim = 'idle'; }, 500);
      const th = s.household(q); if (th) th.money = Math.max(0, th.money - took); const hh = s.household(v); if (hh) hh.money += took;
      const r = v.rel.get(0) || { affinity: 0, familiar: 0 }; r.affinity = O.clamp(r.affinity + 0.35, -1, 1); r.familiar = Math.min(1, (r.familiar || 0) + 0.2); r.trust = O.clamp((r.trust || 0) + 0.25, -1, 1); v.rel.set(0, r);
      s.remember(v, 'The stranger caught the cutpurse and gave me back my purse.', 'player', 1, 0.6);
      s.relate(q, { id: 0 }, -0.5); s.remember(q, 'The stranger caught me with a cut purse.', 'player', 1, -0.6);
      PS.rep.guard = (PS.rep.guard || 0) + 0.03; if (PS.rep.town != null) PS.rep.town += 0.02;
      talk(q, ['Let go of me!', 'All right, all right!', 'It was only a few coins!'][q.id % 3], 2.5, 'angry');
      // the watch, if any are near, take the thief away
      const watch = s.people.find((g) => /guard|watch|sergeant/.test(g.job?.role || '') && g.alive !== false && g.agent.inside == null && Math.hypot(g.agent.x - a.x, g.agent.y - a.y) < 320);
      setTimeout(() => {
        if (watch && s.arrestNPC) { s.arrestNPC(q, { kind: 'theft', severity: 1, witnesses: [{ id: v.id }], profile: {} }, false); talk(watch, 'I\'ll take that one.', 2.5); }
        else { a.frozen = false; }
        const reward = Math.min(took, 2 + Math.floor(took / 3));
        if (reward > 0 && hh && hh.money >= reward) { hh.money -= reward; PS.money += reward; }
        talk(v, reward > 0 ? `Bless you! Here, take ${reward === 1 ? 'an aurin' : reward + ' aurins'} for your trouble.` : 'Bless you! I thought it was gone for good.', 3.5);
        s.log(`${v.first}'s purse was cut in the street; the stranger caught the thief.`, 'crime');
        end();
      }, 900);
      ev.phase = 'caught';
    }
    O.Underworld = { busy: () => !!ev, end };
    void say;
  }
  O.UnderworldSetup = { setup };
})();
