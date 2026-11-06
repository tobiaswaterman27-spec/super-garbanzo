// On the march. Take the King's coin and march, and the days on the road are lived, not skipped: men of
// your own town march beside you, and each night something asks an answer of you, given in your own
// words. Dice by the fire; an order to take a farmer's pig; a comrade hurt and slowing the column; the
// night watch, with sleep pulling at you; and the hedge by the road, where a man could slip away.
// What you do is paid, punished, and remembered by the men who march home with you.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, home = O.SimRef.home;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const yes = (t) => /\b(yes|aye|yeah|yh|ok|okay|sure|i will|i'?ll|do it|deal|fine|go on|carry|take|help|watch|stay|throw|play|deal me in)\b/i.test(t);
    const no = (t) => /\b(no|nay|won'?t|refuse|leave|not|never|rather not)\b/i.test(t);
    O.marchEvents = (side, done) => {
      const s = home, men = s.people.filter((q) => q.sex === 'm' && q.age >= 18 && q.age <= 40 && !q.visitor && q.alive !== false && !O.upright(s, q)).sort(() => Math.random() - 0.5).slice(0, 3);
      const comrade = (i) => men[i % Math.max(1, men.length)] || { first: 'Wat', name: 'Wat of the levy', id: -1 };
      const host = side === 'rebel' ? 'the rebel host' : "the King's host";
      let pay = 0, hpLoss = 0, deserted = false; const notes = [];
      const credit = (q, d, memory) => { if (q && q.id >= 0) { s.relate(q, { id: 0 }, d); if (memory) s.remember(q, memory, 'war', 2.5); } };
      const NIGHTS = [
        { text: () => `The first night out. You make camp in a hayfield with ${host}. ${comrade(0).first} from home has dice and a grin. "A game? Penny a throw."`,
          answer: (t) => { if (yes(t)) { const w = Math.random() < 0.5 + (PS.skills.gambling || 0) * 0.3; const n = 1 + Math.floor(Math.random() * 4); pay += w ? n : -n; credit(comrade(0), 0.1, `Diced with ${O.Forge?.player?.name || 'the stranger'} on the march.`); return `You throw till the fire's low. ${w ? `You come out ₳${n} the richer, and ${comrade(0).first} swears you cheat.` : `You lose ₳${n}, and ${comrade(0).first} buys you a drink with it.`}`; } credit(comrade(0), -0.02); return 'You turn in early. Your feet will thank you.'; } },
        { text: () => `The second day. The sergeant points at a farmhouse off the road. "That farmer's got a pig. The host is hungry. Fetch it." The farmer's wife watches from the door with her children.`,
          answer: (t) => { if (no(t) && !/\bnot\b.*\bno\b/.test(t)) { pay -= 2; notes.push('refused the pig'); return 'You refuse. The sergeant stops two days\' pay and calls you soft, but the farmer\'s wife crosses herself as you pass.'; } pay += 2; PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.05); notes.push('took the pig'); return 'You drag the pig squealing up the road. That night there is pork for the whole company, and the sergeant gives you an extra share. You don\'t look back at the farmhouse.'; } },
        { text: () => `On the fourth day ${comrade(1).first}'s foot goes bad: he can barely walk and the column is leaving him behind. "Don't leave me here," he says.`,
          answer: (t) => { if (yes(t) || /\b(carry|help|arm|shoulder)\b/i.test(t)) { hpLoss += 6; PS.energy = Math.max(0, PS.energy - 25); credit(comrade(1), 0.45, `${O.Forge?.player?.name || 'The stranger'} carried me on the march when my foot went. I owe them my life.`); notes.push(`carried ${comrade(1).first}`); return `You take his arm over your shoulder and half carry him for two days. Your back aches for a week. He doesn't forget it.`; } credit(comrade(1), -0.4, `${O.Forge?.player?.name || 'The stranger'} left me by the road on the march.`); return `You leave him on a milestone with a crust. He makes it home, in the end, but he won't look at you.`; } },
        { text: () => `Your turn at the night watch. The camp is asleep, the fires low. Your eyes close and open, close and open...`,
          answer: (t) => { if (/\b(sleep|rest|close|doze|lie down)\b/i.test(t) && !/\b(don'?t|not|stay awake)\b/i.test(t)) { if (Math.random() < 0.5) { pay -= 3; hpLoss += 8; notes.push('slept on watch'); return 'You drift off. The sergeant\'s boot wakes you at dawn: a flogging and three days\' pay stopped.'; } return 'You doze, and nobody comes. Lucky.'; } PS.skills.fighting = Math.min(1, (PS.skills.fighting || 0) + 0.01); return 'You pinch yourself awake and walk the lines till dawn. Nothing stirs but owls.'; } },
        { text: () => `The last night before the fighting. There's a gap in the hedge by the road, and no one watching it. ${comrade(2).first} whispers: "I'm going home. Come with me?"`,
          answer: (t) => { if (yes(t) && !/\bstay\b/i.test(t)) { deserted = true; credit(comrade(2), 0.2, `Slipped away from the host with ${O.Forge?.player?.name || 'the stranger'}.`); return 'You go through the hedge together and walk all night. Home by the back ways, with no pay and no glory, and a deserter\'s name if anyone asks.'; } credit(comrade(2), 0.05); return `You shake your head. ${comrade(2).first} goes alone. In the morning there are drums.`; } },
      ];
      let i = 0;
      const step = () => {
        if (deserted || i >= NIGHTS.length) {
          PS.money = Math.max(0, PS.money + pay); PS.hp = Math.max(10, PS.hp - hpLoss);
          if (deserted) { PS.enlisted = null; PS.deserter = { day: s.day, side }; for (let k = 0; k < 720 * 2; k++) { s.tick(2); PS.tick(2, k % 3 === 0); } s.log('A volunteer deserted the host and slipped home by the back ways.', 'war'); O.UI.say(`Home again, without the host. ${pay ? `₳${pay} to the good.` : ''}`, 'bad'); return; }
          for (const q of men) if (q.id >= 0) s.remember(q, `Marched with ${host} beside ${O.Forge?.player?.name || 'the stranger'}${notes.length ? ' (' + notes.join(', ') + ')' : ''}.`, 'war', 2);
          return done();
        }
        const n = NIGHTS[i++];
        O.UI.dialog.open({ name: i === 2 ? 'The sergeant' : 'On the march', color: '#5a3a1a', text: n.text(), options: [], chat: (t) => { const r = n.answer(t); O.UI.dialog.open({ name: 'On the march', color: '#5a3a1a', text: r, options: [], onClose: () => setTimeout(step, 200) }); } });
      };
      step();
    };
    (O.extraLines = O.extraLines || []).push(() => (PS.deserter ? 'Word is the player deserted the host on the march; you think less of them for it, unless you hate the war.' : ''));
  }
  O.MarchSetup = { setup };
})();
