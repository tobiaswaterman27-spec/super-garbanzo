// Snow days. When the snow lies thick, children build snowmen: they roll a ball along the ground and it
// grows as it goes, roll a smaller one for the head, heave it up, and give it stick arms, coal eyes and a
// carrot of a nose; the snowman stands in the street (and grins at you) until the thaw takes it. Where
// the water has frozen, they run and slide on the ice, arms out, and now and then go flat on their backs.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t) => O.Speech && O.Speech.say(q, t, 1.4);
    const ok = (x, y) => !game.solidAt(x - 4, y - 2) && !game.solidAt(x + 4, y - 2);
    const men = []; let build = null, slide = null, cool = 6;
    const kidFree = (q) => q && q.age >= 5 && q.age <= 13 && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._playing && !q._scene;
    const hold = (q) => { q._snow = true; q.agent.frozen = true; q.agent.path = null; };
    const free = (q) => { if (!q) return; q._snow = false; q.agent.forceAnim = null; q.agent.lift = 0; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; };
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const W = s.weather || {}, snowy = (W.snowCover || 0) > 0.35, P = game.player;
      for (const m of men.slice()) { if (m.s !== s) continue; if ((W.snowCover || 0) < 0.1) { m.melt = (m.melt || 0) + dt / 60; if (m.melt > 1) men.splice(men.indexOf(m), 1); } }
      // building
      if (build) { const b = build; b.t += dt; const [k1, k2] = b.kids; if (b.s !== s || !snowy || b.t > 60 || b.kids.some((k) => k.alive === false)) { b.kids.forEach(free); build = null; }
        else if (b.stage === 'roll') { const a = k1.agent; const nx = a.x + b.dir * 16 * dt; if (ok(nx, a.y) && Math.abs(nx - b.x0) < 60) { a.x = nx; } else b.dir = -b.dir; a.dir = b.dir > 0 ? 2 : 1; a.forceAnim = 'crouch'; b.r = Math.min(7, b.r + dt * 0.5); b.bx = a.x + b.dir * 7; b.by = a.y; if (k2) { k2.agent.forceAnim = 'crouch'; const hx = b.bx + 14, hy = b.by + 6; k2.agent.x += (hx - k2.agent.x) * dt * 2; k2.agent.y += (hy - k2.agent.y) * dt * 2; b.hr = Math.min(4.5, (b.hr || 1) + dt * 0.3); } if (b.r >= 7) { b.stage = 'stack'; b.t2 = 0; } }
        else if (b.stage === 'stack') { b.t2 += dt; k1.agent.forceAnim = 'pickup'; if (k2) k2.agent.forceAnim = 'pickup'; if (b.t2 > 2) { b.stage = 'dress'; b.t2 = 0; men.push(b.man = { s, x: b.bx, y: b.by, r: b.r, hr: b.hr || 4.5, dressed: 0, melt: 0, nose: true }); } }
        else if (b.stage === 'dress') { b.t2 += dt; k1.agent.forceAnim = 'place'; b.man.dressed = Math.min(1, b.t2 / 3); if (b.t2 > 3.2) { k1.agent.forceAnim = 'celebrate'; if (k2) k2.agent.forceAnim = 'celebrate'; if (!b.said) { b.said = 1; say(k1, pick(['He\'s got your nose!', 'Sir Snowball!', 'He\'s the best one ever!'])); } if (b.t2 > 6) { b.kids.forEach(free); build = null; } } } }
      // sliding on the ice
      if (slide) { const sl = slide; sl.t += dt; const a = sl.q.agent; if (sl.s !== s || sl.t > 16 || !snowy) { free(sl.q); slide = null; }
        else { if (sl.fall > 0) { sl.fall -= dt; a.forceAnim = sl.fall > 0.8 ? 'lie' : 'sit'; } else { const nx = a.x + sl.vx * dt; if (sl.ice(nx, a.y)) a.x = nx; else sl.vx = -sl.vx * 0.8; a.dir = sl.vx > 0 ? 2 : 1; a.forceAnim = Math.abs(sl.vx) > 30 ? 'celebrate' : 'run'; sl.vx += (sl.vx > 0 ? 1 : -1) * (Math.abs(sl.vx) < 20 ? 60 : -10) * dt; if (Math.random() < dt * 0.15) { sl.fall = 1.4; say(sl.q, pick(['Oof!', 'My bum!', 'Wheee- ow.'])); } } } }
      cool -= dt; if (cool > 0 || !snowy) return; cool = 8;
      const kids = s.people.filter((q) => kidFree(q) && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 380);
      if (!build && kids.length && men.filter((m) => m.s === s && Math.hypot(m.x - P.x, m.y - P.y) < 500).length < 3) { const k1 = kids[0], k2 = kids.find((q) => q !== k1 && Math.hypot(q.agent.x - k1.agent.x, q.agent.y - k1.agent.y) < 100); [k1, k2].filter(Boolean).forEach(hold); build = { s, kids: [k1, k2].filter(Boolean), stage: 'roll', t: 0, r: 1.5, dir: Math.random() < 0.5 ? 1 : -1, x0: k1.agent.x, bx: k1.agent.x, by: k1.agent.y }; say(k1, pick(['Let\'s make a snowman!', 'Help me roll it!'])); return; }
      const frozen = s.season === 'winter' && (W.snowCover || 0) > 0.6; const w = s.world;
      if (!slide && frozen && w.TER && w.ter) { const iceAt = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return w.ter[ty * w.W + tx] === w.TER.WATER; }; const k = kids.find((q) => { for (let r = 1; r < 6; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (iceAt(q.agent.x + dx * T, q.agent.y + dy * T)) return true; return false; }); if (k) { let ix = null; for (let r = 1; r < 6 && !ix; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (!ix && iceAt(k.agent.x + dx * T, k.agent.y + dy * T)) ix = [k.agent.x + dx * T, k.agent.y + dy * T]; hold(k); k.agent.x = ix[0]; k.agent.y = ix[1]; slide = { s, q: k, t: 0, vx: (Math.random() < 0.5 ? -1 : 1) * 40, fall: 0, ice: iceAt }; } }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height;
      const ball = (x, y, r) => { ctx.fillStyle = '#f4f6fa'; ctx.beginPath(); ctx.arc(x, y - r, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#d8dee8'; ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.7, r * 0.7, 0, Math.PI); ctx.fill(); };
      if (build && build.s === s && build.stage === 'roll') { ball(Math.round(build.bx - cam.x), Math.round(build.by - cam.y), build.r); if (build.kids[1]) ball(Math.round(build.kids[1].agent.x - 8 - cam.x), Math.round(build.kids[1].agent.y - cam.y), build.hr || 1); }
      for (const m of men) { if (m.s !== s) continue; const x = Math.round(m.x - cam.x), y = Math.round(m.y - cam.y); if (x < -20 || y < -40 || x > W + 20 || y > H + 20) continue; const sc = 1 - (m.melt || 0) * 0.6; const r = m.r * sc, hr = m.hr * sc; ball(x, y, r); ball(x, y - r * 2 + 2, hr); if (m.dressed > 0.3 && sc > 0.6) { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 2, Math.round(y - r * 2 - hr - 1), 1, 1); ctx.fillRect(x + 1, Math.round(y - r * 2 - hr - 1), 1, 1); ctx.fillRect(x, Math.round(y - r * 1.4), 1, 1); ctx.fillRect(x, Math.round(y - r * 0.8), 1, 1); } if (m.dressed > 0.6 && sc > 0.6) { ctx.fillStyle = '#e07020'; ctx.fillRect(x, Math.round(y - r * 2 - hr + 1), 3, 1); ctx.strokeStyle = '#5a3d26'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - r, y - r * 1.4); ctx.lineTo(x - r - 5, y - r * 1.4 - 4); ctx.moveTo(x + r, y - r * 1.4); ctx.lineTo(x + r + 5, y - r * 1.4 - 3); ctx.stroke(); } }
    });
    O.WinterPlay = { men, get build() { return build; }, get slide() { return slide; } };
  }
  O.WinterPlaySetup = { setup };
})();
