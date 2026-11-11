// A bad name, felt. When you're known for a thief or worse (or someone has good reason to hate you), the
// street lets you know it: folk step out of your way and turn their backs, a woman catches her child by the
// arm and pulls it in close, an old man crosses himself, someone mutters "That's the one" behind a hand,
// and a bold one spits in the dust as you pass. Once a day each.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const done = new Map(); let acc = 0, shunned = 0, pulled = 0;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const notorious = () => (PS.rep && (PS.rep.criminal > 0.4 || PS.rep.civilian < -0.35)) || (PS.wantedLevel && PS.wantedLevel() >= 1) || !!PS.outlaw;
    game.hooks.update.push((dt) => { acc += dt; if (acc < 0.6) return; acc = 0; const s = cur(); if (!s || !s.people || game.scene || (O.crowned && O.crowned())) return; const P = game.player, bad = notorious();
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || q.errand || q.gang || talking(q) || q.age < 14 || /guard|watch|sergeant/.test(q.job?.role || '')) continue; if (Math.hypot(a.x - P.x, a.y - P.y) > 46 || done.get(q.id) === s.day) continue;
        const hate = (q.rel.get(0)?.affinity || 0) < -0.45; if (!bad && !hate) continue; done.set(q.id, s.day); shunned++;
        // a child near them is pulled in close
        const kid = s.people.find((k) => k.age < 10 && k.home === q.home && k.agent && !k.agent.hidden && !k.agent.frozen && !k.errand && Math.hypot(k.agent.x - P.x, k.agent.y - P.y) < 70);
        if (kid) { pulled++; O.Errands.send(s, kid, [Math.floor(a.x / T), Math.floor(a.y / T) + 1], { anim: 'idle', secs: 3, face: 0, sprint: true, giveUp: game.t + 10 }); O.Speech && O.Speech.say(q, pick([`${kid.first}! Here. Now.`, 'Come away from there, child.', 'Don\'t look at them. Come here.']), 2.2); }
        else O.Speech && O.Speech.say(q, hate ? pick(['You. I\'ve not forgotten.', 'Keep walking.', 'Get out of my sight.']) : pick(['That\'s the one...', 'God keep us. Look who it is.', 'Hide your purse.', 'Thief.']), 2.2);
        O.gesture && O.gesture(q, pick(hate ? ['shake', 'point'] : ['pray', 'shake', 'look']), 1.6);
        // and steps away from you
        const dx = a.x - P.x, dy = a.y - P.y, d = Math.hypot(dx, dy) || 1; O.Errands.send(s, q, [Math.floor((a.x + dx / d * 50) / T), Math.floor((a.y + dy / d * 40) / T)], { anim: 'look', secs: 2, face: 0, giveUp: game.t + 10 });
        break; } });
    O.Shunning = { get shunned() { return shunned; }, get pulled() { return pulled; } };
  }
  O.ShunningSetup = { setup };
})();
