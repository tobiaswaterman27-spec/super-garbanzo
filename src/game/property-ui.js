// Property and lordship for the player: For Sale signs on empty houses and shops, buying, letting to
// tenants, opening a business, selling, the Holdings panel (P), and, for the rich and respectable -
// the lordship of the town you're in, with its powers over tax, the watch, relief and building.
'use strict';
(function () {
  const PS = O.PlayerState, esc = (s) => O.escape(s);

  function setup(game, sim) {
    const home = () => O.SimRef.home;
    const forSale = (b) => !(O.isPublicBuilding && O.isPublicBuilding(b)) && !b.site && !b.ruined && !b.fire && b.type !== 'hideout' && ((b.type === 'house' && !b.household) || b.closedShop || b.listed) && (!b.owner || b.owner.kind !== 'player');
    O.forSale = forSale;
    // the realm's own buildings are never for sale: halls, the watch, churches, the morgue, hospitals, schools, castles
    const PUBLIC = new Set(['townhall', 'guard', 'chapel', 'church', 'cathedral', 'morgue', 'hospital', 'school', 'keep', 'palace', 'kitchen', 'moothall', 'jail', 'harbour', 'minecourt', 'posthouse', 'gatehouse', 'gaol']);
    O.isPublicBuilding = (b) => PUBLIC.has(b.type) || !!(O.Data.BUSINESS[b.type] && O.Data.BUSINESS[b.type].public);
    const owned = (b) => b.owner && b.owner.kind === 'player';

    // a little painted sign by the door of anything for sale
    let signCanvas = null;
    function sign() {
      if (signCanvas) return signCanvas;
      const P = O.Pal, B = new O.MatBuffer(22, 18); B.part(1); B.capsule(4, 17, 4, 3, 0.8, 0.8, P.mat(P.wood.oak, 'wood'));
      B.part(2); B.rect(1, 2, 20, 9, P.mat('#e8dcc0', 'cloth'), 3); for (let x = 1; x < 21; x++) B.shadeAt(x, 10, 1);
      const red = P.mat('#a8382f', 'cloth');
      const FONT = { S: ['111', '100', '111', '001', '111'], A: ['010', '101', '111', '101', '101'], L: ['100', '100', '100', '100', '111'], E: ['111', '100', '110', '100', '111'] };
      [...'SALE'].forEach((ch, i) => FONT[ch].forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') B.plot(3 + i * 4 + x, 4 + y, red, 2); })));
      signCanvas = B.toCanvas(); return signCanvas;
    }
    // the boards stand in the street as real things (you walk round them, and they sit behind what's in front)
    let saleT = 0;
    const saleSprite = () => { const c = sign(); return { canvas: c, ox: 11, oy: 17, W: c.width, H: c.height }; };
    // somebody brings the board and knocks it in: the house agent, the owner, or the parish clerk
    const putter = (s, b) => {
      const ok = (q) => q && q.alive !== false && q.age >= 16 && !q.errand && q.agent && !q.agent.hidden && q.agent.inside == null && q.health?.hp > 30 && !q.visitor && Math.hypot(q.agent.x - b.doorX * 16, q.agent.y - b.doorY * 16) < 260;
      const agent = [...s.biz.values()].filter((z) => z.type === 'agency').flatMap((z) => z.workers.map((id) => s.byId.get(id))).find(ok);
      if (agent) return agent;
      const hh = b.owner?.kind === 'household' && s.households[b.owner.id - 1]; const own = hh && hh.members.map((id) => s.byId.get(id)).find(ok); if (own) return own;
      const pl = game.player; return s.people.filter(ok).sort((a, c) => Math.hypot(a.agent.x - b.doorX * 16, a.agent.y - b.doorY * 16) - Math.hypot(c.agent.x - b.doorX * 16, c.agent.y - b.doorY * 16))[0] || null; void pl;
    };
    const coming = new WeakSet();
    game.hooks.update.push((dt) => {
      saleT -= dt; const w = game.world, s = O.SimRef.cur; if (saleT > 0 || !w || game.scene || !s || w !== s.world) return; saleT = 1;
      for (const b of w.buildings) {
        if (b.doorX == null) continue;
        const want = forSale(b), has = w.props.find((p) => p.kind === 'salesign' && p.signFor === b.id);
        if (want && !has && !coming.has(b)) {
          const near = w._saleSeen && O.Errands.live.size < 2 && Math.hypot(b.doorX * 16 - game.player.x, b.doorY * 16 - game.player.y) < 420, at = O.Signs.spotBy(w, b, 1), q = near && at && putter(s, b);
          // out of sight it's simply there; in sight you watch it go up
          if (q && O.Errands.send(s, q, [at[0], at[1] + 1], { anim: 'hammer', secs: 3, face: 3, carry: { good: 'planks', qty: 1 }, at: () => { O.Speech && O.Speech.say(q, b.type === 'house' ? 'For sale, this one.' : 'Up for sale.', 2.5); }, after: (ok) => { coming.delete(b); if (ok && forSale(b) && !w.props.some((p) => p.kind === 'salesign' && p.signFor === b.id)) O.Signs.plant(w, b, 'salesign', saleSprite(), 1); } })) coming.add(b);
          else O.Signs.plant(w, b, 'salesign', saleSprite(), 1);
        } else if (!want && has) O.Signs.pull(w, has);
      }
      w._saleSeen = true; // boards already up when you arrive; new ones are carried out in front of you
    });
    O.saleCandidate = () => {
      if (game.scene) return null;
      const w = game.world, pl = game.player;
      for (const q of w.props) if (q.kind === 'salesign' && Math.abs(q.x - pl.x) < 26 && Math.abs(q.y - pl.y) < 26) { const b = w.buildings.find((x) => x.id === q.signFor); if (b) { const d = Math.hypot(q.x - pl.x, q.y - pl.y); return { type: 'property', b, d, x: q.x, y: q.y - 28 }; } }
      for (const b of (O.SimRef.cur || sim).world.buildings) { if (!(forSale(b) || owned(b))) continue; const d = Math.hypot(b.doorX * 16 + 8 - pl.x, b.doorY * 16 + 6 - pl.y); if (d < 16) return { type: 'property', b, d: d + 2, x: b.doorX * 16 + 8, y: b.doorY * 16 - 20 }; }
      return null;
    };
    // owners put things up for sale now and then: a landlord's spare house, a struggling shop
    let lastList = -1;
    game.hooks.update.push(() => {
      const H = home(); if (H.day === lastList) return; lastList = H.day;
      for (const v of O.Travel.visited.values()) {
        const s = v.sim, r = s.rng;
        for (const b of s.world.buildings) if (b.listed && H.day - b.listed.day > 12) b.listed = null; // no buyer: taken off the market
        if (!r.chance(0.35)) continue;
        const spare = s.world.buildings.filter((b) => b.type === 'house' && b.owner?.kind === 'household' && b.household && s.households[b.owner.id - 1] && s.households[b.owner.id - 1].home !== b.id && !b.listed);
        const weak = [...s.biz.values()].filter((bz) => !bz.ownerPlayer && bz.cash < 15 && bz.workers && bz.workers.length).map((bz) => s.world.buildings.find((b) => b.id === bz.id)).filter((b) => b && !b.listed && !O.isPublicBuilding(b));
        const pick = r.chance(0.5) && spare.length ? r.pick(spare) : weak.length ? r.pick(weak) : spare.length ? r.pick(spare) : null;
        if (pick) { pick.listed = { day: H.day }; s.log(`${pick.type === 'house' ? 'A let house' : pick.name} has been put up for sale.`, 'economy'); }
      }
    });

    function panel(b) {
      const s = O.SimRef.cur || sim, v = s.value(b), mine = owned(b), shop = !!b.closedShop || (s.biz.get(b.id) && mine), leased = PS.lease && PS.lease.b === b.id && PS.lease.place === s.world.placeId;
      const tenants = b.household ? s.households[b.household - 1] : null;
      const rentEst = s.rentValue(b);
      O.Panels.open(mine ? `Your ${b.type === 'house' ? 'house' : 'property'}` : `${b.listed ? (s.biz.get(b.id) ? `${b.name}, a going concern,` : 'A let house') : b.closedShop ? 'Empty shop' : 'Empty house'} for sale`, `<div class="kv">
        <div><span class="lbl">Value</span><b>${O.money(v)}</b><small>${b.w * 2}×${b.d * 2} paces inside, ${b.floors || 1} floor${(b.floors || 1) > 1 ? 's' : ''}, condition ${Math.round((b.condition ?? 0.8) * 100)}%</small></div>
        <div><span class="lbl">Owner</span><b>${esc(s.ownerName(b.owner))}</b><small>${tenants ? `let to the ${esc(tenants.surname)} family at ₳${b.rent || rentEst} a week` : 'standing empty'}</small></div>
        ${b.closedShop ? `<div><span class="lbl">Was</span><b>${esc(b.closedShop.name)}</b><small>closed on day ${b.closedShop.day}</small></div>` : ''}
      </div>
      <div class="topics" style="margin-top:10px">
        ${!mine ? `<button data-a="buy">Buy for ${O.money(v)}</button>` : ''}
        ${!mine && !leased ? `<button data-a="rent">Rent it for ₳${s.rentValue(b)} a week</button>` : ''}
        ${mine && s.biz.get(b.id)?.ownerPlayer ? '<button data-a="run">Run the business</button>' : ''}
        ${mine && b.type === 'house' && !b.household ? `<button data-a="let">Let it to a family (₳${rentEst} a week)</button>` : ''}
        ${mine && b.closedShop ? ['bakery', 'store', 'tavern', 'smithy'].map((t) => `<button data-open="${t}">Open a ${O.Data.BUSINESS[t].label.toLowerCase()} (₳60)</button>`).join('') : ''}
        ${(mine || leased) && O.fitsAs ? O.fitsAs(b).filter((t) => t !== b.type && !s.biz.get(b.id)).slice(0, 6).map((t) => `<button data-open2="${t}">Open as a ${O.Data.BUSINESS[t].label.toLowerCase()} (₳40 stock)</button>`).join('') : ''}
        ${mine ? ['stone', 'wood', 'dirt'].map((f) => `<button data-floor="${f}">Lay a ${f} floor</button>`).join('') + ['plank', 'timber', 'stone'].map((w2) => `<button data-wall="${w2}">${w2} walls</button>`).join('') : ''}
        ${mine && !O.isPublicBuilding(b) ? `<button data-a="sell">Sell for ${O.money(Math.round(v * 0.8))}</button>` : ''}
      </div>`, (r) => {
        const on = (sel, f) => { const el = r.querySelector(sel); if (el) el.onclick = f; };
        on('[data-a=buy]', () => {
          if (PS.money < v) return O.Panels.toast(`You need ${O.money(v)}.`, 'bad');
          PS.money -= v;
          if (b.owner && b.owner.kind === 'household') { const hh = s.households[b.owner.id - 1]; if (hh) hh.money += v; } else s.treasury.cash += v;
          b.owner = { kind: 'player' }; b.rent = b.household ? (b.rent || rentEst) : null;
          if (b.listed) { b.listed = null; const bz = s.biz.get(b.id); if (bz) { const seller = bz.owner != null && s.byId.get(bz.owner); if (seller) { const hh = s.household(seller); if (hh) hh.money += Math.round(v * 0.2); } bz.ownerPlayer = true; } }
          s.log(`A newcomer has bought ${b.closedShop ? 'the old ' + b.closedShop.name : 'a house'} for ₳${v}.`, 'economy');
          PS.rep.merchant = Math.min(1, PS.rep.merchant + 0.05);
          panel(b);
        });
        on('[data-a=let]', () => { if (!s.immigrate) return; const hh = s.immigrate(b); if (hh) { b.rent = rentEst; O.Panels.toast(`The ${hh.surname} family will take it at ₳${rentEst} a week. They're on the road now.`); } O.Panels.close(); });
        on('[data-a=sell]', () => { const pr = Math.round(v * 0.8); PS.money += pr; s.treasury.cash -= Math.min(s.treasury.cash, pr); b.owner = { kind: 'parish' }; const bz = s.biz.get(b.id); if (bz) bz.ownerPlayer = false; O.Panels.close(); O.Panels.toast(`Sold for ${O.money(pr)}.`); });
        on('[data-a=rent]', () => { const rent = s.rentValue(b); if (PS.money < rent) return O.Panels.toast(`The first week's rent is ₳${rent}.`, 'bad'); PS.money -= rent; if (b.owner?.kind === 'household') { const hh = s.households[b.owner.id - 1]; if (hh) hh.money += rent; } else s.treasury.cash += rent; PS.lease = { b: b.id, place: s.world.placeId, rent, paidUntil: s.day + 7 }; b.leasedToPlayer = true; b.listed = null; O.Panels.close(); O.Panels.toast(`It's yours to use at ₳${rent} a week. The landlord will come for the rent.`); });
        on('[data-a=run]', () => runBusiness(b));
        r.querySelectorAll('[data-open2]').forEach((x) => x.onclick = () => { if (PS.money < 40) return O.Panels.toast('You need ₳40 for the first stock.', 'bad'); PS.money -= 40; const bz = s.startBusiness(b, x.dataset.open2, 'player'); s.fillVacancies(); O.Panels.close(); O.Panels.toast(`${bz.name} opens. Its fittings make it what it is: take them out and it stops.`); });
        r.querySelectorAll('[data-floor]').forEach((x) => x.onclick = () => { O.redecorate(b, 'floor', x.dataset.floor); panel(b); });
        r.querySelectorAll('[data-wall]').forEach((x) => x.onclick = () => { O.redecorate(b, 'wall', x.dataset.wall); panel(b); });
        r.querySelectorAll('[data-open]').forEach((x) => x.onclick = () => { if (PS.money < 60) return O.Panels.toast('You need ₳60 to stock and staff it.', 'bad'); PS.money -= 60; const bz = s.startBusiness(b, x.dataset.open, 'player'); s.fillVacancies(); O.Panels.close(); O.Panels.toast(`${bz.name} opens under your ownership. A manager will run it; the profit is yours.`); });
      });
    }
    O.propertyPanel = panel;
    // running a business you own: its purse, its people, their pay and their posts
    function runBusiness(b) {
      const s = O.SimRef.cur || sim, bz = s.biz.get(b.id); if (!bz) return;
      const roles = bz.def.jobs.map((j) => j[0]);
      const goods = Object.keys(bz.def.buys || {}).filter((g) => O.Data.GOODS[g]);
      const moveTo = s.world.buildings.filter((x) => x !== b && !s.biz.get(x.id) && !x.household && !x.site && !x.ruined && !O.isPublicBuilding(x) && (x.owner?.kind === 'player' || (PS.lease && PS.lease.b === x.id && PS.lease.place === s.world.placeId)));
      const rows = bz.workers.map((id) => s.byId.get(id)).filter(Boolean).map((q) => `<tr><td>${esc(q.name)}<br><small class="lbl">${esc(q.job.role)}${q.job.wage != null ? `, ₳${q.job.wage} a day` : ''}</small></td><td><button data-raise="${q.id}">Raise</button>${roles.indexOf(q.job.role) > 0 ? `<button data-promote="${q.id}">Promote</button>` : ''}<button data-fire="${q.id}">Dismiss</button></td></tr>`).join('');
      O.Panels.open(`Running ${bz.name}`, `<div class="kv"><div><span class="lbl">Business purse</span><b>${O.money(Math.floor(bz.cash))}</b><small>your hands spend it on what the business needs</small></div><div><span class="lbl">Today's takings</span><b>${O.money(Math.round(bz.salesToday || 0))}</b></div></div>
        <div class="topics" style="margin:8px 0"><button data-fund="20">Put in ₳20</button><button data-take="20">Take out ₳20</button><button data-hire="1">Take on hands</button></div>
        <table><thead><tr><th>Hand</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="2">Nobody works here yet.</td></tr>'}</tbody></table>
        <div class="lbl" style="margin-top:10px">Standing deals</div>
        <ul class="chron">${(bz.deals || []).map((d, i) => `<li>${d.qty} ${esc(O.Data.GOODS[d.good]?.name.toLowerCase() || d.good)} from ${esc(d.fromName)} at ₳${d.price} each, ${d.when === 'daily' ? 'every day' : 'every ' + O.DAYNAMES[d.when ?? 6]} <button data-undeal="${i}">End it</button></li>`).join('') || '<li>None.</li>'}</ul>
        ${goods.length ? `<div class="topics"><select data-dg>${goods.map((g) => `<option value="${g}">${esc(O.Data.GOODS[g]?.name || g)}</option>`).join('')}</select><select data-dq><option>5</option><option selected>10</option><option>20</option></select><select data-dd><option value="daily">every day</option>${O.DAYNAMES.map((n, i) => `<option value="${i}" ${i === 6 ? 'selected' : ''}>every ${n}</option>`).join('')}</select><button data-deal="1">Offer a supplier a standing deal</button></div>` : ''}
        <div class="topics" style="margin-top:8px">${moveTo.length ? moveTo.map((x) => `<button data-move="${x.id}">Move the business to ${esc(x.type === 'house' ? 'your house' : x.closedShop ? 'the old ' + x.closedShop.name : x.name)}</button>`).join('') : '<small class="lbl">To move the business, first buy or rent empty premises.</small>'}</div>`, (r) => {
        const on = (sel, f) => r.querySelectorAll(sel).forEach((x) => x.onclick = () => f(x));
        on('[data-undeal]', (x) => { bz.deals.splice(+x.dataset.undeal, 1); runBusiness(b); });
        on('[data-deal]', () => { const g = r.querySelector('[data-dg]').value, qty = +r.querySelector('[data-dq]').value; const dd = r.querySelector('[data-dd]').value, res = O.Deals.offer(s, bz, g, qty, null, dd === 'daily' ? 'daily' : +dd); O.Panels.toast(res.msg, res.ok ? '' : 'bad'); if (res.ok) runBusiness(b); });
        on('[data-move]', (x) => { const nb = s.building(+x.dataset.move), res = O.Deals.relocate(s, bz, nb); O.Panels.close(); O.Panels.toast(res); });
        on('[data-fund]', () => { if (PS.money < 20) return O.Panels.toast('You have not got ₳20.', 'bad'); PS.money -= 20; bz.cash += 20; runBusiness(b); });
        on('[data-take]', () => { if (bz.cash < 20) return O.Panels.toast('The purse is too light.', 'bad'); bz.cash -= 20; PS.money += 20; runBusiness(b); });
        on('[data-hire]', () => { s.fillVacancies(); runBusiness(b); });
        on('[data-raise]', (x) => { const q = s.byId.get(+x.dataset.raise); q.job.wage = (q.job.wage ?? bz.def.wage[q.job.role] ?? 5) + 1; s.relate(q, { id: 0 }, 0.15); s.remember(q, 'The owner raised my pay.', 'work', 1.5, 0); runBusiness(b); });
        on('[data-promote]', (x) => { const q = s.byId.get(+x.dataset.promote), i = roles.indexOf(q.job.role); q.job.role = roles[i - 1]; q.job.wage = Math.max(q.job.wage || 0, (bz.def.wage[q.job.role] || 6) + 1); s.refreshLook && s.refreshLook(q); s.relate(q, { id: 0 }, 0.2); s.remember(q, `Made ${q.job.role} by the owner.`, 'work', 2, 0); runBusiness(b); });
        on('[data-fire]', (x) => { const q = s.byId.get(+x.dataset.fire); bz.workers = bz.workers.filter((id) => id !== q.id); q.job = null; s.relate(q, { id: 0 }, -0.4); s.remember(q, `Dismissed from ${bz.name}.`, 'work', 2, 0); runBusiness(b); });
      });
    }
    O.runBusiness = runBusiness;
    O.ownsBusiness = () => [...O.Travel.visited.values()].some((v) => v.world.buildings.some((b) => b.owner?.kind === 'player' && v.sim.biz.get(b.id)));
    O.myBusinesses = () => [...O.Travel.visited.values()].flatMap((v) => v.world.buildings.filter((b) => b.owner?.kind === 'player' && v.sim.biz.get(b.id)).map((b) => ({ b, s: v.sim, bz: v.sim.biz.get(b.id) })));

    // ---- holdings and lordship ----
    function holdings() {
      const H = O.SimRef.cur && O.SimRef.cur.lordship ? O.SimRef.cur : home(); // the town you're in
      const all = [...O.Travel.visited.values()].flatMap((v) => v.world.buildings.filter(owned).map((b) => ({ b, s: v.sim })));
      const rows = all.map(({ b, s }) => `<tr><td>${esc(b.type === 'house' ? 'House' : b.name)}<br><small class="lbl">${esc(s.world.name)}</small></td><td class="n">${O.money(s.value(b))}</td><td>${b.household ? `${esc(s.households[b.household - 1]?.surname || '')} family, ₳${b.rent}/wk` : s.biz.get(b.id)?.ownerPlayer ? `${esc(s.biz.get(b.id).name)}, till ${O.money(s.biz.get(b.id).cash)}` : 'empty'}</td></tr>`).join('');
      const L = H.lordship, lord = L.holder === 'player';
      const resident = O.livesIn && O.livesIn(H.world.placeId || 'ashford');
      const TN = esc(H.world.name);
      const canPetition = !lord && resident && PS.wantedLevel() === 0 && !PS.exiled && PS.rep.civilian > -0.2;
      O.Panels.open('Holdings', `<div class="kv">
          <div><span class="lbl">Rents received</span><b>${O.money(PS.rentIncome || 0)}</b><small>paid each Moonday</small></div>
          <div><span class="lbl">Business profits</span><b>${O.money(PS.bizIncome || 0)}</b><small>your share as owner</small></div>
          <div><span class="lbl">Lordship of ${esc(H.world.name)}</span><b>${lord ? 'Yours' : 'The crown\'s'}</b><small>${lord ? 'You set the tax, the watch and the works.' : `The crown asks ${O.money(L.price)} and an unstained name.`}</small></div>
        </div>
        <table style="margin-top:12px"><thead><tr><th>Property</th><th class="n">Value</th><th>Use</th></tr></thead><tbody>${rows || '<tr><td colspan="3">You own nothing yet. Look for For Sale signs by empty houses and shops.</td></tr>'}</tbody></table>
        ${!lord ? `<p class="caption" style="margin-top:12px">${canPetition ? 'You could petition the crown for the lordship.' : !resident ? `Only someone who lives in ${TN} may hold its lordship: own a house here and sleep in it.` : 'The crown will not sell a lordship to someone the watch is looking for, or whom the common folk despise.'}</p>${canPetition ? `<button class="btn" data-pet="1">Petition for the lordship (${O.money(L.price)})</button>` : ''}` : lordControls(H)}${PS.reeve && !lord ? reeveControls(H) : ''}${PS.reeve || lord ? officeControls(H) : ''}${moot(H)}${O.landSection ? O.landSection() : ''}`, (r) => {
        if (O.bindLand) O.bindLand(r, holdings);
        const pet = r.querySelector('[data-pet]');
        if (pet) pet.onclick = () => { if (PS.money < L.price) return O.Panels.toast(`You need ${O.money(L.price)}.`, 'bad'); PS.money -= L.price; H.kingdom.treasury += L.price; L.holder = 'player'; PS.lord = true; H.log(`By letters from the crown, the newcomer is made Lord of ${H.world.name}.`, 'politics'); H.kingdom.addNews(`A new lord has been granted ${H.world.name}.`, 'politics'); for (const p of H.people) if (p.age >= 16 && H.rng.chance(0.5)) H.remember(p, 'We have a new lord, a stranger with deep pockets.', 'politics', 1.5); holdings(); };
        bindLord(r, H);
      });
    }
    // the town's voice at the council of the realm, for its lord or its reeve
    function officeControls(H) {
      const pr = PS.councilPriority || 'security', st = PS.warStance || 'dove';
      const m = H.lastMoot;
      return `<div class="lbl" style="margin-top:12px">${esc(H.world.name)}'s voice at the council of the realm</div><div class="kv">
        <div><span class="lbl">${esc(H.world.name)} asks for</span><b style="font-size:20px">${pr}</b><small>${['security', 'food', 'health', 'roads'].map((k) => `<button data-pri="${k}">${k}</button>`).join(' ')}</small></div>
        <div><span class="lbl">On other motions</span><b style="font-size:20px">${PS.councilDefault === 'aye' ? 'Aye' : 'Nay'}</b><small><button data-def="aye">Aye</button> <button data-def="nay">Nay</button></small></div>
        <div><span class="lbl">On war</span><b style="font-size:20px">${st === 'hawk' ? 'Fight' : 'Pay for peace'}</b><small><button data-war="hawk">Fight</button> <button data-war="dove">Pay for peace</button></small></div>
      </div>${m ? `<p class="caption">Last moot, ${O.Chronicle.dateLabel(m.day)}: ${m.results.map((x) => `${esc(x.who)} ${x.v}`).join(' · ')}.</p>` : ''}`;
    }
    function reeveControls(H) {
      const gh = H.biz.get(H.guardId), guards = gh ? gh.def.jobs[1][1] : 0;
      return `<div class="lbl" style="margin-top:12px">As Reeve of ${esc(H.world.name)}</div><div class="kv">
        <div><span class="lbl">Market tax</span><b>${Math.round(H.treasury.taxRate * 100)}%</b><small><button data-tax="-1">Lower</button> <button data-tax="1">Raise</button></small></div>
        <div><span class="lbl">Watchmen</span><b>${guards + 1}</b><small><button data-g="-1">Dismiss one</button> <button data-g="1">Hire one</button></small></div>
        <div><span class="lbl">Common chest</span><b>${O.money(H.treasury.cash)}</b><small>the reeve keeps it, but may not take from it</small></div>
        <div><span class="lbl">Works</span><b>${H.build.sites.filter((x) => x.stage < 10).length ? 'Building' : 'Idle'}</b><small><button data-build="1">Order a new house (₳160)</button></small></div>
      </div>`;
    }
    function moot(H) {
      if (PS.reeve) return '';
      if (H.reeveMoot) return PS.standForReeve ? `<p class="caption" style="margin-top:12px">You are standing for reeve at the moot on ${O.DAYNAMES[(H.weekday + H.reeveMoot - H.day) % 7]} at five. Be in the square, and be liked.</p>` : `<p class="caption" style="margin-top:12px">A moot is called for ${O.DAYNAMES[(H.weekday + H.reeveMoot - H.day) % 7]} to choose ${esc(H.world.name)}'s reeve.</p>${PS.wantedLevel() === 0 && !PS.exiled ? '<button class="btn" data-stand="1">Stand for reeve</button>' : ''}`;
      return `<p class="caption" style="margin-top:12px">${esc(H.world.name)} chooses its reeve at a moot each spring, or when the office falls empty. Anyone of standing may stand.</p>`;
    }
    function lordControls(H) {
      const gh = H.biz.get(H.guardId), guards = gh ? gh.def.jobs[1][1] : 0;
      return `<div class="lbl" style="margin-top:12px">As Lord of ${esc(H.world.name)}</div><div class="kv">
        <div><span class="lbl">Market tax</span><b>${Math.round(H.treasury.taxRate * 100)}%</b><small><button data-tax="-1">Lower</button> <button data-tax="1">Raise</button></small></div>
        <div><span class="lbl">Watchmen</span><b>${guards + 1}</b><small><button data-g="-1">Dismiss one</button> <button data-g="1">Hire one</button></small></div>
        <div><span class="lbl">Treasury</span><b>${O.money(H.treasury.cash)}</b><small><button data-take="1">Take ₳50 for yourself</button></small></div>
        <div><span class="lbl">Works</span><b>${H.build.sites.filter((x) => x.stage < 10).length ? 'Building' : 'Idle'}</b><small><button data-build="1">Order a new house (₳160)</button></small></div>
        <div><span class="lbl">Justice</span><b>Your word</b><small><button data-pardon="1">Pardon all outstanding crimes</button></small></div>
      </div>`;
    }
    function bindLord(r, H) {
      const t = (sel, f) => r.querySelectorAll(sel).forEach((x) => x.onclick = () => { f(x); holdings(); });
      t('[data-pri]', (x) => { PS.councilPriority = x.dataset.pri; });
      t('[data-def]', (x) => { PS.councilDefault = x.dataset.def; });
      t('[data-war]', (x) => { PS.warStance = x.dataset.war; });
      t('[data-stand]', () => { PS.standForReeve = true; H.log('The newcomer has put themselves forward at the moot.', 'politics'); for (const p of H.people) if (!p.visitor && p.age >= 16 && H.rng.chance(0.3)) H.remember(p, 'The newcomer is standing for reeve. Imagine.', 'politics', 1); });
      t('[data-tax]', (x) => { H.treasury.taxRate = O.clamp(H.treasury.taxRate + +x.dataset.tax * 0.02, 0.02, 0.2); H.log(`The lord ${+x.dataset.tax > 0 ? 'raised' : 'lowered'} the market tax to ${Math.round(H.treasury.taxRate * 100)}%.`, 'politics'); for (const p of H.people) if (p.age >= 18 && H.rng.chance(0.3)) { H.remember(p, `The new lord ${+x.dataset.tax > 0 ? 'raised' : 'cut'} the market tax.`, 'politics', 1); H.relate(p, { id: 0 }, +x.dataset.tax > 0 ? -0.05 : 0.05); } });
      t('[data-g]', (x) => { const gh = H.biz.get(H.guardId); const n = O.clamp(gh.def.jobs[1][1] + +x.dataset.g, 1, 8); gh.def = Object.assign({}, gh.def, { jobs: [gh.def.jobs[0], ['guard', n]] }); if (+x.dataset.g < 0) { const g = H.people.find((q) => q.job?.biz === H.guardId && q.job.role === 'guard'); if (g) { g.job = null; gh.workers = gh.workers.filter((id) => id !== g.id); H.remember(g, 'The lord dismissed me from the watch.', 'hardship', 2); } } else H.fillVacancies(); });
      t('[data-take]', () => { const n = Math.min(50, Math.floor(H.treasury.cash)); H.treasury.cash -= n; PS.money += n; H.log('The lord drew coin from the parish chest for their own use.', 'politics'); for (const p of H.people) if (p.age >= 18 && H.rng.chance(0.2)) H.relate(p, { id: 0 }, -0.08); });
      t('[data-build]', () => { if (H.treasury.cash < 220) return O.Panels.toast('The treasury is too thin.', 'bad'); const free = [0, 1, 2, 3, 4].filter((i) => !H.build.used.has(i)); if (free.length) H.build.start(free[0], 160); });
      t('[data-pardon]', () => { for (const c of H.crimes) if (c.perp === 'player') c.closed = 'pardoned'; PS.bounty = false; H.log('The lord has pardoned all outstanding crimes. Some say they pardoned themselves.', 'politics'); PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.1); });
    }
    O.holdings = holdings;
    game.keyHandlers.push((e) => { if (e.code === 'KeyP' && !O.panelOpen) { holdings(); return true; } return false; });
  }
  O.PropertyUI = { setup };
})();
