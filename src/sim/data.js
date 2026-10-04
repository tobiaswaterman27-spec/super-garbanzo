// Static simulation data: goods, trades, names, personality traits.
'use strict';
(function () {
  // Base prices in pennies (d). 12d = 1 shilling.
  const GOODS = {
    wheat: { name: 'Wheat', base: 2, unit: 'bushel', slots: 1 },
    flour: { name: 'Flour', base: 4, unit: 'sack', slots: 1 },
    bread: { name: 'Bread', base: 2, unit: 'loaf', slots: 1, food: 1 },
    cabbage: { name: 'Cabbage', base: 1, unit: 'head', slots: 1, food: 0.6 },
    fish: { name: 'Fish', base: 2, unit: 'fish', slots: 1, food: 0.8 },
    ale: { name: 'Ale', base: 1, unit: 'jug', slots: 1 },
    meal: { name: 'Hot meal', base: 4, unit: 'bowl', slots: 1, food: 1.4 },
    logs: { name: 'Logs', base: 3, unit: 'bundle', slots: 2 },
    firewood: { name: 'Firewood', base: 1, unit: 'bundle', slots: 1 },
    iron: { name: 'Iron bar', base: 8, unit: 'bar', slots: 1 },
    stone: { name: 'Building stone', base: 2, unit: 'block', slots: 2 },
    tools: { name: 'Tools', base: 24, unit: 'piece', slots: 1 },
    medicine: { name: 'Remedy', base: 10, unit: 'phial', slots: 1 },
    herbs: { name: 'Herbs', base: 2, unit: 'bunch', slots: 1 },
    dagger: { name: 'Dagger', base: 14, unit: 'blade', slots: 1, weapon: true },
    sword: { name: 'Sword', base: 40, unit: 'blade', slots: 2, weapon: true },
    axe: { name: 'Hand axe', base: 18, unit: 'axe', slots: 1, weapon: true },
    spoon: { name: 'Silver spoon', base: 12, unit: 'spoon', slots: 1, valuable: true },
    brooch: { name: 'Brooch', base: 30, unit: 'brooch', slots: 1, valuable: true },
    candlestick: { name: 'Pewter candlestick', base: 9, unit: 'candlestick', slots: 1, valuable: true },
    key: { name: 'Room key', base: 0, unit: 'key', slots: 1, quest: true },
    meat: { name: 'Meat', base: 4, unit: 'cut', slots: 1, food: 1.3 },
    ring: { name: 'Gold ring', base: 45, unit: 'ring', slots: 1, valuable: true },
    furniture: { name: 'Chair', base: 16, unit: 'piece', slots: 3 },
    helm: { name: 'Iron helm', base: 30, unit: 'helm', slots: 2 },
    cloth: { name: 'Bolt of cloth', base: 10, unit: 'bolt', slots: 2 },
    planks: { name: 'Planks', base: 5, unit: 'bundle', slots: 2 },
  };

  // Business definitions: roles (job slots), hours, recipes (per worker-hour at skill 1),
  // what they sell to the public and what they keep in stock.
  const BUSINESS = {
    farmhouse: { label: 'Farm', jobs: [['farmer', 1], ['farmhand', 2]], hours: [6, 18], recipes: [{ out: { wheat: 4.5, cabbage: 2 }, inp: {} }], sells: ['cabbage', 'wheat'], buys: { tools: 'smithy' }, targets: { wheat: 60, cabbage: 40, tools: 3 }, wage: { farmer: 0, farmhand: 6 } },
    mill: { label: 'Mill', jobs: [['miller', 1], ['labourer', 1]], hours: [7, 17], recipes: [{ out: { flour: 2 }, inp: { wheat: 2 } }], sells: ['flour'], buys: { wheat: 'farmhouse|warehouse|import' }, targets: { wheat: 40, flour: 40 }, wage: { miller: 0, labourer: 6 } },
    bakery: { label: 'Bakery', jobs: [['baker', 1], ['apprentice', 1]], hours: [5, 17], recipes: [{ out: { bread: 6 }, inp: { flour: 2, firewood: 0.5 } }], sells: ['bread'], buys: { flour: 'mill|import', firewood: 'woodcutter|store|import' }, targets: { flour: 30, firewood: 10, bread: 60 }, wage: { baker: 0, apprentice: 4 } },
    woodcutter: { label: "Woodcutter's", jobs: [['woodcutter', 2]], hours: [7, 17], recipes: [{ out: { logs: 1.5, firewood: 5 }, inp: {} }], sells: ['firewood', 'logs'], buys: { tools: 'smithy' }, targets: { firewood: 40, logs: 20, tools: 2 }, wage: { woodcutter: 7 } },
    smithy: { label: 'Smithy', jobs: [['blacksmith', 1], ['apprentice', 1]], hours: [7, 18], recipes: [{ out: { tools: 0.25 }, inp: { iron: 0.5, firewood: 0.5 } }, { out: { dagger: 0.06, axe: 0.04 }, inp: { iron: 0.15, firewood: 0.1 }, role: 'blacksmith' }], sells: ['tools', 'dagger', 'axe'], buys: { firewood: 'woodcutter', iron: 'mine|import' }, targets: { iron: 10, firewood: 10, tools: 6, dagger: 3, axe: 2 }, wage: { blacksmith: 0, apprentice: 4 } },
    tavern: { label: 'Tavern', jobs: [['innkeeper', 1], ['server', 1], ['cook', 1]], hours: [11, 24], recipes: [{ out: { meal: 4 }, inp: { bread: 1, cabbage: 1, firewood: 0.3 } }, { out: { ale: 5 }, inp: { wheat: 1 } }], sells: ['meal', 'ale'], buys: { bread: 'bakery', cabbage: 'farmhouse|import', wheat: 'farmhouse|import', firewood: 'woodcutter|store|import' }, targets: { bread: 12, cabbage: 12, wheat: 10, firewood: 8, meal: 20, ale: 30 }, wage: { innkeeper: 0, server: 6, cook: 7 } },
    store: { label: 'General Store', jobs: [['shopkeeper', 1]], hours: [8, 18], recipes: [], sells: ['cabbage', 'firewood', 'flour', 'fish'], buys: { cabbage: 'farmhouse|import', firewood: 'woodcutter|import', flour: 'mill', fish: 'fishery|none' }, targets: { cabbage: 30, firewood: 30, flour: 10, fish: 12 }, wage: { shopkeeper: 0 } },
    doctor: { label: "Physician's", jobs: [['physician', 1], ['herbalist', 1], ['bearer', 2]], hours: [8, 17], recipes: [{ out: { herbs: 1.2 }, inp: {}, role: 'herbalist' }, { out: { medicine: 0.4 }, inp: { herbs: 0.5 }, role: 'physician' }], sells: ['medicine', 'herbs'], targets: { herbs: 10, medicine: 8 }, wage: { physician: 0, herbalist: 6, bearer: 4 } },
    guard: { label: 'Watch House', jobs: [['guard captain', 1], ['guard', 3], ['sweeper', 1], ['tax collector', 1]], hours: [0, 24], recipes: [], sells: [], targets: {}, public: true, wage: { 'guard captain': 9, guard: 6, sweeper: 3, 'tax collector': 4 } },
    morgue: { label: 'Morgue', jobs: [['undertaker', 2]], hours: [0, 24], recipes: [], sells: [], targets: {}, public: true, wage: { undertaker: 3 } },
    stable: { label: 'Stables', jobs: [['horse trader', 1], ['stablehand', 1]], hours: [7, 19], recipes: [], sells: [], buys: { wheat: 'farmhouse' }, targets: { wheat: 12 }, wage: { 'horse trader': 0, stablehand: 5 } },
    fishery: { label: 'Fishery', jobs: [['fisher', 3]], hours: [5, 15], recipes: [{ out: { fish: 4 }, inp: {} }], sells: ['fish'], targets: { fish: 40 }, wage: { fisher: 6 } },
    mine: { label: 'Mine', jobs: [['mine foreman', 1], ['miner', 4]], hours: [6, 17], recipes: [{ out: { iron: 0.8, stone: 1 }, inp: {} }], sells: ['iron', 'stone'], targets: { iron: 40, stone: 30 }, wage: { 'mine foreman': 0, miner: 7 } },
    sawmill: { label: 'Sawmill', jobs: [['sawyer', 1], ['labourer', 2]], hours: [7, 17], recipes: [{ out: { planks: 1.6 }, inp: { logs: 1 } }], sells: ['planks'], buys: { logs: 'woodcutter|import' }, targets: { logs: 20, planks: 30 }, wage: { sawyer: 0, labourer: 6 } },
    quarry: { label: 'Quarry', jobs: [['quarry master', 1], ['quarryman', 3]], hours: [6, 17], recipes: [{ out: { stone: 1.5 }, inp: {} }], sells: ['stone'], targets: { stone: 40 }, wage: { 'quarry master': 0, quarryman: 7 } },
    butcher: { label: 'Butcher', jobs: [['butcher', 1], ['apprentice', 1]], hours: [6, 16], recipes: [{ out: { meat: 3 }, inp: {} }], sells: ['meat'], targets: { meat: 30 }, wage: { butcher: 0, apprentice: 4 } },
    jeweller: { label: 'Jeweller', jobs: [['jeweller', 1], ['night watchman', 1]], hours: [9, 17], recipes: [{ out: { ring: 0.05, brooch: 0.06 }, inp: {}, role: 'jeweller' }], sells: ['ring', 'brooch'], targets: { ring: 6, brooch: 5 }, wage: { jeweller: 0, 'night watchman': 7 }, security: 0.9 },
    apothecary: { label: 'Apothecary', jobs: [['apothecary', 1]], hours: [8, 18], recipes: [{ out: { medicine: 0.5, herbs: 0.6 }, inp: {} }], sells: ['medicine', 'herbs'], targets: { medicine: 12, herbs: 12 }, wage: { apothecary: 0 } },
    carpenter: { label: 'Carpenter', jobs: [['carpenter', 1], ['apprentice', 1]], hours: [7, 17], recipes: [{ out: { furniture: 0.25 }, inp: { planks: 0.5 } }], sells: ['furniture'], buys: { planks: 'sawmill|builder|import' }, targets: { planks: 10, furniture: 6 }, wage: { carpenter: 0, apprentice: 4 } },
    armourer: { label: 'Armourer', jobs: [['armourer', 1]], hours: [7, 17], recipes: [{ out: { helm: 0.08, sword: 0.04 }, inp: { iron: 0.3 } }], sells: ['helm', 'sword'], buys: { iron: 'mine|import' }, targets: { iron: 10, helm: 4, sword: 2 }, wage: { armourer: 0 } },
    warehouse: { label: 'Warehouse', jobs: [['warehouse master', 1], ['warehouse worker', 2]], hours: [6, 18], recipes: [], sells: ['cloth', 'wheat', 'iron'], targets: { cloth: 30, wheat: 80, iron: 20 }, wage: { 'warehouse master': 0, 'warehouse worker': 6, docker: 8 }, security: 0.6 },
    townhall: { label: 'Town Hall', jobs: [['magistrate', 1], ['clerk', 2]], hours: [8, 17], recipes: [], sells: [], targets: {}, public: true, wage: { magistrate: 14, clerk: 7 }, security: 0.7 },
    hospital: { label: 'Hospital', jobs: [['physician', 2], ['nurse', 2], ['bearer', 4]], hours: [0, 24], recipes: [{ out: { medicine: 0.4 }, inp: {} }], sells: ['medicine'], targets: { medicine: 20 }, public: true, wage: { physician: 12, nurse: 6, bearer: 5 } },
    school: { label: 'School', jobs: [['teacher', 1]], hours: [8, 15], recipes: [], sells: [], targets: {}, public: true, wage: { teacher: 7 } },
    keep: { label: 'Castle household', jobs: [['steward', 1], ['cook', 1], ['maid', 2], ['groom', 1]], hours: [6, 21], recipes: [{ out: { meal: 3 }, inp: { bread: 1, cabbage: 1, firewood: 0.3 }, role: 'cook' }], sells: [], buys: { bread: 'bakery|import', cabbage: 'farmhouse|import', firewood: 'woodcutter|store|import' }, targets: { bread: 10, cabbage: 10, firewood: 8, meal: 12 }, wage: { steward: 9, cook: 7, maid: 5, groom: 5 }, security: 0.8 },
    palace: { label: 'Royal household', jobs: [['chamberlain', 1], ['lady-in-waiting', 2], ['maid', 4], ['page', 2], ['groom', 2]], hours: [6, 22], recipes: [], sells: [], targets: {}, wage: { chamberlain: 12, 'lady-in-waiting': 8, maid: 5, page: 3, groom: 5 }, security: 0.95 },
    kitchen: { label: 'Royal Kitchens', jobs: [['master cook', 1], ['cook', 2], ['scullion', 2]], hours: [5, 21], recipes: [{ out: { meal: 6 }, inp: { bread: 1, cabbage: 1, meat: 0.5, firewood: 0.4 } }], sells: ['meal'], buys: { bread: 'bakery|import', cabbage: 'farmhouse|import', meat: 'butcher|import', firewood: 'woodcutter|store|import' }, targets: { bread: 20, cabbage: 20, meat: 10, firewood: 12, meal: 30 }, wage: { 'master cook': 9, cook: 7, scullion: 4 } },
    chapel: { label: 'Chapel', jobs: [['priest', 1], ['parish clerk', 1]], hours: [6, 20], recipes: [], sells: [], targets: {}, public: true, wage: { priest: 6, 'parish clerk': 3 } },
  };

  // Which sprite outfit a trade wears.
  const ROLE_OUTFIT = {
    farmer: 'farmer', farmhand: 'farmhand', miller: 'miller', labourer: 'villager', baker: 'baker', apprentice: 'villager', woodcutter: 'woodcutter',
    blacksmith: 'blacksmith', innkeeper: 'innkeeper', server: 'innkeeper', cook: 'baker', shopkeeper: 'merchant', physician: 'doctor', assistant: 'villager',
    bearer: 'bearer', undertaker: 'undertaker', sweeper: 'sweeper', 'tax collector': 'courier', 'parish clerk': 'merchant',
    steward: 'merchant', maid: 'servant', groom: 'farmhand', chamberlain: 'noble', 'lady-in-waiting': 'noble', page: 'servant', 'master cook': 'baker', scullion: 'servant',
    'guard captain': 'guard', guard: 'guard', priest: 'priest', herbalist: 'farmhand', butcher: 'baker', jeweller: 'merchant', 'night watchman': 'guard', apothecary: 'doctor', carpenter: 'woodcutter', armourer: 'blacksmith', 'warehouse master': 'merchant', 'warehouse worker': 'villager', docker: 'villager', sawyer: 'woodcutter', 'quarry master': 'woodcutter', quarryman: 'woodcutter', magistrate: 'noble', clerk: 'merchant', nurse: 'villager', teacher: 'priest', fisher: 'fisher', miner: 'woodcutter', 'mine foreman': 'woodcutter', 'horse trader': 'merchant', stablehand: 'farmhand', porter: 'villager', trader: 'merchant',
  };

  const NAMES = {
    m: ['Adam', 'Alan', 'Aldous', 'Baldwin', 'Bartholomew', 'Bennet', 'Cuthbert', 'Edmund', 'Edric', 'Geoffrey', 'Gilbert', 'Godwin', 'Hamon', 'Henry', 'Hob', 'Hugh', 'Jack', 'John', 'Lambert', 'Martin', 'Nicholas', 'Odo', 'Osbert', 'Peter', 'Ralph', 'Reynold', 'Richard', 'Robert', 'Roger', 'Simon', 'Stephen', 'Thomas', 'Walter', 'Wat', 'William', 'Wulfric'],
    f: ['Agnes', 'Alice', 'Alys', 'Amice', 'Avice', 'Beatrice', 'Cecily', 'Christina', 'Edith', 'Eleanor', 'Ellen', 'Emma', 'Isabel', 'Joan', 'Juliana', 'Lettice', 'Mabel', 'Margery', 'Matilda', 'Maud', 'Petronella', 'Rose', 'Sybil', 'Tiffany', 'Wymarc'],
    sur: ['Abbot', 'Ashby', 'Baker', 'Barker', 'Brewer', 'Carter', 'Cooper', 'Dyer', 'Fisher', 'Fletcher', 'Fuller', 'Gardner', 'Hale', 'Hayward', 'Hobb', 'Kemp', 'Marsh', 'Miller', 'Norris', 'Page', 'Reeve', 'Saddler', 'Smith', 'Swift', 'Thatcher', 'Turner', 'Wainwright', 'Ward', 'Webb', 'Wood'],
  };

  const TRAITS = [['brave', 'cowardly'], ['greedy', 'generous'], ['ambitious', 'lazy'], ['loyal', 'suspicious'], ['social', 'introverted'], ['curious', 'cautious'], ['risk-taking', 'patient'], ['friendly', 'hostile'], ['impatient', 'patient']];

  const GOALS = ['buy a bigger house', 'become a master', 'open a shop', 'save a tidy sum', 'move to the capital', 'marry', 'see the children settled', 'retire in comfort', 'pay off debts', 'escape poverty', 'become guard captain'];

  O.Data = { GOODS, BUSINESS, ROLE_OUTFIT, NAMES, TRAITS, GOALS };
})();
