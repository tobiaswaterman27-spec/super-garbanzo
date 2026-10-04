// Drawing what fights leave behind: blood on the ground (drops from a stab, a streak from a sword,
// a splash from an axe, a dark pool where someone died), things dropped in the street, the dead
// where they fell, stretchers carried through the village, the puff of smoke at the morgue door,
// and wounds on people, bruises, cuts and bandages that shrink as they heal. Also: picking up
// what's lying in the street.
'use strict';
(function () {
  const RED = ['#7a1a1a', '#9a2222', '#b8302a'], DARK = '#4a0e10';
  const ICON = { dagger: '#b8bcc4', sword: '#c8ccd4', axe: '#9aa0aa', bread: '#c88a45', spoon: '#c8ccd4', herbs: '#5a9a40', tools: '#9aa0aa', coin: '#e0c050' };

  function setup(game) {
    const PS = O.PlayerState;
    const sim = () => O.SimRef.cur;

    // ---------- blood and dropped things on the ground ----------
    function drawMark(ctx, m, cam) {
      const r = O.RNG(m.seed), x = Math.round(m.x - cam.x), y = Math.round(m.y - cam.y), s = m.size || 0.5;
      const dot = (dx, dy, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
      if (m.kind === 'drops') for (let i = 0; i < 3 + s * 4; i++) dot(r.int(-4, 4), r.int(-2, 2), RED[r.int(0, 2)]);
      else if (m.kind === 'streak') { const n = 5 + Math.round(s * 5), dir = r.chance(0.5) ? 1 : -1; for (let i = 0; i < n; i++) dot(i * dir - n / 2 * dir, Math.round(i * 0.4) - 1, RED[i % 3]); for (let i = 0; i < 3; i++) dot(r.int(-5, 5), r.int(-3, 3), RED[1]); }
      else if (m.kind === 'splatter') { for (let i = 0; i < 10 + s * 10; i++) { const a = r.next() * Math.PI * 2, d = Math.pow(r.next(), 0.6) * (4 + s * 4); dot(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d * 0.6), RED[r.int(0, 2)]); } dot(-2, -1, DARK, 4, 2); }
      else if (m.kind === 'pool') { ctx.fillStyle = DARK; for (let yy = -3; yy <= 3; yy++) { const w = Math.round(9 * Math.sqrt(1 - (yy / 3.6) ** 2)); ctx.fillRect(x - w, y + yy, w * 2, 1); } ctx.fillStyle = RED[0]; ctx.fillRect(x - 5, y - 1, 6, 1); }
    }
    function drawDropped(ctx, d, cam) {
      const x = Math.round(d.x - cam.x), y = Math.round(d.y - cam.y), c = ICON[d.good] || '#a08a6a';
      if (O.ItemArt && d.good !== 'coin') { const sp = O.ItemArt.small(d.good); ctx.fillStyle = 'rgba(28,20,44,0.3)'; ctx.fillRect(x - 5, y + 1, 10, 2); ctx.drawImage(sp, x - 6, y - 10); if (Math.floor(game.t * 2 + d.id) % 5 === 0 && !d.placed) { ctx.fillStyle = '#fff6dc'; ctx.fillRect(x + 4, y - 9, 1, 1); } return; }
      ctx.fillStyle = 'rgba(28,20,44,0.3)'; ctx.fillRect(x - 3, y + 1, 7, 1);
      if (['dagger', 'sword', 'axe', 'spear', 'tools'].includes(d.good)) { ctx.fillStyle = '#5a3d26'; ctx.fillRect(x - 3, y, 3, 1); ctx.fillStyle = c; ctx.fillRect(x, y - 1, d.good === 'sword' ? 6 : 4, 1); ctx.fillRect(x, y, d.good === 'sword' ? 5 : 3, 1); }
      else { ctx.fillStyle = c; ctx.fillRect(x - 2, y - 2, 4, 3); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 1, y - 2, 1, 1); }
      // a glint now and then, so you notice it
      if (Math.floor(game.t * 2 + d.id) % 5 === 0) { ctx.fillStyle = '#fff6dc'; ctx.fillRect(x + 1, y - 3, 1, 1); }
    }
    game.hooks.drawGround.push((ctx, cam) => {
      const s = sim(); if (!s || s.world !== game.world || game.scene) return;
      for (const m of s.marks || []) drawMark(ctx, m, cam);
      for (const d of s.dropped || []) drawDropped(ctx, d, cam);
    });

    // ---------- bodies and stretchers, sorted with everything else ----------
    const covered = (app) => {
      // a body under a sheet
      const c = document.createElement('canvas'); c.width = 48; c.height = 16; const x = c.getContext('2d');
      x.fillStyle = '#d8d0c0'; x.fillRect(4, 5, 38, 8); x.fillRect(6, 3, 34, 2); x.fillStyle = '#ece6d8'; x.fillRect(5, 5, 36, 2); x.fillStyle = '#a89e8c'; x.fillRect(4, 12, 38, 1); for (let i = 8; i < 40; i += 7) x.fillRect(i, 6, 1, 6);
      void app; return c;
    };
    const headCache = new WeakMap();
    function sleepHead(app) {
      let c = headCache.get(app); if (c && c.ver === app.cacheVer) return c;
      const fr = O.Char.frame(app, 0, 'sleep', 0), hy = O.Char.headY(app), top = Math.max(0, Math.round(hy.cy - hy.ry - 4)), h = Math.round(hy.ry * 2 + 6);
      c = document.createElement('canvas'); c.width = 20; c.height = h; c.getContext('2d').drawImage(fr, 6, top, 20, h, 0, 0, 20, h); c.ver = app.cacheVer; c.cy = hy.ry + 4;
      headCache.set(app, c); return c;
    }
    function stretcherFrame(c) {
      const s = sim(), horiz = Math.abs(c.dx || 1) >= Math.abs(c.dy || 0), L = 40;
      const cv = document.createElement('canvas'); cv.width = 56; cv.height = 56; const x = cv.getContext('2d');
      const occ = c.kind === 'patient' ? s.byId.get(c.target) : (s.bodies || []).find((b) => b.id === c.target);
      // poles and canvas
      if (horiz) {
        x.fillStyle = '#6e4a2c'; x.fillRect(28 - L / 2 - 4, 30, L + 8, 1); x.fillRect(28 - L / 2 - 4, 37, L + 8, 1);
        x.fillStyle = '#c8b890'; x.fillRect(28 - L / 2, 31, L, 6);
        if (c.kind === 'body') x.drawImage(covered(), 4, 26);
        else if (occ) { const hd = sleepHead(occ.app); x.save(); x.translate(28 + (c.dx > 0 ? L / 2 - 6 : -L / 2 + 6), 34); x.rotate(c.dx > 0 ? Math.PI / 2 : -Math.PI / 2); x.drawImage(hd, -10, -hd.cy); x.restore(); x.fillStyle = '#7a8aa8'; x.fillRect(c.dx > 0 ? 28 - L / 2 + 2 : 28 - L / 2 + 10, 31, L - 12, 6); x.fillStyle = '#9aaac8'; x.fillRect(c.dx > 0 ? 28 - L / 2 + 2 : 28 - L / 2 + 10, 31, L - 12, 1); }
      } else {
        x.fillStyle = '#6e4a2c'; x.fillRect(22, 28 - L / 2 + 4, 1, L + 4); x.fillRect(33, 28 - L / 2 + 4, 1, L + 4);
        x.fillStyle = '#c8b890'; x.fillRect(23, 28 - L / 2 + 6, 10, L);
        if (c.kind === 'body') { x.fillStyle = '#d8d0c0'; x.fillRect(23, 28 - L / 2 + 8, 10, L - 4); x.fillStyle = '#ece6d8'; x.fillRect(24, 28 - L / 2 + 8, 8, 2); }
        else if (occ) { const hd = sleepHead(occ.app), up = (c.dy || 0) < 0; x.drawImage(hd, 18, up ? 28 - L / 2 + 6 : 28 + L / 2 - hd.height); x.fillStyle = '#7a8aa8'; x.fillRect(23, up ? 28 - L / 2 + 18 : 28 - L / 2 + 8, 10, L - 16); }
      }
      cv.ox = 28; cv.gy = 46; return cv;
    }
    const pseudo = new Map();
    game.hooks.update.push(() => {
      const s = sim(); if (!s || game.scene || s.world !== game.world) return;
      const want = [];
      for (const b of s.bodies || []) if (!b.carried) { let a = pseudo.get('b' + b.id); if (!a) { a = { bodyOf: b, x: b.x, y: b.y, dir: 0, anim: 'lie', ft: 0, a: b.app }; pseudo.set('b' + b.id, a); } a.x = b.x; a.y = b.y; want.push(a); }
      for (const c of s.carries || []) if (c.stage === 'carry' && c.x != null) { let a = pseudo.get('c' + c.id); if (!a) { a = { carry: c, x: c.x, y: c.y, ft: 0 }; pseudo.set('c' + c.id, a); } a.x = c.x; a.y = c.y + 0.5; want.push(a); }
      const keys = new Set(want); for (const [k, a] of pseudo) if (!keys.has(a)) pseudo.delete(k);
      game.actors = [...game.actors.filter((a) => !a.bodyOf && !a.carry), ...want];
    });
    const _frame = game.actorFrame.bind(game);
    game.actorFrame = (a) => {
      if (a.carry) return stretcherFrame(a.carry);
      return _frame(a);
    };

    // your own cuts and bruises close up day by day
    let lastDay = null;
    game.hooks.update.push(() => { const s = sim(); if (!s) return; if (lastDay != null && s.day !== lastDay && PS.wounds) { for (const w of PS.wounds) w.sev -= 0.11; PS.wounds = PS.wounds.filter((w) => w.sev > 0.05); } lastDay = s.day; });

    // ---------- the puff of smoke at the morgue ----------
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = sim(); if (!s || !s.puffs || game.scene) return;
      for (const p of s.puffs) { p.t += 1 / 60; const n = 10, r = 4 + p.t * 18, al = Math.max(0, 0.8 - p.t * 0.8); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + p.t; ctx.fillStyle = `rgba(214,210,220,${al.toFixed(2)})`; const sz = 3 + Math.round(p.t * 3); ctx.fillRect(Math.round(p.x + Math.cos(a) * r - cam.x), Math.round(p.y - 14 + Math.sin(a) * r * 0.6 - p.t * 10 - cam.y), sz, sz); } }
      s.puffs = s.puffs.filter((p) => p.t < 1.1);
    });

    // ---------- wounds on people ----------
    const geo = new WeakMap();
    function bodyGeo(app) { let g = geo.get(app); if (g && g.v === app.cacheVer) return g; const hy = O.Char.headY(app), hip = O.Char.hipY(app, 'idle'), m = O.Char.bodyMetrics(app); g = { cy: hy.cy, ry: hy.ry, hip, sh: hip - m.torso, v: app.cacheVer }; geo.set(app, g); return g; }
    game.drawWounds = (ctx, a, fx, fy) => {
      const ws = a === game.player ? PS.wounds : a.person?.wounds;
      if (!ws || !ws.length || !a.a || a.anim === 'lie' || a.anim === 'sleep') return;
      const g = bodyGeo(a.a), front = a.dir === 0 || a.dir === 4 || a.dir === 5, back = a.dir === 3 || a.dir === 6 || a.dir === 7;
      for (const w of ws) {
        const r = O.RNG(w.seed || 1), k = Math.max(1, Math.round(w.sev * 3));
        let x = fx + 16, y = fy;
        if (w.part === 'face') { if (!front) continue; x += r.chance(0.5) ? -2 : 2; y += Math.round(g.cy + 1); }
        else if (w.part === 'arm') { x += r.chance(0.5) ? -6 : 6; y += Math.round(g.sh + 6); }
        else { x += r.int(-3, 3); y += Math.round(g.sh + 4 + r.int(0, 4)); if (back && w.kind === 'bruise') continue; }
        if (w.bandage && w.part !== 'face') { ctx.fillStyle = '#ece6d8'; ctx.fillRect(x - 2, y, 4, 2); ctx.fillStyle = '#c8b8a0'; ctx.fillRect(x - 2, y + 1, 4, 1); continue; }
        if (w.kind === 'bruise') { ctx.fillStyle = w.sev > 0.4 ? '#6a3a5a' : '#8a6a6a'; ctx.fillRect(x, y, Math.min(2, k), 1 + (k > 2 ? 1 : 0)); }
        else if (w.kind === 'stab') { ctx.fillStyle = '#8a1a1a'; ctx.fillRect(x, y, 1, 1); if (k > 1) { ctx.fillStyle = '#a83030'; ctx.fillRect(x, y + 1, 1, k - 1); } }
        else if (w.kind === 'slash') { ctx.fillStyle = '#9a2222'; for (let i = 0; i < k + 1; i++) ctx.fillRect(x - 1 + i, y + i - 1, 1, 1); }
        else { ctx.fillStyle = '#8a1a1a'; ctx.fillRect(x - 1, y, Math.min(3, k + 1), Math.min(2, k)); ctx.fillStyle = '#b8302a'; ctx.fillRect(x, y, 1, 1); }
      }
    };

    // ---------- picking up what's in the street ----------
    O.pickupCandidate = () => {
      const s = sim(); if (!s || game.scene || !s.dropped || !s.dropped.length) return null;
      const p = game.player; let best = null, bd = 18;
      for (const d of s.dropped) { const dd = Math.hypot(d.x - p.x, d.y - p.y); if (dd < bd) { bd = dd; best = d; } }
      return best ? { type: 'pickup', it: best, d: bd - 2, x: best.x, y: best.y - 8 } : null;
    };
    O.pickUp = (it) => {
      const s = sim(), G = O.Data.GOODS;
      if (it.good === 'coin') { PS.money += it.qty; s.pickUpDropped(it); return O.UI.say(`You pick up ₳${it.qty}.`); }
      let n = 0; for (let i = 0; i < it.qty; i++) if (PS.add(it.good)) n++;
      if (!n) return O.UI.say('Your satchel is full.');
      if (n < it.qty) it.qty -= n; else s.pickUpDropped(it);
      O.UI.say(`You pick up ${n > 1 ? n + ' ' : 'a '}${(G[it.good]?.name || it.good).toLowerCase()}.`);
      game.player.anim = 'pickup'; game.player.ft = 0; setTimeout(() => { if (game.player.anim === 'pickup') game.player.anim = 'idle'; }, 500);
    };
    // dropping something from the satchel
    O.dropItem = (k) => {
      const s = sim(); if (!PS.items.includes(k)) return;
      const i = PS.items.indexOf(k); PS.items.splice(i, 1);
      if (PS.equipped === k && !PS.items.includes(k)) PS.equipped = 'fists';
      if (game.scene) { const b = game.scene.b; s.drop(k, 1, b.doorX * s.T + 8 + (Math.random() - 0.5) * 10, (b.doorY + 1) * s.T + 4); }
      else s.drop(k, 1, game.player.x + 6, game.player.y + 2);
      O.UI.say(`You put down the ${(O.Data.GOODS[k]?.name || k).toLowerCase()}.`);
    };
  }
  O.AftermathFX = { setup };
})();
