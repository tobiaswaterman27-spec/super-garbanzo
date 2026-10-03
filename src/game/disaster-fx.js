// Floods and pestilence made visible: brown floodwater spreading over the land with drifting ripples
// and a muddy fringe, and red crosses daubed on the doors of quarantined houses.
'use strict';
(function () {
  function setup(game, home) {
    const cur = () => O.SimRef.cur;
    game.hooks.drawGround.push((ctx, cam) => {
      const s = cur(); if (game.scene || game.world !== s.world) return;
      const F = s.floodState; if (!F || !F.tiles) return;
      const w = s.world, T = 16, t = game.t;
      const x0 = Math.max(0, Math.floor(cam.x / T) - 1), y0 = Math.max(0, Math.floor(cam.y / T) - 1), x1 = Math.min(w.W - 1, Math.ceil((cam.x + game.vw) / T) + 1), y1 = Math.min(w.H - 1, Math.ceil((cam.y + game.vh) / T) + 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * w.W + x; if (!F.tiles.has(i)) continue;
        const px = x * T - cam.x, py = y * T - cam.y;
        const edge = !F.tiles.has(i - 1) && w.ter[i - 1] !== w.TER.WATER || !F.tiles.has(i + 1) && w.ter[i + 1] !== w.TER.WATER || !F.tiles.has(i - w.W) && w.ter[i - w.W] !== w.TER.WATER || !F.tiles.has(i + w.W) && w.ter[i + w.W] !== w.TER.WATER;
        const X = Math.round(px), Y = Math.round(py);
        if (!edge) { ctx.fillStyle = 'rgba(78,96,84,0.93)'; ctx.fillRect(X, Y, T, T); }
        else {
          // a ragged, muddy shoreline in 2-pixel steps
          for (let yy = 0; yy < T; yy += 2) for (let xx = 0; xx < T; xx += 2) {
            const n = O.noise2((x * T + xx) * 0.18, (y * T + yy) * 0.18, 77);
            if (n > 0.62) continue;
            ctx.fillStyle = n > 0.48 ? 'rgba(110,90,60,0.75)' : 'rgba(78,96,84,0.9)';
            ctx.fillRect(X + xx, Y + yy, 2, 2);
          }
        }
        // ripples drifting downstream
        ctx.fillStyle = 'rgba(176,190,170,0.6)';
        const ph = Math.floor((t * 6 + x * 3 + y * 7) % 16);
        ctx.fillRect(Math.round(px + ph), Math.round(py + ((x * 5 + y * 3) % 12) + 2), 3, 1);
        if ((x + y) % 3 === 0) ctx.fillRect(Math.round(px + ((ph + 8) % 16)), Math.round(py + ((x * 7 + y) % 10) + 4), 2, 1);
      }
    });
    // red crosses on marked doors
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (game.scene || game.world !== s.world || !s.quarantine) return;
      for (const b of s.world.buildings) {
        if (!b.marked || !b.sprite || !b.sprite.door) continue;
        const d = b.sprite.door, x = Math.round(b.x * 16 - b.sprite.OV + d.x + d.w / 2 - cam.x), y = Math.round((b.bottom + 1) * 16 - b.sprite.H + d.y + 4 - cam.y);
        ctx.fillStyle = '#d8382c'; ctx.fillRect(x - 1, y - 4, 3, 11); ctx.fillRect(x - 4, y - 1, 9, 3);
      }
    });
    let wasQ = false, wasF = false;
    game.hooks.update.push(() => {
      const s = home, q = !!s.quarantine, f = !!(s.floodState && s.floodState.level >= 1);
      if (q && !wasQ && game.world === s.world) O.Panels.toast('Quarantine: the sick keep to their houses, marked with red crosses. The tavern is shut.', 'bad');
      if (f && !wasF && game.world === s.world) O.Panels.toast('The river has burst its banks!', 'bad');
      wasQ = q; wasF = f;
    });
  }
  O.DisasterFX = { setup };
})();
