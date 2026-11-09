// The watch try the doors. Between their calling of the hours, a watchman on the night round goes along
// the shop fronts and gives each door a shove and a rattle of the latch to see it's fast, holding his
// lantern up to it; "Locked tight." Now and then one isn't, and he bangs on it till the shopkeeper comes
// down in his nightshirt, grumbling, to bolt it.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let cool = 15, checks = 0, open = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const watch = (q) => /guard|watch|constable|sergeant/.test(q.job?.role || '');
    const night = () => game.isNight && game.isNight();
    const SHOPS = new Set(['smithy', 'bakery', 'butcher', 'tailor', 'carpenter', 'chandler', 'store', 'grocer', 'cobbler', 'apothecary', 'jeweller', 'weaver', 'potter', 'cooper', 'tanner', 'moneylender', 'tavern', 'inn']);
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene || !night()) return; cool -= dt; if (cool > 0) return; cool = 12 + Math.random() * 12;
      const P = game.player, w = s.people.filter((q) => watch(q) && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !talking(q) && near(q.agent.x, q.agent.y, 600)); if (!w.length) return; const q = pick(w);
      const doors = s.world.buildings.filter((b) => SHOPS.has(b.type) && b.doorX != null && Math.hypot(b.doorX * T - q.agent.x, b.doorY * T - q.agent.y) < 260 && !game.lit?.has?.(b.id)); if (!doors.length) return;
      const b = pick(doors); checks++;
      O.Errands.send(s, q, [b.doorX, b.doorY + 1], { anim: 'open', secs: 1.6, face: 3, giveUp: game.t + 40, at: () => { if (near(q.agent.x, q.agent.y, 260)) O.sfx && O.sfx('door', 0.25); }, after: (ok) => {
        if (!ok) return; const unlocked = Math.random() < 0.08; if (!near(q.agent.x, q.agent.y, 300)) return;
        if (!unlocked) { if (Math.random() < 0.45) O.Speech && O.Speech.say(q, pick(['Locked tight.', 'All fast here.', 'Good. Snug as a drum.']), 1.8); return; }
        open++; O.Speech && O.Speech.say(q, pick(['This one\'s off the latch! Hoy! Wake up in there!', 'Unbarred, and the till inside. Wake up!']), 2.4); O.gesture && O.gesture(q, 'attack', 1.2); setTimeout(() => O.sfx && O.sfx('smack', 0.3), 300);
        const keeper = (s.biz.get(b.id)?.workers || []).map((id) => s.byId.get(id)).find((x) => x && x.agent && x.agent.inside === b.id) || s.people.find((x) => x.home === b.id && x.age > 18 && x.agent && x.agent.inside === b.id);
        if (keeper) setTimeout(() => { if (!keeper.agent || keeper.agent.inside !== b.id || keeper.agent.frozen || keeper.errand) return; const was = keeper.agent.inside; keeper.agent.x = b.doorX * T + 8; keeper.agent.y = (b.doorY + 1) * T + 6; keeper.agent.inside = null; keeper.agent.hidden = false; O.gesture && O.gesture(keeper, 'yawn', 2); O.Speech && O.Speech.say(keeper, pick(['All right, all right! I\'m coming!', 'Thank you, watchman. I\'d swear I barred it.', 'Can a man not sleep?']), 2.4); setTimeout(() => { if (keeper.agent && keeper.agent.inside == null) { keeper.agent.inside = was; keeper.agent.hidden = true; } }, 5000); }, 2500);
      } });
    });
    O.DoorCheck = { get checks() { return checks; }, get open() { return open; }, soon: () => { cool = 0; } };
  }
  O.DoorCheckSetup = { setup };
})();
