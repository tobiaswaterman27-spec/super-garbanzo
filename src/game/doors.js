// Doors that open, and people who walk through them. Nobody blinks out of the street any more:
// when someone goes indoors the door swings open, they step up into the doorway and are swallowed
// by the dark of the room; when they come out the door opens and they step down onto the street.
// The player does the same — pressing E at a door walks you in.
'use strict';
(function () {
  function setup(game) {
    const T = 16;
    const walkers = []; // { a, b, t, dur, mode: 'in'|'out', player, done }
    const doorRect = (b) => { const sp = b.sprite, d = sp && sp.door; if (!d) return null; return { x: b.x * T - sp.OV + d.x, y: (b.bottom + 1) * T - sp.H + d.y, w: d.w, h: d.h }; };
    function openDoor(b, dur = 0.9) { b._doorOpen = Math.max(b._doorOpen || 0, game.t + dur); }
    function walk(a, b, mode, opts = {}) {
      const r = doorRect(b); if (!r) { opts.done && opts.done(); return false; }
      walkers.push({ a, b, t: 0, dur: opts.dur || 0.6, mode, player: !!opts.player, done: opts.done, r });
      openDoor(b, (opts.dur || 0.6) + 0.5);
      return true;
    }
    game.openDoor = openDoor;
    game.walkThroughDoor = walk;

    // the player walks in, then the room loads
    game.walkInto = (b, then) => {
      const p = game.player;
      if (!doorRect(b) || game.scene) return then();
      p.dir = 3; p.walkingDoor = true;
      walk(p.a, b, 'in', { player: true, done: () => { p.walkingDoor = false; then(); } });
    };
    const _exit = game.exitBuilding.bind(game);
    game.exitBuilding = function () {
      const b = this.scene && this.scene.b;
      _exit();
      if (b && b.sprite && b.sprite.door && b.world !== 'elsewhere') {
        const p = this.player; p.walkingDoor = true; p.dir = 0;
        walk(p.a, b, 'out', { player: true, done: () => { p.walkingDoor = false; } });
      }
    };

    // watch villagers go in and out
    game.hooks.update.push((dt) => {
      const sim = O.SimRef.cur;
      if (sim && sim.world === game.world && !game.scene) {
        for (const q of sim.people) {
          const ag = q.agent; if (!ag || q.alive === false) continue;
          const vis = !ag.hidden;
          if (ag._vis === true && !vis && ag.inside != null) {
            const b = sim.building ? sim.building(ag.inside) : null; const r = b && doorRect(b);
            if (r && Math.hypot(ag.x - (r.x + r.w / 2), ag.y - (r.y + r.h)) < 48) walk(q.app, b, 'in');
          } else if (ag._vis === false && vis && ag._lastIn != null) {
            const b = sim.building ? sim.building(ag._lastIn) : null; const r = b && doorRect(b);
            if (r && Math.hypot(ag.x - (r.x + r.w / 2), ag.y - (r.y + r.h)) < 48) { walk(q.app, b, 'out'); ag._suppressUntil = game.t + 0.6; }
          }
          ag._vis = vis; if (ag.inside != null) ag._lastIn = ag.inside;
        }
      }
      for (const w of walkers) { w.t += dt; }
      for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].t >= walkers[i].dur) { const w = walkers[i]; walkers.splice(i, 1); w.done && w.done(); }
      const p = game.player;
      if (p.walkingDoor) {
        p.walkingDoorT = (p.walkingDoorT || 0) + dt;
        if (p.walkingDoorT > 1.6) { p.walkingDoor = false; p.walkingDoorT = 0; p.locked = false; } // never left standing in a doorway
        else { p.locked = true; p._suppressUntil = game.t + 0.05; }
      } else p.walkingDoorT = 0;
    });

    // drawn straight after the building, so the doorway sits in its wall
    game.drawDoor = (ctx, b, cam) => {
      const r = doorRect(b); if (!r) return;
      const open = (b._doorOpen || 0) > game.t;
      if (!open) return;
      const x = r.x - cam.x, y = r.y - cam.y;
      // the dark room beyond, warm if a fire is burning
      const warm = game.lit && game.lit.has(b.id);
      ctx.fillStyle = warm ? '#3a2416' : '#1c1614'; ctx.fillRect(x, y, r.w, r.h);
      ctx.fillStyle = warm ? '#5a3a1e' : '#2a2220'; ctx.fillRect(x, y + r.h - 3, r.w, 3);
      // the door leaf, swung inward against the hinge side
      ctx.fillStyle = '#6e4a2c'; ctx.fillRect(x, y, 4, r.h);
      ctx.fillStyle = '#8a6239'; ctx.fillRect(x, y, 1, r.h);
      ctx.fillStyle = '#4a3020'; ctx.fillRect(x + 3, y, 1, r.h);
      // whoever is passing through
      for (const w of walkers) {
        if (w.b !== b) continue;
        const u = Math.min(1, w.t / w.dur), base = r.y + r.h;
        const fy = w.mode === 'in' ? base + 6 - u * 13 : base - 7 + u * 15;
        const dir = w.mode === 'in' ? 3 : 0;
        const fr = O.Char.frame(w.a, dir, 'walk', Math.floor(w.t * 11) % 8);
        const fx = Math.round(r.x + r.w / 2 - 16 - cam.x), fyy = Math.round(fy - O.Char.GROUND - cam.y);
        ctx.save();
        if (fy < base) { ctx.beginPath(); ctx.rect(x, y, r.w, 400); ctx.clip(); }
        ctx.drawImage(fr, fx, fyy);
        // the gloom of the room falls over them as they go in
        const dark = O.clamp((base - fy) / 10, 0, 0.6);
        if (dark > 0) { ctx.globalAlpha = dark; ctx.fillStyle = '#140e0c'; ctx.fillRect(x, y, r.w, r.h); ctx.globalAlpha = 1; }
        ctx.restore();
      }
    };
  }
  O.Doors = { setup };
})();
