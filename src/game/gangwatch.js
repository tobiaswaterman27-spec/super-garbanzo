// The lookout's whistle. When the gang hangs about its corner of an evening there's always one of them
// with an eye on the street, and when the watch comes round on its rounds, the whistle goes: the dice
// vanish into sleeves, some of them stroll off whistling in different directions, the rest stand about
// looking at the sky like choirboys; the watchman eyes them, says "Move along", and walks on; and the
// minute his back's turned they're jeering after him and drifting back together.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const alerts = []; let acc = 0, warned = 0; const last = new Map();
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._gwatch = false; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene || !s.gangs) return;
      for (const A of alerts.slice()) { A.t += dt; const ga = A.guard.agent; const gone = !ga || ga.hidden || Math.hypot(ga.x - A.x, ga.y - A.y) > 220;
        A.stay.forEach((q, i) => { const a = q.agent; if (!q._gwatch) return; a.forceAnim = A.jeer ? (i % 2 ? 'laugh' : 'point') : ['look', 'idle', 'scratch', 'look'][(Math.floor(A.t / 2) + i) % 4]; });
        if (!A.eyed && A.t > 1.5 && ga && near(ga.x, ga.y, 320)) { A.eyed = true; O.gesture && O.gesture(A.guard, 'look', 1.6); O.Speech && O.Speech.say(A.guard, pick(['Move along, you lot.', 'I\'ve got my eye on you.', 'Evening. Up to no good, I don\'t doubt.']), 2.4); if (A.stay[0]) setTimeout(() => O.Speech && O.Speech.say(A.stay[0], pick(['Evening, constable!', 'Lovely night for it, sir.', 'Who, us?']), 2), 2200); }
        if ((gone && A.t > 5) || A.t > 18) { if (!A.jeer) { A.jeer = true; A.jt = A.t; if (A.stay[0] && near(A.x, A.y, 320)) O.Speech && O.Speech.say(A.stay[A.stay.length - 1] || A.stay[0], pick(['Ha! Waddle on, fat-boots!', 'Did you see his face?', 'Right. Where were we? Your throw.']), 2.2); } else if (A.t - A.jt > 3) { for (const q of A.stay) rel(q); alerts.splice(alerts.indexOf(A), 1); } }
        if (A.s !== s) { for (const q of A.stay) rel(q); alerts.splice(alerts.indexOf(A), 1); } }
      acc += dt; if (acc < 0.8) return; acc = 0; const hr = s.minute / 60; if (hr < 19 || hr >= 23.5) return;
      for (const g of s.gangs.values ? s.gangs.values() : Object.values(s.gangs)) { if (!g || !g.members || g.id === 'player' || alerts.some((A) => A.g === g)) continue; if ((last.get(g) || -99) > game.t - 60) continue;
        const out = g.members.map((m) => s.byId.get(m.id)).filter((q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && ((typeof q.activity?.zone === 'string' && q.activity.zone.startsWith('haunt:')) || q.activity?.act === 'gangmeet') && !q.agent.frozen && !q.errand && !talking(q)); if (out.length < 1) continue;
        const cx = out.reduce((a, q) => a + q.agent.x, 0) / out.length, cy = out.reduce((a, q) => a + q.agent.y, 0) / out.length; if (!near(cx, cy, 460)) continue;
        const guard = s.people.find((q) => q.agent && !q.agent.hidden && q.agent.inside == null && /guard|watch|sergeant|constable/.test(q.job?.role || '') && !q.gang && Math.hypot(q.agent.x - cx, q.agent.y - cy) < 150); if (!guard) continue;
        last.set(g, game.t); warned++;
        const look = out[0]; if (near(cx, cy, 340)) { O.Speech && O.Speech.say(look, pick(['Psst! The watch!', 'Heads up, lads. Blue coat.', 'Wheet-wheeoo! Cave!']), 1.8); O.sfx && O.sfx('pipe', 0.15); }
        const stay = [], go = []; out.forEach((q, i) => (i % 2 === 0 ? stay : go).push(q));
        for (const q of stay) { q._gwatch = true; q.agent.frozen = true; q.agent.path = null; q.agent.dir = q.agent.x < guard.agent.x ? 2 : 1; }
        for (const q of go) { const a = q.agent, ang = Math.random() * Math.PI * 2; O.Errands.send(s, q, [Math.floor((a.x + Math.cos(ang) * 120) / T), Math.floor((a.y + Math.sin(ang) * 80) / T)], { anim: 'idle', secs: 4, face: 0, giveUp: game.t + 25 }); }
        alerts.push({ s, g, guard, stay, go, x: cx, y: cy, t: 0 }); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const A = alerts.find((x) => x.stay.includes(q) || x.go.includes(q)); return !A ? (A === undefined && alerts.some((x) => x.guard === q) ? 'You are on your rounds and you have just walked past a knot of gang toughs who went very quiet when they saw you.' : '') : 'The watch has just come by your gang\'s corner and you are acting innocent until he has gone.'; });
    O.GangWatch = { alerts, get warned() { return warned; } };
  }
  O.GangWatchSetup = { setup };
})();
