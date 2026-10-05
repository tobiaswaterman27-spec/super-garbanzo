// Your name, seen in the street. The watch nod to someone in good standing as they pass and keep a hard
// eye on a known troublemaker; and when you're famous (well loved, a champion of the lists, the monarch)
// now and then a few of the town's children run up to stare and wave, then run off again.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k);
    const famous = () => (O.crowned && O.crowned()) || PS.rep.civilian > 0.55 || PS.rep.local > 0.6;
    const notorious = () => PS.rep.criminal > 0.4 || PS.rep.guard < -0.35 || (PS.wantedLevel && PS.wantedLevel() >= 1);
    const seen = new Map(); // guard id -> last minute they reacted
    const followers = new Map(); // child id -> { until, ax, ay }
    const gawked = new Map(); let nextKids = 0;
    // let a child go: back to whatever they were doing, running off
    function release(s, id) { const q = s.byId.get(id); followers.delete(id); if (!q || !q.agent) return; q.agent.frozen = false; q.agent.forceAnim = null; q.activity = null; }
    let tk = 0;
    game.hooks.update.push((dt) => {
      const s = cur(), p = game.player; if (!s) return;
      if (game.scene || O.panelOpen) { if (game.scene) for (const id of followers.keys()) release(s, id); return; }
      tk -= dt;
      if (tk <= 0) {
        tk = 0.5; const now = s.day * 1440 + s.minute;
        // the watch, as you pass
        for (const g of s.people) {
          if (!/guard|sergeant|watch/.test(g.job?.role || '') || g.agent.hidden || g.agent.chasing || g.activity?.act === 'sleep') continue;
          const d = Math.hypot(g.agent.x - p.x, g.agent.y - p.y); if (d > 40 || (seen.get(g.id) || -1e9) > now - 120) continue;
          seen.set(g.id, now); g.agent.dir = O.dirOf(p.x - g.agent.x, p.y - g.agent.y);
          if (O.crowned && O.crowned()) { g.agent.forceAnim = 'wave'; say(`${g.first} of the watch stands to attention as you pass. "Majesty."`); }
          else if (notorious()) { g.agent.forceAnim = 'point'; say(`${g.first} of the watch watches you go by with a hard eye.`, 'bad'); }
          else if (PS.rep.guard > 0.3 || PS.rep.local > 0.45) { g.agent.forceAnim = 'wave'; say(`${g.first} of the watch gives you a nod.`); }
          else continue;
          g.agent.frozen = true; setTimeout(() => { g.agent.frozen = false; g.agent.forceAnim = null; }, 1300);
        }
        // children who'll follow someone famous
        // children who run up to see someone famous: only now and then, a child at most once a day
        if (famous() && !followers.size && game.t > nextKids) {
          const kids = s.people.filter((q) => q.age >= 5 && q.age < 13 && !q.agent.hidden && q.agent.inside == null && (gawked.get(q.id) ?? -1) !== s.day && ['play', 'stroll', 'festival'].includes(q.activity?.act) && Math.hypot(q.agent.x - p.x, q.agent.y - p.y) < 110).slice(0, 2);
          if (kids.length) {
            nextKids = game.t + 90 + Math.random() * 120;
            for (const kid of kids) { gawked.set(kid.id, s.day); followers.set(kid.id, { until: game.t + 9, at: null, ax: p.x, ay: p.y }); kid.agent.frozen = true; kid.agent.path = null; }
            say(O.crowned && O.crowned() ? 'Children come running to stare: the monarch, in the street!' : `${kids.length > 1 ? 'Two children run' : 'A child runs'} up to gawp at you. Your name has got about.`);
          } else nextKids = game.t + 20;
        }
      }
      for (const [id, f] of followers) {
        const q = s.byId.get(id); if (!q || q.agent.hidden || q.agent.inside != null) { release(s, id); continue; }
        const a = q.agent, k = [...followers.keys()].indexOf(id);
        // they run up to where you were, stare and wave a little, and run off; walk away and they don't follow
        if (game.t > f.until || Math.hypot(p.x - f.ax, p.y - f.ay) > 70) { release(s, id); continue; }
        const tx = f.ax - 14 + k * 26, ty = f.ay + 22, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
        if (d > 3 && f.at == null) { const sp = 70 * dt, nx = a.x + dx / d * Math.min(sp, d), ny = a.y + dy / d * Math.min(sp, d); if (!game.solidAt(nx, ny)) { a.x = nx; a.y = ny; } else f.at = game.t; a.dir = O.dirOf(dx, dy); a.forceAnim = 'run'; }
        else { if (f.at == null) f.at = game.t; a.forceAnim = (Math.floor(game.t * 2) + id) % 3 ? 'idle' : 'wave'; a.dir = O.dirOf(p.x - a.x, p.y - a.y); }
      }
    });
  }
  O.RenownSetup = { setup };
})();
