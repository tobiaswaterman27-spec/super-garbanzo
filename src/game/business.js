// The Business tab (B, or from the menu): it changes with what you do. The crown's business if you
// wear it; your own businesses (income, staff, purse, and the full management); and every post you
// hold: wage, hours, how you've done, your master and your fellow workers, with what you can do about
// it (hand in your notice, or ask for a raise: by letter if you have one to send, or in person).
'use strict';
(function () {
  function setup(game, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t)), money = (n) => O.money(Math.round(n));
    const simOf = (e) => (O.Travel?.visited.get(e.place)?.sim) || cur();
    function askRaise(e, how) {
      const s = simOf(e), boss = e.master != null && s.byId.get(e.master), aff = boss ? (boss.rel.get(0)?.affinity || 0) : 0, st = e.stats || {};
      if ((e.raiseAsked || -9) > s.day - 6) return say(`${boss ? boss.first : 'Your master'} says you asked only lately. Wait a while.`, 'bad');
      e.raiseAsked = s.day;
      const merit = (st.shifts || 0) >= 4 && (st.late || 0) + (st.missed || 0) * 2 <= (st.shifts || 0) / 3 && (st.tasks || 0) / Math.max(1, st.shifts || 1) >= 2;
      const yes = merit && (aff > 0 || how === 'letter') && Math.random() < 0.6 + aff * 0.4;
      if (yes) { e.wage += 1; if (boss) s.relate(boss, { id: 0 }, -0.02); say(how === 'letter' ? `A reply comes back from ${boss ? boss.first : 'your master'}: "Agreed. ₳${e.wage} a day from now on."` : `${boss ? boss.first : 'Your master'} thinks it over. "Very well. ₳${e.wage} a day."`); }
      else { if (boss) s.relate(boss, { id: 0 }, -0.05); say(how === 'letter' ? `A reply comes back: "Not yet. ${merit ? 'Times are hard.' : 'Show me more first: on time, and more done.'}"` : `"${merit ? 'Not now. The purse won\'t bear it.' : 'A raise? Show me better work first, and turn up on time.'}"`, 'bad'); }
      open();
    }
    O.askRaise = askRaise;
    function open() {
      const s = cur(), posts = (O.Employment && O.Employment.posts()) || [], mine = O.myBusinesses ? O.myBusinesses() : [];
      const parts = [];
      if (O.crowned && O.crowned()) { const k = O.SimRef.home.kingdom; parts.push(`<h3>The Crown</h3><div class="kv"><div><span class="lbl">Royal treasury</span><b>${money(k.treasury)}</b></div><div><span class="lbl">Crown tax</span><b>${Math.round(k.taxRate * 100)}%</b></div><div><span class="lbl">War</span><b>${k.war?.phase === 'war' ? 'At war' : 'At peace'}</b></div></div><div class="topics">${['realm', 'justice', 'honours', 'works', 'fest', 'war'].map((t) => `<button data-crown="${t}">${{ realm: 'The realm', justice: 'Justice', honours: 'Honours', works: 'Works', fest: 'Festivities and guests', war: 'War and peace' }[t]}</button>`).join('')}</div>`); }
      for (const { b, s: bs, bz } of mine) {
        const staff = bz.workers.map((id) => bs.byId.get(id)).filter(Boolean);
        parts.push(`<h3>${esc(bz.name)} <small class="lbl">${esc(bs.world.name)}, yours</small></h3><div class="kv"><div><span class="lbl">In the till</span><b>${money(bz.cash)}</b></div><div><span class="lbl">Sold today</span><b>${money(bz.salesToday || 0)}</b></div><div><span class="lbl">Staff</span><b>${staff.length}</b><small>${staff.slice(0, 5).map((q) => esc(q.first + ' (' + q.job.role + ')')).join(', ')}</small></div><div><span class="lbl">Your profits so far</span><b>${money(PS.bizIncome || 0)}</b></div></div><div class="topics"><button data-run="${bs.world.placeId}:${b.id}">Manage ${esc(bz.name)}</button></div>`);
      }
      posts.forEach((e, i) => {
        const es = simOf(e), bz = es.world.placeId === e.place ? es.biz.get(e.biz) : null, boss = e.master != null && es.byId.get(e.master), st = e.stats || {};
        const mates = bz ? bz.workers.map((id) => es.byId.get(id)).filter((q) => q && q !== boss).slice(0, 8) : [];
        const like = boss ? (boss.rel.get(0)?.affinity || 0) : 0;
        parts.push(`<h3>${esc(e.role)} <small class="lbl">at ${esc(e.bizName)}, ${esc(e.placeName)}</small></h3><div class="kv"><div><span class="lbl">Wage</span><b>₳${e.wage}</b><small>a day</small></div><div><span class="lbl">Shifts worked</span><b>${st.shifts || 0}</b><small>${st.late || 0} late, ${st.missed || 0} missed, ${st.tasks || 0} tasks done</small></div><div><span class="lbl">Your master</span><b>${esc(boss ? boss.name : e.masterName || 'the crown')}</b><small>${boss ? (like > 0.3 ? 'thinks well of you' : like < -0.2 ? 'is not pleased with you' : 'has no strong view of you') : ''}</small></div><div><span class="lbl">Fellow workers</span><b>${mates.length}</b><small>${mates.map((q) => esc(q.first + ' (' + q.job.role + ')')).join(', ') || 'none'}</small></div></div>
          <div class="topics">${boss ? `<button data-raise="${i}" data-how="${PS.items.includes('letter') ? 'letter' : 'word'}">${PS.items.includes('letter') ? 'Ask for a raise by letter' : 'Ask for a raise (send word)'}</button>` : ''}<button data-notice="${i}">Hand in your notice</button></div>`);
      });
      // your home, and a party in it
      const home = myHome(s);
      if (home) {
        const P = s.party && s.party.day === s.day ? s.party : null;
        const friends = s.people.filter((q) => q.age >= 16 && !q.visitor && q.alive !== false && (q.rel.get(0)?.affinity || 0) > 0.12).sort((a, b) => (b.rel.get(0)?.affinity || 0) - (a.rel.get(0)?.affinity || 0)).slice(0, 10);
        parts.push(`<h3>Your home <small class="lbl">${esc(home.type === 'house' ? 'your house' : home.name)}, ${esc(s.world.name)}</small></h3>${P ? `<p>A party tonight: ${P.guests.length} invited households have said they'll come. Doors open at seven.</p>` : friends.length ? `<p>Throw a party tonight, from seven: food and ale for ₳10, and ₳2 a head. Not everyone you ask will come, and they'll come and go as they please; families come together.</p><div class="topics">${friends.map((q) => `<label style="display:inline-block;margin:2px 8px 2px 0"><input type="checkbox" data-inv="${q.id}" checked> ${esc(q.name)}</label>`).join('')}</div><div class="topics"><button data-party="1">Send out the invitations</button></div>` : '<p class="caption">Make some friends in town and you could have them round.</p>'}`);
      }
      if (!parts.length) parts.push('<p>You have no post and no business. Ask anyone "Who\'s taking on hands?", or look for For Sale signs on empty shops.</p>');
      parts.push('<p class="caption">Your lands, houses and offices are under Holdings (P). Your day\'s undertakings are under J.</p>');
      O.Panels.open('Business', parts.join(''), (r) => {
        r.querySelectorAll('[data-crown]').forEach((b) => b.onclick = () => O.openCrown(b.dataset.crown));
        r.querySelectorAll('[data-run]').forEach((b) => b.onclick = () => { const [pl, id] = b.dataset.run.split(':'); const v = O.Travel.visited.get(pl); const bb = v && v.world.buildings.find((x) => x.id === +id); if (bb && pl === s.world.placeId) O.runBusiness(bb); else say('You can only manage it from where it is.', 'bad'); });
        r.querySelectorAll('[data-raise]').forEach((b) => b.onclick = () => { const e = posts[+b.dataset.raise]; if (b.dataset.how === 'letter') PS.remove('letter'); askRaise(e, b.dataset.how === 'letter' ? 'letter' : 'word'); });
        const pb = r.querySelector('[data-party]'); if (pb) pb.onclick = () => {
          const ids = [...r.querySelectorAll('[data-inv]')].filter((x) => x.checked).map((x) => +x.dataset.inv); if (!ids.length) return say('Invite someone first.', 'bad');
          const cost = 10 + ids.length * 2; if (PS.money < cost) return say(`The food and ale would cost ₳${cost}.`, 'bad'); PS.money -= cost;
          const hh = new Map(), guests = [];
          for (const id of ids) { const q = s.byId.get(id); const aff = q.rel.get(0)?.affinity || 0; if (Math.random() > 0.35 + aff * 0.6) { s.remember(q, 'Was asked to the stranger\'s party, but had other plans.', 'social', 0.6, 0); continue; } hh.set(q.household, q); }
          for (const [h0, q] of hh) { const H = s.households[h0 - 1], from = 19 + (Math.random() * 2 - 0.5), to = 22 + Math.random() * 1.5; const members = H ? H.members.map((x) => s.byId.get(x)).filter((m) => m && m.alive !== false && (m.age >= 4)) : [q]; for (const m of members) guests.push({ id: m.id, from, to }); s.remember(q, 'Asked to the stranger\'s house for a party.', 'social', 1.2, 0); }
          s.party = { b: home.id, day: s.day, guests: [...hh.keys()], who: guests };
          if (hh.size) O.addLead && O.addLead({ place: s.world.placeId, b: home.id, until: s.day * 1440 + 23 * 60, why: 'party', label: 'Your party at home tonight' });
          say(hh.size ? `${hh.size} household${hh.size > 1 ? 's' : ''} will come tonight, from about seven. Some will be early and some late.` : 'Nobody can come tonight. Maybe another time.', hh.size ? '' : 'bad'); open();
        };
        r.querySelectorAll('[data-notice]').forEach((b) => b.onclick = () => { const e = posts[+b.dataset.notice]; O.Employment.quit(`You hand in your notice at ${e.bizName}.`, e); open(); });
      });
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
    game.keyHandlers.push((e) => { if (e.code === 'KeyB' && !O.panelOpen) { open(); return true; } return false; });
    // asking in person, at work
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; const e = ((O.Employment && O.Employment.posts()) || []).find((x) => x.master === q.id && x.place === cur().world.placeId); if (e) out.push(['raise', 'Ask for a raise']); return out; };
    npcUI.onExtra = (q, key, render) => { if (key !== 'raise') return prevOn && prevOn(q, key, render); const e = O.Employment.posts().find((x) => x.master === q.id && x.place === cur().world.placeId); npcUI.closeTalk(); askRaise(e, 'person'); O.Panels.close(); };
  }
  O.BusinessSetup = { setup };
})();
