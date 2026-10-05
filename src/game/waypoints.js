// Where to go. Several arrows at once (the person you were told to find, a bounty, your shift), each
// tied to what it's for: give the thing up and its arrow goes too. An arrow near you points the way and
// shrinks as you close in, until only the mark over the place (or the person) is left. Indoors it shows
// you the way through: the stairs, the door of the room, or the way out.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const now = (s) => s.day * 1440 + s.minute;
    O.addLead = (l) => { PS.leads = (PS.leads || []).filter((x) => !(x.why === l.why && (x.id === l.id && x.b === l.b && String(x.tile) === String(l.tile))) && !(l.why === 'contract' && x.why === 'contract')); PS.leads.push(l); };
    O.dropLead = (pred) => { PS.leads = (PS.leads || []).filter((x) => !pred(x)); };

    // ---------------------------------------------------------------- the arrow
    // drawn in 2-pixel blocks, outlined; it sits between you and the place, smaller the nearer you are
    // (tx, ty) is the mark itself: the arrow travels toward it and, close by, shrinks into it
    O.guideArrow = (ctx, cam, tx, ty, label) => {
      if (PS.guides === 'off' || PS.guides === 'marks') return;
      const P = game.player, sx = P.x, sy = P.y - 16, dx = tx - sx, dy = ty - sy, dist = Math.hypot(dx, dy);
      if (dist < 26) return; // merged into the mark
      const ang = Math.atan2(dy, dx), scale = O.clamp(dist / 320, 0.35, 1), vw = game.vw, vh = game.vh;
      const px = sx - cam.x, py = sy - cam.y, mx = 22, top = 70, bot = 26;
      const edge = Math.min(Math.abs((Math.cos(ang) > 0 ? vw - mx - px : px - mx) / (Math.cos(ang) || 1e-6)), Math.abs((Math.sin(ang) > 0 ? vh - bot - py : py - top) / (Math.sin(ang) || 1e-6)));
      const k = Math.max(14, Math.min(edge, dist - 10 * scale)), ax = Math.round(px + Math.cos(ang) * k), ay = Math.round(py + Math.sin(ang) * k);
      const blk = 2, snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4), ca = Math.round(Math.cos(snap) * 1000) / 1000, sa = Math.round(Math.sin(snap) * 1000) / 1000, grow = scale * (Math.floor(game.t * 4) % 2 ? 1.1 : 1);
      const inside = (u, v) => { u /= grow; v /= grow; const diag = Math.abs(ca) > 0.1 && Math.abs(sa) > 0.1, w = diag ? 1.2 : 1.6; return (u >= 0 && u <= 7 && Math.abs(v) <= 7 - u) || (u >= -7 && u < 0 && Math.abs(v) <= w); };
      const cells = []; for (let gy = -10; gy <= 10; gy++) for (let gx = -10; gx <= 10; gx++) { const u = gx * ca + gy * sa, v = -gx * sa + gy * ca; if (inside(u, v)) cells.push([gx, gy, u]); }
      ctx.fillStyle = '#1b1424'; for (const [x, y] of cells) ctx.fillRect(ax + x * blk - 2, ay + y * blk - 2, blk + 4, blk + 4);
      ctx.fillStyle = '#f0b45c'; for (const [x, y] of cells) ctx.fillRect(ax + x * blk, ay + y * blk, blk, blk);
      ctx.fillStyle = '#ffe2a0'; for (const [x, y, u] of cells) if (u > 3 * grow) ctx.fillRect(ax + x * blk, ay + y * blk, blk, 1);
      if (label && dist > 90) tag(ctx, ax, ay + 14 * scale + 8, label);
    };
    // a small label: what the marker is for
    const tag = (ctx, x, y, text) => {
      ctx.font = '8px Silkscreen, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const t2 = text.length > 34 ? text.slice(0, 33) + '…' : text, w = ctx.measureText(t2).width;
      x = Math.max(w / 2 + 6, Math.min(game.vw - w / 2 - 6, x)); y = Math.max(4, Math.min(game.vh - 16, y)); // kept on the screen
      ctx.fillStyle = 'rgba(27,20,36,.82)'; ctx.fillRect(Math.round(x - w / 2 - 3), Math.round(y - 2), Math.round(w + 6), 12);
      ctx.fillStyle = '#ffe2a0'; ctx.fillText(t2, Math.round(x), Math.round(y)); ctx.textAlign = 'start';
    };
    O.guideTag = tag;
    const mark = (ctx, cam, x, y) => { const bob = Math.round(Math.sin(game.t * 4) * 2); x = Math.round(x - cam.x); y = Math.round(y - cam.y) + bob; ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 3, y - 1, 7, 5); ctx.fillRect(x - 1, y + 4, 3, 2); ctx.fillStyle = '#f0b45c'; ctx.fillRect(x - 2, y, 5, 3); ctx.fillRect(x, y + 3, 1, 2); };

    // ---------------------------------------------------------------- indoors: the way through
    O.wayOut = () => { const sc = game.scene; if (!sc) return null; const st = sc.L.items.find((i) => i.kind === 'stairs' && !i.stairs); if (sc.floor > 0 && st) { const [x, y] = sc.anchor(st); return [x, y + 10]; } return sc.wayIn(); };
    // where in this building someone is, as a spot in the scene you're in: them, the room door, or the stairs toward them
    function inScene(s, q) {
      const sc = game.scene; if (!sc) return null;
      const a = sc.actors.get(q.id); if (a && !a.leaving) return [a.x, a.y];
      const b = sc.b, keep = b.parent || b;
      if (q.agent.inside !== keep.id) return O.wayOut(); // they're not in here: the way out
      if (keep.royal && O.Castle) {
        const key = O.Castle.where(q, keep, s), plan = O.Castle.plan(keep, s), room = plan.all.find((r) => r.roomKey === key), fl = room ? room.roomFloor || 0 : +String(key).replace('f', '') || 0;
        if (b.parent) return O.wayOut(); // you're in a room and they're not: back out to the hall
        if (fl === sc.floor && room) { const d = sc.L.items.find((i) => i.kind === 'roomdoor' && i.room === room.roomKey); if (d) { const [x, y] = sc.anchor(d); return [x, d.front ? y - 12 : y + 14]; } }
        const st = sc.L.items.find((i) => i.kind === 'stairs' && (fl > sc.floor ? i.stairs : !i.stairs)); if (st) { const [x, y] = sc.anchor(st); return [x, y + 10]; }
        return null;
      }
      // another floor of a house or an inn
      const st = sc.L.items.find((i) => i.kind === 'stairs'); if (st) { const [x, y] = sc.anchor(st); return [x, y + 10]; }
      return null;
    }

    // ---------------------------------------------------------------- your markers on the map of the realm
    let mapWrapped = false;
    game.hooks.update.push(() => {
      if (mapWrapped || !O.openMap) return; mapWrapped = true;
      const _open = O.openMap;
      O.openMap = () => {
        _open();
        const cv = document.getElementById('kmap'), wrap = cv && cv.parentElement, E = O.Eldoria, K = O.SimRef.home.kingdom; if (!wrap || !E) return;
        const t = now(cur()), byPlace = new Map();
        for (const l of PS.leads || []) if (l.until > t && l.place) { const a = byPlace.get(l.place) || []; if (!a.includes(l.label || 'somewhere to go')) a.push(l.label || 'somewhere to go'); byPlace.set(l.place, a); }
        if (PS.coronation && !PS.coronation.done) { const a = byPlace.get(PS.coronation.place) || []; if (!a.includes('Your coronation')) a.push('Your coronation'); byPlace.set(PS.coronation.place, a); }
        for (const [pid, labels] of byPlace) { const pl = K.place(pid); if (!pl) continue; const m = document.createElement('span'); m.className = 'maplabel lead'; m.textContent = '▼ ' + labels.join(' / '); m.style.left = (pl.x / E.W * 100) + '%'; m.style.top = ((pl.y - 3.2) / E.H * 100) + '%'; wrap.appendChild(m); }
        const info = document.getElementById('mapinfo');
        if (info && byPlace.size) info.insertAdjacentHTML('afterend', `<p class="caption"><b>Your markers:</b> ${[...byPlace].map(([pid, ls]) => `${O.escape(ls.join(', '))} (${O.escape(K.place(pid)?.name || pid)})`).join('; ')}</p>`);
      };
    });
    // ---------------------------------------------------------------- drawing the leads
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      const s = cur(); if (!s || O.panelOpen) return;
      const t = now(s), vis = (x, y) => x - cam.x > -8 && x - cam.x < game.vw + 8 && y - 40 - cam.y > 0 && y - cam.y < game.vh + 8;
      PS.leads = (PS.leads || []).filter((l) => l.until > t);
      const list = PS.leads.slice(); const pre = O.preShiftTarget && O.preShiftTarget(); if (pre) list.push(Object.assign({ place: s.world.placeId, why: 'shift' }, pre));
      const seen = new Map();
      if (PS.guides === 'off') return;
      for (const l of list) {
        if (l.place !== s.world.placeId) continue;
        let x, y, over = 46;
        if (l.id != null) {
          const q = s.byId.get(l.id); if (!q || q.alive === false) continue;
          if (game.scene) { const p = inScene(s, q); if (!p) continue; [x, y] = p; over = game.scene.actors.get(q.id) ? 46 : 30; }
          else if (q.agent.hidden || q.agent.inside != null) { const b = q.agent.inside != null && s.building(q.agent.inside); if (!b || b.doorX == null) continue; x = b.doorX * T + 8; y = b.doorY * T - 8; over = 44; }
          else { x = q.agent.x; y = q.agent.y; }
        } else if (l.b != null) {
          if (game.scene) { if ((game.scene.b.parent || game.scene.b).id === l.b) continue; const w = O.wayOut(); if (!w) continue; [x, y] = w; over = 30; }
          else { const b = s.building(l.b); if (!b || b.doorX == null) continue; x = b.doorX * T + 8; y = b.doorY * T - 8; over = 44; }
        } else if (l.tile) {
          if (game.scene) { const w = O.wayOut(); if (!w) continue; [x, y] = w; over = 30; }
          else { x = l.tile[0] * T + 8; y = l.tile[1] * T + 8; over = 30; }
        } else continue;
        // two things in the same place get one marker, with both their names on it
        const key = Math.round(x / 8) + ':' + Math.round(y / 8);
        if (seen.has(key)) { const m = seen.get(key); if (l.label && !m.labels.includes(l.label)) m.labels.push(l.label); continue; }
        seen.set(key, { x, y: y - over, labels: [l.label || 'Somewhere to go'] });
      }
      const P = game.player;
      for (const m of seen.values()) {
        const label = m.labels.join(' / ');
        if (vis(m.x, m.y + 40)) { mark(ctx, cam, m.x, m.y); if (Math.hypot(P.x - m.x, P.y - m.y) < 200) tag(ctx, Math.round(m.x - cam.x), Math.round(m.y - cam.y) - 16, label); }
        O.guideArrow(ctx, cam, m.x, m.y + 2, label);
      }
    });
  }
  O.WaypointsSetup = { setup };
})();
