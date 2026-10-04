// Errands: a real townsperson leaves what they were doing, walks to a spot in the street, does
// something there you can watch (hammers in a board, hangs a sign, greets a friend, squares up to an
// enemy) and then goes back to their day. Anything can send someone on one.
'use strict';
(function () {
  function setup(game) {
    const SP = O.Sim.prototype, _plan = SP.plan, _route = SP.route, _idle = SP.idleAnim;
    // while on an errand, that is what they're doing
    SP.plan = function (p) { if (p.errand && !p.errand.done) return { act: 'errand', outdoor: true, zone: 'errand', key: p.errand.key }; return _plan.call(this, p); };
    SP.route = function (p, act) {
      if (act.act !== 'errand' || !p.errand) return _route.call(this, p, act);
      const a = p.agent, [tx, ty] = p.errand.tile;
      if (a.inside != null) { const b = this.building(a.inside); const [ex, ey] = this.entry(b); [a.x, a.y] = this.tileCenter(ex, ey, p); a.inside = null; a.hidden = false; }
      const sx = Math.floor(a.x / this.T), sy = Math.floor((a.y - 1) / this.T);
      a.goal = [tx, ty]; a.goalB = null; a.offPath = false;
      const path = sx === tx && sy === ty ? [] : this.path.find(sx, sy, tx, ty);
      if (!path) { a.path = [[tx, ty]]; a.offPath = true; } else a.path = path;
      a.pi = 0;
    };
    SP.idleAnim = function (p) { if (p.errand && p.errand.working) return p.errand.anim; return _idle.call(this, p); };
    const live = new Set();
    // send q to tile [tx, ty], face `face` there, play `anim` for `secs` seconds, then call done()
    function send(sim, q, tile, opts) {
      if (!q || !q.agent || q.errand) return false;
      // a town that has its own day plan laid over the shared one still sends people on errands
      if (Object.prototype.hasOwnProperty.call(sim, 'plan') && !sim._errandPlan) { const own = sim.plan; sim.plan = (p) => (p.errand && !p.errand.done ? { act: 'errand', outdoor: true, zone: 'errand', key: p.errand.key } : own(p)); sim._errandPlan = true; }
      q.errand = Object.assign({ key: Math.random().toString(36).slice(2, 7), tile, anim: 'hammer', secs: 2.5, face: 0, carry: null, sim, started: game.t, giveUp: game.t + 60 }, opts);
      if (q.errand.carry) q.agent.carrying = q.errand.carry;
      q.activity = null; q.agent.path = null; q.agent.goal = null; // re-plan straight away
      live.add(q);
      return true;
    }
    function finish(q, ok) { const e = q.errand; if (!e) return; live.delete(q); e.done = true; q.errand = null; if (e.carry && q.agent.carrying === e.carry) q.agent.carrying = null; q.activity = null; q.agent.path = null; q.agent.goal = null; if (e.done && e.after) try { e.after(ok); } catch (err) { console.error(err); } }
    game.hooks.update.push(() => {
      for (const q of [...live]) {
        const e = q.errand; if (!e) { live.delete(q); continue; }
        const a = q.agent, [tx, ty] = e.tile, T = e.sim.T;
        if (q.alive === false || q.health?.hp <= 0) { finish(q, false); continue; }
        const there = !a.path && a.inside == null && Math.hypot(a.x - (tx * T + 8), a.y - (ty * T + 10)) < 14;
        if (there && !e.working) { e.working = true; e.until = game.t + e.secs; a.dir = e.face; if (e.carry && a.carrying === e.carry) a.carrying = null; if (e.at) try { e.at(); } catch (err) { console.error(err); } }
        if (e.working) { a.dir = e.face; a.anim = e.anim; if (game.t >= e.until) finish(q, true); }
        else if (game.t > e.giveUp) { finish(q, false); }
      }
    });
    O.Errands = { send, finish, live };
  }
  O.ErrandsSetup = { setup };
})();
