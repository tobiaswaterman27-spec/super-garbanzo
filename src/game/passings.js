// Meeting in the street. When two people pass, what's between them shows: friends wave and call a
// greeting, or stop for a word and a laugh before going on; lovers linger; common folk bob a bow or a
// curtsy to their betters, who nod back; folk cross themselves as the priest goes by and he blesses
// them; enemies stop and glare, and the hot-headed shoulder each other; a running child barges into
// someone and is told off. And those who know and like you wave and call your name as you pass.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t) => O.Speech && O.Speech.say(q, t, 1.6);
    const walking = (q) => q.agent && !q.agent.hidden && q.agent.inside == null && q.agent.path && !q.agent.frozen && !q.errand?.working && !q._scene && !q._playing && !q._fighting && !q._bit && !q._cp && !q._war && !q._mark && !q._front && !q._shake && q.alive !== false && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    const rel = (a, b) => (a.rel && a.rel.get && a.rel.get(b.id)) || {};
    const gentle = (q) => !!(q.gentry || q.title || /lord|lady|knight|reeve|steward|bailiff|magistrate/.test(q.job?.role || ''));
    const priest = (q) => /priest|friar|chaplain|monk|nun/.test(q.job?.role || '');
    const stops = []; const cool = new Map();
    const hello = (h) => h < 11 ? 'Morning' : h < 17 ? 'Good day' : 'Evening';
    function stop(q, secs, anim, face) { q.agent.frozen = true; q._pass = true; q.agent.forceAnim = anim; if (face) q.agent.dir = O.dirOf(face.agent.x - q.agent.x, face.agent.y - q.agent.y); stops.push({ q, t: secs, seq: null }); return stops[stops.length - 1]; }
    function meet(s, a, b) {
      const ra = rel(a, b), rb = rel(b, a), aff = ((ra.affinity || 0) + (rb.affinity || 0)) / 2, fam = Math.max(ra.familiar || 0, rb.familiar || 0), h = s.minute / 60;
      const lovers = a.spouse === b.id || a.betrothed === b.id || (a.courting && a.courting === b.id);
      if (a.age < 13 && b.age >= 16 && a.agent.sprint !== false && Math.random() < 0.25 && a.activity?.act === 'play') { stop(a, 1.2, 'hurt', b); stop(b, 1.6, 'shake', a); say(b, pick(['Watch where you\'re going!', 'Oi! Mind me!', 'Slow down, you little imp.'])); return true; }
      const watch = (q) => /guard|watch|sergeant|constable/.test(q.job?.role || ''), late = h >= 21 || h < 5;
      if (watch(a) && !watch(b) && b.age >= 14 && (b.gang || (late && Math.random() < 0.4))) { stop(a, 3.2, 'point', b); const st = stop(b, 3.2, 'shrug', a); st.seq = [[1.2, b, 'talk'], [2.4, a, 'gesture']]; say(a, b.gang ? pick([`You. ${b.first}. Where are you off to?`, 'Turn out your pockets.', 'I\'ve got my eye on you, cap or no cap.']) : pick(['Late to be abroad. Your business?', 'Who goes there?', 'Home, is it? Go on, then.'])); setTimeout(() => say(b, b.gang ? pick(['Nowhere, sergeant.', 'Just walking.', 'Got nothing on me.']) : pick(['Home, sir. Just home.', 'Fetching the midwife, sir!', 'Only me, sir.'])), 1200); return true; }
      if (watch(b) && !watch(a)) return meet(s, b, a);
      if (priest(b) && !priest(a) && a.age >= 8) { stop(a, 1.4, 'pray', b); stop(b, 1.4, 'gesture', a); if (Math.random() < 0.4) say(b, 'Bless you, child.'); return true; }
      if (priest(a) && !priest(b) && b.age >= 8) return meet(s, b, a);
      if (gentle(b) && !gentle(a) && a.age >= 12) { stop(a, 1.3, a.sex === 'f' ? 'curtsy' : 'bow', b); stop(b, 1, 'nod', a); if (Math.random() < 0.3) say(a, b.sex === 'f' ? 'My lady.' : 'Sir.'); return true; }
      if (gentle(a) && !gentle(b)) return meet(s, b, a);
      if (aff < -0.4 && fam > 0.2) { const hot = [a, b].some((q) => (q.traits || []).some((t) => /hostile|hot|quarrel|proud/.test(t))); stop(a, 2.2, 'look', b); stop(b, 2.2, 'look', a);
        if (hot && Math.random() < 0.5) { setTimeout(() => { O.gesture && O.gesture(a, 'attack', 0.4); O.gesture && O.gesture(b, 'hurt', 0.6); O.sfx && Math.hypot(a.agent.x - game.player.x, a.agent.y - game.player.y) < 220 && O.sfx('smack', 0.2); say(b, pick(['Shove me again. Go on.', 'You want to try that?', 'Hands off.'])); }, 700); } else if (Math.random() < 0.5) say(a, pick([`${b.first}.`, 'Hmph.', 'Look who it is.'])); return true; }
      if (lovers && a.age >= 15) { stop(a, 3.5, 'talk', b); stop(b, 3.5, 'laugh', a); if (Math.random() < 0.5) say(a, pick(['There you are.', `${b.first}! I was hoping I'd see you.`])); return true; }
      if (aff > 0.25 && fam > 0.3 && Math.random() < 0.35 && a.age >= 13 && b.age >= 13) { const st = stop(a, 4, 'talk', b); stop(b, 4, 'nod', a); st.seq = [[1.4, a, 'laugh'], [1.5, b, 'talk'], [2.8, a, 'nod']]; say(a, pick([`${b.first}! How's the family?`, `${hello(h)}, ${b.first}. Heard about the miller?`, `${b.first}! Haven't seen you in an age.`])); return true; }
      if (fam > 0.15 && aff > -0.1) { O.gesture && O.gesture(a, 'wave', 1); setTimeout(() => O.gesture && O.gesture(b, Math.random() < 0.5 ? 'wave' : 'nod', 1), 300); if (Math.random() < 0.25) say(a, `${hello(h)}, ${b.first}.`); return true; }
      if (a.age >= 16 && b.age >= 16 && Math.random() < 0.3) { O.gesture && O.gesture(a, 'nod', 0.7); setTimeout(() => O.gesture && O.gesture(b, 'nod', 0.7), 250); return true; } // (strangers: a nod)
      return false;
    }
    let scan = 0, pc = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      for (const st of stops.slice()) { st.t -= dt; if (st.seq) for (const sq of st.seq) if (!sq.done && (4 - st.t) > sq[0]) { sq.done = true; sq[1].agent.forceAnim = sq[2]; }
        if (st.t <= 0 || st.q.alive === false || game.scene) { const q = st.q; q._pass = false; q.agent.forceAnim = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; stops.splice(stops.indexOf(st), 1); } }
      scan -= dt; if (scan > 0 || game.scene) return; scan = 0.3;
      const now = performance.now(); const P = game.player;
      const ws = s.people.filter((q) => walking(q) && !q._pass && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 380 && (cool.get(q.id) || 0) < now);
      for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) { const a = ws[i], b = ws[j]; if (a._pass || b._pass) continue; const d = Math.hypot(a.agent.x - b.agent.x, a.agent.y - b.agent.y); if (d > 20 || d < 3) continue;
        const k = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id; if ((cool.get(k) || 0) > now) continue; cool.set(k, now + 120000); cool.set(a.id, now + 20000); cool.set(b.id, now + 20000);
        try { meet(s, a, b); } catch (e) { console.error(e); } }
      // passing you
      pc -= 0.3; if (pc > 0 || !PS) return;
      for (const q of ws) { if (q._pass) continue; const d = Math.hypot(q.agent.x - P.x, q.agent.y - P.y); if (d > 26) continue; const r = rel(q, { id: 0 }); if ((r.familiar || 0) < 0.25) continue; if ((cool.get('p' + q.id) || 0) > now) continue; cool.set('p' + q.id, now + 90000); pc = 4;
        const nm = (O.Forge && O.Forge.player && O.Forge.player.name || '').split(' ')[0];
        if ((r.affinity || 0) > 0.35) { O.gesture && O.gesture(q, 'wave', 1.2); say(q, pick([`${hello(s.minute / 60)}${nm ? ', ' + nm : ''}!`, nm ? `${nm}! All well?` : 'All well, friend?', 'There\'s a face I know!'])); }
        else if ((r.affinity || 0) < -0.35) { O.gesture && O.gesture(q, 'look', 1.2); if (Math.random() < 0.4) say(q, pick(['Hmph.', 'You.'])); }
        else O.gesture && O.gesture(q, 'nod', 0.8);
        break; }
      if (cool.size > 3000) cool.clear();
    });
    O.Passings = { stops, meet: (a, b) => meet(cur(), a, b) };
  }
  O.PassingsSetup = { setup };
})();
