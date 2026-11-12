// Lessons on the doorstep. The old teach the young, out in the lane: an old soldier squaring two boys up
// with sticks ("Guard up! Step in, don't swing wild"), a grandmother with a spindle and two girls trying
// theirs, an old poacher crouched over a loop of wire showing how a snare sits, a clerk scratching letters
// in the dirt with a stick while the children copy. The children come away a little handier. Sit in on
// it, and so do you (they'll laugh at a grown pupil, then show you anyway).
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._lesson && !q.visitor && !talking(q);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const KINDS = {
      sticks: { skill: 'fighting', teach: (q) => q.sex === 'm' && /soldier|guard|sergeant|veteran|smith|labourer/.test(q.job?.role || '') || (q.sex === 'm' && q.age >= 55), kid: (k) => k.sex === 'm' && k.age >= 8, tAnim: ['point', 'talk', 'attack'], kAnim: ['attack', 'idle', 'attack', 'shake'], lines: ['Guard up! Up!', 'Step in, don\'t swing wild.', 'Again. Slower. Watch his shoulder, not his stick.', 'Good! That would have had him.'], what: 'how to hold a stick and keep your guard up', learnt: 'stick-fighting' },
      letters: { skill: 'letters', teach: (q) => /priest|clerk|scribe|notary|schoolmaster|friar|monk/.test(q.job?.role || '') || q.age >= 60, kid: (k) => k.age >= 6, tAnim: ['crouch', 'point', 'talk'], kAnim: ['crouch', 'crouch', 'look'], lines: ['A. Like a roof with a beam across.', 'Now your own name. Big letters.', 'That\'s a B, not a D. Look again.', 'Good. Tomorrow, the rest of it.'], what: 'your letters, scratched in the dirt', learnt: 'letters' },
      snares: { skill: 'stealth', teach: (q) => q.sex === 'm' && (/woodcutter|forester|poacher|charcoal|shepherd|swineherd/.test(q.job?.role || '') || q.age >= 55), kid: (k) => k.age >= 9, tAnim: ['crouch', 'crouch', 'point'], kAnim: ['crouch', 'look', 'crouch'], lines: ['Low, where the run goes under the hedge.', 'A hand high off the ground. No more.', 'And you never set one on the lord\'s side of the ditch. You hear?', 'Quiet, now. Rabbits have ears.'], what: 'how a snare sits on a rabbit run', learnt: 'snaring' },
      spinning: { skill: 'crafting', teach: (q) => q.sex === 'f' && q.age >= 45, kid: (k) => k.sex === 'f' && k.age >= 6, tAnim: ['spin', 'spin', 'talk'], kAnim: ['spin', 'spin', 'shake'], lines: ['Draw it out slow, and let the spindle drop.', 'Too thick! Pinch it finer.', 'There. That\'s thread. Your grandmother would be proud.', 'Keep it turning, keep it turning.'], what: 'spinning with a drop-spindle', learnt: 'spinning' },
    };
    let L = null, cool = 120, force = false, held = 0, sat = 0;
    const rel_ = (q) => { if (!q || !q._lesson) return; q._lesson = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } };
    function end() { if (!L) return; rel_(L.t); for (const k of L.kids) rel_(k); if (L.you) game.player.anim = 'idle'; L = null; }
    function begin(s, kindName) { const P = game.player;
      const kinds = kindName ? [kindName] : Object.keys(KINDS).sort(() => Math.random() - 0.5);
      for (const kn of kinds) { const K = KINDS[kn];
        const t = s.people.filter((q) => free(q) && q.age >= 35 && K.teach(q) && q.home != null && s.building(q.home)?.doorX != null && near(q.agent.x, q.agent.y, 380)).sort((a, b) => Math.hypot(a.agent.x - P.x, a.agent.y - P.y) - Math.hypot(b.agent.x - P.x, b.agent.y - P.y))[0]; if (!t) continue;
        const ks = s.people.filter((k) => free(k) && k.age >= 5 && k.age <= 14 && K.kid(k) && Math.hypot(k.agent.x - t.agent.x, k.agent.y - t.agent.y) < 400).slice(0, 2); if (!ks.length) continue;
        const h = s.building(t.home), x = (h.doorX) * T + 8, y = (h.doorY + 2) * T + 8; if (s.world.solid[(h.doorY + 2) * s.world.W + h.doorX]) continue;
        held++; L = { s, kn, K, t, kids: ks, x, y, k: 0, you: false, youT: 0, learnt: false, at: 0, scratches: [] };
        t._lesson = true; O.Errands.send(s, t, [h.doorX, h.doorY + 2], { anim: 'idle', secs: 0.2, face: 0, giveUp: game.t + 40, after: (ok) => { if (!L || L.t !== t) return; if (!ok) { end(); return; } t.agent.frozen = true; t.agent.path = null; L.at++; } });
        ks.forEach((kq, i) => { kq._lesson = true; O.Errands.send(s, kq, [h.doorX + (i ? 1 : -1), h.doorY + 3], { anim: 'idle', secs: 0.2, face: 3, giveUp: game.t + 40, after: (ok) => { if (!L || !L.kids.includes(kq)) return; if (!ok) { rel_(kq); L.kids.splice(L.kids.indexOf(kq), 1); return; } kq.agent.frozen = true; kq.agent.path = null; L.at++; } }); });
        return true; }
      return false; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      if (L) { const { t, kids, K } = L; if (L.s !== s || t.alive === false || talking(t) || L.k > 75 || (!L.started && L.k > 40)) { end(); return; } L.k += dt;
        if (!L.started) { if (t.agent.frozen && kids.some((k) => k.agent.frozen)) { L.started = true; L.k = 0; if (near(t.agent.x, t.agent.y, 320)) say(t, pick([`Right, you two. Today: ${K.what}.`, 'Gather round, and listen, for once.']), 2.4); } return; }
        const ph = Math.floor(L.k / 2.2); t.agent.forceAnim = K.tAnim[ph % K.tAnim.length]; t.agent.dir = 0;
        kids.forEach((kq, i) => { if (!kq.agent.frozen) return; kq.agent.forceAnim = K.kAnim[(ph + i) % K.kAnim.length]; kq.agent.dir = L.kn === 'sticks' ? (i ? 1 : 2) : 3; });
        if (L.kn === 'letters' && Math.random() < dt * 1.2) L.scratches.push([L.x - 14 + Math.random() * 28, L.y + 10 + Math.random() * 8, Math.random() < 0.5 ? 1 : 0]);
        if (L.kn === 'sticks' && Math.random() < dt * 0.8 && near(t.agent.x, t.agent.y, 260)) O.sfx && O.sfx('smack', 0.05);
        L.say = (L.say ?? 4) - dt; if (L.say <= 0) { L.say = 7 + Math.random() * 5; if (near(t.agent.x, t.agent.y, 300)) say(t, pick(K.lines), 2.4); else if (Math.random() < 0.3 && kids[0] && near(kids[0].agent.x, kids[0].agent.y, 300)) say(kids[0], pick(['Like this?', 'I did it! Look!', 'My arm hurts.', 'Again, again!']), 1.8); }
        if (L.you) { if (!near(L.x, L.y + 18, 46)) { L.you = false; game.player.anim = 'idle'; } else { const P = game.player; P.anim = L.kn === 'sticks' ? (Math.floor(L.k / 1.1) % 2 ? 'attack' : 'idle') : L.kn === 'spinning' ? 'spin' : 'crouch'; P.dir = 0; L.youT += dt;
          if (L.youT > 15 && !L.learnt) { L.learnt = true; sat++; PS.skills = PS.skills || {}; const k = K.skill; PS.skills[k] = Math.min(1, (PS.skills[k] || 0) + 0.04); const r = relOf(t); r.affinity = Math.min(1, r.affinity + 0.08); r.familiar = Math.min(1, (r.familiar || 0) + 0.12); try { s.remember(t, `The stranger sat in with the children while I taught them ${K.learnt}.`, 'social', 0.6); } catch (e) { /* */ } O.UI && O.UI.say && O.UI.say(`You come away knowing a little more of ${K.learnt}.`, 'good'); say(t, pick(['Not bad, for an old pupil.', 'You\'ll do. Practise.', 'Better than these two, and that\'s not saying much.']), 2.4); } } }
        if (L.k > 70) { for (const kq of kids) { kq.skills = kq.skills || {}; kq.skills[K.skill] = Math.min(1, (kq.skills[K.skill] || 0) + 0.02); try { s.relate(kq, t, 0.06); s.remember(kq, `Old ${t.first} taught us ${K.learnt} by the door.`, 'social', 0.6, t.id); } catch (e) { /* */ } } if (near(t.agent.x, t.agent.y, 300)) say(t, pick(['That\'s enough for today. Off with you.', 'Same time tomorrow, if your mothers can spare you.']), 2.2); end(); }
        return; }
      cool -= dt; if (cool > 0 && !force) return; cool = 200 + Math.random() * 200; const hr = s.minute / 60; if (!force && (hr < 9 || hr > 18 || Math.random() < 0.4)) return; force = false; begin(s); });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!L || !L.started || L.you || L.learnt || game.scene || P.locked || L.s !== cur()) return null; if (Math.hypot(L.x - P.x, L.y + 18 - P.y) > 44) return null;
      return { type: 'custom', d: 2, x: L.x, y: L.y - 34, label: `Sit in on ${L.t.first}'s lesson (${L.K.learnt})`, act: () => { L.you = true; L.youT = 0; say(L.t, pick(['Ha! A grown pupil. Sit, sit.', 'Come to learn, have you? Watch, then.', 'You too? Well, there\'s room.']), 2.2); if (L.kids[0]) setTimeout(() => L && L.kids[0] && say(L.kids[0], 'He\'s too old for lessons!'.replace('He\'s', 'They\'re'), 1.6), 1200); } }; });
    (O.extraLines = O.extraLines || []).push((s, q) => !L ? '' : q === L.t ? `You are out by your door teaching the children ${L.K.what}.` : L.kids.includes(q) ? `Old ${L.t.first} is teaching you ${L.K.what}, out by their door.` : '');
    game.hooks.drawWorld.push((ctx, cam) => { if (!L || game.scene || L.s !== cur()) return;
      if (L.kn === 'letters') { ctx.fillStyle = 'rgba(70,50,30,0.55)'; for (const [x, y, v] of L.scratches) { const sx = Math.round(x - cam.x), sy = Math.round(y - cam.y); if (v) ctx.fillRect(sx, sy, 3, 1); else ctx.fillRect(sx, sy, 1, 3); } }
      if (L.kn === 'snares' && L.started) { const sx = Math.round(L.x - cam.x), sy = Math.round(L.y + 12 - cam.y); ctx.fillStyle = '#c0c4c8'; ctx.fillRect(sx - 3, sy, 7, 1); ctx.fillRect(sx - 3, sy - 4, 1, 4); ctx.fillRect(sx + 3, sy - 4, 1, 4); ctx.fillRect(sx - 2, sy - 5, 5, 1); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(sx + 5, sy - 6, 1, 7); }
      if (L.kn === 'sticks' && L.started) { ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1; for (const kq of L.kids) { if (!kq.agent.frozen) continue; const a = kq.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y) - 14, sw = Math.sin(L.k * 6 + kq.id) * 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (a.dir === 2 ? 1 : -1) * (6 + sw), y - 8); ctx.stroke(); } } });
    O.Lessons = { get lesson() { return L; }, get held() { return held; }, get sat() { return sat; }, soon: () => { cool = 0; force = true; }, begin: (k) => begin(cur(), k) };
  }
  O.LessonsSetup = { setup };
})();
