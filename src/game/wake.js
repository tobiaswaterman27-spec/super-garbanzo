// Waking the sleeping, and people running from you. Press E at a bed with someone in it and you wake
// them. If you belong there (your house, your inn room, a friend's) they grumble and go back to sleep
// in a while; if you're a stranger in their room they get up and run for the watch (in the castle, for
// the guard). Anyone frightened (a stranger at their bed, a blow struck near them, a blade drawn) runs
// from you for a little while before going back to their day.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k);
    const abs = (s) => s.day * 1440 + s.minute;

    // ---------------- running away ----------------
    const running = new Map(); // id -> { q, until }
    function flee(q, secs = 6) {
      if (!q || !q.agent || q.alive === false || q.agent.chasing || /guard|captain|sergeant|knight/.test(q.job?.role || '')) return;
      running.set(q.id, { q, until: game.t + secs });
      q.agent.fleeing = true; q.agent.path = null; q.agent.frozen = true;
    }
    O.flee = flee;
    game.hooks.update.push((dt) => {
      if (!running.size) return;
      const p = game.player;
      for (const [id, r] of running) {
        const q = r.q, a = q.agent;
        if (game.t > r.until || q.alive === false || q.health?.hp <= 0) { running.delete(id); a.fleeing = false; a.frozen = false; a.path = null; a.goal = null; q.activity = null; continue; }
        if (a.hidden || a.inside != null) continue;
        let dx = a.x - p.x, dy = a.y - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const sp = 92 * dt; let nx = a.x + dx * sp, ny = a.y + dy * sp;
        if (game.solidAt(nx, ny)) { if (!game.solidAt(nx, a.y)) ny = a.y; else if (!game.solidAt(a.x, ny)) nx = a.x; else { nx = a.x + dy * sp; ny = a.y - dx * sp; if (game.solidAt(nx, ny)) { nx = a.x; ny = a.y; } } }
        a.dir = O.dirOf(nx - a.x, ny - a.y); a.x = nx; a.y = ny; a.anim = 'run';
      }
    });
    // whoever is near when you strike someone runs (the guards don't)
    O.scare = (x, y, r = 110, except) => { const s = cur(); if (game.scene) return; for (const q of s.people) if (q !== except && !q.agent.hidden && q.age >= 4 && Math.hypot(q.agent.x - x, q.agent.y - y) < r && !(q.rel && (q.rel.get(0)?.affinity || 0) > 0.5)) flee(q, 5 + (q.id % 4)); };

    // ---------------- waking the sleeping ----------------
    const sleepersIn = (it) => { const sc = game.scene; return sc && sc.sleeping ? (sc.sleeping.get(it) || []).map((z) => z.q).filter((q) => q && q.activity?.act === 'sleep') : []; };
    O.bedSleepers = sleepersIn;
    // you belong here: your own place, your rented room, your household's, or someone who's fond of you
    function belongs(q, b) {
      if (b.owner?.kind === 'player' || (PS.lease && PS.lease.b === b.id) || (PS.room && PS.room.b === b.id)) return true;
      if (b.parent && O.castleMayEnter && O.castleMayEnter({ locked: b.locked || null }) && b.locked) return true; // the royal family's own rooms, if you're family
      return (q.rel && (q.rel.get(0)?.affinity || 0) > 0.45);
    }
    O.wakeBed = (it) => {
      const s = cur(), sc = game.scene, b = sc.b, keep = b.parent || b, list = sleepersIn(it); if (!list.length) return false;
      const q = list[0];
      q.task = { act: 'home', b: keep.id, woken: abs(s) + 25 };
      if (belongs(q, b)) {
        s.relate(q, { id: 0 }, -0.05);
        say(`${q.first} stirs and sits up. “What? What is it?… Let me sleep.” They'll be back asleep before long.`);
        return true;
      }
      // a stranger at the bedside: up, and out of the door for help
      const seen = [q, ...list.slice(1), ...[...sc.actors.values()].map((a) => a.person).filter((z) => z && z !== q && z.activity?.act !== 'sleep')];
      const cr = s.recordCrime({ kind: 'trespass', perp: 'player', placeName: b.name || 'a house', tile: [keep.doorX, keep.doorY], seen, victimPerson: q, severity: s.hour >= 21 || s.hour < 6 ? 2 : 1 });
      PS.crimes.push(cr.id); s.relate(q, { id: 0 }, -0.6);
      const guards = s.people.filter((g) => /guard/.test(g.job?.role || '') && g.alive !== false && g.activity?.act !== 'sleep');
      const near = keep.royal && guards.find((g) => g.agent.inside === keep.id);
      q.task = { act: 'report', b: near ? keep.id : s.guardId, crime: cr.id, woken: abs(s) + 60 };
      for (const z of list.slice(1)) z.task = { act: 'home', b: keep.id, woken: abs(s) + 40 };
      say(`${q.first} wakes with a start and sees you. “Who are you? Get out! ${keep.royal ? 'Guards! GUARDS!' : 'Help! Watch!'}” They scramble out of bed and run for help.`, 'bad');
      if (near && O.lawReport) O.lawReport(cr, near);
      return true;
    };
    // a woken sleeper gets up for a while, then goes back to bed (the one who ran for help stays up longer)
    let tk = 0;
    game.hooks.update.push((dt) => {
      tk -= dt; if (tk > 0) return; tk = 1;
      const s = cur(), now = abs(s);
      for (const q of s.people) if (q.task?.woken && now > q.task.woken) q.task = null;
    });
  }
  O.WakeSetup = { setup };
})();
