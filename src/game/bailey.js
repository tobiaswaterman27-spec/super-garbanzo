// The castle bailey at work. In the yard before the keep, knights and squires practise at the pell (a
// post they hack at with blunt swords), a groom lunges a horse round in a ring at the end of a long rein,
// the falconer walks with a hawk hooded on his fist, and a boy runs messages. They're there by day; at
// night the yard is empty but for the sentries.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let yard = null, seed = 1;
    const mk = (role, i) => O.Char.makeAppearance(O.hash('bailey', role, i, seed), { sex: 'm', age: role === 'squire' || role === 'boy' ? 15 : 28 + i * 5, genes: O.Char.randomGenes(O.RNG(O.hash('bg', role, i)), 'north'), role: role === 'knight' ? 'noble' : role === 'squire' ? 'guard' : 'farmer', wealth: role === 'knight' ? 0.8 : 0.4 });
    function build(s) {
      const keep = s.world.buildings.find((b) => b.type === 'keep' || b.type === 'palace'); if (!keep || keep.doorX == null) return null;
      const ok = (x, y) => !game.solidAt(x - 8, y - 2) && !game.solidAt(x + 8, y - 2) && !game.solidAt(x, y + 6) && !game.solidAt(x, y - 8);
      const find = (dx, dy) => { for (let r = 0; r < 6; r++) for (const sx of [1, -1]) { const x = (keep.doorX + dx + sx * r) * T + 8, y = (keep.doorY + dy) * T + 10; if (ok(x, y) && ok(x + 16, y)) return [x, y]; } return null; };
      const pell = find(-6, 5), ring = find(6, 6), walk = find(0, 7);
      seed++; const Y = { s, keep, pell, ring, walk, t: 0, men: [] };
      if (pell) { Y.men.push({ role: 'knight', app: mk('knight', 0), x: pell[0] - 12, y: pell[1], dir: 2, anim: 'attack', ft: 0, k: 'pell' }); Y.men.push({ role: 'squire', app: mk('squire', 1), x: pell[0] - 22, y: pell[1] + 14, dir: 2, anim: 'idle', ft: 0, k: 'watch' }); }
      if (ring) { Y.men.push({ role: 'groom', app: mk('groom', 2), x: ring[0], y: ring[1], dir: 0, anim: 'point', ft: 0, k: 'groom' }); Y.horse = { seed: 77 + seed, coat: pick(Object.keys(O.Animals.COATS)), blaze: true, socks: false, anim: 'walk', ft: 0 }; }
      if (walk) Y.men.push({ role: 'falconer', app: mk('falconer', 3), x: walk[0], y: walk[1], dir: 2, anim: 'walk', ft: 0, k: 'stroll', x0: walk[0], vx: 1 });
      return Y;
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) { return; } const h = s.minute / 60, day = h >= 7 && h < 19 && !s.raining;
      if (!yard || yard.s !== s) yard = day ? build(s) : null; if (!yard) return; if (!day) { yard = null; return; }
      yard.t += dt; const y = yard;
      for (const m of y.men) { m.ft += dt;
        if (m.k === 'pell') { const c = Math.floor(m.ft * 1.4) % 5; m.anim = c < 3 ? 'attack' : c === 3 ? 'block' : 'idle'; if (c < 3 && Math.random() < dt * 1.5 && Math.hypot(m.x - game.player.x, m.y - game.player.y) < 220) O.sfx && O.sfx('smack', 0.15); }
        else if (m.k === 'watch') { m.anim = Math.floor(m.ft / 4) % 4 === 0 ? 'nod' : 'idle'; if (Math.random() < dt * 0.04 && Math.hypot(m.x - game.player.x, m.y - game.player.y) < 250) O.Speech && O.Speech.say({ agent: m, first: 'Squire' }, pick(['Higher, sir! Your guard!', 'Well struck!', 'Again, sir?']), 1.6); }
        else if (m.k === 'groom') { m.dir = Math.floor((y.t * 0.6) / (Math.PI / 2)) % 4; m.anim = 'point'; }
        else if (m.k === 'stroll') { m.x += m.vx * 14 * dt; if (Math.abs(m.x - m.x0) > 60 || game.solidAt(m.x + m.vx * 8, m.y - 2)) m.vx = -m.vx; m.dir = m.vx > 0 ? 2 : 1; m.anim = 'walk'; } }
      if (y.horse) y.horse.ft += dt;
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const y = yard; if (!y || game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height;
      if (y.pell) { const x = Math.round(y.pell[0] - cam.x), yy = Math.round(y.pell[1] - cam.y); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 2, yy - 22, 5, 22); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 2, yy - 22, 5, 2); ctx.fillStyle = '#5a3d26'; ctx.fillRect(x - 3, yy - 2, 7, 2); }
      if (y.ring && y.horse) { const a = y.t * 0.6, rx = y.ring[0] + Math.cos(a) * 34, ry = y.ring[1] + Math.sin(a) * 18, dir = Math.sin(a) > 0 ? (Math.cos(a) > 0 ? 1 : 1) : 2; const hdir = Math.cos(a + Math.PI / 2) > 0 ? 2 : 1;
        ctx.strokeStyle = 'rgba(120,90,60,0.8)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(Math.round(y.ring[0] - cam.x) + 4, Math.round(y.ring[1] - cam.y) - 12); ctx.lineTo(Math.round(rx - cam.x), Math.round(ry - cam.y) - 18); ctx.stroke();
        try { const HA = O.Animals.HANIMS.walk, fr = O.Animals.horse(y.horse, hdir, 'walk', Math.floor(y.horse.ft * HA.fps) % HA.frames); ctx.drawImage(fr, Math.round(rx - fr.ox - cam.x), Math.round(ry - fr.gy - cam.y)); } catch (e) { /* */ } void dir; }
      for (const m of y.men.slice().sort((a, b) => a.y - b.y)) { if (O.occluded && O.occluded(m.x, m.y)) continue; const x = Math.round(m.x - cam.x), yy = Math.round(m.y - cam.y); if (x < -30 || yy < -60 || x > W + 30 || yy > H + 30) continue; try { const A = O.Char.ANIMS[m.anim] || O.Char.ANIMS.idle; const fr = O.Char.frame(m.app, m.dir, m.anim, Math.floor(m.ft * A.fps) % A.frames); ctx.drawImage(fr, x - 16, yy - O.Char.GROUND); } catch (e) { /* */ }
        if (m.k === 'pell') { ctx.strokeStyle = '#a8b0bc'; ctx.lineWidth = 1; ctx.beginPath(); const sw = m.anim === 'attack'; ctx.moveTo(x + 4, yy - 14); ctx.lineTo(x + (sw ? 16 : 6), yy - (sw ? 18 : 28)); ctx.stroke(); }
        if (m.k === 'stroll') { const hx = x + (m.dir === 1 ? -6 : 6), hy = yy - 16; ctx.fillStyle = '#5a4030'; ctx.fillRect(hx - 2, hy - 4, 4, 4); ctx.fillStyle = '#8a2a20'; ctx.fillRect(hx - 1, hy - 5, 2, 2); ctx.fillStyle = '#c8b070'; ctx.fillRect(hx - 3, hy, 6, 1); } }
    });
    O.Bailey = { get yard() { return yard; } };
  }
  O.BaileySetup = { setup };
})();
