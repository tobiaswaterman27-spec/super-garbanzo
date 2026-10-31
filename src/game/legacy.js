// What you leave behind. A village of your own: get a charter for wild land from a lord, the sheriff,
// a reeve or the crown, pick the spot out in the open country, give it a name and choose how it will be
// governed (as its lord, by a council of its freemen with you at the head, or by a reeve the moot
// chooses); then raise its buildings one by one, and settlers come to fill them. Whoever leads it sits
// at the council of the realm in the royal castle on Thursdays, and the crown notices who doesn't come.
// Growing old: the years show on your face, and slow your step; and when you're ready, ask a grown
// child of yours to take over and you live on as them, your old self beside them in the house. And,
// very rarely, things that undo the years: the Elixir of Youth, and the Water of the Undying Spring.
'use strict';
(function () {
  const D = O.Data, T = 16;
  Object.assign(D.GOODS, {
    elixir: D.GOODS.elixir || { name: 'Elixir of Youth', base: 4000, unit: 'phial', slots: 1, drink: true, rare: true },
    undying: D.GOODS.undying || { name: 'Water of the Undying Spring', base: 9000, unit: 'flask', slots: 1, drink: true, rare: true },
  });
  const KINDS = [['house', 'Cottage', 180], ['bakery', 'Bakehouse', 260], ['tavern', 'Alehouse', 340], ['smithy', 'Smithy', 260], ['store', 'Village store', 240], ['chapel', 'Chapel', 380], ['mill', 'Mill', 320]];
  const GOVS = { lord: 'You rule it as lord of the manor: higher rents, and the say is yours alone.', council: 'A council of its freemen, with you at its head: lower rents, and settlers come gladly.', reeve: 'A reeve chosen at the moot runs it for you: you take the rents, they keep the peace.' };
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), clamp = O.clamp, esc = (t) => O.escape(String(t));
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const V = () => PS.village;

    // ---------------------------------------------------------------- the charter, the spot, the name
    const canGrant = (q) => q.lordOf || q.gentry || q.title === 'Sheriff' || /reeve|steward|lord|lady|king|queen|monarch|chamberlain/.test((q.job?.role || '') + ' ' + (q.title || '').toLowerCase());
    function grant(s, q, a) { if (PS.charter || V() || !canGrant(q)) return null; const pr = clamp(Math.round(Number(a.price) || 200), 0, 2000); if (PS.money < pr) return `You haven't ₳${pr}.`; PS.money -= pr; PS.charter = { day: s.day, by: q.name, place: s.world.placeId }; return `${q.first} grants you a charter for wild land to settle${pr ? ` (₳${pr})` : ''}. Find your spot out in the open country.`; }
    const spotOk = (w, tx, ty) => {
      if (w.ox == null) return false; const dt = Math.max(w.ox - tx, tx - w.ox - w.townW, w.oy - ty, ty - w.oy - w.townH, 0); if (dt < 22) return false;
      if (w.gx0 != null && (O.Island.ownerAt(w.gx0 + tx, w.gy0 + ty) || {}).id !== w.placeId) return false;
      for (let y = ty - 7; y <= ty + 7; y++) for (let x = tx - 10; x <= tx + 10; x++) { if (x < 2 || y < 2 || x >= w.W - 2 || y >= w.H - 2) return false; const t = w.ter[y * w.W + x]; if (t === w.TER.WATER) return false; }
      return !w.buildings.some((b) => Math.abs(b.x - tx) < 14 && Math.abs(b.y - ty) < 10);
    };
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), w = game.world, P = game.player; if (!s || game.scene || !w.ter) return null;
      if (PS.charter && !V() && PS.charter.place === w.placeId) { const tx = Math.floor(P.x / T), ty = Math.floor(P.y / T); if (!spotOk(w, tx, ty)) return null; return { type: 'custom', d: 3, x: P.x, y: P.y - 50, label: 'Found your village here', act: () => found(s, w, tx, ty) }; }
      const v = V(); if (v && v.place === w.placeId && Math.hypot(v.cx * T + 8 - P.x, v.cy * T + 8 - P.y) < 36) return { type: 'custom', d: 1, x: v.cx * T + 8, y: v.cy * T - 30, label: v.gov ? `${v.name}: raise a building` : `${v.name || 'Your village'}: how will it be governed?`, act: () => (v.gov ? builder(s) : govern(s)) };
      return null;
    });
    function found(s, w, tx, ty) {
      O.Panels.open('A village of your own', `<p>Here, then. What will it be called?</p><input type="text" data-n maxlength="22" placeholder="${esc(['Newfold', 'Ashby', 'Thornfield', 'Holmwick', 'Brightwater'][s.day % 5])}" style="width:100%"><div class="topics" style="margin-top:8px"><button data-ok>Found it</button></div>`, (r) => {
        const i = r.querySelector('[data-n]'); i.focus();
        const ok = () => {
          const nm = (i.value || i.placeholder).trim().replace(/[^A-Za-z' -]/g, '').slice(0, 22) || i.placeholder; O.Panels.close();
          const plots = []; for (const [dx, dy] of [[-8, -2], [-3, -2], [3, -2], [-8, 5], [-3, 5], [3, 5], [8, 1]]) plots.push([tx + dx, ty + dy, 4, 3]);
          PS.village = { name: nm, place: w.placeId, cx: tx, cy: ty, founded: s.day, plots, used: [], gov: null };
          lay(w, PS.village);
          O.addLead && O.addLead({ place: w.placeId, tile: [tx, ty], why: 'village', key: 'village', label: nm, until: 1e9 });
          s.log(`The stranger has founded a village, ${nm}, in the open country outside ${s.world.name}.`, 'life'); PS.charter = null;
          say(`${nm} is founded. Stand by its signpost to decide how it will be governed, then raise its buildings.`);
        };
        r.querySelector('[data-ok]').onclick = ok; i.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
      });
    }
    // the ground cleared, the street laid and the signpost up (again, whenever the world is built afresh)
    function lay(w, v) {
      if (w.props.some((p) => p.village)) return; const tx = v.cx, ty = v.cy;
      for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 9; x <= tx + 9; x++) { const k = y * w.W + x; if (w.ter[k] === w.TER.FOREST) w.ter[k] = w.TER.GRASS; }
      w.trees = w.trees.filter((t) => !(Math.abs(t.x / T - tx) <= 9 && Math.abs((t.y - 1) / T - ty) <= 6)); w.props = w.props.filter((p) => !(Math.abs(p.x / T - tx) <= 9 && Math.abs((p.y - 1) / T - ty) <= 6 && !p.flat));
      for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 9; x <= tx + 9; x++) if (!w.buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y <= b.bottom)) w.solid[y * w.W + x] = 0;
      for (let x = tx - 9; x <= tx + 9; x++) w.ter[(ty + 1) * w.W + x] = w.TER.ROAD; // the village street
      w.props.push({ kind: 'signpost', x: tx * T + 8, y: ty * T + 14, seed: 3, v: 0, solid: true, village: true }); w.solid[ty * w.W + tx] = 1; w.dirtyStatics = true;
      if (w._chunks) for (let cy = Math.floor((ty - 7) / 16); cy <= Math.floor((ty + 7) / 16); cy++) for (let cx = Math.floor((tx - 10) / 16); cx <= Math.floor((tx + 10) / 16); cx++) w._chunks.delete(cx + ',' + cy);
    }
    const laid = new WeakSet();
    game.hooks.update.push(() => { const w = game.world, v = V(); if (!v || !w || !w.ter || laid.has(w) || w.placeId !== v.place) return; laid.add(w); lay(w, v); });
    function govern(s) {
      const v = V();
      O.Panels.open(`How ${esc(v.name)} is governed`, `${Object.entries(GOVS).map(([k, t]) => `<button data-g="${k}" style="display:block;width:100%;text-align:left;margin:4px 0">${esc(t)}</button>`).join('')}<p class="caption">Whoever leads it sits at the council of the realm in the royal castle, Thursdays at two.</p>`, (r) => {
        r.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { v.gov = b.dataset.g; O.Panels.close(); s.log(`${v.name} is to be ${v.gov === 'lord' ? 'held by the stranger as lord of the manor' : v.gov === 'council' ? 'governed by a council of its freemen, the stranger at its head' : 'run by a reeve chosen at the moot'}.`, 'politics'); say(`${v.name} has its government. Now raise its first buildings.`); });
      });
    }
    function builder(s) {
      const v = V(), free = v.plots.map((pl, i) => i).filter((i) => !v.used.includes(i));
      O.Panels.open(`Building ${esc(v.name)}`, free.length ? `<p class="caption">Builders and timber are paid from your purse; the stone and timber still have to reach the site before each stage can go up.</p>${KINDS.map(([k, l, c]) => `<button data-k="${k}" style="display:block;width:100%;text-align:left;margin:3px 0">${esc(l)}: ${O.money(c)}</button>`).join('')}` : '<p>Every plot in the village is built on.</p>', (r) => {
        r.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => {
          const k = b.dataset.k, [, label, cost] = KINDS.find((x) => x[0] === k); if (PS.money < cost) return O.Panels.toast(`You need ${O.money(cost)}.`, 'bad');
          const i = free[0]; v.used.push(i); PS.money -= cost; O.Panels.close();
          const site = s.build.start(1000 + i, cost, { player: true }); if (site) { site.intent = k; site.villageLabel = label; site.b.name = `${v.name} ${label} (building)`; }
          say(`Builders start on the ${label.toLowerCase()} at ${v.name}.`);
        });
      });
    }
    // building on the village's own plots, and what each becomes when it's done
    { const s0 = O.SimRef.home, proto = s0 && s0.build && Object.getPrototypeOf(s0.build);
      if (proto) {
        const _plot = proto.plot; proto.plot = function (i) { if (i >= 1000 && PS.village) return PS.village.plots[i - 1000]; return _plot.call(this, i); };
        const _fin = proto.finish; proto.finish = function (site) {
          const r = _fin.call(this, site);
          if (site.intent && site.intent !== 'house' && PS.village) { const b = site.b; if (this.sim.startBusiness) { const bz = this.sim.startBusiness(b, site.intent, 'player'); if (bz) { bz.name = b.name = `${PS.village.name} ${site.villageLabel}`; } } }
          else if (PS.village && site.villageLabel) site.b.name = `A cottage in ${PS.village.name}`;
          return r;
        };
      } }
    // the rents: lord takes more, a free council less
    { const SP = O.Sim.prototype, _nd = SP.newDay; SP.newDay = function () { const r = _nd.apply(this, arguments); const v = V(); if (v && v.gov && this === O.SimRef.home) { const n = this.world.buildings.filter((b) => b.owner?.kind === 'player' && b.household && v.plots.some(([x, y]) => x === b.x && y === b.bottom)).length; const per = v.gov === 'lord' ? 4 : v.gov === 'council' ? 2 : 3; if (n) { PS.money += n * per; PS.rentIncome = (PS.rentIncome || 0) + n * per; } } return r; }; }

    // ---------------------------------------------------------------- the council of the realm: you must go
    const leads = () => { const v = V(); return v && (v.gov === 'lord' || v.gov === 'council'); };
    let cd = -1;
    game.hooks.update.push(() => {
      const H = O.SimRef.home; if (!H || !leads() || cd === H.day) return; cd = H.day; const K = H.kingdom;
      const cap = K.places.find((p) => p.kind === 'capital');
      if (H.weekday === 3) { O.addLead && O.addLead({ place: cap ? cap.id : 'aurelia', why: 'council', key: 'council', label: 'The council of the realm, royal castle, 2pm', from: H.day * 1440 + 13 * 60, until: H.day * 1440 + 17 * 60 }); say(`The council of the realm sits today at two, in the royal castle. As head of ${V().name} you are expected.`); }
      if (H.weekday === 4) { const went = K.councilPending && K.councilPending.done && K.councilPending.day === H.day - 1; const v = V();
        if (went) { v.missed = 0; } else { v.missed = (v.missed || 0) + 1; say(`You were missed at the council of the realm. The crown notes it${v.missed >= 2 ? ', and not kindly' : ''}.`, 'bad'); if (v.missed >= 3) { v.gov = 'reeve'; v.missed = 0; H.log(`The crown has put a reeve over ${v.name}: its head never came to the council of the realm.`, 'politics'); say(`The crown has put a reeve over ${v.name}, since you never come to the council.`, 'bad'); } } }
    });

    // ---------------------------------------------------------------- growing old
    let lastAge = null;
    game.hooks.update.push(() => {
      const a = O.Forge && O.Forge.player; if (!a) return;
      if (PS.undying != null && a.age > PS.undying) a.age = PS.undying; // (the years don't take you)
      if (lastAge == null) { lastAge = a.age; return; }
      if (a.age !== lastAge) { lastAge = a.age; reage(a.age); if (a.age === 60) say('Your step is slower than it was, and there is grey in your hair.'); }
    });
    function reage(age) {
      const sp = Object.assign({}, O.Forge.spec(), { age, hairGrey: age >= 52 }), old = O.Forge.player, a = O.Creator.appearanceFromSpec(sp);
      if (old && old.outfit) a.outfit = old.outfit; a.age = age; O.Forge.setPlayer(a, sp);
      if (game.player._baseA) game.player._baseA = a; else game.setPlayerAppearance(a); lastAge = age;
    }
    O.reagePlayer = reage;
    { const _sp = game.speedFor; game.speedFor = function (run) { const v = _sp ? _sp.call(this, run) : run ? 92 : 50, age = (O.Forge && O.Forge.player && O.Forge.player.age) || 27; return game.player.mount ? v : v * (age >= 75 ? 0.72 : age >= 60 ? 0.86 : 1); }; }
    // ---------------------------------------------------------------- an heir to carry on
    function inherit(s, q) {
      if (!q.playerChild || q.age < 16 || q.alive === false) return null;
      const sp = O.Forge.spec(), oldA = O.Forge.player, hh = s.household(q); if (!hh) return null;
      // your old self lives on, as one of the household
      const me = s.newPerson({ sex: sp.sex, age: oldA.age || sp.age, first: sp.name, sur: sp.surname || q.sur, household: hh.id, home: q.home, genes: oldA.genes || q.genes, wealth: 0.6 });
      me.name = `${me.first} ${me.sur}`; me.app = oldA; me.children = [q.id];
      me.agent = { x: game.player.x + 14, y: game.player.y, dir: 0, anim: 'idle', ft: 0, a: oldA, hidden: !!game.scene, inside: q.agent.inside, path: null, goal: null, person: me };
      me.activity = { act: 'home', b: q.home }; hh.members.push(me.id);
      // and you are your child now: their face, their name, their friends
      for (const p of s.people) { if (p === q || p === me) continue; const rc = p.rel.get(q.id), r0 = p.rel.get(0); if (r0) p.rel.set(me.id, Object.assign({}, r0)); if (rc) p.rel.set(0, Object.assign({}, rc, { name: q.first })); else p.rel.delete(0); }
      const P0 = PS.partner; if (P0 && P0.stage === 'married') { const z = s.byId.get(P0.id); if (z) { z.spouse = me.id; me.spouse = z.id; z.withPlayer = null; } PS.partner = null; }
      (PS.forebears = PS.forebears || []).push({ name: `${sp.name} ${sp.surname || ''}`.trim(), age: oldA.age, day: s.day, retired: true });
      PS.children = (PS.children || []).filter((k) => k.id !== q.id);
      const nsp = Object.assign({}, sp, { name: q.first, surname: q.sur, sex: q.sex, age: q.age, hairGrey: false });
      s.people.splice(s.people.indexOf(q), 1); s.byId.delete(q.id); hh.members = hh.members.filter((id) => id !== q.id);
      O.Forge.setPlayer(q.app, nsp); if (game.player._baseA) game.player._baseA = q.app; else game.setPlayerAppearance(q.app); lastAge = q.app.age = q.age;
      PS.undying = null;
      s.log(`${me.name} has handed all on to ${q.first}, and lives on in the house in their old age.`, 'life');
      setTimeout(() => O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(), 300);
      return `You carry on as ${q.first} ${q.sur}. Your old self lives on beside you.`;
    }

    // ---------------------------------------------------------------- the rarest things in the realm
    const youngNPC = (q, age) => { q.age = age; q.stage = O.Char.ageStage ? O.Char.ageStage(age) : q.stage; const o = q.app && q.app.outfit; q.app = O.Char.makeAppearance(O.hash('person', q.id, q.first), { sex: q.sex, age, genes: q.genes, role: q.job ? 'villager' : 'villager', wealth: 0.5 }); if (o) q.app.outfit = o; if (q.agent) q.agent.a = q.app; };
    if (O.consume) { const _c = O.consume; O.consume = (k) => {
      if (k === 'elixir') { PS.remove('elixir'); const age = Math.min(25, (O.Forge.player && O.Forge.player.age) || 25); O.Forge.player.age = age; reage(age); say('You drink the elixir. The years run off you like water: you are young again.'); return; }
      if (k === 'undying') { PS.remove('undying'); PS.undying = (O.Forge.player && O.Forge.player.age) || 27; say('You drink from the flask. Something settles in you, still and deep: the years will not touch you now.'); return; }
      return _c(k); }; }
    (O.onGift = O.onGift || []).push((s, q, o) => {
      if (o.g === 'elixir') { youngNPC(q, Math.min(25, q.age)); s.remember(q, 'The stranger gave me the Elixir of Youth. I am young again.', 'player', 3, 1); relOf(q).affinity = 1; }
      if (o.g === 'undying') { q.undying = q.age; s.remember(q, 'The stranger gave me the Water of the Undying Spring. I will not grow old.', 'player', 3, 1); relOf(q).affinity = 1; }
    });
    { const SP = O.Sim.prototype, _nd = SP.newDay; SP.newDay = function () { const r = _nd.apply(this, arguments); for (const p of this.people) if (p.undying != null && p.age > p.undying) p.age = p.undying; return r; }; }
    // where they might be found: an old ruin's rubble, a ship home from the south, an apothecary's shelf in the capital, once in a long while
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), w = game.world, P = game.player; if (!s || game.scene || !w.props) return null;
      const ru = w.props.find((p) => p.ruinName && Math.hypot(p.x - P.x, p.y - P.y) < 40); if (!ru) return null;
      const k = w.placeId + ':' + ru.ruinName; if ((PS.searched || {})[k]) return null;
      return { type: 'custom', d: 2, x: ru.x, y: ru.y - 60, label: `Search the ruins of ${ru.ruinName}`, act: () => { (PS.searched = PS.searched || {})[k] = s.day; const P0 = game.player; P0.anim = 'crouch'; setTimeout(() => { P0.anim = 'idle'; const r = Math.random(); if (r < 0.03 && PS.canCarry('elixir')) { PS.add('elixir'); say('Under a fallen stone, wrapped in rotten silk: a little phial, still sealed. The Elixir of Youth.'); } else if (r < 0.04 && PS.canCarry('undying')) { PS.add('undying'); say('In a niche in the old wall, a flask of clear water that never seems to warm. The Water of the Undying Spring.'); } else if (r < 0.4) { const n = 3 + Math.floor(Math.random() * 12); PS.money += n; say(`Old coins in the rubble: ₳${n}.`); } else say('Nettles, rubble and old bones. Nothing.'); }, 2200); } };
    });
    let rd = -1;
    game.hooks.update.push(() => { const s = cur(); if (!s || rd === s.day) return; rd = s.day; if (s.world.placeId !== 'aurelia' || Math.random() > 0.02) return; const ap = [...s.biz.values()].find((z) => z.type === 'apothecary'); if (ap && !(ap.stock.elixir > 0)) { ap.stock.elixir = 1; ap.def.sells.includes('elixir') || ap.def.sells.push('elixir'); } });

    const A = { grant_charter: grant, inherit };
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) { if (a && A[a.do]) return A[a.do](s, q, a); return base.apply(this, arguments); };
    (O.extraActs = O.extraActs || []).push('grant_charter {"price"} (a lord, sheriff, reeve or the crown granting the player a charter to settle wild land and found a village)', 'inherit (only the player\'s own grown child, when the player asks them to take over everything: they agree to carry on in the player\'s place)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [], v = V(), age = (O.Forge && O.Forge.player && O.Forge.player.age) || 27;
      if (canGrant(q) && !v && !PS.charter) out.push('You could grant the player a charter to settle wild land and found a village (grant_charter), for a price, if you think them fit.');
      if (v) out.push(`The player founded the village of ${v.name}${v.gov ? `, ${v.gov === 'lord' ? 'and holds it as its lord' : v.gov === 'council' ? 'and heads its council' : 'run by a reeve'}` : ''}.`);
      if (q.playerChild && q.age >= 16) out.push(`You are the player's own ${q.sex === 'm' ? 'son' : 'daughter'}. ${age >= 45 ? 'If they ask you to take over everything from them, you may agree (inherit).' : ''}`);
      if (PS.undying != null) out.push('The player never seems to grow any older, and folk whisper about it.');
      return out.join(' ');
    });
  }
  O.LegacySetup = { setup };
})();
