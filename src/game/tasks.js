// Your undertakings, in one place (J): the posts you hold, a bounty or hired work, what your gang has
// asked of you, and the arrow you're following. Any of them can be given up. Walk out of a shift and
// you're not paid for the day and your master won't thank you; drop a bounty and the watch notes it;
// let your gang down and they remember.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    function open() {
      const s = cur(), posts = (O.Employment && O.Employment.posts()) || [], C = PS.contract, gang = (O.GangLife ? O.GangLife.mine() : []).filter((m) => m.task && !m.task.done);
      const rows = [];
      posts.forEach((e, i) => rows.push(`<tr><td><b>${esc(e.role)}</b> at ${esc(e.bizName)}${e.place !== s.world.placeId ? `, ${esc(e.placeName)}` : ''}${e.onShift ? ' <span class="warn">(on shift now)</span>' : ''}</td><td><button data-quit="${i}">${e.onShift ? 'Walk out' : 'Hand in notice'}</button></td></tr>`));
      if (C) rows.push(`<tr><td>${esc(C.text)} <span class="caption">(₳${C.reward})</span></td><td><button data-contract="1">Give it up</button></td></tr>`);
      gang.forEach((m, i) => rows.push(`<tr><td>For your gang: ${esc(m.task.text || m.task.kind)}</td><td><button data-gang="${i}">Let it go</button></td></tr>`));
      const leads = (PS.leads || []).filter((l) => l.why !== 'contract' && l.until > s.day * 1440 + s.minute);
      leads.forEach((l, i) => rows.push(`<tr><td>Arrow: ${esc(l.label || 'somewhere to go')}</td><td><button data-lead="${i}">Stop</button></td></tr>`));
      O.Panels.open('Your undertakings', rows.length ? `<table><tbody>${rows.join('')}</tbody></table><p class="caption">Walking out mid-shift loses the day's pay and angers your master. Giving up a bounty, the watch will remember.</p>` : '<p>Nothing on your hands just now.</p>', (r) => {
        r.querySelectorAll('[data-quit]').forEach((b) => b.onclick = () => {
          const e = posts[+b.dataset.quit], es = (O.Travel?.visited.get(e.place)?.sim) || s, boss = e.master != null && es.byId.get(e.master);
          if (boss) { es.relate(boss, { id: 0 }, e.onShift ? -0.35 : -0.08); es.remember(boss, e.onShift ? 'The stranger walked out in the middle of a shift. No pay for that.' : 'The stranger left my service.', 'work', e.onShift ? 2 : 1); }
          O.Employment.quit(e.onShift ? `You walk out. ${boss ? boss.first + ' shouts after you that you\'ll not see a penny for today.' : 'No pay for today.'}` : `You hand in your notice at ${e.bizName}.`, e);
          if (e.onShift) PS.rep.local = Math.max(-1, PS.rep.local - 0.05);
          open();
        });
        const c = r.querySelector('[data-contract]'); if (c) c.onclick = () => { if (PS.contract?.kind === 'escort') { const q = s.byId.get(PS.contract.target); if (q) { q.agent.frozen = false; q.agent.forceAnim = null; q.task = { act: 'leave', outdoor: true, zone: 'east', emigrating: true }; } } PS.contract = null; O.dropLead((l) => l.why === 'contract'); PS.rep.guard = Math.max(-1, PS.rep.guard - 0.05); say('You give up the contract. No pay.'); open(); };
        r.querySelectorAll('[data-gang]').forEach((b) => b.onclick = () => { const m = gang[+b.dataset.gang]; m.task = null; O.dropLead((l) => l.why === 'gangtask'); m.loyaltyHits = (m.loyaltyHits || 0) + 1; PS.rep.criminal = Math.max(0, PS.rep.criminal - 0.02); say('You let the job go. Your gang will remember it.', 'bad'); open(); });
        r.querySelectorAll('[data-lead]').forEach((b) => b.onclick = () => { const l = leads[+b.dataset.lead]; O.dropLead((x) => x === l); open(); });
      });
    }
    O.openTasks = open;
    game.keyHandlers.push((e) => { if (e.code === 'KeyJ' && !O.panelOpen) { open(); return true; } return false; });
  }
  O.TasksSetup = { setup };
})();
