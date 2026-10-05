// What's on, and when. Every event has a date: the fairs and feasts of the year, the Sunday market, the
// council on Thursdays, a coronation, an execution, your party, weddings and funerals, and the gatherings
// townsfolk hold themselves: a christening after a birth, a guild feast, a church ale, a harvest-home
// supper, the mummers in winter, a lord's hunt. No two big gatherings are held in a town at the same
// time. Any of them can be found in Undertakings (J), and you can be shown the way.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    const K = () => O.SimRef.home.kingdom;
    const SD = () => O.SEASON_DAYS || 14, SEAS = () => O.SEASONS || ['spring', 'summer', 'autumn', 'winter'];
    const seasonOf = (day) => SEAS()[Math.floor((day - 1) / SD() + 1) % 4], dos = (day) => ((day - 1) % SD()) + 1;
    O.dateOf = (day) => `${(O.DAYNAMES || [])[(day - 1) % 7] || 'Day'}, ${seasonOf(day).charAt(0).toUpperCase() + seasonOf(day).slice(1)} ${dos(day)}`;
    const hh = (h) => { const H = Math.floor(h), M = Math.round((h - H) * 60); return `${((H + 11) % 12) + 1}${M ? ':' + String(M).padStart(2, '0') : ''}${H < 12 ? 'am' : 'pm'}`; };
    O.hourStr = hh;
    const capital = () => K().places.find((x) => x.kind === 'capital');

    // ---------------------------------------------------------------- gatherings the townsfolk hold
    const KINDS = {
      christening: { title: (h) => `The christening of the ${h.sur} baby`, where: 'chapel', from: 11, to: 12.5, open: false },
      guildfeast: { title: (h) => `${h.name}'s guild feast`, where: 'tavern', from: 18, to: 22, open: false },
      churchale: { title: () => 'A church ale on the green', where: 'square', from: 12, to: 17, open: true, seasons: ['spring', 'summer'] },
      harvesthome: { title: (h) => `Harvest-home supper at the ${h.sur} farm`, where: 'farm', from: 18, to: 22, open: false, seasons: ['autumn'] },
      mummers: { title: () => "The mummers' play in the square", where: 'square', from: 16, to: 18, open: true, seasons: ['winter'] },
      hunt: { title: (h) => `${h.title ? h.title + ' ' : ''}${h.first}'s hunt`, where: 'wood', from: 9, to: 13, open: false, gentry: true },
    };
    const festOn = (s, day) => { const d = dos(day), se = seasonOf(day); return (se === 'autumn' && d === 10) || (se === 'winter' && d === 7) || (se === 'spring' && d === 12) || (s.hosted && s.hosted.day === day); };
    // does a big gathering already fill this time in this town?
    O.eventClash = (s, day, from, to, except) => {
      for (const e of O.eventsFor(s, day, day)) { if (e === except || e.small || e.ref === except) continue; if (e.from < to && from < e.to) return e; }
      return null;
    };
    function schedule(s) {
      s.npcEvents = (s.npcEvents || []).filter((e) => e.day >= s.day - 1);
      const r = s.rng, day = s.day + 1 + r.int(0, 2), se = seasonOf(day);
      // a new baby is christened within the week
      for (const c of s.people) if (c.age === 0 && !c.christened && c.alive !== false && (c.parents || []).length && s.chapelId) {
        c.christened = true; const mum = s.byId.get(c.parents[0]);
        const ev = { kind: 'christening', title: `The christening of ${c.first} ${c.sur || ''}`.trim(), b: s.chapelId, day: s.day + 2, from: 11, to: 12.5, host: mum?.id, open: false };
        if (!O.eventClash(s, ev.day, ev.from, ev.to)) s.npcEvents.push(ev);
      }
      if (!r.chance(0.4) || festOn(s, day)) return;
      const kinds = Object.entries(KINDS).filter(([k, d]) => k !== 'christening' && (!d.seasons || d.seasons.includes(se)));
      const [kind, D0] = kinds[r.int(0, kinds.length - 1)];
      let host = null, b = null, tile = null;
      if (D0.gentry) host = s.people.find((q) => (q.gentry || q.lordOf) && q.alive !== false && r.chance(0.5)) || null;
      else host = s.people.filter((q) => q.age >= 30 && !q.visitor && q.alive !== false && (kind !== 'guildfeast' || (q.job && s.biz.get(q.job.biz)?.owner === q.id)) && (kind !== 'harvesthome' || /farm/.test(s.building(q.home)?.type || '')))[r.int(0, 30)] || null;
      if (!host && !D0.open) return;
      if (D0.where === 'tavern') b = s.tavernId; else if (D0.where === 'chapel') b = s.chapelId; else if (D0.where === 'farm') b = host?.home;
      else if (D0.where === 'square') { const [x0, y0, x1, y1] = s.Z.square; tile = [Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2)]; }
      else if (D0.where === 'wood') tile = s.Z.wood ? [Math.floor((s.Z.wood[0] + s.Z.wood[2]) / 2), Math.floor((s.Z.wood[1] + s.Z.wood[3]) / 2)] : null;
      if (b == null && !tile) return;
      const hsx = host ? { name: host.name, sur: host.sur || host.name.split(' ').slice(-1)[0], first: host.first, title: host.title } : { name: '', sur: '', first: '' };
      const ev = { kind, title: D0.title(hsx), b, tile, day, from: D0.from, to: D0.to, host: host?.id, open: D0.open, gentry: !!D0.gentry };
      if (O.eventClash(s, day, ev.from, ev.to)) return;
      s.npcEvents.push(ev);
      s.log(`${ev.title}: ${O.dateOf(day)}, from ${hh(ev.from)}.`, 'social');
    }
    let lastDay = new Map();
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.world) return;
      if (lastDay.get(s) === s.day) return; lastDay.set(s, s.day);
      try { schedule(s); } catch (e) { console.error(e); }
    });
    // who goes: the host's household, friends of the host, and for an open one anyone with the time
    const SP = O.Sim.prototype, _plan = SP.plan;
    SP.plan = function (p) {
      const evs = this.npcEvents; if (!evs || !evs.length || p.task || p.visitor || p.age < 4 || p.health?.illness) return _plan.call(this, p);
      const h = this.hour;
      for (const e of evs) {
        if (e.day !== this.day || h < e.from || h >= e.to) continue;
        const host = e.host != null && this.byId.get(e.host);
        const goes = (host && (p.household === host.household || (p.rel.get(host.id)?.affinity || 0) > 0.25 || (e.kind === 'christening' && (p.rel.get(host.id)?.familiar || 0) > 0.2))) || (e.open && (p.id + e.day) % 3 === 0) || (e.gentry && (p.gentry || p.job?.role === 'gamekeeper' || p.job?.role === 'falconer'));
        if (!goes) continue;
        const pl = _plan.call(this, p); if (pl && pl.act === 'work' && !e.open && (p.id % 2)) return pl; // some can't leave work
        if (e.tile) return { act: 'festival', outdoor: true, zone: e.kind === 'hunt' ? 'wood' : 'square' };
        return { act: e.kind === 'christening' ? 'worship' : 'socialise', b: e.b };
      }
      return _plan.call(this, p);
    };
    // being there counts: the host and the guests think better of you
    let tk = 0;
    game.hooks.update.push((dt) => {
      tk -= dt; if (tk > 0) return; tk = 5;
      const s = cur(); if (!s.npcEvents) return;
      const P = game.player, h = s.hour;
      for (const e of s.npcEvents) {
        if (e.day !== s.day || h < e.from || h >= e.to || e.seenYou) continue;
        let there = false;
        if (e.b != null) there = !!game.scene && (game.scene.b.parent || game.scene.b).id === e.b;
        else if (e.tile) there = !game.scene && Math.hypot(P.x - e.tile[0] * T, P.y - e.tile[1] * T) < 160;
        if (!there) continue;
        e.seenYou = true;
        const host = e.host != null && s.byId.get(e.host);
        if (host) { s.relate(host, { id: 0 }, 0.12); s.remember(host, `The stranger came to ${e.title.toLowerCase()}.`, 'social', 1, 0); }
        for (const q of s.people) if (q.activity && (q.activity.b === e.b || (e.tile && q.activity.act === 'festival')) && q !== host && Math.random() < 0.4) s.relate(q, { id: 0 }, 0.04);
        say(`You join ${e.title.toLowerCase()}.${host ? ` ${host.first} is glad you came.` : ''}`);
      }
    });

    // ---------------------------------------------------------------- letters and messengers take time
    // a letter goes off by rider and the answer comes back hours or days later (handlers by kind, so it saves)
    O.mailHandlers = O.mailHandlers || {};
    const absHome = () => O.SimRef.home.day * 1440 + O.SimRef.home.minute;
    O.sendMail = (kind, data, hours, what) => { (PS.mail = PS.mail || []).push({ kind, data, due: absHome() + Math.round(hours * 60), what: what || null }); };
    O.mailWaiting = () => (PS.mail || []).filter((m) => m.what);
    let mt = 0;
    game.hooks.update.push((dt) => {
      mt -= dt; if (mt > 0 || !PS.mail || !PS.mail.length || (O.UI.dialogOpen && O.UI.dialogOpen()) || O.panelOpen) return; mt = 1;
      const t = absHome(), m = PS.mail.find((x) => x.due <= t); if (!m) return;
      PS.mail = PS.mail.filter((x) => x !== m);
      const h = O.mailHandlers[m.kind]; if (h) try { h(m.data); } catch (e) { console.error(e); }
    });
    // ---------------------------------------------------------------- everything on, in one list
    O.eventsFor = (s, d0, d1) => {
      const out = [], add = (e) => { if (e.day >= d0 && e.day <= d1) out.push(e); };
      const here = s.world.placeId;
      for (let d = d0; d <= d1; d++) {
        const se = seasonOf(d), dd = dos(d);
        if (se === 'autumn' && dd === 10) add({ day: d, from: 10, to: 15, title: 'The harvest fair in the square', where: 'the square', square: true });
        if (se === 'winter' && dd === 7) add({ day: d, from: 18, to: 23, title: 'The midwinter feast', where: s.world.buildings.some((b) => b.royal) ? 'the great hall' : 'the tavern', b: s.world.buildings.find((b) => b.royal)?.id ?? s.tavernId });
        if (se === 'spring' && dd === 12 && s.world.buildings.some((b) => b.royal || b.type === 'keep')) add({ day: d, from: 10, to: 15, title: 'The spring tournament', where: 'the lists by the castle', square: true });
        if ((d - 1) % 7 === 6) add({ day: d, from: 7, to: 14, title: 'Sunday market', where: 'the square', square: true, small: true });
        if ((d - 1) % 7 === 3 && capital()) add({ day: d, from: 14, to: 18, title: 'The council of the realm', where: `the great hall at ${capital().name}`, place: capital().id, small: here !== capital().id, council: true });
      }
      if (s.hosted && s.hosted.day >= d0) add({ day: s.hosted.day, from: 10, to: 22, title: s.hosted.coronation ? 'The coronation feast' : `A ${s.hosted.kind === 'midwinter' ? 'feast' : s.hosted.kind} called by the crown`, where: s.world.name, square: s.hosted.kind !== 'midwinter' });
      if (PS.coronation && !PS.coronation.done) add({ day: PS.coronation.day, from: 10, to: 13, title: 'Your coronation', where: 'the castle chapel', place: PS.coronation.place, coronation: true });
      for (const e of s.executions || []) if (!e.done) add({ day: e.day, from: 10.5, to: 11.5, title: `An execution at the block (${s.byId.get(e.id)?.name || 'the condemned'})`, where: 'the square', square: true, small: true });
      if (s.party && !s.party.done) add({ day: s.party.day, from: 19, to: 23, title: 'Your party', where: 'your home', b: s.party.b, ref: s.party });
      for (const ev of s.events || []) if (ev.kind === 'wedding' || ev.kind === 'funeral') { const a = s.byId.get(ev.a ?? ev.who); add({ day: ev.day, from: ev.kind === 'wedding' ? 11 : 10, to: ev.kind === 'wedding' ? 12 : 11, title: ev.kind === 'wedding' ? `A wedding: ${a?.first || ''} and ${s.byId.get(ev.b)?.first || ''}` : `The funeral of ${ev.name || a?.name || 'a neighbour'}`, where: 'the chapel', b: s.chapelId, small: true }); }
      for (const ev of s.npcEvents || []) add(Object.assign({ where: ev.b != null ? s.building(ev.b)?.name || 'a house' : ev.kind === 'hunt' ? 'the wood' : 'the square', square: !!ev.tile && ev.kind !== 'hunt', ref: ev }, ev));
      for (const e of K().elections || []) if (!e.done && e.place === here) add({ day: e.day, from: 8, to: 20, title: 'Election day: the ballot box is open', where: 'the hall', small: true });
      return out.sort((a, b) => a.day - b.day || a.from - b.from);
    };
    // show me the way
    function lead(s, e) {
      const until = e.day * 1440 + Math.round(e.to * 60);
      if (e.place && e.place !== s.world.placeId) return say(`That's at ${K().place(e.place)?.name}. Take the road there; the way will be shown when you arrive.`);
      if (e.b != null) O.addLead({ place: s.world.placeId, b: e.b, until, why: 'event', label: e.title });
      else if (e.coronation || e.council) { const k = s.world.buildings.find((b) => b.royal); if (k) O.addLead({ place: s.world.placeId, b: k.id, until, why: 'event', label: e.title }); }
      else { const t = e.tile || (() => { const [x0, y0, x1, y1] = s.Z.square; return [Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2)]; })(); O.addLead({ place: s.world.placeId, tile: t, until, why: 'event', label: e.title }); }
      say(`You'll be shown the way to ${e.title.charAt(0).toLowerCase() + e.title.slice(1)}.`);
    }
    O.calendarHTML = () => {
      const s = cur(), list = O.eventsFor(s, s.day, s.day + 6), wait = O.mailWaiting();
      const letters = wait.length ? `<h3>Waiting for answers</h3><ul class="chron">${wait.map((m) => `<li>${esc(m.what)}</li>`).join('')}</ul>` : '';
      if (!list.length) return letters;
      return letters + `<h3>What's on</h3><table><tbody>${list.map((e, i) => `<tr><td><b>${esc(e.title)}</b><br><small class="lbl">${e.day === s.day ? 'Today' : e.day === s.day + 1 ? 'Tomorrow' : esc(O.dateOf(e.day))}, ${hh(e.from)} to ${hh(e.to)}, ${esc(e.where || '')}</small></td><td><button data-ev="${i}">Show the way</button></td></tr>`).join('')}</tbody></table>`;
    };
    O.bindCalendar = (r) => { const s = cur(), list = O.eventsFor(s, s.day, s.day + 6); r.querySelectorAll('[data-ev]').forEach((b) => b.onclick = () => lead(s, list[+b.dataset.ev])); };
  }
  O.CalendarSetup = { setup };
})();
