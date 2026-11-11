// "Did you hear?" Folk who saw something today can't keep it in: as you pass, one calls out to you about it
// (the bull, the fire, the wedding, the friar), the way news goes round a town before supper. Not often:
// one now and then, and never the same person twice in a day.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const told = new Map(); let acc = 0, next = 0, calls = 0;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const OPEN = [[/bull/, 'Did you see the bull? Loose in the street! I near died.'], [/chimney/, 'Did you hear about the chimney? Went up like a torch.'], [/wheel|wagon/, 'There\'s a wagon broke down on the road. Lost a wheel, the fool.'], [/missing|little one|lost/, 'A child went missing today! Found, thank God.'], [/swarm|bees/, 'The bees swarmed today! Did you hear the pans?'], [/friar/, 'There was a friar at the cross, preaching fire. Gave me the shivers.'], [/truant/, 'The master caught a truant today. You should have heard him howl.'], [/christening/, 'There was a christening. Pennies for the children!'], [/tree/, 'They felled the big tree today. The whole street shook.'], [/hail/, 'Did you see that hail? Big as peas! My roof sounded like a drum.'], [/ploughed/, 'The ploughboys ploughed up old skinflint\'s step! Serves him right.']];
    game.hooks.update.push((dt) => { acc += dt; if (acc < 1) return; acc = 0; const s = cur(); if (!s || !s.people || game.scene || game.t < next) return; const P = game.player;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || q.errand || talking(q) || q.age < 8 || told.get(q.id) === s.day) continue; if (Math.hypot(a.x - P.x, a.y - P.y) > 50) continue;
        const b = (q.beliefs || []).find((x) => x.day === s.day && (x.src === 'seen' || x.src === 'rumour') && !/^The stranger(?!'s dog turned)/.test(x.t)); if (!b) continue; const o = OPEN.find(([re]) => re.test(b.t)); if (!o) continue;
        told.set(q.id, s.day); calls++; next = game.t + 90; a.dir = O.dirOf(P.x - a.x, P.y - a.y); O.gesture && O.gesture(q, 'talk', 1.6); O.Speech && O.Speech.say(q, o[1], 3); break; } });
    O.StreetNews = { get calls() { return calls; } };
  }
  O.StreetNewsSetup = { setup };
})();
