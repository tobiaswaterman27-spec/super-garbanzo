// Bodies tell their story. The very old go with a stick, tapping as they walk. Anyone hurt (a brawl,
// a fall, a war wound) wears a bandage round the head and goes on a crutch until they mend; the sick
// out of doors go wrapped and slow, coughing. Nobody needs to be told: you can see it.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const hurt = (q) => { const il = q.health && q.health.illness; return !!(il && /injur|wound|broken|hurt|bruis|cut/.test(il.kind || '')) || (q.health && q.health.hp != null && q.health.hp < 50); };
    const sick = (q) => { const il = q.health && q.health.illness; return !!(il && !hurt(q)) && q.health.state === 'ill'; };
    let ct = 0;
    game.hooks.update.push((dt) => { const s = cur(); if (!s || game.scene) return; ct -= dt; if (ct > 0) return; ct = 3; for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen) continue; if (Math.hypot(a.x - game.player.x, a.y - game.player.y) > 300) continue; if (sick(q) && Math.random() < 0.25) O.gesture && O.gesture(q, 'cough', 1.2); } });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height, tk = performance.now() / 1000;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.mount) continue; const x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); if (x < -20 || y < -40 || x > W + 20 || y > H + 20) continue;
        const moving = a.anim === 'walk' || a.anim === 'run' || a.forceAnim === 'walk', side = a.dir === 1 ? -1 : 1;
        if (hurt(q)) { const sw = moving ? Math.round(Math.sin(tk * 7) * 2) : 0; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + side * 6, y - 14); ctx.lineTo(x + side * (7 + sw), y); ctx.stroke(); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x + side * 6 - 1, y - 15, 3, 1); ctx.fillStyle = '#efe8dc'; ctx.fillRect(x - 3, y - (q.age < 13 ? 20 : 27), 6, 1); ctx.fillStyle = '#b84a3a'; ctx.fillRect(x + 1, y - (q.age < 13 ? 20 : 27), 1, 1); }
        else if (q.age >= 68) { const sw = moving ? Math.round(Math.sin(tk * 5 + q.id) * 2) : 0; ctx.strokeStyle = '#5a3d26'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + side * 5, y - 11); ctx.lineTo(x + side * (6 + sw), y); ctx.stroke(); ctx.fillStyle = '#5a3d26'; ctx.fillRect(x + side * 5 - 1, y - 12, 2, 1); } }
    });
    O.Infirm = { hurt, sick };
  }
  O.InfirmSetup = { setup };
})();
