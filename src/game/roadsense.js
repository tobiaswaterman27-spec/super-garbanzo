// Nobody lies about in the road for no reason. Someone stretched out in the street is either taken ill
// (and then they groan and call for help, a passer-by or the bearers come before long, and you can help
// them up yourself) or is simply in the wrong pose, and gets up and goes on their way.
'use strict';
(function () {
  const DOWN = new Set(['lie', 'sleep', 'doze']);
  function setup(game) {
    const cur = () => O.SimRef.cur, P = () => game.player;
    let t0 = 0; O.roadFixes = 0;
    game.hooks.update.push((dt) => {
      t0 -= dt; if (t0 > 0) return; t0 = 2; const s = cur(); if (!s) return; const now = s.day * 1440 + s.minute;
      for (const q of s.people) {
        const a = q.agent; if (!a || a.hidden || a.inside != null || q.alive === false) continue;
        const g = a.gest && a.gest.until > performance.now() ? a.gest.anim : null;
        if (!DOWN.has(a.anim) && !DOWN.has(a.forceAnim) && !DOWN.has(g)) continue;
        const ill = q.activity?.act === 'collapsed' || q.health?.state === 'incapacitated' || (q.health?.hp ?? 100) <= 0 || q.carriedBy != null;
        if (!ill) { // a pose with no cause: up they get
          if (DOWN.has(a.forceAnim)) a.forceAnim = null; if (g) a.gest = null; a.anim = 'idle'; a.wait = 0; if (!a.path) a.goal = null; O.roadFixes++; continue;
        }
        // taken ill in the street: they call out, and help comes before long
        if (Math.hypot(a.x - P().x, a.y - P().y) < 160 && Math.random() < 0.18) O.Speech && O.Speech.say(q, ['Help... I can\'t get up.', 'Oh... my head...', 'Someone, please...', 'Fetch the physician...'][Math.floor(Math.random() * 4)], 3);
        if (q.collapsedAt != null && now - q.collapsedAt > 75 && !q.helper && !q._stretcherSent) {
          const h = s.people.filter((z) => z !== q && z.agent && !z.agent.hidden && z.agent.inside == null && !z.task && z.age >= 16 && !z.health.illness && z.activity?.act !== 'sleep').sort((u, v) => Math.hypot(u.agent.x - a.x, u.agent.y - a.y) - Math.hypot(v.agent.x - a.x, v.agent.y - a.y))[0];
          if (h) { q.helper = h.id; h.task = { act: 'help', target: q.id, outdoor: true }; s.remember(h, `Found ${q.name} lying in the street and went to help.`, 'health', 1, q.id); }
        }
      }
    });
    // you can help them up yourself
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(); if (!s || game.scene) return null; const p = P();
      const q = s.people.find((z) => z.agent && !z.agent.hidden && z.agent.inside == null && z.activity?.act === 'collapsed' && Math.hypot(z.agent.x - p.x, z.agent.y - p.y) < 26);
      if (!q) return null;
      return { type: 'custom', d: 10, x: q.agent.x, y: q.agent.y - 30, label: `Help ${q.first} up`, act: () => {
        O.gesture && (p.gest = { anim: 'take', from: performance.now(), until: performance.now() + 1200 });
        if (s.helpArrive) s.helpArrive({ task: { target: q.id }, id: 0 }); // (they're set on their feet and make for the physician or home)
        q.helper = null; s.relate && s.relate(q, { id: 0 }, 0.15); s.remember(q, 'The player helped me up when I fell ill in the street.', 'player', 1.4, 0.2);
        O.Speech && O.Speech.say(q, 'Bless you. I\'ll manage now, I think.', 3); O.Panels.toast(`You help ${q.first} to their feet.`);
      } };
    });
  }
  O.RoadSenseSetup = { setup };
})();
