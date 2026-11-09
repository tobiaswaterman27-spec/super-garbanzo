// What happens at the work. Every post has its marked places to go to, and now each place can turn up
// something of its own, as work does: the ewe caught by the fleece in the brambles, the cow that puts her
// foot in the pail, the letter for a house where nobody answers and a neighbour takes it in, the grave that
// turns up an old bone, the chimney that drops a jackdaw's nest on your head, a coin found in the straw. Some
// cost you a scratch; some leave you a tip or a little find; most are just the life of the job.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let was = false, count = 0; const log = { coin: 0, item: 0, hurt: 0, said: 0 };
    // [what happens, a line someone near says (or null), the effect]
    const INC = {
      shepherd: [['A ewe has her fleece caught fast in the brambles. You work her free, and she bolts without a word of thanks.', null, null], ['One of the lambs has strayed off alone, crying. You carry it back under your arm to its mother.', 'Bless you, I\'d lost count of that one.', null], ['You find a tuft of good wool caught on the fence and stuff it in your pocket.', null, { item: 'wool' }]],
      dairymaid: [['The cow puts her foot square in the pail. Half the milk across the straw.', 'She does that. Kick her back, she won\'t care.', null], ['The cat sits beside you through the milking, waiting for a squirt. You oblige.', null, null], ['A farm wife buys a jug of the warm milk straight from the pail.', null, { coin: 1 }]],
      beekeeper: [['A bee gets up your sleeve and stings you for your trouble.', null, { hurt: 1 }], ['The comb in this one is heavy and golden. A good hive.', null, { item: 'honey' }]],
      gravedigger: [['Your spade turns up an old bone, brown as a root. You set it back in the corner of the grave with a word.', null, null], ['A widow stands at the edge and watches you dig without a word, then puts a coin in your hand and goes.', null, { coin: 1 }], ['You hit a great stone and it takes you an age to lever out.', null, { hurt: 1 }]],
      messenger: [['Nobody answers at this door. A neighbour leans out and takes the letter in for them.', 'I\'ll see they get it. Is it bad news?', null], ['The woman reads the letter there on the step and bursts into tears. Good news, she says. Her son is alive.', 'Oh, God be thanked! Wait, here, for your trouble.', { coin: 1 }], ['A dog sees you off the step with its teeth.', null, { hurt: 1 }]],
      'mounted courier': [['The man you bring it to scribbles an answer on the back and bids you wait for it.', 'Take this back with you, and quick.', null], ['A farmer flags you down for news from the road.', 'What news from the town? Is there war?', null]],
      'chimney sweep': [['A jackdaw\'s nest comes down the flue on your head, sticks and soot and all.', null, null], ['You come out black from hat to boots. The children in the lane shriek and run from you.', 'The bogeyman! The bogeyman!', null], ['The goodwife gives you bread and dripping for leaving her hearth so clean.', null, { item: 'bread' }]],
      'rat-catcher': [['A big one goes for your hand before you get the stick on it.', null, { hurt: 1 }], ['The housewife pays you a penny a tail on top, she\'s so glad to see the back of them.', null, { coin: 1 }]],
      lamplighter: [['A child follows you lamp to lamp, watching each one catch.', 'Can I do the next one? Please?', null]],
      'water carrier': [['You slop half a bucket down your legs on the step.', null, null], ['An old man too frail to carry asks for a dipper from your bucket and blesses you for it.', null, null]],
      'town crier': [['Someone heckles your cry from a window.', 'Louder! We can\'t hear you over your own bell!', null], ['A crowd gathers to hear you. For once they listen to every word.', null, null]],
      thatcher: [['A bundle of reed slides off the roof and you nearly go after it.', null, { hurt: 1 }], ['The householder sends up a mug of ale on the end of a rake.', 'Here, get that down you.', null]],
      laundress: [['A shirt sails off the line and you chase it down the lane.', null, null], ['There\'s a coin left in the pocket of a gentleman\'s coat. Finders keepers, the other women say.', null, { coin: 1 }]],
      groom: [['The bay mare takes a nip at your shoulder while you pick out her hoof.', null, { hurt: 1 }], ['A rider tips you for the shine on his horse.', null, { coin: 1 }]],
      stablehand: [['You find a coin in the straw, dropped by some rider.', null, { coin: 1 }], ['The old horse at the end leans his whole weight on you while you work. Friendly.', null, null]],
      gardener: [['You turn up a blackened old coin with the spade.', null, { coin: 1 }], ['A blackbird follows your spade for worms, close enough to touch.', null, null], ['You pick a handful of herbs from the edge of the bed.', null, { item: 'herbs' }]],
      miner: [['A chunk of the face comes down a foot from your head.', 'Christ! Are you whole?', null], ['There\'s a fat vein of good ore here. The foreman will be pleased.', null, null]],
      quarryman: [['A chip of stone takes you across the cheek.', null, { hurt: 1 }], ['This block splits sweet and true along the bed.', null, null]],
      labourer: [['A splinter as long as your finger in the palm. You draw it with your teeth.', null, { hurt: 1 }], ['The foreman shares his ale skin round, and you get a good pull.', 'Drink up. It\'s hot work.', null]],
      builder: [['A mallet slips from the scaffold above and thumps down beside you.', 'Sorry! Sorry! Look out below!', null], ['A passer-by stops to admire the wall going up.', 'That\'s fine straight work.', null]],
      'clay digger': [['You sink to the knee in the clay and lose a shoe to it.', null, null]],
      'peat cutter': [['A lark goes up singing from under your feet.', null, null], ['You find an old wooden bowl preserved black in the peat.', null, null]],
      'charcoal burner': [['The stack breaks through on one side and you run to smother it with turf.', null, { hurt: 1 }]],
      'salt boiler': [['The steam off the pan takes the skin off your knuckles.', null, { hurt: 1 }]],
      gamekeeper: [['You find a snare set by the warren. Some poacher\'s, and fresh.', null, null], ['A hind and her calf stand and look at you across the clearing, then are gone.', null, null]],
      ferryman: [['The passenger pays and adds a penny for a dry crossing.', null, { coin: 1 }], ['A man leans out too far to look at the fish and nearly has you all over.', null, null]],
      'toll keeper': [['A carter argues the toll, loud and long, then pays.', 'Robbery! Plain robbery on the king\'s road!', null]],
      'tax collector': [['A householder pays you in eggs and an apology.', null, null]],
      'bell-ringer': [['The rope skins your palms on the backswing.', null, { hurt: 1 }]],
      midwife: [['A safe delivery. The father, half-mad with joy, presses a coin on you.', null, { coin: 1 }]],
      'barber-surgeon': [['The man in the chair faints clean away at the sight of his own blood.', null, null], ['A tip for a close shave.', null, { coin: 1 }]],
      carter: [['A wheel drops into a rut to the axle and you have to heave it out.', null, { hurt: 1 }]],
      'market warden': [['You catch a trader with a thumb on the scales.', 'I never! That\'s the scale, not me!', null]],
    };
    const TRADE = {
      baking: [['A loaf comes out a little burnt at the heel. Your own supper, then.', null, { item: 'bread' }], ['A child at the door with her nose pressed to the window. You give her a crust.', null, null]],
      smithing: [['The horse you shoe leans on you the whole time.', null, null], ['A spark goes down your shirt.', null, { hurt: 1 }]],
      brewing: [['The master lets you taste the new brew. Strong stuff.', null, null]],
      carpentry: [['A knot in the plank fights the saw every inch.', null, null]],
      tailoring: [['The needle goes into your thumb to the bone.', null, { hurt: 1 }]],
    };
    function by(s) { const P = game.player; return s.people.find((q) => q.agent && !q.agent.hidden && !q.agent.frozen && q.age >= 6 && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < (game.scene ? 9999 : 140) && (!game.scene || q.agent.inside === game.scene.b?.id)); }
    function incident(s, e, bz, trade) {
      const list = INC[e.role] || TRADE[trade]; if (!list) return; const [text, line, fx] = pick(list); count++;
      const good = fx && (fx.coin || fx.item), bad = fx && fx.hurt; O.UI && O.UI.say && O.UI.say(text, good ? 'good' : bad ? 'bad' : undefined);
      if (line) { const q = by(s); if (q) { setTimeout(() => O.Speech && O.Speech.say(q, line, 2.6), 700); log.said++; } }
      if (fx && fx.coin) { PS.money = (PS.money || 0) + fx.coin; log.coin++; O.sfx && O.sfx('coins', 0.4, !!game.scene); }
      if (fx && fx.item && O.Data.GOODS[fx.item] && PS.canCarry(fx.item)) { PS.add(fx.item); log.item++; }
      if (fx && fx.hurt) { game.player.anim = 'hurt'; log.hurt++; O.sfx && O.sfx('hurt', 0.3, !!game.scene); }
    }
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !O.Employment || !O.Employment.here) return; const e = O.Employment.here(); const working = !!(e && e.onShift && game.player.locked && e.place === s.world.placeId);
      if (was && !working && e) { const bz = s.biz.get(e.biz), trade = bz && O.tradeOf ? O.tradeOf(e, bz) : null; if (Math.random() < 0.2) incident(s, e, bz, trade); }
      was = working;
    });
    O.JobIncidents = { log, INC, TRADE, get count() { return count; }, fire: () => { const s = cur(), e = O.Employment.here(); if (!e) return false; const bz = s.biz.get(e.biz); incident(s, e, bz, bz && O.tradeOf ? O.tradeOf(e, bz) : null); return true; } };
  }
  O.JobIncidentsSetup = { setup };
})();
