// Your name, seen in the street. The watch nod to someone in good standing as they pass and keep a hard
// eye on a known troublemaker; and when you're famous (well loved, a champion of the lists, the monarch)
// the town's children trail after you for a while, at a respectful distance.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k);
    const famous = () => (O.crowned && O.crowned()) || PS.rep.civilian > 0.55 || PS.rep.local > 0.6;
    const notorious = () => PS.rep.criminal > 0.4 || PS.rep.guard < -0.35 || (PS.wantedLevel && PS.wantedLevel() >= 1);
    const seen = new Map(); // guard id -> last minute they reacted
    const followers = new Map(); // child id -> until (game.t)
    let tk = 0;
    game.hooks.update.push((dt) => {
      const s = cur(), p = game.player; if (!s || game.scene || O.panelOpen) return;
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
        if (famous() && followers.size < 3) {
          const kid = s.people.find((q) => q.age >= 5 && q.age < 13 && !q.agent.hidden && q.agent.inside == null && !followers.has(q.id) && ['play', 'stroll', 'festival'].includes(q.activity?.act) && Math.hypot(q.agent.x - p.x, q.agent.y - p.y) < 90);
          if (kid) { followers.set(kid.id, game.t + 20 + Math.random() * 15); kid.agent.frozen = true; kid.agent.path = null; if (followers.size === 1) say(O.crowned && O.crowned() ? 'Children run after you, wide-eyed: the monarch, in the street!' : 'A gaggle of children trails after you. Your name has got about.'); }
        }
      }
      for (const [id, until] of followers) {
        const q = s.byId.get(id); if (!q || game.t > until || q.agent.hidden || q.agent.inside != null) { if (q) { q.agent.frozen = false; q.agent.forceAnim = null; q.activity = null; } followers.delete(id); continue; }
        const a = q.agent, k = [...followers.keys()].indexOf(id), tx = p.x - 22 + k * 14, ty = p.y + 18, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
        if (d > 3) { const sp = (d > 60 ? 80 : 48) * dt, nx = a.x + dx / d * Math.min(sp, d), ny = a.y + dy / d * Math.min(sp, d); if (!game.solidAt(nx, ny)) { a.x = nx; a.y = ny; } a.dir = O.dirOf(dx, dy); a.forceAnim = d > 60 ? 'run' : 'walk'; }
        else { a.forceAnim = (Math.floor(game.t * 2) + id) % 5 ? 'idle' : 'wave'; a.dir = O.dirOf(p.x - a.x, p.y - a.y); }
      }
    });
  }
  O.RenownSetup = { setup };
})();
