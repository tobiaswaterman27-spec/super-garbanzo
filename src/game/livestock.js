// The beast market. On market day a corner by the square is penned off with hurdles, sheep in one pen and
// pigs in the other, milling about, and the drover stands by them crying their worth. Buyers come and look
// them over, lean on the hurdle and point, and there's haggling ("Six." "Five, and I'm robbing myself.")
// until they spit and shake on it; then the buyer goes off home with the beast trotting behind on a rope.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let M = null; let cool = 8; const led = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const say = (q, t, d) => q && q.agent && near(q.agent.x, q.agent.y, 300) && O.Speech && O.Speech.say(q, t, d || 2.5);
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.agent.mount && !q.errand && !q._bit && !q._scene && !q._chore && !q._call && !q._beast && !q.visitor && !talking(q);
    const isMarket = (s) => s && s.weekday === 6 && s.minute >= 7 * 60 && s.minute < 13 * 60;
    function place(s) {
      if (!s.Z || !s.Z.square) return null; const [x0, y0, x1, y1] = s.Z.square, w = s.world;
      const ok = (tx, ty) => { for (let y = ty; y < ty + 3; y++) for (let x = tx; x < tx + 8; x++) { if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1) return false; const i = y * w.W + x; if (w.solid[i] || w.ter[i] === w.TER.WATER) return false; } return true; };
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; let best = null, bd = 1e9;
      for (let ty = y0 - 14; ty <= y1 + 12; ty++) for (let tx = x0 - 16; tx <= x1 + 10; tx++) { const d = Math.hypot(tx + 4 - cx, ty + 1 - cy); if (d >= bd || d < 3) continue; if (ok(tx, ty)) { best = { tx, ty }; bd = d; } }
      return best;
    }
    function setUp(s) {
      const at = place(s); if (!at) return null; const r = O.RNG(O.hash('beasts', s.day, s.world.placeId || 'x'));
      const pens = [{ kind: 'sheep', x0: at.tx * T + 4, y0: at.ty * T + 8, w: 3 * T + 8, h: 2 * T + 4, n: 4 + r.int(0, 2), price: 5 }, { kind: 'pig', x0: (at.tx + 4) * T + 4, y0: at.ty * T + 8, w: 3 * T + 8, h: 2 * T + 4, n: 2 + r.int(0, 2), price: 8 }];
      for (const p of pens) { p.beasts = []; for (let i = 0; i < p.n; i++) p.beasts.push({ x: p.x0 + 6 + r.next() * (p.w - 12), y: p.y0 + 10 + r.next() * (p.h - 12), seed: r.int(1, 999), dir: r.next() < 0.5 ? 1 : 2, ft: r.next() * 3, mv: false }); }
      return { s, day: s.day, pens, at, drover: null, deals: 0, cry: 3 };
    }
    function release(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._beast = null; }
    game.hooks.update.push((dt) => {
      const s = cur();
      // beasts being led home follow their buyer
      for (const L of led.slice()) { const a = L.q.agent; L.ft += dt; if (!a || L.s !== s || a.inside != null || a.hidden || L.ft > 120) { led.splice(led.indexOf(L), 1); continue; } L.trail.push([a.x, a.y]); if (L.trail.length > 18) L.trail.shift(); const [tx, ty] = L.trail[0]; const d = Math.hypot(tx - L.x, ty - L.y); L.mv = d > 1; if (L.mv) { L.dir = tx > L.x ? 2 : 1; L.x += (tx - L.x) * Math.min(1, dt * 4); L.y += (ty - L.y) * Math.min(1, dt * 4); } }
      if (!s || !s.world || game.scene) return;
      if (!isMarket(s)) { if (M) { release(M.drover); for (const p of M.pens) for (const b of p.beasts) if (b.buyer) release(b.buyer); M = null; } return; }
      if (!M || M.day !== s.day || M.s !== s) { M = setUp(s); if (!M) return; }
      for (const p of M.pens) for (const b of p.beasts) { b.ft += dt; if (b.mv) { const dx = b.tx - b.x, dy = b.ty - b.y, dd = Math.hypot(dx, dy); if (dd < 1) b.mv = false; else { b.x += dx / dd * 8 * dt; b.y += dy / dd * 8 * dt; b.dir = dx > 0 ? 2 : 1; } } else if (Math.random() < dt * 0.25) { b.tx = p.x0 + 6 + Math.random() * (p.w - 12); b.ty = p.y0 + 10 + Math.random() * (p.h - 12); b.mv = true; } if (Math.random() < dt * 0.02 && near(b.x, b.y, 220)) O.animalCall && O.animalCall(p.kind, 0.15); }
      // the drover
      if (!M.drover || M.drover.alive === false || !M.drover.agent) {
        const P = game.player, dr = s.people.filter((q) => free(q) && q.age >= 20 && q.age < 65 && (/shepherd|farm|drover|swine|herd/.test(q.job?.role || '') || !q.job) && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 800)[0];
        if (dr) { dr._beast = 'drover'; M.drover = dr; O.Errands.send(s, dr, [M.at.tx + 3, M.at.ty + 3], { anim: 'idle', secs: 0.2, face: 0, giveUp: game.t + 60, after: (ok) => { if (!ok || !dr.agent) { dr._beast = null; M.drover = null; return; } dr.agent.frozen = true; dr.agent.path = null; dr.agent.dir = 0; M.droverIn = true; } }); }
      }
      const drv = M.drover;
      if (drv && M.droverIn && drv.agent) { if (talking(drv)) { /* the player has his ear */ } else { M.cry -= dt; drv.agent.forceAnim = M.deal ? M.deal.anim : (Math.floor(game.t / 4) % 3 ? 'idle' : 'point'); if (M.cry <= 0 && !M.deal) { M.cry = 12 + Math.random() * 8; say(drv, pick(['Fine fat wethers here!', 'Pigs! Good pigs, fed on acorns!', 'Look at the wool on that one!', 'Best beasts this side of the river!'])); } } }
      // a buyer and the haggling
      if (M.deal) { const D = M.deal; D.t += dt; const b = D.q;
        if (!b.agent || b.alive === false || talking(b) || D.t > 40) { release(b); M.deal = null; }
        else if (D.at) { b.agent.forceAnim = D.t < 4 ? 'look' : D.t < 6 ? 'point' : D.t < 14 ? 'talk' : D.t < 16 ? 'give' : 'idle'; D.anim = D.t < 6 ? 'idle' : D.t < 14 ? 'talk' : D.t < 16 ? 'take' : 'idle';
          if (!D.s1 && D.t > 6) { D.s1 = 1; say(b, `${D.pen.price + 2}? For that one? I'll give you ${D.pen.price - 1}.`, 2.8); }
          if (!D.s2 && D.t > 9) { D.s2 = 1; drv && say(drv, `${D.pen.price + 1}, and I'm robbing myself.`, 2.8); }
          if (!D.s3 && D.t > 12) { D.s3 = 1; say(b, `${D.pen.price}, and done.`, 2.5); }
          if (!D.s4 && D.t > 14) { D.s4 = 1; drv && say(drv, 'Done. Spit and shake.', 2.2); try { const hb = s.household(b), hd = drv && s.household(drv); if (hb && hd && hb !== hd && hb.money >= D.pen.price) { hb.money -= D.pen.price; hd.money += D.pen.price; } } catch (e) { /* */ } }
          if (D.t > 17) { const beast = D.pen.beasts.shift(); M.deals++; if (beast) led.push({ s, q: b, kind: D.pen.kind, seed: beast.seed, x: beast.x, y: beast.y, dir: 1, ft: 0, mv: false, trail: [] }); release(b); M.deal = null; say(b, pick(['Come on, you.', 'Home, then.', 'There\'s a good beast.']), 2); } }
      }
      cool -= dt; if (cool > 0 || M.deal || !M.droverIn) return; cool = 14 + Math.random() * 10;
      const pen = pick(M.pens.filter((p) => p.beasts.length)); if (!pen) return;
      const PL = game.player, q = s.people.filter((x) => free(x) && x.age >= 18 && x.age < 70 && x !== drv && x.household && Math.hypot(x.agent.x - PL.x, x.agent.y - PL.y) < 700 && (() => { try { return s.household(x).money > 30; } catch (e) { return false; } })())[0];
      if (!q) return; q._beast = 'buyer'; const D = { q, pen, t: 0 }; M.deal = D;
      O.Errands.send(s, q, [Math.floor((pen.x0 + pen.w / 2) / T), Math.floor((pen.y0 + pen.h) / T) + 1], { anim: 'idle', secs: 0.2, face: 3, giveUp: game.t + 50, after: (ok) => { if (!ok || !q.agent || M?.deal !== D) { q._beast = null; if (M && M.deal === D) M.deal = null; return; } q.agent.frozen = true; q.agent.path = null; q.agent.dir = 3; D.at = true; D.t = 0; } });
    });
    const drawBeast = (ctx, cam, kind, b, moving) => { try { const an = moving ? 'walk' : (b.seed + Math.floor(b.ft / 5)) % 3 ? 'graze' : 'idle', HA = O.Animals.HANIMS[an], fr = O.Animals.animal(kind, b.seed, b.dir, moving, Math.floor(b.ft * HA.fps) % HA.frames, an); if (O.occluded && O.occluded(b.x, b.y)) return; ctx.drawImage(fr, Math.round(b.x - (fr.ox ?? fr.width / 2) - cam.x), Math.round(b.y - (fr.gy ?? fr.height) - cam.y)); } catch (e) { /* */ } };
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      if (M && M.s === s) for (const p of M.pens) {
        const x = Math.round(p.x0 - cam.x), y = Math.round(p.y0 - cam.y); if (x > ctx.canvas.width + 60 || y > ctx.canvas.height + 60 || x + p.w < -60 || y + p.h < -60) continue;
        ctx.fillStyle = 'rgba(120,90,50,0.35)'; ctx.fillRect(x, y + 4, p.w, p.h - 4);
        // back hurdle, beasts, front hurdle
        const hurdle = (yy) => { ctx.fillStyle = '#7a5a3a'; for (let xx = x; xx <= x + p.w; xx += 8) ctx.fillRect(xx, yy - 8, 2, 9); ctx.fillStyle = '#9a7a4a'; ctx.fillRect(x, yy - 7, p.w + 2, 1); ctx.fillRect(x, yy - 4, p.w + 2, 1); ctx.fillRect(x, yy - 1, p.w + 2, 1); };
        hurdle(y + 4); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x, y - 4, 2, p.h + 5); ctx.fillRect(x + p.w, y - 4, 2, p.h + 5);
        for (const b of [...p.beasts].sort((u, v) => u.y - v.y)) drawBeast(ctx, cam, p.kind, b, b.mv);
        hurdle(y + p.h + 1);
      }
      for (const L of led) { if (L.s !== s) continue; drawBeast(ctx, cam, L.kind, L, L.mv); const a = L.q.agent; if (a && !a.hidden) { ctx.strokeStyle = 'rgba(200,180,140,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(a.x - cam.x), Math.round(a.y - 10 - cam.y)); ctx.lineTo(Math.round(L.x - cam.x), Math.round(L.y - 8 - cam.y)); ctx.stroke(); } }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!M) return ''; if (q === M.drover) return `You are the drover selling beasts at the market pens: ${M.pens.map((p) => `${p.beasts.length} ${p.kind === 'pig' ? 'pigs' : 'sheep'} at about ₳${p.price} each`).join(' and ')}. You have sold ${M.deals} today. Haggle hard.`; if (M.deal && M.deal.q === q) return 'You are at the market pens haggling with the drover over a beast.'; return ''; });
    O.Livestock = { get M() { return M; }, led };
  }
  O.LivestockSetup = { setup };
})();
