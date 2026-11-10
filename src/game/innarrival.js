// A guest at the inn. Now and then a traveller comes up the street to the tavern door leading a tired horse
// by the bridle, mud to the knees: the ostler comes out wiping his hands and takes the horse round to the
// yard, the potboy runs for the saddlebags, and the host is on the step with a cup of ale for the road-dust
// and a word of welcome; the traveller stretches the ache out of his back and goes in.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let A = null, cool = 150, guests = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._inn && !q._bit && !q._scene && !talking(q);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._inn = false; }
    function end() { if (!A) return; for (const q of A.staff) rel(q); A = null; }
    const clear = (x0, y0, x1, y1) => { for (let k = 0; k <= 1; k += 0.05) if (game.solidAt(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k - 2)) return false; return true; };
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (A) { A.t += dt; if (A.s !== s || A.t > 90) { end(); return; } const g = A.guest, h = A.horse;
        if (A.phase === 'come') { const dx = A.door[0] - g.x, dy = A.door[1] + 14 - g.y, d = Math.hypot(dx, dy); if (d > 2) { g.x += dx / d * 26 * dt; g.y += dy / d * 26 * dt; g.dir = O.dirOf(dx, dy); } else { A.phase = 'greet'; A.k = 0; g.dir = 3; } h.x = g.x - Math.sign(dx || 1) * 16 * (Math.abs(dx) > Math.abs(dy) ? 1 : 0); h.y = g.y + (Math.abs(dy) >= Math.abs(dx) ? 14 : 2); h.dir = dx > 0 ? 2 : 1; h.ft += dt; h.moving = d > 2; g.ft += dt; g.anim = d > 2 ? 'walk' : 'idle';
          if (A.phase === 'greet') { // the inn comes out to meet them
            const staff = (A.bz.workers || []).concat(A.bz.owner != null && A.bz.owner !== 'player' ? [A.bz.owner] : []).map((id) => s.byId.get(id)).filter(able).slice(0, 3);
            staff.forEach((q, i) => { const a = q.agent; a.inside = null; a.hidden = false; a.x = A.door[0] + [10, -12, 18][i]; a.y = A.door[1] + [2, 6, 12][i]; if (game.solidAt(a.x, a.y - 2)) { a.x = A.door[0]; a.y = A.door[1] + 4; } a.frozen = true; a.path = null; q._inn = true; }); A.staff = staff; } }
        if (A.phase === 'greet') { A.k += dt; g.anim = A.k < 1.5 ? 'stretch' : A.k < 4 ? 'take' : A.k < 6 ? 'drink' : 'idle'; h.moving = false; h.ft += dt;
          A.staff.forEach((q, i) => { const a = q.agent; a.dir = O.dirOf(g.x - a.x, g.y - a.y); a.forceAnim = i === 0 ? (A.k < 4 ? 'give' : 'talk') : i === 1 ? (A.k < 3 ? 'idle' : 'carry') : (A.k < 2.5 ? 'wave' : 'idle'); });
          if (!A.s1 && A.k > 0.5 && near(g.x, g.y, 320)) { A.s1 = true; if (A.staff[0]) O.Speech && O.Speech.say(A.staff[0], pick(['Welcome, friend! You\'ve the road on you. Here, wet your throat.', 'Come in, come in! A bed, is it? And supper?', 'You\'re in luck, the best room\'s free.']), 3); setTimeout(() => A && O.Speech && O.Speech.say(A.guest, pick(['Bless you. Forty miles since dawn.', 'A bed, and something hot, and see to the horse.', 'Is the road to the coast clear of thieves?']), 2.6), 3000); }
          if (A.k > 3 && A.staff[1] && !A.bags) { A.bags = true; A.staff[1].agent.carrying = { good: 'cloth', qty: 1 }; }
          if (A.k > 6) { A.phase = 'in'; A.k = 0; const os = A.staff[2] || A.staff[0]; A.ostler = os; if (os && near(g.x, g.y, 320)) O.Speech && O.Speech.say(os, 'I\'ll rub him down and give him a feed, sir.', 2.2); } }
        if (A.phase === 'in') { A.k += dt; // the guest goes in; the horse is led round to the yard
          if (A.k > 0.6) g.gone = true; if (A.staff[1]) A.staff[1].agent.carrying = null; const dx = A.yard[0] - h.x, dy = A.yard[1] - h.y, d = Math.hypot(dx, dy); if (d > 2) { h.x += dx / d * 20 * dt; h.y += dy / d * 20 * dt; h.dir = dx > 0 ? 2 : 1; h.moving = true; h.ft += dt; } else h.gone = true;
          const os = A.ostler; if (os && os.agent) { os.agent.x = h.x + (h.dir === 2 ? 14 : -14); os.agent.y = h.y; os.agent.forceAnim = 'walk'; os.agent.dir = h.dir; }
          if ((h.gone && g.gone) || A.k > 14) { guests++; end(); } }
        return; }
      cool -= dt; if (cool > 0) return; cool = 240 + Math.random() * 240; if (hr < 11 || hr > 20) return;
      const bz = [...s.biz.values()].find((z) => (z.type === 'tavern' || z.type === 'inn') && z.open !== false); if (!bz) return; const b = s.building(bz.b?.id ?? bz.id); if (!b || b.doorX == null || !near(b.doorX * T, b.doorY * T, 420)) return;
      const door = [b.doorX * T + 8, (b.doorY + 1) * T + 6]; let st = null; for (const [ox, oy] of [[0, 200], [220, 14], [-220, 14], [0, 140], [140, 14], [-140, 14]]) { const x = door[0] + ox, y = door[1] + 14 + oy; if (!game.solidAt(x, y - 2) && clear(x, y, door[0], door[1] + 14)) { st = [x, y]; break; } } if (!st) return;
      let yard = [door[0] + 60, door[1] + 20]; for (const ox of [60, -60, 90, -90]) if (!game.solidAt(door[0] + ox, door[1] + 20 - 2)) { yard = [door[0] + ox, door[1] + 20]; break; }
      const R = O.RNG(O.hash('guest', s.day, Math.floor(hr))); const app = O.Char.makeAppearance(O.hash('guestapp', s.day, Math.floor(hr)), { sex: R.next() < 0.8 ? 'm' : 'f', age: 25 + Math.floor(R.next() * 30), genes: O.Char.randomGenes(R, R.next() < 0.5 ? 'north' : 'south'), role: pick(['merchant', 'courier', 'pilgrim', 'merchant']), wealth: 0.5 });
      const coats = Object.keys(O.Animals.COATS || { bay: 1 }); A = { s, bz, b, door, yard, t: 0, phase: 'come', staff: [], guest: { app, x: st[0], y: st[1], dir: 3, ft: 0, anim: 'walk', agent: { x: st[0], y: st[1], hidden: false, inside: null }, first: 'the traveller' }, horse: { id: 'innh' + s.day + Math.floor(hr), seed: O.hash('innh', s.day), coat: coats[Math.floor(R.next() * coats.length)], saddled: true, x: st[0], y: st[1] + 14, dir: 1, ft: 0, moving: true } };
    });
    game.hooks.update.push(() => { if (A) { A.guest.agent.x = A.guest.x; A.guest.agent.y = A.guest.y; A.guest.agent.hidden = !!A.guest.gone; } });
    game.hooks.drawWorld.push((ctx, cam) => { if (!A || game.scene || A.s !== cur()) return; const g = A.guest, h = A.horse;
      if (!h.gone) { try { const an = h.moving ? 'walk' : 'idle', HA = O.Animals.HANIMS[an], fr = O.Animals.horse(h, h.dir, an, Math.floor(h.ft * HA.fps) % HA.frames); ctx.drawImage(fr, Math.round(h.x - fr.ox - cam.x), Math.round(h.y - fr.gy - cam.y)); if (fr.front) ctx.drawImage(fr.front, Math.round(h.x - fr.ox - cam.x), Math.round(h.y - fr.gy - cam.y)); } catch (e) { /* */ }
        ctx.fillStyle = '#6a4a2c'; ctx.fillRect(Math.round(h.x - cam.x) - 9, Math.round(h.y - cam.y) - 20, 6, 5); ctx.fillRect(Math.round(h.x - cam.x) + 4, Math.round(h.y - cam.y) - 20, 6, 5); }
      if (!g.gone) { try { const A2 = O.Char.ANIMS[g.anim] || O.Char.ANIMS.idle, fr = O.Char.frame(g.app, g.dir, g.anim, Math.floor(g.ft * (A2.fps || 6)) % (A2.frames || 1)); ctx.drawImage(fr, Math.round(g.x - 16 - cam.x), Math.round(g.y - O.Char.GROUND - cam.y)); } catch (e) { /* */ }
        if (A.phase === 'come') { ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(g.x - cam.x), Math.round(g.y - cam.y) - 12); ctx.lineTo(Math.round(h.x - cam.x) + (h.dir === 2 ? 12 : -12), Math.round(h.y - cam.y) - 18); ctx.stroke(); } } });
    (O.extraLines = O.extraLines || []).push((s, q) => !A || !q._inn ? '' : 'A traveller has just come to your inn, tired from the road, and you are seeing to them and their horse.');
    O.InnArrival = { get arrival() { return A; }, get guests() { return guests; }, soon: () => { cool = 0; } };
  }
  O.InnArrivalSetup = { setup };
})();
