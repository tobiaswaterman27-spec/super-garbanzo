// Static simulation data: goods, trades, names, personality traits.
'use strict';
(function () {
  // Base prices in pennies (d). 12d = 1 shilling.
  const GOODS = {
    wheat: { name: 'Wheat', base: 2, unit: 'bushel', slots: 1 },
    flour: { name: 'Flour', base: 4, unit: 'sack', slots: 1 },
    bread: { name: 'Bread', base: 2, unit: 'loaf', slots: 1, food: 1 },
    cabbage: { name: 'Cabbage', base: 1, unit: 'head', slots: 1, food: 0.6 },
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
  };

  // Business definitions: roles (job slots), hours, recipes (per worker-hour at skill 1),
  // what they sell to the public and what they keep in stock.
  const BUSINESS = {
    farmhouse: { label: 'Farm', jobs: [['farmer', 1], ['farmhand', 2]], hours: [6, 18], recipes: [{ out: { wheat: 4.5, cabbage: 2 }, inp: {} }], sells: ['cabbage', 'wheat'], buys: { tools: 'smithy' }, targets: { wheat: 60, cabbage: 40, tools: 3 }, wage: { farmer: 0, farmhand: 6 } },
    mill: { label: 'Mill', jobs: [['miller', 1], ['labourer', 1]], hours: [7, 17], recipes: [{ out: { flour: 2 }, inp: { wheat: 2 } }], sells: ['flour'], buys: { wheat: 'farmhouse' }, targets: { wheat: 40, flour: 40 }, wage: { miller: 0, labourer: 6 } },
    bakery: { label: 'Bakery', jobs: [['baker', 1], ['apprentice', 1]], hours: [5, 17], recipes: [{ out: { bread: 6 }, inp: { flour: 2, firewood: 0.5 } }], sells: ['bread'], buys: { flour: 'mill', firewood: 'woodcutter' }, targets: { flour: 30, firewood: 10, bread: 60 }, wage: { baker: 0, apprentice: 4 } },
    woodcutter: { label: "Woodcutter's", jobs: [['woodcutter', 2]], hours: [7, 17], recipes: [{ out: { logs: 1.5, firewood: 5 }, inp: {} }], sells: ['firewood', 'logs'], buys: { tools: 'smithy' }, targets: { firewood: 40, logs: 20, tools: 2 }, wage: { woodcutter: 7 } },
    smithy: { label: 'Smithy', jobs: [['blacksmith', 1], ['apprentice', 1]], hours: [7, 18], recipes: [{ out: { tools: 0.25 }, inp: { iron: 0.5, firewood: 0.5 } }, { out: { dagger: 0.06, axe: 0.04 }, inp: { iron: 0.15, firewood: 0.1 }, role: 'blacksmith' }], sells: ['tools', 'dagger', 'axe'], buys: { firewood: 'woodcutter', iron: 'import' }, targets: { iron: 10, firewood: 10, tools: 6, dagger: 3, axe: 2 }, wage: { blacksmith: 0, apprentice: 4 } },
    tavern: { label: 'Tavern', jobs: [['innkeeper', 1], ['server', 1], ['cook', 1]], hours: [11, 24], recipes: [{ out: { meal: 4 }, inp: { bread: 1, cabbage: 1, firewood: 0.3 } }, { out: { ale: 5 }, inp: { wheat: 1 } }], sells: ['meal', 'ale'], buys: { bread: 'bakery', cabbage: 'farmhouse', wheat: 'farmhouse', firewood: 'woodcutter' }, targets: { bread: 12, cabbage: 12, wheat: 10, firewood: 8, meal: 20, ale: 30 }, wage: { innkeeper: 0, server: 6, cook: 7 } },
    store: { label: 'General Store', jobs: [['shopkeeper', 1]], hours: [8, 18], recipes: [], sells: ['cabbage', 'firewood', 'flour'], buys: { cabbage: 'farmhouse', firewood: 'woodcutter', flour: 'mill' }, targets: { cabbage: 30, firewood: 30, flour: 10 }, wage: { shopkeeper: 0 } },
    doctor: { label: "Physician's", jobs: [['physician', 1], ['herbalist', 1]], hours: [8, 17], recipes: [{ out: { herbs: 1.2 }, inp: {}, role: 'herbalist' }, { out: { medicine: 0.4 }, inp: { herbs: 0.5 }, role: 'physician' }], sells: ['medicine', 'herbs'], targets: { herbs: 10, medicine: 8 }, wage: { physician: 0, herbalist: 6 } },
    guard: { label: 'Watch House', jobs: [['guard captain', 1], ['guard', 3]], hours: [0, 24], recipes: [], sells: [], targets: {}, public: true, wage: { 'guard captain': 12, guard: 8 } },
    chapel: { label: 'Chapel', jobs: [['priest', 1]], hours: [6, 20], recipes: [], sells: [], targets: {}, public: true, wage: { priest: 6 } },
  };

  // Which sprite outfit a trade wears.
  const ROLE_OUTFIT = {
    farmer: 'farmer', farmhand: 'farmhand', miller: 'miller', labourer: 'villager', baker: 'baker', apprentice: 'villager', woodcutter: 'woodcutter',
    blacksmith: 'blacksmith', innkeeper: 'innkeeper', server: 'innkeeper', cook: 'baker', shopkeeper: 'merchant', physician: 'doctor', assistant: 'villager',
    'guard captain': 'guard', guard: 'guard', priest: 'priest', herbalist: 'farmhand', porter: 'villager', trader: 'merchant',
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
