// The Business tab (B, or from the menu): it changes with what you do. The crown's business if you
// wear it; your own businesses (income, staff, purse, and the full management); and every post you
// hold: wage, hours, how you've done, your master and your fellow workers, with what you can do about
// it (hand in your notice, or ask for a raise: by letter if you have one to send, or in person).
'use strict';
(function () {
  function setup(game, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t)), money = (n) => O.money(Math.round(n));
    const simOf = (e) => (O.Travel?.visited.get(e.place)?.sim) || cur();
    O.mailHandlers = O.mailHandlers || {};
    O.mailHandlers.raise = ({ place, biz, role }) => { const e = ((O.Employment && O.Employment.posts()) || []).find((x) => x.place === place && x.biz === biz && x.role === role); if (e) askRaise(e, 'letter', true); };
    function askRaise(e, how, answered) {
      if (how === 'letter' && !answered) { // the letter goes; the answer comes back later
        if ((PS.mail || []).some((m) => m.kind === 'raise' && m.data.biz === e.biz && m.data.place === e.place)) return say('You have written already. Wait for the answer.', 'bad');
        O.sendMail('raise', { place: e.place, biz: e.biz, role: e.role }, 8 + Math.random() * 14, `${e.masterName || 'Your master'}'s answer about a raise`);
        say(`Your letter goes to ${e.masterName || 'your master'}. The answer will come in its own time.`); return open();
      }
      const s = simOf(e), boss = e.master != null && s.byId.get(e.master), aff = boss ? (boss.rel.get(0)?.affinity || 0) : 0, st = e.stats || {};
      if ((e.raiseAsked || -9) > s.day - 6) return say(`${boss ? boss.first : 'Your master'} says you asked only lately. Wait a while.`, 'bad');
      e.raiseAsked = s.day;
      if (answered) { /* (the reply to your letter) */ }
      const merit = (st.shifts || 0) >= 4 && (st.late || 0) + (st.missed || 0) * 2 <= (st.shifts || 0) / 3 && (st.tasks || 0) / Math.max(1, st.shifts || 1) >= 2;
      const yes = merit && (aff > 0 || how === 'letter') && Math.random() < 0.6 + aff * 0.4;
      if (yes) { e.wage += 1; if (boss) s.relate(boss, { id: 0 }, -0.02); say(how === 'letter' ? `A reply comes back from ${boss ? boss.first : 'your master'}: "Agreed. ₳${e.wage} a day from now on."` : `${boss ? boss.first : 'Your master'} thinks it over. "Very well. ₳${e.wage} a day."`); }
      else { if (boss) s.relate(boss, { id: 0 }, -0.05); say(how === 'letter' ? `A reply comes back: "Not yet. ${merit ? 'Times are hard.' : 'Show me more first: on time, and more done.'}"` : `"${merit ? 'Not now. The purse won\'t bear it.' : 'A raise? Show me better work first, and turn up on time.'}"`, 'bad'); }
      open();
    }
    O.askRaise = askRaise;
    const TABS = [['crown', 'The Crown'], ['work', 'Your work'], ['own', 'Your businesses'], ['home', 'Your home'], ['war', 'War'], ['ways', 'Ways up']];
    const ROYAL = ['monarch', 'consort', 'heir', 'prince', 'princess'];
    // how you leave a post depends on what it is
    function leaveOf(e) {
      if (e.role === 'monarch') return ['abdicate', 'Abdicate the throne'];
      if (ROYAL.includes(e.role)) return ['renounce', 'Renounce your place at court'];
      if (e.role === 'apprentice') return ['indenture', 'Buy out your indenture (₳20)'];
      if (['priest', 'bishop', 'chaplain'].includes(e.role) && PS.vows) return ['vows', 'Ask to be released from your vows'];
      if (/royal guard|knight|squire|soldier/.test(e.role)) return ['service', 'Ask to be released from service'];
      if (O.COURT && O.COURT.has(e.role)) return ['leave', "Ask the crown's leave to go"];
      return ['notice', 'Hand in your notice'];
    }
    function open(tab) {
      if (typeof tab === 'string') PS.bizTab = tab;
      const s = cur(), posts = (O.Employment && O.Employment.posts()) || [], mine = O.myBusinesses ? O.myBusinesses() : [];
      const secs = { crown: [], work: [], own: [], home: [], war: [], ways: [] }, parts = [];
      if (O.crowned && O.crowned()) { const k = O.SimRef.home.kingdom; secs.crown.push(`<h3>The Crown</h3><div class="kv"><div><span class="lbl">Royal treasury</span><b>${money(k.treasury)}</b></div><div><span class="lbl">Crown tax</span><b>${Math.round(k.taxRate * 100)}%</b></div><div><span class="lbl">War</span><b>${k.war?.phase === 'war' ? 'At war' : 'At peace'}</b></div></div><div class="topics">${['realm', 'justice', 'honours', 'works', 'fest', 'war'].map((t) => `<button data-crown="${t}">${{ realm: 'The realm', justice: 'Justice', honours: 'Honours', works: 'Works', fest: 'Festivities and guests', war: 'War and peace' }[t]}</button>`).join('')}</div>`); }
      for (const { b, s: bs, bz } of mine) {
        const staff = bz.workers.map((id) => bs.byId.get(id)).filter(Boolean);
        secs.own.push(`<h3>${esc(bz.name)} <small class="lbl">${esc(bs.world.name)}, yours</small></h3><div class="kv"><div><span class="lbl">In the till</span><b>${money(bz.cash)}</b></div><div><span class="lbl">Sold today</span><b>${money(bz.salesToday || 0)}</b></div><div><span class="lbl">Staff</span><b>${staff.length}</b><small>${staff.slice(0, 5).map((q) => esc(q.first + ' (' + q.job.role + ')')).join(', ')}</small></div><div><span class="lbl">Your profits so far</span><b>${money(PS.bizIncome || 0)}</b></div></div><div class="topics"><button data-run="${bs.world.placeId}:${b.id}">Manage ${esc(bz.name)}</button></div>`);
      }
      posts.forEach((e, i) => {
        const es = simOf(e), bz = es.world.placeId === e.place ? es.biz.get(e.biz) : null, royal = ROYAL.includes(e.role), boss = !royal && e.master != null && es.byId.get(e.master), st = e.stats || {};
        const mates = bz ? bz.workers.map((id) => es.byId.get(id)).filter((q) => q && q !== boss).slice(0, 8) : [];
        const like = boss ? (boss.rel.get(0)?.affinity || 0) : 0, how = O.jobHow ? O.jobHow(e) : { tasks: [] }, [o, c] = O.jobHours ? O.jobHours(e) : [8, 17];
        const hh = (h) => `${Math.floor(h) % 24}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
        const mode = royal ? `Your days at court run from ${hh(o)} to ${hh(c)}.` : how.mode === 'quota' ? `A day's work: do each task below and your day is done, whenever that is. Hours ${hh(o)} to ${hh(c)}.` : `A shift from ${hh(o)} to ${hh(c)}: stay the hours, and new work comes along through the day.`;
        const list = e.onShift && how.tasks.length ? `<h4>Today's tasks</h4><ul class="chron">${how.tasks.map((t) => `<li>${t.done ? '☑' : '☐'} <b>${esc(t.text)}</b>${t.need > 1 ? ` (${t.have}/${t.need})` : ''}${t.done ? '' : `<br><small class="lbl">${esc(t.how)}</small>`}</li>`).join('')}</ul>` : `<p class="caption">${e.dayInfo?.dayDone ? 'Your work is done for today.' : 'Your tasks are set when your shift begins.'}</p>`;
        const [lk, ll] = leaveOf(e);
        secs.work.push(`<h3>${esc(O.roleName ? O.roleName(e.role) : e.role)} <small class="lbl">${royal ? esc(e.placeName) : `at ${esc(e.bizName)}, ${esc(e.placeName)}`}</small></h3>${how.summary ? `<p>${esc(how.summary)}</p>` : ''}<p class="caption">${mode}</p><div class="kv"><div><span class="lbl">${royal ? 'From the treasury' : 'Wage'}</span><b>₳${e.wage}</b><small>a day</small></div><div><span class="lbl">Days worked</span><b>${st.shifts || 0}</b><small>${st.late || 0} late, ${st.missed || 0} missed, ${st.tasks || 0} tasks done</small></div>${royal ? '' : `<div><span class="lbl">Your master</span><b>${esc(boss ? boss.name : e.masterName || 'the crown')}</b><small>${boss ? (like > 0.3 ? 'thinks well of you' : like < -0.2 ? 'is not pleased with you' : 'has no strong view of you') : ''}</small></div><div><span class="lbl">Fellow workers</span><b>${mates.length}</b><small>${mates.map((q) => esc(q.first + ' (' + q.job.role + ')')).join(', ') || 'none'}</small></div>`}</div>${list}
          <div class="topics">${boss && !(O.COURT && O.COURT.has(e.role)) ? `<button data-raise="${i}" data-how="${PS.items.includes('letter') ? 'letter' : 'word'}">${PS.items.includes('letter') ? 'Ask for a raise by letter' : 'Ask for a raise (send word)'}</button>` : ''}<button data-leave="${i}:${lk}">${ll}</button></div>`);
      });
      // your home, and a party in it
      const home = myHome(s);
      if (home) {
        const P = s.party && s.party.day === s.day ? s.party : null;
        const friends = s.people.filter((q) => q.age >= 16 && !q.visitor && q.alive !== false && (q.rel.get(0)?.affinity || 0) > 0.12).sort((a, b) => (b.rel.get(0)?.affinity || 0) - (a.rel.get(0)?.affinity || 0)).slice(0, 10);
        secs.home.push(`<h3>Your home <small class="lbl">${esc(home.type === 'house' ? 'your house' : home.name)}, ${esc(s.world.name)}</small></h3>${P ? `<p>A party tonight: ${P.guests.length} invited households have said they'll come. Doors open at seven.</p>` : friends.length ? `<p>Throw a party tonight, from seven: food and ale for ₳10, and ₳2 a head. Not everyone you ask will come, and they'll come and go as they please; families come together.</p><div class="topics">${friends.map((q) => `<label style="display:inline-block;margin:2px 8px 2px 0"><input type="checkbox" data-inv="${q.id}" checked> ${esc(q.name)}</label>`).join('')}</div><div class="topics"><button data-party="1">Send out the invitations</button></div>` : '<p class="caption">Make some friends in town and you could have them round.</p>'}`);
      }
      if (!secs.work.length && !posts.length) secs.work.push('<p>You have no post. Ask anyone "Who\'s taking on hands?", or look for For Sale signs on empty shops.</p>');
      if (O.warTabHTML) { const w = O.warTabHTML(); if (w) secs.war.push(w); }
      if (O.careersHTML) secs.ways.push(O.careersHTML());
      parts.push('<p class="caption">Your lands, houses and offices are under Holdings (P). Your day\'s undertakings are under J.</p>');
      const avail = TABS.filter(([k]) => secs[k].length || k === 'work');
      let cur0 = PS.bizTab && avail.some(([k]) => k === PS.bizTab) ? PS.bizTab : (secs.crown.length ? 'crown' : 'work');
      const bar = `<div class="topics tabs" style="margin-bottom:10px">${avail.map(([k, l]) => `<button data-tab="${k}" class="${k === cur0 ? 'hot' : ''}">${l}</button>`).join('')}</div>`;
      O.Panels.open('Business', bar + secs[cur0].join('') + parts.join(''), (r) => {
        r.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => open(b.dataset.tab));
        O.bindCareers && O.bindCareers(r, open);
        O.bindWarTab && O.bindWarTab(r, open);
        r.querySelectorAll('[data-crown]').forEach((b) => b.onclick = () => O.openCrown(b.dataset.crown));
        r.querySelectorAll('[data-run]').forEach((b) => b.onclick = () => { const [pl, id] = b.dataset.run.split(':'); const v = O.Travel.visited.get(pl); const bb = v && v.world.buildings.find((x) => x.id === +id); if (bb && pl === s.world.placeId) O.runBusiness(bb); else say('You can only manage it from where it is.', 'bad'); });
        r.querySelectorAll('[data-raise]').forEach((b) => b.onclick = () => { const e = posts[+b.dataset.raise]; if (b.dataset.how === 'letter') PS.remove('letter'); askRaise(e, b.dataset.how === 'letter' ? 'letter' : 'word'); });
        const pb = r.querySelector('[data-party]'); if (pb) pb.onclick = () => {
          const ids = [...r.querySelectorAll('[data-inv]')].filter((x) => x.checked).map((x) => +x.dataset.inv); if (!ids.length) return say('Invite someone first.', 'bad');
          { const cl = O.eventClash && O.eventClash(s, s.day, 19, 23); if (cl) return say(`Tonight everyone will be at ${cl.title.charAt(0).toLowerCase() + cl.title.slice(1)}. Have your party another night.`, 'bad'); }
          const cost = 10 + ids.length * 2; if (PS.money < cost) return say(`The food and ale would cost ₳${cost}.`, 'bad'); PS.money -= cost;
          const hh = new Map(), guests = [];
          for (const id of ids) { const q = s.byId.get(id); const aff = q.rel.get(0)?.affinity || 0; if (Math.random() > 0.35 + aff * 0.6) { s.remember(q, 'Was asked to the stranger\'s party, but had other plans.', 'social', 0.6, 0); continue; } hh.set(q.household, q); }
          for (const [h0, q] of hh) { const H = s.households[h0 - 1], from = 19 + (Math.random() * 2 - 0.5), to = 22 + Math.random() * 1.5; const members = H ? H.members.map((x) => s.byId.get(x)).filter((m) => m && m.alive !== false && (m.age >= 4)) : [q]; for (const m of members) guests.push({ id: m.id, from, to }); s.remember(q, 'Asked to the stranger\'s house for a party.', 'social', 1.2, 0); }
          s.party = { b: home.id, day: s.day, guests: [...hh.keys()], who: guests };
          if (hh.size) O.addLead && O.addLead({ place: s.world.placeId, b: home.id, until: s.day * 1440 + 23 * 60, why: 'party', label: 'Your party at home tonight' });
          say(hh.size ? `${hh.size} household${hh.size > 1 ? 's' : ''} will come tonight, from about seven. Some will be early and some late.` : 'Nobody can come tonight. Maybe another time.', hh.size ? '' : 'bad'); open();
        };
        r.querySelectorAll('[data-leave]').forEach((b) => b.onclick = () => { const [ix, k] = b.dataset.leave.split(':'); leave(posts[+ix], k); });
      });
    }
    function leave(e, k) {
      const s = simOf(e), K = O.SimRef.home.kingdom, Q = (m) => { O.Employment.quit(m, e); open(); };
      if (k === 'abdicate') return O.UI.dialog.open({ name: 'Abdicate?', color: '#7a1a2a', text: 'Lay down the crown? The council of the realm will choose who wears it after you, and you will be a subject again.', options: [{ key: 'y', label: 'Lay down the crown' }, { key: 'n', label: 'Keep it' }], onPick: (x) => {
        O.UI.dialog.close(); if (x !== 'y') return;
        const R = K.rulers, P = R && R.pretender, heir = P ? { name: P.name, sex: P.sex || 'm', age: P.age || 40, regnal: '', since: s.day, heir: null } : { name: 'Edmund', sex: 'm', age: 44, regnal: '', since: s.day, heir: null };
        if (R) { R.crown = heir; R.reigns.push({ who: K.crownTitle(), from: s.day, to: null, how: 'chosen by the council when the monarch abdicated' }); }
        PS.royal = false; PS.anointed = false; PS.coronation = null;
        K.addNews(`The monarch has abdicated. The council of the realm has chosen ${heir.name} to wear the crown.`, 'rulers');
        Q('You lay the crown on its cushion and walk out of the throne room a subject.');
      } });
      if (k === 'renounce') return Q(`You renounce your place at court.`);
      if (k === 'indenture') { if (PS.money < 20) return say('Buying out your indenture costs ₳20.', 'bad'); PS.money -= 20; const bz = s.biz.get(e.biz); if (bz) bz.cash += 20; return Q(`You pay ₳20 to ${e.masterName || 'your master'} and your indenture is torn up.`); }
      if (k === 'vows') { PS.vows = false; return Q('The bishop releases you from your vows, with a heavy heart.'); }
      if (k === 'service') return Q(`You are released from service at ${e.bizName}.`);
      if (k === 'leave') return Q("The crown grants you leave to go.");
      return Q(`You hand in your notice at ${e.bizName}.`);
    }
    O.openBusiness = open;
    const myHome = (s) => { const L = PS.lease && PS.lease.place === s.world.placeId && s.building(PS.lease.b); if (L) return L; return s.world.buildings.find((b) => b.owner?.kind === 'player' && ['house', 'townhouse', 'mansion', 'farmhouse', 'cottage'].includes(b.type)) || null; };
    // the guests' evening: they come when they come, all of a family together, and go home in their own time
    const SP = O.Sim.prototype, _plan = SP.plan;
    SP.plan = function (p) {
      const P = this.party;
      if (P && P.day === this.day && P.who) { const g = P.who.find((x) => x.id === p.id); if (g && this.hour >= g.from && this.hour < g.to && !p.task && !(p.health && p.health.illness)) return { act: 'socialise', b: P.b }; }
      return _plan.call(this, p);
    };
    // a good party: those who came think the better of you
    game.hooks.update.push(() => {
      const s = cur(), P = s && s.party; if (!P || P.done || s.day !== P.day || s.hour < 23) return;
      P.done = true; let n = 0;
      for (const g of P.who || []) { const q = s.byId.get(g.id); if (q && q.agent.inside === P.b || q && q.activity?.act === 'socialise') { s.relate(q, { id: 0 }, 0.15); n++; } }
      if (n) say(`The last of your guests head home. ${n} came; they'll remember a good evening.`);
    });
    // B opens Business from anywhere (closing whatever panel was up), and closes it again
    game.keyHandlers.push((e) => {
      if (e.code !== 'KeyB' || (O.UI.dialogOpen && O.UI.dialogOpen())) return false;
      const title = document.querySelector('.panel-modal h2')?.textContent;
      if (O.panelOpen) { O.Panels.close(); if (title === 'Business') return true; }
      O.npcUI && O.npcUI.talking && O.npcUI.talking() && O.npcUI.closeTalk();
      open(); return true;
    });
    // asking in person, at work
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; const e = ((O.Employment && O.Employment.posts()) || []).find((x) => x.master === q.id && x.place === cur().world.placeId); if (e) out.push(['raise', 'Ask for a raise']); return out; };
    npcUI.onExtra = (q, key, render) => { if (key !== 'raise') return prevOn && prevOn(q, key, render); const e = O.Employment.posts().find((x) => x.master === q.id && x.place === cur().world.placeId); npcUI.closeTalk(); askRaise(e, 'person'); O.Panels.close(); };
  }
  O.BusinessSetup = { setup };
})();
