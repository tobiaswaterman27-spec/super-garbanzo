// The castle kept as a castle. By day and by night two of the royal guard stand sentry either side of
// the keep's great door, and two more outside the gatehouse in the curtain wall, facing the town with their spears.
// They are real guards on their shift, not painted ones: talk to them, and at the change of the watch
// fresh men take their places. Hay and clutter are cleared out of the royal garden.
'use strict';
(function () {
  function setup(game) {
    const SP = O.Sim.prototype, cur = () => O.SimRef.cur;
    const keepOf = (s) => s.world.buildings.find((b) => b.royal && !b.parent && b.doorX != null);
    // where the four posts are: two at the keep door, two at the curtain wall's gate below it
    const postsOf = (s) => {
      if (s._posts !== undefined && s._postsW === s.world) return s._posts; s._postsW = s.world;
      const k = keepOf(s); if (!k) return (s._posts = null);
      const out = [[k.doorX - 2, k.doorY + 1], [k.doorX + 2, k.doorY + 1]];
      const arch = s.world.props.filter((p) => p.kind === 'gatearch' && Math.abs(p.x / 16 - k.doorX) < 12 && p.y / 16 > k.doorY && p.y / 16 - k.doorY < 40).sort((a, b) => a.y - b.y)[0];
      if (arch) { const ax = Math.floor(arch.x / 16), ay = Math.floor(arch.y / 16); for (const dx of [-2, 2]) { const tx = ax + dx; let ty = ay + 1; for (let k2 = 0; k2 < 8 && s.world.solid[ty * s.world.W + tx]; k2++) ty++; out.push([tx, ty]); } }
      return (s._posts = out.filter(([x, y]) => !s.world.solid[y * s.world.W + x]));
    };
    const sentries = (s) => s.people.filter((q) => q.job?.role === 'royal guard' && q.alive !== false && !q.isPlayer).sort((a, b) => a.id - b.id);
    const _plan = SP.plan;
    SP.plan = function (p) {
      const a = _plan.call(this, p);
      if (!a || a.act !== 'work' || p.job?.role !== 'royal guard' || p.isPlayer) return a;
      const posts = postsOf(this); if (!posts || !posts.length) return a;
      // whoever is on duty: the first ones take the posts outside, the rest keep the halls
      const onDuty = sentries(this).filter((q) => q === p || q.activity?.act === 'work' || q.activity?.zone === 'sentry');
      const i = onDuty.indexOf(p); if (i < 0 || i >= posts.length) return a;
      return { act: 'stroll', outdoor: true, zone: 'sentry', post: i };
    };
    const _zone = SP.zoneTile;
    SP.zoneTile = function (p, zone) { if (zone === 'sentry') { const posts = postsOf(this), t = posts && posts[p.activity?.post ?? 0]; if (t) return t; } return _zone.call(this, p, zone); };
    const _idle = SP.idleAnim;
    SP.idleAnim = function (p) { if (p.activity?.zone === 'sentry') { p.agent.dir = 0; return (Math.floor(this.minute / 7) + p.id) % 9 === 0 ? 'look' : 'idle'; } return _idle.call(this, p); };
    // a royal garden is no rickyard
    let cleared = null;
    game.hooks.update.push(() => {
      const s = cur(), w = game.world; if (!s || !w || cleared === w) return; cleared = w; const k = keepOf(s); if (!k) return;
      const inWard = (p) => Math.abs(p.x / 16 - k.doorX) < 26 && p.y / 16 > k.doorY - 2 && p.y / 16 < k.doorY + 32;
      const nearStable = (p) => w.buildings.some((b) => /stable/.test(b.type || '') && Math.hypot(p.x / 16 - (b.x + b.w / 2), p.y / 16 - (b.y + (b.h || 4) / 2)) < 7);
      const before = w.props.length;
      for (let i = w.props.length - 1; i >= 0; i--) { const p = w.props[i]; if ((p.kind === 'hay' || p.kind === 'woodpile' || p.kind === 'cart') && inWard(p) && !nearStable(p)) { if (p.solid) w.solid[Math.floor(p.y / 16) * w.W + Math.floor(p.x / 16)] = 0; w.props.splice(i, 1); } }
      if (w.props.length !== before) w.dirtyStatics = true;
    });
    O.castlePosts = (s) => postsOf(s || cur());
  }
  O.CastleGroundsSetup = { setup };
})();
