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

  function buildContext(sim, p, playerState) {
    const hh = sim.household(p);
    const job = p.job ? (p.job.biz ? `${p.job.role} at ${sim.biz.get(p.job.biz).name}` : p.job.role) : p.age < 16 ? 'a child' : 'out of work';
    const bake = sim.supplierOf('bakery');
    const opinion = p.rel.get(0) || { affinity: 0, familiar: 0 };
    return {
      name: p.name, age: p.age, sex: p.sex, stage: p.stage, job, traits: p.traits, goal: p.goal,
      mood: p.mood, hunger: Math.round(p.needs.hunger), energy: Math.round(p.needs.energy), social: Math.round(p.needs.social),
      householdMoney: Math.round(hh.money), pantry: { ...hh.pantry },
      skill: p.job ? Math.round((p.skills[p.job.role] || 0) * 100) : null,
      activity: p.activity?.act, place: sim.world.name,
      memories: p.memories.slice(0, 6).map((m) => m.text),
      family: { spouse: p.spouse ? sim.byId.get(p.spouse)?.name : null, children: (p.children || []).map((id) => sim.byId.get(id)?.first).filter(Boolean) },
      opinionOfPlayer: opinion, playerReputation: playerState?.reputation || { local: 0 },
      prices: bake ? { bread: sim.price(bake, 'bread') } : {},
      news: sim.history.filter((h) => h.kind !== 'day').slice(-4).map((h) => h.text),
      time: { day: sim.day, minute: Math.floor(sim.minute) },
    };
  }

  // A system prompt for a remote LLM, built from the same brief.
  function remotePrompt(ctx) {
    return [
      `You are ${ctx.name}, ${ctx.age}, ${ctx.job} in the medieval village of ${ctx.place}.`,
      `Personality: ${ctx.traits.join(', ')}. Your goal: ${ctx.goal || 'none in particular'}.`,
      `Right now: ${ctx.activity}. Hunger ${ctx.hunger}/100, energy ${ctx.energy}/100. Household purse ${ctx.householdMoney}d.`,
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
      if (ctx.stage === 'child' || ctx.stage === 'olderChild') return pick(['Are you a soldier? You look like a soldier.', "Mam says I'm not to talk to strangers.", 'Have you seen a dog with one ear? He\'s mine.'], seed);
      if (ctx.traits.includes('hostile') || a < -0.3) return pick(['What do you want?', "Keep walking, stranger.", "I've nothing for you."], seed);
      if (f > 0.3) return pick([`Back again? Good day to you.`, `Ah, it's you. Fair day.`], seed);
      if (ctx.traits.includes('suspicious')) return pick(["You're not from Ashford. What's your business?", 'Hm. Haven\'t seen you before.'], seed);
      return pick(['Good day to you.', "God keep you. Passing through?", 'Morning. Fine weather for it.', 'Well met, traveller.'], seed);
    },
    topic(ctx, topic, seed) {
      switch (topic) {
        case 'self': {
          if (ctx.hunger < 25) return pick(["Truth be told I've not eaten since yesterday.", 'Hungry. The pot was empty this morning.'], seed);
          if (ctx.energy < 25) return "Dead on my feet. I'll sleep well tonight.";
          const hard = ctx.memories.find((m) => /afford|couldn't|could only pay|nothing to eat|shut/.test(m));
          if (hard) return `Could be better. ${hard}`;
          if (ctx.householdMoney > 150) return pick(["Can't complain. Business has been kind.", 'Well enough, thank you. The purse is heavy for once.'], seed);
          return pick(['Well enough. Work, bread, sleep, same as anyone.', "I get by. Can't ask for more."], seed);
        }
        case 'work': {
          if (!ctx.skill && ctx.job === 'out of work') return pick(["I've no work. If you hear of any, tell me.", 'Nothing steady. I take what comes.'], seed);
          if (ctx.stage === 'child') return 'I help Mam. And I chase the geese.';
          const lvl = ctx.skill > 85 ? 'master' : ctx.skill > 65 ? 'expert' : ctx.skill > 45 ? 'skilled' : ctx.skill > 25 ? 'trained' : 'beginner';
          return `I'm ${ctx.job}. ${lvl === 'master' ? "Been at it long enough there's little left to teach me." : lvl === 'beginner' ? "Still learning. I spoil more than I'd like." : 'Steady work, honest hands.'}${ctx.goal ? ` One day I mean to ${ctx.goal}.` : ''}`;
        }
        case 'prices': {
          const b = ctx.prices.bread;
          if (b == null) return "Couldn't tell you.";
          if (b >= 4) return `Bread's ${b}d a loaf now. Robbery. Something's wrong at the mill, or the farm.`;
          if (b <= 1) return `Bread's cheap, ${b}d. Good harvest, they say.`;
          return `Bread's ${b}d a loaf at Hobb's. Same as ever, near enough.`;
        }
        case 'news': {
          const rumours = ctx.memories.filter((m) => !/^Sent to fetch|Shared a jug/.test(m)).concat(ctx.news);
          if (!rumours.length) return 'Nothing happens in Ashford. That\'s why we like it.';
          const r = pick(rumours, seed);
          return pick(['Heard tell that ', 'They\'re saying ', 'Word is, '], seed + 1) + r.charAt(0).toLowerCase() + r.slice(1);
        }
        case 'family': {
          const f = ctx.family;
          if (!f.spouse && !f.children.length) return pick(['Just me. Quieter that way.', 'No family to speak of.'], seed);
          return `${f.spouse ? `My ${ctx.sex === 'm' ? 'wife' : 'husband'}, ${f.spouse}` : 'Just me'}${f.children.length ? `, and the little ones: ${f.children.join(', ')}` : ''}.`;
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
