// NPC interaction (contextual prompt + talk card) and the Town Ledger inspector.
'use strict';
(function () {
  const G = O.Data.GOODS;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ACT_LABEL = {
    sleep: 'asleep', work: 'working', fieldwork: 'working the fields', chop: 'felling timber', festival: 'at the harvest festival', lessons: 'at lessons in the chapel', feast: 'at a wedding feast', council: 'away at the castle council', cry: 'crying the news', gangmeet: 'meeting at the hideout', report: 'reporting a crime to the watch', investigate: 'investigating a crime', jailed: 'locked in the cell', market: 'coming to market', service: 'in service at a house', sick: 'ill in bed', collapsed: 'collapsed!', help: 'running to help someone', escort: 'helping a patient to the physician', 'to-doctor': 'going to the physician', treated: 'being treated by the physician', mourn: 'at a funeral', wedding: 'at a wedding', build: 'building the new house', 'move-in': 'moving to Ashford', forage: 'gathering herbs', patrol: 'on patrol', eat: 'having a meal', 'eat-out': 'eating at the tavern',
    home: 'at home', play: 'playing', shop: 'shopping', socialise: 'drinking at the tavern', perform: 'playing for the tavern', recruit: 'calling for recruits', moot: 'at the moot in the square', firefight: 'fighting a fire!', leave: 'on the road out', sit: 'resting on the bench', stroll: 'taking the air', worship: 'at chapel',
    'wait-work': 'waiting for carrying work', pickup: 'collecting goods', deliver: 'making a delivery', 'carry-home': 'carrying shopping home', import: 'bringing goods to market', rest: 'resting at the inn', leave: 'leaving town',
  };
  O.ACT_LABEL = ACT_LABEL;

  function setup(game, sim) {
    const root = game.el.parentElement;
    const card = document.createElement('aside'); card.className = 'hud talk'; card.hidden = true; card.setAttribute('aria-live', 'polite'); root.appendChild(card);
    const ledger = document.createElement('div'); ledger.className = 'ledger'; ledger.hidden = true; root.appendChild(ledger);
    let talking = null, ltab = 'people', lsel = null;

    game.hooks.update.push(() => {
      if (!talking) return;
      const pos = game.scene ? game.scene.personPos(talking) : (talking.agent.hidden ? null : [talking.agent.x, talking.agent.y]);
      if (!pos || Math.hypot(pos[0] - game.player.x, pos[1] - game.player.y) > (talking.agent.approach ? 400 : 70)) return closeTalk();
      // while you type they wait, as long as their patience lasts
      { const ty = O.UI.dialog.typing?.(); if (ty && !talking._typingSince) talking._typingSince = performance.now(); if (!ty) talking._typingSince = 0; }
      const tr0 = talking.traits || [], patience = tr0.includes('impatient') ? 6000 : tr0.includes('patient') ? 45000 : 16000;
      const typingOk = O.UI.dialog.typing?.() && performance.now() - (talking._typingSince || 0) < patience;
      if (!(O.AI && O.AI.busy) && !typingOk) {
        const q = talking, t = q.traits || [], long = t.includes('social') ? 90 : t.includes('introverted') ? 25 : 50;
        // they tire of a talk only after a long quiet, or a very long talk; work or anything urgent calls sooner
        if (q._mustGo || absNow() - (q._lastSaid || q._talkFrom || absNow()) > long || absNow() - (q._talkFrom || absNow()) > long * 4) {
          const line = q._mustGo === 'work' ? pick(["I'll be late for work. I must go.", 'There, that\'s the hour. Work calls.']) : q._mustGo ? pick(['I must be off.', "I've somewhere to be. Fare you well."]) : pick(["Well, I'd best be getting on.", 'I must away. Good day to you.', "Enough talk. I've things to do."]);
          if (q._mustGo && !q._hurry) { const a0 = q._mustGo; q._mustGo = null; hurry(q, a0); return; }
          if (!q._hurry) { const why = q._mustGo ? `You must go now (${q._mustGo === 'work' ? 'work' : 'somewhere to be'}); take your leave.` : 'The talk has run its course and you have things to do; take your leave.'; q._mustGo = null; const qq = q; closeTalk(); walkAway(qq, line, why); return; }
        }
        if (q._hurry && O.UI.dialog.typing?.()) q._hurry.until = Math.max(q._hurry.until, performance.now() + 4000); // (they wait for your question)
        if (q._hurry && performance.now() > q._hurry.until && !O.UI.dialog.typing?.()) { const qq = q; q._hurry = null; closeTalk(); walkAway(qq, pick(['Good day to you.', 'Fare you well.', 'Another time.']), 'You can stay no longer and go now; a quick goodbye.'); return; }
      }
      // whoever you're talking to keeps turning to face you (unless they're sat or abed)
      const d = O.dirOf(game.player.x - pos[0], game.player.y - pos[1]);
      if (game.scene) { const a = game.scene.actors.get(talking.id); if (a && !a.seat && !a.gBed) { a.dir = d; a.gDir = d; } }
      else talking.agent.dir = d;
      talking.agent.frozen = true;
    });

    // what you know of someone's trade: they told you ("What do you do?"), someone told you, they're your
    // master, or you can see them at it in their own workplace
    const PSk = O.PlayerState;
    const kk = (q) => (O.SimRef.cur.world.placeId || '') + ':' + q.id; O.knowKey = kk;
    O.knowsTrade = (q) => !!(q && ((PSk.knows || {})[kk(q)] || (game.scene && q.job && game.scene.b.id === q.job.biz && q.activity?.act === 'work') || (PSk.posts || []).some((e) => e.master === q.id)));
    O.learnTrade = (q) => { if (q) (PSk.knows = PSk.knows || {})[kk(q)] = 1; };
    // while you talk with someone they don't wander off: their day waits till you're done
    // while you talk with someone their day waits, but not for ever: when something calls them away, they go
    const URGENT = new Set(['work', 'fire', 'firefight', 'help', 'collapsed', 'report', 'investigate', 'escort', 'to-doc', 'leave', 'labour', 'council', 'worship', 'meet', 'sick']);
    { const SP = O.Sim.prototype, _plan = SP.plan; SP.plan = function (p) {
      if (talking && p === talking && p.activity && !p.agent.hidden) { const real = _plan.call(this, p); if (real && real.act !== p.activity.act && URGENT.has(real.act) && !p._mustGo) p._mustGo = real.act; return p.activity; }
      return _plan.call(this, p); }; }
    const absNow = () => sim.day * 1440 + sim.minute;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    // can they talk at all? busy, hurrying, or not willing: a word over the shoulder and off they go
    function busyLine(q) {
      const act = q.activity?.act, r = q.rel.get(0) || { affinity: 0, familiar: 0 }, role = q.job?.role || '';
      if (q.age < 3 || act === 'sleep') return null;
      if (['fire', 'firefight', 'help', 'report', 'escort', 'to-doc', 'labour'].includes(act)) return pick(["Not now! Can't you see?", 'Out of my way!', 'No time, no time!']);
      if (act === 'leave') return pick(["I'm on the road, friend. Another time.", "Can't stop, I've miles to go."]);
      if (r.affinity < -0.55) return pick(["I've nothing to say to you.", 'Leave me be.', 'Go away.']);
      const sells = q.job && sim.biz.get(q.job.biz)?.def.sells?.length;
      if (act === 'work' && !sells && q.agent.inside == null && Math.random() < 0.5) return pick(["I'm working. Come back when I'm done.", "Can't stop to chat, there's work to do.", 'Later. The master would have my hide.']);
      if (act === 'patrol' && Math.random() < 0.4) return pick(['Move along, citizen.', "I'm on my rounds."]);
      if (q.health?.illness?.sev > 0.6) return pick(["I'm not well. Leave me be.", "Not today. I can barely stand."]);
      return null;
    }
    // why they must go, in their own words
    function whyGo(q, act) {
      const bz = q.job && sim.biz.get(q.job.biz);
      return act === 'work' ? (bz ? `I'm due at ${bz.name}` : "I'm due at work") : act === 'worship' ? 'mass is about to start' : act === 'meet' ? "I'm meeting someone" : act === 'council' ? 'the council sits soon' : act === 'leave' ? "I've a long road ahead" : ['fire', 'firefight'].includes(act) ? "there's a fire" : ['help', 'escort', 'to-doc', 'labour'].includes(act) ? 'someone needs me' : act === 'sick' ? "I'm not well" : act === 'report' ? 'I must get to the watch' : "I've somewhere to be";
    }
    // in a hurry: a word of sorry and why, one more answer if you're quick, then off they go
    function hurry(q, act) {
      const why = whyGo(q, act); q._hurry = { why, until: performance.now() + (act === 'work' || ['fire', 'help', 'leave'].includes(act) ? 9000 : 15000) };
      const fb = pick([`Forgive me, I can't stay. ${why[0].toUpperCase() + why.slice(1)}.`, `I'm sorry, I must go. ${why[0].toUpperCase() + why.slice(1)}.`, `Sorry, ${why}. I have to be off.`]);
      renderTalk('', true); voice(q, `The player wants to talk, but you are in a hurry (${why}). Say sorry, briefly, and that you can only stop a moment.`, fb, (t) => { if (talking !== q) return; (q._conv = q._conv || []).push({ who: 'q', t }); renderTalk(t); });
    }
    // their words, not set phrases: the moment is described and they say it as they would (the set
    // line stands in only if the words can't be had)
    function voice(q, situation, fallback, show) {
      if (!(O.AI && O.AI.ready && O.AIChat && O.AIChat.line)) return show(fallback);
      O.AIChat.line(q, situation).then((t) => show(t || fallback));
    }
    function walkAway(q, line, why) {
      const s0 = sim;
      // they stay till the words are said and the window shuts (by you, or by itself once read), then go
      q.agent.frozen = true; q._snubUntil = s0.day * 1440 + s0.minute + 20;
      const go = () => { q.agent.frozen = false; O.NpcActs && O.NpcActs.walkOff(q); };
      if (!talking) { const pos = game.scene ? game.scene.personPos(q) : [q.agent.x, q.agent.y]; if (pos) q.agent.dir = O.dirOf(game.player.x - pos[0], game.player.y - pos[1]); O.UI.dialog.open({ name: q.first, color: tagColour(q), text: '', busy: true, options: [] }); } // (they stop and face you while they find the words)
      voice(q, why || 'You end the talk and go on your way; a parting word.', line, (t) => {
        if (talking) return go(); O.UI.dialog.open({ name: q.first, color: tagColour(q), text: t, options: [] });
        const until = performance.now() + 1800 + t.length * 45;
        const wait = () => { if (!O.UI.dialogOpen() || talking) return go(); if (performance.now() > until) { O.UI.dialog.close(); return go(); } setTimeout(wait, 150); }; setTimeout(wait, 300);
      });
    }
    function openTalk(q) {
      // not wanting to talk: they say so, but keep at it (or come back later) and they'll hear you out
      const s0 = sim; if (q._snubUntil && s0.day * 1440 + s0.minute < q._snubUntil) { q._snubTries = (q._snubTries || 0) + 1; if (q._snubTries < 3) { const l = pick(["I've no interest in talking to you.", 'Not now. Leave me be.', "I've nothing to say to you."]); q.agent.frozen = true; O.UI.dialog.open({ name: q.first, color: tagColour(q), text: '', busy: true, options: [] }); voice(q, 'The player tries again to talk to you, but you have no interest in talking to them just now; say so.', l, (t) => { q.agent.frozen = false; if (talking) return; O.UI.dialog.open({ name: q.first, color: tagColour(q), text: t, options: [] }); setTimeout(() => { if (O.UI.dialogOpen() && !talking) O.UI.dialog.close(); }, 1600 + t.length * 25); }); return; } q._snubUntil = 0; q._snubTries = 0; }
      { const bl = O.AI && O.AI.ready ? busyLine(q) : null;
        if (bl) { const act = q.activity?.act, r0 = q.rel.get(0) || {}; if ((r0.affinity || 0) < -0.55 || ['fire', 'firefight', 'help', 'report'].includes(act)) return walkAway(q, bl, (r0.affinity || 0) < -0.55 ? 'The player tries to talk to you, and you dislike them; brush them off and walk away.' : `The player tries to talk to you, but you are in the middle of something urgent (${act}); you won't stop.`); talking = q; q.agent.frozen = true; q._group = []; q._talkFrom = absNow(); q._lastSpeaker = null; hurry(q, act === 'work' || act === 'patrol' ? 'work' : act); return; } }
      talking = q; q.agent.frozen = true; q._lastSpeaker = null; q._mustGo = null; q._talkFrom = absNow();
      // others standing with them join in (as in a group in the square)
      { const pos0 = game.scene ? game.scene.personPos(q) : [q.agent.x, q.agent.y];
        const near = pos0 ? (game.scene ? [...game.scene.actors.values()].filter((a) => !a.hidden && a.person && a.person !== q).map((a) => [a.person, a.x, a.y]) : sim.people.filter((z) => z !== q && !z.agent.hidden).map((z) => [z, z.agent.x, z.agent.y])) : [];
        const chatting = (z) => { const a1 = q.activity?.act, a2 = z.activity?.act; if (!a1 || a1 !== a2 || !['socialise', 'stroll', 'festival', 'feast', 'sit', 'rest', 'gangmeet', 'eat-out', 'home'].includes(a1)) return false; const r1 = q.rel.get(z.id); return !!(q.spouse === z.id || q.household === z.household || (r1 && (r1.affinity > 0.2 || r1.familiar > 0.4))); };
        q._group = near.filter(([z, x, y]) => Math.hypot(x - pos0[0], y - pos0[1]) < 30 && z.age >= 5 && z.health.hp > 0 && chatting(z)).slice(0, 2).map(([z]) => z);
        for (const z of q._group) z.agent.frozen = true; }
      O.jobEvent && O.jobEvent('talk', { q });
      O.dropLead && O.dropLead((l) => l.id === q.id && l.place === O.SimRef.cur.world.placeId && l.why !== 'contract'); // found them: the arrow's done its work
      const pos = game.scene ? game.scene.personPos(q) || [q.agent.x, q.agent.y] : [q.agent.x, q.agent.y];
      const dx = game.player.x - pos[0], dy = game.player.y - pos[1];
      q.agent.dir = O.dirOf(dx, dy);
      if (game.scene) { const a = game.scene.actors.get(q.id); if (a) a.dir = q.agent.dir; }
      game.player.dir = O.dirOf(-dx, -dy);
      const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; r.familiar = Math.min(1, r.familiar + 0.1); q.rel.set(0, r);
      // before the crown (or a lord), folk bow or curtsy
      if (O.gesture && q.age >= 6 && ((O.crowned && O.crowned()) || O.PlayerState.title)) O.gesture(q, q.sex === 'f' ? 'curtsy' : 'bow', 1.8);
      if (r.familiar <= 0.11) sim.remember(q, 'A stranger stopped me in the street to talk.', 'player', 0.8, 0);
      // back again so soon: they know it
      const since = q._lastTalkAt != null ? absNow() - q._lastTalkAt : null;
      const again = since != null && since < 90 ? pick(since < 10 ? ['Back again?', 'You again? What is it?', 'Forget something?', 'Yes?'] : ['Hello again.', 'Twice in one day!', 'Back so soon?']) : null;
      if (!(since != null && since < 120)) q._conv = []; // a fresh talk, unless it carries on from just now
      const greet0 = again || O.Dialogue.provider.greet(O.Dialogue.buildContext(sim, q), q.id + sim.day);
      if (O.AI && O.AI.ready) { renderTalk('', true); const n0 = (q._conv || []).length; voice(q, again ? `The player comes up to talk to you again, ${since < 10 ? 'only moments' : 'a little while'} after you last spoke.` : 'The player has just come up to you to talk. Greet them, or not, as you would, given what you are doing.', greet0, (t) => { if (talking !== q || (q._conv || []).length !== n0) return; q._conv.push({ who: 'q', t }); renderTalk(t); }); } // (you spoke first: their greeting is moot)
      else renderTalk(greet0);
    }
    function closeTalk() { if (talking) { talking.agent.approach = false; talking.agent.approachSide = null; O.AIChat && O.AIChat.ended(talking); for (const z of talking._group || []) { z.agent.frozen = false; z.agent.talking = 0; } }
      if (talking) { const a = talking.agent; a.frozen = false; a.talking = 0; talking._lastTalkAt = absNow(); if (a.inside == null && !a.chasing) { a.path = null; a.goal = null; } } talking = null; /* (and on their way again) */ card.hidden = true; if (O.UI.dialogOpen()) O.UI.dialog.close(); }
    function bar(v, cls = '') { return `<span class="bar ${cls}"><i style="width:${Math.round(O.clamp(v, 0, 100))}%"></i></span>`; }
    // name tag in the colour of their clothes
    function tagColour(q) { const m = q.app?.outfit?.over; const r = m != null && O.Pal.ramp ? O.Pal.ramp(m) : null; return r ? `rgb(${r[2][0]},${r[2][1]},${r[2][2]})` : '#b0683a'; }
    function renderTalk(line, busy) {
      const q = talking; if (!q) return;
      q.agent.talking = 30;
      const bz = q.job?.biz ? sim.biz.get(q.job.biz) : null;
      const atWork = bz && bz.open && q.agent.inside === bz.id && q.activity?.act === 'work' && bz.def.sells.length;
      const innkeeper = bz && bz.type === 'tavern' && q.agent.inside === bz.id && bz.open;
      const options = [];
      for (const [k, l] of (api.extraButtons ? api.extraButtons(q) : [])) options.push({ key: 'x-' + k, label: l, hot: true });
      if (atWork) options.push({ key: 'trade', label: 'Show me your wares', hot: true });
      if (q.job?.role === 'parish clerk' && q.activity?.act === 'work' && O.knowsTrade(q)) options.push({ key: 'houses', label: 'Houses to let or sell', hot: true });
      if (!(O.AI && O.AI.ready)) { for (const [k, l] of [['self', 'How are you?'], ['work', 'What do you do?'], ['news', 'Any news?'], ['family', 'Your family?']]) options.push({ key: k, label: l }); options.push({ key: 'bye', label: 'Goodbye' }); }
      O.UI.dialog.open({ name: (q._lastSpeaker && q._lastSpeaker !== q ? q._lastSpeaker.first : q.gentry ? q.name : q.first + (q.title ? `, ${q.title}` : q.office ? `, ${q.office}` : '')), color: tagColour(q._lastSpeaker || q), text: busy ? '' : line, busy, options: busy ? [] : options, chat: O.AI && O.AI.ready ? (t) => O.AIChat.say(q, t, (ln, b) => { if (talking === q) renderTalk(ln, b); }) : null, give: O.AI && O.AI.ready ? (g) => O.AIChat.give(q, g, (ln, b) => { if (talking === q) renderTalk(ln, b); }) : null, focus: true, onPick: (t) => pickTopic(q, bz, t), onClose: () => { q.agent.approach = false; O.AIChat && O.AIChat.ended(q); q._lastTalkAt = absNow(); if (talking === q) { q.agent.frozen = false; q.agent.talking = 0; if (q.agent.inside == null && !q.agent.chasing) { q.agent.path = null; q.agent.goal = null; } talking = null; } } });
    }
    function pickTopic(q, bz, t) {
      if (t === 'bye') { const bye = ['Fare you well.', 'God keep you.', 'Mind how you go.', 'Until next time.'][(q.id + sim.day) % 4]; O.UI.dialog.open({ name: q.first, color: tagColour(q), text: bye, options: [] }); talking = null; q.agent.frozen = false; setTimeout(() => { if (O.UI.dialogOpen() && !talking) O.UI.dialog.close(); }, 1600); return; }
      if (t.startsWith('x-')) return api.onExtra && api.onExtra(q, t.slice(2), renderTalk);
      if (t === 'trade') { closeTalk(); return O.Panels.trade(sim, bz, q); }
      if (t === 'houses') { closeTalk(); return O.Parish && O.Parish.open(sim, q); }
      if (t === 'rent') {
        const PS = O.PlayerState;
        if (PS.room && PS.room.b === bz.id && sim.day <= PS.room.until) return renderTalk("You've a room already. Top of the stairs.");
        if (PS.money < 6) return renderTalk("Six aurins a night, and I don't do credit.");
        PS.money -= 6; bz.cash += 6; PS.room = { b: bz.id, until: sim.day + 1 }; PS.add('key');
        sim.remember(q, 'Let a room to a stranger.', 'work', 0.5, 0);
        return renderTalk("Room's upstairs, first bed on the left. Chest is yours while you stay. Mind the third step.");
      }
      if (t === 'work') O.learnTrade(q);
      const seed = q.id * 31 + sim.day + Math.floor(sim.minute / 7) + t.length;
      const ctx = O.Dialogue.buildContext(sim, q), line = O.Dialogue.provider.topic(ctx, t, seed);
      if (t === 'news' && ctx._picked && O.Chronicle) O.Chronicle.playerHears(O.Chronicle.byId(ctx._picked.f), ctx._picked.v, ctx._picked.src === 'saw' ? 'rumour' : ctx._picked.src, q.name);
      renderTalk(line);
    }

    // ---------------- ledger ----------------
    function money(d) { d = Math.round(d); return `₳${Math.round(d)}`; }
    function renderLedger() {
      if (ledger.hidden) return;
      const tabs = [['people', 'Residents'], ['biz', 'Businesses'], ['town', 'Town'], ['log', 'Chronicle']];
      let body = '';
      if (ltab === 'people') {
        const rows = sim.people.filter((p) => !p.visitor).slice().sort((a, b) => a.household - b.household || b.age - a.age);
        body = `<table><thead><tr><th>Name</th><th>Age</th><th>Occupation</th><th>Home</th><th class="n">Purse</th><th>Doing</th><th>Fed</th></tr></thead><tbody>${rows.map((p) => {
          const hh = sim.household(p), home = sim.building(p.home);
          return `<tr data-id="${p.id}" class="${lsel === p.id ? 'sel' : ''}"><td>${esc(p.name)}</td><td class="n">${p.age}</td><td>${esc(p.job ? p.job.role : p.age < 16 ? (p.age < 3 ? 'baby' : 'child') : 'none')}</td><td>${esc(home?.name || '')} #${home?.id ?? ''}</td><td class="n">${money(hh.money)}</td><td>${esc(ACT_LABEL[p.activity?.act] || '')}</td><td>${bar(p.needs.hunger, p.needs.hunger < 25 ? 'warn' : '')}</td></tr>`;
        }).join('')}</tbody></table>`;
        if (lsel != null) {
          const p = sim.byId.get(lsel);
          if (p) body = `<div class="detail"><b>${esc(p.name)}</b>, ${p.traits.join(', ')}. Goal: ${esc(p.goal || '-')}. Skill: ${p.job ? Math.round((p.skills[p.job.role] || 0) * 100) : '-'}.<br><span class="lbl">Memories</span><ul>${p.memories.slice(0, 6).map((m) => `<li>Day ${m.day}: ${esc(m.text)}</li>`).join('') || '<li>Nothing notable yet.</li>'}</ul></div>` + body;
        }
      } else if (ltab === 'biz') {
        body = `<div class="bizgrid">${[...sim.biz.values()].map((bz) => {
          const owner = sim.byId.get(bz.owner);
          const stock = Object.entries(bz.stock).map(([g, q]) => `<tr><td>${G[g].name}</td><td class="n">${Math.floor(q)}</td><td class="n">${bz.def.sells.includes(g) ? '₳' + sim.price(bz, g) : '-'}</td></tr>`).join('');
          const orders = bz.orders.map((o) => `${o.qty} ${G[o.good].name.toLowerCase()} from ${sim.biz.get(o.from)?.name || 'trader'}`).join('; ');
          return `<section class="biz"><h3>${esc(bz.name)} <span class="pill ${bz.open ? 'ok' : ''}">${bz.open ? 'OPEN' : 'CLOSED'}</span></h3>
            <div class="lbl">${owner ? 'Owner ' + esc(owner.name) + ' · ' : ''}${bz.workers.length} staff · till ${money(bz.cash)} · sold today ${money(bz.salesToday)}</div>
            <table><thead><tr><th>Stock</th><th class="n">Qty</th><th class="n">Price</th></tr></thead><tbody>${stock || '<tr><td colspan="3">No goods</td></tr>'}</tbody></table>
            ${orders ? `<div class="lbl">On order: ${esc(orders)}</div>` : ''}</section>`;
        }).join('')}</div>`;
      } else if (ltab === 'town') {
        const pop = sim.people.filter((p) => !p.visitor);
        const stages = {}; pop.forEach((p) => (stages[p.stage] = (stages[p.stage] || 0) + 1));
        const hungry = pop.filter((p) => p.needs.hunger < 25).length;
        const purse = sim.households.reduce((s, h) => s + h.money, 0);
        const employed = pop.filter((p) => p.job).length, adults = pop.filter((p) => p.age >= 16 && p.age < 66).length;
        body = `<div class="kv">
          <div><span class="lbl">Population</span><b>${pop.length}</b><small>${Object.entries(stages).map(([k, v]) => `${v} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join(', ')}</small></div>
          <div><span class="lbl">Households</span><b>${sim.households.length}</b><small>combined purse ${money(purse)}</small></div>
          <div><span class="lbl">Employment</span><b>${employed}/${adults}</b><small>working-age adults with a trade</small></div>
          <div><span class="lbl">Going hungry</span><b class="${hungry ? 'warn' : ''}">${hungry}</b><small>residents with an empty belly</small></div>
          <div><span class="lbl">Treasury</span><b>${money(sim.treasury.cash)}</b><small>market tax ${Math.round(sim.treasury.taxRate * 100)}% · hearth tax ₳${sim.treasury.hearth ?? 2} · town wages ${money(sim.publicCosts ? sim.publicCosts().wages : 0)} a week</small></div>${(sim.treasury.weeks || []).length ? `<div style="grid-column:1/-1"><span class="lbl">The town's accounts, week by week</span><table><thead><tr><th>Week to day</th><th class="n">Taxes in</th><th class="n">Paid out</th><th class="n">To the crown</th><th class="n">From the crown</th><th class="n">In the chest</th></tr></thead><tbody>${sim.treasury.weeks.slice(-5).map((w) => `<tr><td>${w.day}</td><td class="n">${money(w.income)}</td><td class="n">${money(w.spent)}</td><td class="n">${money(w.levy)}</td><td class="n">${money(w.grant)}</td><td class="n">${money(w.cash)}</td></tr>`).join('')}</tbody></table></div>` : ''}
          <div><span class="lbl">Trade</span><b>${money(sim.stats.sales)}</b><small>all sales since you arrived · wages paid ${money(sim.stats.wages)} · exports ${money(sim.stats.exports || 0)}</small></div>
          <div><span class="lbl">Health</span><b class="${pop.filter((p) => p.health.illness).length > 6 ? 'warn' : ''}">${pop.filter((p) => p.health.illness).length} ill</b><small>sanitation ${Math.round(sim.settlement.sanitation * 100)}% · ${pop.filter((p) => p.activity?.act === 'treated').length} with the physician${sim.settlement.outbreak ? ' · OUTBREAK' : ''}</small></div>
          <div><span class="lbl">Births & deaths</span><b>${sim.history.filter((h) => h.kind === 'life' && /was born/.test(h.text)).length} · ${sim.dead.length}</b><small>${sim.dead.slice(-2).map((d) => `${d.name} (${d.age})`).join(', ') || 'none buried yet'}</small></div>
          <div><span class="lbl">Produced</span><b>${Math.round(sim.stats.produced.bread || 0)} loaves</b><small>${Object.entries(sim.stats.produced).filter(([g]) => g !== 'bread').map(([g, q]) => `${Math.round(q)} ${G[g].name.toLowerCase()}`).join(', ')}</small></div>
        </div>`;
      } else {
        body = `<ol class="chron">${sim.history.slice().reverse().slice(0, 80).map((h) => `<li><span class="lbl">Day ${h.day} ${String(Math.floor(h.minute / 60)).padStart(2, '0')}:${String(h.minute % 60).padStart(2, '0')}</span> ${esc(h.text)}</li>`).join('')}</ol>`;
      }
      ledger.innerHTML = `<div class="ledger-in"><header><h2>${esc(sim.world.name)} Ledger</h2><nav>${tabs.map(([k, l]) => `<button data-lt="${k}" aria-pressed="${k === ltab}">${l}</button>`).join('')}</nav><button class="x" aria-label="Close ledger">✕</button></header><div class="ledger-body">${body}</div></div>`;
      ledger.querySelectorAll('[data-lt]').forEach((b) => b.onclick = () => { ltab = b.dataset.lt; lsel = null; renderLedger(); });
      ledger.querySelector('.x').onclick = () => toggleLedger(false);
      ledger.querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => { lsel = lsel === +tr.dataset.id ? null : +tr.dataset.id; renderLedger(); });
    }
    function toggleLedger(v) {
      const keep = ledger.querySelector('.ledger-body')?.scrollTop || 0;
      ledger.hidden = v === undefined ? !ledger.hidden : !v;
      renderLedger(); const lb = ledger.querySelector('.ledger-body'); if (lb) lb.scrollTop = keep;
    }
    let acc = 0;
    game.hooks.update.push((dt) => { acc += dt; if (acc > 1.5 && !ledger.hidden) { acc = 0; const lb = ledger.querySelector('.ledger-body'); const st = lb ? lb.scrollTop : 0; renderLedger(); const nb = ledger.querySelector('.ledger-body'); if (nb) nb.scrollTop = st; } });

    game.keyHandlers.push((e) => {
      if (e.code === 'KeyL') { toggleLedger(); return true; }
      if (e.code === 'Escape' && (talking || !ledger.hidden)) { closeTalk(); toggleLedger(false); return true; }
      return false;
    });
    // someone says something into the talk (a report back, a call across the room)
    function speak(q, line, who) { if (talking !== q) return; q._lastSpeaker = who || q; (q._conv = q._conv || []).push({ who: 'q', by: (who || q).first, t: line }); renderTalk(line); }
    // they start it: walk up (or turn to you) and speak first
    function startFrom(q, line) {
      if (talking || O.panelOpen || O.UI.dialogOpen()) return false;
      talking = q; q.agent.frozen = true; q._group = []; q._talkFrom = absNow(); q._lastSpeaker = null; q.agent.approach = true;
      const pos = game.scene ? game.scene.personPos(q) || [q.agent.x, q.agent.y] : [q.agent.x, q.agent.y];
      q.agent.dir = O.dirOf(game.player.x - pos[0], game.player.y - pos[1]); if (game.scene) { const a = game.scene.actors.get(q.id); if (a) a.dir = q.agent.dir; }
      const n0 = (q._conv || []).length; renderTalk('', true); voice(q, `You go up to the player to say this, in your own words: "${line}"`, line, (t) => { if (talking !== q || (q._conv || []).length !== n0) return; (q._conv = q._conv || []).push({ who: 'q', t }); renderTalk(t); }); return true;
    }
    const api = { openTalk, closeTalk, toggleLedger, talking: () => talking, speak, startFrom };
    O.npcUI = api;
    return api;
  }
  O.NpcUI = { setup };
})();
