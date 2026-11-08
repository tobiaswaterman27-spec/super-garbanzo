// The lord's hunt. On a fine morning, now and then, the gentleman of the place rides out to hunt: his
// huntsman on foot ahead with the horn, three hounds casting about and giving tongue, out along the
// road to the woods; in the afternoon they come back the same way, the hounds tired, a deer slung over
// a pony led behind. Folk stop to watch them pass and touch their caps; boys run alongside.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let hunt = null, doneDay = -1;
    const app = (role, i) => O.Char.makeAppearance(O.hash('hunt', role, i), { sex: 'm', age: role === 'lord' ? 40 : 30, genes: O.Char.randomGenes(O.RNG(O.hash('hg', role, i)), 'north'), role: role === 'lord' ? 'noble' : 'farmer', wealth: role === 'lord' ? 0.9 : 0.4 });
    function route(s, a, b) { const p = s.path.find(a[0], a[1], b[0], b[1]); return p ? p.map(([x, y]) => [x * T + 8, y * T + 10]) : null; }
    function begin(s, back) {
      const wood = O.Hunters && O.Hunters.woodEdge(); if (!wood) return null; const E = s.Z.square ? [Math.floor((s.Z.square[0] + s.Z.square[2]) / 2), s.Z.square[3] + 1] : s.Z.east;
      const path = back ? route(s, wood, E) : route(s, E, wood); if (!path || path.length < 8) return null;
      const lord = s.people.find((q) => q.gentry && q.age >= 20 && q.age <= 60 && q.alive !== false && !q.visitor);
      return { s, back, path, pi: 0, lead: path[0].slice(), trail: [path[0].slice()], t: 0, lordQ: lord || null, lordApp: lord ? lord.app : app('lord', s.day), hunts: app('huntsman', s.day), horse: { seed: 900 + s.day, coat: pick(Object.keys(O.Animals.COATS)), blaze: true, socks: true, anim: 'walk', ft: 0 }, pony: back ? { seed: 400 + s.day, coat: 'dun' in O.Animals.COATS ? 'dun' : Object.keys(O.Animals.COATS)[0], blaze: false, socks: false, anim: 'walk', ft: 0 } : null, hounds: [0, 1, 2].map((i) => ({ seed: 70 + i * 13, x: path[0][0], y: path[0][1], ft: Math.random(), dir: 2, ox: (i - 1) * 10 })), horn: 2 };
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) { return; } const h = s.minute / 60;
      if (!hunt) { if (s.raining || s.weekday === 6 || doneDay === s.day * 2 + (h > 12 ? 1 : 0)) return; if ((h > 7.5 && h < 8.5) || (h > 15 && h < 16)) { const P = game.player; if (Math.random() < 0.003) { doneDay = s.day * 2 + (h > 12 ? 1 : 0); hunt = begin(s, h > 12); if (hunt && Math.hypot(hunt.lead[0] - P.x, hunt.lead[1] - P.y) > 900) hunt = null; } } return; }
      const H = hunt; H.t += dt; if (H.s !== s || H.t > 120) { hunt = null; return; }
      const tgt = H.path[H.pi]; if (!tgt) { hunt = null; return; } const dx = tgt[0] - H.lead[0], dy = tgt[1] - H.lead[1], d = Math.hypot(dx, dy), st = 30 * dt; if (d <= st) { H.lead = tgt.slice(); H.pi++; } else { H.lead[0] += dx / d * st; H.lead[1] += dy / d * st; }
      if (Math.hypot(H.lead[0] - H.trail[0][0], H.lead[1] - H.trail[0][1]) > 2) { H.trail.unshift(H.lead.slice()); if (H.trail.length > 80) H.trail.pop(); }
      H.horse.ft += dt; if (H.pony) H.pony.ft += dt;
      for (const hd of H.hounds) { hd.ft += dt; const k = Math.max(0, 0), tx = H.lead[0] + 20 + hd.ox + Math.sin(H.t * 2 + hd.seed) * 12, ty = H.lead[1] + Math.cos(H.t * 1.7 + hd.seed) * 8; hd.x += (tx - hd.x) * Math.min(1, dt * 3); hd.y += (ty - hd.y) * Math.min(1, dt * 3); hd.dir = tx > hd.x ? 2 : 1; void k; }
      H.horn -= dt; if (H.horn <= 0) { H.horn = 6 + Math.random() * 6; if (Math.hypot(H.lead[0] - game.player.x, H.lead[1] - game.player.y) < 500) { O.sfx && O.sfx('horn', 0.35); O.animalCall && O.animalCall('dog', 0.3); } }
      if (Math.random() < dt * 2) for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || q._sawHunt === H || Math.hypot(a.x - H.lead[0], a.y - H.lead[1]) > 70) continue; q._sawHunt = H; O.gesture && O.gesture(q, q.age < 12 ? 'wave' : q.sex === 'f' ? 'curtsy' : 'bow', 1.5); }
    });
    const at = (H, k) => H.trail[Math.min(H.trail.length - 1, k)];
    game.hooks.drawWorld.push((ctx, cam) => {
      const H = hunt; if (!H || game.scene) return; const tk = performance.now() / 1000;
      // the huntsman on foot ahead, with his horn
      const hp = H.lead, hx = Math.round(hp[0] + 14 - cam.x), hy = Math.round(hp[1] - cam.y); if (!(O.occluded && O.occluded(hp[0] + 14, hp[1]))) try { const A = O.Char.ANIMS.walk, fr = O.Char.frame(H.hunts, 2, 'walk', Math.floor(tk * A.fps) % A.frames); ctx.drawImage(fr, hx - 16, hy - O.Char.GROUND); } catch (e) { /* */ } ctx.fillStyle = '#c8a040'; ctx.fillRect(hx + 4, hy - 20, 4, 2);
      // the lord on his horse
      const lp = at(H, 6), lx = Math.round(lp[0] - cam.x), ly = Math.round(lp[1] - cam.y); if (!(O.occluded && O.occluded(lp[0], lp[1]))) try { const HA = O.Animals.HANIMS.walk, hf = O.Animals.horse(H.horse, 2, 'walk', Math.floor(H.horse.ft * HA.fps) % HA.frames); ctx.drawImage(hf, lx - hf.ox, ly - hf.gy); const rider = O.Char.frame(H.lordApp, 2, 'ride', 0), hip = O.Char.hipY(H.lordApp, 'ride'); const sx = lx - hf.ox + (hf.seat ? hf.seat[0] : hf.ox), sy = ly - hf.gy + (hf.seat ? hf.seat[1] : 18); ctx.drawImage(rider, Math.round(sx - 16), Math.round(sy - hip)); if (hf.front) ctx.drawImage(hf.front, lx - hf.ox, ly - hf.gy); } catch (e) { /* */ }
      // the pony with the deer, coming home
      if (H.pony && !(O.occluded && O.occluded(at(H, 22)[0], at(H, 22)[1]))) { const pp = at(H, 22), px = Math.round(pp[0] - cam.x), py = Math.round(pp[1] - cam.y); try { const HA = O.Animals.HANIMS.walk, pf = O.Animals.horse(H.pony, 2, 'walk', Math.floor(H.pony.ft * HA.fps) % HA.frames); ctx.drawImage(pf, px - pf.ox, py - pf.gy); } catch (e) { /* */ } ctx.fillStyle = '#8a5a34'; ctx.fillRect(px - 10, py - 30, 20, 6); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(px + 9, py - 36, 1, 6); ctx.fillRect(px + 11, py - 35, 1, 5); }
      // the hounds
      for (const hd of H.hounds) { if (O.occluded && O.occluded(hd.x, hd.y)) continue; const x = hd.x - cam.x, y = hd.y - cam.y; try { const A = O.Animals.HANIMS.walk, fr = O.Animals.animal('dog', hd.seed, hd.dir, true, Math.floor(hd.ft * A.fps * 1.6) % A.frames, 'walk'); ctx.drawImage(fr, Math.round(x - (fr.ox ?? fr.width / 2)), Math.round(y - (fr.gy ?? fr.height))); } catch (e) { /* */ } }
    });
    O.LordsHunt = { start: (back) => { hunt = begin(cur(), !!back); return hunt; }, get hunt() { return hunt; } };
  }
  O.LordsHuntSetup = { setup };
})();
