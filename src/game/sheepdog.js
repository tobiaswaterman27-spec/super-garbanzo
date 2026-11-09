// The sheepdog at work. Out where the sheep graze, the shepherd stands at the edge of the field leaning on
// the crook and whistles, and the dog goes: out wide round the flock in a great running arc, low to the
// ground, then in; the sheep bunch and turn away from it and drift together; "Come by!" and it swings
// one way, "Away to me!" and the other, "Lie down!" and it drops flat in the grass, eyes on them. Then a
// last whistle, and it trots back to lie at the shepherd's feet.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let D = null, cool = 30, runs = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (D) { D.t += dt; if (D.s !== s || D.t > 50) { D = null; return; } const dg = D.dog, sh = D.sheep.filter((f) => !f.dead);
        const cx = sh.reduce((a, f) => a + f.x, 0) / (sh.length || 1), cy = sh.reduce((a, f) => a + f.y, 0) / (sh.length || 1);
        // the commands, in turn
        if (D.t > D.next) { D.next = D.t + 6 + Math.random() * 4; D.cmd = D.t > 34 ? 'home' : pick(['come', 'away', 'away', 'come', 'down']); if (near(D.man.x, D.man.y, 340)) { O.Speech && O.Speech.say(D.man, { come: 'Come by! Come by!', away: 'Away to me! Away!', down: 'Lie down! ... Steady.', home: 'That\'ll do. That\'ll do, Fly.' }[D.cmd], 2.2); O.sfx && O.sfx('pipe', 0.08); } }
        if (D.cmd === 'come' || D.cmd === 'away') { D.ang += (D.cmd === 'come' ? 1 : -1) * dt * 1.4; const r = 34 + Math.sin(D.t * 0.7) * 10, tx = cx + Math.cos(D.ang) * r, ty = cy + Math.sin(D.ang) * r * 0.7; const dx = tx - dg.x, dy = ty - dg.y, d = Math.hypot(dx, dy); const v = Math.min(d, 95 * dt); if (d > 0.5) { dg.x += dx / d * v; dg.y += dy / d * v; dg.dir = dx > 0 ? 2 : 1; } dg.anim = 'gallop'; }
        else if (D.cmd === 'down') dg.anim = 'idle';
        else { const dx = D.man.x + 10 - dg.x, dy = D.man.y + 4 - dg.y, d = Math.hypot(dx, dy); if (d > 2) { const v = Math.min(d, 70 * dt); dg.x += dx / d * v; dg.y += dy / d * v; dg.dir = dx > 0 ? 2 : 1; dg.anim = 'walk'; } else { dg.anim = 'idle'; if (D.t > 46) { runs++; D = null; return; } } }
        dg.ft += dt;
        // the sheep shy away from the dog and bunch together
        for (const f of sh) { const dx = f.x - dg.x, dy = f.y - dg.y, d = Math.hypot(dx, dy); if (d < 30 && d > 0.1 && D.cmd !== 'home') { f.x += dx / d * 40 * dt; f.y += dy / d * 28 * dt; f.moving = true; f.dir = dx > 0 ? 2 : 1; f.tx = null; } const gx = cx - f.x, gy = cy - f.y, g = Math.hypot(gx, gy); if (g > 14 && D.cmd !== 'home') { f.x += gx / g * 8 * dt; f.y += gy / g * 6 * dt; } }
        if (Math.random() < dt * 0.4 && near(cx, cy, 300)) O.animalCall && O.animalCall('sheep', 0.15);
        return; }
      cool -= dt; if (cool > 0) return; cool = 120 + Math.random() * 120; if (hr < 8 || hr > 17) return; const W = s.weather; if (W && W.raining) return;
      const id = s.world.placeId, all = (O.fauna || []).filter((f) => f.world === id && f.kind === 'sheep' && !f.dead && !f.wild && near(f.x, f.y, 380)); if (all.length < 3) return;
      const z = all[0].z, sheep = all.filter((f) => f.z === z); if (sheep.length < 3) return;
      const cx = sheep.reduce((a, f) => a + f.x, 0) / sheep.length, cy = sheep.reduce((a, f) => a + f.y, 0) / sheep.length;
      // the shepherd stands at the edge, a little way off
      let mx = cx + 70, my = cy + 10; for (const [ox, oy] of [[70, 10], [-70, 10], [0, 60], [0, -60]]) if (!game.solidAt(cx + ox, cy + oy - 2)) { mx = cx + ox; my = cy + oy; break; }
      const R = O.RNG(O.hash('shep', id)); const app = O.Char.makeAppearance(O.hash('shepherd', id), { sex: 'm', age: 40 + Math.floor(R.next() * 25), genes: O.Char.randomGenes(R, 'north'), role: 'shepherd', wealth: 0.25 });
      D = { s, sheep, man: { x: mx, y: my, app, agent: { x: mx, y: my, hidden: false, inside: null }, first: 'the shepherd' }, dog: { x: mx + 10, y: my + 4, dir: 1, ft: 0, anim: 'idle', seed: O.hash('fly', id) % 9999 }, t: 0, next: 1, ang: Math.atan2(my - cy, mx - cx), cmd: 'down' };
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (!D || game.scene || D.s !== cur()) return; const m = D.man, x = Math.round(m.x - cam.x), y = Math.round(m.y - cam.y); m.agent.x = m.x; m.agent.y = m.y;
      try { const fr = O.Char.frame(m.app, m.x > D.dog.x ? 1 : 2, D.cmd === 'home' || D.cmd === 'down' ? 'idle' : 'point', 0); ctx.drawImage(fr, x - 16, y - O.Char.GROUND); } catch (e) { /* */ }
      ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 6, y - 30); ctx.arc(x + 4, y - 30, 2, 0, Math.PI, true); ctx.stroke();
      const dg = D.dog; try { const HA = O.Animals.HANIMS[dg.anim] || O.Animals.HANIMS.idle; const fr = O.Animals.animal('dog', dg.seed, dg.dir, dg.anim !== 'idle', Math.floor(dg.ft * HA.fps) % HA.frames, dg.anim); ctx.drawImage(fr, Math.round(dg.x - cam.x - (fr.ox ?? fr.width / 2)), Math.round(dg.y - cam.y - (fr.gy ?? fr.height))); } catch (e) { /* */ } });
    O.Sheepdog = { get run() { return D; }, get runs() { return runs; }, soon: () => { cool = 0; } };
  }
  O.SheepdogSetup = { setup };
})();
