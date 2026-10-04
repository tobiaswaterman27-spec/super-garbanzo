// Running with a gang. Ask any member of one of the town's gangs to let you in; prove yourself if
// they won't take you on your name alone. Every gang has the same ladder, and each rung has its own
// work, given out when you ask for it: a hanger-on keeps watch and carries word; a runner fences what
// others lift; a lifter works the crowds; a housebreaker takes what's in a marked house; an enforcer
// collects the gang's protection from the shops and roughs up those who won't pay; a lieutenant
// sends the others out at night and keeps the purse; the right hand settles the gang's worst
// quarrels for good. Work done well earns a cut and trust; enough trust and the boss moves you up.
// You may run with more than one gang, but never two in the same town: they'd know.
'use strict';
(function () {
  // the gang's jobs, from the meanest to the best: each its own work and its own cut
  const JOBS = [
    { name: 'Lookout', pay: 2, kinds: ['watch'] },
    { name: 'Runner', pay: 3, kinds: ['message'] },
    { name: 'Cutpurse', pay: 4, kinds: ['lift'] },
    { name: "Fence's boy", pay: 5, kinds: ['fence'] },
    { name: 'Smuggler', pay: 6, kinds: ['smuggle'] },
    { name: 'Poacher', pay: 6, kinds: ['poach'] },
    { name: 'Footpad', pay: 7, kinds: ['rough'] },
    { name: 'Housebreaker', pay: 9, kinds: ['burgle'] },
    { name: 'Enforcer', pay: 10, kinds: ['protect', 'rough'] },
    { name: 'Spy', pay: 11, kinds: ['spy'] },
    { name: 'Recruiter', pay: 12, kinds: ['recruit'] },
    { name: 'Lieutenant', pay: 15, kinds: ['manage'] },
    { name: 'Assassin', pay: 30, kinds: ['kill'] },
    { name: 'Right hand', pay: 35, kinds: ['kill', 'manage'] },
  ];
  const RANKS = JOBS.map((j) => j.name), PAY = JOBS.map((j) => j.pay);
  function setup(game, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t)), T = 16;
    const mine = () => (PS.gangRanks = PS.gangRanks || []);
    const here = (s = cur()) => mine().filter((m) => m.place === s.world.placeId);
    const memberOf = (s, gid) => mine().find((m) => m.place === s.world.placeId && m.gid === gid);
    const gangOf = (s, m) => s.gangs && s.gangs.find((g) => g.id === m.gid);
    const boss = (s, g) => g && g.leader != null ? s.byId.get(g.leader) : null;
    const door = (b) => [b.doorX * T + 8, b.doorY * T + 10];

    // ---------------------------------------------------------------- talking to a gang's people
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => {
      const out = prevExtra ? prevExtra(q) : [], s = cur();
      const rec = here(s).find((m) => m.task && !m.task.done && m.task.kind === 'recruit' && m.task.target === q.id);
      if (rec) out.push(['grecruit', `Put in a word for ${rec.name.replace(/^the /, 'the ')}`]);
      if (!q.gang && q.age >= 16 && s.gangs && s.gangs.length && !/guard|captain|sergeant/.test(q.job?.role || '') && !memberOfAny(s)) out.push(['gwho', 'Know anyone who works outside the law?']);
      if (!q.gang || q.gang === 'player' || !s.gangs) return out;
      const g = s.gang(q.gang); if (!g) return out;
      const m = memberOf(s, g.id);
      if (!m && !((PS.knowsGang || {})[O.knowKey(q)] || PS.rep.criminal > 0.35)) return out; // you'd have to know they're one of them
      if (!m) out.push(['gjoin', `Ask to run with ${g.name}`]);
      else {
        if (!m.task || m.task.done) out.push(['gtask', 'Any work for me?']);
        else if (m.task.kind === 'fence' && Object.keys(PS.stolen || {}).length) out.push(['gfence', 'Hand over what I lifted']);
        out.push(['grank', 'Where do I stand?']);
        if (m.rank >= 11) out.push(['gmanage', "The night's work"]);
      }
      return out;
    };
    const memberOfAny = (s) => (s.gangs || []).some((g) => memberOf(s, g.id));
    // who'd know: the shady, the poor, the tavern crowd, and anyone who likes you; the honest won't say
    // Who'll tell you, and what they actually know. The upright (the law, the government, the Church) and
    // the good-hearted never say. Everyone else needs to trust you first, and can only name someone they
    // know runs with a gang: kin, a friend, someone they drink with; or, for the town's rough sort, a face
    // everyone in the lanes knows.
    function gangLead(s, q) {
      const PSx = PS, aff = q.rel?.get(0)?.affinity || 0;
      if (O.upright(s, q)) return `"${['I\'ll not help you into that sort of company.', 'Ask the watch, if you\'re so curious. In fact, I might.', 'God keep you from such people.'][q.id % 3]}"`;
      const good = q.attitude > 0.35 || q.traits.includes('generous') && q.traits.includes('loyal');
      if (good) return '"Me? I keep to honest work, and honest folk."';
      const rough = q.traits.includes('greedy') || q.traits.includes('hostile') || q.attitude < -0.1 || s.household(q).money < 15;
      const need = rough ? 0.1 : 0.35;
      if (aff < need && PSx.rep.criminal < 0.3) return `"${['Why would I tell you anything? I hardly know you.', 'I don\'t talk about such things with strangers.', 'Buy me a drink some time, and maybe we\'ll talk.'][q.id % 3]}"`;
      const ms = s.people.filter((m) => m.gang && m.gang !== 'player' && m.alive !== false && m !== q);
      const knowsOf = ms.filter((m) => m.household === q.household || (q.rel?.get(m.id)?.affinity || 0) > 0.15 || (m.rel?.get(q.id)?.affinity || 0) > 0.15 || (rough && (m.id + q.id) % 3 === 0));
      if (!knowsOf.length) return `"${['I wouldn\'t know. I keep my head down.', 'Not that I know of, and I\'d not want to.', 'Couldn\'t tell you. Nobody I know.'][q.id % 3]}"`;
      const m = knowsOf.sort((a, b) => ((a.id * 5 + q.id) % 11) - ((b.id * 5 + q.id) % 11))[0], g = s.gang(m.gang);
      const where = m.job?.biz != null && s.biz.get(m.job.biz) ? `you'll find ${m.sex === 'f' ? 'her' : 'him'} at ${s.biz.get(m.job.biz).name} in the day` : s.biz && [...s.biz.values()].find((z) => z.type === 'tavern') ? `${m.sex === 'f' ? 'she' : 'he'} drinks at ${[...s.biz.values()].find((z) => z.type === 'tavern').name} of an evening` : `${m.sex === 'f' ? 'she' : 'he'} lives about the town`;
      PSx.gangLead = m.id; (PSx.knowsGang = PSx.knowsGang || {})[O.knowKey(m)] = 1;
      return `"Keep your voice down. ${m.first} ${m.sur || ''} runs with ${g ? g.name : 'a crew'}: ${where}. Talk to ${m.sex === 'f' ? 'her' : 'him'}, and you never heard it from me."`;
    }
    npcUI.onExtra = (q, key, render) => {
      if (key === 'gwho') { const s = cur(); if (q._gwho === s.day) return render('"I\'ve said what I\'ve said."'); q._gwho = s.day; return render(gangLead(s, q)); }
      if (key === 'grecruit') {
        const s = cur(), m = here(s).find((x) => x.task && !x.task.done && x.task.kind === 'recruit' && x.task.target === q.id), g = m && s.gang(m.gid);
        if (!g) return render('Eh?');
        const ch = 0.35 + Math.max(0, -(q.attitude || 0)) * 0.5 + ((q.rel.get(0) || {}).affinity || 0) * 0.5 + (s.household(q).money < 30 ? 0.2 : 0);
        if (O.upright(s, q)) return render(`"Me? Run with them? I serve ${q.job?.biz != null && s.biz.get(q.job.biz)?.def.public ? 'the town' : 'the Church and the crown'}. Get away from me before I call the watch."`);
        if (s.rng.chance(ch)) { g.members.push({ id: q.id, role: 'recruit', loyalty: 0.5, wage: 3, joined: s.day }); q.gang = g.id; m.task.have = 1; complete(s, g, m); return render(`...All right. Tell them I'm in.`); }
        m.task.tries = (m.task.tries || 0) + 1; s.relate(q, { id: 0 }, -0.05);
        return render(m.task.tries >= 2 ? "I said no. Leave me be, or I'll tell the watch." : "Run with a gang? No. I've trouble enough.");
      }
      if (!['gjoin', 'gtask', 'grank', 'gfence', 'gmanage'].includes(key)) return prevOn && prevOn(q, key, render);
      const s = cur(), g = s.gang(q.gang);
      if (key === 'gjoin') return join(s, g, q, render);
      const m = memberOf(s, g.id);
      if (key === 'grank') return render(`You're ${/^[AEIOU]/.test(RANKS[m.rank]) ? 'an' : 'a'} ${RANKS[m.rank].toLowerCase()} with us. ${m.rank >= RANKS.length - 1 ? "There's nowhere higher but the boss's own chair." : `${Math.max(0, need(m) - m.done)} more good jobs and the boss might think of you for ${RANKS[m.rank + 1].toLowerCase()}.`}`);
      if (key === 'gtask') { const t = give(s, g, m, q); if (!t) return render('Nothing just now. Come back tomorrow.'); refresh(); return render(t.ask); }
      if (key === 'gfence') { const n = Object.values(PS.stolen).reduce((a, b) => a + b, 0); let paid = 0; for (const [k, c] of Object.entries(PS.stolen)) { const r = PS.remove(k, c); paid += Math.max(1, Math.round((O.Data.GOODS[k]?.base || 2) * 0.5)) * r; } PS.stolen = {}; PS.money += paid; g.purse += Math.round(paid * 0.4); m.task.have = m.task.need; complete(s, g, m, q); return render(`${n} things. ₳${paid} for you, the rest for the purse. Good.`); }
      if (key === 'gmanage') { npcUI.closeTalk(); return manage(s, g, m); }
    };
    function join(s, g, q, render) {
      const other = here(s).find((m) => m.gid !== g.id);
      const r = q.rel.get(0) || {}, rep = PS.rep.criminal || 0;
      const trial = trials()[s.world.placeId + ':' + g.id];
      if (trial && trial.done) { /* proved */ }
      else if (rep < 0.08 && (r.affinity || 0) < 0.3) {
        trials()[s.world.placeId + ':' + g.id] = { need: 2, have: 0, done: false };
        return render(`Run with us? Nobody knows your name. Lift two purses in ${s.world.name} without the watch taking you, then come and ask again.`);
      }
      if (other) {
        const og = s.gang(other.gid);
        PS.gangRanks = mine().filter((x) => x !== other);
        if (og) { og.rel.player = 'enemy'; s.log(`${og.name} have heard the newcomer now runs with ${g.name}.`, 'gang'); }
        say(`${og ? og.name.replace(/^the /, 'The ') : 'Your old gang'} will hear of this. They'll not forget it.`, 'bad');
      }
      mine().push({ place: s.world.placeId, placeName: s.world.name, gid: g.id, name: g.name, rank: 0, done: 0, trust: 0.2, since: s.day, task: null });
      g.log.push(`Day ${s.day}: the newcomer was taken on as a lookout.`);
      s.relate(q, { id: 0 }, 0.1); refresh();
      return render(`All right. You're one of ours now, ${g.name.replace(/^the /, '')}. Start at the bottom: ask me for work.`);
    }
    const trials = () => (PS.gangTrials = PS.gangTrials || {});
    O.Bus.on('lift', ({ sim }) => {
      for (const [k, t] of Object.entries(trials())) if (k.startsWith(sim.world.placeId + ':') && !t.done) { t.have++; if (t.have >= t.need) { t.done = true; say('Word will get back to the gang that you can lift a purse. Go and ask them again.'); } }
      for (const m of here(sim)) if (m.task && !m.task.done && m.task.kind === 'lift') { m.task.have++; if (m.task.have >= m.task.need) complete(sim, sim.gang(m.gid), m); refresh(); }
    });
    O.Bus.on('poach', ({ kind, sim }) => { if (kind !== 'deer') return; for (const m of here(sim)) if (m.task && !m.task.done && m.task.kind === 'poach') { m.task.have = 1; complete(sim, sim.gang(m.gid), m); } });
    const need = (m) => 2 + Math.floor(m.rank * 1.2);

    // ---------------------------------------------------------------- the work
    function give(s, g, m, giver) {
      if (m.task && !m.task.done) return m.task;
      const r = s.rng, k = m.rank, houses = s.world.buildings.filter((b) => b.type === 'house' && b.household && b.doorX != null && b.owner?.kind !== 'player');
      const shops = [...s.biz.values()].filter((z) => !z.def.public && z.b && z.b.doorX != null && !z.ownerPlayer);
      const people = s.people.filter((q) => !q.visitor && q.age >= 18 && q.alive !== false && q.gang !== g.id && !q.royal);
      const pool = [], want = JOBS[k].kinds, den = s.world.buildings.find((b) => b.id === g.hideout);
      for (const kind of want) {
        if (kind === 'message') { const h = r.pick(houses); if (h) pool.push({ kind, b: h.id, at: door(h), text: `Carry word to the ${s.households[h.household - 1]?.surname || ''} house`, ask: `Take this word to the ${s.households[h.household - 1]?.surname} house. Say it at the door, nowhere else.`, label: 'Pass the word at the door' }); }
        if (kind === 'watch') { const sp = r.pick(shops); if (sp) pool.push({ kind, b: sp.id, at: [sp.b.doorX * T + 8 + 24, sp.b.doorY * T + 26], text: `Keep watch by ${sp.name} after dark`, ask: `Stand by ${sp.name} tonight and keep your eyes open. An hour after dark. Tell me who comes and goes.`, label: 'Keep watch for an hour', night: true }); }
        if (kind === 'fence') pool.push({ kind, text: 'Bring the gang something lifted', ask: "Bring me something you've lifted, anything, and I'll fence it. You keep half." });
        if (kind === 'lift') pool.push({ kind, need: 2, text: 'Lift two purses in the crowd', ask: "Two purses. Market, tavern, wherever the crowd is thick. Don't get caught." });
        if (kind === 'smuggle') { const h = r.pick(houses); if (h) pool.push({ kind, b: h.id, at: door(h), text: `Carry a crate to the ${s.households[h.household - 1]?.surname} house after dark`, ask: `There's a crate wants moving, quiet like, to the ${s.households[h.household - 1]?.surname} house. After dark. Don't open it.`, label: 'Leave the crate at the door', night: true, carry: true }); }
        if (kind === 'poach') pool.push({ kind, text: "Bring down one of the lord's deer", ask: "The lord's deer, in the woods. One will do. Mind the gamekeeper." });
        if (kind === 'rough') { const d = r.pick(people.filter((q) => q.job)); if (d) pool.push({ kind, target: d.id, text: `Rough up ${d.name}`, ask: `${d.name} owes and won't pay. Put them on the ground. Don't kill them: dead men pay nothing.` }); }
        if (kind === 'burgle') { const h = r.pick(houses.filter((b) => (b.wealth || 0.4) > 0.35)) || r.pick(houses); if (h) pool.push({ kind, b: h.id, text: `Take something from the ${s.households[h.household - 1]?.surname} house`, ask: `The ${s.households[h.household - 1]?.surname} house. They keep more than they show. Get in at night, take what you can carry, get out.` }); }
        if (kind === 'protect') { const sp = r.pick(shops); if (sp) pool.push({ kind, b: sp.id, at: [sp.b.doorX * T + 8, sp.b.doorY * T + 10], text: `Collect our due from ${sp.name}`, ask: `${sp.name} owes us for keeping it safe. ₳${PAY[8] * 2}. Make sure they understand.`, label: `Lean on ${sp.name} for the gang's due` }); }
        if (kind === 'spy') { const rv = s.gangs.find((x) => x.id !== g.id && x.id !== 'player'), rb = rv && s.world.buildings.find((b) => b.id === rv.hideout); if (rb) pool.push({ kind, b: rb.id, at: [rb.doorX * T + 8 + 40, (rb.doorY + 2) * T], text: `Watch ${rv.name}' den after dark`, ask: `${rv.name.replace(/^the /, 'The ')} are up to something. Lie up near their den tonight and count who comes and goes.`, label: 'Lie up and watch the den', night: true });
          else { const wh = s.world.buildings.find((b) => b.type === 'guard' && b.doorX != null); if (wh) pool.push({ kind, b: wh.id, at: [wh.doorX * T + 8 + 30, (wh.doorY + 2) * T], text: 'Watch the watch house after dark', ask: 'I want to know when the watch change over, and how many go out at night. Watch the watch house tonight.', label: 'Watch the watch house', night: true }); } }
        if (kind === 'recruit') { const free = s.people.filter((q) => !q.visitor && !q.gang && q.age >= 17 && q.age < 45 && q.alive !== false && !q.job?.role?.startsWith('guard') && !q.gentry), t = r.pick(free.filter((q) => !q.job)) || r.pick(free); if (t) pool.push({ kind, target: t.id, text: `Bring ${t.name} into the gang`, ask: t.job ? `${t.name} is sick of their master. Talk them round: we pay better.` : `${t.name} has no work and an empty belly. Talk them round. We could use the hands.` }); }
        if (kind === 'manage') pool.push({ kind, text: "Send the lads out on tonight's job", ask: "You run the night's work now. Pick a house, pick the hands, and keep the purse straight." });
        if (kind === 'kill') {
          const rivals = s.gangs.filter((x) => x.id !== g.id && x.id !== 'player').map((x) => s.byId.get(x.leader)).filter((q) => q && q.alive !== false);
          const witness = people.find((q) => q.memories && q.memories.some((mm) => mm.kind === 'crime' && /gang|den/.test(mm.text)));
          const t = r.pick(rivals) || witness || r.pick(people);
          if (t) pool.push({ kind, target: t.id, text: `Settle ${t.name} for good`, ask: `${t.name}. ${t.gang ? 'Their lot have had this coming.' : 'They saw too much and talk too much.'} I don't want to hear their name again. Nobody sees you do it.` });
        }
      }
      void den;
      const t = pool.length ? r.pick(pool) : null; if (!t) return null;
      m.task = Object.assign({ id: Math.random().toString(36).slice(2, 7), need: 1, have: 0, done: false, day: s.day, giver: giver && giver.id }, t);
      return m.task;
    }
    function complete(s, g, m, from) {
      const t = m.task; if (!t) return; t.done = true;
      const pay = PAY[m.rank] + (t.kind === 'kill' ? 40 : 0), purse = g ? g.purse : 0, paid = Math.min(pay, Math.max(0, Math.floor(purse)));
      if (g) g.purse -= paid; PS.money += paid; PS.rep.criminal = Math.min(1, (PS.rep.criminal || 0) + 0.03 + m.rank * 0.01);
      m.done++; m.trust = Math.min(1, m.trust + 0.08);
      say(`${t.text}: done. ${paid ? `Your cut: ₳${paid}.` : 'The purse is empty; you\'re owed.'}`);
      if (g) g.log.push(`Day ${s.day}: the newcomer did the gang's work (${t.text.toLowerCase()}).`);
      // moving up
      if (m.done >= need(m) && m.rank < RANKS.length - 1 && m.trust > 0.35) {
        m.rank++; m.done = 0; m.trust -= 0.15;
        const b = g && boss(s, g); say(`${b ? b.first : 'The boss'} sends word: you're ${RANKS[m.rank].toLowerCase()} now.`);
        if (g) g.log.push(`Day ${s.day}: the newcomer was made ${RANKS[m.rank].toLowerCase()}.`);
      }
      void from; refresh();
    }

    // places where the work is done
    O.gangCandidate = () => {
      const s = cur(), p = game.player;
      for (const m of here(s)) {
        const t = m.task; if (!t || t.done || !t.at) continue;
        if (game.scene) continue;
        if (Math.hypot(t.at[0] - p.x, t.at[1] - p.y) < 24) {
          if (t.night && !(s.hour >= 20 || s.hour < 4)) return { type: 'gangtask', m, d: 3, x: t.at[0], y: t.at[1] - 34, label: 'Come back after dark' };
          return { type: 'gangtask', m, d: 2, x: t.at[0], y: t.at[1] - 34, label: t.label || 'Do the job' };
        }
      }
      return null;
    };
    O.gangAct = (c) => {
      const s = cur(), m = c.m, t = m.task, g = gangOf(s, m), p = game.player;
      if (t.night && !(s.hour >= 20 || s.hour < 4)) return say('Not in daylight. After dark.');
      if (t.kind === 'message') { p.anim = 'talk'; p.locked = true; setTimeout(() => { p.locked = false; p.anim = 'idle'; t.have = 1; complete(s, g, m); }, 1500); say('You knock, and say what you were told to say. The door shuts.'); return; }
      if (t.kind === 'smuggle') { p.anim = 'place'; p.locked = true; setTimeout(() => { p.locked = false; p.anim = 'idle'; t.have = 1; complete(s, g, m); say('You set the crate down by the door and walk away without looking back.'); }, 1300); return; }
      if (t.kind === 'spy') { p.anim = 'crouch'; p.locked = true; let k2 = 0; const step2 = () => { for (let i = 0; i < 6; i++) s.tick(2); if (++k2 < 5) setTimeout(step2, 250); else { p.locked = false; p.anim = 'idle'; t.have = 1; complete(s, g, m); say(`An hour in the bracken. You count them in and out.`); } }; step2(); return; }
      if (t.kind === 'watch') { p.anim = 'look'; p.locked = true; let k = 0; const step = () => { for (let i = 0; i < 6; i++) s.tick(2); if (++k < 5) setTimeout(step, 250); else { p.locked = false; p.anim = 'idle'; t.have = 1; complete(s, g, m); say('An hour goes by. You saw who came and went.'); } }; step(); return; }
      if (t.kind === 'protect') {
        const bz = s.biz.get(t.b), keeper = bz && bz.workers.map((id) => s.byId.get(id)).find((q) => q && q.alive !== false) || null;
        p.anim = 'point'; setTimeout(() => { if (p.anim === 'point') p.anim = 'idle'; }, 900);
        const due = PAY[8] * 2, scared = s.rng.chance(0.65 + (PS.rep.criminal || 0) * 0.3);
        if (bz && scared && bz.cash >= due) { bz.cash -= due; if (g) g.purse += due; t.have = 1; if (keeper) { keeper.agent.shockedUntil = s.minute + 2; s.relate(keeper, { id: 0 }, -0.3); O.Speech.say(keeper, 'All right, all right. Take it.', 2.5); } complete(s, g, m); say(`${keeper ? keeper.first : 'The keeper'} counts out ₳${due} with shaking hands. It goes in the gang's purse.`); }
        else { if (keeper) { O.Speech.say(keeper, "I'll not pay. Get out, or I'll call the watch!", 3, 'angry'); s.relate(keeper, { id: 0 }, -0.4); } say("They won't pay. Make them, another way, or come back.", 'bad'); const c2 = s.recordCrime && s.recordCrime({ kind: 'extortion', perp: 'player', placeName: bz ? bz.name : s.world.name, tile: [Math.floor(p.x / T), Math.floor(p.y / T)], seen: keeper ? [keeper] : [], severity: 1 }); if (c2) PS.crimes.push(c2.id); }
      }
    };
    // a marked house, a marked man: watched for
    let lastStolen = 0;
    game.hooks.update.push(() => {
      const s = cur();
      for (const m of here(s)) {
        const t = m.task; if (!t || t.done) continue;
        if (t.kind === 'burgle') { const n = Object.values(PS.stolen || {}).reduce((a, b) => a + b, 0); if (game.scene && game.scene.b.id === t.b && n > lastStolen) { t.have = 1; complete(s, gangOf(s, m), m); } lastStolen = n; }
        if (t.kind === 'rough') { const q = s.byId.get(t.target); if (q && (q.health.hp < 70 || (q._punched || 0) >= 3)) { t.have = 1; complete(s, gangOf(s, m), m); } else if (!q || q.alive === false) { t.done = true; say(`${q ? q.name : 'They'} died. The boss wanted them paying, not dead.`, 'bad'); m.trust -= 0.2; } }
        if (t.kind === 'kill') { const q = s.byId.get(t.target); if (!q || q.alive === false || q.health?.hp <= 0) { t.have = 1; complete(s, gangOf(s, m), m); } }
        // left too long, the work goes to someone else
        if (!t.done && s.day - t.day > 3) { t.done = true; m.trust = Math.max(0, m.trust - 0.12); say(`The gang gave “${t.text.toLowerCase()}” to someone else. You took too long.`, 'bad'); refresh(); }
      }
    });

    // ---------------------------------------------------------------- the night's work (lieutenant and up)
    function manage(s, g, m) {
      const hands = g.members.map((x) => [x, s.byId.get(x.id)]).filter(([, q]) => q && q.alive !== false && !q.jailUntil);
      const houses = s.world.buildings.filter((b) => b.type === 'house' && b.household && b.owner?.kind !== 'player').slice(0, 12);
      const set = g.playerOrder && g.playerOrder.day === s.day ? g.playerOrder : null;
      O.Panels.open(`${g.name.replace(/^the /, 'The ')}: the night's work`, `<p class="caption">The purse holds ₳${Math.floor(g.purse)}. ${hands.length} hands free. ${set ? `Tonight: the ${esc(s.households[s.building(set.b)?.household - 1]?.surname || '')} house, ${set.hands.length} hands.` : 'Nothing set for tonight.'}</p>
        <div class="lbl">Who goes</div>${hands.map(([x, q], i) => `<label style="display:block"><input type="checkbox" data-h="${i}" ${x.role !== 'leader' ? 'checked' : ''}> ${esc(q.name)} <small class="lbl">${esc(x.role)}, loyalty ${Math.round(x.loyalty * 100)}%</small></label>`).join('')}
        <div class="lbl" style="margin-top:8px">Which house</div><select data-b>${houses.map((b) => `<option value="${b.id}">The ${esc(s.households[b.household - 1]?.surname || '')} house (${b.wealth > 0.6 ? 'rich' : b.wealth > 0.35 ? 'comfortable' : 'poor'}, ${b.security > 0.4 ? 'well barred' : 'easy door'})</option>`).join('')}</select>
        <div class="topics" style="margin-top:10px"><button data-go="1">Send them tonight</button><button data-wages="1">Pay the hands (₳${hands.length * 3})</button></div>`, (r) => {
        r.querySelector('[data-go]').onclick = () => {
          const picked = [...r.querySelectorAll('[data-h]')].filter((x) => x.checked).map((x) => hands[+x.dataset.h][1].id); if (!picked.length) return O.Panels.toast('Send somebody.', 'bad');
          g.playerOrder = { day: s.day, b: +r.querySelector('[data-b]').value, hands: picked };
          if (m.task && m.task.kind === 'manage' && !m.task.done) { m.task.have = 1; complete(s, g, m); }
          O.Panels.close(); say('Word goes round the den: tonight, after the bells.');
        };
        r.querySelector('[data-wages]').onclick = () => { const w = hands.length * 3; if (g.purse < w) return O.Panels.toast('The purse is too light.', 'bad'); g.purse -= w; for (const [x] of hands) x.loyalty = Math.min(1, x.loyalty + 0.05); O.Panels.toast('The hands are paid. They like you better for it.'); manage(s, g, m); };
      });
    }
    // the job you ordered goes ahead at two in the morning, in whichever town it was set
    let lastNight = -1;
    game.hooks.update.push(() => {
      for (const v of [O.SimRef.home, ...[...(O.Travel?.visited.values() || [])].map((x) => x.sim)]) {
        const s = v; if (!s || !s.gangs) continue;
        for (const g of s.gangs) {
          const o = g.playerOrder; if (!o || o.ran || s.day !== o.day + (s.hour < 12 ? 1 : 0) || s.hour < 2 || s.hour > 5) continue;
          o.ran = true; if (lastNight === s.day) { /* one report a night */ } lastNight = s.day;
          const b = s.building(o.b), hh = b && s.households[b.household - 1], hands = o.hands.map((id) => s.byId.get(id)).filter(Boolean);
          const odds = 0.35 + hands.length * 0.12 - (b?.security || 0.3) * 0.5;
          if (hh && s.rng.chance(O.clamp(odds, 0.1, 0.85))) { const took = Math.min(hh.money, 10 + s.rng.int(0, 30)); hh.money -= took; g.purse += took; g.log.push(`Day ${s.day}: the night's work at the ${hh.surname} house brought in ₳${took}.`); s.log(`The ${hh.surname} house was broken into in the night.`, 'crime'); PS.money += Math.round(took * 0.2); if (O.SimRef.cur === s) say(`Word from the den: the ${hh.surname} job went well. ₳${took}, a fifth of it yours.`); }
          else { const caught = hands[0]; if (caught && s.arrestNPC) s.arrestNPC(caught, { kind: 'burglary', severity: 2, witnesses: [], profile: {} }, false); g.log.push(`Day ${s.day}: the night's work went wrong; ${caught ? caught.name + ' was taken' : 'nobody got in'}.`); if (O.SimRef.cur === s) say(`Word from the den: the job went wrong.${caught ? ` ${caught.first} was taken by the watch.` : ''}`, 'bad'); }
        }
      }
    });

    // ---------------------------------------------------------------- the list in the corner
    let el = null, sig = '';
    function refresh() { sig = ''; }
    game.hooks.update.push(() => {
      if (!el) { el = document.createElement('div'); el.className = 'joblist ganglist'; (document.getElementById('tab-play') || document.body).appendChild(el); }
      const list = mine(); if (!list.length || O.panelOpen) { el.hidden = true; sig = ''; return; }
      const jl = document.querySelector('.joblist:not(.ganglist)'), top = jl && !jl.hidden ? jl.offsetTop + jl.offsetHeight + 10 : 12;
      const html = list.map((m) => `<div class="jh">${esc(RANKS[m.rank])} · ${esc(m.name.replace(/^the /, 'The '))}${m.place !== cur().world.placeId ? `, ${esc(m.placeName)}` : ''}</div>${m.task && !m.task.done ? `<ul><li>□ ${esc(m.task.text)}${m.task.need > 1 ? ` (${m.task.have}/${m.task.need})` : ''}</li></ul>` : '<div class="js">Ask any of them for work</div>'}`).join('');
      if (html + top !== sig) { sig = html + top; el.innerHTML = html; el.style.top = top + 'px'; }
      el.hidden = false;
    });
    // a marker over where the gang's work is waiting
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      if (indoor) return; const s = cur(), bob = Math.round(Math.sin(game.t * 4) * 2);
      for (const m of here(s)) { const t = m.task; if (!t || t.done || !t.at) continue; const x = Math.round(t.at[0] - cam.x), y = Math.round(t.at[1] - 40 - cam.y) + bob; ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 3, y - 1, 7, 5); ctx.fillRect(x - 1, y + 4, 3, 2); ctx.fillStyle = '#c04a3a'; ctx.fillRect(x - 2, y, 5, 3); ctx.fillRect(x, y + 3, 1, 2); }
    });
    O.GangLife = { RANKS, JOBS, mine, give, complete };
  }
  O.GangLifeSetup = { setup };
})();
