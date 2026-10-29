// What people agree to in talk, and then do: meet you somewhere at a time (early, late, or not at all),
// come along with you, go somewhere, let you into their home, give you things or ask for them, take a
// gift or hand it back, take your job or look for one, carry a message to someone, think better or
// worse of someone, or simply walk off.
'use strict';
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const G = () => O.Data.GOODS;
  const PS = () => O.PlayerState;
  const abs = (s) => s.day * 1440 + s.minute;
  const hm = (h) => { h = ((Math.round(h * 2) / 2) % 24 + 24) % 24; const hh = Math.floor(h), mm = h % 1 ? ':30' : ''; return hh === 0 ? `midnight` : hh === 12 && !mm ? 'noon' : `${hh % 12 || 12}${mm}${hh < 12 ? 'am' : 'pm'}`; };
  const WD = ['sunday', 'moonday', 'tewsday', 'wodensday', 'thunorsday', 'freyday', 'saturnday'];
  const WD2 = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  // ---------------------------------------------------------------- places and things by name
  function placeFor(s, q, name) {
    const n = String(name || '').toLowerCase().trim(); if (!n) return null;
    if (/^(my|his|her) (home|house)/.test(n) && q.home != null) { const b = s.building(q.home); return b && { b: b.id, label: `${q.first}'s house` }; }
    if (/^(your|the player'?s) (home|house)/.test(n)) { const r = PS().residence; const b = r && r.place === s.world.placeId ? s.building(r.b) : s.world.buildings.find((x) => x.owner?.kind === 'player'); return b ? { b: b.id, label: 'your house' } : null; }
    if (/square|market|green/.test(n)) { const z = s.Z && (s.Z.square || s.Z.market); if (z) return { tile: [z[0], z[1]], label: 'the square' }; }
    let best = null, bs = 0;
    const words = n.replace(/^the /, '').split(/[^a-z']+/).filter((w) => w.length > 2);
    for (const bz of s.biz.values()) { const bn = bz.name.toLowerCase(); let sc = bn.includes(n.replace(/^the /, '')) ? 10 : 0; for (const w of words) if (bn.includes(w)) sc += 2; if (bz.type && n.includes(bz.type)) sc += 3; if (sc > bs) { bs = sc; best = bz; } }
    if (best && bs >= 2) return { b: best.id, label: best.name };
    for (const b of s.world.buildings) if (b.name && b.name.toLowerCase().includes(n.replace(/^the /, ''))) return { b: b.id, label: b.name };
    return null;
  }
  function goodFor(name) {
    const n = String(name || '').toLowerCase().replace(/^(a|an|some|the|my|your) /, '').trim(); if (!n) return null;
    if (/aurin|coin|money|silver/.test(n)) return 'coin';
    let best = null, bs = 0;
    for (const [k, v] of Object.entries(G())) { const vn = v.name.toLowerCase(); let sc = vn === n || k === n ? 10 : vn.includes(n) || n.includes(vn) ? 6 : 0; for (const w of n.split(/\s+/)) if (w.length > 2 && vn.includes(w.replace(/s$/, ''))) sc += 2; if (sc > bs) { bs = sc; best = k; } }
    return bs >= 2 ? best : null;
  }
  function personFor(s, name) {
    const n = String(name || '').toLowerCase().trim(); if (!n) return null;
    return s.people.find((p) => p.name.toLowerCase() === n) || s.people.find((p) => p.first.toLowerCase() === n.split(' ')[0] && p.alive !== false) || null;
  }
  function whenFor(s, day, hour) {
    let h = clamp(Number(hour) || 12, 0, 23.5), d = s.day; const dn = String(day || 'today').toLowerCase();
    if (dn === 'tomorrow') d += 1; else if (/^in (\d+)/.test(dn)) d += +RegExp.$1; else { const i = Math.max(WD.indexOf(dn), WD2.indexOf(dn)); if (i >= 0) { const wd = (s.day - 1) % 7; d += ((i - wd) + 7) % 7 || 7; } }
    let at = d * 1440 + h * 60; if (at < abs(s) + 20) at += 1440; return at;
  }
  const dayWord = (s, at) => { const d = Math.floor(at / 1440); return d === s.day ? 'today' : d === s.day + 1 ? 'tomorrow' : WD[(d - 1) % 7].replace(/^./, (c) => c.toUpperCase()); };

  // ---------------------------------------------------------------- items changing hands
  const flying = [];
  function posOf(who) {
    const g = O.game; if (who === 'player') return [g.player.x, g.player.y - 18];
    const p = g.scene ? g.scene.personPos(who) : [who.agent.x, who.agent.y]; return p ? [p[0], p[1] - 18] : null;
  }
  function fly(from, to, g) { const a = posOf(from), b = posOf(to); if (!a || !b) return; flying.push({ a, b, g, t: 0 }); }
  function keepGift(s, q, o) {
    if (o.g === 'coin') { const hh = s.household(q); if (hh) hh.money += o.n; }
    else { const hh = s.household(q); if (hh && hh.pantry && (G()[o.g]?.food || o.g in hh.pantry)) hh.pantry[o.g] = (hh.pantry[o.g] || 0) + 1; else (q.items = q.items || []).push(o.g); }
    const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; const wanted = q.wants && (q.wants.g === o.g);
    r.affinity = clamp(r.affinity + (wanted ? 0.15 : o.g === 'coin' ? 0.04 * Math.min(3, o.n / 2) : 0.06), -1, 1); q.rel.set(0, r);
    if (wanted) q.wants = null;
    s.remember(q, `${r.name || 'A stranger'} gave me ${o.label}.`, 'player', 0.8, 0);
    O.gesture && O.gesture(q, 'nod', 1.6);
  }
  function returnGift(q, o) {
    const P = PS(); if (o.g === 'coin') P.money += o.n; else if (!P.add(o.g)) O.UI.say(`You've no room; you set the ${(G()[o.g]?.name || o.g).toLowerCase()} down.`);
    fly(q, 'player', o.g);
  }
  function npcGives(s, q, name) {
    const g = goodFor(name); if (!g) return null;
    const P = PS(), hh = s.household(q);
    if (g === 'coin') { const n = Math.min(5, Math.floor((hh && hh.money) || 0)); if (n < 1) return null; hh.money -= n; P.money += n; fly(q, 'player', 'coin'); return `${q.first} gives you ₳${n}.`; }
    if (!P.canCarry(g)) return `You've no room for what ${q.first} offers.`;
    let src = null;
    if (hh && hh.pantry && (hh.pantry[g] || 0) >= 1) { hh.pantry[g] -= 1; src = 'home'; }
    else if ((q.items || []).includes(g)) { q.items.splice(q.items.indexOf(g), 1); src = 'own'; }
    else { const bz = q.job && s.biz.get(q.job.biz); if (bz && (bz.stock[g] || 0) >= 1 && (bz.owner === q.id || q.activity?.act === 'work')) { bz.stock[g] -= 1; src = 'work'; } }
    if (!src) return null;
    P.add(g); fly(q, 'player', g); O.gesture && O.gesture(q, 'place', 1);
    return `${q.first} gives you ${(/^[aeiou]/i.test(G()[g].name) ? 'an ' : 'a ') + G()[g].name.toLowerCase()}.`;
  }

  // ---------------------------------------------------------------- meeting up
  // a meeting: they set off in time to arrive near the hour (the patient early, the lazy late), wait a while, and remember whether you came
  function meet(s, q, a) {
    const pl = placeFor(s, q, a.place); if (!pl) return null;
    const at = whenFor(s, a.day, a.hour), t = q.traits || [], r = q.rel.get(0) || {};
    let off = (t.includes('patient') ? -12 : 0) + (t.includes('lazy') ? 18 : 0) + (t.includes('impatient') ? 6 : 0) + Math.round((Math.random() - 0.5) * 20);
    const flake = Math.random() < (t.includes('lazy') ? 0.2 : 0.06) * ((r.affinity || 0) > 0.4 ? 0.4 : 1);
    const why = String(a.why || 'a meeting').slice(0, 40), P = PS();
    P.meets = (P.meets || []).filter((m) => !(m.who === q.id && m.place === s.world.placeId && m.state === 'set'));
    const m = { id: 'm' + Date.now().toString(36), place: s.world.placeId, who: q.id, name: q.first, b: pl.b ?? null, tile: pl.tile || null, label: `${pl.label}, ${hm((at % 1440) / 60)} ${dayWord(s, at)}`, at, why, off, flake, state: 'set', came: false, saw: false };
    P.meets.push(m); lead(m);
    s.remember(q, `Agreed to meet ${r.name || 'the stranger'} at ${m.label} (${why}).`, 'player', 0.9, 0);
    return `Meeting set: ${q.first}, ${m.label}.`;
  }
  function lead(m) { if (!O.addLead) return; O.addLead({ place: m.place, b: m.b ?? undefined, tile: m.tile || undefined, until: m.at + 90, from: m.at, why: 'meet', key: m.id, label: `Meet ${m.name}: ${m.label}` }); }
  O.meetsFor = (s, d0, d1) => (PS().meets || []).filter((m) => m.state === 'set' && Math.floor(m.at / 1440) >= d0 && Math.floor(m.at / 1440) <= d1).map((m) => ({ day: Math.floor(m.at / 1440), from: (m.at % 1440) / 60, to: (m.at % 1440) / 60 + 1.5, title: `Meet ${m.name} (${m.why})`, where: m.label.split(',')[0], b: m.b ?? undefined, place: m.place, meet: true }));

  // ---------------------------------------------------------------- the day's plans bend to what was agreed
  const follow = new Map(); // person id -> until (abs minutes)
  const goTo = new Map(); // person id -> { b, until }
  const invites = new Map(); // building id -> until
  function following(q) { const u = follow.get(q.id); return !!u && u > abs(O.SimRef.cur); }
  { const SP = O.Sim.prototype, _plan = SP.plan;
    SP.plan = function (p) {
      const now = abs(this), place = this.world.placeId;
      if (follow.has(p.id) && this === O.SimRef.cur) {
        if (follow.get(p.id) < now || p.health.illness?.sev > 0.6) { follow.delete(p.id); p.agent.chasing = false; }
        else { const sc = O.game.scene; if (sc) { p.agent.chasing = false; return { act: 'visit', b: (sc.b.parent || sc.b).id }; } return { act: 'follow', outdoor: true, zone: 'square' }; }
      }
      const g = goTo.get(p.id); if (g) { if (g.until < now) goTo.delete(p.id); else return g.b != null ? { act: 'visit', b: g.b } : { act: 'stroll', outdoor: true, zone: 'square' }; }
      for (const m of (PS().meets || [])) {
        if (m.who !== p.id || m.place !== place || m.state !== 'set' || m.flake) continue;
        if (now >= m.at + m.off - 35 && now <= m.at + 90 + Math.max(0, m.off)) return m.b != null ? { act: 'meet', b: m.b } : { act: 'stroll', outdoor: true, zone: 'square' };
      }
      return _plan.call(this, p);
    }; }
  function setup(game) {
  // walking along with you, out of doors
  game.hooks.update.push((dt) => {
    const g = O.game, s = O.SimRef.cur; if (!s) return;
    for (const f of flying) f.t += dt; for (let i = flying.length - 1; i >= 0; i--) if (flying[i].t > 0.7) flying.splice(i, 1);
    if (g.scene) return;
    for (const [id] of follow) {
      const q = s.byId.get(id); if (!q || q.agent.hidden || q.agent.inside != null) continue;
      if (q.agent.frozen) continue;
      const a = q.agent; a.chasing = true; a.path = null;
      const dx = g.player.x - a.x, dy = g.player.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d > 520) { follow.delete(id); a.chasing = false; continue; }
      if (d > 26) { const sp = (d > 90 ? 92 : 58) * dt, nx = a.x + (dx / d) * sp, ny = a.y + (dy / d) * sp; if (!g.solidAt(nx, ny)) { a.x = nx; a.y = ny; } else if (!g.solidAt(nx, a.y)) a.x = nx; else if (!g.solidAt(a.x, ny)) a.y = ny; a.anim = d > 90 ? 'run' : 'walk'; a.dir = O.dirOf(dx, dy); }
      else { a.anim = 'idle'; a.dir = O.dirOf(dx, dy); }
    }
  });
  // checking meetings: did you come, did they
  let mt = 0;
  game.hooks.update.push((dt) => {
    mt -= dt; if (mt > 0) return; mt = 0.5;
    const s = O.SimRef.cur, g = O.game, P = PS(); if (!s || !P.meets) return;
    const now = abs(s);
    for (const m of P.meets) {
      if (m.state !== 'set' || m.place !== s.world.placeId) continue;
      if (now >= m.at - 40 && now <= m.at + 90) {
        const atPlace = m.b != null ? (g.scene && (g.scene.b.id === m.b || (g.scene.b.parent && g.scene.b.parent.id === m.b))) : (!g.scene && m.tile && Math.hypot(g.player.x - (m.tile[0] * 16 + 8), g.player.y - (m.tile[1] * 16 + 8)) < 120);
        if (atPlace) m.came = true;
        const q = s.byId.get(m.who); if (q && m.came && !m.flake) { const qp = g.scene ? g.scene.personPos(q) : (q.agent.hidden ? null : [q.agent.x, q.agent.y]); if (qp && Math.hypot(qp[0] - g.player.x, qp[1] - g.player.y) < 60) { m.saw = true; m.state = 'met'; done(s, q, m, true); } }
      } else if (now > m.at + 90) { m.state = m.came ? 'stood-up' : 'missed'; const q = s.byId.get(m.who); if (q) done(s, q, m, false); }
    }
    P.meets = P.meets.filter((m) => m.state === 'set' || now - m.at < 1440 * 3);
  });
  // the flying things, drawn over everything
  game.hooks.drawTop.push((ctx, cam) => {
    for (const f of flying) {
      const k = Math.min(1, f.t / 0.6), x = f.a[0] + (f.b[0] - f.a[0]) * k, y = f.a[1] + (f.b[1] - f.a[1]) * k - Math.sin(k * Math.PI) * 18;
      if (f.g === 'coin') { ctx.fillStyle = '#f0c040'; ctx.fillRect(Math.round(x - cam.x - 2), Math.round(y - cam.y - 2), 4, 4); ctx.fillStyle = '#a07010'; ctx.fillRect(Math.round(x - cam.x - 1), Math.round(y - cam.y - 1), 2, 2); continue; }
      try { const ic = O.ItemArt.small(f.g); ctx.drawImage(ic, Math.round(x - cam.x - 6), Math.round(y - cam.y - 6)); } catch (e) { /* no art */ }
    }
  });
  for (const m of (PS().meets || [])) if (m.state === 'set') lead(m);
  }
  function done(s, q, m, met) {
    const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r);
    O.dropLead && O.dropLead((l) => l.key === m.id);
    if (met) { r.affinity = clamp(r.affinity + (/date|court|walk/i.test(m.why) ? 0.14 : 0.07), -1, 1); r.familiar = Math.min(1, r.familiar + 0.1); s.remember(q, `Met ${r.name || 'the stranger'} at ${m.label.split(',')[0]} as we agreed.`, 'player', 0.9, 0); O.UI.say(`${q.first} is here, as agreed.`); }
    else if (m.state === 'missed') { r.affinity = clamp(r.affinity - 0.15, -1, 1); r.trust = clamp((r.trust || 0) - 0.12, -1, 1); s.remember(q, `Waited for ${r.name || 'the stranger'} at ${m.label.split(',')[0]}, and they never came.`, 'player', 1, 0); O.UI.say(`You missed meeting ${q.first}.`, 'bad'); }
    else { s.remember(q, `Forgot to meet ${r.name || 'the stranger'} at ${m.label.split(',')[0]}.`, 'player', 0.7, 0); O.UI.say(`${q.first} never came.`, 'bad'); }
  }

  // ---------------------------------------------------------------- doors opened to you
  O.invitedTo = (b) => { const u = invites.get(b.id); return !!u && u > abs(O.SimRef.cur); };

  // ---------------------------------------------------------------- messages carried
  const passing = [];
  { const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () { const r = _nd.apply(this, arguments);
      for (let i = passing.length - 1; i >= 0; i--) { const m = passing[i]; if (m.s !== this) continue; const a = this.byId.get(m.from), b = this.byId.get(m.to); passing.splice(i, 1); if (!a || !b || b.alive === false) continue;
        (b.beliefs = b.beliefs || []).unshift({ t: `${a.first} says ${m.who} told them: ${m.msg}`, src: 'friend', from: a.first, day: this.day, aboutPlayer: true });
        this.remember(b, `${a.first} passed on a message from ${m.who}: "${m.msg}"`, 'social', 0.9, 0); this.relate(b, a, 0.02); }
      return r; }; }

  // ---------------------------------------------------------------- the jobs side
  function takeJob(s, q) {
    const P = PS(), e = P.emp; if (!e || e.place !== s.world.placeId || O.COURT?.has(e.role)) return null;
    const bz = s.biz.get(e.biz); if (!bz || q.age < 14) return null;
    if (q.job) { const old = s.biz.get(q.job.biz); if (old) old.workers = old.workers.filter((id) => id !== q.id); }
    q.job = { biz: bz.id, role: e.role, wage: e.wage }; if (!bz.workers.includes(q.id)) bz.workers.push(q.id);
    O.Employment && O.Employment.quit(`${q.first} takes your post as ${e.role} at ${bz.name}.`);
    s.remember(q, `Took over the post of ${e.role} at ${bz.name}.`, 'work', 1, 0);
    return null;
  }
  function seekJob(s, q, place) {
    const pl = placeFor(s, q, place); const bz = pl && pl.b != null && s.biz.get(pl.b); if (!bz) return null;
    const slots = (bz.def.jobs || []).filter(([role, n]) => bz.workers.filter((id) => s.byId.get(id)?.job?.role === role).length < n);
    if (!q.job && q.age >= 14 && slots.length && Math.random() < 0.6) { const role = slots[slots.length - 1][0]; q.job = { biz: bz.id, role, wage: (bz.def.wage || {})[role] || 4 }; bz.workers.push(q.id); s.remember(q, `Found work as ${role} at ${bz.name}.`, 'work', 1, 0); return `${q.first} has found work at ${bz.name}.`; }
    s.remember(q, `Thinking of looking for work at ${bz.name}.`, 'work', 0.6, 0); return null;
  }

  // ---------------------------------------------------------------- doing what they said
  function apply(s, q, a, main) {
    const r = q.rel.get(0) || {};
    switch (a.do) {
      case 'meet': return meet(s, q, a);
      case 'follow': follow.set(q.id, abs(s) + 180); goTo.delete(q.id); return `${q.first} comes along with you.`;
      case 'stop': if (follow.delete(q.id)) { q.agent.chasing = false; return `${q.first} goes about their day.`; } return null;
      case 'go': { const pl = placeFor(s, q, a.place); if (!pl) return null; goTo.set(q.id, { b: pl.b ?? null, until: abs(s) + 120 }); return null; }
      case 'invite': { if (q.home == null) return null; invites.set(q.home, abs(s) + 360); const b = s.building(q.home); O.addLead && O.addLead({ place: s.world.placeId, b: q.home, until: abs(s) + 360, why: 'invite', key: 'inv' + q.id, label: `${q.first}'s house: you're welcome today` }); return `${q.first} says you may come to their house today${b ? '' : ''}.`; }
      case 'give': return npcGives(s, q, a.item);
      case 'want': { const g = goodFor(a.item); if (!g || g === 'coin') return null; q.wants = { g, name: (G()[g]?.name || g).toLowerCase(), until: s.day + 5 }; return null; }
      case 'take_gift': if (q._offer) { keepGift(s, q, q._offer); q._offer = null; } return null;
      case 'refuse_gift': if (q._offer) { returnGift(q, q._offer); q._offer = null; } return null;
      case 'take_job': return takeJob(s, q);
      case 'seek_job': return seekJob(s, q, a.place);
      case 'tell': { const to = personFor(s, a.to); if (!to || to === q || !a.msg) return null; passing.push({ s, from: q.id, to: to.id, msg: O.cleanSpeech(String(a.msg)).slice(0, 120), who: r.name || 'the stranger' }); return null; }
      case 'like': { const of = personFor(s, a.of); if (!of || of === q) return null; s.relate(q, of, (Number(a.by) > 0 ? 1 : -1) * 0.1); return null; }
      case 'leave': return 'leave';
      default: return null;
    }
  }
  // walking off: they turn away and get on with their day
  function walkOff(q) { q.agent.frozen = false; q.agent.talking = 0; follow.delete(q.id); q.agent.chasing = false; q.agent.path = null; q.agent.goal = null; }

  O.NpcActsSetup = { setup };
  O.NpcActs = { apply, fly, keepGift, returnGift, following, walkOff, placeFor, goodFor, personFor, meet };
})();
