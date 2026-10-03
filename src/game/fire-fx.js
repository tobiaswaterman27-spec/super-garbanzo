// Fire made visible: pixel flames licking along the roof and out of the windows, a column of dark
// smoke leaning with the wind, a glow on the ground at night (see the engine's light pools), sparks,
// and the hiss of water. You can take a bucket and join the line.
'use strict';
(function () {
  const FLAME = ['#fff0a0', '#ffd040', '#ff9a20', '#e05a18', '#a8301a'];

  function setup(game, home) {
    const PS = O.PlayerState, smoke = [];
    const cur = () => O.SimRef.cur;
    game.hooks.update.push((dt) => {
      const s = cur(); if (game.scene || game.world !== s.world) return;
      const W = s.weather;
      for (const b of s.world.buildings) {
        if (!b.fire && !(b.ruined && s.day - b.ruined.day < 1)) continue;
        const sp = b.sprite; if (!sp) continue;
        const i = b.fire ? b.fire.i : 0.05, n = b.fire ? Math.round(1 + i * 5 * dt * 30) : (Math.random() < dt * 3 ? 1 : 0); // a ruin only smoulders
        for (let k = 0; k < n; k++) smoke.push({ x: b.x * 16 - sp.OV + sp.W * (0.2 + Math.random() * 0.6), y: (b.bottom + 1) * 16 - sp.H + 10 + Math.random() * 10, vx: (W.wind - 0.2) * 14 + (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 10, life: 2.5 + Math.random() * 2.5 * (0.5 + i), age: 0, r: b.fire ? 2 + Math.random() * 3 * (0.5 + i) : 1.5, dark: b.fire ? 0.55 + Math.random() * 0.3 : 0.2 });
      }
      for (const p of smoke) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 2.2; }
      for (let k = smoke.length - 1; k >= 0; k--) if (smoke[k].age > smoke[k].life) smoke.splice(k, 1);
      if (smoke.length > 600) smoke.splice(0, smoke.length - 600);
    });
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      const s = cur(); if (indoor || game.scene || game.world !== s.world) return;
      const t = game.t;
      // smoke first, flames over it
      for (const p of smoke) {
        const a = Math.max(0, 1 - p.age / p.life) * 0.5, g = Math.round(40 + 40 * (1 - p.dark)), r = Math.round(p.r);
        ctx.fillStyle = `rgba(${g},${g - 6},${g - 4},${a.toFixed(2)})`;
        const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
        for (let yy = -r; yy <= r; yy++) { const w = Math.round(Math.sqrt(r * r - yy * yy)); ctx.fillRect(x - w, y + yy, w * 2, 1); }
      }
      for (const b of s.world.buildings) {
        if (!b.fire || !b.sprite) continue;
        const sp = b.sprite, i = b.fire.i, left = b.x * 16 - sp.OV - cam.x, top = (b.bottom + 1) * 16 - sp.H - cam.y;
        // flames rise from wherever the roof (or wall top) is, more of them as the fire grows
        const cols = Math.max(3, Math.round((sp.W / 3) * Math.min(1, i * 1.4)));
        for (let c = 0; c < cols; c++) {
          const fx = Math.round(sp.W * (0.12 + 0.76 * ((c * 0.618 + 0.13) % 1)));
          let ry = 0; for (let y = 0; y < sp.H; y++) { if (sp.buf && sp.buf.mat[y * sp.W + fx] >= 0) { ry = y; break; } }
          const h = Math.round((6 + 16 * i) * (0.6 + 0.4 * Math.sin(t * 9 + c * 1.7) * Math.sin(t * 4.3 + c)));
          for (let y = 0; y < h; y++) {
            const w = Math.max(1, Math.round((h - y) / 3 * (0.7 + 0.3 * Math.sin(t * 13 + y + c)))), sway = Math.round(Math.sin(t * 6 + y * 0.5 + c) * (y / 6));
            ctx.fillStyle = FLAME[Math.min(4, Math.floor((y / h) * 5))];
            ctx.fillRect(Math.round(left + fx - w / 2 + sway), Math.round(top + ry + 4 - y), w, 1);
          }
        }
        // windows glow and spit flame
        for (const wd of sp.windows || []) if (i > 0.35) { ctx.fillStyle = FLAME[(Math.floor(t * 8) + wd.x) % 3 + 1]; ctx.fillRect(Math.round(left + wd.x + 1), Math.round(top + wd.y + 1), Math.max(1, wd.w - 2), Math.max(1, wd.h - 2)); }
        // sparks
        for (let k = 0; k < 6 * i; k++) { const ph = (t * 0.7 + k * 0.37) % 1; ctx.fillStyle = FLAME[k % 3]; ctx.fillRect(Math.round(left + sp.W * ((k * 0.29 + ph * 0.2) % 1)), Math.round(top - ph * 40), 1, 1); }
      }
    });

    // the bucket line
    O.fireLabel = (c) => `Grab a bucket and fight the fire${c.b.fire.fighters ? ` (${c.b.fire.fighters} at it)` : ''}`;
    O.fightFire = (c) => {
      const s = cur(), b = c.b; if (!b.fire) return;
      if (PS.energy < 8) return O.Panels.toast("You've nothing left to give. Rest, or watch it burn.", 'bad');
      game.player.anim = 'work';
      const before = b.fire.i;
      for (let k = 0; k < 10 && b.fire; k++) { b.fire.player = 4; s.tick(1); PS.tick(1, false); }
      PS.energy = Math.max(0, PS.energy - 5); PS.hunger = Math.max(0, PS.hunger - 2);
      PS.helpedFires = PS.helpedFires || {}; PS.helpedFires[b.id + '@' + s.day] = true;
      PS.rep.local = Math.min(1, PS.rep.local + 0.01); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.005);
      for (const q of s.people) if (q.task?.act === 'firefight' && q.task.b2 === b.id && s.rng.chance(0.2)) s.relate(q, { id: 0 }, 0.05);
      if (!b.fire) O.Panels.toast('The last of the flames hiss out under your bucket. A cheer goes up along the line.');
      else O.Panels.toast(b.fire.i < before ? 'Ten minutes of hauling water. The fire is falling back.' : 'Ten minutes of hauling water, and still it grows. More hands are needed.', b.fire.i < before ? '' : 'bad');
      setTimeout(() => { if (game.player.anim === 'work') game.player.anim = 'idle'; }, 800);
    };
    const prevOut = home.onFireOut;
    const outHook = (sim) => (b, f, lost) => {
      if (prevOut) prevOut(b, f, lost);
      if (PS.helpedFires && PS.helpedFires[b.id + '@' + sim.day] && !lost) O.Chronicle.deed(sim, `A newcomer worked in the bucket line that saved ${b.type === 'house' ? 'a house' : b.name} from fire.`, `You helped put out the fire at ${b.type === 'house' ? 'a house' : b.name}.`, 'disaster', 2, true);
    };
    home.onFireOut = outHook(home);
    home.onFire = (b) => { if (game.world === home.world) { O.Panels.toast(`Fire! Smoke is rising over ${home.world.name}. The alarm bell is ringing.`, 'bad'); O.Sound && O.Sound.play('bell', 5, 0.7); } };
  }

  O.FireFX = { setup };
})();
