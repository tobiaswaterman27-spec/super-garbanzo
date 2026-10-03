// The kingdom made visible: caravans that physically pass along the King's Road (and can be robbed),
// the town crier, the notice board, the reeve riding to council, and a pixel map of the realm.
'use strict';
(function () {
  const PS = O.PlayerState, esc = (s) => O.escape(s);
  const WEST = ['saltmouth', 'oakhollow'];

  function setup(game, sim, npcUI) {
    const K = sim.kingdom, T = sim.T, Ch = O.Char;
    const live = []; // caravans currently in Ashford

    // ---------------- caravans on the King's Road ----------------
    sim.caravanArrives = (c) => {
      const prev = c.path[c.leg], fromWest = WEST.includes(prev) || (prev === 'ashford' && WEST.includes(c.from));
      const dir = fromWest ? 1 : -1;
      const x0 = fromWest ? 2 : sim.world.W * T - 2, y = 30 * T + 22;
      const members = [];
      const mk = (role, i) => { const a = Ch.makeAppearance(O.hash('car', c.id, i), { role, age: 25 + (i * 7) % 30, wealth: role === 'merchant' ? 0.7 : 0.4, region: K.place(c.from).region }); return { a, x: x0 - dir * i * 22, y: y - (i % 2) * 6, dir: dir > 0 ? 2 : 1, anim: 'walk', ft: i * 0.3, role, caravan: c }; };
      members.push(mk('merchant', 0));
      for (let i = 0; i < c.guards; i++) members.push(mk('guard', i + 1));
      const cart = { cart: true, x: x0 - dir * 12, y: y + 4, dir, caravan: c };
      live.push({ c, members, cart, dir, done: false, robbed: false });
      sim.log(`A caravan of ${c.qty} ${c.good} from ${K.place(c.from).name} to ${K.place(c.to).name} is coming along the King's Road.`, 'trade');
    };
    const cartSprite = O.Env.prop('cart', 9, 1);
    game.hooks.update.push((dt) => {
      const dtm = dt * game.clock.speed;
      for (const L of live) {
        if (L.halted) { L.members.forEach((m) => (m.anim = 'idle')); continue; }
        const step = 34 * Math.min(dtm, 4) * L.dir;
        for (const m of L.members) { m.x += step; m.ft += dt; m.anim = 'walk'; }
        L.cart.x += step;
        const out = L.dir > 0 ? L.cart.x > sim.world.W * T + 30 : L.cart.x < -30;
        if (out) { L.done = true; L.c.held = false; L.c.prog = 0; L.c.leg++; }
      }
      for (let i = live.length - 1; i >= 0; i--) if (live[i].done) live.splice(i, 1);
      if (!game.scene && game.world === O.SimRef.home.world) game.actors = [...game.actors.filter((a) => !a.caravan), ...live.flatMap((L) => L.members)];
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene || game.world !== O.SimRef.home.world) return;
      for (const L of live) { const sp = cartSprite; const x = Math.round(L.cart.x - sp.ox - cam.x), y = Math.round(L.cart.y - sp.oy - cam.y); if (L.dir < 0) { ctx.save(); ctx.translate(x + sp.W, y); ctx.scale(-1, 1); ctx.drawImage(sp.canvas, 0, 0); ctx.restore(); } else ctx.drawImage(sp.canvas, x, y); }
    });
    // the caravan master can be talked to, traded with, or robbed
    const atHome = () => game.world === O.SimRef.home.world;
    O.caravanCandidate = () => {
      if (game.scene || !atHome()) return null;
      for (const L of live) { const m = L.members[0]; const d = Math.hypot(m.x - game.player.x, m.y - game.player.y); if (d < 28) return { type: 'caravan', L, d, x: m.x, y: m.y }; }
      return null;
    };
    O.caravanPanel = (L) => {
      const c = L.c; L.halted = true;
      const gangHere = sim.playerGang() ? sim.playerGang().members.filter((m) => { const p = sim.byId.get(m.id); return p && !p.agent.hidden && Math.hypot(p.agent.x - game.player.x, p.agent.y - game.player.y) < 160; }).length : 0;
      const odds = O.clamp(0.25 + PS.rep.criminal * 0.4 + gangHere * 0.15 + (O.Combat && O.Combat.armed() ? 0.15 : 0) - c.guards * 0.12, 0.05, 0.9);
      O.Panels.open(`${c.merchant}'s caravan`, `<p class="caption">${c.qty} loads of ${c.good}, from ${esc(K.place(c.from).name)} to ${esc(K.place(c.to).name)}. ${c.guards} hired guard${c.guards > 1 ? 's' : ''} walk beside the cart.</p>
        <p class="speech">“Fair day. We'll be in ${esc(K.place(c.to).name)} by the week's end, God and the roads willing.”</p>
        <div class="topics"><button data-a="ask">Ask about the road</button><button data-a="rob">Demand the cargo (${Math.round(odds * 100)}% they yield)</button><button data-a="go">Let them pass</button></div>`, (r) => {
        r.querySelector('[data-a=go]').onclick = () => { L.halted = false; O.Panels.close(); };
        r.querySelector('[data-a=ask]').onclick = () => { const nw = K.news.slice(-3).map((n) => n.text); O.Panels.toast(`${c.merchant}: “${nw.length ? nw[sim.rng.int(0, nw.length - 1)] : 'Quiet roads, thank God.'}”`); };
        r.querySelector('[data-a=rob]').onclick = () => {
          O.Panels.close();
          const seen = [...sim.seers(game.player.x, game.player.y)];
          const cr = sim.recordCrime({ kind: 'caravan robbery', perp: 'player', placeName: "the King's Road", tile: [Math.floor(game.player.x / T), 30], seen, severity: 4 });
          // the caravan's own people are witnesses too (they describe you in the next town)
          const look = O.Justice.lookOf(game.player.a);
          cr.witnesses.push({ id: -1, desc: O.Justice.remembered(look, 0.8, sim.rng), acc: 0.8 }); cr.reported = true; cr.profile = O.Justice.vote(cr.witnesses.map((w) => w.desc)); cr.investigated = true; cr.evidence = 1.5;
          PS.crimes.push(cr.id); PS.bounty = true; PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.15); PS.rep.merchant = Math.max(-1, PS.rep.merchant - 0.3);
          if (sim.rng.chance(odds)) {
            const coin = Math.round(c.value * 0.35); PS.money += coin; L.robbed = true; c.done = true; L.done = true;
            const g = sim.playerGang(); if (g) { g.purse += Math.round(c.value * 0.15); g.recentJobs = (g.recentJobs || 0) + 2; }
            K.robbed(c, 'outlaws on the King\'s Road near Ashford');
            O.Panels.toast(`The guards throw down their staves. You take ${coin}d of goods and coin${g ? ' (and a share for the band)' : ''}.`, 'bad');
          } else {
            L.halted = false;
            const dmg = 15 + c.guards * 8; PS.hp = Math.max(5, PS.hp - dmg);
            O.Panels.toast(`The caravan guards beat you back! (−${dmg} health) They'll describe you in every town on the road.`, 'bad');
          }
        };
      });
    };

    // bunting across the square on festival days
    const FLAG = ['#a8382f', '#e0c040', '#3f5f8e', '#ece4d0', '#3d5e34'];
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene || !sim.festival || !sim.festival()) return;
      const sq = sim.Z.square, y0 = sq[1] * 16 - 4, x0 = sq[0] * 16, x1 = sq[2] * 16 + 16;
      for (let row = 0; row < 3; row++) {
        const yy = y0 + row * 34 - cam.y;
        for (let x = x0; x < x1; x++) {
          const sag = Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 10, y = Math.round(yy + sag);
          ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - cam.x, y, 1, 1);
          if ((x - x0) % 8 === 0) { ctx.fillStyle = FLAG[((x - x0) / 8 + row) % FLAG.length]; for (let k = 0; k < 4; k++) ctx.fillRect(x - cam.x + 1, y + 1 + k, 4 - k, 1); }
        }
      }
    });

    // ---------------- reeve to council, crier, notices ----------------
    const reeve = sim.reeveId ? sim.byId.get(sim.reeveId) : sim.people.filter((p) => p.age >= 35 && !p.visitor && !p.job?.role?.startsWith('guard') && !p.gang).sort((a, b) => sim.household(b).money - sim.household(a).money)[0];
    if (reeve) { reeve.title = 'Reeve of Ashford'; sim.reeveId = reeve.id; }
    const _plan = sim.plan.bind(sim);
    sim.plan = (p) => {
      const dos = sim.weather.dayOfSeason, h = sim.hour;
      if (p.id === sim.reeveId && !p.health.illness) {
        if ((dos === 2 && h >= 8) || dos === 3 || (dos === 4 && h < 12)) return { act: 'council', outdoor: true, zone: 'east' };
      }
      if (p.job?.role === 'priest' && sim.weekday !== 6 && ((h >= 8.75 && h < 9.4) || (h >= 16.75 && h < 17.4))) return { act: 'cry', outdoor: true, zone: 'crier' };
      return _plan(p);
    };
    const _zone = sim.zoneTile.bind(sim);
    sim.zoneTile = (p, zone) => { if (zone === 'crier') return [44, 28]; if (zone === 'east') return [95, 31]; return _zone(p, zone); };
    // the reeve disappears up the road while away
    game.hooks.update.push(() => {
      const rv = sim.byId.get(sim.reeveId);
      if (rv && rv.activity?.act === 'council' && !rv.agent.path && rv.agent.x > 93 * T) rv.agent.hidden = true;
      else if (rv && rv.activity?.act !== 'council' && rv.agent.hidden && rv.agent.inside == null) { rv.agent.hidden = false; }
    });
    // the crier calls the news when the player is within earshot
    let lastCry = -1;
    game.hooks.update.push(() => {
      const cr = sim.people.find((p) => p.activity?.act === 'cry' && !p.agent.path && !p.agent.hidden);
      if (!cr || game.scene || game.world !== O.SimRef.home.world) return;
      const slot = sim.day * 2 + (sim.hour > 12 ? 1 : 0);
      if (slot === lastCry) return;
      if (Math.hypot(cr.agent.x - game.player.x, cr.agent.y - game.player.y) > 170) return;
      lastCry = slot; cr.agent.talking = 60;
      const items = [...K.news.slice(-2).map((n) => n.text), ...(PS.bountyAmount && PS.wantedLevel() >= 2 ? [`A reward of ${PS.bountyAmount}d is offered for the outlaw: ${PS.soughtFor()}.`] : [])];
      O.Panels.toast(`${cr.first} the crier: “Hear ye, hear ye! ${items.length ? items.join(' ') : 'All is well in Ashford.'}”`);
    });

    // notice board in the square
    if (!sim.world.props.some((p) => p.kind === 'noticeboard')) { sim.world.props.push({ kind: 'noticeboard', x: 42 * T + 8, y: 29 * T + 14, seed: 5, solid: true }); sim.world.solid[29 * sim.world.W + 42] = 1; sim.world.dirtyStatics = true; }
    O.noticeCandidate = () => { if (game.scene) return null; const nb = sim.world.props.find((p) => p.kind === 'noticeboard'); if (!nb) return null; const d = Math.hypot(nb.x - game.player.x, nb.y - game.player.y); return d < 22 ? { type: 'notices', d: d + 1, x: nb.x, y: nb.y - 26 } : null; };
    O.readNotices = () => {
      const wanted = sim.crimes.filter((c) => c.perp !== 'player' && c.investigated && !c.solved && Object.keys(c.profile || {}).length).slice(-3);
      const mine = PS.wantedLevel() >= 1 ? `<li><b>WANTED</b> for ${PS.crimes.length} crime${PS.crimes.length > 1 ? 's' : ''}: ${esc(PS.soughtFor() || 'a stranger')}.${PS.bountyAmount ? ` Reward ${PS.bountyAmount}d.` : ''}</li>` : '';
      const prices = K.places.filter((p) => !p.detailed).map((p) => `<tr><td>${esc(p.name)}</td><td class="n">${p.prices.grain}d</td><td class="n">${p.prices.iron}d</td><td class="n">${p.prices.cloth}d</td></tr>`).join('');
      O.Panels.open('Notice board', `<ol class="chron">${mine}${wanted.map((c) => `<li>Sought: ${esc(O.Justice.describe(c.profile))}, for ${esc(c.kind)} at ${esc(c.placeName || 'Ashford')}.</li>`).join('')}${K.councils.slice(-1).flatMap((r) => r.items.map((i) => `<li>By order of the council (day ${r.day}): to ${esc(i.text)} — ${i.pass ? 'CARRIED' : 'defeated'} ${i.yes}–${i.of - i.yes}.</li>`)).join('')}${K.news.slice(-4).reverse().map((n) => `<li>${esc(n.text)}</li>`).join('')}</ol>
        <div class="lbl" style="margin-top:12px">Prices at market, by the last carter</div><table><thead><tr><th>Town</th><th class="n">Grain</th><th class="n">Iron</th><th class="n">Cloth</th></tr></thead><tbody>${prices}</tbody></table>`);
    };

    // ---------------- the kingdom map ----------------
    let mapCanvas = null;
    function renderMap() {
      const W = 64, H = 40, S = 8; const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
      const ctx = c.getContext('2d'); const img = ctx.createImageData(W * S, H * S);
      const P = O.Pal; const R = { sea: P.makeRamp('#3a6a8a', 0.6), grass: P.makeRamp('#6a8a44', 0.6), farm: P.makeRamp('#a89a50', 0.6), forest: P.makeRamp('#3a5a34', 0.7), hill: P.makeRamp('#8a8070', 0.7), snow: P.makeRamp('#dfe4ea', 0.4) };
      for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) {
        const mx = x / S, my = y / S, n = O.fbm(mx / 6, my / 6, 3, 3), f = O.noise2(x * 0.7, y * 0.7, 2);
        const coast = 3.5 + Math.sin(my / 4) * 1.5 + n * 2;
        let ramp, s = n > 0.55 ? 3 : n > 0.4 ? 2 : 1;
        if (mx < coast) { ramp = R.sea; s = f > 0.85 ? 3 : 1; }
        else if (my < 10 + n * 4) ramp = my < 5 + n * 3 ? R.snow : R.hill;
        else if (my > 28 - n * 3) ramp = R.farm;
        else if (n > 0.58) ramp = R.forest;
        else ramp = R.grass;
        if (f > 0.93) s = Math.min(4, s + 1);
        const col = ramp[s], i = (y * W * S + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }
    function drawMap(cv) {
      const S = 8, ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      if (!mapCanvas) mapCanvas = renderMap();
      ctx.drawImage(mapCanvas, 0, 0);
      for (const rd of K.roads) {
        const a = K.place(rd.a), b = K.place(rd.b), n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * S);
        for (let i = 0; i <= n; i++) { const x = Math.round((a.x + (b.x - a.x) * i / n) * S), y = Math.round((a.y + (b.y - a.y) * i / n) * S); ctx.fillStyle = rd.damaged ? (i % 6 < 3 ? '#a8382f' : 'transparent') : rd.quality > 0.7 ? '#e0cfa0' : '#b39a6a'; if (ctx.fillStyle !== 'transparent' && ctx.fillStyle !== '#00000000') ctx.fillRect(x, y, 2, 2); }
      }
      for (const s of K.places) {
        const x = s.x * S, y = s.y * S, sz = s.kind === 'capital' ? 6 : s.kind === 'castle' ? 5 : s.kind === 'town' || s.kind === 'port' ? 4 : 3;
        ctx.fillStyle = '#1b1424'; ctx.fillRect(x - sz - 1, y - sz - 1, sz * 2 + 3, sz * 2 + 3);
        ctx.fillStyle = s.detailed ? '#f0b45c' : s.kind === 'castle' ? '#c8ccd4' : s.happiness < 0.4 ? '#c87060' : '#e8dcc0';
        ctx.fillRect(x - sz, y - sz, sz * 2 + 1, sz * 2 + 1);
        if (s.kind === 'castle' || s.kind === 'capital') { ctx.fillStyle = '#1b1424'; for (let k = -sz; k <= sz; k += 2) ctx.fillRect(x + k, y - sz - 1, 1, 1); }
      }
      for (const c of K.caravans) {
        const a = K.place(c.path[c.leg]), b = K.place(c.path[c.leg + 1] || c.path[c.leg]); const t = O.clamp(c.prog, 0, 1);
        const x = Math.round((a.x + (b.x - a.x) * t) * S), y = Math.round((a.y + (b.y - a.y) * t) * S);
        ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = '#d9893a'; ctx.fillRect(x - 1, y - 1, 3, 3);
      }
    }
    O.openMap = () => {
      const rows = K.places.map((s) => `<tr><td><b>${esc(s.name)}</b><br><small class="lbl">${s.kind} · ${s.region}</small></td><td class="n">${s.pop}</td><td><span class="bar ${s.food < 0.85 ? 'warn' : ''}"><i style="width:${Math.round(Math.min(1, s.food) * 100)}%"></i></span></td><td><span class="bar ${s.happiness < 0.4 ? 'warn' : ''}"><i style="width:${Math.round(s.happiness * 100)}%"></i></span></td><td><span class="bar ${s.crime > 0.35 ? 'warn' : ''}"><i style="width:${Math.round(s.crime * 100)}%"></i></span></td><td class="n">${s.prices.grain}d</td></tr>`).join('');
      O.Panels.open('The Kingdom', `<div class="mapwrap"><canvas id="kmap" width="512" height="320"></canvas></div>
        <p class="caption">Ashford is gold. Orange marks are caravans on the roads; red dashes are roads closed by damage. Crown treasury ${O.money(K.treasury)}, crown tax ${Math.round(K.taxRate * 100)}%.</p>
        <table><thead><tr><th>Settlement</th><th class="n">People</th><th>Food</th><th>Content</th><th>Crime</th><th class="n">Grain</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="lbl" style="margin-top:12px">News from the realm</div><ol class="chron">${K.news.slice(-8).reverse().map((n) => `<li><span class="lbl">Day ${n.day}</span> ${esc(n.text)}</li>`).join('') || '<li>No news yet.</li>'}</ol>`, () => {
        const cv = document.getElementById('kmap'); drawMap(cv);
        // place labels as DOM so the type stays sharp
        const wrap = cv.parentElement; for (const s of K.places) { const l = document.createElement('span'); l.className = 'maplabel' + (s.detailed ? ' here' : ''); l.textContent = s.name; l.style.left = (s.x / 64 * 100) + '%'; l.style.top = (s.y / 40 * 100) + '%'; wrap.appendChild(l); }
      });
      const inner = document.querySelector('.panel-modal .ledger-in'); if (inner) inner.classList.remove('narrow');
    };
    game.keyHandlers.push((e) => { if (e.code === 'KeyM' && !O.panelOpen) { O.openMap(); return true; } return false; });
  }
  O.KingdomUI = { setup };
})();
