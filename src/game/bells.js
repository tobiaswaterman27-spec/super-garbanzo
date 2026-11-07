// The chapel bell keeps the day. It rings at first light, the Angelus at noon and at six (three and
// three and three, then nine), a long peal before Sunday mass, and the curfew at nine at night; it
// tolls slow for a funeral. Out in the street, at the Angelus folk stop where they stand, bow their
// heads and cross themselves, and then go on; at the curfew they hurry home.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let queue = [], last = -1;
    const vol = (s) => { const b = s.chapelId != null && s.building(s.chapelId); if (!b || b.doorX == null) return 0.25; const d = Math.hypot(b.doorX * 16 - game.player.x, b.doorY * 16 - game.player.y); return Math.max(0.12, 1 - d / 1400) * (game.scene ? 0.5 : 1); };
    function ring(s, pattern, gap = 1.6) { let t = 0; for (const n of pattern) { for (let i = 0; i < n; i++) { queue.push(t); t += gap; } t += gap * 1.8; } }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return; const m = Math.floor(s.minute), sunday = s.weekday === 6;
      if (m !== last) { const from = last < 0 || ((m - last + 1440) % 1440) > 30 ? m : last + 1; last = m; for (let mm0 = from; ; mm0++) { const m = ((mm0 % 1440) + 1440) % 1440;
        if (m === 6 * 60) ring(s, [5]);
        if (m === 12 * 60 || m === 18 * 60) { ring(s, [3, 3, 3, 9], 1.4); angelus(s); }
        if (sunday && m === 8 * 60 + 15) ring(s, [12], 1.1);
        if (m === 21 * 60) ring(s, [15], 2.2);
        if ((s.events || []).some((e) => e.kind === 'funeral' && e.day === s.day) && m === 9 * 60 + 40) ring(s, [10], 4);
        if (m === last) break; } }
      if (queue.length) { for (let i = 0; i < queue.length; i++) queue[i] -= dt; while (queue.length && queue[0] <= 0) { queue.shift(); O.sfx && O.sfx('churchbell', vol(s)); } }
    });
    function angelus(s) { for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || q.age < 6 || q._fighting || Math.hypot(a.x - game.player.x, a.y - game.player.y) > 500) continue; if (/guard|watch/.test(q.job?.role || '') && Math.random() < 0.5) continue; setTimeout(() => { if (a.hidden || a.inside != null) return; O.gesture && O.gesture(q, 'pray', 4 + Math.random() * 2); }, 300 + Math.random() * 1500); }
      if (Math.random() < 0.5) { const q = pick(s.people.filter((q) => q.agent && !q.agent.hidden && q.agent.inside == null && q.age > 40 && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 300)); if (q) setTimeout(() => O.Speech && O.Speech.say(q, pick(['The Angelus.', 'Angelus Domini...', 'Noon already.']), 1.8), 2000); } }
    O.Bells = { ring: (p) => ring(cur(), p || [3]), angelus: () => angelus(cur()), get queue() { return queue; } };
  }
  O.BellsSetup = { setup };
})();
