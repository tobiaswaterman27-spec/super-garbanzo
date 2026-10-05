// Plotting a rising against the crown. You need fighters (your gang, sellswords you hire, arms for them)
// and lords who'll bring their men. The lords of the realm are won by letter: sound them out, send
// gifts, promise them land when you rule, or pay their price. The gentry in town you sound out face to
// face. The Duke of Frostmere wants the crown for himself, but he'd make common cause with you. A man
// inside the castle (a guard who'll open the postern, or a post of your own there) opens a quieter way
// in. Every word spoken carries: whispers reach the court, and if the crown hears enough, it comes for
// you first. When you rise you choose how: storm the gates, slip in by the postern, or lay siege.
'use strict';
(function () {
  const T = 16;
  function setup(game, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    const K = () => O.SimRef.home.kingdom;
    const P = () => (PS.plot = PS.plot || { sworn: {}, swords: 0, arms: 0, heat: 0, gifts: {}, asked: {}, price: {}, promised: {}, inside: null, duke: false });
    const day = () => O.SimRef.home.day;
    const crowned = () => O.crowned && O.crowned();
    const sexP = () => O.Forge.player?.sex || O.Forge.player?.a?.sex || 'm';

    // ---------------------------------------------------------------- the lords of the realm
    const MEN = { castle: 40, city: 25, port: 20, town: 15 }; // the great lords and the towns that matter; reeves of villages don't raise armies
    function realmLords() {
      const k = K(), R = k.rulersInit ? k.rulersInit() : k.rulers; if (!R) return [];
      const out = [];
      for (const [id, L] of Object.entries(R.lords || {})) {
        const pl = k.place(id); if (!pl || !MEN[pl.kind] || id === R.pretender?.seat) continue;
        out.push({ key: 'realm:' + id, name: k.lordName(id), place: pl.name, men: MEN[pl.kind], grudge: (O.hash('grudge', id, L.name) % 70) / 100 });
      }
      return out.sort((a, b) => b.men - a.men);
    }
    // how a lord leans: their own grudge against the crown, your name, your gifts and promises, and who's already with you
    function lean(l) {
      const pl = P(), sworn = Object.keys(pl.sworn).length;
      return l.grudge + PS.rep.civilian * 0.2 + (PS.knight ? 0.1 : 0) + (PS.lord ? 0.1 : 0) + (pl.gifts[l.key] || 0) * 0.12 + (pl.promised[l.key] ? 0.25 : 0) + sworn * 0.05 - Math.max(0, PS.rep.criminal) * 0.15;
    }
    const leanWord = (v) => v >= 0.6 ? 'leaning your way' : v >= 0.4 ? 'wavering' : v >= 0.2 ? 'cool' : 'loyal to the crown';
    const heatWord = (h) => h >= 2.2 ? 'the crown is asking questions' : h >= 1.2 ? 'there is talk at court' : h > 0.3 ? 'a few whispers' : 'quiet';
    const swear = (key, rec) => { P().sworn[key] = Object.assign({ day: day() }, rec); };
    function warm(n) { P().heat = Math.max(0, P().heat + n); }
    // a letter needs carrying: your own if you have one, else a rider for ₳3
    function post() { if (PS.items.includes('letter')) { PS.remove('letter'); return true; } if (PS.money < 3) { say('You have no letter, and no ₳3 for a rider to carry word.', 'bad'); return false; } PS.money -= 3; return true; }

    function sound(l, reopen) {
      const pl = P();
      if (pl.asked[l.key] && day() - pl.asked[l.key] < 2) return say(`You wrote to ${l.name} lately. Give them time.`, 'bad');
      if (!post()) return;
      pl.asked[l.key] = day(); warm(0.25);
      const v = lean(l) + (Math.random() - 0.5) * 0.15;
      let text;
      if (v >= 0.6) { swear(l.key, { name: l.name, men: l.men, how: 'by letter' }); text = `A reply under ${l.name}'s seal: "I have no love for this crown. When you raise your banner, my ${l.men} men will be under it."`; }
      else if (v >= 0.38) { const price = 20 + Math.round((0.6 - v) * 200); pl.price[l.key] = price; text = `A careful reply from ${l.name}: "These are dangerous words. A lord must think of his people... ₳${price} would help me think of them less." (They might also take a promise of land.)`; }
      else if (v < 0.18 && Math.random() < 0.55) { warm(1.2); text = `No reply from ${l.name}. Then word comes that your letter was carried to the capital, unopened, under the crown's seal.`; }
      else text = `${l.name} writes back: "I will forget I read this. Do not write to me again."`;
      O.UI.dialog.open({ name: 'A letter comes back', color: '#4a3a2a', text, options: [{ key: 'ok', label: 'Go on' }], onPick: () => { O.UI.dialog.close(); reopen && reopen(); } });
    }
    function gift(l, reopen) { const pl = P(); if (PS.money < 40) return say('A gift fit for a lord costs ₳40.', 'bad'); PS.money -= 40; pl.gifts[l.key] = (pl.gifts[l.key] || 0) + 1; warm(0.1); say(`A gift goes to ${l.name}: a fine horse and a cask of wine, and no word of why.`); reopen(); }
    function promise(l, reopen) { const pl = P(); pl.promised[l.key] = true; warm(0.15); say(`You promise ${l.name} the lands of a loyalist when you rule. They'll hold you to it.`); reopen(); }
    function pay(l, reopen) { const pl = P(), n = pl.price[l.key]; if (PS.money < n) return say(`They want ₳${n}.`, 'bad'); PS.money -= n; delete pl.price[l.key]; swear(l.key, { name: l.name, men: l.men, how: 'bought' }); say(`${l.name} takes your coin, and gives you their word and their ${l.men} men.`); reopen(); }

    // ---------------------------------------------------------------- the Duke
    function duke(reopen) {
      const pl = P(), R = K().rulers, D = R?.pretender; if (!D) return;
      if (!post()) return; warm(0.3);
      const others = Object.keys(pl.sworn).length, g = cur().playerGang && cur().playerGang();
      if (others >= 1 || (g && g.members.length >= 6)) {
        pl.duke = true; swear('duke', { name: `${D.name}, ${D.title}`, men: 60, how: 'common cause' });
        O.UI.dialog.open({ name: D.title, color: '#3a2a4a', text: `"So. Someone else has had enough of them. My men are yours, sixty of them, when you rise. Only remember who has the better claim to the crown, when it is won."`, options: [{ key: 'ok', label: 'Agreed' }], onPick: () => { O.UI.dialog.close(); reopen(); } });
      } else O.UI.dialog.open({ name: D.title, color: '#3a2a4a', text: `"Who are you to write to me of crowns? Come back with men behind you, and a lord or two."`, options: [{ key: 'ok', label: 'Go on' }], onPick: () => { O.UI.dialog.close(); reopen(); } });
    }

    // ---------------------------------------------------------------- face to face: the gentry, and a man inside
    const isGentry = (q) => (q.gentry || /^(Lord|Lady|Sir|Dame)/.test(q.title || '')) && !q.royal;
    const isInside = (q) => /royal guard|^guard$|sergeant|groom|page|butler|steward|chamberlain|maid|scullion/.test(q.job?.role || '') && (cur().biz.get(q.job.biz)?.b?.royal || cur().world.buildings.find((b) => b.id === q.job.biz)?.royal);
    const plotting = () => !crowned() && ((cur().playerGang && cur().playerGang()) || Object.keys(P().sworn).length > 0);
    const keyOf = (q) => cur().world.placeId + ':' + q.id;
    const prevB = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => {
      const out = prevB ? prevB(q) : [];
      if (plotting() && q.age >= 18 && q.alive !== false) {
        if (isGentry(q) && !P().sworn[keyOf(q)]) out.push(['plot', 'Speak of a rising']);
        else if (isInside(q) && !P().inside) out.push(['postern', 'Would you open a gate one night?']);
      }
      return out;
    };
    npcUI.onExtra = (q, key, render) => {
      if (key === 'plot') return faceToFace(q, render);
      if (key === 'postern') return insideMan(q, render);
      return prevOn && prevOn(q, key, render);
    };
    function caught(q, why) {
      const s = cur(); warm(1.5);
      const cr = s.recordCrime({ kind: 'sedition', perp: 'player', placeName: s.world.name, tile: [Math.floor(game.player.x / T), Math.floor(game.player.y / T)], seen: [q], victimPerson: q, severity: 3 });
      PS.crimes.push(cr.id); s.relate(q, { id: 0 }, -0.6);
      return why;
    }
    function faceToFace(q, render) {
      const s = cur(), aff = q.rel.get(0)?.affinity || 0, k = keyOf(q);
      if (P().asked[k] === day()) return render('"I have given you my answer."');
      P().asked[k] = day(); warm(0.2);
      const v = aff * 0.6 + (O.hash('grudge', k) % 50) / 100 + PS.rep.civilian * 0.15 + Object.keys(P().sworn).length * 0.05 + (PS.knight ? 0.1 : 0);
      if (v >= 0.55) { swear(k, { name: `${q.title ? q.title + ' ' : ''}${q.first}`, men: 6, how: 'in person', place: s.world.name }); s.relate(q, { id: 0 }, 0.05); return render(`${q.first} looks about, then lowers their voice. "You're not the only one who thinks it. My sword and my household's, six of us. When the day comes, send word."`); }
      if (v >= 0.3) return render(`"Careful. Walls have ears in this town." ${q.first} won't say yes. Not yet. (Win their friendship, or win more lords to you first.)`);
      if (aff < 0.15 && Math.random() < 0.5) return render(caught(q, `${q.first} steps back. "That is treason, and I'll not be hanged beside you. The watch will hear of this."`));
      return render(`"I'll pretend I didn't hear that." ${q.first} turns away.`);
    }
    function insideMan(q, render) {
      const aff = q.rel.get(0)?.affinity || 0;
      npcUI.closeTalk && npcUI.closeTalk();
      O.UI.dialog.open({ name: q.first, color: '#3a3a4a', text: `You ask ${q.first}, quietly, whether a postern gate might be left unbarred one night.`, options: [{ key: 'pay', label: 'Thirty aurins says it might (₳30)' }, { key: 'ask', label: 'For friendship\'s sake' }, { key: 'no', label: 'Forget I asked' }], onPick: (k) => {
        O.UI.dialog.close(); if (k === 'no') return;
        if (k === 'pay' && PS.money < 30) return say('You haven\'t ₳30.', 'bad');
        const v = aff + (k === 'pay' ? 0.35 : 0) + (Math.random() - 0.5) * 0.2;
        if (k === 'pay') PS.money -= 30; warm(0.3);
        if (v >= 0.5) { P().inside = { name: q.first, place: cur().world.placeId }; say(`${q.first} pockets it without looking at you. "Third night after you send word. The little gate by the kitchens."`); }
        else if (v < 0.2 && Math.random() < 0.6) say(caught(q, `${q.first} goes cold. "You'll answer for that." They head for the captain.`), 'bad');
        else { if (k === 'pay') PS.money += 30; say(`${q.first} shakes their head. "Not for any money. Go away."`); }
      } });
      return null;
    }

    // ---------------------------------------------------------------- strength
    function forces() {
      const s = cur(), pl = P(), g = s.playerGang && s.playerGang();
      const gang = g ? g.members.length : 0, swords = pl.swords, armed = Math.min(pl.arms, gang + swords);
      const lordsMen = Object.values(pl.sworn).reduce((n, l) => n + (l.men || 0), 0);
      const ours = gang + swords + armed * 0.5 + lordsMen / 4 + (PS.knight ? 3 : 0);
      const W = K().war, away = W && W.phase === 'war' && !W.civil;
      const theirs = (away ? 16 : 26) + (K().rulers?.crown ? 0 : -6);
      return { gang, swords, armed, lordsMen, ours, theirs, away, lords: Object.keys(pl.sworn).length, fighters: gang + swords };
    }
    const odds = (a, b) => a / (a + b);
    const oddsWord = (o) => o >= 0.75 ? 'good' : o >= 0.55 ? 'better than even' : o >= 0.42 ? 'even' : o >= 0.28 ? 'poor' : 'hopeless';

    // ---------------------------------------------------------------- the panel section (Business)
    O.risingHTML = () => {
      if (crowned()) return '';
      const s = cur(), g = s.playerGang && s.playerGang(), pl = P(), F = forces();
      if (!g && !F.lords && !pl.swords) return `<h3>Rise against the crown</h3><p class="caption">Lead a gang of your own first (and gather at least 8 fighters, with sellswords if need be). Then win lords to your side.</p>`;
      let h = `<h3>Rise against the crown</h3><p class="caption">Whispers at court: <b>${heatWord(pl.heat)}</b>. ${F.away ? 'The King\'s host is away at war: the capital is thinly held.' : ''}</p>`;
      h += `<table class="ledger"><tr><td>Your gang</td><td>${F.gang}</td></tr><tr><td>Sellswords</td><td>${F.swords} <button data-sword="1">Hire one (₳15)</button><button data-sword="5">Hire five (₳75)</button></td></tr><tr><td>Armed</td><td>${F.armed} of ${F.fighters} <button data-arms="1">Arm five (₳20)</button></td></tr><tr><td>Lords' men</td><td>${F.lordsMen}</td></tr><tr><td>A way in</td><td>${pl.inside ? `${esc(pl.inside.name)} will leave the postern unbarred` : 'none yet (ask a guard or servant at the castle)'}</td></tr></table>`;
      const sw = Object.values(pl.sworn);
      h += `<h4>Sworn to you (${sw.length}; 2 needed)</h4>${sw.length ? '<ul>' + sw.map((l) => `<li>${esc(l.name)}: ${l.men} men <small class="lbl">${esc(l.how)}</small></li>`).join('') + '</ul>' : '<p class="caption">No one yet. Write to the lords of the realm below, or speak to the gentry in town (talk: Speak of a rising).</p>'}`;
      h += `<h4>The lords of the realm</h4><table class="ledger">`;
      for (const l of realmLords()) {
        if (pl.sworn[l.key]) continue;
        const v = lean(l), seen = pl.asked[l.key] != null;
        h += `<tr><td><b>${esc(l.name)}</b><br><small class="lbl">${l.men} men · ${seen ? leanWord(v) : 'unknown mind'}${pl.promised[l.key] ? ' · promised land' : ''}</small></td><td><div class="topics" style="margin:0">`
          + `<button data-sound="${l.key}">Sound them out by letter</button>`
          + `<button data-gift="${l.key}">Send a gift (₳40)</button>`
          + (pl.promised[l.key] ? '' : `<button data-promise="${l.key}">Promise land</button>`)
          + (pl.price[l.key] ? `<button data-pay="${l.key}" class="hot">Pay their price (₳${pl.price[l.key]})</button>` : '')
          + `</div></td></tr>`;
      }
      h += `</table>`;
      const D = K().rulers?.pretender;
      if (D && !pl.duke) h += `<p class="caption">${esc(D.name)}, ${esc(D.title)}, has long thought the crown should be his.</p><div class="topics"><button data-duke="1">Write to the Duke</button></div>`;
      const ok = F.fighters >= 8 && F.lords >= 2;
      h += `<p class="caption">Your strength against the crown's: ${oddsWord(odds(F.ours, F.theirs))} odds. Win and the crown is yours; lose, and it's treason.</p><div class="topics"><button data-rise="1" class="hot" ${ok ? '' : 'disabled'}>Raise your banner</button></div>${ok ? '' : `<p class="caption">You need 8 fighters (${F.fighters}) and 2 lords sworn (${F.lords}).</p>`}`;
      return h;
    };
    O.bindRising = (r, reopen) => {
      const pl = P(), find = (k) => realmLords().find((l) => l.key === k);
      r.querySelectorAll('[data-sword]').forEach((b) => b.onclick = () => { const n = +b.dataset.sword, c = 15 * n; if (PS.money < c) return say(`That's ₳${c}.`, 'bad'); if (pl.swords + n > 30) return say('There aren\'t that many blades for hire this side of the sea.', 'bad'); PS.money -= c; pl.swords += n; warm(0.08 * n); say(`${n === 1 ? 'A hard-faced sellsword' : 'Five sellswords'} take${n === 1 ? 's' : ''} your coin, through a tavern-keeper who asks no questions.`); reopen(); });
      r.querySelectorAll('[data-arms]').forEach((b) => b.onclick = () => { if (PS.money < 20) return say('That\'s ₳20.', 'bad'); PS.money -= 20; pl.arms += 5; warm(0.1); say('Five spears and five jacks of boiled leather, bought quietly and hidden in a hayloft.'); reopen(); });
      r.querySelectorAll('[data-sound]').forEach((b) => b.onclick = () => sound(find(b.dataset.sound), reopen));
      r.querySelectorAll('[data-gift]').forEach((b) => b.onclick = () => gift(find(b.dataset.gift), reopen));
      r.querySelectorAll('[data-promise]').forEach((b) => b.onclick = () => promise(find(b.dataset.promise), reopen));
      r.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => pay(find(b.dataset.pay), reopen));
      const d = r.querySelector('[data-duke]'); if (d) d.onclick = () => duke(reopen);
      const rb = r.querySelector('[data-rise]'); if (rb) rb.onclick = () => rise();
    };

    // ---------------------------------------------------------------- the day itself
    function rise() {
      O.Panels.close();
      const pl = P(), F = forces(), base = odds(F.ours, F.theirs);
      const opts = [{ key: 'storm', label: `Storm the gates at dawn (${oddsWord(base)} odds)` }];
      if (pl.inside) opts.push({ key: 'postern', label: `In by the postern at night, ${pl.inside.name} letting you in (${oddsWord(Math.min(0.95, base + 0.22))} odds)` });
      if (F.lordsMen >= 50) opts.push({ key: 'siege', label: `Lay siege with the lords' hosts: three days (${oddsWord(Math.min(0.95, base + 0.12))} odds)` });
      opts.push({ key: 'wait', label: 'Not yet' });
      O.UI.dialog.open({ name: 'The rising', color: '#5a1a1a', text: `${F.fighters} of your own${F.lordsMen ? ` and ${F.lordsMen} of the lords' men` : ''} wait on your word. How do you take the capital?`, options: opts, onPick: (k) => {
        O.UI.dialog.close(); if (k === 'wait') return;
        let o = base, tale;
        if (k === 'storm') tale = 'At first light your people go at the gates with axes and a ram. The watch on the walls is slow to wake.';
        if (k === 'postern') { o = Math.min(0.95, base + 0.22); tale = `At the third hour of night the little gate by the kitchens opens. ${pl.inside.name} keeps their word. You are in the courtyard before the alarm.`; }
        if (k === 'siege') { o = Math.min(0.95, base + 0.12); tale = 'The lords\' hosts close the roads. For three days nothing goes in; on the fourth, hungry men inside start to talk of opening the gates.'; const s = O.SimRef.home; for (let i = 0; i < 3 * 720; i++) s.tick(2); }
        const won = Math.random() < o;
        setTimeout(() => (won ? victory(tale) : defeat(tale)), 60);
      } });
    }
    function victory(tale) {
      const pl = P(), s = O.SimRef.home;
      s.log('Rebels led by the stranger took the capital. The old crown has fallen.', 'politics');
      O.Chronicle && O.Chronicle.deed && O.Chronicle.deed(s, 'The stranger rose against the crown, and won.', 'You took the crown by the sword.');
      const after = () => {
        // promises come due
        const owed = Object.keys(pl.promised).filter((k) => pl.sworn[k]);
        if (!owed.length) return done();
        O.UI.dialog.open({ name: 'Promises', color: '#5a4a1a', text: `${owed.length} lord${owed.length > 1 ? 's' : ''} you promised land to come to collect. The loyalists' estates are yours to give.`, options: [{ key: 'keep', label: 'Keep your word' }, { key: 'break', label: 'Break it: the land stays with the crown' }], onPick: (k) => {
          O.UI.dialog.close();
          if (k === 'break') { PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.3); s.log('The new monarch broke faith with the lords who raised them up. They will not forget.', 'politics'); pl.brokeFaith = owed.length; }
          else { PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.1); s.log('The new monarch rewarded the lords who stood by them with the lands of the old crown\'s friends.', 'politics'); }
          done();
        } });
      };
      const done = () => { O.takeAnyPost('monarch'); PS.plot = null; };
      const takeIt = () => O.UI.dialog.open({ name: 'The crown is yours', color: '#7a1a2a', text: `${tale} By nightfall the old crown has fled, and you are proclaimed in the great hall.`, options: [{ key: 'ok', label: 'Take the throne' }], onPick: () => { O.UI.dialog.close(); after(); } });
      if (!pl.duke) return takeIt();
      const D = K().rulers.pretender;
      O.UI.dialog.open({ name: D.title, color: '#3a2a4a', text: `${tale} The old crown has fled. In the great hall ${D.name} of Frostmere sets his hand on the throne and looks at you. "Well? We agreed I had the better claim."`, options: [{ key: 'duke', label: 'Crown the Duke (be his first lord)' }, { key: 'me', label: 'The crown is mine. Seize him.' }], onPick: (k) => {
        O.UI.dialog.close();
        if (k === 'duke') {
          PS.knight = true; PS.lord = PS.lord || true; PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.2); PS.money += 300;
          s.log(`${D.name}, Duke of Frostmere, is crowned, and his ally the stranger is made his first lord.`, 'politics');
          if (K().rulers.crown) { K().rulers.crown.name = D.name; K().rulers.crown.sex = 'm'; }
          PS.plot = null;
          return say(`${D.name} is crowned. You are knighted, given ₳300 and a lord's rank, and sit at his right hand.`);
        }
        if (Math.random() < 0.55) { s.log(`The stranger's men seized the Duke of Frostmere in the great hall. He is in the tower.`, 'politics'); return takeIt(); }
        s.log('The Duke of Frostmere escaped the capital and raised his banner against the new crown.', 'politics');
        O.UI.dialog.open({ name: 'Betrayed, and betrayer', color: '#3a2a4a', text: 'The Duke cuts his way out with his household knights and rides north. You have the crown; now you have a war for it.', options: [{ key: 'ok', label: 'Then let it come' }], onPick: () => { O.UI.dialog.close(); after(); setTimeout(() => K().declareWar && K().declareWar({ civil: true, enemy: "the Duke of Frostmere's host", home: 'frostmere' }), 500); } });
      } });
    }
    function defeat(tale) {
      const pl = P(), s = cur(), g = s.playerGang && s.playerGang();
      if (g) for (const m of [...g.members]) if (Math.random() < 0.6) s.leaveGang(m, g, 'taken or scattered after the failed rising');
      PS.money = Math.floor(PS.money / 3); PS.exiled = true; PS.bounty = true; PS.bountyAmount = (PS.bountyAmount || 0) + 150; PS.rep.guard = -1; PS.knight = false;
      const cr = s.recordCrime({ kind: 'treason', perp: 'player', placeName: 'the capital', tile: [0, 0], seen: [], severity: 5 }); cr.reported = true; cr.investigated = true; cr.evidence = 2; PS.crimes.push(cr.id);
      const names = Object.values(pl.sworn).map((l) => l.name).slice(0, 3);
      s.log(`The stranger's rising was crushed.${names.length ? ` ${names.join(', ')} lost their heads for it.` : ''}`, 'politics');
      PS.plot = null;
      O.UI.dialog.open({ name: 'Treason', color: '#3a1010', text: `${tale} But it goes wrong: the crown's men hold, and by noon it is a rout. ${names.length ? `The lords who stood with you are taken. ` : ''}You escape with your life and little else: branded, banished from every town, ₳${PS.bountyAmount} on your head.`, options: [{ key: 'ok', label: 'Live, at least' }], onPick: () => O.UI.dialog.close() });
    }

    // ---------------------------------------------------------------- whispers: if the court hears enough, it comes for you
    let lastDay = -1;
    game.hooks.update.push(() => {
      const d = day(); if (d === lastDay) return; const first = lastDay < 0; lastDay = d; if (first || !PS.plot || crowned()) return;
      const pl = PS.plot;
      if (pl.heat >= 3) {
        const s = cur(), cr = s.recordCrime({ kind: 'sedition', perp: 'player', placeName: s.world.name, tile: [0, 0], seen: [], severity: 4 });
        cr.reported = true; cr.investigated = true; cr.evidence = 2; PS.crimes.push(cr.id); PS.rep.guard = Math.min(PS.rep.guard, -0.6);
        let fled = 0; for (const k of Object.keys(pl.sworn)) if (Math.random() < 0.4) { delete pl.sworn[k]; fled++; }
        pl.heat = 1.2; pl.inside = null;
        s.log('The crown has issued a warrant against the stranger for plotting treason.', 'politics');
        O.UI.dialog.open({ name: 'The crown knows', color: '#3a1010', text: `Too many tongues have wagged. A warrant is out for you, for plotting treason: the watch will take you on sight.${fled ? ` ${fled} of your sworn lords have made their peace with the crown.` : ''} Your man inside has lost his nerve.`, options: [{ key: 'ok', label: 'Lie low' }], onPick: () => O.UI.dialog.close() });
      } else pl.heat = Math.max(0, pl.heat - 0.15);
    });
  }
  O.RisingSetup = { setup };
})();
