// Indoor scene: renders a building's floor, places the residents who are actually inside it at the
// furniture that matches what they're doing, shows stock levels on shelves and in sacks, and handles
// collision, stairs and leaving by the door.
'use strict';
(function () {
  const T = 16, Ch = O.Char;

  class Indoor {
    constructor(game, sim, b, floor = 0) {
      this.game = game; this.sim = sim; this.b = b; this.floor = floor;
      this.L = O.Interior.interior(b, floor, sim);
      this.R = this.L.room;
      this.actors = new Map(); // person id -> scene actor
      this.t = 0;
    }
    // floor tile -> scene pixel (feet position)
    tileXY(tx, ty) { return [this.R.SW + tx * T + 8, this.R.WH + ty * T + 12]; }
    anchor(it) { return [this.R.SW + (it.tx + it.fw / 2) * T, this.R.WH + (it.ty + it.fh) * T - 1]; }
    enterAt(fromStairs) {
      const p = this.game.player;
      if (fromStairs || this.L.dc < 0) { const st = this.L.items.find((i) => i.kind === 'stairs'); const [x, y] = this.anchor(st); p.x = x + (st.tx === 0 ? 14 : -14); p.y = y - 4; p.dir = 0; }
      else { [p.x, p.y] = this.tileXY(this.L.dc, this.L.d - 1); p.y += 2; p.dir = 3; }
    }
    blocked(x, y) {
      const R = this.R, L = this.L;
      const test = (px, py) => {
        const tx = Math.floor((px - R.SW) / T), ty = Math.floor((py - R.WH) / T);
        if (py < R.WH + 5) return true;
        if (tx < 0 || tx >= L.w) return true;
        if (ty >= L.d) return !(this.floor === 0 && tx === L.dc);
        return L.grid[ty * L.w + tx] === 1;
      };
      return test(x - 4, y - 3) || test(x + 3, y - 3) || test(x - 4, y) || test(x + 3, y);
    }
    update(dt) {
      this.t += dt;
      const p = this.game.player;
      if (this.floor === 0 && p.y > this.R.WH + this.L.d * T + 2) this.game.exitBuilding();
      this.placeActors();
    }

    // Who is inside, and where do they belong right now?
    placeActors() {
      const sim = this.sim, L = this.L, b = this.b;
      const inside = sim.people.filter((q) => q.agent.inside === b.id).sort((a, c) => a.id - c.id);
      const bedsHere = L.items.filter((i) => i.bed);
      const twoF = b.floors >= 2;
      const used = new Set(); const seen = new Set();
      const free = (list) => list.find((i) => !used.has(i)) || null;
      const seats = L.items.filter((i) => i.seat || i.pew);
      const idleTiles = []; for (let y = 0; y < L.d; y++) for (let x = 0; x < L.w; x++) if (!L.grid[y * L.w + x] && !(Math.abs(x - L.dc) <= 1 && y >= L.d - 2) && y > 0) idleTiles.push([x, y]);
      for (const q of inside) {
        const act = q.activity?.act;
        const sleeping = act === 'sleep' || act === 'sick';
        const fl = twoF ? ((sleeping && b.id !== sim.docId) || (act === 'home' && q.id % 2) ? 1 : 0) : 0;
        if (b.type === 'tavern' && (act === 'rest') ) { /* travellers rest upstairs */ }
        const wantFloor = b.type === 'tavern' && act === 'rest' ? 1 : fl;
        if (wantFloor !== this.floor) continue;
        let x, y, dir = 0, anim = 'idle', over = null;
        let spot = null;
        if (act === 'jailed') { const c = L.items.find((i) => i.cell); if (c) { const [ax, ay] = this.anchor(c); x = ax + ((q.id % 3) - 1) * 6; y = ay - 6; anim = 'sit'; dir = 0; } }
        else if (act === 'treated' || (act === 'sick' && b.id === sim.docId)) { spot = L.items.find((i) => i.medbed && !used.has(i)) || free(bedsHere); if (spot) { const [ax, ay] = this.anchor(spot); x = ax; y = ay - 44 + Ch.GROUND; anim = 'sleep'; } }
        else if (sleeping) {
          spot = free(bedsHere);
          if (spot) { const [ax, ay] = this.anchor(spot); x = ax; y = ay - 44 + Ch.GROUND; anim = 'sleep'; over = spot; }
          else { const t = idleTiles[(q.id * 5) % Math.max(1, idleTiles.length)] || [0, 1]; [x, y] = this.tileXY(t[0], t[1]); y += 14; anim = 'sleep'; } // a straw pallet on the floor
        }
        else if (act === 'work' || act === 'pickup' && q.job?.biz === b.id) {
          const role = q.job?.role;
          spot = L.items.find((i) => !used.has(i) && i.work && i.work.includes(role)) || L.items.find((i) => !used.has(i) && i.counter);
          if (spot) {
            const [ax, ay] = this.anchor(spot);
            const behind = spot.counter || spot.kind === 'desk' || spot.kind === 'altar' || spot.kind === 'bar';
            if (behind) { x = ax + (spot.kind === 'bar' ? ((q.id % 3) - 1) * 14 : 0); y = ay - spot.fh * T - (spot.kind === 'altar' ? -2 : 0) + (spot.kind === 'altar' ? 18 : 0); dir = 0; anim = q.agent.talking ? 'talk' : 'idle'; if (spot.kind === 'altar') { y = ay + 12; dir = 3; } }
            else { x = ax + (spot.kind === 'oven' || spot.kind === 'forge' ? 0 : 0); y = ay + 13; dir = 3; anim = spot.kind === 'medbed' ? 'idle' : 'work'; }
            if (spot.kind === 'desk') anim = 'read';
            if (spot.kind === 'altar') anim = (Math.floor(this.t / 8) + q.id) % 2 ? 'read' : 'talk';
            if (spot.kind === 'cauldron') anim = 'cook';
            if (spot.kind === 'bar' && q.agent.talking) anim = 'talk';
          }
        } else if (act === 'perform') { // a bard plays by the hearth
          const c = L.items.find((i) => i.kind === 'fireplace') || L.items.find((i) => i.kind === 'bar'); const [ax, ay] = c ? this.anchor(c) : this.tileXY(Math.floor(L.w / 2), 2);
          x = ax + (c && c.kind === 'bar' ? -40 : 0); y = ay + 22; dir = 0; anim = (Math.floor(this.t / 4) % 3) ? 'talk' : 'idle';
        } else if (act === 'mourn' || act === 'wedding') {
          const c = L.items.find((i) => i.kind === 'altar') || L.items[0]; const [ax, ay] = this.anchor(c); const k = inside.filter((z) => z.activity?.act === act).indexOf(q);
          x = ax + ((k % 6) - 2.5) * 12; y = ay + 26 + Math.floor(k / 6) * 14; dir = 3; anim = act === 'mourn' ? 'mourn' : (k % 3 === 0 ? 'celebrate' : 'idle');
        } else if (['socialise', 'eat-out', 'eat', 'worship', 'rest', 'gangmeet', 'lessons', 'feast'].includes(act) || (act === 'home' && q.stage !== 'baby')) {
          spot = act === 'home' && q.id % 3 === 0 ? null : free(seats);
          if (spot) { const [ax, ay] = this.anchor(spot); x = ax; y = ay + 2; dir = spot.pew ? 3 : 0; anim = 'sit'; if (spot.pew) { const k = inside.filter((z) => ['worship', 'lessons'].includes(z.activity?.act)).indexOf(q) % 3; x = ax + (k - 1) * 14; } }
        } else if (act === 'shop' || act === 'deliver' || act === 'pickup' || act === 'carry-home' || act === 'import') {
          const c = L.items.find((i) => i.counter);
          if (c) { const [ax, ay] = this.anchor(c); x = ax + ((q.id % 3) - 1) * 12; y = ay + 14; dir = 3; anim = q.agent.carrying ? 'carry' : 'idle'; }
        }
        if (x == null && act === 'socialise' && b.type === 'tavern') { const bar = L.items.find((i) => i.kind === 'bar'); if (bar) { const [ax, ay] = this.anchor(bar); const k = q.id % 5; x = ax - 24 + k * 12; y = ay + 14; dir = 3; anim = (Math.floor(this.t / 3) + q.id) % 3 ? 'drink' : 'talk'; } }
        if (x == null) { const t = idleTiles[(q.id * 7) % Math.max(1, idleTiles.length)] || [0, 0]; [x, y] = this.tileXY(t[0], t[1]); x += (q.id % 3) * 3 - 3; dir = (q.id + Math.floor(this.t / 6)) % 4 === 3 ? 0 : (q.id + Math.floor(this.t / 6)) % 4; anim = q.agent.talking ? 'talk' : q.stage === 'baby' ? 'crouch' : 'idle'; }
        if (spot && spot.kind !== 'pew' && spot.kind !== 'bar') used.add(spot);
        let a = this.actors.get(q.id);
        if (!a) { a = { ft: Math.random() * 2, person: q, a: q.app }; this.actors.set(q.id, a); }
        if (q.agent.frozen) { anim = 'talk'; dir = a.dir ?? dir; }
        Object.assign(a, { x, y, dir: q.agent.frozen ? a.dir : dir, anim, a: q.app, hidden: false });
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
        // sacks/barrels holding stock disappear as the stock runs down
        if (it.stockOf && bz && O.Data.GOODS[it.stockOf]) {
          const same = L.items.filter((i) => i.stockOf === it.stockOf); const k = same.indexOf(it);
          const ratio = O.clamp((bz.stock[it.stockOf] || 0) / (bz.def.targets[it.stockOf] || 10), 0, 1);
          if (k >= Math.ceil(ratio * same.length)) continue;
        }
        const sp = O.Furn.furniture(it.kind, v, it.seed);
        const [ax, ay] = this.anchor(it);
        drawables.push({ y: sp.flat ? -1 : ay, draw: () => { ctx.drawImage(sp.canvas, Math.round(ax - sp.ox - cam.x), Math.round(ay - sp.oy - cam.y)); if (sp.fire) this.drawFire(ctx, ax - sp.ox + sp.fire.x - cam.x, ay - sp.oy + sp.fire.y - cam.y, sp.fire); if (sp.candles) for (const [cx, cy] of sp.candles) this.flame(ctx, ax - sp.ox + cx - cam.x, ay - sp.oy + cy - cam.y, 1); } });
      }
      for (const a of this.actors.values()) drawables.push({ y: a.anim === 'sleep' ? a.y + 1 : a.y + (a.anim === 'sit' ? 0.5 : 0), draw: () => this.drawActor(ctx, a, cam, a.anim !== 'sleep') });
      const p = g.player; drawables.push({ y: p.y, draw: () => this.drawActor(ctx, p, cam, true) });
      drawables.sort((a, c) => a.y - c.y);
      for (const d of drawables) d.draw();
      for (const h of g.hooks.drawWorld) h(ctx, cam);
      // lighting: dim interior, warm pools around fires and candles, daylight under windows
      const amb = night ? [58, 52, 88] : g.ambient().map((c, k) => Math.round(c * [0.86, 0.82, 0.78][k]));
      const pools = [];
      for (const it of L.items) {
        const [ax, ay] = this.anchor(it);
        if (it.kind === 'fireplace' || it.kind === 'oven' || it.kind === 'forge') pools.push([ax - cam.x, ay - 10 - cam.y, 44 + Math.sin(this.t * 9 + it.id) * 2, 'fire']);
        if (it.kind === 'altar') pools.push([ax - cam.x, ay - 20 - cam.y, 30, 'fire']);
        if (it.kind === 'table' && night) pools.push([ax - cam.x, ay - 8 - cam.y, 22, 'fire']);
      }
      if (!night) for (const w of R.windows) pools.push([w.x + w.w / 2 - cam.x, R.WH + 10 - cam.y, 26, 'day']);
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
        const h = f.coals ? 1 + ((Math.floor(t * 8) + i) % 2) : 3 + Math.round((Math.sin(t * 11 + i * 2.3) + 1) * 2.2);
        ctx.fillStyle = f.coals ? '#c83a20' : '#c84a20'; ctx.fillRect(fx - 1, Math.round(y) - h + 2, 3, h);
        ctx.fillStyle = '#ff9a30'; ctx.fillRect(fx - 1, Math.round(y) - h + 3, 2, Math.max(1, h - 2));
        ctx.fillStyle = '#ffe080'; ctx.fillRect(fx, Math.round(y) - h + 4, 1, Math.max(1, h - 4));
      }
    }

    // ---- interaction candidates for the interact module ----
    candidates() {
      const p = this.game.player, out = [];
      for (const a of this.actors.values()) { const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < 30 && a.anim !== 'sleep') out.push({ type: 'npc', person: a.person, d, x: a.x, y: a.y }); }
      for (const it of this.L.items) {
        const [ax, ay] = this.anchor(it);
        const cx = ax, cy = ay - it.fh * 8 + 4;
        const d = Math.hypot(cx - p.x, Math.max(0, cy - p.y - 8, p.y - ay - 6) + (Math.abs(cx - p.x) > it.fw * 8 + 6 ? 20 : 0));
        if (d > 22) continue;
        if (it.gangStash && this.b.gang === 'player') out.push({ type: 'stash', it, d, x: cx, y: cy });
        if (it.container) out.push({ type: 'container', it, d, x: cx, y: cy });
        if (it.bed) out.push({ type: 'bed', it, d: d + 1, x: cx, y: cy });
        if (it.kind === 'stairs') out.push({ type: 'stairs', it, d: d - 2, x: cx, y: cy });
        if (it.portrait) out.push({ type: 'portrait', it, d: d + 2, x: cx, y: cy - 30 });
        if (O.workCandidate) { const wc = O.workCandidate(this, it, d, cx, cy); if (wc) out.push(wc); }
      }
      return out;
    }
    personPos(q) { const a = this.actors.get(q.id); return a ? [a.x, a.y] : null; }
  }
  O.Indoor = Indoor;
})();
