// The kingdom made visible: caravans that physically pass along the King's Road (and can be robbed),
// the town crier, the notice board, the reeve riding to council, and a pixel map of the realm.
'use strict';
(function () {
  const PS = O.PlayerState, esc = (s) => O.escape(s);
  const WEST = ['westhaven', 'elmstead'];

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
      const mourning = sim.mourningUntil != null && sim.day <= sim.mourningUntil;
      if (game.scene || game.world !== O.SimRef.home.world || (!mourning && !(sim.festival && sim.festival()))) return;
      const COLS = mourning ? ['#1e1a22', '#3a2e48', '#1e1a22', '#4a4450'] : FLAG;
      const sq = sim.Z.square, y0 = sq[1] * 16 - 4, x0 = sq[0] * 16, x1 = sq[2] * 16 + 16;
      for (let row = 0; row < 3; row++) {
        const yy = y0 + row * 34 - cam.y;
        for (let x = x0; x < x1; x++) {
          const sag = Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 10, y = Math.round(yy + sag);
          ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - cam.x, y, 1, 1);
          if ((x - x0) % 8 === 0) { ctx.fillStyle = COLS[((x - x0) / 8 + row) % COLS.length]; for (let k = 0; k < 4; k++) ctx.fillRect(x - cam.x + 1, y + 1 + k, 4 - k, 1); }
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
      const Ch = O.Chronicle, crierFacts = Ch.facts.filter((f) => f.imp >= 2 && f.day >= sim.day - 4 && !f.secret).sort((a, b) => b.imp - a.imp || b.day - a.day).slice(0, 2);
      const told = crierFacts.map((f) => { const v = Ch.tell(f, 'crier', sim, sim.rng); Ch.playerHears(f, v, 'crier', cr.name); return v; });
      const items = [...(told.length ? told : K.news.slice(-2).map((n) => n.text)), ...(PS.bountyAmount && PS.wantedLevel() >= 2 ? [`A reward of ${PS.bountyAmount}d is offered for the outlaw: ${PS.soughtFor()}.`] : [])];
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
    const E = O.Eldoria, MS = 3; // three pixels to a map unit
    function renderMap() {
      const c = document.createElement('canvas'); c.width = E.W * MS; c.height = E.H * MS;
      const ctx = c.getContext('2d'); const img = ctx.createImageData(c.width, c.height);
      const P = O.Pal;
      const R = { sea: P.makeRamp('#2e5a7e', 0.6), beach: P.makeRamp('#c8b07a', 0.5), lake: P.makeRamp('#3f6f9a', 0.6), river: P.makeRamp('#4a80b0', 0.5), peak: P.makeRamp('#dfe6ea', 0.4), mountain: P.makeRamp('#8a8478', 0.8),
        forest: P.makeRamp('#3f6a34', 0.7), frost: P.makeRamp('#4f6e5e', 0.6), black: P.makeRamp('#2e4630', 0.7), farm: P.makeRamp('#b0a050', 0.6), grass: P.makeRamp('#6a9a48', 0.6), moor: P.makeRamp('#8a8a5a', 0.6), marsh: P.makeRamp('#5a7a5a', 0.6) };
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const mx = x / MS, my = y / MS, t = E.terrainAt(mx, my), n = O.fbm(mx / 3, my / 3, 5, 3), f = O.noise2(x * 0.6, y * 0.6, 2);
        let ramp = R[t] || R.grass, s = n > 0.58 ? 3 : n > 0.42 ? 2 : 1;
        if (t === 'forest') { const g = E.regionAt(mx, my); ramp = g && g.r.cold ? R.frost : g && g.r.dark ? R.black : R.forest; if (f > 0.6) s = (x + y) % 3 ? 1 : 3; }
        if (t === 'sea') { s = f > 0.9 ? 3 : n > 0.6 ? 2 : 1; if (((x + Math.floor(y / 6) * 3) % 11) === 0 && y % 6 === 0) s = 3; }
        if (t === 'farm') s = (Math.floor(y / 3) + Math.floor(x / 9)) % 3 === 0 ? 3 : 2;
        if (t === 'mountain' || t === 'peak') { s = n > 0.5 ? 3 : 1; if (O.noise2(x * 0.3, y * 0.3, 8) > 0.75) s = t === 'peak' ? 4 : 3; }
        if (f > 0.95) s = Math.min(4, s + 1);
        const col = ramp[s], i = (y * c.width + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // ruins of older times
      for (const r of E.RUINS) { const x = r.x * MS, y = r.y * MS; ctx.fillStyle = '#5a5248'; ctx.fillRect(x - 3, y - 2, 2, 4); ctx.fillRect(x + 1, y - 3, 2, 5); ctx.fillRect(x - 3, y + 2, 6, 1); }
      return c;
    }
    const MAIN = new Set(["the King's Road", 'the Eastern Trade Road', 'the Western Road', 'the Northern Road', 'the Iron Road', 'the Southern Farm Road']);
    function drawMap(cv) {
      const S = MS, ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      if (!mapCanvas) mapCanvas = renderMap();
      ctx.drawImage(mapCanvas, 0, 0);
      for (const rd of K.roads) {
        const a = K.place(rd.a), b = K.place(rd.b), n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * S), main = MAIN.has(rd.name);
        for (let i = 0; i <= n; i++) {
          const x = Math.round((a.x + (b.x - a.x) * i / n) * S), y = Math.round((a.y + (b.y - a.y) * i / n) * S);
          if (!main && i % 4 > 1) continue;
          ctx.fillStyle = rd.damaged ? (i % 6 < 3 ? '#a8382f' : 'transparent') : main ? '#e8d49a' : '#c8b48a';
          if (ctx.fillStyle !== 'transparent') { ctx.fillRect(x, y, main ? 2 : 1, main ? 2 : 1); }
        }
      }
      for (const s of K.places) {
        const x = Math.round(s.x * S), y = Math.round(s.y * S), sz = s.kind === 'capital' ? 6 : s.kind === 'castle' ? 4 : s.pop >= 300 ? 3 : s.pop >= 80 ? 2 : 1;
        ctx.fillStyle = '#1b1424'; ctx.fillRect(x - sz - 1, y - sz - 1, sz * 2 + 3, sz * 2 + 3);
        ctx.fillStyle = s.detailed ? '#f0b45c' : s.kind === 'castle' ? '#c8ccd4' : s.kind === 'capital' ? '#f4e8c8' : s.happiness < 0.4 ? '#c87060' : '#e8dcc0';
        ctx.fillRect(x - sz, y - sz, sz * 2 + 1, sz * 2 + 1);
        if (s.kind === 'castle' || s.kind === 'capital') { ctx.fillStyle = '#1b1424'; for (let k = -sz; k <= sz; k += 2) ctx.fillRect(x + k, y - sz - 1, 1, 1); ctx.fillRect(x, y - 1, 1, 3); }
      }
      // you are here
      const here = K.place(game.world.placeId);
      if (here) { const x = Math.round(here.x * S), y = Math.round(here.y * S), b = Math.floor(game.t * 2) % 2; ctx.strokeStyle = b ? '#f0b45c' : '#fff6dc'; ctx.strokeRect(x - 9.5, y - 9.5, 19, 19); }
      for (const c of K.caravans) {
        const a = K.place(c.path[c.leg]), b = K.place(c.path[c.leg + 1] || c.path[c.leg]); if (!a || !b) continue; const t = O.clamp(c.prog, 0, 1);
        const x = Math.round((a.x + (b.x - a.x) * t) * S), y = Math.round((a.y + (b.y - a.y) * t) * S);
        ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = '#d9893a'; ctx.fillRect(x - 1, y - 1, 3, 3);
      }
    }
    let zoom = 2;
    const govLine = (s) => { const g = s.gov || {}; return `${esc(g.body || 'the council')}${g.size ? ` (${g.size})` : ''}`; };
    function placeInfo(s) {
      const g = s.gov || {}, lead = K.lordName ? K.lordName(s.id) : s.leader;
      return `<b>${esc(s.name)}</b> <span class="lbl">${esc(s.kind)} · ${esc(s.area || s.region)} · ${s.pop} souls</span><br>
        Governed by ${govLine(s)}, led by <b>${esc(lead || s.leader)}</b>.${g.note ? ' ' + esc(g.note) : ''}<br>
        <span class="lbl">Produces ${Object.entries(s.produces || {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'little'} · roads to ${K.neighbours(s.id).map((n) => esc(K.place(n).name)).join(', ')}</span>`;
    }
    O.openMap = () => {
      const rows = K.places.slice().sort((a, b) => b.pop - a.pop).map((s) => `<tr><td><b>${esc(s.name)}</b><br><small class="lbl">${s.kind} · ${esc(s.area || s.region)}</small></td><td><small>${govLine(s)}<br><span class="lbl">${esc(K.lordName ? K.lordName(s.id) : s.leader)}</span></small></td><td class="n">${s.pop}</td><td><span class="bar ${s.food < 0.85 ? 'warn' : ''}"><i style="width:${Math.round(Math.min(1, s.food) * 100)}%"></i></span></td><td><span class="bar ${s.happiness < 0.4 ? 'warn' : ''}"><i style="width:${Math.round(s.happiness * 100)}%"></i></span></td><td><span class="bar ${s.crime > 0.35 ? 'warn' : ''}"><i style="width:${Math.round(s.crime * 100)}%"></i></span></td></tr>`).join('');
      O.Panels.open('The Island of Eldoria', `<div class="mapbar"><button data-z="-1">−</button><button data-z="1">+</button><span class="lbl">${K.places.length} settlements · drag to move, click a place for its government</span></div>
        <div class="mapview"><div class="mapwrap" style="width:${zoom * 100}%"><canvas id="kmap" width="${E.W * MS}" height="${E.H * MS}"></canvas></div></div>
        <p class="caption" id="mapinfo">${placeInfo(K.place(game.world.placeId) || K.places[0])}</p>
        <p class="caption">Gold marks where you are. Orange marks are caravans on the roads; red dashes are roads closed by damage. Crown treasury ${O.money(K.treasury)}, crown tax ${Math.round(K.taxRate * 100)}%.</p>
        <table><thead><tr><th>Settlement</th><th>Government</th><th class="n">People</th><th>Food</th><th>Content</th><th>Crime</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="lbl" style="margin-top:12px">News from the realm</div><ol class="chron">${K.news.slice(-8).reverse().map((n) => `<li><span class="lbl">Day ${n.day}</span> ${esc(n.text)}</li>`).join('') || '<li>No news yet.</li>'}</ol>`, (root) => {
        const cv = document.getElementById('kmap'); drawMap(cv);
        const wrap = cv.parentElement, view = wrap.parentElement;
        // every settlement is named; regions, lakes and rivers too
        for (const s of K.places) { const l = document.createElement('span'); l.className = 'maplabel' + (s.id === game.world.placeId ? ' here' : '') + (s.kind === 'capital' ? ' capital' : s.kind === 'hamlet' ? ' small' : s.kind === 'village' || s.kind === 'mine' ? ' mid' : ''); l.textContent = s.name; l.style.left = (s.x / E.W * 100) + '%'; l.style.top = (s.y / E.H * 100) + '%'; wrap.appendChild(l); }
        for (const r of E.REGIONS) { const l = document.createElement('span'); l.className = 'maplabel region'; l.textContent = r.name.replace(/^the /, ''); l.style.left = ((r.x + (r.kind === 'mountain' ? r.rx * 0.4 : 0)) / E.W * 100) + '%'; l.style.top = ((r.y + (r.kind === 'mountain' ? r.ry * 0.6 : -r.ry * 0.3)) / E.H * 100) + '%'; wrap.appendChild(l); }
        for (const r of E.LAKES) { const l = document.createElement('span'); l.className = 'maplabel water'; l.textContent = r.name; l.style.left = (r.x / E.W * 100) + '%'; l.style.top = ((r.y + r.ry) / E.H * 100) + '%'; wrap.appendChild(l); }
        for (const r of E.RIVERS) { const m = r.pts[Math.floor(r.pts.length / 2)]; const l = document.createElement('span'); l.className = 'maplabel water'; l.textContent = r.name.replace(/^the /, ''); l.style.left = (m[0] / E.W * 100) + '%'; l.style.top = (m[1] / E.H * 100) + '%'; wrap.appendChild(l); }
        for (const r of E.RUINS) { const l = document.createElement('span'); l.className = 'maplabel ruin'; l.textContent = r.name.replace(/^the /, ''); l.style.left = (r.x / E.W * 100) + '%'; l.style.top = (r.y / E.H * 100) + '%'; wrap.appendChild(l); }
        const centre = () => { const h = K.place(game.world.placeId); if (!h) return; view.scrollLeft = h.x / E.W * wrap.clientWidth - view.clientWidth / 2; view.scrollTop = h.y / E.H * wrap.clientHeight - view.clientHeight / 2; };
        requestAnimationFrame(centre);
        root.querySelectorAll('[data-z]').forEach((b) => b.onclick = () => {
          const cx = (view.scrollLeft + view.clientWidth / 2) / wrap.clientWidth, cy = (view.scrollTop + view.clientHeight / 2) / wrap.clientHeight;
          zoom = O.clamp(zoom + +b.dataset.z, 1, 5); wrap.style.width = zoom * 100 + '%';
          requestAnimationFrame(() => { view.scrollLeft = cx * wrap.clientWidth - view.clientWidth / 2; view.scrollTop = cy * wrap.clientHeight - view.clientHeight / 2; });
        });
        // drag to pan; a click without a drag picks the nearest place
        let drag = null;
        view.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, sl: view.scrollLeft, st: view.scrollTop, moved: false }; view.setPointerCapture(e.pointerId); };
        view.onpointermove = (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; view.scrollLeft = drag.sl - dx; view.scrollTop = drag.st - dy; };
        view.onpointerup = (e) => {
          const d = drag; drag = null; if (!d || d.moved) return;
          const rc = wrap.getBoundingClientRect(), mx = (e.clientX - rc.left) / rc.width * E.W, my = (e.clientY - rc.top) / rc.height * E.H;
          let best = null, bd = 1e9; for (const s of K.places) { const dd = Math.hypot(s.x - mx, s.y - my); if (dd < bd) { bd = dd; best = s; } }
          if (best && bd < 12) root.querySelector('#mapinfo').innerHTML = placeInfo(best);
        };
      });
      const inner = document.querySelector('.panel-modal .ledger-in'); if (inner) inner.classList.remove('narrow');
    };
    game.keyHandlers.push((e) => { if (e.code === 'KeyM' && !O.panelOpen) { O.openMap(); return true; } return false; });
  }
  O.KingdomUI = { setup };
})();
