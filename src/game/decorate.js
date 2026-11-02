// Arranging a home of your own, piece by piece. In a house you own or rent press V to arrange it: walk
// up to anything and pick it up with E, carry it where you want it and set it down with E. R turns it,
// T gives it another finish (a different wood, a different weave) for a couple of aurins of stain or dye,
// Tab brings out the next thing you have (from your satchel or the house's lumber store), Delete puts
// what you hold away in the store. Wall coverings, floors and colour washes go up the same way: hold the
// roll of tapestry or the stack of tiles and press E. Out of doors the ground round your house is yours to
// lay out the same way (a bench, a flower bed, a water butt, a lantern post, a clipped yew), and the house
// itself can be rendered, re-roofed and have its door and shutters painted.
// Everything in other people's houses can be bought from the trade that makes it, or made yourself at a
// workbench, a loom or a kiln once you've the skill.
'use strict';
(function () {
  const T = 16, D = O.Data, G = D.GOODS;

  // ---------------- what there is to have ----------------
  // pieces seen in other people's houses that weren't on sale before
  const MORE_FURN = { pew: ['Pew', 16, 'carpenter'], throne: ['Great carved chair', 90, 'carpenter'], altar: ['Altar table', 40, 'builder'], medbed: ['Sickbed', 18, 'carpenter'], hay: ['Hay bale', 2, 'farmhouse'], partH: ['Inner wall (along)', 14, 'builder'], partV: ['Inner wall (across)', 14, 'builder'] };
  Object.assign(D.FURN, MORE_FURN);
  for (const [k, [name, base, maker]] of Object.entries(MORE_FURN)) G['fx_' + k] = { name, base, unit: 'piece', slots: 3, furniture: k, maker };
  // wall coverings, floors and washes for inside
  const WALLS = { lime: ['Limewash and lath', 8, 'builder', '#e8e0cc'], plank: ['Wall planking', 16, 'carpenter', '#8a6239'], timber: ['Timber and daub', 20, 'builder', '#d6c8a8'], log: ['Log facing', 12, 'woodcutter', '#7c5a38'], stone: ['Stone facing', 34, 'quarry', '#8e8880'], panel: ['Oak panelling', 40, 'carpenter', '#6e4a2c'], tapestry: ['Wall tapestry', 60, 'weaver', '#7a3a4a'], stencil: ['Stencilled plaster', 22, 'builder', '#d8a898'] };
  const FLOORS = { stone: ['Stone flags', 30, 'quarry', '#9a948a'], wood: ['Floorboards', 18, 'carpenter', '#b08a5a'], rushes: ['Strewing rushes', 3, 'farmhouse', '#c9a456'], tiles: ['Glazed floor tiles', 45, 'potter', '#b45a38'], herring: ['Herringbone brick', 36, 'brickworks', '#a0503a'], dirt: ['Beaten earth', 2, 'builder', '#7a6248'] };
  const TINTS = { ochre: ['Ochre wash', 6, 'dyer', '#d8b878'], rose: ['Rose wash', 6, 'dyer', '#d8a898'], sage: ['Sage wash', 6, 'dyer', '#a8b890'], woad: ['Woad wash', 6, 'dyer', '#98a8c0'], white: ['White wash', 4, 'builder', '#e8e0cc'] };
  // and for outside: the house itself
  const RENDERS = { plaster: ['Lime render', 10, 'builder', '#e2d6b8'], plasterOchre: ['Ochre render', 12, 'dyer', '#d8b878'], plasterPink: ['Rose render', 12, 'dyer', '#dcb2a0'], plasterWhite: ['White render', 12, 'builder', '#ece6d6'], brick: ['Brick facing', 40, 'brickworks', '#a0503a'], stone: ['Stone facing (outside)', 46, 'quarry', '#9a948a'] };
  const ROOFS = { thatch: ['Thatch for a roof', 30, 'farmhouse', '#c9a456'], shingle: ['Oak shingles', 40, 'carpenter', '#7a5a40'], tile: ['Roof tiles', 60, 'brickworks', '#b45a38'], slate: ['Roof slates', 70, 'quarry', '#5d6676'] };
  const PAINTS = { red: ['Red door paint', 5, 'dyer', '#8a3a2a'], green: ['Green door paint', 5, 'dyer', '#3f6a4a'], blue: ['Blue door paint', 6, 'dyer', '#3a4f7a'], black: ['Black door paint', 4, 'chandler', '#2a2426'], ochre: ['Yellow door paint', 5, 'dyer', '#a8803a'], oak: ['Oak stain', 3, 'carpenter', '#6e4a2c'] };
  // what can stand in a yard
  const YARD = { bench: ['Garden bench', 8, 'carpenter'], barrel: ['Water butt', 6, 'cooper'], crate: ['Crate', 3, 'carpenter'], woodpile: ['Stacked firewood', 3, 'woodcutter'], flowers: ['Flower bed', 4, 'farmhouse'], topiary: ['Clipped yew', 18, 'farmhouse'], sundial: ['Sundial', 26, 'builder'], skep: ['Bee skep', 6, 'apiary'], trough: ['Trough', 8, 'carpenter'], lamp: ['Lantern post', 12, 'smithy'], sapling: ['Young tree', 4, 'woodcutter'], firepit: ['Fire pit', 3, 'builder'], fountain: ['Stone fountain', 120, 'builder'], hay: ['Haycock', 2, 'farmhouse'], cart: ['Handcart', 20, 'wainwright'], banner: ['Banner on a pole', 10, 'weaver'], sack: ['Sacks', 1, 'weaver'] };
  const LOOK = (O.ItemArt && O.ItemArt.LOOK) || {};
  const def = (pre, tab, extra) => { for (const [k, [name, base, maker, col]] of Object.entries(tab)) { G[pre + k] = Object.assign({ name, base, unit: 'lot', slots: pre === 'dp_' || pre === 'tn_' ? 1 : 2, maker }, extra(k)); if (col) LOOK[pre + k] = [pre === 'dp_' ? 'flask' : 'bale', col, col]; } };
  def('wl_', WALLS, (k) => ({ decor: { what: 'wall', kind: k } }));
  def('fl_', FLOORS, (k) => ({ decor: { what: 'floor', kind: k } }));
  def('tn_', TINTS, (k) => ({ decor: { what: 'tint', kind: k } }));
  def('er_', RENDERS, (k) => ({ outside: { what: 'render', kind: k } }));
  def('rf_', ROOFS, (k) => ({ outside: { what: 'roof', kind: k } }));
  def('dp_', PAINTS, (k) => ({ outside: { what: 'paint', kind: k, col: PAINTS[k][3] } }));
  for (const [k, [name, base, maker]] of Object.entries(YARD)) { G['yd_' + k] = { name, base, unit: 'piece', slots: 3, yard: k, maker }; LOOK['yd_' + k] = ['furn:' + ({ flowers: 'plant', topiary: 'plant', sapling: 'plant', lamp: 'candlestand', skep: 'sack', firepit: 'woodpile', fountain: 'cauldron', sundial: 'candlestand', trough: 'washtub', cart: 'table', banner: 'rack', hay: 'sack' }[k] || k), '#8a6239', '#6a4a2c']; }
  // who sells them: the trade that makes them, else the general store
  const sells = (type, goods) => {
    const bz = D.BUSINESS[type] || D.BUSINESS.store; if (!bz) return;
    const out = {};
    for (const g of goods) { if (!bz.sells.includes(g)) bz.sells.push(g); bz.targets[g] = bz.targets[g] || 1; out[g] = 0.015; }
    bz.recipes.push({ out, inp: {} });
  };
  const byMaker = {};
  for (const [k, g] of Object.entries(G)) if (/^(wl|fl|tn|er|rf|dp|yd)_/.test(k) || (k.startsWith('fx_') && MORE_FURN[k.slice(3)])) (byMaker[g.maker] = byMaker[g.maker] || []).push(k);
  for (const [m, goods] of Object.entries(byMaker)) sells(m, goods);
  // anything in FURN whose maker isn't selling it yet
  for (const [k, [, , maker]] of Object.entries(D.FURN)) { const bz = D.BUSINESS[maker] || D.BUSINESS.store; if (bz && !bz.sells.includes('fx_' + k)) sells(maker, ['fx_' + k]); }

  // making them yourself
  const MAKE = {
    workbench: [
      ['Make a stool', { planks: 1 }, { fx_stool: 1 }, 'woodcraft', 0], ['Knock up a crate', { planks: 1, nails: 1 }, { fx_crate: 1 }, 'woodcraft', 0],
      ['Make a bench', { planks: 2, nails: 1 }, { fx_bench: 1 }, 'woodcraft', 0.1], ['Make a garden bench', { planks: 2, nails: 1 }, { yd_bench: 1 }, 'woodcraft', 0.1],
      ['Make a chair', { planks: 2, nails: 1 }, { fx_chair: 1 }, 'woodcraft', 0.2], ['Make a trough', { planks: 2, nails: 1 }, { yd_trough: 1 }, 'woodcraft', 0.15],
      ['Make a table', { planks: 3, nails: 1 }, { fx_table: 1 }, 'woodcraft', 0.25], ['Make a chest', { planks: 3, nails: 2 }, { fx_chest: 1 }, 'woodcraft', 0.25],
      ['Make shelves', { planks: 2, nails: 1 }, { fx_shelf: 1 }, 'woodcraft', 0.2], ['Make a bed frame', { planks: 4, nails: 2, linen: 1 }, { fx_bed: 1 }, 'woodcraft', 0.35],
      ['Make a cupboard', { planks: 3, nails: 2 }, { fx_cupboard: 1 }, 'woodcraft', 0.35], ['Make a bookcase', { planks: 4, nails: 2 }, { fx_bookcase: 1 }, 'woodcraft', 0.45],
      ['Make a cradle', { planks: 2, nails: 1 }, { fx_cradle: 1 }, 'woodcraft', 0.3], ['Make a writing desk', { planks: 3, nails: 2 }, { fx_desk: 1 }, 'woodcraft', 0.5],
      ['Make a wardrobe', { planks: 5, nails: 2 }, { fx_wardrobe: 1 }, 'woodcraft', 0.55], ['Lay up floorboards', { planks: 3, nails: 2 }, { fl_wood: 1 }, 'woodcraft', 0.15],
      ['Cut wall planking', { planks: 3, nails: 1 }, { wl_plank: 1 }, 'woodcraft', 0.15], ['Carve oak panelling', { planks: 4, nails: 1 }, { wl_panel: 1 }, 'woodcraft', 0.6],
      ['Rive oak shingles', { logs: 3 }, { rf_shingle: 1 }, 'woodcraft', 0.3], ['Make a handcart', { planks: 4, nails: 2, iron: 1 }, { yd_cart: 1 }, 'woodcraft', 0.45],
    ],
    loom: [['Weave a rug', { wool: 2 }, { fx_rug: 1 }, 'crafting', 0.1], ['Weave a wall tapestry', { wool: 3, dyedcloth: 1 }, { wl_tapestry: 1 }, 'crafting', 0.45], ['Sew a banner', { linen: 2, dyedcloth: 1 }, { yd_banner: 1 }, 'crafting', 0.2]],
    kiln: [['Fire floor tiles', { clay: 3, firewood: 1 }, { fl_tiles: 1 }, 'crafting', 0.25], ['Fire roof tiles', { clay: 4, firewood: 1 }, { rf_tile: 1 }, 'crafting', 0.3], ['Fire a potted plant pot', { clay: 1, firewood: 1 }, { fx_plant: 1 }, 'crafting', 0]],
    cauldron: [['Mix a limewash', { lime: 1 }, { tn_white: 1 }, 'crafting', 0], ['Boil up ochre wash', { ochre: 1 }, { tn_ochre: 1 }, 'crafting', 0.05], ['Boil up woad wash', { woad: 1 }, { tn_woad: 1 }, 'crafting', 0.05], ['Boil up madder paint', { madder: 1 }, { dp_red: 1 }, 'crafting', 0.05]],
    table: [['Gather strewing rushes', { hay: 2 }, { fl_rushes: 1 }, 'crafting', 0], ['Plant up a flower bed', { herbs: 2 }, { yd_flowers: 1 }, 'crafting', 0]],
  };
  const EASY = ['Make a stool', 'Knock up a crate', 'Gather strewing rushes', 'Plant up a flower bed', 'Weave a rug', 'Mix a limewash'];

  const WOODY = new Set(['chair', 'stool', 'table', 'longtable', 'bench', 'bed', 'double', 'cradle', 'chest', 'wardrobe', 'cupboard', 'dresser', 'bookcase', 'desk', 'shelf', 'pew', 'partH', 'partV', 'medbed', 'workbench', 'counter', 'crate']);
  const TURNS = { chair: [0, 1, 2, 3], stool: [0, 1, 2, 3], throne: [0, 1, 2, 3], bed: [0, 1, 2] };
  const WIDTHS = { rug: [3, 2, 4, 5], pew: [5, 3, 4] };
  const NOT_MOVED = new Set(['stairs', 'roomdoor', 'portrait', 'cell']);

  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k);
    const nm = (k) => (G[k]?.name || k).toLowerCase();
    // the recipes join the rest
    if (O.Recipes) {
      for (const [st, list] of Object.entries(MAKE)) for (const rc of list) if ([...Object.keys(rc[1]), ...Object.keys(rc[2])].every((g) => G[g]) && !(O.Recipes.RECIPES[st] || []).some((r) => r[0] === rc[0])) { (O.Recipes.RECIPES[st] = O.Recipes.RECIPES[st] || []).push(rc); O.Recipes.UNIVERSAL.add(rc[0]); }
      for (const l of EASY) O.Recipes.STARTER.add(l);
    }
    // a shop that has never made one has one or two in by now
    let seedT = 0;
    game.hooks.update.push((dt) => {
      seedT -= dt; if (seedT > 0) return; seedT = 5;
      const s = cur(); if (!s || s._decorSeeded) return; s._decorSeeded = true;
      for (const bz of s.biz.values()) for (const g of bz.def.sells || []) if (/^(wl|fl|tn|er|rf|dp|yd|fx)_/.test(g) && !(bz.stock[g] > 0)) bz.stock[g] = (G[g].base || 9) < 25 ? 2 : 1;
    });

    // ---------------- whose ground is this ----------------
    const mine = (b) => b && ((b.owner && b.owner.kind === 'player') || (PS.lease && PS.lease.b === b.id && (!PS.lease.place || PS.lease.place === cur().world.placeId)));
    const homeOut = () => { const s = cur(); return s.world.buildings.find((b) => mine(b) && b.doorX != null && !b.parent && !b.site) || null; };
    const TR = () => cur().world.TER;
    function yardOK(b, tx, ty) {
      const w = cur().world; if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H) return 'off';
      const dx = tx < b.x ? b.x - tx : tx > b.x + b.w - 1 ? tx - (b.x + b.w - 1) : 0, dy = ty < b.y ? b.y - ty : ty > b.bottom ? ty - b.bottom : 0;
      if (Math.max(dx, dy) > 4) return 'far';
      if (w.buildings.some((o) => tx >= o.x && tx < o.x + o.w && ty >= o.y && ty <= o.bottom + (o === b ? 0 : 0))) return 'house';
      if (tx === b.doorX && (ty === b.doorY || ty === b.doorY + 1)) return 'door';
      if (w.solid[ty * w.W + tx]) return 'solid';
      const tr = TR(), t = w.ter && w.ter[ty * w.W + tx];
      if (tr && (t === tr.ROAD || t === tr.BRIDGE || t === tr.WATER || t === tr.COBBLE)) return 'road';
      if (w.props.some((p) => !p.flat && Math.floor(p.x / T) === tx && Math.floor((p.y - 1) / T) === ty)) return 'prop';
      if ((w.trees || []).some((t2) => Math.floor(t2.x / T) === tx && Math.floor((t2.y - 1) / T) === ty)) return 'tree';
      return null;
    }
    // what you set out in your yard is put back whenever the place is loaded
    const yardProp = (b, y) => ({ kind: y.kind, x: y.tx * T + 8, y: y.ty * T + 15, seed: y.seed || 1, v: y.v || 0, solid: false, yard: b.id, flat: y.kind === 'flowers' });
    function restoreYards() {
      const w = cur()?.world; if (!w || w._yardsUp) return; w._yardsUp = true;
      for (const b of w.buildings) for (const y of b.yard || []) w.props.push(yardProp(b, y));
      for (const b of w.buildings) if (b.spec && (b.spec.doorCol || b.spec.plaster || b.spec._redone)) { try { b.spec._fin = undefined; b.sprite = O.Env.building(b.spec); } catch (e) { /* */ } }
      w.dirtyStatics = true;
    }
    game.hooks.update.push(() => restoreYards());

    // ---------------- the mode itself ----------------
    const st = { on: false, held: null, pick: -1, where: null };
    const store = (b) => (b.store = b.store || []);
    const yardStore = (b) => (b.yardStore = b.yardStore || []);
    function palette() {
      const out = [];
      if (game.scene) {
        const b = game.scene.b;
        for (const k of new Set(PS.items)) { const g = G[k]; if (g && (g.furniture || g.decor)) out.push({ src: 'satchel', good: k }); }
        store(b).forEach((p, i) => out.push({ src: 'store', i, piece: p }));
      } else {
        const b = st.where;
        for (const k of new Set(PS.items)) { const g = G[k]; if (g && (g.yard || g.outside)) out.push({ src: 'satchel', good: k }); }
        if (b) yardStore(b).forEach((p, i) => out.push({ src: 'store', i, piece: p }));
      }
      return out;
    }
    const pieceLabel = (p) => (p.good ? G[p.good].name : (G[(game.scene ? 'fx_' : 'yd_') + p.kind]?.name || p.kind));
    // the tile you're facing, and where a piece fw x fh would sit to cover it
    function facingTile() {
      const p = game.player, d = O.Char.DIRV[p.dir] || [0, 1];
      if (game.scene) { const sc = game.scene; return [Math.floor((p.x + d[0] * 18 - sc.R.SW) / T), Math.floor((p.y + d[1] * 14 - sc.R.WH) / T) - (d[1] < 0 ? 1 : 0)]; }
      return [Math.floor((p.x + d[0] * 16) / T), Math.floor((p.y - 2 + d[1] * 14) / T)];
    }
    function footOf(h) { const [fw, fh] = (h.kind === 'bed' && h.rot) ? [3, 2] : (WIDTHS[h.kind] ? [h.width || WIDTHS[h.kind][0], h.kind === 'rug' ? 2 : 1] : (O.Interior.foot ? O.Interior.foot(h.kind, h.rot, h.width) : null) || SIZE_GUESS[h.kind] || [1, 1]); return [fw, fh]; }
    const SIZE_GUESS = { bed: [2, 3], double: [3, 3], medbed: [2, 3], cradle: [2, 2], table: [3, 2], longtable: [5, 2], bench: [3, 1], fireplace: [3, 1], oven: [3, 2], forge: [3, 2], throne: [2, 2], counter: [3, 1], bar: [5, 1], wardrobe: [2, 1], dresser: [2, 1], bookcase: [2, 1], cupboard: [2, 1], desk: [2, 1], workbench: [3, 1], doughtable: [2, 1], butcherblock: [2, 1], loom: [2, 2], millstone: [2, 2], vat: [2, 2], kiln: [2, 2], altar: [3, 1], shelf: [2, 1] };
    function spotFor(h) {
      const [tx, ty] = facingTile(), p = game.player, d = O.Char.DIRV[p.dir] || [0, 1], [fw, fh] = footOf(h);
      let x0 = tx - Math.floor((fw - 1) / 2), y0 = ty - Math.floor((fh - 1) / 2);
      if (d[0] > 0) x0 = tx; else if (d[0] < 0) x0 = tx - fw + 1;
      if (d[1] > 0) y0 = ty; else if (d[1] < 0) y0 = ty - fh + 1;
      if (game.scene) { const L = game.scene.L; x0 = O.clamp(x0, 0, Math.max(0, L.w - fw)); y0 = O.clamp(y0, 0, Math.max(0, L.d - fh)); }
      return [x0, y0, fw, fh];
    }

    // the thing at the tile you face
    function pieceAt() {
      const [tx, ty] = facingTile();
      if (game.scene) {
        const L = game.scene.L; let best = null;
        for (const it of L.items) if (!NOT_MOVED.has(it.kind) && D.FURN[it.kind] && tx >= it.tx && tx < it.tx + it.fw && ty >= it.ty && ty < it.ty + it.fh) { if (!best || (best.flat && !it.flat)) best = it; }
        return best;
      }
      const w = cur().world; return w.props.find((p) => p.yard === st.where?.id && Math.floor(p.x / T) === tx && Math.floor((p.y - 1) / T) === ty) || null;
    }

    // rebuild the room round you without moving you
    function rebuild(sc) { const p = game.player, x = p.x, y = p.y, dir = p.dir; O.Interior.invalidate(sc.b); game.enterBuilding(sc.b, sc.floor, null); p.x = x; p.y = y; p.dir = dir; }
    function reachable(L, it) { const R = L.reachable; if (!R) return true; for (let y = it.ty - 1; y <= it.ty + it.fh; y++) for (let x = it.tx - 1; x <= it.tx + it.fw; x++) if (x >= 0 && y >= 0 && x < L.w && y < L.d && R[y * L.w + x]) return true; return false; }
    function standsOn(sc, x0, y0, fw, fh) { const p = game.player, px = Math.floor((p.x - sc.R.SW) / T), py = Math.floor((p.y - 2 - sc.R.WH) / T); return px >= x0 && px < x0 + fw && py >= y0 && py < y0 + fh; }

    function lift() {
      const it = pieceAt();
      if (!it) return say(game.scene ? 'Nothing there to move. Tab brings out what you have.' : 'Nothing of yours there. Tab brings out what you have.');
      if (game.scene) {
        const sc = game.scene, b = sc.b;
        if (it.owned) b.extraFurn = (b.extraFurn || []).filter((f) => !(f.kind === it.kind && f.tx === it.tx && f.ty === it.ty && f.floor === sc.floor));
        else (b.removedFurn = b.removedFurn || []).push(sc.floor + ':' + it.kind + '@' + it.tx + ',' + it.ty);
        st.held = { kind: it.kind, v: it.v || 0, rot: it.rot || 0, width: it.width, seed: it.seed || 1 };
        anim('pickup'); rebuild(sc); O.sfx && O.sfx('place', 0.5, true); checkFit(b);
      } else {
        const w = cur().world, b = st.where;
        w.props = w.props.filter((p) => p !== it); w.dirtyStatics = true;
        b.yard = (b.yard || []).filter((y) => !(y.kind === it.kind && y.tx === Math.floor(it.x / T) && y.ty === Math.floor((it.y - 1) / T)));
        st.held = { kind: it.kind, v: it.v || 0, seed: it.seed || 1, yard: true }; anim('pickup');
      }
      say(`You lift the ${pieceLabel(st.held).toLowerCase()}. E to set it down, R to turn it, Delete to put it away.`);
    }
    function setDown() {
      const h = st.held; if (!h) return;
      if (h.good && G[h.good].decor) return applyInside(h);
      if (h.good && G[h.good].outside) return applyOutside(h);
      if (game.scene) {
        const sc = game.scene, b = sc.b, [x0, y0, fw, fh] = spotFor(h);
        if (standsOn(sc, x0, y0, fw, fh) && h.kind !== 'rug') return say("You're standing where it would go. Step back a pace.", 'bad');
        const prev = (b.extraFurn || []).slice(), f = { kind: h.kind, tx: x0, ty: y0, floor: sc.floor, rot: h.rot || 0, v: h.v || 0, seed: h.seed || 1 };
        if (h.width) f.width = h.width;
        b.extraFurn = [...prev, f]; O.Interior.invalidate(b);
        const L2 = O.Interior.interior(b, sc.floor, cur());
        const ok = L2.items.some((i) => i.owned && i.kind === h.kind && i.tx === x0 && i.ty === y0);
        if (!ok || L2.items.some((i) => i.access && !reachable(L2, i))) { b.extraFurn = prev; O.Interior.invalidate(b); return say(ok ? 'That would block the way to something. Try another spot.' : "It won't fit there.", 'bad'); }
        if (h.good) PS.remove(h.good);
        st.held = null; anim('place'); rebuild(sc); O.sfx && O.sfx('place', 0.6, true); checkFit(b);
        say(`You set the ${(D.FURN[h.kind]?.[0] || h.kind).toLowerCase()} down.`);
      } else {
        const b = st.where, [tx, ty] = facingTile(), why = yardOK(b, tx, ty);
        if (why) return say({ far: "That's past your own ground.", house: "That's the house.", door: 'Not across your own door.', solid: "There's no room there.", road: 'Not on the road; it belongs to everyone.', prop: "Something's already there.", tree: "There's a tree there.", off: 'Not there.' }[why], 'bad');
        const y = { kind: h.kind, tx, ty, v: h.v || (h.kind === 'lamp' ? 1 : 0), seed: h.seed || Math.floor(Math.random() * 999) + 1 };
        (b.yard = b.yard || []).push(y); const w = cur().world; w.props.push(yardProp(b, y)); w.dirtyStatics = true;
        if (h.good) PS.remove(h.good);
        st.held = null; anim('place'); O.sfx && O.sfx('place', 0.5);
        say(`You set the ${(YARD[y.kind]?.[0] || y.kind).toLowerCase()} out.`);
      }
    }
    function applyInside(h) {
      const sc = game.scene; if (!sc) return say('That goes up inside.', 'bad');
      const b = sc.b, d = G[h.good].decor;
      if ((b.decor || {})[d.what] === d.kind) return say("It's like that already.");
      b.decor = Object.assign({}, b.decor, { [d.what]: d.kind });
      PS.remove(h.good); st.held = null; anim('work');
      O.sfx && O.sfx(d.what === 'floor' ? 'place' : 'sweep', 0.6, true);
      setTimeout(() => { if (game.scene && game.scene.b === b) rebuild(game.scene); }, 900);
      say(d.what === 'floor' ? `You lay the ${nm(h.good)}. The room looks new.` : d.what === 'tint' ? `You brush on the ${nm(h.good)}.` : `You put up the ${nm(h.good)}.`);
    }
    function applyOutside(h) {
      const b = st.where; if (!b || game.scene) return say('That goes on the outside of the house.', 'bad');
      const o = G[h.good].outside, sp = b.spec;
      if (o.what === 'roof') { if (sp.roof === o.kind) return say('The roof is that already.'); sp.roof = o.kind; }
      else if (o.what === 'render') { if (o.kind === 'brick' || o.kind === 'stone') sp.wall = o.kind; else { if (['stone', 'log', 'plank', 'brick'].includes(sp.wall)) sp.wall = 'timber'; sp.plaster = o.kind; } }
      else if (o.what === 'paint') { sp.doorCol = o.col; sp.shutterCol = o.col; }
      sp._redone = true; sp._fin = undefined;
      try { b.sprite = O.Env.building(sp); } catch (e) { console.error(e); }
      PS.remove(h.good); st.held = null; anim('work'); O.sfx && O.sfx('place', 0.5);
      say(o.what === 'roof' ? `The roof is done in ${nm(h.good)}.` : o.what === 'paint' ? 'You paint the door and the shutters.' : 'The house front is done over.');
    }
    function turn() {
      const h = st.held; if (!h) { const it = pieceAt(); if (!it) return; lift(); if (!st.held) return; return turn(); }
      if (TURNS[h.kind]) { const r = TURNS[h.kind]; h.rot = r[(r.indexOf(h.rot || 0) + 1) % r.length]; }
      else if (WIDTHS[h.kind]) { const r = WIDTHS[h.kind]; h.width = r[(r.indexOf(h.width || r[0]) + 1) % r.length]; }
      else return say('That only stands one way.');
      O.sfx && O.sfx('place', 0.3, !!game.scene);
    }
    function refinish() {
      const h = st.held; if (!h) return say('Pick something up first.');
      if (PS.money < 2) return say('A pot of stain or dye costs ₳2.', 'bad');
      if (h.kind === 'rug' || h.kind === 'banner' || h.kind === 'flowers') h.seed = (h.seed || 1) + 7;
      else if (WOODY.has(h.kind) || h.yard) h.v = ((h.v || 0) + 1) % 3;
      else return say("There's no other finish for that.");
      PS.money -= 2; O.sfx && O.sfx('scrub', 0.3, !!game.scene);
      say(h.kind === 'rug' || h.kind === 'banner' ? 'You dye it another colour. ₳2.' : 'You give it another finish. ₳2.');
    }
    function stow(quiet) {
      const h = st.held; if (!h) return;
      if (!h.good) { if (game.scene) store(game.scene.b).push({ kind: h.kind, v: h.v, rot: h.rot, width: h.width, seed: h.seed }); else if (st.where) yardStore(st.where).push({ kind: h.kind, v: h.v, seed: h.seed }); }
      st.held = null; if (!quiet) say('Put away in the store. Tab brings it out again.');
    }
    function next() {
      const pal = palette(); if (!pal.length) return say(game.scene ? 'You have nothing to set out. Furniture, rugs, wall coverings and floors are sold by the trades that make them, or you can make them.' : 'You have nothing for the yard. Benches, flower beds, water butts, lantern posts, roofing and paint can be bought or made.');
      stow(true);
      st.pick = (st.pick + 1) % pal.length; const e = pal[st.pick];
      if (e.src === 'store') { const lst = game.scene ? store(game.scene.b) : yardStore(st.where); const p = lst.splice(e.i, 1)[0]; st.held = Object.assign({}, p, game.scene ? {} : { yard: true }); st.pick = Math.max(-1, st.pick - 1); }
      else { const g = G[e.good]; st.held = { good: e.good, kind: g.furniture || g.yard || null, v: 0, rot: 0, seed: Math.floor(Math.random() * 999) + 1, yard: !!g.yard }; }
      say(`In hand: ${pieceLabel(st.held)}. ${st.held.kind ? 'E sets it down.' : 'E puts it on.'}`);
    }
    function anim(a) { const p = game.player; p.anim = a; p.ft = 0; setTimeout(() => { if (p.anim === a) p.anim = 'idle'; }, 700); }
    function checkFit(b) { if (O.fitsAs) try { O.fitsAs(b); } catch (e) { /* */ } }

    function enter() {
      if (game.scene) { if (!mine(game.scene.b)) return say('You can only arrange a home you own or rent.', 'bad'); st.where = game.scene.b; }
      else { const b = homeOut(); const p = game.player; if (!b || Math.hypot(p.x / T - (b.doorX + 0.5), p.y / T - b.doorY) > 9) return say('Go to your own house to lay out the ground round it.', 'bad'); st.where = b; }
      st.on = true; st.pick = -1; st.lastScene = game.scene; showBar();
      say(game.scene ? 'Arranging the room. Walk to a piece and press E to lift it; Tab for what you have; V when done.' : 'Laying out your ground. Tab for what you have; E to set it down; V when done.');
    }
    function leave() { stow(true); st.on = false; st.held = null; showBar(); }
    O.Decorate = { enter, leave, get on() { return st.on; }, state: st, palette, yardOK, YARD, WALLS, FLOORS };

    game.keyHandlers.unshift((e) => {
      if (O.panelOpen || (O.UI.dialogOpen && O.UI.dialogOpen())) return false;
      if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey) { if (st.on) { leave(); say('Done arranging.'); } else enter(); return true; }
      if (!st.on) return false;
      if (e.code === 'KeyE' || e.code === 'Enter') { if (st.held) setDown(); else lift(); showBar(); return true; }
      if (e.code === 'KeyR') { turn(); showBar(); return true; }
      if (e.code === 'KeyT') { refinish(); showBar(); return true; }
      if (e.code === 'Tab') { next(); showBar(); return true; }
      if (e.code === 'Delete' || e.code === 'Backspace') { stow(); showBar(); return true; }
      if (e.code === 'Escape') { leave(); return true; }
      return false;
    });
    // leaving the place ends it
    game.hooks.update.push(() => {
      if (!st.on) return;
      if (game.scene !== st.lastScene) { if (st.lastScene !== undefined && st.held && (!!game.scene !== !!st.lastScene)) { const h = st.held; if (h.good) st.held = null; else { const wasIn = !!st.lastScene; st.held = null; if (wasIn && st.lastScene.b) store(st.lastScene.b).push({ kind: h.kind, v: h.v, rot: h.rot, width: h.width, seed: h.seed }); else if (st.where) yardStore(st.where).push({ kind: h.kind, v: h.v, seed: h.seed }); } } st.lastScene = game.scene; }
      const here = game.scene ? game.scene.b : null;
      if ((st.where && here && here !== st.where) || (here && !mine(here)) || (!here && st.where && st.where === game.scene?.b)) { leave(); return; }
      if (!here && st.where && st.where.doorX != null) { const p = game.player; if (Math.hypot(p.x / T - (st.where.doorX + 0.5), p.y / T - st.where.doorY) > 12) leave(); }
      if (here && st.where !== here) st.where = here;
    });

    // the piece in your hands, shown where it would go
    game.hooks.drawWorld.push((ctx, cam) => {
      if (!st.on) return;
      ctx.save();
      if (game.scene) {
        const sc = game.scene, h = st.held;
        if (h && h.kind) {
          const [x0, y0, fw, fh] = spotFor(h);
          ctx.strokeStyle = 'rgba(240,210,120,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(sc.R.SW + x0 * T - cam.x) + 0.5, Math.round(sc.R.WH + y0 * T - cam.y) + 0.5, fw * T - 1, fh * T - 1);
          try { const sp = sc.sprite({ kind: h.kind, rot: h.rot || 0, width: h.width, fw, seed: h.seed || 1 }, h.v || 0); const ax = sc.R.SW + (x0 + fw / 2) * T, ay = sc.R.WH + (y0 + fh) * T - 1; ctx.globalAlpha = 0.65; ctx.drawImage(sp.canvas, Math.round(ax - sp.ox - cam.x), Math.round(ay - sp.oy - cam.y)); } catch (e) { /* */ }
        } else { const [tx, ty] = facingTile(); ctx.strokeStyle = 'rgba(240,210,120,0.6)'; ctx.strokeRect(Math.round(sc.R.SW + tx * T - cam.x) + 0.5, Math.round(sc.R.WH + ty * T - cam.y) + 0.5, T - 1, T - 1); }
      } else {
        const [tx, ty] = facingTile(), h = st.held, bad = h && h.kind && st.where ? yardOK(st.where, tx, ty) : null;
        ctx.strokeStyle = bad ? 'rgba(220,90,70,0.85)' : 'rgba(240,210,120,0.85)'; ctx.strokeRect(tx * T - cam.x + 0.5, ty * T - cam.y + 0.5, T - 1, T - 1);
        if (h && h.kind) { try { const sp = O.Env.prop(h.kind, h.seed || 1, h.v || (h.kind === 'lamp' ? 1 : 0)); ctx.globalAlpha = 0.65; ctx.drawImage(sp.canvas, Math.round(tx * T + 8 - sp.ox - cam.x), Math.round(ty * T + 15 - sp.oy - cam.y)); } catch (e) { /* */ } }
      }
      ctx.restore();
    });

    // a strip along the bottom: what's in hand and what keys do what
    let bar = null;
    function showBar() {
      if (!st.on) { if (bar) bar.style.display = 'none'; return; }
      if (!bar) { bar = document.createElement('div'); bar.id = 'decorBar'; bar.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);max-width:min(560px,calc(100vw - 32px));background:rgba(28,22,18,0.88);color:#efe4cc;font-family:var(--pix);font-size:13px;line-height:1.5;padding:6px 10px;border:1px solid #8a6a3a;border-radius:4px;z-index:40;pointer-events:none;text-align:center'; document.body.appendChild(bar); }
      const pal = palette(), h = st.held;
      bar.style.display = 'block';
      bar.innerHTML = `<b>${game.scene ? 'Arranging the room' : 'Laying out your ground'}</b> · in hand: <b>${h ? O.escape(pieceLabel(h)) : 'nothing'}</b>${h && h.width ? ` (${h.width} wide)` : ''}<br><span style="opacity:.8">E lift / set down · R turn · T new finish ₳2 · Tab next of ${pal.length} · Del put away · V done</span>`;
    }
    game.hooks.update.push(() => { if (st.on && bar && Math.random() < 0.05) showBar(); });

    // the town does it too: a household with money to spare buys a new piece or has a room done over,
    // pays the trade that sold it, and talks about it after
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        for (const hh of this.households) {
          if (!(hh.money > 90) || Math.random() > 0.04) continue;
          const b = this.building ? this.building(hh.home) : null; if (!b || mine(b) || b.parent) continue;
          const who = hh.members.map((id) => this.byId.get(id)).filter((q) => q && q.age >= 18)[0]; if (!who) continue;
          const shops = [...this.biz.values()].filter((z) => (z.def.sells || []).some((g) => /^(wl|fl|tn|fx)_/.test(g) && z.stock[g] >= 1));
          const shop = shops[Math.floor(Math.random() * shops.length)]; if (!shop) continue;
          const goods = shop.def.sells.filter((g) => /^(wl|fl|tn|fx)_/.test(g) && shop.stock[g] >= 1 && (G[g].base || 9) < hh.money / 3);
          const g = goods[Math.floor(Math.random() * goods.length)]; if (!g) continue;
          const price = Math.round((G[g].base || 9) * 1.1);
          if (G[g].decor) { b.decor = Object.assign({}, b.decor, { [G[g].decor.what]: G[g].decor.kind }); }
          else {
            // a new piece: it has to fit and leave the way clear, else they take it back
            const prev = (b.extraFurn || []).slice(), L = O.Interior.interior(b, 0, this), kind = G[g].furniture;
            let done = false;
            for (let k = 0; k < 12 && !done; k++) { const tx = Math.floor(Math.random() * L.w), ty = 1 + Math.floor(Math.random() * Math.max(1, L.d - 3)); b.extraFurn = [...prev, { kind, tx, ty, floor: 0, v: Math.floor(Math.random() * 3), seed: Math.floor(Math.random() * 999) + 1 }]; O.Interior.invalidate(b); const L2 = O.Interior.interior(b, 0, this); done = L2.items.some((i) => i.owned && i.kind === kind && i.tx === tx && i.ty === ty) && !L2.items.some((i) => i.access && !reachable(L2, i)); }
            if (!done) { b.extraFurn = prev; O.Interior.invalidate(b); continue; }
          }
          O.Interior.invalidate(b);
          hh.money -= price; shop.stock[g] -= 1; shop.cash = (shop.cash || 0) + price;
          b.lastDone = { what: G[g].name.toLowerCase(), day: this.day, who: who.id };
          this.remember && this.remember(who, `Bought ${O.goodsWord ? O.goodsWord(g) : G[g].name.toLowerCase()} for the house from ${shop.name}. ₳${price}.`, 'life', 0.4);
        }
      } catch (e) { console.error(e); }
      return r;
    };
    O.Decorate.npcNewThing = (b) => (b.lastDone && cur().day - b.lastDone.day < 6 ? b.lastDone : null);

    // using a decor good from the satchel picks it up to place it
    const _place = O.placeItem;
    O.placeItem = (k) => {
      const g = G[k];
      if (g && (g.decor || g.outside || g.yard || (g.furniture && game.scene && mine(game.scene.b)))) {
        if (!st.on) enter(); if (!st.on) return;
        stow(true); st.held = { good: k, kind: g.furniture || g.yard || null, v: 0, rot: 0, seed: Math.floor(Math.random() * 999) + 1, yard: !!g.yard }; showBar();
        return say(`In hand: ${G[k].name}. ${st.held.kind ? 'Face where it goes and press E.' : 'Press E to put it on.'}`);
      }
      return _place ? _place(k) : undefined;
    };
    // the prompt over things while arranging
    const _cand = O.furnCandidate;
    O.furnCandidate = () => (st.on ? null : (_cand ? _cand() : null));
  }
  O.DecorateSetup = { setup };
})();
