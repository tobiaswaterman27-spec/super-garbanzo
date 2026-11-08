// Work leaves its traces in the air. Indoors and out, whoever is at a trade throws off what that trade
// throws off: sparks jump from the smith's hammer, sawdust drifts down under the saw, flour puffs up from
// the kneading, chips fly from the axe, dust rises under the broom, suds from the scrubbing brush, and wisps
// of fluff from the spinning and weaving.
'use strict';
(function () {
  function setup(game) {
    const parts = []; let acc = 0;
    const FX = {
      hammer: (hot) => hot ? { n: 3, c: ['#ffe080', '#ffb040', '#ff8020'], vy: -60, spread: 70, g: 160, life: 0.45, s: 1 } : { n: 1, c: ['#c8a070'], vy: -30, spread: 40, g: 160, life: 0.5, s: 1 },
      saw: () => ({ n: 2, c: ['#e8d0a0', '#d8c090'], vy: 4, spread: 10, g: 30, life: 1.2, s: 1 }),
      knead: () => ({ n: 1, c: ['rgba(250,248,240,0.7)'], vy: -10, spread: 10, g: -4, life: 1.0, s: 2 }),
      mix: () => ({ n: 1, c: ['rgba(250,248,240,0.6)'], vy: -8, spread: 8, g: -4, life: 0.9, s: 2 }),
      chop: () => ({ n: 2, c: ['#c8a070', '#a8804a'], vy: -50, spread: 60, g: 180, life: 0.6, s: 1 }),
      sweep: () => ({ n: 1, c: ['rgba(170,150,120,0.5)'], vy: -6, spread: 20, g: -3, life: 1.0, s: 2, low: true }),
      scrub: () => ({ n: 1, c: ['rgba(240,248,255,0.8)'], vy: -14, spread: 10, g: -6, life: 0.8, s: 1 }),
      weave: () => ({ n: 1, c: ['rgba(240,236,220,0.7)'], vy: -6, spread: 12, g: -2, life: 1.4, s: 1 }),
      spin: () => ({ n: 1, c: ['rgba(240,236,220,0.7)'], vy: -6, spread: 12, g: -2, life: 1.4, s: 1 }),
      shear: () => ({ n: 1, c: ['rgba(240,236,220,0.8)'], vy: -4, spread: 14, g: 10, life: 1.4, s: 2 }),
      dig: () => ({ n: 2, c: ['#6a4a30', '#5a3c26'], vy: -40, spread: 40, g: 180, life: 0.5, s: 1 }),
    };
    const HOT = /smithy|armourer|farrier|blacksmith|forge|foundry/;
    const DV = [[0, 1], [-1, 0], [1, 0], [0, -1]];
    function emit(x, y, dir, f) { const [dx, dy] = DV[dir] || [0, 1]; const ox = x + dx * 9, oy = y - (f.low ? 2 : 10) + dy * 4; for (let i = 0; i < f.n; i++) parts.push({ x: ox + (Math.random() - 0.5) * 4, y: oy, vx: (Math.random() - 0.5) * f.spread + dx * 10, vy: f.vy * (0.6 + Math.random() * 0.6), g: f.g, t: 0, life: f.life * (0.7 + Math.random() * 0.6), c: f.c[Math.floor(Math.random() * f.c.length)], s: f.s }); }
    function tick(dt) { for (const p of parts.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.98; if (p.t > p.life) parts.splice(parts.indexOf(p), 1); } if (parts.length > 300) parts.splice(0, parts.length - 300); }
    function draw(ctx, cam) { for (const p of parts) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), p.s, p.s); } ctx.globalAlpha = 1; }
    game.hooks.update.push((dt) => {
      tick(dt); acc += dt; if (acc < 0.22) return; acc = 0;
      const sc = game.scene;
      if (sc && sc.actors) { const hot = HOT.test(sc.b?.type || ''); for (const a of sc.actors.values()) { if (a.leaving || a.anim === 'walk') continue; const f = FX[a.anim]; if (!f || Math.random() < 0.35) continue; emit(a.x, a.y, a.dir, f(hot)); } return; }
      const s = O.SimRef.cur; if (!s || !s.people) return; const P = game.player;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null) continue; if (Math.abs(a.x - P.x) > 360 || Math.abs(a.y - P.y) > 260) continue; const an = a.frozen ? a.forceAnim : a.anim; const f = FX[an]; if (!f || Math.random() < 0.4) continue; if (an === 'hammer' && /smith|farrier|armourer/.test(q.job?.role || '')) continue; if (an === 'saw' && q._siteRole) continue; emit(a.x, a.y - (a.lift || 0), a.dir, f(false)); }
    });
    game.hooks.drawTop.push((ctx, cam, inScene) => { if (inScene) draw(ctx, cam); });
    game.hooks.drawWorld.push((ctx, cam) => { if (!game.scene) draw(ctx, cam); });
    O.WorkFx = { parts };
  }
  O.WorkFxSetup = { setup };
})();
