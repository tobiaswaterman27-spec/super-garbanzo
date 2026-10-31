// Out of doors, by day and by night. With a bow and a sheaf of arrows you can shoot game and beasts at a
// distance, and the arrow flies; you get better with practice, and sometimes you get the arrow back.
// A campfire throws light and flickers. On summer nights fireflies drift over the grass, bats flit at
// dusk, and owls call from the woods. When snow lies deep the children build snowmen, and so can you.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const hour = () => game.clock.minute / 60;

    // ---------------------------------------------------------------- the bow
    const flying = []; // { x0, y0, x1, y1, t, dur, then }
    const targetsNear = () => {
      const P = game.player; if (game.scene || !O.Combat || !O.Combat.targets) return [];
      return O.Combat.targets().map((t) => { const f = (O.fauna || []).find((z) => Math.abs(z.x - t.x) < 1 && Math.abs(z.y - t.y) < 1); return f ? { t, f, d: Math.hypot(t.x - P.x, t.y - P.y) } : null; }).filter((z) => z && z.d > 28 && z.d < 240).sort((a, b) => a.d - b.d);
    };
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      if (!PS.items.includes('bow') || !PS.items.includes('arrows') || game.player.locked) return null;
      const n = targetsNear()[0]; if (!n) return null;
      return { type: 'custom', d: 2, x: n.f.x, y: n.f.y - 26, label: `Loose an arrow at the ${n.f.kind}`, act: () => shoot(n) };
    });
    function shoot(n) {
      const P = game.player, sk = (PS.skills.archery = PS.skills.archery || 0.1);
      PS.remove('arrows', 1); const dx = n.f.x - P.x, dy = n.f.y - P.y;
      P.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
      P.anim = 'point'; setTimeout(() => { if (P.anim === 'point') P.anim = 'idle'; }, 700);
      const hit = Math.random() < O.clamp(0.4 + sk * 0.5 - n.d / 900 + (n.f.kind === 'bear' ? 0.15 : 0), 0.1, 0.95);
      const miss = hit ? [0, 0] : [(Math.random() - 0.5) * 50, (Math.random() - 0.5) * 30];
      O.Sound && O.Sound.play('thud', 0.3);
      flying.push({ x0: P.x, y0: P.y - 20, x1: n.f.x + miss[0], y1: n.f.y - 8 + miss[1], t: 0, dur: 0.12 + n.d / 900, then: () => {
        PS.skills.archery = Math.min(1, sk + (hit ? 0.015 : 0.008));
        const s = cur();
        if (hit) { n.t.hit(30, true, { name: 'arrow', key: 'bow' }); if (n.f.fierce && !n.f.dead) n.t.hit(30, true, { name: 'arrow', key: 'bow' }); }
        else say(pick(['Wide. The arrow buries itself in the grass.', 'A miss, by a hand.', 'The arrow whispers past.']));
        if (s && Math.random() < 0.5) s.drop('arrows', 1, n.f.x + miss[0], n.f.y + miss[1]);
      } });
    }
    game.hooks.update.push((dt) => { for (let i = flying.length - 1; i >= 0; i--) { const a = flying[i]; a.t += dt; if (a.t >= a.dur) { flying.splice(i, 1); try { a.then(); } catch (e) { console.error(e); } } } });
    game.hooks.drawWorld.push((ctx, cam) => {
      for (const a of flying) {
        const k = a.t / a.dur, x = a.x0 + (a.x1 - a.x0) * k, y = a.y0 + (a.y1 - a.y0) * k - Math.sin(k * Math.PI) * 10;
        const ang = Math.atan2(a.y1 - a.y0, a.x1 - a.x0), ex = Math.cos(ang) * 7, ey = Math.sin(ang) * 7;
        ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(x - ex - cam.x) + 0.5, Math.round(y - ey - cam.y) + 0.5); ctx.lineTo(Math.round(x - cam.x) + 0.5, Math.round(y - cam.y) + 0.5); ctx.stroke();
        ctx.fillStyle = '#e8e4d8'; ctx.fillRect(Math.round(x - ex - cam.x) - 1, Math.round(y - ey - cam.y) - 1, 2, 2); ctx.fillStyle = '#9aa0a8'; ctx.fillRect(Math.round(x - cam.x), Math.round(y - cam.y), 1, 1);
      }
    });
    // the fletcher, the bowyer and the hunter will sell you a bow and arrows in talk
    (O.extraLines = O.extraLines || []).push((s, q) => /fletcher|bowyer|hunter|gamekeeper|forester/.test(q.job?.role || '') ? 'You can sell the player a bow (sell {"item":"bow"}, about ₳18) and arrows (sell {"item":"arrows"}, about ₳1 each), and teach them to draw and loose.' : '');

    // ---------------------------------------------------------------- campfires light the dark
    const fires = () => (game.scene || !game.world.props ? [] : game.world.props.filter((p) => p.campfire || p.kind === 'firepit'));
    (O.extraLights = O.extraLights || []).push((pools, cam) => { for (const p of fires()) pools.push([p.x - cam.x, p.y - 6 - cam.y, 46]); });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; const t = performance.now() / 1000;
      for (const p of fires()) {
        const x = Math.round(p.x - cam.x), y = Math.round(p.y - 6 - cam.y); if (x < -20 || y < -20 || x > game.vw + 20 || y > game.vh + 20) continue;
        const k = Math.floor(t * 8 + p.x) % 3;
        ctx.fillStyle = '#d04a18'; ctx.fillRect(x - 3, y - 3 - k, 7, 5 + k); ctx.fillStyle = '#ffa030'; ctx.fillRect(x - 2, y - 5 - (k % 2), 5, 5); ctx.fillStyle = '#fff2a0'; ctx.fillRect(x - 1, y - 3, 2, 3);
        if (k === 0) { ctx.fillStyle = '#ffb040'; ctx.fillRect(x + ((t * 13) % 6) - 3, y - 9 - ((t * 20) % 8), 1, 1); }
      }
    });

    // ---------------------------------------------------------------- the night: fireflies, bats, owls
    const motes = []; for (let i = 0; i < 26; i++) motes.push({ x: Math.random() * 600, y: Math.random() * 400, p: Math.random() * 6, s: 0.5 + Math.random() });
    const bats = []; for (let i = 0; i < 4; i++) bats.push({ x: Math.random() * 600, y: Math.random() * 200, vx: (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 30), p: Math.random() * 6 });
    const grassAround = () => { const w = game.world, P = game.player; if (!w.ter) return false; const k = Math.floor(P.y / T) * w.W + Math.floor(P.x / T); return w.ter[k] === w.TER.GRASS || w.ter[k] === w.TER.FOREST; };
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      if (indoor || game.scene) return; const s = cur(); if (!s) return; const h = hour(), t = performance.now() / 1000, W = s.weather || {};
      const fair = !s.raining && W.kind !== 'snow' && W.kind !== 'storm';
      // fireflies on a summer night, over grass
      if (fair && s.season === 'summer' && (h > 20.8 || h < 2) && grassAround()) {
        for (const m of motes) {
          const x = ((m.x + Math.sin(t * 0.4 * m.s + m.p) * 30) % game.vw + game.vw) % game.vw, y = ((m.y + Math.cos(t * 0.3 * m.s + m.p) * 20) % game.vh + game.vh) % game.vh;
          const on = Math.sin(t * 2 * m.s + m.p * 3); if (on < 0.2) continue;
          ctx.fillStyle = `rgba(230,255,120,${(on * 0.8).toFixed(2)})`; ctx.fillRect(Math.round(x), Math.round(y), 2, 2); ctx.fillStyle = `rgba(230,255,120,${(on * 0.2).toFixed(2)})`; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 4, 4);
        }
      }
      // bats at dusk, spring to autumn
      if (fair && s.season !== 'winter' && h > 19.4 && h < 21.5) {
        ctx.fillStyle = '#1a1418';
        for (const b of bats) {
          b.x += b.vx / 60; if (b.x < -20) b.x = game.vw + 20; if (b.x > game.vw + 20) b.x = -20;
          const x = Math.round(b.x), y = Math.round(b.y + 20 + Math.sin(t * 3 + b.p) * 18), f = Math.floor(t * 12 + b.p) % 2;
          ctx.fillRect(x - 1, y, 3, 2); if (f) { ctx.fillRect(x - 4, y - 1, 3, 1); ctx.fillRect(x + 2, y - 1, 3, 1); } else { ctx.fillRect(x - 4, y + 1, 3, 1); ctx.fillRect(x + 2, y + 1, 3, 1); }
        }
      }
    });
    let owl = 0;
    game.hooks.update.push((dt) => {
      owl -= dt; if (owl > 0 || game.scene) return; owl = 25 + Math.random() * 30; const h = hour(), w = game.world, P = game.player; if (!(h > 21 || h < 4) || !w.trees) return;
      const tr = w.trees.find((x) => Math.abs(x.x - P.x) < 220 && Math.abs(x.y - P.y) < 160 && Math.hypot(x.x - P.x, x.y - P.y) > 60); if (!tr) return;
      O.Speech && O.Speech.say({ x: tr.x, y: tr.y - 40 }, pick(['Hoo... hoo-hoo.', 'Too-wit.', 'Hoo-hoo.']), 2.4);
    });

    // ---------------------------------------------------------------- snowmen
    let _sm = null;
    const snowmanSprite = () => {
      if (_sm) return _sm; const c = document.createElement('canvas'); c.width = 16; c.height = 24; const x = c.getContext('2d');
      const disc = (cx, cy, r, col) => { x.fillStyle = col; for (let yy = -r; yy <= r; yy++) { const ww = Math.round(Math.sqrt(r * r - yy * yy)); x.fillRect(cx - ww, cy + yy, ww * 2, 1); } };
      disc(8, 18, 6, '#6a7486'); disc(8, 18, 5, '#e6eaf2'); disc(7, 17, 3, '#ffffff'); disc(8, 9, 4, '#6a7486'); disc(8, 9, 3, '#e6eaf2'); x.fillStyle = 'rgba(40,50,70,0.25)'; x.fillRect(3, 23, 10, 1);
      x.fillStyle = '#20202a'; x.fillRect(6, 8, 1, 1); x.fillRect(9, 8, 1, 1); x.fillRect(8, 15, 1, 1); x.fillRect(8, 18, 1, 1); x.fillStyle = '#e08030'; x.fillRect(8, 10, 2, 1);
      x.fillStyle = '#5a3d24'; x.fillRect(2, 13, 3, 1); x.fillRect(11, 13, 3, 1); x.fillStyle = '#9a3a30'; x.fillRect(5, 12, 6, 1);
      return (_sm = { canvas: c, W: 16, H: 24, ox: 8, oy: 23 });
    };
    const snowDeep = () => { const s = cur(); return s && s.weather && s.weather.snowCover > 0.35; };
    const putSnowman = (x, y, by) => { const w = game.world; if (w.props.filter((p) => p.snowman).length > 8) return; w.props.push({ kind: 'snowman', x, y, seed: 1, v: 0, solid: false, snowman: true, by, sprite: snowmanSprite() }); w.dirtyStatics = true; };
    O.moreCandidates.push(() => {
      if (game.scene || !snowDeep() || game.player.locked) return null; const P = game.player, w = game.world;
      if (w.props.some((p) => p.snowman && Math.hypot(p.x - P.x, p.y - P.y) < 40)) return null;
      return { type: 'custom', d: 16, x: P.x, y: P.y - 40, label: 'Build a snowman', act: () => {
        P.anim = 'crouch'; P.locked = true; setTimeout(() => { P.locked = false; P.anim = 'idle'; putSnowman(P.x + 18, P.y + 2, 'player'); PS.mood = Math.min(100, (PS.mood || 50) + 3); say('You roll a body and a head, find two coals and a stick or two. He looks very pleased with himself.'); }, 3000);
      } };
    });
    let sn = 0;
    game.hooks.update.push((dt) => {
      sn -= dt; if (sn > 0) return; sn = 8; const s = cur(), w = game.world; if (!s || !w || !w.props || game.scene) return;
      if (!s.weather || s.weather.snowCover < 0.2) { if (w.props.some((p) => p.snowman)) { w.props = w.props.filter((p) => !p.snowman); w.dirtyStatics = true; } return; }
      if (!snowDeep() || s.hour < 9 || s.hour > 16) return;
      const kids = s.people.filter((q) => q.age >= 5 && q.age < 13 && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 300);
      const k = kids[0]; if (!k || Math.random() > 0.3 || w.props.some((p) => p.snowman && p.by === k.id)) return;
      O.gesture(k, 'crouch', 3); setTimeout(() => { putSnowman(k.agent.x + 14, k.agent.y + 2, k.id); O.gesture(k, 'celebrate', 2); O.Speech && O.Speech.say(k, pick(['Look at him!', 'He needs a nose!', 'Our snowman!']), 2.2); }, 3000);
    });
  }
  O.OutdoorsSetup = { setup };
})();
