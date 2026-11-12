// Nobody stays spoken for by mistake. The little scenes mark the people they borrow (on their way to
// the riverbank, at the door with the hens, up the apple tree...), and every scene holds them still while
// it has them. If someone is marked but neither held nor on their way anywhere for a good few seconds,
// the scene lost track of them (another errand took them over, say), so the mark comes off and they are
// free to be asked again.
'use strict';
(function () {
  const FLAGS = ['_bank', '_tree', '_door', '_stable', '_abbey', '_winter', '_call', '_chore', '_beast', '_repair', '_puddle', '_quay', '_garden', '_hat', '_kid2', '_bake', '_tooth', '_leisure', '_rain', '_grave', '_scarer', '_wassail', '_rog', '_wash', '_office', '_evict', '_reopen', '_moot', '_dole', '_flood', '_swarm', '_lost', '_truant', '_watch', '_christ', '_shrove', '_plough', '_grist', '_trestle', '_soul', '_candle', '_yule', '_bull', '_gwatch', '_friar', '_chim', '_inn', '_kidbull', '_visit', '_rough', '_warm', '_borrow', '_oldload', '_hen', '_nb', '_thank', '_dpurse', '_slipped', '_peace', '_mind', '_mwrun'];
  function setup(game) {
    const since = new Map(); let t = 0; let cleared = 0;
    game.hooks.update.push((dt) => {
      t += dt; if (t < 1) return; const step = t; t = 0;
      const s = O.SimRef.cur; if (!s || !s.people) return;
      for (const q of s.people) {
        const a = q.agent; let marked = null; for (const f of FLAGS) if (q[f]) { marked = f; break; }
        if (!marked || !a || a.frozen || q.errand) { since.delete(q); continue; }
        const k = (since.get(q) || 0) + step; since.set(q, k);
        if (k > 8) { for (const f of FLAGS) if (q[f]) q[f] = f === '_call' || f === '_chore' || f === '_beast' ? null : false; if (q._stableH) { q._stableH.tied = false; q._stableH = null; } a.forceAnim = null; since.delete(q); cleared++; }
      }
    });
    O.FlagWatch = { get cleared() { return cleared; } };
  }
  O.FlagWatchSetup = { setup };
})();
