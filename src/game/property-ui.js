// Property and lordship for the player: For Sale signs on empty houses and shops, buying, letting to
// tenants, opening a business, selling, the Holdings panel (P), and — for the rich and respectable —
// the lordship of Ashford with its powers over tax, the watch, relief and building.
'use strict';
(function () {
  const PS = O.PlayerState, esc = (s) => O.escape(s);

  function setup(game, sim) {
    const home = () => O.SimRef.home;
    const forSale = (b) => !b.site && b.type !== 'hideout' && ((b.type === 'house' && !b.household) || b.closedShop) && (!b.owner || b.owner.kind !== 'player');
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
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return;
      for (const b of sim.world.buildings) if (forSale(b)) { const x = b.doorX * 16 + 14 - cam.x, y = b.doorY * 16 - 14 - cam.y; if (x > -20 && y > -20 && x < game.vw + 20 && y < game.vh + 20) ctx.drawImage(sign(), Math.round(x), Math.round(y)); }
    });
    O.saleCandidate = () => {
      if (game.scene) return null;
      for (const b of sim.world.buildings) { if (!(forSale(b) || owned(b))) continue; const d = Math.hypot(b.doorX * 16 + 8 - game.player.x, b.doorY * 16 + 6 - game.player.y); if (d < 16) return { type: 'property', b, d: d + 2, x: b.doorX * 16 + 8, y: b.doorY * 16 - 20 }; }
      return null;
    };

    function panel(b) {
      const s = sim, v = s.value(b), mine = owned(b), shop = !!b.closedShop || (s.biz.get(b.id) && mine);
      const tenants = b.household ? s.households[b.household - 1] : null;
      const rentEst = Math.max(2, Math.round(v / 140));
      O.Panels.open(mine ? `Your ${b.type === 'house' ? 'house' : 'property'}` : `${b.closedShop ? 'Empty shop' : 'Empty house'} for sale`, `<div class="kv">
        <div><span class="lbl">Value</span><b>${O.money(v)}</b><small>${b.w * 2}×${b.d * 2} paces inside, ${b.floors || 1} floor${(b.floors || 1) > 1 ? 's' : ''}, condition ${Math.round((b.condition ?? 0.8) * 100)}%</small></div>
        <div><span class="lbl">Owner</span><b>${esc(s.ownerName(b.owner))}</b><small>${tenants ? `let to the ${esc(tenants.surname)} family at ${b.rent || rentEst}d a week` : 'standing empty'}</small></div>
        ${b.closedShop ? `<div><span class="lbl">Was</span><b>${esc(b.closedShop.name)}</b><small>closed on day ${b.closedShop.day}</small></div>` : ''}
      </div>
      <div class="topics" style="margin-top:10px">
        ${!mine ? `<button data-a="buy">Buy for ${O.money(v)}</button>` : ''}
        ${mine && b.type === 'house' && !b.household ? `<button data-a="let">Let it to a family (${rentEst}d a week)</button>` : ''}
        ${mine && b.closedShop ? ['bakery', 'store', 'tavern', 'smithy'].map((t) => `<button data-open="${t}">Open a ${O.Data.BUSINESS[t].label.toLowerCase()} (60d)</button>`).join('') : ''}
        ${mine ? `<button data-a="sell">Sell for ${O.money(Math.round(v * 0.8))}</button>` : ''}
      </div>`, (r) => {
        const on = (sel, f) => { const el = r.querySelector(sel); if (el) el.onclick = f; };
        on('[data-a=buy]', () => {
          if (PS.money < v) return O.Panels.toast(`You need ${O.money(v)}.`, 'bad');
          PS.money -= v;
          if (b.owner && b.owner.kind === 'household') { const hh = s.households[b.owner.id - 1]; if (hh) hh.money += v; } else s.treasury.cash += v;
          b.owner = { kind: 'player' }; b.rent = b.household ? (b.rent || rentEst) : null;
          s.log(`A newcomer has bought ${b.closedShop ? 'the old ' + b.closedShop.name : 'a house'} for ${v}d.`, 'economy');
          PS.rep.merchant = Math.min(1, PS.rep.merchant + 0.05);
          panel(b);
        });
        on('[data-a=let]', () => { if (!s.immigrate) return; const hh = s.immigrate(b); if (hh) { b.rent = rentEst; O.Panels.toast(`The ${hh.surname} family will take it at ${rentEst}d a week. They're on the road now.`); } O.Panels.close(); });
        on('[data-a=sell]', () => { const pr = Math.round(v * 0.8); PS.money += pr; s.treasury.cash -= Math.min(s.treasury.cash, pr); b.owner = { kind: 'parish' }; const bz = s.biz.get(b.id); if (bz) bz.ownerPlayer = false; O.Panels.close(); O.Panels.toast(`Sold for ${O.money(pr)}.`); });
        r.querySelectorAll('[data-open]').forEach((x) => x.onclick = () => { if (PS.money < 60) return O.Panels.toast('You need 60d to stock and staff it.', 'bad'); PS.money -= 60; const bz = s.startBusiness(b, x.dataset.open, 'player'); s.fillVacancies(); O.Panels.close(); O.Panels.toast(`${bz.name} opens under your ownership. A manager will run it; the profit is yours.`); });
      });
    }
    O.propertyPanel = panel;

    // ---- holdings and lordship ----
    function holdings() {
      const H = home();
      const all = [...O.Travel.visited.values()].flatMap((v) => v.world.buildings.filter(owned).map((b) => ({ b, s: v.sim })));
      const rows = all.map(({ b, s }) => `<tr><td>${esc(b.type === 'house' ? 'House' : b.name)}<br><small class="lbl">${esc(s.world.name)}</small></td><td class="n">${O.money(s.value(b))}</td><td>${b.household ? `${esc(s.households[b.household - 1]?.surname || '')} family, ${b.rent}d/wk` : s.biz.get(b.id)?.ownerPlayer ? `${esc(s.biz.get(b.id).name)}, till ${O.money(s.biz.get(b.id).cash)}` : 'empty'}</td></tr>`).join('');
      const L = H.lordship, lord = L.holder === 'player';
      const canPetition = !lord && PS.wantedLevel() === 0 && !PS.exiled && PS.rep.civilian > -0.2;
      O.Panels.open('Holdings', `<div class="kv">
          <div><span class="lbl">Rents received</span><b>${O.money(PS.rentIncome || 0)}</b><small>paid each Moonday</small></div>
          <div><span class="lbl">Business profits</span><b>${O.money(PS.bizIncome || 0)}</b><small>your share as owner</small></div>
          <div><span class="lbl">Lordship of Ashford</span><b>${lord ? 'Yours' : 'The crown\'s'}</b><small>${lord ? 'You set the tax, the watch and the works.' : `The crown asks ${O.money(L.price)} and an unstained name.`}</small></div>
        </div>
        <table style="margin-top:12px"><thead><tr><th>Property</th><th class="n">Value</th><th>Use</th></tr></thead><tbody>${rows || '<tr><td colspan="3">You own nothing yet. Look for For Sale signs by empty houses and shops.</td></tr>'}</tbody></table>
        ${!lord ? `<p class="caption" style="margin-top:12px">${canPetition ? 'You could petition the Lord of Thornbury for the lordship.' : 'The crown will not sell a lordship to someone the watch is looking for, or whom the common folk despise.'}</p>${canPetition ? `<button class="btn" data-pet="1">Petition for the lordship (${O.money(L.price)})</button>` : ''}` : lordControls(H)}${PS.reeve && !lord ? reeveControls(H) : ''}${PS.reeve || lord ? officeControls(H) : ''}${moot(H)}`, (r) => {
        const pet = r.querySelector('[data-pet]');
        if (pet) pet.onclick = () => { if (PS.money < L.price) return O.Panels.toast(`You need ${O.money(L.price)}.`, 'bad'); PS.money -= L.price; H.kingdom.treasury += L.price; L.holder = 'player'; PS.lord = true; H.log('By letters from Thornbury, the newcomer is made Lord of Ashford.', 'politics'); H.kingdom.addNews(`A new lord has been granted Ashford.`, 'politics'); for (const p of H.people) if (p.age >= 16 && H.rng.chance(0.5)) H.remember(p, 'We have a new lord, a stranger with deep pockets.', 'politics', 1.5); holdings(); };
        bindLord(r, H);
      });
    }
    // Ashford's voice at the castle council, for its lord or its reeve
    function officeControls(H) {
      const pr = PS.councilPriority || 'security', st = PS.warStance || 'dove';
      const m = H.lastMoot;
      return `<div class="lbl" style="margin-top:12px">Ashford's voice at the castle council</div><div class="kv">
        <div><span class="lbl">Ashford asks for</span><b style="font-size:20px">${pr}</b><small>${['security', 'food', 'health', 'roads'].map((k) => `<button data-pri="${k}">${k}</button>`).join(' ')}</small></div>
        <div><span class="lbl">On other motions</span><b style="font-size:20px">${PS.councilDefault === 'aye' ? 'Aye' : 'Nay'}</b><small><button data-def="aye">Aye</button> <button data-def="nay">Nay</button></small></div>
        <div><span class="lbl">On war</span><b style="font-size:20px">${st === 'hawk' ? 'Fight' : 'Pay for peace'}</b><small><button data-war="hawk">Fight</button> <button data-war="dove">Pay for peace</button></small></div>
      </div>${m ? `<p class="caption">Last moot, ${O.Chronicle.dateLabel(m.day)}: ${m.results.map((x) => `${esc(x.who)} ${x.v}`).join(' · ')}.</p>` : ''}`;
    }
    function reeveControls(H) {
      const gh = H.biz.get(H.guardId), guards = gh ? gh.def.jobs[1][1] : 0;
      return `<div class="lbl" style="margin-top:12px">As Reeve of Ashford</div><div class="kv">
        <div><span class="lbl">Market tax</span><b>${Math.round(H.treasury.taxRate * 100)}%</b><small><button data-tax="-1">Lower</button> <button data-tax="1">Raise</button></small></div>
        <div><span class="lbl">Watchmen</span><b>${guards + 1}</b><small><button data-g="-1">Dismiss one</button> <button data-g="1">Hire one</button></small></div>
        <div><span class="lbl">Common chest</span><b>${O.money(H.treasury.cash)}</b><small>the reeve keeps it, but may not take from it</small></div>
        <div><span class="lbl">Works</span><b>${H.build.sites.filter((x) => x.stage < 10).length ? 'Building' : 'Idle'}</b><small><button data-build="1">Order a new house (160d)</button></small></div>
      </div>`;
    }
    function moot(H) {
      if (PS.reeve) return '';
      if (H.reeveMoot) return PS.standForReeve ? `<p class="caption" style="margin-top:12px">You are standing for reeve at the moot on ${O.DAYNAMES[(H.weekday + H.reeveMoot - H.day) % 7]} at five. Be in the square, and be liked.</p>` : `<p class="caption" style="margin-top:12px">A moot is called for ${O.DAYNAMES[(H.weekday + H.reeveMoot - H.day) % 7]} to choose Ashford's reeve.</p>${PS.wantedLevel() === 0 && !PS.exiled ? '<button class="btn" data-stand="1">Stand for reeve</button>' : ''}`;
      return `<p class="caption" style="margin-top:12px">Ashford chooses its reeve at a moot each spring, or when the office falls empty. Anyone of standing may stand.</p>`;
    }
    function lordControls(H) {
      const gh = H.biz.get(H.guardId), guards = gh ? gh.def.jobs[1][1] : 0;
      return `<div class="lbl" style="margin-top:12px">As Lord of Ashford</div><div class="kv">
        <div><span class="lbl">Market tax</span><b>${Math.round(H.treasury.taxRate * 100)}%</b><small><button data-tax="-1">Lower</button> <button data-tax="1">Raise</button></small></div>
        <div><span class="lbl">Watchmen</span><b>${guards + 1}</b><small><button data-g="-1">Dismiss one</button> <button data-g="1">Hire one</button></small></div>
        <div><span class="lbl">Treasury</span><b>${O.money(H.treasury.cash)}</b><small><button data-take="1">Take 50d for yourself</button></small></div>
        <div><span class="lbl">Works</span><b>${H.build.sites.filter((x) => x.stage < 10).length ? 'Building' : 'Idle'}</b><small><button data-build="1">Order a new house (160d)</button></small></div>
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
