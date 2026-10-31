// Living off the land, and making a home of it. Out in the country, with the right tool, you can fell a
// tree for logs and firewood (and the stump grows back in time), break stone from a rock, dig clay at the
// water's edge; strike a campfire with firewood and cook at it wherever you are; and at a house of your
// own, dig a garden bed by the door, sow it, and harvest it when it's grown. Books from the scrivener
// teach you as you read them. The townsfolk do the same: children pick berries, and folk gather kindling.
'use strict';
(function () {
  const T = 16;
  O.Data.GOODS.book = O.Data.GOODS.book || { name: 'Book', base: 25, unit: 'book', slots: 1, book: true };
  { const S = O.Data.BUSINESS.scriptorium; if (S && !S.sells.includes('book')) { S.recipes.push({ out: { book: 0.04 }, inp: { parchment: 0.4, ink: 0.05 } }); S.sells.push('book'); S.targets.book = 3; } }
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS;
    const has = (k) => PS.items.includes(k);
    const outOfTown = (w, x, y) => w.ox == null || Math.max(w.ox - x / T, x / T - w.ox - w.townW, w.oy - y / T, y / T - w.oy - w.townH, 0) > 3;
    let busy = false;
    const work = (anim, secs, then) => { const P = game.player; busy = true; P.anim = anim; P.ft = 0; P.locked = true; setTimeout(() => { busy = false; P.locked = false; if (P.anim === anim) P.anim = 'idle'; then(); }, secs * 1000); };
    const give = (g, n) => { let got = 0; for (let i = 0; i < n; i++) if (PS.canCarry(g)) { PS.add(g); got++; } return got; };

    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), w = game.world, P = game.player; if (!s || game.scene || busy || !w.ter || !w.trees) return null;
      // a tree, with an axe
      if (has('axe') && outOfTown(w, P.x, P.y)) { const t = w.trees.find((tr) => Math.hypot(tr.x - P.x, tr.y - 4 - P.y) < 22); if (t) return { type: 'custom', d: 4, x: t.x, y: t.y - 50, label: 'Fell the tree', act: () => fell(s, w, t) }; }
      // a rock, with a hammer or tools
      if (has('hammer') || has('tools')) { const r = w.props.find((p) => p.kind === 'rock' && Math.hypot(p.x - P.x, p.y - P.y) < 22); if (r) return { type: 'custom', d: 4, x: r.x, y: r.y - 30, label: 'Break stone from the rock', act: () => breakRock(s, w, r) }; }
      // clay, with a spade, at the water's edge
      if (has('spade')) { const tx = Math.floor(P.x / T), ty = Math.floor(P.y / T); if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.ter[(ty + dy) * w.W + tx + dx] === w.TER.WATER)) return { type: 'custom', d: 6, x: P.x, y: P.y - 40, label: 'Dig clay from the bank', act: () => digClay(s) }; }
      // a campfire, anywhere out of doors, with firewood
      const fire = w.props.find((p) => p.campfire && Math.hypot(p.x - P.x, p.y - P.y) < 30);
      if (fire) return { type: 'custom', d: 3, x: fire.x, y: fire.y - 30, label: 'Cook at your fire', act: () => O.craftPanel && O.craftPanel({ it: { kind: 'fireplace' }, who: 'your own' }) };
      if (PS.count && PS.count('firewood') >= 2 && outOfTown(w, P.x, P.y)) return { type: 'custom', d: 14, x: P.x, y: P.y - 40, label: 'Make a campfire (2 firewood)', act: () => campfire(s, w) };
      // the garden at your door
      const g = gardenHere(s, w); if (g) return g;
      return null;
    });
    function fell(s, w, t) {
      work('chop', 3.2, () => {
        const tx = Math.floor(t.x / T), ty = Math.floor((t.y - 1) / T); w.trees = w.trees.filter((x) => x !== t); w.solid[ty * w.W + tx] = 0;
        w.props.push({ kind: 'stump', x: t.x, y: t.y - 1, seed: t.seed || 1, v: 0, solid: false }); w.dirtyStatics = true;
        const a = give('logs', 2), b = give('firewood', 2); PS.skills = PS.skills || {}; PS.skills.woodcraft = Math.min(1, (PS.skills.woodcraft || 0) + 0.01); PS.energy = Math.max(0, PS.energy - 8);
        say(`Timber! The ${t.kind || 'tree'} comes down. ${a ? a + ' logs' : ''}${a && b ? ' and ' : ''}${b ? b + ' bundles of firewood' : ''}${!a && !b ? 'Your satchel is too full to carry any of it.' : '.'}`);
        const keeper = s.people.find((q) => ['gamekeeper', 'forester'].includes(q.job?.role) && !q.agent.hidden && Math.hypot(q.agent.x - t.x, q.agent.y - t.y) < 220);
        if (keeper) { const c = s.recordCrime({ kind: 'felling the lord\'s timber', perp: 'player', placeName: 'the woods', tile: [tx, ty], seen: [keeper], severity: 1 }); if (c) PS.crimes.push(c.id); say(`${keeper.first} the ${keeper.job.role} saw that. That's the lord's timber.`, 'bad'); }
      });
    }
    function breakRock(s, w, r) { work('hammer', 2.6, () => { w.props = w.props.filter((x) => x !== r); if (r.solid) w.solid[Math.floor((r.y - 1) / T) * w.W + Math.floor(r.x / T)] = 0; w.dirtyStatics = true; const n = give('stone', 1); if (Math.random() < 0.06 && PS.canCarry('iron')) { PS.add('iron'); say('You break the rock. A seam of ore runs through it: a lump of iron as well as the stone.'); } else say(n ? 'You break the rock and dress a block of stone.' : 'You break the rock, but you can\'t carry the stone.'); PS.energy = Math.max(0, PS.energy - 6); }); }
    let clayDay = -1, clayN = 0;
    function digClay(s) { if (clayDay !== s.day) { clayDay = s.day; clayN = 0; } if (clayN >= 4) return say('The good clay here is dug out for today.'); clayN++; work('dig', 2.4, () => { say(give('clay', 1) ? 'You dig a lump of good grey clay from the bank.' : 'Your satchel is full.'); }); }
    function campfire(s, w) { PS.remove('firewood', 2); work('crouch', 2, () => { const P = game.player; w.props.push({ kind: 'firepit', x: P.x + 18, y: P.y + 2, seed: 9, v: 0, solid: false, campfire: true, until: s.day * 1440 + s.minute + 240 }); w.dirtyStatics = true; say('You strike a spark into the kindling. A fire to warm by, and to cook at.'); }); }
    game.hooks.update.push(() => { const s = cur(), w = game.world; if (!s || !w || !w.props) return; const t = s.day * 1440 + s.minute; if (w.props.some((p) => p.campfire && p.until < t)) { w.props = w.props.filter((p) => !(p.campfire && p.until < t)); w.dirtyStatics = true; } });
    // warmth by your fire on a cold night
    game.hooks.update.push((dt) => { const w = game.world, P = game.player; if (!w || !w.props || game.scene) return; if (w.props.some((p) => p.campfire && Math.hypot(p.x - P.x, p.y - P.y) < 40)) { PS.cold = 0; PS.energy = Math.min(100, (PS.energy || 0) + dt * 0.05); } });

    // ---------------------------------------------------------------- a garden of your own
    const myHome = (s) => s.world.buildings.find((b) => b.owner?.kind === 'player' && b.doorX != null) || (PS.residence && PS.residence.place === s.world.placeId ? s.building(PS.residence.b) : null) || (PS.lease && PS.lease.place === s.world.placeId ? s.building(PS.lease.b) : null);
    const gardens = () => (PS.gardens = PS.gardens || []);
    // open grass near the door, clear of walls, roads and other things, 3 wide and 2 deep
    function bedSpot(w, h) {
      const free = (x, y) => { const k = y * w.W + x; return !w.solid[k] && w.ter[k] === w.TER.GRASS && !w.props.some((p) => Math.abs(p.x - (x * T + 8)) < 12 && Math.abs(p.y - (y * T + 14)) < 12) && !w.buildings.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.bottom + 1); };
      let best = null, bd = 1e9;
      for (let y = h.bottom - 2; y <= h.bottom + 6; y++) for (let x = h.x - 6; x <= h.x + h.w + 5; x++) {
        let ok = true; for (let i = 0; i < 3 && ok; i++) for (let j = 0; j < 2 && ok; j++) ok = free(x + i, y + j);
        if (!ok) continue; const d = Math.hypot(x + 1 - h.doorX, y - h.doorY); if (d < bd && Math.abs(x + 1 - h.doorX) > 1) { bd = d; best = [x, y]; }
      }
      return best;
    }
    function gardenHere(s, w) {
      const h = myHome(s), P = game.player; if (!h || h.doorX == null) return null;
      if (Math.hypot(h.doorX * T + 8 - P.x, (h.doorY + 1) * T - P.y) > 70) return null;
      const g = gardens().find((x) => x.place === s.world.placeId && x.b === h.id);
      if (!g) return { type: 'custom', d: 8, x: P.x, y: P.y - 40, label: 'Dig a garden bed by the door', act: () => work('dig', 3, () => { const spot = bedSpot(s.world, h); if (!spot) return say('There is no open ground by your door for a bed.'); const [x0, y0] = spot; gardens().push({ place: s.world.placeId, b: h.id, x: x0, y: y0, crop: null, sown: null }); lay(w); say('You turn over a bed of earth beside the house. Sow it with cabbage, oats, barley or wheat from your satchel.'); }) };
      const ready = g.crop && s.day - g.sown >= (g.crop === 'cabbage' ? 4 : 6);
      if (ready) return { type: 'custom', d: 6, x: g.x * T + 16, y: g.y * T - 20, label: `Harvest your ${g.crop}`, act: () => work('pickup', 2.4, () => { const n = give(g.crop, g.crop === 'cabbage' ? 4 : 5); say(`You bring in your ${g.crop}: ${n} into the satchel.`); PS.skills = PS.skills || {}; PS.skills.farming = Math.min(1, (PS.skills.farming || 0) + 0.02); g.crop = null; g.sown = null; lay(w); }) };
      if (!g.crop) { const seed = ['cabbage', 'oats', 'barley', 'wheat'].find((k) => has(k)); if (seed && s.season !== 'winter') return { type: 'custom', d: 6, x: g.x * T + 16, y: g.y * T - 20, label: `Sow your ${seed}`, act: () => work('crouch', 2.4, () => { PS.remove(seed); g.crop = seed; g.sown = s.day; lay(w); say(`You sow the ${seed}. Keep an eye on it: ${seed === 'cabbage' ? 'four' : 'six'} days or so.`); }) }; }
      return null;
    }
    let _bed = null;
    // a patch of dug earth with furrows, drawn under whatever grows in it
    const bedSprite = () => { if (_bed) return _bed; const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#6b4a2e'; x.fillRect(0, 0, 16, 16); for (let r = 0; r < 4; r++) { x.fillStyle = '#4f3420'; x.fillRect(0, r * 4 + 2, 16, 1); x.fillStyle = '#86603c'; x.fillRect(0, r * 4 + 1, 16, 1); } x.fillStyle = '#5a3d24'; for (let k = 0; k < 10; k++) x.fillRect((k * 7) % 16, (k * 5) % 16, 1, 1); return (_bed = { canvas: c, W: 16, H: 16, ox: 8, oy: 15 }); };
    function lay(w) {
      w.props = w.props.filter((p) => !p.garden); const s = cur();
      for (const g of gardens()) { if (g.place !== w.placeId) continue; const grown = g.crop ? Math.min(1, (s.day - g.sown) / (g.crop === 'cabbage' ? 4 : 6)) : 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = g.x + i, y = g.y + j; if (w.solid[y * w.W + x]) continue; w.props.push({ kind: 'gardenbed', x: x * T + 8, y: y * T + 15, seed: 1, v: 0, solid: false, flat: true, garden: true, sprite: bedSprite() }); if (!g.crop) continue; const kind = !g.crop ? 'soilrow' : grown < 0.5 ? 'sprout' : g.crop === 'cabbage' ? 'cabbage' : 'wheat'; w.props.push({ kind, x: x * T + 8, y: y * T + 15, seed: 1, v: kind === 'soilrow' ? 0 : kind === 'sprout' ? 1 : kind === 'wheat' ? 2 : 1, solid: false, flat: true, garden: true }); } }
      w.dirtyStatics = true;
    }
    let gd = -1; const laid = new WeakSet();
    game.hooks.update.push(() => { const s = cur(), w = game.world; if (!s || !w || !w.props) return; if (!laid.has(w) || gd !== s.day) { laid.add(w); gd = s.day; lay(w); } });

    // ---------------------------------------------------------------- books
    O.readBook = (k) => {
      const s = cur(), done = (PS.booksRead = PS.booksRead || 0);
      work('read', 4, () => {
        PS.booksRead = done + 1; PS.skills = PS.skills || {}; PS.skills.letters = Math.min(1, (PS.skills.letters || 0) + 0.05);
        const R = O.Recipes, unknown = R ? R.all().filter((r) => !R.known(r[0])) : [];
        if (unknown.length && Math.random() < 0.5) { const r = unknown[Math.floor(Math.random() * unknown.length)]; (PS.recipes = PS.recipes || []).push(r[0]); say(`You read for an hour. A page on the craft teaches you how to ${r[0].toLowerCase()}.`); }
        else say(['You read of the old kings of Eldoria, and the war with Varn.', 'A book of hours: prayers, and pictures of saints in gold.', 'A bestiary: the unicorn, the manticore, and the humble hedgehog.', 'A treatise on the stars, and when to sow by them.', 'Tales of knights and their ladies. Some of it is even true.'][done % 5] + ' Your letters improve.');
      });
    };

    // the townsfolk at it too: children pick berries in season, and folk bring kindling home
    let nt = 0;
    game.hooks.update.push((dt) => {
      nt -= dt; if (nt > 0 || game.scene) return; nt = 20; const s = cur(); if (!s) return; const P = game.player;
      const kid = s.people.find((q) => q.age >= 5 && q.age < 13 && !q.agent.hidden && q.agent.inside == null && q.activity?.act === 'play' && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 200);
      if (kid && (s.season === 'summer' || s.season === 'autumn')) { O.gesture && O.gesture(kid, 'pickup', 2); const hh = s.household(kid); if (hh && hh.pantry) hh.pantry.berries = (hh.pantry.berries || 0) + 1; if (Math.random() < 0.3 && O.Speech) O.Speech.say(kid, 'Blackberries!', 2); }
      const adult = s.people.find((q) => q.age >= 16 && !q.job && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 200);
      if (adult && s.season !== 'summer') { O.gesture && O.gesture(adult, 'pickup', 2); const hh = s.household(adult); if (hh && hh.pantry) hh.pantry.firewood = (hh.pantry.firewood || 0) + 1; }
    });
  }
  O.GatheringSetup = { setup };
})();
