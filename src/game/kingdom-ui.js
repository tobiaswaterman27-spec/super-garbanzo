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
      const x0 = fromWest ? ((sim.world.ox || 0) + 2) * T : ((sim.world.ox || 0) + (sim.world.townW || sim.world.W) - 2) * T, y = (sim.world.roadY || 30) * T + 22;
      const members = [];
      const mk = (role, i) => { const a = Ch.makeAppearance(O.hash('car', c.id, i), { role, age: 25 + (i * 7) % 30, wealth: role === 'merchant' ? 0.7 : 0.4, region: K.place(c.from).region }); return { a, x: x0 - dir * i * 22, y: y - (i % 2) * 6, dir: dir > 0 ? 2 : 1, anim: 'walk', ft: i * 0.3, role, caravan: c }; };
      members.push(mk('merchant', 0));
      for (let i = 0; i < c.guards; i++) members.push(mk('guard', i + 1));
      const cart = { cart: true, x: x0 - dir * 12, y: y + 4, dir, caravan: c };
      live.push({ c, members, cart, dir, done: false, robbed: false });
      sim.log(`A caravan of ${O.Data.GOODS[c.good] ? O.countOf(c.good, c.qty) : c.qty + ' ' + c.good} from ${K.place(c.from).name} to ${K.place(c.to).name} is coming along the King's Road.`, 'trade');
    };
    const cartSprite = O.Env.prop('cart', 9, 1);
    game.hooks.update.push((dt) => {
      const dtm = dt * game.clock.speed;
      for (const L of live) {
        if (L.halted) { L.members.forEach((m) => (m.anim = 'idle')); continue; }
        const step = 34 * Math.min(dtm, 4) * L.dir;
        for (const m of L.members) { m.x += step; m.ft += dt; m.anim = 'walk'; }
        L.cart.x += step;
        const out = L.dir > 0 ? L.cart.x > ((sim.world.ox || 0) + (sim.world.townW || sim.world.W)) * T + 30 : L.cart.x < (sim.world.ox || 0) * T - 30;
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
            O.Panels.toast(`The guards throw down their staves. You take ₳${coin} of goods and coin${g ? ' (and a share for the band)' : ''}.`, 'bad');
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
      if (game.scene || game.world !== O.SimRef.home.world || (!mourning && !(sim.festival && sim.festival()) && !(O.Revels && O.Revels.today(sim) && sim.hour >= 7))) return;
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
    if (reeve) { reeve.title = `Reeve of ${sim.world.name}`; sim.reeveId = reeve.id; }
    const H0 = O.SimRef.cur, _plan = (p) => Object.getPrototypeOf(H0).plan.call(H0, p); // always the shared plan as it stands now (others add to it later)
    sim.plan = (p) => {
      const dos = sim.weather.dayOfSeason, h = sim.hour;
      if (p.id === sim.reeveId && !p.health.illness) {
        if ((dos === 2 && h >= 8) || dos === 3 || (dos === 4 && h < 12)) return { act: 'council', outdoor: true, zone: 'east' };
      }
      if (p.job?.role === 'priest' && sim.weekday !== 6 && ((h >= 8.75 && h < 9.4) || (h >= 16.75 && h < 17.4))) return { act: 'cry', outdoor: true, zone: 'crier' };
      return _plan(p);
    };
    const _zone = sim.zoneTile.bind(sim);
    sim.zoneTile = (p, zone) => { if (zone === 'crier') return [44 + (sim.world.ox || 0), 28 + (sim.world.oy || 0)]; if (zone === 'east') return sim.Z.east; return _zone(p, zone); };
    // the reeve disappears up the road while away
    game.hooks.update.push(() => {
      const rv = sim.byId.get(sim.reeveId);
      if (rv && rv.activity?.act === 'council' && !rv.agent.path && rv.agent.x > (sim.Z.east[0] - 2) * T) rv.agent.hidden = true;
      else if (rv && rv.activity?.act !== 'council' && rv.agent.hidden && rv.agent.inside == null) { rv.agent.hidden = false; }
    });
    // the crier calls the news when the player is within earshot
    let lastCry = -1;
    game.hooks.update.push(() => {
      const cr = sim.people.find((p) => p.activity?.act === 'cry' && !p.agent.path && !p.agent.hidden);
      if (!cr || game.scene || game.world !== O.SimRef.home.world) return;
      const slot = sim.day * 2 + (sim.hour > 12 ? 1 : 0);
      if (slot === lastCry) return;
      if (Math.hypot(cr.agent.x - game.player.x, cr.agent.y - game.player.y) > 90) return;
      lastCry = slot; cr.agent.talking = 60;
      const Ch = O.Chronicle, crierFacts = Ch.facts.filter((f) => f.imp >= 2 && f.day >= sim.day - 4 && !f.secret).sort((a, b) => b.imp - a.imp || b.day - a.day).slice(0, 2);
      const told = crierFacts.map((f) => { const v = Ch.tell(f, 'crier', sim, sim.rng); Ch.playerHears(f, v, 'crier', cr.name); return v; });
      const items = [...(told.length ? told : K.news.slice(-2).map((n) => n.text)), ...(PS.bountyAmount && PS.wantedLevel() >= 2 ? [`A reward of ₳${PS.bountyAmount} is offered for the outlaw: ${PS.soughtFor()}.`] : [])];
      // nothing new since the last cry: the crier says so, rather than the same again
      const fresh = items.filter((t) => !(sim._cried || []).includes(t));
      sim._cried = [...(sim._cried || []), ...fresh].slice(-12);
      const words = `Hear ye, hear ye! ${fresh.length ? fresh.join(' ') : `All is well in ${sim.world.name}.`}`;
      cr.agent.anim = 'wave';
      O.Speech.say(cr, words.length > 160 ? words.slice(0, 157) + '…' : words, 9, 'shout', 140);
      O.Panels.toast(`${cr.first} the crier: “${words}”`);
    });
    // the town criers of every place call out on their rounds, but only those near enough hear them
    let nextCall = 0;
    game.hooks.update.push(() => {
      if (game.t < nextCall || game.scene) return; nextCall = game.t + 4;
      const s = O.SimRef.cur; if (!s) return;
      const h = s.hour; if (h < 8 || h > 18) return;
      for (const q of s.people) {
        if (q.job?.role !== 'town crier' || !q.agent || q.agent.hidden || q.agent.inside != null || q.health.hp <= 0) continue;
        if (!O.Speech.inEarshot(q, 120) || (q._cried || 0) > game.t) continue;
        q._cried = game.t + 40;
        const n = (K.news || []).filter((x) => !x.secret).slice(-3), it = n.length ? n[(q.id + s.day + Math.floor(h)) % n.length].text : `${O.DAYNAMES[s.weekday]}, and all is well in ${s.world.name}.`;
        O.Speech.say(q, `Oyez, oyez! ${it}`, 8, 'shout', 140); q.agent.anim = 'wave';
        O.UI.say(`${q.first} the crier calls: “${it}”`);
      }
    });

    // notice board in the square
    if (!sim.world.props.some((p) => p.kind === 'noticeboard')) { { const nx = 42 + (sim.world.ox || 0), ny = 29 + (sim.world.oy || 0); sim.world.props.push({ kind: 'noticeboard', x: nx * T + 8, y: ny * T + 14, seed: 5, solid: true }); sim.world.solid[ny * sim.world.W + nx] = 1; } sim.world.dirtyStatics = true; }
    O.noticeCandidate = () => { if (game.scene) return null; const nb = sim.world.props.find((p) => p.kind === 'noticeboard'); if (!nb) return null; const d = Math.hypot(nb.x - game.player.x, nb.y - game.player.y); return d < 22 ? { type: 'notices', d: d + 1, x: nb.x, y: nb.y - 26 } : null; };
    O.readNotices = () => {
      const wanted = sim.crimes.filter((c) => c.perp !== 'player' && c.investigated && !c.solved && Object.keys(c.profile || {}).length).slice(-3);
      const mine = PS.wantedLevel() >= 1 ? `<li><b>WANTED</b> for ${PS.crimes.length} crime${PS.crimes.length > 1 ? 's' : ''}: ${esc(PS.soughtFor() || 'a stranger')}.${PS.bountyAmount ? ` Reward ₳${PS.bountyAmount}.` : ''}</li>` : '';
      const prices = K.places.filter((p) => !p.detailed).map((p) => `<tr><td>${esc(p.name)}</td><td class="n">₳${p.prices.grain}</td><td class="n">₳${p.prices.iron}</td><td class="n">₳${p.prices.cloth}</td></tr>`).join('');
      O.Panels.open('Notice board', `<ol class="chron">${mine}${wanted.map((c) => `<li>Sought: ${esc(O.Justice.describe(c.profile))}, for ${esc(c.kind)} at ${esc(c.placeName || 'Ashford')}.</li>`).join('')}${K.councils.slice(-1).flatMap((r) => r.items.map((i) => `<li>By order of the council (day ${r.day}): to ${esc(i.text)}, ${i.pass ? 'CARRIED' : 'defeated'} ${i.yes}-${i.of - i.yes}.</li>`)).join('')}${K.news.slice(-4).reverse().map((n) => `<li>${esc(n.text)}</li>`).join('')}</ol>
        <div class="lbl" style="margin-top:12px">Prices at market, by the last carter</div><table><thead><tr><th>Town</th><th class="n">Grain</th><th class="n">Iron</th><th class="n">Cloth</th></tr></thead><tbody>${prices}</tbody></table>`);
    };

    // ---------------- the kingdom map ----------------
    let mapCanvas = null;
    const E = O.Eldoria, MS = 3; // three pixels to a map unit
    // the map is painted a few rows at a time from the moment the game starts, so it's ready when you open it
    let job = null;
    function renderMap(rows = 1e9) {
      if (!job) { const c = document.createElement('canvas'); c.width = E.W * MS; c.height = E.H * MS; const ctx = c.getContext('2d'); job = { c, ctx, img: ctx.createImageData(c.width, c.height), y: 0 }; }
      const { c, ctx, img } = job;
      const P = O.Pal;
      const R = { sea: P.makeRamp('#2e5a7e', 0.6), beach: P.makeRamp('#c8b07a', 0.5), lake: P.makeRamp('#3f6f9a', 0.6), river: P.makeRamp('#4a80b0', 0.5), peak: P.makeRamp('#dfe6ea', 0.4), mountain: P.makeRamp('#8a8478', 0.8),
        forest: P.makeRamp('#3f6a34', 0.7), frost: P.makeRamp('#4f6e5e', 0.6), black: P.makeRamp('#2e4630', 0.7), farm: P.makeRamp('#b0a050', 0.6), grass: P.makeRamp('#6a9a48', 0.6), moor: P.makeRamp('#8a8a5a', 0.6), marsh: P.makeRamp('#5a7a5a', 0.6) };
      const yEnd = Math.min(c.height, job.y + rows);
      for (let y = job.y; y < yEnd; y++) for (let x = 0; x < c.width; x++) {
        const mx = x / MS, my = y / MS, t = E.terrainAt(mx, my), n = O.fbm(mx / 3, my / 3, 5, 3), f = O.noise2(x * 0.6, y * 0.6, 2);
        let ramp = R[t] || R.grass, s = n > 0.58 ? 3 : n > 0.42 ? 2 : 1;
        if (t === 'forest') { const g = E.regionAt(mx, my); ramp = g && g.r.cold ? R.frost : g && g.r.dark ? R.black : R.forest; if (f > 0.6) s = (x + y) % 3 ? 1 : 3; }
        if (t === 'sea') { s = f > 0.9 ? 3 : n > 0.6 ? 2 : 1; if (((x + Math.floor(y / 6) * 3) % 11) === 0 && y % 6 === 0) s = 3; }
        if (t === 'farm') s = (Math.floor(y / 3) + Math.floor(x / 9)) % 3 === 0 ? 3 : 2;
        if (t === 'mountain' || t === 'peak') { s = n > 0.5 ? 3 : 1; if (O.noise2(x * 0.3, y * 0.3, 8) > 0.75) s = t === 'peak' ? 4 : 3; }
        if (f > 0.95) s = Math.min(4, s + 1);
        const col = ramp[s], i = (y * c.width + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      }
      job.y = yEnd; if (job.y < c.height) return null;
      ctx.putImageData(img, 0, 0); job = null;
      // ruins of older times
      for (const r of E.RUINS) { const x = Math.round(r.x * MS), y = Math.round(r.y * MS); ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = '#8a8278'; ctx.fillRect(x - 1, y - 1, 3, 3); }
      return c;
    }
    // tiny pixel pictures of places: roofs, walls, towers, a spire, a keep
    function drawPlace(ctx, s, x, y) {
      const R = O.RNG(O.hash('icon', s.id)), dark = '#1b1424';
      const roofs = ['#a8442e', '#8a5a34', '#b8683a', '#6a5a6a', '#c07a3a'], wall = '#e8dcc0', stone = '#a8a29a', stoneD = '#6a645c';
      const px = (xx, yy, c) => { ctx.fillStyle = c; ctx.fillRect(xx, yy, 1, 1); };
      const rect = (xx, yy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(xx, yy, w, h); };
      const house = (hx, hy, big) => {
        const w = big ? 5 : 4, rf = R.pick(roofs);
        rect(hx - 1, hy - 3, w + 2, 6, dark); rect(hx, hy - 4, w, 1, dark);
        rect(hx + 1, hy - 3, w - 2, 1, rf); rect(hx, hy - 2, w, 1, rf); // a peaked roof
        rect(hx, hy - 1, w, 2, wall); px(hx + Math.floor(w / 2), hy, '#5a3d26'); // walls and a door
      };
      const tower = (tx, ty, h) => { rect(tx - 2, ty - h - 1, 5, h + 2, dark); rect(tx - 1, ty - h, 3, h, stone); px(tx - 1, ty - h - 1, stone); px(tx + 1, ty - h - 1, stone); };
      const ring = (r) => { ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = stone; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2); ctx.stroke(); };
      const spire = (sx, sy) => { rect(sx - 1, sy - 7, 3, 8, dark); rect(sx, sy - 6, 1, 6, stone); px(sx, sy - 7, '#e8c860'); };
      const n = (k) => { for (let i = 0; i < k; i++) house(x + R.int(-7, 6), y + R.int(-4, 5), R.chance(0.3)); };
      switch (s.kind) {
        case 'capital': ring(13); for (let i = 0; i < 14; i++) house(x + R.int(-10, 8), y + R.int(-6, 9), R.chance(0.4)); for (const [dx, dy] of [[-12, 0], [12, 0], [0, -12], [0, 12], [-9, -9], [9, -9], [-9, 9], [9, 9]]) tower(x + dx, y + dy + 2, 4);
          rect(x + 2, y - 12, 11, 9, dark); rect(x + 3, y - 11, 9, 7, stone); tower(x + 4, y - 4, 9); tower(x + 11, y - 4, 9); tower(x + 7, y - 6, 12); px(x + 7, y - 20, '#c03030'); px(x + 8, y - 20, '#c03030'); break;
        case 'city': ring(9); for (let i = 0; i < 9; i++) house(x + R.int(-7, 5), y + R.int(-5, 6), R.chance(0.4)); for (const [dx, dy] of [[-9, 0], [9, 0], [0, -9], [0, 9]]) tower(x + dx, y + dy + 2, 4); spire(x + 1, y - 2); break;
        case 'castle': rect(x - 7, y - 6, 15, 9, dark); rect(x - 6, y - 5, 13, 7, stone); for (let k = -6; k <= 6; k += 2) px(x + k, y - 6, stone); tower(x - 6, y + 2, 9); tower(x + 6, y + 2, 9); tower(x, y + 1, 12); rect(x - 1, y - 1, 3, 3, stoneD); px(x, y - 14, '#2a4aa0'); px(x + 1, y - 14, '#2a4aa0'); break;
        case 'town': case 'port': n(s.pop > 500 ? 8 : 6); spire(x + R.int(-2, 2), y); if (s.kind === 'port') { rect(x - 9, y + 6, 6, 3, dark); rect(x - 8, y + 6, 4, 2, '#8a5a34'); px(x - 6, y + 3, wall); px(x - 6, y + 4, wall); px(x - 6, y + 5, dark); } break;
        case 'village': for (let i = 0; i < 4; i++) house(x + R.int(-5, 3), y + R.int(-2, 3), false); if (s.pop > 140) spire(x + 3, y + 1); break;
        case 'mine': rect(x - 5, y - 3, 11, 6, dark); rect(x - 4, y - 2, 9, 4, '#7a7064'); rect(x - 1, y - 1, 3, 3, '#1b1424'); house(x + 5, y + 3, false); break;
        default: house(x - 2, y, false); if (s.pop > 30) house(x + 2, y + 2, false);
      }
      if (s.detailed) { ctx.strokeStyle = '#f0b45c'; ctx.lineWidth = 1; ctx.strokeRect(x - 7.5, y - 6.5, 15, 12); }
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
        const x = Math.round(s.x * S), y = Math.round(s.y * S), sz = s.kind === 'capital' ? 6 : s.kind === 'city' ? 5 : s.kind === 'castle' ? 4 : s.pop >= 300 ? 3 : s.pop >= 80 ? 2 : 1;
        ctx.fillStyle = '#1b1424'; ctx.fillRect(x - sz - 1, y - sz - 1, sz * 2 + 3, sz * 2 + 3);
        ctx.fillStyle = s.detailed ? '#f0b45c' : s.kind === 'castle' ? '#c8ccd4' : s.kind === 'capital' || s.kind === 'city' ? '#f4e8c8' : s.happiness < 0.4 ? '#c87060' : '#e8dcc0';
        ctx.fillRect(x - sz, y - sz, sz * 2 + 1, sz * 2 + 1);
      }
      // you are here
      // you are here: exactly where you stand on the island
      { let hx, hy; const w = game.world, p = game.player; if (w.island && !game.scene) { const g = O.Island.toGlobal(w, p.x, p.y); hx = g[0] / 16 / O.Island.U; hy = g[1] / 16 / O.Island.U; } else { const h = K.place(w.placeId); if (h) { hx = h.x; hy = h.y; } }
        if (hx != null) { const x = Math.round(hx * S), y = Math.round(hy * S), b = Math.floor(game.t * 2) % 2; ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 3, y - 3, 7, 7); ctx.fillStyle = b ? '#f0b45c' : '#fff6dc'; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.strokeStyle = b ? '#f0b45c' : '#fff6dc'; ctx.strokeRect(x - 9.5, y - 9.5, 19, 19); } }
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
        <p class="caption">Gold marks where you are. Orange marks are caravans on the roads; red dashes are roads closed by damage. Crown treasury ${O.money(K.treasury)}, crown tax ${Math.round(K.taxRate * 100)}%.</p>${O.councilMinutes ? O.councilMinutes() : ''}
        <table><thead><tr><th>Settlement</th><th>Government</th><th class="n">People</th><th>Food</th><th>Content</th><th>Crime</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="lbl" style="margin-top:12px">News from the realm</div><ol class="chron">${K.news.slice(-8).reverse().map((n) => `<li><span class="lbl">Day ${n.day}</span> ${esc(n.text)}</li>`).join('') || '<li>No news yet.</li>'}</ol>`, (root) => {
        const cv = document.getElementById('kmap'); drawMap(cv);
        const wrap = cv.parentElement, view = wrap.parentElement;
        // every settlement is named; regions, lakes and rivers too
        for (const s of K.places) { const l = document.createElement('span'); l.className = 'maplabel' + (s.id === game.world.placeId ? ' here' : '') + (s.kind === 'capital' ? ' capital' : s.kind === 'city' ? ' city' : s.kind === 'hamlet' ? ' small' : s.kind === 'village' || s.kind === 'mine' ? ' mid' : ''); l.textContent = s.name; const drop = { capital: 2.6, city: 2.2, castle: 1.8, town: 1.4, port: 1.4 }[s.kind] ?? 1; l.style.left = (s.x / E.W * 100) + '%'; l.style.top = ((s.y + drop) / E.H * 100) + '%'; wrap.appendChild(l); }
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
    game.hooks.update.push(() => { if (!mapCanvas && !O.panelOpen && game.t > 2) mapCanvas = renderMap(6); });
  }
  O.KingdomUI = { setup };
})();
