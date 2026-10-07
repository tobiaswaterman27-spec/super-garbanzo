// Dialogue: what NPCs say is built from what they actually know and feel.
//
// buildContext() gathers a compact, factual brief about the NPC (identity, personality, needs, job,
// money worries, recent memories, opinion of the player, local prices and news). Providers turn that
// brief into speech:
//   - LocalProvider (default, works offline): template lines chosen from the brief.
//   - RemoteProvider (planned): sends the same brief to an LLM through a game server proxy and plays
//     the reply with text-to-speech. See docs/SPEECH.md. Artifacts cannot reach external APIs, so the
//     remote provider is wired but disabled here.
'use strict';
(function () {
  const G = O.Data.GOODS;

  // "8 casks of ale", "3 loaves of bread", "a sack of flour"
  const plural = (u) => (/^(fish|sheep|deer|salt|wheat|barley|flour|bread|meat|cloth|wool|iron|honey|herbs|timber|charcoal|ale|wine|beer|cider|mead|clay|peat|tar|thatch|spices|silk|glass|ink|parchment|leather|grain|malt|butter|milk|cheese|pottage|medicine|tools|planks|logs|firewood|candles|tallow candles|stone)$/.test(u) ? u : /f$/.test(u) ? u.replace(/f$/, 'ves') : /(s|x|ch|sh)$/.test(u) ? u + 'es' : u + 's');
  O.countOf = (g, n) => { const G0 = G[g]; if (!G0) return `${n} ${g}`; const nm = G0.name.toLowerCase(), u = G0.unit; if (!u || u === nm || nm.endsWith(u) || nm.endsWith(plural(u)) || ['garment', 'piece', 'item', 'one'].includes(u)) return n === 1 ? `${/s$/.test(nm) ? 'some' : (/^[aeiou]/.test(nm) ? 'an' : 'a')} ${nm}` : `${n} ${plural(nm)}`; if (nm.startsWith(u + ' of ')) return `${n === 1 ? 'a' : n} ${n === 1 ? u : plural(u)}${nm.slice(u.length)}`; return `${n === 1 ? 'a' : n} ${n === 1 ? u : plural(u)} of ${nm}`; };
  // the goods in general: "iron bars", "cloth", "wheat"
  O.goodsWord = (g) => { const G0 = G[g]; if (!G0) return String(g); const nm = G0.name.toLowerCase(), u = G0.unit; if (!u || u === nm || nm.endsWith(u)) return plural(nm); return nm.replace(/^(bolt|bundle|sack|cask|jug|loaf|head|cut|pot|bag|block|piece|set) of /, ''); };
  const an = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
  // "the innkeeper at the Crooked Lantern", "a farmhand at Marsh Farm", "the guard captain at the watch house"
  function bizPhrase(sim, bz) {
    const n = bz.name || bz.def.label;
    if (/^the /i.test(n)) return 'the ' + n.slice(4);
    if (/^St\.? /.test(n)) return n;
    if (n.startsWith(sim.world.name + ' ') || (/^[A-Z][a-z]+'s /.test(n) && !/^(Physician|Woodcutter|Forester|Carrier|Builder|Miller|Fisher|Shepherd|Brewer|Weaver|Potter|Tanner|Cooper|Mason|Baker|Butcher|Smith|Saddler|Glazier|Scrivener|Barber|Jeweller|Wainwright)'s/.test(n)) || /Farm$|Vineyard$|Castle$/.test(n)) return n;
    return 'the ' + n.replace(/^(Watch House|General Store|Town Hall|Post House|Toll House|Gaol|Hospital|School|Morgue|Mill|Chapel)\b/, (m) => m.toLowerCase());
  }
  function jobPhrase(sim, p) {
    if (!p.job) return null;
    const bz = p.job.biz != null && sim.biz.get(p.job.biz); if (!bz) return an(p.job.role) + ' ' + p.job.role;
    const same = bz.workers.filter((id) => sim.byId.get(id)?.job?.role === p.job.role).length, head = bz.owner === p.id;
    return `${same <= 1 || head ? 'the' : an(p.job.role)} ${p.job.role} at ${bizPhrase(sim, bz)}`;
  }
  function buildContext(sim, p, playerState) {
    const hh = sim.household(p);
    const job = p.job ? jobPhrase(sim, p) : p.age < 16 ? 'a child' : 'out of work';
    // the household as the person sees it: spouse, children, parents, brothers and sisters under the same roof
    const mates = (hh ? hh.members : []).map((id) => sim.byId.get(id)).filter((q) => q && q !== p && q.alive !== false);
    const kids = (p.children || []).map((id) => sim.byId.get(id)).filter((q) => q && q.alive !== false);
    const parents = (p.parents || []).map((id) => sim.byId.get(id)).filter((q) => q && q.alive !== false);
    const fam2 = { spouse: p.spouse ? sim.byId.get(p.spouse) : null, kids, parents: parents.length ? parents : mates.filter((q) => q.age >= p.age + 16 && !(p.children || []).includes(q.id) && q.id !== p.spouse).slice(0, 2), sibs: mates.filter((q) => Math.abs(q.age - p.age) < 16 && q.id !== p.spouse && !(p.children || []).includes(q.id) && (parents.length ? (q.parents || []).some((x) => (p.parents || []).includes(x)) : q.sur === p.sur)), widowed: !!p.widowed && !p.spouse };
    // what they'd talk about, price-wise: what they sell themselves, or the market
    const ownBz = p.job?.biz != null ? sim.biz.get(p.job.biz) : null, sells = ownBz ? (ownBz.def.sells || []).filter((g) => G[g]) : [];
    const market = []; for (const [type, g] of [['bakery', 'bread'], ['tavern', 'ale'], ['woodcutter', 'firewood'], ['store', 'cheese'], ['butcher', 'meat'], ['store', 'eggs']]) { const sp = sim.supplierOf(type, g); if (sp && G[g]) market.push({ g, price: sim.price(sp, g), at: bizPhrase(sim, sp), base: G[g].base }); }
    const bake = sim.supplierOf('bakery');
    const opinion = p.rel.get(0) || { affinity: 0, familiar: 0 };
    return {
      name: p.name, first: p.first, gang: p.gang || null, age: p.age, sex: p.sex, stage: p.stage, job, traits: p.traits, goal: p.goal,
      mood: p.mood, hunger: Math.round(p.needs.hunger), energy: Math.round(p.needs.energy), social: Math.round(p.needs.social),
      householdMoney: Math.round(hh.money), illness: p.health.illness ? { kind: p.health.illness.kind, sev: +p.health.illness.sev.toFixed(2) } : null, pantry: { ...hh.pantry },
      skill: p.job ? Math.round((p.skills[p.job.role] || 0) * 100) : null,
      activity: p.activity?.act, place: sim.world.name,
      memories: p.memories.slice(0, 6).map((m) => m.text),
      family: { spouse: p.spouse ? sim.byId.get(p.spouse)?.name : null, children: (p.children || []).map((id) => sim.byId.get(id)?.first).filter(Boolean) }, fam2, married: !!p.spouse,
      sells: sells.slice(0, 3).map((g) => ({ g, price: sim.price(ownBz, g), base: G[g].base })), market, rich: (hh?.money || 0) > 150,
      opinionOfPlayer: opinion, sawPlayerCrime: p.memories.some((m) => m.kind === 'crime' && m.about === 0 && m.strength > 0.3) && (() => { const c = sim.crimes.filter((x) => x.perp === 'player' && x.witnesses.some((w) => w.id === p.id)).pop(); return c ? O.Justice.matchScore(c.witnesses.find((w) => w.id === p.id).desc, O.Justice.lookOf(O.game.player.a)) >= 0.5 : false; })(), playerReputation: playerState?.reputation || { local: 0 },
      prices: bake ? { bread: sim.price(bake, 'bread') } : {},
      news: sim.history.filter((h) => h.kind !== 'day').slice(-4).map((h) => h.text),
      heard: (p.heard || []).map((h) => ({ f: h.f, v: h.v, src: h.src })),
      fame: (p.heard || []).filter((h) => { const f = O.Chronicle && O.Chronicle.byId(h.f); return f && f.byPlayer && !f.secret; }).map((h) => h.v),
      ancestors: [...(p.parents || []), p.widowed].filter(Boolean).map((id) => sim.byId.get(id)).filter((q) => q && q.alive === false).map((q) => ({ name: q.name, first: q.first, rel: (p.parents || []).includes(q.id) ? (q.sex === 'm' ? 'father' : 'mother') : (q.sex === 'm' ? 'husband' : 'wife'), mem: (sim.memorials || []).find((m) => m.name === q.name) })),
      time: { day: sim.day, minute: Math.floor(sim.minute) }, weather: sim.weather ? sim.weather.kind : 'clear', season: sim.season,
    };
  }

  // A system prompt for a remote LLM, built from the same brief.
  function remotePrompt(ctx) {
    return [
      `You are ${ctx.name}, ${ctx.age}, ${ctx.job} in the medieval village of ${ctx.place}.`,
      `Personality: ${ctx.traits.join(', ')}. Your goal: ${ctx.goal || 'none in particular'}.`,
      `Right now: ${ctx.activity}. Hunger ${ctx.hunger}/100, energy ${ctx.energy}/100. Household purse ₳${ctx.householdMoney}.`,
      `You remember: ${ctx.memories.join(' | ') || 'nothing notable lately'}.`,
      `Your opinion of the stranger talking to you: affinity ${ctx.opinionOfPlayer.affinity.toFixed(2)}, familiarity ${ctx.opinionOfPlayer.familiar.toFixed(2)}.`,
      `Only speak about things you could know. You may be wrong or repeat rumours. Reply in 1-3 short sentences, in plain period-flavoured English, no modern words.`,
    ].join('\n');
  }

  const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

  const LocalProvider = {
    name: 'local',
    greet(ctx, seed) {
      const a = ctx.opinionOfPlayer.affinity, f = ctx.opinionOfPlayer.familiar;
      if (ctx.gang === 'player') return pick(['Boss.', 'Evening, chief. Quiet so far.', "What's the job?"], seed);
      if (ctx.sawPlayerCrime) return pick(["You! I know your face. You're the thief!", 'Stay back. I saw what you did.', "I've told the watch about you."], seed);
      if (ctx.stage === 'child' || ctx.stage === 'olderChild') return pick(['Are you a soldier? You look like a soldier.', "Mam says I'm not to talk to strangers.", 'Have you seen a dog with one ear? He\'s mine.'], seed);
      if (ctx.traits.includes('hostile') || a < -0.3) return pick(['What do you want?', "Keep walking, stranger.", "I've nothing for you."], seed);
      if (ctx.fame && ctx.fame.length && seed % 3 !== 0) return pick(['I know you! ', 'Ah, you\'re the one folk talk of. ', 'So it\'s you. '], seed) + pick(['Heard it said: ', 'They say ', 'Word is, '], seed + 1) + O.Chronicle.lower(pick(ctx.fame, seed + 2));
      if (f > 0.3) return pick([`Back again? Good to see you.`, `Ah, it's you.`, 'You again! Well met.'], seed);
      if (ctx.traits.includes('suspicious')) return pick([`You're not from ${ctx.place}. What's your business?`, 'Hm. Haven\'t seen you before.'], seed);
      const h = ctx.time.minute / 60, part = h < 5 || h >= 21 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'day' : 'evening';
      const wx = /rain|heavy|storm|hail/.test(ctx.weather) ? pick(['Wet enough for you?', "Filthy weather. Come in out of it if you've sense."], seed + 1) : /snow/.test(ctx.weather) ? pick(['Cold enough for you?', 'Mind the ice on the step.'], seed + 1) : /fog|mist/.test(ctx.weather) ? "Can't see your hand in front of you today." : ctx.season === 'summer' && part === 'day' ? 'Hot one today.' : null;
      const hi = { night: pick(["You're abroad late.", 'God keep you this night.'], seed), morning: pick(['Morning.', 'God give you good morning.'], seed), day: pick(['Good day to you.', 'Well met.'], seed), evening: pick(['Good evening.', 'Evening, stranger.'], seed) }[part];
      return wx && seed % 2 ? `${hi} ${wx}` : pick([hi, `${hi} Passing through?`, `${hi} You're not from these parts.`, 'God keep you.'], seed + 2);
    },
    topic(ctx, topic, seed) {
      switch (topic) {
        case 'self': {
          if (ctx.age < 13 && !ctx.illness) return pick(["I'm well! Mam says I grow like a weed.", "Good. I found a bird's nest by the mill.", "I'm hungry. I'm always hungry.", "I've a loose tooth. Look."], seed);
          if (ctx.illness) return ctx.illness.kind === 'injury' ? pick(["Hurt my arm at work. It'll mend, God willing.", 'Took a knock at work. Still aches.'], seed) : ctx.illness.sev > 0.5 ? pick(["I'm burning up. Leave me be.", "I can barely stand."], seed) : pick(['A touch of something. Nothing that will keep me abed.', "Sniffling, that's all."], seed);
          const baby = ctx.memories.find((m) => /^Gave birth to|was born\.$/.test(m));
          if (baby) { const nm = (baby.match(/to (\w+)|^(\w+) was born/) || [])[1] || (baby.match(/^(\w+) was born/) || [])[1]; return pick([`Tired! We've a new baby${nm ? `, little ${nm}` : ''}. Up half the night.`, `Happy, God be thanked. ${nm || 'The baby'} came safe and sound.`], seed); }
          const wed = ctx.memories.find((m) => /^Married /.test(m));
          if (wed) return pick([`Never better. I'm newly wed, did you not hear? ${wed}`, `Happy. ${wed} The whole street came to the feast.`], seed);
          const block = ctx.memories.find((m) => /die on the block/.test(m));
          if (block) return pick(["I can't get it out of my head. I watched a man die on the block.", 'Shaken, if I tell the truth. The execution in the square.'], seed);
          const fest = ctx.memories.find((m) => /came to|christening|feast|fair/.test(m) && !/stranger/.test(m));
          if (fest && seed % 3 === 0) return pick(['Well! Still full from the feast.', "Merry enough. There's been some fine gatherings of late."], seed);
          const grief = ctx.memories.find((m) => /has died|buried/.test(m));
          if (grief) return `Hard days. ${grief}`;
          if (ctx.hunger < 25) return pick(["Truth be told I've not eaten since yesterday.", 'Hungry. The pot was empty this morning.'], seed);
          if (ctx.energy < 25) return "Dead on my feet. I'll sleep well tonight.";
          const hard = ctx.memories.find((m) => /afford|couldn't|could only pay|nothing to eat|shut/.test(m));
          if (hard) return `Could be better. ${hard}`;
          if (ctx.householdMoney > 150) return ctx.job === 'out of work' || ctx.job === 'a child' ? pick(['Well, God be thanked. We want for nothing.', 'Comfortable, thank you. The family purse is full.'], seed) : pick(["Can't complain. Business has been kind.", 'Well enough, thank you. The purse is heavy for once.'], seed);
          return pick(['Well enough. Work, bread, sleep, same as anyone.', "I get by. Can't ask for more."], seed);
        }
        case 'work': {
          if (ctx.age < 12) return pick(['I help Mam about the house. And I chase the geese.', 'I fetch the water and mind the little ones.', "I'm too young for work, Da says. I gather kindling though."], seed);
          if (ctx.age < 16 && ctx.job === 'a child') return pick(["I'm learning my father's trade, near enough. Fetch this, carry that.", "I help at home. Next year I'm to be bound apprentice, God willing."], seed);
          if (ctx.job === 'out of work') return ctx.age >= 65 ? (ctx.fam2 && (ctx.fam2.kids.length || ctx.fam2.parents.length) ? pick(["My working days are done. I mind the hearth now.", "I've done my share of work. My children keep me now."], seed) : pick(["My working days are done. I live on what I put by.", 'Too old for work now. The parish looks in on me.'], seed)) : pick(["I've no work. If you hear of any, tell me.", 'Nothing steady. I take what comes.'], seed);
          const lvl = ctx.skill > 85 ? 'master' : ctx.skill > 65 ? 'expert' : ctx.skill > 45 ? 'skilled' : ctx.skill > 25 ? 'trained' : 'beginner';
          // no ambitions that contradict a life: the married don't long to marry, the rich don't mean to escape poverty
          const goal = ctx.goal && !(/children/.test(ctx.goal) && !(ctx.fam2 && ctx.fam2.kids.length)) && !(ctx.married && /marry/.test(ctx.goal)) && !(ctx.rich && /poverty|debts/.test(ctx.goal)) && !(ctx.age > 60 && /settle|marry|master/.test(ctx.goal)) && !(/guard captain/.test(ctx.goal) && !/guard|watch|sergeant/.test(ctx.job || '')) && !(/become a master/.test(ctx.goal) && /master|innkeeper|physician|priest|captain/.test(ctx.job || '')) ? ctx.goal : null;
          const how = lvl === 'master' ? pick(["Been at it long enough there's little left to teach me.", "I've done it so long I could do it asleep."], seed) : lvl === 'beginner' ? pick(["Still learning. I spoil more than I'd like.", "I'm new to it. Every day I learn something."], seed) : pick(['Steady work, honest hands.', 'It keeps bread on the table.', "Hard work, but it's mine."], seed);
          return `I'm ${ctx.job}. ${how}${goal ? ` One day I mean to ${goal}.` : ''}`;
        }
        case 'prices': {
          const say1 = (m) => { const G0 = G[m.g] || {}, nm = (G0.name || m.g).toLowerCase(), u = G0.unit && G0.unit !== nm && !nm.endsWith(G0.unit) ? G0.unit : null, many = /s$/.test(nm) && !/ss$/.test(nm); const per = u ? (/^half/.test(u) ? `the ${u}` : `${an(u)} ${u}`) : 'each'; const head = `${nm.charAt(0).toUpperCase() + nm.slice(1)} ${many ? 'are' : 'is'} ₳${m.price} ${per}`; const r = m.price / Math.max(0.5, m.base); return r > 1.4 ? `${head} now. Robbery.` : r < 0.75 ? `${head}, cheap as it's ever been.` : `${head}${m.at ? ` at ${m.at}` : ''}, same as ever.`; };
          if (ctx.sells && ctx.sells.length && seed % 2 === 0) { const m = pick(ctx.sells, seed); return `Ours? ${say1(m).replace(/ at [^,.]*/, '')} ${m.price > m.base * 1.3 ? 'Costs us more to make, these days.' : 'Fair, for good work.'}`; }
          if (!ctx.market || !ctx.market.length) return "Couldn't tell you. I grow what I eat.";
          const a = pick(ctx.market, seed), b = pick(ctx.market, seed + 3);
          return a === b ? say1(a) : `${say1(a)} ${say1(b)}`;
        }
        case 'news': {
          if (ctx.heard && ctx.heard.length && (seed % 4 !== 0)) {
            const famNames = ctx.fam2 ? [ctx.fam2.spouse, ...ctx.fam2.kids, ...ctx.fam2.parents, ...ctx.fam2.sibs].filter(Boolean).map((q) => q.name) : [];
            const pool = ctx.heard.filter((x) => !famNames.some((n) => String(x.v).includes(n)) && !String(x.v).includes(ctx.name) && !String(x.v).includes((ctx.first || '') + ' ' + (ctx.name || '').split(' ').slice(-1)[0]));
            if (!pool.length) return pick([`Nothing worth the telling. Quiet in ${ctx.place}.`, "Not that I've heard. You'd do better at the tavern."], seed);
            const h = pick(pool, seed); ctx._picked = h;
            const lead = { saw: 'I saw it myself: ', crier: 'The crier was calling it: ', watch: 'The watch put it about that ', bard: 'There was a bard at the tavern singing it: ', broadsheet: 'It was in the broadsheet: ', merchant: 'A merchant passing through told it: ', rumour: pick(['Heard tell that ', "They're saying ", 'Word is, '], seed + 1) }[h.src] || 'Word is, ';
            const v = String(h.src === 'bard' || h.src === 'broadsheet' ? h.v : O.Chronicle.lower(h.v)).replace(/^(hear ye,? hear ye!?\s*)?by order of the council:\s*/i, '');
            return lead + v;
          }
          const rumours = ctx.memories.filter((m) => !/^Sent to fetch|Shared a jug/.test(m)).concat(ctx.news).filter((m) => !String(m).includes(ctx.name));
          if (!rumours.length) return `Nothing happens in ${ctx.place}. That's why we like it.`;
          const r = pick(rumours, seed);
          return pick(['Heard tell that ', 'They\'re saying ', 'Word is, '], seed + 1) + O.Chronicle.lower(r);
        }
        case 'family': {
          const f = ctx.family;
          const anc = ctx.ancestors && ctx.ancestors.length && seed % 2 === 0 ? ctx.ancestors[seed % ctx.ancestors.length] : null;
          if (anc) return anc.mem ? `My ${anc.rel}, ${anc.first}, was ${anc.mem.title || 'well known here'}. There's a stone for ${anc.rel === 'mother' || anc.rel === 'wife' ? 'her' : 'him'} by the chapel. ${anc.mem.deeds && anc.mem.deeds.length ? 'People still talk of it.' : 'We were proud.'}` : pick([`I think of my ${anc.rel} often. ${anc.first} is buried in the chapel yard.`, `My ${anc.rel}, God rest ${anc.rel === 'mother' || anc.rel === 'wife' ? 'her' : 'him'}, used to say this place would be the death of us. ${anc.first} was right in the end.`], seed);
          const F = ctx.fam2 || { kids: [], parents: [], sibs: [] }, list = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
          const small = F.kids.filter((k) => k.age < 16), grown = F.kids.filter((k) => k.age >= 16);
          const bits = [];
          if (F.spouse) bits.push(`My ${ctx.sex === 'm' ? 'wife' : 'husband'}, ${F.spouse.first}`);
          else if (F.widowed) bits.push(`I'm ${ctx.sex === 'm' ? 'a widower' : 'a widow'}, God rest ${ctx.sex === 'm' ? 'her' : 'him'}`);
          const our = F.spouse ? 'our' : 'my'; if (small.length) bits.push(`${small.every((k) => k.age < 11) ? (small.length === 1 ? `${our} little one` : `${our} little ones`) : small.length === 1 ? `${our} ${small[0].sex === 'm' ? 'boy' : 'girl'}` : `${our} children`}, ${list(small.map((k) => k.first))}`);
          if (grown.length) bits.push(grown.length === 1 ? `${F.spouse ? 'our' : 'my'} ${grown[0].sex === 'm' ? 'son' : 'daughter'} ${grown[0].first}, grown now` : `${grown.length} grown children, ${list(grown.map((k) => k.first))}`);
          if (!F.spouse && !F.kids.length && F.parents.length) bits.push(`I live with my ${F.parents.length === 2 ? 'mother and father' : F.parents[0].sex === 'm' ? 'father' : 'mother'}, ${list(F.parents.map((q) => q.first))}`);
          else if (F.kids.length && F.parents.length) bits.push(`and my old ${F.parents[0].sex === 'm' ? 'father' : 'mother'} ${F.parents[0].first} lives with us`);
          if (F.sibs.length && ctx.age < 30 && !F.spouse) bits.push(`${F.sibs.length === 1 ? (F.sibs[0].sex === 'm' ? 'my brother' : 'my sister') : 'my brothers and sisters'}, ${list(F.sibs.map((q) => q.first))}`);
          if (!bits.length) return pick(['Just me. Quieter that way.', 'No family to speak of. Not here.'], seed);
          const s0 = bits.join('; '); return s0.charAt(0).toUpperCase() + s0.slice(1) + '.';
        }
        default: return '…';
      }
    },
  };

  const RemoteProvider = {
    name: 'remote',
    enabled: false,
    endpoint: '/api/npc-dialogue', // game server proxy that holds the API key; never call the LLM from the client
    async respond(ctx, playerLine) {
      if (!this.enabled) throw new Error('Remote dialogue is not enabled in this build');
      const res = await fetch(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: remotePrompt(ctx), line: playerLine, voice: voiceFor(ctx) }) });
      return res.json(); // { text, audioUrl }
    },
  };

  // Voice selection for text-to-speech: stable per NPC so a person always sounds the same.
  function voiceFor(ctx) {
    const pitch = ctx.stage === 'child' || ctx.stage === 'olderChild' ? 'young' : ctx.stage === 'elder' ? 'old' : 'adult';
    return { sex: ctx.sex, age: pitch, temperament: ctx.traits.includes('hostile') ? 'gruff' : ctx.traits.includes('friendly') ? 'warm' : 'neutral' };
  }

  O.Dialogue = { buildContext, remotePrompt, LocalProvider, RemoteProvider, voiceFor, provider: LocalProvider };
})();
