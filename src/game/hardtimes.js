// Hard times, and what you do in them. When the pestilence brings a quarantine, the river floods, or
// the harvest fails in the town you're in, you're asked what you'll do: help (and be remembered for it,
// at some risk or cost), turn it to profit (and be remembered for that too), or keep your head down.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS;
    const seen = new Map(); // town:event -> day offered
    function offer(s, key, title, text, options) {
      const k = (s.world.placeId || 'x') + ':' + key; if (seen.get(k) === s.day) return; seen.set(k, s.day);
      O.UI.dialog.open({ name: title, color: '#7a3a2a', text, options: options.map(([l], i) => ({ key: 'h' + i, label: l })), onPick: (pk) => { O.UI.dialog.close(); options[+pk.slice(1)][1](); } });
    }
    const warm = (s, n, amt) => { for (const q of s.people) if (q.age >= 14 && Math.random() < n) s.relate(q, { id: 0 }, amt); };
    // the harvest can fail: late in autumn, some years, the grain doesn't come in
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.weather) return;
      if (s.season === 'autumn' && s.weather.dayOfSeason === 9 && s.hour >= 8 && s._harvestRoll !== s.day) {
        s._harvestRoll = s.day;
        if (O.RNG(O.hash('harvest', s.world.placeId || 'x', s.day)).chance(0.22)) { s.harvestFailed = s.day; for (const bz of s.biz.values()) for (const g0 of ['wheat', 'flour', 'bread']) if (bz.stock[g0]) bz.stock[g0] = Math.floor(bz.stock[g0] / 3); s.log('The harvest has failed: blight in the wheat and rain at the reaping. Bread is scarce and dear.', 'disaster'); }
      }
    });
    let tk = 0;
    game.hooks.update.push((dt) => {
      tk -= dt; if (tk > 0 || O.panelOpen || (O.UI.dialogOpen && O.UI.dialogOpen())) return; tk = 2;
      const s = cur(); if (!s || !s.world || game.scene) return;
      // the pestilence
      if (s.quarantine && s.day - s.quarantine.since <= 3) offer(s, 'plague', 'The pestilence', 'Crosses are chalked on the doors of the sick. The physician can\'t be everywhere, and remedies are worth their weight in silver.', [
        ['Nurse the sick beside the physician', () => { PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.15); PS.rep.local = Math.min(1, PS.rep.local + 0.12); warm(s, 0.4, 0.15); PS.energy = Math.max(0, PS.energy - 40); if (Math.random() < 0.25) { PS.hp = Math.max(20, PS.hp - 30); say('You nurse the sick through a long day and night. You come away feverish yourself, but the town will not forget it.', 'bad'); } else say('You nurse the sick through a long day and night. The town will not forget it.'); s.log('The stranger worked beside the physician through the worst of the pestilence.', 'health'); }],
        ['Sell remedies at a price', () => { const have = PS.items.filter((k) => k === 'medicine' || k === 'herbs'); if (!have.length) return say('You have no remedies or herbs to sell. The apothecary has, and the price is climbing.', 'bad'); let got = 0; for (const k of have) { PS.remove(k); got += (G[k].base || 3) * 4; } PS.money += got; PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.12); PS.rep.merchant = Math.min(1, PS.rep.merchant + 0.05); warm(s, 0.3, -0.12); say(`You sell your remedies for ₳${got}. Some bless you; more curse the price.`); }],
        ['Keep away from the sick', () => say('You keep to yourself and wait for it to pass.')],
      ]);
      // the flood
      const F = s.floodState;
      if (F && F.level >= 1) offer(s, 'flood', 'The river is over its banks', 'Brown water is in the low houses by the bridge. Families are carrying what they can to higher ground; some houses already stand empty.', [
        ['Help carry and dig', () => { PS.energy = Math.max(0, PS.energy - 30); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.1); PS.rep.local = Math.min(1, PS.rep.local + 0.1); warm(s, 0.35, 0.12); say('You spend hours in the water carrying chests and children. Soaked and tired, but well thought of.'); s.log('The stranger waded in to help the flooded families.', 'disaster'); }],
        ['Pick through the empty houses', () => { const loot = ['candlestick', 'spoon', 'cloth', 'bread'].filter(() => Math.random() < 0.5); for (const k of loot) PS.add(k); const coin = 5 + Math.floor(Math.random() * 15); PS.money += coin; if (Math.random() < 0.4) { const cr = s.recordCrime({ kind: 'looting', perp: 'player', placeName: s.world.name, tile: [Math.floor(game.player.x / 16), Math.floor(game.player.y / 16)], seen: s.seers(game.player.x, game.player.y).slice(0, 2), severity: 2 }); PS.crimes.push(cr.id); say(`You come away with ₳${coin}${loot.length ? ' and ' + loot.join(', ') : ''}. Someone saw you.`, 'bad'); } else say(`You come away with ₳${coin}${loot.length ? ' and ' + loot.join(', ') : ''}, and nobody saw.`); }],
        ['Keep to the high ground', () => say('You keep your feet dry and watch.')],
      ]);
      // the failed harvest
      if (s.harvestFailed != null && s.day - s.harvestFailed <= 2) offer(s, 'harvest', 'A hungry winter coming', 'The harvest has failed. Bread is scarce and the poor are already going without.', [
        ['Give ₳20 to the poorest households', () => { if (PS.money < 20) return say('You have not got ₳20 to give.', 'bad'); PS.money -= 20; const poor = s.households.filter((h) => !h.gone && h.money < 25).slice(0, 5); for (const h of poor) h.money += Math.floor(20 / Math.max(1, poor.length)); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.1); warm(s, 0.3, 0.1); say('You give what you can. The poor will remember it.'); }],
        ['Buy up bread and sell it dear', () => { if (PS.money < 20) return say('You need ₳20 to buy up a stock.', 'bad'); PS.money += 18; PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.12); PS.rep.merchant = Math.min(1, PS.rep.merchant + 0.08); warm(s, 0.3, -0.1); say('You buy up what bread there is and sell it on at twice the price: ₳18 in your pocket, and some hard looks.'); }],
        ['Tighten your own belt', () => say('You eat less and wait for spring.')],
      ]);
    });
  }
  O.HardTimesSetup = { setup };
})();
