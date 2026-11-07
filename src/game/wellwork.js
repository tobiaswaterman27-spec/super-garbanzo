// Drawing water. When someone's at the well for water, you see the bucket go down on its rope and
// come up full, slopping, the windlass turning; and there's a wet patch on the stones round the well.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || !s.world || game.scene || !O.Errands) return; const wells = s.world.props.filter((p) => p.kind === 'well'); if (!wells.length) return;
      const tk = performance.now() / 1000;
      for (const w of wells) { const x = Math.round(w.x - cam.x), y = Math.round(w.y - cam.y); if (x < -40 || y < -60 || x > ctx.canvas.width + 40 || y > ctx.canvas.height + 40) continue;
        const at = [...O.Errands.live].find((q) => q.errand && q.errand.working && Math.hypot(q.agent.x - w.x, q.agent.y - w.y) < 30);
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#4a5a6a'; ctx.beginPath(); ctx.ellipse(x, y + 3, 14, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        if (!at) continue; const k = (tk % 3) / 3, up = k > 0.5, d = up ? (1 - k) * 2 : k * 2; // down then up
        const by = y - 22 + Math.round(d * 14); ctx.strokeStyle = '#a89060'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x, by); ctx.stroke();
        ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 2, by, 5, 4); if (up && d < 0.9) { ctx.fillStyle = '#9ac0d8'; ctx.fillRect(x - 1, by, 3, 1); if (Math.floor(tk * 6) % 2) ctx.fillRect(x + 3, by + 3 + Math.floor(tk * 10) % 3, 1, 1); }
        ctx.fillStyle = '#5a3d26'; const a = tk * (up ? -4 : 4); ctx.fillRect(x + 8 + Math.round(Math.cos(a) * 3), y - 27 + Math.round(Math.sin(a) * 3), 2, 2);
      }
    });
  }
  O.WellWorkSetup = { setup };
})();
