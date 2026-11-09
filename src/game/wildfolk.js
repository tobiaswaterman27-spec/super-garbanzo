// The country between the towns has people in it. In the woods: a woodcutter felling and logs stacked,
// a charcoal-burner minding his smoking mound, a woman gathering mushrooms in her apron. In the open: a
// shepherd sitting with his crook while his flock grazes and his dog lies watching, mowers in a line
// swinging their scythes in summer, gleaners bent over the stubble in autumn. On the roads: a pair of
// travellers with packs and staffs going from one town to the next.
'use strict';
(function () {
  const T = 16, C = 13;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const H = (a, b, c) => (O.hash('wf', a, b, c) % 1000) / 1000;
    let cache = null;
    const mk = (role, a, b, i) => O.Char.makeAppearance(O.hash('wfolk', role, a, b, i), { sex: role === 'gatherer' || role === 'gleaner' ? 'f' : 'm', age: 20 + Math.floor(H(a, b, i) * 40), genes: O.Char.randomGenes(O.RNG(O.hash('wg', a, b, i)), 'north'), role: 'farmer', wealth: 0.25 });
    function scenes(s) {
      const w = s.world; if (!w.ter || !w.TER) return []; const P = game.player, cx = Math.floor(P.x / T / C), cy = Math.floor(P.y / T / C), key = (w.placeId || 'x') + cx + ':' + cy + s.season;
      if (cache && cache.key === key) return cache.list; const list = [];
      const inTown = (tx, ty) => w.ox != null && tx > w.ox - 6 && tx < w.ox + w.townW + 6 && ty > w.oy - 6 && ty < w.oy + w.townH + 6;
      for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 2; gx <= cx + 2; gx++) {
        let tx = gx * C + 9, ty = gy * C + 9; for (const [ox, oy] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4], [4, 4]]) { const ax = tx + ox, ay = ty + oy; if (ax > 2 && ay > 2 && ax < w.W - 3 && ay < w.H - 3 && w.ter[ay * w.W + ax] === w.TER.FIELD) { tx = ax; ty = ay; break; } } if (tx < 3 || ty < 3 || tx >= w.W - 3 || ty >= w.H - 3 || w.solid[ty * w.W + tx]) continue; const t = w.ter[ty * w.W + tx], r = H(gx, gy, 1); if (r > 0.7 || (inTown(tx, ty) && t !== w.TER.FIELD)) continue;
        const x = tx * T + 8, y = ty * T + 12, sc = { x, y, t: H(gx, gy, 2) * 10, men: [], gx, gy };
        if (t === w.TER.FOREST) { sc.kind = r < 0.3 ? 'woodcut' : r < 0.38 ? 'charcoal' : 'gather'; sc.men.push({ app: mk(sc.kind === 'gather' ? 'gatherer' : 'wood', gx, gy, 0), x, y, dir: 2, ft: 0 }); }
        else if (t === w.TER.GRASS) { if (s.season === 'summer' && r < 0.15) { sc.kind = 'mow'; for (let i = 0; i < 3; i++) sc.men.push({ app: mk('mower', gx, gy, i), x: x + i * 14, y: y + i * 4, dir: 1, ft: i * 0.3 }); } else if (s.season === 'autumn' && r < 0.15) { sc.kind = 'glean'; for (let i = 0; i < 3; i++) sc.men.push({ app: mk('gleaner', gx, gy, i), x: x + i * 20, y: y + (i % 2) * 10, dir: 1, ft: i }); } else if (s.season !== 'winter' && r > 0.6) { sc.kind = 'hawk'; sc.men.push({ app: O.Char.makeAppearance(O.hash('falconer', gx, gy), { sex: 'm', age: 30 + Math.floor(H(gx, gy, 9) * 25), genes: O.Char.randomGenes(O.RNG(O.hash('fg', gx, gy)), 'north'), role: 'knight', wealth: 0.9 }), x, y, dir: 2, ft: 0 }); sc.hawk = { st: 'fist', t: 4 + H(gx, gy, 3) * 6, x: x + 7, y: y - 22, z: 0, ang: 0 }; } else if (r < 0.45) { sc.kind = 'shepherd'; sc.men.push({ app: mk('shepherd', gx, gy, 0), x, y, dir: 0, ft: 0 }); sc.sheep = Array.from({ length: 6 }, (_, i) => ({ x: x + (H(gx, i, 3) - 0.5) * 90, y: y + (H(i, gy, 4) - 0.5) * 50, seed: 600 + i + gx, dir: 1, ft: i, moving: false })); sc.dog = { x: x + 14, y: y + 6, seed: 50 + gx }; } else continue; }
        else if (t === w.TER.FIELD) { if (r > 0.45) continue; sc.kind = s.season === 'spring' ? 'plough' : s.season === 'autumn' ? 'reap' : s.season === 'summer' ? 'weed' : null; if (!sc.kind) continue; const n = sc.kind === 'plough' ? 1 : 3; for (let i = 0; i < n; i++) sc.men.push({ app: mk('field', gx, gy, i), x: x + i * 16, y: y + i * 3, dir: 1, ft: i * 0.5 }); if (sc.kind === 'plough') sc.ox = { seed: 300 + gx, coat: 0, x: x - 22, y, ft: 0 }; sc.x0 = x; }
        else if (t === w.TER.ROAD) { sc.kind = 'way'; for (let i = 0; i < 2; i++) sc.men.push({ app: mk('way', gx, gy, i), x: x + i * 10, y, dir: 2, ft: i * 0.4 }); sc.dirx = H(gx, gy, 5) < 0.5 ? 1 : -1; }
        else continue;
        list.push(sc);
      }
      cache = { key, list }; return list;
    }
    const smoke = [];
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const day = !(game.isNight && game.isNight()); const L = scenes(s); const w = s.world;
      for (const p of smoke.slice()) { p.t += dt; p.x += 5 * dt; p.y -= 10 * dt; if (p.t > 5) smoke.splice(smoke.indexOf(p), 1); }
      if (!day) return;
      for (const sc of L) { sc.t += dt; for (const m of sc.men) m.ft += dt;
        if (sc.kind === 'charcoal' && Math.random() < dt * 3) smoke.push({ x: sc.x + 24 + (Math.random() - 0.5) * 10, y: sc.y - 8, t: 0 });
        if (sc.kind === 'mow') for (const m of sc.men) { m.x -= 3 * dt; }
        if (sc.kind === 'plough' || sc.kind === 'reap') { const v = sc.kind === 'plough' ? 9 : 2; for (const m of sc.men) { m.x -= v * dt; if (m.x < sc.x0 - 90) m.x = sc.x0 + 40; } if (sc.ox) { sc.ox.x = sc.men[0].x - 24; sc.ox.ft += dt; } }
        if (sc.kind === 'glean') for (const m of sc.men) { if (Math.random() < dt * 0.2) m.x += (Math.random() - 0.5) * 10; }
        if (sc.kind === 'way') { for (const m of sc.men) { const nx = m.x + sc.dirx * 20 * dt, tx = Math.floor(nx / T), ty = Math.floor(m.y / T); if (w.ter[ty * w.W + tx] === w.TER.ROAD && !w.solid[ty * w.W + tx]) m.x = nx; else sc.dirx = -sc.dirx; m.dir = sc.dirx > 0 ? 2 : 1; } }
        if (sc.hawk) { const hk = sc.hawk, m = sc.men[0]; hk.t -= dt; const fx = m.x + 7, fy = m.y - 22;
          if (hk.st === 'fist') { hk.x = fx; hk.y = fy; hk.z = 0; if (hk.t <= 0) { hk.st = 'up'; hk.t = 0; hk.ang = 0; } }
          else if (hk.st === 'up') { hk.t += 2 * dt; hk.ang += dt * 1.6; hk.z = Math.min(70, hk.z + 30 * dt); hk.x = sc.x + Math.cos(hk.ang) * 60; hk.y = sc.y - 30 + Math.sin(hk.ang) * 26; if (hk.t > 7) { hk.st = 'stoop'; hk.tx = sc.x + (H(sc.gx, sc.gy, Math.floor(hk.ang)) - 0.5) * 120; hk.ty = sc.y + 10; } }
          else if (hk.st === 'stoop') { const dx = hk.tx - hk.x, dy = hk.ty - hk.y, dd = Math.hypot(dx, dy); hk.z = Math.max(0, hk.z - 90 * dt); if (dd < 3 && hk.z <= 0) { hk.st = 'kill'; hk.t = 3; } else if (dd > 0) { hk.x += dx / dd * Math.min(dd, 140 * dt); hk.y += dy / dd * Math.min(dd, 140 * dt); } }
          else if (hk.st === 'kill') { if (hk.t <= 0) hk.st = 'back'; }
          else if (hk.st === 'back') { const dx = fx - hk.x, dy = fy - hk.y, dd = Math.hypot(dx, dy); hk.z = Math.min(12, hk.z + 20 * dt); if (dd < 3) { hk.st = 'fist'; hk.t = 10 + Math.random() * 8; } else { hk.x += dx / dd * Math.min(dd, 80 * dt); hk.y += dy / dd * Math.min(dd, 80 * dt); } } }
        if (sc.sheep) for (const sh of sc.sheep) { sh.ft += dt; if (!sh.moving && Math.random() < dt * 0.15) { sh.tx = sc.x + (Math.random() - 0.5) * 90; sh.ty = sc.y + (Math.random() - 0.5) * 50; sh.moving = true; } if (sh.moving) { const dx = sh.tx - sh.x, dy = sh.ty - sh.y, d = Math.hypot(dx, dy); if (d < 2) sh.moving = false; else { sh.x += dx / d * 8 * dt; sh.y += dy / d * 8 * dt; sh.dir = dx > 0 ? 2 : 1; } } }
      }
    });
    const ANIM = { hawk: 'idle', plough: 'walk', reap: 'hoe', weed: 'hoe', woodcut: 'chop', charcoal: 'pitch', gather: 'crouch', mow: 'saw', glean: 'pickup', shepherd: 'sit', way: 'walk' };
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene || !cache) return; if (game.isNight && game.isNight()) return; const W = ctx.canvas.width, Hh = ctx.canvas.height, tk = performance.now() / 1000;
      for (const p of smoke) { ctx.globalAlpha = 0.4 * (1 - p.t / 5); ctx.fillStyle = '#6a6a70'; const r = 1 + Math.floor(p.t * 1.5); ctx.fillRect(Math.round(p.x - cam.x) - r, Math.round(p.y - cam.y) - r, r * 2, r * 2); } ctx.globalAlpha = 1;
      for (const sc of cache.list) { const x = Math.round(sc.x - cam.x), y = Math.round(sc.y - cam.y); if (x < -80 || y < -80 || x > W + 80 || y > Hh + 80) continue;
        if (sc.kind === 'woodcut') { for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#7a5232' : '#8a6239'; ctx.fillRect(x + 14 + (i % 2) * 7, y - 4 - Math.floor(i / 2) * 4, 7, 4); ctx.fillStyle = '#c8a070'; ctx.fillRect(x + 14 + (i % 2) * 7, y - 4 - Math.floor(i / 2) * 4, 1, 4); } }
        if (sc.kind === 'charcoal') { ctx.fillStyle = '#3a2e26'; ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.quadraticCurveTo(x + 24, y - 20, x + 38, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = Math.floor(tk * 5) % 2 ? '#ff8a20' : '#c85a10'; ctx.fillRect(x + 22, y - 4, 3, 2); }
        if (sc.kind === 'gather') { ctx.fillStyle = '#d8c8a8'; for (let i = 0; i < 5; i++) ctx.fillRect(x + 8 + i * 6, y + 2 + (i % 2) * 3, 2, 2); }
        if (sc.kind === 'plough' && sc.ox) { ctx.fillStyle = 'rgba(70,46,30,0.6)'; ctx.fillRect(Math.round(sc.ox.x + 24 - cam.x), y + 1, Math.max(0, Math.round(sc.x0 + 40 - sc.ox.x - 24)), 2); try { const A = O.Animals.HANIMS.walk, fr = O.Animals.animal('cow', sc.ox.seed, 1, true, Math.floor(sc.ox.ft * A.fps) % A.frames, 'walk'); ctx.drawImage(fr, Math.round(sc.ox.x - (fr.ox ?? fr.width / 2) - cam.x), Math.round(sc.ox.y - (fr.gy ?? fr.height) - cam.y)); } catch (e) { /* */ } ctx.strokeStyle = '#5a3d26'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(sc.ox.x + 10 - cam.x), y - 8); ctx.lineTo(Math.round(sc.men[0].x - 4 - cam.x), y - 10); ctx.lineTo(Math.round(sc.men[0].x - 8 - cam.x), y + 1); ctx.stroke(); }
        if (sc.kind === 'reap') for (let i = 0; i < 4; i++) { const sx = Math.round(sc.x0 + 20 + i * 18 - cam.x), sy = y + (i % 2) * 6; ctx.fillStyle = '#d8b850'; ctx.fillRect(sx - 2, sy - 9, 5, 9); ctx.fillStyle = '#b89838'; ctx.fillRect(sx - 3, sy - 5, 7, 1); }
        if (sc.sheep) for (const sh of sc.sheep) { try { const an = sh.moving ? 'walk' : 'graze', A = O.Animals.HANIMS[an], fr = O.Animals.animal('sheep', sh.seed, sh.dir, sh.moving, Math.floor(sh.ft * A.fps) % A.frames, an); ctx.drawImage(fr, Math.round(sh.x - (fr.ox ?? fr.width / 2) - cam.x), Math.round(sh.y - (fr.gy ?? fr.height) - cam.y)); } catch (e) { /* */ } }
        if (sc.hawk) { const hk = sc.hawk, hx = Math.round(hk.x - cam.x), hy = Math.round(hk.y - hk.z - cam.y); if (hk.st !== 'fist') { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(Math.round(hk.x - cam.x) - 2, Math.round(hk.y - cam.y) + 1, 5, 1); }
          if (hk.st === 'fist' || hk.st === 'kill') { ctx.fillStyle = '#6a4a30'; ctx.fillRect(hx - 1, hy - 4, 3, 4); ctx.fillStyle = '#8a6a44'; ctx.fillRect(hx, hy - 6, 2, 2); ctx.fillStyle = '#e0b030'; ctx.fillRect(hx + 2, hy - 5, 1, 1); if (hk.st === 'kill') { ctx.fillStyle = '#8a7a6a'; ctx.fillRect(hx - 3, hy, 4, 2); } }
          else { const f = Math.floor(tk * (hk.st === 'stoop' ? 2 : 7)) % 2; ctx.fillStyle = '#6a4a30'; ctx.fillRect(hx - 1, hy, 3, 2); ctx.fillStyle = '#5a3a24'; ctx.fillRect(hx - 5, hy - (f ? 2 : 0), 4, 1); ctx.fillRect(hx + 2, hy - (f ? 2 : 0), 4, 1); } }
        if (sc.dog) { try { const A = O.Animals.HANIMS.idle, fr = O.Animals.animal('dog', sc.dog.seed, 1, false, Math.floor(tk * A.fps) % A.frames, 'idle'); ctx.drawImage(fr, Math.round(sc.dog.x - (fr.ox ?? fr.width / 2) - cam.x), Math.round(sc.dog.y - (fr.gy ?? fr.height) - cam.y)); } catch (e) { /* */ } }
        for (const m of sc.men) { const mx = Math.round(m.x - cam.x), my = Math.round(m.y - cam.y); try { const an = ANIM[sc.kind], A = O.Char.ANIMS[an] || O.Char.ANIMS.idle, fr = O.Char.frame(m.app, m.dir, an, Math.floor(m.ft * A.fps) % A.frames); ctx.drawImage(fr, mx - 16, my - O.Char.GROUND); } catch (e) { /* */ }
          if (sc.kind === 'shepherd') { ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx + 6, my); ctx.lineTo(mx + 7, my - 26); ctx.arc(mx + 9, my - 26, 2, Math.PI, 0); ctx.stroke(); }
          if (sc.kind === 'mow') { const a = Math.sin(m.ft * 4) * 0.7; ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx, my - 14); ctx.lineTo(mx - 10 * Math.cos(a), my - 2); ctx.stroke(); ctx.strokeStyle = '#c8ccd4'; ctx.beginPath(); ctx.moveTo(mx - 10 * Math.cos(a), my - 2); ctx.lineTo(mx - 10 * Math.cos(a) - 8, my); ctx.stroke(); }
          if (sc.kind === 'way') { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(mx + (m.dir === 2 ? -9 : 3), my - 24, 6, 8); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(mx + (m.dir === 2 ? 6 : -7), my - 28, 1, 28); } } }
    });
    O.WildFolk = { scenes: () => scenes(cur()) };
  }
  O.WildFolkSetup = { setup };
})();
