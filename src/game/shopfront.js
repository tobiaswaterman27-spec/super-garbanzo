// Work done in the street. Through the working day the trades step out of their doors to do the parts
// of the work that want daylight and room, and you can stand and watch: the smith at the anvil by his
// door with the sparks jumping at every blow and the hiss of the quench; the baker setting a tray of
// loaves to cool on a board, steaming; the carpenter and the boatwright sawing a plank on trestles,
// sawdust falling; the woodcutter splitting logs on the block, chips flying; the butcher at his block;
// the tapster rolling a cask to the door; the miller's man and the carter stacking sacks and crates;
// the tailor sewing on the step in the good light; the chandler hanging candles on the rack; the
// brewer stirring a steaming tub; the fisher mending nets; the beekeeper with his smoker.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const nearP = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const fronts = [], parts = [];
    const sfx = (k, v, x, y) => O.sfx && nearP(x, y, 260) && O.sfx(k, v * (1 - Math.hypot(x - game.player.x, y - game.player.y) / 300));
    const puff = (x, y, n, o) => { for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * (o.sx || 40), vy: -(o.up || 20) * (0.5 + Math.random()), g: o.g ?? 60, t: 0, life: o.life || 0.5, c: typeof o.c === 'function' ? o.c() : o.c, s: o.s || 1 }); };
    const steam = (x, y) => parts.push({ x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 4, vy: -10 - Math.random() * 6, g: 0, t: 0, life: 1.6, c: 'rgba(235,235,240,0.45)', s: 2 });

    // at = where the prop stands relative to the worker (they face it)
    const WORK = {
      smithy: { anim: 'hammer', len: [16, 24], init(f) { f.hot = 1; }, beat: 1.45, onBeat(f, x, y) { puff(x + 10, y - 8, 4 + Math.floor(Math.random() * 4), { c: () => pick(['#ffd060', '#ff9a30', '#fff0a0']), sx: 70, up: 40, g: 120, life: 0.45 }); sfx('smack', 0.35, x, y); f.hot = Math.max(0.2, f.hot - 0.06); if (f.hot < 0.4 && !f.quenched) { f.quenched = true; sfx('scrub', 0.4, x, y); for (let i = 0; i < 10; i++) steam(x + 18, y - 4); } },
        draw(f, ctx, x, y) { ctx.fillStyle = '#3a3a42'; ctx.fillRect(x + 6, y - 9, 10, 3); ctx.fillRect(x + 9, y - 6, 4, 6); ctx.fillRect(x + 7, y - 1, 8, 2); const hc = Math.floor(255 * f.hot); ctx.fillStyle = `rgb(255,${Math.max(60, hc - 60)},${Math.max(20, hc - 200)})`; ctx.fillRect(x + 8, y - 10, 6, 1); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 17, y - 5, 6, 5); ctx.fillStyle = '#5a7a9a'; ctx.fillRect(x + 18, y - 5, 4, 1); } },
      bakery: { anim: 'place', len: [12, 18], init(f) { f.loaves = 0; }, beat: 1.4, onBeat(f, x, y) { if (f.loaves < 6) { f.loaves++; sfx('place', 0.2, x, y); } }, tick(f, x, y, dt) { if (Math.random() < dt * 3 * f.loaves / 6) steam(x + 9 + Math.random() * 12, y - 9); },
        draw(f, ctx, x, y) { ctx.fillStyle = '#8a6239'; ctx.fillRect(x + 6, y - 8, 16, 3); ctx.fillRect(x + 7, y - 5, 2, 5); ctx.fillRect(x + 19, y - 5, 2, 5); for (let i = 0; i < f.loaves; i++) { ctx.fillStyle = '#c08a40'; ctx.fillRect(x + 7 + (i % 3) * 5, y - 10 - Math.floor(i / 3) * 0, 4, 2); ctx.fillStyle = '#e0b060'; ctx.fillRect(x + 8 + (i % 3) * 5, y - 10, 2, 1); } } },
      carpenter: { anim: 'saw', len: [14, 22], beat: 0.8, onBeat(f, x, y) { puff(x + 12, y - 5, 2, { c: '#e0c890', sx: 12, up: 3, g: 40, life: 0.7 }); sfx('sweep', 0.12, x, y); f.cut = Math.min(1, (f.cut || 0) + 0.05); },
        draw(f, ctx, x, y) { ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 5, y - 6, 2, 6); ctx.fillRect(x + 19, y - 6, 2, 6); ctx.fillStyle = '#c8a070'; ctx.fillRect(x + 3, y - 8, 20, 2); ctx.fillStyle = '#5a3d26'; ctx.fillRect(x + 12, y - 8, 1, Math.round(2 * (f.cut || 0)) + 0.5); } },
      woodcutter: { anim: 'chop', len: [14, 22], beat: 1, onBeat(f, x, y) { f.n = (f.n || 0) + 1; puff(x + 10, y - 3, 3, { c: () => pick(['#d8b070', '#a07a4a']), sx: 60, up: 30, g: 110, life: 0.5 }); sfx('smack', 0.3, x, y); if (f.n % 3 === 0) { f.split = (f.split || 0) + 1; } },
        draw(f, ctx, x, y) { ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 6, y - 4, 8, 4); ctx.fillStyle = '#b89060'; ctx.fillRect(x + 7, y - 4, 6, 1); if ((f.n || 0) % 3 !== 2) { ctx.fillStyle = '#8a6239'; ctx.fillRect(x + 8, y - 9, 4, 5); } for (let i = 0; i < Math.min(8, f.split || 0); i++) { ctx.fillStyle = i % 2 ? '#8a6239' : '#7a5232'; ctx.fillRect(x + 16 + (i % 4) * 3, y - 2 - Math.floor(i / 4) * 2, 3, 2); } } },
      butcher: { anim: 'cleave', len: [12, 18], beat: 1.25, onBeat(f, x, y) { sfx('smack', 0.3, x, y); puff(x + 10, y - 6, 1, { c: '#8a2a2a', sx: 20, up: 10, g: 80, life: 0.3 }); },
        draw(f, ctx, x, y) { ctx.fillStyle = '#7a5232'; ctx.fillRect(x + 6, y - 7, 10, 7); ctx.fillStyle = '#c86060'; ctx.fillRect(x + 8, y - 9, 6, 2); ctx.fillStyle = '#5a3d26'; ctx.fillRect(x + 19, y - 22, 1, 10); ctx.fillStyle = '#b04848'; ctx.fillRect(x + 18, y - 14, 3, 5); } },
      tavern: { anim: 'carry', len: [10, 14], move: true, init(f, x, y) { f.cask = { x: x + 40, y }; }, tick(f, x, y, dt) { const q = f.q, a = q.agent, c = f.cask; const tx = f.door[0] + 10; if (c.x > tx) { c.x -= 18 * dt; a.x = c.x - 9; a.dir = 1; a.forceAnim = 'walk'; c.r = (c.r || 0) - dt * 4; if (Math.random() < dt * 2) sfx('place', 0.12, c.x, c.y); } else { a.forceAnim = 'wipe'; } },
        draw(f, ctx, x, y, cam) { const c = f.cask, cx = Math.round(c.x - cam.x), cy = Math.round(c.y - cam.y); ctx.save(); ctx.translate(cx, cy - 4); ctx.fillStyle = '#7a5232'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 1; const r = c.r || 0; for (const k of [-2.5, 2.5]) { ctx.beginPath(); ctx.moveTo(k * Math.cos(r), -4); ctx.lineTo(k * Math.cos(r), 4); ctx.stroke(); } ctx.restore(); } },
      store: { anim: 'carry', len: [12, 18], move: true, init(f, x, y) { f.n = 0; f.leg = 0; f.from = [x - 18, y]; f.to = [x + 14, y]; }, tick(f, x, y, dt) { const a = f.q.agent, [tx, ty] = f.leg % 2 ? f.from : f.to, dx = tx - a.x, d = Math.abs(dx); if (d < 1.5) { f.leg++; if (f.leg % 2 === 1) { f.n = Math.min(6, f.n + 1); sfx('place', 0.25, a.x, a.y); a.forceAnim = 'place'; } } else { a.x += Math.sign(dx) * Math.min(d, 30 * dt); a.dir = dx > 0 ? 2 : 1; a.forceAnim = f.leg % 2 ? 'walk' : 'carry'; } },
        draw(f, ctx, x, y, cam) { const tx = Math.round(f.to[0] - cam.x) + 6, ty = Math.round(f.to[1] - cam.y); for (let i = 0; i < f.n; i++) { ctx.fillStyle = f.sack ? '#c8b080' : '#8a6239'; ctx.fillRect(tx + (i % 3) * 7, ty - 6 - Math.floor(i / 3) * 6, 6, 6); ctx.fillStyle = f.sack ? '#a89060' : '#6a4a2c'; ctx.fillRect(tx + (i % 3) * 7, ty - 6 - Math.floor(i / 3) * 6, 6, 1); } const a = f.q.agent; if (f.leg % 2 === 0) { ctx.fillStyle = f.sack ? '#c8b080' : '#8a6239'; ctx.fillRect(Math.round(a.x - cam.x) - 3, Math.round(a.y - cam.y) - 22, 6, 5); } } },
      tailor: { anim: 'weave', len: [18, 28], sit: true, beat: 2.5, onBeat(f, x, y) { },
        draw(f, ctx, x, y) { ctx.fillStyle = '#5a6a8a'; ctx.fillRect(x - 4, y - 7, 9, 3); ctx.fillStyle = '#e8e0cc'; ctx.fillRect(x + 3, y - 8, 1, 1); } },
      chandler: { anim: 'place', len: [12, 18], init(f) { f.n = 0; }, beat: 1.8, onBeat(f, x, y) { f.n = Math.min(10, f.n + 1); },
        draw(f, ctx, x, y) { ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 6, y - 18, 16, 1); ctx.fillRect(x + 6, y - 18, 1, 18); ctx.fillRect(x + 21, y - 18, 1, 18); for (let i = 0; i < f.n; i++) { ctx.fillStyle = '#efe6c8'; ctx.fillRect(x + 8 + i * 1.4, y - 17, 1, 7); } } },
      brewery: { anim: 'mix', len: [14, 20], tick(f, x, y, dt) { if (Math.random() < dt * 6) steam(x + 12, y - 9); }, beat: 2, onBeat(f, x, y) { sfx('scrub', 0.1, x, y); },
        draw(f, ctx, x, y) { ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 6, y - 9, 13, 9); ctx.fillStyle = '#c89040'; ctx.fillRect(x + 7, y - 9, 11, 2); ctx.fillStyle = '#4a3a2c'; ctx.fillRect(x + 6, y - 6, 13, 1); } },
      fishery: { anim: 'work', len: [16, 24],
        draw(f, ctx, x, y) { ctx.strokeStyle = 'rgba(200,190,160,0.8)'; ctx.lineWidth = 0.5; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + 6 + i * 3, y - 16); ctx.lineTo(x + 6 + i * 3, y - 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 6, y - 16 + i * 3.5); ctx.lineTo(x + 18, y - 16 + i * 3.5); ctx.stroke(); } ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 5, y - 17, 15, 1); } },
      apiary: { anim: 'shake', len: [10, 16], tick(f, x, y, dt) { if (Math.random() < dt * 5) parts.push({ x: x + 8, y: y - 10, vx: 6 + Math.random() * 6, vy: -8, g: 0, t: 0, life: 1.4, c: 'rgba(200,200,200,0.5)', s: 2 }); if (Math.random() < dt * 4) parts.push({ x: x + 16 + Math.random() * 6, y: y - 6 - Math.random() * 6, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 20, g: 0, t: 0, life: 0.8, c: '#e0b030', s: 1 }); },
        draw(f, ctx, x, y) { ctx.fillStyle = '#c8a050'; ctx.beginPath(); ctx.ellipse(x + 19, y - 5, 5, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#a07a30'; ctx.lineWidth = 0.6; for (const k of [-7, -4, -1]) { ctx.beginPath(); ctx.moveTo(x + 14, y + k); ctx.lineTo(x + 24, y + k); ctx.stroke(); } ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 18, y - 2, 2, 2); } },
      doctor: { anim: 'mix', len: [12, 18], beat: 1.5, onBeat(f, x, y) { sfx('scrub', 0.06, x, y); },
        draw(f, ctx, x, y) { ctx.fillStyle = '#9a9488'; ctx.fillRect(x + 6, y - 11, 6, 4); ctx.fillStyle = '#5a8a4a'; ctx.fillRect(x + 7, y - 12, 4, 1); } },
      stable: { anim: 'pitch', len: [14, 20], beat: 1.3, onBeat(f, x, y) { puff(x + 10, y - 14, 5, { c: () => pick(['#d8c070', '#c8b060', '#b8a050']), sx: 40, up: 20, g: 50, life: 0.8 }); f.n = Math.min(12, (f.n || 0) + 1); },
        draw(f, ctx, x, y) { ctx.fillStyle = '#c8b060'; const h = 3 + Math.floor((f.n || 0) / 2); ctx.beginPath(); ctx.ellipse(x + 18, y - h / 2, 7, h / 2 + 1, 0, 0, Math.PI * 2); ctx.fill(); } },
    };
    WORK.builder = WORK.carpenter; WORK.boatyard = WORK.carpenter; WORK.charcoal = WORK.woodcutter; WORK.carrier = WORK.store; WORK.posthouse = WORK.store; WORK.mill = Object.assign({}, WORK.store, { init(f, x, y) { WORK.store.init(f, x, y); f.sack = true; } });

    const outWhere = (b, i) => { const dx = [-1, 1, 2, -2][i % 4]; return [(b.doorX + dx) * T + 8, (b.doorY + 1) * T + 12]; };
    const okAt = (x, y) => !game.solidAt(x, y - 2) && !game.solidAt(x + 20, y - 2) && !game.solidAt(x - 6, y - 2);
    function begin(s, bz, q) {
      const bid = bz.b?.id ?? bz.id, b = s.building(bid); if (!b || b.doorX == null) return null; const W = WORK[bz.type]; if (!W) return null;
      let at = null; for (let i = 0; i < 4; i++) { const [x, y] = outWhere(b, i); if (okAt(x, y)) { at = [x, y]; break; } } if (!at) return null;
      const a = q.agent; a.inside = null; a.hidden = false; a.x = at[0]; a.y = at[1]; a.frozen = true; a.path = null; a.dir = 2; q._front = true;
      const f = { s, bz, bid, q, W, at, door: [b.doorX * T + 8, b.doorY * T + 16], t: 0, len: W.len[0] + Math.random() * (W.len[1] - W.len[0]), beat: 0.4, act: q.activity && q.activity.act };
      W.init && W.init(f, at[0], at[1]); fronts.push(f); bz._frontAt = s.day * 24 + s.minute / 60; O.sfx && nearP(f.door[0], f.door[1], 260) && O.sfx('door', 0.3); return f;
    }
    function finish(f, quick) {
      const q = f.q, a = q.agent; q._front = false; a.forceAnim = null; a.lift = 0; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking();
      if (tq !== q) { a.frozen = false; if (q.activity && q.activity.act === 'work' && q.alive !== false) { a.inside = f.bid; a.hidden = true; a.path = null; if (!quick) O.sfx && nearP(f.door[0], f.door[1], 260) && O.sfx('door', 0.25); } }
      fronts.splice(fronts.indexOf(f), 1);
    }
    let scan = 3;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      for (const pt of parts.slice()) { pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += pt.g * dt; if (pt.t > pt.life) parts.splice(parts.indexOf(pt), 1); }
      for (const f of fronts.slice()) {
        const q = f.q, a = q.agent; f.t += dt;
        if (game.scene || f.s !== s || q.alive === false || (q.activity && q.activity.act) !== f.act || q._fighting || q.errand) { finish(f, true); continue; }
        if (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) continue;
        if (f.t > f.len) { finish(f); continue; }
        const [x, y] = f.at, W = f.W;
        if (!W.move) { a.x = x; a.y = y; a.dir = 2; a.forceAnim = W.sit ? (Math.floor(f.t * 0.7) % 4 === 3 ? 'look' : W.anim) : W.anim; }
        if (W.beat) { f.beat -= dt; if (f.beat <= 0) { f.beat = W.beat * (0.85 + Math.random() * 0.3); W.onBeat && W.onBeat(f, x, y); } }
        if (f.q2 != null) f.q2 -= dt;
        W.tick && W.tick(f, x, y, dt);
      }
      scan -= dt; if (scan > 0 || game.scene) return; scan = 2.5;
      if (fronts.length >= 4) return;
      const h = s.minute / 60, now = s.day * 24 + h;
      for (const bz of s.biz.values()) {
        if (!WORK[bz.type] || bz.closedDown || (bz._frontAt && now - bz._frontAt < 1.2) || fronts.some((f) => f.bz === bz)) continue;
        const bid = bz.b?.id ?? bz.id, b = s.building(bid); if (!b || b.doorX == null || !nearP(b.doorX * T + 8, b.doorY * T + 16, 420)) continue;
        const ws = (bz.workers || []).map((i) => s.byId.get(i)).filter((q) => q && q.alive !== false && q.agent && q.agent.inside === bid && q.activity && q.activity.act === 'work' && !q.errand && !q._front && !q.agent.frozen && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q));
        if (!ws.length || (ws.length === 1 && !['smithy', 'woodcutter', 'charcoal', 'carpenter', 'boatyard', 'builder', 'fishery', 'apiary', 'stable', 'mill', 'carrier'].includes(bz.type) && Math.random() < 0.6)) continue; // (a lone shopkeeper minds the counter, mostly)
        if (Math.random() < 0.55) { begin(s, bz, ws[ws.length - 1]); if (fronts.length >= 4) break; }
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; ctx.save();
      for (const f of fronts) { const x = Math.round(f.at[0] - cam.x), y = Math.round(f.at[1] - cam.y); try { f.W.draw && f.W.draw(f, ctx, x, y, cam); } catch (e) { /* */ } }
      for (const pt of parts) { const k = 1 - pt.t / pt.life; ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.5)); ctx.fillStyle = pt.c; ctx.fillRect(Math.round(pt.x - cam.x), Math.round(pt.y - cam.y), pt.s, pt.s); }
      ctx.globalAlpha = 1; ctx.restore();
    });
    (O.extraLines = O.extraLines || []).push((s, q) => q._front ? 'You have stepped out of the shop door to do a piece of the work in the daylight; the player has caught you at it.' : '');
    O.ShopFront = { fronts, parts, start(type) { const s = cur(); const bz = [...s.biz.values()].find((z) => z.type === type); if (!bz) return null; const bid = bz.b?.id ?? bz.id; const q = (bz.workers || []).map((i) => s.byId.get(i)).find((q) => q && q.alive !== false); if (!q) return null; q.activity = { act: 'work' }; q.errand = null; return begin(s, bz, q); }, WORK };
  }
  O.ShopFrontSetup = { setup };
})();
