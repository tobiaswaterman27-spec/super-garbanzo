// The hero of the hour. For a day or two after someone roped the bull or went up the ladder at the fire,
// folk who saw it stop them in the street: a slap on the back, a "Well roped, Cedric!", a laugh, and the
// hero looking at their boots and pleased as anything.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const heroes = new Map(); const done = new Set(); let acc = 0, praised = 0;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    game.hooks.update.push((dt) => { acc += dt; if (acc < 1) return; acc = 0; const s = cur(); if (!s || !s.people || game.scene) return;
      for (const [mod, kind] of [['LooseBull', 'bull'], ['ChimneyFire', 'fire']]) { let h = null; try { h = O[mod] && O[mod].hero; } catch (e) { h = null; } if (h && !heroes.has(h.id)) heroes.set(h.id, { q: h, kind, day: s.day }); }
      for (const [id, H] of heroes) { if (s.day - H.day > 2) { heroes.delete(id); continue; } const h = H.q, ha = h.agent; if (!ha || ha.hidden || ha.inside != null || ha.frozen || h.errand || talking(h) || !near(ha.x, ha.y, 300)) continue;
        const f = s.people.find((q) => q !== h && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !talking(q) && q.age >= 10 && !done.has(q.id + ':' + id + ':' + s.day) && Math.hypot(q.agent.x - ha.x, q.agent.y - ha.y) < 40 && (q.beliefs || []).some((b) => b.src === 'seen' && b.t.includes(h.first))); if (!f) continue;
        done.add(f.id + ':' + id + ':' + s.day); praised++; f.agent.dir = O.dirOf(ha.x - f.agent.x, ha.y - f.agent.y); ha.dir = O.dirOf(f.agent.x - ha.x, f.agent.y - ha.y);
        O.gesture && O.gesture(f, 'give', 1.4); O.Speech && O.Speech.say(f, pick(H.kind === 'bull' ? [`Well roped, ${h.first}!`, `There's the bull-tamer! ${h.first}, you mad devil!`, `${h.first}! I'll stand you a drink for that bull.`] : [`${h.first}, up that ladder like a cat! Well done.`, `Here's the fire-fighter! ${h.first}, you saved the street.`]), 2.6);
        setTimeout(() => { O.gesture && O.gesture(h, 'laugh', 1.6); O.Speech && O.Speech.say(h, pick(['Ah, it was nothing.', 'Somebody had to.', 'My knees are still shaking, mind.']), 2.2); }, 2200); try { s.relate(h, f, 0.03); } catch (e) { /* */ } break; } });
    O.HeroPraise = { get praised() { return praised; }, heroes };
  }
  O.HeroPraiseSetup = { setup };
})();
