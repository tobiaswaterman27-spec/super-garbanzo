// A knock at your own door. When you're at home in a house of your own, now and then someone you once did
// a kindness comes calling: they knock, come in with a basket over their arm, look round the place, thank
// you properly this time, leave you something (a loaf, a cheese, a jug, a bunch of herbs) and go. Not often;
// and the same face not more than once in a few days.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState, G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let V = null, cool = 90, visits = 0; const lastBy = new Map();
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const helped = (q) => (q.memories || []).find((m) => m.kind === 'kindness' && /stranger/i.test(m.text || ''));
    function leave() { if (!V) return; const q = V.q, b = V.b, a = q.agent; q._visit = false; a.forceAnim = null; if (!talking(q)) a.frozen = false; a.inside = null; a.hidden = false; if (b.doorX != null) { a.x = b.doorX * T + 8; a.y = (b.doorY + 1) * T + 8; } a.path = null; q.activity = null; V = null; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s) return; const sc = game.scene;
      if (V) { V.t += dt; if (!sc || sc.b !== V.b || V.t > 20 || V.q.alive === false) { leave(); return; } const q = V.q;
        if (V.t > 2.5 && !V.s1) { V.s1 = true; const m = helped(q); O.Speech && O.Speech.say(q, pick([`I hope you don't mind me calling. I never thanked you properly, for ${/child|little one/.test(m?.text || '') ? 'my little one' : /fire|chimney/.test(m?.text || '') ? 'the fire' : /bread|loaf/.test(m?.text || '') ? 'the bread' : 'what you did'}.`, 'Is this your place? It\'s snug. I brought you a little something.', 'I was passing, and I thought, I\'ll look in on them.']), 4); }
        if (V.t > 7 && !V.gave) { V.gave = true; const opts = ['bread', 'cabbage', 'ale', 'herbs', 'fish', 'meat'].filter((k) => G[k] && PS.canCarry && PS.canCarry(k)); const k = pick(opts.length ? opts : ['bread']); if (G[k] && PS.canCarry(k)) PS.add(k); O.gesture && O.gesture(q, 'give', 1.6); O.UI && O.UI.say && O.UI.say(`${q.first} leaves you ${({ bread: 'a fresh loaf', cabbage: 'a cabbage from their garden', ale: 'a jug of their own brewing', herbs: 'a bunch of sweet herbs', fish: 'a fish', meat: 'a cut of bacon' })[k] || 'a little something'}, wrapped in a cloth.`, 'good'); const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; r.familiar = Math.min(1, (r.familiar || 0) + 0.15); q.rel.set(0, r); }
        if (V.t > 12 && !V.bye) { V.bye = true; O.Speech && O.Speech.say(q, pick(['Well, I won\'t keep you. God bless this house.', 'I\'ll be off. Call on us, mind!']), 3); }
        if (V.t > 15) leave(); return; }
      if (!sc || !sc.b || !(sc.b.owner && sc.b.owner.kind === 'player')) return; const hr = s.minute / 60; if (hr < 9 || hr > 19) return; cool -= dt; if (cool > 0) return; cool = 150 + Math.random() * 150;
      const q = s.people.find((x) => x.alive !== false && x.agent && x.agent.inside == null && !x.agent.hidden && !x.agent.frozen && !x.errand && !talking(x) && x.age >= 14 && helped(x) && (lastBy.get(x.id) ?? -99) < s.day - 3); if (!q) return;
      lastBy.set(q.id, s.day); visits++; const a = q.agent; a.inside = sc.b.id; a.hidden = true; a.enteredAt = s.minute; a.path = null; a.frozen = true; q._visit = true; V = { q, b: sc.b, t: 0 }; O.sfx && O.sfx('door', 0.5, true);
      setTimeout(() => { if (V && V.q === q) O.UI && O.UI.say && O.UI.say(`A knock at the door: it is ${q.first}.`); }, 300); });
    (O.extraLines = O.extraLines || []).push((s, q) => V && V.q === q ? 'You have called at the stranger\'s house to thank them for a kindness they did you, with a small gift.' : '');
    O.HomeVisit = { get visits() { return visits; }, get visit() { return V; }, soon: () => { cool = 0; } };
  }
  O.HomeVisitSetup = { setup };
})();
