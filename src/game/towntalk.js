// Talk of the town. What happens in the street doesn't vanish when it's over: everyone who saw the bull
// get loose, the chimney go up, the lost child found, carries it home and tells it at supper, and for days
// after folk bring it up when you talk to them, the more so if it was you who caught the rope or carried
// the child home ("You're the one who...").
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const last = new Map(); let acc = 0, told = 0;
    function tell(s, x, y, seen, heard) { const P = game.player; if (x == null) { x = P.x; y = P.y; } const wit = s.people.filter((q) => q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && q.age >= 6 && Math.hypot(q.agent.x - x, q.agent.y - y) < 240);
      const add = (q, t, src) => { q.beliefs = q.beliefs || []; if (q.beliefs.some((b) => b.t === t)) return; q.beliefs.unshift({ t: t.slice(0, 160), src, day: s.day }); if (q.beliefs.length > 14) q.beliefs.length = 14; };
      const homes = new Set(); for (const q of wit) { add(q, seen, 'seen'); homes.add(q.home); } for (const q of s.people) if (homes.has(q.home) && !wit.includes(q) && q.age >= 6) add(q, heard, 'rumour'); told++;
      // and into the town's chronicle, where the crier and the gossips find it
      try { if (O.Chronicle && O.Chronicle.add) { const mine = /^The stranger/.test(seen), big = mine || /bull|chimney|wheel|missing/.test(seen); O.Chronicle.add({ day: s.day, minute: Math.floor(s.minute), place: s.world.placeId || 'ashford', placeName: s.world.name, cat: mine ? 'people' : /bull|chimney|flood/.test(seen) ? 'disaster' : 'people', imp: big ? 2 : 1, text: heard.replace(/^They say /, '').replace(/, they say\.$/, '.').replace(/^(.)/, (c) => c.toUpperCase()), byPlayer: mine }); } } catch (e) { /* */ }
      return wit.length; }
    // [what to watch, where it happened, what the witnesses saw, what the household heard]
    const EV = [
      ['LooseBull', 'caught', () => O.LooseBull.bull?.bull, 'A bull got loose in the street today and nearly trampled folk before the men roped it.', 'There was a bull loose in the street today, they say.'],
      ['LooseBull', 'grabbed', () => O.LooseBull.bull?.bull, 'The stranger grabbed the loose bull by its nose-ring rope today, bold as you like.', 'They say the stranger caught a loose bull by the nose-ring today.'],
      ['ChimneyFire', 'fires', () => O.ChimneyFire.fire && { x: O.ChimneyFire.fire.top[0], y: O.ChimneyFire.fire.top[1] + 40 }, 'A chimney caught fire in the lane today; it was a near thing for the thatch next door.', 'Somebody\'s chimney caught fire today, near the lane.'],
      ['ChimneyFire', 'yours', null, 'The stranger ran up with a bucket when the chimney caught fire today.', 'The stranger helped put out a chimney fire today, they say.'],
      ['LostChild', 'found', () => O.LostChild.lost?.kid?.agent, 'A little one went missing today and the mother was half out of her mind till they were found.', 'A child went missing in the lanes today, but was found.'],
      ['LostChild', 'rescued', null, 'The stranger found a lost little one today and walked them home to their mother.', 'They say the stranger brought a lost child home today. Kind of them.'],
      ['Swarm', 'taken', null, 'The bees swarmed today and the beekeeper took them in a skep while folk banged pans.', 'There was a swarm of bees out today.'],
      ['OxWagons', 'broken', () => O.OxWagons.wagon, 'An ox-wagon lost a wheel on the road today and blocked it half the morning.', 'A wagon broke down on the road today.'],
      ['OxWagons', 'helpedYou', null, 'The stranger put a shoulder under the carter\'s wagon when its wheel came off.', 'The stranger helped a carter with a broken wagon, they say.'],
      ['FloodFolk', 'helped', null, 'The stranger took a bucket and helped bail out a flooded house.', 'They say the stranger helped folk bail out the flood.'],
      ['BreadDole', 'given', null, 'The stranger gave a loaf of their own to a poor soul in the bread queue.', 'The stranger gave bread to the poor at the dole, they say.'],
      ['Truants', 'caught', () => O.Truants.run?.kids?.[0]?.agent, 'The master caught a truant by the ear today and marched him back to his letters.', 'Some lad was caught playing truant today.'],
      ['Friar', 'sermons', null, 'A friar preached at the cross today, all hellfire and the rich man and Lazarus.', 'There was a friar preaching in the square today.'],
      ['PloughMonday', 'ploughed', () => O.PloughMonday.run?.lads?.[0]?.agent, 'The ploughboys ploughed up a mean man\'s doorstep today for refusing them a penny.', 'Some skinflint had his step ploughed up by the ploughboys.'],
      ['TreeFall', 'felled', null, 'A great tree came down today with a crash you could hear across the town.', 'They felled a big tree today.'],
      ['Christening', 'held', () => O.Christening.scene && { x: O.Christening.scene.x, y: O.Christening.scene.y }, 'There was a christening today, and pennies thrown for the children.', 'There was a christening today.'],
    ];
    game.hooks.update.push((dt) => { acc += dt; if (acc < 0.5) return; acc = 0; const s = cur(); if (!s || !s.people) return;
      for (const [mod, key, at, seen, heard] of EV) { const M = O[mod]; if (!M) continue; let v; try { v = M[key]; } catch (e) { continue; } if (typeof v !== 'number') continue; const k = mod + '.' + key, was = last.get(k); last.set(k, v); if (was == null || v <= was) continue; let pos = null; try { pos = at && at(); } catch (e) { pos = null; } tell(s, pos ? pos.x : null, pos ? pos.y : null, seen, heard); } });
    O.TownTalk = { tell: (x, y, seen, heard) => tell(cur(), x, y, seen, heard || seen), get told() { return told; } };
  }
  O.TownTalkSetup = { setup };
})();
