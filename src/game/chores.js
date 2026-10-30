// The small duties of every trade, besides its main work: the smith shoes a horse and quenches the
// tongs, the baker scrapes the oven, the maid turns the mattresses. Each day a post gets one or two of
// them, done at a piece of furniture inside, on the open floor, or outside the door, each with its
// own action and what comes of it.
'use strict';
(function () {
  // [text, where, action, minutes, done, gain]: where is furniture kinds ('a|b'), 'floor' or 'out';
  // gain is { cash }, { good, qty } or { cond } (the building's repair)
  const C = {
    abbot: [['Lead the brothers at prayer', 'altar|pew', 'pray', 20, 'The office is sung.'], ['Hear the brothers\' faults in chapter', 'chair|bench|desk', 'read', 15, 'Penances given, and kindly.'], ['Go over the abbey\'s accounts', 'desk', 'count', 15, 'The wool money is in.']],
    prioress: [['Lead the sisters at prayer', 'altar|pew', 'pray', 20, 'The office is sung.'], ['Hear the sisters in chapter', 'chair|bench|desk', 'read', 15, 'All is well in the house.'], ['Go over the priory\'s accounts', 'desk', 'count', 15, 'The rents are in.']],
    monk: [['Sing the office in choir', 'pew|altar', 'pray', 20, 'Lauds, and then a little bread.'], ['Copy a page of the gospels', 'desk', 'write', 25, 'One page, and not a blot.'], ['Tend the herb garden', 'out', 'hoe', 20, 'Sage, rue and hyssop, weeded.'], ['Ring for the hours', 'out|floor', 'stretch', 10, 'The bell carries over the fields.']],
    nun: [['Sing the office in choir', 'pew|altar', 'pray', 20, 'Vespers, and quiet.'], ['Embroider an altar cloth', 'desk|chair|bench', 'weave', 25, 'Gold thread on white linen.'], ['Physic the sick at the gate', 'out', 'crouch', 15, 'A poultice and a prayer.'], ['Copy a psalter', 'desk', 'write', 25, 'Neat, and gilt at the capitals.']],
    'lay brother': [['Brew the abbey ale', 'barrel|cauldron', 'mix', 25, 'It will be good by Sunday.'], ['Work the abbey fields', 'out', 'hoe', 25, 'The furrows are straight.'], ['Feed the poor at the gate', 'out', 'place', 15, 'Bread and pottage for all who came.']],
    'lay sister': [['Make the cheese', 'table|counter', 'knead', 20, 'Pressed and salted.'], ['Feed the hens', 'out', 'pickup', 10, 'A basket of eggs.'], ['Wash the house linen', 'washtub|out', 'scrub', 20, 'On the line to dry.']],
    'harbour master': [['Take the dues of a ship in', 'counter|desk', 'count', 15, 'Paid in full, and written down.', { cash: 3 }], ['Walk the quay', 'out', 'look', 15, 'Every ship moored fast.'], ['Write up the tide table', 'desk', 'write', 10, 'High water at noon.']],
    shipwright: [['Caulk a seam with pitch and oakum', 'out|workbench', 'hammer', 25, 'Tight as a drum.'], ['Shape a new rib', 'workbench|out', 'saw', 25, 'A fine curve of oak.'], ['Check the rigging', 'out', 'look', 15, 'One shroud to replace.']],
    sailor: [['Coil the ropes on the quay', 'out', 'carry', 10, 'Neat as a knot.'], ['Mend a sail', 'table|out', 'weave', 20, 'Stitched with a palm and needle.'], ['Unload a hold', 'crate|barrel|out', 'carry', 25, 'The hold is empty, your back is not.', { cash: 2 }]],
    shepherd: [['Count the flock into the fold', 'out', 'count', 15, 'All there, and the gate shut.'], ['Look over a lame ewe', 'out', 'look', 15, 'A thorn in the hoof, out now.'], ['Mend a gap in the hurdles', 'out', 'hammer', 20, 'No way through for a lamb.'], ['Shear a fleece', 'out', 'scrub', 25, 'A good fleece, rolled and tied.', { good: 'wool', qty: 1 }]],
    dairymaid: [['Milk the cows', 'out', 'bucket', 20, 'Two pails, frothing.'], ['Churn the butter', 'churn|table|counter', 'mix', 25, 'It has come, yellow and firm.', { cash: 2 }], ['Scald the pails and the churn', 'washtub|table|floor', 'scrub', 10, 'Sweet and clean.'], ['Press the curd for cheese', 'table|counter', 'knead', 20, 'Into the press, and weighted.', { good: 'cheese', qty: 1 }]],
    chambermaid: [['Change the sheets in the guest beds', 'bed|double', 'scrub', 15, 'Fresh linen on every bed.'], ['Empty and scour the chamber pots', 'floor', 'bucket', 10, 'Done, and best not spoken of.'], ['Sweep and air the rooms', 'floor', 'sweep', 15, 'The windows open, the rushes fresh.']],
    midwife: [['Call on a woman near her time', 'out', 'look', 20, 'Not long now, by the look of her.'], ['Make up a birthing posset', 'table|cauldron|fireplace', 'mix', 15, 'Warm and sweet with honey.'], ['Wash and fold the swaddling bands', 'washtub|table', 'scrub', 10, 'Clean and ready.']],
    sergeant: [['Drill the watch in the yard', 'out', 'attack', 20, 'They hold their staves straighter now.'], ['Write up the night\'s doings', 'desk|table', 'write', 15, 'All set down.'], ['Check the cell locks', 'cell|chest|door', 'open', 10, 'Every lock fast.']],
    'bounty hunter': [['Study the notices on the board', 'out', 'read', 10, 'Three faces, three prices.'], ['Oil and check your manacles', 'chest|table|bench', 'scrub', 10, 'They close with a good snap.'], ['Ask at the tavern door after strangers', 'out', 'look', 15, 'A name, and a road.']],
    'rat-catcher': [['Set traps along the walls', 'floor', 'place', 15, 'Baited and set.'], ['Empty the traps', 'floor', 'pickup', 10, 'A good haul, if you like rats.'], ['Walk your terrier round the yards', 'out', 'look', 15, 'Two caught, one got away.']],
    lamplighter: [['Trim the wicks', 'candlestand|lamp|table', 'scrub', 10, 'Trimmed straight.'], ['Fill the oil and refill the tallow', 'barrel|shelf|table', 'pour', 10, 'Enough for the night.'], ['Mend a cracked lantern', 'workbench|table', 'hammer', 15, 'Good as new.']],
    'chimney sweep': [['Sweep a kitchen flue', 'fireplace|oven', 'sweep', 25, 'Soot everywhere, but the flue draws.', { cash: 2 }], ['Shake out the sacks of soot', 'out', 'sweep', 10, 'A black cloud on the wind.'], ['Mend your brushes', 'bench|table', 'weave', 10, 'Bristles tight again.']],
    'water carrier': [['Fill the buckets at the well', 'out', 'bucket', 15, 'Two brimming buckets.'], ['Carry water to a house', 'out', 'carry', 15, 'Delivered, and a coin for it.', { cash: 1 }], ['Mend the yoke strap', 'bench|table', 'hammer', 10, 'It holds.']],
    'ballot clerk': [['Count the ballots', 'desk|table', 'count', 20, 'Counted twice, and tallies.'], ['Write up the roll of voters', 'desk', 'write', 15, 'Every name in its place.']],
    squire: [['Polish your knight\'s armour', 'rack|chest|bench', 'scrub', 20, 'It shines like a mirror.'], ['Practise at the quintain', 'out', 'attack', 20, 'You only took one knock.'], ['Saddle the destrier', 'out|hay', 'place', 15, 'Girth tight, stirrups even.']],
    falconer: [['Fly the hawks', 'out', 'look', 20, 'She comes back to the glove.'], ['Feed the mews', 'perch|table|out', 'pickup', 10, 'Fed and hooded.'], ['Mend a jess', 'table|bench', 'weave', 10, 'Supple and strong.']],
    knight: [['Train at arms', 'out', 'attack', 25, 'Sweat and bruises, and better for it.'], ['Ride out to look over the lands', 'out', 'look', 20, 'All quiet on the bounds.'], ['Hear a tenant\'s complaint', 'chair|desk|table', 'read', 15, 'Settled, more or less.']],
    herald: [['Learn the new arms by heart', 'desk|table', 'read', 15, 'Or and azure, a lion rampant.'], ['Cry the proclamation in the square', 'out', 'look', 15, 'Heard by all the market.'], ['Copy out the roll of arms', 'desk', 'write', 20, 'Neat, every blazon.']],
    'master of horse': [['Look over the stud', 'out|hay', 'look', 20, 'A fine foal on the way.'], ['Choose horses for the hunt', 'out', 'count', 15, 'Six ready and fresh.'], ['Check the farrier\'s bill', 'desk|table', 'count', 10, 'Dear, but fair.']],
    'royal guard': [['Stand to at the door', 'floor|door', 'look', 20, 'Nobody passes.'], ['Burnish your halberd', 'rack|bench', 'scrub', 10, 'A blade like glass.'], ['Change the watch', 'floor', 'look', 10, 'Relieved, and relieving.']],
    'captain of the royal guard': [['Check the castle keys', 'chest|desk', 'count', 10, 'Every key on its hook.'], ['Write the night\'s orders', 'desk|table', 'write', 15, 'Orders given.']],
    jester: [['Practise juggling', 'floor|out', 'gesture', 15, 'Three balls, then four.'], ['Learn a new song for supper', 'chair|bench', 'read', 15, 'A rude one, too.'], ['Mend your bells and motley', 'chair|table', 'weave', 10, 'Jingling again.']],
    executioner: [['Whet the axe', 'workbench|table|out', 'scrub', 15, 'Keen enough to split a hair.'], ['Mend the scaffold steps', 'out', 'hammer', 20, 'Sound under any weight.']],
    spy: [['Listen at the tavern', 'table|bench|out', 'look', 20, 'A name, and a meeting.'], ['Write up what you heard, in cipher', 'desk|table', 'write', 15, 'Folded small.'], ['Follow a stranger at a distance', 'out', 'look', 15, 'You know where they sleep.']],
    gravedigger: [['Dig a grave', 'out', 'pitch', 30, 'Six feet, and square.', { cash: 2 }], ['Trim the churchyard grass', 'out', 'sweep', 15, 'Neat round every stone.'], ['Sharpen the spade', 'workbench|out', 'scrub', 10, 'It bites clean.']],
    'bell-ringer': [['Ring the hours', 'out|floor', 'stretch', 10, 'The bell carries over the roofs.'], ['Grease the bell wheel', 'floor|out', 'scrub', 15, 'It swings sweet.'], ['Mend the bell rope', 'bench|table', 'weave', 10, 'Spliced and sound.']],
    'pilgrim guide': [['Tell the saint\'s story at the shrine', 'altar|pew', 'read', 15, 'Every pilgrim weeps at the end.'], ['Sell pilgrim badges', 'counter|table', 'count', 10, 'Lead badges, a penny each.', { cash: 2 }]],
    thatcher: [['Bind bundles of reed', 'out', 'weave', 20, 'A stack of yealms.'], ['Patch a leaking roof', 'out', 'hammer', 25, 'Dry again, under the eaves.', { cond: 0.03 }], ['Sharpen the shearing hook', 'workbench|out', 'scrub', 10, 'Keen.']],
    plasterer: [['Mix the daub', 'out|floor', 'mix', 20, 'Clay, dung and straw, just right.'], ['Patch a cracked wall', 'out', 'scrub', 20, 'Smooth as cream.', { cond: 0.03 }], ['Limewash a wall', 'out', 'scrub', 15, 'Bright white.']],
    roofer: [['Hang new slates', 'out', 'hammer', 25, 'Tight and true.', { cond: 0.03 }], ['Check the ridge tiles', 'out', 'look', 15, 'One loose, fixed now.'], ['Cut slates to size', 'workbench|out', 'hammer', 15, 'A neat pile.']],
    bailiff: [['Serve a summons', 'out', 'look', 15, 'Delivered, with a scowl.'], ['Take an inventory of goods for a debt', 'chest|shelf|table', 'count', 20, 'Every pot written down.'], ['Write up the distraint', 'desk|table', 'write', 15, 'Signed and sealed.']],
    farmer: [['Mend the plough harness', 'workbench|chest|out', 'hammer', 20, 'The harness will hold another season.'], ['Count the beasts in the paddock', 'out', 'count', 15, 'All present, and none lame.'], ['Sharpen the scythes and sickles', 'out|workbench', 'scrub', 15, 'They take a hair off your arm now.'], ['Muck out the byre', 'out', 'pitch', 25, 'The muck is on the heap and the byre is sweet.', { good: 'cabbage', qty: 1 }]],
    farmhand: [['Fork hay into the racks', 'out|hay', 'pitch', 20, 'The racks are full.'], ['Carry water to the troughs', 'out', 'bucket', 15, 'The troughs are brimming.'], ['Gather the eggs', 'out', 'pickup', 10, 'A basket of eggs, still warm.', { good: 'eggs', qty: 2 }], ['Clear stones from the strips', 'out', 'pickup', 20, 'A cairn of stones at the headland.']],
    miller: [['Dress the millstones', 'millstone', 'hammer', 30, 'The furrows are cut sharp again.'], ['Grease the gears', 'millstone|out', 'scrub', 15, 'The wheel turns without a squeal.'], ['Weigh the sacks for the toll', 'sack|counter|millstone', 'count', 15, 'The miller\'s toll is taken fair.', { cash: 2 }]],
    labourer: [['Shift the sacks to the loft', 'sack|crate|floor', 'carry', 20, 'Your back knows it.'], ['Clear the yard', 'out', 'sweep', 15, 'The yard is clear.'], ['Stack the barrels', 'barrel|crate|floor', 'carry', 15, 'Stacked, and none rolling.']],
    baker: [['Scrape out the oven', 'oven', 'scrub', 15, 'The ash is out and the floor of the oven is clean.'], ['Set the leaven for tomorrow', 'doughtable', 'knead', 15, 'The leaven is fed and covered.'], ['Bake a batch of pies to order', 'oven|doughtable', 'knead', 30, 'A batch of pies, crimped and golden.', { cash: 4 }]],
    apprentice: [['Fetch and carry for the master', 'floor', 'carry', 15, 'Fetched and carried.'], ['Sweep the shavings and scraps', 'floor', 'sweep', 10, 'Swept.'], ['Watch the master at the bench and learn', 'workbench|anvil|doughtable|loom|counter|desk', 'look', 20, 'You pick up a trick or two.']],
    blacksmith: [['Shoe a horse', 'out|anvil', 'hammer', 30, 'Four shoes on, and the horse walks sound.', { cash: 4 }], ['Quench and temper the tongs', 'forge|anvil', 'hammer', 15, 'They ring true.'], ['Mend a cooking pot for a neighbour', 'anvil', 'hammer', 20, 'Patched and riveted.', { cash: 2 }]],
    armourer: [['Rivet a hauberk', 'anvil|workbench', 'hammer', 30, 'Ring by ring, mended.', { cash: 3 }], ['Scour the rust off the stock', 'rack|workbench|anvil', 'scrub', 20, 'Bright as new.'], ['Fit a helm to a customer', 'counter|anvil', 'place', 15, 'It sits snug.', { cash: 2 }]],
    innkeeper: [['Tap a fresh barrel', 'barrel|bar|counter', 'pour', 10, 'Clear, and a good head on it.'], ['Count the takings', 'bar|counter|desk', 'count', 10, 'The takings tally.'], ['Chalk up the slates of those who owe', 'bar|counter', 'write', 10, 'Every debt on the slate.']],
    server: [['Wipe down the tables', 'table|longtable', 'scrub', 10, 'The tables are clean.'], ['Lay fresh rushes', 'floor', 'sweep', 10, 'Fresh rushes, and the old ones out.'], ['Carry up the ale from the cellar', 'barrel|bar|floor', 'carry', 15, 'Up the steps, and not a drop spilled.']],
    cook: [['Scour the cauldron', 'cauldron|fireplace|oven', 'scrub', 15, 'Scoured to the iron.'], ['Pluck and draw the fowl', 'butcherblock|table|counter', 'cleave', 20, 'Ready for the spit.'], ['Skim the stockpot', 'cauldron|fireplace', 'mix', 10, 'The stock runs clear.'], ['Put up the day\'s pottage', 'cauldron|fireplace|oven', 'mix', 20, 'A pot of pottage for anyone hungry.', { good: 'meal', qty: 1 }]],
    'master cook': [['Taste every pot in the kitchen', 'cauldron|fireplace|oven', 'mix', 15, 'More salt in the second one.'], ['Plan the feast with the steward', 'desk|table', 'write', 20, 'The bill of fare is written.'], ['Check the larder', 'shelf|cupboard|barrel|sack', 'look', 10, 'Nothing has turned.']],
    scullion: [['Scrub the trenchers', 'washtub|table|counter', 'scrub', 15, 'A stack of clean trenchers.'], ['Turn the spit', 'fireplace|cauldron', 'mix', 20, 'The roast browns even.'], ['Carry out the slops', 'floor', 'bucket', 10, 'Out with the slops.']],
    maid: [['Turn and air the mattresses', 'bed|double', 'scrub', 15, 'The beds are made and turned.'], ['Polish the candlesticks', 'candlestand|table|shelf', 'scrub', 10, 'They shine.'], ['Beat the rugs', 'rug|floor', 'sweep', 15, 'Clouds of dust, and clean rugs.'], ['Empty the chamber pots', 'bed|double|floor', 'bucket', 10, 'Done, and best not spoken of.']],
    laundress: [['Wash the linen', 'washtub', 'scrub', 25, 'The linen is on the line.', { cash: 2 }], ['Starch and press the ruffs', 'table|washtub', 'scrub', 15, 'Crisp.'], ['Mend the torn sheets', 'table|chair', 'weave', 20, 'Darned.']],
    butler: [['Count the plate', 'cupboard|dresser|shelf|chest', 'count', 15, 'Every spoon is here.'], ['Decant the wine for supper', 'barrel|table', 'pour', 10, 'Decanted and breathing.'], ['Set the high table', 'longtable|table', 'place', 15, 'Laid to perfection.']],
    steward: [['Check the stores against the book', 'shelf|barrel|sack|chest', 'count', 20, 'The book and the stores agree.'], ['Pay the household its wages', 'desk|table', 'count', 15, 'The wages are paid.'], ['Write to the tenants about the rents', 'desk', 'write', 20, 'Letters sealed and sent.']],
    chamberlain: [['Inspect the royal chambers', 'bed|double|wardrobe', 'look', 15, 'All in order for the night.'], ['Lock up the strongroom', 'chest|cupboard', 'open', 10, 'Locked, and the key on your belt.']],
    'lady-in-waiting': [['Lay out the gowns for the evening', 'wardrobe|chest|bed', 'place', 15, 'The gowns are laid out.'], ['Read aloud in the solar', 'chair|bench', 'read', 20, 'A chapter of romance, and sighs.'], ['Embroider an altar cloth', 'chair|bench|table', 'weave', 25, 'Another flower in silk.']],
    page: [['Carry a message across the castle', 'floor', 'carry', 10, 'Delivered.'], ['Polish your master\'s boots and spurs', 'chair|bench|chest', 'scrub', 10, 'They gleam.'], ['Practise with the wooden sword', 'out|floor', 'attack', 15, 'Your arm aches.']],
    groom: [['Groom the horses', 'out|hay', 'scrub', 20, 'Coats like silk.'], ['Clean and oil the tack', 'rack|chest|workbench|hay', 'scrub', 15, 'Supple leather.'], ['Walk a lame horse', 'out', 'look', 15, 'Better by the end.']],
    stablehand: [['Fill the hay racks', 'hay|out', 'pitch', 15, 'Full.'], ['Pick out the hooves', 'out|hay', 'crouch', 15, 'Clean hooves, sound horses.'], ['Carry water to the stalls', 'out|floor', 'bucket', 15, 'Every bucket full.']],
    guard: [['Stand at the gate and check who passes', 'out', 'look', 20, 'Nobody gets by you.'], ['Oil your mail', 'rack|chest|bench', 'scrub', 10, 'Your mail will not rust.'], ['Drill at the pell', 'out', 'attack', 15, 'You hack a post to splinters.']],
    'guard captain': [['Inspect the weapons rack', 'rack|chest', 'look', 10, 'Two blades want sharpening.'], ['Write the watch roll', 'desk|table', 'write', 15, 'The watches are set.']],
    'night watchman': [['Check the doors are barred', 'out', 'open', 15, 'All fast.'], ['Call the hour', 'out', 'point', 5, 'All is well.']],
    gaoler: [['Feed the prisoners', 'cell|table', 'place', 15, 'Bread and water for each.'], ['Check the locks and chains', 'cell', 'open', 10, 'All secure.']],
    turnkey: [['Walk the cells', 'cell', 'look', 10, 'Nobody digging.'], ['Sluice the cells', 'cell|floor', 'bucket', 15, 'Sluiced out.']],
    priest: [['Hear confession', 'altar|pew|bench', 'pray', 20, 'You hear a great deal and repeat none of it.'], ['Write the sermon', 'desk|altar', 'write', 20, 'A sermon on pride.'], ['Visit the sick of the parish', 'out', 'pray', 25, 'They are glad of you.'], ['Bless the fields', 'out', 'pray', 15, 'The fields are blessed.']],
    'parish clerk': [['Ring the bell for the hour', 'altar|floor', 'work', 5, 'The bell carries over the roofs.'], ['Enter the baptisms in the register', 'desk|altar', 'write', 15, 'Every name entered.'], ['Trim the candles', 'candlestand|altar', 'place', 10, 'All trimmed.']],
    teacher: [['Hear the children recite', 'desk|bench', 'read', 20, 'Most of them know it.'], ['Cut new quills', 'desk', 'write', 10, 'A bundle of sharp quills.'], ['Set copy for the slates', 'desk', 'write', 15, 'A good round hand to copy.']],
    physician: [['Read the waters', 'desk|medbed|table', 'look', 15, 'Murky, but hopeful.'], ['Let blood', 'medbed|bed|chair', 'cleave', 15, 'The humours are rebalanced, or so you hope.', { cash: 3 }], ['Write up the case book', 'desk', 'write', 15, 'Written up.']],
    nurse: [['Change the dressings', 'medbed|bed', 'place', 15, 'Clean linen on every wound.'], ['Boil the linen', 'cauldron|fireplace|washtub', 'mix', 15, 'Boiled clean.'], ['Spoon broth into the weak', 'medbed|bed', 'serve', 15, 'They take it.']],
    'barber-surgeon': [['Shave a customer', 'chair', 'scrub', 15, 'Smooth, and no blood.', { cash: 2 }], ['Pull a tooth', 'chair', 'cleave', 10, 'Out it comes, with a yell.', { cash: 2 }], ['Strop the razors', 'workbench|desk|counter|chair', 'scrub', 10, 'Keen.']],
    apothecary: [['Grind the simples', 'workbench|counter|desk|table', 'mix', 20, 'A jar of powder.', { good: 'remedy', qty: 1 }], ['Label the jars', 'shelf|counter', 'write', 10, 'Every jar labelled.'], ['Make up a prescription', 'counter|workbench', 'mix', 15, 'Made up, and paid for.', { cash: 3 }]],
    herbalist: [['Gather herbs in the hedgerows', 'out', 'pickup', 20, 'A basketful.', { good: 'herbs', qty: 2 }], ['Hang the herbs to dry', 'shelf|rack|table', 'place', 10, 'Bunches hanging from the beams.']],
    undertaker: [['Measure for a coffin', 'out|workbench', 'count', 15, 'Measured.'], ['Plane the coffin boards', 'workbench', 'saw', 25, 'Smooth boards.'], ['Dig a grave', 'out', 'dig', 30, 'Six feet down.', { cash: 3 }]],
    carpenter: [['Mend a cart wheel', 'workbench|out', 'hammer', 25, 'True and round again.', { cash: 3 }], ['Sharpen the chisels', 'workbench', 'scrub', 10, 'Keen.'], ['Hang a door for a neighbour', 'out', 'hammer', 25, 'It swings and shuts.', { cash: 3 }]],
    cooper: [['Shave the staves', 'workbench', 'saw', 20, 'A pile of staves.'], ['Drive the hoops on', 'workbench|barrel', 'hammer', 20, 'Tight and watertight.'], ['Mend a leaking tun', 'barrel|workbench', 'hammer', 15, 'It holds.', { cash: 2 }]],
    wainwright: [['Fit a new axle', 'workbench|out', 'hammer', 25, 'The cart rolls true.', { cash: 3 }], ['Steam and bend a felloe', 'workbench', 'saw', 20, 'Bent to the curve.']],
    sawyer: [['Saw a log into planks', 'workbench|out', 'saw', 25, 'A stack of planks.', { good: 'planks', qty: 1 }], ['Sharpen the saw', 'workbench', 'scrub', 10, 'Every tooth set.']],
    woodcutter: [['Split kindling', 'out|woodpile', 'chop', 15, 'A heap of kindling.', { good: 'firewood', qty: 2 }], ['Stack the cordwood', 'out|woodpile', 'carry', 15, 'Stacked to dry.'], ['Grind the axe', 'out|workbench', 'scrub', 10, 'Sharp enough to shave with.']],
    forester: [['Mark the trees for felling', 'out', 'hammer', 20, 'Each one blazed.'], ['Walk the bounds for poachers', 'out', 'look', 25, 'Snares cut, and no poacher caught.']],
    gamekeeper: [['Check the snares for poachers', 'out', 'crouch', 20, 'Two snares found and cut.'], ['Feed the pheasants', 'out', 'pickup', 15, 'They come running.']],
    gardener: [['Clip the hedges', 'out', 'shear', 25, 'Square and neat.'], ['Weed the beds', 'out', 'hoe', 20, 'Not a weed left.'], ['Prune the fruit trees', 'out', 'shear', 20, 'Pruned for a better crop.', { good: 'apples', qty: 1 }]],
    beekeeper: [['Smoke the hives and take the comb', 'out', 'crouch', 20, 'A frame of comb, and only one sting.', { good: 'honey', qty: 1 }], ['Weave a new skep', 'workbench|chair|out', 'weave', 25, 'A new straw hive.']],
    'vine-dresser': [['Tie in the vines', 'out', 'crouch', 20, 'Tied in.'], ['Prune the vines', 'out', 'shear', 20, 'Pruned hard.']],
    vintner: [['Rack the wine', 'barrel|vat', 'pour', 20, 'Off the lees, clear.'], ['Taste the new casks', 'barrel|vat', 'drink', 10, 'A good year.']],
    brewer: [['Stir the mash', 'vat|cauldron', 'mix', 20, 'Sweet wort.'], ['Scald the barrels', 'barrel|vat', 'scrub', 15, 'Clean, or the ale will sour.'], ['Pitch the yeast', 'vat', 'pour', 10, 'It will be working by morning.']],
    maltster: [['Turn the malt on the floor', 'floor', 'pitch', 20, 'Turned, and sprouting even.'], ['Fire the kiln', 'kiln|oven|fireplace', 'place', 15, 'The malt is drying.']],
    butcher: [['Joint a carcass', 'butcherblock', 'cleave', 25, 'Neatly jointed.', { good: 'meat', qty: 1 }], ['Make sausages', 'butcherblock|table', 'knead', 20, 'A string of sausages.', { good: 'sausage', qty: 1 }], ['Salt down the pork', 'barrel|butcherblock', 'mix', 15, 'It will keep the winter.']],
    tanner: [['Scrape the hides', 'out|workbench|vat', 'scrub', 25, 'The flesh side is clean.'], ['Turn the hides in the pits', 'vat|out', 'pitch', 20, 'Turned, and the stink with them.']],
    cobbler: [['Resole a pair of boots', 'workbench|counter', 'hammer', 20, 'Good for another year.', { cash: 2 }], ['Cut leather for uppers', 'workbench', 'cleave', 15, 'Cut to the last.']],
    saddler: [['Stitch a saddle', 'workbench', 'weave', 25, 'Stitch by stitch.'], ['Mend a bridle', 'workbench|counter', 'weave', 15, 'Mended.', { cash: 2 }]],
    tailor: [['Take a customer\'s measure', 'counter|floor', 'count', 15, 'Every inch written down.'], ['Cut cloth for a doublet', 'table|workbench|counter', 'cleave', 20, 'Cut, with little waste.'], ['Turn an old cloak', 'table|workbench|chair', 'weave', 20, 'It looks new.', { cash: 2 }]],
    weaver: [['Warp the loom', 'loom', 'weave', 25, 'The loom is dressed.'], ['Mend broken threads', 'loom', 'weave', 10, 'Mended.']],
    spinner: [['Card the wool', 'spinning|chair|bench', 'spin', 20, 'Soft rolags.'], ['Wind the yarn into skeins', 'spinning|chair', 'spin', 15, 'Neat skeins.']],
    dyer: [['Stir the dye vats', 'vat|cauldron', 'mix', 20, 'A good deep blue.'], ['Rinse the cloth in the stream', 'out', 'scrub', 20, 'The water runs blue downstream.']],
    chandler: [['Dip candles', 'cauldron|vat|workbench', 'mix', 20, 'A rack of candles.', { good: 'candles', qty: 1 }], ['Render the tallow', 'cauldron|fireplace', 'mix', 20, 'The tallow is rendered, and it reeks.']],
    potter: [['Wedge the clay', 'workbench|table', 'knead', 15, 'No air in it.'], ['Load the kiln', 'kiln', 'place', 20, 'Stacked and fired.'], ['Throw a set of bowls', 'workbench', 'knead', 25, 'A row of bowls drying.', { cash: 2 }]],
    glazier: [['Cut panes', 'workbench', 'cleave', 20, 'Cut, and none cracked.'], ['Lead a window', 'workbench', 'hammer', 25, 'Leaded and puttied.', { cash: 3 }]],
    jeweller: [['Polish the stock', 'counter|shelf|desk', 'scrub', 15, 'Everything sparkles.'], ['Set a stone in a ring', 'workbench|desk|counter', 'hammer', 25, 'Set fast.', { cash: 4 }], ['Weigh the gold', 'counter|desk', 'count', 10, 'To the grain.']],
    fletcher: [['Fletch arrows', 'workbench', 'weave', 20, 'A sheaf of arrows.'], ['Straighten shafts', 'workbench', 'look', 15, 'True.']],
    bowyer: [['Tiller a bow stave', 'workbench', 'saw', 25, 'It bends even.'], ['String the finished bows', 'rack|workbench', 'place', 10, 'Strung.']],
    'rope-maker': [['Lay a rope', 'out|workbench', 'spin', 25, 'A coil of rope.'], ['Hackle the hemp', 'workbench', 'scrub', 15, 'Combed out.']],
    builder: [['Mix the mortar', 'out', 'mix', 15, 'Mixed.'], ['Carry stone up the ladder', 'out', 'carry', 20, 'Up and up.'], ['Lay a course of stone', 'out', 'hammer', 25, 'Level and plumb.']],
    'master builder': [['Check the work with the plumb line', 'out', 'look', 15, 'True.'], ['Draw the plans', 'desk|workbench|table', 'write', 25, 'Plans for the next one.']],
    brickmaker: [['Mould bricks', 'out|workbench', 'knead', 20, 'A row of bricks drying.'], ['Stack the kiln', 'kiln|out', 'place', 20, 'Stacked for firing.']],
    'clay digger': [['Dig clay', 'out', 'dig', 25, 'A cartload of clay.']],
    quarryman: [['Split a block', 'out', 'hammer', 25, 'Split clean.', { good: 'stone', qty: 1 }], ['Clear the spoil', 'out', 'pitch', 20, 'Cleared.']],
    'quarry master': [['Mark the next face', 'out', 'point', 15, 'There, and there.'], ['Tally the blocks', 'out|desk', 'count', 15, 'Tallied.']],
    miner: [['Shore up a gallery', 'out|floor', 'hammer', 25, 'Propped and safe.'], ['Haul ore to the surface', 'out|floor', 'carry', 20, 'Up it comes.']],
    'mine foreman': [['Check the props', 'out|floor', 'look', 15, 'Sound.'], ['Weigh the ore', 'out|desk', 'count', 15, 'Weighed and written.']],
    'charcoal burner': [['Build a clamp', 'out', 'carry', 25, 'Stacked and turfed.'], ['Watch the burn', 'out', 'look', 20, 'Slow and steady.']],
    'peat cutter': [['Cut peat', 'out', 'dig', 25, 'A stack of turves.']],
    'salt boiler': [['Rake the salt pans', 'out|cauldron', 'pitch', 20, 'A heap of salt.'], ['Stoke the fires under the pans', 'out|fireplace', 'place', 15, 'Roaring.']],
    fisher: [['Mend the nets', 'out', 'weave', 20, 'Mended.'], ['Gut the catch', 'out|table', 'cleave', 15, 'Gutted and salted.', { good: 'fish', qty: 1 }], ['Caulk the boat', 'out', 'hammer', 20, 'Tight.']],
    boatwright: [['Steam a plank', 'out|workbench', 'saw', 20, 'Bent to the hull.'], ['Caulk a seam', 'out', 'hammer', 20, 'Pitched and tight.']],
    ferryman: [['Bail out the ferry', 'out', 'bucket', 15, 'Dry.'], ['Collect the fares', 'out', 'count', 10, 'A purse of pennies.', { cash: 2 }]],
    'toll keeper': [['Take the tolls', 'out', 'count', 15, 'Every cart paid.', { cash: 2 }], ['Mend the toll bar', 'out', 'hammer', 15, 'It swings true.']],
    carter: [['Grease the axles', 'out', 'scrub', 15, 'No more squeal.'], ['Load the cart', 'out|crate|sack', 'carry', 20, 'Loaded and roped.']],
    messenger: [['Carry a letter to a house in the town', 'out', 'carry', 15, 'Delivered.', { cash: 1 }]],
    'mounted courier': [['See to your horse', 'out', 'scrub', 15, 'Fed and rubbed down.'], ['Check the dispatch bag', 'desk|chest|out', 'look', 10, 'All sealed.']],
    postmaster: [['Sort the letters', 'desk|counter', 'count', 15, 'Sorted by road.'], ['Seal the post bags', 'desk|counter', 'place', 10, 'Sealed.']],
    clerk: [['Copy a deed', 'desk', 'write', 25, 'A fair copy.', { cash: 2 }], ['File the papers', 'shelf|bookcase|chest|desk', 'place', 10, 'All in order.']],
    scribe: [['Write a letter for someone who cannot', 'desk', 'write', 20, 'Read back to them, and sealed.', { cash: 2 }], ['Rule the pages', 'desk', 'write', 10, 'Ruled.']],
    magistrate: [['Read the depositions', 'desk', 'read', 25, 'You have a fair idea what happened.'], ['Sign the warrants', 'desk', 'write', 10, 'Signed and sealed.']],
    'tax collector': [['Tally the hearth roll', 'desk|counter', 'count', 20, 'Every hearth counted.']],
    moneylender: [['Weigh the pledges', 'counter|desk|chest', 'count', 15, 'Every pledge weighed.'], ['Write up the interest', 'desk', 'write', 15, 'Owed, and noted.']],
    'house agent': [['Look over an empty house', 'out', 'look', 20, 'Damp in the back room.'], ['Write a lease', 'desk', 'write', 20, 'A lease ready to sign.']],
    shopkeeper: [['Dust the shelves', 'shelf|counter', 'scrub', 10, 'Dust gone.'], ['Count the stock', 'shelf|crate|barrel|sack', 'count', 15, 'All accounted for.'], ['Set out the wares', 'counter|shelf|table', 'place', 10, 'Laid out to tempt.']],
    'warehouse master': [['Check the bills against the bales', 'crate|sack|barrel|desk', 'count', 20, 'Two bales short.'], ['Write the manifest', 'desk', 'write', 15, 'Written.']],
    'warehouse worker': [['Stack the bales', 'crate|sack|floor', 'carry', 20, 'Stacked to the rafters.'], ['Roll the barrels to the door', 'barrel|floor', 'carry', 15, 'Rolled.']],
    'horse trader': [['Show a horse\'s paces', 'out', 'look', 15, 'It moves well.'], ['Check a horse\'s teeth', 'out', 'look', 10, 'Younger than they said.']],
    sweeper: [['Shovel the dung off the street', 'out', 'sweep', 15, 'The street is fit to walk.'], ['Clear the gutters', 'out', 'sweep', 15, 'Running clear.']],
    bearer: [['Carry a litter to the hospital', 'out', 'carry', 20, 'Carried gently.'], ['Fetch physic from the apothecary', 'out', 'carry', 15, 'Fetched.']],
    'market warden': [['Check the weights and measures', 'out', 'count', 15, 'One false measure, confiscated.', { cash: 2 }], ['Settle a quarrel between stallholders', 'out', 'talk', 15, 'Settled, for now.']],
    'town crier': [['Learn the proclamation by heart', 'desk|out', 'read', 10, 'Word perfect.']],
  };
  const pick = (a, r) => a[Math.floor(r() * a.length)];
  // what the post's workplace has to work at
  const kindsAt = (bz, s) => { try { const L = O.Interior.interior(bz.b, 0, s); return new Set(L.items.map((it) => it.kind)); } catch (e) { return new Set(); } };
  const choose = (where, have) => { for (const w of where.split('|')) if (w === 'out' || w === 'floor' || have.has(w)) return w; return null; };
  O.choreTasks = (s, bz, e) => {
    const list = C[e.role]; if (!list || !bz || !bz.b) return [];
    const r = O.RNG(O.hash('chore', e.role, s.day, bz.id)), have = kindsAt(bz, s), out = [];
    const n = 2 + (r.next() < 0.5 ? 1 : 0), pool = list.slice(); // (two or three of the small duties each day)
    while (out.length < n && pool.length) {
      const c = pool.splice(Math.floor(r.next() * pool.length), 1)[0], at = choose(c[1], have); if (!at) continue;
      out.push({ kind: 'chore', at, text: c[0], label: c[0], anim: c[2], mins: c[3], doneMsg: c[4], gain: c[5] || null, need: 1 });
    }
    void pick; return out;
  };
  // what comes of it
  O.choreGain = (t, s, bz) => {
    const g = t.gain; if (!g || !bz) return;
    if (g.cash) bz.cash += g.cash;
    if (g.good && O.Data.GOODS[g.good]) bz.stock[g.good] = (bz.stock[g.good] || 0) + g.qty;
    if (g.cond && bz.b) bz.b.condition = Math.min(1, (bz.b.condition || 0.8) + g.cond);
  };
  O.CHORES = C;
})();
