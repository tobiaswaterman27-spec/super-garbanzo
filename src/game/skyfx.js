// The look of the seasons. A rainbow when the sun comes out after rain. Leaves coming down off the oaks
// and birches in autumn, blossom drifting in spring. Butterflies over the grass on fine days, a skein
// of birds going over. And in spring and summer you can pick a posy of wildflowers out in the fields,
// which most people are glad to be given.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS;
    G.flowers = G.flowers || { name: 'Wildflowers', base: 1, unit: 'posy', slots: 1, gift: true };
    const hour = () => game.clock.minute / 60;
    const wet = (k) => ['rain', 'heavy', 'storm', 'hail'].includes(k);

    // ---------------------------------------------------------------- the rainbow
    let lastKind = null, bowFrom = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.weather) return; const k = s.weather.kind, h = hour(), abs = s.day * 1440 + s.minute;
      if (lastKind && wet(lastKind) && !wet(k) && k !== 'fog' && k !== 'snow' && h > 7 && h < 18 && Math.random() < 0.7) bowFrom = abs;
      lastKind = k; if (bowFrom >= 0 && abs - bowFrom > 90) bowFrom = -1;
    });
    const BANDS = ['#e04848', '#f08a30', '#f0d040', '#58b050', '#4880d8', '#5850b0', '#9050b0'];
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      if (indoor || game.scene || bowFrom < 0) return; const s = cur(); if (!s) return;
      const age = (s.day * 1440 + s.minute - bowFrom) / 90, a = Math.sin(Math.min(1, Math.max(0, age)) * Math.PI) * 0.22; if (a <= 0.01) return;
      const cx = game.vw * 0.72, cy = game.vh * 0.55, R = game.vw * 0.42;
      ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = 3;
      BANDS.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, R - i * 3, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); });
      ctx.restore();
    });

    // ---------------------------------------------------------------- leaves and blossom
    const bits = [];
    let bt = 0;
    game.hooks.update.push((dt) => {
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.t += dt; b.x += (b.vx + Math.sin(b.t * 3 + b.p) * 10) * dt; b.y += b.vy * dt; if (b.t > b.life) bits.splice(i, 1); }
      bt -= dt; if (bt > 0 || game.scene) return; bt = 0.25; const s = cur(), w = game.world; if (!s || !w.trees) return;
      const autumn = s.season === 'autumn', spring = s.season === 'spring' && s.weather && s.weather.dayOfSeason < 10; if ((!autumn && !spring) || bits.length > 90) return;
      const cam = game.cam, wind = (s.weather && s.weather.wind) || 0.3;
      const vis = w.trees.filter((t) => t.kind !== 'pine' && t.x > cam.x - 20 && t.x < cam.x + game.vw + 20 && t.y > cam.y && t.y < cam.y + game.vh + 40);
      for (let n = 0; n < (autumn ? 5 : 3) && vis.length; n++) {
        const t = vis[Math.floor(Math.random() * vis.length)];
        const col = autumn ? ['#c8642a', '#d89a30', '#a84a20', '#e0b848', '#8a5a2a'][Math.floor(Math.random() * 5)] : ['#f6d6e2', '#ffffff', '#f0b8cc'][Math.floor(Math.random() * 3)];
        bits.push({ x: t.x + (Math.random() - 0.5) * 22, y: t.y - 34 - Math.random() * 14, vx: 6 + wind * 30, vy: 9 + Math.random() * 7, t: 0, p: Math.random() * 6, life: 2.5 + Math.random() * 2, col });
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return;
      for (const b of bits) { const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y); ctx.globalAlpha = Math.min(1, (b.life - b.t) * 1.5); ctx.fillStyle = b.col; ctx.fillRect(x, y, Math.sin(b.t * 6 + b.p) > 0 ? 3 : 2, 2); }
      ctx.globalAlpha = 1;
    });

    // ---------------------------------------------------------------- butterflies and birds
    const flies = []; for (let i = 0; i < 6; i++) flies.push({ x: Math.random(), y: Math.random(), p: Math.random() * 6, col: ['#f0e8f8', '#f0c040', '#e88040', '#a0c8f0'][i % 4] });
    let flock = null, ft = 20;
    const onGrass = () => { const w = game.world, P = game.player; if (!w.ter) return false; return w.ter[Math.floor(P.y / T) * w.W + Math.floor(P.x / T)] === w.TER.GRASS; };
    game.hooks.update.push((dt) => {
      ft -= dt; const s = cur(); if (!s || game.scene) return; const h = hour();
      if (!flock && ft < 0 && h > 6 && h < 19 && !wet(s.weather?.kind)) { ft = 40 + Math.random() * 60; const dir = Math.random() < 0.5 ? 1 : -1; flock = { x: dir > 0 ? -40 : game.vw + 40, y: 30 + Math.random() * game.vh * 0.4, vx: dir * (50 + Math.random() * 20), n: 3 + Math.floor(Math.random() * 5) }; if (Math.random() < 0.5) O.Sound && O.Sound.play('bird', 0.3); }
      if (flock) { flock.x += flock.vx * dt; if (flock.x < -80 || flock.x > game.vw + 80) flock = null; }
    });
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      if (indoor || game.scene) return; const s = cur(); if (!s) return; const h = hour(), t = performance.now() / 1000;
      if ((s.season === 'spring' || s.season === 'summer') && h > 8 && h < 18 && !wet(s.weather?.kind) && s.weather?.kind !== 'fog' && onGrass()) {
        for (const f of flies) {
          const x = Math.round(((f.x * game.vw + Math.sin(t * 0.7 + f.p) * 60 + t * 6) % game.vw + game.vw) % game.vw), y = Math.round(f.y * game.vh + Math.sin(t * 1.9 + f.p * 2) * 18);
          const up = Math.floor(t * 9 + f.p) % 2; ctx.fillStyle = f.col; if (up) { ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); } else { ctx.fillRect(x - 1, y, 1, 2); ctx.fillRect(x + 1, y, 1, 2); } ctx.fillStyle = '#3a2a20'; ctx.fillRect(x, y, 1, 2);
        }
      }
      if (flock) {
        ctx.fillStyle = '#2a2428';
        for (let i = 0; i < flock.n; i++) { const x = Math.round(flock.x - Math.sign(flock.vx) * (i % 2 ? i : i) * 9), y = Math.round(flock.y + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 6), up = Math.floor(t * 6 + i) % 2; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 2, y - up, 2, 1); ctx.fillRect(x + 1, y - up, 2, 1); }
      }
    });

    // ---------------------------------------------------------------- a posy of wildflowers
    let picked = new Map();
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), w = game.world, P = game.player; if (!s || game.scene || !w.ter || P.locked) return null;
      if (!(s.season === 'spring' || s.season === 'summer') || hour() < 6 || hour() > 20 || !onGrass()) return null;
      if (w.ox != null && Math.max(w.ox - P.x / T, P.x / T - w.ox - w.townW, w.oy - P.y / T, P.y / T - w.oy - w.townH, 0) < 2) return null;
      const key = Math.floor(P.x / 160) + ',' + Math.floor(P.y / 160); if (picked.get(key) === s.day) return null;
      return { type: 'custom', d: 22, x: P.x, y: P.y - 40, label: 'Pick wildflowers', act: () => {
        if (!PS.canCarry('flowers')) return say('No room in the satchel for flowers.');
        picked.set(key, s.day); P.anim = 'pickup'; P.locked = true;
        setTimeout(() => { P.locked = false; P.anim = 'idle'; PS.add('flowers'); say(['Cowslips, cornflowers and a sprig of meadowsweet.', 'A handful of daisies and red campion.', 'Poppies and ox-eye daisies, tied with a grass stalk.'][Math.floor(Math.random() * 3)]); }, 2200);
      } };
    });
    (O.extraLines = O.extraLines || []).push((s, q) => PS.items.includes('flowers') && q.age >= 6 ? 'The player is carrying a posy of wildflowers. If they give it to you, you are touched (more so if you are fond of them or courting).' : '');
  }
  O.SkyFxSetup = { setup };
})();
