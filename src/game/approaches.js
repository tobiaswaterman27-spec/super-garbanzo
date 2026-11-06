// People come to you. Now and then, someone near you who has a reason walks over and starts talking:
// - a neighbour short of money asks to borrow a little till market day;
// - someone busy asks you to fetch them a thing from a shop, coin in hand (bring it and hand it over);
// - someone with a trouble on their mind asks what you'd do;
// - a friend warns you: the watch have your description, or a gang is asking after you;
// - a friend asks you to supper;
// - someone with news can't keep it in;
// - a maker offers you something they've made, cheap;
// - a young hothead challenges you to a race to the well;
// - someone you helped thanks you again; someone you wronged has it out with you.
// After the first words it's an ordinary talk: answer as you like.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const rel = (q) => q.rel.get(0) || { affinity: 0, familiar: 0 };
    const near = (q, r) => q && q.agent && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < r;
    const busy = (q) => q.errand || q.agent.frozen || q._scene || q.visitor || q.age < 8 || q.activity?.act === 'sleep' || q.job?.onShift || q.homefront;
    const mem = (q, re) => (q.memories || []).slice(-20).reverse().find((m) => re.test(m.text || m.t || ''));
    const OPENERS = [
      { k: 'borrow', w: 1, fit: (s, q) => rel(q).familiar > 0.2 && rel(q).affinity > 0.1 && (s.household(q)?.money || 0) < 8 && !(PS.lent || []).some((x) => x.who === q.id),
        say: (s, q) => `Forgive me asking. Could you lend me ${pick([3, 4, 5, 6])} aurins till market day? We've nothing in the house, and I'll pay you back, I swear it.` },
      { k: 'fetch', w: 1, fit: (s, q) => rel(q).affinity > -0.1 && (s.household(q)?.money || 0) > 12 && !PS.fetchFor && q.age >= 30,
        say: (s, q) => { const g = pick(['bread', 'candles', 'cheese', 'ale', 'salt'].filter((x) => G[x])); const shop = [...s.biz.values()].find((z) => (z.def.sells || []).includes(g)); if (!shop) return null; const price = Math.max(2, Math.round((s.price ? s.price(shop, g) : G[g].base) * 1.3)); const hh = s.household(q); hh.money -= price; PS.money += price; PS.fetchFor = { q: q.id, g, paid: price, day: s.day, place: s.world.placeId, shop: shop.name }; O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(q, 'player', 'coin'); O.addLead && O.addLead({ place: s.world.placeId, id: q.id, until: (s.day + 1) * 1440 + 1200, why: 'fetch', label: `Bring ${q.first} ${G[g].name.toLowerCase()} from ${shop.name}` }); return `My legs aren't what they were. Would you fetch me ${G[g].name.toLowerCase()} from ${shop.name}? Here's ₳${price}, and something for your trouble when you bring it.`; } },
      { k: 'advice', w: 1, fit: (s, q) => rel(q).familiar > 0.25 && !!mem(q, /owe|quarrel|sick|lost|debt|turned off|wouldn't have me|grudge|walked out|shamed/i),
        say: (s, q) => { const m = mem(q, /owe|quarrel|sick|lost|debt|turned off|wouldn't have me|grudge|walked out|shamed/i); return `Can I ask you something? ${(m.text || m.t).replace(/\.$/, '')}. What would you do, in my place?`; } },
      { k: 'warn', w: 2, fit: (s, q) => rel(q).affinity > 0.35 && ((PS.wantedLevel && PS.wantedLevel() >= 1) || (s.gangs || []).some((g) => g.rel && g.rel.player === 'enemy')),
        say: (s, q) => (PS.wantedLevel && PS.wantedLevel() >= 1 ? 'Keep your head down. The watch have your description; I heard the sergeant read it out at the Watch House.' : `Mind yourself after dark. ${(s.gangs || []).find((g) => g.rel && g.rel.player === 'enemy')?.name || 'Those gang lads'} have been asking where you sleep.`) },
      { k: 'supper', w: 1, fit: (s, q) => rel(q).affinity > 0.45 && q.home != null && s.minute / 60 < 16,
        say: (s, q) => `Come and eat with us tonight, at our house. Seven o'clock. It's only pottage, but there's plenty of it.` },
      { k: 'gossip', w: 2, fit: (s, q) => rel(q).familiar > 0.1 && (q.beliefs || []).some((b) => b.src === 'rumour' && s.day - (b.day || 0) < 4),
        say: (s, q) => { const b = (q.beliefs || []).find((x) => x.src === 'rumour'); return `Have you heard? ${b.t.replace(/^Heard from [^:]+: /, '')}`; } },
      { k: 'wares', w: 1, fit: (s, q) => { const bz = q.job && s.biz.get(q.job.biz); return bz && (bz.def.sells || []).some((g) => (bz.stock[g] || 0) > 3 && !/^fx_|^wl_|^fl_/.test(g)) && q.job.role !== 'apprentice'; },
        say: (s, q) => { const bz = s.biz.get(q.job.biz), g = pick(bz.def.sells.filter((x) => (bz.stock[x] || 0) > 3 && G[x])); return g ? `You look like someone who'd want good ${G[g].name.toLowerCase()}. I'll let you have it under the shop price, today only. Interested?` : null; } },
      { k: 'race', w: 1, fit: (s, q) => q.age >= 14 && q.age <= 22 && (q.traits.includes('brave') || q.traits.includes('risk-taking') || q.traits.includes('competitive')),
        say: (s, q) => { PS.race = { q: q.id, day: s.day, place: s.world.placeId, start: performance.now() }; const w = s.world.props.find((p) => p.kind === 'well'); if (w) PS.race.to = [w.x, w.y]; return `Race you to the well! First there wins. Go!`; } },
      { k: 'thanks', w: 1, fit: (s, q) => rel(q).affinity > 0.4 && !!mem(q, /stranger (fed|brought|carried|gave|saved|helped)|player (fed|brought|helped)/i),
        say: (s, q) => `I never thanked you properly. ${(mem(q, /stranger (fed|brought|carried|gave|saved|helped)|player (fed|brought|helped)/i).text || '').replace(/^The stranger /, 'You ').replace(/\.$/, '')}. I won't forget it.` },
      { k: 'reckoning', w: 2, fit: (s, q) => rel(q).affinity < -0.35 && q.age >= 16 && !!mem(q, /stranger (punched|robbed|struck|stole|walked into|beat|cheated)/i),
        say: (s, q) => `You. ${(mem(q, /stranger (punched|robbed|struck|stole|walked into|beat|cheated)/i).text || '').replace(/^.*?the stranger/i, 'You').replace(/\.$/, '')}. Did you think I'd forget? I want it put right.` },
    ];
    const last = new Map(); let next = 40;
    game.hooks.update.push((dt) => {
      next -= dt; if (next > 0) return; next = 55 + Math.random() * 50;
      const s = cur(); if (!s || game.scene || game.player.locked || (O.npcUI && O.npcUI.talking && O.npcUI.talking()) || (O.UI.dialogOpen && O.UI.dialogOpen()) || O.panelOpen) return;
      const h = s.minute / 60; if (h < 7 || h > 21) return;
      const cands = s.people.filter((q) => near(q, 230) && !busy(q) && !(last.get(q.id) > s.day * 1440 + s.minute - 1440));
      const options = [];
      for (const q of cands) for (const o of OPENERS) { try { if (o.fit(s, q)) for (let i = 0; i < o.w; i++) options.push([q, o]); } catch (e) { /* */ } }
      if (!options.length) return;
      const [q, o] = pick(options); let line = null; try { line = o.say(s, q); } catch (e) { console.error(e); }
      if (!line) return;
      last.set(q.id, s.day * 1440 + s.minute); q._approach = o.k;
      const go = () => { if (O.npcUI && !O.npcUI.talking()) O.npcUI.startFrom(q, line); };
      if (O.Errands && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) > 50) O.Errands.send(s, q, [Math.floor(game.player.x / T) + 1, Math.floor(game.player.y / T)], { anim: 'wave', secs: 0.6, giveUp: 25, after: go }); else go();
    });
    // the fetched thing, handed over
    (O.onGift = O.onGift || []).push((s, q, o) => {
      const F = PS.fetchFor; if (!F || F.q !== q.id || o.g !== F.g) return;
      PS.fetchFor = null; const tip = 2 + Math.floor(Math.random() * 3), hh = s.household(q); if (hh && hh.money >= tip) { hh.money -= tip; PS.money += tip; }
      s.relate(q, { id: 0 }, 0.2); s.remember(q, `The stranger fetched me ${G[o.g].name.toLowerCase()} from the shop.`, 'social', 1.5); O.dropLead && O.dropLead((l) => l.why === 'fetch');
      O.UI.say(`${q.first} thanks you and gives you ₳${tip} for your trouble.`, 'good');
    });
    game.hooks.update.push(() => { const F = PS.fetchFor, s = cur(); if (F && s && s.day - F.day > 1) { PS.fetchFor = null; const q = s.byId.get(F.q); if (q) { s.relate(q, { id: 0 }, -0.3); s.remember(q, `The stranger took ₳${F.paid} to fetch me ${G[F.g]?.name.toLowerCase() || 'something'} and never came back.`, 'grudge', 2); } } });
    // the race
    let rt = 0;
    game.hooks.update.push((dt) => {
      const R = PS.race; if (!R) return; rt -= dt; if (rt > 0) return; rt = 0.3;
      const s = cur(), q = s.byId.get(R.q); if (!q || !R.to || game.scene) { PS.race = null; return; }
      if (!R.sent) { R.sent = true; if (O.npcUI && O.npcUI.talking()) O.npcUI.closeTalk(); O.Errands && O.Errands.send(s, q, [Math.floor(R.to[0] / T), Math.floor(R.to[1] / T) + 1], { anim: 'celebrate', secs: 3, giveUp: 60 }); q.agent.runFast = true; }
      const mine = Math.hypot(game.player.x - R.to[0], game.player.y - R.to[1]), theirs = Math.hypot(q.agent.x - R.to[0], q.agent.y - R.to[1]);
      if (mine < 30 || theirs < 30) { const won = mine < 30 && mine <= theirs; PS.race = null; O.Speech && O.Speech.say(q, won ? pick(['You cheated! Again tomorrow.', 'Fast for an old one!', 'Curse you, you\'re quick.']) : pick(['Ha! Too slow!', 'Beat you!', 'I win! I always win!']), 2.5); s.relate(q, { id: 0 }, won ? 0.12 : 0.06); if (won) { PS.skills.running = Math.min(1, (PS.skills.running || 0) + 0.03); } O.UI.say(won ? `You beat ${q.first} to the well.` : `${q.first} beats you to the well.`, 'note'); }
      else if (performance.now() - R.start > 60000) PS.race = null;
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const k = q._approach; if (!k) return ''; q._approach = null; return { borrow: 'You came over to ask the player to lend you a few aurins (use the borrow act if they agree to lend, with the amount).', fetch: `You gave the player coin to fetch you ${G[PS.fetchFor?.g]?.name?.toLowerCase() || 'something'} from the shop.`, advice: 'You came to ask the player for advice about your trouble; listen and react to what they say.', supper: 'You came to invite the player to supper at your house tonight at seven (use the invite act with the place and hour if they say yes).', wares: 'You came to offer the player some of your goods under the shop price (use the sell act if they agree on a price).', reckoning: 'You came to have it out with the player over what they did to you. You want an apology, or amends; you may come to blows.', race: 'You challenged the player to a race to the well.' }[k] || ''; });
    O.Approaches = { OPENERS, force: (k) => { const s = cur(); const o = OPENERS.find((x) => x.k === k); const q = s.people.find((z) => near(z, 400) && !busy(z) && (() => { try { return o.fit(s, z); } catch (e) { return false; } })()); if (!q) return null; const line = o.say(s, q); if (line) { q._approach = k; O.npcUI.startFrom(q, line); } return q && line ? q.first + ': ' + line : null; } };
  }
  O.ApproachesSetup = { setup };
})();
