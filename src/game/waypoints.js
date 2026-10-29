// Where to go. You keep track of what you're about (the person you were told to find, a meeting, your
// shift, the gang's job) and press N to choose which one to be shown the way to, or a place in the
// town. One arrow, for that alone: it circles you pointing the way, then settles over the place itself.
// Indoors it shows the way through: the stairs, the door of the room, or the way out.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const now = (s) => s.day * 1440 + s.minute;
    O.addLead = (l) => { PS.leads = (PS.leads || []).filter((x) => !(x.why === l.why && (x.id === l.id && x.b === l.b && String(x.tile) === String(l.tile))) && !(l.why === 'contract' && x.why === 'contract')); PS.leads.push(l); };
    O.dropLead = (pred) => { PS.leads = (PS.leads || []).filter((x) => !pred(x)); };

    // ---------------------------------------------------------------- the arrow
    // One arrow, and only for the place you chose. Far off it circles you, pointing the way; once the
    // place is in sight it glides over and settles above it, bobbing, pointing down at it.
    const st = { x: null, y: null, ang: 0, t: 0 };
    O.wayIs = (id) => PS.wayTo === id;
    O.guideArrow = (ctx, cam, tx, ty, label) => {
      if (PS.guides === 'off') return;
      const P = game.player, dt = Math.min(0.1, Math.max(0, game.t - (st.t || game.t))); st.t = game.t;
      const sx = P.x, sy = P.y - 18, dx = tx - sx, dy = ty - sy, dist = Math.hypot(dx, dy);
      const onScreen = tx - cam.x > 20 && tx - cam.x < game.vw - 20 && ty - cam.y > 40 && ty - cam.y < game.vh - 20;
      const hover = onScreen && dist < 260;
      const bob = Math.sin(game.t * 5);
      let wx, wy, wang;
      if (hover) { wx = tx; wy = ty - 10 + bob * 2.5; wang = Math.PI / 2; }
      else { const ang = Math.atan2(dy, dx), r = 34 + bob * 2; wx = sx + Math.cos(ang) * r; wy = sy + Math.sin(ang) * r; wang = ang; }
      if (st.x == null || Math.hypot(st.x - wx, st.y - wy) > 900) { st.x = wx; st.y = wy; st.ang = wang; }
      const k = 1 - Math.exp(-dt * (hover ? 9 : 14));
      st.x += (wx - st.x) * k; st.y += (wy - st.y) * k;
      let da = wang - st.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; st.ang += da * Math.min(1, k * 1.4);
      const ax = Math.round(st.x - cam.x), ay = Math.round(st.y - cam.y), ca = Math.cos(st.ang), sa = Math.sin(st.ang), blk = 2, sc = hover ? 0.8 : 0.9;
      const inside = (u, v) => { u /= sc; v /= sc; return (u >= 0 && u <= 6 && Math.abs(v) <= 6 - u) || (u >= -6 && u < 0 && Math.abs(v) <= 1.5); };
      const cells = []; for (let gy = -8; gy <= 8; gy++) for (let gx = -8; gx <= 8; gx++) { const u = gx * ca + gy * sa, v = -gx * sa + gy * ca; if (inside(u, v)) cells.push([gx, gy, u, v]); }
      ctx.fillStyle = '#1b1424'; for (const [x, y] of cells) ctx.fillRect(ax + x * blk - 1, ay + y * blk - 1, blk + 2, blk + 2);
      ctx.fillStyle = '#f0b45c'; for (const [x, y] of cells) ctx.fillRect(ax + x * blk, ay + y * blk, blk, blk);
      ctx.fillStyle = '#ffe2a0'; for (const [x, y, u, v] of cells) if (v < -0.5 && u > -1) ctx.fillRect(ax + x * blk, ay + y * blk, blk, 1);
      if (label && !hover) tag(ctx, ax, ay + 16, label);
      else if (label && hover && dist < 120) tag(ctx, ax, ay - 30, label);
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
    // ---------------------------------------------------------------- what you could be shown the way to
    const idOf = (l) => l.key || `${l.why}:${l.id ?? ''}:${l.b ?? ''}:${l.tile ?? ''}:${l.label || ''}`;
    function spotOf(s, l) {
      let x, y;
      if (l.at) { if (game.scene) { const w = O.wayOut(); if (!w) return null; return [w[0], w[1] - 30]; } return [l.at[0], l.at[1] - 30]; }
      if (l.id != null) {
        const q = s.byId.get(l.id); if (!q || q.alive === false) return null;
        if (game.scene) { const p = inScene(s, q); if (!p) return null; return [p[0], p[1] - (game.scene.actors.get(q.id) ? 46 : 30)]; }
        if (q.agent.hidden || q.agent.inside != null) { const b = q.agent.inside != null && s.building(q.agent.inside); if (!b || b.doorX == null) return null; return [b.doorX * T + 8, b.doorY * T - 20]; }
        return [q.agent.x, q.agent.y - 46];
      }
      if (l.b != null) {
        if (game.scene) { if ((game.scene.b.parent || game.scene.b).id === l.b) return null; const w = O.wayOut(); if (!w) return null; return [w[0], w[1] - 30]; }
        const b = s.building(l.b); if (!b || b.doorX == null) return null; return [b.doorX * T + 8, b.doorY * T - 20];
      }
      if (l.tile) { if (game.scene) { const w = O.wayOut(); if (!w) return null; return [w[0], w[1] - 30]; } x = l.tile[0] * T + 8; y = l.tile[1] * T - 14; return [x, y]; }
      return null;
    }
    // every way you might want showing, here and now
    function choices(s) {
      const t = now(s), out = [];
      PS.leads = (PS.leads || []).filter((l) => l.until > t);
      for (const l of PS.leads) if (l.place === s.world.placeId && !(l.from != null && t < l.from - 120)) out.push({ id: idOf(l), label: l.label || 'Somewhere to go', l });
      const pre = O.preShiftTarget && O.preShiftTarget(); if (pre) out.push({ id: 'shift', label: pre.label, l: Object.assign({ place: s.world.placeId }, pre) });
      if (O.jobWayTarget) { const j = O.jobWayTarget(); if (j) out.push({ id: 'job', label: j.label, job: true }); }
      for (const m of (O.GangLife ? O.GangLife.mine() : [])) if (m.place === s.world.placeId && m.task && !m.task.done && m.task.at) out.push({ id: 'gang:' + m.gid, label: m.task.text, l: { at: m.task.at } });
      return out;
    }
    // places of the town anyone could name
    function townPlaces(s) {
      const out = [], seen = new Set(), add = (b, label) => { if (!b || b.doorX == null || seen.has(label)) return; seen.add(label); out.push({ label, b: b.id }); };
      const home = s.world.buildings.find((b) => b.owner?.kind === 'player') || (PS.lease && s.building(PS.lease.b)) || (PS.partner && PS.partner.stage === 'married' && PS.partner.place === s.world.placeId && s.byId.get(PS.partner.id) && s.building(s.byId.get(PS.partner.id).home));
      if (home) add(home, 'Home');
      for (const ty of ['tavern', 'chapel', 'store', 'bakery', 'smithy', 'doctor', 'guard', 'townhall', 'stable', 'butcher', 'tailor', 'moneylender', 'posthouse'])
        for (const bz of s.biz.values()) if (bz.type === ty && bz.b) { add(bz.b, bz.name); break; }
      if (s.world.zones && s.world.zones.square) { const z = s.world.zones.square; out.push({ label: 'The square', tile: [Math.round((z[0] + z[2]) / 2), Math.round((z[1] + z[3]) / 2)] }); }
      return out;
    }
    O.openWays = () => {
      const s = cur(); if (!s) return;
      const list = choices(s), places = townPlaces(s), esc = O.escape;
      const btn = (id, label, on) => `<button data-way="${esc(id)}" style="display:block;width:100%;text-align:left;margin:3px 0"${on ? ' class="on"' : ''}>${on ? '▶ ' : ''}${esc(label)}</button>`;
      O.Panels.open('Where to?', `${list.length ? `<div class="lbl">What you're about</div>${list.map((c) => btn(c.id, c.label, PS.wayTo === c.id)).join('')}` : ''}
        <div class="lbl" style="margin-top:8px">${esc(s.world.name)}</div>${places.map((p, i) => btn('place:' + i, p.label, PS.wayTo === 'place:' + p.label)).join('')}
        ${PS.wayTo ? `<div style="margin-top:8px">${btn('', 'Nowhere: put the arrow away', false)}</div>` : ''}`, (root) => {
        root.querySelectorAll('[data-way]').forEach((b) => b.onclick = () => {
          const id = b.dataset.way;
          if (id.startsWith('place:')) { const p = places[+id.slice(6)]; const key = 'place:' + p.label; O.addLead({ place: s.world.placeId, b: p.b, tile: p.tile, why: 'chosen', key, label: p.label, until: now(s) + 1440 }); PS.wayTo = key; }
          else PS.wayTo = id || null;
          O.Panels.close();
        });
      });
    };
    // someone told you the way: you may have it marked, or not
    let offerEl = null;
    O.offerWay = (l) => {
      if (!offerEl) { offerEl = document.createElement('div'); offerEl.className = 'wayoffer'; (document.getElementById('tab-play') || document.body).appendChild(offerEl); }
      const key = idOf(l);
      offerEl.innerHTML = `<span>${O.escape(l.label)}</span><button data-y>Mark the way</button><button data-n>No</button>`;
      offerEl.hidden = false; clearTimeout(offerEl._t); offerEl._t = setTimeout(() => { offerEl.hidden = true; }, 12000);
      offerEl.querySelector('[data-y]').onclick = () => { PS.wayTo = key; offerEl.hidden = true; };
      offerEl.querySelector('[data-n]').onclick = () => { offerEl.hidden = true; };
    };
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyN' || e.repeat || O.panelOpen || O.UI.dialogOpen() || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
      if (document.getElementById('tab-play')?.hidden) return;
      e.preventDefault(); O.openWays();
    });
    // ---------------------------------------------------------------- the chosen way
    game.hooks.drawTop.push((ctx, cam) => {
      const s = cur(); if (!s || O.panelOpen || !PS.wayTo || PS.wayTo === 'job') return;
      const c = choices(s).find((x) => x.id === PS.wayTo);
      if (!c) { if (!(PS.leads || []).some((l) => idOf(l) === PS.wayTo)) PS.wayTo = null; return; } // done with, or elsewhere
      const p = spotOf(s, c.l); if (!p) return;
      // there: the arrow has done its work
      const l = c.l, P = game.player;
      if (!game.scene && (l.b != null || l.tile) && l.id == null && Math.hypot(p[0] - P.x, p[1] + 20 - P.y) < 30) { if (l.why === 'chosen' || l.why === 'directions') O.dropLead((x) => x === l); PS.wayTo = null; return; }
      if (game.scene && l.b != null && (game.scene.b.parent || game.scene.b).id === l.b) { if (l.why === 'chosen' || l.why === 'directions') O.dropLead((x) => x === l); PS.wayTo = null; return; }
      O.guideArrow(ctx, cam, p[0], p[1], c.label);
    });
  }
  O.WaypointsSetup = { setup };
})();
