// Every trade in the realm. Everything in the jobs list exists here: the goods, the places that make
// them and the people who work there. Each business says what it needs (inputs it buys, and from whom),
// what it makes, its hours, its wages, the equipment a building must have inside to be that business,
// and where such a place tends to stand (fishers by the water, charcoal burners in the woods...).
// Nothing here is beyond the middle ages: wood, stone, iron, wool, leather, clay, wax and muscle.
'use strict';
(function () {
  const D = O.Data, G = D.GOODS;

  // ---------------- goods ----------------
  // food: how filling (1 = a meal's worth); drink: refreshes; place: can be set down in the world
  Object.assign(G, {
    // the larder
    barley: { name: 'Barley', base: 2, unit: 'bushel', slots: 1 },
    oats: { name: 'Oats', base: 2, unit: 'bushel', slots: 1 },
    hay: { name: 'Hay', base: 1, unit: 'bale', slots: 2 },
    malt: { name: 'Malt', base: 3, unit: 'sack', slots: 1 },
    milk: { name: 'Milk', base: 1, unit: 'jug', slots: 1, drink: 0.4, food: 0.3, place: true },
    butter: { name: 'Butter', base: 3, unit: 'pat', slots: 1, food: 0.4, place: true },
    cheese: { name: 'Cheese', base: 4, unit: 'wheel', slots: 1, food: 0.8, place: true },
    eggs: { name: 'Eggs', base: 1, unit: 'half-dozen', slots: 1, food: 0.5, place: true },
    honey: { name: 'Honey', base: 5, unit: 'pot', slots: 1, food: 0.3, place: true },
    apples: { name: 'Apples', base: 1, unit: 'basket', slots: 1, food: 0.4, place: true },
    pie: { name: 'Meat pie', base: 3, unit: 'pie', slots: 1, food: 1.2, place: true },
    cake: { name: 'Honey cake', base: 3, unit: 'cake', slots: 1, food: 0.7, place: true },
    sausage: { name: 'Sausages', base: 3, unit: 'string', slots: 1, food: 1, place: true },
    stew: { name: 'Pottage', base: 2, unit: 'bowl', slots: 1, food: 1.1, place: true },
    wine: { name: 'Wine', base: 6, unit: 'flask', slots: 1, drink: 0.5, place: true },
    venison: { name: 'Venison', base: 7, unit: 'haunch', slots: 2, food: 1.5 },
    salt: { name: 'Salt', base: 2, unit: 'bag', slots: 1 },
    grapes: { name: 'Grapes', base: 2, unit: 'basket', slots: 1, food: 0.3 },
    // raw stuff
    beeswax: { name: 'Beeswax', base: 4, unit: 'cake', slots: 1 },
    charcoal: { name: 'Charcoal', base: 2, unit: 'sack', slots: 1 },
    coal: { name: 'Sea coal', base: 2, unit: 'sack', slots: 1 },
    silver: { name: 'Silver', base: 30, unit: 'ingot', slots: 1, valuable: true },
    gold: { name: 'Gold', base: 80, unit: 'nugget', slots: 1, valuable: true },
    clay: { name: 'Clay', base: 1, unit: 'lump', slots: 1 },
    bricks: { name: 'Bricks', base: 3, unit: 'hod', slots: 2 },
    peat: { name: 'Peat', base: 1, unit: 'turf', slots: 1 },
    flax: { name: 'Flax', base: 2, unit: 'sheaf', slots: 1 },
    linen: { name: 'Linen', base: 9, unit: 'bolt', slots: 2 },
    hemp: { name: 'Hemp', base: 2, unit: 'sheaf', slots: 1 },
    rope: { name: 'Rope', base: 4, unit: 'coil', slots: 1 },
    nets: { name: 'Fishing net', base: 8, unit: 'net', slots: 2 },
    woad: { name: 'Woad', base: 2, unit: 'bundle', slots: 1 },
    madder: { name: 'Madder root', base: 2, unit: 'bundle', slots: 1 },
    dyedcloth: { name: 'Dyed cloth', base: 16, unit: 'bolt', slots: 2 },
    sand: { name: 'Sand', base: 1, unit: 'sack', slots: 1 },
    potash: { name: 'Potash', base: 2, unit: 'pot', slots: 1 },
    glass: { name: 'Glass pane', base: 14, unit: 'pane', slots: 1 },
    pitch: { name: 'Pitch', base: 3, unit: 'pot', slots: 1 },
    bark: { name: 'Oak bark', base: 1, unit: 'bundle', slots: 1 },
    feathers: { name: 'Goose feathers', base: 1, unit: 'bundle', slots: 1 },
    parchment: { name: 'Parchment', base: 4, unit: 'sheet', slots: 1 },
    ink: { name: 'Ink', base: 3, unit: 'pot', slots: 1 },
    letter: { name: 'Letter', base: 2, unit: 'letter', slots: 1 },
    soap: { name: 'Soap', base: 2, unit: 'cake', slots: 1 },
    // made things
    nails: { name: 'Nails', base: 2, unit: 'bag', slots: 1 },
    horseshoes: { name: 'Horseshoes', base: 4, unit: 'set', slots: 1 },
    mail: { name: 'Mail shirt', base: 90, unit: 'shirt', slots: 3 },
    arrows: { name: 'Arrows', base: 4, unit: 'sheaf', slots: 1 },
    bow: { name: 'Longbow', base: 20, unit: 'bow', slots: 2, weapon: true },
    saddle: { name: 'Saddle', base: 30, unit: 'saddle', slots: 3 },
    harness: { name: 'Harness', base: 14, unit: 'set', slots: 2 },
    wheel: { name: 'Cart wheel', base: 10, unit: 'wheel', slots: 3 },
    cart: { name: 'Handcart', base: 40, unit: 'cart', slots: 4 },
    boat: { name: 'Rowing boat', base: 120, unit: 'boat', slots: 4 },
    cup: { name: 'Clay cup', base: 1, unit: 'cup', slots: 1, place: true },
    jug: { name: 'Jug', base: 2, unit: 'jug', slots: 1, place: true },
    broom: { name: 'Broom', base: 2, unit: 'broom', slots: 1 },
    bucket: { name: 'Bucket', base: 3, unit: 'bucket', slots: 1, place: true },
    shears: { name: 'Shears', base: 6, unit: 'pair', slots: 1 },
    sickle: { name: 'Sickle', base: 5, unit: 'sickle', slots: 1 },
    spade: { name: 'Spade', base: 6, unit: 'spade', slots: 1 },
    hammer: { name: 'Hammer', base: 5, unit: 'hammer', slots: 1 },
    rod: { name: 'Fishing rod', base: 3, unit: 'rod', slots: 1 },
    tent: { name: 'Canvas tent', base: 30, unit: 'tent', slots: 4 },
    lantern: { name: 'Horn lantern', base: 6, unit: 'lantern', slots: 1, place: true },
  });
  // furniture and fittings: bought from the trades that make them, set down inside a building
  const FURN = {
    counter: ['Shop counter', 18, 'carpenter'], shelf: ['Shelves', 12, 'carpenter'], table: ['Table', 12, 'carpenter'], chair: ['Chair', 5, 'carpenter'],
    bench: ['Bench', 6, 'carpenter'], bed: ['Bed', 20, 'carpenter'], double: ['Double bed', 34, 'carpenter'], chest: ['Chest', 10, 'carpenter'],
    wardrobe: ['Wardrobe', 24, 'carpenter'], cupboard: ['Cupboard', 14, 'carpenter'], dresser: ['Dresser', 22, 'carpenter'], bookcase: ['Bookcase', 20, 'carpenter'],
    desk: ['Writing desk', 18, 'carpenter'], workbench: ['Workbench', 14, 'carpenter'], doughtable: ['Kneading trough', 12, 'carpenter'], butcherblock: ['Butcher\'s block', 10, 'carpenter'],
    loom: ['Loom', 30, 'carpenter'], spinning: ['Spinning wheel', 14, 'carpenter'], rack: ['Tool rack', 8, 'carpenter'], bar: ['Bar counter', 30, 'carpenter'],
    longtable: ['Long table', 22, 'carpenter'], stool: ['Stool', 3, 'carpenter'], cradle: ['Cradle', 8, 'carpenter'],
    barrel: ['Barrel', 6, 'cooper'], washtub: ['Washtub', 5, 'cooper'], vat: ['Brewing vat', 26, 'cooper'],
    anvil: ['Anvil', 40, 'smithy'], cauldron: ['Cauldron', 16, 'smithy'], candlestand: ['Candlestand', 6, 'smithy'],
    oven: ['Bread oven', 45, 'builder'], forge: ['Forge', 50, 'builder'], kiln: ['Kiln', 40, 'builder'], fireplace: ['Hearth', 30, 'builder'], millstone: ['Millstones', 60, 'builder'],
    rug: ['Rug', 9, 'weaver'], crate: ['Crate', 3, 'carpenter'], sack: ['Sack', 1, 'weaver'], woodpile: ['Woodpile', 2, 'woodcutter'], plant: ['Potted plant', 3, 'potter'],
    ballotbox: ['Ballot box', 8, 'carpenter'],
  };
  for (const [k, [name, base, maker]] of Object.entries(FURN)) G['fx_' + k] = { name, base, unit: 'piece', slots: 3, furniture: k, maker };
  D.FURN = FURN;

  // ---------------- where things stand ----------------
  // site: 'town' (in or by the town), 'shore' (water's edge), 'coast' (the sea), 'river', 'woods', 'hills', 'moor', 'fields'
  const B = (o) => Object.assign({ hours: [7, 17], recipes: [], sells: [], buys: {}, targets: {}, wage: {} }, o);
  Object.assign(D.BUSINESS, {
    brewery: B({ label: 'Brewhouse', jobs: [['brewer', 1], ['maltster', 1]], hours: [6, 18], site: 'town', w: 5, d: 4, look: { wall: 'timber', roof: 'thatch', chimney: true, sign: 'mug' },
      recipes: [{ out: { malt: 1.2 }, inp: { barley: 1.2 }, role: 'maltster' }, { out: { ale: 6 }, inp: { malt: 1, firewood: 0.3 }, role: 'brewer' }],
      sells: ['ale', 'malt'], buys: { barley: 'farmhouse|import', firewood: 'woodcutter|store|import', cask: 'cooper|import' }, targets: { barley: 20, malt: 12, ale: 60, firewood: 8, cask: 3 }, wage: { brewer: 0, maltster: 5 }, equip: ['vat', 'barrel', 'counter'] }),
    vineyard: B({ label: 'Vineyard', jobs: [['vintner', 1], ['vine-dresser', 2]], hours: [6, 18], site: 'fields', south: true, w: 5, d: 4, look: { wall: 'stone', stoneMat: 'stoneWarm', roof: 'tile' },
      recipes: [{ out: { grapes: 2 }, inp: {}, role: 'vine-dresser' }, { out: { wine: 1.2 }, inp: { grapes: 2 }, role: 'vintner' }],
      sells: ['wine', 'grapes'], buys: { cask: 'cooper|import' }, targets: { grapes: 20, wine: 30, cask: 3 }, wage: { vintner: 0, 'vine-dresser': 5 }, equip: ['vat', 'barrel'] }),
    apiary: B({ label: 'Bee garden', jobs: [['beekeeper', 1]], hours: [8, 16], site: 'fields', w: 3, d: 3, look: { wall: 'timber', roof: 'thatch' },
      recipes: [{ out: { honey: 0.6, beeswax: 0.3 }, inp: {} }], sells: ['honey', 'beeswax'], targets: { honey: 20, beeswax: 10 }, wage: { beekeeper: 0 }, equip: ['shelf', 'barrel'] }),
    lodge: B({ label: "Forester's lodge", jobs: [['forester', 1], ['gamekeeper', 1]], hours: [6, 19], site: 'woods', w: 4, d: 3, look: { wall: 'log', roof: 'thatch', chimney: true },
      recipes: [{ out: { venison: 0.15, feathers: 0.3, bark: 0.6 }, inp: {}, role: 'gamekeeper' }, { out: { logs: 0.4 }, inp: {}, role: 'forester' }],
      sells: ['venison', 'feathers', 'bark'], targets: { venison: 6, feathers: 10, bark: 12 }, wage: { forester: 5, gamekeeper: 6 }, equip: ['rack', 'workbench'] }),
    charcoal: B({ label: "Charcoal burners' camp", jobs: [['charcoal burner', 2]], hours: [5, 20], site: 'woods', w: 3, d: 3, look: { wall: 'log', roof: 'thatch' },
      recipes: [{ out: { charcoal: 2, potash: 0.3, pitch: 0.2 }, inp: { logs: 1 } }], sells: ['charcoal', 'potash', 'pitch'], buys: { logs: 'woodcutter|lodge|import' }, targets: { logs: 12, charcoal: 30, potash: 8, pitch: 6 }, wage: { 'charcoal burner': 5 }, equip: ['woodpile', 'kiln'] }),
    claypit: B({ label: 'Clay pit', jobs: [['clay digger', 2]], hours: [7, 17], site: 'river', w: 3, d: 3, look: { wall: 'plank', roof: 'shingle' },
      recipes: [{ out: { clay: 3 }, inp: {} }], sells: ['clay'], targets: { clay: 40 }, wage: { 'clay digger': 5 }, equip: ['rack'] }),
    brickworks: B({ label: 'Brickworks', jobs: [['brickmaker', 2]], hours: [7, 17], site: 'town', w: 5, d: 3, look: { wall: 'stone', roof: 'tile', chimney: true },
      recipes: [{ out: { bricks: 1.4 }, inp: { clay: 2, firewood: 0.4 } }], sells: ['bricks'], buys: { clay: 'claypit|import', firewood: 'woodcutter|import' }, targets: { clay: 20, firewood: 10, bricks: 30 }, wage: { brickmaker: 5 }, equip: ['kiln', 'workbench'] }),
    saltworks: B({ label: 'Salt pans', jobs: [['salt boiler', 2]], hours: [6, 18], site: 'coast', w: 4, d: 3, look: { wall: 'plank', roof: 'shingle' },
      recipes: [{ out: { salt: 1.5, sand: 1 }, inp: { firewood: 0.3 } }], sells: ['salt', 'sand'], buys: { firewood: 'woodcutter|import' }, targets: { firewood: 10, salt: 30, sand: 20 }, wage: { 'salt boiler': 5 }, equip: ['cauldron', 'barrel'] }),
    peatcut: B({ label: 'Peat cutting', jobs: [['peat cutter', 2]], hours: [7, 17], site: 'moor', w: 3, d: 2, look: { wall: 'log', roof: 'thatch' },
      recipes: [{ out: { peat: 3 }, inp: {} }], sells: ['peat'], targets: { peat: 40 }, wage: { 'peat cutter': 4 }, equip: ['rack'] }),
    dyer: B({ label: 'Dyehouse', jobs: [['dyer', 1], ['apprentice', 1]], site: 'river', w: 4, d: 3, look: { wall: 'timber', roof: 'shingle' },
      recipes: [{ out: { dyedcloth: 0.3 }, inp: { cloth: 0.3, woad: 0.3 } }], sells: ['dyedcloth'], buys: { cloth: 'weaver|import', woad: 'farmhouse|import' }, targets: { cloth: 8, woad: 8, dyedcloth: 8 }, wage: { dyer: 0, apprentice: 4 }, equip: ['vat', 'rack'] }),
    saddler: B({ label: 'Saddler', jobs: [['saddler', 1]], site: 'town', w: 4, d: 3, look: { wall: 'timber', roof: 'thatch', shopWindow: true },
      recipes: [{ out: { saddle: 0.04, harness: 0.1 }, inp: { leather: 0.4 } }], sells: ['saddle', 'harness'], buys: { leather: 'tanner|import' }, targets: { leather: 8, saddle: 2, harness: 4 }, wage: { saddler: 0 }, equip: ['workbench', 'rack', 'counter'] }),
    glazier: B({ label: 'Glazier', jobs: [['glazier', 1]], site: 'town', w: 4, d: 3, look: { wall: 'stone', roof: 'slate', chimney: true, shopWindow: true },
      recipes: [{ out: { glass: 0.1 }, inp: { sand: 0.4, potash: 0.2, firewood: 0.3 } }], sells: ['glass'], buys: { sand: 'saltworks|quarry|import', potash: 'charcoal|import', firewood: 'woodcutter|import' }, targets: { sand: 8, potash: 4, firewood: 6, glass: 4 }, wage: { glazier: 0 }, equip: ['kiln', 'workbench', 'counter'] }),
    ropewalk: B({ label: 'Ropewalk', jobs: [['rope-maker', 2]], site: 'town', w: 6, d: 2, look: { wall: 'plank', roof: 'shingle', roofType: 'side' },
      recipes: [{ out: { rope: 0.6, nets: 0.1 }, inp: { hemp: 0.6 } }], sells: ['rope', 'nets'], buys: { hemp: 'farmhouse|import' }, targets: { hemp: 10, rope: 12, nets: 4 }, wage: { 'rope-maker': 5 }, equip: ['spinning', 'rack'] }),
    wainwright: B({ label: 'Wainwright', jobs: [['wainwright', 1], ['apprentice', 1]], site: 'town', w: 5, d: 4, look: { wall: 'plank', roof: 'shingle', bigDoor: true },
      recipes: [{ out: { wheel: 0.12, cart: 0.03 }, inp: { planks: 0.4, iron: 0.05 } }], sells: ['wheel', 'cart'], buys: { planks: 'sawmill|builder|import', iron: 'mine|import' }, targets: { planks: 10, iron: 3, wheel: 4, cart: 2 }, wage: { wainwright: 0, apprentice: 4 }, equip: ['workbench', 'anvil'] }),
    boatyard: B({ label: 'Boatyard', jobs: [['boatwright', 1], ['labourer', 1]], site: 'shore', w: 6, d: 3, look: { wall: 'plank', roof: 'shingle', bigDoor: true },
      recipes: [{ out: { boat: 0.01, nets: 0.05 }, inp: { planks: 0.6, rope: 0.1, pitch: 0.1 }, role: 'boatwright' }], sells: ['boat'], buys: { planks: 'sawmill|import', rope: 'ropewalk|import', pitch: 'charcoal|import' }, targets: { planks: 12, rope: 4, pitch: 3, boat: 1 }, wage: { boatwright: 0, labourer: 6 }, equip: ['workbench', 'rack'] }),
    fletcher: B({ label: 'Fletcher & bowyer', jobs: [['fletcher', 1], ['bowyer', 1]], site: 'town', w: 4, d: 3, look: { wall: 'timber', roof: 'thatch', shopWindow: true, sign: 'sword' },
      recipes: [{ out: { arrows: 0.5 }, inp: { feathers: 0.2, logs: 0.05 }, role: 'fletcher' }, { out: { bow: 0.05 }, inp: { logs: 0.1 }, role: 'bowyer' }], sells: ['arrows', 'bow'], buys: { feathers: 'lodge|farmhouse|import', logs: 'woodcutter|import' }, targets: { feathers: 8, logs: 4, arrows: 12, bow: 3 }, wage: { fletcher: 0, bowyer: 6 }, equip: ['workbench', 'rack', 'counter'] }),
    scriptorium: B({ label: 'Scrivener', jobs: [['scribe', 1]], site: 'town', w: 4, d: 3, look: { wall: 'stone', roof: 'slate', shopWindow: true },
      recipes: [{ out: { letter: 1.5, ink: 0.2 }, inp: { parchment: 0.5 } }], sells: ['letter', 'ink', 'parchment'], buys: { parchment: 'tanner|import' }, targets: { parchment: 10, letter: 12, ink: 4 }, wage: { scribe: 0 }, equip: ['desk', 'bookcase', 'counter'] }),
    posthouse: B({ label: 'Post house', jobs: [['postmaster', 1], ['messenger', 2], ['mounted courier', 1]], hours: [7, 19], site: 'town', w: 5, d: 4, look: { wall: 'stone', roof: 'slate', sign: 'scales' },
      recipes: [], sells: ['letter', 'parchment'], buys: { letter: 'scriptorium|import' }, targets: { letter: 20, parchment: 6 }, wage: { postmaster: 0, messenger: 4, 'mounted courier': 8 }, equip: ['counter', 'desk', 'shelf'] }),
    barber: B({ label: 'Barber-surgeon', jobs: [['barber-surgeon', 1]], site: 'town', w: 4, d: 3, look: { wall: 'timber', roof: 'thatch', shopWindow: true, sign: 'herb' },
      recipes: [{ out: { medicine: 0.1, soap: 0.3 }, inp: { herbs: 0.1 } }], sells: ['medicine', 'soap'], buys: { herbs: 'doctor|apothecary|import' }, targets: { herbs: 4, medicine: 4, soap: 8 }, wage: { 'barber-surgeon': 0 }, equip: ['chair', 'washtub', 'shelf'] }),
    moneylender: B({ label: 'Moneylender', jobs: [['moneylender', 1], ['clerk', 1]], hours: [9, 17], site: 'town', w: 4, d: 4, floors: 2, look: { wall: 'stone', roof: 'slate', shopWindow: true, sign: 'scales' },
      recipes: [], sells: [], targets: {}, wage: { moneylender: 0, clerk: 7 }, equip: ['desk', 'chest', 'counter'], security: 0.8 }),
    laundry: B({ label: 'Laundry', jobs: [['laundress', 2]], hours: [6, 16], site: 'river', w: 4, d: 3, look: { wall: 'timber', roof: 'thatch' },
      recipes: [{ out: { soap: 0.2 }, inp: { tallow: 0.05, potash: 0.05 } }], sells: ['soap'], buys: { tallow: 'butcher|import', potash: 'charcoal|import' }, targets: { soap: 6, tallow: 2, potash: 2 }, wage: { laundress: 4 }, equip: ['washtub', 'washtub', 'rack'] }),
    carrier: B({ label: "Carrier's yard", jobs: [['carter', 2]], hours: [6, 19], site: 'town', w: 5, d: 3, look: { wall: 'plank', roof: 'shingle', bigDoor: true },
      recipes: [], sells: [], buys: { hay: 'farmhouse|import' }, targets: { hay: 10 }, wage: { carter: 5 }, equip: ['rack', 'barrel'] }),
    agency: B({ label: 'House agent', jobs: [['house agent', 1]], hours: [9, 17], site: 'town', w: 3, d: 3, look: { wall: 'timber', roof: 'tile', shopWindow: true, sign: 'scales' },
      recipes: [], sells: [], targets: {}, wage: { 'house agent': 0 }, equip: ['desk', 'counter'] }),
    ferry: B({ label: 'Ferry', jobs: [['ferryman', 1]], hours: [6, 20], site: 'river', w: 3, d: 2, look: { wall: 'plank', roof: 'thatch' },
      recipes: [], sells: [], targets: {}, wage: { ferryman: 4 }, equip: ['rack'] }),
    tollhouse: B({ label: 'Toll house', jobs: [['toll keeper', 1]], hours: [6, 21], site: 'town', w: 3, d: 3, look: { wall: 'stone', roof: 'slate' },
      recipes: [], sells: [], targets: {}, wage: { 'toll keeper': 4 }, public: true, equip: ['desk'] }),
    gaol: B({ label: 'Gaol', jobs: [['gaoler', 1], ['turnkey', 2]], hours: [6, 22], site: 'town', w: 5, d: 4, look: { wall: 'stone', stoneMat: 'stoneDark', roof: 'slate' },
      recipes: [], sells: [], buys: { bread: 'bakery|store|import' }, targets: { bread: 12 }, wage: { gaoler: 8, turnkey: 5 }, public: true, equip: ['cell', 'desk'], security: 0.9 }),
    posting: null,
  });
  delete D.BUSINESS.posting;

  // ---------------- what each old trade must have inside to be that trade ----------------
  const EQ = { bakery: ['oven', 'shelf', 'counter'], smithy: ['forge', 'anvil'], armourer: ['forge', 'anvil', 'rack'], tavern: ['bar', 'table', 'barrel'], store: ['shelf', 'counter'], butcher: ['butcherblock', 'counter'],
    carpenter: ['workbench'], tailor: ['workbench', 'counter'], weaver: ['loom'], cobbler: ['workbench', 'counter'], chandler: ['cauldron'], cooper: ['workbench'], tanner: ['workbench'], potter: ['workbench', 'counter'],
    mill: ['millstone'], apothecary: ['shelf', 'cauldron'], doctor: ['desk', 'medbed'], jeweller: ['workbench'], sawmill: ['workbench'], builder: ['workbench', 'rack'] };
  for (const [t, eq] of Object.entries(EQ)) if (D.BUSINESS[t] && !D.BUSINESS[t].equip) D.BUSINESS[t].equip = eq;

  // ---------------- new hands in the old trades ----------------
  const addJob = (type, role, n, wage) => { const d = D.BUSINESS[type]; if (!d || d.jobs.some(([r]) => r === role)) return; d.jobs.push([role, n]); d.wage[role] = wage; };
  // farms: barley and oats for the brewers and horses, flax, hemp and woad, a dairy and hens
  const fm = D.BUSINESS.farmhouse;
  if (fm && !fm.jobs.some(([r]) => r === 'dairymaid')) {
    addJob('farmhouse', 'dairymaid', 1, 4);
    fm.recipes.push({ out: { milk: 2, butter: 0.4, cheese: 0.25, eggs: 1 }, inp: {}, role: 'dairymaid' }, { out: { barley: 1.5, oats: 1, hay: 1.5, flax: 0.3, hemp: 0.3, woad: 0.2, apples: 0.4 }, inp: {}, role: 'farmhand' });
    fm.sells = [...new Set([...fm.sells, 'milk', 'butter', 'cheese', 'eggs', 'barley', 'oats', 'hay', 'flax', 'hemp', 'woad', 'apples'])];
    Object.assign(fm.targets, { milk: 10, butter: 6, cheese: 6, eggs: 10, barley: 30, oats: 20, hay: 20, flax: 8, hemp: 8, woad: 6, apples: 10 });
  }
  // the inn: a chambermaid, pies, pottage and wine besides ale; the bakery bakes pies and cakes
  addJob('tavern', 'chambermaid', 1, 3);
  const tv = D.BUSINESS.tavern; if (tv && !tv.sells.includes('stew')) { tv.recipes.push({ out: { stew: 3, pie: 1 }, inp: { cabbage: 0.5, meat: 0.3, salt: 0.05, firewood: 0.2 }, role: 'cook' }); tv.sells.push('stew', 'pie', 'wine'); tv.buys.wine = 'vineyard|import'; tv.buys.meat = 'butcher|import'; tv.buys.salt = 'saltworks|import'; tv.buys.ale = 'brewery|import'; Object.assign(tv.targets, { stew: 10, pie: 6, wine: 6, meat: 4, salt: 3 }); }
  const bk = D.BUSINESS.bakery; if (bk && !bk.sells.includes('pie')) { bk.recipes.push({ out: { pie: 1, cake: 1 }, inp: { flour: 0.5, meat: 0.2, honey: 0.1, firewood: 0.2 } }); bk.sells.push('pie', 'cake'); bk.buys.meat = 'butcher|import'; bk.buys.honey = 'apiary|import'; Object.assign(bk.targets, { pie: 12, cake: 8, meat: 3, honey: 2 }); }
  const bu = D.BUSINESS.butcher; if (bu && !bu.sells.includes('sausage')) { bu.recipes.push({ out: { sausage: 1 }, inp: { salt: 0.05 } }); bu.sells.push('sausage'); bu.buys = Object.assign(bu.buys || {}, { salt: 'saltworks|import' }); bu.targets.sausage = 10; bu.targets.salt = 2; }
  // the smith shoes horses and makes nails; the armourer makes mail; the tanner sells parchment
  const sm = D.BUSINESS.smithy; if (sm && !sm.sells.includes('nails')) { sm.recipes.push({ out: { nails: 0.8, horseshoes: 0.2, hammer: 0.05, sickle: 0.04, shears: 0.03, spade: 0.04 }, inp: { iron: 0.3, charcoal: 0.2 } }); sm.sells.push('nails', 'horseshoes', 'hammer', 'sickle', 'shears', 'spade', 'fx_anvil', 'fx_cauldron', 'fx_candlestand'); sm.buys.charcoal = 'charcoal|import'; Object.assign(sm.targets, { nails: 10, horseshoes: 4, hammer: 2, sickle: 2, shears: 2, spade: 2, charcoal: 6, fx_anvil: 1, fx_cauldron: 2, fx_candlestand: 2 }); }
  const ar = D.BUSINESS.armourer; if (ar && !ar.sells.includes('mail')) { ar.recipes.push({ out: { mail: 0.015 }, inp: { iron: 0.3 } }); ar.sells.push('mail'); ar.targets.mail = 1; }
  const tn = D.BUSINESS.tanner; if (tn && !tn.sells.includes('parchment')) { tn.recipes.push({ out: { parchment: 0.4 }, inp: { hide: 0.15, bark: 0.1 } }); tn.sells.push('parchment'); tn.buys.bark = 'lodge|import'; tn.targets.parchment = 10; tn.targets.bark = 6; }
  const ch = D.BUSINESS.chandler; if (ch && !ch.sells.includes('lantern')) { ch.recipes.push({ out: { candles: 2, lantern: 0.05 }, inp: { beeswax: 0.3 } }); ch.sells.push('lantern'); ch.buys.beeswax = 'apiary|import'; ch.targets.beeswax = 4; ch.targets.lantern = 2; }
  const pt = D.BUSINESS.potter; if (pt && !pt.sells.includes('cup')) { pt.recipes.push({ out: { cup: 1, jug: 0.4, fx_plant: 0.05 }, inp: { clay: 0.6 } }); pt.sells.push('cup', 'jug', 'fx_plant'); pt.buys.clay = 'claypit|import'; Object.assign(pt.targets, { clay: 10, cup: 12, jug: 6, fx_plant: 2 }); }
  const cp = D.BUSINESS.carpenter; if (cp) { const kinds = Object.entries(FURN).filter(([, v]) => v[2] === 'carpenter').map(([k]) => 'fx_' + k); cp.recipes.push({ out: Object.fromEntries(kinds.map((k) => [k, 0.02])), inp: { planks: 0.4, nails: 0.05 }, role: 'carpenter' }); cp.sells = [...new Set([...cp.sells, ...kinds, 'broom', 'bucket'])]; cp.buys.nails = 'smithy|import'; for (const k of kinds) cp.targets[k] = 1; cp.targets.broom = 2; cp.targets.bucket = 2; cp.recipes.push({ out: { broom: 0.2, bucket: 0.1 }, inp: { planks: 0.1 } }); }
  const co = D.BUSINESS.cooper; if (co) { co.recipes.push({ out: { fx_barrel: 0.04, fx_washtub: 0.03, fx_vat: 0.01 }, inp: { planks: 0.3 } }); co.sells = [...new Set([...co.sells, 'fx_barrel', 'fx_washtub', 'fx_vat'])]; Object.assign(co.targets, { fx_barrel: 2, fx_washtub: 1, fx_vat: 1 }); }
  const bd = D.BUSINESS.builder; if (bd) { bd.recipes.push({ out: { fx_oven: 0.01, fx_forge: 0.01, fx_kiln: 0.01, fx_fireplace: 0.015, fx_millstone: 0.005 }, inp: { stone: 0.4, bricks: 0.2 }, role: 'master builder' }); bd.sells = [...new Set([...bd.sells, 'fx_oven', 'fx_forge', 'fx_kiln', 'fx_fireplace', 'fx_millstone', 'bricks'])]; bd.buys.bricks = 'brickworks|import'; Object.assign(bd.targets, { fx_oven: 1, fx_forge: 1, fx_kiln: 1, fx_fireplace: 1, fx_millstone: 1, bricks: 10 }); addJob('builder', 'thatcher', 1, 6); addJob('builder', 'plasterer', 1, 6); addJob('builder', 'roofer', 1, 6); }
  const wv = D.BUSINESS.weaver; if (wv) { wv.recipes.push({ out: { linen: 0.2, fx_rug: 0.02, fx_sack: 0.1 }, inp: { flax: 0.3 } }); wv.sells = [...new Set([...wv.sells, 'linen', 'fx_rug', 'fx_sack'])]; wv.buys.flax = 'farmhouse|import'; Object.assign(wv.targets, { linen: 4, fx_rug: 1, fx_sack: 4, flax: 6 }); }
  const st = D.BUSINESS.store; if (st) { st.sells = [...new Set([...st.sells, 'tent', 'salt', 'candles', 'soap', 'eggs', 'cheese', 'apples', 'broom', 'bucket', 'cup', 'rope'])]; Object.assign(st.buys, { tent: 'weaver|import', salt: 'saltworks|import', candles: 'chandler|import', soap: 'laundry|barber|import', eggs: 'farmhouse|import', cheese: 'farmhouse|import', apples: 'farmhouse|import', broom: 'carpenter|import', bucket: 'carpenter|import', cup: 'potter|import', rope: 'ropewalk|import' }); Object.assign(st.targets, { tent: 2, salt: 6, candles: 12, soap: 6, eggs: 6, cheese: 4, apples: 6, broom: 2, bucket: 2, cup: 6, rope: 2 }); }
  const fi = D.BUSINESS.fishery; if (fi) { fi.buys = Object.assign(fi.buys || {}, { nets: 'ropewalk|boatyard|import', salt: 'saltworks|import' }); Object.assign(fi.targets, { nets: 2, salt: 2 }); }
  const ml = D.BUSINESS.mine; if (ml && !ml.sells.includes('coal')) { ml.recipes.push({ out: { coal: 1, silver: 0.03, gold: 0.005 }, inp: {} }); ml.sells.push('coal', 'silver'); Object.assign(ml.targets, { coal: 20, silver: 2, gold: 1 }); }
  const qu = D.BUSINESS.quarry; if (qu && !qu.sells.includes('sand')) { qu.recipes.push({ out: { sand: 1 }, inp: {} }); qu.sells.push('sand'); qu.targets.sand = 20; }
  const jw = D.BUSINESS.jeweller; if (jw) { jw.buys = Object.assign(jw.buys || {}, { silver: 'mine|import', gold: 'mine|import' }); Object.assign(jw.targets, { silver: 2, gold: 1 }); }
  const sb = D.BUSINESS.stable; if (sb) { sb.buys = Object.assign(sb.buys || {}, { hay: 'farmhouse|import', oats: 'farmhouse|import', horseshoes: 'smithy|import', saddle: 'saddler|import', harness: 'saddler|import' }); Object.assign(sb.targets, { hay: 10, oats: 8, horseshoes: 2, saddle: 1, harness: 1 }); sb.sells = [...new Set([...sb.sells, 'saddle', 'harness'])]; }
  // public servants and household offices
  addJob('guard', 'gaoler', 1, 5); addJob('guard', 'sergeant', 1, 8); addJob('guard', 'bounty hunter', 1, 2);
  addJob('chapel', 'gravedigger', 1, 3); addJob('chapel', 'bell-ringer', 1, 2); addJob('chapel', 'pilgrim guide', 1, 3);
  addJob('townhall', 'bailiff', 1, 6); addJob('townhall', 'market warden', 1, 5); addJob('townhall', 'town crier', 1, 3); addJob('townhall', 'rat-catcher', 1, 3); addJob('townhall', 'lamplighter', 1, 3); addJob('townhall', 'chimney sweep', 1, 3); addJob('townhall', 'water carrier', 1, 3); addJob('townhall', 'ballot clerk', 1, 3);
  addJob('doctor', 'midwife', 1, 6); addJob('hospital', 'midwife', 1, 6); addJob('hospital', 'barber-surgeon', 1, 8);
  addJob('palace', 'herald', 1, 8); addJob('palace', 'master of horse', 1, 10); addJob('palace', 'royal guard', 4, 8); addJob('palace', 'captain of the royal guard', 1, 12); addJob('palace', 'jester', 1, 6); addJob('palace', 'falconer', 1, 7); addJob('palace', 'executioner', 1, 6); addJob('palace', 'spy', 1, 10); addJob('palace', 'stablehand', 2, 5);
  addJob('keep', 'squire', 1, 3); addJob('keep', 'gamekeeper', 1, 6); addJob('keep', 'falconer', 1, 7); addJob('keep', 'stablehand', 1, 5); addJob('keep', 'knight', 1, 15);
  addJob('manor', 'stablehand', 1, 5); addJob('manor', 'gamekeeper', 1, 6); addJob('manor', 'farmer', 1, 6);

  // ---------------- what each trade wears and does ----------------
  Object.assign(D.ROLE_OUTFIT, {
    brewer: 'innkeeper', maltster: 'farmhand', vintner: 'merchant', 'vine-dresser': 'farmhand', beekeeper: 'farmhand', forester: 'woodcutter', gamekeeper: 'woodcutter',
    'charcoal burner': 'woodcutter', 'clay digger': 'farmhand', brickmaker: 'builder', 'salt boiler': 'fisher', 'peat cutter': 'farmhand', dyer: 'villager', saddler: 'villager',
    glazier: 'blacksmith', 'rope-maker': 'villager', wainwright: 'woodcutter', boatwright: 'fisher', fletcher: 'villager', bowyer: 'woodcutter', scribe: 'merchant', postmaster: 'merchant',
    messenger: 'courier', 'mounted courier': 'courier', 'barber-surgeon': 'doctor', moneylender: 'merchant', laundress: 'servant', carter: 'farmhand', 'house agent': 'merchant', ferryman: 'fisher',
    'toll keeper': 'guard', dairymaid: 'farmhand', chambermaid: 'servant', gaoler: 'guard', turnkey: 'guard', sergeant: 'guard', 'bounty hunter': 'outlaw', gravedigger: 'undertaker', 'bell-ringer': 'priest',
    'pilgrim guide': 'priest', bailiff: 'guard', 'market warden': 'merchant', 'town crier': 'courier', 'rat-catcher': 'villager', lamplighter: 'villager', 'chimney sweep': 'sweeper',
    'water carrier': 'villager', 'ballot clerk': 'merchant', midwife: 'doctor', herald: 'courier', 'master of horse': 'noble', 'royal guard': 'guard', 'captain of the royal guard': 'guard',
    jester: 'bard', falconer: 'woodcutter', executioner: 'outlaw', spy: 'villager', stablehand: 'farmhand', squire: 'servant', knight: 'guard', thatcher: 'builder', plasterer: 'builder', roofer: 'builder', potboy: 'innkeeper',
  });

  // the action and tool each role works with: [animation, outdoors?]
  D.ROLE_ACTION = {
    baker: 'knead', apprentice: 'work', blacksmith: 'hammer', armourer: 'hammer', farmer: 'hoe', farmhand: 'pitch', dairymaid: 'pour', shepherd: 'shear', miller: 'carry', labourer: 'carry',
    woodcutter: 'chop', forester: 'chop', 'charcoal burner': 'pitch', sawyer: 'saw', carpenter: 'saw', cooper: 'hammer', wainwright: 'saw', boatwright: 'hammer', bowyer: 'saw', fletcher: 'work',
    innkeeper: 'pour', server: 'serve', cook: 'cook', chambermaid: 'scrub', potboy: 'scrub', brewer: 'mix', maltster: 'pitch', vintner: 'pour', 'vine-dresser': 'work', beekeeper: 'work',
    butcher: 'cleave', fisher: 'fish', 'salt boiler': 'mix', 'clay digger': 'dig', brickmaker: 'knead', 'peat cutter': 'dig', miner: 'chop', quarryman: 'chop', 'mine foreman': 'write', 'quarry master': 'write',
    weaver: 'weave', spinner: 'spin', tailor: 'work', dyer: 'mix', tanner: 'scrub', cobbler: 'hammer', saddler: 'work', chandler: 'mix', potter: 'knead', glazier: 'work', 'rope-maker': 'spin',
    jeweller: 'work', physician: 'write', herbalist: 'work', apothecary: 'mix', nurse: 'serve', bearer: 'carry', midwife: 'serve', 'barber-surgeon': 'work',
    scribe: 'write', clerk: 'write', postmaster: 'write', magistrate: 'write', moneylender: 'count', 'house agent': 'write', 'ballot clerk': 'count', teacher: 'read', priest: 'pray', 'parish clerk': 'write',
    'bell-ringer': 'pray', gravedigger: 'dig', undertaker: 'scrub', sweeper: 'sweep', 'chimney sweep': 'sweep', laundress: 'scrub', 'water carrier': 'bucket', lamplighter: 'point', 'rat-catcher': 'crouch',
    'guard captain': 'write', guard: 'idle', gaoler: 'idle', turnkey: 'place', sergeant: 'point', 'royal guard': 'idle', 'captain of the royal guard': 'point', 'tax collector': 'count', bailiff: 'point', 'market warden': 'count',
    'town crier': 'wave', herald: 'read', shopkeeper: 'count', 'horse trader': 'talk', stablehand: 'pitch', groom: 'scrub', 'master of horse': 'talk', gamekeeper: 'look', falconer: 'look',
    steward: 'write', chamberlain: 'write', butler: 'pour', maid: 'scrub', page: 'carry', 'lady-in-waiting': 'talk', 'master cook': 'cook', scullion: 'scrub', gardener: 'dig', jester: 'celebrate',
    executioner: 'idle', spy: 'look', squire: 'scrub', knight: 'idle', thatcher: 'work', plasterer: 'scrub', roofer: 'hammer', 'master builder': 'write', builder: 'hammer', carter: 'carry', ferryman: 'pitch',
    'toll keeper': 'count', messenger: 'carry', 'mounted courier': 'carry', 'warehouse master': 'write', 'warehouse worker': 'carry', docker: 'carry', 'night watchman': 'look', 'pilgrim guide': 'talk', 'bounty hunter': 'look',
  };
  D.actionFor = (role) => D.ROLE_ACTION[role] || 'work';
})();
