// Blows you can see. When you swing, the weapon leaves a quick bright arc in the air in front of you;
// when a blow lands on someone, there's a burst of sparks (steel) or a puff of dust (a fist or a stave)
// and they rock back.
'use strict';
(function () {
  function setup(game) {
    const arcs = [], bursts = []; let wasSwing = false;
    const _hurt = O.Combat && O.Combat.hurt;
    game.hooks.update.push((dt) => {
      const P = game.player; if (P.swinging && !wasSwing) { const dv = O.Char.DIRV ? (O.Char.DIRV[P.dir] || [0, 1]) : [0, 1]; arcs.push({ x: P.x + dv[0] * 10, y: P.y - 14 + dv[1] * 6, a: Math.atan2(dv[1], dv[0]), t: 0 }); }
      wasSwing = !!P.swinging;
      for (const a of arcs.slice()) { a.t += dt; if (a.t > 0.18) arcs.splice(arcs.indexOf(a), 1); }
      for (const b of bursts.slice()) { b.t += dt; for (const p of b.ps) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; } if (b.t > 0.4) bursts.splice(bursts.indexOf(b), 1); }
    });
    // a hit: sparks where it landed (whoever's health just dropped, near you)
    const hpSeen = new WeakMap();
    game.hooks.update.push(() => { const s = O.SimRef.cur; if (!s || game.scene) return; const P = game.player; const steel = O.Combat && O.Combat.weapon && O.Combat.weapon() && O.Combat.weapon().key !== 'fists';
      for (const q of s.people) { if (!q.agent || q.agent.hidden || !q.health || Math.abs(q.agent.x - P.x) > 140 || Math.abs(q.agent.y - P.y) > 100) continue; const hp = q.health.hp, was = hpSeen.get(q); hpSeen.set(q, hp); if (was != null && hp < was - 0.5) bursts.push({ t: 0, ps: Array.from({ length: steel ? 8 : 5 }, () => ({ x: q.agent.x, y: q.agent.y - 16, vx: (Math.random() - 0.5) * 80, vy: -30 - Math.random() * 50, c: steel ? (Math.random() < 0.5 ? '#fff0a0' : '#ffb040') : '#c8b090' })) }); } });
    void _hurt;
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return;
      for (const a of arcs) { const k = a.t / 0.18; ctx.globalAlpha = 0.8 * (1 - k); ctx.strokeStyle = '#f4f4f8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Math.round(a.x - cam.x), Math.round(a.y - cam.y), 10 + k * 3, a.a - 1.2 + k * 1.4, a.a + 0.2 + k * 1.4); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (const b of bursts) for (const p of b.ps) { ctx.globalAlpha = Math.max(0, 1 - b.t / 0.4); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 1, 1); }
      ctx.globalAlpha = 1;
    });
  }
  O.SlashSetup = { setup };
})();
