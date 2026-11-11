// Remembered kindness. Someone you've helped (the mother whose child you brought home, the goodwife whose
// chimney you doused, the poor soul you gave your bread to) doesn't forget it: when you pass in the street
// they stop, smile, call out to you or press your hand; and those who only saw it nod to you as a decent
// sort. Once a day each, so it never grows tiresome.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const greeted = new Map(); let acc = 0, thanks = 0, nods = 0, gifts = 0; const PS = O.PlayerState, G = O.Data.GOODS;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const helped = (q) => (q.memories || []).find((m) => m.kind === 'kindness' && /stranger/i.test(m.text || ''));
    const saw = (q) => (q.beliefs || []).find((b) => b.src === 'seen' && /^The stranger/.test(b.t || '') && !/wretch|shameful/i.test(b.t || ''));
    const LINES = [[/child|little one/, ['God bless you! My little one still talks of you.', 'There\'s the one who brought my baby home!', 'I\'ll never forget what you did, friend.']], [/chimney|fire/, ['My thatch would be ashes but for you.', 'Our fire-fighter! Come and eat with us one day.']], [/bread|loaf/, ['God reward you for that loaf. I\'ve not forgotten.', 'You fed my children that day. Bless you.']], [/flood|bail/, ['You bailed my floor! The flour\'s dry now, thanks to you.', 'Our good neighbour from the flood!']], [/.*/, ['Friend! Good to see you.', 'God keep you, stranger. You\'re a good soul.']]];
    game.hooks.update.push((dt) => { acc += dt; if (acc < 0.7) return; acc = 0; const s = cur(); if (!s || !s.people || game.scene) return; const P = game.player;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || q.errand || talking(q) || q.age < 6) continue; if (Math.hypot(a.x - P.x, a.y - P.y) > 44) continue; if (greeted.get(q.id) === s.day) continue;
        const m = helped(q), b = !m && saw(q); if (!m && !b) continue; greeted.set(q.id, s.day);
        a.dir = O.dirOf(P.x - a.x, P.y - a.y);
        if (m) { thanks++; const set = LINES.find(([re]) => re.test(m.text))[1]; O.Speech && O.Speech.say(q, pick(set), 3); O.gesture && O.gesture(q, Math.random() < 0.5 ? 'wave' : 'bow', 1.6); const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; r.familiar = Math.min(1, (r.familiar || 0) + 0.05); q.rel.set(0, r);
          // and sometimes a little something pressed into your hand
          if (Math.random() < (q._gaveYou ? 0.1 : 0.45)) { const opts = ['bread', 'cabbage', 'firewood', 'flowers', 'fish', 'ale'].filter((k) => G[k] && PS.canCarry && PS.canCarry(k)); const k = opts[Math.floor(Math.random() * opts.length)]; if (k) { PS.add(k); q._gaveYou = true; gifts++; O.gesture && O.gesture(q, 'give', 1.2); setTimeout(() => O.UI && O.UI.say && O.UI.say(`${q.first} presses ${({ bread: 'a loaf', cabbage: 'a cabbage', firewood: 'a bundle of firewood', flowers: 'a posy', fish: 'a fish wrapped in a leaf', ale: 'a jug of ale' })[k]} on you and won't hear no.`, 'good'), 900); } } }
        else { nods++; O.gesture && O.gesture(q, 'nod', 1.2); if (Math.random() < 0.4) O.Speech && O.Speech.say(q, pick(['I saw what you did. Good on you.', 'You\'re the one, aren\'t you? Well done.', 'Good day to you, friend.']), 2.2); }
        break; } });
    O.Gratitude = { get gifts() { return gifts; }, get thanks() { return thanks; }, get nods() { return nods; }, greeted };
  }
  O.GratitudeSetup = { setup };
})();
