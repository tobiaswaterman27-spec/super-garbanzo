// The guilds and the road to mastery. Every trade in a town belongs to its guild: the Bakers, the Smiths,
// the Clothworkers and the rest, each with its warden and its masters. Bind yourself to a master as an
// apprentice by indenture; serve your days and learn, and your master gives you your journeyman's papers
// and a journeyman's book. Then go and work in other towns: a master of the trade there signs your book.
// With two signatures and real skill, bring your masterpiece before the guild; if it passes, you are a
// master, free to keep a shop of that trade. The guilds hold the towns' trades fast: an outsider keeping a
// shop of a guild's trade, or a member selling under the guild's price, is fined by the warden. Each year
// the masters choose a warden, and it may be you. Guilds pay their dues, feast, and give to the church.
'use strict';
(function () {
  const GUILD = { bakery: 'Bakers', smithy: 'Smiths', armourer: 'Smiths', carpenter: 'Carpenters', cooper: 'Carpenters', wainwright: 'Carpenters', boatyard: 'Carpenters', weaver: 'Clothworkers', tailor: 'Clothworkers', dyer: 'Clothworkers', butcher: 'Butchers', tavern: 'Brewers', brewery: 'Brewers', builder: 'Masons', chandler: 'Chandlers', apothecary: 'Apothecaries', store: 'Merchants', warehouse: 'Merchants', cobbler: 'Cordwainers', tanner: 'Cordwainers', potter: 'Potters', glazier: 'Glaziers', fletcher: 'Bowyers', mill: 'Millers' };
  const SKILL = (t) => (O.Work && O.Work.SKILL_OF && O.Work.SKILL_OF[t]) || null;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS, SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    G.jbook = G.jbook || { name: 'Journeyman\'s book', base: 1, unit: 'book', slots: 1 };
    const mine = () => (PS.guildRanks = PS.guildRanks || {}); // guild name -> { rank, master, place, from, until, stamps:[places], wardenOf }
    const guildOf = (s, q) => { const bz = q.job && s.biz.get(q.job.biz); return bz && GUILD[bz.type] ? { name: GUILD[bz.type], bz } : null; };
    const isMaster = (s, q) => { const g = guildOf(s, q); if (!g) return false; const bz = g.bz; return bz.owner === q.id || bz.workers[0] === q.id || (q.job.role && bz.def.jobs && bz.def.jobs[0][0] === q.job.role); };
    // the guilds of a town, gathered when first asked for
    const guilds = (s) => {
      if (s._guilds && s._guildsDay === s.day) return s._guilds; const out = s._guilds || {};
      for (const bz of s.biz.values()) { const n = GUILD[bz.type]; if (!n) continue; const g = out[n] || (out[n] = { name: n, warden: null, chest: 40, floor: 0.85, masters: [] }); }
      for (const g of Object.values(out)) { g.masters = s.people.filter((q) => q.alive !== false && guildOf(s, q)?.name === g.name && isMaster(s, q)).map((q) => q.id); if (g.warden !== 'player' && !g.masters.includes(g.warden)) g.warden = g.masters.slice().sort((a, b) => (s.byId.get(b).age || 0) - (s.byId.get(a).age || 0))[0] || null; }
      s._guilds = out; s._guildsDay = s.day; return out;
    };
    O.Guilds = { guilds, GUILD };
    const skillFor = (n) => { const t = Object.keys(GUILD).find((k) => GUILD[k] === n && SKILL(k)); return t ? (PS.skills[SKILL(t)] || 0) : 0; };

    // ---------------------------------------------------------------- the ladder, in talk
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a) {
      const A = a && a.do; if (!['indenture', 'make_journeyman', 'sign_book', 'judge_masterpiece', 'join_guild', 'guild_fine'].includes(A)) return base.apply(this, arguments);
      const g = guildOf(s, q); if (!g || !isMaster(s, q)) return null; const R = mine(), cur0 = R[g.name];
      if (A === 'indenture') {
        if (cur0) return `You are already ${cur0.rank === 'master' ? 'a master' : 'bound'} in the ${g.name}' guild.`;
        R[g.name] = { rank: 'apprentice', master: q.id, place: s.world.placeId, from: s.day, until: s.day + 14, stamps: [] };
        PS.job = { biz: g.bz.id, place: s.world.placeId, apprentice: true, day: s.day, hoursToday: 0 };
        s.remember(q, 'Took the stranger on as my apprentice, bound by indenture.', 'work', 1.5, 0);
        return `${q.first} has the indenture written out and you both make your mark. You are apprenticed to the ${g.name} for two weeks at least.`;
      }
      if (A === 'make_journeyman') {
        if (!cur0 || cur0.rank !== 'apprentice' || cur0.master !== q.id) return null;
        if (s.day < cur0.until) return `Your indenture has ${cur0.until - s.day} more days to run.`;
        if (skillFor(g.name) < 0.35) return 'You haven\'t the skill yet. Keep at it.';
        cur0.rank = 'journeyman'; cur0.from = s.day; PS.add('jbook');
        return `${q.first} gives you your journeyman's papers and a little book for other masters to sign. Go and work in other towns.`;
      }
      if (A === 'sign_book') {
        if (!cur0 || cur0.rank !== 'journeyman' || !PS.items.includes('jbook')) return null;
        if (s.world.placeId === cur0.place || cur0.stamps.includes(s.world.placeId)) return 'This town can\'t sign your book: work in another.';
        const worked = Object.entries(PS.workDays || {}).some(([k, v]) => k.endsWith('@' + s.world.placeId) && v >= 2);
        if (!worked) return 'Work here a couple of days first, and then we\'ll see.';
        cur0.stamps.push(s.world.placeId); return `${q.first} signs your book: you've worked well in ${s.world.name}. (${cur0.stamps.length} signature${cur0.stamps.length > 1 ? 's' : ''})`;
      }
      if (A === 'judge_masterpiece') {
        if (!cur0 || cur0.rank !== 'journeyman') return null;
        if (cur0.stamps.length < 2) return 'Two masters in other towns must sign your book first.';
        const fee = 20; if (PS.money < fee) return `The guild's fee for judging is ₳${fee}.`;
        PS.money -= fee; guilds(s)[g.name].chest += fee;
        const sk = skillFor(g.name); game.player.anim = 'place'; setTimeout(() => { game.player.anim = 'idle'; }, 1500);
        if (sk < 0.6 || Math.random() > 0.4 + sk * 0.6) return `The masters turn your masterpiece over and over, and shake their heads. Not yet. Practise and come again.`;
        cur0.rank = 'master'; cur0.place = s.world.placeId; PS.rep.merchant = Math.min(1, PS.rep.merchant + 0.1);
        s.log(`The ${g.name}' guild has made the newcomer a master of the trade.`, 'economy');
        O.Chronicle && O.Chronicle.deed && O.Chronicle.deed(s, `The newcomer was made a master of the ${g.name}.`, `You are a master of the ${g.name}' guild.`, 'player', 3, true);
        return `Your masterpiece passes. The masters stand and raise their cups: you are a master of the ${g.name}.`;
      }
      if (A === 'join_guild') {
        const fee = O.clamp(Math.round(Number(a.fee) || 30), 0, 100);
        if (cur0 && cur0.rank === 'master') return 'You are a master already.';
        if (skillFor(g.name) < 0.65) return 'The guild only takes masters who can show the skill.';
        if (PS.money < fee) return `The entry fine is ₳${fee}.`; PS.money -= fee; guilds(s)[g.name].chest += fee;
        R[g.name] = { rank: 'master', place: s.world.placeId, from: s.day, stamps: [] }; return `You pay ₳${fee} and are entered on the ${g.name}' roll as a master.`;
      }
      return null;
    };
    (O.extraActs = O.extraActs || []).push('indenture {} (masters: take the player as apprentice by indenture)', 'make_journeyman {} (their master, when the indenture is served and they have the skill)', 'sign_book {} (a master in another town where the journeyman has worked)', 'judge_masterpiece {} (masters: judge the journeyman\'s masterpiece before the guild)', 'join_guild {"fee"} (masters: admit a skilled master from elsewhere for an entry fine)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const g = guildOf(s, q); if (!g) return ''; const G0 = guilds(s)[g.name], R = mine()[g.name];
      const w = G0.warden === 'player' ? 'the player' : (s.byId.get(G0.warden) || {}).name || 'nobody yet';
      let t = `Your trade is ruled by the ${g.name}' guild here (warden: ${w}); it sets the least price and keeps outsiders from keeping shop.`;
      if (R) t += R.rank === 'apprentice' && R.master === q.id ? ` The player is your bound apprentice (${Math.max(0, R.until - s.day)} days left on the indenture).` : ` The player is a ${R.rank} of the ${g.name}${R.stamps && R.stamps.length ? ` with ${R.stamps.length} signature(s) in their book` : ''}.`;
      return t;
    });

    // ---------------------------------------------------------------- the guild's grip on the town
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments); const G0 = guilds(this), here = this.world.placeId, R = mine();
      // a shop of a guild's trade kept by an outsider, or sold under the guild's price
      if (this.weekday === 1) for (const b of this.world.buildings) {
        if (b.owner?.kind !== 'player') continue; const bz = this.biz.get(b.id), n = bz && GUILD[bz.type]; if (!n || !G0[n]) continue;
        const member = R[n] && R[n].rank === 'master', under = (bz.markup || 1) < G0[n].floor;
        if (member && !under) continue; const fine = member ? 8 : 15, warden = this.byId.get(G0[n].warden);
        const paid = Math.min(PS.money, fine); PS.money -= paid; G0[n].chest += paid;
        if (this === cur()) { if (warden && O.npcUI && !O.npcUI.talking() && !warden.agent.hidden && Math.hypot(warden.agent.x - game.player.x, warden.agent.y - game.player.y) < 300) O.npcUI.startFrom(warden, member ? `You're selling under the guild's price at ${bz.name}. That's ₳${fine}, and keep to the price.` : `${bz.name} is a ${n.toLowerCase()}' trade and you're no master of ours. ₳${fine} to the guild, every week, until you are.`); else say(`The ${n}' warden fines you ₳${paid} for ${member ? 'selling under the guild price' : 'keeping a guild trade without being a master'} at ${bz.name}.`, 'bad'); }
      }
      // the year's warden, chosen by the masters; the dues; gifts to the church
      if (this.weather.dayOfSeason === 1 && this.season === 'spring') for (const g of Object.values(G0)) {
        const me = R[g.name] && R[g.name].rank === 'master' && R[g.name].place === here;
        if (me && (PS.rep.merchant || 0) > 0.3 && Math.random() < 0.35 + (PS.rep.merchant || 0) * 0.4) { g.warden = 'player'; R[g.name].wardenOf = here; this.log(`The masters of the ${g.name} have chosen the newcomer as their warden for the year.`, 'economy'); if (this === cur()) say(`You are chosen warden of the ${g.name}' guild for the year. The guild's chest and its quarrels are yours.`); }
        else if (g.warden === 'player') { g.warden = null; if (R[g.name]) R[g.name].wardenOf = null; }
      }
      if (this.weekday === 6) for (const g of Object.values(G0)) {
        g.chest += g.masters.length * 2; for (const id of g.masters) { const hh = this.household(this.byId.get(id)); if (hh) hh.money = Math.max(0, hh.money - 2); }
        if (g.chest > 60) { g.chest -= 20; const P = this.kingdom && this.kingdom.place ? this.kingdom.place(here) : null; if (P) P.happiness = Math.min(1, (P.happiness ?? 0.5) + 0.004); if (Math.random() < 0.3) this.log(`The ${g.name}' guild has paid for candles and a new altar cloth at the chapel.`, 'social'); }
        if (g.warden === 'player' && this === cur()) { const share = Math.round(g.chest * 0.1); g.chest -= share; PS.money += share; say(`As warden of the ${g.name} you draw ₳${share} from the guild chest for your trouble.`); }
      }
      return r;
    };
    // as warden: set the guild's least price, and feast the masters
    const wardenPanel = () => {
      const s = cur(), G0 = guilds(s), mineHere = Object.values(G0).filter((g) => g.warden === 'player'); if (!mineHere.length) return say('You are warden of no guild here.');
      const g = mineHere[0];
      O.Panels.open(`The ${g.name}' guild`, `<p>Masters: ${g.masters.map((id) => (s.byId.get(id) || {}).name).filter(Boolean).join(', ') || 'none'}. Chest: ${O.money(g.chest)}. Least price: ${Math.round(g.floor * 100)}% of the fair price.</p>
        <div class="topics"><button data-f="up">Raise the guild price</button><button data-f="down">Lower it</button><button data-f="feast">Feast the masters (${O.money(30)} from the chest)</button><button data-f="council">Petition the council for lower market tolls</button></div>`, (r) => {
        r.querySelector('[data-f=up]').onclick = () => { g.floor = Math.min(1.1, g.floor + 0.05); O.Panels.close(); say('The guild price goes up. Buyers grumble; masters smile.'); };
        r.querySelector('[data-f=down]').onclick = () => { g.floor = Math.max(0.6, g.floor - 0.05); O.Panels.close(); say('The guild price comes down. The town is glad of it.'); };
        r.querySelector('[data-f=feast]').onclick = () => { if (g.chest < 30) return O.Panels.toast('The chest is too thin.', 'bad'); g.chest -= 30; for (const id of g.masters) { const q = s.byId.get(id); if (q) s.relate(q, { id: 0 }, 0.08); } O.Panels.close(); say('The masters feast at the guild\'s cost, and drink your health.'); };
        r.querySelector('[data-f=council]').onclick = () => { O.Panels.close(); const ok = Math.random() < 0.3 + (PS.rep.merchant || 0) * 0.5; if (ok) { if (s.treasury) s.treasury.cash -= 20; for (const id of g.masters) { const q = s.byId.get(id); if (q) s.relate(q, { id: 0 }, 0.06); } s.log(`At the ${g.name}' petition, the council has lowered the market tolls.`, 'politics'); say('The council gives way: the tolls come down. The masters are delighted.'); } else say('The council hears you out and does nothing. The masters mutter.', 'bad'); };
      });
    };
    O.wardenPanel = wardenPanel;
    (O.sceneMore = O.sceneMore || []).push(() => { const s = cur(), sc = game.scene; if (!s || !sc) return null; const bz = s.biz.get((sc.b.parent || sc.b).id), n = bz && GUILD[bz.type]; if (!n || guilds(s)[n]?.warden !== 'player') return null; return { type: 'custom', d: 40, x: game.player.x, y: game.player.y - 40, label: `The ${n}' guild business`, act: wardenPanel }; });
    (O.extraActs = O.extraActs || []).push('open_guild {} (anyone: when the player, as warden, asks to see the guild\'s business)');
    const base2 = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a) { if (a && a.do === 'open_guild') { if (!Object.values(guilds(s)).some((g) => g.warden === 'player')) return null; setTimeout(wardenPanel, 600); return 'The guild\'s book and chest are brought out.'; } return base2.apply(this, arguments); };
  }
  O.GuildsSetup = { setup };
})();
