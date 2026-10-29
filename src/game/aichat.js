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
  // tidy what's said: a capital to start, a stop to end, a lone i made I, no doubled words
  const tidy = (t) => { t = String(t || '').trim(); if (!t) return t; t = t.replace(/\bi\b/g, 'I').replace(/\b(\w+) \1\b/gi, '$1').replace(/\s+([,.!?;:])/g, '$1').replace(/([,.!?;:])(?=[A-Za-z])/g, '$1 '); t = t[0].toUpperCase() + t.slice(1); if (!/[.!?"]$/.test(t)) t += '.'; return t; };
  const clean0 = clean; O.cleanSpeech = (x) => tidy(clean0(x));

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
    if (AI.kind === 'mock') { // (tests only: a dull, predictable villager)
      const said = prompt.slice(prompt.lastIndexOf('\nPlayer: ') + 9), who = (/--- (\w+) \(spoken to\)/.exec(prompt) || [])[1] || 'Me', acts = [];
      if (/meet me/i.test(said)) acts.push({ who, do: 'meet', place: /tavern|lantern/i.test(said) ? 'The Crooked Lantern' : 'the square', hour: 18, day: 'tomorrow', why: /date/i.test(said) ? 'a date' : 'a meeting' });
      if (/follow me|come with me/i.test(said)) acts.push({ who, do: 'follow' });
      if (/give me/i.test(said)) acts.push({ who, do: 'give', item: (/give me (?:a |an |some )?(\w+)/i.exec(said) || [])[1] || 'bread' });
      if (/holds out/i.test(said)) acts.push({ who, do: 'take_gift' });
      if (/your house/i.test(said)) acts.push({ who, do: 'invite' });
      if (/go away|leave/i.test(said)) acts.push({ who, do: 'leave' });
      return { lines: [{ who, say: /name/i.test(said) ? 'They call me what my mother called me.' : 'Aye, well. ' + (said.length > 20 ? 'That is a lot to take in.' : 'If you say so.') }], people: { [who]: { feel: 0, trust: 0, learned: '', caught: false } }, name: (/I am (\w+)/i.exec(said) || [])[1] || '', agree: /please/i.test(said), acts };
    }
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
    if (q.spouse) { const sp = by(q.spouse); if (sp) fam.push(`${q.sex === 'm' ? 'wife' : 'husband'} ${sp.first} (${sp.age}, ${sp.job ? sp.job.role : 'keeps the house'}; now ${whereabouts(s, q, sp)})`); }
    else if (q.widowed) { const w = by(q.widowed); fam.push(`widowed${w ? ` (${w.first} died)` : ''}`); }
    for (const id of q.children || []) { const c = by(id); if (c) fam.push(c.alive === false ? `child ${c.first} (dead)` : `${c.sex === 'm' ? 'son' : 'daughter'} ${c.first} (${c.age}; now ${whereabouts(s, q, c)})`); }
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
    const dest = q.activity && q.activity.b != null && q.agent.inside !== q.activity.b ? s.building(q.activity.b) : null;
    lines.push(`Now: ${t}, ${s.season}, ${s.weather ? s.weather.kind : 'clear'}. You are ${O.ACT_LABEL && O.ACT_LABEL[q.activity?.act] || 'about'}${inside ? ` in ${placeOf(s, inside, cx, cy).replace(/ \(.*\)$/, '')}` : ' outdoors'}${dest ? `, on your way to ${placeOf(s, dest, cx, cy).replace(/ \(.*\)$/, '')}` : ''}.`);
    if (q._lastTalkAt != null) { const ago = s.day * 1440 + s.minute - q._lastTalkAt; lines.push(`You last spoke with the player ${ago < 10 ? 'just a moment ago' : ago < 60 ? 'a little while ago' : ago < 600 ? 'earlier today' : ago < 1440 * 2 ? 'yesterday' : `${Math.round(ago / 1440)} days ago`}.`); }
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
  const RULES = `Write what happens next in a conversation in a medieval village game. Reply ONLY with JSON:
{"lines":[{"who":"First name","say":"..."}],"people":{"First name":{"feel":0,"trust":0,"learned":"","caught":false}},"name":"","agree":false,"acts":[]}
lines: normally 1 line from the person spoken to; 2 or 3 only if others are in the talk and would chime in. say: 1 or 2 short sentences, at most 30 words, fully in character for age, temper, mood and what they are doing now. Plain medieval English, no modern words, perfect spelling and grammar, no dashes, no emoji, nothing in brackets or stars.
Stay fully in character, always: these are real medieval people, never an AI, assistant, model, character or game; never mention prompts, rules, JSON, games or anything modern, even if the player insists, asks them to stop pretending, or talks of such things (then they are simply puzzled). Each say is only the spoken words, never starting with a name.
They know only what their card says; asked anything else they don't know, guess vaguely or say so, and never invent people or places in their town. Nonsense confuses them. The suspicious, hostile or untrusting are curt with strangers and doubt claims. The greedy and hostile may lie. Busy people want to get on.
people: for each person present: feel and trust (-2..2) = how the player's words change their liking and belief; learned = a short new claim from the player they now believe, else ""; caught = true if they now see the player lied before.
name: the player's name if the player just gave it. agree: true only if they now agree to the pending request.
acts: only what a speaker truly agrees to or does, each {"who":"First name","do":...}:
meet {"place","hour":0-23,"day":"today"|"tomorrow"|weekday,"why"} | follow (come along with the player now) | stop (stop following) | go {"place"} (go there now) | invite (let the player into their home today) | give {"item"} (hand over something they have) | want {"item"} (ask the player for something) | take_gift | refuse_gift | take_job (accept the player's own job when offered) | seek_job {"place"} | tell {"to","msg"} (pass a message to someone they know) | like {"of","by":-1 or 1} (think better or worse of someone after what was said) | call {"who"} (call someone near or in the same house over to join the talk, even across the room) | ask {"who","question"} (go and ask someone in the house or near, privately, then come back with the answer) | leave (end the talk and walk off: rude player, busy, bored, or done). If a speaker says they are off somewhere now, add a go act for it (or leave).
They know where their family and friends are just now (the card says); a stranger at the door is not invited in on a whim, and they don't promise to ask someone who is right there: they call them or ask them.\nPlaces: names from the card, "my home", "your home" or "the square". Items: things the speaker has, or the player carries.`;
  const G = () => O.Data.GOODS;
  function goodsHad(s, q) {
    const hh = s.household(q), out = [];
    for (const [g, n] of Object.entries((hh && hh.pantry) || {})) if (n >= 1 && G()[g]) out.push(G()[g].name.toLowerCase());
    const bz = q.job && q.activity?.act === 'work' && s.biz.get(q.job.biz); if (bz) for (const [g, n] of Object.entries(bz.stock || {})) if (n >= 1 && G()[g] && bz.def.sells.includes(g)) out.push(G()[g].name.toLowerCase() + ' (stock, to sell)');
    for (const g of q.items || []) out.push((G()[g]?.name || g).toLowerCase());
    return [...new Set(out)].slice(0, 12);
  }
  // where someone is just now, as the speaker would put it
  function whereabouts(s, q, z) {
    if (!z || z.alive === false) return '';
    const g = O.game, scB = g.scene && (g.scene.b.parent || g.scene.b);
    if (z.agent.inside != null && z.agent.inside === q.agent.inside) return g.scene && g.scene.actors.has(z.id) ? 'here in the room with you' : 'here in the same building';
    const act = z.activity?.act;
    if (act === 'sleep') return z.agent.inside === z.home ? 'asleep at home' : 'asleep';
    if (z.agent.inside != null) { const b = s.building(z.agent.inside), bz = s.biz.get(z.agent.inside); return z.agent.inside === z.home ? 'at home' : `in ${bz ? bz.name : b && b.name ? b.name : 'a house'}`; }
    if (act === 'work') return 'out at work';
    const dest = z.activity && z.activity.b != null ? s.building(z.activity.b) : null; return dest ? `out, on the way to ${s.biz.get(dest.id)?.name || dest.name || 'somewhere'}` : 'out in the town';
  }
  O.whereabouts = whereabouts;
  // who someone is to them
  function relTo(s, q, z) {
    if (q.spouse === z.id) return q.sex === 'm' ? 'your wife' : 'your husband';
    if ((q.children || []).includes(z.id)) return z.sex === 'm' ? 'your son' : 'your daughter';
    if ((q.parents || []).includes(z.id)) return z.sex === 'm' ? 'your father' : 'your mother';
    if ((q.parents || []).length && (z.parents || []).some((x) => (q.parents || []).includes(x))) return z.sex === 'm' ? 'your brother' : 'your sister';
    if (q.household != null && q.household === z.household) return 'of your household';
    if (q.job && z.job && q.job.biz === z.job.biz) return `works with you (${z.job.role})`;
    const r = q.rel.get(z.id); if (r && r.affinity > 0.3) return 'a friend'; if (r && r.affinity < -0.3) return 'someone you dislike';
    if (r && r.familiar > 0.2) return `someone you know${z.job ? ` (${z.job.role})` : ''}`;
    return 'a stranger to you';
  }
  O.relTo = relTo;
  // who is about them right now, in the same room or close by in the street
  function nearby(s, q, r0 = 140) {
    const g = O.game, out = [];
    if (g.scene) { const me = g.scene.personPos(q); if (me) for (const a of g.scene.actors.values()) { const z = a.person; if (!z || z === q || a.hidden || a.leaving) continue; out.push([z, Math.hypot(a.x - me[0], a.y - me[1])]); } }
    else if (!q.agent.hidden) for (const z of s.people) { if (z === q || z.agent.hidden || z.agent.inside != null) continue; const d = Math.hypot(z.agent.x - q.agent.x, z.agent.y - q.agent.y); if (d < r0) out.push([z, d]); }
    return out.sort((a, b) => a[1] - b[1]).slice(0, 6).map(([z, d]) => ({ z, d }));
  }
  // what someone is doing, as you'd see it: the pose they're in, who they're talking with, where they're off to
  const POSE = { sit: 'sitting', doze: 'dozing in a chair', sweep: 'sweeping', scrub: 'scrubbing', dance: 'dancing', eat: 'eating', drink: 'drinking', cook: 'cooking', talk: 'talking', read: 'reading', write: 'writing', pray: 'praying', hammer: 'hammering', chop: 'chopping wood', saw: 'sawing', knead: 'kneading dough', pour: 'pouring', serve: 'serving', count: 'counting coins', sleep: 'asleep', lie: 'lying on the ground', mourn: 'grieving', celebrate: 'merry', laugh: 'laughing', yawn: 'yawning', cough: 'coughing', play: 'playing', carry: 'carrying something', walk: 'walking', run: 'running', look: 'looking about' };
  function doing(s, z) {
    const g = O.game, a = g.scene ? g.scene.actors.get(z.id) : z.agent, an = a && (a.anim || a.gAnim), bits = [];
    if (an && POSE[an]) bits.push(POSE[an]);
    else if (z.activity?.act) bits.push((O.ACT_LABEL || {})[z.activity.act] || z.activity.act);
    if (O.npcUI && O.npcUI.talking() === z) bits.push('talking with the player');
    const dest = z.activity && z.activity.b != null && z.agent.inside !== z.activity.b ? s.building(z.activity.b) : null;
    if (dest && (an === 'walk' || an === 'run')) bits.push(`towards ${s.biz.get(dest.id)?.name || dest.name || 'a house'}`);
    if (z.health?.illness) bits.push('looking unwell');
    return bits.join(', ');
  }
  O.doingOf = doing;
  O.nearbyOf = nearby;
  function extraCard(s, q) {
    const PS = O.PlayerState, L = [];
    const nb = nearby(s, q); if (nb.length) L.push(`Near you now: ${nb.map(({ z, d }) => `${z.first} ${z.sur || ''}, ${z.age < 14 ? (z.sex === 'm' ? 'a boy' : 'a girl') : z.sex === 'm' ? 'a man' : 'a woman'} of ${z.age}, ${relTo(s, q, z)}${d < 34 ? ', right beside you' : ''}${doing(s, z) ? ` (${doing(s, z)})` : ''}`.replace(/  /g, ' ')).join('; ')}.`);
    const had = goodsHad(s, q); if (had.length) L.push(`You have: ${had.join(', ')}.`);
    const carried = [...new Set(PS.items)].map((g) => (G()[g]?.name || g).toLowerCase()); L.push(`The player carries: ${carried.join(', ') || 'nothing'}${PS.money ? `, and ₳${PS.money}` : ''}.`);
    for (const m of (PS.meets || []).filter((m) => m.who === q.id && m.place === s.world.placeId && m.state === 'set')) L.push(`You agreed to meet the player at ${m.label}.`);
    if (q.wants && q.wants.until > s.day) L.push(`You asked the player for ${q.wants.name}.`);
    if (q._offer) L.push(`The player is holding out ${q._offer.label} to you as a gift: answer with take_gift or refuse_gift.`);
    if (O.NpcActs && O.NpcActs.following(q)) L.push('You are walking along with the player.');
    if (PS.emp && PS.emp.place === s.world.placeId) L.push(`The player works as ${PS.emp.role} at ${PS.emp.bizName || 'a business here'}.`);
    const realm = (s.kingdom?.news || []).filter((n) => !['migration', 'growth', 'decline'].includes(n.kind) && n.day >= s.day - 10).slice(-3).map((n) => clean(n.text));
    if (realm.length) L.push(`News of the realm: ${realm.join(' | ')}`);
    return L.join('\n');
  }
  function shortCard(s, q) {
    const r = q.rel.get(0) || {}; const job = q.job ? q.job.role : q.age < 14 ? 'a child' : 'no work';
    return `${q.first} ${q.sur || ''} (${q.sex === 'm' ? 'man' : 'woman'}, ${q.age}, ${job}; temper ${(q.traits || []).join(', ')}; ${r.familiar > 0.2 ? 'knows the player' : 'does not know the player'}${r.affinity > 0.3 ? ', likes them' : r.affinity < -0.2 ? ', dislikes them' : ''}). ${speechFor(q.age, q.stage)}`;
  }
  const gest = (q, anim, secs = 2.2) => { const now = performance.now(); q.agent.gest = { anim, from: now, until: now + secs * 1000 }; };
  O.gesture = gest;
  async function say(q, text, render, opt = {}) {
    const s = O.SimRef.cur, PS = O.PlayerState, r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r);
    const conv = q._conv || (q._conv = []);
    text = text.slice(0, 220); conv.push({ who: 'p', t: text }); q._lastSaid = s.day * 1440 + s.minute;
    if (q.activity?.act === 'sleep') return reply(q, pk(['Mmh. Wha...', 'Zzz.', 'Leave me be. I\'m sleeping.']), render);
    if (q.age < 3) { if (q._offer) { const o = q._offer; q._offer = null; if (o.g !== 'coin' && Math.random() < 0.5) { (q.items = q.items || []).push(o.g); return reply(q, pk(['Ooh!', 'Mine!', 'Ta.']), render); } O.NpcActs && O.NpcActs.returnGift(q, o); } return reply(q, babble(q), render); }
    if (!opt.gift && gibberish(text)) { r.trust = clamp((r.trust || 0) - 0.02, -1, 1); gest(q, 'shrug'); return reply(q, confused(q), render); }
    if (!AI.ready) return reply(q, '...', render);
    const ask = askFor(q), group = (q._group || []).filter((z) => z.alive !== false);
    const history = conv.slice(-8, -1).map((c) => (c.who === 'p' ? 'Player: ' : (c.by || q.first) + ': ') + c.t).join('\n');
    const hurryNote = q._hurry ? `${q.first} is in a hurry (${q._hurry.why}): answer briefly, then say they must go now.\n` : '';
    const prompt = `${RULES}\n\n${hurryNote}${group.length ? 'The player is speaking to the whole group: any of them may answer.\n' : ''}--- ${q.first} (spoken to) ---\n${speechFor(q.age, q.stage)}\n${card(s, q)}\n${extraCard(s, q)}\n${group.length ? `--- Also in the talk ---\n${group.map((z) => shortCard(s, z)).join('\n')}\n` : ''}${ask ? `--- Pending request to ${q.first} ---\nThe player wants you to ${ask.goal}. ${ask.why || ''} Weigh it by temper, needs and trust; agree only if convinced.\n` : 'No request is pending: agree is false.\n'}--- Talk so far ---\n${history || '(none)'}\nPlayer: ${text}`;
    render(null, true);
    AI.busy = true;
    let out = null;
    try { out = await AI.json(prompt); }
    catch (e) { AI.busy = false; if (q._offer) { O.NpcActs && O.NpcActs.returnGift(q, q._offer); q._offer = null; } return reply(q, e && e.code === 'rate_limited' ? pk(['Not now. I\'ve a lot on.', 'Give me a moment, will you?']) : pk(['Hm?', 'Sorry, I was miles away.']), render); }
    AI.busy = false;
    const lines = Array.isArray(out?.lines) ? out.lines.filter((l) => l && typeof l.say === 'string' && l.say.trim()) : typeof out?.say === 'string' ? [{ who: q.first, say: out.say }] : [];
    if (!lines.length) return reply(q, pk(['Hm.', 'Well.']), render);
    const n = (v) => clamp(Math.round(Number(v) || 0), -2, 2), everyone = [q, ...group];
    const byName = (w) => everyone.find((z) => z.first === w || (w && String(w).startsWith(z.first))) || null;
    if (out.name && typeof out.name === 'string' && out.name.length < 30) { const nm = clean(out.name).split(' ')[0]; for (const z of everyone) { const rz = z.rel.get(0) || { affinity: 0, familiar: 0 }; rz.name = nm; z.rel.set(0, rz); } }
    for (const z of everyone) {
      const pz = (out.people && (out.people[z.first] || out.people[z.name])) || (z === q ? out : null); if (!pz) continue;
      const rz = z.rel.get(0) || { affinity: 0, familiar: 0 }; z.rel.set(0, rz);
      rz.affinity = clamp(rz.affinity + n(pz.feel) * 0.04, -1, 1); rz.trust = clamp((rz.trust || 0) + n(pz.trust) * 0.06, -1, 1); rz.familiar = Math.min(1, rz.familiar + 0.02);
      if (pz.learned && typeof pz.learned === 'string' && pz.learned.length > 3) { (z.beliefs = z.beliefs || []).unshift({ t: clean(pz.learned).slice(0, 140), src: 'player', day: s.day }); z.beliefs.length = Math.min(z.beliefs.length, 10); }
      if (pz.caught) {
        rz.trust = clamp((rz.trust || 0) - 0.35, -1, 1); rz.affinity = clamp(rz.affinity - 0.2, -1, 1);
        s.remember(z, `Caught ${rz.name || 'the stranger'} in a lie.`, 'player', 1, 0);
        const i = (z.traits || []).indexOf('loyal'); if (i >= 0) z.traits[i] = 'suspicious';
        if (z.beliefs) z.beliefs = z.beliefs.filter((b) => b.src !== 'player');
      }
      if (rz.affinity > 0.7 && (z.traits || []).includes('hostile') && Math.random() < 0.1) z.traits[z.traits.indexOf('hostile')] = 'friendly';
      const fv = n(pz.feel); gest(z, pz.caught ? 'shake' : fv >= 2 ? 'laugh' : fv === 1 ? 'nod' : fv <= -1 ? 'shake' : Math.random() < 0.5 ? 'gesture' : 'shrug', fv >= 2 ? 2.6 : 2);
    }
    if (ask && out.agree === true) { try { ask.onAgree(q); } catch (e) { /* a task gone */ } }
    q._talked = { day: s.day, first: q._talked && q._talked.day === s.day ? q._talked.first : text };
    // what they do
    let leave = false; const notes = [];
    if (Array.isArray(out.acts) && O.NpcActs) for (const a of out.acts.slice(0, 4)) { if (!a || typeof a.do !== 'string') continue; const who = byName(a.who) || q; const res = O.NpcActs.apply(s, who, a, q); if (res === 'leave') leave = true; else if (res) notes.push(res); }
    if (q._offer) { const o = q._offer; q._offer = null; if (r.affinity > -0.2) O.NpcActs && O.NpcActs.keepGift(s, q, o); else O.NpcActs && O.NpcActs.returnGift(q, o); }
    const shown = lines.slice(0, 3).map((l) => { const who = byName(l.who) || q; return { who, t: inChar(who, clean(l.say)) }; });
    q._lastSpeaker = shown[0].who;
    for (const l of shown) conv.push({ who: 'q', by: l.who.first, t: l.t });
    if (conv.length > 16) conv.splice(0, conv.length - 16);
    // in a group each speaks in turn, their own name on the tag
    render(shown[0].t, false);
    let delay = 0; for (const l of shown.slice(1)) { delay += 1400 + shown[0].t.length * 35; setTimeout(() => { if (O.npcUI && O.npcUI.talking() === q && !AI.busy) { q._lastSpeaker = l.who; render(l.t, false); } }, delay); }
    if (notes.length) O.UI.say(notes.join(' '));
    if (q._hurry) { leave = true; q._hurry = null; }
    if (leave) setTimeout(() => { if (O.npcUI && O.npcUI.talking() === q) { O.npcUI.closeTalk(); } q._snubUntil = s.day * 1440 + s.minute + (r.affinity < -0.2 ? 240 : 30); O.NpcActs && O.NpcActs.walkOff(q); }, 2200);
  }
  // never a name in front of the words, never a word from outside their world
  const OUT = /\b(AI|A\.I\.|artificial|assistant|language model|chatbot|bot|prompt|JSON|roleplay|role-play|role play|in character|NPC|video ?game|the game|player character|Claude|OpenAI|Anthropic|ChatGPT|computer|internet)\b/i;
  function inChar(q, t) {
    t = String(t || '').replace(/^\s*[A-Z][\w'-]+(?: [A-Z][\w'-]+)?\s*:\s*/, '');
    if (OUT.test(t)) return confused(q);
    return tidy(t);
  }
  function reply(q, line, render) {
    line = inChar(q, clean(line)) || '...'; q._lastSpeaker = null;
    (q._conv = q._conv || []).push({ who: 'q', t: line }); if (q._conv.length > 16) q._conv.splice(0, q._conv.length - 16);
    render(line, false);
  }
  // holding something out: it leaves your hands, and they take it or hand it back
  function give(q, g, render) {
    const PS = O.PlayerState; if (q._offer) return;
    let label, offer;
    if (g === 'coin') { const n = Math.min(PS.money, 5); if (n < 1) return; PS.money -= n; label = `₳${n}`; offer = { g, n, label }; }
    else { if (!PS.remove(g)) return; label = (/^[aeiou]/i.test(G()[g]?.name || '') ? 'an ' : 'a ') + (G()[g]?.name || g).toLowerCase(); offer = { g, n: 1, label }; }
    q._offer = offer; O.NpcActs && O.NpcActs.fly('player', q, g);
    O.game.player.anim = 'place'; O.game.player.ft = 0; setTimeout(() => { if (O.game.player.anim === 'place') O.game.player.anim = 'idle'; }, 500);
    say(q, `(holds out ${label} to you)`, render, { gift: true });
  }
  // a letter in your own words: they read it, may act on it, and write back
  async function readLetter(s, q, text) {
    if (!AI.ready || q.age < 9) return;
    const prompt = `${RULES}\n\nInstead of talk: ${q.first} has just read a letter from the player and writes a short reply letter (the "say" of one line, 1 to 3 sentences, plain and in character; a poor or rough person writes plainly). Acts like meet still apply; follow, go and leave do not.\n--- ${q.first} ---\n${speechFor(q.age, q.stage)}\n${card(s, q)}\n${extraCard(s, q)}\nNo request is pending: agree is false.\n--- The letter ---\nPlayer: ${String(text).slice(0, 400)}`;
    let out; try { out = await AI.json(prompt); } catch (e) { return; }
    const line = Array.isArray(out?.lines) && out.lines[0] && out.lines[0].say ? inChar(q, clean(out.lines[0].say)) : null;
    const pz = out?.people && (out.people[q.first] || Object.values(out.people)[0]); const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r);
    if (pz) { r.affinity = clamp(r.affinity + clamp(Math.round(+pz.feel || 0), -2, 2) * 0.04, -1, 1); r.trust = clamp((r.trust || 0) + clamp(Math.round(+pz.trust || 0), -2, 2) * 0.05, -1, 1); if (pz.learned) (q.beliefs = q.beliefs || []).unshift({ t: clean(pz.learned).slice(0, 140), src: 'player', day: s.day }); }
    if (out?.name) r.name = clean(out.name).split(' ')[0];
    const notes = []; if (Array.isArray(out?.acts) && O.NpcActs) for (const a of out.acts.slice(0, 3)) if (a && ['meet', 'give', 'want', 'seek_job', 'tell', 'like', 'invite'].includes(a.do)) { if (a.do === 'give') continue; const res = O.NpcActs.apply(s, q, a, q); if (res && res !== 'leave') notes.push(res); }
    if (line) O.sendMail('reply', { from: q.name, text: line, notes }, 2 + Math.random() * 6, `A letter from ${q.first}`);
  }
  O.mailHandlers = O.mailHandlers || {};
  O.mailHandlers.reply = (d) => { O.Panels.open(`A letter from ${d.from}`, `<p class="letter">${esc(d.text)}</p>${(d.notes || []).length ? `<p class="caption">${esc(d.notes.join(' '))}</p>` : ''}`); };
  // friends now and then write to ask you to meet
  { const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () { const r = _nd.apply(this, arguments);
      if (this !== O.SimRef.cur || !O.NpcActs || Math.random() > 0.35) return r;
      const fond = this.people.filter((p) => p.alive !== false && p.age >= 16 && ((p.rel.get(0) || {}).affinity || 0) > 0.45 && ((p.rel.get(0) || {}).familiar || 0) > 0.3);
      const q = fond[Math.floor(Math.random() * fond.length)]; if (!q || (O.PlayerState.meets || []).some((m) => m.who === q.id && m.state === 'set')) return r;
      const tav = [...this.biz.values()].find((b) => b.type === 'tavern'), place = Math.random() < 0.5 && tav ? tav.name : 'the square', hour = place === 'the square' ? 12 + Math.floor(Math.random() * 5) : 18 + Math.floor(Math.random() * 3);
      const note = O.NpcActs.apply(this, q, { do: 'meet', place, hour, day: 'tomorrow', why: q.traits.includes('social') ? 'a drink and a talk' : 'a talk' }, q);
      if (note) O.sendMail('reply', { from: q.name, text: `Will you meet me at ${place} tomorrow, at ${hour > 12 ? hour - 12 + ' in the evening' : hour === 12 ? 'noon' : hour + ' in the morning'}? I'd like to see you.`, notes: [note] }, 1 + Math.random() * 4, `A letter from ${q.first}`);
      return r; }; }
  // when a talk ends, they keep one memory of it, not a line for every word
  function ended(q) {
    const s = O.SimRef.cur; if (!q) return;
    if (q._offer) { O.NpcActs && O.NpcActs.returnGift(q, q._offer); q._offer = null; }
    if (!q._talked || q._talked.day !== s.day || q._talked.stored) return;
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
  O.AIChat = { say, give, ended, card, gibberish, readLetter };
})();
