// Letters. Buy a sheet at the scrivener's, the post house or the store, write it from your satchel and
// pay a messenger to carry it: they walk it through the streets to the person and go in to hand it over.
// A letter to your master that you're unwell, or can't come, excuses you that day (but too many and
// they'll tire of it); one saying you'll be late covers your lateness; a notice ends your service.
// Where there's no post house you can give the letter to its reader yourself.
'use strict';
(function () {
  const KINDS = [
    ['unwell', "I'm unwell and can't come in today", 'work'],
    ['cannot', "I can't come in today", 'work'],
    ['late', "I'll be late today", 'work'],
    ['notice', 'I give notice: I am leaving your service', 'work'],
    ['greet', 'Greetings and good wishes', 'any'],
    ['thanks', 'Thank you for your kindness', 'any'],
    ['meet', 'Meet me at the square at noon', 'any'],
  ];
  function setup(game, home, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    // what a letter does when it's read
    function deliver(s, L) {
      const q = s.byId.get(L.to); if (!q) return;
      const e = PS.emp;
      s.remember(q, `A letter from the stranger: “${L.text}”`, 'social', 1, 0); s.relate(q, { id: 0 }, L.kind === 'thanks' || L.kind === 'greet' ? 0.04 : 0);
      if (e && e.place === s.world.placeId && e.master === q.id) {
        if (L.kind === 'unwell' || L.kind === 'cannot') { e.excuseDay = s.day + (s.hour >= 20 ? 1 : 0); if (e.dayInfo && e.day === e.excuseDay) e.dayInfo.excused = true; e.stats.excused = (e.stats.excused || 0); if (e.stats.excused >= 3) s.relate(q, { id: 0 }, -0.05); }
        if (L.kind === 'late' && e.dayInfo) e.dayInfo.excused = true;
        if (L.kind === 'notice') { O.Employment.quit(`${q.first} has your letter of notice. You no longer work at ${e.bizName}.`); return; }
      }
      say(`Your letter has been put into ${q.first}'s hands.`);
    }
    O.Letters = { KINDS, deliver };

    // the messenger carries it: a real walk to the reader's door
    const SP = O.Sim.prototype, _plan = SP.plan, _onEnter = SP.onEnter;
    SP.plan = function (p) { if (p.task && p.task.act === 'letter') { const q = this.byId.get(p.task.to); const b = q && (q.agent.inside != null ? q.agent.inside : q.home); return { act: 'letter', b: b != null ? b : p.home, to: p.task.to }; } return _plan.call(this, p); };
    SP.onEnter = function (p, bid) {
      if (p.task && p.task.act === 'letter') { const q = this.byId.get(p.task.to); if (q && (q.agent.inside === bid || q.home === bid)) { const L = p.task.letter; p.task = null; deliver(this, L); this.remember(p, `Carried a letter to ${q.name}.`, 'work', 0.4); return; } }
      return _onEnter.call(this, p, bid);
    };

    function write(idx) {
      const s = cur(), e = PS.emp;
      const known = [...(s.people.filter((q) => q.alive !== false && ((q.rel.get(0)?.familiar || 0) > 0.05 || (e && e.master === q.id && e.place === s.world.placeId))))].slice(0, 16);
      if (!known.length) return say('You know nobody here well enough to write to.', 'bad');
      const opts = known.map((q) => `<option value="${q.id}">${esc(q.name)}${e && e.master === q.id ? ' (your master)' : ''}</option>`).join('');
      O.Panels.open('Write a letter', `<p class="caption">To whom, and what shall it say?</p><p><select data-to>${opts}</select></p><div class="topics">${KINDS.map(([k, t]) => `<button data-k="${k}">${esc(t)}</button>`).join('')}</div>`, (r) => {
        r.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => {
          const to = +r.querySelector('[data-to]').value, kind = b.dataset.k, text = KINDS.find((x) => x[0] === kind)[1];
          PS.items.splice(idx, 1);
          const L = { to, kind, text, day: s.day };
          // a messenger, if the town keeps a post house
          const post = [...s.biz.values()].find((bz) => bz.type === 'posthouse');
          const runner = post && post.workers.map((id) => s.byId.get(id)).find((q) => q && (q.job?.role === 'messenger' || q.job?.role === 'mounted courier') && !q.task && q.alive !== false);
          O.Panels.close();
          if (runner) { if (PS.money >= 1) { PS.money -= 1; post.cash += 1; } runner.task = { act: 'letter', to, letter: L }; runner.agent.goal = null; runner.agent.path = null; say(`You seal the letter and pay an aurin. ${runner.first}, the messenger, sets off with it.`); }
          else { (PS.sealed = PS.sealed || []).push(L); say('There is no messenger to be had here. You carry the sealed letter yourself: give it to them when you see them.'); }
          game.player.anim = 'write'; game.player.ft = 0; setTimeout(() => { if (game.player.anim === 'write') game.player.anim = 'idle'; }, 1200);
        });
      });
    }
    O.writeLetter = write;
    // handing over a letter you carried yourself
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; if ((PS.sealed || []).some((L) => L.to === q.id)) out.push(['letter', 'Give them your letter']); return out; };
    npcUI.onExtra = (q, key, render) => { if (key !== 'letter') return prevOn && prevOn(q, key, render); const i = PS.sealed.findIndex((L) => L.to === q.id); const L = PS.sealed.splice(i, 1)[0]; deliver(cur(), L); return render(`${q.first} breaks the seal and reads it.`); };
  }
  O.LettersSetup = { setup };
})();
