// A good name, felt. The other side of the shunning: once you're known as honest, open-handed or godly, the
// street shows it. Men nod and touch their caps as you pass, a woman calls a blessing from her doorstep,
// children run up to walk a few steps beside you, and now and then a goodwife presses an apple or the heel
// of a loaf into your hand. Good deeds are how a bad name mends, and you can watch it mend: the same people
// who turned their backs start, one by one, to nod. And it isn't only you: a townsman just out of the
// lock-up gets the same cold shoulders from his neighbours that you would, until it wears off.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState, G = O.Data && O.Data.GOODS || {};
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const done = new Map(); let acc = 0, nodded = 0, gifts = 0, walked = 0, npcShun = 0, giftDay = -1, nAcc = 0;
    const notorious = () => (PS.rep && (PS.rep.criminal > 0.4 || PS.rep.civilian < -0.35)) || (PS.wantedLevel && PS.wantedLevel() >= 1) || !!PS.outlaw;
    function why() { if (!O.standing || notorious()) return null; const st = O.standing(); if (st.honest < -0.2) return null;
      const w = []; if (st.honest > 0.4) w.push('honest'); if (st.generous > 0.3) w.push('generous'); if (st.godly > 0.4) w.push('godly'); return w.length ? w : null; }
    const free = (q) => q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q.gang && !talking(q) && !q._coup && !q.jailUntil;
    game.hooks.update.push((dt) => { acc += dt; if (acc < 0.7) return; acc = 0; const s = cur(); if (!s || !s.people || game.scene || (O.crowned && O.crowned())) return; const P = game.player, w = why(); if (!w) return;
      for (const q of s.people) { const a = q.agent; if (!a || !free(q) || q.age < 5) continue; const d = Math.hypot(a.x - P.x, a.y - P.y); if (d > 50 || done.get(q.id) === s.day) continue; if ((q.rel.get(0)?.affinity || 0) < -0.3) continue; done.set(q.id, s.day); nodded++;
        if (q.age < 12) { // a child falls in beside you for a few steps
          walked++; O.gesture && O.gesture(q, 'point', 1); say(q, pick(['Where are you going? Can I come?', 'My mam says you\'re kind.', 'Hello! Hello!']), 2);
          O.Errands.send(s, q, [Math.floor((P.x + 14) / T), Math.floor((P.y + 4) / T)], { anim: 'idle', secs: 1.2, face: 0, sprint: true, giveUp: game.t + 8 }); break; }
        O.gesture && O.gesture(q, pick(['nod', 'nod', 'pray']), 1.2);
        const t = w.includes('godly') && Math.random() < 0.4 ? pick(['God keep you.', 'Bless you, friend.', 'Saw you at Mass. God be with you.']) : w.includes('generous') && Math.random() < 0.5 ? pick(['There goes a kind soul.', 'Good day to you, and thank you.', 'You\'ve a big heart, they say.']) : pick(['Good day to you.', 'Morning.', 'Fair weather to you.', 'Well met.']);
        say(q, t, 2);
        // a gift, now and then, from a house that can spare it
        const hh = s.household(q); if (w.includes('generous') || w.includes('honest')) if (giftDay !== s.day && q.age >= 18 && hh && (hh.money || 0) > 30 && Math.random() < 0.12) { const g = ['apples', 'bread', 'eggs', 'cheese', 'honey'].filter((k) => G[k] && (!hh.pantry || (hh.pantry[k] || 0) >= 1 || k === 'apples'))[0] || 'bread';
          if (PS.canCarry ? PS.canCarry(g) : true) { giftDay = s.day; gifts++; if (hh.pantry && hh.pantry[g]) hh.pantry[g] = Math.max(0, hh.pantry[g] - 1); setTimeout(() => { O.gesture && O.gesture(q, 'give', 1); O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(q, 'player', g); PS.add ? PS.add(g) : PS.items.push(g); say(q, pick(['Here, take this. No, I insist.', 'For you. You\'ve done right by folk here.', 'Go on, it\'s only a little thing.']), 2.4); O.UI && O.UI.say && O.UI.say(`${q.first} presses ${(G[g] && G[g].name || g).toLowerCase()} into your hand.`, 'good'); }, 1300); } }
        break; } });
    // a townsman with a bad name gets the cold shoulder too: fresh out of the lock-up, or caught at it
    const bad = (s, q) => (q._gaolbird != null && s.day - q._gaolbird <= 10);
    game.hooks.update.push((dt) => { nAcc += dt; if (nAcc < 2) return; nAcc = 0; const s = cur(); if (!s || !s.people || game.scene) return; const P = game.player;
      for (const q of s.people) if (q.jailUntil && q._gaolbird !== s.day) q._gaolbird = s.day; // marked while inside
      for (const z of s.people) { if (!bad(s, z) || z.jailUntil || !z.agent || z.agent.hidden || z.agent.inside != null || Math.hypot(z.agent.x - P.x, z.agent.y - P.y) > 320) continue;
        const q = s.people.find((y) => y !== z && y.age >= 14 && free(y) && y.home !== z.home && Math.hypot(y.agent.x - z.agent.x, y.agent.y - z.agent.y) < 40 && done.get('n' + y.id + ':' + z.id) !== s.day); if (!q) continue; done.set('n' + q.id + ':' + z.id, s.day); npcShun++;
        O.gesture && O.gesture(q, pick(['shake', 'look', 'point']), 1.4); say(q, pick([`Look who's out. Lock your doors.`, `${z.first}. Thought they'd keep you longer.`, 'Gaolbird.', `Don't you come near my stall, ${z.first}.`]), 2.2);
        const dx = q.agent.x - z.agent.x, dy = q.agent.y - z.agent.y, d = Math.hypot(dx, dy) || 1; O.Errands.send(s, q, [Math.floor((q.agent.x + dx / d * 46) / T), Math.floor((q.agent.y + dy / d * 36) / T)], { anim: 'look', secs: 1.6, face: 0, giveUp: game.t + 10 });
        setTimeout(() => { if (z.agent && !z.errand) { O.gesture && O.gesture(z, 'shake', 1); say(z, pick(['I\'ve paid for it.', 'Say that to my face.', '...']), 1.8); } }, 1600); break; } });
    (O.extraLines = O.extraLines || []).push((s, q) => q._gaolbird != null && !q.jailUntil && s.day - q._gaolbird <= 10 ? 'You are just out of the lock-up, and your neighbours have not forgotten it: some cross the street to avoid you.' : '');
    O.GoodName = { why, get nodded() { return nodded; }, get gifts() { return gifts; }, get walked() { return walked; }, get npcShun() { return npcShun; } };
  }
  O.GoodNameSetup = { setup };
})();
