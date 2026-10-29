// Fences that join up, and gates that open and shut. However a fence was laid down (rails along, rails
// up), each post looks to its neighbours and runs its rails to meet them, corners included. A gate is
// opened and closed with E; left open, the beasts in that pen will wander out through it in time.
'use strict';
(function () {
  const T = 16, KINDS = new Set(['fenceH', 'fenceV', 'fenceGate', 'fencePost', 'fence']);
  // turn every piece of fence in a world into a joined piece, once
  O.fixFences = (world) => {
    if (!world || world._fenced) return; world._fenced = true;
    const at = new Map(), list = [];
    for (const p of world.props) if (KINDS.has(p.kind)) { const tx = Math.floor(p.x / T), ty = Math.floor((p.y - 1) / T), k = ty * world.W + tx; if (at.has(k)) { p._dupe = true; continue; } at.set(k, p); list.push([p, tx, ty]); }
    if (!list.length) return;
    world.props = world.props.filter((p) => !p._dupe);
    for (const [p, tx, ty] of list) {
      const gate = p.kind === 'fenceGate' || !!(p.v & 16 && p.kind === 'fence'), open = p.kind === 'fence' && !!(p.v & 32);
      const has = (x, y) => at.has(y * world.W + x);
      let v = (has(tx, ty - 1) ? 1 : 0) | (has(tx + 1, ty) ? 2 : 0) | (has(tx, ty + 1) ? 4 : 0) | (has(tx - 1, ty) ? 8 : 0);
      if (gate) v |= 16 | (open ? 32 : 0);
      p.kind = 'fence'; p.v = v; p.x = tx * T + 8; p.y = ty * T + 15; p.sprite = null; p.flat = false;
      p.solid = !(gate && open); world.solid[ty * world.W + tx] = p.solid ? 1 : 0;
      if (gate) p.gate = true;
    }
  };
  function setup(game) {
    const near = () => { const w = game.world, P = game.player; if (game.scene || !w) return null; let best = null, bd = 26; for (const p of w.props) { if (!p.gate) continue; const d = Math.hypot(p.x - P.x, p.y - 2 - P.y); if (d < bd) { bd = d; best = p; } } return best; };
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const g = near(); if (!g) return null; const open = !!(g.v & 32);
      return { type: 'custom', d: 1, x: g.x, y: g.y - 30, label: open ? 'Shut the gate' : 'Open the gate', act: () => toggle(g) };
    });
    function toggle(g) {
      const w = game.world, open = !(g.v & 32), tx = Math.floor(g.x / T), ty = Math.floor((g.y - 1) / T);
      g.v = open ? g.v | 32 : g.v & ~32; g.solid = !open; w.solid[ty * w.W + tx] = open ? 0 : 1; g.sprite = O.Env.prop('fence', g.seed, g.v);
      game.player.anim = 'open'; setTimeout(() => { if (game.player.anim === 'open') game.player.anim = 'idle'; }, 400);
      O.Audio && O.Audio.sfx && O.Audio.sfx('door');
      w.dirtyStatics = true;
      // which pen this gate belongs to: its beasts may stray while it stands open
      for (const pen of w.pens || []) { const [x0, y0, x1, y1] = pen.z; if (tx >= x0 - 1 && tx <= x1 + 1 && ty >= y0 - 1 && ty <= y1 + 1) pen.gateOpen = open ? [tx, ty] : null; }
    }
    O.Fences = { toggle };
  }
  O.FencesSetup = { setup };
})();
