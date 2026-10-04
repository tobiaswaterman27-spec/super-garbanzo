// Indoor scene: renders a building's floor, places the residents who are actually inside it where
// their business puts them — asleep in their own beds under the covers, at the table facing it, in
// the pews facing the altar, behind the counter, at the bench — shows stock levels on shelves and
// in sacks, and handles collision, stairs and leaving by the door.
'use strict';
(function () {
  const T = 16, Ch = O.Char;
  const SLEEPY = new Set(['sleep', 'sick']);

  class Indoor {
    constructor(game, sim, b, floor = 0) {
      this.game = game; this.sim = sim; this.b = b; this.floor = floor;
      this.L = O.Interior.interior(b, floor, sim);
      this.R = this.L.room;
      this.actors = new Map(); // person id -> scene actor
      this.t = 0;
    }
    // floor tile -> scene pixel (feet position, middle of the tile)
    tileXY(tx, ty) { return [this.R.SW + tx * T + 8, this.R.WH + ty * T + 12]; }
    anchor(it) { return [this.R.SW + (it.tx + it.fw / 2) * T, this.R.WH + (it.ty + it.fh) * T - 1]; }
    rect(it) { const x = this.R.SW + it.tx * T, y = this.R.WH + it.ty * T; return [x, y, x + it.fw * T, y + it.fh * T]; }
    enterAt(fromStairs) {
      const p = this.game.player, L = this.L;
      const st = L.items.find((i) => i.kind === 'stairs');
      if ((fromStairs || L.dc < 0) && st) { [p.x, p.y] = this.tileXY(st.tx, st.ty + st.fh); p.x += 8; p.y += 2; p.dir = 0; }
      else { p.x = this.R.SW + (L.dc + 1) * T; p.y = this.R.WH + (L.d - 1) * T + 12; p.dir = 3; }
    }
    blocked(x, y) {
      const R = this.R, L = this.L;
      const test = (px, py) => {
        const tx = Math.floor((px - R.SW) / T), ty = Math.floor((py - R.WH) / T);
        if (py < R.WH + 5) return true;
        if (tx < 0 || tx >= L.w) return true;
        if (ty >= L.d) return !(this.floor === 0 && (tx === L.dc || tx === L.dc + 1));
        return L.grid[ty * L.w + tx] === 1;
      };
      return test(x - 4, y - 3) || test(x + 3, y - 3) || test(x - 4, y) || test(x + 3, y);
    }
    update(dt) {
      this.t += dt;
      const p = this.game.player;
      if (this.floor === 0 && p.y > this.R.WH + this.L.d * T + 4) this.game.exitBuilding();
      this.placeActors();
    }

    // Who is inside, and where do they belong right now?
    placeActors() {
      const sim = this.sim, L = this.L, b = this.b;
      const inside = sim.people.filter((q) => q.agent.inside === b.id && q.alive !== false).sort((a, c) => a.id - c.id);
      const twoF = b.floors >= 2;
      const used = new Set(), seen = new Set();
      const seats = L.items.filter((i) => i.seat && i.kind !== 'pew');
      const pews = L.items.filter((i) => i.kind === 'pew');
      const counters = L.items.filter((i) => i.counter);
      const idleTiles = []; for (let y = 1; y < L.d; y++) for (let x = 0; x < L.w; x++) if (!L.grid[y * L.w + x] && L.reachable[y * L.w + x] && !(this.floor === 0 && Math.abs(x - L.dc - 0.5) <= 1.5 && y >= L.d - 2)) idleTiles.push([x, y]);
      // which floor is each person on?
      const floorOf = (q) => {
        const act = q.activity?.act;
        if (!twoF) return 0;
        if (b.type === 'tavern') return act === 'rest' || (SLEEPY.has(act) && q.home !== b.id) || (SLEEPY.has(act) && q.home === b.id) ? 1 : 0;
        if (['house', 'mansion', 'townhouse', 'keep', 'tenement'].includes(b.type)) return SLEEPY.has(act) && b.id !== sim.docId ? 1 : act === 'home' && q.id % 3 === 0 ? 1 : 0;
        return SLEEPY.has(act) && q.home === b.id ? 1 : 0; // a shop: the family lives upstairs
      };
      const here = inside.filter((q) => floorOf(q) === this.floor);
      // ---- beds: couples together, babies in cradles, then everyone else
      const slots = [];
      for (const it of L.items) if (it.bed) for (let k = 0; k < (it.slots || 1); k++) slots.push({ it, k });
      const sleepers = here.filter((q) => SLEEPY.has(q.activity?.act) || q.activity?.act === 'treated');
      const bedOf = new Map();
      const take = (q, pred) => { const s = slots.find((x) => !x.taken && pred(x)); if (s) { s.taken = q; bedOf.set(q.id, s); return true; } return false; };
      for (const q of sleepers) if (q.activity?.act === 'treated' || (q.activity?.act === 'sick' && b.id === sim.docId)) take(q, (s) => s.it.kind === 'medbed');
      for (const q of sleepers) {
        if (bedOf.has(q.id)) continue;
        const sp = q.spouse && sleepers.find((z) => z.id === q.spouse);
        if (sp && !bedOf.has(sp.id)) { const s = slots.find((x) => !x.taken && x.it.slots === 2 && x.k === 0); if (s) { s.taken = q; bedOf.set(q.id, s); const s2 = slots.find((x) => x.it === s.it && x.k === 1); s2.taken = sp; bedOf.set(sp.id, s2); continue; } }
      }
      for (const q of sleepers) if (!bedOf.has(q.id) && q.age < 3) take(q, (s) => s.it.cradle);
      for (const q of sleepers) if (!bedOf.has(q.id)) take(q, (s) => !s.it.cradle && s.it.slots === 1 && !s.it.medbed);
      for (const q of sleepers) if (!bedOf.has(q.id)) take(q, (s) => !s.it.cradle && !s.it.medbed);
      // children squeeze in together rather than sleep on the floor
      for (const q of sleepers) if (!bedOf.has(q.id) && q.age < 14) { const s = slots.find((x) => x.taken && x.taken.age < 14 && !x.extra && !x.it.cradle); if (s) { s.extra = q; bedOf.set(q.id, { it: s.it, k: 1, share: true }); } }
      this.sleeping = new Map(); // bed item -> [{ q, k }]
      for (const [id, s] of bedOf) { const q = sim.byId.get(id); const arr = this.sleeping.get(s.it) || []; arr.push({ q, k: s.share ? (s.it.slots === 2 ? 1 : 0.5) : s.k }); this.sleeping.set(s.it, arr); }
      const pewCount = new Map();
      for (const q of here) {
        const act = q.activity?.act;
        let x, y, dir = 0, anim = 'idle', spot = null, inBed = false, seat = null, sortY = null;
        if (bedOf.has(q.id)) { inBed = true; spot = bedOf.get(q.id).it; [x, y] = this.anchor(spot); }
        else if (act === 'jailed') { const c = L.items.find((i) => i.cell); if (c) { const [ax, ay] = this.anchor(c); x = ax + ((q.id % 3) - 1) * 12; y = ay - 10; anim = 'sit'; dir = 0; } }
        else if (SLEEPY.has(act)) { // no bed free: dozing in a chair, never on the floor
          spot = seats.find((i) => !used.has(i)); if (spot) { seat = spot; anim = 'doze'; }
        }
        else if (act === 'work' || (act === 'pickup' && q.job?.biz === b.id)) {
          const role = q.job?.role;
          spot = L.items.find((i) => !used.has(i) && i.work && i.work.includes(role)) || counters.find((i) => !used.has(i));
          if (spot) {
            const [ax, ay] = this.anchor(spot), [rx0, ry0] = this.rect(spot);
            const behind = spot.counter || spot.kind === 'desk' || spot.kind === 'altar' || spot.kind === 'bar';
            if (behind) { x = ax + (spot.kind === 'bar' ? ((q.id % 3) - 1) * 18 : 0); y = ry0 - 2; dir = 0; anim = q.agent.talking ? 'talk' : 'idle'; if (spot.kind === 'desk') { anim = 'read'; } }
            else { x = ax; y = ay + 12; dir = 3; anim = spot.kind === 'medbed' ? 'idle' : 'work'; }
            if (spot.kind === 'altar') { anim = (Math.floor(this.t / 8) + q.id) % 2 ? 'read' : 'talk'; }
            if (spot.kind === 'cauldron') anim = 'cook';
            if (spot.kind === 'bar' && q.agent.talking) anim = 'talk';
            void rx0;
          }
        } else if (act === 'perform') { // a bard plays by the hearth
          const c = L.items.find((i) => i.kind === 'fireplace') || L.items.find((i) => i.kind === 'bar'); const [ax, ay] = c ? this.anchor(c) : this.tileXY(Math.floor(L.w / 2), 2);
          x = ax + (c && c.kind === 'bar' ? -40 : 0); y = ay + 26; dir = 0; anim = (Math.floor(this.t / 4) % 3) ? 'talk' : 'idle';
        } else if (act === 'mourn' || act === 'wedding' || act === 'worship' || act === 'lessons') {
          const p = pews.find((i) => (pewCount.get(i) || 0) < (i.seats || i.fw));
          if (p) { const k = pewCount.get(p) || 0; pewCount.set(p, k + 1); const [rx0] = this.rect(p); x = rx0 + 8 + k * T; y = this.anchor(p)[1] - 2; sortY = this.anchor(p)[1] + 0.6; dir = 3; anim = act === 'mourn' ? 'mourn' : act === 'wedding' && k % 3 === 0 ? 'celebrate' : 'sit'; if (anim === 'mourn') anim = 'sit'; spot = p; seat = { pewSeat: true, it: p }; }
          else { const t = idleTiles[(q.id * 7) % Math.max(1, idleTiles.length)] || [1, L.d - 3]; [x, y] = this.tileXY(t[0], t[1]); dir = 3; anim = act === 'mourn' ? 'mourn' : 'idle'; } // standing at the back
        } else if (['socialise', 'eat-out', 'eat', 'rest', 'gangmeet', 'feast'].includes(act) || (act === 'home' && q.stage !== 'baby')) {
          if (!(act === 'home' && q.id % 3 === 0)) { spot = seats.find((i) => !used.has(i)); if (spot) seat = spot; }
          if (spot && b.type === 'tavern' && act === 'socialise') anim = (Math.floor(this.t / 3) + q.id) % 3 ? 'drink' : 'talk';
        } else if (act === 'shop' || act === 'deliver' || act === 'pickup' || act === 'carry-home' || act === 'import') {
          const c = counters[0];
          if (c) { const [ax] = this.anchor(c), [, , , ry1] = this.rect(c); x = ax + ((q.id % 3) - 1) * 14; y = ry1 + 12; dir = 3; anim = q.agent.carrying ? 'carry' : 'idle'; }
        }
        if (seat && !seat.pewSeat) { // sat in a chair, facing the way it faces
          const [ax, ay] = this.anchor(seat), r = seat.rot || 0;
          dir = [0, 1, 2, 3][r]; x = ax + (r === 1 ? 2 : r === 2 ? -2 : 0); y = ay + (r === 0 ? -3 : r === 3 ? -3 : 1); sortY = ay + 0.6;
          if (anim === 'idle') anim = 'sit';
          if (anim !== 'doze' && anim !== 'sit') anim = anim === 'drink' ? 'drink' : 'talk';
        }
        if (x == null && !inBed) { const t = idleTiles[(q.id * 7) % Math.max(1, idleTiles.length)] || [0, 1]; [x, y] = this.tileXY(t[0], t[1]); x += (q.id % 3) * 3 - 3; dir = (q.id + Math.floor(this.t / 6)) % 8; anim = q.agent.talking ? 'talk' : q.stage === 'baby' ? 'crouch' : 'idle'; }
        if (spot && spot.kind !== 'pew' && spot.kind !== 'bar') used.add(spot);
        let a = this.actors.get(q.id);
        if (!a) { a = { ft: Math.random() * 2, person: q, a: q.app }; this.actors.set(q.id, a); }
        if (q.agent.frozen) { anim = anim === 'sit' ? 'sit' : 'talk'; dir = a.dir ?? dir; }
        Object.assign(a, { x, y, sortY, dir: q.agent.frozen ? a.dir : dir, anim, a: q.app, hidden: inBed, inBed: inBed ? spot : null, seat: seat && !seat.pewSeat ? seat : seat?.pewSeat ? seat.it : null });
        seen.add(q.id);
      }
      for (const id of [...this.actors.keys()]) if (!seen.has(id)) this.actors.delete(id);
    }

    camera() {
      const g = this.game, R = this.R, p = g.player;
      const cx = R.W <= g.vw ? Math.round((R.W - g.vw) / 2) : Math.round(O.clamp(p.x - g.vw / 2, 0, R.W - g.vw));
      const cy = R.H <= g.vh ? Math.round((R.H - g.vh) / 2) : Math.round(O.clamp(p.y - 20 - g.vh / 2, 0, R.H - g.vh));
      return { x: cx, y: cy };
    }

    sprite(it, v) {
      const rot = it.kind === 'pew' || it.kind === 'bar' || it.kind === 'rug' ? it.width || it.fw : it.rot || 0;
      let sp = O.Furn.furniture(it.kind, v, it.seed, it.kind === 'bed' && rot === 2 ? 1 : rot);
      if (it.kind === 'bed' && it.rot === 2) sp = O.Furn.mirrored(sp);
      return sp;
    }

    // a sleeper's head on the pillow: the top of their own frame, eyes shut
    headOf(q) {
      const fr = Ch.frame(q.app, 0, 'sleep', 0), hy = Ch.headY(q.app);
      const c = document.createElement('canvas'), top = Math.max(0, Math.round(hy.cy - hy.ry - 4)), h = Math.round(hy.ry * 2 + 6);
      c.width = 20; c.height = h; c.getContext('2d').drawImage(fr, 6, top, 20, h, 0, 0, 20, h);
      c.cy = hy.ry + 4; return c;
    }
    drawSleepers(ctx, it, sp, ax, ay, cam) {
      let list = this.sleeping && this.sleeping.get(it);
      const pl = this.game.player;
      if (pl.inBed === it) { list = [...(list || []).filter((s) => s.k !== 0), { q: (pl._sleepQ && pl._sleepQ.app === pl.a ? pl._sleepQ : (pl._sleepQ = { app: pl.a, id: -1 })), k: 0 }]; }
      if (!list) return;
      for (const { q, k } of list) {
        const pi = sp.pillows ? sp.pillows[Math.min(sp.pillows.length - 1, Math.floor(k))] : [0, -20];
        const hc = q._headCanvas && q._headVer === q.app.cacheVer ? q._headCanvas : (q._headCanvas = this.headOf(q), q._headVer = q.app.cacheVer, q._headCanvas);
        let px = ax + pi[0] + (k === 0.5 ? 5 : 0), py = ay + pi[1];
        if (it.kind === 'bed' && it.rot) { // head on the pillow at the wall end, turned on its side
          ctx.save(); ctx.translate(Math.round(px - cam.x), Math.round(py - cam.y)); ctx.rotate(it.rot === 1 ? -Math.PI / 2 : Math.PI / 2); ctx.drawImage(hc, -10, -hc.cy - 1); ctx.restore();
        } else ctx.drawImage(hc, Math.round(px - 10 - cam.x), Math.round(py - hc.cy + 3 - cam.y));
        // drifting Zs over whoever is fast asleep
        if (q.id === -1 || (q.id + Math.floor(this.t)) % 3 === 0) { const zt = (this.t * 0.6 + (q.id & 7) * 0.13) % 1; ctx.globalAlpha = 1 - zt; ctx.fillStyle = '#e8e4f0'; const zx = Math.round(px + 6 + zt * 6 - cam.x), zy = Math.round(py - 12 - zt * 12 - cam.y); ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1); ctx.globalAlpha = 1; }
      }
    }

    draw(ctx) {
      const g = this.game, cam = g.cam, R = this.R, L = this.L, sim = this.sim;
      ctx.fillStyle = '#0d0a12'; ctx.fillRect(0, 0, g.vw, g.vh);
      ctx.drawImage(R.canvas, -cam.x, -cam.y);
      const night = g.isNight();
      if (night) { ctx.fillStyle = '#141a2c'; for (const w of R.windows) ctx.fillRect(w.x - cam.x, w.y - cam.y, w.w, w.h); }
      const bz = sim.biz.get(this.b.id);
      const drawables = [];
      for (const it of L.items) {
        let v = it.v;
        if (it.kind === 'shelf' || it.kind === 'rack') { const gd = it.stockGood; if (bz && gd) { const tgt = bz.def.targets[gd] || 10; v = Math.round(3 * O.clamp((bz.stock[gd] || 0) / tgt, 0, 1)); if (it.kind === 'rack') v = 0; } else v = 2; }
        // sacks and barrels holding stock disappear as the stock runs down
        if (it.stockOf && bz && O.Data.GOODS[it.stockOf]) {
          const same = L.items.filter((i) => i.stockOf === it.stockOf); const k = same.indexOf(it);
          const ratio = O.clamp((bz.stock[it.stockOf] || 0) / (bz.def.targets[it.stockOf] || 10), 0, 1);
          if (k >= Math.ceil(ratio * same.length)) continue;
        }
        const sp = this.sprite(it, v);
        const [ax, ay] = this.anchor(it);
        const at = (c) => ctx.drawImage(c, Math.round(ax - sp.ox - cam.x), Math.round(ay - sp.oy - cam.y));
        drawables.push({ y: sp.flat ? -1 : ay - (it.kind === 'pew' ? 1 : 0), draw: () => {
          at(sp.canvas);
          if (sp.fire) { const lit = !this.b.sprite?.chimney || !g.lit || g.lit.has(this.b.id) || it.kind === 'cauldron'; this.drawFire(ctx, ax + sp.fire.x - cam.x, ay + sp.fire.y - cam.y, Object.assign({}, sp.fire, { coals: sp.fire.coals || !lit })); }
          if (sp.candles && (night || it.kind === 'altar' || it.kind === 'candlestand')) for (const [cx, cy] of sp.candles) this.flame(ctx, ax + cx - cam.x, ay + cy - cam.y, 1);
          if (sp.cover) { this.drawSleepers(ctx, it, sp, ax, ay, cam); at(sp.cover); }
        } });
        if (sp.back) drawables.push({ y: ay + 4, draw: () => at(sp.back) }); // a chair or pew back in front of whoever sits in it
      }
      for (const a of this.actors.values()) if (!a.hidden) drawables.push({ y: a.sortY ?? a.y, draw: () => this.drawActor(ctx, a, cam, a.anim !== 'sit' && a.anim !== 'doze') });
      const p = g.player; if (!p.inBed) drawables.push({ y: p.y, draw: () => this.drawActor(ctx, p, cam, true) });
      drawables.sort((a, c) => a.y - c.y);
      for (const d of drawables) d.draw();
      for (const h of g.hooks.drawWorld) h(ctx, cam);
      // lighting: dim interior, warm pools around fires and candles, daylight under windows and at the door
      const amb = night ? [58, 52, 88] : g.ambient().map((c, k) => Math.round(c * [0.86, 0.82, 0.78][k]));
      const pools = [];
      for (const it of L.items) {
        const [ax, ay] = this.anchor(it);
        if (it.kind === 'fireplace' || it.kind === 'oven' || it.kind === 'forge') pools.push([ax - cam.x, ay - 10 - cam.y, 56 + Math.sin(this.t * 9 + it.id) * 2, 'fire']);
        if (it.kind === 'altar' || it.kind === 'candlestand') pools.push([ax - cam.x, ay - 24 - cam.y, 32, 'fire']);
        if ((it.kind === 'table' || it.kind === 'longtable') && it.v >= 1 && night) pools.push([ax - cam.x, ay - 16 - cam.y, 26, 'fire']);
      }
      if (!night) { for (const w of R.windows) pools.push([w.x + w.w / 2 - cam.x, R.WH + 14 - cam.y, 34, 'day']); if (this.floor === 0) pools.push([(R.doorX0 + R.doorX1) / 2 - cam.x, R.WH + R.FH - cam.y, 30, 'day']); }
      g.drawLightingWith(amb, pools);
    }

    drawActor(ctx, a, cam, shadow) {
      const fr = this.game.actorFrame(a), ox = fr.ox ?? 16;
      const fx = Math.round(a.x - ox - cam.x), fy = Math.round(a.y - Ch.GROUND - cam.y);
      if (shadow && !fr.ox) { ctx.fillStyle = 'rgba(28,20,44,0.3)'; ctx.fillRect(fx + 11, fy + Ch.GROUND - 1, 10, 3); ctx.fillRect(fx + 9, fy + Ch.GROUND, 14, 1); }
      ctx.drawImage(fr, fx, fy);
    }
    flame(ctx, x, y, s) {
      const f = Math.floor(this.t * 10 + x) % 3;
      ctx.fillStyle = '#ff9a30'; ctx.fillRect(Math.round(x), Math.round(y) - f % 2, s + 1, 2);
      ctx.fillStyle = '#ffe080'; ctx.fillRect(Math.round(x), Math.round(y) - 1 - f % 2, 1, 1);
    }
    drawFire(ctx, x, y, f) {
      const n = Math.max(3, Math.floor(f.w / 3)), t = this.t;
      for (let i = 0; i < n; i++) {
        const fx = Math.round(x - f.w / 2 + (i + 0.5) * (f.w / n));
        const h = f.coals ? 1 + ((Math.floor(t * 8) + i) % 2) : 3 + Math.round((Math.sin(t * 11 + i * 2.3) + 1) * 2.6);
        ctx.fillStyle = f.coals ? '#a83a20' : '#c84a20'; ctx.fillRect(fx - 1, Math.round(y) - h + 2, 3, h);
        ctx.fillStyle = '#ff9a30'; ctx.fillRect(fx - 1, Math.round(y) - h + 3, 2, Math.max(1, h - 2));
        ctx.fillStyle = '#ffe080'; ctx.fillRect(fx, Math.round(y) - h + 4, 1, Math.max(1, h - 4));
      }
    }

    // ---- interaction candidates for the interact module ----
    candidates() {
      const p = this.game.player, out = [];
      for (const a of this.actors.values()) { if (a.hidden) continue; const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < 30 && a.anim !== 'doze') out.push({ type: 'npc', person: a.person, d, x: a.x, y: a.y }); }
      const bz = this.sim.biz.get(this.b.id);
      for (const it of this.L.items) {
        const [x0, y0, x1, y1] = this.rect(it);
        const d = Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(y0 - p.y, 0, p.y - y1 - 6)) + 4;
        if (d > 18) continue;
        const cx = (x0 + x1) / 2, cy = y0 - 6;
        if (it.gangStash && this.b.gang === 'player') out.push({ type: 'stash', it, d, x: cx, y: cy });
        if (it.container) out.push({ type: 'container', it, d, x: cx, y: cy });
        if (it.bed && !it.cradle) out.push({ type: 'bed', it, d: d + 1, x: cx, y: cy });
        if (it.kind === 'stairs') out.push({ type: 'stairs', it, d: d - 2, x: cx, y: cy });
        if (it.portrait) out.push({ type: 'portrait', it, d: d + 2, x: cx, y: cy - 30 });
        if (it.kind === 'hay') out.push({ type: 'hay', it, d: d + 3, x: cx, y: cy });
        // buy across the counter or from the shelves, when someone is serving
        if ((it.counter || it.shop) && bz && !bz.def.public) {
          const seller = [...this.actors.values()].find((a) => !a.hidden && a.person.job?.biz === this.b.id && a.person.activity?.act === 'work');
          if (seller) out.push({ type: 'shop', it, seller: seller.person, d: d - 1, x: cx, y: cy });
        }
        if (O.workCandidate) { const wc = O.workCandidate(this, it, d, cx, cy); if (wc) out.push(wc); }
        if (O.craftCandidate) { const cc = O.craftCandidate(this, it, d, cx, cy); if (cc) out.push(cc); }
      }
      return out;
    }
    personPos(q) { const a = this.actors.get(q.id); return a ? [a.x, a.y] : null; }
  }
  O.Indoor = Indoor;
})();
