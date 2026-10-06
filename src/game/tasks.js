// Your undertakings, in one place (J): the posts you hold, a bounty or hired work, what your gang has
// asked of you, the places you're being shown the way to, and what's on in town. Any of them can be given up. Walk out of a shift and
// you're not paid for the day and your master won't thank you; drop a bounty and the watch notes it;
// let your gang down and they remember.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    function open() {
      const s = cur(), posts = (O.Employment && O.Employment.posts()) || [], C = PS.contract && !(PS.contract.until && PS.contract.until < s.day * 1440 + s.minute) ? PS.contract : null;
      if (O.GangLife) for (const m of O.GangLife.mine()) if (m.task && !m.task.done && m.task.day != null && m.task.day < s.day - 3) m.task = null; // (old errands lapse)
      const gang = (O.GangLife ? O.GangLife.mine() : []).filter((m) => m.task && !m.task.done);
      const rows = [];
      posts.forEach((e, i) => rows.push(`<tr><td><b>${esc(e.role)}</b> at ${esc(e.bizName)}${e.place !== s.world.placeId ? `, ${esc(e.placeName)}` : ''}${e.onShift ? ' <span class="warn">(on shift now)</span>' : ''}</td><td>${e.onShift && !(O.COURT && O.COURT.has(e.role)) ? `<button data-quit="${i}">Walk out of today's work</button>` : `<button data-post="1">See it in Business</button>`}</td></tr>`));
      if (C) rows.push(`<tr><td>${esc(C.text)} <span class="caption">(₳${C.reward})</span></td><td><button data-contract="1">Give it up</button></td></tr>`);
      gang.forEach((m, i) => rows.push(`<tr><td>For your gang: ${esc(m.task.text || m.task.kind)}</td><td><button data-gang="${i}">Let it go</button></td></tr>`));
      if (s.party && s.party.day === s.day && !s.party.done) rows.push(`<tr><td>Your party tonight, from seven (${s.party.guests.length} household${s.party.guests.length === 1 ? '' : 's'} coming)</td><td><button data-party="1">Call it off</button></td></tr>`);
      const leads = (PS.leads || []).filter((l) => l.why !== 'contract' && l.why !== 'party' && l.until > s.day * 1440 + s.minute);
      leads.forEach((l, i) => rows.push(`<tr><td>Being shown the way: ${esc(l.label || 'somewhere to go')}</td><td><button data-lead="${i}">Stop showing me</button></td></tr>`));
      const cal = O.calendarHTML ? O.calendarHTML() : '';
      O.Panels.open('Your undertakings', (rows.length ? `<table><tbody>${rows.join('')}</tbody></table>${(() => { const m = posts.some((e) => e.master != null && e.master !== 0 && !(O.COURT && O.COURT.has(e.role))); const parts = []; if (m) parts.push("Walking out mid-shift loses the day's pay and angers your master."); if (PS.contract) parts.push('Giving up a bounty, the watch will remember.'); return parts.length ? `<p class="caption">${parts.join(' ')}</p>` : ''; })()}` : '<p>Nothing on your hands just now.</p>') + cal, (r) => {
        O.bindCalendar && O.bindCalendar(r);
        r.querySelectorAll('[data-post]').forEach((b) => b.onclick = () => O.openBusiness('work'));
        r.querySelectorAll('[data-quit]').forEach((b) => b.onclick = () => {
          const e = posts[+b.dataset.quit], es = (O.Travel?.visited.get(e.place)?.sim) || s, boss = e.master != null && es.byId.get(e.master);
          if (boss) { es.relate(boss, { id: 0 }, e.onShift ? -0.35 : -0.08); es.remember(boss, e.onShift ? 'The stranger walked out in the middle of a shift. No pay for that.' : 'The stranger left my service.', 'work', e.onShift ? 2 : 1); }
          if (e.dayInfo) { e.onShift = false; e.dayInfo.walkedOut = true; e.dayInfo.dayDone = true; e.tasks = []; } say(`You walk out. ${boss ? boss.first + ' shouts after you that you\'ll not see an aurin for today.' : 'No pay for today.'}`, 'bad');
          if (e.onShift) PS.rep.local = Math.max(-1, PS.rep.local - 0.05);
          open();
        });
        const c = r.querySelector('[data-contract]'); if (c) c.onclick = () => { if (PS.contract?.kind === 'escort') { const q = s.byId.get(PS.contract.target); if (q) { q.agent.frozen = false; q.agent.forceAnim = null; q.task = { act: 'leave', outdoor: true, zone: 'east', emigrating: true }; } } PS.contract = null; O.dropLead((l) => l.why === 'contract'); PS.rep.guard = Math.max(-1, PS.rep.guard - 0.05); say('You give up the contract. No pay.'); open(); };
        r.querySelectorAll('[data-gang]').forEach((b) => b.onclick = () => { const m = gang[+b.dataset.gang]; m.task = null; O.dropLead((l) => l.why === 'gangtask'); m.loyaltyHits = (m.loyaltyHits || 0) + 1; PS.rep.criminal = Math.max(0, PS.rep.criminal - 0.02); say('You let the job go. Your gang will remember it.', 'bad'); open(); });
        const pt = r.querySelector('[data-party]'); if (pt) pt.onclick = () => { for (const g of s.party.who || []) { const q = s.byId.get(g.id); if (q) { s.relate(q, { id: 0 }, -0.05); s.remember(q, 'The stranger called off their party.', 'social', 0.6, 0); } } s.party = null; O.dropLead((l) => l.why === 'party'); say('You send word round: the party is off. The food will keep.', 'bad'); open(); };
        r.querySelectorAll('[data-lead]').forEach((b) => b.onclick = () => { const l = leads[+b.dataset.lead]; O.dropLead((x) => x === l); open(); });
      });
    }
    O.openTasks = open;
    game.keyHandlers.push((e) => {
      if (e.code !== 'KeyJ' || (O.UI.dialogOpen && O.UI.dialogOpen())) return false;
      const title = document.querySelector('.panel-modal h2')?.textContent;
      if (O.panelOpen) { O.Panels.close(); if (title === 'Your undertakings') return true; }
      open(); return true;
    });
  }
  O.TasksSetup = { setup };
})();
