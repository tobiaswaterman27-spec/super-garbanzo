// Life indoors, while you're in the room.
// - The tavern of an evening: two at a table arm-wrestle while the others bang the boards; someone stands
//   for a toast and the room drinks it; the room takes up a song everyone knows; a man who's had too
//   much sways, hiccups and nods off; a spilt cup nearly comes to blows until the innkeeper says not in
//   her house. Ask anyone sitting to arm-wrestle you, for a stake if you like.
// - At home: the family at table together, grace said; children squabbling and a parent sorting it out;
//   prayers before bed; someone mending by the fire.
// - At work: the master looks over a hand's work and says what they think of it; the hands joke and
//   grumble when the master's back is turned.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 3);
    const gest = (q, anim, secs) => O.gesture && O.gesture(q, anim, secs || 2);
    const here = () => { const sc = game.scene; if (!sc) return []; return [...sc.actors.values()].filter((a) => a.person && !a.hidden && !a.inBed && a.person.activity?.act !== 'sleep' && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === a.person)); };
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const closePair = (list, r, f) => { for (const a of list) for (const b of list) if (a !== b && dist(a, b) < r && (!f || f(a.person, b.person))) return [a, b]; return null; };

    const TAVERN = [
      { name: 'arm', fit: (L) => closePair(L.filter((a) => a.seat && a.person.age >= 16 && a.person.age < 60), 40, (p, q) => p.sex === 'm' || q.sex === 'm'),
        run: (s, [A, B]) => { const a = A.person, b = B.person; say(a, `Come on then, ${b.first}. Elbows on the board.`); let k = 0;
          const iv = setInterval(() => { k++; gest(a, 'shake', 1.1); gest(b, 'shake', 1.1); if (k === 2) for (const o of here()) if (o !== A && o !== B && dist(o, A) < 90) { gest(o.person, 'celebrate', 1.5); if (Math.random() < 0.4) say(o.person, pick(['Push! Push!', `Go on, ${a.first}!`, `${b.first}, don't shame us!`]), 1.5); }
            if (k >= 4) { clearInterval(iv); const win = (a.traits.includes('brave') ? 0.6 : 0.5) > Math.random() ? a : b, lose = win === a ? b : a; gest(win, 'celebrate', 2); gest(lose, 'shrug', 2); say(win, pick(['Ha! Another!', 'Pay up.', 'Like a babe in arms.'])); s.relate(win, lose, 0.03); s.remember(lose, `Lost at arm-wrestling to ${win.first} in the tavern.`, 'social', 0.6, win.id); } }, 1300); } },
      { name: 'toast', fit: (L) => { const t = L.filter((a) => a.person.age >= 16); return t.length >= 3 ? t : null; },
        run: (s, L) => { const a = pick(L).person, k = s.kingdom, crown = k && k.rulers && k.rulers.crown; const to = pick([`To ${crown && crown.name ? crown.name : 'the King'}!`, 'To the harvest!', `To ${s.world.name}!`, 'To absent friends!', 'Confusion to the tax collector!']);
          gest(a, 'celebrate', 2); say(a, to, 2.5); setTimeout(() => { for (const o of L) if (o.person !== a) { gest(o.person, 'drink', 2.5); } const o = pick(L.filter((x) => x.person !== a)); if (o) { const e = to.replace(/^To /, ''); say(o.person, e.charAt(0).toUpperCase() + e.slice(1), 1.6); } }, 1500); for (const o of L) s.relate(o.person, a, 0.01); } },
      { name: 'song', fit: (L) => (L.length >= 3 && O.Music && O.songBook && O.songBook().length ? L : null),
        run: (s, L) => { const book = O.songBook(), song = pick(book), lead = pick(L).person; const chorus = L.filter((a) => a.person !== lead).slice(0, 3).map((a) => a.person);
          for (const c of chorus) gest(c, 'dance', 6); try { O.Music.sing(lead, song, chorus); } catch (e) { say(lead, '♪ ' + song.lines[0] + ' ♪', 4); } } },
      { name: 'drunk', fit: (L) => { const d = L.find((a) => a.person.sex === 'm' && a.person.age >= 20 && (a.person.traits.includes('social') || Math.random() < 0.3)); return d ? [d] : null; },
        run: (s, [D]) => { const q = D.person; gest(q, 'hurt', 1.5); say(q, pick(['*hic* One more. Jus\' one more.', 'I love you all. Every one of you.', 'Who moved the floor?', '*hic*']), 2.5); setTimeout(() => { gest(q, 'doze', 8); say(q, 'Zzz...', 2); }, 6000); } },
      { name: 'spill', fit: (L) => closePair(L.filter((a) => a.person.age >= 18), 45, (p, q) => p.sex === 'm' && q.sex === 'm'),
        run: (s, [A, B]) => { const a = A.person, b = B.person; say(a, 'You spilt my ale, you oaf!'); gest(a, 'shake', 1.5); setTimeout(() => { say(b, pick(['Then buy another!', 'Watch your mouth.', 'It was half water anyway.'])); gest(b, 'point', 1.2); }, 1500);
          setTimeout(() => { const ik = here().find((x) => /innkeeper|server/.test(x.person.job?.role || '')); if (ik) { say(ik.person, 'Not in my house! Sit down, both of you, or out you go.', 3); gest(ik.person, 'point', 2); } s.relate(a, b, -0.08); s.relate(b, a, -0.08); }, 3200); } },
    ];
    const HOME = [
      { name: 'grace', fit: (L, s) => (L.length >= 2 && s.minute / 60 >= 11.5 && s.minute / 60 < 13.5 || s.minute / 60 >= 18 && s.minute / 60 < 19.5 ? (L.length >= 2 ? L : null) : null),
        run: (s, L) => { const elder = L.slice().sort((a, b) => b.person.age - a.person.age)[0].person; say(elder, pick(['Bless us, O Lord, and these thy gifts.', 'For what we are about to receive.', 'God be thanked for bread.']), 3); for (const a of L) gest(a.person, 'pray', 2.5); setTimeout(() => { for (const a of L) gest(a.person, 'eat', 6); const c = L.find((a) => a.person.age < 12); if (c) say(c.person, pick(['Pottage again?', 'Can I have the crust?', 'He took the bigger piece!']), 2); }, 2800); } },
      { name: 'squabble', fit: (L) => { const kids = L.filter((a) => a.person.age >= 4 && a.person.age < 13); const par = L.find((a) => a.person.age >= 20); return kids.length >= 2 && par ? { kids, par } : null; },
        run: (s, { kids, par }) => { say(kids[0].person, pick(['That\'s mine!', 'He hit me!', 'You\'re not my friend any more.']), 2); gest(kids[0].person, 'shake', 1.2); setTimeout(() => { say(kids[1].person, pick(['Did not!', 'Was mine first!', 'Liar!']), 1.6); gest(kids[1].person, 'point', 1.2); }, 1300);
          setTimeout(() => { say(par.person, pick(['Enough! Both of you. Share it, or neither has it.', 'Do you want a smacked leg? No? Then hush.', 'Out to the yard, the pair of you.']), 3); gest(par.person, 'point', 2); }, 3000); } },
      { name: 'prayers', fit: (L, s) => (s.minute / 60 >= 20.5 && L.length >= 2 ? L : null), run: (s, L) => { for (const a of L) gest(a.person, 'pray', 5); say(L[0].person, 'Matthew, Mark, Luke and John, bless the bed that I lie on.', 4); } },
      { name: 'mend', fit: (L) => { const m = L.find((a) => a.person.age >= 14 && !a.seat === false); return m ? [m] : (L[0] ? [L[0]] : null); }, run: (s, [A]) => { gest(A.person, 'work', 8); if (Math.random() < 0.5) say(A.person, pick(['This hose won\'t last another winter.', 'Where did I put the needle?', 'There. Good as new. Nearly.']), 2.5); } },
    ];
    const WORK = [
      { name: 'inspect', fit: (L, s, bz) => { const boss = bz && s.bossOf && s.bossOf(bz); const ba = boss && L.find((a) => a.person === boss); const hand = ba && L.find((a) => a.person !== boss && a.person.job?.biz === bz.id); return ba && hand ? { ba, hand } : null; },
        run: (s, { ba, hand }) => { const b = ba.person, h = hand.person, sk = (h.skills && h.skills[h.job.role]) || 0.3; gest(b, 'look', 2.5); setTimeout(() => { gest(b, sk > 0.5 ? 'nod' : 'shake', 1.5); say(b, sk > 0.5 ? pick(['Good. Neat work.', 'That\'ll do nicely.', 'You\'re coming on.']) : pick(['Again. And properly this time.', 'Is that what I pay you for?', 'Slower. Do it right, not quick.']), 2.5); s.relate(h, b, sk > 0.5 ? 0.03 : -0.04); }, 2500); } },
      { name: 'banter', fit: (L, s, bz) => { const boss = bz && s.bossOf && s.bossOf(bz); return closePair(L.filter((a) => a.person !== boss && a.person.job?.biz === bz?.id), 120); },
        run: (s, [A, B]) => { say(A.person, pick(['Is it dinner yet?', 'My back\'s broke.', 'Did you see the miller\'s daughter at Mass?', 'He\'s in a mood today.']), 2.5); setTimeout(() => { say(B.person, pick(['Not till the bell.', 'Mine too. Keep at it.', 'Every man in the parish did.', 'Head down, or we\'ll catch it.']), 2.5); gest(B.person, 'laugh', 1.2); }, 2000); s.relate(A.person, B.person, 0.02); } },
    ];
    let next = 8, last = {};
    game.hooks.update.push((dt) => {
      next -= dt; if (next > 0) return; next = 16 + Math.random() * 16;
      const sc = game.scene, s = cur(); if (!sc || !s || (O.npcUI && O.npcUI.talking && O.npcUI.talking())) return;
      const L = here(); if (!L.length) return;
      const b = sc.b, bz = s.biz.get(b.id), h = s.minute / 60;
      const pool = b.type === 'tavern' && (h >= 17 || h < 1) ? TAVERN : ['house', 'cottage', 'townhouse', 'farmhouse'].includes(b.type) ? HOME : bz && bz.def.hours && h >= bz.def.hours[0] && h < bz.def.hours[1] ? WORK : null;
      if (!pool) return; const now = performance.now();
      for (const sn of pool.slice().sort(() => Math.random() - 0.5)) { if (last[sn.name] && now - last[sn.name] < 90000) continue; let c = null; try { c = sn.fit(L, s, bz); } catch (e) { c = null; } if (!c) continue; last[sn.name] = now; try { sn.run(s, c, bz); } catch (e) { console.error(e); } break; }
    });
    // arm-wrestle the player, by asking
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      if (q && typeof text === 'string' && game.scene && /\b(arm[- ]?wrestle|wrestle (you|me)|test (your|my) arm|elbows on the (board|table))\b/i.test(text) && O.AI && O.AI.ready && q.age >= 14) {
        const s = cur(), stake = Math.max(0, Math.min(20, +((text.match(/\d+/) || [0])[0]))); if (stake && PS.money < stake) { const l = "You can't stake what you haven't got."; render(l); return Promise.resolve(); }
        const mine = 0.35 + (PS.skills.fighting || 0) * 0.4 + PS.energy / 400, theirs = 0.35 + (/smith|butcher|woodcutter|quarry|miner|labourer|guard/.test(q.job?.role || '') ? 0.25 : 0) + (q.sex === 'm' ? 0.1 : 0) + (q.age > 55 ? -0.15 : 0);
        const win = mine * Math.random() > theirs * Math.random() * 0.95;
        const P = game.player, now = performance.now(); P.gest = { anim: 'shake', from: now, until: now + 3500 }; gest(q, 'shake', 3.5);
        const l = win ? `Agh! You've an arm on you. ${stake ? `₳${stake}, curse you.` : 'Again some time.'}` : `Ha! Down you go. ${stake ? `₳${stake} to me.` : 'Better luck next time.'}`;
        setTimeout(() => { if (stake) { const hh = s.household(q); if (win) { PS.money += stake; if (hh) hh.money -= stake; } else { PS.money -= stake; if (hh) hh.money += stake; } } PS.skills.fighting = Math.min(1, (PS.skills.fighting || 0) + 0.01); PS.energy = Math.max(0, PS.energy - 4); s.relate(q, { id: 0 }, 0.05); gest(q, win ? 'shrug' : 'celebrate', 2); }, 3500);
        (q._conv = q._conv || []).push({ who: 'p', t: text }); setTimeout(() => { q._conv.push({ who: 'q', t: l }); render(l); }, 3600); return Promise.resolve();
      }
      return _say.apply(this, arguments);
    };
    O.IndoorLife = { run: (kind, name) => { const s = cur(), L = here(), bz = game.scene && s.biz.get(game.scene.b.id); const pool = { tavern: TAVERN, home: HOME, work: WORK }[kind]; const sn = pool && pool.find((x) => x.name === name); const c = sn && sn.fit(L, s, bz); if (c) { sn.run(s, c, bz); return true; } return false; } };
  }
  O.IndoorLifeSetup = { setup };
})();
