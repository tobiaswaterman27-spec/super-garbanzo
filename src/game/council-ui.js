// Seeing the realm governed. On election day the hall of the place holds the ballot box: a citizen
// (someone who lives here, in a house they own or rent) can read each candidate's record and put in
// their vote, or stand themselves if their name is good. On council day the leaders of the realm ride
// into the capital and take their seats at the long tables in the castle's great hall, the monarch on
// the throne, the guards at the doors; they leave again at evening.
'use strict';
(function () {
  function setup(game, home) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    const K = () => home.kingdom;
    const HALLS = ['townhall', 'moothall', 'chapel', 'church', 'guard', 'keep'];
    const citizen = (s) => O.livesIn(s.world.placeId);
    const openElection = (s) => (K().elections || []).find((e) => e.place === s.world.placeId && !e.done);

    O.voteCandidate = () => {
      const s = cur(), sc = game.scene; if (!sc || !HALLS.includes(sc.b.type)) return null;
      const e = openElection(s); if (!e) return null;
      const p = game.player, it = sc.L.items.find((i) => i.kind === 'desk' || i.kind === 'altar' || i.counter) || sc.L.items[0]; if (!it) return null;
      const [x, y] = sc.anchor(it); if (Math.hypot(x - p.x, y + 10 - p.y) > 60) return null;
      return { type: 'vote', e, d: 5, x, y: y - 34 };
    };
    O.voteAct = (c) => {
      const s = cur(), e = c.e, pl = K().place(e.place);
      const voted = e.voters && e.voters.includes('player'), can = citizen(s);
      const rows = e.cands.map((k, i) => `<tr><td><b>${esc(k.name)}</b><br><small class="lbl">${esc(k.record)}</small></td><td>${can && !voted ? `<button data-v="${i}">Vote</button>` : ''}</td></tr>`).join('');
      const stand = can && !e.cands.some((k) => k.player) && PS.rep.local > -0.1 && !(PS.wantedLevel && PS.wantedLevel() > 0);
      O.Panels.open(`Election in ${pl.name}`, `<p class="caption">The old ${esc(K().leaders[e.place]?.title || 'leader').toLowerCase()} ${esc(e.oldName || '')} ${esc(e.why)}. The box is on the table; the count is tomorrow.${can ? '' : ' Only those who live here (in a house of their own or rented, where they sleep) may vote.'}${voted ? ' You have voted.' : ''}</p><table>${rows}</table>${stand ? '<div class="topics" style="margin-top:10px"><button data-stand="1">Stand yourself</button></div>' : ''}`, (r) => {
        r.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => { e.votes[b.dataset.v] = (e.votes[b.dataset.v] || 0) + 1; (e.voters = e.voters || []).push('player'); game.player.anim = 'place'; O.Panels.close(); say(`You fold your vote and drop it in the box for ${e.cands[+b.dataset.v].name}.`); });
        const st = r.querySelector('[data-stand]'); if (st) st.onclick = () => { const nm = (O.Forge && O.Forge.player && O.Forge.player.name) || 'The newcomer'; e.cands.push({ name: nm, record: PS.emp ? `the ${PS.emp.role} at ${PS.emp.bizName}` : 'a newcomer of good name', votes: 0, appeal: 0.3 + PS.rep.local * 0.6 + PS.rep.civilian * 0.3, player: true }); O.Panels.close(); say("Your name goes up beside the others'. The count is tomorrow."); };
      });
    };

    // the council in the great hall: the realm's leaders come for the afternoon
    const SP = O.Sim.prototype, _plan = SP.plan;
    SP.plan = function (p) { if (p.councillor) return !sessionOver(this) ? { act: 'feast', b: p.councillor } : { act: 'leave', outdoor: true, zone: 'east' }; return _plan.call(this, p); };
    let spawned = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!s.world.placeId || s.world.placeId !== (K().places.find((x) => x.kind === 'capital') || {}).id) return;
      const hall = s.world.buildings.find((b) => b.royal); if (!hall) return;
      const h = s.hour;
      if (s.weekday === 3 && h >= 12.25 && h < 16.5 && spawned !== s.day) {
        spawned = s.day; K().leadersInit && K().leadersInit();
        const L = Object.entries(K().leaders || {}).filter(([id, l]) => !l.out && MAJOR.has(K().place(id)?.kind)); // every leader of a city, town, port or castle
        for (const [id, l] of L) {
          const q = s.newPerson({ sex: l.sex, age: 40 + (l.name.length % 20), first: l.first || l.name.split(' ')[0], sur: l.name.split(' ').slice(1).join(' '), household: 0, home: null, genes: O.Char.randomGenes(s.rng, 'south'), wealth: 0.85, visitor: true });
          const ttl = String(l.title || 'Reeve').replace(/^[^,]*,\s*/, '').replace(/^(Lord|Lady) .*/, '$1'); l.title = ttl; q.name = `${ttl} ${l.name}`; q.title = l.title; q.councillor = hall.id; q.councilFor = id;
          q.app = O.Char.makeAppearance(O.hash('leader', id), { sex: q.sex, age: q.age, genes: q.genes, role: 'noble', wealth: 0.85 });
          // they ride in by the east gate, one behind another, and up to the hall
          const E = s.Z && s.Z.east, n = L.findIndex(([x]) => x === id), late = h >= 13.75;
          const [ex, ey] = late || !E ? s.entry(hall) : E;
          q.agent = { x: ex * 16 + 8 - (late ? 0 : n * 22), y: ey * 16 + 10 + (n % 2) * 8, dir: 1, anim: 'idle', ft: 0, a: q.app, hidden: late, inside: late ? hall.id : null, path: null, goal: null, person: q };
          q.ridingOut = !late;
          s.people.push(q); s.byId.set(q.id, q);
        }
        say(h < 13.75 ? 'The leaders of the realm are riding in for the council.' : 'The leaders of the realm are gathering in the great hall for the council.');
      }
      // gone home in the evening
      for (const q of s.people) if (q.councillor) q.ridingOut = q.agent.inside == null; // mounted on the road, on foot in the hall
      if (sessionOver(s) && s.hour >= (K().councilPending?.endedAt ?? 17.5) + 0.6 && s.people.some((q) => q.councillor)) { for (const q of s.people.filter((x) => x.councillor)) s.byId.delete(q.id); s.people = s.people.filter((q) => !q.councillor); }
    });

    // ---------------------------------------------------------------- the session itself
    // the council won't start without you if you have a seat: they wait in the great hall until five, then go
    const MAJOR = new Set(['castle', 'city', 'town', 'port']);
    const capitalId = () => (K().places.find((x) => x.kind === 'capital') || {}).id;
    function mySeat() {
      if (O.crowned && O.crowned()) return { role: 'monarch' };
      const pid = Object.keys(PS.reeveOf || {}).find((id) => (PS.reeveOf || {})[id]) || (PS.office && PS.office.place) || (PS.reeve || PS.lord ? home.world.placeId : null);
      return pid ? { role: 'leader', place: pid } : null;
    }
    O.councilSeat = mySeat;
    function sessionOver(s) { const P = K().councilPending; if (!P || P.day !== s.day) return s.hour >= 16.5; return !!P.done; }
    const _hold = K().holdCouncil.bind(K());
    K().holdCouncil = function () { if (mySeat()) { this.councilPending = { day: this.sim.day }; return; } return _hold(); };
    const TOPICS = [['a new bridge', 'build', 120], ['more men for the watch', 'guards', 60], ['relief for the poor', 'relief', 40], ['a lower crown tax', 'tax', 40], ['the roads mended', 'build', 120], ['grain from the crown stores', 'relief', 40]];
    function applyItem(it, granted) {
      const k = K(), L = k.leaders[it.id], pl = k.place(it.id); if (!L || !pl) return;
      if (granted) {
        k.treasury -= Math.min(k.treasury, it.cost);
        if (it.kind === 'guards') pl.gov = Object.assign({}, pl.gov, { guards: (pl.gov?.guards || 1) + 1 });
        if (it.kind === 'tax') k.taxRate = Math.max(0.04, k.taxRate - 0.005);
        if (it.kind === 'relief' || it.kind === 'build') pl.wealth = Math.min(0.95, (pl.wealth || 0.5) + 0.02);
        if (it.kind === 'build') (pl.works = pl.works || []).push({ what: it.ask, day: k.sim.day });
        L.favour = Math.min(1, L.favour + 0.05); (L.deeds = L.deeds || []).push(`won ${it.ask} for ${pl.name}`);
      } else L.favour = Math.max(-1, L.favour - 0.06);
    }
    function agenda(s) {
      const here = s.people.filter((q) => q.councillor && q.councilFor && q.alive !== false), r = s.rng, items = [];
      for (const q of here) if (r.chance(0.55)) { const tp = TOPICS[r.int(0, TOPICS.length - 1)]; items.push({ id: q.councilFor, who: q.name, place: K().place(q.councilFor)?.name, ask: tp[0], kind: tp[1], cost: tp[2] }); }
      return items.slice(0, 7);
    }
    function closeSession(s, items, how) {
      const k = K(), P = k.councilPending || { day: s.day }; P.done = true; P.endedAt = s.hour; k.councilPending = P;
      const minutes = { day: s.day, items: items.map((it) => ({ id: it.id, who: it.who, place: it.place, ask: it.ask, granted: !!it.granted })) };
      k.councilLog = k.councilLog || []; k.councilLog.push(minutes); if (k.councilLog.length > 12) k.councilLog.shift();
      k.addNews(`The council of the realm sat in the great hall${how ? ' ' + how : ''}: ${items.length} matters heard, ${items.filter((x) => x.granted).length} granted.`, 'politics');
      O.jobEvent && O.jobEvent('council');
    }
    O.openCouncilSession = (done) => {
      const s = cur(), seat = mySeat(), k = K();
      if (!seat) return say('Only the monarch and the leaders of the realm sit at the council.', 'bad');
      if (s.weekday !== 3 || s.hour < 13.9) return say('The council sits on Thursdays at two.', 'bad');
      if (k.councilPending?.done && k.councilPending.day === s.day) return say('The council has risen for the day.');
      const items = agenda(s), n = s.people.filter((q) => q.councillor).length;
      let mine = null;
      const draw = () => {
        const rows = items.map((it, i) => `<tr><td><b>${esc(it.who)}</b> of ${esc(it.place || '')} asks for <b>${esc(it.ask)}</b> <small class="lbl">(₳${it.cost})</small>${it.stance ? `<br><small class="lbl">You ${it.stance === 1 ? 'spoke for it' : 'spoke against it'}</small>` : ''}</td><td>${seat.role === 'monarch' ? `<button data-g="${i}" class="${it.granted === true ? 'hot' : ''}">Grant</button><button data-r="${i}" class="${it.granted === false ? 'hot' : ''}">Refuse</button>` : `<button data-for="${i}">Speak for it</button><button data-ag="${i}">Speak against</button>`}</td></tr>`).join('');
        const askRow = seat.role === 'leader' ? `<h4>Your own petition, for ${esc(k.place(seat.place)?.name || 'your town')}</h4>${mine ? `<p>You ask for <b>${esc(mine.ask)}</b>.</p>` : `<div class="topics">${TOPICS.map((tp, i) => `<button data-mine="${i}">Ask for ${esc(tp[0])}</button>`).join('')}</div>`}` : '';
        O.Panels.open('The council of the realm', `<p class="caption">${n} of the realm's leaders sit at the long table in the great hall${seat.role === 'monarch' ? ', and you preside' : ''}. Crown treasury: <b>${O.money(Math.round(k.treasury))}</b>.</p>${items.length ? `<table><tbody>${rows}</tbody></table>` : '<p>Nobody has brought a matter today.</p>'}${askRow}<div class="topics" style="margin-top:10px"><button data-close="1" class="hot">${seat.role === 'monarch' ? 'Rise: the council is ended' : 'Let the crown decide'}</button></div>`, (r) => {
          r.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { items[+b.dataset.g].granted = true; draw(); });
          r.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { items[+b.dataset.r].granted = false; draw(); });
          r.querySelectorAll('[data-for]').forEach((b) => b.onclick = () => { items[+b.dataset.for].stance = 1; draw(); });
          r.querySelectorAll('[data-ag]').forEach((b) => b.onclick = () => { items[+b.dataset.ag].stance = -1; draw(); });
          r.querySelectorAll('[data-mine]').forEach((b) => b.onclick = () => { const tp = TOPICS[+b.dataset.mine]; mine = { id: seat.place, who: O.Forge.player?.name || 'You', place: k.place(seat.place)?.name, ask: tp[0], kind: tp[1], cost: tp[2], player: true }; draw(); });
          r.querySelector('[data-close]').onclick = () => {
            if (mine) items.push(mine);
            const cr = k.rulers && k.rulers.crown, temper = (cr && cr.temper) || 'just';
            for (const it of items) {
              if (seat.role !== 'monarch') { const L = k.leaders[it.id] || { favour: 0.2 }, pl = k.place(it.id) || {}; let liking = (pl.happiness || 0.5) - 0.55 + (L.favour || 0) * 0.4 + (it.stance || 0) * 0.15 + (it.player ? PS.rep.civilian * 0.3 + 0.05 : 0) + (Math.random() - 0.5) * 0.5 - (it.cost >= 100 ? 0.1 : 0); if (temper === 'stern') liking -= 0.1; it.granted = liking > 0.15 && k.treasury - it.cost > 400; if (it.granted) k.treasury -= 0; }
              if (it.granted === undefined) it.granted = false;
              if (k.leaders[it.id]) applyItem(it, it.granted); else if (it.granted) k.treasury -= Math.min(k.treasury, it.cost);
              // speaking for or against makes friends and enemies at the table
              if (it.stance) for (const q of s.people) if (q.councilFor === it.id) s.relate(q, { id: 0 }, it.stance * 0.2);
              if (seat.role === 'monarch') for (const q of s.people) if (q.councilFor === it.id) s.relate(q, { id: 0 }, it.granted ? 0.2 : -0.15);
            }
            if (mine && mine.granted) { const pl = k.place(seat.place); if (pl) pl.happiness = Math.min(1, (pl.happiness || 0.5) + 0.05); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.05); }
            closeSession(s, items);
            O.Panels.close();
            const g = items.filter((x) => x.granted).length;
            say(seat.role === 'monarch' ? `The council rises. You granted ${g} of ${items.length}. The leaders file out to ride home.` : `The crown hears the matters and gives its answers: ${g} of ${items.length} granted${mine ? `; your own petition was ${mine.granted ? 'granted' : 'refused'}` : ''}.`);
            done && done();
          };
        });
      };
      draw();
    };
    // a seat at the table: take it in the great hall
    const prevScene = O.sceneCandidate;
    O.sceneCandidate = () => {
      const sc = game.scene, s = cur();
      if (sc && sc.b.royal && !sc.b.parent && sc.floor === 1 && s.weekday === 3 && s.hour >= 13.9 && s.hour < 17.5 && mySeat() && !(K().councilPending?.done && K().councilPending.day === s.day) && s.people.some((q) => q.councillor)) {
        const tb = sc.L.items.find((i) => i.council || i.kind === 'table') || sc.L.items.find((i) => i.kind === 'chair');
        if (tb) { const [x, y] = sc.anchor(tb), p = game.player, d = Math.hypot(x - p.x, y - p.y); if (d < 80) return { type: 'custom', d: d - 30, label: 'Take your seat at the council', act: () => O.openCouncilSession() }; }
      }
      return prevScene ? prevScene() : null;
    };
    // the day of the council: those with a seat are told; if you never come, they go home at five
    let toldDay = -1;
    game.hooks.update.push(() => {
      const s = cur(), k = K(), seat = mySeat(); if (!seat) return;
      const hd = home.day, wd = (hd - 1) % 7;
      if (wd === 3 && toldDay !== hd && home.hour >= 8 && home.hour < 14) {
        toldDay = hd;
        say(`The council of the realm sits today at two, in the great hall at ${k.place(capitalId())?.name || 'the capital'}. ${seat.role === 'monarch' ? 'It cannot begin without you.' : 'Your seat waits for you.'}`);
        if (s.world.placeId === capitalId()) { const keep = s.world.buildings.find((b) => b.royal); if (keep) O.addLead && O.addLead({ place: s.world.placeId, b: keep.id, until: hd * 1440 + 17 * 60, why: 'council', label: 'The council of the realm, at two' }); }
      }
      const P = k.councilPending;
      if (P && !P.done && P.day === hd && home.hour >= 17) {
        P.done = true; P.endedAt = 17;
        if (seat.role === 'monarch') { k.addNews('The leaders of the realm waited in the great hall until five, but the monarch never came. They rode home with nothing decided.', 'politics'); for (const L of Object.values(k.leaders || {})) L.favour = Math.max(-1, (L.favour || 0) - 0.03); PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.04); say('The council waited for you until five, then rode home. They will remember it.', 'bad'); }
        else { _hold(); say('The council sat without you; your town had no voice there today.', 'bad'); }
      }
    });
    // the minutes, for whoever asks at the castle or reads the map
    O.councilMinutes = () => {
      const log = (K().councilLog || []).slice(-3).reverse();
      if (!log.length) return '<p class="caption">The council of the realm meets every Thursday at two in the great hall.</p>';
      return log.map((m) => `<div class="lbl">Council of day ${m.day}</div><ul class="chron">${m.items.map((it) => `<li>${esc(it.who)} of ${esc(it.place)}: ${it.sacked ? 'put out of office' : it.resigned ? 'resigned' : `asked for ${esc(it.ask)}, ${it.granted ? 'granted' : 'refused'}`}</li>`).join('')}</ul>`).join('');
    };
  }
  O.CouncilUI = { setup };
})();
