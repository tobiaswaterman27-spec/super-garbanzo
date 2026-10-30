// Boats and ships. A rowing boat is bought like anything else, in words, from a boatwright (or a fisher
// or ferryman with one to spare); it's moored at the nearest water's edge, and with it you can row out on
// the river, the lake or the sea and land wherever you like. The ports have a harbour, with a harbour
// master, a shipwright and sailors: buy a ship there, and send it out trading over the sea to Varn, to
// Aldmark or the south; it comes home in a week or so with its hold full and a profit, or not at all
// (pirates and storms). Smugglers in the gangs run cheap wine and silk ashore by night.
'use strict';
(function () {
  const D = O.Data, T = 16;
  D.BUSINESS.harbour = D.BUSINESS.harbour || Object.assign({ hours: [6, 20], recipes: [], sells: [], buys: {}, targets: {}, wage: {} }, { label: 'Harbour', jobs: [['harbour master', 1], ['shipwright', 1], ['sailor', 3]], site: 'coast', w: 7, d: 4, look: { wall: 'plank', roof: 'shingle', roofType: 'side', bigDoor: true, sign: 'anchor' },
    recipes: [{ out: { boat: 0.02, rope: 0.2 }, inp: { planks: 0.4 }, role: 'shipwright' }, { out: { fish: 1.5, salt: 0.3 }, inp: {}, role: 'sailor' }], sells: ['boat', 'fish', 'salt', 'wine', 'silk', 'spices'],
    buys: { planks: 'sawmill|import' }, targets: { boat: 2, fish: 30, salt: 10, planks: 12, wine: 6, silk: 3, spices: 3 }, wage: { 'harbour master': 0, shipwright: 7, sailor: 5 }, equip: ['counter', 'crate', 'barrel', 'rack', 'shelf'] });
  Object.assign(D.GOODS, { silk: D.GOODS.silk || { name: 'Silk', base: 40, unit: 'bolt', slots: 1, valuable: false }, spices: D.GOODS.spices || { name: 'Spices', base: 30, unit: 'pouch', slots: 1 }, wine: D.GOODS.wine || { name: 'Wine', base: 6, unit: 'flask', slots: 1 } });
  const LANDS = { varn: { name: 'Varn', days: [5, 8], gain: [1.4, 2.0], risk: 0.18 }, aldmark: { name: 'Aldmark', days: [6, 10], gain: [1.5, 2.3], risk: 0.22 }, south: { name: 'the southern ports', days: [9, 14], gain: [1.8, 3.0], risk: 0.3 } };

  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), clamp = O.clamp;
    const boats = () => (PS.boats = PS.boats || []);
    const isWater = (w, x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx >= 0 && ty >= 0 && tx < w.W && ty < w.H && w.TER && w.ter[ty * w.W + tx] === w.TER.WATER; };
    // a boat bought (in words, from the boatwright's stock) goes to the water, not into your satchel
    game.hooks.update.push(() => {
      if (!PS.items.includes('boat')) return; const s = cur(), w = game.world; if (!s || !w || !w.ter) return;
      PS.items.splice(PS.items.indexOf('boat'), 1);
      const P = game.player, spot = shore(w, P.x, P.y, 60);
      const b = { id: 'boat' + Date.now().toString(36), place: s.world.placeId, x: spot ? spot[0] : P.x, y: spot ? spot[1] : P.y, wx: spot ? spot[2] : null, wy: spot ? spot[3] : null };
      boats().push(b); moor(w, b);
      say(spot ? 'Your boat is moored at the water\'s edge, a short way off.' : 'Your boat waits for you at the nearest water.');
    });
    // the nearest land tile beside water
    function shore(w, x0, y0, r) { const tx0 = Math.floor(x0 / T), ty0 = Math.floor(y0 / T); let best = null, bd = 1e9; for (let y = ty0 - r; y <= ty0 + r; y++) for (let x = tx0 - r; x <= tx0 + r; x++) { if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1) continue; const i = y * w.W + x; if (w.ter[i] !== w.TER.WATER) continue; for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const j = (y + dy) * w.W + x + dx; if (w.ter[j] === w.TER.WATER || w.solid[j]) continue; const d = (x - tx0) ** 2 + (y - ty0) ** 2; if (d < bd) { bd = d; best = [(x + dx) * T + 8, (y + dy) * T + 12, x * T + 8, y * T + 12]; } } } return best; }
    const moor = (w, b) => { w.props = w.props.filter((p) => p.boatOf !== b.id); if (b.wx == null) return; w.props.push({ kind: 'boat', x: b.wx, y: b.wy + 3, seed: 7, v: 0, solid: false, boatOf: b.id, sprite: O.Env.prop('boat', 7, 0) }); w.dirtyStatics = true; };
    // the moored boats of this place, whenever you come back to it
    const seen = new WeakSet();
    game.hooks.update.push(() => { const s = cur(), w = game.world; if (!s || !w || !w.props || seen.has(w)) return; seen.add(w); for (const b of boats()) if (b.place === w.placeId) moor(w, b); });
    // rowing: out on the water, the land is what you can't cross
    let rowing = null;
    const _blocked = game.blocked.bind(game);
    game.blocked = (x, y) => { if (!rowing || game.scene) return _blocked(x, y); const w = game.world; return !(isWater(w, x - 4, y - 3) && isWater(w, x + 3, y - 3) && isWater(w, x - 4, y) && isWater(w, x + 3, y)); };
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), w = game.world, P = game.player; if (!s || game.scene || !w.ter) return null;
      if (rowing) { const land = shore(w, P.x, P.y, 2); if (!land) return null; return { type: 'custom', d: 0, x: P.x, y: P.y - 40, label: 'Row ashore and land here', act: () => { const b = rowing; rowing = null; b.wx = Math.floor(P.x / T) * T + 8; b.wy = Math.floor(P.y / T) * T + 12; P.x = land[0]; P.y = land[1]; P.anim = 'idle'; moor(w, b); say('You pull the boat up and step ashore.'); } }; }
      const b = boats().find((z) => z.place === w.placeId && z.wx != null && Math.hypot(z.wx - P.x, z.wy - P.y) < 34); if (!b) return null;
      return { type: 'custom', d: 0, x: b.wx, y: b.wy - 20, label: 'Row out in your boat', act: () => { rowing = b; w.props = w.props.filter((p) => p.boatOf !== b.id); w.dirtyStatics = true; P.x = b.wx; P.y = b.wy; say('You push off and take up the oars.'); } };
    });
    game.hooks.drawGround.push((ctx, cam) => { if (!rowing || game.scene) return; const P = game.player, sp = O.Env.prop('boat', 7, 0); ctx.drawImage(sp.canvas, Math.round(P.x - sp.ox - cam.x), Math.round(P.y + 6 - sp.oy - cam.y)); });
    game.hooks.update.push(() => { if (rowing) { const P = game.player; P.anim = 'sit'; if (game.scene) rowing = null; } });
    O.rowing = () => !!rowing;

    // ---------------------------------------------------------------- ships, and voyages over the sea
    const ships = () => (PS.ships = PS.ships || []);
    const atHarbour = (s, q) => { const bz = q.job && s.biz.get(q.job.biz); return bz && bz.type === 'harbour' ? bz : null; };
    const A = {
      buy_ship(s, q, a) {
        const bz = atHarbour(s, q); if (!bz || !/harbour master|shipwright/.test(q.job.role)) return null;
        const pr = clamp(Math.round(Number(a.price) || 600), 200, 3000); if (PS.money < pr) return `You haven't ₳${pr} for a ship.`;
        PS.money -= pr; bz.cash += pr; const name = String(a.name || ['The Gull', 'The Saint Brannoc', 'The Good Hope', 'The Swallow', 'The Fair Wind'][ships().length % 5]).slice(0, 30);
        ships().push({ id: 'ship' + Date.now().toString(36), name, port: s.world.placeId, at: 'port' });
        return `${name} is yours, riding at anchor in ${s.world.name}.`;
      },
      voyage(s, q, a) {
        if (!atHarbour(s, q)) return null; const sh = ships().find((x) => x.at === 'port' && x.port === s.world.placeId); if (!sh) return null;
        const key = Object.keys(LANDS).find((k) => String(a.to || '').toLowerCase().includes(LANDS[k].name.toLowerCase().replace('the ', '').split(' ')[0])) || 'varn', L = LANDS[key];
        const stake = clamp(Math.round(Number(a.cargo) || 100), 20, Math.max(20, Math.floor(PS.money))); if (PS.money < stake) return `You haven't ₳${stake} for a cargo.`;
        PS.money -= stake; const H = O.SimRef.home;
        Object.assign(sh, { at: 'sea', to: key, stake, back: H.day + L.days[0] + Math.floor(Math.random() * (L.days[1] - L.days[0] + 1)) });
        return `${sh.name} sails for ${L.name} with ₳${stake} of cargo. She should be home in a week or two.`;
      },
      smuggle(s, q, a) {
        const g = q.gang && s.gang && s.gang(q.gang); if (!g || g.speciality !== 'smuggling') return null;
        const item = ['wine', 'silk', 'spices'].find((k) => String(a.item || '').toLowerCase().includes(k)) || 'wine', pr = Math.max(1, Math.round(D.GOODS[item].base * 0.45));
        if (PS.money < pr) return `You haven't ₳${pr}.`; if (!PS.canCarry(item)) return 'Your satchel is full.';
        PS.money -= pr; g.purse += pr; PS.add(item); PS.rep.criminal = Math.min(1, (PS.rep.criminal || 0) + 0.02);
        return `${q.first} slips you ${D.GOODS[item].name.toLowerCase()} off the boats, no duty paid, for ₳${pr}.`;
      },
    };
    // ships come home (or don't)
    let vd = -1;
    game.hooks.update.push(() => {
      const H = O.SimRef.home; if (!H || vd === H.day) return; vd = H.day;
      for (const sh of ships()) {
        if (sh.at !== 'sea' || H.day < sh.back) continue;
        const L = LANDS[sh.to] || LANDS.varn;
        if (Math.random() < L.risk) { const how = Math.random() < 0.5 ? 'taken by pirates off the coast' : 'lost in a storm with all her cargo'; PS.ships = ships().filter((x) => x !== sh); say(`Word comes from the harbour: ${sh.name} was ${how}.`, 'bad'); H.log(`The stranger's ship ${sh.name} was ${how}.`, 'event'); continue; }
        const gain = Math.round(sh.stake * (L.gain[0] + Math.random() * (L.gain[1] - L.gain[0]))); PS.money += gain; sh.at = 'port'; sh.voyages = (sh.voyages || 0) + 1;
        say(`${sh.name} is home from ${L.name}! Her cargo sells for ₳${gain}.`); PS.rep.merchant = Math.min(1, (PS.rep.merchant || 0) + 0.04);
      }
    });
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && A[a.do]) return A[a.do](s, q, a);
      if (a && a.do === 'sell' && O.NpcActs.goodFor(a.item) === 'boat') {
        const role = q.job?.role || ''; if (!/boatwright|shipwright|harbour|fisher|ferryman/.test(role)) return null;
        if (/fisher|ferryman/.test(role) && !(q.job && (s.biz.get(q.job.biz)?.stock.boat || 0) >= 1)) { const pr = clamp(Math.round(Number(a.price) || 60), 0, 300); if (PS.money < pr) return `You haven't ₳${pr}.`; if (q._soldBoat) return null; q._soldBoat = true; PS.money -= pr; const hh = s.household(q); if (hh) hh.money += pr; PS.add('boat'); return `${q.first} lets you have their old boat for ₳${pr}.`; }
      }
      return base.apply(this, arguments);
    };
    (O.extraActs = O.extraActs || []).push('buy_ship {"price","name"?} (harbour master or shipwright selling the player a ship)', 'voyage {"to":"Varn"|"Aldmark"|"the south","cargo"} (harbour master sending the player\'s ship out trading with cargo bought for that sum)', 'smuggle {"item":"wine"|"silk"|"spices"} (a smuggler selling the player run goods cheap)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [], role = q.job?.role || '';
      if (/boatwright|shipwright/.test(role) || (/fisher|ferryman/.test(role) && q.age > 30)) out.push(`You can sell the player a rowing boat (sell {"item":"boat","price"}), about ₳${/fisher|ferryman/.test(role) ? 60 : 120} for a sound one${/fisher|ferryman/.test(role) ? ', an old one of yours' : ''}.`);
      if (atHarbour(s, q) && /harbour master|shipwright/.test(role)) { const mine = ships().filter((x) => x.port === s.world.placeId); out.push(`You can sell the player a ship (buy_ship), about ₳600 for a small trader${mine.length ? `; their ship${mine.length > 1 ? 's' : ''} here: ${mine.map((x) => `${x.name} (${x.at === 'sea' ? 'at sea, bound for ' + (LANDS[x.to]?.name || 'abroad') : 'in port'})`).join(', ')}` : ''}. ${mine.some((x) => x.at === 'port') ? 'You can send their ship out trading (voyage) to Varn, Aldmark or the south: the further, the richer and the more dangerous.' : ''}`); }
      if (q.gang && s.gang && s.gang(q.gang)?.speciality === 'smuggling') out.push('Your gang runs smuggled wine, silk and spices ashore; you might sell some cheap to someone you trust (smuggle).');
      return out.join(' ');
    });
    O.Sea = { boats, ships, rowing: () => rowing };
  }
  O.SeaSetup = { setup };
})();
