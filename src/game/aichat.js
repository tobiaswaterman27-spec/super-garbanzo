// Talking in your own words. Whatever you type, the person answers as themselves: from what they know
// (their work, family, friends, home, the town, what they did yesterday, what they've heard of you),
// how they feel about you, their age and their temper. Replies come from Claude (the quick model, when
// the game is opened on claude.ai) or from an OpenAI key the player gives. Without either the game
// can't be played. Every call is kept small: one short card of facts, the last few lines, and a
// one or two sentence answer back. Babies babble and nonsense gets a "Huh?" without asking anyone.
'use strict';
(function () {
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return null; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // no long dashes, no curly quotes, no ellipsis glyphs, no stage directions: plain words only
  const clean = (s) => String(s || '').replace(/\*[^*]{0,60}\*/g, '').replace(/\([^)]{0,60}\)/g, '').replace(/\s*[—–]\s*/g, ', ').replace(/\s+-\s+/g, ', ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...')
    .replace(/,\s*([.!?])/g, '$1').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/^["'\s]+|["'\s]+$/g, '').trim();
  O.cleanSpeech = clean;

  // ---------------------------------------------------------------- who answers
  const AI = O.AI = { kind: null, ready: false, sample: null, key: null, busy: false };
  AI.detect = async () => {
    if (LS('outlaw.devai') === 'mock' || (navigator.webdriver && location.protocol === 'file:')) { AI.kind = 'mock'; return (AI.ready = true); } // (automated tests only)
    if (window.claude && typeof window.claude.use === 'function') {
      try { const s = await window.claude.use('sample'); if (s) { AI.sample = s; AI.kind = 'claude'; return (AI.ready = true); } } catch (e) { /* not on claude.ai */ }
    }
    const key = LS('outlaw.openai'); if (key) { AI.key = key; AI.kind = 'openai'; return (AI.ready = true); }
    return false;
  };
  AI.json = async (prompt) => {
    if (AI.kind === 'claude') return AI.sample.json(prompt, { modelTier: 'quick', cache: false });
    if (AI.kind === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + AI.key },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 150, temperature: 0.8, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw { code: r.status === 401 ? 'bad_key' : r.status === 429 ? 'rate_limited' : 'upstream_error', message: j.error?.message || '' };
      return JSON.parse(j.choices[0].message.content);
    }
    if (AI.kind === 'mock') { const m = /Player: (.*)$/m.exec(prompt), said = m ? m[1] : ''; return { say: /name/i.test(said) ? 'They call me what my mother called me.' : 'Aye, well. ' + (said.length > 20 ? 'That is a lot to take in.' : 'If you say so.'), feel: 0, trust: 0, learned: '', name: (/I am (\w+)/i.exec(said) || [])[1] || '', agree: /please/i.test(said), caught: false }; }
    throw { code: 'no_ai' };
  };

  // the gate: no voices, no game
  AI.gate = () => new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'ai-gate';
    el.innerHTML = `<div class="ai-gate-in"><h1>Outlaw</h1><p class="ai-wait">Looking for Claude</p><form hidden><p>Open this game on claude.ai, or use your OpenAI key.</p><input type="password" placeholder="sk-..." autocomplete="off"><button type="submit">Play</button><p class="ai-err" hidden></p></form></div>`;
    document.body.appendChild(el);
    const form = el.querySelector('form'), inp = el.querySelector('input'), err = el.querySelector('.ai-err'), wait = el.querySelector('.ai-wait');
    let dots = 0; const tk = setInterval(() => { wait.textContent = 'Looking for Claude' + '.'.repeat(dots++ % 4); }, 350);
    const done = () => { clearInterval(tk); el.remove(); resolve(); };
    AI.detect().then((ok) => {
      if (ok) return done();
      clearInterval(tk); wait.hidden = true; form.hidden = false; inp.focus();
      form.onsubmit = async (e) => {
        e.preventDefault(); const k = inp.value.trim();
        if (!/^sk-[\w-]{20,}$/.test(k)) { err.hidden = false; err.textContent = 'That is not an OpenAI key.'; return; }
        AI.key = k; AI.kind = 'openai'; err.hidden = false; err.textContent = 'Checking';
        try { await AI.json('Reply with only this JSON: {"ok": true}'); } catch (x) { AI.kind = null; err.textContent = x.code === 'bad_key' ? 'OpenAI refused that key.' : 'Could not reach OpenAI from here.'; return; }
        LS('outlaw.openai', k); AI.ready = true; done();
      };
    });
  });

  // ---------------------------------------------------------------- what they know: one short card
  const SEAS = ['summer', 'autumn', 'winter', 'spring'];
  const dayName = (d) => { d = ((d - 1) % 56 + 56) % 56; return `${SEAS[Math.floor(d / 14)]} ${(d % 14) + 1}`; };
  const DIR = (dx, dy) => { const a = Math.atan2(dy, dx), k = Math.round(a / (Math.PI / 4)); return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][(k + 8) % 8]; };
  function placeOf(s, b, cx, cy) {
    if (!b) return 'somewhere';
    const bz = s.biz.get(b.id), name = bz ? bz.name : b.name && !/^House/.test(b.name) ? b.name : null;
    const dx = b.doorX - cx, dy = b.doorY - cy, far = Math.hypot(dx, dy);
    const where = far < 8 ? 'by the square' : `on the ${DIR(dx, dy)} side of town`;
    return name ? `${name} (${where})` : `a house ${where}`;
  }
  function centre(s) {
    if (s._ctr) return s._ctr; const bs = s.world.buildings.filter((b) => b.doorX != null);
    let x = 0, y = 0; for (const b of bs) { x += b.doorX; y += b.doorY; } return (s._ctr = [x / Math.max(1, bs.length), y / Math.max(1, bs.length)]);
  }
  const hm = (h) => { h = ((h % 24) + 24) % 24; return h === 0 ? 'midnight' : h === 12 ? 'noon' : h < 12 ? `${h}am` : `${h - 12}pm`; };
  const ageWord = (a) => a < 1 ? 'a baby' : `${a}`;
  function memScore(s, q, m) {
    const ageThen = q.age - (s.day - m.day) / 56, years = (s.day - m.day) / 56;
    const keep = q.age >= 70 ? 1.2 : q.age >= 55 ? 2.5 : q.age < 10 ? 1.5 : 4; // the old and the very young forget sooner
    let v = (m.strength || 0.5) * Math.exp(-years / keep);
    if (ageThen < 6) v *= 0.15; else if (ageThen < 12) v *= 0.5; // early childhood is mostly gone
    return v;
  }
  O.memScore = memScore;
  function speechFor(age, stage) {
    if (age < 5) return 'You are a small child: only a few simple words at a time, sometimes wrong words, no long sentences.';
    if (age < 9) return 'You are a young child: short simple sentences, simple words, a child\'s view of things.';
    if (age < 13) return 'You are a child: plain sentences, no grand words.';
    if (age < 18) return 'You are a youth: fluent, a little blunt or awkward.';
    if (stage === 'elder') return 'You are old: unhurried, sometimes wander onto the old days.';
    return '';
  }
  function card(s, q) {
    const PS = O.PlayerState, [cx, cy] = centre(s), lines = [];
    const by = (id) => s.byId.get(id), alive = (p) => p && p.alive !== false;
    const ctx = O.Dialogue ? O.Dialogue.buildContext(s, q, { reputation: PS.rep }) : {};
    const bdays = ((q.birthday || 1) - (((s.day - 1) % 56) + 1) + 56) % 56;
    lines.push(`You are ${q.name}, ${q.sex === 'm' ? 'a man' : 'a woman'}${q.age < 18 ? ' (a ' + (q.sex === 'm' ? 'boy' : 'girl') + ')' : ''} of ${ageWord(q.age)}, living in ${s.world.name}${q.title ? `, ${q.title}` : q.office ? `, the ${q.office}` : ''}. Birthday ${dayName(q.birthday || 1)}${bdays === 0 ? ' (today!)' : bdays <= 3 ? ` (in ${bdays} days)` : ''}.`);
    lines.push(`Temper: ${(q.traits || []).join(', ')}. Mood ${q.mood > 0.3 ? 'good' : q.mood < -0.3 ? 'low' : 'fair'}. ${q.needs.hunger < 30 ? 'Hungry. ' : ''}${q.needs.energy < 30 ? 'Tired. ' : ''}${q.health.illness ? 'Unwell (' + q.health.illness.kind + '). ' : ''}Hopes: ${q.goal || 'to get by'}.`);
    // work
    if (q.job) {
      const bz = q.job.biz != null && s.biz.get(q.job.biz), boss = bz && bz.owner != null && by(bz.owner);
      const wage = bz && (q.job.wage || (bz.def.wage || {})[q.job.role]); const hrs = bz && bz.def.hours;
      const mates = bz ? bz.workers.map(by).filter((p) => alive(p) && p !== q).slice(0, 3).map((p) => `${p.first} (${p.job.role})`) : [];
      lines.push(`Work: ${q.job.role}${bz ? ` at ${placeOf(s, s.building(bz.id), cx, cy)}` : ''}${boss && boss !== q ? `, under ${boss.name}` : bz && bz.owner === q.id ? ', your own business' : ''}${wage ? `, ₳${wage} a day` : ''}${hrs ? `, ${hm(hrs[0])} to ${hm(hrs[1])}` : ''}${mates.length ? `. Work with ${mates.join(', ')}` : ''}.`);
      const yd = s.day - 1, ywd = (yd - 1) % 7;
      const yMem = (q.memories || []).filter((m) => m.day === yd).slice(0, 2).map((m) => clean(m.text));
      lines.push(`Yesterday: ${ywd === 0 ? 'Sunday, mass and rest' : `you worked your hours${bz && bz.def.sells && bz.def.sells.length ? ', and trade was ' + ((bz.salesYesterday ?? bz.salesToday) > 40 ? 'brisk' : 'slow') : ''}`}${yMem.length ? '. Also: ' + yMem.join(' ') : ''}.`);
    } else lines.push(q.age < 14 ? 'You are a child: chores, play, lessons.' : 'You have no work just now.');
    // home and family
    const hh = s.household(q), home = s.building(q.home);
    lines.push(`Home: ${placeOf(s, home, cx, cy)}. The household purse is ${hh && hh.money > 150 ? 'full' : hh && hh.money > 40 ? 'fair' : 'thin'}.`);
    const fam = [];
    if (q.spouse) { const sp = by(q.spouse); if (sp) fam.push(`${q.sex === 'm' ? 'wife' : 'husband'} ${sp.first} (${sp.age}, ${sp.job ? sp.job.role : 'at home'})`); }
    else if (q.widowed) { const w = by(q.widowed); fam.push(`widowed${w ? ` (${w.first} died)` : ''}`); }
    for (const id of q.children || []) { const c = by(id); if (c) fam.push(c.alive === false ? `child ${c.first} (dead)` : `${c.sex === 'm' ? 'son' : 'daughter'} ${c.first} (${c.age})`); }
    for (const id of q.parents || []) { const c = by(id); if (c) fam.push(c.alive === false ? `${c.sex === 'm' ? 'father' : 'mother'} ${c.first} (dead)` : `${c.sex === 'm' ? 'father' : 'mother'} ${c.first} (${c.age})`); }
    if (ctx.fam2 && ctx.fam2.sibs) for (const sb of ctx.fam2.sibs.slice(0, 3)) fam.push(`${sb.sex === 'm' ? 'brother' : 'sister'} ${sb.first} (${sb.age})`);
    if (fam.length) lines.push(`Family: ${fam.join(', ')}.`);
    // friends and foes
    const rels = [...q.rel.entries()].filter(([id]) => id !== 0).map(([id, r]) => [by(id), r]).filter(([p]) => alive(p));
    const friends = rels.filter(([, r]) => r.affinity > 0.25).sort((a, b) => b[1].affinity - a[1].affinity).slice(0, 4);
    const foes = rels.filter(([, r]) => r.affinity < -0.3).sort((a, b) => a[1].affinity - b[1].affinity).slice(0, 2);
    if (friends.length) lines.push(`Friends: ${friends.map(([p]) => `${p.name} (${p.job ? p.job.role : p.age < 14 ? 'a child' : 'no trade'}, lives at ${placeOf(s, s.building(p.home), cx, cy)})`).join('; ')}.`);
    if (foes.length) lines.push(`You dislike: ${foes.map(([p]) => p.name).join(', ')}.`);
    // what they remember, fading with years and age
    const mem = (q.memories || []).map((m) => [m, memScore(s, q, m)]).filter(([, v]) => v > 0.12).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (mem.length) lines.push(`You remember: ${mem.map(([m, v]) => (v < 0.3 ? '(dimly) ' : '') + clean(m.text)).join(' | ')}`);
    if ((q.beliefs || []).length) lines.push(`You believe: ${q.beliefs.slice(0, 6).map((b) => clean(b.t) + (b.src === 'player' ? ' (the player told you)' : b.from ? ` (${b.from} told you)` : '')).join(' | ')}`);
    // the town around them
    const places = [...s.biz.values()].filter((bz) => !bz.def.public || ['chapel', 'guard', 'townhall', 'school'].includes(bz.type)).slice(0, 40);
    const pick = []; const seen = new Set(); for (const bz of places) { if (seen.has(bz.type) || pick.length >= 14) continue; seen.add(bz.type); pick.push(`${bz.name}${bz.owner != null && by(bz.owner) ? ` (${by(bz.owner).first}'s)` : ''}: ${DIR(s.building(bz.id).doorX - cx, s.building(bz.id).doorY - cy)}`); }
    lines.push(`Places you know in ${s.world.name}: ${pick.join('; ')}.`);
    const news = (s.history || []).filter((h) => !['day', 'trade', 'economy'].includes(h.kind) && h.day >= s.day - 6).slice(-4).map((h) => clean(h.text));
    if (news.length) lines.push(`Lately in town: ${news.join(' | ')}`);
    if (ctx.prices && ctx.prices.bread) lines.push(`A loaf costs ₳${ctx.prices.bread}.`);
    // now
    const h = s.hour, t = `${Math.floor(h) % 12 || 12}${h < 12 ? 'am' : 'pm'}`, inside = q.agent.inside != null ? s.building(q.agent.inside) : null;
    lines.push(`Now: ${t}, ${s.season}, ${s.weather ? s.weather.kind : 'clear'}. You are ${O.ACT_LABEL && O.ACT_LABEL[q.activity?.act] || 'about'}${inside ? ` in ${placeOf(s, inside, cx, cy).replace(/ \(.*\)$/, '')}` : ' outdoors'}.`);
    // the player, as far as they know them
    const r = q.rel.get(0) || { affinity: 0, familiar: 0 };
    const known = r.name ? `${r.name}` : 'a stranger whose name you do not know';
    const fond = r.affinity > 0.5 ? 'you like them a lot' : r.affinity > 0.15 ? 'you like them' : r.affinity < -0.4 ? 'you dislike them' : r.affinity < -0.1 ? 'you are wary of them' : 'no strong feeling';
    const tr = (r.trust || 0) > 0.4 ? 'you trust them' : (r.trust || 0) < -0.3 ? 'you do not trust a word they say' : r.familiar < 0.2 ? 'you do not know them' : 'you half trust them';
    lines.push(`Talking to you: ${known}; met ${r.familiar < 0.15 ? 'just now' : r.familiar < 0.5 ? 'a few times' : 'often'}; ${fond}; ${tr}.`);
    if (ctx.sawPlayerCrime) lines.push('You saw them commit a crime and know their face.');
    if (ctx.fame && ctx.fame.length) lines.push(`You've heard of them: ${ctx.fame.slice(0, 3).map(clean).join(' | ')}`);
    if (r.familiar > 0.3 || (ctx.fame || []).length) { const rp = PS.rep || {}; if ((rp.criminal || 0) > 0.4) lines.push('Folk say they are a rogue.'); else if ((rp.local || 0) > 0.4) lines.push('Folk speak well of them.'); }
    const emp = PS.emp && PS.emp.place === s.world.placeId && q.job && PS.emp.biz === q.job.biz;
    if (emp) lines.push(`They work at your workplace as ${PS.emp.role}.`);
    if (PS.gang && q.gang && q.gang === PS.gang) lines.push('They are in your gang.');
    if (O.crowned && O.crowned()) lines.push('They are the crowned monarch of the realm.');
    return lines.join('\n');
  }
  O.aiCard = card;

  // ---------------------------------------------------------------- the cheap answers
  const vowels = /[aeiouy]/i;
  function gibberish(t) {
    const w = t.toLowerCase().replace(/[^a-z\s']/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return true;
    const bad = w.filter((x) => (x.length >= 5 && !vowels.test(x)) || /[bcdfghjklmnpqrstvwxz]{5,}/.test(x) || /(.)\1{3,}/.test(x) || (x.length > 14 && !/(tion|ness|ment|ship|able)/.test(x)));
    return bad.length / w.length > 0.5;
  }
  const pk = (a) => a[Math.floor(Math.random() * a.length)];
  function babble(q) {
    const s = O.SimRef.cur, sib = (s.household(q)?.members || []).map((id) => s.byId.get(id)).find((p) => p && p !== q && p.age < 14);
    if (q.age < 1) return pk(['Ba ba ba.', 'Goo.', 'Ah! Ah!', 'Mmm ba.', 'Dah.', 'Ehh.']);
    if (q.age < 2) return pk(['Mama!', 'Dada.', 'No!', 'Ba ba.', 'Up!', 'Doggy.', 'Dah dah.', 'Moo.']);
    return pk(['Want bread.', 'Look! Bird!', 'No. Mine.', sib ? `${sib.first}!` : 'Mama!', 'Up, up!', 'Doggy go.', 'Hello.', 'What dat?']);
  }
  function confused(q) {
    const t = q.traits || [];
    if (q.age < 9) return pk(['What?', 'That\'s not words.', 'You talk funny.']);
    if (t.includes('hostile')) return pk(['What?', 'Speak sense or be off.', 'Are you drunk?']);
    if (t.includes('friendly')) return pk(['Sorry? I didn\'t catch that.', 'Come again?', 'Are you feeling well?']);
    return pk(['Huh?', 'What?', 'I don\'t follow you.', 'Say that again?']);
  }

  // ---------------------------------------------------------------- what someone may be asked to do
  // a job task, a gang, a favour: anything that wants a yes from this person registers here
  const asks = [];
  O.addAsk = (fn) => asks.push(fn);
  const askFor = (q) => { for (const fn of asks) { const a = fn(q); if (a) return a; } return null; };

  // ---------------------------------------------------------------- the talk
  const RULES = `Write the next thing this person says in a medieval village game. Reply ONLY with JSON:
{"say": string, "feel": -2..2, "trust": -2..2, "learned": string, "name": string, "agree": boolean, "caught": boolean}
say: their words, 1 or 2 short sentences, at most 30 words, fully in character for their age, temper and mood. Plain medieval English, no modern words. Perfect spelling and grammar. No dashes, no emoji, no actions in brackets or stars.
They know only what their card says. Asked about anything else, they don't know, guess vaguely or say so; they never invent facts about real people or places in their town. Nonsense makes them confused. Suspicious, hostile or untrusting people are curt with strangers and doubt what they're told. The greedy and hostile may lie.
feel: how much what the player just said changes their liking for them. trust: how much it changes their belief in them.
learned: a short new claim from the player's words they now believe, in their own words, else "". name: the player's name if the player just gave it, else "".
agree: true only if they now genuinely agree to the request below. caught: true only if they now realise the player lied to them before.`;
  let ctl = null;
  async function say(q, text, render) {
    const s = O.SimRef.cur, PS = O.PlayerState, r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r);
    const conv = q._conv || (q._conv = []);
    text = text.slice(0, 220); conv.push({ who: 'p', t: text });
    if (q.activity?.act === 'sleep') return reply(q, pk(['Mmh. Wha...', 'Zzz.', 'Leave me be. I\'m sleeping.']), render);
    if (q.age < 3) return reply(q, babble(q), render);
    if (gibberish(text)) { r.trust = clamp((r.trust || 0) - 0.02, -1, 1); return reply(q, confused(q), render); }
    if (!AI.ready) return reply(q, '...', render);
    const ask = askFor(q);
    const history = conv.slice(-7, -1).map((c) => (c.who === 'p' ? 'Player: ' : 'You: ') + c.t).join('\n');
    const prompt = `${RULES}\n\n${speechFor(q.age, q.stage)}\n--- Your card ---\n${card(s, q)}\n${ask ? `--- Request ---\nThe player wants you to ${ask.goal}. ${ask.why || ''} Weigh it by your temper, needs and trust. Set agree true only if convinced.\n` : 'No request is pending: agree is false.\n'}--- Talk so far ---\n${history || '(none)'}\nPlayer: ${text}`;
    render(null, true);
    AI.busy = true; ctl = {};
    let out = null;
    try { out = await AI.json(prompt); }
    catch (e) { AI.busy = false; return reply(q, e && e.code === 'rate_limited' ? pk(['Not now. I\'ve a lot on.', 'Give me a moment, will you?']) : pk(['Hm?', 'Sorry, I was miles away.']), render); }
    AI.busy = false;
    if (!out || typeof out.say !== 'string' || !out.say.trim()) return reply(q, pk(['Hm.', 'Well.']), render);
    const n = (v) => clamp(Math.round(Number(v) || 0), -2, 2);
    r.affinity = clamp(r.affinity + n(out.feel) * 0.04, -1, 1); r.trust = clamp((r.trust || 0) + n(out.trust) * 0.06, -1, 1); r.familiar = Math.min(1, r.familiar + 0.02);
    if (out.name && typeof out.name === 'string' && out.name.length < 30) r.name = clean(out.name).split(' ')[0];
    if (out.learned && typeof out.learned === 'string' && out.learned.length > 3) { (q.beliefs = q.beliefs || []).unshift({ t: clean(out.learned).slice(0, 140), src: 'player', day: s.day }); q.beliefs.length = Math.min(q.beliefs.length, 10); }
    if (out.caught) {
      r.trust = clamp((r.trust || 0) - 0.35, -1, 1); r.affinity = clamp(r.affinity - 0.2, -1, 1);
      s.remember(q, `Caught ${r.name || 'the stranger'} in a lie.`, 'player', 1, 0);
      const i = (q.traits || []).indexOf('loyal'); if (i >= 0) q.traits[i] = 'suspicious';
      if (q.beliefs) q.beliefs = q.beliefs.filter((b) => b.src !== 'player');
    }
    // a person warms over time: a sour temper can sweeten for someone they've come to like
    if (r.affinity > 0.7 && (q.traits || []).includes('hostile') && Math.random() < 0.1) q.traits[q.traits.indexOf('hostile')] = 'friendly';
    if (ask && out.agree === true) { try { ask.onAgree(q); } catch (e) { /* a task gone */ } }
    q._talked = { day: s.day, first: q._talked && q._talked.day === s.day ? q._talked.first : text };
    reply(q, out.say, render);
  }
  function reply(q, line, render) {
    line = clean(line) || '...';
    (q._conv = q._conv || []).push({ who: 'q', t: line }); if (q._conv.length > 14) q._conv.splice(0, q._conv.length - 14);
    render(line, false);
  }
  // when a talk ends, they keep one memory of it, not a line for every word
  function ended(q) {
    const s = O.SimRef.cur; if (!q || !q._talked || q._talked.day !== s.day || q._talked.stored) return;
    const r = q.rel.get(0) || {}; q._talked.stored = true;
    s.remember(q, `Talked with ${r.name || 'a stranger'}, who said: "${clean(q._talked.first).slice(0, 70)}"`, 'player', 0.6, 0);
  }
  // what's said travels: a claim someone believes is passed on to a friend now and then, and old ones fade
  { const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () { const r = _nd.apply(this, arguments);
      for (const p of this.people) { if (!p.beliefs || !p.beliefs.length) continue;
        p.beliefs = p.beliefs.filter((b) => this.day - b.day < 40 || Math.random() < 0.7);
        if (Math.random() < 0.25) { const b = p.beliefs[0], fr = [...p.rel.entries()].filter(([id, x]) => id !== 0 && x.affinity > 0.3).map(([id]) => this.byId.get(id)).filter((q) => q && q.alive !== false);
          const q = fr[Math.floor(Math.random() * fr.length)]; if (b && q && !(q.beliefs || []).some((x) => x.t === b.t)) (q.beliefs = q.beliefs || []).unshift({ t: b.t, src: 'friend', from: p.first, day: this.day }); }
      }
      return r; }; }
  O.AIChat = { say, ended, card, gibberish };
})();
