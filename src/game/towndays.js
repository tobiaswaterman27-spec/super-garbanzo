// The town's own life, with more for you to learn and meddle in. Everyone keeps a habit (the baker at
// the well at seven, the reeve at the tavern of a Freyday) and if you watch you learn it. Bad blood
// grows: a sharp word one day, a shove the next, then a brawl with friends taking sides until the watch
// break it up. Courting couples can be helped or hindered: carry a lover's letter, whisper that one is
// sweet on another, or that one is false. Rumours pass mouth to mouth and grow on the way, and you can
// start them. Of an evening folk fish off the bank, dice and sing at the tavern, and of a Sunday wrestle
// on the green (and you can try a bout). Weather tells: snow slows you, spring storms flood the low
// ground by the river, and fog hides a thief. The council puts up works (a well, a cross, a roof)
// that the town builds before your eyes, and you can work on them or dip into the chest. And at night,
// after the curfew bell, the watch ask your business, and you can creep (X) where you'd not be seen.
'use strict';
(function () {
  const T = 16;
  const HAB = ['well', 'tavern', 'chapel', 'square', 'bank', 'well', 'square'];
  const DAYS = ['Sunday', 'Moonday', 'Tewsday', 'Wodensday', 'Thorsday', 'Freyday', 'Saturnday'];
  O.sqCentre = (z) => (z.length >= 4 ? [Math.round((z[0] + z[2]) / 2), Math.round((z[1] + z[3]) / 2)] : z);
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), SP = O.Sim.prototype;
    const sp = (q, t, secs = 3) => O.Speech && O.Speech.say(q, t, secs);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const aff = (a, b) => ((a.rel && a.rel.get(b.id)) || {}).affinity || 0;
    const nearP = (q, r) => q && q.agent && !q.agent.hidden && q.agent.inside == null && !game.scene && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < r;
    const hm = (h) => { const H = Math.floor(h), m = Math.round((h - H) * 60); return `${H % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${H < 12 ? ' in the morning' : H < 17 ? ' in the afternoon' : ' in the evening'}`; };
    const byName = (s, text) => { const low = text.toLowerCase(); return s.people.filter((z) => z.first && z.first.length > 2 && new RegExp('\\b' + z.first.toLowerCase() + '\\b').test(low)).sort((a, b) => b.first.length - a.first.length)[0] || null; };

    // ---------------------------------------------------------------- habits
    const habitOf = (p) => {
      if (p.habit !== undefined) return p.habit; if (p.age < 14 || p.visitor || !p.job && p.age > 70) return (p.habit = null);
      const r = O.RNG(O.hash('habit', p.id)), where = HAB[r.int(0, HAB.length - 1)], hour = where === 'tavern' ? r.int(18, 21) + 0.5 * r.int(0, 1) : where === 'chapel' ? r.pick([7, 18]) : r.int(7, 19) + 0.5 * r.int(0, 1);
      return (p.habit = { where, hour, day: r.chance(0.5) ? r.int(0, 6) : null, mins: r.int(25, 60) });
    };
    const habitText = (p) => { const h = habitOf(p); if (!h) return null; return `${h.day != null ? `on ${DAYS[h.day]}s` : 'every day'} about ${hm(h.hour)}, at ${h.where === 'bank' ? 'the riverbank' : h.where === 'tavern' ? 'the tavern' : h.where === 'chapel' ? 'the chapel' : h.where === 'well' ? 'the well' : 'the square'}`; };
    const inHabit = (s, p) => { const h = habitOf(p); if (!h) return false; if (h.day != null && s.weekday !== h.day) return false; const m = s.hour * 60, h0 = h.hour * 60; return m >= h0 && m < h0 + h.mins; };
    const _plan = SP.plan;
    SP.plan = function (p) {
      const a = _plan.call(this, p);
      if (!a || p.task || p.errand || !['home', 'stroll', 'socialise', 'idle', 'wander', 'wait-work', 'rest'].includes(a.act) || !inHabit(this, p)) return hobby(this, p, a);
      const h = habitOf(p);
      if (h.where === 'tavern' && this.tavernId != null) return { act: 'socialise', b: this.tavernId };
      if (h.where === 'chapel' && this.chapelId != null) return { act: 'worship', b: this.chapelId };
      return { act: 'stroll', outdoor: true, zone: 'habit', habit: h.where };
    };
    const propTile = (s, kind) => { const w = s.world, pr = w.props.find((x) => x.kind === kind); return pr ? [Math.floor(pr.x / T), Math.floor(pr.y / T) + 1] : null; };
    let bankTiles = null, bankW = null;
    const bankTile = (s, p) => { const w = s.world; if (bankW !== w) { bankW = w; bankTiles = []; const ox = w.ox || 0, oy = w.oy || 0; for (let y = oy - 15; y < oy + (w.townH || 60) + 15; y += 2) for (let x = ox - 15; x < ox + (w.townW || 80) + 15; x += 2) { const i = y * w.W + x; if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1 || w.solid[i] || !w.ter || w.ter[i] === w.TER.WATER) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.ter[(y + dy) * w.W + x + dx] === w.TER.WATER)) bankTiles.push([x, y]); } } return bankTiles.length ? bankTiles[p.id % bankTiles.length] : null; };
    const _zone = SP.zoneTile;
    SP.zoneTile = function (p, zone) {
      if (zone === 'habit') { const k = p.activity?.habit; const t = k === 'well' ? propTile(this, 'well') : k === 'bank' ? bankTile(this, p) : null; if (t) return [t[0] + (p.id % 3) - 1, t[1] + (p.id % 2)]; return _zone.call(this, p, 'square'); }
      if (zone === 'fishing') { const t = bankTile(this, p); if (t) return t; }
      if (zone === 'green') { const sq = (this.world.zones && this.world.zones.square && O.sqCentre(this.world.zones.square)) || null; if (sq) return [sq[0] + (p.id % 4) - 2, sq[1] + 3 + (p.id % 2)]; }
      if (zone === 'works' && this.project) return [this.project.tx + (p.id % 3) - 1, this.project.ty + 1 + (p.id % 2)];
      return _zone.call(this, p, zone);
    };
    // you learn a habit by seeing it twice
    let lt = 0;
    game.hooks.update.push((dt) => {
      lt -= dt; if (lt > 0) return; lt = 6; const s = cur(); if (!s || game.scene) return; PS.habits = PS.habits || {};
      for (const q of s.people) { if (!q.activity || q.activity.zone !== 'habit' || !nearP(q, 140)) continue; const k = s.world.placeId + ':' + q.id, rec = PS.habits[k] || (PS.habits[k] = { seen: 0, lastDay: -1 });
        if (rec.lastDay === s.day) continue; rec.lastDay = s.day; rec.seen++; if (rec.seen === 2) { rec.text = `${q.first} is at ${habitText(q).replace(/^.*?, at /, '')} ${habitText(q).split(', at ')[0]}`; O.Panels.toast(`You've noticed: ${q.first} comes here ${habitText(q).split(', at ')[0]}.`); } }
    });
    O.knownHabits = () => Object.values(PS.habits || {}).filter((r) => r.text).map((r) => r.text);

    // ---------------------------------------------------------------- hobbies of an evening, and Sunday wrestling
    function hobby(s, p, a) {
      if (!a || p.task || p.errand || p.age < 14 || !['home', 'stroll', 'socialise', 'idle', 'wander', 'rest'].includes(a.act)) return a;
      const r = O.RNG(O.hash('hobby', p.id)), kind = p.hobbyKind || (p.hobbyKind = r.pick(['none', 'none', 'fishing', 'dice', 'singing', 'wrestling', 'none']));
      const h = s.hour;
      if (kind === 'fishing' && h >= 17 && h < 20 && (s.day + p.id) % 3 === 0) return { act: 'stroll', outdoor: true, zone: 'fishing', hobby: 'fishing' };
      if ((kind === 'dice' || kind === 'singing') && h >= 19 && h < 22.5 && s.tavernId != null && (s.day + p.id) % 2 === 0) return { act: 'socialise', b: s.tavernId, hobby: kind };
      if (kind === 'wrestling' && s.weekday === 0 && h >= 14 && h < 17) return { act: 'stroll', outdoor: true, zone: 'green', hobby: 'wrestling' };
      return a;
    }
    const _idle = SP.idleAnim;
    SP.idleAnim = function (p) {
      const ho = p.activity?.hobby, hab = p.activity?.habit;
      if (ho === 'fishing') return 'fish';
      if (ho === 'wrestling') return (Math.floor(this.minute / 2) + p.id) % 3 === 0 ? 'attack' : (Math.floor(this.minute / 2) + p.id) % 3 === 1 ? 'celebrate' : 'idle';
      if (hab === 'well') return (Math.floor(this.minute / 3) + p.id) % 2 ? 'bucket' : 'talk';
      if (ho === 'works') return 'hammer';
      return _idle.call(this, p);
    };
    // try a bout on the green
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), P = game.player; if (!s || game.scene || s.weekday !== 0 || s.hour < 14 || s.hour >= 17) return null;
      const opp = s.people.find((q) => q.activity?.hobby === 'wrestling' && nearP(q, 40)); if (!opp) return null;
      return { type: 'custom', d: 20, x: opp.agent.x, y: opp.agent.y - 40, label: `Wrestle ${opp.first} for a coin`, act: () => {
        P.locked = true; P.anim = 'attack'; P.ft = 0; O.gesture && O.gesture(opp, 'attack', 3); O.sfx && O.sfx('smack', 0.6);
        setTimeout(() => { P.locked = false; P.anim = 'idle'; const sk = (PS.skills && (PS.skills.fighting || 0)) || 0.2, win = Math.random() < 0.35 + sk * 0.5 + (opp.age > 45 ? 0.15 : 0);
          if (win) { PS.money += 3; PS.skills.fighting = Math.min(1, (PS.skills.fighting || 0) + 0.02); sp(opp, pick(['Fairly thrown. Again next Sunday!', 'Hah! You\'re stronger than you look.']), 3); say('You throw them fair and square. The crowd cheers, and three aurins change hands your way.'); }
          else { PS.money = Math.max(0, PS.money - 2); sp(opp, pick(['Down you go!', 'Better luck next week.']), 3); say('You hit the grass hard. It costs you two aurins and some pride.', 'bad'); }
          s.relate && s.relate(opp, { id: 0 }, 0.05); }, 3000);
      } };
    });

    // ---------------------------------------------------------------- bad blood that grows into a brawl
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        this.feuds = (this.feuds || []).filter((f) => this.byId.get(f.a) && this.byId.get(f.b) && this.day - f.day < 20);
        if (this.feuds.length < 3) { const adults = this.people.filter((q) => q.age >= 16 && !q.visitor && q.alive !== false); for (let k = 0; k < 40 && this.feuds.length < 3; k++) { const a = pick(adults); if (!a || !a.rel) continue; for (const [id, rel] of a.rel) { if (id === 0 || (rel.affinity || 0) > -0.45) continue; const b = this.byId.get(id); if (!b || b.household === a.household || this.feuds.some((f) => [f.a, f.b].includes(a.id) || [f.a, f.b].includes(b.id))) continue; this.feuds.push({ a: a.id, b: b.id, stage: 0, day: this.day }); break; } } }
        // rumours travel
        spreadRumours(this);
        // the council's works
        worksDay(this);
      } catch (e) { console.error(e); }
      return r;
    };
    let ft = 0;
    game.hooks.update.push((dt) => {
      ft -= dt; if (ft > 0) return; ft = 8; const s = cur(); if (!s || game.scene || !s.feuds) return;
      for (const f of s.feuds) {
        const a = s.byId.get(f.a), b = s.byId.get(f.b); if (!nearP(a, 320) || !nearP(b, 320) || Math.hypot(a.agent.x - b.agent.x, a.agent.y - b.agent.y) > 180 || f.lastDay === s.day) continue;
        f.lastDay = s.day;
        if (f.stage === 0) { sp(a, pick([`Look who it is. ${b.first}, the liar.`, `Still owe me, ${b.first}.`, `Keep walking, ${b.first}.`])); setTimeout(() => sp(b, pick(['Say that again.', 'Mind your mouth.', 'You\'ll regret that.'])), 1600); O.gesture && O.gesture(a, 'point', 1.6); }
        else if (f.stage === 1) { if (O.Errands) O.Errands.send(s, a, [Math.floor(b.agent.x / T), Math.floor(b.agent.y / T)], { anim: 'shake', secs: 2, face: 0 }); sp(a, 'Get out of my way!'); setTimeout(() => { O.gesture && O.gesture(b, 'hurt', 0.8); sp(b, 'Don\'t you push me!'); }, 1800); }
        else { brawl(s, a, b); f.stage = -1; s.remember(a, `Came to blows with ${b.name} in the street.`, 'social', 2, b.id); s.remember(b, `Came to blows with ${a.name} in the street.`, 'social', 2, a.id); }
        f.stage++; if (f.stage > 2) s.feuds = s.feuds.filter((x) => x !== f);
      }
    });
    function brawl(s, a, b) {
      if (!O.Errands) return; const x = Math.floor((a.agent.x + b.agent.x) / 2 / T), y = Math.floor((a.agent.y + b.agent.y) / 2 / T);
      const friendOf = (q, not) => [...(q.rel || [])].filter(([id, r]) => id !== 0 && (r.affinity || 0) > 0.4).map(([id]) => s.byId.get(id)).find((z) => z && z !== not && nearP(z, 400));
      const fa = friendOf(a, b), fb = friendOf(b, a);
      const go = (q, dx, face) => q && O.Errands.send(s, q, [x + dx, y], { anim: 'attack', secs: 8, face, giveUp: game.t + 40, at: () => { if (Math.random() < 0.4) sp(q, pick(['Have that!', 'Come on then!', 'Hit him!']), 2); } });
      go(a, -1, 2); go(b, 1, 1); go(fa, -2, 2); go(fb, 2, 1);
      s.log(`A fight in the street between ${a.name} and ${b.name}${fa || fb ? ', and their friends piled in' : ''}.`, 'social');
      for (const q of s.people) if (!q.gang && q !== a && q !== b && q !== fa && q !== fb && nearP(q, 200) && Math.random() < 0.4) { sp(q, pick(['A fight! A fight!', 'Fetch the watch!']), 2); }
      const g = s.people.find((q) => /^guard|sergeant/.test(q.job?.role || '') && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - x * T, q.agent.y - y * T) < 700);
      if (g) setTimeout(() => { O.Errands.send(s, g, [x, y + 1], { anim: 'point', secs: 3, giveUp: game.t + 40, at: () => { sp(g, 'Break it up! The lot of you, home!', 3); for (const q of [a, b, fa, fb]) if (q && q.errand) O.Errands.finish && O.Errands.finish(q, true); } }); }, 5000);
      if (s.fallIll && Math.random() < 0.5) s.fallIll(pick([a, b]), 'injury', 0.25);
    }

    // ---------------------------------------------------------------- rumours you start, and the ones that grow
    const GROW = [(t) => t, (t) => t + ', and that\'s not the half of it', (t) => t.replace(/\bstole\b/, 'stole, and more than once').replace(/\blied\b/, 'lied to everyone'), (t) => 'They say ' + t.replace(/^they say /i, '') + ', and worse besides'];
    function spreadRumours(s) {
      s.rumours = (s.rumours || []).filter((r) => s.day - r.day < 14);
      for (const r of s.rumours) {
        const about = s.byId.get(r.about); if (!about) continue; const tellers = [...r.heard].map((id) => s.byId.get(id)).filter(Boolean);
        for (const t of tellers.slice(0, 6)) {
          const friends = [...(t.rel || [])].filter(([id, rel]) => id !== 0 && id !== r.about && (rel.affinity || 0) > 0.15 && !r.heard.has(id)).map(([id]) => s.byId.get(id)).filter(Boolean);
          const to = friends[0]; if (!to || Math.random() > 0.6) continue;
          r.heard.add(to.id); r.gen = Math.min(GROW.length - 1, (r.gen || 0) + (Math.random() < 0.3 ? 1 : 0)); const text = GROW[r.gen](r.text);
          to.beliefs = to.beliefs || []; to.beliefs.unshift({ t: `Heard from ${t.first}: ${text}`.slice(0, 160), src: 'rumour', day: s.day });
          const rr = to.rel.get(about.id) || { affinity: 0, familiar: 0 }; rr.affinity = Math.max(-1, (rr.affinity || 0) - 0.06); to.rel.set(about.id, rr);
          // the one it's about hears it back, and traces it
          if (to === about || friends.includes(about)) { if (r.byPlayer && !r.traced && Math.random() < 0.4) { r.traced = true; const pr = about.rel.get(0) || { affinity: 0 }; pr.affinity = Math.max(-1, (pr.affinity || 0) - 0.35); about.rel.set(0, pr); s.remember(about, `Found out the stranger has been spreading lies about me.`, 'social', 2.5, -0.4); } }
        }
      }
    }
    const RUMOUR = /\b(did you hear|have you heard|they say|i heard|people say|word is)\b/i, SLUR = /\b(stole|thief|liar|lied|cheat|cheats|drunk|beats|false|in debt|owes|sweet on|carrying on with|seen with)\b/i;
    const LOVE_FOR = /\b(\w+) (fancies|is sweet on|likes|asked after|asked about|has eyes for) you\b/i, FALSE = /\b(\w+) (is false|has been seen with (another|someone)|is not to be trusted|is carrying on with)\b/i, CARRY = /\b(carry|take|bring) (a |your )?(letter|word|message|note) to (\w+)\b/i;
    const _say = O.AIChat.say;
    O.AIChat.say = function (q, text, render, opt) {
      const s = cur(); const rep = (l) => { (q._conv = q._conv || []).push({ who: 'p', t: text }, { who: 'q', t: l }); render(l, false); return Promise.resolve(); };
      if (q && typeof text === 'string' && s && !(opt && opt.gift)) {
        // courting: carry a letter, whisper sweet or sour
        let m;
        if ((m = text.match(CARRY))) { const to = byName(s, m[4]); const rom = (s.romances || []).find((x) => (x.a === q.id && x.b === to?.id) || (x.b === q.id && x.a === to?.id));
          if (to && rom) { (PS.sealed = PS.sealed || []).push({ to: to.id, kind: 'love', from: q.id, text: `${q.first} writes that they think of you every hour`, day: s.day }); return rep(`Would you? Then give ${to.first} this, and don't you read it.`); } }
        if ((m = text.match(LOVE_FOR))) { const who = byName(s, m[1]); if (who && who !== q) { const r0 = q.rel.get(who.id) || { affinity: 0, familiar: 0 }; r0.affinity = Math.min(1, (r0.affinity || 0) + 0.2); q.rel.set(who.id, r0); s.remember(q, `The stranger told me ${who.first} is sweet on me.`, 'social', 1.4, who.id); } }
        if ((m = text.match(FALSE))) { const who = byName(s, m[1]); if (who && who !== q) { const r0 = q.rel.get(who.id) || { affinity: 0, familiar: 0 }; r0.affinity = Math.max(-1, (r0.affinity || 0) - 0.25); q.rel.set(who.id, r0); const rom = (s.romances || []).find((x) => [x.a, x.b].includes(q.id) && [x.a, x.b].includes(who.id)); if (rom && Math.random() < 0.4) { s.romances = s.romances.filter((x) => x !== rom); s.log(`${q.first} and ${who.first} are walking out no more.`, 'social'); } s.remember(q, `The stranger told me ${who.first} is false.`, 'social', 1.6, who.id); } }
        // a rumour started by you
        if (RUMOUR.test(text) && SLUR.test(text)) { const who = byName(s, text); if (who && who !== q) { s.rumours = s.rumours || []; s.rumours.push({ about: who.id, text: text.replace(RUMOUR, '').replace(/^[\s,:]+/, '').slice(0, 120), heard: new Set([q.id]), day: s.day, byPlayer: true, gen: 0 }); const r0 = q.rel.get(who.id) || { affinity: 0, familiar: 0 }; r0.affinity = Math.max(-1, (r0.affinity || 0) - 0.08); q.rel.set(who.id, r0); } }
      }
      return _say.apply(this, arguments);
    };
    // a lover's letter handed over warms the one who gets it
    if (O.Letters) { const _del = O.Letters.deliver; O.Letters.deliver = (s, L) => { if (L.kind === 'love') { const q = s.byId.get(L.to), from = s.byId.get(L.from); if (q && from) { const r0 = q.rel.get(from.id) || { affinity: 0, familiar: 0 }; r0.affinity = Math.min(1, (r0.affinity || 0) + 0.2); q.rel.set(from.id, r0); s.remember(q, `${from.first} sent me word by the stranger's hand. My heart leapt.`, 'social', 1.6, from.id); s.relate && s.relate(q, { id: 0 }, 0.08); say(`${q.first} reads it, and colours, and smiles.`); } return; } return _del(s, L); }; }
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = []; const h = habitText(q); if (h) out.push(`Your own habit: ${h}.`);
      const fr = [...(q.rel || [])].filter(([id, r]) => id !== 0 && (r.affinity || 0) > 0.4).map(([id]) => s.byId.get(id)).filter(Boolean).slice(0, 2); for (const f of fr) { const t = habitText(f); if (t) out.push(`You know ${f.first}'s habit: ${t}.`); }
      const heard = (q.beliefs || []).filter((b) => b.src === 'rumour').slice(0, 2).map((b) => b.t); if (heard.length) out.push(`Rumours you've heard (you may pass them on, or doubt them): ${heard.join(' / ')}.`);
      const fd = (s.feuds || []).find((f) => f.a === q.id || f.b === q.id); if (fd) { const o = s.byId.get(fd.a === q.id ? fd.b : fd.a); if (o) out.push(`You have bad blood with ${o.name} and it is getting worse.`); }
      return out.join(' ');
    });

    // ---------------------------------------------------------------- children remember you when they're grown
    const _say2 = O.AIChat.say;
    O.AIChat.say = function (q, text, render, opt) { if (q && q.age < 13) { const r0 = q.rel.get(0) || {}; q.childMem = { aff: r0.affinity || 0, age: q.age }; } return _say2.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => { const m = q.childMem; if (!m || q.age < 13) return ''; return `You remember the player from when you were a child of ${m.age}: ${m.aff > 0.3 ? 'they were kind to you, and you have not forgotten it' : m.aff < -0.2 ? 'they were cruel or cold to you, and you have not forgotten that either' : 'you remember them a little'}.`; });

    // ---------------------------------------------------------------- weather that matters
    { const _sp = game.speedFor; game.speedFor = function (run) { let v = _sp ? _sp.call(this, run) : run ? 92 : 50; const s = cur(); if (!game.scene && s && s.weather) { if ((s.weather.snowCover || 0) > 0.4) v *= 0.8; if (floodedAt(game.player.x, game.player.y)) v *= 0.55; } if (game.player.sneak && !game.player.mount) v *= 0.55; return v; }; }
    const flooding = () => { const s = cur(); return s && s.season === 'spring' && s.weather && (s.weather.kind === 'storm' || s.weather.kind === 'heavy'); };
    function floodedAt(x, y) { if (!flooding()) return false; const w = game.world; if (!w || !w.ter) return false; const tx = Math.floor(x / T), ty = Math.floor(y / T); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (w.ter[(ty + dy) * w.W + tx + dx] === w.TER.WATER) return true; return false; }
    game.hooks.drawGround.push((ctx, cam) => {
      if (!flooding() || game.scene) return; const w = game.world, x0 = Math.floor(cam.x / T), y0 = Math.floor(cam.y / T), x1 = x0 + Math.ceil(game.vw / T) + 1, y1 = y0 + Math.ceil(game.vh / T) + 1;
      ctx.fillStyle = 'rgba(70,110,150,0.42)';
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w.W + x; if (!w.ter || w.ter[i] === w.TER.WATER || w.solid[i]) continue; let near = false; for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (w.ter[(y + dy) * w.W + x + dx] === w.TER.WATER) { near = true; break; } if (near) ctx.fillRect(x * T - cam.x, y * T - cam.y, T, T); }
    });
    if (O.Pursuit) { const _m = O.Pursuit.rangeMul; O.Pursuit.rangeMul = () => { const s = cur(), base = _m ? _m() : 1; let k = base; if (s && s.weather && s.weather.kind === 'fog') k *= 0.6; if (game.player.sneak) k *= 0.55; return k; }; }

    // ---------------------------------------------------------------- the council's works
    const WORKS = [['well', 'a new well by the green', 70], ['memorial', 'a market cross', 80], ['bench', 'benches round the square', 40], ['roof', 'a new roof on the chapel', 90]];
    function worksDay(s) {
      const P0 = s.project;
      if (P0 && P0.done >= P0.need) { finishWorks(s, P0); s.project = null; return; }
      if (P0 || s.day - (s.lastWorks ?? -99) < 9 || !s.treasury || s.treasury.cash < 80) return; s.lastWorks = s.day;
      const [kind, name, need] = pick(WORKS), sq = (s.world.zones && s.world.zones.square && O.sqCentre(s.world.zones.square)) || null; if (!sq) return;
      let tx = sq[0] + 5, ty = sq[1] - 3; for (let k = 0; k < 30 && s.world.solid[ty * s.world.W + tx]; k++) { tx = sq[0] + ((k * 7) % 13) - 6; ty = sq[1] + ((k * 5) % 9) - 4; }
      s.treasury.cash -= 60; s.project = { kind, name, need, done: 0, fund: 60, tx, ty, day: s.day };
      for (const [pk, dx] of [['stonepile', -1], ['timberstack', 1]]) s.world.props.push({ kind: pk, x: (tx + dx) * T + 8, y: (ty + 2) * T + 12, seed: s.day, works: true }); s.world.dirtyStatics = true;
      s.log(`The council has put up ₳60 for ${name}. Labourers wanted at the square.`, 'town');
    }
    function finishWorks(s, P0) {
      const w = s.world; w.props = w.props.filter((p) => !p.works);
      if (P0.kind === 'roof') { const ch = s.building(s.chapelId); if (ch) ch.condition = 1; }
      else { w.props.push({ kind: P0.kind === 'bench' ? 'bench' : P0.kind, x: P0.tx * T + 8, y: P0.ty * T + 15, seed: s.day, solid: P0.kind !== 'bench' }); if (P0.kind !== 'bench') w.solid[P0.ty * w.W + P0.tx] = 1; }
      w.dirtyStatics = true; s.log(`${P0.name[0].toUpperCase() + P0.name.slice(1)} is finished, and the town turns out to look.`, 'town');
    }
    // the labourers at it through the day
    const _plan2 = SP.plan;
    SP.plan = function (p) { const a = _plan2.call(this, p); const P0 = this.project; if (!P0 || !a || p.task || p.errand || this.hour < 8 || this.hour > 17) return a; if (/labourer|builder|carpenter|mason/.test(p.job?.role || '') && (p.id + this.day) % 3 === 0 && a.act !== 'sleep') return { act: 'stroll', outdoor: true, zone: 'works', hobby: 'works' }; return a; };
    let wt = 0;
    game.hooks.update.push((dt) => { wt -= dt; if (wt > 0) return; wt = 3; const s = cur(), P0 = s && s.project; if (!P0) return; const n = s.people.filter((q) => q.activity?.hobby === 'works' && !q.agent.path && q.agent.inside == null).length; P0.done = Math.min(P0.need, P0.done + n * 0.05); });
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), P0 = s && s.project, P = game.player; if (!P0 || game.scene) return null; const d = Math.hypot(P0.tx * T + 8 - P.x, (P0.ty + 1) * T - P.y); if (d > 40) return null;
      if (s.hour >= 21 || s.hour < 5) return P0.fund > 5 ? { type: 'custom', d: 15, x: P0.tx * T + 8, y: P0.ty * T - 20, label: 'Dip into the works chest', act: () => { const n = Math.min(P0.fund, 8 + Math.floor(Math.random() * 10)); P0.fund -= n; PS.money += n; const seen = s.seers ? s.seers(P.x, P.y) : []; if (seen.length) { const cr = s.recordCrime({ kind: 'theft from the town works', perp: 'player', placeName: s.world.name, tile: [P0.tx, P0.ty], seen, severity: 2 }); PS.crimes.push(cr.id); say(`You lift ₳${n} from the chest. Someone saw.`, 'bad'); } else say(`You lift ₳${n} from the works chest. The council will wonder where it went.`); } } : null;
      if (s.hour < 8 || s.hour > 18 || P0.fund < 3) return null;
      return { type: 'custom', d: 15, x: P0.tx * T + 8, y: P0.ty * T - 20, label: `Work on ${P0.name} (₳3)`, act: () => { P.locked = true; P.anim = 'hammer'; P.ft = 0; O.sfx && O.sfx('chop', 0.6); setTimeout(() => { P.locked = false; P.anim = 'idle'; P0.done = Math.min(P0.need, P0.done + 6); P0.fund -= 3; PS.money += 3; say(`A stint on ${P0.name}: ₳3. ${Math.round(P0.done / P0.need * 100)}% done.`); }, 2400); } };
    });

    // ---------------------------------------------------------------- night: the watch ask your business; creep where you'd not be seen
    let nt = 0;
    game.hooks.update.push((dt) => {
      nt -= dt; if (nt > 0) return; nt = 3; const s = cur(); if (!s || game.scene || !(s.hour >= 21.5 || s.hour < 4.5) || PS.askedNight === s.day || (O.Law && O.Law.chasing())) return;
      const g = s.people.find((q) => /^guard|sergeant|watch/.test(q.job?.role || '') && nearP(q, 55) && q.activity?.act !== 'sleep'); if (!g || (O.npcUI && O.npcUI.talking())) return;
      if (game.player.sneak && Math.random() < 0.6) return; // (crept past)
      PS.askedNight = s.day; O.npcUI.startFrom(g, 'The curfew bell\'s long rung. What\'s your business abroad at this hour?');
    });
    (O.extraLines = O.extraLines || []).push((s, q) => (/^guard|sergeant|watch/.test(q.job?.role || '') && (s.hour >= 21.5 || s.hour < 4.5) ? 'It is after curfew. You ask anyone abroad their business; a lame answer and you send them home, a shifty one and you take a closer look.' : ''));
    game.keyHandlers.push((e) => { if (e.code !== 'KeyX' || O.panelOpen || (O.UI.dialogOpen && O.UI.dialogOpen())) return false; const P = game.player; P.sneak = !P.sneak; O.Panels.toast(P.sneak ? 'You creep, keeping low and quiet.' : 'You walk upright again.'); return true; });
    // creeping, you're seen from nearer only
    const _seers = SP.seers;
    if (_seers) SP.seers = function (x, y, ex) { const out = _seers.apply(this, arguments); if (!game.player.sneak || Math.hypot(x - game.player.x, y - game.player.y) > 4) return out; return out.filter((q) => Math.hypot(q.agent.x - x, q.agent.y - y) < 45); };
    // and look it: low, slow
    const Ch = O.Char, _fr = game.actorFrame;
    game.actorFrame = function (a) { if (a === game.player && a.sneak && (a.anim === 'walk' || a.anim === 'idle') && !a.mount) { const A = Ch.ANIMS.crouch, f = Math.floor((a.ft || 0) * 2) % A.frames; return Ch.frame(a.a, a.dir, 'crouch', f); } return _fr.call(this, a); };
    O.TownDays = { habitOf, habitText, floodedAt };
  }
  O.TownDaysSetup = { setup };
})();
