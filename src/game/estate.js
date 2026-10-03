// Land. Buy an empty building plot in Ashford and pay builders to raise a house of your own on it
// (the same eleven stages the council's houses go through, worked by hired villagers). Buy strips
// of the common field from the farm: hired hands work them, and each Moonday what they reaped is
// sold to the mill at the going price, less the labourers' wages — so floods, seasons and the price
// of grain decide whether land pays. Enough land and property, and you are landed gentry.
'use strict';
(function () {
  const STRIPS = 12, STRIP_PRICE = 45, PLOT_PRICE = 60, BUILD_COST = 180;
  function setup(game, home) {
    const PS = O.PlayerState, esc = (s) => O.escape(String(s)), toast = (t, k) => O.Panels.toast(t, k);
    PS.plots = PS.plots || []; PS.fields = PS.fields || [];
    const plotName = (pl) => (pl[1] < 30 ? 'beside the north track' : 'south of Mill Lane');

    O.landSection = () => {
      const H = home, B = H.build, farm = H.supplierOf('farmhouse');
      const free = O.PLOTS.map((pl, i) => ({ pl, i })).filter(({ pl, i }) => !B.used.has(i) && B.plotFree(pl));
      const mine = PS.plots.map((i) => ({ i, pl: O.PLOTS[i], site: B.sites.find((s) => s.player && s.b.x === O.PLOTS[i][0] && s.b.bottom === O.PLOTS[i][1]) }));
      const owned = PS.fields.length, sold = (H.farmStripsSold || 0);
      const rows = [
        ...mine.map(({ i, pl, site }) => `<tr><td>Your plot ${plotName(pl)}<br><small class="lbl">${pl[2]}×${pl[3]} tiles</small></td><td>${site ? (site.stage >= 10 ? 'Your house stands here' : `Building: ${O.STAGES[site.stage]} (${Math.round(site.prog * 100)}%)`) : `<button data-pbuild="${i}">Build a house · ${O.money(BUILD_COST)}</button>`}</td></tr>`),
        ...free.map(({ pl, i }) => `<tr><td>Empty plot ${plotName(pl)}<br><small class="lbl">${pl[2]}×${pl[3]} tiles, sold by the parish</small></td><td><button data-plot="${i}">Buy · ${O.money(PLOT_PRICE)}</button></td></tr>`),
      ].join('');
      const last = PS.lastHarvest;
      return `<div class="lbl" style="margin-top:12px">Land in Ashford</div>
        <table><tbody>${rows || '<tr><td colspan="2">No building plots are free.</td></tr>'}</tbody></table>
        <div class="kv" style="margin-top:10px"><div><span class="lbl">Strips of the common field</span><b>${owned}</b><small>${farm ? `${STRIPS - sold} left to buy from the farm at ${O.money(STRIP_PRICE)} each. ${STRIPS - sold > 0 ? '<button data-strip="1">Buy a strip</button>' : ''}` : 'No farm to sell land.'}</small></div>
        <div><span class="lbl">Land income</span><b>${O.money(PS.landIncome || 0)}</b><small>${last ? `Last Moonday: ${last.wheat} bushels sold for ${O.money(last.gross)}, ${O.money(last.wages)} to the hands` : 'Reaped and sold each Moonday'}</small></div>
        ${PS.estate ? `<div><span class="lbl">Standing</span><b style="font-size:22px">Landed gentry</b><small>${esc(PS.estate.title)}</small></div>` : ''}</div>`;
    };
    O.bindLand = (r, refresh) => {
      const H = home;
      r.querySelectorAll('[data-plot]').forEach((b) => b.onclick = () => { if (PS.money < PLOT_PRICE) return toast(`You need ${O.money(PLOT_PRICE)}.`, 'bad'); const i = +b.dataset.plot; PS.money -= PLOT_PRICE; H.treasury.cash += PLOT_PRICE; H.build.used.add(i); PS.plots.push(i); H.log(`The parish has sold a building plot ${plotName(O.PLOTS[i])} to the newcomer.`, 'economy'); refresh(); });
      r.querySelectorAll('[data-pbuild]').forEach((b) => b.onclick = () => { if (PS.money < BUILD_COST) return toast(`Builders and timber cost ${O.money(BUILD_COST)}.`, 'bad'); PS.money -= BUILD_COST; H.build.start(+b.dataset.pbuild, BUILD_COST, { player: true }); refresh(); });
      const st = r.querySelector('[data-strip]'); if (st) st.onclick = () => {
        const farm = H.supplierOf('farmhouse'); if (!farm) return;
        if (PS.money < STRIP_PRICE) return toast(`A strip costs ${O.money(STRIP_PRICE)}.`, 'bad');
        PS.money -= STRIP_PRICE; farm.cash += STRIP_PRICE; H.farmStripsSold = (H.farmStripsSold || 0) + 1; PS.fields.push({ place: 'ashford', strip: H.farmStripsSold - 1, day: H.day });
        H.log(`Marsh Farm has sold a strip of the common field to the newcomer.`, 'economy'); checkEstate(); refresh();
      };
    };
    function checkEstate() {
      if (PS.estate) return;
      const props = [...O.Travel.visited.values()].flatMap((v) => v.world.buildings.filter((b) => b.owner && b.owner.kind === 'player')).length;
      if (PS.fields.length >= 4 && props >= 2) {
        PS.estate = { day: home.day, title: `of ${home.world.name}, holding ${PS.fields.length} strips and ${props} houses` };
        O.Chronicle.deed(home, `The newcomer now holds land and houses enough to be reckoned gentry in ${home.world.name}.`, 'With your fields and houses you are now reckoned landed gentry.', 'rulers', 3, true);
        toast('With your fields and houses, folk now call you gentry. Hats come off as you pass.');
        PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.1); PS.rep.merchant = Math.min(1, PS.rep.merchant + 0.1);
      }
    }
    // each Moonday the hands' work is reaped and sold
    const _newDay = home.newDay.bind(home);
    home.newDay = function () { _newDay(); try { reckon(); } catch (e) { console.error(e); } };
    function reckon() {
      checkEstate();
      if (home.weekday !== 0 || !PS.fields.length) return;
      const n = PS.fields.filter((f) => f.place === 'ashford').length; if (!n) return;
      const season = { spring: 0.4, summer: 0.9, autumn: 1.6, winter: 0 }[home.season];
      const flood = home.floodState && home.floodState.peak >= 2 ? 0.5 : 1;
      const wheat = Math.round(n * 4 * season * flood * home.rng.float(0.8, 1.2));
      const mill = home.supplierOf('mill'), price = mill ? Math.max(1, Math.round(home.price(mill, 'wheat') * 0.7)) : 1;
      const gross = mill ? Math.min(wheat * price, Math.floor(mill.cash)) : 0;
      if (mill && wheat) { mill.stock.wheat = (mill.stock.wheat || 0) + wheat; mill.cash -= gross; }
      // the hands are paid whether the year is good or not
      const wages = n * 3; const poor = home.households.filter((h) => !h.gone && h.money < 60);
      for (let k = 0; k < wages; k++) if (poor.length) poor[k % poor.length].money += 1;
      const net = gross - wages; PS.money += net; PS.landIncome = (PS.landIncome || 0) + net;
      PS.lastHarvest = { day: home.day, wheat, gross, wages };
      if (game.world === home.world) toast(wheat ? `Your strips: ${wheat} bushels sold to the mill for ${O.money(gross)}; ${O.money(wages)} paid to the hands.` : `Your strips lie fallow this ${home.season}. The hands still want their ${O.money(wages)}.`, net < 0 ? 'bad' : '');
    }
    // marker posts on your strips of the common field
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene || game.world !== home.world || !PS.fields.length) return;
      const fz = home.Z.farm, span = (fz[2] - fz[0] + 1) / STRIPS;
      for (const f of PS.fields) {
        if (f.place !== 'ashford') continue;
        const x = Math.round((fz[0] + f.strip * span) * 16 + 4 - cam.x), y = Math.round(fz[1] * 16 + 2 - cam.y);
        // a tall boundary stake with a pennant in your colours, above the fence line
        ctx.fillStyle = '#2a1e16'; ctx.fillRect(x - 1, y - 27, 4, 30);
        ctx.fillStyle = '#c8a070'; ctx.fillRect(x, y - 26, 2, 28);
        const wave = Math.round(Math.sin(game.t * 3 + f.strip) * 1);
        ctx.fillStyle = '#2a1e16'; ctx.fillRect(x + 2, y - 27 + wave, 9, 7);
        ctx.fillStyle = '#e8c840'; ctx.fillRect(x + 2, y - 26 + wave, 8, 5); ctx.fillStyle = '#a8382f'; ctx.fillRect(x + 2, y - 24 + wave, 8, 1);
      }
    });
  }
  O.Estate = { setup };
})();
