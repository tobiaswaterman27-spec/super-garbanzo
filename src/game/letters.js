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
  ];
  function setup(game, home, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    // what a letter does when it's read
    function deliver(s, L) {
      const q = s.byId.get(L.to); if (!q) return;
      const e = PS.emp;
      const nm = (q.rel.get(0) || {}).name || 'the stranger';
      s.remember(q, `A letter from ${nm}: "${String(L.text).slice(0, 90)}"`, 'social', 1, 0);
      // what came with it: coin into their purse, a thing into their hands
      const encl = [];
      if (L.coin > 0) { const hh = s.household(q); if (hh) hh.money += L.coin; else q.purse = (q.purse || 0) + L.coin; encl.push(`₳${L.coin}`); }
      if (L.item) { (q.items = q.items || []).push(L.item); encl.push((O.Data.GOODS[L.item]?.name || L.item).toLowerCase()); }
      if (encl.length) { const worth = (L.coin || 0) + (L.item ? (O.Data.GOODS[L.item]?.base || 2) : 0); s.relate && s.relate(q, { id: 0 }, Math.min(0.25, 0.03 + worth * 0.01)); s.remember(q, `${nm} sent me ${encl.join(' and ')} with their letter.`, 'social', 1.4, 0.2); L.enclosed = encl.join(' and '); }
      if (L.kind === 'own' && O.AIChat && O.AIChat.readLetter) { O.AIChat.readLetter(s, q, L.text + (L.enclosed ? `\n(Folded inside the letter: ${L.enclosed}.)` : '')); say(`Your letter${L.enclosed ? ' and what you sent with it' : ''} has been put into ${q.first}'s hands.`); return; }
      if (e && e.place === s.world.placeId && e.master === q.id) {
        if (L.kind === 'unwell' || L.kind === 'cannot') { e.excuseDay = s.day + (s.hour >= 20 ? 1 : 0); if (e.dayInfo && e.day === e.excuseDay) e.dayInfo.excused = true; e.stats.excused = (e.stats.excused || 0); if (e.stats.excused >= 3) s.relate(q, { id: 0 }, -0.05); }
        if (L.kind === 'late' && e.dayInfo) e.dayInfo.excused = true;
        if (L.kind === 'notice') { O.Employment.quit(`${q.first} has your letter of notice. You no longer work at ${e.bizName}.`); return; }
      }
      say(`Your letter has been put into ${q.first}'s hands.`);
    }
    // something an NPC means to send you with a reply, taken from what they really have
    function takeFrom(s, q, name, amount) {
      const g = O.NpcActs && O.NpcActs.goodFor(name); if (!g) return null; const hh = s.household(q);
      if (g === 'coin') { const n = Math.max(0, Math.min(Math.round(+amount || 5), Math.floor(((hh && hh.money) || 0) - 5))); if (n < 1) return null; hh.money -= n; return { coin: n }; }
      if (hh && hh.pantry && (hh.pantry[g] || 0) >= 1) { hh.pantry[g] -= 1; return { item: g }; }
      if ((q.items || []).includes(g)) { q.items.splice(q.items.indexOf(g), 1); return { item: g }; }
      const bz = q.job && s.biz.get(q.job.biz); if (bz && (bz.stock[g] || 0) >= 1 && bz.owner === q.id) { bz.stock[g] -= 1; return { item: g }; }
      return null;
    }
    O.Letters = { KINDS, deliver, takeFrom };

    // the messenger carries it: a real walk to the reader's door
    const SP = O.Sim.prototype, _plan = SP.plan, _onEnter = SP.onEnter;
    SP.plan = function (p) { if (p.task && p.task.act === 'letter') { const q = this.byId.get(p.task.to); const b = q && (q.agent.inside != null ? q.agent.inside : q.home); return { act: 'letter', b: b != null ? b : p.home, to: p.task.to }; } return _plan.call(this, p); };
    SP.onEnter = function (p, bid) {
      if (p.task && p.task.act === 'letter') { const q = this.byId.get(p.task.to); if (q && (q.agent.inside === bid || q.home === bid)) { const L = p.task.letter; p.task = null; deliver(this, L); this.remember(p, `Carried a letter to ${q.name}.`, 'work', 0.4); return; } }
      return _onEnter.call(this, p, bid);
    };

    function write(idx) {
      const s = cur(), e = PS.emp;
      const knows = (q) => q.alive !== false && !q.isPlayer && ((q.rel.get(0)?.familiar || 0) > 0.05 || (q.rel.get(0)?.affinity || 0) > 0.2 || (e && e.master === q.id));
      const known = s.people.filter(knows).slice(0, 18).map((q) => ({ q, place: s.world.placeId, where: '' }));
      for (const [pl, v] of (O.Travel && O.Travel.visited) || []) { if (pl === s.world.placeId || !v || !v.sim) continue; for (const q of v.sim.people.filter(knows).slice(0, 8)) known.push({ q, place: pl, where: v.sim.world.name }); }
      if (!known.length) return say('You know nobody here well enough to write to.', 'bad');
      const opts = known.map(({ q, place, where }) => `<option value="${place}:${q.id}">${esc(q.name)}${e && e.master === q.id ? ' (your master)' : ''}${where ? ` (in ${esc(where)})` : ''}</option>`).join('');
      const goods = [...new Set(PS.items.filter((k, j) => j !== idx))].filter((k) => O.Data.GOODS[k] && !/paper|letter/.test(k));
      const enclose = `<div class="lbl" style="margin-top:8px">Enclose with it</div><p><label>Coin ₳ <input data-coin type="number" min="0" max="${Math.floor(PS.money)}" value="0" style="width:5em"></label> <select data-item><option value="">nothing else</option>${goods.map((k) => `<option value="${k}">${esc(O.Data.GOODS[k].name)}</option>`).join('')}</select></p>`;
      O.Panels.open('Write a letter', `<p><select data-to>${opts}</select></p>${enclose}${O.AI && O.AI.ready ? `<p><textarea data-own rows="4" maxlength="400" style="width:100%" placeholder="Dear ..."></textarea></p><div class="topics"><button data-k="own">Seal and send</button></div>` : ''}<div class="topics">${KINDS.map(([k, t]) => `<button data-k="${k}">${esc(t)}</button>`).join('')}</div>`, (r) => {
        r.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => {
          const [toPlace, toId] = r.querySelector('[data-to]').value.split(':'), to = +toId, kind = b.dataset.k, own = (r.querySelector('[data-own]')?.value || '').trim();
          const coin = Math.max(0, Math.min(Math.floor(PS.money), Math.floor(+(r.querySelector('[data-coin]')?.value || 0)))), item = r.querySelector('[data-item]')?.value || null;
          if (kind === 'own' && !own) return;
          const text = kind === 'own' ? own.slice(0, 400) : KINDS.find((x) => x[0] === kind)[1];
          PS.items.splice(idx, 1);
          if (coin) PS.money -= coin; if (item && PS.items.includes(item)) PS.remove(item);
          const L = { to, kind, text, day: s.day, coin, item: item && item !== '' ? item : null, place: toPlace };
          // to another town: by the carrier on the road, a day or so
          if (toPlace !== s.world.placeId) { if (PS.money >= 2) PS.money -= 2; O.Panels.close(); O.sendMail('outgoing', { L }, 8 + Math.random() * 14, null); say(`You seal the letter${coin || L.item ? ' with what you\'re sending' : ''} and pay the carrier two aurins. It will be on the road a day or so.`); game.player.anim = 'write'; game.player.ft = 0; setTimeout(() => { if (game.player.anim === 'write') game.player.anim = 'idle'; }, 1200); return; }
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
    O.mailHandlers = O.mailHandlers || {};
    O.mailHandlers.outgoing = (d) => { const L = d.L, v = O.Travel && O.Travel.visited.get(L.place), s2 = (v && v.sim) || (L.place === cur().world.placeId ? cur() : null); if (s2) deliver(s2, L); };
    // letters to you can carry things too: whatever came folded in is yours when you open it
    O.mailHandlers.gift = (d) => {
      if (d.coin) PS.money += d.coin; if (d.item && !PS.add(d.item)) say(`You've no room for the ${(O.Data.GOODS[d.item]?.name || d.item).toLowerCase()}; you set it down.`, 'bad');
      O.sfx && O.sfx(d.coin ? 'kaching' : 'handover', 0.9, !!game.scene);
      const what = [d.coin ? `₳${d.coin}` : null, d.item ? (O.Data.GOODS[d.item]?.name || d.item).toLowerCase() : null].filter(Boolean).join(' and ');
      O.Panels.open(`A letter from ${d.from}`, `<p class="letter">${esc(d.text)}</p>${what ? `<p class="caption">Folded inside: ${esc(what)}.</p>` : ''}`);
    };
    // now and then a friend sends a little something, and a debtor pays what they borrowed, by letter
    const SPx = O.Sim.prototype, _nd = SPx.newDay;
    SPx.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        for (const L of (PS.lent || []).slice()) { if (L.place && L.place !== this.world.placeId) continue; const q = this.byId.get(L.who), hh = q && this.household(q); if (!q || !hh || L.due > this.day || hh.money < L.n + 10 || this.rng.next() > 0.3) continue; if (Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 400) continue; hh.money -= L.n; PS.lent = PS.lent.filter((x) => x !== L); O.sendMail('gift', { from: q.name, text: `What I owe you, with my thanks. I'd not have you think me a bad payer.`, coin: L.n }, 2 + this.rng.next() * 8, `A letter from ${q.first}`); }
        const friends = this.people.filter((q) => q.alive !== false && ((q.rel.get(0) || {}).affinity || 0) > 0.6 && q.age >= 16);
        for (const q of friends) { if ((q._giftDay || -99) > this.day - 21 || this.rng.next() > 0.04) continue; const hh = this.household(q); if (!hh) continue; q._giftDay = this.day;
          const things = Object.keys(hh.pantry || {}).filter((k) => hh.pantry[k] >= 2 && O.Data.GOODS[k]); const item = things.length && this.rng.next() < 0.6 ? things[Math.floor(this.rng.next() * things.length)] : null; const coin = !item && hh.money > 40 ? 2 + Math.floor(this.rng.next() * 4) : 0; if (!item && !coin) continue;
          if (item) hh.pantry[item] -= 1; if (coin) hh.money -= coin;
          O.sendMail('gift', { from: q.name, text: item ? `I had a little more than we need, and thought of you. Don't thank me.` : `A few coins for your purse. Times are hard enough. Pay me back when you're rich.`, coin, item }, 3 + this.rng.next() * 10, `A letter from ${q.first}`); }
      } catch (e) { /* */ }
      return r;
    };
    // handing over a letter you carried yourself
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; if ((PS.sealed || []).some((L) => L.to === q.id)) out.push(['letter', 'Give them your letter']); return out; };
    npcUI.onExtra = (q, key, render) => { if (key !== 'letter') return prevOn && prevOn(q, key, render); const i = PS.sealed.findIndex((L) => L.to === q.id); const L = PS.sealed.splice(i, 1)[0]; deliver(cur(), L); return render(`${q.first} breaks the seal and reads it.`); };
  }
  O.LettersSetup = { setup };
})();
