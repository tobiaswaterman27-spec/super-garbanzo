// Ruling as monarch. With the crown (or as consort) the K key opens the Crown: the crown tax, the
// prisoners in this town's cells (pardon them, or lengthen their term, or banish them), titles to
// grant (a knighthood for someone who has earned it), works to order from the treasury (alms for the
// poor, a granary, the walls, the roads), and war and peace. And when you sit on the throne in the
// hours of court, petitioners come before you one by one and you decide.
'use strict';
(function () {
  function setup(game, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t)), money = (n) => O.money(Math.round(n));
    const K = () => O.SimRef.home.kingdom;
    const crowned = () => (PS.posts || []).some((e) => e.role === 'monarch' || e.role === 'consort');
    O.crowned = crowned;
    const placeOf = (s) => K().places.find((x) => x.id === s.world.placeId) || null;

    // ---------------------------------------------------------------- the Crown panel
    function open(tab = 'realm') {
      if (!crowned()) return say('Only the monarch rules the realm.', 'bad');
      const k = K(), s = cur(), pl = placeOf(s), W = k.war || { phase: 'peace' };
      const prisoners = s.people.filter((q) => q.task?.act === 'jailed' || q.sentence && q.jailUntil > s.day);
      const worthy = s.people.filter((q) => q.age >= 21 && !q.title && !q.royal && !q.gang && !q.visitor && ((q.rel.get(0)?.affinity || 0) > 0.3 || (q.job && /captain|steward|chamberlain|master|knight|sergeant/.test(q.job.role)))).slice(0, 8);
      const tabs = [['realm', 'The realm'], ['justice', 'Justice'], ['honours', 'Honours'], ['works', 'Works'], ['fest', 'Festivities'], ['war', 'War and peace']];
      let body = '';
      if (tab === 'realm') {
        const avg = (f) => Math.round(k.places.reduce((a, p) => a + (p[f] || 0), 0) / Math.max(1, k.places.length) * 100);
        body = `<div class="kv"><div><span class="lbl">Royal treasury</span><b>${money(k.treasury)}</b></div><div><span class="lbl">Crown tax</span><b>${Math.round(k.taxRate * 100)}%</b><small><button data-tax="-1">Lower</button> <button data-tax="1">Raise</button></small></div><div><span class="lbl">The realm's contentment</span><b>${avg('happiness')}%</b><small>fed ${avg('food')}% · crime ${avg('crime')}%</small></div><div><span class="lbl">${esc(s.world.name)}</span><b>${pl ? Math.round((pl.happiness || 0) * 100) + '% content' : ''}</b></div></div><p class="caption">A higher crown tax fills the treasury and empties the people's patience. The tax is gathered weekly from every town.</p>`;
      } else if (tab === 'justice') {
        body = prisoners.length ? `<table><thead><tr><th>Prisoner</th><th>Crime</th><th class="n">Days left</th><th></th></tr></thead><tbody>${prisoners.map((q) => `<tr><td>${esc(q.name)}</td><td>${esc(q.sentence?.crime || 'held')}</td><td class="n">${Math.max(0, (q.jailUntil || s.day) - s.day)}</td><td><button data-pardon="${q.id}">Pardon</button> ${q.sentence?.death ? '' : `<button data-block="${q.id}">To the block</button> `}<button data-longer="${q.id}">Seven days more</button> <button data-banish="${q.id}">Banish</button></td></tr>`).join('')}</tbody></table>` : `<p>The cells of ${esc(s.world.name)} are empty.</p>`;
        body += '<p class="caption">A pardon is popular with the prisoner\'s kin; harshness is popular with the victims and the watch.</p>';
      } else if (tab === 'honours') {
        body = worthy.length ? `<table><tbody>${worthy.map((q) => `<tr><td>${esc(q.name)}</td><td>${esc(q.job?.role || '')}</td><td><button data-knight="${q.id}">${q.sex === 'f' ? 'Make a dame' : 'Knight'}</button></td></tr>`).join('')}</tbody></table>` : '<p>Nobody here has yet earned an honour from you. Those who like you, and those who serve well (captains, stewards, masters), can be honoured.</p>';
      } else if (tab === 'works') {
        const W2 = [['alms', 'Alms for the poor of this town', 150], ['granary', 'A granary, against a hungry winter', 300], ['walls', 'Mend and raise the town walls', 450], ['roads', 'Mend the roads of the realm', 250], ['feast', 'A feast day for the town, at the crown\'s cost', 120]];
        body = `<table><tbody>${W2.map(([kk, l, c]) => `<tr><td>${esc(l)}</td><td class="n">${money(c)}</td><td><button data-work="${kk}" data-cost="${c}">Order it</button></td></tr>`).join('')}</tbody></table><p class="caption">Paid from the royal treasury (${money(k.treasury)}).</p>`;
      } else if (tab === 'fest') {
        const G = guests(), named = Object.keys(G.list).map((key) => { const id = +key.split(':')[1]; const q = key.startsWith((s.world.placeId || '') + ':') && s.byId.get(id); return q ? `<tr><td>${esc(q.name)}</td><td><button data-unlist="${key}">Remove</button></td></tr>` : ''; }).join('');
        body = `<p>Call a festivity for tomorrow in ${esc(s.world.name)}, at the crown's cost.</p><div class="topics"><button data-host="tournament">A tournament (₳150)</button><button data-host="fair">A fair (₳80)</button><button data-host="midwinter">A great feast (₳120)</button><button data-host="market">A market of travelling merchants (₳40)</button></div>${s.hosted && s.hosted.day >= s.day ? `<p class="caption">Called: ${esc(s.hosted.kind)} on day ${s.hosted.day}.</p>` : ''}
          <div class="lbl" style="margin-top:10px">The castle's guest list</div><div class="topics"><button data-mode="all" aria-pressed="${G.mode === 'all'}">Open to all</button><button data-mode="black" aria-pressed="${G.mode === 'black'}">All but the barred (blacklist)</button><button data-mode="white" aria-pressed="${G.mode === 'white'}">Only the invited (whitelist)</button></div>
          ${named ? `<table><tbody>${named}</tbody></table>` : '<p class="caption">Nobody on the list. Talk to anyone to invite them or bar them.</p>'}<p class="caption">${G.mode === 'white' ? 'Only those you invite (and the household) come to the castle and its feasts.' : G.mode === 'black' ? 'Those you bar are turned away from the castle and its feasts.' : 'Anyone may come.'}</p>`;
      } else if (tab === 'war') {
        body = W.phase === 'war' ? `<p>The realm is at war with ${esc(W.enemy?.name || W.enemy || 'the enemy')}. Battles fought: ${(W.battles || []).length}.</p><div class="topics"><button data-peace="1">Sue for peace (₳300 to the enemy)</button></div>` : `<p>The realm is at peace.</p><div class="topics">${(O.warFoes ? O.warFoes() : [{ key: '', name: 'the enemy' }]).map((f) => `<button data-war="${f.key}">Declare war on ${esc(f.name)}</button>`).join('')}</div><p class="caption">War raises the crown tax, calls men to arms and empties the treasury; victory brings glory and plunder.</p>`;
      }
      O.Panels.open('The Crown', `<nav class="tabs" style="margin-bottom:8px">${tabs.map(([t, l]) => `<button data-tab="${t}" aria-pressed="${t === tab}">${l}</button>`).join(' ')}</nav>${body}`, (r) => {
        r.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => open(b.dataset.tab));
        r.querySelectorAll('[data-tax]').forEach((b) => b.onclick = () => { O.jobEvent && O.jobEvent('decree'); k.taxRate = O.clamp(k.taxRate + +b.dataset.tax * 0.01, 0.02, 0.2); k.addNews && k.addNews(`By royal decree the crown tax is ${+b.dataset.tax > 0 ? 'raised' : 'lowered'} to ${Math.round(k.taxRate * 100)}%.`, 'politics'); for (const q of s.people) if (q.age >= 18 && s.rng.chance(0.2)) s.relate(q, { id: 0 }, +b.dataset.tax > 0 ? -0.05 : 0.04); open('realm'); });
        const who = (id) => s.byId.get(+id);
        r.querySelectorAll('[data-block]').forEach((b) => b.onclick = () => { O.jobEvent && O.jobEvent('decree'); const q = who(b.dataset.block); O.condemn(s, q, `${(q.sentence?.crime || 'their crimes').split(':')[0]}, by the crown's order`); PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.05); PS.rep.guard = Math.min(1, PS.rep.guard + 0.05); open('justice'); });
        r.querySelectorAll('[data-pardon]').forEach((b) => b.onclick = () => { O.jobEvent && O.jobEvent('decree'); const q = who(b.dataset.pardon); q.jailUntil = s.day; q.task = null; q.sentence = null; s.relate(q, { id: 0 }, 0.6); s.log(`By royal pardon ${q.name} walks free.`, 'crime'); s.remember(q, 'Pardoned by the monarch.', 'crime', 3, 0); open('justice'); });
        r.querySelectorAll('[data-longer]').forEach((b) => b.onclick = () => { O.jobEvent && O.jobEvent('decree'); const q = who(b.dataset.longer); q.jailUntil = (q.jailUntil || s.day) + 7; if (q.sentence) q.sentence.days += 7; s.relate(q, { id: 0 }, -0.4); s.log(`By the monarch's order ${q.name} will serve seven days more.`, 'crime'); open('justice'); });
        r.querySelectorAll('[data-banish]').forEach((b) => b.onclick = () => { O.jobEvent && O.jobEvent('decree'); const q = who(b.dataset.banish); q.task = { act: 'leave', outdoor: true, zone: 'east', emigrating: true }; q.jailUntil = s.day; q.sentence = null; s.log(`${q.name} is banished from ${s.world.name} by royal order.`, 'crime'); open('justice'); });
        r.querySelectorAll('[data-knight]').forEach((b) => b.onclick = () => { O.jobEvent && O.jobEvent('decree'); const q = who(b.dataset.knight); q.title = q.sex === 'f' ? 'Dame' : 'Sir'; q.name = `${q.title} ${q.first} ${q.sur}`; q.gentry = true; s.relate(q, { id: 0 }, 0.8); s.log(`${q.name} has been ${q.sex === 'f' ? 'made a dame' : 'knighted'} by the monarch.`, 'politics'); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.03); open('honours'); });
        r.querySelectorAll('[data-work]').forEach((b) => b.onclick = () => {
          const c = +b.dataset.cost; if (k.treasury < c) return say('The treasury cannot bear it.', 'bad'); k.treasury -= c;
          const kk = b.dataset.work; O.jobEvent && O.jobEvent('decree');
          if (kk === 'alms') { for (const hh of s.households) if (!hh.gone && hh.money < 30) hh.money += 8; if (pl) pl.happiness = Math.min(1, (pl.happiness || 0.5) + 0.08); s.log('Royal alms were given out to the poor households of the town.', 'politics'); }
          if (kk === 'granary') { for (const p2 of k.places) if (p2.stock) p2.stock.grain = (p2.stock.grain || 0) + p2.pop / 20; s.log('By the monarch\'s order, granaries are filled against the winter.', 'politics'); }
          if (kk === 'walls') { if (pl) { pl.crime = Math.max(0.02, (pl.crime || 0.2) - 0.08); pl.walls = true; } s.log(`Masons are at work on the walls of ${s.world.name}, by royal order.`, 'politics'); }
          if (kk === 'roads') { for (const p2 of k.places) p2.wealth = Math.min(1, (p2.wealth || 0.4) + 0.02); s.log('The crown pays for the mending of the realm\'s roads; trade moves easier.', 'politics'); }
          if (kk === 'feast') { s.festivalDay = s.day + 1; s.festivalWhy = 'the monarch\'s feast'; s.log('Tomorrow is a holiday, at the crown\'s cost: music and dancing in the square.', 'politics'); }
          for (const q of s.people) if (q.age >= 16 && s.rng.chance(0.3)) s.relate(q, { id: 0 }, 0.06);
          say('Your order goes out. It will be done.'); open('works');
        });
        r.querySelectorAll('[data-host]').forEach((b) => b.onclick = () => { O.jobEvent && O.jobEvent('decree'); const kk = b.dataset.host, c = { tournament: 150, fair: 80, midwinter: 120, market: 40 }[kk]; if (k.treasury < c) return say('The treasury cannot bear it.', 'bad'); { const [f0, t0] = kk === 'midwinter' ? [18, 23] : kk === 'market' ? [7, 14] : [10, 15], cl = O.eventClash && O.eventClash(s, s.day + 1, f0, t0); if (cl || (s.hosted && s.hosted.day === s.day + 1)) return say(`Tomorrow is taken already: ${cl ? cl.title.charAt(0).toLowerCase() + cl.title.slice(1) : 'another festivity'}. Choose another day.`, 'bad'); } k.treasury -= c; s.hosted = { kind: kk, day: s.day + 1 }; s.log(`By royal command there will be ${kk === 'midwinter' ? 'a great feast' : kk === 'market' ? 'a market of travelling merchants' : 'a ' + kk} tomorrow.`, 'politics'); say('The heralds cry it through the streets: tomorrow, by your command.'); open('fest'); });
        r.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { guests().mode = b.dataset.mode; open('fest'); });
        r.querySelectorAll('[data-unlist]').forEach((b) => b.onclick = () => { delete guests().list[b.dataset.unlist]; open('fest'); });
        r.querySelectorAll('[data-war]').forEach((wb) => wb.onclick = () => { O.declareOn ? O.declareOn(wb.dataset.war) : k.declareWar && k.declareWar(); O.jobEvent && O.jobEvent('decree'); say('You declare war. The heralds ride out.', 'bad'); open('war'); });
        const pb = r.querySelector('[data-peace]'); if (pb) pb.onclick = () => { if (k.treasury < 300) return say('The treasury cannot pay the price of peace.', 'bad'); k.treasury -= 300; k.makePeace && k.makePeace('none'); say('Envoys carry your terms. The war is over.'); open('war'); };
      });
    }
    O.openCrown = open;
    // the guest list: open to all, a blacklist of the barred, or a whitelist of the invited
    const guests = () => (PS.guests = PS.guests || { mode: 'all', list: {} });
    // true: invited; false: kept out; null: no say (the household, or nobody's ruling)
    O.castleGuest = (s, q) => { if (!crowned()) return null; const G = guests(), on = !!G.list[O.knowKey(q)]; if (G.mode === 'white') return on; if (G.mode === 'black') return on ? false : null; return null; };
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; if (crowned() && q.age >= 12) { const G = guests(), on = !!G.list[O.knowKey(q)]; if (G.mode === 'white') out.push(['guest', on ? 'Strike them from the guest list' : 'Invite them to the castle']); else if (G.mode === 'black') out.push(['guest', on ? 'Lift their bar from the castle' : 'Bar them from the castle']); } return out; };
    npcUI.onExtra = (q, key, render) => { if (key !== 'guest') return prevOn && prevOn(q, key, render); const G = guests(), kk = O.knowKey(q); if (G.list[kk]) delete G.list[kk]; else G.list[kk] = 1; const on = !!G.list[kk]; return render(G.mode === 'white' ? (on ? '"Majesty! I am honoured."' : '"As Your Majesty wishes."') : (on ? '"Majesty? What have I done?"' : '"Thank you, Majesty."')); };
    // (the Crown is opened from the Business tab, B)

    // ---------------------------------------------------------------- audiences: petitioners at the throne
    const PETITIONS = [
      { text: (q) => `${q.first} kneels. "Majesty, my neighbour's pigs have ruined my garden twice this month, and he laughs at me."`, opts: [['Order the neighbour to pay ₳5', (s, q) => { s.household(q).money += 5; s.relate(q, { id: 0 }, 0.3); }], ['Tell them to settle it between themselves', (s, q) => { s.relate(q, { id: 0 }, -0.1); }]] },
      { text: (q) => `${q.first} bows low. "Majesty, the harvest failed on our strip. My children are hungry."`, opts: [['Give ₳10 from the treasury', (s, q, k) => { k.treasury -= 10; s.household(q).money += 10; s.relate(q, { id: 0 }, 0.5); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.03); }], ['The crown cannot feed every mouth', (s, q) => { s.relate(q, { id: 0 }, -0.3); }]] },
      { text: (q) => `${q.first} stands stiffly. "Majesty, the tax collector takes more than his due, and pockets the difference."`, opts: [['Have the collector looked into', (s, q) => { s.relate(q, { id: 0 }, 0.3); const c = s.people.find((x) => x.job?.role === 'tax collector'); if (c) s.remember(c, 'The monarch had my books looked into.', 'politics', 2); }], ['Dismiss the complaint', (s, q) => { s.relate(q, { id: 0 }, -0.2); }]] },
      { text: (q) => `${q.first} clutches a cap. "Majesty, I ask leave to marry above my station. Her father forbids it."`, opts: [['Grant your blessing', (s, q) => { s.relate(q, { id: 0 }, 0.5); s.remember(q, 'The monarch blessed my match.', 'social', 3, 0); }], ['Refuse: let the father decide', (s, q) => { s.relate(q, { id: 0 }, -0.3); }]] },
      { text: (q) => `${q.first} is angry. "Majesty, a band of thieves robs the road to the mill and the watch does nothing."`, opts: [['Send more watchmen (₳40)', (s, q, k) => { k.treasury -= 40; const pl = placeOf(s); if (pl) pl.crime = Math.max(0.02, (pl.crime || 0.2) - 0.05); s.relate(q, { id: 0 }, 0.4); }], ['The watch is stretched thin enough', (s, q) => { s.relate(q, { id: 0 }, -0.25); }]] },
      { text: (q) => `${q.first} is a merchant. "Majesty, a charter to trade in wool without the guild's fee, and I will pay the crown ₳30."`, opts: [['Grant the charter (+₳30)', (s, q, k) => { k.treasury += 30; s.relate(q, { id: 0 }, 0.4); PS.rep.merchant = Math.min(1, PS.rep.merchant + 0.05); }], ['The guild\'s fee stands', (s, q) => { s.relate(q, { id: 0 }, -0.2); }]] },
    ];
    let nextAudience = 0;
    game.hooks.update.push(() => {
      const s = cur(), p = game.player;
      if (!crowned() || !p.sitting || !p.sitting.it || p.sitting.it.kind !== 'throne' || O.panelOpen || O.UI.dialogOpen && O.UI.dialogOpen()) return;
      const now = s.day * 1440 + s.minute; if (s.hour < 9 || s.hour >= 17 || pending || waiting) return;
      // the first comes up as soon as you sit; then one after another, with a little while between
      if (!p._throneSince || p._throneSince.it !== p.sitting.it) { p._throneSince = { it: p.sitting.it }; nextAudience = 0; }
      if (now < nextAudience) return;
      nextAudience = now + 12;
      const welcome = (x) => { const g0 = O.castleGuest(s, x); return guests().mode === 'white' ? g0 === true : g0 !== false; };
      const q = s.people.filter((x) => x.age >= 18 && !x.royal && !x.visitor && x.alive !== false && !x.task && welcome(x))[Math.floor(Math.random() * 40)] || s.people.find((x) => x.age >= 18 && !x.royal && welcome(x));
      if (!q) return;
      const pt = PETITIONS[Math.floor(Math.random() * PETITIONS.length)];
      // they come up the hall to stand before the throne, then speak
      const keep = game.scene && (game.scene.b.parent || game.scene.b);
      if (keep && keep.royal) { q.task = { act: 'petition', b: keep.id }; q.activity = q.task; q.agent.path = null; q.agent.inside = keep.id; q.agent.hidden = true; q.agent.enteredAt = s.minute; } // they've been waiting in the hall
      pending = { q, pt, at: game.t + 1.5 };
    });
    // stand up from the throne and whoever was waiting goes away unheard
    game.hooks.update.push(() => { if (waiting && !game.player.sitting && !(O.UI.dialogOpen && O.UI.dialogOpen())) { if (waiting.task?.act === 'petition') waiting.task = null; waiting = null; } });
    let pending = null, waiting = null; // (waiting: a petitioner before the throne, not yet answered)
    game.hooks.update.push(() => {
      if (!pending || game.t < pending.at || O.panelOpen || (O.UI.dialogOpen && O.UI.dialogOpen())) return;
      const { q, pt } = pending; pending = null; const s = cur();
      if (!game.player.sitting) { if (q.task?.act === 'petition') q.task = null; return; }
      waiting = q;
      O.UI.dialog.open({ name: `${q.first}, a petitioner · Treasury ${O.money(Math.round(K().treasury))}`, color: '#8a6239', text: pt.text(q), options: pt.opts.map(([l], i) => ({ key: 'p' + i, label: l })), onPick: (key) => { const o = pt.opts[+key.slice(1)]; o[1](s, q, K()); O.jobEvent && O.jobEvent('hear'); s.remember(q, 'Brought my petition before the monarch.', 'politics', 2, 0); O.UI.dialog.close(); waiting = null; if (q.task?.act === 'petition') q.task = null; say(`${q.first} bows and withdraws. The next petitioner waits.`); }, onClose: () => { if (waiting === q) { waiting = null; if (q.task?.act === 'petition') q.task = null; } } });
    });
  }
  O.CrownSetup = { setup };
})();
