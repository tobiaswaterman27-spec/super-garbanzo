// The parish clerk keeps the register of the town's empty houses. Ask at the chapel in working hours
// and you can take one on a weekly lease (the rent is paid each week from your purse; fall behind and
// you're out) or buy it outright.
'use strict';
(function () {
  const PS = O.PlayerState;
  const rentOf = (b, sim = O.SimRef && O.SimRef.cur) => sim && sim.rentValue ? sim.rentValue(b) : Math.round(6 + b.w * b.d * (b.floors || 1) * 0.6 + (b.wealth || 0.5) * 14);

  function open(sim, clerk) {
    const houses = [...new Set([...(sim.emptyHouses ? sim.emptyHouses() : []), ...sim.world.buildings.filter((b) => b.parishLet && !b.leasedToPlayer && !b.household)])].filter((b) => b.owner?.kind !== 'player');
    const lease = PS.lease && PS.lease.place === sim.world.placeId ? sim.building(PS.lease.b) : null;
    const where = (b) => (sim.where ? sim.where({ x: b.doorX * sim.T, y: b.doorY * sim.T }) : '');
    const rows = houses.map((b) => `<tr><td>${b.name && b.name !== 'House' ? O.escape(b.name) : 'A house'} <small class="lbl">${b.w}×${b.d}${(b.floors || 1) > 1 ? ', two floors' : ''} · ${where(b)}</small></td><td class="n">${rentOf(b, sim)}d a week</td><td class="n">${O.money(Math.round(sim.value(b)))}</td><td><button data-rent="${b.id}">Rent</button> <button data-buy="${b.id}">Buy</button></td></tr>`).join('') || '<tr><td colspan="4">Every house in the parish is lived in.</td></tr>';
    O.Panels.open('The parish register', `<div class="lbl">${O.escape(clerk.name)}, parish clerk · your purse ${O.money(PS.money)}</div>
      ${lease ? `<p class="caption">You rent a house here at ${PS.lease.rent}d a week, paid to day ${PS.lease.paidUntil}. <button data-end="1">Give up the lease</button></p>` : ''}
      <table><thead><tr><th>Empty houses</th><th class="n">Rent</th><th class="n">To buy</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <p class="caption">Rent is due every seven days and taken from your purse. A house of your own has a bed to sleep in, a chest to keep things in, and a door you can bar.</p>`, (r) => {
      r.querySelectorAll('[data-rent]').forEach((x) => x.onclick = () => {
        const b = sim.building(+x.dataset.rent), rent = rentOf(b, sim);
        if (PS.money < rent) return O.Panels.toast(`The first week's rent is ${rent}d. You haven't got it.`, 'bad');
        PS.money -= rent; sim.treasury.cash += rent; sim.treasury.income += rent;
        PS.lease = { b: b.id, place: sim.world.placeId, rent, paidUntil: sim.day + 7 };
        b.vacant = false; b.leasedToPlayer = true;
        sim.remember(clerk, 'Let a house to the stranger.', 'work', 0.8, 0);
        O.Panels.close(); O.UI.say(`${clerk.first} hands you a key. The house is yours to live in, at ${rent}d a week.`);
      });
      r.querySelectorAll('[data-buy]').forEach((x) => x.onclick = () => {
        const b = sim.building(+x.dataset.buy), price = Math.round(sim.value(b));
        if (PS.money < price) return O.Panels.toast(`It's ${O.money(price)} to buy. You haven't the money.`, 'bad');
        PS.money -= price; sim.treasury.cash += Math.round(price * 0.1); sim.treasury.income += Math.round(price * 0.1);
        b.owner = { kind: 'player' }; b.vacant = true; b.rent = null;
        if (PS.lease && PS.lease.b === b.id) PS.lease = null;
        O.Panels.close(); O.UI.say(`The deed is drawn up and sealed. The house is yours.`);
      });
      const e = r.querySelector('[data-end]'); if (e) e.onclick = () => { const b = sim.building(PS.lease.b); if (b) { b.vacant = true; b.leasedToPlayer = false; } PS.lease = null; O.Panels.close(); O.UI.say('You hand back the key.'); };
    });
  }

  function setup(game) {
    let lastDay = null;
    game.hooks.update.push(() => {
      const sim = O.SimRef.home; if (!sim) return;
      if (lastDay !== sim.day) {
        lastDay = sim.day;
        const L = PS.lease;
        if (L && L.place === sim.world.placeId) { const b = sim.building(L.b); if (b) b.leasedToPlayer = true; }
        if (L && sim.day >= L.paidUntil && L.place === sim.world.placeId) {
          if (PS.money >= L.rent) { PS.money -= L.rent; sim.treasury.cash += L.rent; sim.treasury.income += L.rent; L.paidUntil += 7; O.UI.say(`You pay the week's rent: ${L.rent}d.`); }
          else { const b = sim.building(L.b); if (b) { b.vacant = true; b.leasedToPlayer = false; } PS.lease = null; O.UI.say('You couldn\'t pay the rent. The parish has taken back the house.', 'bad'); }
        }
      }
    });
  }
  O.Parish = { open, setup, rentOf };
})();
