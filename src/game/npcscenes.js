// Small things people do together, where you can see them. Every little while, somewhere near you, one
// of these happens with whoever is free and fits it:
// - women at the well with their buckets, passing the news while the pails fill;
// - two men crouched over knucklebones or dice on the step, shouting the throws;
// - children playing tag, chasing and shrieking, or skipping in a ring;
// - two neighbours who don't get on, quarrelling over a debt in the street, pointing and shaking fists;
// - a young one taking a heavy sack off an old one's back and carrying it for them;
// - a courting pair walking out side by side;
// - a pedlar crying his wares, and someone buying;
// - a child lost in the square, crying for their mother, until the mother comes running (or you walk
//   them home: say you'll take them, and they follow you);
// - the priest stopping to bless someone.
// Everything they say moves how they feel about each other, and is remembered.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 3);
    const tileOf = (q) => [Math.floor(q.agent.x / T), Math.floor(q.agent.y / T)];
    const near = (q, r) => q && q.agent && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < r;
    const FREE = new Set(['stroll', 'socialise', 'idle', 'shop', 'play', 'rest', 'home', 'forage']);
    const free = (q) => q && q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand && !q.agent.frozen && !q.visitor && q.alive !== false && (!q.activity || FREE.has(q.activity.act)) && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) && !q._scene;
    const freeNear = (s, r, f) => s.people.filter((q) => free(q) && near(q, r) && (!f || f(q)));
    const hold = (qs, secs) => { for (const q of qs) { q._scene = true; setTimeout(() => { q._scene = false; }, secs * 1000); } };
    const send = (s, q, tile, o) => O.Errands && O.Errands.send(s, q, tile, Object.assign({ giveUp: 40 }, o));
    const kin = (s, c) => [...(c.parents || []), ...((s.household(c)?.members) || [])].map((id) => s.byId.get(id)).filter((q, i, a) => q && q !== c && q.age >= 18 && a.indexOf(q) === i);
    const rel = (s, a, b, d) => { s.relate(a, b, d); s.relate(b, a, d); };

    const SCENES = [
      // the well
      { name: 'well', fit: (s) => { const w = s.world.props.find((p) => p.kind === 'well' && Math.hypot(p.x - game.player.x, p.y - game.player.y) < 320); if (!w) return null; const ws = freeNear(s, 360, (q) => q.sex === 'f' && q.age >= 15).slice(0, 3); return ws.length >= 2 ? { w, ws } : null; },
        run: (s, { w, ws }) => { const wt = [Math.floor(w.x / T), Math.floor(w.y / T) + 1]; hold(ws, 30); ws.forEach((q, i) => send(s, q, [wt[0] - 1 + i, wt[1]], { anim: i ? 'talk' : 'bucket', secs: 14, face: 3, carry: { good: 'bucket', qty: 1 } }));
          const topic = pick(['the price of bread', 'the miller\'s new wife', 'who was seen at the tavern late', 'the weather for the harvest', 'the reeve', 'a sick child two doors down']);
          setTimeout(() => say(ws[0], pick([`Did you hear about ${topic}?`, `They're all talking about ${topic}.`, 'Well, I never.'])), 3500); setTimeout(() => ws[1] && say(ws[1], pick(['No! Tell me.', 'I heard different.', 'Hush, here comes someone.', 'God save us.'])), 6500);
          setTimeout(() => ws[2] && say(ws[2], 'And that is all I will say on it.'), 9500); for (let i = 1; i < ws.length; i++) rel(s, ws[0], ws[i], 0.04); } },
      // dice or knucklebones on the step
      { name: 'dice', fit: (s) => { const ms = freeNear(s, 300, (q) => q.age >= 14 && q.age < 60 && q.sex === 'm').slice(0, 2); return ms.length === 2 ? { ms } : null; },
        run: (s, { ms }) => { const t = tileOf(ms[0]); hold(ms, 25); send(s, ms[0], t, { anim: 'crouch', secs: 14, face: 2 }); send(s, ms[1], [t[0] + 1, t[1]], { anim: 'crouch', secs: 14, face: 1 });
          let k = 0; const iv = setInterval(() => { if (k++ > 3) { clearInterval(iv); const win = pick(ms), lose = ms.find((x) => x !== win); say(win, 'Mine! Pay up.'); setTimeout(() => say(lose, pick(['Again tomorrow.', 'You cheat, I swear it.', 'Fine. Here.'])), 1600); const hw = s.household(win), hl = s.household(lose); if (hw && hl && hl.money > 1) { hl.money -= 1; hw.money += 1; } rel(s, win, lose, Math.random() < 0.3 ? -0.05 : 0.03); return; } const q = ms[k % 2]; say(q, pick(['Sixes!', 'Snake eyes. Curse it.', 'Four and three.', 'Come on, come on...']), 1.6); O.sfx && O.sfx('catch', 0.3); O.gesture && O.gesture(q, k % 2 ? 'celebrate' : 'shrug', 1.2); }, 2600); } },
      // children's games
      { name: 'tag', fit: (s) => { if (O.KidsPlay) return null; // (the children's games are played out properly now)
        { const ks = freeNear(s, 300, (q) => q.age >= 5 && q.age <= 12).slice(0, 4); return ks.length >= 3 ? { ks } : null; } },
        run: (s, { ks }) => { hold(ks, 30); const base = tileOf(ks[0]); let it = 0;
          const round = (n) => { if (n > 5) return; const t = [base[0] + Math.floor(Math.random() * 7) - 3, base[1] + Math.floor(Math.random() * 5) - 2]; ks.forEach((q, i) => send(s, q, i === it ? t : [t[0] + (i - 1) * 2, t[1] + (i % 2 ? 1 : -1)], { anim: i === it ? 'point' : 'celebrate', secs: 1.5, face: 0 })); say(ks[it], n ? 'You\'re it!' : pick(['Can\'t catch me!', 'Tag! Who\'s it?', 'One, two, three, coming!']), 1.6); it = (it + 1) % ks.length; setTimeout(() => round(n + 1), 4500); };
          round(0); ks.forEach((a) => ks.forEach((b) => { if (a !== b) s.relate(a, b, 0.02); })); } },
      // a quarrel over a debt
      { name: 'quarrel', fit: (s) => { for (const a of freeNear(s, 300, (q) => q.age >= 18)) { const b = freeNear(s, 300, (q) => q !== a && q.age >= 18 && ((a.rel.get(q.id) || {}).affinity || 0) < -0.1)[0]; if (b) return { a, b }; } return null; },
        run: (s, { a, b }) => { hold([a, b], 20); const t = tileOf(b); send(s, a, [t[0] - 1, t[1]], { anim: 'point', secs: 8, face: 2 }); const n = 2 + Math.floor(Math.random() * 10);
          setTimeout(() => say(a, `You still owe me ${n} aurins, ${b.first}. Since Lady Day!`), 2500); setTimeout(() => { say(b, pick(['I paid you, and you know it.', 'You\'ll have it when I have it.', 'Keep your voice down, man.'])); O.gesture && O.gesture(b, 'shake', 1.5); }, 5000);
          setTimeout(() => { say(a, pick(['We\'ll see what the reeve says.', 'Liar.', 'This isn\'t over.'])); rel(s, a, b, -0.06); s.remember(a, `Quarrelled with ${b.name} in the street over money owed.`, 'grudge', 1.2, b.id); s.remember(b, `${a.name} shamed me in the street over a debt.`, 'grudge', 1.2, a.id); }, 8000); } },
      // a helping hand
      { name: 'help', fit: (s) => { const old = freeNear(s, 280, (q) => q.age >= 62)[0]; const young = old && freeNear(s, 300, (q) => q !== old && q.age >= 14 && q.age <= 40)[0]; return old && young ? { old, young } : null; },
        run: (s, { old, young }) => { hold([old, young], 25); old.agent.carrying = { good: 'sack', qty: 1 }; say(old, 'Oof. My back.'); const t = tileOf(old);
          send(s, young, [t[0] + 1, t[1]], { anim: 'take', secs: 1.5, face: 1, after: () => { old.agent.carrying = null; young.agent.carrying = { good: 'sack', qty: 1 }; say(young, 'Here, let me take that for you.'); setTimeout(() => { say(old, 'Bless you, child.'); young.agent.carrying = null; }, 6000); } });
          rel(s, old, young, 0.12); s.remember(old, `${young.first} carried my load for me.`, 'social', 1.5, young.id); } },
      // walking out together
      { name: 'courting', fit: (s) => { for (const a of freeNear(s, 300, (q) => q.age >= 16 && q.age <= 35 && !q.spouse)) { const b = s.people.find((q) => free(q) && q !== a && q.sex !== a.sex && !q.spouse && Math.abs(q.age - a.age) < 8 && ((a.rel.get(q.id) || {}).affinity || 0) > 0.3); if (b) return { a, b }; } return null; },
        run: (s, { a, b }) => { hold([a, b], 30); const t = tileOf(a); const dest = [t[0] + 6, t[1] + 1]; send(s, a, dest, { anim: 'talk', secs: 8, face: 1 }); send(s, b, [dest[0] + 1, dest[1]], { anim: 'laugh', secs: 8, face: 2 });
          setTimeout(() => say(a, pick(['Will you walk out with me on Sunday?', 'Your hair looks fine today.', 'I made you this. It\'s only a ribbon.'])), 5000); setTimeout(() => say(b, pick(['Perhaps I will.', 'Get away with you!', 'Mother will be watching.'])), 8000); rel(s, a, b, 0.08); } },
      // a lost child
      { name: 'lost', fit: (s) => { const c = freeNear(s, 260, (q) => q.age >= 3 && q.age <= 8 && kin(s, q).length)[0]; return c && !PS.lostChild ? { c } : null; },
        run: (s, { c }) => { c._lost = { day: s.day }; PS.lostChild = { id: c.id, day: s.day }; hold([c], 90); O.Errands.send(s, c, tileOf(c), { anim: 'mourn', secs: 60, face: 0, giveUp: 90 }); say(c, 'Mam? MAM? I can\'t find my mam!', 3.5);
          setTimeout(() => { if (!c._lost) return; const par = kin(s, c).find((q) => q && q.agent && !q.agent.hidden && q.agent.inside == null) || kin(s, c)[0]; if (par && par.agent.inside != null) { par.agent.inside = null; par.agent.hidden = false; const b0 = s.building(par.home); if (b0) { par.agent.x = b0.doorX * T + 8; par.agent.y = (b0.doorY + 1) * T; } } if (!par) return; O.Errands.finish && O.Errands.finish(c, true); O.Errands.send(s, par, tileOf(c), { anim: 'celebrate', secs: 3, face: 0, after: () => { say(par, `There you are! Never run off like that again.`); c._lost = null; PS.lostChild = null; } }); say(par, `${c.first}! ${c.first}!`, 2.5); }, 45000); } },
      // the priest's blessing
      { name: 'bless', fit: (s) => { const pr = s.people.find((q) => /priest|friar|monk/.test(q.job?.role || '') && free(q) && near(q, 280)); const b = pr && freeNear(s, 300, (q) => q !== pr && q.age >= 6)[0]; return b ? { pr, b } : null; },
        run: (s, { pr, b }) => { hold([pr, b], 15); const t = tileOf(b); send(s, pr, [t[0] + 1, t[1]], { anim: 'pray', secs: 3, face: 1 }); send(s, b, t, { anim: 'bow', secs: 3, face: 2 }); setTimeout(() => say(pr, 'God keep you, and yours.'), 3000); setTimeout(() => say(b, 'Thank you, Father.'), 5500); s.relate(b, pr, 0.05); } },
      // a pedlar crying wares
      { name: 'pedlar', fit: (s) => { const p0 = freeNear(s, 300, (q) => q.age >= 25 && /merchant|pedlar|chapman|shopkeeper|farmer|dairymaid|beekeeper|fisher/.test(q.job?.role || ''))[0] || null; const buyer = freeNear(s, 300, (q) => q !== p0 && q.age >= 16)[0]; return p0 && buyer ? { p0, buyer } : null; },
        run: (s, { p0, buyer }) => { hold([p0, buyer], 20); say(p0, /farmer|dairymaid/.test(p0.job?.role || '') ? pick(['Fresh eggs! New butter!', 'Cheese, good cheese, from our own cows!']) : /fisher/.test(p0.job?.role || '') ? 'Fresh fish! Caught this morning!' : /beekeeper/.test(p0.job?.role || '') ? 'Honey! Wax for your candles!' : pick(['Ribbons! Needles! Laces for your stays!', 'Fine combs, fine pins, two a penny!', 'Who\'ll buy? Who\'ll buy?']), 3); const t = tileOf(p0);
          setTimeout(() => send(s, buyer, [t[0] + 1, t[1]], { anim: 'give', secs: 2, face: 1, after: () => { say(buyer, 'A needle, then. And not a bent one.'); O.gesture && O.gesture(p0, 'give', 1.2); const hb = s.household(buyer), hp = s.household(p0); if (hb && hp && hb.money > 1) { hb.money -= 1; hp.money += 1; } } }), 2500); } },
      // an old one tells the children a story
      { name: 'story', fit: (s) => { const old = freeNear(s, 300, (q) => q.age >= 58)[0]; const ks = old && freeNear(s, 320, (q) => q.age >= 4 && q.age <= 11).slice(0, 3); return old && ks && ks.length >= 2 ? { old, ks } : null; },
        run: (s, { old, ks }) => { hold([old, ...ks], 30); const t = tileOf(old); send(s, old, t, { anim: 'sit', secs: 22, face: 0 }); ks.forEach((k, i) => send(s, k, [t[0] - 1 + i, t[1] + 1], { anim: 'sit', secs: 20, face: 3 }));
          const tale = pick(['the winter the wolves came to the church door', 'the giant who built the old bridge', 'how your great-grandfather fought at the ford', 'the hare who outran the Devil', 'the night the mill wheel turned by itself']);
          setTimeout(() => say(old, `Sit down, sit down. Did I ever tell you about ${tale}?`, 3.5), 2500); setTimeout(() => say(ks[0], pick(['Tell it again!', 'Was it true?', 'Not the scary one!'])), 7000); setTimeout(() => say(old, 'And that, my chicks, is why you never go to the woods at night.', 3.5), 15000);
          ks.forEach((k) => s.relate(k, old, 0.06)); } },
      // a pig gets out
      { name: 'pig', fit: (s) => { const pig = (O.fauna || []).find((f) => f.kind === 'pig' && f.world === s.world.placeId && !f._loose && Math.hypot(f.x - game.player.x, f.y - game.player.y) < 400); const owner = pig && freeNear(s, 400, (q) => q.age >= 16 && /farm|swine|herd/.test(q.job?.role || ''))[0] || (pig && freeNear(s, 300, (q) => q.age >= 16)[0]); return pig && owner ? { pig, owner } : null; },
        run: (s, { pig, owner }) => { pig._loose = { owner: owner.id, until: game.t + 50 }; pig.speed = 34; hold([owner], 40); say(owner, 'The pig! Somebody stop that pig!', 3); PS.loosePig = { f: pig, owner: owner.id };
          let n = 0; const chase = () => { if (!pig._loose || n++ > 8) { if (pig._loose) { pig._loose = null; pig.speed = 12; say(owner, 'Got you, you devil.'); PS.loosePig = null; } return; } const t = [Math.floor(pig.x / T) + Math.floor(Math.random() * 7) - 3, Math.floor(pig.y / T) + Math.floor(Math.random() * 5) - 2]; pig.tx = t[0] * T + 8; pig.ty = t[1] * T + 8; send(s, owner, t, { anim: 'point', secs: 0.5, giveUp: 8 }); setTimeout(chase, 5000); }; chase(); } },
      // a cart stuck in the mud
      { name: 'cart', fit: (s) => { const c = freeNear(s, 320, (q) => q.age >= 18 && q.age < 60 && /carter|carrier|farmer|merchant|woodcutter/.test(q.job?.role || ''))[0]; return c && !PS.stuckCart ? { c } : null; },
        run: (s, { c }) => { hold([c], 60); const t = tileOf(c); send(s, c, t, { anim: 'shake', secs: 30, face: 2, carry: null }); PS.stuckCart = { q: c.id, x: c.agent.x + 14, y: c.agent.y, until: game.t + 60 }; say(c, 'Stuck fast. Will someone give me a shove? Put your shoulder to it!', 3.5);
          const helper = freeNear(s, 300, (q) => q !== c && q.age >= 16 && q.age < 55 && q.sex === 'm')[0]; if (helper) setTimeout(() => { if (!PS.stuckCart) return; send(s, helper, [t[0] + 1, t[1]], { anim: 'shake', secs: 5, face: 1, after: () => { if (!PS.stuckCart) return; PS.stuckCart = null; say(c, 'She moves! Thank you, friend.'); s.relate(c, helper, 0.1); } }); }, 25000); } },
      // making it up after a fight or a quarrel
      { name: 'makeup', fit: (s) => { for (const a of freeNear(s, 300, (q) => q.age >= 14)) { const m = (a.memories || []).slice(-30).find((x) => /beat me in a fight|quarrelled with|shamed me/.test(x.text || '') && x.about != null); const b = m && s.byId.get(m.about); if (b && free(b) && near(b, 340) && ((a.rel.get(b.id) || {}).affinity || 0) < 0) return { a, b }; } return null; },
        run: (s, { a, b }) => { hold([a, b], 20); const t = tileOf(b); send(s, a, [t[0] - 1, t[1]], { anim: 'talk', secs: 6, face: 2 }); setTimeout(() => say(a, pick([`${b.first}. I was wrong, the other day. I'm sorry for it.`, `Let's not be at odds, ${b.first}. Life's too short.`, 'Shake on it? No hard feelings.'])), 2500);
          setTimeout(() => { const ok = !b.traits.includes('hostile') || Math.random() < 0.3; say(b, ok ? pick(['Aye. Shake, then.', 'Forgotten. Come and have a drink.', 'I said worse. Peace.']) : 'Sorry? You will be.', 2.5); if (ok) { O.gesture && O.gesture(a, 'give', 1.2); O.gesture && O.gesture(b, 'take', 1.2); s.relate(a, b, 0.3); s.relate(b, a, 0.3); s.remember(a, `Made it up with ${b.name}.`, 'social', 1.5, b.id); s.remember(b, `Made it up with ${a.name}.`, 'social', 1.5, a.id); } else s.relate(b, a, -0.05); }, 5500); } },
      // a small gift between friends
      { name: 'gift', fit: (s) => { for (const a of freeNear(s, 300, (q) => q.age >= 10)) { const b = freeNear(s, 300, (q) => q !== a && ((a.rel.get(q.id) || {}).affinity || 0) > 0.4)[0]; const hh = s.household(a), g = hh && ['bread', 'cheese', 'eggs', 'honey', 'apples', 'flowers', 'cake'].find((k) => (hh.pantry[k] || 0) >= 1 && O.Data.GOODS[k]); if (b && g) return { a, b, g }; } return null; },
        run: (s, { a, b, g }) => { hold([a, b], 15); const t = tileOf(b); send(s, a, [t[0] - 1, t[1]], { anim: 'give', secs: 2, face: 2, after: () => { const ha = s.household(a), hb = s.household(b); if (ha && (ha.pantry[g] || 0) >= 1) { ha.pantry[g]--; if (hb) hb.pantry[g] = (hb.pantry[g] || 0) + 1; } O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(a, b, g); say(a, pick([`Here, I brought you some ${O.Data.GOODS[g].name.toLowerCase()}.`, 'For you. Don\'t say I never give you anything.', 'Mother sent this round.'])); setTimeout(() => say(b, pick(['You shouldn\'t have! Thank you.', 'Oh, bless you.', 'I\'ll return the dish.'])), 2000); s.relate(b, a, 0.08); } }); } },
      // a neighbour brings food to the sick
      { name: 'visit', fit: (s) => { const sick = s.people.find((q) => (q.health?.illness || q.activity?.act === 'sick') && q.home != null && q.alive !== false); if (!sick) return null; const b = s.building(sick.home); const n = b && freeNear(s, 360, (q) => q.household !== sick.household && q.age >= 16 && ((q.rel.get(sick.id) || {}).affinity || 0) > 0)[0]; return n && b.doorX != null ? { n, sick, b } : null; },
        run: (s, { n, sick, b }) => { hold([n], 20); send(s, n, [b.doorX, b.doorY + 1], { anim: 'give', secs: 3, face: 3, carry: { good: 'bread', qty: 1 }, after: () => { const hh = s.household(sick); if (hh) hh.pantry.bread = (hh.pantry.bread || 0) + 1; say(n, pick([`I heard ${sick.first} was poorly. I brought broth.`, 'How is the patient? Here, take this.', 'Send for me if you need anything.'])); s.relate(sick, n, 0.15); s.remember(sick, `${n.name} brought food when I was sick.`, 'social', 2, n.id); } }); } },
    ];

    // catching a loose pig, pushing a cart
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const P = game.player, s = cur(); if (!s || game.scene) return null;
      const L = PS.loosePig; if (L && L.f && L.f._loose && Math.hypot(L.f.x - P.x, L.f.y - P.y) < 26) return { type: 'custom', d: 2, x: L.f.x, y: L.f.y - 16, label: 'Grab the pig', act: () => { const f = L.f; f._loose = null; f.speed = 12; PS.loosePig = null; P.anim = 'crouch'; P.ft = 0; const o = s.byId.get(L.owner); O.sfx && O.sfx('catch', 0.6); if (O.animalCall) O.animalCall('pig', 0.7); if (o) { say(o, 'You caught him! Bless you. Here, for your trouble.'); s.relate(o, { id: 0 }, 0.2); const hh = s.household(o); if (hh && hh.money > 3) { hh.money -= 2; PS.money += 2; O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(o, 'player', 'coin'); } s.remember(o, 'The stranger caught my pig when it ran off.', 'social', 1.5); } } };
      const C = PS.stuckCart; if (C && Math.hypot(C.x - P.x, C.y - P.y) < 34) return { type: 'custom', d: 3, x: C.x, y: C.y - 30, label: 'Put your shoulder to the cart', act: () => { P.locked = true; P.anim = 'shake'; P.ft = 0; O.sfx && O.sfx('smack', 0.4); setTimeout(() => { P.locked = false; P.anim = 'idle'; const c = s.byId.get(C.q); PS.stuckCart = null; PS.energy = Math.max(0, PS.energy - 6); if (c) { O.Errands && O.Errands.finish && O.Errands.finish(c, true); say(c, 'She moves! You\'ve a good back on you. Here.'); s.relate(c, { id: 0 }, 0.15); const hh = s.household(c); if (hh && hh.money > 3) { hh.money -= 2; PS.money += 2; O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(c, 'player', 'coin'); } } }, 2500); } };
      return null;
    });
    game.hooks.update.push(() => { const C = PS.stuckCart; if (C && game.t > C.until) PS.stuckCart = null; const L = PS.loosePig; if (L && L.f && (!L.f._loose || game.t > L.f._loose.until)) { if (L.f._loose) { L.f._loose = null; L.f.speed = 12; } PS.loosePig = null; } });

    // somewhere near you, now and then
    let next = 12; const lastRun = {};
    game.hooks.update.push((dt) => {
      next -= dt; if (next > 0) return; next = 14 + Math.random() * 18;
      const s = cur(); if (!s || game.scene || (O.npcUI && O.npcUI.talking && O.npcUI.talking())) return;
      const h = s.minute / 60; if (h < 7 || h > 20) return;
      const now = performance.now();
      for (const sc of SCENES.slice().sort(() => Math.random() - 0.5)) {
        if (lastRun[sc.name] && now - lastRun[sc.name] < 120000) continue;
        if ((sc.name === 'tag' || sc.name === 'lost') && (h < 9 || h > 18)) continue;
        let ctx = null; try { ctx = sc.fit(s); } catch (e) { ctx = null; }
        if (!ctx) continue;
        lastRun[sc.name] = now; try { sc.run(s, ctx); } catch (e) { console.error(e); } break;
      }
    });
    // walking a lost child home
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      if (q && q._lost && typeof text === 'string' && /\b(take you home|find your (mam|mother|ma|da|father)|come with me|i'?ll help you|where do you live)\b/i.test(text)) {
        const s = cur(); q._lost = null; O.Errands.finish && O.Errands.finish(q, true); O.NpcActs && O.NpcActs.apply(s, q, { do: 'follow' }, q); q._walkHome = true;
        const line = 'S-sniff. Our house is that way. Will you hold my hand?'; (q._conv = q._conv || []).push({ who: 'p', t: text }, { who: 'q', t: line }); render(line); return Promise.resolve();
      }
      return _say.apply(this, arguments);
    };
    let lt = 0;
    game.hooks.update.push((dt) => {
      lt -= dt; if (lt > 0) return; lt = 1; const s = cur(), L = PS.lostChild; if (!s || !L) return; const c = s.byId.get(L.id); if (!c || !c._walkHome) return;
      const b = s.building(c.home); if (!b || b.doorX == null) return;
      if (Math.hypot(b.doorX * T + 8 - game.player.x, (b.doorY + 1) * T - game.player.y) < 50) {
        c._walkHome = false; PS.lostChild = null; O.NpcActs && O.NpcActs.apply(s, c, { do: 'stop' }, c);
        const par = kin(s, c)[0];
        if (par) { say(par, `${c.first}! Oh, thank God. Thank you, stranger, thank you.`, 3.5); s.relate(par, { id: 0 }, 0.35); s.remember(par, `The stranger brought ${c.first} home when they were lost.`, 'social', 3); const hh = s.household(par); if (hh && hh.money > 6) { hh.money -= 3; PS.money += 3; O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(par, 'player', 'coin'); } }
        s.relate(c, { id: 0 }, 0.3); PS.almsToPoor = (PS.almsToPoor || 0) + 1;
      }
    });
    O.Scenes = { SCENES, run: (name) => { const s = cur(), sc = SCENES.find((x) => x.name === name); const c = sc && sc.fit(s); if (c) { sc.run(s, c); return true; } return false; } };
  }
  O.ScenesSetup = { setup };
})();
